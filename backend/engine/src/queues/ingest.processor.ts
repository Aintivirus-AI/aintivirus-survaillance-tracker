import { Logger } from '@nestjs/common';
import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { INGEST_QUEUE } from './queues.constants';
import { IngestJobData } from './queue.types';
import { ConnectorRegistry } from '../connectors/connector.registry';
import { IngestPersistenceService } from './ingest.persistence.service';
import { ExportService } from '../dataset/export.service';

@Processor(INGEST_QUEUE)
export class IngestProcessor extends WorkerHost {
  private readonly logger = new Logger(IngestProcessor.name);

  constructor(
    private readonly connectorRegistry: ConnectorRegistry,
    private readonly persistenceService: IngestPersistenceService,
    private readonly exportService: ExportService,
  ) {
    super();
  }

  async process(job: Job<IngestJobData>): Promise<unknown> {
    this.logger.debug(
      `Received ingest job ${job.id} for connector ${job.data.connectorId}`,
    );
    await job.updateProgress(5);

    const connector = this.connectorRegistry.get(job.data.connectorId);
    if (!connector) {
      throw new Error(`Connector "${job.data.connectorId}" not registered`);
    }

    const result = await connector.collect({
      jobId: String(job.id),
      attempt: job.attemptsMade + 1,
      scheduledFor: new Date(job.timestamp),
    });

    const snapshot = await this.persistenceService.persist(connector, result);
    await this.exportService.writeLatestSnapshot();

    await job.updateProgress(100);
    this.logger.log(
      `Connector ${connector.metadata.id} processed ${result.records.length} records (snapshot ${snapshot.id})`,
    );
    return result;
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<IngestJobData>, err: Error): void {
    this.logger.error(
      `Job ${job.id} failed for connector ${job.data.connectorId}: ${err.message}`,
      err.stack,
    );
  }
}
