# AINTIVIRUS Surveillance Tracker

Surveillance Tracker aggregates open-source intelligence on automated license plate readers (ALPRs), red light cameras, and related infrastructure. The platform ingests data from multiple sources on a recurring schedule, persists normalized records, and serves both a live API and a React-based explorer UI with an offline-ready dataset fallback.

- **Backend**: NestJS service (`backend/engine`) orchestrates connector jobs via BullMQ, writes results to SQLite, and publishes JSON exports.
- **Frontend**: Vite + React application (`frontend/app`) visualizes live API data and can fall back to static exports.
- **Operations**: `docs/OPERATIONS.md` provides the full runbook for provisioning, monitoring, and recovery.

## Features & Data Sources

| Connector | Kind | Default cadence | Description |
|-----------|------|-----------------|-------------|
| `redlightcameralist` | Scrape | Hourly (`0 * * * *`) | Crawls RedLightCameraList for intersection listings; merges discovered and curated city feeds. |
| `atlas-of-surveillance` | API | Hourly (`0 * * * *`) | Pulls CSV exports from EFF's Atlas of Surveillance project (Flock Safety subset). |
| `overpass-alpr` | API | Daily (`0 0 * * *`) | Queries the Overpass API for OSM nodes tagged as public ALPR surveillance and enriches them via Nominatim. |

Each connector maintains bundled sample data. On remote failure the engine serves these fallbacks while retaining the last successful snapshot on disk.

## Repository Layout

```
backend/engine/    # NestJS ingestion engine, BullMQ queues, SQLite persistence, REST API
frontend/app/      # React/Vite UI consuming the live API (with offline fallback dataset)
docs/              # Operations runbook and project documentation
```

## Prerequisites

- Node.js 20.x (LTS)
- npm 10+
- Redis 6+ (persistent instance for BullMQ)
- SQLite is bundled and stored under `backend/engine/data/`

Optional for development:

- Docker/Podman for containerized Redis
- Modern browser for the React UI

## Quick Start

1. **Install dependencies**
   ```bash
   npm install --prefix backend/engine
   npm install --prefix frontend/app
   ```
2. **Provide Redis**
   - Start a local instance (e.g., `docker run -p 6379:6379 redis:7`) or point `REDIS_URL` at an existing service.
3. **Run the backend**
   ```bash
   cd backend/engine
   npm run start:dev
   ```
   - The engine listens on `PORT` (default `3000`).
   - Recurring ingest jobs are scheduled automatically during bootstrap.
4. **Run the frontend**
   ```bash
   cd frontend/app
   npm run dev
   ```
   - Vite serves the UI on `5173` by default; for same-origin reverse proxies leave `VITE_API_BASE_URL` empty and let the web server forward `/api/*` to the backend.

Visit http://localhost:5173 to explore the dataset. The UI fetches `GET /api/dataset/latest` and falls back to `/fallback-dataset.json` if the API is offline.

## Configuration

Create `.env` files beside the services (the engine loads `.env.local` then `.env`). Key variables:

| Variable | Default | Purpose |
|----------|---------|---------|
| `PORT` | `3000` | Engine HTTP port |
| `REDIS_URL` | _unset_ | Full Redis connection string (alternatively configure `REDIS_HOST`/`REDIS_PORT`) |
| `DATA_DIR` | `<repo>/backend/engine/data` | Directory containing the SQLite database |
| `DATABASE_PATH` | `<DATA_DIR>/engine.sqlite` | Custom path for SQLite |
| `CORS_ORIGINS` | `http://localhost:5173` | Comma-separated origins allowed by the API |
| `NOMINATIM_BASE_URL` | `https://nominatim.openstreetmap.org` | Reverse-geocoding endpoint |
| `NOMINATIM_USER_AGENT` | `aintivirus-surveillance-tracker/1.0` | Required by Nominatim usage policy |
| `NOMINATIM_EMAIL` | _unset_ | Contact email included in Nominatim requests (strongly recommended) |
| `NOMINATIM_TIMEOUT_MS` | `10000` | Nominatim request timeout |
| `NOMINATIM_RATE_LIMIT_MS` | `1100` | Minimum delay between reverse-geocoding calls |
| `VITE_API_BASE_URL` | `http://localhost:3000` | Frontend API root |

See `docs/OPERATIONS.md` for production-ready environment templates, systemd examples, and secrets handling.

## Engine API Surface

| Endpoint | Description |
|----------|-------------|
| `GET /api/dataset/latest` | Latest merged dataset including per-source records |
| `GET /api/dataset/export/latest` | Returns the most recent on-disk export (falls back to live build) |
| `GET /api/sources` | Metadata for all registered connectors |
| `GET /api/sources/:key` | Latest snapshot and records for a specific source |
| `GET /health` | Aggregated component health (database, Redis, queue, ingestion summary) |

The engine also writes exports to `backend/engine/exports/latest.json` and archives a timestamped copy under `backend/engine/exports/archive/`.

## Data & Persistence

- SQLite database (`backend/engine/data/engine.sqlite`) stores `sources`, `snapshots`, and `records`.
- Export service regenerates JSON payloads after every successful ingest job.
- Fallback sample datasets ensure continuity when upstream APIs are unavailable.

Back up both the database file and the `exports/` directory; additional runbook guidance is in `docs/OPERATIONS.md`.

## Development Workflow

- **Code quality**: `npm run lint` (backend) and Vite/TypeScript diagnostic output on the frontend.
- **Tests**:
  ```bash
  npm test --prefix backend/engine        # unit tests
  npm run test:e2e --prefix backend/engine
  ```
- **Frontend build**: `npm run build --prefix frontend/app` (outputs to `frontend/app/dist`).
- **Formatting**: `npm run format --prefix backend/engine`.

## Deployment Overview

- Run the engine under a process manager (systemd, PM2, container orchestrator) with access to Redis and persistent storage for `data/` + `exports/`.
- Serve the frontend from any static host (Netlify, S3, Cloudflare Pages). Set `VITE_API_BASE_URL` during build to target the public engine URL.
- Expose `/exports/latest.json` via CDN or object storage to power the UI fallback and third-party consumers.
- Establish monitoring on `/health`, Redis availability, and queue failure counts.

Production-ready procedures, maintenance schedules, and incident response steps are detailed in `docs/OPERATIONS.md`.

## Contributing

Issues and merge requests are welcome. Please:

1. Open an issue describing scope and rationale.
2. Follow the lint/test commands above.
3. Update documentation when behavior changes.

## Further Reading

- Full runbook: `docs/OPERATIONS.md`
- NestJS documentation: https://docs.nestjs.com
- BullMQ documentation: https://docs.bullmq.io
- Vite documentation: https://vitejs.dev


