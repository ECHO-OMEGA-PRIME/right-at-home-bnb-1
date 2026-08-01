from pathlib import Path

path = Path(r"C:\ECHO_OMEGA_PRIME\WEBSITES\right-at-home-bnb\apps\mobile\src\services\notifications.ts")
text = path.read_text(encoding="utf-8")
old = """  try {
    const response = await fetch('https://api.rightathome.bnb/notifications/register', {
      method: 'POST',"""
new = """  try {
    const apiBase = process.env.EXPO_PUBLIC_API_URL?.replace(/\\/+$/, '');
    if (!apiBase) {
      throw new Error('EXPO_PUBLIC_API_URL is not configured');
    }

    const response = await fetch(`${apiBase}/notifications/register`, {
      method: 'POST',"""
if old not in text:
    raise SystemExit("Notification registration endpoint block not found")
path.write_text(text.replace(old, new, 1), encoding="utf-8", newline="\n")
print(f"PATCHED={path}")
