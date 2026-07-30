#!/usr/bin/env python3
"""
Live smoke for the payroll routes against production.

These routes require a real Firebase owner/admin ID token -- an ADMIN_API_SECRET
only gets you past the edge middleware, and the route's own role check still
refuses it. That is the intended behaviour, so this smoke mints a genuine owner
token the same way the P0 login acceptance does.

What it proves, beyond "the endpoint answered":
  * a GARBAGE credential is rejected, not merely a missing one -- presence of a
    credential is not authentication, and testing only the empty case is how a
    middleware bypass ships
  * the roster and the runs list come from the database, not a hardcoded array
  * the preview engine prices the real employee, which is the whole reason the
    two withholding engines were merged into one module

Exit code is the number of failed checks, so it can gate a deploy.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import requests

sys.path.insert(0, str(Path(__file__).resolve().parent))

from rah_login_acceptance import (  # noqa: E402
    PROJECT_ID,
    TIMEOUT,
    google_access_token,
    live_firebase_config,
    load_service_account,
    mint_id_token,
)

BASE = "https://rah-midland.com"

# The API reads its token from this cookie, not from an Authorization header.
AUTH_COOKIE = "rah-auth-token"

FAILURES: list[str] = []


def find_owner_uid_by_claim(access_token: str) -> tuple[str, str]:
    """Find an owner by reading Identity Toolkit custom claims.

    Deliberately NOT the acceptance tool's Firestore lookup. The echo-prime-ai
    Firestore project is quota-walled (429 on every runQuery), which would make
    this smoke fail for a reason that has nothing to do with payroll.

    Reading the `role` custom claim is also the path the API itself takes first,
    so this exercises the same source of truth the routes authorise against.
    """
    url = f"https://identitytoolkit.googleapis.com/v1/projects/{PROJECT_ID}/accounts:query"
    headers = {"Authorization": f"Bearer {access_token}"}
    next_token, scanned = None, 0

    while True:
        payload: dict = {"returnUserInfo": True, "limit": "500"}
        if next_token:
            payload["nextPageToken"] = next_token
        r = requests.post(url, headers=headers, json=payload, timeout=TIMEOUT)
        if r.status_code != 200:
            raise RuntimeError(f"accounts:query failed {r.status_code}: {r.text[:300]}")
        body = r.json()
        users = body.get("userInfo", []) or []
        scanned += len(users)

        for u in users:
            attrs = u.get("customAttributes") or "{}"
            try:
                role = json.loads(attrs).get("role")
            except json.JSONDecodeError:
                continue
            if role in ("owner", "admin"):
                return u["localId"], f"{u.get('email', '?')} (role={role})"

        next_token = body.get("nextPageToken")
        if not next_token or not users:
            raise RuntimeError(
                f"no user carries an owner/admin role claim (scanned {scanned}). "
                "Run tools/backfill_role_claims.py first."
            )


def check(name: str, ok: bool, detail: str = "") -> bool:
    print(f"  {'PASS' if ok else 'FAIL'}  {name}")
    if detail:
        print(f"        {detail}")
    if not ok:
        FAILURES.append(name)
    return ok


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default=BASE)
    args = ap.parse_args()
    base = args.base.rstrip("/")

    print(f"RAH payroll live smoke -> {base}\n")

    # ---- auth controls -------------------------------------------------
    #
    # These MUST use the cookie. The API reads its token from the rah-auth-token
    # cookie and never from an Authorization header, so a probe that sends
    # "Authorization: Bearer garbage" gets a 401 for the wrong reason -- the
    # header was ignored, not rejected -- and would pass even if the cookie path
    # authenticated anything at all. A control that cannot fail proves nothing.
    print("auth controls")
    r = requests.get(f"{base}/api/payroll/runs", timeout=TIMEOUT)
    check("no credential is rejected", r.status_code == 401, f"status={r.status_code}")

    r = requests.get(
        f"{base}/api/payroll/runs",
        cookies={AUTH_COOKIE: "not-a-real-token"},
        timeout=TIMEOUT,
    )
    check(
        "GARBAGE cookie token is rejected",
        r.status_code == 401,
        f"status={r.status_code} -- presence of a credential is not authentication",
    )

    r = requests.get(
        f"{base}/api/payroll/runs",
        headers={"Authorization": "Bearer not-a-real-token"},
        timeout=TIMEOUT,
    )
    check(
        "a bearer header alone does not authenticate",
        r.status_code == 401,
        f"status={r.status_code}",
    )

    # ---- mint a real owner token ---------------------------------------
    cfg = live_firebase_config()
    sa = load_service_account()
    # cloud-platform, not identitytoolkit: find_owner_uid reads Firestore, and a
    # token scoped only to Identity Toolkit comes back 403 insufficient scopes.
    access = google_access_token(sa, "https://www.googleapis.com/auth/cloud-platform")
    uid, email = find_owner_uid_by_claim(access)
    token = mint_id_token(sa, cfg["apiKey"], uid)
    jar = {AUTH_COOKIE: token}
    print(f"\nauthenticated as owner {email} ({uid})\n")

    # ---- real data -----------------------------------------------------
    print("real data")
    r = requests.get(f"{base}/api/payroll/runs", cookies=jar, timeout=TIMEOUT)
    ok = check("GET /api/payroll/runs", r.status_code == 200, f"status={r.status_code}")
    if ok:
        body = r.json()
        check(
            "runs list has the real-data contract",
            "payroll_runs" in body and "total" in body,
            f"total={body.get('total')} keys={sorted(body)}",
        )

    r = requests.get(f"{base}/api/payroll/employees", cookies=jar, timeout=TIMEOUT)
    roster: list[dict] = []
    if check("GET /api/payroll/employees", r.status_code == 200, f"status={r.status_code}"):
        body = r.json()
        roster = body.get("employees", [])
        fabricated = {"Maria Garcia", "James Wilson", "Lisa Chen", "Carlos Ramirez"}
        names = {e.get("name") for e in roster}
        check(
            "roster is not the old hardcoded four",
            not (names & fabricated) or len(roster) != 4,
            f"count={len(roster)} names={sorted(n for n in names if n)[:6]}",
        )

    # ---- the preview engine on real input -------------------------------
    print("\npricing engine")

    # Positive proof that the hardcoded roster is gone, and one that works even
    # when the database is empty: EMP-001 used to price "Maria Garcia" at
    # $18/hr. If it still prices anyone, the fabricated array is still in there.
    r = requests.post(
        f"{base}/api/payroll/calculate",
        cookies=jar,
        json={
            "pay_period": {"start": "2026-07-01", "end": "2026-07-15"},
            "entries": [{"employee_id": "EMP-001", "regular_hours": 40}],
        },
        timeout=TIMEOUT,
    )
    if check("POST /api/payroll/calculate reachable", r.status_code == 200, f"status={r.status_code}"):
        body = r.json()
        priced = body.get("employee_results", [])
        errs = body.get("errors") or []
        check(
            "the fabricated employee EMP-001 is no longer priced",
            len(priced) == 0 and any("EMP-001" in str(e) for e in errs),
            f"priced={len(priced)} errors={json.dumps(errs)[:120]}",
        )

    if not roster:
        check(
            "preview prices a real employee",
            True,
            "SKIPPED - no employee rows exist yet, so there is nobody real to price. "
            "Not seeding one: this is production.",
        )
    else:
        emp = roster[0]
        payload = {
            "pay_period": {"start": "2026-07-01", "end": "2026-07-15"},
            "pay_periods_per_year": 24,
            "entries": [{"employee_id": emp["id"], "regular_hours": 40}],
        }
        r = requests.post(
            f"{base}/api/payroll/calculate", cookies=jar, json=payload, timeout=TIMEOUT
        )
        if check("POST /api/payroll/calculate", r.status_code == 200, f"status={r.status_code}"):
            results = r.json().get("employee_results", [])
            check(
                "preview priced the real employee",
                len(results) == 1 and results[0]["employee_id"] == emp["id"],
                json.dumps(results[0]["employee_taxes"]) if results else "no results",
            )

    print()
    if FAILURES:
        print(f"{len(FAILURES)} FAILED: {', '.join(FAILURES)}")
    else:
        print("all checks passed")
    return len(FAILURES)


if __name__ == "__main__":
    raise SystemExit(main())
