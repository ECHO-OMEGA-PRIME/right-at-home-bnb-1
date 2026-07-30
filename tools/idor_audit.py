#!/usr/bin/env python3
"""
Find by-id data access that bypasses property scoping.

WHY THIS EXISTS
/api/cleaning applied its filters ONLY to the list branch. Anything addressed by
primary key -- GET ?id=, PUT, DELETE, and four POST action branches -- skipped
authorization entirely, so a worker with a job id could read, rewrite or delete a
cleaning job at ANY property. Seven holes in one file, found by accident while
chasing a probe that had failed for the wrong reason.

One file having seven means the shape is systemic, not local. This finds the rest,
and keeps finding them: --strict makes it a CI gate like the RBAC audit.

WHAT IT FLAGS
A Prisma call addressed by primary key (findUnique/findFirst/update/delete on
`{ id: ... }`) inside a handler that a NON-owner role can reach, where the handler
shows no ownership check.

WHAT COUNTS AS AN OWNERSHIP CHECK
  scopeAllows(...)      an explicit per-record test
  scopedWhere(...)      the scope folded into the query
  propertyScopeFor(...) the scope resolved at all
  updateMany/deleteMany with a scope in the WHERE (atomic, unraceable)

WHAT IT DELIBERATELY DOES NOT FLAG
Handlers restricted to owner/admin. This is a single-business app: an owner
seeing every property is the intended behaviour, not a leak. The risk is
specifically a route a WORKER can reach.

Exit code is the number of unguarded findings, so it can gate a deploy.
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

API_ROOT = Path(__file__).resolve().parent.parent / "apps" / "web" / "app" / "api"

HANDLER_RE = re.compile(r"^export (?:async )?function (GET|POST|PUT|PATCH|DELETE)\b", re.M)
ROLES_RE = re.compile(r"require(?:OneOf)?Roles?\s*\(\s*request\s*,\s*\[([^\]]*)\]", re.S)
SINGLE_ROLE_RE = re.compile(r"requireRole\s*\(\s*request\s*,\s*['\"](\w+)['\"]")

# Prisma access addressed by primary key.
BY_ID_RE = re.compile(
    r"prisma\.(\w+)\.(findUnique|findFirst|update|delete)\s*\(\s*\{\s*where:\s*\{\s*id\b",
    re.S,
)

GUARDS = ("scopeAllows", "scopedWhere", "propertyScopeFor")

# Models with no property dimension -- scoping them is meaningless.
PROPERTYLESS_MODELS = {
    "user", "workerProfile", "serviceSubscription", "ledgerAccount",
    "taxPeriod", "payrollBatch", "workerPayEntry", "guest",
}


def handlers(source: str) -> list[tuple[str, str]]:
    """Split a route file into (verb, body) pairs."""
    marks = [(m.start(), m.group(1)) for m in HANDLER_RE.finditer(source)]
    out = []
    for i, (pos, verb) in enumerate(marks):
        end = marks[i + 1][0] if i + 1 < len(marks) else len(source)
        out.append((verb, source[pos:end]))
    return out


def roles_for(body: str) -> set[str]:
    m = ROLES_RE.search(body)
    if m:
        return {r.strip().strip("'\"") for r in m.group(1).split(",") if r.strip()}
    m = SINGLE_ROLE_RE.search(body)
    return {m.group(1)} if m else set()


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--strict", action="store_true", help="exit non-zero on findings")
    args = ap.parse_args()

    findings: list[tuple[str, str, str, str]] = []
    unknown: list[tuple[str, str, str, str]] = []
    scanned = 0
    guarded = 0
    owner_only = 0

    for path in sorted(API_ROOT.rglob("route.ts")):
        source = path.read_text(encoding="utf-8", errors="replace")
        rel = str(path.relative_to(API_ROOT)).replace("\\", "/")

        for verb, body in handlers(source):
            hits = BY_ID_RE.findall(body)
            if not hits:
                continue
            scanned += 1

            roles = roles_for(body)
            # No non-owner role can reach it -> not a tenant-isolation risk here.
            if roles and roles <= {"owner", "admin"}:
                owner_only += 1
                continue

            if any(g in body for g in GUARDS):
                guarded += 1
                continue

            for model, op in hits:
                if model in PROPERTYLESS_MODELS:
                    continue
                entry = (rel, verb, f"prisma.{model}.{op}", ",".join(sorted(roles)) or "-")
                # A handler where no role guard was DETECTED is not the same as a
                # confirmed worker-reachable hole: it may be public by design
                # (the marketing site reads /api/properties unauthenticated), or
                # it may use a guard shape this regex does not know. Reporting
                # those as findings would overstate the result, so they are
                # listed separately for a human to classify.
                (findings if roles else unknown).append(entry)

    print(f"scanned {scanned} handlers containing by-id access")
    print(f"  {guarded} already carry an ownership check")
    print(f"  {owner_only} are owner/admin-only (out of scope by design)")

    if findings:
        print(f"\nUNGUARDED BY-ID ACCESS ({len(findings)}):")
        print("  a caller with one of these roles can address a record by primary key")
        print("  without any property-ownership test\n")
        width = max(len(f[0]) for f in findings)
        for rel, verb, call, roles in findings:
            print(f"  {rel:<{width}}  {verb:<6}  {call:<38}  roles=[{roles}]")
        print("\nFix: resolve the scope, then either scopeAllows(scope, row.propertyId)")
        print("     before acting, or put the scope in the WHERE with updateMany/deleteMany")
        print("     so the check and the write cannot be raced. Return 404, never 403.")
    else:
        print("\nno CONFIRMED unguarded by-id access")

    if unknown:
        print(f"\nUNCLASSIFIED ({len(unknown)}) -- no role guard detected, needs a human:")
        print("  Either public by design (the marketing site reads /api/properties")
        print("  unauthenticated) or using a guard shape this audit does not recognise.")
        print("  NOT counted as findings -- reporting them as holes would overstate the")
        print("  result -- but they must not vanish either. Classify, then fix or annotate.\n")
        width = max(len(u[0]) for u in unknown)
        for rel, verb, call, _ in unknown:
            print(f"  {rel:<{width}}  {verb:<6}  {call}")

    # Count HANDLERS in every bucket. findings/unknown hold one entry per Prisma
    # CALL, and a handler can contain several -- mixing the two units made this
    # check report 51 of 43 the first time it ran, which is the whole reason it
    # exists.
    def distinct_handlers(rows):
        return len({(r[0], r[1]) for r in rows})

    total = guarded + owner_only + distinct_handlers(findings) + distinct_handlers(unknown)
    if total != scanned:
        # Every scanned handler must land in exactly one bucket. Silently losing
        # some is how an audit reports "clean" while missing whole files.
        print(f"\n!! ACCOUNTING GAP: {scanned} scanned but {total} classified.")
    else:
        # Say it out loud. A silent success is indistinguishable from a check
        # that did not run.
        print(f"\naccounting: all {scanned} scanned handlers classified")

    # Only CONFIRMED worker-reachable holes gate the build; unclassified entries
    # are surfaced loudly but must not fail CI on a guess.
    return len(findings) if args.strict else 0


if __name__ == "__main__":
    sys.exit(main())
