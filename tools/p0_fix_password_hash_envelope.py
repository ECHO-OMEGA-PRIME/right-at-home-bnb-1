from pathlib import Path

path = Path(r"C:\ECHO_OMEGA_PRIME\WEBSITES\right-at-home-bnb\apps\desktop\src\renderer\services\encryption.ts")
text = path.read_text(encoding="utf-8")
old = """export async function hashPassword(password: string): Promise<string> {
  const salt = generateSalt();
  const derived = await deriveKey(password, salt);
  return `pbkdf2-sha256$${PASSWORD_KDF_ITERATIONS}$${derived}`;
}
"""
new = """export async function hashPassword(password: string): Promise<string> {
  const salt = generateSalt();
  const derived = await deriveKey(password, salt);
  const digest = derived.slice(derived.indexOf('.') + 1);
  return `pbkdf2-sha256$${PASSWORD_KDF_ITERATIONS}$${salt}$${digest}`;
}
"""
if old not in text:
    raise SystemExit("Password hash function was not found")
path.write_text(text.replace(old, new, 1), encoding="utf-8", newline="\n")
print(f"PATCHED={path}")
