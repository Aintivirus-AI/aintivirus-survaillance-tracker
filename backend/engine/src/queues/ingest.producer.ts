import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { JobsOptions, Queue } from 'bullmq';
import { INGEST_JOB, INGEST_QUEUE } from './queues.constants';
import { IngestJobData } from './queue.types';
import { ConnectorMetadata } from '../connectors/connector.types';

type RepeatableJobInfo = {
  key: string;
  pattern?: string;
  cron?: string;
};

@Injectable()
export class IngestProducer {
  private readonly logger = new Logger(IngestProducer.name);

  constructor(@InjectQueue(INGEST_QUEUE) private readonly queue: Queue) {}

  async enqueue(data: IngestJobData, delayMs?: number): Promise<void> {
    await this.queue.add(INGEST_JOB, data, {
      jobId: `${data.connectorId}:${Date.now()}`,
      removeOnComplete: true,
      removeOnFail: 10,
      delay: delayMs,
    });
  }

  async ensureRecurring(metadata: ConnectorMetadata): Promise<void> {
    const repeatableJobs = await this.queue.getRepeatableJobs();
    const existing = repeatableJobs.find(
      (job) => job.name === INGEST_JOB && job.id === metadata.id,
    ) as RepeatableJobInfo | undefined;

    if (existing) {
      const currentPattern = existing.pattern ?? existing.cron;
      if (currentPattern === metadata.schedule) {
        return;
      }

      this.logger.log(
        `Updating recurring schedule for ${metadata.id} from ${currentPattern} to ${metadata.schedule}`,
      );
      await this.queue.removeRepeatableByKey(existing.key);
    }

    const options: JobsOptions = {
      jobId: metadata.id,
      repeat: {
        pattern: metadata.schedule,
        jobId: metadata.id,
      },
      removeOnComplete: true,
      removeOnFail: 50,
    };

    try {
      await this.queue.add(INGEST_JOB, { connectorId: metadata.id }, options);
      this.logger.log(`Scheduled recurring ingest job for ${metadata.id}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Failed to schedule recurring ingest for ${metadata.id}: ${message}`,
      );
      throw error;
    }
  }

  async pruneStaleRecurring(validConnectorIds: Set<string>): Promise<void> {
    const repeatableJobs = await this.queue.getRepeatableJobs();
    const staleJobs = repeatableJobs.filter(
      (job) =>
        job.name === INGEST_JOB &&
        typeof job.id === 'string' &&
        !validConnectorIds.has(job.id),
    );

    for (const stale of staleJobs) {
      try {
        await this.queue.removeRepeatableByKey(stale.key);
        this.logger.log(
          `Removed stale recurring ingest job for ${stale.id ?? 'unknown'}`,
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error(
          `Failed to remove stale ingest job for ${stale.id ?? 'unknown'}: ${message}`,
        );
      }
    }

    const pendingJobs = await this.queue.getJobs(['waiting', 'delayed']);
    for (const job of pendingJobs) {
      const connectorId =
        job.name === INGEST_JOB &&
        job.data &&
        typeof (job.data as IngestJobData).connectorId === 'string'
          ? (job.data as IngestJobData).connectorId
          : undefined;

      if (connectorId && !validConnectorIds.has(connectorId)) {
        const jobId = job.id?.toString();
        try {
          await job.remove();
          this.logger.log(`Removed pending ingest job for ${connectorId}`);
          continue;
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);

          if (
            error instanceof Error &&
            job.repeatJobKey &&
            message.includes('job scheduler')
          ) {
            try {
              await this.queue.removeRepeatableByKey(job.repeatJobKey);
              if (jobId) {
              await this.queue.remove(jobId);
              }
              this.logger.log(
                `Removed repeatable pending ingest job for ${connectorId}`,
              );
              continue;
            } catch (cleanupError) {
              const cleanupMessage =
                cleanupError instanceof Error
                  ? cleanupError.message
                  : String(cleanupError);
              this.logger.error(
                `Failed cleanup for pending ingest job ${connectorId}: ${cleanupMessage}`,
              );
              continue;
            }
          }

          this.logger.error(
            `Failed to remove pending ingest job for ${connectorId}: ${message}`,
          );
        }
      }
    }
  }
}
