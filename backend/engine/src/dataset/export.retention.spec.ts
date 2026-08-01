import { promises as fs } from 'fs';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { ConfigService } from '@nestjs/config';
import { ExportService } from './export.service';
import { DatasetService } from './dataset.service';
import { LatestDataset } from './dataset.types';

/**
 * Archive retention.
 *
 * Every export writes a full copy of the dataset (~64 MB in production) into
 * exports/archive. Nothing pruned them: 138 accumulated, filled the 28 GB root
 * volume on 2026-06-17, and that stopped ingestion, blocked certbot renewal and
 * took every aintivirus.ai host offline when the certificate expired.
 */
describe('ExportService archive retention', () => {
  let sandbox: string;
  let originalCwd: string;

  const dataset = (generatedAt: string): LatestDataset => ({
    generatedAt,
    sources: [],
  });

  const makeService = (retention?: number, pretty?: boolean) => {
    const datasetService = {
      buildLatestDataset: jest
        .fn()
        .mockResolvedValue(dataset('2026-08-01T12:00:00.000Z')),
    } as unknown as DatasetService;

    const config = {
      get: (key: string) => {
        if (key === 'exports.archiveRetention') return retention;
        if (key === 'exports.pretty') return pretty;
        return undefined;
      },
    } as unknown as ConfigService;

    return new ExportService(datasetService, config);
  };

  const archiveDir = () => join(process.cwd(), 'exports', 'archive');

  const seedArchive = async (names: string[]) => {
    await fs.mkdir(archiveDir(), { recursive: true });
    for (const name of names) {
      await fs.writeFile(join(archiveDir(), name), '{}');
    }
  };

  const listArchive = async () => (await fs.readdir(archiveDir())).sort();

  beforeEach(() => {
    originalCwd = process.cwd();
    sandbox = mkdtempSync(join(tmpdir(), 'export-retention-'));
    process.chdir(sandbox);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    rmSync(sandbox, { recursive: true, force: true });
  });

  describe('pruneArchive', () => {
    it('keeps the newest N snapshots and deletes the rest', async () => {
      await seedArchive([
        'dataset-2026-01-01T00-00-00-000.json',
        'dataset-2026-02-01T00-00-00-000.json',
        'dataset-2026-03-01T00-00-00-000.json',
        'dataset-2026-04-01T00-00-00-000.json',
        'dataset-2026-05-01T00-00-00-000.json',
      ]);

      const removed = await makeService(2).pruneArchive();

      expect(removed).toBe(3);
      expect(await listArchive()).toEqual([
        'dataset-2026-04-01T00-00-00-000.json',
        'dataset-2026-05-01T00-00-00-000.json',
      ]);
    });

    it('deletes oldest-first, since names sort chronologically', async () => {
      await seedArchive([
        'dataset-2026-05-01T00-00-00-000.json',
        'dataset-2026-01-01T00-00-00-000.json',
        'dataset-2026-03-01T00-00-00-000.json',
      ]);

      await makeService(1).pruneArchive();

      expect(await listArchive()).toEqual(['dataset-2026-05-01T00-00-00-000.json']);
    });

    it('does nothing when the archive is already within the limit', async () => {
      await seedArchive([
        'dataset-2026-01-01T00-00-00-000.json',
        'dataset-2026-02-01T00-00-00-000.json',
      ]);

      expect(await makeService(10).pruneArchive()).toBe(0);
      expect(await listArchive()).toHaveLength(2);
    });

    it('does nothing when the count exactly equals the limit', async () => {
      await seedArchive([
        'dataset-2026-01-01T00-00-00-000.json',
        'dataset-2026-02-01T00-00-00-000.json',
      ]);

      expect(await makeService(2).pruneArchive()).toBe(0);
      expect(await listArchive()).toHaveLength(2);
    });

    it('leaves unrelated files alone', async () => {
      await seedArchive([
        'dataset-2026-01-01T00-00-00-000.json',
        'dataset-2026-02-01T00-00-00-000.json',
        'dataset-2026-03-01T00-00-00-000.json',
        'README.md',
        'notes.txt',
      ]);

      await makeService(1).pruneArchive();

      const remaining = await listArchive();
      expect(remaining).toContain('README.md');
      expect(remaining).toContain('notes.txt');
      expect(remaining.filter((n) => n.startsWith('dataset-'))).toHaveLength(1);
    });

    it('returns 0 rather than throwing when the archive does not exist', async () => {
      await expect(makeService(5).pruneArchive()).resolves.toBe(0);
    });

    it('defaults to keeping 10 when unconfigured', async () => {
      const names = Array.from({ length: 15 }, (_, i) =>
        `dataset-2026-01-${String(i + 1).padStart(2, '0')}T00-00-00-000.json`);
      await seedArchive(names);

      await makeService(undefined).pruneArchive();

      expect(await listArchive()).toHaveLength(10);
    });
  });

  describe('writeLatestSnapshot', () => {
    it('prunes as part of a normal export', async () => {
      const names = Array.from({ length: 8 }, (_, i) =>
        `dataset-2026-01-0${i + 1}T00-00-00-000.json`);
      await seedArchive(names);

      await makeService(3).writeLatestSnapshot();

      // 8 seeded + 1 new, pruned back to 3.
      expect(await listArchive()).toHaveLength(3);
    });

    it('keeps the snapshot it just wrote', async () => {
      await seedArchive([
        'dataset-2026-01-01T00-00-00-000.json',
        'dataset-2026-01-02T00-00-00-000.json',
      ]);

      await makeService(1).writeLatestSnapshot();

      expect(await listArchive()).toEqual(['dataset-2026-08-01T12-00-00-000.json']);
    });

    it('still writes latest.json', async () => {
      await makeService(2).writeLatestSnapshot();

      const raw = await fs.readFile(join(process.cwd(), 'exports', 'latest.json'), 'utf-8');
      expect(JSON.parse(raw).generatedAt).toBe('2026-08-01T12:00:00.000Z');
    });

    // Retention has to bound growth over many runs, not just one.
    it('holds the archive flat across repeated exports', async () => {
      const service = makeService(3);
      for (let day = 1; day <= 12; day++) {
        (service as unknown as { datasetService: DatasetService }).datasetService
          .buildLatestDataset = jest
          .fn()
          .mockResolvedValue(dataset(`2026-08-${String(day).padStart(2, '0')}T00:00:00.000Z`));
        await service.writeLatestSnapshot();
      }

      expect(await listArchive()).toHaveLength(3);
    });
  });

  describe('serialisation', () => {
    it('writes compact JSON by default', async () => {
      await makeService(5, false).writeLatestSnapshot();

      const raw = await fs.readFile(join(process.cwd(), 'exports', 'latest.json'), 'utf-8');
      // Indenting a 64 MB dataset adds tens of megabytes of whitespace to every
      // archived copy and to every byte served to a client.
      expect(raw).not.toContain('\n  ');
      expect(JSON.parse(raw)).toBeTruthy();
    });

    it('pretty-prints when explicitly enabled', async () => {
      await makeService(5, true).writeLatestSnapshot();

      const raw = await fs.readFile(join(process.cwd(), 'exports', 'latest.json'), 'utf-8');
      expect(raw).toContain('\n  ');
    });

    it('stays valid JSON either way', async () => {
      for (const pretty of [true, false]) {
        await makeService(5, pretty).writeLatestSnapshot();
        const raw = await fs.readFile(join(process.cwd(), 'exports', 'latest.json'), 'utf-8');
        expect(() => JSON.parse(raw)).not.toThrow();
      }
    });
  });
});
