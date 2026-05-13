# 0001 — Adopt echo-repo-template baseline (ADR-0005)

**Status:** Accepted
**Date:** 2026-05-13
**Author:** ECHO-OMEGA-PRIME (cc-builder-forge)

## Context

ADR-0005 (Pillar 5) establishes a canonical GitHub template repo and CI/CD
pipeline for all sovereign repos. BP-5.9 applies that template to the
bobmcwilliams4 website repos so they reach baseline quality-gate compliance.

## Decision

Adopt all files from `ECHO-OMEGA-PRIME/echo-repo-template` that were absent:
`.editorconfig`, `CODEOWNERS`, `CONTRIBUTING.md`, `LICENSE`, `SECURITY.md`,
`CHANGELOG.md`, `.github/workflows/ci.yml`, `.github/workflows/release.yml`,
`.github/PULL_REQUEST_TEMPLATE.md`, `docs/decisions/`.

## Alternatives considered

1. **Skip CI for website repos** — rejected; uniform CI is the point of ADR-0005.
2. **Custom workflow per repo** — deferred to BP-5.3 matrix expansion.

## Consequences

- **Positive:** repo passes ADR-0005 scorecard; PRs get CI + release workflow.
- **Negative:** CI may flag existing lint warnings on first run (non-blocking).
- **Neutral:** existing files unchanged; only additive diff.
