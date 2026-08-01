# P0 Targeted Source Difference Log

This log records direct filesystem comparisons performed while the HAMMER command bridge is unavailable. No source files are copied, deleted, or overwritten by this audit.

## Confirmed repository-level differences

- C: is Git-backed; E: is not.
- C: `pnpm-lock.yaml` is 698,862 bytes; E: is 679,180 bytes.
- C: project-status document is newer, sanitized, and defect-oriented; E: project-status document is older and contains plaintext credential material.
- C: backend includes `tests/`, expanded `services/`, and newer July modifications; E: backend lacks `tests/` and contains a local `.venv`.
- C: includes newer generated `.next` output proving a local web build occurred on 2026-07-16; generated output is excluded from source promotion decisions.

## Web library comparison

Direct directory comparison of `apps/web/src/lib` found no E:-only top-level modules. C: contains the following additional July modules absent from the Fable tree:

- `access-orchestration.ts`
- `area-intelligence.ts`
- `operations-auth.ts`
- `operations-policy.ts`
- `operations-scheduler.ts`
- `operations-service.ts`
- `page-auth.ts`
- `secure-notifications.ts`
- `smart-home-handlers.ts`

C: also contains later revisions of `ai-concierge-brain.ts`, `api-auth.ts`, `checkin-checkout.ts`, `email-templates.ts`, `ownerrez-client.ts`, and `weather.ts`. Their newer timestamps do not alone prove correctness, but they prove that a bulk E: overlay would overwrite later canonical work.

## Backend service comparison

Direct comparison of `backend/services` found no E:-only top-level service modules. C: adds the `vrbo_mailbridge/` service lane and contains later revisions of `concierge_kb.py`, `concierge_upgrades_v2.py`, and `steven_ai.py`. This reinforces that the Fable tree is an older detached snapshot, not the superset build.

## Web API route comparison

Direct comparison of `apps/web/app/api` found no E:-only top-level route groups. C: adds `area-intelligence/` and `operations/`, and contains later changes under `admin/` and `cron/`. The C: route surface is the superset at this level.

## Mobile and desktop comparison

The C: and E: top-level layouts for `apps/mobile` and `apps/desktop` match in filenames, sizes, and source timestamps. Differences observed there are dependency-directory timestamps and directory allocation metadata, not proven source improvements. No Fable-only mobile or desktop top-level source was identified.

## Git provenance

The canonical repository reflog traces the project from the original `bobmcwilliams4/right-at-home-bnb` clone through production database/Twilio work, Vercel fixes, VRBO synchronization, guest automation, role dashboards, payment integrations, security hardening, and the `cf-to-echo-cloud` migration commit. Local and remote `cf-to-echo-cloud` both point to `f4ee582e74c3ce6c14dae0e5d00e1d44a5355916`. July source modifications after that commit remain uncommitted/uncertified until command execution is restored and `git status` can be captured.

## Firebase bundle evidence

The local Next.js production bundle `apps/web/.next/static/chunks/app/layout-366d75a0fba5c189.js` was built on 2026-07-16 and contains:

- `authDomain: "echo-prime-ai.firebaseapp.com"`
- `projectId: "echo-prime-ai"`
- `storageBucket: "echo-prime-ai.appspot.com"`
- no compiled `NEXT_PUBLIC_FIREBASE_API_KEY` value
- no compiled `NEXT_PUBLIC_FIREBASE_APP_ID` value
- diagnostics reporting both client API key and app ID as unconfigured

This proves the local production bundle cannot initialize the intended RAH Firebase client correctly. It does not by itself prove the exact currently deployed Vercel bundle, but it is sufficient to block promotion of the local build.

