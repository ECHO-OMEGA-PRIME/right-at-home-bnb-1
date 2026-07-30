# RAH Midland P0 Verified Inventory

**Generated:** 2026-07-23  
**Build Tracker plan:** `rah-midland`  
**Gate:** P0 — Discovery, recovery, and scope lock

## 1. Canonical source decision

### Provisional canonical repository

`C:\ECHO_OMEGA_PRIME\WEBSITES\right-at-home-bnb`

- Git-backed monorepo.
- Active branch: `cf-to-echo-cloud`.
- Local and remote branch ref: `f4ee582e74c3ce6c14dae0e5d00e1d44a5355916`.
- Configured remote: `https://github.com/ECHO-OMEGA-PRIME/right-at-home-bnb-1.git`.
- Contains web, mobile, desktop, FastAPI backend, Prisma, shared packages, tests, security hardening, deployment configuration, VRBO MailBridge work, and July 2026 operational modules.
- Contains newer local modifications after the branch HEAD. These remain uncommitted and uncertified until command execution is restored and an exact `git status` plus test run is captured.

### Preserved detached comparison tree

`E:\fable_work\rah-midland`

- Full monorepo snapshot without local Git metadata.
- Major source lanes are older than the C: repository.
- Direct comparisons found no E:-only top-level modules in:
  - `apps/web/src/lib`
  - `apps/web/app/api`
  - `backend/services`
  - `apps/mobile`
  - `apps/desktop`
  - package-family names under `packages/`
- Contains local dependency and virtual-environment artifacts.
- Contains an older project-status document with plaintext credential material. Treat the entire tree as sensitive evidence pending credential rotation and history review.
- Must remain read-only. Do not bulk-copy E: over C:.

### Separate Echo/FORGE migration lane

`C:\ECHO_OMEGA_PRIME\.claude\worktrees\cf-migrate-rah-api-20260525`

- Historical migration plan for Cloudflare `rah-api` to a FORGE FastAPI service and `echo.rahapi.*` SDK capabilities.
- The migration PR description claims a `SYSTEMS/echo_rah_api` implementation, but that directory is not present in the currently visible worktree.
- Treat the migration as an unverified service lane, not as the website monorepo or an authoritative replacement.

### Requirements/design evidence

- `C:\ECHO_OMEGA_PRIME\PROJECTS\right-at-home-bnb-design`
- `C:\ECHO_OMEGA_PRIME\KNOWLEDGE_FORGE\echo_rah_api_docs\RAH_MIDLAND_CANONICAL_DESCRIPTION.md`

These are architecture and requirements evidence, not executable source.

## 2. Monorepo structure

The canonical repository contains:

- `apps/web` — Next.js web application and API routes
- `apps/mobile` — React Native / Expo application
- `apps/desktop` — Electron application
- `backend` — FastAPI application, routers, services, database, Alembic, middleware, and tests
- `packages/ai-concierge`
- `packages/analytics`
- `packages/cloud-sync`
- `packages/messaging`
- `packages/pricing`
- `packages/security`
- `packages/services`
- `packages/shared`
- `packages/smart-locks`
- `packages/testing`
- `packages/types`
- `packages/utils`
- `bridge`
- `tools`
- `STEVEN_PALMA_BNB_LISTINGS`
- Prisma schema and seed tooling
- Firebase index configuration
- Vercel deployment configuration

## 3. Source-superset evidence

C: contains July modules absent from E:, including:

- `apps/web/src/lib/access-orchestration.ts`
- `apps/web/src/lib/area-intelligence.ts`
- `apps/web/src/lib/operations-auth.ts`
- `apps/web/src/lib/operations-policy.ts`
- `apps/web/src/lib/operations-scheduler.ts`
- `apps/web/src/lib/operations-service.ts`
- `apps/web/src/lib/page-auth.ts`
- `apps/web/src/lib/secure-notifications.ts`
- `apps/web/src/lib/smart-home-handlers.ts`
- `apps/web/app/api/area-intelligence/`
- `apps/web/app/api/operations/`
- `backend/services/vrbo_mailbridge/`
- `backend/tests/`

No corresponding E:-only top-level source lane was found in the directly compared areas.

## 4. Deployment inventory

### Public site

- Production domain: `https://rah-midland.com`
- Platform: Next.js deployment linked to Vercel.
- Vercel project name: `right-at-home-bnb`.
- Local Vercel link file exists at `.vercel/project.json`.
- Vercel configuration defines:
  - Next.js build with pnpm
  - output directory `.next`
  - cron routes for monitoring, VRBO sync, and guest messages
  - `/api/v1/*` rewrite to `https://api.rah-midland.com/*`

### Verified live defects on 2026-07-23

- Homepage describes 22 properties but renders all summary counters as zero.
- Public `/properties` renders a guest identity and exposes an `Add Property` control.
- Public `/properties` reports zero managed properties, zero active listings, zero average rate, and zero bedrooms.
- The live deployment behavior matches the July 17 local project-status report and does not reflect the local middleware hardening.

### API deployment

- Configured public API domain: `https://api.rah-midland.com`.
- Independent public search did not produce a verifiable health response.
- FORGE deployment state, service unit, Postgres schema, SDK capability registration, and tunnel health remain unverified.

## 5. Firebase and authentication inventory

### Source configuration found

The following source and documentation locations default Firebase to project `echo-prime-ai`:

- `apps/web/src/lib/auth.ts`
- `apps/web/src/lib/shared/firebase/index.ts`
- `apps/web/src/lib/firebase-admin.ts`
- `apps/web/.env.example`
- `apps/web/VERCEL_ENV_SETUP.md`

The P0 target and historical production project are identified as `rightathome-prod`. No explicit `rightathome-prod` identifier was found in the canonical repository search.

### Likely authentication/configuration fault

- Client auth falls back to `echo-prime-ai` unless Vercel environment variables override every project field.
- Firebase Admin also defaults to `echo-prime-ai`.
- The environment setup guide instructs operators to configure `echo-prime-ai`.
- This creates a direct project-identity conflict with `rightathome-prod` and is a credible cause of the historical `auth/configuration-not-found` failure.

### Route authorization conflict

`apps/web/src/lib/auth.ts` treats `/properties` and every child route under `/properties/*` as public. This includes `/properties/new`.

A newer local `apps/web/middleware.ts` explicitly protects `/properties/new`, makes it admin-only, blocks inactive-property booking paths, and disables production dev-login credentials. The live site still exposes the Add Property control, proving that this local hardening is not yet deployed or not controlling the rendered UI.

### Secrets and credential hygiene

- `.env` and `apps/web/.env.local` exist locally and are covered by `.gitignore`.
- Secret values were not read or copied during this inventory.
- The detached E: project-status document contains exposed credential material.
- All credentials ever exposed in source or documentation require rotation, provider audit-log review, and Git-history remediation before production certification.

## 6. Integration inventory

Source and documentation identify these integration lanes:

- Firebase Authentication, Firestore, Storage, and Functions
- Prisma and PostgreSQL / Supabase
- VRBO iCal synchronization
- VRBO mailbox ingestion / MailBridge
- OwnerRez client, migration, and webhook routes
- Airbnb iCal integration
- Tuya / ARPHA smart-lock control
- Twilio SMS and voice
- PayPal, Stripe, and Square payment code
- Email delivery providers
- ElevenLabs voice
- Groq and Echo SDK AI routing
- Vercel cron automation
- Echo Cloud / FORGE API migration
- MinIO object storage migration design

All integration credentials, provider health, webhook signing, production callback URLs, and mutation permissions remain subject to independent verification.

## 7. Current blockers

1. HAMMER command bridge returns Cloudflare `502 origin_bad_gateway`; exact Git status, full hash diff, builds, tests, and deployment commands cannot run.
2. Multiple source trees require final file-level reconciliation before archival.
3. Firebase project identity conflicts between `echo-prime-ai` and expected `rightathome-prod`.
4. Production authentication health is unverified.
5. Local authorization hardening is not proven deployed.
6. Credential rotation and Git-history remediation are incomplete.
7. API/FORGE migration deployment is unverified.
8. Property/role/workflow acceptance scope is not formally frozen.

## 8. Required next execution sequence

1. Restore the HAMMER command bridge.
2. Execute `tools/p0_compare_sources.ps1` and review every Fable-only or same-path conflict.
3. Capture exact `git status`, branch, remotes, submodules/worktrees, and untracked files without cleaning or resetting.
4. Create a protected consolidation branch from the canonical C: tree.
5. Import only reviewed Fable-only improvements, with one commit per logical lane.
6. Resolve Firebase project authority: confirm the actual production project, authorized domains, providers, service account, and Vercel variables.
7. Build and test the local middleware/auth fix.
8. Deploy an immutable commit and verify guest denial for `/properties/new` plus removal of Add Property from guest UI.
9. Re-run homepage/property data verification.
10. Verify the API/FORGE service and all high-risk integration mutation gates.

## Verdict

**Canonical source:** C: Git repository, provisional but strongly supported.  
**Fable source:** preserved detached historical snapshot, not eligible for bulk promotion.  
**Production:** live but not ready; authorization, data hydration, Firebase identity, credential hygiene, and deployment provenance remain open.  
**P0:** in progress; fail-closed.
