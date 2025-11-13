import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { SourceModule } from '../sources/source.module';
import { DatasetService } from './dataset.service';
import { ExportService } from './export.service';
import { DatasetController } from './dataset.controller';

@Module({
  imports: [DatabaseModule, SourceModule],
  controllers: [DatasetController],
  providers: [DatasetService, ExportService],
  exports: [DatasetService, ExportService],
})
export class DatasetModule {}
