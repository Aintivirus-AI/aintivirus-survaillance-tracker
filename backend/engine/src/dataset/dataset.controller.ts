import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { DatasetService } from './dataset.service';
import { ExportService } from './export.service';
import { SourceService } from '../sources/source.service';

@Controller('api')
export class DatasetController {
  constructor(
    private readonly datasetService: DatasetService,
    private readonly exportService: ExportService,
    private readonly sourceService: SourceService,
  ) {}

  @Get('dataset/latest')
  async getLatestDataset() {
    return this.datasetService.buildLatestDataset();
  }

  @Get('dataset/export/latest')
  async getLatestDatasetExport() {
    const dataset = await this.exportService.readLatestFromDisk();
    return dataset ?? this.datasetService.buildLatestDataset();
  }

  @Get('sources')
  async listSources() {
    const sources = await this.sourceService.listSources();
    return sources.map((source) => ({
      key: source.key,
      title: source.title,
      description: source.description,
      kind: source.kind,
      homepage: source.homepage,
      schedule: source.schedule,
      lastRevision: source.lastRevision,
      lastIngestedAt: source.lastIngestedAt
        ? source.lastIngestedAt.toISOString()
        : null,
      totalRecords: source.totalRecords,
      createdAt: source.createdAt.toISOString(),
      updatedAt: source.updatedAt.toISOString(),
    }));
  }

  @Get('sources/:key')
  async getSourceDataset(@Param('key') key: string) {
    const dataset = await this.datasetService.buildSourceDataset(key);
    if (!dataset) {
      throw new NotFoundException(`Source "${key}" not found`);
    }
    return dataset;
  }
}
