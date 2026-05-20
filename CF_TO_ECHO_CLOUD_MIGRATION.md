# rah-midland.com — Cloudflare → Echo Cloud Migration

*Authored 2026-05-20 by ECHO OMEGA PRIME (Opus 4.7) per Commander directive
"i want rah-midland.com to replace all Cloudflare dependencies with Echo Cloud workers etc."*

## Scope — what counts as a "Cloudflare dependency"

Inventory of every CF touchpoint in this repo (browser-extension noise in `tools/.edge-vrbo-profile/`
ignored — those are unrelated bundled extensions). Five real deps, listed in execution order:

| # | Dep | Source location | Today | After migration |
|---|-----|------|-------|-----------------|
| 1 | **`echo-sdk-gateway.bmcii1976.workers.dev`** | `apps/web/src/lib/echo-sdk.ts:7` (`SDK_URL`) | CF Worker hosting an ECHO SDK shim with custom REST paths (`/engine/query`, `/knowledge/search`, `/brain/ingest`, `/brain/search`, `/worker/call`) | FORGE SDK gate at `sdk1.echo-op.com` via `echo-omega-bridge` tunnel — canonical envelope `{envelope_version:1, capability, params}` |
| 2 | **`rightathome-api.bmcii1976.workers.dev`** | `backend/wrangler.toml`, `backend/worker.js`, `backend/deploy-worker.js`; consumed by `apps/web/vercel.json:38` rewrite `/api/*` | CF Worker with hand-rolled properties / weather / stats endpoints | The `backend/` FastAPI app (already exists in this repo — routes for bookings/cleaners/concierge/finance/guests/locks/messages/properties/vrbo) deployed on FORGE, tunneled as `api.rah-midland.com` |
| 3 | **CF Workers AI** (`@cf/meta/llama-3.1-8b-instruct`) | `apps/web/app/api/calls/ai-respond/route.ts:166`, `apps/web/app/api/concierge/chat/route.ts:115` | Direct call to `api.cloudflare.com/client/v4/accounts/$CF_ACCOUNT_ID/ai/run/...` | `echo.claude.oauth` Max-OAuth gateway on FORGE port 8420 ($0 via Bobby's Max subscription) — same path numerology uses |
| 4 | **CF R2** | `.env.example` (`CLOUDFLARE_R2_ACCESS_KEY`, `_SECRET_KEY`, `_BUCKET`, `_ENDPOINT`) | Configured but no code touches it yet | MinIO on ANVIL (`192.168.1.96:9000`) — same S3 API, drop-in client swap |
| 5 | **`tools/property-questionnaire/`** | Separate CF Worker (`wrangler.toml`) — small form receiver | Standalone deploy | Single FastAPI endpoint on FORGE, gated under the same tunnel hostname |

Doctrine reminder (CLAUDE.md): **HARD BAN** on CF Workers / R2 / D1 / KV / DOs / Pages / Queues
/ Hyperdrive / Vectorize / AI Gateway. Only `cloudflared` named tunnel `echo-omega-bridge`
(id `53f370a8-78c8-4146-8b57-f1577f85b327`) is allowed.

---

## Architecture after migration

```
                         ┌──────────────────────────────────────────────────────┐
                         │  Vercel (unchanged) — rah-midland.com Next.js app    │
                         │  • Frontend pages                                    │
                         │  • Next.js /api/* routes (use FORGE backends now)    │
                         └──────────┬───────────────────────┬───────────────────┘
                                    │                       │
                                    │ HTTPS                 │ HTTPS
                                    │                       │
                          ┌─────────▼──────────┐   ┌────────▼───────────────┐
                          │ api.rah-midland.com│   │ sdk1.echo-op.com       │
                          │ (cloudflared tunnel│   │ (same tunnel hostname  │
                          │  → FORGE :8001     │   │  used by numerology    │
                          │  uvicorn FastAPI)  │   │  → FORGE :8000 gate)   │
                          │  RAH backend       │   │  Engine/knowledge/brain│
                          └─────────┬──────────┘   └─────────────┬──────────┘
                                    │                            │
                                    │       FORGE 192.168.1.137  │
                                    └─────────────┬──────────────┘
                                                  │
                          ┌──────────────────┬────┴────┬──────────────────────┐
                          │                  │         │                      │
                          ▼                  ▼         ▼                      ▼
                  ┌─────────────┐    ┌─────────────┐ ┌─────────────────┐ ┌─────────┐
                  │ Postgres    │    │ echo-claude │ │ Engines (5,500) │ │ MinIO   │
                  │ +pgvector   │    │ -oauth :8420│ │ + knowledge fwk │ │ ANVIL   │
                  │ :5432       │    │ Max OAuth   │ │                 │ │ :9000   │
                  │ (Prisma /   │    │ ($0/req)    │ │                 │ │ (R2     │
                  │  Drizzle)   │    │             │ │                 │ │  replc) │
                  └─────────────┘    └─────────────┘ └─────────────────┘ └─────────┘
```

**One Cloudflare thing remains**: the *named tunnel* `echo-omega-bridge` (doctrine-allowed —
it's just ingress, not compute). All compute moves to FORGE/ANVIL.

---

## Phase plan

### Phase 0 — Prep (Commander's hand, parallel to Phase 1)

These are the same shape as the numerology last-mile + already-staged enablers (see
`COMMANDER_HANDOFF.md` §1 + §Setup items).

| Step | Where | What |
|------|-------|------|
| 0.1 | CF Zero Trust → Tunnels → echo-omega-bridge → Public Hostnames | Add `sdk1.echo-op.com` → `http://localhost:8000` (FORGE SDK gate) **if not already there from numerology setup** |
| 0.2 | CF Zero Trust → Tunnels → echo-omega-bridge → Public Hostnames | Add `api.rah-midland.com` → `http://localhost:8001` (where the RAH FastAPI backend will listen) |
| 0.3 | `cloudflared` config on FORGE (`/etc/cloudflared/config.yml` or `~/.cloudflared/config.yml`) | Adds the same two ingress entries; reload `cloudflared` after |
| 0.4 | Vercel project (rah-midland) → Settings → Env Vars | Add `ECHO_SDK_GATE=https://sdk1.echo-op.com`, `ECHO_API_BASE=https://api.rah-midland.com`, `ECHO_SOVEREIGN_KEY=<value of forge:/home/forge/.echo_sovereign_key>`, `LLM_GATEWAY=https://sdk1.echo-op.com`, `LLM_CAP=echo.claude.oauth` |
| 0.5 | Vercel project | Redeploy from `main` (or trigger by pushing a no-op commit) |

### Phase 1 — Code migration (autonomous; no Commander keystroke)

These all happen in this repo on a feature branch (`cf-to-echo-cloud`).
**No code below assumes a Commander credential drop — all the new endpoints sit behind the
tunnel and use the existing sovereign key flow.**

| Step | File(s) | Change |
|------|---------|--------|
| 1.1 | `apps/web/src/lib/echo-sdk.ts` | Swap `SDK_URL` to `process.env.ECHO_SDK_GATE`, replace REST paths with canonical envelope POSTs to `/sdk/invoke`; map: `/engine/query`→`echo.engine.query`, `/knowledge/search`→`echo.knowledge.search`, `/brain/ingest`→`echo.context.remember`, `/brain/search`→`echo.context.recall`, `/worker/call`→`echo.claude.oauth` |
| 1.2 | `apps/web/app/api/calls/ai-respond/route.ts` | Replace direct `api.cloudflare.com/.../ai/run/@cf/meta/llama-3.1-8b-instruct` POST with `echo.claude.oauth` cap invocation |
| 1.3 | `apps/web/app/api/concierge/chat/route.ts` | Same as 1.2 |
| 1.4 | `apps/web/vercel.json` line 38 | Change rewrite destination from `https://rightathome-api.bmcii1976.workers.dev/:path*` to `https://api.rah-midland.com/:path*` |
| 1.5 | `apps/web/next.config.js:59` CSP | Drop `https://*.bmcii1976.workers.dev` from `connect-src`; add `https://sdk1.echo-op.com https://api.rah-midland.com` |
| 1.6 | `backend/wrangler.toml`, `backend/worker.js`, `backend/deploy-worker.js`, `backend/DEPLOY_INSTRUCTIONS.md` | **Delete** (CF Worker is going away — the FastAPI app in the same dir is the replacement) |
| 1.7 | `backend/` FastAPI app | Add CORS allow-list for `https://rah-midland.com`; verify it boots clean against the FORGE Postgres (`DATABASE_URL` already wired) |
| 1.8 | `backend/` deploy artifact | Add `backend/deploy/forge-systemd.service` unit + a one-shot install script that drops it on FORGE (or run via uvicorn under the existing `echo-claude-oauth.service` pattern) |
| 1.9 | `.env.example` | Replace `CLOUDFLARE_R2_*` with `MINIO_ENDPOINT=http://192.168.1.96:9000`, `MINIO_BUCKET=rah-uploads`, `MINIO_ACCESS_KEY=…`, `MINIO_SECRET_KEY=…`; keep R2 names commented + deprecated for one release for rollback |
| 1.10 | `tools/property-questionnaire/wrangler.toml` | Delete + add equivalent FastAPI route (single `POST /questionnaire`) under the RAH backend |
| 1.11 | New file: `WEBSITES/right-at-home-bnb/docs/echo-cloud-architecture.md` | Persistent architecture doc for next maintainer |
| 1.12 | `RAH_MIDLAND_PROJECT_STATUS.md` | Update "TECH STACK" table — change "Backend API: Next.js + CF Worker fallback PARTIAL" → "Backend API: Next.js + FastAPI on FORGE LIVE"; "Echo Vault API: workers.dev" → "Echo SDK gate via cloudflared tunnel" |

### Phase 2 — Deploy + smoke test (Commander + ECHO together)

| Step | Owner | Verify |
|------|-------|--------|
| 2.1 | ECHO | `curl https://sdk1.echo-op.com/sdk/health` returns 200 (depends on Phase 0.1) |
| 2.2 | ECHO | `curl https://api.rah-midland.com/health` returns FastAPI health JSON (depends on Phase 0.2 + 1.8) |
| 2.3 | ECHO | From the deployed Vercel app: hit `/api/properties` → returns DB rows (not the workers.dev mock) |
| 2.4 | ECHO | Hit `/api/concierge/chat` → response from `echo.claude.oauth` with `billing: "$0-max-oauth"` |
| 2.5 | Commander | Browse rah-midland.com → confirm dashboard loads real data, no CF Worker calls in DevTools Network panel |
| 2.6 | ECHO | Search `apps/web` + `bridge/` + `backend/` for any remaining `workers.dev` / `cloudflare` string — should be zero (except in comments referencing the old behavior) |
| 2.7 | ECHO | `echo.context.remember` a session_summary at importance 0.90 with the migration artifact ID + final commit SHA |

### Phase 3 — Decommission (Commander's hand)

| Step | What |
|------|------|
| 3.1 | CF dashboard → Workers → delete `rightathome-api`, `echo-sdk-gateway` (do NOT delete `echo-vault-api` yet — other projects may still reference it; do a separate audit pass) |
| 3.2 | CF dashboard → R2 → delete `rightathome-uploads` bucket (if empty / migrated) |
| 3.3 | Git: merge `cf-to-echo-cloud` → `main`, delete branch |

---

## Risk register

| Risk | Mitigation |
|------|------------|
| Vercel rewrite to `api.rah-midland.com` breaks before tunnel hostname exists | Phase order: do Phase 0 (Commander's hand) BEFORE Phase 1.4 ships. We can ship 1.1/1.2/1.3 first (those use env-var-driven endpoints — fallback to old CF Worker if env var unset), then 1.4 when Phase 0 is green |
| FORGE SDK gate down → entire frontend AI breaks | `sdk1.echo-op.com` ingress already has connection caching in cloudflared; gate uptime is the constraint, identical situation to numerology |
| Postgres connection storm from Next.js serverless | Existing config uses Supabase pooler (port 6543) which is built for this; FORGE Postgres also has pgBouncer pattern available |
| Cleanup deletes a worker still used by another project | Phase 3.1 is gated — audit pass before deletion |
| Existing R2 uploads (if any) lose pre-signed URL access during cutover | None exist today (R2 vars set but no code path) — clean cutover |

---

## Existing infra we lean on (already live, verified)

| | State |
|---|---|
| FORGE SDK gate `192.168.1.137:8000/sdk/invoke` | 1249 caps, ENFORCING, smoke-verified |
| `echo-claude-oauth.service` (FORGE :8420) | active, `billing:"$0-max-oauth"` |
| `cloudflared` named tunnel `echo-omega-bridge` | active, ingress patched for claude-oauth already |
| MinIO on ANVIL :9000 | per cluster doctrine — R2 replacement |
| Postgres on FORGE :5432 (echo/echo) | 1.13M-row function index, pgvector |

---

## Commander-keystroke summary

Only 5 keystrokes total — same shape as numerology's last-mile:

1. **CF dashboard public hostname:** `api.rah-midland.com` → `http://localhost:8001` (under `echo-omega-bridge` tunnel).
2. **CF dashboard public hostname:** `sdk1.echo-op.com` → `http://localhost:8000` (if not already there from numerology).
3. **Vercel env vars:** `ECHO_SDK_GATE`, `ECHO_API_BASE`, `ECHO_SOVEREIGN_KEY`, `LLM_GATEWAY`, `LLM_CAP` (5 vars).
4. **Vercel redeploy.**
5. **Confirm decommission targets** before Phase 3.1 worker deletes (you click delete on workers.dev workers).

Everything else is autonomous code work.

---

*This plan is built to be **shipped in stages**, not one big-bang flip. Phase 1 steps 1.1–1.3
all use env-var endpoints with fallback — they can land, ship to prod, and continue to use
the old CF Worker URLs until Phase 0 completes. Phase 1.4 (the vercel.json rewrite) is the
only step that **requires** Phase 0 done first, so it ships last.*
