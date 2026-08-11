import type { FirebaseOptions } from 'firebase/app';

// RAH Midland's real, controlled Firebase project is echo-prime-ai. The web
// app carried the same retired project value (a project we have no admin
// access to -- see apps/web/src/lib/firebase-client-config.ts and the
// P0 diagnosis in docs/consolidation/P0_PRODUCTION_FIREBASE_DIAGNOSIS_*.md)
// until it was corrected in commit c442be3. Mobile still had it: fixed here
// to match, per ECHO doctrine "ALL sites use ONE project echo-prime-ai".
export const RAH_FIREBASE_PROJECT_ID = 'echo-prime-ai';

const config = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY?.trim() ?? '',
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN?.trim() ?? '',
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID?.trim() ?? '',
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET?.trim() ?? '',
  messagingSenderId:
    process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID?.trim() ?? '',
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID?.trim() ?? '',
} as const;

export function getMobileFirebaseConfig(): FirebaseOptions {
  const missing = Object.entries(config)
    .filter(([, value]) => !value)
    .map(([name]) => name);

  if (missing.length > 0) {
    throw new Error(
      `Mobile Firebase configuration is incomplete. Missing: ${missing.join(', ')}`,
    );
  }

  if (config.projectId !== RAH_FIREBASE_PROJECT_ID) {
    throw new Error(
      `Mobile Firebase project mismatch. Expected ${RAH_FIREBASE_PROJECT_ID}, received ${config.projectId}.`,
    );
  }

  return { ...config };
}
