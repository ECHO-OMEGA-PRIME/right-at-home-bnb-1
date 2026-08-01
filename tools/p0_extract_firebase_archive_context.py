from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(r"C:\ECHO_OMEGA_PRIME\WEBSITES\right-at-home-bnb")
DISCOVERY = ROOT / "docs" / "consolidation" / "P0_FIREBASE_CONFIG_DISCOVERY.json"
OUTPUT = ROOT / "docs" / "consolidation" / "P0_FIREBASE_ARCHIVE_CONTEXT_REDACTED.json"

API_KEY_RE = re.compile(r"AIza[0-9A-Za-z_-]{20,}")
SENSITIVE_ASSIGN_RE = re.compile(
    r"(?i)(private_key|auth_token|password|secret)\s*[:=]\s*([\"']).*?\2"
)


def redact(line: str) -> str:
    line = API_KEY_RE.sub("<REDACTED_FIREBASE_API_KEY>", line)
    return SENSITIVE_ASSIGN_RE.sub(lambda match: f"{match.group(1)}=<REDACTED>", line)


def main() -> int:
    discovery = json.loads(DISCOVERY.read_text(encoding="utf-8-sig"))
    paths = sorted(
        {
            item["path"]
            for item in discovery.get("candidates", [])
            if "CHAT_ARCHIVE" in item.get("path", "")
            or "scratchpad\\swarm_review" in item.get("path", "")
        }
    )

    contexts: list[dict[str, object]] = []
    for raw_path in paths:
        path = Path(raw_path)
        if not path.is_file():
            continue
        try:
            lines = path.read_text(encoding="utf-8", errors="replace").splitlines()
        except OSError:
            continue

        for index, line in enumerate(lines):
            if "rightathome-prod" not in line.lower():
                continue
            start = max(0, index - 12)
            end = min(len(lines), index + 21)
            contexts.append(
                {
                    "path": str(path),
                    "match_line": index + 1,
                    "context": [
                        f"{line_number + 1}: {redact(lines[line_number])}"
                        for line_number in range(start, end)
                    ],
                }
            )

    result = {
        "checked_utc": datetime.now(timezone.utc).isoformat(),
        "source_count": len(paths),
        "context_count": len(contexts),
        "contexts": contexts,
    }
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(result, indent=2), encoding="utf-8")
    print(json.dumps({"output": str(OUTPUT), "source_count": len(paths), "context_count": len(contexts)}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
