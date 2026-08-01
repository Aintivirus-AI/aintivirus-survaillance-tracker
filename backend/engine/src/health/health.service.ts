import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { DataSource } from 'typeorm';
import { SourceService } from '../sources/source.service';
import { INGEST_QUEUE } from '../queues/queues.constants';
import {
  ComponentReport,
  HealthReport,
  IngestionSummary,
} from './health.types';

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  /** No successful ingest within this window means the data is stale. */
  private static readonly DEFAULT_STALE_AFTER_MS = 26 * 60 * 60 * 1000;

  constructor(
    private readonly dataSource: DataSource,
    private readonly sourceService: SourceService,
    @InjectQueue(INGEST_QUEUE) private readonly ingestQueue: Queue,
    private readonly configService?: ConfigService,
  ) {}

  private get staleAfterMs(): number {
    return (
      this.configService?.get<number>('health.ingestionStaleAfterMs') ??
      HealthService.DEFAULT_STALE_AFTER_MS
    );
  }

  async check(): Promise<HealthReport> {
    const database = await this.checkDatabase();
    const redis = await this.checkRedis();
    const queue = await this.checkQueue();
    const ingestion = await this.buildIngestionSummary();

    const components = { database, redis, queue, ingestion };
    const overallStatus = this.computeOverallStatus(components);

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      components,
    };
  }

  private async checkDatabase(): Promise<ComponentReport> {
    const started = performance.now();
    try {
      await this.dataSource.query('SELECT 1');
      return {
        status: 'ok',
        latencyMs: performance.now() - started,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Database health check failed: ${message}`);
      return {
        status: 'error',
        latencyMs: performance.now() - started,
        error: message,
      };
    }
  }

  private async checkRedis(): Promise<ComponentReport> {
    const started = performance.now();
    try {
      await this.ingestQueue.waitUntilReady();
      // `waitUntilReady` ensures the queue connection is alive.
      return {
        status: 'ok',
        latencyMs: performance.now() - started,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Redis health check failed: ${message}`);
      return {
        status: 'error',
        latencyMs: performance.now() - started,
        error: message,
      };
    }
  }

  private async checkQueue(): Promise<
    ComponentReport<Record<string, unknown>>
  > {
    const started = performance.now();
    try {
      const counts = await this.ingestQueue.getJobCounts(
        'waiting',
        'active',
        'failed',
        'delayed',
        'completed',
      );

      // BullMQ keeps failed jobs until they are explicitly removed, so
      // `failed > 0` meant a single failure months ago pinned the service to
      // "degraded" for the rest of its life. Health should describe the
      // service *now*: report degraded only when work is currently stuck or
      // failures dominate recent completions.
      const failed = counts.failed ?? 0;
      const completed = counts.completed ?? 0;
      const waiting = counts.waiting ?? 0;
      const status = this.classifyQueue(failed, completed, waiting);

      return {
        status,
        latencyMs: performance.now() - started,
        meta: { ...counts, failureRatio: this.failureRatio(failed, completed) },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Queue health check failed: ${message}`);
      return {
        status: 'error',
        latencyMs: performance.now() - started,
        error: message,
      };
    }
  }

  /** Failures as a share of recent terminal jobs. 0 when nothing has run. */
  private failureRatio(failed: number, completed: number): number {
    const terminal = failed + completed;
    if (terminal === 0) return 0;
    return Math.round((failed / terminal) * 100) / 100;
  }

  private classifyQueue(
    failed: number,
    completed: number,
    waiting: number,
  ): 'ok' | 'degraded' {
    // A backlog means jobs are not being drained right now.
    if (waiting > 50) return 'degraded';
    // Retained failures with no successes at all is worth flagging...
    if (failed > 0 && completed === 0) return 'degraded';
    // ...otherwise judge by proportion, not by the mere existence of a failure.
    return this.failureRatio(failed, completed) > 0.25 ? 'degraded' : 'ok';
  }

  private async buildIngestionSummary(): Promise<
    ComponentReport<IngestionSummary>
  > {
    try {
      const sources = await this.sourceService.listSources();
      const totals = sources.reduce(
        (acc, source) => {
          acc.totalRecords += source.totalRecords ?? 0;
          const timestamp = source.lastIngestedAt?.toISOString() ?? null;
          if (
            !acc.lastIngestedAt ||
            (timestamp && timestamp > acc.lastIngestedAt)
          ) {
            acc.lastIngestedAt = timestamp;
          }
          return acc;
        },
        {
          lastIngestedAt: null as string | null,
          sourcesTracked: sources.length,
          totalRecords: 0,
        },
      );

      const summary: IngestionSummary = {
        lastIngestedAt: totals.lastIngestedAt,
        sourcesTracked: totals.sourcesTracked,
        totalRecords: totals.totalRecords,
      };

      // Previously this was `sourcesTracked > 0 ? 'ok' : 'degraded'`, which is
      // a check that the *configuration* exists, not that ingestion works.
      // Production ran 45 days with no successful ingest — disk was full — and
      // reported "ok" the entire time. Staleness is the signal that matters.
      return {
        status: this.classifyIngestion(summary.lastIngestedAt ?? null),
        meta: summary,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to compute ingestion summary: ${message}`);
      return {
        status: 'error',
        error: message,
        meta: {
          lastIngestedAt: null,
          sourcesTracked: 0,
          totalRecords: 0,
        },
      };
    }
  }

  /**
   * `error` when nothing has ever ingested or the last run is far past due,
   * `degraded` once it slips beyond the freshness window.
   */
  private classifyIngestion(
    lastIngestedAt: string | null,
    now: number = Date.now(),
  ): 'ok' | 'degraded' | 'error' {
    if (!lastIngestedAt) return 'error';

    const last = Date.parse(lastIngestedAt);
    if (Number.isNaN(last)) return 'error';

    const age = now - last;
    if (age >= this.staleAfterMs * 4) return 'error';
    if (age >= this.staleAfterMs) return 'degraded';
    return 'ok';
  }

  private computeOverallStatus(components: HealthReport['components']) {
    if (
      components.database.status === 'error' ||
      components.redis.status === 'error' ||
      components.queue.status === 'error' ||
      // Ingestion errors were previously invisible at the top level, so a
      // service serving 45-day-old data still reported "degraded" at worst.
      components.ingestion.status === 'error'
    ) {
      return 'error' as const;
    }

    if (
      components.database.status === 'degraded' ||
      components.redis.status === 'degraded' ||
      components.queue.status === 'degraded' ||
      components.ingestion.status === 'degraded'
    ) {
      return 'degraded' as const;
    }

    return 'ok' as const;
  }
}
