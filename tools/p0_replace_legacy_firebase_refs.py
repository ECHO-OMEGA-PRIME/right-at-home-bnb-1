from __future__ import annotations

from pathlib import Path

ROOT = Path(r"C:\ECHO_OMEGA_PRIME\WEBSITES\right-at-home-bnb")
TARGETS = [
    ROOT / "packages" / "cloud-sync" / "README.md",
    ROOT / "packages" / "testing" / "integration" / "sync.test.ts",
    ROOT / "packages" / "testing" / "src" / "index.ts",
    ROOT / "packages" / "testing" / "utils" / "mocks.ts",
    ROOT / "packages" / "testing" / "validation" / "validate-sync.ts",
    ROOT / "tools" / "vrbo_image_scraper.py",
]

replacements = {
    "echo-prime-ai": "rightathome-prod",
}

changed = []
for target in TARGETS:
    if not target.is_file():
        raise SystemExit(f"Missing expected target: {target}")

    original = target.read_text(encoding="utf-8")
    updated = original
    for old, new in replacements.items():
        updated = updated.replace(old, new)

    if updated != original:
        target.write_text(updated, encoding="utf-8", newline="\n")
        changed.append(str(target))

print(f"CHANGED_COUNT={len(changed)}")
for item in changed:
    print(f"CHANGED={item}")
