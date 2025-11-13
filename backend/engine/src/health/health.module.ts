import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { DatabaseModule } from '../database/database.module';
import { SourceModule } from '../sources/source.module';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { INGEST_QUEUE } from '../queues/queues.constants';

@Module({
  imports: [
    DatabaseModule,
    SourceModule,
    BullModule.registerQueue({
      name: INGEST_QUEUE,
    }),
  ],
  controllers: [HealthController],
  providers: [HealthService],
})
export class HealthModule {}
