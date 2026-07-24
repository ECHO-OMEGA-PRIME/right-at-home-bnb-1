/**
 * Firebase configuration for Right at Home BnB CloudSync.
 * Configuration is environment-only and restricted to rightathome-prod.
 */

import { FirebaseApp, FirebaseOptions, getApp, getApps, initializeApp } from 'firebase/app';
import {
  CACHE_SIZE_UNLIMITED,
  Firestore,
  connectFirestoreEmulator,
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore';

const EXPECTED_PROJECT_ID = 'rightathome-prod';

function value(...candidates: Array<string | undefined>): string {
  return candidates.find((candidate) => candidate?.trim())?.trim() ?? '';
}

function resolveFirebaseConfig(): FirebaseOptions {
  const config: FirebaseOptions = {
    apiKey: value(process.env.NEXT_PUBLIC_FIREBASE_API_KEY, process.env.FIREBASE_API_KEY),
    authDomain: value(
      process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      process.env.FIREBASE_AUTH_DOMAIN,
    ),
    projectId: value(
      process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      process.env.FIREBASE_PROJECT_ID,
    ),
    storageBucket: value(
      process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      process.env.FIREBASE_STORAGE_BUCKET,
    ),
    messagingSenderId: value(
      process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      process.env.FIREBASE_MESSAGING_SENDER_ID,
    ),
    appId: value(process.env.NEXT_PUBLIC_FIREBASE_APP_ID, process.env.FIREBASE_APP_ID),
  };

  const missing = Object.entries(config)
    .filter(([, item]) => !item)
    .map(([key]) => key);

  if (missing.length > 0) {
    throw new Error(`[CloudSync] Firebase configuration missing: ${missing.join(', ')}`);
  }

  if (config.projectId !== EXPECTED_PROJECT_ID) {
    throw new Error(
      `[CloudSync] Firebase project mismatch: expected ${EXPECTED_PROJECT_ID}, ` +
        `received ${config.projectId}.`,
    );
  }

  return config;
}

export const COLLECTIONS = {
  PROPERTIES: 'rightathome_properties',
  PHOTOS: 'rightathome_photos',
  BOOKINGS: 'rightathome_bookings',
  GUESTS: 'rightathome_guests',
  CLEANING_JOBS: 'rightathome_cleaning_jobs',
  SMART_LOCKS: 'rightathome_smart_locks',
  MESSAGES: 'rightathome_messages',
  EXPENSES: 'rightathome_expenses',
  USERS: 'rightathome_users',
  SYNC_METADATA: 'rightathome_sync_metadata',
  OFFLINE_QUEUE: 'rightathome_offline_queue',
} as const;

export type CollectionName = (typeof COLLECTIONS)[keyof typeof COLLECTIONS];

let firebaseApp: FirebaseApp | null = null;
let firestoreDb: Firestore | null = null;
let isInitialized = false;
let initializationPromise: Promise<Firestore> | null = null;

export interface FirebaseInitOptions {
  useEmulator?: boolean;
  emulatorHost?: string;
  emulatorPort?: number;
  enableOfflinePersistence?: boolean;
}

function getOrCreateFirebaseApp(): FirebaseApp {
  const config = resolveFirebaseConfig();

  if (getApps().length === 0) return initializeApp(config);

  const existing = getApp();
  if (existing.options.projectId !== config.projectId) {
    throw new Error(
      `[CloudSync] Existing Firebase app uses ${existing.options.projectId ?? 'unknown'}; ` +
        `RAH requires ${config.projectId}.`,
    );
  }
  return existing;
}

export async function initializeFirebase(
  options: FirebaseInitOptions = {},
): Promise<Firestore> {
  if (initializationPromise) return initializationPromise;
  if (isInitialized && firestoreDb) return firestoreDb;

  initializationPromise = (async () => {
    try {
      firebaseApp = getOrCreateFirebaseApp();

      const {
        useEmulator = false,
        emulatorHost = 'localhost',
        emulatorPort = 8080,
        enableOfflinePersistence = true,
      } = options;

      if (typeof window !== 'undefined' && enableOfflinePersistence) {
        firestoreDb = initializeFirestore(firebaseApp, {
          localCache: persistentLocalCache({
            tabManager: persistentMultipleTabManager(),
            cacheSizeBytes: CACHE_SIZE_UNLIMITED,
          }),
        });
      } else {
        firestoreDb = getFirestore(firebaseApp);
      }

      if (useEmulator) {
        connectFirestoreEmulator(firestoreDb, emulatorHost, emulatorPort);
      }

      isInitialized = true;
      return firestoreDb;
    } catch (error) {
      initializationPromise = null;
      throw error;
    }
  })();

  return initializationPromise;
}

export async function getFirestoreDb(): Promise<Firestore> {
  if (firestoreDb && isInitialized) return firestoreDb;
  return initializeFirebase();
}

export function getFirestoreSync(): Firestore {
  if (!firestoreDb || !isInitialized) {
    throw new Error('[CloudSync] Firebase not initialized. Call initializeFirebase() first.');
  }
  return firestoreDb;
}

export function isFirebaseInitialized(): boolean {
  return isInitialized;
}

export function getFirebaseApp(): FirebaseApp | null {
  return firebaseApp;
}

export async function cleanupFirebase(): Promise<void> {
  firestoreDb = null;
  firebaseApp = null;
  isInitialized = false;
  initializationPromise = null;
}

export function getFirebaseConfiguration(): FirebaseOptions {
  return resolveFirebaseConfig();
}
