# RAH Midland P0 Change Manifest — 2026-07-23

Status: **SOURCE WRITTEN — NOT YET COMPILED, TESTED, COMMITTED, OR DEPLOYED**

Canonical repository:

`C:\ECHO_OMEGA_PRIME\WEBSITES\right-at-home-bnb`

## Purpose

Remove unsafe Firebase cross-project defaults, enforce the canonical `rightathome-prod` identity, close the `/properties/new` guest-access gap, eliminate shared guest sync identity, sanitize deployment templates, and establish P0 scope/evidence documents.

## Source changes

| File | SHA-256 | Change |
|---|---|---|
| `apps/web/src/lib/firebase-client-config.ts` | `11756b6012d51975ff80191b1ec2726f0f319d52a1a95c4bcd3320a2c5dce355` | New canonical client config; requires all public values and exact project ID. |
| `apps/web/src/lib/auth.ts` | `3ccb8c18c4d6e2e71acf66f485cc591d53c256b0d92f880271f24b1c08f21bc5` | Auth API preserved; cross-project app rejected; legacy worker roles normalized; public-route logic tightened. |
| `apps/web/src/lib/shared/firebase/index.ts` | `aa7510a9c0151cae90e3dcfec3b9da56c63e999771a42a83575578a9e4af82f7` | Web sync uses canonical Firebase config. |
| `packages/shared/src/firebase/index.ts` | `31c2f2871c34663d1636c59db904b644ee3ee10f11af9943305658ac8df790fc` | Cross-platform shared package requires environment config and exact RAH project. |
| `packages/cloud-sync/src/firebase-config.ts` | `a6a467bd5ff4d67c03394a4e7f9f717a2446980c66cb1d428eef456ec7da581d` | Cloud sync no longer hardcodes shared Echo Firebase values. |
| `apps/web/src/lib/firebase-admin.ts` | `6a60fc7f67897132193d83b3f625f7f7906bcd1b973d0d955447cc9037cd4683` | Admin SDK validates project and normalized service-account fields. |
| `apps/web/app/api/health/route.ts` | `11e9fc819f0f1f07486cd898331566bd28d8d95dc9e0510af151b6f0fa8166ef` | Safe health output reports project/configuration state without values. |
| `apps/web/src/components/properties/PropertiesRouteGuard.tsx` | `fced8d0d8478a223eefc3a65df6c474dcbbe3a1d73a548c1c087d3984a27a7a7` | Owner/admin client guard; guest/worker Add Property control hidden. |
| `apps/web/app/properties/layout.tsx` | `d3a0dea9e21298a1db2d134352976d7ed9e0cdb43f527a74b84148904efe2668` | Applies route guard to property routes. |
| `apps/web/app/providers.tsx` | `7f649be4c3cba0748ca28a353b0e16952b6714a5e1a0234c75310320ed11087a` | Sync identity follows authenticated user instead of global `guest_user`. |

## Deployment/configuration changes

| File | SHA-256 | Change |
|---|---|---|
| `apps/web/.env.example` | `8b7daa0cf9e633cd5142ee91bfcc232753af7c17003444618dd6ad71f3be1a49` | Sanitized web template for `rightathome-prod`. |
| `.env.example` | `8f6447274fbae76377371728901a1e2fe52786a462d332a09b8f7925877e6820` | Sanitized monorepo template; removed old Firebase/GCP assumptions. |
| `apps/web/VERCEL_ENV_SETUP.md` | `ad9ad361e724fe7b1d54c3a99652047194b62331b4b947f9c9c2c8da06f84fcf` | One Vercel project and one Firebase authority documented. |
| `apps/web/tools/sync-vercel-env.py` | `c7a2bd16de957a1c56801d11bbebb5474c967685f5ecd280e73d7d0c740825cf` | Removed hardcoded vault path/project; explicit validation and confirmation required. |

## P0 evidence and scope documents

| File | SHA-256 |
|---|---|
| `docs/consolidation/P0_ACCEPTANCE_MATRIX.md` | `2a5ec60a4c7d11ec5d617167d9d53f337155f919347238b6aa3d434eb263065e` |
| `docs/consolidation/P0_NONFUNCTIONAL_REQUIREMENTS.md` | `d9700ede7676cafc0c6d4b02adaeeaa05759eeb939ff11dfdee04c5e7f23fdc1` |
| `docs/consolidation/P0_SECURITY_ROTATION_RUNBOOK.md` | `b114c9e2aa25941459922e8f76e1410045b52eef1571a0ddb30276e6e47928b2` |
| `docs/consolidation/P0_VERIFIED_INVENTORY.md` | `7e85c015d888624b3ec259e1c61222414c5ae423d42b2e3f92af8ab05eaa8582` |

## Validation required

Run from the canonical repository when the HAMMER execution route is restored:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\p0_compare_sources.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\p0_verify_environment.ps1
```

Then run the repository-defined equivalents of:

```powershell
pnpm --dir apps/web exec tsc --noEmit
pnpm --dir apps/web exec prisma validate
pnpm --dir apps/web build
pnpm test
```

## Mandatory checks before commit

- No compiled bundle contains `echo-prime-ai`.
- No source/default points Firebase to a different project.
- No secret values appear in tracked files or generated evidence.
- `/properties/new` denies unauthenticated, guest, and worker sessions.
- Owner/admin can access the create-property workflow.
- Sync events use the authenticated user ID.
- Health returns expected project `rightathome-prod`.
- Existing APIs importing `@/lib/auth` still compile.
- Firebase Admin service-account parsing compiles against the installed SDK version.

## Deployment prohibition

Do not commit, push, merge, sync Vercel variables, migrate data, or deploy until:

1. typecheck/build/tests pass;
2. exposed credentials are rotated;
3. verified `rightathome-prod` values are loaded from the approved secret store;
4. Git state and full C:/E: hash delta are captured;
5. the immutable deployment commit is identified.


## Addendum — final source hashes

The following artifacts were added or updated after the initial manifest body:

| File | Final SHA-256 | Note |
|---|---|---|
| `apps/web/src/lib/auth.ts` | `675554b7b890e42083163507d5e3464b813e055fa02156feaf255b32da43bf9e` | Final hash after exporting the retained legacy worker-role type for migration tooling. |
| `tools/p0_static_assertions.mjs` | `e80a3a66e3a476ce4243f6643b12036a2afe1701f19c6130deffa966da421006` | Dependency-free P0 source assertions. |
| `docs/consolidation/P0_SCOPE_FREEZE.md` | `faf32f52b525ff79c5c1fdb2e23057b1c3cc289f91aa7191ea558bbd5ed79938` | Formal acceptance-scope freeze. |
| `apps/web/vercel_env_output.txt` | `065ccb876ae137bd967613423e26a4f28b24fe4012029e65286afbdf0d76f26c` | Stale Vercel listing neutralized; no environment values retained. |

Run the static assertion suite before typecheck:

```powershell
node .\tools\p0_static_assertions.mjs
```
