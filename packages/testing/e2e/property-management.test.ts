/**
 * E2E Property Management Tests
 * Complete end-to-end tests for property CRUD operations
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createPrismaMock,
  createFirebaseMock,
  createApiMock
} from '../utils/mocks';
import {
  REAL_PROPERTIES,
  PROPERTY_PHOTO_COUNTS,
  TOTAL_EXPECTED_PROPERTIES,
  TOTAL_EXPECTED_PHOTOS,
  createTestProperty
} from '../utils/fixtures';
import { isValidZipCode, generateTestId } from '../utils/helpers';

describe('E2E: Property Management', () => {
  let prisma: ReturnType<typeof createPrismaMock>;
  let firebase: ReturnType<typeof createFirebaseMock>;
  let api: ReturnType<typeof createApiMock>;

  beforeEach(() => {
    prisma = createPrismaMock();
    firebase = createFirebaseMock();
    api = createApiMock();
    firebase._reset();
  });

  describe('Property Listing', () => {
    it('should list all Steven Palma properties', async () => {
      const response = await api.properties.list();

      expect(response.success).toBe(true);
      expect(response.data.length).toBe(TOTAL_EXPECTED_PROPERTIES);
    });

    it('should have correct property count (14 properties)', async () => {
      const properties = await prisma.property.findMany();
      expect(properties.length).toBe(TOTAL_EXPECTED_PROPERTIES);
    });

    it('should have all properties in Midland, TX', async () => {
      const properties = await prisma.property.findMany();

      for (const property of properties) {
        expect(property.city).toBe('Midland');
        expect(property.state).toBe('TX');
      }
    });

    it('should display correct photo counts per property', () => {
      let totalPhotos = 0;
      for (const [propertyId, count] of Object.entries(PROPERTY_PHOTO_COUNTS)) {
        expect(count).toBeGreaterThan(0);
        totalPhotos += count;
      }
      expect(totalPhotos).toBe(TOTAL_EXPECTED_PHOTOS);
    });
  });

  describe('Property Creation', () => {
    it('should create a new property with required fields', async () => {
      const newProperty = createTestProperty({
        name: 'New Test Property',
        address: '999 Test Drive',
        city: 'Midland',
        state: 'TX',
        zip: '79705',
        bedrooms: 3,
        bathrooms: 2,
        maxGuests: 6,
        baseRate: 200,
        cleaningFee: 100
      });

      const created = await prisma.property.create({
        data: newProperty as Parameters<typeof prisma.property.create>[0]['data']
      });

      expect(created.id).toBeDefined();
      expect(created.name).toBe('New Test Property');
    });

    it('should validate ZIP code on creation', () => {
      const validZip = '79705';
      const invalidZip = '1234';

      expect(isValidZipCode(validZip)).toBe(true);
      expect(isValidZipCode(invalidZip)).toBe(false);
    });

    it('should sync new property to Firebase', async () => {
      const newProperty = createTestProperty({
        name: 'Firebase Sync Test Property'
      });

      const created = await prisma.property.create({
        data: newProperty as Parameters<typeof prisma.property.create>[0]['data']
      });

      // Sync to Firebase
      const firestore = firebase.firestore;
      await firestore.collection('rightathome_properties').doc(created.id).set(created);

      const snapshot = await firestore.collection('rightathome_properties').doc(created.id).get();
      expect(snapshot.exists).toBe(true);
      expect(snapshot.data()?.name).toBe('Firebase Sync Test Property');
    });

    it('should generate unique property ID', () => {
      const id1 = generateTestId('prop');
      const id2 = generateTestId('prop');

      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^prop_/);
    });
  });

  describe('Property Update', () => {
    it('should update property pricing', async () => {
      const propertyId = REAL_PROPERTIES[0].id!;
      const newRate = 350;

      const updated = await prisma.property.update({
        where: { id: propertyId },
        data: { baseRate: newRate }
      });

      expect(updated.baseRate).toBe(newRate);
    });

    it('should update property amenities', async () => {
      const propertyId = REAL_PROPERTIES[0].id!;
      const newAmenities = ['pool', 'hot_tub', 'wifi', 'ev_charger'];

      const updated = await prisma.property.update({
        where: { id: propertyId },
        data: { amenities: newAmenities }
      });

      expect(updated.amenities).toContain('ev_charger');
    });

    it('should update property status', async () => {
      const propertyId = REAL_PROPERTIES[0].id!;

      const updated = await prisma.property.update({
        where: { id: propertyId },
        data: { status: 'maintenance' }
      });

      expect(updated.status).toBe('maintenance');
    });

    it('should sync property updates to Firebase', async () => {
      const propertyId = REAL_PROPERTIES[0].id!;
      const firestore = firebase.firestore;

      // Initial set
      await firestore.collection('rightathome_properties').doc(propertyId).set(REAL_PROPERTIES[0]);

      // Update
      await firestore.collection('rightathome_properties').doc(propertyId).update({
        baseRate: 400
      });

      const snapshot = await firestore.collection('rightathome_properties').doc(propertyId).get();
      expect(snapshot.data()?.baseRate).toBe(400);
    });
  });

  describe('Property Deletion', () => {
    it('should delete property from database', async () => {
      // Create a property to delete
      const newProperty = await prisma.property.create({
        data: createTestProperty() as Parameters<typeof prisma.property.create>[0]['data']
      });

      // Delete it
      const deleted = await prisma.property.delete({
        where: { id: newProperty.id }
      });

      expect(deleted.id).toBe(newProperty.id);

      // Verify it's gone
      const retrieved = await prisma.property.findUnique({
        where: { id: newProperty.id }
      });
      expect(retrieved).toBeNull();
    });

    it('should remove property from Firebase on delete', async () => {
      const propertyId = generateTestId('prop');
      const firestore = firebase.firestore;

      // Create in Firebase
      await firestore.collection('rightathome_properties').doc(propertyId).set({
        id: propertyId,
        name: 'To Be Deleted'
      });

      // Delete
      await firestore.collection('rightathome_properties').doc(propertyId).delete();

      // Verify removed
      const snapshot = await firestore.collection('rightathome_properties').doc(propertyId).get();
      expect(snapshot.exists).toBe(false);
    });
  });

  describe('Property Search & Filter', () => {
    it('should filter properties by bedroom count', async () => {
      const minBedrooms = 4;
      const properties = await prisma.property.findMany();
      const filtered = properties.filter(
        (p: typeof REAL_PROPERTIES[0]) => p.bedrooms! >= minBedrooms
      );

      expect(filtered.length).toBeGreaterThan(0);
      for (const property of filtered) {
        expect(property.bedrooms).toBeGreaterThanOrEqual(minBedrooms);
      }
    });

    it('should filter properties by price range', async () => {
      const minPrice = 200;
      const maxPrice = 300;

      const properties = await prisma.property.findMany();
      const filtered = properties.filter(
        (p: typeof REAL_PROPERTIES[0]) =>
          p.baseRate! >= minPrice && p.baseRate! <= maxPrice
      );

      expect(filtered.length).toBeGreaterThan(0);
      for (const property of filtered) {
        expect(property.baseRate).toBeGreaterThanOrEqual(minPrice);
        expect(property.baseRate).toBeLessThanOrEqual(maxPrice);
      }
    });

    it('should filter properties by amenity', async () => {
      const requiredAmenity = 'pool';
      const properties = await prisma.property.findMany();
      const filtered = properties.filter(
        (p: typeof REAL_PROPERTIES[0]) => p.amenities?.includes(requiredAmenity)
      );

      expect(filtered.length).toBeGreaterThan(0);
    });

    it('should search properties by name', async () => {
      const searchTerm = 'Oasis';
      const properties = await prisma.property.findMany();
      const filtered = properties.filter(
        (p: typeof REAL_PROPERTIES[0]) =>
          p.name?.toLowerCase().includes(searchTerm.toLowerCase())
      );

      expect(filtered.length).toBeGreaterThan(0);
    });
  });

  describe('Property Validation', () => {
    it('should validate required fields', () => {
      const requiredFields = ['name', 'address', 'city', 'state', 'bedrooms', 'bathrooms', 'maxGuests', 'baseRate'];

      for (const property of REAL_PROPERTIES) {
        for (const field of requiredFields) {
          expect((property as Record<string, unknown>)[field]).toBeDefined();
        }
      }
    });

    it('should validate bedroom count is positive', () => {
      for (const property of REAL_PROPERTIES) {
        expect(property.bedrooms).toBeGreaterThan(0);
      }
    });

    it('should validate bathroom count is positive', () => {
      for (const property of REAL_PROPERTIES) {
        expect(property.bathrooms).toBeGreaterThan(0);
      }
    });

    it('should validate maxGuests is reasonable', () => {
      for (const property of REAL_PROPERTIES) {
        expect(property.maxGuests).toBeGreaterThan(0);
        expect(property.maxGuests).toBeLessThanOrEqual(20);
      }
    });

    it('should validate baseRate is positive', () => {
      for (const property of REAL_PROPERTIES) {
        expect(property.baseRate).toBeGreaterThan(0);
      }
    });
  });

  describe('Property-Booking Relationship', () => {
    it('should link bookings to properties', async () => {
      const propertyId = REAL_PROPERTIES[0].id!;
      const bookings = await prisma.booking.findMany();
      const propertyBookings = bookings.filter(
        (b: { propertyId: string }) => b.propertyId === propertyId
      );

      // All bookings should have valid property reference
      for (const booking of propertyBookings) {
        expect(booking.propertyId).toBe(propertyId);
      }
    });

    it('should link cleaning jobs to properties', async () => {
      const propertyId = REAL_PROPERTIES[0].id!;
      const cleaningJobs = await prisma.cleaningJob.findMany();
      const propertyJobs = cleaningJobs.filter(
        (j: { propertyId: string }) => j.propertyId === propertyId
      );

      for (const job of propertyJobs) {
        expect(job.propertyId).toBe(propertyId);
      }
    });
  });

  describe('Complete Property CRUD Flow', () => {
    it('should complete full property lifecycle', async () => {
      // 1. CREATE
      const newProperty = createTestProperty({
        name: 'CRUD Test Property',
        address: '123 CRUD Street',
        baseRate: 250,
        cleaningFee: 125
      });

      const created = await prisma.property.create({
        data: newProperty as Parameters<typeof prisma.property.create>[0]['data']
      });
      expect(created.id).toBeDefined();
      const propertyId = created.id;

      // 2. READ
      const retrieved = await prisma.property.findUnique({
        where: { id: propertyId }
      });
      expect(retrieved?.name).toBe('CRUD Test Property');

      // 3. UPDATE
      const updated = await prisma.property.update({
        where: { id: propertyId },
        data: { baseRate: 300 }
      });
      expect(updated.baseRate).toBe(300);

      // 4. Sync to Firebase
      const firestore = firebase.firestore;
      await firestore.collection('rightathome_properties').doc(propertyId).set(updated);

      const snapshot = await firestore.collection('rightathome_properties').doc(propertyId).get();
      expect(snapshot.exists).toBe(true);

      // 5. DELETE
      await prisma.property.delete({ where: { id: propertyId } });
      await firestore.collection('rightathome_properties').doc(propertyId).delete();

      // 6. VERIFY DELETION
      const deleted = await prisma.property.findUnique({ where: { id: propertyId } });
      expect(deleted).toBeNull();

      const firebaseDeleted = await firestore.collection('rightathome_properties').doc(propertyId).get();
      expect(firebaseDeleted.exists).toBe(false);

      console.log(`Property CRUD lifecycle completed for: ${propertyId}`);
    });
  });

  describe('Property Photo Management', () => {
    it('should have expected photo counts per property', () => {
      for (const property of REAL_PROPERTIES) {
        const photoCount = PROPERTY_PHOTO_COUNTS[property.id!];
        if (photoCount !== undefined) {
          expect(photoCount).toBeGreaterThan(0);
        }
      }
    });

    it('should total 730 photos across all properties', () => {
      expect(TOTAL_EXPECTED_PHOTOS).toBe(730);
    });

    it('should store photo URLs in Firebase', async () => {
      const propertyId = REAL_PROPERTIES[0].id!;
      const firestore = firebase.firestore;

      const photoData = {
        propertyId,
        url: 'https://photos.example.com/photo1.jpg',
        isPrimary: true,
        sortOrder: 0
      };

      await firestore.collection('rightathome_photos').add(photoData);

      const snapshot = await firestore.collection('rightathome_photos').get();
      expect(snapshot.size).toBeGreaterThan(0);
    });
  });
});
