# Idea2Video — Railway Edition (Phase 1 MVP)

Same product, ported off Cloudflare Workers onto Railway. This removes the
awkward two-platform split (edge Workers + a separate render container) from
the original design — everything here is plain Node.js, which can run FFmpeg
directly, so the "render worker" is just a second process of the same
codebase instead of a separate deploy target glued on via HTTP.

## What changed vs. the Cloudflare version

| | Cloudflare version | Railway version |
|---|---|---|
| API runtime | Cloudflare Workers (Hono) | Node.js (Express) |
| Database | D1 (SQLite, edge) | Postgres (managed by Railway) |
| Job queue | Cloudflare Queues + HTTP-pull hack | Redis + BullMQ (native retries/backoff) |
| Composition | Separate container, HTTP callbacks + service token | Same codebase, second Railway service, direct DB access |
| Storage | Cloudflare R2 | Still Cloudflare R2 (or any S3-compatible — storage is decoupled from compute) |
| Frontend | Next.js on Cloudflare Pages | Next.js — deploy on Railway or Vercel, your call |

Business logic (providers, Visual Router, cost tracking, pipeline stages) is
functionally identical — only the infrastructure glue changed.

## 1. Prerequisites

- Railway account
- Same API keys as before: OpenAI, Replicate, ElevenLabs, Pexels, Serper
- Cloudflare R2 (or Backblaze B2 / AWS S3) bucket + access keys for storage — kept separate from compute since object storage pricing/egress matters independently of where your app runs

## 2. Local development

```bash
docker compose up -d          # Postgres + Redis
cd api
cp .env.example .env          # fill in DATABASE_URL=postgres://idea2video:localdev@localhost:5432/idea2video
                               # and REDIS_URL=redis://localhost:6379, plus your API keys
npm install
npm run db:migrate
npm run db:seed
npm run dev:server             # terminal 1
npm run dev:worker              # terminal 2

cd ../web
cp .env.example .env.local     # NEXT_PUBLIC_API_URL=http://localhost:8080
npm install
npm run dev
```

## 3. Deploy to Railway

Railway project with **four services**, all from this one repo:

1. **Postgres** — Railway plugin, one click. Copy the generated `DATABASE_URL`.
2. **Redis** — Railway plugin, one click. Copy the generated `REDIS_URL`.
3. **api** service — root directory `api/`, Dockerfile build.
   - Start command: `npm run start:server` (default `CMD` in the Dockerfile)
   - Env vars: `DATABASE_URL`, `REDIS_URL` (reference the plugins), `JWT_SECRET`, `RENDER_WORKER_SERVICE_TOKEN` (any random string, not actually needed for auth anymore but kept for parity/future use), all the AI provider keys, `S3_*` vars.
4. **worker** service — **same repo, same `api/` root directory, same Dockerfile**, but override the start command in Railway's service settings to `npm run start:worker`. Same env vars as `api` (needs DB + Redis + provider keys, since composition calls FFmpeg but the earlier pipeline stages already ran in `api`).

Then:
```bash
# One-time: run migrations against the Railway Postgres instance
psql $DATABASE_URL -f infra/migrations/0001_init.sql
psql $DATABASE_URL -f infra/seed/seed.sql
```

5. **web** service — root directory `web/`, Dockerfile build, or just deploy to Vercel instead (better Next.js DX, generous free tier, no reason it has to be on Railway). Set `NEXT_PUBLIC_API_URL` to the `api` service's public Railway URL either way.

## 4. First test run

Same as before: sign up → Create Video → *"Explain ACH payments to a beginner"* → English → 5 min → Professional → Standard → watch `/video/:id` progress → Approve & Complete → Download.

## 5. Why this is a better fit for the actual objective

The product's core workload is long-running media composition and AI
orchestration, not low-latency globally-distributed request handling. Railway
(or Render/Fly — same shape) matches that directly: one Postgres, one Redis,
two Node processes that can both run FFmpeg natively, real job retries via
BullMQ, and no HTTP-based workaround just to get a queue message from an edge
platform into a container that can actually do the work.

## 6. Same known MVP limitations as before

- Composition is FFmpeg-based; swap for Remotion when you want real
  chart/diagram scene rendering instead of plain text slides.
- No caption burn-in yet (word-timestamp estimation exists in the TTS
  provider file, not yet wired into an SRT + FFmpeg subtitle pass).
- No Razorpay checkout flow — schema is ready, UI/webhook handling isn't built.
- Replicate video model version hash is a placeholder — pin a real one before
  enabling Tier 4 in production.


