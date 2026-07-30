/**
 * CloudSync Integration Tests
 * Tests for Firebase/Firestore synchronization functionality
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createFirebaseMock } from '../utils/mocks';
import {
  REAL_PROPERTIES,
  TEST_BOOKINGS,
  TEST_GUESTS,
  TOTAL_EXPECTED_PROPERTIES,
  TOTAL_EXPECTED_PHOTOS
} from '../utils/fixtures';

// Collection names from firebase-config.ts
const COLLECTIONS = {
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

describe('CloudSync Integration', () => {
  let firebase: ReturnType<typeof createFirebaseMock>;
  let firestore: typeof firebase.firestore;

  beforeEach(() => {
    firebase = createFirebaseMock();
    firestore = firebase.firestore;
    firebase._reset();
  });

  describe('Firebase Initialization', () => {
    it('should initialize with correct project ID', () => {
      expect(firebase.app.options.projectId).toBe('echo-prime-ai');
    });

    it('should have app name', () => {
      expect(firebase.app.name).toBe('test-app');
    });
  });

  describe('Firestore Collection Operations', () => {
    it('should create collection reference', () => {
      const collectionRef = firestore.collection(COLLECTIONS.PROPERTIES);
      expect(collectionRef).toBeDefined();
    });

    it('should add document to collection', async () => {
      const property = REAL_PROPERTIES[0];
      const collectionRef = firestore.collection(COLLECTIONS.PROPERTIES);
      const docRef = await collectionRef.add(property);

      expect(docRef.id).toBeDefined();
    });

    it('should set document with specific ID', async () => {
      const property = REAL_PROPERTIES[0];
      const docRef = firestore.collection(COLLECTIONS.PROPERTIES).doc(property.id!);

      await expect(docRef.set(property)).resolves.not.toThrow();
    });

    it('should get document by ID', async () => {
      const property = REAL_PROPERTIES[0];
      const docRef = firestore.collection(COLLECTIONS.PROPERTIES).doc(property.id!);

      await docRef.set(property);
      const snapshot = await docRef.get();

      expect(snapshot.exists).toBe(true);
      expect(snapshot.id).toBe(property.id);
    });

    it('should update existing document', async () => {
      const property = REAL_PROPERTIES[0];
      const docRef = firestore.collection(COLLECTIONS.PROPERTIES).doc(property.id!);

      await docRef.set(property);
      await expect(docRef.update({ baseRate: 300 })).resolves.not.toThrow();
    });

    it('should delete document', async () => {
      const property = REAL_PROPERTIES[0];
      const docRef = firestore.collection(COLLECTIONS.PROPERTIES).doc(property.id!);

      await docRef.set(property);
      await expect(docRef.delete()).resolves.not.toThrow();
    });

    it('should handle non-existent document', async () => {
      const docRef = firestore.collection(COLLECTIONS.PROPERTIES).doc('non_existent');
      const snapshot = await docRef.get();

      expect(snapshot.exists).toBe(false);
    });
  });

  describe('Batch Operations', () => {
    it('should create batch write', () => {
      const batch = firestore.batch();
      expect(batch).toBeDefined();
      expect(batch.set).toBeDefined();
      expect(batch.update).toBeDefined();
      expect(batch.delete).toBeDefined();
      expect(batch.commit).toBeDefined();
    });

    it('should commit batch successfully', async () => {
      const batch = firestore.batch();
      await expect(batch.commit()).resolves.not.toThrow();
    });
  });

  describe('Transaction Operations', () => {
    it('should run transaction', async () => {
      const result = await firestore.runTransaction(async (transaction) => {
        return { success: true };
      });

      expect(result).toEqual({ success: true });
    });
  });

  describe('Real-time Listeners', () => {
    it('should set up document listener', () => {
      const property = REAL_PROPERTIES[0];
      const docRef = firestore.collection(COLLECTIONS.PROPERTIES).doc(property.id!);

      const unsubscribe = docRef.onSnapshot((snapshot) => {
        expect(snapshot).toBeDefined();
      });

      expect(typeof unsubscribe).toBe('function');
    });

    it('should set up collection listener', () => {
      const collectionRef = firestore.collection(COLLECTIONS.PROPERTIES);

      const unsubscribe = collectionRef.onSnapshot((snapshot) => {
        expect(snapshot).toBeDefined();
      });

      expect(typeof unsubscribe).toBe('function');
    });

    it('should receive initial snapshot', async () => {
      const property = REAL_PROPERTIES[0];
      const docRef = firestore.collection(COLLECTIONS.PROPERTIES).doc(property.id!);

      await docRef.set(property);

      let received = false;
      docRef.onSnapshot((snapshot) => {
        received = true;
        expect(snapshot.exists).toBe(true);
      });

      expect(received).toBe(true);
    });
  });

  describe('Query Operations', () => {
    it('should query with where clause', () => {
      const collectionRef = firestore.collection(COLLECTIONS.PROPERTIES);
      const query = collectionRef.where('status', '==', 'active');

      expect(query).toBeDefined();
      expect(query.get).toBeDefined();
    });

    it('should execute query', async () => {
      const collectionRef = firestore.collection(COLLECTIONS.PROPERTIES);
      const query = collectionRef.where('status', '==', 'active');
      const snapshot = await query.get();

      expect(snapshot).toBeDefined();
      expect(Array.isArray(snapshot.docs)).toBe(true);
    });
  });

  describe('Property Sync', () => {
    it('should sync all properties to Firestore', async () => {
      const collectionRef = firestore.collection(COLLECTIONS.PROPERTIES);

      for (const property of REAL_PROPERTIES) {
        const docRef = collectionRef.doc(property.id!);
        await docRef.set(property);
      }

      const snapshot = await collectionRef.get();
      expect(snapshot.size).toBe(TOTAL_EXPECTED_PROPERTIES);
    });

    it('should retrieve synced properties', async () => {
      const collectionRef = firestore.collection(COLLECTIONS.PROPERTIES);

      // Sync first property
      const property = REAL_PROPERTIES[0];
      await collectionRef.doc(property.id!).set(property);

      // Retrieve
      const docRef = collectionRef.doc(property.id!);
      const snapshot = await docRef.get();

      expect(snapshot.exists).toBe(true);
      const data = snapshot.data();
      expect(data?.name).toBe(property.name);
    });
  });

  describe('Booking Sync', () => {
    it('should sync bookings to Firestore', async () => {
      const collectionRef = firestore.collection(COLLECTIONS.BOOKINGS);

      for (const booking of TEST_BOOKINGS) {
        const docRef = collectionRef.doc(booking.id!);
        await docRef.set(booking);
      }

      const snapshot = await collectionRef.get();
      expect(snapshot.size).toBe(TEST_BOOKINGS.length);
    });

    it('should update booking status', async () => {
      const booking = TEST_BOOKINGS[0];
      const docRef = firestore.collection(COLLECTIONS.BOOKINGS).doc(booking.id!);

      await docRef.set(booking);
      await docRef.update({ status: 'checked_in' });

      const snapshot = await docRef.get();
      expect(snapshot.data()?.status).toBe('checked_in');
    });
  });

  describe('Guest Sync', () => {
    it('should sync guests to Firestore', async () => {
      const collectionRef = firestore.collection(COLLECTIONS.GUESTS);

      for (const guest of TEST_GUESTS) {
        const docRef = collectionRef.doc(guest.id!);
        await docRef.set(guest);
      }

      const snapshot = await collectionRef.get();
      expect(snapshot.size).toBe(TEST_GUESTS.length);
    });

    it('should find guest by email', async () => {
      const guest = TEST_GUESTS[0];
      const collectionRef = firestore.collection(COLLECTIONS.GUESTS);
      await collectionRef.doc(guest.id!).set(guest);

      const query = collectionRef.where('email', '==', guest.email);
      const snapshot = await query.get();

      expect(snapshot.empty).toBe(false);
    });
  });

  describe('Offline Queue', () => {
    it('should queue operations for offline sync', async () => {
      const queueRef = firestore.collection(COLLECTIONS.OFFLINE_QUEUE);

      const offlineOperation = {
        id: `op_${Date.now()}`,
        type: 'CREATE',
        collection: COLLECTIONS.PROPERTIES,
        data: REAL_PROPERTIES[0],
        timestamp: new Date(),
        retryCount: 0
      };

      await queueRef.add(offlineOperation);
      const snapshot = await queueRef.get();

      expect(snapshot.size).toBeGreaterThan(0);
    });

    it('should process queued operations', async () => {
      const queueRef = firestore.collection(COLLECTIONS.OFFLINE_QUEUE);

      // Add to queue
      const docRef = await queueRef.add({
        type: 'CREATE',
        collection: COLLECTIONS.PROPERTIES,
        data: REAL_PROPERTIES[0],
        timestamp: new Date()
      });

      // Process (delete from queue)
      const queueDoc = queueRef.doc(docRef.id);
      await queueDoc.delete();

      // Verify removed
      const snapshot = await queueDoc.get();
      expect(snapshot.exists).toBe(false);
    });
  });

  describe('Sync Metadata', () => {
    it('should track last sync timestamp', async () => {
      const metadataRef = firestore.collection(COLLECTIONS.SYNC_METADATA).doc('lastSync');

      const metadata = {
        lastSyncAt: new Date(),
        syncedCollections: Object.keys(COLLECTIONS),
        deviceId: 'test-device',
        platform: 'desktop'
      };

      await metadataRef.set(metadata);
      const snapshot = await metadataRef.get();

      expect(snapshot.exists).toBe(true);
      expect(snapshot.data()?.platform).toBe('desktop');
    });

    it('should track sync status per collection', async () => {
      const metadataRef = firestore.collection(COLLECTIONS.SYNC_METADATA);

      for (const collectionName of Object.keys(COLLECTIONS)) {
        await metadataRef.doc(collectionName).set({
          lastSyncAt: new Date(),
          documentCount: 0,
          status: 'synced'
        });
      }

      const snapshot = await metadataRef.get();
      expect(snapshot.size).toBe(Object.keys(COLLECTIONS).length);
    });
  });

  describe('Error Handling', () => {
    it('should handle update on non-existent document', async () => {
      const docRef = firestore.collection(COLLECTIONS.PROPERTIES).doc('non_existent');

      await expect(docRef.update({ name: 'Test' })).rejects.toThrow();
    });

    it('should handle invalid collection name', () => {
      const collectionRef = firestore.collection('invalid_collection');
      expect(collectionRef).toBeDefined();
    });
  });

  describe('Data Validation', () => {
    it('should validate property data structure before sync', () => {
      const requiredFields = ['id', 'name', 'address', 'city', 'state'];

      for (const property of REAL_PROPERTIES) {
        for (const field of requiredFields) {
          expect((property as Record<string, unknown>)[field]).toBeDefined();
        }
      }
    });

    it('should validate booking data structure before sync', () => {
      const requiredFields = ['id', 'propertyId', 'guestName', 'checkIn', 'checkOut'];

      for (const booking of TEST_BOOKINGS) {
        for (const field of requiredFields) {
          expect((booking as Record<string, unknown>)[field]).toBeDefined();
        }
      }
    });
  });
});
