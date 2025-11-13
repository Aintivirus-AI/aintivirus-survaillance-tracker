import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { INGEST_QUEUE } from './queues.constants';
import { IngestProducer } from './ingest.producer';
import { IngestProcessor } from './ingest.processor';
import { IngestOrchestrator } from './ingest.orchestrator';
import { IngestPersistenceService } from './ingest.persistence.service';
import { SourceModule } from '../sources/source.module';
import { DatabaseModule } from '../database/database.module';
import { DatasetModule } from '../dataset/dataset.module';
import { ConnectorsModule } from '../connectors/connectors.module';

@Module({
  imports: [
    DatabaseModule,
    SourceModule,
    DatasetModule,
    ConnectorsModule,
    BullModule.registerQueue({
      name: INGEST_QUEUE,
    }),
  ],
  providers: [
    IngestProducer,
    IngestProcessor,
    IngestOrchestrator,
    IngestPersistenceService,
  ],
  exports: [IngestProducer],
})
export class QueuesModule {}
