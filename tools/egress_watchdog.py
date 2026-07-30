#!/usr/bin/env python3
"""RAH dynamic egress watchdog.

The Tuya Cloud project for RAH smart locks is IP-allowlisted to the public
egress IP of FORGE (echo-rah-api). The home/ISP IP is dynamic: if it drifts,
Tuya calls (guest lock-code provisioning) fail until the allowlist is updated.

This script detects that drift and alerts the Commander via Telegram.

Behavior
--------
- Reads expected IP from env RAH_EXPECTED_EGRESS_IP (default 107.219.15.225).
- Queries 3 independent public-IP services and takes a majority consensus
  (>= 2 agreeing sources required). Single-source failures are tolerated;
  without consensus it logs and exits 1 WITHOUT touching state or alerting.
- On match : writes {expected, current, ok: true, checked_at} to the state
  file (env RAH_EGRESS_STATE, default /home/forge/rah-monitor/egress_state.json)
  and exits 0 quietly.
- On drift : logs a structured event, writes {expected, current, changed_at,
  acknowledged: false} to the state file, and sends a Telegram alert.
  Alerts are throttled (RAH_REALERT_HOURS, default 6h) so a 10-minute timer
  does not spam the Commander with the same drift.

Telegram path (in preference order):
  1. /home/forge/cc_tg.py say <SID> "<msg>"   (existing fleet helper)
  2. Direct Bot API sendMessage using env TG_BOT_TOKEN (chat 8890692789)
  3. Neither available -> log loudly; state file is still written.

Designed for a systemd oneshot + timer. Never raises to the systemd layer:
every failure mode is caught and logged. Exit codes: 0 = ok or drift handled,
1 = no confident public-IP reading (transient; timer will retry).

Stdlib only. No third-party dependencies.
"""

from __future__ import annotations

import ipaddress
import json
import os
import subprocess
import sys
import time
import urllib.request
from collections import Counter
from datetime import datetime, timezone

# --------------------------------------------------------------------------
# Configuration (env-driven; sane defaults for FORGE deployment)
# --------------------------------------------------------------------------
EXPECTED_IP = os.environ.get("RAH_EXPECTED_EGRESS_IP", "107.219.15.225").strip()
STATE_PATH = os.environ.get(
    "RAH_EGRESS_STATE", "/home/forge/rah-monitor/egress_state.json"
).strip()
HTTP_TIMEOUT = float(os.environ.get("RAH_EGRESS_HTTP_TIMEOUT", "5"))
REALERT_HOURS = float(os.environ.get("RAH_REALERT_HOURS", "6"))

CC_TG_HELPER = os.environ.get("RAH_CC_TG_PATH", "/home/forge/cc_tg.py")
CC_TG_SID = os.environ.get("RAH_TG_SID", "RAH-EGRESS")
TG_BOT_TOKEN = os.environ.get("TG_BOT_TOKEN", "").strip()
TG_CHAT_ID = os.environ.get("TG_CHAT_ID", "8890692789").strip()

IP_SOURCES = (
    "https://api.ipify.org",
    "https://ifconfig.me/ip",
    "https://checkip.amazonaws.com",
)

MIN_CONSENSUS = 2  # sources that must agree before we act


# --------------------------------------------------------------------------
# Structured logging (JSON lines -> stdout -> journald)
# --------------------------------------------------------------------------
def log(event: str, level: str = "info", **fields) -> None:
    record = {
        "ts": datetime.now(timezone.utc).isoformat(),
        "svc": "rah-egress-watchdog",
        "level": level,
        "event": event,
    }
    record.update(fields)
    try:
        print(json.dumps(record, default=str), flush=True)
    except Exception:  # pragma: no cover - logging must never kill us
        print(f"{record['ts']} {level} {event}", flush=True)


# --------------------------------------------------------------------------
# Public IP discovery
# --------------------------------------------------------------------------
def fetch_ip(url: str, want_version: int) -> str | None:
    """Fetch one source. Returns a validated IP string or None.

    Discards readings whose address family differs from the expected IP's
    (dual-stack hosts can get an IPv6 answer from some sources, which must
    not poison an IPv4-allowlist comparison).
    """
    req = urllib.request.Request(
        url, headers={"User-Agent": "rah-egress-watchdog/1.0"}
    )
    try:
        with urllib.request.urlopen(req, timeout=HTTP_TIMEOUT) as resp:
            if resp.status != 200:
                log("source_non_200", level="warning", url=url, status=resp.status)
                return None
            body = resp.read(256).decode("utf-8", errors="replace").strip()
        addr = ipaddress.ip_address(body)  # validates + normalizes
        if addr.version != want_version:
            log(
                "source_wrong_family",
                level="warning",
                url=url,
                got=str(addr),
                want=f"IPv{want_version}",
            )
            return None
        return str(addr)
    except Exception as exc:
        log("source_failed", level="warning", url=url, error=repr(exc))
        return None


def consensus_ip(want_version: int) -> str | None:
    """Majority vote across sources; None when no confident reading."""
    readings = {}
    for url in IP_SOURCES:
        ip = fetch_ip(url, want_version)
        if ip:
            readings[url] = ip

    if not readings:
        log("no_sources_reachable", level="error")
        return None

    counts = Counter(readings.values())
    ip, votes = counts.most_common(1)[0]
    if votes >= MIN_CONSENSUS:
        log("consensus", ip=ip, votes=votes, readings=readings)
        return ip

    log(
        "no_consensus",
        level="warning",
        readings=readings,
        note=f"need >= {MIN_CONSENSUS} agreeing sources; acting on nothing",
    )
    return None


# --------------------------------------------------------------------------
# State file (atomic write)
# --------------------------------------------------------------------------
def read_state() -> dict:
    try:
        with open(STATE_PATH, "r", encoding="utf-8") as fh:
            data = json.load(fh)
        return data if isinstance(data, dict) else {}
    except FileNotFoundError:
        return {}
    except Exception as exc:
        log("state_read_failed", level="warning", path=STATE_PATH, error=repr(exc))
        return {}


def write_state(state: dict) -> None:
    try:
        directory = os.path.dirname(STATE_PATH) or "."
        os.makedirs(directory, exist_ok=True)
        tmp = f"{STATE_PATH}.tmp"
        with open(tmp, "w", encoding="utf-8") as fh:
            json.dump(state, fh, indent=2, sort_keys=True)
            fh.write("\n")
        os.replace(tmp, STATE_PATH)
    except Exception as exc:
        log("state_write_failed", level="error", path=STATE_PATH, error=repr(exc))


# --------------------------------------------------------------------------
# Telegram alerting
# --------------------------------------------------------------------------
def send_via_cc_tg(message: str) -> bool:
    if not os.path.isfile(CC_TG_HELPER):
        return False
    try:
        proc = subprocess.run(
            ["python3", CC_TG_HELPER, "say", CC_TG_SID, message],
            stdin=subprocess.DEVNULL,
            capture_output=True,
            text=True,
            timeout=30,
        )
        if proc.returncode == 0:
            log("telegram_sent", via="cc_tg.py")
            return True
        log(
            "cc_tg_failed",
            level="warning",
            rc=proc.returncode,
            stderr=(proc.stderr or "")[-400:],
        )
        return False
    except Exception as exc:
        log("cc_tg_failed", level="warning", error=repr(exc))
        return False


def send_via_bot_api(message: str) -> bool:
    if not TG_BOT_TOKEN:
        return False
    try:
        payload = json.dumps({"chat_id": TG_CHAT_ID, "text": message}).encode("utf-8")
        req = urllib.request.Request(
            f"https://api.telegram.org/bot{TG_BOT_TOKEN}/sendMessage",
            data=payload,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            ok = resp.status == 200
        if ok:
            log("telegram_sent", via="bot_api")
        else:
            log("bot_api_non_200", level="warning", status=resp.status)
        return ok
    except Exception as exc:
        log("bot_api_failed", level="warning", error=repr(exc))
        return False


def send_alert(message: str) -> bool:
    if send_via_cc_tg(message):
        return True
    if send_via_bot_api(message):
        return True
    log(
        "ALERT_DELIVERY_FAILED",
        level="error",
        message=message,
        note="No Telegram path available (cc_tg.py missing/failed, no TG_BOT_TOKEN). "
        "State file written; fix alert path.",
    )
    return False


# --------------------------------------------------------------------------
# Drift handling
# --------------------------------------------------------------------------
def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def should_realert(prev: dict, current_ip: str) -> bool:
    """Throttle: re-alert for the SAME drifted IP only every REALERT_HOURS."""
    if prev.get("current") != current_ip or prev.get("ok") is True:
        return True  # new drift (or first drift after an OK state)
    last = prev.get("last_alert_epoch")
    if not isinstance(last, (int, float)):
        return True
    return (time.time() - last) >= REALERT_HOURS * 3600


def handle_drift(current_ip: str, prev: dict) -> None:
    log(
        "EGRESS_IP_DRIFT",
        level="error",
        expected=EXPECTED_IP,
        current=current_ip,
        impact="Tuya Cloud allowlist no longer matches egress; "
        "guest lock-code provisioning WILL FAIL until updated.",
    )

    alert_due = should_realert(prev, current_ip)
    state = {
        "expected": EXPECTED_IP,
        "current": current_ip,
        "changed_at": (
            prev.get("changed_at")
            if prev.get("current") == current_ip and prev.get("ok") is not True
            else utc_now_iso()
        ),
        "acknowledged": False,
    }

    if alert_due:
        msg = (
            f"[{CC_TG_SID}] RAH EGRESS IP DRIFT: FORGE public IP is now "
            f"{current_ip} (Tuya allowlist expects {EXPECTED_IP}). "
            f"Guest lock-code provisioning via Tuya will FAIL. "
            f"Fix: update the Tuya Cloud project IP allowlist to {current_ip}, "
            f"then set RAH_EXPECTED_EGRESS_IP={current_ip} in "
            f"echo-rah-egress-watchdog.service and daemon-reload."
        )
        send_alert(msg)  # failure already logged loudly; never raises
        state["last_alert_epoch"] = time.time()
        state["last_alert_at"] = utc_now_iso()
    else:
        # carry throttle bookkeeping forward
        state["last_alert_epoch"] = prev.get("last_alert_epoch")
        state["last_alert_at"] = prev.get("last_alert_at")
        log("alert_throttled", current=current_ip, realert_hours=REALERT_HOURS)

    write_state(state)


def handle_ok(current_ip: str, prev: dict) -> None:
    if prev.get("ok") is not True and prev.get("current"):
        log("egress_ip_recovered", expected=EXPECTED_IP, previous=prev.get("current"))
    write_state(
        {
            "expected": EXPECTED_IP,
            "current": current_ip,
            "ok": True,
            "checked_at": utc_now_iso(),
        }
    )


# --------------------------------------------------------------------------
# Entrypoint
# --------------------------------------------------------------------------
def main() -> int:
    try:
        want_version = ipaddress.ip_address(EXPECTED_IP).version
    except ValueError:
        log("invalid_expected_ip", level="error", value=EXPECTED_IP)
        return 1

    current = consensus_ip(want_version)
    if current is None:
        # Transient / no confident reading: do NOT touch state, do NOT alert.
        return 1

    prev = read_state()
    if current == EXPECTED_IP:
        handle_ok(current, prev)
    else:
        handle_drift(current, prev)
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as exc:  # absolute backstop: never traceback to systemd
        log("unhandled_exception", level="error", error=repr(exc))
        sys.exit(1)
