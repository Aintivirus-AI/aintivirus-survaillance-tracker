import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { SourceService } from './source.service';

@Module({
  imports: [DatabaseModule],
  providers: [SourceService],
  exports: [SourceService],
})
export class SourceModule {}
