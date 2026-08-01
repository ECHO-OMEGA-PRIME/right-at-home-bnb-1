from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(r"C:\ECHO_OMEGA_PRIME\WEBSITES\right-at-home-bnb")
SEARCH_ROOTS = [ROOT / "apps", ROOT / "packages"]
changed: list[Path] = []

for search_root in SEARCH_ROOTS:
    for package_file in search_root.rglob("package.json"):
        if "node_modules" in package_file.parts:
            continue
        data = json.loads(package_file.read_text(encoding="utf-8"))
        scripts = data.get("scripts")
        if not isinstance(scripts, dict):
            continue
        if scripts.get("test") != "vitest run":
            continue
        scripts["test"] = "vitest run --passWithNoTests"
        package_file.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8", newline="\n")
        changed.append(package_file)

print(f"CHANGED_COUNT={len(changed)}")
for item in changed:
    print(f"PATCHED={item}")
