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
# operations-auth actor guards. requireWorkerActor admits workers; requireOwnerActor
# does not. Neither is shaped like requireOneOfRoles, so the first version of this
# audit saw dispatch/tasks/[id] as having no role guard at all.
ACTOR_RE = re.compile(r"require(Worker|Owner)Actor\s*\(")
# requireAuth admits ANY authenticated user, guest included. It is a real guard
# for "is someone logged in", but says nothing about which properties they may
# see -- so a handler using it still needs an ownership check.
ANY_AUTH_RE = re.compile(r"requireAuth\s*\(\s*request")
# Service-credential routes. admin/property-info and admin/vrbo-ical both
# authenticate a machine caller with a constant-time ADMIN_API_SECRET compare
# rather than a user role; that is an ALT_CONTROL, not an absence of one.
SECRET_GUARD_RE = re.compile(r"adminSecretMatches\s*\(|verifySecret\s*\(|x-api-secret")
# An explicit, greppable declaration that a handler is public on purpose.
PUBLIC_MARKER = "@public-by-design"
# A HUMAN-verified exemption, for ownership checks this regex cannot see --
# typically because the check lives in a service module the handler calls, or
# inside a role-gated branch rather than at handler level.
#
# This is a fail-OPEN mechanism and is treated as such: it must carry a stated
# reason, and every use is listed in the output so it can never accumulate
# silently. Prefer moving the check somewhere the audit CAN see it.
SCOPE_VERIFIED_RE = re.compile(r"@scope-verified:\s*(\S.*)")

# Prisma access addressed by primary key.
BY_ID_RE = re.compile(
    r"prisma\.(\w+)\.(findUnique|findFirst|update|delete)\s*\(\s*\{\s*where:\s*\{\s*id\b",
    re.S,
)

# Ownership checks this codebase actually uses. The property-scope helpers, plus
# the operations-auth pattern: requireWorkerActor + canManageAllWorkOrders, which
# narrows the query to the caller's OWN assignments
# (`where.assignedWorkerId = auth.workerProfile.id`). That is a per-actor scope
# rather than a per-property one, and it is a legitimate guard -- the first
# version of this audit did not know it and reported five false positives in
# dispatch/tasks/[id] alone.
GUARDS = (
    "scopeAllows",
    "scopedWhere",
    "propertyScopeFor",
    "canManageAllWorkOrders",
    "assignedWorkerId = auth.workerProfile",
)

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


def roles_for(body: str, module: str = "") -> set[str]:
    """Roles that can reach this handler.

    Follows ONE level of indirection: messages/automated delegates its check to a
    local authorizeStaffOrService() helper, and reading only the handler body
    made an owner/admin-only route look unguarded. A role call inside a
    file-level helper the handler awaits counts as the handler's own.
    """

    def parse(src: str) -> set[str]:
        m = ROLES_RE.search(src)
        if m:
            return {r.strip().strip("'\"") for r in m.group(1).split(",") if r.strip()}
        m = SINGLE_ROLE_RE.search(src)
        if m:
            return {m.group(1)}
        a = ACTOR_RE.search(src)
        if a:
            return {"worker", "owner", "admin"} if a.group(1) == "Worker" else {"owner", "admin"}
        return set()

    direct = parse(body)
    if direct:
        return direct

    for helper in set(re.findall(r"await\s+(\w+)\s*\(\s*request", body)):
        # Match the helper function body up to the next top-level declaration.
        stop = r"(?:export|async function|function)"
        pattern = (r"(?:async\s+)?function\s+" + re.escape(helper)
                   + r"\b(.*?)(?=" + chr(10) + stop + r")")
        hm = re.search(pattern, module, re.S)
        if hm:
            found = parse(hm.group(1))
            if found:
                return found
    return set()


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--strict", action="store_true", help="exit non-zero on findings")
    args = ap.parse_args()

    findings: list[tuple[str, str, str, str]] = []
    unknown: list[tuple[str, str, str, str]] = []
    scanned = 0
    guarded = 0
    owner_only = 0
    public_by_design = 0
    secret_guarded = 0
    scope_verified: list[tuple[str, str, str]] = []

    for path in sorted(API_ROOT.rglob("route.ts")):
        source = path.read_text(encoding="utf-8", errors="replace")
        rel = str(path.relative_to(API_ROOT)).replace("\\", "/")

        for verb, body in handlers(source):
            hits = BY_ID_RE.findall(body)
            if not hits:
                continue
            scanned += 1

            # Declared public on purpose (marketing listings, PayPal return).
            # Counted separately so "public" never hides among "unclassified".
            if PUBLIC_MARKER in body:
                public_by_design += 1
                continue

            sv = SCOPE_VERIFIED_RE.search(body)
            if sv:
                scope_verified.append((rel, verb, sv.group(1).strip()))
                continue

            # Authenticated as a machine via ADMIN_API_SECRET rather than a user
            # role. A real control, just not a role-shaped one.
            if SECRET_GUARD_RE.search(body) or SECRET_GUARD_RE.search(source):
                secret_guarded += 1
                continue

            roles = roles_for(body, source)
            if not roles and ANY_AUTH_RE.search(body):
                roles = {"guest", "worker", "owner", "admin"}

            # No non-owner role can reach it -> not a tenant-isolation risk here.
            if roles and roles <= {"owner", "admin"}:
                owner_only += 1
                continue

            # Look for the ownership check in the handler AND in any helper it
            # awaits: dispatch/tasks/[id] keeps both its role guard and its
            # ownership narrowing inside getVisibleWorkOrder(), so scanning only
            # the handler body missed a guard that was plainly there.
            searchable = body
            for helper in set(re.findall(r"await\s+(\w+)\s*\(\s*request", body)):
                hm = re.search(
                    r"(?:async\s+)?function\s+" + re.escape(helper) + r"(.*?)(?="
                    + chr(10) + r"(?:export|async function|function))",
                    source, re.S)
                if hm:
                    searchable += hm.group(1)

            if any(g in searchable for g in GUARDS):
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
    print(f"  {secret_guarded} authenticate with ADMIN_API_SECRET (service callers)")
    print(f"  {public_by_design} are declared @public-by-design")
    if scope_verified:
        print(f"  {len(scope_verified)} carry a HUMAN @scope-verified exemption:")
        for rel, verb, why in scope_verified:
            print(f"      {rel} {verb} — {why}")

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

    total = (guarded + owner_only + secret_guarded + public_by_design
             + len(scope_verified)
             + distinct_handlers(findings) + distinct_handlers(unknown))
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
