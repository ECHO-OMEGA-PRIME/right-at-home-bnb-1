from __future__ import annotations

import json
import subprocess
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(r"C:\ECHO_OMEGA_PRIME\WEBSITES\right-at-home-bnb")
GCLOUD = Path(r"C:\Program Files (x86)\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd")
PUBLIC_OUTPUT = ROOT / "docs" / "consolidation" / "P0_FIREBASE_QUOTA_PROJECT_PROBE.json"
PRIVATE_OUTPUT = ROOT / "docs" / "consolidation" / "P0_FIREBASE_RECOVERED_WEB_CONFIG_PRIVATE.json"
TARGET = "rightathome-prod"
ACCOUNT = "bmcii1976@gmail.com"
QUOTA_PROJECTS = ["echo-prime-ai", "echo-prime-ai-7f259", "rightathome-prod"]
BASE = f"https://firebase.googleapis.com/v1beta1/projects/{TARGET}"


def run(command: list[str]) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        command,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        timeout=90,
        check=False,
    )


def request_json(url: str, token: str, quota_project: str) -> tuple[int, Any | None, str | None]:
    request = urllib.request.Request(
        url,
        headers={
            "Authorization": f"Bearer {token}",
            "x-goog-user-project": quota_project,
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            body = response.read().decode("utf-8", errors="replace")
            return response.status, json.loads(body), None
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        try:
            message = json.loads(body).get("error", {}).get("message")
        except json.JSONDecodeError:
            message = body[:300]
        return exc.code, None, message
    except (urllib.error.URLError, TimeoutError) as exc:
        return 0, None, str(exc)


def main() -> int:
    token_result = run([str(GCLOUD), "auth", "print-access-token", f"--account={ACCOUNT}"])
    token = token_result.stdout.strip() if token_result.returncode == 0 else ""
    attempts: list[dict[str, Any]] = []
    recovered: list[dict[str, Any]] = []

    for quota_project in QUOTA_PROJECTS:
        attempt: dict[str, Any] = {
            "quota_project": quota_project,
            "project_status": None,
            "webapps_status": None,
            "webapp_count": 0,
            "access_granted": False,
        }
        if not token:
            attempt["error"] = "No access token"
            attempts.append(attempt)
            continue

        project_status, project_body, project_error = request_json(BASE, token, quota_project)
        apps_status, apps_body, apps_error = request_json(f"{BASE}/webApps", token, quota_project)
        apps = apps_body.get("apps", []) if isinstance(apps_body, dict) else []
        attempt.update(
            {
                "project_status": project_status,
                "project_error": project_error,
                "webapps_status": apps_status,
                "webapps_error": apps_error,
                "webapp_count": len(apps),
                "access_granted": project_status == 200 and apps_status == 200,
            }
        )

        for app in apps:
            app_name = app.get("name")
            if not app_name:
                continue
            config_status, config_body, config_error = request_json(
                f"https://firebase.googleapis.com/v1beta1/{app_name}/config",
                token,
                quota_project,
            )
            attempt.setdefault("config_statuses", []).append(
                {"status": config_status, "error": config_error, "app_id_present": bool(app.get("appId"))}
            )
            if config_status == 200 and isinstance(config_body, dict):
                recovered.append(
                    {
                        "account": ACCOUNT,
                        "quota_project": quota_project,
                        "project": project_body,
                        "app": app,
                        "config": config_body,
                    }
                )
        attempts.append(attempt)

    PRIVATE_OUTPUT.write_text(
        json.dumps(
            {
                "checked_utc": datetime.now(timezone.utc).isoformat(),
                "target_project": TARGET,
                "recovered": recovered,
            },
            indent=2,
        ),
        encoding="utf-8",
    )
    public = {
        "checked_utc": datetime.now(timezone.utc).isoformat(),
        "account": ACCOUNT,
        "target_project": TARGET,
        "token_exit_code": token_result.returncode,
        "token_obtained": bool(token),
        "successful_quota_project_count": sum(1 for item in attempts if item["access_granted"]),
        "recovered_web_config_count": len(recovered),
        "attempts": attempts,
        "private_output": str(PRIVATE_OUTPUT),
    }
    PUBLIC_OUTPUT.write_text(json.dumps(public, indent=2), encoding="utf-8")
    print(json.dumps({
        "output": str(PUBLIC_OUTPUT),
        "successful_quota_project_count": public["successful_quota_project_count"],
        "recovered_web_config_count": len(recovered),
    }))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
