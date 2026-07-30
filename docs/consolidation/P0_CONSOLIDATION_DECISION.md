# RAH Midland P0 Consolidation Decision

## Provisional canonical source

`C:\ECHO_OMEGA_PRIME\WEBSITES\right-at-home-bnb`

- Git-backed repository.
- Active branch: `cf-to-echo-cloud`.
- Verified HEAD: `f4ee582e74c3ce6c14dae0e5d00e1d44a5355916`.
- Configured remote: `https://github.com/ECHO-OMEGA-PRIME/right-at-home-bnb-1.git`.
- Contains newer July 2026 backend, tests, security hardening, project-status evidence, generated web build output, and local working-tree work that must be preserved.

## Preserved comparison source

`E:\fable_work\rah-midland`

- Full detached monorepo snapshot with no local Git metadata.
- Broadly matches the canonical monorepo structure.
- Contains older status, backend, package-lock, and integration state than the C: repository.
- Contains a local Python virtual environment and dependency/build artifacts that are not source-of-truth inputs.
- Contains plaintext credential material in an older project-status document. Treat the tree as sensitive evidence; do not publish or bulk-copy it.

## Separate migration lane

`C:\ECHO_OMEGA_PRIME\.claude\worktrees\cf-migrate-rah-api-20260525`

This is a separate Cloudflare-to-Echo/FORGE service migration lane, not a replacement for the website monorepo. Its intended service was documented as `SYSTEMS/echo_rah_api` with `echo.rahapi.*` capabilities, but the expected service directory is not present in the currently visible worktree. The migration claims therefore require independent source and deployment verification before adoption.

## Requirements and design evidence

- `C:\ECHO_OMEGA_PRIME\PROJECTS\right-at-home-bnb-design`
- `C:\ECHO_OMEGA_PRIME\KNOWLEDGE_FORGE\echo_rah_api_docs\RAH_MIDLAND_CANONICAL_DESCRIPTION.md`

These are requirements, architecture, and historical-design evidence. They are not executable canonical source.

## Consolidation rules

1. Do not bulk-copy E: into C:.
2. Do not delete, rename, clean, reset, stash, or overwrite either tree during P0.
3. Exclude `.git`, `node_modules`, `.next`, `.venv`, caches, generated output, and secret files from source comparison.
4. Import only files proven Fable-only or materially better after a path-level content review.
5. Preserve C: local hardening and tests unless a reviewed change explicitly supersedes them.
6. Do not deploy or enable autonomous booking, payment, messaging, or smart-lock mutation until security, authentication, reservation reconciliation, and readback gates pass.
7. Rotate all credentials exposed in source or documentation before production certification.

## Current execution limitation

A non-destructive SHA-256 comparison script was created at:

`C:\ECHO_OMEGA_PRIME\WEBSITES\right-at-home-bnb\tools\p0_compare_sources.ps1`

The script could not execute because the HAMMER Windows command bridge returned Cloudflare `502 origin_bad_gateway` for both process creation and process listing on 2026-07-23. Direct filesystem inspection remains available and is being used for targeted consolidation evidence.
