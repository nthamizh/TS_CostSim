# CostSimulator — Dev Setup

## Prerequisites
- Node 24+, pnpm 9+
- Docker / Docker Compose
- A GitHub PAT with `read:packages` scope (for `@nthamizh/ui`)

## 1. Clone and install
```bash
git clone https://github.com/your-org/TS_CostSimulator
cd TS_CostSimulator
echo "//npm.pkg.github.com/:_authToken=YOUR_PAT" >> .npmrc
pnpm install
```

## 2. Start infrastructure
```bash
docker compose up -d   # postgres:5433, redis:6380, minio:9002
```

## 3. Migrate
```bash
cd apps/api
cp .env .env.local     # already has localhost defaults
pnpm db:migrate
```

## 4. Start all apps
```bash
pnpm dev               # api :4002, web :5175, worker
```

API health:  http://localhost:4002/health
Web dev:     http://localhost:5175/costsim

## Env vars (apps/api/.env)
| Variable | Default | Notes |
|---|---|---|
| DATABASE_URL | postgres://costsim:costsim@localhost:5433/costsim | |
| REDIS_URL | redis://localhost:6380 | |
| COSTSIM_SHARED_SECRET | — | Min 32 chars; must match Platform |
| PLATFORM_API_URL | http://localhost:4000 | For ETL status callbacks |
| STORAGE_* | localhost:9002/minioadmin | MinIO dev instance |

## Loading test data
POST a JSON array matching the target table's column shape to MinIO at
`costsim/etl/<enterpriseId>/<targetTable>.json`, then trigger the ETL
webhook manually:
```bash
curl -X POST http://localhost:4002/v1/jobs/etl-handler \
  -H "X-CostSim-Token: <signed-jwt>" \
  -H "Content-Type: application/json" \
  -d '{"jobId":"...","jobType":"etl","jobConfig":{"targetTable":"eligibility","enterpriseId":"..."},"runId":"..."}'
```
