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
      // `failed > 0` pinned the service to "degraded" for the rest of its life
      // after a single failure. Counting successes doesn't help either: the
      // producer sets removeOnComplete: true, so `completed` is always 0.
      //
      // What actually indicates a problem *now* is a recent failure or a
      // backlog that isn't draining.
      const failed = counts.failed ?? 0;
      const waiting = counts.waiting ?? 0;
      const recentFailures = failed > 0 ? await this.countRecentFailures() : 0;
      const status = this.classifyQueue(recentFailures, waiting);

      return {
        status,
        latencyMs: performance.now() - started,
        meta: { ...counts, recentFailures },
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

  /**
   * How many retained failures happened inside the freshness window.
   *
   * Retained failures are a log, not a status: an ingest that failed once in
   * June says nothing about whether the queue works today.
   */
  private async countRecentFailures(now: number = Date.now()): Promise<number> {
    try {
      const jobs = await this.ingestQueue.getJobs(['failed'], 0, 50);
      const cutoff = now - this.staleAfterMs;
      return jobs.filter((job) => {
        const at = job?.finishedOn ?? job?.timestamp ?? 0;
        return typeof at === 'number' && at >= cutoff;
      }).length;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Could not inspect failed jobs: ${message}`);
      // Unknown is not the same as broken — don't invent a failure.
      return 0;
    }
  }

  private classifyQueue(
    recentFailures: number,
    waiting: number,
  ): 'ok' | 'degraded' {
    // A backlog means jobs are not being drained right now.
    if (waiting > 50) return 'degraded';
    return recentFailures > 0 ? 'degraded' : 'ok';
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
