from pathlib import Path

ROOT = Path(r"C:\ECHO_OMEGA_PRIME\WEBSITES\right-at-home-bnb\packages\testing")

formatting = ROOT / "unit" / "formatting.test.ts"
text = formatting.read_text(encoding="utf-8")
text = text.replace(
    "const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' };",
    "const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' };",
    1,
)
old_relative = """function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays === -1) return 'Yesterday';
  if (diffDays > 0) return `In ${diffDays} days`;
  return `${Math.abs(diffDays)} days ago`;
}
"""
new_relative = """function formatRelativeTime(date: Date): string {
  const now = new Date();
  const dayNumber = (value: Date): number =>
    Date.UTC(value.getFullYear(), value.getMonth(), value.getDate()) /
    (1000 * 60 * 60 * 24);
  const diffDays = dayNumber(date) - dayNumber(now);

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays === -1) return 'Yesterday';
  if (diffDays > 0) return `In ${diffDays} days`;
  return `${Math.abs(diffDays)} days ago`;
}
"""
if old_relative not in text:
    raise SystemExit("Relative-time helper block not found")
formatting.write_text(text.replace(old_relative, new_relative, 1), encoding="utf-8", newline="\n")

fixtures = ROOT / "utils" / "fixtures.ts"
text = fixtures.read_text(encoding="utf-8")
factory_anchor = "// ============================================\n// FACTORY FUNCTIONS\n// ============================================\n"
factory_header = """// ============================================
// FACTORY FUNCTIONS
// ============================================

let fixtureIdSequence = 0;

function nextFixtureId(prefix: string): string {
  fixtureIdSequence += 1;
  return `${prefix}_${Date.now()}_${fixtureIdSequence.toString(36)}`;
}
"""
if factory_anchor not in text:
    raise SystemExit("Fixture factory anchor not found")
text = text.replace(factory_anchor, factory_header, 1)
text = text.replace("id: `prop_test_${Date.now()}`,", "id: nextFixtureId('prop_test'),", 1)
text = text.replace("id: `book_test_${Date.now()}`,", "id: nextFixtureId('book_test'),", 1)
text = text.replace("id: `guest_test_${Date.now()}`,", "id: nextFixtureId('guest_test'),", 1)
text = text.replace("email: `test${Date.now()}@example.com`,", "email: `${nextFixtureId('test')}@example.com`,", 1)
text = text.replace("id: `clean_test_${Date.now()}`,", "id: nextFixtureId('clean_test'),", 1)
fixtures.write_text(text, encoding="utf-8", newline="\n")

print(f"PATCHED={formatting}")
print(f"PATCHED={fixtures}")
