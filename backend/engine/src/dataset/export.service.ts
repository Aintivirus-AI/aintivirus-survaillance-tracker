import { Injectable, Logger } from '@nestjs/common';
import { promises as fs } from 'fs';
import { dirname, join } from 'path';
import { DatasetService } from './dataset.service';
import { LatestDataset } from './dataset.types';

@Injectable()
export class ExportService {
  private readonly logger = new Logger(ExportService.name);

  constructor(private readonly datasetService: DatasetService) {}

  // Resolve at call time — production uses the service's runtime cwd,
  // tests change cwd to a sandbox before calling.
  private exportDirectory(): string {
    return join(process.cwd(), 'exports');
  }

  private archiveDirectory(): string {
    return join(this.exportDirectory(), 'archive');
  }

  async writeLatestSnapshot(): Promise<LatestDataset> {
    const dataset = await this.datasetService.buildLatestDataset();
    const exportDir = this.exportDirectory();
    const archiveDir = this.archiveDirectory();

    await fs.mkdir(exportDir, { recursive: true });
    await this.writeJsonAtomic(join(exportDir, 'latest.json'), dataset);

    await fs.mkdir(archiveDir, { recursive: true });
    const versionedName = `dataset-${dataset.generatedAt
      .replace(/[:.]/g, '-')
      .replace(/Z$/, '')}.json`;
    await this.writeJsonAtomic(join(archiveDir, versionedName), dataset);

    return dataset;
  }

  async readLatestFromDisk(): Promise<LatestDataset | null> {
    try {
      const raw = await fs.readFile(
        join(this.exportDirectory(), 'latest.json'),
        'utf-8',
      );
      return JSON.parse(raw) as LatestDataset;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Unable to read latest export from disk: ${message}`);
      return null;
    }
  }

  /**
   * Write JSON atomically: serialize to a sibling .tmp file, fsync, then rename.
   * rename(2) is atomic on POSIX — a crash mid-write leaves either the old file
   * intact or the new file complete, never a half-written `latest.json`.
   */
  private async writeJsonAtomic(path: string, payload: LatestDataset): Promise<void> {
    const tmpPath = `${path}.tmp-${process.pid}-${Date.now()}`;
    const body = JSON.stringify(payload, null, 2);

    const handle = await fs.open(tmpPath, 'w');
    try {
      await handle.writeFile(body, 'utf-8');
      // Flush to disk before rename so we don't hand nginx/caches a 0-byte file
      // on a sudden host power-loss after the rename.
      await handle.sync();
    } finally {
      await handle.close();
    }

    try {
      await fs.rename(tmpPath, path);
    } catch (error) {
      // Cleanup the stale tmp on rename failure; re-throw so the caller sees it.
      await fs.rm(tmpPath, { force: true }).catch(() => {
        /* best-effort cleanup */
      });
      throw error;
    }

    // fsync the parent directory so the rename itself is durable on crash.
    const dirHandle = await fs.open(dirname(path), 'r').catch(() => null);
    if (dirHandle) {
      try {
        await dirHandle.sync();
      } catch {
        // some filesystems (e.g. tmpfs) reject fsync on dirs; ignore
      } finally {
        await dirHandle.close();
      }
    }

    this.logger.log(`Wrote dataset export to ${path}`);
  }
}
