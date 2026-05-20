# RAH-MIDLAND.COM — COMPLETE PROJECT STATUS & BUILD PLAN
## Steven Palma | Right at Home BnB | Midland, TX
## Target: Fully Autonomous Operations by May 2026

---

## OVERVIEW

**Website:** https://rah-midland.com (Live, Vercel auto-deploy from GitHub)
**GitHub:** github.com/bobmcwilliams4/right-at-home-bnb (Private)
**Properties:** 22 vacation rentals in Midland, TX
**Owner:** Steven Palma (steven.palma@rah-midland.com | (432) 559-1904)
**Goal:** Website + apps run the entire business while Steven is in Spain (May 2026)

---

## TECH STACK

| Layer | Technology | Status |
|-------|-----------|--------|
| Frontend | Next.js 15 + React 19 + TailwindCSS | LIVE |
| Hosting | Vercel (auto-deploy from GitHub) | LIVE |
| Database | Prisma ORM + Supabase PostgreSQL | ✅ PRODUCTION |
| Auth | Firebase Authentication | CONFIGURED |
| Real-time | Firebase Firestore | CONFIGURED |
| Backend API | Next.js API Routes + FastAPI on FORGE (`api.rah-midland.com` via cloudflared tunnel) | ✅ CODE READY — deploy via `backend/deploy/install-forge.sh` |
| Mobile App | React Native + Expo | UI BUILT, NOT DEPLOYED |
| Desktop App | Electron + React | UI BUILT, NOT DEPLOYED |
| Smart Locks | Tuya Cloud API (ARPHA D280W WiFi) | API LIVE, 3 LOCKS CONNECTED |
| Channel Manager | OwnerRez (free trial) — decision pending | PENDING |
| Voice/Calls | Twilio (calls + SMS) | ✅ CREDENTIALS SET |
| AI / LLM | Echo SDK gate → `echo.claude.oauth` ($0 Max-OAuth, primary) + GROQ fallback. Replaced Cloudflare Workers AI 2026-05-20. | ✅ CODE READY |
| Object Storage | MinIO on ANVIL `192.168.1.96:9000` (S3-compatible). Replaced Cloudflare R2 2026-05-20. | ✅ CODE READY |
| AI Concierge | Groq + fallback to SENTINEL-OMNI | CODE READY |
| TTS | ElevenLabs v3 | CODE READY |
| Payments | Stripe + Square | CODE EXISTS, NOT CONFIGURED |
| Email | Zoho SMTP (rah-midland.com domain) | CONFIGURED |

---

## SMART LOCK SYSTEM — TUYA / ARPHA D280W

### Status: API VERIFIED LIVE

**Locks Installed:**

| Property | Device ID | Status | Battery |
|----------|-----------|--------|---------|
| Garfield | `eb066e65fa99294ea78miv` | ONLINE, LOCKED | 100% |
| Castleford | `eb51f7fbcf98b9d955wqb9` | MAPPED | TBD |
| Lincoln Green | `eb6d7ec17a24e8948dnhee` | MAPPED | TBD |

**Tuya Cloud Credentials (in Echo Vault):**
- Client ID: `3f5a7je79x58r8yscvxw`
- Client Secret: `781115f4900d43dc9b66eaa27f56ca7c`
- Data Center: Western America (`openapi.tuyaus.com`)
- Smart Life Account: rightathomemidland@gmail.com
- UID: `bay1773877962749xHcZ`

**API Verified:**
- Token generation: WORKING
- Device status query: WORKING (Garfield tested 2026-04-02)
- Temporary password creation endpoint: AVAILABLE
- Temporary password deletion endpoint: AVAILABLE
- Entry logs endpoint: AVAILABLE

**Automation Flow (code-complete, needs end-to-end test):**
```
Booking confirmed (any source)
  → tuya-lock-client.ts creates time-limited 6-digit code
  → Code pushed to ARPHA D280W lock via Tuya Cloud API
  → Guest receives code via email + SMS
  → Check-out time → code auto-deleted via Tuya API
  → Lock auto-locks (10 second timer configured on hardware)
  → Thermostat resets to eco mode (65°F)
```

**Code:** `apps/web/src/lib/tuya-lock-client.ts`
**API Route:** `apps/web/app/api/smart-home/route.ts`

**REMAINING WORK:**
- [ ] End-to-end test: create temp code → verify on physical lock → delete code
- [ ] Test code expiration (time-limited validity)
- [ ] Wire booking trigger → auto code generation
- [ ] Install locks on remaining 19 properties
- [ ] Set up Tuya webhook for real-time lock/unlock notifications
- [ ] Battery monitoring alerts (notify Steven when < 20%)

---

## CHANNEL MANAGER / PMS — DECISION NEEDED

### Current: OwnerRez Free Trial (14 days)
**Login:** sp3158@sbcglobal.net / Maxwell2824! (2FA via email)
**API Status:** Need 2FA code from Steven to generate `pt_*` API token

### Options Researched:

| Platform | Cost (22 props) | API Quality | VRBO+Airbnb | Recommendation |
|----------|-----------------|-------------|-------------|----------------|
| Lodgify | $96-120/mo | Good | Yes | CHEAPEST |
| Beds24 | $154-220/mo | Strong | Yes | BEST VALUE |
| OwnerRez | $300-400/mo | Best | Yes | BEST API |

### What the PMS Does:
1. Syncs calendar across VRBO, Airbnb, Booking.com (prevents double bookings)
2. Manages rates/pricing across all channels
3. Receives booking notifications from all channels
4. Sends automated guest messages (pre-arrival, check-in, mid-stay, checkout)
5. Processes payments (via Stripe)
6. Feeds bookings into RAH-midland.com → triggers smart lock code generation

### Integration Built (ready to wire up):
- `apps/web/src/lib/ownerrez-client.ts` — Full OwnerRez v2 REST API client
- `apps/web/src/lib/ownerrez-migration.ts` — Data export/migration tool
- `apps/web/app/api/ownerrez/route.ts` — API routes (health, properties, bookings, export)
- `apps/web/app/api/ownerrez/webhook/route.ts` — Real-time booking event receiver

**REMAINING WORK:**
- [ ] Steven provides 2FA code → generate OwnerRez API token
- [ ] OR decide on alternative PMS (Lodgify/Beds24)
- [ ] Wire PMS booking webhook → smart lock code generation
- [ ] Wire PMS booking webhook → automated guest messaging
- [ ] Test full flow: VRBO booking → PMS → RAH site → lock code → guest notification

---

## WEBSITE (rah-midland.com) — DETAILED STATUS

### Pages — What's REAL vs MOCK

| Page | URL | Status | Issue |
|------|-----|--------|-------|
| Landing page | `/` | REAL | Live, public-facing |
| Properties list | `/properties` | MOCK DATA | Property data hardcoded in `property-knowledge.ts`, images are Unsplash placeholders |
| Login | `/login` | REAL | Firebase auth |
| Dev Login | `/dev-login` | ✅ SECURED | Server-side redirect to /login in production, dev-only access |
| Register | `/register` | REAL | Firebase auth |
| Dashboard | `/dashboard` | PARTIAL | UI real, some data sources mock |
| Bookings | `/bookings` | REAL | Prisma database |
| Calendar | `/calendar` | REAL | Calendar integration |
| Guests | `/guests` | REAL | Firebase-backed |
| Finance | `/finance` | REAL | Firebase expense tracking |
| Cleaning | `/cleaning` | MOCK STORAGE | UI real, but uses in-memory Map() — data lost on restart |
| Cleaners | `/cleaners` | NEEDS VERIFICATION | |
| Messages | `/messages` | REAL | Firebase-backed |
| Notifications | `/notifications` | REAL | |
| Settings | `/settings` | REAL | |
| Smart Locks | `/locks` | REAL | Tuya integration |
| Smart Home | `/smart-home` | NEEDS VERIFICATION | |
| Concierge | `/concierge` | REAL | AI-powered |
| Steven AI | `/steven` | REAL | AI personality + voice |
| Analytics | `/analytics` | NEEDS VERIFICATION | |
| Maintenance | `/maintenance` | NEEDS VERIFICATION | |
| Lawn Service | `/lawn-service` | NEEDS VERIFICATION | |
| Privacy Policy | `/privacy-policy` | STATIC | |
| Terms of Service | `/terms-of-service` | STATIC | |

### API Routes — What's REAL vs MOCK

| Endpoint | Status | Issue |
|----------|--------|-------|
| `/api/bookings` | REAL | Prisma DB — needs PostgreSQL for production |
| `/api/properties` | MOCK DATA | Returns hardcoded property array |
| `/api/cleaning` | ✅ FIXED | Prisma persistent storage (was in-memory Map) |
| `/api/sync` | ✅ FIXED | Real iCal feed sync for Airbnb/VRBO (was fake delays) |
| `/api/debug` | ✅ SECURED | Returns 404 in production unless secret key provided |
| `/api/ownerrez` | REAL | OwnerRez API client (needs credentials) |
| `/api/ownerrez/webhook` | REAL | Webhook receiver |
| `/api/smart-home` | ✅ FIXED | Real Tuya lock control + Prisma storage (was in-memory) |
| `/api/calls/*` | REAL | Twilio integration (needs credentials) |
| `/api/steven-ai` | REAL | Groq API + SENTINEL-OMNI fallback |
| `/api/concierge` | ✅ FIXED | Property data from DB, no hardcoded WiFi/codes in source |
| `/api/checkout` | ✅ REAL | Full Stripe checkout integration |
| `/api/checkout/square` | ✅ REAL | Full Square payment integration |
| `/api/email/send` | ✅ REAL | Resend + SendGrid multi-provider |
| `/api/messages/automated` | ✅ FIXED | Prisma storage + real Twilio SMS + email sending |
| `/api/weather` | REAL | Weather API proxy |
| `/api/vrbo/sync` | NEEDS VERIFICATION | |
| `/api/webhooks/vrbo` | NEEDS VERIFICATION | |
| `/api/guests` | ✅ REAL | Full Prisma CRUD with pagination |
| `/api/admin/*` | ✅ REAL | VRBO scraper + Firebase image upload |
| `/api/cron/*` | ✅ REAL | Cleaner monitor + system health cron |
| `/api/monitor/*` | ✅ REAL | Late cleaners + system alerts |
| `/api/settings` | ✅ FIXED | Prisma Setting model (was in-memory + cookies) |

### Libraries — What's REAL vs MOCK

| Library | Status | Issue |
|---------|--------|-------|
| `firebase-memory.ts` | REAL | Firebase Firestore integration |
| `steven-memory.ts` | REAL | Firebase-backed guest memory |
| `airbnb-integration.ts` | REAL | iCal feed parsing |
| `ownerrez-client.ts` | REAL | OwnerRez v2 API client |
| `ownerrez-migration.ts` | REAL | Data export/migration |
| `tuya-lock-client.ts` | REAL | Tuya smart lock API (verified live) |
| `twilio.ts` | REAL | Twilio calls/SMS |
| `prisma.ts` | REAL | Database ORM |
| `weather.ts` | REAL | Weather API |
| `email-templates.ts` | REAL | Email templates |
| `steven-personality.ts` | REAL | AI personality system |
| `financials.ts` | REAL | Firebase expense tracking |
| `local-events.ts` | REAL | Midland TX events |
| `occupancy-calculator.ts` | REAL | Occupancy math |
| `property-knowledge.ts` | MOCK | Hardcoded 22 properties — needs DB migration |
| `property-images.ts` | ✅ DB-BACKED | Pulls from PropertyPhoto DB, falls back to static VRBO data |
| `demo-mode.ts` | MOCK | Demo configuration — disable for production |
| `cleaning-system.ts` | PARTIAL | Checklist real, storage needs fix |
| `cleaning-checklist.ts` | PARTIAL | Hardcoded checklists |
| `crm.ts` | STUB | CRM placeholder |
| `crash-alert.ts` | STUB | Minimal implementation |
| `calendar-sync.ts` | NEEDS VERIFICATION | |
| `ai-concierge-brain.ts` | PARTIAL | Calendar integration TODO |

---

## DATABASE

### Production: Supabase PostgreSQL ✅ LIVE
- **Project:** right-at-home-bnb (`ufdgnphupeknvkcocrmp`)
- **Region:** us-east-1
- **URL:** https://ufdgnphupeknvkcocrmp.supabase.co
- **User:** `rah_app` (dedicated app user, not superuser)
- **Pooler:** `postgresql://rah_app.ufdgnphupeknvkcocrmp:***@aws-0-us-east-1.pooler.supabase.com:6543/postgres`
- **Direct:** `postgresql://rah_app:***@db.ufdgnphupeknvkcocrmp.supabase.co:5432/postgres`
- **Tables:** All 12 Prisma models created (User, Property, PropertyPhoto, Guest, Booking, CleaningJob, SmartLock, Message, Expense, ConciergeQuery, AuditLog, Setting)
- **Schema pushed:** 2026-04-02 via `prisma db push`

### Remaining DB Tasks:
- [x] Provision PostgreSQL
- [x] Push schema
- [ ] Set DATABASE_URL + DIRECT_URL on Vercel (needs Vercel CLI auth)
- [ ] Seed 22 properties from property-knowledge.ts
- [ ] Migrate existing Firebase data to PostgreSQL

### Firebase Firestore Collections (REAL, in use):
- `rah_memory` — AI memory
- `steven_guests` — Guest profiles
- `rah_properties` — Property data
- `rah_context` — Context storage
- `bookings` — Booking records
- `vrbo_listings` — VRBO sync
- `airbnb_listings` — Airbnb sync
- `expenses` — Financial tracking

---

## MOBILE APP (Cleaner/Owner App)

### Status: UI BUILT, NOT DEPLOYED

**Location:** `apps/mobile/`
**Framework:** React Native + Expo

**Screens Built:**
- Home screen
- Jobs list + detail
- Booking detail
- Calendar
- Cleaning management
- Messages
- Leaderboard
- Settings

**What Works:**
- React Query hooks configured for API fetching
- UI components complete
- Navigation structure complete

**What's Missing:**
- [ ] Not built/compiled for iOS or Android
- [ ] API integration not verified end-to-end
- [ ] Push notifications not configured
- [ ] GPS check-in for cleaners not tested
- [ ] Photo upload for cleaning verification not tested
- [ ] App Store / Play Store listing not created

---

## DESKTOP APP (Admin Control Center)

### Status: UI BUILT, NOT DEPLOYED

**Location:** `apps/desktop/`
**Framework:** Electron + React

**Screens Built:**
- Dashboard
- Properties + Property Detail
- Bookings
- Cleaners
- Finance
- Smart Locks
- Settings

**Services Built:**
- Calendar service
- Cleaning service
- Invoicing service
- Encryption service
- Audit service
- Pricing service
- Logging service

**What's Missing:**
- [ ] Electron packaging not configured
- [ ] Offline-first sync not verified
- [ ] Cross-platform sync (Firebase) not tested
- [ ] Installer creation (Windows + Mac)

---

## CREDENTIALS IN VAULT

### Echo Vault API (https://echo-vault-api.bmcii1976.workers.dev)

| Service | Status | In Vault |
|---------|--------|----------|
| Tuya Cloud API | VERIFIED LIVE | Yes — Client ID + Secret |
| Tuya Lock Garfield | VERIFIED LIVE | Yes — Device ID |
| Tuya Lock Castleford | MAPPED | Yes — Device ID |
| Tuya Lock Lincoln Green | MAPPED | Yes — Device ID |
| Smart Life App | CONFIGURED | Yes — rightathomemidland@gmail.com |
| OwnerRez Login | STORED | Yes — sp3158@sbcglobal.net (needs 2FA for API token) |
| Firebase | NEEDS CHECK | Check if in vault |
| Twilio | NEEDS CHECK | Check if in vault |
| Stripe | NOT CONFIGURED | No |
| Square | NOT CONFIGURED | No |
| ElevenLabs | NEEDS CHECK | Check if in vault |
| Groq | NEEDS CHECK | Check if in vault |
| Google Maps | NEEDS CHECK | Check if in vault |

---

## CRITICAL PATH TO MAY 2026

### PHASE 1: Foundation (Week 1-2) — BLOCKING

| # | Task | Status | Blocker |
|---|------|--------|---------|
| 1 | Steven provides OwnerRez 2FA code | WAITING | Steven sleeping |
| 2 | Decide PMS: OwnerRez vs Lodgify vs Beds24 | WAITING | Steven decision |
| 3 | Set up PostgreSQL production database | NOT STARTED | |
| 4 | Fix in-memory cleaning storage → Firestore/Prisma | NOT STARTED | |
| 5 | Remove `/dev-login` from production | NOT STARTED | |
| 6 | Replace hardcoded property data with DB queries | NOT STARTED | |
| 7 | Replace Unsplash images with real VRBO property photos | NOT STARTED | |
| 8 | Configure ALL environment variables on Vercel | NOT STARTED | |

### PHASE 2: Integrations (Week 2-3)

| # | Task | Status | Blocker |
|---|------|--------|---------|
| 9 | Wire PMS → smart lock code generation | NOT STARTED | Phase 1 #1-2 |
| 10 | Wire PMS → automated guest messaging | NOT STARTED | Phase 1 #1-2 |
| 11 | End-to-end test Tuya lock code creation/deletion | NOT STARTED | |
| 12 | Configure + test Twilio calls/SMS | NOT STARTED | |
| 13 | Configure + test Stripe/Square payments | NOT STARTED | |
| 14 | Configure + test email sending (Zoho SMTP) | NOT STARTED | |
| 15 | Verify all 11 "NEEDS CHECK" API endpoints | NOT STARTED | |

### PHASE 3: Apps (Week 3-4)

| # | Task | Status | Blocker |
|---|------|--------|---------|
| 16 | Build + test mobile app (Expo) | NOT STARTED | |
| 17 | Deploy mobile app to TestFlight / Play Store beta | NOT STARTED | |
| 18 | Build + test desktop app (Electron) | NOT STARTED | |
| 19 | Test cross-platform sync (web ↔ mobile ↔ desktop) | NOT STARTED | |
| 20 | Install locks on remaining 19 properties | NOT STARTED | Steven action |

### PHASE 4: Production Hardening (Week 4+)

| # | Task | Status | Blocker |
|---|------|--------|---------|
| 21 | Full end-to-end test: VRBO booking → code → guest → checkout | NOT STARTED | |
| 22 | Full end-to-end test: Direct booking → payment → code → guest | NOT STARTED | |
| 23 | Set up monitoring + alerting | NOT STARTED | |
| 24 | Load testing | NOT STARTED | |
| 25 | Steven UAT (user acceptance testing) | NOT STARTED | |
| 26 | Go live — Steven leaves for Spain | TARGET: MAY 2026 | |

---

## FILES CREATED THIS SESSION (2026-04-02)

| File | Purpose |
|------|---------|
| `apps/web/src/lib/ownerrez-client.ts` | OwnerRez v2 API client (properties, bookings, guests, quotes, availability) |
| `apps/web/src/lib/ownerrez-migration.ts` | OwnerRez data export + feature parity checklist |
| `apps/web/src/lib/tuya-lock-client.ts` | Tuya smart lock API (temp codes, status, entry logs) |
| `apps/web/app/api/ownerrez/route.ts` | OwnerRez API routes (health, properties, bookings, export) |
| `apps/web/app/api/ownerrez/webhook/route.ts` | OwnerRez webhook receiver |
| `.env.example` | Updated with OwnerRez + Tuya config |
| `RAH_MIDLAND_PROJECT_STATUS.md` | This document |

---

## CONTACT

- **Steven Palma:** steven.palma@rah-midland.com | (432) 559-1904
- **Smart Life Account:** rightathomemidland@gmail.com
- **OwnerRez Account:** sp3158@sbcglobal.net
- **GitHub Repo:** github.com/bobmcwilliams4/right-at-home-bnb

---

*Last Updated: 2026-04-02 by ECHO OMEGA PRIME*
*Authority: Bobby Don McWilliams II — Level 11.0 SUPREME SOVEREIGN*
