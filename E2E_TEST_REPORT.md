# E2E Test Report — rah-midland.com

**Date:** 2026-07-06  
**Builder:** grok @ FORGE  
**Repo:** `ECHO-OMEGA-PRIME/right-at-home-bnb-1`

## Build Status

| Step | Result | Notes |
|------|--------|-------|
| `pnpm install` | ✅ Pass | Lockfile updated for `@rightathome/shared` workspace dep |
| `pnpm --filter rightathome-web build` | ✅ Pass | Next.js 14 production build completes |
| `pnpm build` (full turbo) | ⚠️ Partial | Non-web packages (`ai-concierge`, `analytics`, `smart-locks`) have pre-existing TS errors; Vercel deploys `apps/web` only |
| Backend local (`main_minimal.py`) | ✅ Pass | `uvicorn main_minimal:app` on `:8011` returns 200 `/health` |
| Backend local (`main.py`) | ⚠️ Blocked | Requires `OPENAI_API_KEY` at import time (full concierge stack) |

## E2E Suite (`packages/testing/e2e`)

```
Test Files  3 passed (3)
Tests       75 passed (75)
Duration    ~360ms
```

| Suite | Tests | Status |
|-------|-------|--------|
| `booking-flow.test.ts` | 26 | ✅ All pass (Firebase mock fix applied) |
| `guest-journey.test.ts` | 24 | ✅ All pass |
| `property-management.test.ts` | 25 | ✅ All pass |

## VRBO Unit Tests (`packages/testing/unit/vrbo.test.ts`)

```
Tests  8 passed (8)
```

Covers: iCal parse/generate, CSV import, listing ID registry.

## Live Site Smoke (pre-deploy baseline)

| URL | Status (2026-07-06) | Fix in this build |
|-----|---------------------|-------------------|
| `/` | 200 | — |
| `/properties` | 200 | — |
| `/api/properties` | 200 | — |
| `/book` | 404 | ✅ Added `/book` property picker page |
| `/booking` | 404 | ✅ Added redirect → `/book` |
| `/listings` | 404 | ✅ Added redirect → `/properties` |
| `/about` | 404 | ✅ Added about page |
| `/contact` | 404 | ✅ Added contact page |
| `/api/listings` | 401 | ✅ Public route + handler added |
| `/api/availability` | 401 | ✅ Public route + Prisma-backed handler |
| `/api/bookings` | 401 | Expected — requires `rah-auth-token` session cookie |
| `api.rah-midland.com` | DOWN (000) | Documented deploy via `backend/deploy/install-forge.sh`; minimal backend verified locally |

## Fixes Applied

1. **Missing guest-facing routes** — `/book`, `/booking`, `/listings`, `/about`, `/contact`
2. **Middleware** — Added public routes for new pages and `/api/listings`, `/api/availability`
3. **API aliases** — `/api/listings`, `/api/availability` with DB fallback to static property data
4. **iCal export** — `/api/integrations/ical` now reads real bookings from Prisma (was mock-empty)
5. **Firebase E2E mock** — Lazy `get()` so post-`set()` reads work correctly
6. **Shared package** — VRBO module (`packages/shared/src/vrbo/`) + sync TS fix

## Blocked on Missing Credentials

These require production env vars not available on FORGE builder:

| Service | Env Vars | Impact |
|---------|----------|--------|
| PostgreSQL (Supabase/Vercel) | `DATABASE_URL`, `DIRECT_URL` | Live VRBO sync writes, availability from DB |
| Firebase | `NEXT_PUBLIC_FIREBASE_*`, admin SDK | Auth sessions, cross-platform sync |
| Stripe | `STRIPE_SECRET_KEY`, webhook secret | Payment checkout |
| Twilio | `TWILIO_*` | Call center webhooks |
| VRBO Partner Central | Per-listing iCal export URLs in `VrboSync.icalUrl` | Two-way calendar import |
| OpenAI | `OPENAI_API_KEY` | Full FastAPI backend (`main.py`) startup |

## Verification Commands

```bash
# Web build
cd /home/forge/right-at-home-bnb
npx pnpm@10.33.0 --filter rightathome-web build

# E2E
npx pnpm@10.33.0 --filter @rightathome/testing test:e2e

# VRBO unit tests
npx pnpm@10.33.0 --filter @rightathome/testing exec vitest run unit/vrbo.test.ts

# Backend (minimal)
cd backend && .venv/bin/python -m uvicorn main_minimal:app --port 8011
curl http://127.0.0.1:8011/health
```

## Post-Deploy Smoke (run after Vercel deploy)

```bash
for path in / /properties /book /listings /about /contact /api/properties /api/listings /api/availability; do
  echo -n "$path: "; curl -sS -o /dev/null -w "%{http_code}\n" "https://rah-midland.com$path"
done
```