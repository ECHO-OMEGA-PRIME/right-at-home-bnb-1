#!/usr/bin/env python3
"""Finish the Tuya Cloud access-secret rotation (RAH Midland).

Run AFTER resetting the Access Secret in the Tuya IoT console
(iot.tuya.com -> Cloud -> Development -> RAH BnB project -> Overview ->
Authorization Key -> Reset next to Access Secret).

Keep the new secret OUT of chat: paste it into a one-line file first, then run:

    (paste the new secret into)  E:\\tmp\\tuya_new.txt
    ! python C:\\ECHO_OMEGA_PRIME\\WEBSITES\\right-at-home-bnb\\tools\\rotate_tuya_finish.py

The script: verifies the NEW secret pulls a live Tuya token, verifies the OLD
secret is now DEAD, writes the new secret to apps/web/.env.local and the local
master vault (Tuya_Cloud_API), best-effort syncs the vault worker, then shreds
the temp file. It changes NOTHING unless the new secret verifies live.
"""
import hashlib, hmac, time, json, os, sys, sqlite3, urllib.request, re

RAH = r"C:\ECHO_OMEGA_PRIME\WEBSITES\right-at-home-bnb"
ENV = os.path.join(RAH, "apps", "web", ".env.local")
NEW_FILE = os.environ.get("TUYA_NEW_FILE", r"E:\tmp\tuya_new.txt")
VAULT_DB = r"C:\ECHO_OMEGA_PRIME\SECURE_VAULT\master_vault.db"
TUYA_BASE = "https://openapi.tuyaus.com"  # Western America data center


def load_env():
    vals = {}
    for line in open(ENV, encoding="utf-8", errors="ignore"):
        line = line.strip()
        if "=" in line and not line.startswith("#"):
            k, v = line.split("=", 1)
            vals[k.strip()] = v.strip().strip('"').strip("'")
    return vals


def tuya_token_ok(access_id, secret):
    """Return (ok, msg). ok=True means the creds pulled a live token."""
    t = str(int(time.time() * 1000))
    path = "/v1.0/token?grant_type=1"
    sts = f"GET\n{hashlib.sha256(b'').hexdigest()}\n\n{path}"
    sign = hmac.new(secret.encode(), (access_id + t + sts).encode(), hashlib.sha256).hexdigest().upper()
    req = urllib.request.Request(TUYA_BASE + path, headers={
        "client_id": access_id, "sign": sign, "t": t, "sign_method": "HMAC-SHA256", "nonce": ""})
    try:
        d = json.loads(urllib.request.urlopen(req, timeout=20).read())
        return bool(d.get("success")), d.get("msg") or ("token" if d.get("success") else "no token")
    except Exception as e:
        return False, str(e)[:80]


def main():
    if not os.path.exists(NEW_FILE):
        print(f"FAIL: paste the new Access Secret into {NEW_FILE} first (one line).")
        return 2
    new = open(NEW_FILE, encoding="utf-8").read().strip()
    if not new or len(new) < 16:
        print("FAIL: new secret file is empty/too short.")
        return 2
    env = load_env()
    aid = env.get("TUYA_ACCESS_ID", "")
    old = env.get("TUYA_ACCESS_SECRET", "")
    if not aid:
        print("FAIL: TUYA_ACCESS_ID not found in .env.local")
        return 2

    print("Verifying NEW secret pulls a live Tuya token...")
    ok_new, m_new = tuya_token_ok(aid, new)
    print(f"  new secret -> {'LIVE' if ok_new else 'FAIL'} ({m_new})")
    if not ok_new:
        print("ABORT: new secret did not authenticate. Nothing changed. Re-copy it from the Tuya console.")
        return 1

    print("Verifying OLD secret is now DEAD...")
    ok_old, m_old = tuya_token_ok(aid, old) if old else (False, "no old on file")
    print(f"  old secret -> {'STILL LIVE (!)' if ok_old else 'dead'} ({m_old})")
    if ok_old:
        print("  WARNING: old secret still authenticates. Tuya may lag a few seconds, OR the reset")
        print("           did not take. Re-check the console reset; re-run this after ~30s.")

    # 1) update .env.local (the app reads this)
    src = open(ENV, encoding="utf-8").read()
    src2 = re.sub(r"(?m)^TUYA_ACCESS_SECRET=.*$", f"TUYA_ACCESS_SECRET={new}", src)
    if "TUYA_ACCESS_SECRET=" not in src2:
        src2 = src.rstrip() + f"\nTUYA_ACCESS_SECRET={new}\n"
    open(ENV, "w", encoding="utf-8").write(src2)
    print("  updated apps/web/.env.local")

    # 2) update the local master vault snapshot
    try:
        c = sqlite3.connect(VAULT_DB)
        n = c.execute("UPDATE credentials SET secret=? WHERE service='Tuya_Cloud_API' AND username=?",
                      (new, aid)).rowcount
        c.commit(); c.close()
        print(f"  updated local master vault Tuya_Cloud_API ({n} row)")
    except Exception as e:
        print(f"  local vault update skipped: {e}")

    # 3) best-effort: sync the canonical vault worker via the SDK gate
    sk = os.environ.get("ECHO_SDK_SOVEREIGN_KEY", "")
    if sk:
        try:
            reason = "rotate leaked Tuya access secret after GitHub exposure; syncing new value to the canonical vault"
            body = json.dumps({"envelope_version": 1, "capability": "echo.vault.put",
                               "params": {"service": "Tuya_Cloud_API", "username": aid, "secret": new,
                                          "context": {"bypass_reason": reason}}}).encode()
            req = urllib.request.Request("http://192.168.1.220:8000/sdk/invoke", data=body, method="POST",
                                         headers={"X-Echo-API-Key": sk, "Content-Type": "application/json"})
            r = urllib.request.urlopen(req, timeout=20)
            print(f"  vault worker sync: HTTP {r.status}")
        except Exception as e:
            print(f"  vault worker sync skipped (do it in-session): {e}")
    else:
        print("  vault worker sync skipped (no ECHO_SDK_SOVEREIGN_KEY in env) - sync in-session.")

    # 4) shred the temp file
    try:
        with open(NEW_FILE, "w") as f:
            f.write("x" * len(new))
        os.remove(NEW_FILE)
        print(f"  shredded {NEW_FILE}")
    except Exception as e:
        print(f"  could not shred {NEW_FILE} - delete it manually: {e}")

    print("\nDONE. New Tuya secret verified live, old dead, .env.local + vault updated." if not ok_old
          else "\nPARTIAL: rotated in config, but confirm the old secret is dead (re-run in ~30s).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
