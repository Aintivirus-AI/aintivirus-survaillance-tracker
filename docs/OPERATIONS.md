# Surveillance Tracker – Operations Guide

This runbook explains how to provision, operate, monitor, and recover the AINTIVIRUS Surveillance Tracker across development, staging, and production environments.

---

## 1. Platform Overview

| Component | Location | Responsibility | Dependencies |
|-----------|----------|----------------|--------------|
| Ingestion Engine | `backend/engine` | NestJS service that schedules connector jobs, persists snapshots to SQLite, writes JSON exports, and exposes REST endpoints. | Node.js, Redis, SQLite storage |
| Queue/Workers | Redis + BullMQ (`ingest` queue) | Stores repeatable jobs and executes connector runs within the engine process. | Redis persistence, network reachability |
| Frontend Explorer | `frontend/app` | React/Vite UI that queries live API data or falls back to the latest export for offline mode. | Public API access, static hosting |
| Dataset Exports | `backend/engine/exports/` | Houses `latest.json` for fallback consumers and timestamped archives for historical analysis. | Writable filesystem, backup coverage |

Connectors currently supported:

- `redlightcameralist` (scrape, hourly)
- `atlas-of-surveillance` (CSV API, hourly)
- `overpass-alpr` (Overpass API + Nominatim enrichment, daily)

Each connector bundles sample data to prevent total outages during upstream downtime.

---

## 2. Environments & Secrets

The engine loads `.env.local` (preferred) then `.env`; the frontend uses Vite's `.env` conventions. Recommended `.env.local` for production:

```
PORT=3000
DATA_DIR=/var/lib/aintivirus-engine/data
DATABASE_PATH=/var/lib/aintivirus-engine/data/engine.sqlite
REDIS_URL=redis://user:password@redis.example.com:6379
CORS_ORIGINS=https://tracker.example.com
NOMINATIM_BASE_URL=https://nominatim.openstreetmap.org
NOMINATIM_USER_AGENT=aintivirus-surveillance-tracker/1.0 (ops@example.com)
NOMINATIM_EMAIL=ops@example.com
NOMINATIM_TIMEOUT_MS=15000
NOMINATIM_RATE_LIMIT_MS=1500
```

Frontend `.env`:

```
VITE_API_BASE_URL=https://api.tracker.example.com
```

Keep secrets (Redis credentials, emails) in your secret manager and inject them into environment files or process managers.

---

## 3. Provisioning Checklist

1. **Infrastructure prerequisites**
   - Provision Redis 6+ with persistence (AOF or snapshot) and connectivity from the engine host(s).
   - Allocate persistent volumes for `data/` and `exports/` (minimum 1 GB to start).
   - Configure TLS termination (reverse proxy, load balancer, or ingress).
2. **Engine deployment**
   - Install Node.js 20.x and npm 10+.
   - Copy repository or build artifacts to host.
   - Populate `.env.local` as above.
   - Install dependencies: `npm ci --omit=dev` (for production) within `backend/engine`.
   - Build TypeScript: `npm run build`.
3. **Process manager**
   - Example systemd unit (`/etc/systemd/system/aintivirus-engine.service`):
     ```
     [Unit]
     Description=AINTIVIRUS Surveillance Tracker Engine
     After=network-online.target redis.service

     [Service]
     WorkingDirectory=/opt/aintivirus/backend/engine
     EnvironmentFile=/etc/aintivirus-engine.env
     ExecStart=/usr/bin/node dist/main.js
     Restart=on-failure
     RestartSec=5
     User=aintivirus
     Group=aintivirus
     StandardOutput=journal
     StandardError=journal

     [Install]
     WantedBy=multi-user.target
     ```
   - Reload systemd and enable: `systemctl daemon-reload && systemctl enable --now aintivirus-engine`.
4. **Frontend deployment**
   - `npm ci` then `npm run build` in `frontend/app`.
   - Upload `frontend/app/dist` to your static host (S3+CloudFront, Netlify, etc.).
   - Ensure `VITE_API_BASE_URL` points to the public engine URL before building.
5. **Dataset export delivery**
   - Sync `backend/engine/exports/latest.json` to a CDN or object storage bucket after each ingest run (cron rsync or CI job).
   - Update the frontend `fallback-dataset.json` periodically (see §4.4).

---

## 4. Routine Operation

### 4.1 Service verification

- `systemctl status aintivirus-engine` (or equivalent) should show the service active.
- `curl https://api.tracker.example.com/health` ⇒ expect `{"status":"ok", ...}` with current timestamps.
- `curl https://api.tracker.example.com/api/dataset/latest | jq '.generatedAt'` ⇒ confirm recent ISO timestamp.

### 4.2 Queue management

- Inspect job counts:
  ```bash
  redis-cli HGETALL bull:ingest:meta
  ```
  - `failed` > 0 for consecutive runs ⇒ investigate logs.
- List repeatable jobs:
  ```bash
  redis-cli LRANGE bull:ingest:repeat 0 -1
  ```
- Manually trigger a connector:
  ```bash
  redis-cli -x XADD bull:ingest:wait * \
    < <(echo '{"name":"collect","data":{"connectorId":"redlightcameralist"}}')
  ```
  Alternatively enqueue via the BullMQ UI or a one-off Nest script using `IngestProducer.enqueue`.

### 4.3 Logs

- Journald (systemd) or container logs include structured Nest output.
- Important log channels: `IngestProcessor`, `IngestOrchestrator`, connector class names, `ExportService`.
- Failed connector runs log warnings but will emit fallback data; persistent fallback usage requires manual review.

### 4.4 Updating the frontend fallback dataset

1. Wait for a successful ingest run (check logs or `/api/dataset/export/latest` for new timestamp).
2. Copy `backend/engine/exports/latest.json` to `frontend/app/public/fallback-dataset.json`.
3. Rebuild the frontend (`npm run build`) and redeploy static assets.
4. Commit archive updates if version-controlling fallback assets.

### 4.5 Validating data freshness

- `/api/sources` includes `lastIngestedAt` and `totalRecords`. Alert if any `lastIngestedAt` lags beyond expected cadence (1 h for hourly sources, 24 h for daily).
- `/api/dataset/latest` `generatedAt` should move forward after each connector run. When the frontend is deployed behind the same origin as the API, leave `VITE_API_BASE_URL` empty; otherwise the UI calls `/api/api/dataset/latest` and shows the offline snapshot.
- To deploy a specific frontend branch to a server:
  ```bash
  cd /var/www/aintivirus-survaillance-tracker/frontend/app
  git fetch origin my-feature-branch
  git checkout my-feature-branch
  npm ci            # or npm install
  npm run build
  sudo cp -r dist/* /var/www/aintivirus-frontend/
  sudo systemctl reload nginx
  ```
  Adjust directories/branch names for your setup; rebuild after every checkout before syncing `dist/` to your web root.

---

## 5. Monitoring & Alerting

| Signal | Collection method | Alert suggestion |
|--------|-------------------|------------------|
| HTTP health status | Poll `/health` every minute | Alert when `status != ok` or component error present |
| Ingestion cadence | Parse `/health.components.ingestion.lastIngestedAt` | Alert when timestamp is older than 2× expected cadence |
| Queue failures | Redis metric `bull:ingest:meta.failed` | Alert on consecutive failures or >0 for >15 min |
| Redis availability | Redis ping | Alert on timeouts / refusal |
| Disk utilization | OS metrics on data/export volumes | Alert at 80% capacity |

Logging aggregation (ELK, Loki, CloudWatch) is strongly recommended. Tag production logs with connector names for rapid triage.

### Canceling ingest jobs

Key commands when you need to stop a connector mid-flight. Run from any shell with permissions to reach Redis:

- List active jobs and remove the one you care about (e.g., `overpass-alpr`):\
  ```bash
  node -e "(async()=>{const{Queue}=require('bullmq');const q=new Queue('ingest',{connection:{host:'127.0.0.1',port:6379}});const active=await q.getJobs(['active']);for(const job of active){console.log('active',job.id,job.data);if(job.data?.connectorId==='overpass-alpr'){await job.discard();await job.remove();console.log('force removed',job.id);}}await q.close();})()"
  ```
- For waiting/delayed jobs by connector id swap `'active'` for `['waiting','delayed']`.

- Kill an *active* job: fill in the job id from the logs or `q.getActive()` (act fast before it completes):\
  `node -e "(async()=>{const{Queue}=require('bullmq');const q=new Queue('ingest',{connection:{host:'127.0.0.1',port:6379}});const job=await q.getJob('collect:1731685200000');if(job){await job.discard();await job.remove();console.log('Force removed',job.id);}await q.close();})()"`

- Pause the entire `ingest` queue to stop new jobs from starting:\
  `node -e "(async()=>{const{Queue}=require('bullmq');const q=new Queue('ingest',{connection:{host:'127.0.0.1',port:6379}});await q.pause();console.log('Queue paused');await q.close();})()"`

Remember to resume with `q.resume()` when you’re ready to process jobs again.

---

## 6. Backups & Disaster Recovery

### 6.1 Backup targets

- SQLite database: `backend/engine/data/engine.sqlite`
- Export directory: `backend/engine/exports/`
- Environment files: `/etc/aintivirus-engine.env` (or secret manager)

### 6.2 Suggested schedule

- Nightly snapshot of SQLite + exports (rsync or filesystem snapshot).
- Weekly off-site copy (object storage, encrypted archive).

### 6.3 Backup procedure

1. Stop the engine or ensure no writes: `systemctl stop aintivirus-engine`.
2. Copy files:
   ```bash
   rsync -avz data/engine.sqlite backups/$(date +%F)/engine.sqlite
   rsync -avz exports/ backups/$(date +%F)/exports/
   ```
3. Restart service: `systemctl start aintivirus-engine`.

### 6.4 Restore procedure

1. Stop the engine.
2. Replace the damaged files with backups.
3. Verify ownership/permissions.
4. Start the engine and monitor logs; run `curl /api/dataset/latest` to confirm dataset load.
5. If exports are missing, trigger a connector run to regenerate `latest.json`.

---

## 7. Incident Response

| Scenario | Detection | Immediate actions | Follow-up |
|----------|-----------|-------------------|-----------|
| Source markup changes | Logs show parse warnings; `totalRecords` declines | Disable affected connector (comment schedule or remove repeatable job), gather HTML sample, implement parser fix | Write post-mortem, add monitoring for record count anomalies |
| Redis outage | `/health.components.redis.status=error`; workers stop | Restore Redis service, verify persistence, restart engine | Evaluate HA/replication, update alerts |
| SQLite corruption/lock | `/health.components.database.status=error`; 500 responses | Stop engine, restore from backup or delete DB for fresh start (loses history) | Investigate disk health, consider migrating to managed DB |
| Engine offline | Uptime monitor fails, `/health` unreachable | Restart service/process manager, inspect logs | Review deployment pipelines, automate restarts |
| Nominatim throttling | Connector logs rate-limit warnings; reverse geocodes missing | Increase `NOMINATIM_RATE_LIMIT_MS`, provide dedicated instance, or temporarily disable reverse geocode | Coordinate with OSM policy, cache results |

**Triage checklist**

1. Confirm alert in monitoring dashboard.
2. Capture timestamps, log excerpts, and job IDs.
3. Annotate status page / incident channel.
4. Execute scenario-specific steps above.
5. After recovery, trigger manual ingest to validate system.

---

## 8. Maintenance Tasks

| Cadence | Task | Details |
|---------|------|---------|
| Weekly | Review ingestion success | Check `/health` for ingestion timestamps and queue failures. |
| Weekly | Rotate exports to CDN | Ensure latest fallback is published; update frontend if needed. |
| Monthly | Dependency updates | `npm outdated` in both backend and frontend; run tests after updates. |
| Quarterly | Validate connectors | Manually spot-check sample records, confirm upstream sources unchanged. |
| Ad-hoc | Add new connectors | Implement under `src/connectors/`, update operations doc, ensure schedule configured. |

### Post-deploy checklist

1. Deployment succeeded (CI green, systemd active).
2. `/health` returns `status=ok`.
3. `/api/dataset/latest` `generatedAt` updated.
4. `exports/latest.json` size roughly matches pre-deploy baseline.
5. Frontend renders live data and offline banner clears.
6. Monitoring dashboards reflect new version.

---

## 9. Useful Commands & References

### API quick checks

```bash
# Latest dataset (trim to metadata)
curl -s https://api.tracker.example.com/api/dataset/latest | jq '.sources | length'

# Specific source snapshot
curl -s https://api.tracker.example.com/api/sources/overpass-alpr | jq '.snapshot'

# Latest export from disk
curl -s https://api.tracker.example.com/api/dataset/export/latest | jq '.generatedAt'
```

### npm scripts (engine)

| Command | Purpose |
|---------|---------|
| `npm run start:dev` | Development server with hot reload |
| `npm run start:prod` | Run compiled `dist/main.js` |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm run lint` | Run ESLint |
| `npm run test` | Jest unit tests |
| `npm run test:e2e` | End-to-end test suite |

### Frontend

| Command | Purpose |
|---------|---------|
| `npm run dev` | Vite dev server |
| `npm run build` | Production build (`dist/`) |
| `npm run preview` | Preview built assets locally |

---

## 10. Change Management

- Document connector modifications and schema changes in release notes.
- Before deploying breaking changes, coordinate downtime or run dual deployments to preserve exports.
- Update this runbook whenever operational procedures change.

For additional context, consult the root `README.md` and the engine-specific documentation in `backend/engine/README.md`.
