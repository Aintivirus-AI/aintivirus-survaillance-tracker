import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { Queue } from 'bullmq';
import { HealthService } from './health.service';
import { SourceService } from '../sources/source.service';

const HOUR = 60 * 60 * 1000;
const STALE_AFTER = 26 * HOUR;

interface QueueCounts {
  waiting?: number;
  active?: number;
  failed?: number;
  delayed?: number;
  completed?: number;
}

describe('HealthService', () => {
  const build = (opts: {
    counts?: QueueCounts;
    /** Ages (ms before now) of the retained failed jobs. */
    failedAges?: number[];
    lastIngestedAt?: Date | null;
    sources?: number;
    dbFails?: boolean;
    redisFails?: boolean;
    getJobsThrows?: boolean;
  }) => {
    const {
      counts = { waiting: 0, active: 0, failed: 0, delayed: 0, completed: 0 },
      failedAges = [],
      lastIngestedAt = new Date(),
      sources = 3,
      dbFails = false,
      redisFails = false,
      getJobsThrows = false,
    } = opts;

    const dataSource = {
      query: jest.fn(dbFails
        ? () => Promise.reject(new Error('db down'))
        : () => Promise.resolve([{ 1: 1 }])),
    } as unknown as DataSource;

    const sourceService = {
      listSources: jest.fn().mockResolvedValue(
        Array.from({ length: sources }, () => ({
          totalRecords: 100,
          lastIngestedAt,
        })),
      ),
    } as unknown as SourceService;

    const queue = {
      waitUntilReady: jest.fn(redisFails
        ? () => Promise.reject(new Error('redis down'))
        : () => Promise.resolve()),
      getJobCounts: jest.fn().mockResolvedValue(counts),
      getJobs: jest.fn(getJobsThrows
        ? () => Promise.reject(new Error('redis gone'))
        : () => Promise.resolve(
            failedAges.map((age) => ({ finishedOn: Date.now() - age })),
          )),
    } as unknown as Queue;

    const config = {
      get: (key: string) =>
        key === 'health.ingestionStaleAfterMs' ? STALE_AFTER : undefined,
    } as unknown as ConfigService;

    return new HealthService(dataSource, sourceService, queue, config);
  };

  describe('ingestion freshness', () => {
    it('is ok for a recent ingest', async () => {
      const report = await build({ lastIngestedAt: new Date(Date.now() - HOUR) }).check();
      expect(report.components.ingestion.status).toBe('ok');
      expect(report.status).toBe('ok');
    });

    // The bug that hid the outage: production ran 45 days with no successful
    // ingest (the disk was full) and health reported "ok" the whole time,
    // because the check only asked whether any sources were configured.
    it('reports error when ingestion has been dead for weeks', async () => {
      const report = await build({
        lastIngestedAt: new Date(Date.now() - 45 * 24 * HOUR),
      }).check();

      expect(report.components.ingestion.status).toBe('error');
      expect(report.status).toBe('error');
    });

    it('degrades once data slips past the freshness window', async () => {
      const report = await build({
        lastIngestedAt: new Date(Date.now() - (STALE_AFTER + HOUR)),
      }).check();

      expect(report.components.ingestion.status).toBe('degraded');
      expect(report.status).toBe('degraded');
    });

    it('stays ok just inside the window', async () => {
      const report = await build({
        lastIngestedAt: new Date(Date.now() - (STALE_AFTER - HOUR)),
      }).check();

      expect(report.components.ingestion.status).toBe('ok');
    });

    it('reports error when nothing has ever been ingested', async () => {
      const report = await build({ lastIngestedAt: null }).check();
      expect(report.components.ingestion.status).toBe('error');
    });

    it('does not call a configured-but-idle service healthy', async () => {
      // Sources exist, but none has ever run — the old check returned "ok"
      // purely because sourcesTracked > 0.
      const report = await build({ sources: 3, lastIngestedAt: null }).check();
      expect(report.components.ingestion.status).not.toBe('ok');
    });

    it('still reports the summary numbers', async () => {
      const report = await build({ sources: 3 }).check();
      expect(report.components.ingestion.meta).toMatchObject({
        sourcesTracked: 3,
        totalRecords: 300,
      });
    });
  });

  describe('queue classification', () => {
    // BullMQ retains failed jobs until removed, and the producer sets
    // removeOnComplete: true — so `completed` is ALWAYS 0 and counting
    // successes proves nothing. Only failure recency is meaningful.
    it('does not degrade on a failure from months ago', async () => {
      const report = await build({
        counts: { failed: 1, completed: 0, waiting: 0 },
        failedAges: [60 * 24 * HOUR],
      }).check();

      expect(report.components.queue.status).toBe('ok');
      expect(report.status).toBe('ok');
    });

    it('degrades on a failure inside the freshness window', async () => {
      const report = await build({
        counts: { failed: 1, completed: 0, waiting: 0 },
        failedAges: [2 * HOUR],
      }).check();

      expect(report.components.queue.status).toBe('degraded');
    });

    it('ignores old failures while flagging a recent one', async () => {
      const report = await build({
        counts: { failed: 3, completed: 0, waiting: 0 },
        failedAges: [90 * 24 * HOUR, 60 * 24 * HOUR, HOUR],
      }).check();

      expect(
        (report.components.queue.meta as { recentFailures: number }).recentFailures,
      ).toBe(1);
      expect(report.components.queue.status).toBe('degraded');
    });

    it('is ok for a queue with no failures at all', async () => {
      const report = await build({
        counts: { failed: 0, completed: 0, waiting: 0, delayed: 3 },
      }).check();

      expect(report.components.queue.status).toBe('ok');
    });

    it('degrades on a large backlog even with no failures', async () => {
      const report = await build({
        counts: { failed: 0, completed: 0, waiting: 500 },
      }).check();

      expect(report.components.queue.status).toBe('degraded');
    });

    it('does not inspect failed jobs when there are none', async () => {
      const service = build({ counts: { failed: 0, waiting: 0 } });
      await service.check();

      const queue = (service as unknown as { ingestQueue: Queue }).ingestQueue;
      expect(queue.getJobs).not.toHaveBeenCalled();
    });

    // "I couldn't check" must not be reported as "it's broken".
    it('does not invent a failure when the job list is unreadable', async () => {
      const report = await build({
        counts: { failed: 2, waiting: 0 },
        getJobsThrows: true,
      }).check();

      expect(report.components.queue.status).toBe('ok');
      expect(
        (report.components.queue.meta as { recentFailures: number }).recentFailures,
      ).toBe(0);
    });

    it('still reports the raw counts for monitoring', async () => {
      const report = await build({
        counts: { failed: 2, waiting: 4, delayed: 3, active: 1 },
        failedAges: [HOUR],
      }).check();

      expect(report.components.queue.meta).toMatchObject({
        failed: 2, waiting: 4, delayed: 3, active: 1,
      });
    });
  });

  describe('infrastructure failures', () => {
    it('reports error when the database is unreachable', async () => {
      const report = await build({ dbFails: true }).check();
      expect(report.components.database.status).toBe('error');
      expect(report.status).toBe('error');
    });

    it('reports error when redis is unreachable', async () => {
      const report = await build({ redisFails: true }).check();
      expect(report.components.redis.status).toBe('error');
      expect(report.status).toBe('error');
    });

    it('always includes a timestamp and every component', async () => {
      const report = await build({}).check();
      expect(Date.parse(report.timestamp)).not.toBeNaN();
      expect(Object.keys(report.components).sort()).toEqual([
        'database', 'ingestion', 'queue', 'redis',
      ]);
    });
  });
});
