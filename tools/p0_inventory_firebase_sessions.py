from __future__ import annotations

import json
import os
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(r"C:\ECHO_OMEGA_PRIME\WEBSITES\right-at-home-bnb")
OUTPUT = ROOT / "docs" / "consolidation" / "P0_FIREBASE_ACCOUNT_SESSIONS.json"


def run(command: list[str]) -> dict[str, Any]:
    try:
        completed = subprocess.run(
            command,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=90,
            check=False,
        )
        return {
            "command": command,
            "exit_code": completed.returncode,
            "stdout": completed.stdout,
            "stderr": completed.stderr,
        }
    except (OSError, subprocess.TimeoutExpired) as exc:
        return {"command": command, "exit_code": 127, "stdout": "", "stderr": str(exc)}


def parse_json(text: str) -> Any | None:
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return None


def collect_emails(value: Any) -> list[str]:
    emails: set[str] = set()

    def visit(item: Any) -> None:
        if isinstance(item, dict):
            for key, child in item.items():
                if key.lower() in {"email", "account"} and isinstance(child, str) and "@" in child:
                    emails.add(child)
                visit(child)
        elif isinstance(item, list):
            for child in item:
                visit(child)

    visit(value)
    return sorted(emails)


def collect_project_ids(value: Any) -> list[str]:
    projects: set[str] = set()

    def visit(item: Any) -> None:
        if isinstance(item, dict):
            for key, child in item.items():
                if key in {"projectId", "project_id"} and isinstance(child, str):
                    projects.add(child)
                visit(child)
        elif isinstance(item, list):
            for child in item:
                visit(child)

    visit(value)
    return sorted(projects)


def main() -> int:
    firebase_login = run(["firebase", "login:list", "--json"])
    firebase_projects = run(["firebase", "projects:list", "--json"])
    gcloud_accounts = run(["gcloud", "auth", "list", "--filter=status:ACTIVE", "--format=json"])

    login_json = parse_json(firebase_login["stdout"])
    projects_json = parse_json(firebase_projects["stdout"])
    gcloud_json = parse_json(gcloud_accounts["stdout"])

    appdata = Path(os.environ.get("APPDATA", ""))
    userprofile = Path(os.environ.get("USERPROFILE", ""))
    possible = [
        appdata / "configstore" / "firebase-tools.json",
        userprofile / ".config" / "configstore" / "firebase-tools.json",
        appdata / "firebase-tools.json",
        userprofile / ".config" / "gcloud" / "credentials.db",
        userprofile / ".config" / "gcloud" / "access_tokens.db",
    ]
    stores = []
    for path in possible:
        if not path.is_file():
            continue
        stat = path.stat()
        stores.append(
            {
                "path": str(path),
                "bytes": stat.st_size,
                "modified_utc": datetime.fromtimestamp(stat.st_mtime, timezone.utc).isoformat(),
            }
        )

    project_ids = collect_project_ids(projects_json)
    result = {
        "checked_utc": datetime.now(timezone.utc).isoformat(),
        "firebase_login_exit_code": firebase_login["exit_code"],
        "firebase_logged_in_accounts": collect_emails(login_json),
        "firebase_login_error_present": bool(firebase_login["stderr"].strip()),
        "firebase_projects_exit_code": firebase_projects["exit_code"],
        "firebase_project_ids": project_ids,
        "rightathome_visible": "rightathome-prod" in project_ids,
        "firebase_projects_error_present": bool(firebase_projects["stderr"].strip()),
        "gcloud_exit_code": gcloud_accounts["exit_code"],
        "active_gcloud_accounts": collect_emails(gcloud_json),
        "gcloud_error_present": bool(gcloud_accounts["stderr"].strip()),
        "credential_store_files": stores,
    }
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(result, indent=2), encoding="utf-8")
    print(json.dumps({"output": str(OUTPUT), "rightathome_visible": result["rightathome_visible"]}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
