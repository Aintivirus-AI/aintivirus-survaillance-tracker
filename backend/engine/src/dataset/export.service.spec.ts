import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { ExportService } from './export.service';
import type { DatasetService } from './dataset.service';
import type { LatestDataset } from './dataset.types';

// Run the service in a sandbox directory so we don't touch repo exports/.
async function withSandbox<T>(fn: (service: ExportService, exportDir: string) => Promise<T>): Promise<T> {
  const originalCwd = process.cwd();
  const sandbox = await fs.mkdtemp(join(tmpdir(), 'export-service-'));
  process.chdir(sandbox);
  try {
    const fakeDataset = {
      buildLatestDataset: async (): Promise<LatestDataset> => ({
        generatedAt: '2026-04-17T00:00:00.000Z',
        sources: [],
      }),
    } as unknown as DatasetService;

    const service = new ExportService(fakeDataset);
    return await fn(service, join(sandbox, 'exports'));
  } finally {
    process.chdir(originalCwd);
    await fs.rm(sandbox, { recursive: true, force: true });
  }
}

describe('ExportService.writeLatestSnapshot', () => {
  it('writes a valid JSON file at exports/latest.json', async () => {
    await withSandbox(async (service, exportDir) => {
      const dataset = await service.writeLatestSnapshot();
      const raw = await fs.readFile(join(exportDir, 'latest.json'), 'utf-8');
      const parsed = JSON.parse(raw);
      expect(parsed.generatedAt).toBe(dataset.generatedAt);
      expect(parsed.sources).toEqual([]);
    });
  });

  it('writes an archive copy under exports/archive/', async () => {
    await withSandbox(async (service, exportDir) => {
      await service.writeLatestSnapshot();
      const files = await fs.readdir(join(exportDir, 'archive'));
      expect(files.length).toBe(1);
      expect(files[0]).toMatch(/^dataset-.*\.json$/);
    });
  });

  it('leaves no .tmp- staging files behind after a successful write', async () => {
    await withSandbox(async (service, exportDir) => {
      await service.writeLatestSnapshot();
      const files = await fs.readdir(exportDir);
      const tmpFiles = files.filter((f) => f.includes('.tmp-'));
      expect(tmpFiles).toEqual([]);
    });
  });

  it('preserves the previous latest.json when a rename is possible (no partial write)', async () => {
    await withSandbox(async (service, exportDir) => {
      // First write — good file.
      await service.writeLatestSnapshot();
      const first = await fs.readFile(join(exportDir, 'latest.json'), 'utf-8');
      expect(() => JSON.parse(first)).not.toThrow();

      // Second write — should replace atomically.
      await service.writeLatestSnapshot();
      const second = await fs.readFile(join(exportDir, 'latest.json'), 'utf-8');
      expect(() => JSON.parse(second)).not.toThrow();

      // No half-written garbage in the directory
      const files = await fs.readdir(exportDir);
      for (const f of files) {
        if (f === 'archive') continue;
        const raw = await fs.readFile(join(exportDir, f), 'utf-8');
        expect(() => JSON.parse(raw)).not.toThrow();
      }
    });
  });
});

describe('ExportService.readLatestFromDisk', () => {
  it('returns null gracefully when no export exists yet', async () => {
    await withSandbox(async (service) => {
      const result = await service.readLatestFromDisk();
      expect(result).toBeNull();
    });
  });

  it('returns the parsed dataset when latest.json is present', async () => {
    await withSandbox(async (service) => {
      await service.writeLatestSnapshot();
      const result = await service.readLatestFromDisk();
      expect(result?.generatedAt).toBe('2026-04-17T00:00:00.000Z');
      expect(result?.sources).toEqual([]);
    });
  });
});
