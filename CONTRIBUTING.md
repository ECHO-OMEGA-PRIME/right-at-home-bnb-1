# Contributing

Thanks for considering a contribution. This template targets the bar set in
ADR-0005 — every PR should leave the repo at least as good as it found it.

## Quickstart

```bash
./scripts/setup.sh         # macOS / Linux
./scripts/setup.ps1        # Windows / PowerShell
```

If `setup` doesn't get you to a working state in 5 minutes on a clean machine,
that itself is a bug — file an issue.

## Workflow

1. **Branch off `main`.** Use `feat/<short>`, `fix/<short>`, `chore/<short>`,
   `docs/<short>`. Keep branches short-lived.
2. **Open a draft PR early** if the change is non-trivial; it's easier to
   redirect than to rewrite.
3. **One concern per PR.** Refactors don't ride along with feature work.
4. **Tests** — every behavioral change ships with a test that fails before,
   passes after. CI must be green to merge.
5. **CHANGELOG** — add a line under `## [Unreleased]` for any user-visible
   change.
6. **Commit messages** — imperative mood. `Add foo`, not `Added foo`.

## Code style

- Honor `.editorconfig`. Most editors apply it automatically.
- Lint + typecheck must pass locally before pushing (`scripts/setup` installs
  the toolchain).
- Avoid drive-by reformatting in feature PRs; do formatting fixes separately.

## Reviews

- Reviewers focus on: correctness, naming, test coverage, runbook drift, doc
  drift.
- Authors: respond to every comment, even if "won't change — here's why."
- Land via squash unless the branch was deliberately curated as a series.

## Releases

- Tag with `vX.Y.Z`. `release.yml` produces a GitHub Release from the matching
  CHANGELOG block.
- Breaking changes bump major; deprecations land at minor with a deprecation
  note in CHANGELOG.

## Security

Disclosures go through [SECURITY.md](SECURITY.md), not GitHub issues.
