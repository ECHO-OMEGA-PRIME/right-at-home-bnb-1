# rah-midland.com — Echo Cloud Architecture

*Authored 2026-05-20 alongside the CF → Echo Cloud migration
(`CF_TO_ECHO_CLOUD_MIGRATION.md` in repo root).*

This document is for the **next maintainer**. It explains where every
piece of rah-midland.com runs and why, after the migration off Cloudflare.

## The shape

```
        rah-midland.com (Vercel)
        ┌───────────────────────────────────────┐
        │ Next.js 14 — apps/web/                │
        │ • Server components + /api routes     │
        │ • Prisma → Supabase Postgres          │
        │ • Firebase Auth + Firestore           │
        │ • Twilio (incoming calls / SMS)       │
        └────┬─────────────────────────┬────────┘
             │                         │
   /api/v1/* rewrite                  /api/calls/ai-respond,
   (apps/web/vercel.json)             /api/concierge/chat,
             │                         and any code using
             │                         apps/web/src/lib/echo-sdk.ts
             ▼                         │
        api.rah-midland.com            ▼
        ┌────────────────────┐    sdk1.echo-op.com
        │ FORGE :8001        │    ┌─────────────────────┐
        │ uvicorn FastAPI    │    │ FORGE :8000         │
        │ backend/main.py    │    │ Echo SDK gate       │
        │ • property routes  │    │ • envelope /sdk/    │
        │ • cleaners, locks  │    │   invoke            │
        │ • finance, guests  │    │ • 1249 caps regd    │
        │ • concierge, msgs  │    └──────┬──────────────┘
        └────────┬───────────┘           │
                 │                       │ echo.claude.oauth cap
                 │                       ▼
                 │                  ┌──────────────────────┐
                 │                  │ FORGE :8420          │
                 │                  │ echo-claude-oauth    │
                 │                  │ systemd service —    │
                 │                  │ spawns `claude` CLI  │
                 │                  │ ($0 Max OAuth)       │
                 │                  └──────────────────────┘
                 │
                 ▼
        ┌───────────────────────────────┐      ┌────────────────────┐
        │ Postgres on FORGE :5432       │      │ MinIO on ANVIL     │
        │ (or Supabase pooler)          │      │ 192.168.1.96:9000  │
        │ — RAH app schema              │      │ — uploads bucket   │
        │                               │      │  (S3 API)          │
        └───────────────────────────────┘      └────────────────────┘
```

## Tunnel layout

All public hostnames terminate at the cloudflared named tunnel
**`echo-omega-bridge`** (id `53f370a8-78c8-4146-8b57-f1577f85b327`).
The *named tunnel* is the **only** Cloudflare thing in this stack —
it's allowed by doctrine because it's just ingress, not compute.

Ingress on FORGE (`~/.cloudflared/config.yml` or `/etc/cloudflared/config.yml`):

```yaml
tunnel: 53f370a8-78c8-4146-8b57-f1577f85b327
credentials-file: /etc/cloudflared/53f370a8-78c8-4146-8b57-f1577f85b327.json

ingress:
  - hostname: sdk1.echo-op.com
    service: http://localhost:8000     # Echo SDK gate
  - hostname: claude-oauth.echo-op.com
    service: http://localhost:8420     # Max-OAuth Claude gateway (numerology)
  - hostname: api.rah-midland.com
    service: http://localhost:8001     # RAH FastAPI backend (this migration)
  # ... other hostnames ...
  - service: http_status:404
```

The matching public-hostname records in CF Zero Trust must exist for each
entry — `cloudflared tunnel route dns <UUID> <hostname>` creates the CNAME.

## Vercel env vars (required for the AI + SDK paths)

| Var | Value | Why |
|-----|-------|-----|
| `ECHO_SDK_GATE` | `https://sdk1.echo-op.com` | All SDK calls go here (`apps/web/src/lib/echo-sdk.ts` + `echo-llm.ts`) |
| `ECHO_SOVEREIGN_KEY` | value of `forge:/home/forge/.echo_sovereign_key` `SOVEREIGN_KEY=…` | `X-Echo-API-Key` header on every invoke |
| `LLM_CAP` | `echo.claude.oauth` | Default LLM cap — Max-OAuth path |
| `LLM_MODEL` | `claude-haiku-4-5-20251001` | Default model |
| `ECHO_API_BASE` | `https://api.rah-midland.com` | Where the `/api/v1/*` rewrite points |
| `CORS_ALLOWED_ORIGINS` | (FORGE only) `https://rah-midland.com,https://www.rah-midland.com` | Tightens the FastAPI CORS allowlist for prod |

## Deploying the backend on FORGE

```bash
# From this repo on FORGE (after a git clone or scp of backend/):
cd <repo>/backend
RAH_FROM_GITHUB=0 bash deploy/install-forge.sh
sudo systemctl status rah-midland-api
sudo journalctl -u rah-midland-api -f
```

The install script is idempotent. The systemd unit at
`backend/deploy/forge-systemd.service` listens on `0.0.0.0:8001`,
runs as user `forge`, restarts on failure.

## Smoke tests after deploy

```bash
# Backend reachable on LAN
curl -sS http://192.168.1.137:8001/ | head

# Backend reachable through the tunnel
curl -sS https://api.rah-midland.com/ | head

# SDK gate reachable through the tunnel
curl -sS https://sdk1.echo-op.com/sdk/health | jq

# End-to-end concierge AI (after Vercel env vars + redeploy)
curl -sS -X POST https://rah-midland.com/api/concierge/chat \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"smoke","message":"early breakfast in Midland?"}'
```

## What was removed (and where it lived)

| Removed | Was at | Replacement |
|---------|--------|-------------|
| `backend/wrangler.toml` | CF Worker `rightathome-api.bmcii1976.workers.dev` | This FastAPI app on FORGE :8001 |
| `backend/worker.js`, `backend/deploy-worker.js`, `backend/DEPLOY_INSTRUCTIONS.md` | CF Worker source + deploy script | Replaced by `deploy/install-forge.sh` + systemd unit |
| `tools/property-questionnaire/wrangler.toml` | CF Worker `rah-property-questionnaire` | See `tools/property-questionnaire/MIGRATION_NOTE.md` — `worker.js` retained as port source |
| `apps/web/src/lib/echo-sdk.ts` (old REST shim) | CF Worker `echo-sdk-gateway.bmcii1976.workers.dev` | Same file rewritten to canonical SDK envelope |
| `CLOUDFLARE_R2_*` env vars | `.env.example` | `MINIO_*` env vars pointing at ANVIL `192.168.1.96:9000` |
| Direct `api.cloudflare.com/.../ai/run/@cf/meta/llama-3.1-8b-instruct` calls | `apps/web/app/api/calls/ai-respond/route.ts`, `apps/web/app/api/concierge/chat/route.ts` | `apps/web/src/lib/echo-llm.ts` → `echo.claude.oauth` cap |

## What stayed (and why)

| Kept | Why |
|------|-----|
| Vercel hosting | Vercel isn't Cloudflare; vendor diversity is fine; the deploy story is well-trodden |
| cloudflared named tunnel `echo-omega-bridge` | Allowed by doctrine — ingress only, not compute |
| Supabase Postgres | Could move to FORGE Postgres in a future pass; not blocking this migration |
| Firebase Auth/Firestore | Out of scope — the directive was Cloudflare specifically |
| `apps/web/app/admin/workers/page.tsx` | Page name "workers" refers to cleaning workers (Steven's staff), NOT CF Workers. False match in the grep. |

## Future passes

- Port `tools/property-questionnaire/worker.js` into the Next.js app (option 1 in its MIGRATION_NOTE).
- Migrate Supabase → FORGE Postgres if Bobby wants vendor consolidation (separate ticket).
- Hook the `echo.engine.query`/`echo.knowledge.search` calls in `echo-sdk.ts` into UI surfaces where they'd add value (currently lib is configured but not heavily used in the page tree).

---

*If you're a future me reading this: the migration is documented in detail at
`CF_TO_ECHO_CLOUD_MIGRATION.md` (the plan) and in the memory card
`project-rah-midland-cf-migration`. The grep that misses it on first try is
`rah-midland*` as a dirname pattern — the repo is named `right-at-home-bnb`.*
