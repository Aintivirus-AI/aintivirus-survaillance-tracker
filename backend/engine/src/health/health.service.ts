import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
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

  constructor(
    private readonly dataSource: DataSource,
    private readonly sourceService: SourceService,
    @InjectQueue(INGEST_QUEUE) private readonly ingestQueue: Queue,
  ) {}

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

      const status =
        (counts.failed ?? 0) > 0 ? ('degraded' as const) : ('ok' as const);

      return {
        status,
        latencyMs: performance.now() - started,
        meta: counts,
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

      return {
        status: summary.sourcesTracked > 0 ? 'ok' : 'degraded',
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

  private computeOverallStatus(components: HealthReport['components']) {
    if (
      components.database.status === 'error' ||
      components.redis.status === 'error' ||
      components.queue.status === 'error'
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
