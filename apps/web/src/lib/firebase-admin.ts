/**
 * Server-side Firebase Admin access for RAH Midland.
 * Locked to the `echo-prime-ai` project — the canonical ECHO auth project that
 * actually holds the RAH users (confirmed from the live production client
 * bundle). The prior value 'rightathome-prod' pointed at an inaccessible/unused
 * project and broke server-side token verification. verifyIdToken() only needs
 * the projectId (it validates against Google's public certs), so we initialize
 * with projectId alone when no service account is mounted — this keeps auth
 * working on Vercel; Firestore/Storage admin ops still require a service account
 * and surface their own errors if used without one.
 */

import { App, cert, getApps, initializeApp } from 'firebase-admin/app';
import { Firestore, getFirestore } from 'firebase-admin/firestore';
import { Storage, getStorage } from 'firebase-admin/storage';

const EXPECTED_PROJECT_ID = 'echo-prime-ai';

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

  // No service account and not on a GCP host: initialize with the projectId
  // alone. This is sufficient for verifyIdToken() (the auth critical path, which
  // validates against Google's public certs). Firestore/Storage admin ops will
  // fail without credentials, but the RAH data plane is Postgres/prisma + the
  // FORGE lock API, not Firestore — so authentication works and locks work.
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
      isConfigurationIssue: true,
    };
    return undefined;
  }
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
