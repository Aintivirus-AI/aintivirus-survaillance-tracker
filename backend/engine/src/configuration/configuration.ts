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
    cors: {
      origins: (process.env.CORS_ORIGINS ?? 'http://localhost:5173')
        .split(',')
        .map((origin) => origin.trim())
        .filter((origin) => origin.length > 0),
    },
  };
};
