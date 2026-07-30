# RAH Midland P0 Local Validation Certificate

**Date:** 2026-07-23  
**Canonical repository:** `C:\ECHO_OMEGA_PRIME\WEBSITES\right-at-home-bnb`  
**Branch:** `cf-to-echo-cloud`  
**HEAD:** `f4ee582e74c3ce6c14dae0e5d00e1d44a5355916`  
**Upstream:** `origin/cf-to-echo-cloud`  
**Upstream divergence:** 0 behind / 0 ahead

## Verdict

**LOCAL VALIDATION: GREEN**  
**PRODUCTION READY: NOT ESTABLISHED**

The canonical local source passes the P0 source-integrity, type, compilation, build, and test gates listed below. This certificate does not authorize a commit, push, deployment, secret synchronization, migration, or production promotion.

## Canonical-source decision

The complete SHA-256 comparison between the canonical C: repository and `E:\fable_work\rah-midland` completed with exit code 0.

| Metric | Count |
|---|---:|
| Canonical files | 8,678 |
| Fable files | 8,562 |
| Identical files | 8,555 |
| Same-path content differences | 3 |
| Canonical-only files | 119 |
| Fable-only files | 4 |

The four Fable-only paths are generated dependency/autolinking artifacts. The three same-path differences are mobile build configuration files (`android/gradle.properties`, `ios/Podfile`, and `apps/mobile/package.json`); the Git-backed C: versions are authoritative. No Fable-only application source requires porting.

## Final validation results

| Gate | Result |
|---|---|
| P0 static source assertions | **32/32 GREEN** |
| Web TypeScript (`tsc --noEmit`) | **GREEN, exit 0** |
| Mobile TypeScript (`tsc --noEmit`) | **GREEN, exit 0** |
| Desktop TypeScript (`tsc --noEmit`) | **GREEN, exit 0** |
| Backend Python `compileall` | **GREEN, exit 0** |
| Prisma client generation | **GREEN** |
| Prisma schema validation | **GREEN** |
| Shared workspace package build | **GREEN** |
| Web production build | **GREEN, exit 0** |
| VRBO MailBridge focused tests | **16 passed** |
| Desktop tests | **130/130 passed** |
| Testing package | **316/316 passed** |
| Full Turbo workspace graph | **446 tests passed; 4/4 tasks GREEN** |

**Total executed test assertions represented above:** 462.

The full desktop service contract is now validated for encryption, audit, calendar, invoicing, pricing, cleaning, and logging. The repaired compatibility facades preserve the existing production singleton services while restoring the tested functional APIs.

## Security and authority gates confirmed

The 32-point static gate confirms:

- No runtime, deployment, test, or maintenance source references `echo-prime-ai`.
- No runtime source references the obsolete `api.rightathome.bnb` hostname.
- Web, mobile, backend, shared sync, cloud sync, and Firebase Admin are locked to `rightathome-prod`.
- Existing Firebase app/project mismatches fail closed.
- `/properties/new` requires owner/admin authorization.
- Guest property views hide the Add Property control.
- Production development tokens are rejected.
- Sync identity follows the authenticated user instead of a shared guest identity.
- The VRBO webhook uses the centralized Firebase Admin authority.
- Request-dependent calendar, PayPal, and cron routes are explicitly dynamic.
- Legacy Railway deployment is inert.
- Vercel synchronization and production deployment require explicit confirmation tokens.
- The retired Cloud Run/Railway backend deployment path is disabled.

## Build warnings

The web production build completed successfully. Remaining warnings are non-blocking:

- Browserslist/caniuse data age warning.
- Vite CommonJS Node API deprecation warning during desktop tests.
- Desktop PostCSS configuration module-type warning.

No route-static-generation, PayPal, calendar, cron, Firebase, or TypeScript errors remain in the successful build/test runs.

## Git and provenance state

The working tree is intentionally **not staged** and contains mixed provenance:

| State | Count |
|---|---:|
| Total status entries | 182 |
| Modified tracked paths | 114 |
| Untracked paths | 68 |
| Added/staged paths | 0 |
| Deleted paths | 0 |
| Renamed paths | 0 |

The tracked unstaged diff currently reports 114 files, approximately 10,028 insertions and 10,633 deletions. This includes substantial work that existed before the current P0 remediation plus current validated changes. Commit assembly must therefore be path-based and evidence-reviewed; a bulk commit is prohibited.

Generated and temporary artifacts such as TypeScript build info, raw local test outputs, one-time patch scripts, and test-result directories must be classified before any commit. No reset, clean, stash, deletion, or history rewrite was performed.

## Evidence index

Primary evidence:

- `docs/consolidation/P0_STATIC_ASSERTIONS_OUTPUT.txt`
- `docs/consolidation/P0_WEB_TYPECHECK_OUTPUT.txt`
- `docs/consolidation/P0_MOBILE_TYPECHECK_OUTPUT.txt`
- `docs/consolidation/P0_DESKTOP_TYPECHECK_OUTPUT.txt`
- `docs/consolidation/P0_PRISMA_VALIDATE_OUTPUT.txt`
- `docs/consolidation/P0_SHARED_BUILD_OUTPUT.txt`
- `docs/consolidation/P0_WEB_BUILD_COMPLETED.txt`
- `docs/consolidation/P0_WEB_BUILD_OUTPUT.txt`
- `docs/consolidation/P0_VRBO_MAILBRIDGE_TEST_OUTPUT.txt`
- `docs/consolidation/P0_TESTING_PACKAGE_OUTPUT.txt`
- `docs/consolidation/P0_DESKTOP_TEST_OUTPUT.txt`
- `docs/consolidation/P0_WORKSPACE_TESTS_OUTPUT.txt`
- `docs/consolidation/P0_COMPARE_SOURCES_COMPLETED.txt`
- `docs/consolidation/P0_C_VS_FABLE_HASH_DIFF.json`
- `docs/consolidation/P0_C_VS_FABLE_HASH_DIFF.md`
- `docs/consolidation/P0_GIT_STATE.txt`
- `docs/consolidation/P0_EVIDENCE_DIGESTS.json`

Key digests at certificate issuance:

- Static assertions: `9021f6e1848f5a41445a0e7be60899701e16d3607fd8f88cc342074fad897359`
- Workspace tests: `4dd121be9a8f0e1b123d832073109f81b076bcbd947d86140b97c5047a2cb5ab`
- Desktop tests: `fb7c88e2a7e9974b91c3340d77bebff00cecd22ca0a024fddd1f80ee22f24ce2`
- Web build output: `4e1bf9c8d5b9c90d0559ee6f58dc627bd28b3b2c6e8b5ac034d5c13ce7b78740`
- Source comparison JSON: `43445b057264feecebd5af4507e16f9512aaaa3f3a5cc40f54b43858d49753b4`
- Git-state capture: `cc0bc632dd70a539f900562b8c6b47b925ca3b7363aa1b9eb547104800bc06d0`

## Remaining production blockers

Local GREEN does not close P0 production verification. The following remain mandatory:

1. Rotate the exposed database, Twilio, Tuya, and any other live-looking credentials; revoke old tokens/sessions and audit provider activity.
2. Populate the verified `rightathome-prod` Firebase and server values through the approved secret store.
3. Verify Firebase Authentication providers and authorized domains for `rah-midland.com` and the exact Vercel production domain.
4. Verify the Vercel project/environment linkage and immutable deployment provenance.
5. Verify `api.rah-midland.com`, the FORGE service manifest, Postgres schema/migrations, tunnel, and `echo.rahapi.*` capability registration.
6. Separate the mixed working tree into evidence-reviewed commit units.
7. Run the protected CI gate against the exact commit.
8. Deploy through the controlled production gate.
9. Prove successful owner/admin login with timestamped browser, network, and Firebase evidence.
10. Prove that a guest cannot access `/properties/new` and cannot see Add Property.
11. Reconcile production property data so the public application no longer displays zero counters for the known 22-property portfolio.

## Transport note

The `forge.echo-op.com` execution path was intermittent during this work, returning Cloudflare 502 and 1018 responses between successful runs. The completed local validation evidence was captured during healthy execution windows. Transport instability remains an infrastructure concern but did not invalidate the successful command exit codes and durable evidence above.
