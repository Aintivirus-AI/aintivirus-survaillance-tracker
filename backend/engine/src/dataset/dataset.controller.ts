import {
  BadRequestException,
  Controller,
  Get,
  Header,
  NotFoundException,
  Param,
} from '@nestjs/common';
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

  /**
   * The dataset is ~42 MB. Express already emits an ETag for it, but without a
   * Cache-Control directive browsers had no basis to revalidate, and the client
   * additionally sent `cache: 'no-store'` — so every page load re-downloaded
   * the whole thing. A short max-age plus revalidation turns repeat loads into
   * a 304 instead of 42 MB.
   */
  @Get('dataset/latest')
  @Header('Cache-Control', 'public, max-age=60, stale-while-revalidate=300')
  async getLatestDataset() {
    return this.datasetService.buildLatestDataset();
  }

  @Get('dataset/export/latest')
  @Header('Cache-Control', 'public, max-age=60, stale-while-revalidate=300')
  async getLatestDatasetExport() {
    const dataset = await this.exportService.readLatestFromDisk();
    return dataset ?? this.datasetService.buildLatestDataset();
  }

  @Get('sources')
  @Header('Cache-Control', 'public, max-age=60')
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
  @Header('Cache-Control', 'public, max-age=60, stale-while-revalidate=300')
  async getSourceDataset(@Param('key') key: string) {
    if (!/^[a-z0-9_-]+$/i.test(key) || key.length > 64) {
      throw new BadRequestException(`Invalid source key`);
    }
    const dataset = await this.datasetService.buildSourceDataset(key);
    if (!dataset) {
      throw new NotFoundException(`Source "${key}" not found`);
    }
    return dataset;
  }
}
