#!/usr/bin/env python3
"""Safely validate or sync RAH Midland Firebase variables to Vercel.

This tool never reads from a hardcoded drive or legacy vault path. Values must
already be present in the current process environment. Nothing is changed
unless --sync and the exact confirmation token are both supplied.
"""

from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Dict, Iterable

# echo-prime-ai is the real, controlled Firebase project (fixed 2026-07-30,
# commit c442be3). This fail-closed guard previously rejected the CORRECT
# project id and would have blocked every legitimate env sync since.
EXPECTED_PROJECT_ID = "echo-prime-ai"
CONFIRMATION_TOKEN = "SYNC_RAH_VERCEL_ENV"

FIREBASE_VARIABLES = (
    "NEXT_PUBLIC_FIREBASE_API_KEY",
    "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
    "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
    "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
    "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
    "NEXT_PUBLIC_FIREBASE_APP_ID",
    "FIREBASE_PROJECT_ID",
    "FIREBASE_STORAGE_BUCKET",
    "FIREBASE_SERVICE_ACCOUNT",
)


def read_values(names: Iterable[str]) -> Dict[str, str]:
    return {name: os.environ.get(name, "").strip() for name in names}


def validate(values: Dict[str, str]) -> list[str]:
    errors: list[str] = []
    missing = [name for name, value in values.items() if not value]
    if missing:
        errors.append("Missing variables: " + ", ".join(missing))

    client_project = values.get("NEXT_PUBLIC_FIREBASE_PROJECT_ID", "")
    admin_project = values.get("FIREBASE_PROJECT_ID", "")

    if client_project and client_project != EXPECTED_PROJECT_ID:
        errors.append(
            f"NEXT_PUBLIC_FIREBASE_PROJECT_ID must be {EXPECTED_PROJECT_ID}, "
            f"not {client_project}."
        )
    if admin_project and admin_project != EXPECTED_PROJECT_ID:
        errors.append(
            f"FIREBASE_PROJECT_ID must be {EXPECTED_PROJECT_ID}, not {admin_project}."
        )
    if client_project and admin_project and client_project != admin_project:
        errors.append("Client and Admin Firebase project IDs do not match.")

    return errors


def print_status(values: Dict[str, str]) -> None:
    print("RAH Vercel environment status")
    print(f"Expected Firebase project: {EXPECTED_PROJECT_ID}")
    for name in FIREBASE_VARIABLES:
        print(f"  {name}: {'SET' if values.get(name) else 'MISSING'}")


def require_vercel_cli() -> str:
    executable = shutil.which("vercel")
    if not executable:
        raise RuntimeError("Vercel CLI is not installed or not on PATH.")
    return executable


def run_vercel(
    executable: str,
    arguments: list[str],
    cwd: Path,
    input_text: str | None = None,
) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [executable, *arguments],
        cwd=cwd,
        input=input_text,
        capture_output=True,
        text=True,
        check=False,
    )


def sync(values: Dict[str, str], environment: str, confirm: str) -> int:
    if confirm != CONFIRMATION_TOKEN:
        print(
            f"Refusing to sync. Pass --confirm {CONFIRMATION_TOKEN} exactly.",
            file=sys.stderr,
        )
        return 2

    errors = validate(values)
    if errors:
        for error in errors:
            print(f"ERROR: {error}", file=sys.stderr)
        return 2

    executable = require_vercel_cli()
    project_dir = Path(__file__).resolve().parent.parent

    project_result = run_vercel(executable, ["project", "inspect"], project_dir)
    if project_result.returncode != 0:
        print("Unable to inspect the linked Vercel project.", file=sys.stderr)
        print(project_result.stderr.strip(), file=sys.stderr)
        return project_result.returncode or 1

    for name in FIREBASE_VARIABLES:
        value = values[name]

        # Vercel CLI does not provide a portable atomic upsert. Validate every
        # value first, then replace one variable at a time without printing it.
        run_vercel(
            executable,
            ["env", "rm", name, environment, "--yes"],
            project_dir,
        )
        result = run_vercel(
            executable,
            ["env", "add", name, environment],
            project_dir,
            input_text=value,
        )
        if result.returncode != 0:
            print(f"ERROR updating {name}: {result.stderr.strip()}", file=sys.stderr)
            return result.returncode or 1
        print(f"Updated {name} for {environment}.")

    print("Environment sync complete. A new immutable deployment is still required.")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Validate or sync RAH Firebase variables to the linked Vercel project."
    )
    parser.add_argument("--check", action="store_true", help="Validate environment only.")
    parser.add_argument("--preview", action="store_true", help="Show variable presence only.")
    parser.add_argument("--sync", action="store_true", help="Replace variables in Vercel.")
    parser.add_argument(
        "--environment",
        choices=("production", "preview", "development"),
        default="production",
    )
    parser.add_argument("--confirm", default="")
    args = parser.parse_args()

    values = read_values(FIREBASE_VARIABLES)
    print_status(values)
    errors = validate(values)

    if errors:
        for error in errors:
            print(f"ERROR: {error}", file=sys.stderr)
        return 2

    if args.sync:
        return sync(values, args.environment, args.confirm)

    print("Validation passed. No Vercel changes were made.")
    if not args.check and not args.preview:
        parser.print_help()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
