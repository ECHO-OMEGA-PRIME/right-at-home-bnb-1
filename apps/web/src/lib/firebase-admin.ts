/**
 * Firebase Admin SDK Configuration
 * Server-side Firebase access for API routes
 *
 * @author ECHO OMEGA PRIME
 *
 * VERCEL SETUP:
 * 1. Go to Vercel Dashboard → Project → Settings → Environment Variables
 * 2. Add FIREBASE_SERVICE_ACCOUNT with value = entire JSON content (stringified)
 *    Example: {"type":"service_account","project_id":"echo-prime-ai",...}
 * 3. Redeploy the project
 */

import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { getStorage, Storage } from 'firebase-admin/storage';

let app: App | undefined;
let firestore: Firestore | undefined;
let storageInstance: Storage | undefined;

// Track initialization status for better error reporting
export type FirebaseAdminStatus = {
  initialized: boolean;
  method: 'service_account' | 'default_credentials' | 'none';
  error?: string;
  isConfigurationIssue: boolean;  // True = missing config, False = actual failure
};

let initStatus: FirebaseAdminStatus = {
  initialized: false,
  method: 'none',
  isConfigurationIssue: true
};

function initializeFirebaseAdmin(): App | undefined {
  // Already initialized
  if (getApps().length > 0) {
    initStatus = { initialized: true, method: 'service_account', isConfigurationIssue: false };
    return getApps()[0];
  }

  // Check for service account credentials
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'echo-prime-ai';

  if (serviceAccountJson) {
    try {
      const serviceAccount = JSON.parse(serviceAccountJson);
      app = initializeApp({
        credential: cert(serviceAccount),
        storageBucket: `${projectId}.appspot.com`,
      });
      console.log('✅ Firebase Admin initialized with service account');
      initStatus = { initialized: true, method: 'service_account', isConfigurationIssue: false };
      return app;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown parsing error';
      console.error('❌ Failed to parse FIREBASE_SERVICE_ACCOUNT:', errorMsg);
      initStatus = {
        initialized: false,
        method: 'none',
        error: `Failed to parse service account JSON: ${errorMsg}`,
        isConfigurationIssue: true  // Config issue, not outage
      };
      return undefined;
    }
  }

  // No service account - check if we're on Cloud Run/GCP with default credentials
  if (process.env.GOOGLE_CLOUD_PROJECT || process.env.K_SERVICE) {
    try {
      app = initializeApp({
        projectId,
        storageBucket: `${projectId}.appspot.com`,
      });
      console.log('✅ Firebase Admin initialized with GCP default credentials');
      initStatus = { initialized: true, method: 'default_credentials', isConfigurationIssue: false };
      return app;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.warn('⚠️ Firebase Admin failed with default credentials:', errorMsg);
      initStatus = {
        initialized: false,
        method: 'none',
        error: `Default credentials failed: ${errorMsg}`,
        isConfigurationIssue: false  // Was configured but failed = potential outage
      };
      return undefined;
    }
  }

  // Not configured - this is expected on Vercel without FIREBASE_SERVICE_ACCOUNT
  console.warn('⚠️ Firebase Admin not configured: FIREBASE_SERVICE_ACCOUNT env var not set');
  initStatus = {
    initialized: false,
    method: 'none',
    error: 'FIREBASE_SERVICE_ACCOUNT environment variable not set. Set it in Vercel Dashboard.',
    isConfigurationIssue: true  // Missing config, not an outage
  };
  return undefined;
}

// Initialize on import
app = initializeFirebaseAdmin();

// Export Firestore instance
export const db: Firestore | undefined = (() => {
  if (!app) return undefined;
  if (!firestore) {
    firestore = getFirestore(app);
  }
  return firestore;
})();

// Export Storage instance
export const storage: Storage | undefined = (() => {
  if (!app) return undefined;
  if (!storageInstance) {
    storageInstance = getStorage(app);
  }
  return storageInstance;
})();

// Check if admin is available
export const isAdminAvailable = (): boolean => {
  return !!app;
};

// Get detailed status (for system monitor)
export const getFirebaseAdminStatus = (): FirebaseAdminStatus => {
  return { ...initStatus };
};

// Check if this is a configuration issue (missing env vars) vs actual outage
export const isConfigurationIssue = (): boolean => {
  return initStatus.isConfigurationIssue;
};

export default app;
