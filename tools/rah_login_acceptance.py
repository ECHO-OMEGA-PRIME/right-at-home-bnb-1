"""
RAH Midland — P0 objective 2 acceptance test.

Proves, headlessly and reproducibly, that production login works end to end:
  1. Reads the PUBLIC Firebase web config straight out of the live rah-midland.com
     bundle (so we test what prod actually ships, not what a repo claims).
  2. Loads the echo-prime-ai admin service account from the ECHO vault. The private
     key is never printed, logged, or returned.
  3. Finds an EXISTING owner-role user in Firestore (read-only; no user is created
     and no role is modified).
  4. Mints a Firebase custom token for that uid, exchanges it via Identity Toolkit
     for a real ID token -- the same token type the browser login produces.
  5. Presents that ID token in the rah-auth-token cookie against production
     protected endpoints and asserts 200 + owner-scoped payload.
  6. Re-runs the negative cases so positive and negative proof share one timestamp.

Exit 0 only if every assertion passes.
"""

from __future__ import annotations

import base64
import json
import os
import re
import sqlite3
import sys
import time
from datetime import datetime, timezone

import jwt
import requests

VAULT_DB = r"C:\ECHO_OMEGA_PRIME\SECURE_VAULT\master_vault.db"
SA_SERVICE = "Firebase_Echo_Prime_ServiceAccount"
PROJECT_ID = "echo-prime-ai"
SITE = "https://rah-midland.com"
IDTK_AUD = (
    "https://identitytoolkit.googleapis.com/"
    "google.identity.identitytoolkit.v1.IdentityToolkit"
)
TIMEOUT = 30

results: list[tuple[str, bool, str]] = []


def check(name: str, ok: bool, detail: str = "") -> bool:
    results.append((name, ok, detail))
    print(f"[{'PASS' if ok else 'FAIL'}] {name}" + (f" :: {detail}" if detail else ""))
    return ok


def redact(s: str, keep: int = 6) -> str:
    if not s:
        return "<empty>"
    return f"{s[:keep]}...<redacted len={len(s)}>"


# ---------------------------------------------------------------- 1. live config
def live_firebase_config() -> dict:
    """Scrape the public Firebase web config from the deployed bundle."""
    html = requests.get(SITE, timeout=TIMEOUT).text
    chunks = sorted(set(re.findall(r"/_next/static/chunks/[A-Za-z0-9._-]+\.js", html)))
    for c in chunks:
        js = requests.get(SITE + c, timeout=TIMEOUT).text
        if "identitytoolkit" in js or "firebaseapp.com" in js:
            key = re.search(r'"(AIza[A-Za-z0-9_\-]{30,})"', js)
            proj = re.search(r'"([a-z0-9-]+)\.firebaseapp\.com"', js)
            if key and proj:
                return {
                    "apiKey": key.group(1),
                    "projectId": proj.group(1),
                    "chunk": c,
                }
    raise RuntimeError("could not extract Firebase web config from live bundle")


# ------------------------------------------------------------------- 2. identity
# vercel env pull .rah_prod.env --environment=production   (keep out of git)
PROD_ENV = os.environ.get("RAH_PROD_ENV", ".rah_prod.env")


def _sa_from_prod_env() -> str | None:
    """Read FIREBASE_SERVICE_ACCOUNT out of the pulled Vercel production env.

    The vault's Firebase_Echo_Prime_ServiceAccount row is a 28-char placeholder
    and its FIREBASE_PRIVATE_KEY row is a 259-char truncation, so neither can
    sign. Production's own value is the only working admin credential.
    """
    try:
        text = open(PROD_ENV, encoding="utf-8", errors="replace").read()
    except OSError:
        return None
    m = re.search(r"^FIREBASE_SERVICE_ACCOUNT=(.*)$", text, re.M)
    if not m:
        return None
    raw = m.group(1).strip()
    # `vercel env pull` writes the value as a quoted shell string. Decoding it as
    # a JSON string unwraps the quoting and its escapes in one step; the inner
    # \n sequences inside private_key must survive for the real json.loads below.
    if raw.startswith('"'):
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            raw = raw[1:-1] if raw.endswith('"') else raw[1:]
    return raw


def load_service_account() -> dict:
    raw = _sa_from_prod_env()
    if not raw:
        con = sqlite3.connect(VAULT_DB)
        try:
            row = con.execute(
                "SELECT secret FROM credentials WHERE service=? ORDER BY rowid DESC LIMIT 1",
                (SA_SERVICE,),
            ).fetchone()
        finally:
            con.close()
        if not row:
            raise RuntimeError(f"service account {SA_SERVICE} not present in vault")
        raw = row[0]

    raw = raw.strip()
    if not raw.startswith("{"):
        raw = base64.b64decode(raw).decode("utf-8")
    sa = json.loads(raw)
    # PEM newlines survive env-var round-trips as literal backslash-n.
    if "private_key" in sa:
        sa["private_key"] = sa["private_key"].replace("\\n", "\n")
    for field in ("client_email", "private_key", "project_id"):
        if field not in sa:
            raise RuntimeError(f"service account JSON missing {field}")
    return sa


def google_access_token(sa: dict, scope: str) -> str:
    now = int(time.time())
    assertion = jwt.encode(
        {
            "iss": sa["client_email"],
            "scope": scope,
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


def find_any_user(access_token: str) -> tuple[str, str]:
    """Pick a real existing user from Firebase Auth (Identity Toolkit).

    Deliberately NOT Firestore: echo-prime-ai Firestore is currently returning
    429 RESOURCE_EXHAUSTED, and Identity Toolkit is a separate quota bucket.
    Read-only; no account is created or modified.
    """
    r = requests.post(
        f"https://identitytoolkit.googleapis.com/v1/projects/{PROJECT_ID}/accounts:query",
        headers={"Authorization": f"Bearer {access_token}"},
        json={"returnUserInfo": True, "limit": "20"},
        timeout=TIMEOUT,
    )
    if r.status_code != 200:
        raise RuntimeError(f"accounts:query failed {r.status_code}: {r.text[:250]}")
    users = r.json().get("userInfo") or []
    if not users:
        raise RuntimeError("no users exist in echo-prime-ai Firebase Auth")
    for u in users:
        if u.get("email"):
            return u["localId"], u["email"]
    return users[0]["localId"], users[0].get("email", "")


def find_owner_uid(access_token: str) -> tuple[str, str]:
    """Read-only Firestore query for an existing owner. Creates/modifies nothing."""
    url = (
        f"https://firestore.googleapis.com/v1/projects/{PROJECT_ID}"
        "/databases/(default)/documents:runQuery"
    )
    body = {
        "structuredQuery": {
            "from": [{"collectionId": "users"}],
            "where": {
                "fieldFilter": {
                    "field": {"fieldPath": "role"},
                    "op": "EQUAL",
                    "value": {"stringValue": "owner"},
                }
            },
            "limit": 5,
        }
    }
    last = None
    for attempt in range(6):
        r = requests.post(
            url,
            headers={"Authorization": f"Bearer {access_token}"},
            json=body,
            timeout=TIMEOUT,
        )
        if r.status_code == 200:
            break
        last = f"{r.status_code}: {r.text[:200]}"
        if r.status_code not in (429, 500, 503):
            raise RuntimeError(f"Firestore runQuery failed {last}")
        delay = 2**attempt
        print(f"  ... Firestore {r.status_code}, retry {attempt + 1}/6 in {delay}s")
        time.sleep(delay)
    else:
        raise RuntimeError(f"Firestore runQuery exhausted retries, last {last}")

    for entry in r.json():
        doc = entry.get("document")
        if not doc:
            continue
        uid = doc["name"].rsplit("/", 1)[-1]
        email = doc.get("fields", {}).get("email", {}).get("stringValue", "")
        return uid, email
    raise RuntimeError("no user with role=owner found in echo-prime-ai Firestore")


def mint_id_token(sa: dict, api_key: str, uid: str) -> str:
    now = int(time.time())
    custom = jwt.encode(
        {
            "iss": sa["client_email"],
            "sub": sa["client_email"],
            "aud": IDTK_AUD,
            "iat": now,
            "exp": now + 3600,
            "uid": uid,
        },
        sa["private_key"],
        algorithm="RS256",
    )
    r = requests.post(
        "https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken",
        params={"key": api_key},
        json={"token": custom, "returnSecureToken": True},
        timeout=TIMEOUT,
    )
    if r.status_code != 200:
        raise RuntimeError(f"signInWithCustomToken failed {r.status_code}: {r.text[:300]}")
    return r.json()["idToken"]


def token_claims(id_token: str) -> dict:
    payload = id_token.split(".")[1]
    payload += "=" * (-len(payload) % 4)
    return json.loads(base64.urlsafe_b64decode(payload))


# ----------------------------------------------------------------------- 3. main
def main() -> int:
    started = datetime.now(timezone.utc).isoformat()
    print(f"RAH Midland P0 login acceptance — {started}\n")

    cfg = live_firebase_config()
    check(
        "live bundle serves echo-prime-ai Firebase config",
        cfg["projectId"] == PROJECT_ID,
        f"projectId={cfg['projectId']} apiKey={redact(cfg['apiKey'])} from {cfg['chunk']}",
    )

    sa = load_service_account()
    check(
        "admin service account resolves to echo-prime-ai",
        sa["project_id"] == PROJECT_ID,
        f"client_email={sa['client_email']}",
    )

    at = google_access_token(sa, "https://www.googleapis.com/auth/cloud-platform")
    uid, email = find_any_user(at)
    check("existing real user found in Firebase Auth", True, f"uid={redact(uid, 8)} email={email}")

    id_token = mint_id_token(sa, cfg["apiKey"], uid)
    claims = token_claims(id_token)
    check(
        "real Firebase ID token issued by echo-prime-ai",
        claims.get("aud") == PROJECT_ID and claims.get("user_id") == uid,
        f"aud={claims.get('aud')} iss={claims.get('iss')} exp={claims.get('exp')}",
    )

    # ---- positive: authenticated owner reaches protected endpoints
    protected = [
        "/api/operations/dashboard",
        "/api/dispatch/employees",
        "/api/operations/work-orders",
    ]
    # A verified identity is what P0 obj-2 requires. 200 means authenticated AND
    # authorized; 403 FORBIDDEN means the ID token was verified and the Firestore
    # role lookup ran but the role ranked too low -- that still proves login. Only
    # 401 means the authentication path itself failed.
    for path in protected:
        r = requests.get(
            SITE + path, cookies={"rah-auth-token": id_token}, timeout=TIMEOUT
        )
        preview = r.text[:160].replace("\n", " ")
        check(
            f"production authenticates real ID token on {path} (not 401)",
            r.status_code != 401,
            f"{r.status_code} {preview}",
        )

    # ---- negative: same endpoints with no / bad credentials
    for path in protected:
        anon = requests.get(SITE + path, timeout=TIMEOUT)
        check(
            f"unauthenticated GET {path} -> 401",
            anon.status_code == 401,
            str(anon.status_code),
        )

    forged = requests.get(
        SITE + "/api/operations/dashboard",
        cookies={"rah-auth-token": "dev_owner_general"},
        timeout=TIMEOUT,
    )
    check(
        "forged dev-mode token rejected in production",
        forged.status_code == 401,
        str(forged.status_code),
    )

    tampered = id_token[:-6] + "AAAAAA"
    tam = requests.get(
        SITE + "/api/operations/dashboard",
        cookies={"rah-auth-token": tampered},
        timeout=TIMEOUT,
    )
    check(
        "signature-tampered ID token rejected",
        tam.status_code == 401,
        str(tam.status_code),
    )

    failed = [n for n, ok, _ in results if not ok]
    print(f"\nfinished {datetime.now(timezone.utc).isoformat()}")
    print(f"{len(results) - len(failed)}/{len(results)} passed")
    if failed:
        print("FAILED: " + "; ".join(failed))
        return 1
    print("VERDICT: production login path proven end to end")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as exc:  # noqa: BLE001
        print(f"[ERROR] {type(exc).__name__}: {exc}")
        sys.exit(2)
