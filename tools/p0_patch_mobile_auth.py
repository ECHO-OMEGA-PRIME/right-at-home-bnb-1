from __future__ import annotations

from pathlib import Path

TARGET = Path(r"C:\ECHO_OMEGA_PRIME\WEBSITES\right-at-home-bnb\apps\mobile\src\services\auth.ts")

text = TARGET.read_text(encoding="utf-8")

import_anchor = "import * as Crypto from 'expo-crypto';\n"
import_replacement = (
    "import * as Crypto from 'expo-crypto';\n"
    "import { getMobileFirebaseConfig } from './firebase-config';\n"
)
if import_anchor not in text:
    raise SystemExit("Mobile auth import anchor not found")
text = text.replace(import_anchor, import_replacement, 1)

old_config = '''// Firebase configuration
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || '',
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || 'echo-prime-ai.firebaseapp.com',
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || 'echo-prime-ai',
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || 'echo-prime-ai.appspot.com',
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '249995513427',
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || '',
};

// Initialize Firebase
let app: FirebaseApp;
let auth: Auth;

function initFirebase() {
  if (getApps().length === 0) {
    app = initializeApp(firebaseConfig);
  } else {
    app = getApps()[0];
  }
  auth = getAuth(app);
  return { app, auth };
}
'''

new_config = '''// Initialize Firebase with strict RAH project validation.
let app: FirebaseApp;
let auth: Auth;

function initFirebase() {
  const firebaseConfig = getMobileFirebaseConfig();
  const existing = getApps()[0];

  if (existing) {
    if (existing.options.projectId !== firebaseConfig.projectId) {
      throw new Error(
        `Existing mobile Firebase app uses ${existing.options.projectId ?? 'unknown'}, ` +
          `but RAH requires ${firebaseConfig.projectId}.`,
      );
    }
    app = existing;
  } else {
    app = initializeApp(firebaseConfig);
  }

  auth = getAuth(app);
  return { app, auth };
}
'''

if old_config not in text:
    raise SystemExit("Mobile Firebase configuration block not found")
text = text.replace(old_config, new_config, 1)

old_fetch = "    const response = await fetch('https://api.rightathome.bnb/users/push-token', {\n"
new_fetch = '''    const apiBase = process.env.EXPO_PUBLIC_API_URL?.replace(/\\/+$/, '');
    if (!apiBase) {
      throw new Error('EXPO_PUBLIC_API_URL is not configured');
    }

    const response = await fetch(`${apiBase}/users/push-token`, {
'''
if old_fetch not in text:
    raise SystemExit("Mobile push-token endpoint block not found")
text = text.replace(old_fetch, new_fetch, 1)

TARGET.write_text(text, encoding="utf-8", newline="\n")
print(f"PATCHED={TARGET}")
