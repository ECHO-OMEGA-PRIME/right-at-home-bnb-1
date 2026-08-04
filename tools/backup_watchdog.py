#!/usr/bin/env python3
"""Alert on failed or missing RAH verified database backups.

The backup service reports real process status through systemd.  This monitor
never scrapes success strings from the journal:

* ``failure UNIT`` reads ``Result`` and ``ExecMainStatus`` from systemd and is
  invoked by the backup service's ``OnFailure=`` handler.
* ``silence`` checks both the daily timer state and the newest verified dump's
  mtime.  A missing or older-than-36-hours dump is an alert.

Alerts use the fleet's single Telegram poller via ``cc_tg.py say``.  State is
written atomically so repeated hourly checks re-alert at a bounded cadence
instead of spamming the Commander.
"""

from __future__ import annotations

import argparse
import glob
import json
import os
import re
import subprocess
import sys
import time
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable, Mapping, Sequence


SERVICE = "echo-rah-backup-verify.service"
TIMER = "echo-rah-backup-verify.timer"
UNIT_RE = re.compile(r"^echo-rah-backup-verify\.service$")
BACKUP_GLOB = os.environ.get(
    "RAH_BACKUP_GLOB", "/var/backups/rah/rah-*.dump"
).strip()
STATE_PATH = Path(
    os.environ.get(
        "RAH_BACKUP_MONITOR_STATE",
        "/var/lib/rah-backup-monitor/state.json",
    )
)
SILENCE_HOURS = float(os.environ.get("RAH_BACKUP_SILENCE_HOURS", "36"))
REALERT_HOURS = float(os.environ.get("RAH_BACKUP_REALERT_HOURS", "6"))
CC_TG_HELPER = os.environ.get("RAH_CC_TG_PATH", "/home/forge/cc_tg.py")
CC_TG_SID = os.environ.get("RAH_BACKUP_TG_SID", "RAH-BACKUP")
TG_CHAT_ID = os.environ.get("RAH_BACKUP_TG_CHAT_ID", "").strip()
SDK_URL = os.environ.get(
    "RAH_BACKUP_SDK_URL", "http://127.0.0.1:8000/sdk/invoke"
).strip()
SOVEREIGN_KEY_FILE = Path(
    os.environ.get("RAH_SOVEREIGN_KEY_FILE", "/home/forge/.echo_sovereign_key")
)
DRY_RUN = os.environ.get("RAH_BACKUP_ALERT_DRY_RUN", "").lower() in {
    "1",
    "true",
    "yes",
}

EXIT_MEANINGS = {
    1: "DUMP FAILED",
    2: "RESTORE FAILED",
    3: "CRITICAL DATA INTEGRITY ALERT - ROW COUNT MISMATCH",
}


def now_epoch() -> float:
    return time.time()


def utc_iso(epoch: float | None = None) -> str:
    value = now_epoch() if epoch is None else epoch
    return datetime.fromtimestamp(value, timezone.utc).isoformat()


def log(event: str, level: str = "info", **fields: Any) -> None:
    record = {
        "ts": utc_iso(),
        "svc": "rah-backup-watchdog",
        "level": level,
        "event": event,
    }
    record.update(fields)
    print(json.dumps(record, default=str, sort_keys=True), flush=True)


def parse_properties(text: str) -> dict[str, str]:
    properties: dict[str, str] = {}
    for line in text.splitlines():
        key, separator, value = line.partition("=")
        if separator and key:
            properties[key] = value
    return properties


def unit_result(
    unit: str,
    runner: Callable[..., subprocess.CompletedProcess[str]] = subprocess.run,
) -> dict[str, str]:
    if not UNIT_RE.fullmatch(unit):
        raise ValueError(f"unexpected backup unit: {unit!r}")
    proc = runner(
        [
            "systemctl",
            "show",
            unit,
            "--property=Result",
            "--property=ExecMainCode",
            "--property=ExecMainStatus",
            "--property=ActiveState",
            "--property=InactiveExitTimestamp",
            "--property=InvocationID",
        ],
        capture_output=True,
        text=True,
        timeout=20,
        check=False,
    )
    if proc.returncode != 0:
        raise RuntimeError(
            f"systemctl show failed rc={proc.returncode}: {(proc.stderr or '')[-300:]}"
        )
    values = parse_properties(proc.stdout or "")
    if "ExecMainStatus" not in values or "Result" not in values:
        raise RuntimeError("systemctl did not return Result and ExecMainStatus")
    return values


def timer_health(
    timer: str = TIMER,
    runner: Callable[..., subprocess.CompletedProcess[str]] = subprocess.run,
) -> tuple[bool, str]:
    proc = runner(
        [
            "systemctl",
            "show",
            timer,
            "--property=LoadState",
            "--property=ActiveState",
            "--property=UnitFileState",
            "--property=NextElapseUSecRealtime",
        ],
        capture_output=True,
        text=True,
        timeout=20,
        check=False,
    )
    if proc.returncode != 0:
        return False, f"systemctl show rc={proc.returncode}"
    values = parse_properties(proc.stdout or "")
    healthy = (
        values.get("LoadState") == "loaded"
        and values.get("ActiveState") == "active"
        and values.get("UnitFileState") in {"enabled", "enabled-runtime"}
    )
    detail = (
        f"load={values.get('LoadState', 'unknown')} "
        f"active={values.get('ActiveState', 'unknown')} "
        f"enabled={values.get('UnitFileState', 'unknown')} "
        f"next={values.get('NextElapseUSecRealtime', 'unknown')}"
    )
    return healthy, detail


def backup_service_health(
    runner: Callable[..., subprocess.CompletedProcess[str]] = subprocess.run,
) -> tuple[bool, str]:
    proc = runner(
        [
            "systemctl",
            "show",
            SERVICE,
            "--property=LoadState",
            "--property=ActiveState",
            "--property=Result",
            "--property=ExecMainStatus",
            "--property=InactiveExitTimestamp",
        ],
        capture_output=True,
        text=True,
        timeout=20,
        check=False,
    )
    if proc.returncode != 0:
        return False, f"systemctl show rc={proc.returncode}"
    values = parse_properties(proc.stdout or "")
    active_state = values.get("ActiveState", "unknown")
    result = values.get("Result", "unknown")
    exit_status = values.get("ExecMainStatus", "unknown")
    healthy = values.get("LoadState") == "loaded" and (
        active_state == "activating" or (result == "success" and exit_status == "0")
    )
    detail = (
        f"load={values.get('LoadState', 'unknown')} active={active_state} "
        f"result={result} exit={exit_status} "
        f"completed={values.get('InactiveExitTimestamp', 'unknown')}"
    )
    return healthy, detail


def newest_dump(pattern: str = BACKUP_GLOB) -> tuple[Path | None, float | None]:
    newest_path: Path | None = None
    newest_mtime: float | None = None
    for raw_path in glob.glob(pattern):
        path = Path(raw_path)
        try:
            stat = path.stat()
        except OSError as exc:
            log("dump_stat_failed", level="warning", path=str(path), error=repr(exc))
            continue
        if not path.is_file() or stat.st_size <= 10_240:
            continue
        if newest_mtime is None or stat.st_mtime > newest_mtime:
            newest_path = path
            newest_mtime = stat.st_mtime
    return newest_path, newest_mtime


def read_state(path: Path = STATE_PATH) -> dict[str, Any]:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
        return value if isinstance(value, dict) else {}
    except FileNotFoundError:
        return {}
    except (OSError, json.JSONDecodeError) as exc:
        log("state_read_failed", level="warning", path=str(path), error=repr(exc))
        return {}


def write_state(state: Mapping[str, Any], path: Path = STATE_PATH) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(f".{path.name}.{os.getpid()}.tmp")
    temporary.write_text(
        json.dumps(dict(state), indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    os.chmod(temporary, 0o600)
    os.replace(temporary, path)


def should_alert(previous: Mapping[str, Any], fingerprint: str, now: float) -> bool:
    if previous.get("fingerprint") != fingerprint:
        return True
    last = previous.get("last_alert_epoch")
    if not isinstance(last, (int, float)):
        return True
    return now - float(last) >= REALERT_HOURS * 3600


def load_sovereign_key(path: Path = SOVEREIGN_KEY_FILE) -> str:
    for line in path.read_text(encoding="utf-8").splitlines():
        name, separator, value = line.partition("=")
        if separator and name.strip() == "SOVEREIGN_KEY":
            key = value.strip().strip('"').strip("'")
            if key:
                return key
    raise RuntimeError("SOVEREIGN_KEY is unavailable")


def send_via_sdk(
    message: str,
    *,
    chat_id: str = TG_CHAT_ID,
    key_loader: Callable[[], str] = load_sovereign_key,
    opener: Callable[..., Any] = urllib.request.urlopen,
) -> bool:
    if not chat_id:
        log("sdk_telegram_target_missing", level="error")
        return False
    try:
        key = key_loader()
        body = json.dumps(
            {
                "envelope_version": 1,
                "capability": "echo.social.telegram_post",
                "params": {
                    "command": "telegram_post",
                    "chat_id": chat_id,
                    "text": message,
                },
            }
        ).encode("utf-8")
        request = urllib.request.Request(
            SDK_URL,
            data=body,
            headers={
                "Content-Type": "application/json",
                "X-Echo-API-Key": key,
            },
            method="POST",
        )
        with opener(request, timeout=30) as response:
            response_body = response.read(4096)
            status = getattr(response, "status", 200)
        key = ""  # release the credential reference before response parsing
        result = json.loads(response_body.decode("utf-8"))
        result_status = (result.get("result") or {}).get("status_code")
        ok = status == 200 and result.get("status") == "ok" and result_status == 200
        log("sdk_telegram_sent" if ok else "sdk_telegram_rejected", level="info" if ok else "error")
        return ok
    except Exception as exc:
        log("sdk_telegram_failed", level="error", error_type=type(exc).__name__)
        return False


def send_telegram(
    message: str,
    runner: Callable[..., subprocess.CompletedProcess[str]] = subprocess.run,
) -> bool:
    if DRY_RUN:
        log("telegram_dry_run", message=message)
        return True
    if send_via_sdk(message):
        return True
    if not os.path.isfile(CC_TG_HELPER):
        log("telegram_helper_missing", level="error", path=CC_TG_HELPER)
        return False
    proc = runner(
        ["python3", CC_TG_HELPER, "say", CC_TG_SID, message],
        stdin=subprocess.DEVNULL,
        capture_output=True,
        text=True,
        timeout=30,
        check=False,
    )
    if proc.returncode == 0:
        log("telegram_sent", sid=CC_TG_SID)
        return True
    log(
        "telegram_failed",
        level="error",
        rc=proc.returncode,
        stderr=(proc.stderr or "")[-300:],
    )
    return False


def record_alert(
    state: dict[str, Any],
    key: str,
    fingerprint: str,
    now: float,
    path: Path = STATE_PATH,
) -> None:
    state[key] = {
        "active": True,
        "fingerprint": fingerprint,
        "last_alert_epoch": now,
        "last_alert_at": utc_iso(now),
    }
    state["checked_at"] = utc_iso(now)
    write_state(state, path)


def report_failure(
    unit: str,
    *,
    state_path: Path = STATE_PATH,
    runner: Callable[..., subprocess.CompletedProcess[str]] = subprocess.run,
    notifier: Callable[[str], bool] = send_telegram,
    now: float | None = None,
) -> int:
    current = now_epoch() if now is None else now
    try:
        result = unit_result(unit, runner)
        exit_code = int(result.get("ExecMainStatus", "-1"))
    except ValueError as exc:
        log("failure_unit_rejected", level="error", error=str(exc), unit=unit)
        return 1
    except RuntimeError as exc:
        log("failure_status_unavailable", level="error", error=str(exc), unit=unit)
        exit_code = -1
        result = {"Result": "status-unavailable", "InvocationID": "unknown"}

    meaning = EXIT_MEANINGS.get(exit_code, "BACKUP SERVICE FAILED")
    fingerprint = (
        f"failure:{result.get('InvocationID', 'unknown')}:"
        f"{result.get('Result', 'unknown')}:{exit_code}"
    )
    state = read_state(state_path)
    previous = state.get("failure") if isinstance(state.get("failure"), dict) else {}
    if not should_alert(previous, fingerprint, current):
        log("failure_alert_throttled", unit=unit, exit_code=exit_code)
        return 0

    message = (
        f"[RAH-BACKUP] {meaning}. systemd result={result.get('Result', 'unknown')} "
        f"exit={exit_code}; completed={result.get('InactiveExitTimestamp', 'unknown')}. "
        "No verified backup was accepted. Inspect: "
        f"journalctl -u {unit} -n 100 --no-pager"
    )
    if not notifier(message):
        log("failure_alert_delivery_failed", level="error", unit=unit)
        return 1
    record_alert(state, "failure", fingerprint, current, state_path)
    return 0


def check_silence(
    *,
    pattern: str = BACKUP_GLOB,
    state_path: Path = STATE_PATH,
    timer_probe: Callable[[], tuple[bool, str]] = timer_health,
    service_probe: Callable[[], tuple[bool, str]] = backup_service_health,
    notifier: Callable[[str], bool] = send_telegram,
    now: float | None = None,
) -> int:
    current = now_epoch() if now is None else now
    timer_ok, timer_detail = timer_probe()
    service_ok, service_detail = service_probe()
    path, mtime = newest_dump(pattern)
    age_hours = None if mtime is None else max(0.0, (current - mtime) / 3600)
    stale = path is None or age_hours is None or age_hours > SILENCE_HOURS
    healthy = timer_ok and service_ok and not stale
    state = read_state(state_path)
    previous = state.get("silence") if isinstance(state.get("silence"), dict) else {}

    if healthy:
        if previous.get("active") is True:
            recovery = (
                f"[RAH-BACKUP] RECOVERED. Daily timer is active and newest verified "
                f"dump {path.name} is {age_hours:.1f}h old; verifier result is healthy."
            )
            if not notifier(recovery):
                log("recovery_alert_delivery_failed", level="error")
                return 1
        state["silence"] = {
            "active": False,
            "checked_at": utc_iso(current),
            "newest_dump": path.name if path else None,
            "age_hours": round(age_hours or 0.0, 2),
            "timer": timer_detail,
            "service": service_detail,
        }
        state["checked_at"] = utc_iso(current)
        write_state(state, state_path)
        log("backup_fresh", dump=path.name if path else None, age_hours=age_hours)
        return 0

    dump_detail = "no valid dump exists"
    if path is not None and age_hours is not None:
        dump_detail = f"newest verified dump {path.name} is {age_hours:.1f}h old"
    fingerprint = (
        f"silence:timer={timer_ok}:service={service_ok}:{service_detail}:"
        f"dump={path.name if path else 'missing'}:"
        f"mtime={int(mtime) if mtime is not None else 0}"
    )
    if not should_alert(previous, fingerprint, current):
        log(
            "silence_alert_throttled",
            timer_ok=timer_ok,
            service_ok=service_ok,
            dump=str(path) if path else None,
            age_hours=age_hours,
        )
        return 0

    message = (
        f"[RAH-BACKUP] SILENCE ALERT: {dump_detail}; daily timer healthy={timer_ok} "
        f"({timer_detail}); last verifier healthy={service_ok} ({service_detail}). "
        f"Threshold={SILENCE_HOURS:.0f}h. "
        f"Inspect systemctl status {TIMER} {SERVICE}."
    )
    if not notifier(message):
        log("silence_alert_delivery_failed", level="error")
        return 1
    record_alert(state, "silence", fingerprint, current, state_path)
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    subparsers = parser.add_subparsers(dest="mode", required=True)
    failure = subparsers.add_parser("failure", help="report a failed backup unit")
    failure.add_argument("unit")
    subparsers.add_parser("silence", help="check timer and newest dump age")
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    try:
        if args.mode == "failure":
            return report_failure(args.unit)
        return check_silence()
    except Exception as exc:  # alerting must fail visibly, without a traceback leak
        log("unhandled_exception", level="error", error=repr(exc), mode=args.mode)
        return 1


if __name__ == "__main__":
    sys.exit(main())
