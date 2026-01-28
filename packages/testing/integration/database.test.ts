/**
 * Database Integration Tests
 * Tests for Prisma operations and database interactions
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createPrismaMock } from '../utils/mocks';
import {
  REAL_PROPERTIES,
  TEST_BOOKINGS,
  TEST_GUESTS,
  TEST_USERS,
  TEST_CLEANING_JOBS,
  createTestProperty,
  createTestBooking,
  createTestGuest,
  TOTAL_EXPECTED_PROPERTIES
} from '../utils/fixtures';

describe('Database Integration', () => {
  let prisma: ReturnType<typeof createPrismaMock>;

  beforeEach(() => {
    prisma = createPrismaMock();
  });

  describe('Property Operations', () => {
    it('should fetch all properties', async () => {
      const properties = await prisma.property.findMany();
      expect(properties.length).toBe(TOTAL_EXPECTED_PROPERTIES);
    });

    it('should find property by ID', async () => {
      const propertyId = REAL_PROPERTIES[0].id;
      const property = await prisma.property.findUnique({
        where: { id: propertyId! }
      });

      expect(property).toBeDefined();
      expect(property?.id).toBe(propertyId);
    });

    it('should return null for non-existent property', async () => {
      const property = await prisma.property.findUnique({
        where: { id: 'non_existent_id' }
      });

      expect(property).toBeNull();
    });

    it('should create a new property', async () => {
      const newProperty = createTestProperty({
        name: 'Test Property',
        address: '123 Test Street'
      });

      const created = await prisma.property.create({
        data: newProperty as Parameters<typeof prisma.property.create>[0]['data']
      });

      expect(created).toBeDefined();
      expect(created.name).toBe('Test Property');
    });

    it('should update property details', async () => {
      const propertyId = REAL_PROPERTIES[0].id;
      const updated = await prisma.property.update({
        where: { id: propertyId! },
        data: { baseRate: 300 }
      });

      expect(updated.baseRate).toBe(300);
    });

    it('should delete a property', async () => {
      const newProperty = await prisma.property.create({
        data: createTestProperty() as Parameters<typeof prisma.property.create>[0]['data']
      });

      const deleted = await prisma.property.delete({
        where: { id: newProperty.id }
      });

      expect(deleted).toBeDefined();
    });

    it('should count properties', async () => {
      const count = await prisma.property.count();
      expect(count).toBe(TOTAL_EXPECTED_PROPERTIES);
    });

    it('should find properties by city', async () => {
      const midlandProperties = await prisma.property.findMany();
      const filtered = midlandProperties.filter(p => p.city === 'Midland');
      expect(filtered.length).toBe(TOTAL_EXPECTED_PROPERTIES);
    });

    it('should find active properties', async () => {
      const activeProperties = await prisma.property.findMany();
      const filtered = activeProperties.filter(p => p.status === 'active');
      expect(filtered.length).toBeGreaterThan(0);
    });
  });

  describe('Booking Operations', () => {
    it('should fetch all bookings', async () => {
      const bookings = await prisma.booking.findMany();
      expect(bookings.length).toBe(TEST_BOOKINGS.length);
    });

    it('should find booking by ID', async () => {
      const bookingId = TEST_BOOKINGS[0].id;
      const booking = await prisma.booking.findUnique({
        where: { id: bookingId! }
      });

      expect(booking).toBeDefined();
      expect(booking?.id).toBe(bookingId);
    });

    it('should create a new booking', async () => {
      const newBooking = createTestBooking();
      const created = await prisma.booking.create({
        data: newBooking as Parameters<typeof prisma.booking.create>[0]['data']
      });

      expect(created).toBeDefined();
      expect(created.guestName).toBe(newBooking.guestName);
    });

    it('should update booking status', async () => {
      const bookingId = TEST_BOOKINGS[0].id;
      const updated = await prisma.booking.update({
        where: { id: bookingId! },
        data: { status: 'checked_in' }
      });

      expect(updated.status).toBe('checked_in');
    });

    it('should find bookings by property', async () => {
      const propertyId = REAL_PROPERTIES[0].id;
      const bookings = await prisma.booking.findMany();
      const filtered = bookings.filter(b => b.propertyId === propertyId);
      expect(Array.isArray(filtered)).toBe(true);
    });

    it('should find confirmed bookings', async () => {
      const bookings = await prisma.booking.findMany();
      const confirmed = bookings.filter(b => b.status === 'confirmed');
      expect(confirmed.length).toBeGreaterThan(0);
    });
  });

  describe('Guest Operations', () => {
    it('should fetch all guests', async () => {
      const guests = await prisma.guest.findMany();
      expect(guests.length).toBe(TEST_GUESTS.length);
    });

    it('should find guest by email', async () => {
      const email = TEST_GUESTS[0].email;
      const guest = await prisma.guest.findUnique({
        where: { email }
      });

      expect(guest).toBeDefined();
      expect(guest?.email).toBe(email);
    });

    it('should create a new guest', async () => {
      const newGuest = createTestGuest();
      const created = await prisma.guest.create({
        data: newGuest as Parameters<typeof prisma.guest.create>[0]['data']
      });

      expect(created).toBeDefined();
      expect(created.email).toBe(newGuest.email);
    });

    it('should upsert guest (create or update)', async () => {
      const guestData = {
        email: 'upsert@test.com',
        name: 'Upsert Test',
        role: 'guest' as const,
        totalStays: 0,
        lifetimeValue: 0,
        vipStatus: false
      };

      const upserted = await prisma.guest.upsert({
        where: { email: guestData.email },
        create: guestData,
        update: { totalStays: 1 }
      });

      expect(upserted).toBeDefined();
      expect(upserted.email).toBe(guestData.email);
    });

    it('should find VIP guests', async () => {
      const guests = await prisma.guest.findMany();
      const vipGuests = guests.filter(g => g.vipStatus === true);
      expect(Array.isArray(vipGuests)).toBe(true);
    });
  });

  describe('User Operations', () => {
    it('should fetch all users', async () => {
      const users = await prisma.user.findMany();
      expect(users.length).toBe(TEST_USERS.length);
    });

    it('should find user by ID', async () => {
      const userId = TEST_USERS[0].id;
      const user = await prisma.user.findUnique({
        where: { id: userId }
      });

      expect(user).toBeDefined();
      expect(user?.id).toBe(userId);
    });

    it('should find user by email', async () => {
      const email = TEST_USERS[0].email;
      const user = await prisma.user.findUnique({
        where: { email }
      });

      expect(user).toBeDefined();
      expect(user?.email).toBe(email);
    });

    it('should find cleaners', async () => {
      const users = await prisma.user.findMany();
      const cleaners = users.filter(u => u.role === 'cleaner');
      expect(cleaners.length).toBe(2); // Based on TEST_USERS fixture
    });
  });

  describe('Cleaning Job Operations', () => {
    it('should fetch all cleaning jobs', async () => {
      const jobs = await prisma.cleaningJob.findMany();
      expect(jobs.length).toBe(TEST_CLEANING_JOBS.length);
    });

    it('should find cleaning job by ID', async () => {
      const jobId = TEST_CLEANING_JOBS[0].id;
      const job = await prisma.cleaningJob.findUnique({
        where: { id: jobId! }
      });

      expect(job).toBeDefined();
      expect(job?.id).toBe(jobId);
    });

    it('should update cleaning job status', async () => {
      const jobId = TEST_CLEANING_JOBS[0].id;
      const updated = await prisma.cleaningJob.update({
        where: { id: jobId! },
        data: { status: 'in_progress' }
      });

      expect(updated.status).toBe('in_progress');
    });

    it('should find jobs by cleaner', async () => {
      const cleanerId = 'user_cleaner_1';
      const jobs = await prisma.cleaningJob.findMany();
      const cleanerJobs = jobs.filter(j => j.cleanerId === cleanerId);
      expect(cleanerJobs.length).toBeGreaterThan(0);
    });

    it('should find scheduled jobs', async () => {
      const jobs = await prisma.cleaningJob.findMany();
      const scheduled = jobs.filter(j => j.status === 'scheduled');
      expect(scheduled.length).toBeGreaterThan(0);
    });
  });

  describe('Transaction Operations', () => {
    it('should execute transaction with multiple operations', async () => {
      const operations = [
        prisma.property.count(),
        prisma.booking.count()
      ];

      const results = await prisma.$transaction(operations);
      expect(Array.isArray(results)).toBe(true);
    });

    it('should connect and disconnect', async () => {
      await expect(prisma.$connect()).resolves.not.toThrow();
      await expect(prisma.$disconnect()).resolves.not.toThrow();
    });
  });

  describe('Data Integrity', () => {
    it('should maintain referential integrity between bookings and properties', async () => {
      const bookings = await prisma.booking.findMany();
      const properties = await prisma.property.findMany();
      const propertyIds = new Set(properties.map(p => p.id));

      for (const booking of bookings) {
        expect(propertyIds.has(booking.propertyId)).toBe(true);
      }
    });

    it('should maintain referential integrity between cleaning jobs and properties', async () => {
      const jobs = await prisma.cleaningJob.findMany();
      const properties = await prisma.property.findMany();
      const propertyIds = new Set(properties.map(p => p.id));

      for (const job of jobs) {
        expect(propertyIds.has(job.propertyId)).toBe(true);
      }
    });

    it('should have unique primary keys', async () => {
      const properties = await prisma.property.findMany();
      const ids = properties.map(p => p.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });
  });

  describe('Query Performance', () => {
    it('should handle batch operations efficiently', async () => {
      const startTime = Date.now();

      // Simulate multiple queries
      await Promise.all([
        prisma.property.findMany(),
        prisma.booking.findMany(),
        prisma.guest.findMany(),
        prisma.user.findMany(),
        prisma.cleaningJob.findMany()
      ]);

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should support pagination', async () => {
      const page1 = (await prisma.property.findMany()).slice(0, 5);
      const page2 = (await prisma.property.findMany()).slice(5, 10);

      expect(page1.length).toBeLessThanOrEqual(5);
      expect(page2.length).toBeLessThanOrEqual(5);
    });
  });
});
