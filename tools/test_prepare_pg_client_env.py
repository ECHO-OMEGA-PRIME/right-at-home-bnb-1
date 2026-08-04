#!/usr/bin/env python3
"""Tests for private libpq credential materialization."""

from __future__ import annotations

import os
import tempfile
import unittest
from pathlib import Path

from prepare_pg_client_env import materialize, parse_database_url, pgpass_escape


class PreparePgClientEnvTests(unittest.TestCase):
    def test_materialize_keeps_passwords_out_of_shell_environment(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            credential = root / "credential"
            output = root / "runtime"
            output.mkdir(mode=0o700)
            credential.write_text(
                'DIRECT_URL="postgresql://prod%40user:p%3Aa%5Css@db.example:6543/rah?sslmode=require"\n'
                'RAH_VERIFY_PASSWORD="local:secret"\n',
                encoding="utf-8",
            )
            envfile, passfile = materialize(credential, output)
            env_text = envfile.read_text(encoding="utf-8")
            pass_text = passfile.read_text(encoding="utf-8")
            self.assertNotIn("p:a", env_text)
            self.assertNotIn("local:secret", env_text)
            self.assertIn("prod@user", env_text)
            self.assertIn(r"p\:a\\ss", pass_text)
            self.assertIn(r"local\:secret", pass_text)
            if os.name == "posix":
                self.assertEqual(os.stat(envfile).st_mode & 0o777, 0o600)
                self.assertEqual(os.stat(passfile).st_mode & 0o777, 0o600)

    def test_parse_rejects_non_postgres_or_missing_password(self) -> None:
        for value in (
            "https://example.com/db",
            "postgresql://user@example.com/db",
            "postgresql://user:bad%0Aline@example.com/db",
        ):
            with self.subTest(value=value), self.assertRaises(ValueError):
                parse_database_url(value)

    def test_pgpass_escaping(self) -> None:
        self.assertEqual(pgpass_escape(r"a:b\c"), r"a\:b\\c")


if __name__ == "__main__":
    unittest.main(verbosity=2)
