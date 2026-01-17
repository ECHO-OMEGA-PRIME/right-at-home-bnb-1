/**
 * Firebase Admin SDK Configuration
 * Server-side Firebase access for API routes
 *
 * @author ECHO OMEGA PRIME
 */

import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { getStorage, Storage } from 'firebase-admin/storage';

let app: App | undefined;
let firestore: Firestore | undefined;
let storageInstance: Storage | undefined;

function initializeFirebaseAdmin(): App | undefined {
  // Already initialized
  if (getApps().length > 0) {
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
      return app;
    } catch (error) {
      console.error('Failed to parse service account:', error);
    }
  }

  // Try Google Application Default Credentials (for Cloud Run, etc.)
  try {
    app = initializeApp({
      projectId,
      storageBucket: `${projectId}.appspot.com`,
    });
    console.log('✅ Firebase Admin initialized with default credentials');
    return app;
  } catch (error) {
    console.warn('⚠️ Firebase Admin not available:', error);
    return undefined;
  }
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

export default app;
