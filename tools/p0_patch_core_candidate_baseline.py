from __future__ import annotations

from pathlib import Path
import shutil

SOURCE = Path(r"C:\ECHO_OMEGA_PRIME\WEBSITES\right-at-home-bnb")
CANDIDATE = Path(r"C:\ECHO_OMEGA_PRIME\WORKTREES\rah-p0-core-20260723")


def replace_once(path: Path, old: str, new: str, label: str) -> None:
    text = path.read_text(encoding="utf-8")
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected exactly one match in {path}, found {count}")
    path.write_text(text.replace(old, new, 1), encoding="utf-8", newline="\n")
    print(f"PATCHED {label}: {path}")


def copy_file(relative: str) -> None:
    src = SOURCE / relative
    dst = CANDIDATE / relative
    if not src.is_file():
        raise FileNotFoundError(src)
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, dst)
    print(f"COPIED {relative}")


# 1. New modules required by the P0 route guard and VRBO secure delivery.
copy_file("apps/web/src/lib/page-auth.ts")
copy_file("apps/web/src/lib/secure-notifications.ts")

# 2. Automated message content is a string with a separate optional subject.
messages = CANDIDATE / "apps/web/app/api/messages/automated/route.ts"
replace_once(
    messages,
    "        subject: msg.content?.subject || `${msg.type} message`,\n        body: msg.content?.body || msg.content?.smsBody || '',",
    "        subject: msg.subject || `${msg.type} message`,\n        body: msg.content,",
    "automated message shape",
)

# 3. SyncResult requires a duration field from initialization onward.
vrbo = CANDIDATE / "apps/web/src/lib/integrations/vrbo-sync-service.ts"
replace_once(
    vrbo,
    "  const result: SyncResult = { propertyId, vrboId: vrboListingId, imported: 0, updated: 0, skipped: 0, errors: [] };",
    "  const result: SyncResult = { propertyId, vrboId: vrboListingId, imported: 0, updated: 0, skipped: 0, errors: [], durationMs: 0 };",
    "VRBO duration initialization",
)

# 4. Preserve Record<string, string> across the optional OwnerRez query branch.
ownerrez = CANDIDATE / "apps/web/src/lib/ownerrez-client.ts"
replace_once(
    ownerrez,
    "    const params = bookingId ? { booking_id: bookingId.toString() } : {};",
    "    const params: Record<string, string> = bookingId ? { booking_id: bookingId.toString() } : {};",
    "OwnerRez query parameter type",
)

# 5. Python 3 rejects decimal literals with leading zeroes.
seed = CANDIDATE / "backend/database/seed.py"
replace_once(
    seed,
    "random.randint(01, 07)",
    "random.randint(1, 7)",
    "backend seed ZIP range",
)

# 6. Relocate the Calendar Settings panel from BookingModal into BookingsPage.
source_bookings = (SOURCE / "apps/web/app/bookings/page.tsx").read_text(encoding="utf-8").splitlines(keepends=True)
candidate_path = CANDIDATE / "apps/web/app/bookings/page.tsx"
candidate_lines = candidate_path.read_text(encoding="utf-8").splitlines(keepends=True)

source_main = next(i for i, line in enumerate(source_bookings) if "export default function BookingsPage" in line)
source_panel_start = next(i for i in range(source_main, len(source_bookings)) if "{/* Settings Panel */}" in source_bookings[i])
source_panel_end = next(i for i in range(source_panel_start + 1, len(source_bookings)) if "{/* Stats */}" in source_bookings[i])
panel = source_bookings[source_panel_start:source_panel_end]

candidate_main = next(i for i, line in enumerate(candidate_lines) if "export default function BookingsPage" in line)
misplaced_start = next(i for i in range(0, candidate_main) if "{/* Settings Panel */}" in candidate_lines[i])
misplaced_end = next(i for i in range(misplaced_start + 1, candidate_main) if "{/* Stats */}" in candidate_lines[i])
del candidate_lines[misplaced_start:misplaced_end]

candidate_main = next(i for i, line in enumerate(candidate_lines) if "export default function BookingsPage" in line)
insert_at = next(
    i + 1
    for i in range(candidate_main, len(candidate_lines))
    if candidate_lines[i].strip() == '<div className="p-6">'
)
candidate_lines[insert_at:insert_at] = panel
candidate_path.write_text("".join(candidate_lines), encoding="utf-8", newline="\n")
print(f"PATCHED Calendar Settings relocation: {candidate_path}")

print("P0 CORE BASELINE PATCH COMPLETE")
