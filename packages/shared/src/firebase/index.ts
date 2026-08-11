/**
 * Cross-platform Firebase access for Right at Home BnB.
 * Configuration is environment-only and locked to the RAH Firebase project.
 */

import { FirebaseApp, FirebaseOptions, getApps, initializeApp } from 'firebase/app';
import { Auth, getAuth } from 'firebase/auth';
import { Firestore, getFirestore } from 'firebase/firestore';
import { FirebaseStorage, getStorage } from 'firebase/storage';
import { Functions, getFunctions } from 'firebase/functions';

const EXPECTED_PROJECT_ID = 'echo-prime-ai';

function first(...values: Array<string | undefined>): string {
  return values.find((value) => value?.trim())?.trim() ?? '';
}

function getPortableFirebaseConfig(): FirebaseOptions {
  const config: FirebaseOptions = {
    apiKey: first(
      process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
      process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
      process.env.VITE_FIREBASE_API_KEY,
      process.env.FIREBASE_API_KEY,
    ),
    authDomain: first(
      process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
      process.env.VITE_FIREBASE_AUTH_DOMAIN,
      process.env.FIREBASE_AUTH_DOMAIN,
    ),
    projectId: first(
      process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
      process.env.VITE_FIREBASE_PROJECT_ID,
      process.env.FIREBASE_PROJECT_ID,
    ),
    storageBucket: first(
      process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
      process.env.VITE_FIREBASE_STORAGE_BUCKET,
      process.env.FIREBASE_STORAGE_BUCKET,
    ),
    messagingSenderId: first(
      process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
      process.env.FIREBASE_MESSAGING_SENDER_ID,
    ),
    appId: first(
      process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
      process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
      process.env.VITE_FIREBASE_APP_ID,
      process.env.FIREBASE_APP_ID,
    ),
  };

  const missing = Object.entries(config)
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missing.length > 0) {
    throw new Error(`RAH Firebase configuration is incomplete: ${missing.join(', ')}`);
  }

  if (config.projectId !== EXPECTED_PROJECT_ID) {
    throw new Error(
      `RAH Firebase project mismatch: expected ${EXPECTED_PROJECT_ID}, received ${config.projectId}.`,
    );
  }

  return config;
}

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;
let storage: FirebaseStorage | null = null;
let functions: Functions | null = null;

export function initializeFirebase(): FirebaseApp {
  if (app) return app;
  const config = getPortableFirebaseConfig();
  const existing = getApps()[0];

  if (existing) {
    if (existing.options.projectId !== config.projectId) {
      throw new Error(
        `Existing Firebase app uses ${existing.options.projectId ?? 'unknown'}; ` +
          `RAH requires ${config.projectId}.`,
      );
    }
    app = existing;
  } else {
    app = initializeApp(config);
  }

  return app;
}

export function getAuthInstance(): Auth {
  if (!auth) auth = getAuth(initializeFirebase());
  return auth;
}

export function getFirestoreInstance(): Firestore {
  if (!db) db = getFirestore(initializeFirebase());
  return db;
}

export function getStorageInstance(): FirebaseStorage {
  if (!storage) storage = getStorage(initializeFirebase());
  return storage;
}

export function getFunctionsInstance(): Functions {
  if (!functions) functions = getFunctions(initializeFirebase(), 'us-central1');
  return functions;
}

export const COLLECTIONS = {
  PROPERTIES: 'rightathome_properties',
  BOOKINGS: 'rightathome_bookings',
  GUESTS: 'rightathome_guests',
  CLEANERS: 'rightathome_cleaners',
  USERS: 'rightathome_users',
  CLEANING_JOBS: 'rightathome_cleaning_jobs',
  CLEANING_REPORTS: 'rightathome_cleaning_reports',
  MESSAGES: 'rightathome_messages',
  CONVERSATIONS: 'rightathome_conversations',
  SMART_LOCKS: 'rightathome_smart_locks',
  THERMOSTATS: 'rightathome_thermostats',
  ACCESS_CODES: 'rightathome_access_codes',
  TRANSACTIONS: 'rightathome_transactions',
  PAYOUTS: 'rightathome_payouts',
  SYNC_EVENTS: 'rightathome_sync_events',
  SYNC_DEVICES: 'rightathome_sync_devices',
  NOTIFICATIONS: 'rightathome_notifications',
  SETTINGS: 'rightathome_settings',
  AUDIT_LOG: 'rightathome_audit_log',
} as const;

export const STORAGE_PATHS = {
  PROPERTY_PHOTOS: 'rightathome/properties',
  CLEANING_PHOTOS: 'rightathome/cleaning',
  USER_AVATARS: 'rightathome/avatars',
  DOCUMENTS: 'rightathome/documents',
  RECEIPTS: 'rightathome/receipts',
} as const;

export { app, auth, db, storage, functions };

export default {
  initializeFirebase,
  getAuthInstance,
  getFirestoreInstance,
  getStorageInstance,
  getFunctionsInstance,
  COLLECTIONS,
  STORAGE_PATHS,
};
