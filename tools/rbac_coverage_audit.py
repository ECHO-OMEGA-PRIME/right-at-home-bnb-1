"""RAH Midland P1 - RBAC / tenant-isolation coverage audit.

P1 objective 1 is "authenticated role-based access with least privilege and
property-level tenant isolation". You cannot assert that without knowing which
of the ~103 API routes actually enforce anything, so this classifies every
route handler and fails when an unclassified one appears.

Two enforcement layers exist and BOTH count -- an audit that greps for only one
badly undercounts (a naive `requireAuth` grep says 8/103 protected, which is
wrong; the operations routes use the second layer):

  1. apps/web/src/lib/api-auth.ts       requireAuth / requireRole / requireOneOfRoles
  2. apps/web/src/lib/operations-auth.ts requireOwnerActor / requireWorkerActor /
                                         requireGuestActor  (builds on layer 1,
                                         adds row-level scoping)

Routes legitimately without a session check are declared in PUBLIC_BY_DESIGN
with the reason and the control that replaces the session (signature check,
shared secret, or genuinely public data). Anything else is a finding.

    python tools/rbac_coverage_audit.py            # human report
    python tools/rbac_coverage_audit.py --json     # machine readable
    python tools/rbac_coverage_audit.py --strict   # exit 1 on any UNPROTECTED

--strict is what a CI gate should run.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

API_ROOT = Path("apps/web/app/api")

SESSION_GUARDS = (
    "requireAuth",
    "requireRole",
    "requireOneOfRoles",
    "requireOwnerActor",
    "requireWorkerActor",
    "requireGuestActor",
)

# Alternative controls that make a missing session check correct rather than a gap.
ALT_CONTROL_PATTERNS = {
    "cron secret": re.compile(r"CRON_SECRET|x-vercel-cron|authorization.*Bearer.*CRON", re.I),
    "webhook signature": re.compile(
        r"verif(y|ies)?(Webhook|Signature)|stripe\.webhooks|constructEvent|"
        r"x-hub-signature|paypal.*verify|hmac", re.I),
    "admin shared secret": re.compile(r"ADMIN_API_SECRET|DEBUG_SECRET_KEY|ICAL_EXPORT_KEY", re.I),
}

# Routes that are meant to be reachable without a session. Keep the reason with
# the entry so this list stays reviewable instead of becoming a silent allowlist.
PUBLIC_BY_DESIGN = {
    "health/route.ts": "liveness probe; returns no tenant data",
}

# Both handler styles. Missing the `export const GET = handler` form made this
# audit report the smart-home routes as having no handler at all, when they are
# in fact guarded inside their delegate -- verify the instrument before
# trusting a finding.
HANDLER_RE = re.compile(
    r"export\s+(?:async\s+function\s+|const\s+)(GET|POST|PUT|PATCH|DELETE)\b")

WEB_SRC = Path("apps/web/src")


def _delegated_guards(text: str, seen: set[str] | None = None) -> list[str]:
    """Follow `@/lib/...` imports one level and look for guards there.

    A route that does `export const GET = safeSmartHomeGet` enforces its role
    inside the imported module. Judging only the route file marks a protected
    endpoint as unprotected, which is worse than no audit -- it sends you
    "fixing" something that is already correct while real gaps sit in the noise.
    """
    seen = seen if seen is not None else set()
    found: list[str] = []
    for mod in set(re.findall(r"from\s+['\"]@/lib/([A-Za-z0-9_./-]+)['\"]", text)):
        if mod in seen:
            continue
        seen.add(mod)
        for cand in (WEB_SRC / "lib" / f"{mod}.ts", WEB_SRC / "lib" / mod / "index.ts"):
            if not cand.is_file():
                continue
            sub = cand.read_text(encoding="utf-8", errors="replace")
            found += [g for g in SESSION_GUARDS if re.search(rf"\b{g}\s*\(", sub)]
            break
    return sorted(set(found))


def classify(path: Path) -> dict:
    text = path.read_text(encoding="utf-8", errors="replace")
    rel = path.relative_to(API_ROOT).as_posix()
    methods = sorted(set(HANDLER_RE.findall(text)))
    guards = sorted({g for g in SESSION_GUARDS if re.search(rf"\b{g}\s*\(", text)})
    delegated = [] if guards else _delegated_guards(text)
    if delegated:
        guards = delegated
    alts = sorted(n for n, p in ALT_CONTROL_PATTERNS.items() if p.search(text))

    if guards:
        status = "PROTECTED"
        detail = "+".join(guards) + (" (via delegate)" if delegated else "")
    elif rel in PUBLIC_BY_DESIGN:
        status = "PUBLIC_BY_DESIGN"
        detail = PUBLIC_BY_DESIGN[rel]
    elif alts:
        status = "ALT_CONTROL"
        detail = "+".join(alts)
    elif not methods:
        status = "NO_HANDLER"
        detail = "no exported HTTP handler"
    else:
        status = "UNPROTECTED"
        detail = "no session guard, no alternative control"

    # A guard on the file is not a guard on every method. Flag partial coverage
    # separately -- this is how a POST slips through on an otherwise-guarded route.
    guard_hits = sum(len(re.findall(rf"\b{g}\s*\(", text)) for g in SESSION_GUARDS)
    partial = bool(guards) and len(methods) > 1 and guard_hits < len(methods)

    return {
        "route": rel,
        "methods": methods,
        "status": status,
        "detail": detail,
        "partial_coverage": partial,
    }


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--json", action="store_true")
    ap.add_argument("--strict", action="store_true",
                    help="exit 1 if any route is UNPROTECTED or partially covered")
    args = ap.parse_args()

    if not API_ROOT.is_dir():
        print(f"run from the repo root; {API_ROOT} not found", file=sys.stderr)
        return 2

    rows = sorted((classify(p) for p in API_ROOT.rglob("route.ts")),
                  key=lambda r: (r["status"], r["route"]))

    if args.json:
        print(json.dumps(rows, indent=2))
    else:
        counts: dict[str, int] = {}
        for r in rows:
            counts[r["status"]] = counts.get(r["status"], 0) + 1
        print(f"RAH API route RBAC coverage - {len(rows)} routes\n")
        for status in ("UNPROTECTED", "ALT_CONTROL", "PUBLIC_BY_DESIGN",
                       "PROTECTED", "NO_HANDLER"):
            group = [r for r in rows if r["status"] == status]
            if not group:
                continue
            print(f"--- {status} ({len(group)})")
            for r in group:
                methods = ",".join(r["methods"]) or "-"
                print(f"  {methods:<24} {r['route']}")
                if status in ("UNPROTECTED", "NO_HANDLER"):
                    print(f"  {'':<24}   {r['detail']}")
            print()
        partials = [r for r in rows if r["partial_coverage"]]
        if partials:
            print(f"--- PARTIAL COVERAGE ({len(partials)}) "
                  "- guard present but fewer guard calls than HTTP methods")
            for r in partials:
                print(f"  {','.join(r['methods']):<24} {r['route']}  [{r['detail']}]")
            print()
        print("summary: " + ", ".join(f"{k}={v}" for k, v in sorted(counts.items())))

    bad = [r for r in rows if r["status"] == "UNPROTECTED"] + \
          [r for r in rows if r["partial_coverage"]]
    if args.strict and bad:
        print(f"\nSTRICT: {len(bad)} route(s) need attention", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
