"""Backfill Firebase `role` custom claims for RAH users from Postgres.

Why this exists: echo-prime-ai Firestore is returning 429 RESOURCE_EXHAUSTED, so
the per-request `users/{uid}` role read fails and production login is down. The
shipped auth path (commit 5f5f513) reads the `role` custom claim FIRST and only
falls back to Firestore, so populating claims restores login without needing the
Google Cloud console.

STATUS 2026-07-30: the Prisma `User` model does carry `authUid` (Firebase UID)
and `role`, but production Postgres holds exactly ONE User row and its authUid
is NULL -- so Postgres currently cannot source the mapping. Verified against a
populated DB (761 Booking / 22 Property / 494 Guest rows), so this is a genuine
absence, not a wrong connection. This tool is therefore staged and dry-run
proven, awaiting a real role source: either Firestore once the quota block
clears, or authUid backfill into Postgres. Do NOT hand-assign roles to guess
around it -- naming the wrong account owner is privilege escalation.

Safety properties:
  * --apply is required to write; default is a dry run.
  * Only roles in the app's known set are written. Anything unmapped is skipped
    and reported, never silently downgraded and never escalated.
  * Idempotent: an account whose claim already matches is left untouched.
  * Never widens access beyond what Postgres says. A row with no authUid, an
    inactive row, or an unknown role is skipped.
  * Prints a full distribution before writing so the blast radius is visible.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
from collections import Counter

import jwt
import psycopg2
import requests

# Populate with:
#   vercel env pull .rah_prod.env --environment=production
# Keep it OUT of git - it holds FIREBASE_SERVICE_ACCOUNT and DATABASE_URL.
PROD_ENV = os.environ.get("RAH_PROD_ENV", ".rah_prod.env")
PROJECT_ID = "echo-prime-ai"
TIMEOUT = 30

# The app's ApiUserRole union. Postgres stores upper-case variants.
ROLE_MAP = {
    "GUEST": "guest",
    "WORKER": "worker",
    "ADMIN": "admin",
    "OWNER": "owner",
    "CLEANER": "worker",
    "MAINTENANCE": "worker",
}


def env(key: str) -> str | None:
    text = open(PROD_ENV, encoding="utf-8", errors="replace").read()
    m = re.search(rf"^{key}=(.*)$", text, re.M)
    if not m:
        return None
    raw = m.group(1).strip()
    if raw.startswith('"'):
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            raw = raw[1:-1] if raw.endswith('"') else raw[1:]
    return raw.replace("\\n", "")


def service_account() -> dict:
    raw = env("FIREBASE_SERVICE_ACCOUNT") or ""
    sa = json.loads(raw)
    sa["private_key"] = sa["private_key"].replace("\\n", "\n")
    return sa


def access_token(sa: dict) -> str:
    now = int(time.time())
    assertion = jwt.encode(
        {
            "iss": sa["client_email"],
            "scope": "https://www.googleapis.com/auth/cloud-platform",
            "aud": "https://oauth2.googleapis.com/token",
            "iat": now,
            "exp": now + 3600,
        },
        sa["private_key"],
        algorithm="RS256",
    )
    r = requests.post(
        "https://oauth2.googleapis.com/token",
        data={
            "grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer",
            "assertion": assertion,
        },
        timeout=TIMEOUT,
    )
    r.raise_for_status()
    return r.json()["access_token"]


def postgres_roles() -> list[tuple[str, str, str, bool]]:
    dsn = env("DIRECT_URL") or env("DATABASE_URL")
    if not dsn:
        raise RuntimeError("no DIRECT_URL/DATABASE_URL in pulled prod env")
    con = psycopg2.connect(dsn, connect_timeout=20)
    try:
        with con.cursor() as cur:
            cur.execute(
                """
                SELECT "authUid", email, role, "isActive"
                FROM "User"
                WHERE "authUid" IS NOT NULL AND "authUid" <> ''
                ORDER BY role, email
                """
            )
            return cur.fetchall()
    finally:
        con.close()


def existing_claims(at: str, uid: str) -> dict:
    r = requests.post(
        f"https://identitytoolkit.googleapis.com/v1/projects/{PROJECT_ID}/accounts:lookup",
        headers={"Authorization": f"Bearer {at}"},
        json={"localId": [uid]},
        timeout=TIMEOUT,
    )
    if r.status_code != 200:
        return {}
    users = r.json().get("users") or []
    if not users:
        return {}
    try:
        return json.loads(users[0].get("customAttributes") or "{}")
    except json.JSONDecodeError:
        return {}


def set_claim(at: str, uid: str, claims: dict) -> tuple[bool, str]:
    r = requests.post(
        f"https://identitytoolkit.googleapis.com/v1/projects/{PROJECT_ID}/accounts:update",
        headers={"Authorization": f"Bearer {at}"},
        json={"localId": uid, "customAttributes": json.dumps(claims)},
        timeout=TIMEOUT,
    )
    return r.status_code == 200, f"{r.status_code} {r.text[:120]}"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true", help="actually write claims")
    args = ap.parse_args()

    rows = postgres_roles()
    print(f"Postgres users with a Firebase authUid: {len(rows)}")
    print("role distribution:", dict(Counter(r[2] for r in rows)))
    print("active:", dict(Counter(bool(r[3]) for r in rows)))
    print()

    sa = service_account()
    at = access_token(sa)

    planned: list[tuple[str, str, str]] = []
    skipped: list[tuple[str, str, str]] = []

    for uid, email, pg_role, is_active in rows:
        if not is_active:
            skipped.append((email, str(pg_role), "inactive row"))
            continue
        mapped = ROLE_MAP.get((pg_role or "").strip().upper())
        if not mapped:
            skipped.append((email, str(pg_role), "role not in app role set"))
            continue
        planned.append((uid, email, mapped))

    print(f"eligible for a claim: {len(planned)}   skipped: {len(skipped)}")
    print("planned claim distribution:", dict(Counter(p[2] for p in planned)))
    for email, role, why in skipped[:15]:
        print(f"  SKIP {email} role={role!r} - {why}")
    print()

    if not args.apply:
        print("DRY RUN - nothing written. Re-run with --apply to set claims.")
        for uid, email, role in planned[:20]:
            print(f"  would set role={role:<7} {email}")
        return 0

    wrote = unchanged = failed = 0
    for uid, email, role in planned:
        current = existing_claims(at, uid)
        if current.get("role") == role:
            unchanged += 1
            continue
        merged = {**current, "role": role}
        ok, detail = set_claim(at, uid, merged)
        if ok:
            wrote += 1
            print(f"  set role={role:<7} {email}")
        else:
            failed += 1
            print(f"  FAIL {email}: {detail}")

    print(f"\nwrote={wrote} unchanged={unchanged} failed={failed}")
    return 1 if failed else 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as exc:  # noqa: BLE001
        print(f"[ERROR] {type(exc).__name__}: {exc}")
        sys.exit(2)
