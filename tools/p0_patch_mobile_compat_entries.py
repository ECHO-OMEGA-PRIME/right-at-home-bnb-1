from pathlib import Path

root = Path(r"C:\ECHO_OMEGA_PRIME\WEBSITES\right-at-home-bnb\apps\mobile")

# AuthSession result type is exported from the package root, not the Google provider namespace.
auth = root / "src" / "services" / "auth.ts"
text = auth.read_text(encoding="utf-8")
text = text.replace(
    "import * as Google from 'expo-auth-session/providers/google';",
    "import * as Google from 'expo-auth-session/providers/google';\nimport type { AuthSessionResult } from 'expo-auth-session';",
    1,
)
text = text.replace("response: Google.AuthSessionResult | null,", "response: AuthSessionResult | null,", 1)
text = text.replace(
    "promptAsync: () => Promise<Google.AuthSessionResult>",
    "promptAsync: () => Promise<AuthSessionResult>",
    1,
)
auth.write_text(text, encoding="utf-8", newline="\n")

# Expo 50 keeps the modern async SQLite API under the next entry point.
database = root / "src" / "services" / "database.ts"
text = database.read_text(encoding="utf-8")
old = "import * as SQLite from 'expo-sqlite';"
new = "import * as SQLite from 'expo-sqlite/next';"
if old not in text:
    raise SystemExit("SQLite import anchor not found")
database.write_text(text.replace(old, new, 1), encoding="utf-8", newline="\n")

print(f"PATCHED={auth}")
print(f"PATCHED={database}")
