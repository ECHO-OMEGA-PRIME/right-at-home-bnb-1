from pathlib import Path

path = Path(r"C:\ECHO_OMEGA_PRIME\WEBSITES\right-at-home-bnb\apps\desktop\src\renderer\services\audit.ts")
text = path.read_text(encoding="utf-8")
old = """  const operation = action.split('.').at(-1);
  if (operation === 'create') return 'create';
  if (operation === 'read' || operation === 'view') return 'read';
  if (operation === 'update') return 'update';
  if (operation === 'delete') return 'delete';
  if (
    action === 'logout' ||
"""
new = """  const operation = action.split('.').at(-1);
  if (
    action.startsWith('backup.') ||
    action.startsWith('import.') ||
    action.startsWith('export.') ||
    action.startsWith('system.')
  ) {
    return 'system';
  }
  if (operation === 'create') return 'create';
  if (operation === 'read' || operation === 'view') return 'read';
  if (operation === 'update') return 'update';
  if (operation === 'delete') return 'delete';
  if (
    action === 'logout' ||
"""
if old not in text:
    raise SystemExit("Audit category block was not found")
text = text.replace(old, new, 1)
redundant = """  if (
    action.startsWith('backup.') ||
    action.startsWith('import.') ||
    action.startsWith('export.') ||
    action.startsWith('system.')
  ) {
    return 'system';
  }
  return 'other';
"""
text = text.replace(redundant, "  return 'other';\n", 1)
path.write_text(text, encoding="utf-8", newline="\n")
print(f"PATCHED={path}")
