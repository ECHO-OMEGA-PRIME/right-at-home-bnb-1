/**
 * Right at Home BNB - Firebase Configuration
 * Shared across all platforms
 */

import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';
import { getFunctions, Functions } from 'firebase/functions';

// Firebase configuration - uses environment variables
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ||
    process.env.EXPO_PUBLIC_FIREBASE_API_KEY ||
    process.env.VITE_FIREBASE_API_KEY ||
    process.env.FIREBASE_API_KEY,
  authDomain: 'echo-prime-ai.firebaseapp.com',
  projectId: 'echo-prime-ai',
  storageBucket: 'echo-prime-ai.appspot.com',
  messagingSenderId: '249995513427',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ||
    process.env.EXPO_PUBLIC_FIREBASE_APP_ID ||
    process.env.VITE_FIREBASE_APP_ID ||
    process.env.FIREBASE_APP_ID
};

// Singleton instances
let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;
let storage: FirebaseStorage | null = null;
let functions: Functions | null = null;

/**
 * Initialize Firebase app (singleton)
 */
export function initializeFirebase(): FirebaseApp {
  if (app) return app;

  const existingApps = getApps();
  if (existingApps.length > 0) {
    app = existingApps[0];
  } else {
    app = initializeApp(firebaseConfig);
  }

  return app;
}

/**
 * Get Firebase Auth instance
 */
export function getAuthInstance(): Auth {
  if (auth) return auth;
  auth = getAuth(initializeFirebase());
  return auth;
}

/**
 * Get Firestore instance
 */
export function getFirestoreInstance(): Firestore {
  if (db) return db;
  db = getFirestore(initializeFirebase());
  return db;
}

/**
 * Get Storage instance
 */
export function getStorageInstance(): FirebaseStorage {
  if (storage) return storage;
  storage = getStorage(initializeFirebase());
  return storage;
}

/**
 * Get Functions instance
 */
export function getFunctionsInstance(): Functions {
  if (functions) return functions;
  functions = getFunctions(initializeFirebase(), 'us-central1');
  return functions;
}

// Collection references
export const COLLECTIONS = {
  // Core data
  PROPERTIES: 'rightathome_properties',
  BOOKINGS: 'rightathome_bookings',
  GUESTS: 'rightathome_guests',
  CLEANERS: 'rightathome_cleaners',
  USERS: 'rightathome_users',

  // Operations
  CLEANING_JOBS: 'rightathome_cleaning_jobs',
  CLEANING_REPORTS: 'rightathome_cleaning_reports',
  MESSAGES: 'rightathome_messages',
  CONVERSATIONS: 'rightathome_conversations',

  // Smart Home
  SMART_LOCKS: 'rightathome_smart_locks',
  THERMOSTATS: 'rightathome_thermostats',
  ACCESS_CODES: 'rightathome_access_codes',

  // Finance
  TRANSACTIONS: 'rightathome_transactions',
  PAYOUTS: 'rightathome_payouts',

  // Sync
  SYNC_EVENTS: 'rightathome_sync_events',
  SYNC_DEVICES: 'rightathome_sync_devices',

  // System
  NOTIFICATIONS: 'rightathome_notifications',
  SETTINGS: 'rightathome_settings',
  AUDIT_LOG: 'rightathome_audit_log'
} as const;

// Storage paths
export const STORAGE_PATHS = {
  PROPERTY_PHOTOS: 'rightathome/properties',
  CLEANING_PHOTOS: 'rightathome/cleaning',
  USER_AVATARS: 'rightathome/avatars',
  DOCUMENTS: 'rightathome/documents',
  RECEIPTS: 'rightathome/receipts'
} as const;

// Export all instances
export {
  app,
  auth,
  db,
  storage,
  functions,
  firebaseConfig
};

export default {
  initializeFirebase,
  getAuthInstance,
  getFirestoreInstance,
  getStorageInstance,
  getFunctionsInstance,
  COLLECTIONS,
  STORAGE_PATHS
};
