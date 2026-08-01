from __future__ import annotations

from pathlib import Path

ROOT = Path(r"C:\ECHO_OMEGA_PRIME\WEBSITES\right-at-home-bnb\apps\web\app\api")
TARGETS = [
    ROOT / "bookings" / "calendar" / "route.ts",
    ROOT / "integrations" / "paypal" / "callback" / "route.ts",
    ROOT / "integrations" / "paypal" / "transactions" / "route.ts",
    ROOT / "integrations" / "paypal" / "balance" / "route.ts",
    ROOT / "cron" / "guest-messages" / "route.ts",
    ROOT / "cron" / "vrbo-sync" / "route.ts",
]

EXPORTS = "export const dynamic = 'force-dynamic';\nexport const runtime = 'nodejs';\n"

for target in TARGETS:
    text = target.read_text(encoding="utf-8")
    if "export const dynamic = 'force-dynamic';" in text or 'export const dynamic = "force-dynamic";' in text:
        print(f"UNCHANGED={target}")
        continue

    lines = text.splitlines()
    last_import = -1
    for index, line in enumerate(lines):
        if line.startswith("import "):
            last_import = index

    if last_import < 0:
        raise SystemExit(f"No import block found in {target}")

    lines[last_import + 1:last_import + 1] = ["", "export const dynamic = 'force-dynamic';"]
    if not any(line.strip() in {"export const runtime = 'nodejs';", 'export const runtime = "nodejs";'} for line in lines):
        lines.insert(last_import + 3, "export const runtime = 'nodejs';")

    target.write_text("\n".join(lines) + "\n", encoding="utf-8", newline="\n")
    print(f"PATCHED={target}")
