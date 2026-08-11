#!/usr/bin/env python3
"""Materialize libpq connection metadata and a private passfile.

The source credential is a systemd ``LoadCredential=`` file containing the
production URL and local verifier password. Passwords are written only to a
0600 pgpass file; they are never emitted to stdout, argv, or the generated
shell environment.
"""

from __future__ import annotations

import argparse
import os
import shlex
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlsplit


ALLOWED_KEYS = {
    "DIRECT_URL",
    "RAH_VERIFY_HOST",
    "RAH_VERIFY_PORT",
    "RAH_VERIFY_USER",
    "RAH_VERIFY_PASSWORD",
    "RAH_VERIFY_DATABASE",
}


def read_config(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        name, separator, raw_value = line.partition("=")
        name = name.strip()
        if not separator or name not in ALLOWED_KEYS:
            raise ValueError(f"unsupported credential entry: {name or '<invalid>'}")
        parsed = shlex.split(raw_value.strip(), comments=False, posix=True)
        if len(parsed) != 1:
            raise ValueError(f"credential entry {name} must contain one value")
        values[name] = parsed[0]
    required = {"DIRECT_URL", "RAH_VERIFY_PASSWORD"}
    missing = sorted(required - values.keys())
    if missing:
        raise ValueError(f"missing credential entries: {', '.join(missing)}")
    return values


def parse_database_url(url: str) -> dict[str, str]:
    parsed = urlsplit(url)
    if parsed.scheme not in {"postgres", "postgresql"}:
        raise ValueError("DIRECT_URL must use postgres or postgresql")
    if not parsed.hostname or parsed.username is None or parsed.password is None:
        raise ValueError("DIRECT_URL must include host, username, and password")
    database = unquote(parsed.path.lstrip("/"))
    if not database or "/" in database:
        raise ValueError("DIRECT_URL must identify exactly one database")
    query = parse_qs(parsed.query, keep_blank_values=True)
    sslmode = (query.get("sslmode") or ["prefer"])[0]
    if sslmode not in {"disable", "allow", "prefer", "require", "verify-ca", "verify-full"}:
        raise ValueError("DIRECT_URL contains an unsupported sslmode")
    result = {
        "host": parsed.hostname,
        "port": str(parsed.port or 5432),
        "database": database,
        "user": unquote(parsed.username),
        "password": unquote(parsed.password),
        "sslmode": sslmode,
    }
    for field, value in result.items():
        if not value or "\n" in value or "\r" in value:
            raise ValueError(f"DIRECT_URL contains an invalid {field}")
    return result


def pgpass_escape(value: str) -> str:
    return value.replace("\\", "\\\\").replace(":", "\\:")


def write_exclusive(path: Path, content: str) -> None:
    flags = os.O_WRONLY | os.O_CREAT | os.O_EXCL
    if hasattr(os, "O_NOFOLLOW"):
        flags |= os.O_NOFOLLOW
    descriptor = os.open(path, flags, 0o600)
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8") as handle:
            handle.write(content)
            handle.flush()
            os.fsync(handle.fileno())
    except Exception:
        path.unlink(missing_ok=True)
        raise


def materialize(credential_path: Path, output_dir: Path) -> tuple[Path, Path]:
    config = read_config(credential_path)
    production = parse_database_url(config["DIRECT_URL"])
    local = {
        "host": config.get("RAH_VERIFY_HOST", "localhost"),
        "port": config.get("RAH_VERIFY_PORT", "5433"),
        "database": config.get("RAH_VERIFY_DATABASE", "postgres"),
        "user": config.get("RAH_VERIFY_USER", "echo"),
        "password": config["RAH_VERIFY_PASSWORD"],
    }
    for field in ("host", "port", "database", "user", "password"):
        if not local[field] or "\n" in local[field] or "\r" in local[field]:
            raise ValueError(f"invalid local verifier field: {field}")
    if not local["port"].isdigit() or not 1 <= int(local["port"]) <= 65535:
        raise ValueError("invalid local verifier field: port")

    resolved_output = output_dir.resolve()
    if not resolved_output.is_dir() or resolved_output.is_symlink():
        raise ValueError("output directory must be an existing real directory")
    passfile = resolved_output / "pgpass"
    envfile = resolved_output / "client.env"
    pgpass = (
        ":".join(
            pgpass_escape(production[name])
            for name in ("host", "port", "database", "user", "password")
        )
        + "\n"
        + ":".join(
            pgpass_escape(local[name])
            for name in ("host", "port")
        )
        + ":*:"
        + pgpass_escape(local["user"])
        + ":"
        + pgpass_escape(local["password"])
        + "\n"
    )
    write_exclusive(passfile, pgpass)
    environment = {
        "RAH_PROD_PGHOST": production["host"],
        "RAH_PROD_PGPORT": production["port"],
        "RAH_PROD_PGDATABASE": production["database"],
        "RAH_PROD_PGUSER": production["user"],
        "RAH_PROD_PGSSLMODE": production["sslmode"],
        "RAH_LOCAL_PGHOST": local["host"],
        "RAH_LOCAL_PGPORT": local["port"],
        "RAH_LOCAL_PGUSER": local["user"],
        "RAH_LOCAL_PGDATABASE": local["database"],
        "PGPASSFILE": str(passfile),
    }
    env_text = "".join(
        f"export {name}={shlex.quote(value)}\n"
        for name, value in environment.items()
    )
    try:
        write_exclusive(envfile, env_text)
    except Exception:
        passfile.unlink(missing_ok=True)
        raise
    return envfile, passfile


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("credential_file", type=Path)
    parser.add_argument("output_dir", type=Path)
    args = parser.parse_args()
    materialize(args.credential_file, args.output_dir)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
