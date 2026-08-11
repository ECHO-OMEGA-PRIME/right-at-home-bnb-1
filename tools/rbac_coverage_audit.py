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
    "twilio signature": re.compile(r"requireTwilioSignature|isValidTwilioRequest"),
}

# Routes that are meant to be reachable without a session. Keep the reason with
# the entry so this list stays reviewable instead of becoming a silent allowlist.
PUBLIC_BY_DESIGN = {
    "health/route.ts": "liveness probe; returns no tenant data",
    # Exact POST-only middleware exceptions. Login/signup necessarily run
    # before a session exists; logout must be idempotent for an expired or
    # malformed cookie. Their handlers expose no tenant data, while
    # auth/link remains authenticated and therefore must never appear here.
    "auth/login/route.ts": "credential exchange; returns only an HttpOnly session cookie",
    "auth/signup/route.ts": "identity enrollment and verification initiation",
    "auth/logout/route.ts": "idempotent session-cookie deletion",
    # Verified live 2026-07-30: both return 200 to an anonymous caller today and
    # are the public marketing-site property listings. middleware.ts has an
    # explicit isPublicPropertyApi branch for them. Adding a session guard here
    # breaks the public site, so this is a decision, not an oversight.
    "properties/route.ts": "public property listings for the marketing site",
    "properties/[id]/route.ts": "public property detail for the marketing site",
    "properties/photos/[photoId]/route.ts": "public listing photo bytes by opaque image id",
}

# Real gaps that are TRACKED, not accepted. Kept out of the --strict failure so
# CI is not permanently red, but printed loudly every run so they cannot fade
# into the background. Removing an entry here should mean it was actually fixed.
KNOWN_GAPS: dict[str, str] = {
    # (empty) ownerrez/webhook was the only entry; OwnerRez is not in use and
    # its routes were deleted rather than guarded - dead code is not a gap.
}

# Routes whose GET is deliberately public while their write methods are guarded.
# Declared explicitly so the partial-coverage check stays strict everywhere else
# instead of being loosened globally to accommodate one legitimate shape.
PUBLIC_READ_ROUTES = {
    "properties/[id]/route.ts":
        "GET serves the public marketing listing; PUT/DELETE are owner/admin only",
}

MIDDLEWARE = Path("apps/web/middleware.ts")


def _public_api_prefixes() -> list[str]:
    """Read PUBLIC_API_PREFIXES out of middleware.ts.

    Middleware default-denies /api/* EXCEPT these prefixes, so anything under
    them is reachable with no session by design (Twilio call webhooks, Stripe/
    VRBO webhooks, cron, checkout). Treating those as "unprotected, go add a
    session guard" would be actively harmful -- adding one breaks inbound calls
    and checkout. They need a signature/secret check instead, and a route under
    a public prefix with NO such check is the real finding.

    Parsed rather than duplicated so the audit cannot drift from the middleware.
    """
    if not MIDDLEWARE.is_file():
        return []
    text = MIDDLEWARE.read_text(encoding="utf-8", errors="replace")
    block = re.search(r"const PUBLIC_API_PREFIXES\s*=\s*\[(.*?)\]", text, re.S)
    if not block:
        return []
    return [m.group(1) for m in re.finditer(r"['\"]/api/([^'\"]+)['\"]", block.group(1))]

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


def classify(path: Path, public_prefixes: list[str] | None = None) -> dict:
    public_prefixes = public_prefixes or []
    text = path.read_text(encoding="utf-8", errors="replace")
    rel = path.relative_to(API_ROOT).as_posix()
    route_path = rel[: -len("/route.ts")] if rel.endswith("/route.ts") else rel
    under_public = any(
        route_path == p or route_path.startswith(f"{p}/") for p in public_prefixes
    )
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
    elif rel in KNOWN_GAPS:
        status = "KNOWN_GAP"
        detail = KNOWN_GAPS[rel]
    elif under_public and alts:
        status = "PUBLIC_VERIFIED"
        detail = f"public prefix, verified by {'+'.join(alts)}"
    elif under_public:
        # Reachable with no session AND nothing verifying the caller.
        status = "PUBLIC_UNVERIFIED"
        detail = "under a middleware public prefix with no signature/secret check"
    elif alts:
        status = "ALT_CONTROL"
        detail = "+".join(alts)
    elif not methods:
        status = "NO_HANDLER"
        detail = "no exported HTTP handler"
    else:
        status = "UNPROTECTED"
        detail = "no session guard, no alternative control"

    # A guard on the file is not a guard on every method -- this is how a POST
    # slips through on an otherwise-guarded route.
    #
    # Counting raw guard calls is NOT sufficient and produced three false
    # positives: routes that call a shared local helper
    # (`authorizeStaffOrService`, which all four handlers use) and routes whose
    # guard lives in a delegate module. Both are fully covered. So also count
    # calls to local functions whose own body contains a guard, and never flag
    # a delegate-guarded route, whose guard is by definition not in this file.
    guard_hits = sum(len(re.findall(rf"\b{g}\s*\(", text)) for g in SESSION_GUARDS)
    for fn in re.findall(r"(?:async\s+)?function\s+([A-Za-z0-9_]+)\s*\(", text):
        body = re.search(
            rf"function\s+{fn}\s*\([^)]*\)[^{{]*\{{(.*?)\n\}}", text, re.S)
        if body and any(re.search(rf"\b{g}\s*\(", body.group(1)) for g in SESSION_GUARDS):
            guard_hits += len(re.findall(rf"\b{fn}\s*\(", text)) - 1  # minus its definition
    # A declared public-read route is expected to have one unguarded method
    # (GET); every OTHER method must still be covered.
    expected = len(methods) - (1 if rel in PUBLIC_READ_ROUTES and "GET" in methods else 0)
    partial = bool(guards) and not delegated and len(methods) > 1 and guard_hits < expected

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

    public_prefixes = _public_api_prefixes()
    rows = sorted((classify(p, public_prefixes) for p in API_ROOT.rglob("route.ts")),
                  key=lambda r: (r["status"], r["route"]))

    if args.json:
        print(json.dumps(rows, indent=2))
    else:
        counts: dict[str, int] = {}
        for r in rows:
            counts[r["status"]] = counts.get(r["status"], 0) + 1
        print(f"RAH API route RBAC coverage - {len(rows)} routes\n")
        for status in ("UNPROTECTED", "KNOWN_GAP", "PUBLIC_UNVERIFIED",
                       "PUBLIC_VERIFIED", "ALT_CONTROL", "PUBLIC_BY_DESIGN",
                       "PROTECTED", "NO_HANDLER"):
            group = [r for r in rows if r["status"] == status]
            if not group:
                continue
            print(f"--- {status} ({len(group)})")
            for r in group:
                methods = ",".join(r["methods"]) or "-"
                print(f"  {methods:<24} {r['route']}")
                if status in ("UNPROTECTED", "NO_HANDLER", "PUBLIC_UNVERIFIED",
                              "KNOWN_GAP"):
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
