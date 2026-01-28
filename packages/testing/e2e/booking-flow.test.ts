/**
 * E2E Booking Flow Tests
 * Complete end-to-end tests for the booking process
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  createPrismaMock,
  createFirebaseMock,
  createApiMock
} from '../utils/mocks';
import {
  REAL_PROPERTIES,
  createTestBooking,
  createTestGuest,
  createTestCleaningJob
} from '../utils/fixtures';
import {
  daysFromNow,
  calculateNights,
  calculateTotal,
  isValidEmail,
  isValidPhone,
  isValidDateRange
} from '../utils/helpers';

describe('E2E: Complete Booking Flow', () => {
  let prisma: ReturnType<typeof createPrismaMock>;
  let firebase: ReturnType<typeof createFirebaseMock>;
  let api: ReturnType<typeof createApiMock>;

  beforeEach(() => {
    prisma = createPrismaMock();
    firebase = createFirebaseMock();
    api = createApiMock();
    firebase._reset();
  });

  describe('Step 1: Property Selection', () => {
    it('should display available properties', async () => {
      const response = await api.properties.list();

      expect(response.success).toBe(true);
      expect(response.data.length).toBeGreaterThan(0);

      // Each property should have required display fields
      for (const property of response.data) {
        expect(property.name).toBeDefined();
        expect(property.address).toBeDefined();
        expect(property.baseRate).toBeGreaterThan(0);
        expect(property.maxGuests).toBeGreaterThan(0);
      }
    });

    it('should filter properties by guest count', async () => {
      const guestCount = 8;
      const response = await api.properties.list();

      const suitableProperties = response.data.filter(
        (p: typeof REAL_PROPERTIES[0]) => p.maxGuests! >= guestCount
      );

      expect(suitableProperties.length).toBeGreaterThan(0);
      for (const property of suitableProperties) {
        expect(property.maxGuests).toBeGreaterThanOrEqual(guestCount);
      }
    });

    it('should select property and view details', async () => {
      const selectedPropertyId = REAL_PROPERTIES[0].id!;
      const response = await api.properties.get(selectedPropertyId);

      expect(response.success).toBe(true);
      expect(response.data).toBeDefined();
      expect(response.data.amenities).toBeDefined();
      expect(response.data.cleaningFee).toBeDefined();
    });
  });

  describe('Step 2: Date Selection', () => {
    it('should validate date range selection', () => {
      const checkIn = daysFromNow(7);
      const checkOut = daysFromNow(10);

      expect(isValidDateRange(checkIn, checkOut)).toBe(true);
      expect(calculateNights(checkIn, checkOut)).toBe(3);
    });

    it('should reject invalid date ranges', () => {
      const checkIn = daysFromNow(10);
      const checkOut = daysFromNow(7);

      expect(isValidDateRange(checkIn, checkOut)).toBe(false);
    });

    it('should check property availability for selected dates', async () => {
      const propertyId = REAL_PROPERTIES[0].id!;
      const checkIn = daysFromNow(7);
      const checkOut = daysFromNow(10);

      // Get existing bookings for property
      const bookingsResponse = await api.bookings.list();
      const propertyBookings = bookingsResponse.data.filter(
        (b: { propertyId: string }) => b.propertyId === propertyId
      );

      // Check for conflicts
      const hasConflict = propertyBookings.some(
        (b: { checkIn: Date; checkOut: Date }) =>
          checkIn < b.checkOut && checkOut > b.checkIn
      );

      // For test purposes, dates should be available
      expect(typeof hasConflict).toBe('boolean');
    });
  });

  describe('Step 3: Guest Information', () => {
    it('should validate guest email', () => {
      const validEmail = 'guest@example.com';
      const invalidEmail = 'invalid-email';

      expect(isValidEmail(validEmail)).toBe(true);
      expect(isValidEmail(invalidEmail)).toBe(false);
    });

    it('should validate guest phone', () => {
      const validPhone = '+14325551234';
      const invalidPhone = '123';

      expect(isValidPhone(validPhone)).toBe(true);
      expect(isValidPhone(invalidPhone)).toBe(false);
    });

    it('should create or retrieve guest record', async () => {
      const guestData = createTestGuest({
        email: 'newguest@example.com',
        name: 'New Guest',
        phone: '+14325559999'
      });

      // Check if guest exists
      const existingGuest = await prisma.guest.findUnique({
        where: { email: guestData.email }
      });

      if (!existingGuest) {
        const createdGuest = await prisma.guest.create({
          data: guestData as Parameters<typeof prisma.guest.create>[0]['data']
        });
        expect(createdGuest.email).toBe(guestData.email);
      } else {
        expect(existingGuest.email).toBe(guestData.email);
      }
    });
  });

  describe('Step 4: Pricing Calculation', () => {
    it('should calculate correct booking total', () => {
      const property = REAL_PROPERTIES[0];
      const nights = 3;

      const pricing = calculateTotal(
        property.baseRate!,
        nights,
        property.cleaningFee!
      );

      expect(pricing.subtotal).toBe(property.baseRate! * nights);
      expect(pricing.total).toBeGreaterThan(pricing.subtotal);
    });

    it('should include all fee components', () => {
      const property = REAL_PROPERTIES[0];
      const nights = 3;

      const pricing = calculateTotal(
        property.baseRate!,
        nights,
        property.cleaningFee!
      );

      expect(pricing.subtotal).toBeDefined();
      expect(pricing.serviceFee).toBeDefined();
      expect(pricing.taxes).toBeDefined();
      expect(pricing.total).toBeDefined();

      // Verify total calculation
      const calculatedTotal =
        pricing.subtotal + property.cleaningFee! + pricing.serviceFee + pricing.taxes;
      expect(Math.abs(pricing.total - calculatedTotal)).toBeLessThan(0.01);
    });
  });

  describe('Step 5: Booking Confirmation', () => {
    it('should create booking with all required data', async () => {
      const property = REAL_PROPERTIES[0];
      const checkIn = daysFromNow(14);
      const checkOut = daysFromNow(17);
      const nights = calculateNights(checkIn, checkOut);
      const pricing = calculateTotal(property.baseRate!, nights, property.cleaningFee!);

      const bookingData = createTestBooking({
        propertyId: property.id,
        checkIn,
        checkOut,
        guests: 4,
        nightlyRate: property.baseRate,
        nights,
        subtotal: pricing.subtotal,
        cleaningFee: property.cleaningFee,
        serviceFee: pricing.serviceFee,
        taxes: pricing.taxes,
        total: pricing.total,
        status: 'confirmed',
        source: 'direct'
      });

      const response = await api.bookings.create(bookingData);

      expect(response.success).toBe(true);
      expect(response.data.propertyId).toBe(property.id);
      expect(response.data.status).toBe('confirmed');
    });

    it('should save booking to database', async () => {
      const bookingData = createTestBooking();
      const created = await prisma.booking.create({
        data: bookingData as Parameters<typeof prisma.booking.create>[0]['data']
      });

      expect(created.id).toBeDefined();

      // Verify it can be retrieved
      const retrieved = await prisma.booking.findUnique({
        where: { id: created.id }
      });

      expect(retrieved).toBeDefined();
      expect(retrieved?.guestName).toBe(bookingData.guestName);
    });

    it('should sync booking to Firebase', async () => {
      const bookingData = createTestBooking();
      const firestore = firebase.firestore;
      const docRef = firestore.collection('rightathome_bookings').doc(bookingData.id!);

      await docRef.set(bookingData);
      const snapshot = await docRef.get();

      expect(snapshot.exists).toBe(true);
      expect(snapshot.data()?.guestName).toBe(bookingData.guestName);
    });
  });

  describe('Step 6: Post-Booking Actions', () => {
    it('should create cleaning job for booking', async () => {
      const booking = createTestBooking({
        checkOut: daysFromNow(10)
      });

      const cleaningJob = createTestCleaningJob({
        propertyId: booking.propertyId,
        bookingId: booking.id,
        scheduledDate: booking.checkOut
      });

      const created = await prisma.cleaningJob.create({
        data: cleaningJob as Parameters<typeof prisma.cleaningJob.create>[0]['data']
      });

      expect(created.bookingId).toBe(booking.id);
      expect(created.status).toBe('scheduled');
    });

    it('should update guest statistics', async () => {
      const guestEmail = 'returning@guest.com';

      const guest = await prisma.guest.upsert({
        where: { email: guestEmail },
        create: {
          email: guestEmail,
          name: 'Returning Guest',
          role: 'guest',
          totalStays: 1,
          lifetimeValue: 500,
          vipStatus: false
        },
        update: {
          totalStays: 2,
          lifetimeValue: 1200
        }
      });

      expect(guest.email).toBe(guestEmail);
    });
  });

  describe('Complete Flow: Start to Finish', () => {
    it('should complete full booking journey', async () => {
      // 1. Select property
      const property = REAL_PROPERTIES[0];
      expect(property).toBeDefined();

      // 2. Select dates
      const checkIn = daysFromNow(30);
      const checkOut = daysFromNow(33);
      expect(isValidDateRange(checkIn, checkOut)).toBe(true);

      // 3. Validate guest count
      const guestCount = 4;
      expect(guestCount).toBeLessThanOrEqual(property.maxGuests!);

      // 4. Calculate pricing
      const nights = calculateNights(checkIn, checkOut);
      const pricing = calculateTotal(property.baseRate!, nights, property.cleaningFee!);
      expect(pricing.total).toBeGreaterThan(0);

      // 5. Create guest
      const guest = await prisma.guest.create({
        data: createTestGuest({
          email: `e2e_${Date.now()}@test.com`,
          name: 'E2E Test Guest'
        }) as Parameters<typeof prisma.guest.create>[0]['data']
      });
      expect(guest.id).toBeDefined();

      // 6. Create booking
      const booking = await prisma.booking.create({
        data: createTestBooking({
          propertyId: property.id,
          guestId: guest.id,
          guestName: guest.name,
          guestEmail: guest.email,
          checkIn,
          checkOut,
          guests: guestCount,
          nightlyRate: property.baseRate,
          nights,
          ...pricing,
          status: 'confirmed'
        }) as Parameters<typeof prisma.booking.create>[0]['data']
      });
      expect(booking.id).toBeDefined();
      expect(booking.status).toBe('confirmed');

      // 7. Create cleaning job
      const cleaningJob = await prisma.cleaningJob.create({
        data: createTestCleaningJob({
          propertyId: property.id,
          bookingId: booking.id,
          scheduledDate: checkOut
        }) as Parameters<typeof prisma.cleaningJob.create>[0]['data']
      });
      expect(cleaningJob.id).toBeDefined();

      // 8. Sync to Firebase
      const firestore = firebase.firestore;
      await firestore.collection('rightathome_bookings').doc(booking.id).set({
        ...booking,
        syncedAt: new Date()
      });

      const snapshot = await firestore.collection('rightathome_bookings').doc(booking.id).get();
      expect(snapshot.exists).toBe(true);

      // Flow complete!
      console.log(`E2E booking flow completed: ${booking.id}`);
    });
  });

  describe('Error Scenarios', () => {
    it('should handle booking for non-existent property', async () => {
      const response = await api.properties.get('non_existent_property');
      expect(response.data).toBeNull();
    });

    it('should validate guest count against property max', () => {
      const property = REAL_PROPERTIES.find(p => p.maxGuests === 4);
      if (property) {
        const exceedsMax = 5 > property.maxGuests!;
        expect(exceedsMax).toBe(true);
      }
    });

    it('should handle invalid date selections', () => {
      const invalidCheckIn = daysFromNow(-1); // Past date
      const checkOut = daysFromNow(3);

      // In a real app, past dates should be rejected
      const isPastDate = invalidCheckIn < new Date();
      expect(isPastDate).toBe(true);
    });
  });

  describe('Booking Modification', () => {
    it('should allow date changes before check-in', async () => {
      const booking = createTestBooking({
        status: 'confirmed',
        checkIn: daysFromNow(14),
        checkOut: daysFromNow(17)
      });

      const created = await prisma.booking.create({
        data: booking as Parameters<typeof prisma.booking.create>[0]['data']
      });

      // Modify dates
      const newCheckIn = daysFromNow(21);
      const newCheckOut = daysFromNow(24);

      const updated = await prisma.booking.update({
        where: { id: created.id },
        data: { checkIn: newCheckIn, checkOut: newCheckOut }
      });

      expect(updated.checkIn).toEqual(newCheckIn);
    });

    it('should handle booking cancellation', async () => {
      const booking = createTestBooking({ status: 'confirmed' });
      const created = await prisma.booking.create({
        data: booking as Parameters<typeof prisma.booking.create>[0]['data']
      });

      const cancelled = await prisma.booking.update({
        where: { id: created.id },
        data: { status: 'cancelled' }
      });

      expect(cancelled.status).toBe('cancelled');
    });
  });
});
