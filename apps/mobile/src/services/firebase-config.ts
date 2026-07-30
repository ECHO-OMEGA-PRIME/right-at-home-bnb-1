import type { FirebaseOptions } from 'firebase/app';

export const RAH_FIREBASE_PROJECT_ID = 'rightathome-prod';

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
