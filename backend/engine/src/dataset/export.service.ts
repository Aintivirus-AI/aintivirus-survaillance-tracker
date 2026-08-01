import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { promises as fs } from 'fs';
import { dirname, join } from 'path';
import { DatasetService } from './dataset.service';
import { LatestDataset } from './dataset.types';

/** Matches the timestamped names written by writeLatestSnapshot. */
const ARCHIVE_PATTERN = /^dataset-.*\.json$/;

@Injectable()
export class ExportService {
  private readonly logger = new Logger(ExportService.name);

  constructor(
    private readonly datasetService: DatasetService,
    private readonly configService?: ConfigService,
  ) {}

  private get archiveRetention(): number {
    return this.configService?.get<number>('exports.archiveRetention') ?? 10;
  }

  private get prettyPrint(): boolean {
    return this.configService?.get<boolean>('exports.pretty') ?? false;
  }

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

    // Prune AFTER the new snapshot lands, so a failure here never leaves the
    // archive emptier than it started.
    await this.pruneArchive();

    return dataset;
  }

  /**
   * Keep the newest `archiveRetention` snapshots and delete the rest.
   *
   * Each snapshot is a full copy of the dataset. Without this, they simply
   * accumulated: 138 of them (~8.2 GB) filled the production root volume,
   * which stopped ingestion and expired the TLS certificate for every
   * aintivirus.ai host. Pruning is best-effort — a failure here must not fail
   * the export that just succeeded.
   */
  async pruneArchive(): Promise<number> {
    const archiveDir = this.archiveDirectory();
    const keep = this.archiveRetention;

    try {
      const entries = await fs.readdir(archiveDir);
      // Names are ISO-8601 derived, so lexical order is chronological order.
      const snapshots = entries.filter((n) => ARCHIVE_PATTERN.test(n)).sort();

      if (snapshots.length <= keep) return 0;

      const doomed = snapshots.slice(0, snapshots.length - keep);
      let removed = 0;
      for (const name of doomed) {
        try {
          await fs.rm(join(archiveDir, name), { force: true });
          removed++;
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          this.logger.warn(`Could not prune ${name}: ${message}`);
        }
      }

      if (removed > 0) {
        this.logger.log(
          `Pruned ${removed} archived snapshot(s), keeping the newest ${keep}`,
        );
      }
      return removed;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Archive prune skipped: ${message}`);
      return 0;
    }
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
    const body = JSON.stringify(payload, null, this.prettyPrint ? 2 : undefined);

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
