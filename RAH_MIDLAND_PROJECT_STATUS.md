# RAH-MIDLAND.COM — VERIFIED BUILD STATUS

**Owner:** Right at Home BnB / Steven Palma  
**Production site:** `https://rah-midland.com`  
**Canonical repository:** `C:\ECHO_OMEGA_PRIME\WEBSITES\right-at-home-bnb`  
**Local branch:** `cf-to-echo-cloud`  
**Starting commit:** `f4ee582e74c3ce6c14dae0e5d00e1d44a5355916`  
**Last verified:** 2026-07-17

> This document intentionally contains no passwords, API secrets, device identifiers, database credentials, private network addresses, or vault material. Operational secrets must remain in Echo Vault or the approved deployment secret store.

## Current verdict

| Area | Status | Verified state |
|---|---|---|
| Public landing page | PARTIAL | Live; featured properties render, but homepage counters still render as zero |
| Property directory | PARTIAL | 22 properties render; 18 active and 4 inactive |
| Property administration | NOT READY | Production still exposes the Add Property control and `/properties/new` to a guest session |
| Direct booking | NOT READY | Inactive properties still expose direct-booking and Vrbo booking links |
| Authentication | PARTIAL | Local middleware hardening exists but has not been built, deployed, and independently verified |
| Credential hygiene | BLOCKED | Credentials were found in tracked public documentation; local documentation is now sanitized, but exposed credentials require rotation and Git history remediation |
| Vrbo mailbox ingestion | NOT STARTED | Read-only MailBridge and parser pipeline are not certified |
| Calendar reconciliation | NOT STARTED | Email + Vrbo iCal + RAH iCal reconciliation is not certified |
| Finance synchronization | NOT STARTED | Unified reservation and payout ledger is not certified |
| Tuya automation | DISABLED FOR AUTONOMOUS USE | Do not generate or revoke guest PINs until reservation accuracy, credential rotation, and readback verification pass |
| Mobile app | NOT CERTIFIED | UI exists; production builds and end-to-end tests are not verified |
| Desktop app | NOT CERTIFIED | UI exists; packaging and end-to-end tests are not verified |

## Immediate security actions

1. Rotate every credential that appeared in repository history, including the smart-lock cloud secret and the property-management account password.
2. Revoke or replace any affected tokens, sessions, application secrets, and derived credentials.
3. Review provider audit logs for use after the first public commit containing the exposed material.
4. Remove secrets from Git history with an approved history-rewrite procedure, then invalidate stale clones and deployments.
5. Add repository-wide secret scanning for source, documentation, fixtures, generated files, and staged commits.
6. Keep device identifiers, private infrastructure addresses, database endpoints, and account-recovery details out of public documentation.

## Verified production defects — 2026-07-17

### P0 — Authorization

- Guest-facing `/properties` renders an `Add Property` control.
- A guest session can load `/properties/new` and see the complete ten-step property creation form.
- Local `apps/web/middleware.ts` has an uncommitted guard for `/properties/new`, but it has not been compiled, deployed, or regression-tested.
- The properties page still needs role-aware rendering so guests never see administrative controls.

### P0 — Booking safety

The production API reports four inactive properties:

- `haynes-2802`
- `Vanguard-6613`
- `Oriole-6100`
- `gleneagles-4533`

At least one verified inactive property still renders:

- `Book Now — Best Price`
- `Or book on VRBO`
- direct-booking savings messaging

Inactive or maintenance properties must render an unavailable/request-to-book state and must not expose a bookable URL.

### P1 — Public data and presentation

- Homepage counters render as zero despite the site describing 22 properties.
- The public properties route can briefly or statically render zero-state content before hydration.
- `/profile`, image optimization failures, Firebase permission errors, and hydration errors require a fresh browser-console and network pass after the authorization fixes deploy.
- Login password autocomplete behavior requires revalidation.

## Current local hardening retained

The July 16 local working tree includes security work that must be preserved and validated:

- default property PINs and fallback passwords removed from active web, mobile, and Python source
- public concierge fallbacks replaced with authenticated-dashboard guidance
- legacy webhook code-generation and test-email behavior disabled
- `/properties/new` added to protected and admin-only middleware prefixes
- API property reads narrowed to GET-only public access
- owner/worker/guest route redirection tightened
- operational authorization and secure-notification modules added

This work is **not certified** until the exact dirty tree is inventoried and the full validation matrix passes.

## Required validation matrix

Run from the canonical repository without resetting, cleaning, stashing, or overwriting unrelated work:

```text
pnpm typecheck
pnpm exec prisma validate
pnpm db:generate
pnpm build
pnpm test
```

Also run:

- targeted backend tests for modified Python services
- repository-wide credential scan excluding dependency caches but including documentation and fixtures
- staged-tree secret scan before commit
- unauthenticated `/properties/new` denial test
- guest UI test proving Add Property is absent
- inactive-property test proving no direct or Vrbo booking action exists
- homepage counter regression test
- browser console, page-error, failed-request, hydration, and image checks
- production deployment smoke test from the exact committed source

## Vrbo synchronization sequence

Do not enable instant direct booking until these gates pass:

1. Register approved opaque browser credential capabilities.
2. Rotate exposed mailbox/property-management credentials.
3. Generate a provider-approved application password or secure mail key and store it only in Echo Vault.
4. Verify read-only TLS IMAP connectivity.
5. Import 90–180 days of historical messages without deleting, moving, or marking them read.
6. Build versioned parsers for reservations, changes, cancellations, payments, refunds, payouts, claims, and guest messages.
7. Route unknown templates to `PARSER_REVIEW_REQUIRED` with no booking, calendar, payment, or lock mutation.
8. Create unified reservation records with source message hashes and parser provenance.
9. Reconcile reservation email, Vrbo iCal, and RAH iCal state.
10. On disagreement, set `SYNC_AT_RISK`, preserve existing bookings, block instant confirmation, and require operator reconciliation.

## Direct-booking release gate

The only permitted sequence is:

```text
availability check
→ temporary date hold
→ payment authorization
→ final conflict check
→ reservation persistence
→ RAH calendar update
→ owner notification
→ payment capture
```

When mailbox or calendar state is stale, the site must show `Request to Book` rather than instant confirmation.

## Smart-lock release gate

Autonomous temporary PIN creation remains disabled until:

- the reservation is confirmed by reconciled sources
- property-to-lock mapping is verified
- PIN creation succeeds
- lock readback confirms the PIN
- activation and expiration windows are correct
- cancellation revokes the exact reservation PIN
- revocation readback succeeds
- no credential or PIN enters logs, browser state, source control, or evidence

Remote unlock remains operator-approved.

## Current execution blocker

The local command capabilities `claude.windows.run` and `claude.windows.process_create` are returning persistent Cloudflare `502 origin_bad_gateway` responses from `forge.echo-op.com`. This prevents truthful execution of Git status, TypeScript, Prisma, tests, builds, and commit/push gates.

No source validation, deployment, commit, or push may be claimed until that origin is restored and the required commands pass.
