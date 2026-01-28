/**
 * Firebase Configuration for RightAtHomeBnB CloudSync
 * Project: echo-prime-ai
 *
 * Provides Firebase/Firestore initialization for real-time cloud sync.
 */

import { initializeApp, FirebaseApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  Firestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  CACHE_SIZE_UNLIMITED,
  enableIndexedDbPersistence,
  connectFirestoreEmulator
} from 'firebase/firestore';

// Collection names for RightAtHomeBnB
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
  OFFLINE_QUEUE: 'rightathome_offline_queue'
} as const;

export type CollectionName = typeof COLLECTIONS[keyof typeof COLLECTIONS];

// Firebase configuration for echo-prime-ai project
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY || '',
  authDomain: 'echo-prime-ai.firebaseapp.com',
  projectId: 'echo-prime-ai',
  storageBucket: 'echo-prime-ai.appspot.com',
  messagingSenderId: '249995513427',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || process.env.FIREBASE_APP_ID || ''
};

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

/**
 * Initialize Firebase and Firestore with offline persistence support
 */
export async function initializeFirebase(options: FirebaseInitOptions = {}): Promise<Firestore> {
  // Return existing promise if initialization is in progress
  if (initializationPromise) {
    return initializationPromise;
  }

  // Return existing instance if already initialized
  if (isInitialized && firestoreDb) {
    return firestoreDb;
  }

  initializationPromise = (async () => {
    try {
      // Check if Firebase app already exists
      if (getApps().length === 0) {
        firebaseApp = initializeApp(firebaseConfig);
      } else {
        firebaseApp = getApp();
      }

      // Initialize Firestore with persistence settings
      const {
        useEmulator = false,
        emulatorHost = 'localhost',
        emulatorPort = 8080,
        enableOfflinePersistence = true
      } = options;

      // For browser environments, use persistent local cache
      if (typeof window !== 'undefined' && enableOfflinePersistence) {
        firestoreDb = initializeFirestore(firebaseApp, {
          localCache: persistentLocalCache({
            tabManager: persistentMultipleTabManager(),
            cacheSizeBytes: CACHE_SIZE_UNLIMITED
          })
        });
      } else {
        firestoreDb = getFirestore(firebaseApp);
      }

      // Connect to emulator if specified
      if (useEmulator) {
        connectFirestoreEmulator(firestoreDb, emulatorHost, emulatorPort);
        console.log(`[CloudSync] Connected to Firestore emulator at ${emulatorHost}:${emulatorPort}`);
      }

      isInitialized = true;
      console.log('[CloudSync] Firebase initialized successfully for project: echo-prime-ai');

      return firestoreDb;
    } catch (error) {
      console.error('[CloudSync] Firebase initialization failed:', error);
      initializationPromise = null;
      throw error;
    }
  })();

  return initializationPromise;
}

/**
 * Get the Firestore instance (initializes if needed)
 */
export async function getFirestoreDb(): Promise<Firestore> {
  if (firestoreDb && isInitialized) {
    return firestoreDb;
  }
  return initializeFirebase();
}

/**
 * Get Firestore synchronously (throws if not initialized)
 */
export function getFirestoreSync(): Firestore {
  if (!firestoreDb || !isInitialized) {
    throw new Error('[CloudSync] Firebase not initialized. Call initializeFirebase() first.');
  }
  return firestoreDb;
}

/**
 * Check if Firebase is initialized
 */
export function isFirebaseInitialized(): boolean {
  return isInitialized;
}

/**
 * Get the Firebase app instance
 */
export function getFirebaseApp(): FirebaseApp | null {
  return firebaseApp;
}

/**
 * Clean up Firebase resources
 */
export async function cleanupFirebase(): Promise<void> {
  if (firebaseApp) {
    // Firebase SDK doesn't have a direct cleanup method for web
    // Just clear our references
    firestoreDb = null;
    firebaseApp = null;
    isInitialized = false;
    initializationPromise = null;
    console.log('[CloudSync] Firebase resources cleaned up');
  }
}

export { firebaseConfig };
