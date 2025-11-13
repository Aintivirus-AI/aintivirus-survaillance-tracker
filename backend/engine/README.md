# Engine Service Documentation

This directory contains the NestJS ingestion engine that powers the AINTIVIRUS Surveillance Tracker. The service orchestrates connector jobs via BullMQ, normalizes datasets into SQLite, and exposes both REST endpoints and JSON exports consumed by the frontend.

- Runtime entrypoint: `src/main.ts`
- REST + queue modules: `src/app.module.ts`
- Connectors: `src/connectors/`
- Queues and persistence pipeline: `src/queues/`
- Database entities: `src/database/entities/`

Refer to the repository-level `README.md` for a high-level architecture overview. This document dives into engine-specific workflows.

## Prerequisites

- Node.js 20.x (LTS)
- npm 10+
- Redis 6+ (single instance is sufficient for BullMQ)
- Persistent storage for:
  - `data/engine.sqlite` (SQLite database)
  - `exports/` directory (latest + archived datasets)

## Installation

```bash
cd backend/engine
npm install
```

### Environment Files

The engine loads configuration from `.env.local` (preferred) and `.env`. Copy `config/example.env` (create one if needed) or define the following variables:

| Variable | Default | Notes |
|----------|---------|-------|
| `PORT` | `3000` | HTTP port for the API and health checks |
| `DATA_DIR` | `<repo>/backend/engine/data` | Folder containing SQLite database |
| `DATABASE_PATH` | `<DATA_DIR>/engine.sqlite` | Override path to the SQLite file |
| `REDIS_URL` | _unset_ | Full Redis connection string (use instead of host/port) |
| `REDIS_HOST` | `127.0.0.1` | When `REDIS_URL` is not provided |
| `REDIS_PORT` | `6379` | Redis TCP port |
| `CORS_ORIGINS` | `http://localhost:5173` | Comma-separated list of allowed origins |
| `NOMINATIM_BASE_URL` | `https://nominatim.openstreetmap.org` | Reverse geocoding endpoint |
| `NOMINATIM_USER_AGENT` | `aintivirus-surveillance-tracker/1.0` | Identify your deployment per OSM policy |
| `NOMINATIM_EMAIL` | _unset_ | Strongly recommended when using the shared Nominatim service |
| `NOMINATIM_TIMEOUT_MS` | `10000` | Timeout for geocoding requests (ms) |
| `NOMINATIM_RATE_LIMIT_MS` | `1100` | Delay between reverse-geocode calls (ms) |

## Running the Service

```bash
# Development with live reload
npm run start:dev

# Production build + start
npm run build
npm run start:prod
```

Upon startup the following occurs:

1. `ConnectorsModule` registers all connectors and upserts their metadata into the `sources` table.
2. `IngestOrchestrator` prunes stale recurring jobs and schedules active connectors according to `metadata.schedule` (cron).
3. BullMQ workers (`IngestProcessor`) consume jobs from the `ingest` queue and invoke each connector's `collect` method.
4. `IngestPersistenceService` writes snapshots + records to SQLite and regenerates JSON exports via `ExportService`.

## Connectors

| Connector ID | Kind | Schedule | Notes |
|--------------|------|----------|-------|
| `redlightcameralist` | `scrape` | `0 * * * *` | Discovers city pages and scrapes intersections; respects robots.txt and rate limiting. |
| `atlas-of-surveillance` | `api` | `0 * * * *` | Downloads CSV exports from the Atlas of Surveillance (Flock Safety subset). |
| `overpass-alpr` | `api` | `0 0 * * *` | Uses Overpass API for ALPR nodes and reverse geocodes coordinates via Nominatim. |

Fallback JSON samples (`src/connectors/samples/*.json`) ensure the system continues serving meaningful data if upstream fetches fail. When a fallback run occurs the existing snapshot remains active to prevent data regression.

## Queue Operations

- Queue name: `ingest`
- Job name: `collect`
- Manual trigger example (via `redis-cli`):
  ```bash
  redis-cli -x lpush bull:ingest:wait '{"name":"collect","data":{"connectorId":"atlas-of-surveillance"}}'
  ```
  The engine will pick up the job immediately if workers are running.
- Inspect counts: `redis-cli hgetall bull:ingest:meta`

Refer to `docs/OPERATIONS.md` for recommended BullMQ monitoring practices (Grafana, alerts, failure handling).

## Persistence

The engine uses TypeORM entities:

- `sources` — connector metadata, last ingest timestamps, record counts.
- `snapshots` — per-run snapshot of a connector (revision, record count, metadata).
- `records` — normalized records tied to a specific snapshot.

Exports are written to:

- `exports/latest.json` — merged dataset for quick consumption.
- `exports/archive/dataset-<timestamp>.json` — immutable history per ingest run.

Back up the SQLite file and the entire `exports/` directory together to preserve data lineage.

## API Endpoints

- `GET /api/dataset/latest` — Builds a fresh dataset from SQLite on demand.
- `GET /api/dataset/export/latest` — Returns the most recent export from disk, falling back to live build.
- `GET /api/sources` — Lists registered sources with operational metadata.
- `GET /api/sources/:key` — Returns latest snapshot + records for a specific source.
- `GET /health` — Summarizes database/Redis/queue/ingestion status.

## Testing & Quality

```bash
npm run lint        # ESLint
npm run test        # Unit tests
npm run test:e2e    # End-to-end tests
npm run test:cov    # Coverage report
npm run format      # Prettier
```

CI should execute lint + tests before deploying new connector logic or schema changes.

## Troubleshooting

- **Workers not processing jobs** — Confirm Redis connectivity, review `BullModule` configuration, and check for stale repeatable jobs via `IngestProducer.pruneStaleRecurring` logs.
- **Nominatim throttling** — Increase `NOMINATIM_RATE_LIMIT_MS`, supply a dedicated endpoint, or disable reverse geocoding for local testing by setting the env var accordingly.
- **SQLite locking** — Ensure only one engine instance writes to the same database file. For clustered deployments, migrate to a shared relational database (e.g., Postgres) and adjust TypeORM config.
- **Empty datasets** — Review connector logs. The engine retains the previous snapshot when fallbacks occur; manual intervention may be required if upstream feeds change structure.

For operational playbooks (backup/restore, incident response, deployment checklists) see `../../docs/OPERATIONS.md`.
