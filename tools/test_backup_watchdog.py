#!/usr/bin/env python3
"""Unit tests for the RAH backup failure and silence watchdog."""

from __future__ import annotations

import json
import os
import subprocess
import tempfile
import unittest
from pathlib import Path
from unittest import mock

import backup_watchdog as watchdog


class BackupWatchdogTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temporary = tempfile.TemporaryDirectory()
        self.root = Path(self.temporary.name)
        self.state = self.root / "state.json"
        self.messages: list[str] = []

    def tearDown(self) -> None:
        self.temporary.cleanup()

    def notify(self, message: str) -> bool:
        self.messages.append(message)
        return True

    @staticmethod
    def successful_failure_probe(*args, **kwargs):
        del args, kwargs
        return subprocess.CompletedProcess(
            args=[],
            returncode=0,
            stdout=(
                "Result=exit-code\n"
                "ExecMainCode=1\n"
                "ExecMainStatus=3\n"
                "ActiveState=failed\n"
                "InactiveExitTimestamp=Tue 2026-08-04 09:00:00 UTC\n"
                "InvocationID=abc123\n"
            ),
            stderr="",
        )

    def make_dump(self, age_hours: float, now: float = 2_000_000_000) -> Path:
        path = self.root / "rah-verified.dump"
        path.write_bytes(b"x" * 10_241)
        mtime = now - age_hours * 3600
        os.utime(path, (mtime, mtime))
        return path

    def test_parse_properties(self) -> None:
        self.assertEqual(
            watchdog.parse_properties("Result=exit-code\nExecMainStatus=3\n"),
            {"Result": "exit-code", "ExecMainStatus": "3"},
        )

    def test_load_sovereign_key_parses_only_named_entry(self) -> None:
        path = self.root / "key.env"
        path.write_text("OTHER=nope\nSOVEREIGN_KEY='test-key'\n", encoding="utf-8")
        self.assertEqual(watchdog.load_sovereign_key(path), "test-key")

    def test_sdk_telegram_sender_requires_gate_success(self) -> None:
        class Response:
            status = 200

            def __enter__(self):
                return self

            def __exit__(self, *_args):
                return False

            @staticmethod
            def read(_limit):
                return json.dumps(
                    {"status": "ok", "result": {"status_code": 200}}
                ).encode("utf-8")

        seen = {}

        def opener(request, timeout):
            seen["timeout"] = timeout
            seen["payload"] = json.loads(request.data.decode("utf-8"))
            return Response()

        self.assertTrue(
            watchdog.send_via_sdk(
                "test",
                chat_id="12345",
                key_loader=lambda: "opaque-key",
                opener=opener,
            )
        )
        self.assertEqual(seen["timeout"], 30)
        self.assertEqual(
            seen["payload"]["capability"], "echo.social.telegram_post"
        )
        self.assertEqual(seen["payload"]["params"]["chat_id"], "12345")

    def test_telegram_falls_back_when_sdk_fails(self) -> None:
        with mock.patch.object(watchdog, "DRY_RUN", False), mock.patch.object(
            watchdog, "send_via_sdk", return_value=False
        ), mock.patch.object(watchdog.os.path, "isfile", return_value=True):
            runner = mock.Mock(
                return_value=subprocess.CompletedProcess([], 0, "", "")
            )
            self.assertTrue(watchdog.send_telegram("test", runner=runner))
            runner.assert_called_once()

    def test_failure_uses_real_exit_status_and_deduplicates(self) -> None:
        first = watchdog.report_failure(
            watchdog.SERVICE,
            state_path=self.state,
            runner=self.successful_failure_probe,
            notifier=self.notify,
            now=2_000_000_000,
        )
        second = watchdog.report_failure(
            watchdog.SERVICE,
            state_path=self.state,
            runner=self.successful_failure_probe,
            notifier=self.notify,
            now=2_000_000_060,
        )
        self.assertEqual((first, second), (0, 0))
        self.assertEqual(len(self.messages), 1)
        self.assertIn("ROW COUNT MISMATCH", self.messages[0])
        self.assertIn("exit=3", self.messages[0])

    def test_failure_labels_all_contract_exit_codes(self) -> None:
        expected = {
            1: "DUMP FAILED",
            2: "RESTORE FAILED",
            3: "CRITICAL DATA INTEGRITY ALERT - ROW COUNT MISMATCH",
        }
        for exit_code, label in expected.items():
            with self.subTest(exit_code=exit_code):
                messages: list[str] = []

                def runner(*_args, **_kwargs):
                    return subprocess.CompletedProcess(
                        [],
                        0,
                        (
                            "Result=exit-code\n"
                            f"ExecMainStatus={exit_code}\n"
                            f"InvocationID=invocation-{exit_code}\n"
                        ),
                        "",
                    )

                result = watchdog.report_failure(
                    watchdog.SERVICE,
                    state_path=self.root / f"state-{exit_code}.json",
                    runner=runner,
                    notifier=lambda message: messages.append(message) is None,
                    now=2_000_000_000,
                )
                self.assertEqual(result, 0)
                self.assertIn(label, messages[0])

    def test_failure_rejects_unexpected_unit(self) -> None:
        result = watchdog.report_failure(
            "unrelated.service",
            state_path=self.state,
            notifier=self.notify,
            now=2_000_000_000,
        )
        self.assertEqual(result, 1)
        self.assertEqual(self.messages, [])

    def test_failed_delivery_is_visible_and_not_recorded(self) -> None:
        result = watchdog.report_failure(
            watchdog.SERVICE,
            state_path=self.state,
            runner=self.successful_failure_probe,
            notifier=lambda _message: False,
            now=2_000_000_000,
        )
        self.assertEqual(result, 1)
        self.assertFalse(self.state.exists())

    def test_fresh_dump_and_healthy_timer_are_quiet(self) -> None:
        now = 2_000_000_000
        self.make_dump(2, now)
        result = watchdog.check_silence(
            pattern=str(self.root / "*.dump"),
            state_path=self.state,
            timer_probe=lambda: (True, "active and enabled"),
            service_probe=lambda: (True, "success exit 0"),
            notifier=self.notify,
            now=now,
        )
        self.assertEqual(result, 0)
        self.assertEqual(self.messages, [])
        state = json.loads(self.state.read_text(encoding="utf-8"))
        self.assertFalse(state["silence"]["active"])

    def test_stale_dump_alerts(self) -> None:
        now = 2_000_000_000
        stale = self.make_dump(37, now)
        result = watchdog.check_silence(
            pattern=str(stale),
            state_path=self.state,
            timer_probe=lambda: (True, "active and enabled"),
            service_probe=lambda: (True, "success exit 0"),
            notifier=self.notify,
            now=now,
        )
        self.assertEqual(result, 0)
        self.assertIn("SILENCE ALERT", self.messages[0])
        self.assertIn("37.0h old", self.messages[0])

    def test_missing_dump_alerts(self) -> None:
        result = watchdog.check_silence(
            pattern=str(self.root / "*.dump"),
            state_path=self.state,
            timer_probe=lambda: (True, "active and enabled"),
            service_probe=lambda: (True, "success exit 0"),
            notifier=self.notify,
            now=2_000_000_000,
        )
        self.assertEqual(result, 0)
        self.assertIn("no valid dump exists", self.messages[0])

    def test_disabled_timer_alerts_even_with_fresh_dump(self) -> None:
        now = 2_000_000_000
        self.make_dump(1, now)
        result = watchdog.check_silence(
            pattern=str(self.root / "*.dump"),
            state_path=self.state,
            timer_probe=lambda: (False, "inactive and disabled"),
            service_probe=lambda: (True, "success exit 0"),
            notifier=self.notify,
            now=now,
        )
        self.assertEqual(result, 0)
        self.assertIn("timer healthy=False", self.messages[0])

    def test_failed_service_alerts_even_with_fresh_dump(self) -> None:
        now = 2_000_000_000
        self.make_dump(1, now)
        result = watchdog.check_silence(
            pattern=str(self.root / "*.dump"),
            state_path=self.state,
            timer_probe=lambda: (True, "active and enabled"),
            service_probe=lambda: (False, "result=exit-code exit=2"),
            notifier=self.notify,
            now=now,
        )
        self.assertEqual(result, 0)
        self.assertIn("last verifier healthy=False", self.messages[0])
        self.assertIn("exit=2", self.messages[0])

    def test_recovery_alert_follows_a_silence_alert(self) -> None:
        now = 2_000_000_000
        watchdog.check_silence(
            pattern=str(self.root / "*.dump"),
            state_path=self.state,
            timer_probe=lambda: (True, "active and enabled"),
            service_probe=lambda: (True, "success exit 0"),
            notifier=self.notify,
            now=now,
        )
        self.make_dump(1, now + 60)
        result = watchdog.check_silence(
            pattern=str(self.root / "*.dump"),
            state_path=self.state,
            timer_probe=lambda: (True, "active and enabled"),
            service_probe=lambda: (True, "success exit 0"),
            notifier=self.notify,
            now=now + 60,
        )
        self.assertEqual(result, 0)
        self.assertEqual(len(self.messages), 2)
        self.assertIn("RECOVERED", self.messages[1])


if __name__ == "__main__":
    unittest.main(verbosity=2)
