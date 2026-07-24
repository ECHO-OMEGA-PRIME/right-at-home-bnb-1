/**
 * Server-side Firebase Admin access for RAH Midland.
 * Initialization is fail closed and locked to the rightathome-prod project.
 */

import { App, cert, getApps, initializeApp } from 'firebase-admin/app';
import { Firestore, getFirestore } from 'firebase-admin/firestore';
import { Storage, getStorage } from 'firebase-admin/storage';

const EXPECTED_PROJECT_ID = 'rightathome-prod';

let app: App | undefined;
let firestore: Firestore | undefined;
let storageInstance: Storage | undefined;

export type FirebaseAdminStatus = {
  initialized: boolean;
  method: 'service_account' | 'default_credentials' | 'none';
  projectId?: string;
  error?: string;
  isConfigurationIssue: boolean;
};

let initStatus: FirebaseAdminStatus = {
  initialized: false,
  method: 'none',
  isConfigurationIssue: true,
};

function configuredProjectId(): string {
  return (
    process.env.FIREBASE_PROJECT_ID?.trim() ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim() ||
    ''
  );
}

function initializeFirebaseAdmin(): App | undefined {
  const existing = getApps()[0];
  if (existing) {
    const projectId = existing.options.projectId ?? configuredProjectId();
    if (projectId !== EXPECTED_PROJECT_ID) {
      initStatus = {
        initialized: false,
        method: 'none',
        projectId,
        error: `Firebase Admin project mismatch: expected ${EXPECTED_PROJECT_ID}.`,
        isConfigurationIssue: true,
      };
      return undefined;
    }

    initStatus = {
      initialized: true,
      method: 'service_account',
      projectId,
      isConfigurationIssue: false,
    };
    return existing;
  }

  const projectId = configuredProjectId();
  if (!projectId) {
    initStatus = {
      initialized: false,
      method: 'none',
      error: 'FIREBASE_PROJECT_ID is not configured.',
      isConfigurationIssue: true,
    };
    return undefined;
  }

  if (projectId !== EXPECTED_PROJECT_ID) {
    initStatus = {
      initialized: false,
      method: 'none',
      projectId,
      error: `Firebase Admin project mismatch: expected ${EXPECTED_PROJECT_ID}.`,
      isConfigurationIssue: true,
    };
    return undefined;
  }

  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;
  const storageBucket =
    process.env.FIREBASE_STORAGE_BUCKET?.trim() ||
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET?.trim();

  if (serviceAccountJson) {
    try {
      const serviceAccount = JSON.parse(serviceAccountJson) as {
        project_id?: string;
        client_email?: string;
        private_key?: string;
      };

      if (serviceAccount.project_id !== EXPECTED_PROJECT_ID) {
        throw new Error(
          `Service account project mismatch: expected ${EXPECTED_PROJECT_ID}.`,
        );
      }
      if (!serviceAccount.client_email || !serviceAccount.private_key) {
        throw new Error('Service account JSON is missing required fields.');
      }

      app = initializeApp({
        credential: cert({
          projectId: serviceAccount.project_id,
          clientEmail: serviceAccount.client_email,
          privateKey: serviceAccount.private_key.replace(/\\n/g, '\n'),
        }),
        projectId,
        ...(storageBucket ? { storageBucket } : {}),
      });

      initStatus = {
        initialized: true,
        method: 'service_account',
        projectId,
        isConfigurationIssue: false,
      };
      return app;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown Firebase Admin error';
      initStatus = {
        initialized: false,
        method: 'none',
        projectId,
        error: message,
        isConfigurationIssue: true,
      };
      return undefined;
    }
  }

  if (process.env.GOOGLE_CLOUD_PROJECT || process.env.K_SERVICE) {
    try {
      app = initializeApp({
        projectId,
        ...(storageBucket ? { storageBucket } : {}),
      });
      initStatus = {
        initialized: true,
        method: 'default_credentials',
        projectId,
        isConfigurationIssue: false,
      };
      return app;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown Firebase Admin error';
      initStatus = {
        initialized: false,
        method: 'none',
        projectId,
        error: message,
        isConfigurationIssue: false,
      };
      return undefined;
    }
  }

  initStatus = {
    initialized: false,
    method: 'none',
    projectId,
    error: 'FIREBASE_SERVICE_ACCOUNT is not configured.',
    isConfigurationIssue: true,
  };
  return undefined;
}

app = initializeFirebaseAdmin();

export const db: Firestore | undefined = (() => {
  if (!app) return undefined;
  if (!firestore) firestore = getFirestore(app);
  return firestore;
})();

export const storage: Storage | undefined = (() => {
  if (!app) return undefined;
  if (!storageInstance) storageInstance = getStorage(app);
  return storageInstance;
})();

export const isAdminAvailable = (): boolean => Boolean(app);
export const getFirebaseAdminStatus = (): FirebaseAdminStatus => ({ ...initStatus });
export const isConfigurationIssue = (): boolean => initStatus.isConfigurationIssue;

export default app;
