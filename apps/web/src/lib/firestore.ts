'use client';

import { FirebaseApp, getApps, initializeApp } from 'firebase/app';
import { Firestore, getFirestore } from 'firebase/firestore';
import {
  getFirebaseClientConfig,
  getFirebaseClientConfigurationStatus,
} from '@/lib/firebase-client-config';

let firebaseApp: FirebaseApp | null = null;
let firestoreDb: Firestore | null = null;

function canInitializeFirebase(): boolean {
  return (
    typeof window !== 'undefined' &&
    getFirebaseClientConfigurationStatus().configured
  );
}

function getFirebaseApp(): FirebaseApp {
  const config = getFirebaseClientConfig();

  if (firebaseApp) return firebaseApp;

  const existing = getApps()[0];
  if (existing) {
    if (existing.options.projectId !== config.projectId) {
      throw new Error(
        `Existing Firebase app uses project ${existing.options.projectId ?? 'unknown'}, ` +
          `but RAH requires ${config.projectId}.`,
      );
    }
    firebaseApp = existing;
  } else {
    firebaseApp = initializeApp(config);
  }

  return firebaseApp;
}

export function db(): Firestore {
  if (!canInitializeFirebase()) {
    getFirebaseClientConfig();
    throw new Error('Firestore is unavailable in this environment.');
  }
  if (!firestoreDb) firestoreDb = getFirestore(getFirebaseApp());
  return firestoreDb;
}
