# VRBO Direct Sync — Architecture & Operations

**Steven Palma · Right at Home BnB · Midland TX · 22 properties**

VRBO gives individual hosts **no REST API**. This system uses iCal two-way sync, public page scraping, and Partner Central CSV import.

## Architecture

```
┌─────────────────────┐     iCal import (15 min)      ┌──────────────────┐
│  VRBO Partner       │ ─────────────────────────────►│  rah-midland.com │
│  Central            │   per-listing .ics URL        │  (Next.js/Vercel)│
└─────────────────────┘                               └────────┬─────────┘
         ▲                                                       │
         │ iCal export subscribe                                 │ Prisma
         │ (blocked dates)                                       ▼
         │                                              ┌──────────────────┐
┌────────┴────────────┐   daily scrape                   │  PostgreSQL      │
│  vrbo.com/<id>      │ ───────────────────────────────►│  VrboSync table  │
│  (public listings)  │                                   │  Booking/Guest   │
└─────────────────────┘                                   └──────────────────┘
         ▲
         │ CSV export (manual or scheduled)
┌────────┴────────────┐
│  Partner Central    │
│  Reservations       │
└─────────────────────┘
```

### Modules

| Layer | Path | Role |
|-------|------|------|
| Shared iCal/scrape/CSV | `packages/shared/src/vrbo/` | Parse/generate iCal, scrape listings, parse CSV |
| Sync engine | `apps/web/src/lib/integrations/vrbo-sync-service.ts` | Import VRBO iCal → Prisma bookings |
| Listing cache | `apps/web/src/lib/integrations/vrbo-listing-service.ts` | Scrape → update Property + photos |
| CSV import | `apps/web/src/lib/integrations/vrbo-csv-import-service.ts` | Partner Central CSV → bookings |
| iCal export | `apps/web/app/api/integrations/ical/route.ts` | Export direct bookings for VRBO subscription |
| Cron iCal | `apps/web/app/api/cron/vrbo-sync/route.ts` | Every 15 min |
| Cron listings | `apps/web/app/api/cron/vrbo-listings/route.ts` | Daily 06:00 UTC |
| Admin UI | `apps/web/app/vrbo/page.tsx` + `SyncStatusPanel` | Status, manual sync |
| FastAPI (optional) | `backend/services/integrations/vrbo.py` | Same iCal logic on FORGE |

## Environment Variables

### Required for production sync

```env
# Database (Supabase / Vercel Postgres)
DATABASE_URL=postgresql://...
DIRECT_URL=postgresql://...

# Cron auth (Vercel sets Authorization: Bearer automatically)
CRON_SECRET=your-random-secret

# iCal export key (VRBO subscribes to this URL)
ICAL_EXPORT_KEY=rah-midland-ical-2026
```

### Optional — Partner Central automation

```env
# From Echo vault (services VRBO_STEVEN_PALMA / vrbo_partner_central)
# NEVER commit these — load from vault at deploy time
VRBO_PARTNER_EMAIL=steven@...
VRBO_PARTNER_PASSWORD=...

# Legacy Expedia Partner API (NOT available to individual hosts — leave empty)
VRBO_API_KEY=
VRBO_API_SECRET=
```

### Backend (api.rah-midland.com on FORGE)

```env
OPENAI_API_KEY=sk-...          # Required for full main.py
CORS_ALLOWED_ORIGINS=https://rah-midland.com,https://www.rah-midland.com
DATABASE_URL=postgresql://...
```

## Deploy Backend to FORGE

```bash
# From your machine — pushes backend/ to FORGE and starts systemd unit
ssh forge "bash -s" < backend/deploy/install-forge.sh

# Or clone fresh from GitHub on FORGE
RAH_FROM_GITHUB=1 ssh forge "bash -s" < backend/deploy/install-forge.sh

# Smoke test (local on FORGE)
curl -sS http://127.0.0.1:8001/health

# Public (after cloudflared tunnel)
curl -sS https://api.rah-midland.com/health
```

Service: `rah-midland-api` · Port: `8001` · Unit file: `backend/deploy/forge-systemd.service`

## What Steven Must Provide

### 1. Per-listing iCal export URLs (REQUIRED for calendar sync)

For each of the 15 active VRBO listings:

1. Log into [VRBO Partner Central](https://www.vrbo.com/pm)
2. Select property → **Calendar** → **Import/Export** → **Export calendar**
3. Copy the `.ics` URL (format: `https://www.vrbo.com/icalendar/<hash>.ics`)
4. Store in database:

```sql
UPDATE "VrboSync" SET "icalUrl" = 'https://www.vrbo.com/icalendar/....ics'
WHERE "vrboListingId" = '2634718';
```

Or via admin API:

```bash
curl -X POST https://rah-midland.com/api/admin/vrbo-ical \
  -H "Cookie: rah-auth-token=..." \
  -d '{"propertyId":"castleford-5005","icalUrl":"https://www.vrbo.com/icalendar/....ics"}'
```

### 2. Subscribe VRBO to our export feed (REQUIRED for two-way)

For each listing in Partner Central:

1. **Calendar** → **Import calendar**
2. Paste: `https://rah-midland.com/api/integrations/ical?propertyId=<slug>&key=<ICAL_EXPORT_KEY>`
3. VRBO polls every ~60 minutes

### 3. Reservations — choose one

**Option A — CSV export (recommended, no credentials in app)**

1. Partner Central → **Reservations** → **Export**
2. Upload:

```bash
curl -X POST https://rah-midland.com/api/vrbo/reservations/import \
  -H "Cookie: rah-auth-token=..." \
  -F "file=@reservations.csv"
```

**Option B — Partner Central login (automated scraper, future)**

Set `VRBO_PARTNER_EMAIL` + `VRBO_PARTNER_PASSWORD` from vault. Scraper module documented in `tools/vrbo_autonomous_scraper.py` — requires Playwright + approval gate.

## Listing IDs (15 core)

```
2634718, 2636389, 2638481, 2638524, 2643784, 2643822,
3005111, 3355618, 3477668, 4179271, 4437486, 4471713,
4581977, 4700881, 4750070
```

Additional listings documented in `STEVEN_PALMA_BNB_LISTINGS/`.

## API Endpoints

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/api/cron/vrbo-sync` | GET | CRON_SECRET | iCal import all properties |
| `/api/cron/vrbo-listings` | GET | CRON_SECRET | Daily listing scrape |
| `/api/admin/vrbo-status` | GET/POST | Admin session | Sync status + manual trigger |
| `/api/integrations/ical` | GET | `key` param | Export iCal for VRBO |
| `/api/vrbo/reservations/import` | POST | Admin session | CSV import |
| `/api/listings` | GET | Public | Listing catalog |
| `/api/availability` | GET | Public | Date availability check |

## Manual Sync

```bash
# Trigger full iCal sync (admin auth required)
curl -X POST https://rah-midland.com/api/admin/vrbo-status \
  -H "Content-Type: application/json" \
  -H "Cookie: rah-auth-token=dev_owner_admin" \
  -d '{"action":"sync_all"}'
```

## UI

- **VRBO admin:** `/vrbo` — full management dashboard
- **Calendar:** `/calendar` — compact `SyncStatusPanel` widget
- **Bookings:** `/bookings` — existing sync indicators + conflict modals