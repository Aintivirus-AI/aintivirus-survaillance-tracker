import { join } from 'path';

export const DATA_DIRECTORY = join(process.cwd(), 'data');

export default () => {
  const dataDirectory = process.env.DATA_DIR ?? DATA_DIRECTORY;

  return {
    dataDirectory,
    database: {
      path: process.env.DATABASE_PATH ?? join(dataDirectory, 'engine.sqlite'),
    },
    geocoding: {
      nominatim: {
        baseUrl:
          process.env.NOMINATIM_BASE_URL ??
          'https://nominatim.openstreetmap.org',
        userAgent:
          process.env.NOMINATIM_USER_AGENT ??
          'aintivirus-surveillance-tracker/1.0',
        email: (() => {
          const email = process.env.NOMINATIM_EMAIL;
          if (!email) {
            throw new Error(
              'NOMINATIM_EMAIL environment variable is required. ' +
                'Set it to an email address that identifies your application to the Nominatim API.',
            );
          }
          return email;
        })(),
        timeoutMs: parseInt(process.env.NOMINATIM_TIMEOUT_MS ?? '10000', 10),
        rateLimitMs: parseInt(
          process.env.NOMINATIM_RATE_LIMIT_MS ?? '1100',
          10,
        ),
      },
    },
    redis: {
      url: process.env.REDIS_URL,
      host: process.env.REDIS_HOST ?? '127.0.0.1',
      port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
    },
    exports: {
      /**
       * How many timestamped snapshots to keep in exports/archive.
       *
       * Each snapshot is a full copy of the dataset (~64 MB in production).
       * Nothing pruned these: 138 accumulated and filled the 28 GB root volume
       * on 2026-06-17, which stopped ingestion, blocked certbot renewal and
       * took every aintivirus.ai service offline when the TLS cert expired.
       */
      archiveRetention: Math.max(
        1,
        parseInt(process.env.EXPORT_ARCHIVE_RETENTION ?? '10', 10) || 10,
      ),
      /**
       * Pretty-print exports. Off by default: indenting a 64 MB dataset adds
       * tens of megabytes of whitespace to every archived copy and to every
       * byte served to a client.
       */
      pretty: process.env.EXPORT_PRETTY === '1',
    },
    health: {
      /**
       * Ingestion is considered stale after this long without a successful
       * run. Previously health reported "ok" purely because sources existed,
       * so a 45-day ingestion outage looked healthy.
       */
      ingestionStaleAfterMs:
        parseInt(process.env.INGESTION_STALE_AFTER_HOURS ?? '26', 10) *
        60 *
        60 *
        1000,
    },
    cors: {
      origins: (process.env.CORS_ORIGINS ?? 'http://localhost:5173')
        .split(',')
        .map((origin) => origin.trim())
        .filter((origin) => origin.length > 0),
    },
  };
};
