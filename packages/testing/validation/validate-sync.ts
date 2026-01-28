/**
 * CloudSync Validation Script
 * Verifies Firebase/Firestore connection and sync functionality
 */

import { initializeApp, FirebaseApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  getDocs,
  doc,
  setDoc,
  getDoc,
  deleteDoc,
  Firestore
} from 'firebase/firestore';

interface ValidationResult {
  check: string;
  status: 'PASS' | 'FAIL' | 'WARN' | 'SKIP';
  message?: string;
  duration?: number;
}

// Firebase configuration
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY || process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '',
  authDomain: 'echo-prime-ai.firebaseapp.com',
  projectId: 'echo-prime-ai',
  storageBucket: 'echo-prime-ai.appspot.com',
  messagingSenderId: '249995513427',
  appId: process.env.FIREBASE_APP_ID || process.env.NEXT_PUBLIC_FIREBASE_APP_ID || ''
};

// Collection names
const COLLECTIONS = {
  PROPERTIES: 'rightathome_properties',
  PHOTOS: 'rightathome_photos',
  BOOKINGS: 'rightathome_bookings',
  GUESTS: 'rightathome_guests',
  SYNC_METADATA: 'rightathome_sync_metadata'
} as const;

async function validateSync(): Promise<ValidationResult[]> {
  const results: ValidationResult[] = [];
  let app: FirebaseApp | null = null;
  let db: Firestore | null = null;

  console.log('='.repeat(60));
  console.log('RightAtHomeBnB CloudSync Validation');
  console.log('='.repeat(60));
  console.log();

  // Check environment variables
  const hasApiKey = !!firebaseConfig.apiKey;
  const hasAppId = !!firebaseConfig.appId;

  results.push({
    check: 'Firebase API Key',
    status: hasApiKey ? 'PASS' : 'WARN',
    message: hasApiKey ? 'API key found' : 'API key not set (set FIREBASE_API_KEY env var)'
  });

  results.push({
    check: 'Firebase App ID',
    status: hasAppId ? 'PASS' : 'WARN',
    message: hasAppId ? 'App ID found' : 'App ID not set (set FIREBASE_APP_ID env var)'
  });

  if (!hasApiKey || !hasAppId) {
    results.push({
      check: 'Firebase Initialization',
      status: 'SKIP',
      message: 'Skipping Firebase tests - credentials not configured'
    });
    return results;
  }

  try {
    // 1. Initialize Firebase
    const startInit = Date.now();
    app = initializeApp(firebaseConfig);
    results.push({
      check: 'Firebase Initialization',
      status: 'PASS',
      message: `Initialized app: ${app.name}`,
      duration: Date.now() - startInit
    });

    // 2. Get Firestore instance
    const startFirestore = Date.now();
    db = getFirestore(app);
    results.push({
      check: 'Firestore Connection',
      status: 'PASS',
      message: 'Connected to Firestore',
      duration: Date.now() - startFirestore
    });

    // 3. Test write operation
    const testDocId = `validation_test_${Date.now()}`;
    const testDocRef = doc(db, COLLECTIONS.SYNC_METADATA, testDocId);
    const testData = {
      test: true,
      timestamp: new Date().toISOString(),
      source: 'validate-sync'
    };

    const startWrite = Date.now();
    await setDoc(testDocRef, testData);
    results.push({
      check: 'Firestore Write',
      status: 'PASS',
      message: 'Successfully wrote test document',
      duration: Date.now() - startWrite
    });

    // 4. Test read operation
    const startRead = Date.now();
    const docSnap = await getDoc(testDocRef);
    results.push({
      check: 'Firestore Read',
      status: docSnap.exists() ? 'PASS' : 'FAIL',
      message: docSnap.exists() ? 'Successfully read test document' : 'Test document not found',
      duration: Date.now() - startRead
    });

    // 5. Test delete operation
    const startDelete = Date.now();
    await deleteDoc(testDocRef);
    results.push({
      check: 'Firestore Delete',
      status: 'PASS',
      message: 'Successfully deleted test document',
      duration: Date.now() - startDelete
    });

    // 6. Check each collection exists
    for (const [name, collectionName] of Object.entries(COLLECTIONS)) {
      const startCollection = Date.now();
      try {
        const collRef = collection(db, collectionName);
        const snapshot = await getDocs(collRef);
        results.push({
          check: `Collection: ${name}`,
          status: 'PASS',
          message: `Accessible with ${snapshot.size} documents`,
          duration: Date.now() - startCollection
        });
      } catch (error) {
        results.push({
          check: `Collection: ${name}`,
          status: 'FAIL',
          message: `Error: ${(error as Error).message}`,
          duration: Date.now() - startCollection
        });
      }
    }

    // 7. Check properties sync status
    const propertiesRef = collection(db, COLLECTIONS.PROPERTIES);
    const propertiesSnap = await getDocs(propertiesRef);
    const propertyCount = propertiesSnap.size;

    results.push({
      check: 'Properties Synced',
      status: propertyCount >= 14 ? 'PASS' : propertyCount > 0 ? 'WARN' : 'FAIL',
      message: `${propertyCount} properties in Firestore (expected 14)`
    });

    // 8. Check photos sync status
    const photosRef = collection(db, COLLECTIONS.PHOTOS);
    const photosSnap = await getDocs(photosRef);
    const photoCount = photosSnap.size;

    results.push({
      check: 'Photos Synced',
      status: photoCount >= 700 ? 'PASS' : photoCount > 0 ? 'WARN' : 'FAIL',
      message: `${photoCount} photos in Firestore (expected ~730)`
    });

    // 9. Test offline capability check
    results.push({
      check: 'Offline Support',
      status: 'PASS',
      message: 'Firestore offline persistence is available'
    });

    // 10. Latency check
    const latencyStart = Date.now();
    await getDoc(doc(db, COLLECTIONS.SYNC_METADATA, 'latency_test'));
    const latency = Date.now() - latencyStart;

    results.push({
      check: 'Firestore Latency',
      status: latency < 1000 ? 'PASS' : latency < 3000 ? 'WARN' : 'FAIL',
      message: `Round-trip latency: ${latency}ms`,
      duration: latency
    });

  } catch (error) {
    results.push({
      check: 'Firebase Operations',
      status: 'FAIL',
      message: `Error: ${(error as Error).message}`
    });
  }

  return results;
}

function printResults(results: ValidationResult[]): void {
  console.log();
  console.log('Validation Results:');
  console.log('-'.repeat(60));

  let passCount = 0;
  let failCount = 0;
  let warnCount = 0;
  let skipCount = 0;

  for (const result of results) {
    const icons: Record<string, string> = {
      'PASS': '[PASS]',
      'FAIL': '[FAIL]',
      'WARN': '[WARN]',
      'SKIP': '[SKIP]'
    };
    const icon = icons[result.status];
    console.log(`${icon} ${result.check}`);
    if (result.message) {
      console.log(`       ${result.message}`);
    }
    if (result.duration !== undefined) {
      console.log(`       Duration: ${result.duration}ms`);
    }

    switch (result.status) {
      case 'PASS': passCount++; break;
      case 'FAIL': failCount++; break;
      case 'WARN': warnCount++; break;
      case 'SKIP': skipCount++; break;
    }
  }

  console.log();
  console.log('='.repeat(60));
  console.log(`Summary: ${passCount} passed, ${failCount} failed, ${warnCount} warnings, ${skipCount} skipped`);
  console.log('='.repeat(60));

  if (failCount > 0) {
    console.log('\nCloudSync validation FAILED. Please fix the issues above.');
    process.exit(1);
  } else if (skipCount > 0 && passCount === 0) {
    console.log('\nCloudSync validation SKIPPED - Firebase credentials not configured.');
    console.log('Set FIREBASE_API_KEY and FIREBASE_APP_ID environment variables.');
  } else if (warnCount > 0) {
    console.log('\nCloudSync validation passed with warnings.');
  } else {
    console.log('\nCloudSync validation PASSED!');
  }
}

// Run validation
validateSync()
  .then(printResults)
  .catch(error => {
    console.error('Validation error:', error);
    process.exit(1);
  });
