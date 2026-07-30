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
PUBLIC_OUTPUT = ROOT / "docs" / "consolidation" / "P0_FIREBASE_GCLOUD_ACCOUNT_PROBE.json"
PRIVATE_OUTPUT = ROOT / "docs" / "consolidation" / "P0_FIREBASE_RECOVERED_WEB_CONFIG_PRIVATE.json"
PROJECT_ID = "rightathome-prod"
BASE = f"https://firebase.googleapis.com/v1beta1/projects/{PROJECT_ID}"


def run(command: list[str], timeout: int = 60) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        command,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        timeout=timeout,
        check=False,
    )


def request_json(url: str, token: str) -> tuple[int, Any | None, str | None]:
    request = urllib.request.Request(url, headers={"Authorization": f"Bearer {token}"})
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            body = response.read().decode("utf-8", errors="replace")
            return response.status, json.loads(body), None
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        message = None
        try:
            message = json.loads(body).get("error", {}).get("message")
        except json.JSONDecodeError:
            message = body[:300]
        return exc.code, None, message
    except (urllib.error.URLError, TimeoutError) as exc:
        return 0, None, str(exc)


def main() -> int:
    auth = run([str(GCLOUD), "auth", "list", "--format=json"])
    try:
        account_rows = json.loads(auth.stdout) if auth.returncode == 0 else []
    except json.JSONDecodeError:
        account_rows = []

    results: list[dict[str, Any]] = []
    recovered: list[dict[str, Any]] = []

    for row in account_rows:
        account = row.get("account")
        if not account:
            continue
        token_result = run(
            [str(GCLOUD), "auth", "print-access-token", f"--account={account}"],
            timeout=90,
        )
        token = token_result.stdout.strip() if token_result.returncode == 0 else ""
        account_result: dict[str, Any] = {
            "account": account,
            "credential_status": row.get("status"),
            "token_exit_code": token_result.returncode,
            "token_obtained": bool(token),
            "project_status": None,
            "webapps_status": None,
            "webapp_count": 0,
            "config_statuses": [],
            "access_granted": False,
        }
        if not token:
            results.append(account_result)
            continue

        project_status, _, project_error = request_json(BASE, token)
        account_result["project_status"] = project_status
        account_result["project_error"] = project_error

        apps_status, apps_body, apps_error = request_json(f"{BASE}/webApps", token)
        account_result["webapps_status"] = apps_status
        account_result["webapps_error"] = apps_error
        apps = apps_body.get("apps", []) if isinstance(apps_body, dict) else []
        account_result["webapp_count"] = len(apps)

        for app in apps:
            app_name = app.get("name")
            app_id = app.get("appId")
            if not app_name:
                continue
            config_status, config_body, config_error = request_json(f"https://firebase.googleapis.com/v1beta1/{app_name}/config", token)
            account_result["config_statuses"].append(
                {"app_id_present": bool(app_id), "status": config_status, "error": config_error}
            )
            if config_status == 200 and isinstance(config_body, dict):
                recovered.append(
                    {
                        "account": account,
                        "app": app,
                        "config": config_body,
                    }
                )

        account_result["access_granted"] = project_status == 200 and apps_status == 200
        results.append(account_result)

    private_result = {
        "checked_utc": datetime.now(timezone.utc).isoformat(),
        "project_id": PROJECT_ID,
        "recovered": recovered,
    }
    PRIVATE_OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    PRIVATE_OUTPUT.write_text(json.dumps(private_result, indent=2), encoding="utf-8")

    public_result = {
        "checked_utc": datetime.now(timezone.utc).isoformat(),
        "project_id": PROJECT_ID,
        "gcloud_auth_exit_code": auth.returncode,
        "account_count": len(account_rows),
        "access_granted_account_count": sum(1 for item in results if item["access_granted"]),
        "recovered_web_config_count": len(recovered),
        "accounts": results,
        "private_output": str(PRIVATE_OUTPUT),
    }
    PUBLIC_OUTPUT.write_text(json.dumps(public_result, indent=2), encoding="utf-8")
    print(json.dumps({
        "output": str(PUBLIC_OUTPUT),
        "access_granted_account_count": public_result["access_granted_account_count"],
        "recovered_web_config_count": len(recovered),
    }))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
