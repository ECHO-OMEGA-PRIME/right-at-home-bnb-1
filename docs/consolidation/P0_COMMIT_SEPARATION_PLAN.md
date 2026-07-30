# P0 Commit Separation Plan

## Purpose

Keep validated P0 remediation separate from the original 182-entry mixed working tree and from unrelated feature work.

## Candidate base

- Clean detached worktree: `C:\ECHO_OMEGA_PRIME\WORKTREES\rah-p0-core-20260723`
- Base commit: `f4ee582e74c3ce6c14dae0e5d00e1d44a5355916`
- Original working tree remains untouched and unstaged.

## Commit 1 — Firebase authority and authorization

Use `P0_CORE_CANDIDATE_PATHS.txt` as the path allowlist.

Intent:

- Enforce `rightathome-prod` across web, mobile, shared sync, cloud sync, backend photo storage, environment templates, deployment scripts, and CI.
- Reject mismatched Firebase apps and service accounts.
- Protect `/properties/new` and remove guest administrative controls.
- Bind cloud-sync identity to the authenticated user.
- Keep Vercel synchronization and deployment fail closed.
- Preserve P0 scope, NFR, inventory, and security evidence.

Mandatory gates:

- 32/32 static assertions.
- Shared package build.
- Web TypeScript.
- Prisma schema validation.
- Backend Python compilation.
- Web production build with disposable non-production values.
- `git diff --check` exit 0.

## Commit 2 — Baseline compile repairs

Use `P0_BASELINE_COMPILE_PATHS.txt` as the path allowlist.

Intent:

- Relocate the misplaced Calendar Settings JSX block into the main bookings page.
- Add required page authorization and secure notification modules.
- Correct automated-message content typing.
- Initialize VRBO sync duration.
- Preserve OwnerRez query parameter typing.
- Correct the Python seed ZIP range syntax.

These repairs are required because base commit `f4ee582` is not independently type/compile clean. They must not be represented as Firebase changes.

## Commit 3 — Evidence only

Include only finalized `docs/consolidation/P0_*` evidence files and the permanent validation tools selected for retention.

Exclude:

- Temporary validator `.p0_core_validate.ps1`.
- Generated `.next`, `dist`, `node_modules`, TypeScript build-info, test-result, and cache artifacts.
- Temporary provider environment pulls.
- Local `.env.local` and all credential-bearing files.
- One-off patch scripts unless explicitly retained for audit/reproduction.

## Production prohibition

Do not push, merge, deploy, alias, or change Vercel/Firebase configuration until:

1. All candidate gates are GREEN.
2. A human reviews the exact staged diff for each commit.
3. Exposed provider credentials are rotated.
4. Access to `rightathome-prod` is restored and authoritative Firebase values are retrieved.
5. The user explicitly authorizes production changes.
