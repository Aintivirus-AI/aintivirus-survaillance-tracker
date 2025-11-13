import { Injectable, Logger } from '@nestjs/common';
import { promises as fs } from 'fs';
import { join } from 'path';
import { DatasetService } from './dataset.service';
import { LatestDataset } from './dataset.types';

const EXPORT_DIRECTORY = join(process.cwd(), 'exports');
const ARCHIVE_DIRECTORY = join(EXPORT_DIRECTORY, 'archive');

@Injectable()
export class ExportService {
  private readonly logger = new Logger(ExportService.name);

  constructor(private readonly datasetService: DatasetService) {}

  async writeLatestSnapshot(): Promise<LatestDataset> {
    const dataset = await this.datasetService.buildLatestDataset();
    await fs.mkdir(EXPORT_DIRECTORY, { recursive: true });
    await this.writeJson(join(EXPORT_DIRECTORY, 'latest.json'), dataset);

    await fs.mkdir(ARCHIVE_DIRECTORY, { recursive: true });
    const versionedName = `dataset-${dataset.generatedAt
      .replace(/[:.]/g, '-')
      .replace(/Z$/, '')}.json`;
    await this.writeJson(join(ARCHIVE_DIRECTORY, versionedName), dataset);

    return dataset;
  }

  async readLatestFromDisk(): Promise<LatestDataset | null> {
    try {
      const raw = await fs.readFile(
        join(EXPORT_DIRECTORY, 'latest.json'),
        'utf-8',
      );
      return JSON.parse(raw) as LatestDataset;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Unable to read latest export from disk: ${message}`);
      return null;
    }
  }

  private async writeJson(path: string, payload: LatestDataset): Promise<void> {
    await fs.writeFile(path, JSON.stringify(payload, null, 2), 'utf-8');
    this.logger.log(`Wrote dataset export to ${path}`);
  }
}
