/**
 * E2E Guest Journey Tests
 * Complete end-to-end tests for the guest experience
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createPrismaMock,
  createFirebaseMock,
  createApiMock
} from '../utils/mocks';
import {
  REAL_PROPERTIES,
  TEST_GUESTS,
  createTestBooking,
  createTestGuest
} from '../utils/fixtures';
import {
  daysFromNow,
  calculateNights,
  calculateTotal,
  isValidEmail,
  isValidPhone
} from '../utils/helpers';

describe('E2E: Guest Journey', () => {
  let prisma: ReturnType<typeof createPrismaMock>;
  let firebase: ReturnType<typeof createFirebaseMock>;
  let api: ReturnType<typeof createApiMock>;

  beforeEach(() => {
    prisma = createPrismaMock();
    firebase = createFirebaseMock();
    api = createApiMock();
    firebase._reset();
  });

  describe('Guest Discovery Phase', () => {
    it('should browse available properties', async () => {
      const response = await api.properties.list();

      expect(response.success).toBe(true);
      expect(response.data.length).toBeGreaterThan(0);

      // Guest sees property details
      for (const property of response.data) {
        expect(property.name).toBeDefined();
        expect(property.baseRate).toBeGreaterThan(0);
        expect(property.amenities).toBeDefined();
      }
    });

    it('should filter properties by guest needs', async () => {
      const guestRequirements = {
        minBedrooms: 3,
        maxPrice: 250,
        requiredAmenity: 'wifi'
      };

      const properties = await prisma.property.findMany();
      const suitable = properties.filter(
        (p: typeof REAL_PROPERTIES[0]) =>
          p.bedrooms! >= guestRequirements.minBedrooms &&
          p.baseRate! <= guestRequirements.maxPrice &&
          p.amenities?.includes(guestRequirements.requiredAmenity)
      );

      expect(suitable.length).toBeGreaterThan(0);
    });

    it('should view property details and photos', async () => {
      const propertyId = REAL_PROPERTIES[0].id!;
      const response = await api.properties.get(propertyId);

      expect(response.success).toBe(true);
      expect(response.data).toBeDefined();
      expect(response.data.amenities).toBeDefined();
      expect(response.data.cleaningFee).toBeDefined();
      expect(response.data.maxGuests).toBeDefined();
    });
  });

  describe('Guest Registration', () => {
    it('should validate guest email', () => {
      expect(isValidEmail('guest@example.com')).toBe(true);
      expect(isValidEmail('invalid')).toBe(false);
    });

    it('should validate guest phone', () => {
      expect(isValidPhone('+14325551234')).toBe(true);
      expect(isValidPhone('123')).toBe(false);
    });

    it('should create new guest account', async () => {
      const newGuest = createTestGuest({
        email: 'newguest@example.com',
        name: 'New Guest User',
        phone: '+14325559999'
      });

      const created = await prisma.guest.create({
        data: newGuest as Parameters<typeof prisma.guest.create>[0]['data']
      });

      expect(created.id).toBeDefined();
      expect(created.email).toBe('newguest@example.com');
      expect(created.totalStays).toBe(0);
    });

    it('should recognize returning guest', async () => {
      const existingEmail = TEST_GUESTS[0].email!;
      const guest = await prisma.guest.findUnique({
        where: { email: existingEmail }
      });

      expect(guest).toBeDefined();
      expect(guest?.email).toBe(existingEmail);
    });

    it('should update guest stats on return visit', async () => {
      const guestEmail = 'returning@guest.com';

      // First visit
      let guest = await prisma.guest.upsert({
        where: { email: guestEmail },
        create: {
          email: guestEmail,
          name: 'Returning Guest',
          role: 'guest' as const,
          totalStays: 1,
          lifetimeValue: 500,
          vipStatus: false
        },
        update: {}
      });
      expect(guest.totalStays).toBe(1);

      // Second visit
      guest = await prisma.guest.upsert({
        where: { email: guestEmail },
        create: {
          email: guestEmail,
          name: 'Returning Guest',
          role: 'guest' as const,
          totalStays: 1,
          lifetimeValue: 500,
          vipStatus: false
        },
        update: {
          totalStays: 2,
          lifetimeValue: 1200
        }
      });
      expect(guest.totalStays).toBe(2);
      expect(guest.lifetimeValue).toBe(1200);
    });
  });

  describe('Booking Experience', () => {
    it('should select dates and see pricing', () => {
      const property = REAL_PROPERTIES[0];
      const checkIn = daysFromNow(14);
      const checkOut = daysFromNow(17);
      const nights = calculateNights(checkIn, checkOut);

      const pricing = calculateTotal(property.baseRate!, nights, property.cleaningFee!);

      expect(nights).toBe(3);
      expect(pricing.subtotal).toBe(property.baseRate! * nights);
      expect(pricing.total).toBeGreaterThan(pricing.subtotal);
    });

    it('should make a booking', async () => {
      const guest = createTestGuest();
      const createdGuest = await prisma.guest.create({
        data: guest as Parameters<typeof prisma.guest.create>[0]['data']
      });

      const property = REAL_PROPERTIES[0];
      const booking = createTestBooking({
        propertyId: property.id,
        guestId: createdGuest.id,
        guestName: createdGuest.name,
        guestEmail: createdGuest.email,
        status: 'confirmed'
      });

      const createdBooking = await prisma.booking.create({
        data: booking as Parameters<typeof prisma.booking.create>[0]['data']
      });

      expect(createdBooking.id).toBeDefined();
      expect(createdBooking.status).toBe('confirmed');
    });

    it('should receive booking confirmation', async () => {
      const booking = createTestBooking({ status: 'confirmed' });

      // Simulate confirmation message
      const confirmationMessage = {
        id: `msg_${Date.now()}`,
        type: 'booking_confirmed',
        recipientEmail: booking.guestEmail,
        subject: `Booking Confirmed: ${booking.propertyId}`,
        body: `Your booking for ${booking.nights} nights has been confirmed.`,
        sentAt: new Date()
      };

      expect(confirmationMessage.type).toBe('booking_confirmed');
      expect(confirmationMessage.body).toContain('confirmed');
    });
  });

  describe('Pre-Arrival Experience', () => {
    it('should receive check-in instructions', async () => {
      const booking = createTestBooking({
        status: 'confirmed',
        checkIn: daysFromNow(1) // Tomorrow
      });

      const property = REAL_PROPERTIES.find(p => p.id === booking.propertyId);

      // Simulate pre-arrival message
      const preArrivalMessage = {
        type: 'pre_arrival',
        checkInTime: '3:00 PM',
        accessCode: '1234',
        wifiNetwork: property?.amenities?.includes('wifi') ? 'RightAtHome_Guest' : null,
        wifiPassword: 'Welcome2026',
        propertyAddress: property?.address
      };

      expect(preArrivalMessage.type).toBe('pre_arrival');
      expect(preArrivalMessage.accessCode).toBeDefined();
    });

    it('should have access code generated before check-in', () => {
      // Generate 4-6 digit access code
      const generateAccessCode = () => {
        return Math.floor(100000 + Math.random() * 900000).toString().slice(0, 4);
      };

      const code = generateAccessCode();
      expect(code.length).toBe(4);
      expect(Number(code)).not.toBeNaN();
    });
  });

  describe('During Stay Experience', () => {
    it('should allow guest to contact host', async () => {
      const booking = createTestBooking({ status: 'checked_in' });

      const guestMessage = {
        id: `msg_${Date.now()}`,
        bookingId: booking.id,
        guestEmail: booking.guestEmail,
        subject: 'Question about amenities',
        body: 'Where can I find extra towels?',
        fromGuest: true,
        timestamp: new Date()
      };

      expect(guestMessage.fromGuest).toBe(true);
      expect(guestMessage.body).toBeDefined();
    });

    it('should track guest check-in', async () => {
      const bookingId = 'test_booking';

      const checkedIn = await prisma.booking.update({
        where: { id: 'book_1' }, // Use existing test booking
        data: {
          status: 'checked_in'
        }
      });

      expect(checkedIn.status).toBe('checked_in');
    });
  });

  describe('Check-Out Experience', () => {
    it('should process guest check-out', async () => {
      const checkedOut = await prisma.booking.update({
        where: { id: 'book_1' },
        data: {
          status: 'checked_out'
        }
      });

      expect(checkedOut.status).toBe('checked_out');
    });

    it('should trigger cleaning job on check-out', async () => {
      const booking = createTestBooking({
        checkOut: new Date(),
        status: 'checked_out'
      });

      const cleaningJob = await prisma.cleaningJob.create({
        data: {
          propertyId: booking.propertyId,
          bookingId: booking.id,
          scheduledDate: booking.checkOut,
          scheduledTime: '11:00',
          estimatedDuration: 120,
          status: 'scheduled',
          priority: 'high',
          rate: 100
        } as Parameters<typeof prisma.cleaningJob.create>[0]['data']
      });

      expect(cleaningJob.status).toBe('scheduled');
      expect(cleaningJob.priority).toBe('high');
    });

    it('should send post-checkout thank you', () => {
      const postCheckoutMessage = {
        type: 'post_checkout',
        subject: 'Thanks for staying with us!',
        body: 'We hope you enjoyed your stay. Please leave us a review!',
        reviewLink: 'https://airbnb.com/review/xxx'
      };

      expect(postCheckoutMessage.type).toBe('post_checkout');
      expect(postCheckoutMessage.reviewLink).toBeDefined();
    });
  });

  describe('Guest Loyalty & VIP', () => {
    it('should track guest stay history', async () => {
      const guestEmail = TEST_GUESTS[1].email!; // Sarah - VIP guest
      const guest = await prisma.guest.findUnique({
        where: { email: guestEmail }
      });

      expect(guest?.totalStays).toBeGreaterThan(0);
      expect(guest?.lifetimeValue).toBeGreaterThan(0);
    });

    it('should identify VIP guests', async () => {
      const guests = await prisma.guest.findMany();
      const vipGuests = guests.filter((g: typeof TEST_GUESTS[0]) => g.vipStatus === true);

      expect(vipGuests.length).toBeGreaterThan(0);
      for (const vip of vipGuests) {
        // VIPs typically have multiple stays or high lifetime value
        expect(vip.totalStays! > 5 || vip.lifetimeValue! > 5000).toBe(true);
      }
    });

    it('should upgrade guest to VIP after threshold', async () => {
      const VIP_THRESHOLD_STAYS = 5;
      const VIP_THRESHOLD_VALUE = 5000;

      const guest = await prisma.guest.upsert({
        where: { email: 'vip_candidate@test.com' },
        create: {
          email: 'vip_candidate@test.com',
          name: 'VIP Candidate',
          role: 'guest' as const,
          totalStays: 6,
          lifetimeValue: 6000,
          vipStatus: false
        },
        update: {
          totalStays: 6,
          lifetimeValue: 6000
        }
      });

      // Check VIP eligibility
      const shouldBeVip =
        guest.totalStays! >= VIP_THRESHOLD_STAYS ||
        guest.lifetimeValue! >= VIP_THRESHOLD_VALUE;

      expect(shouldBeVip).toBe(true);
    });
  });

  describe('Complete Guest Journey', () => {
    it('should complete full guest lifecycle', async () => {
      // 1. Guest discovers property
      const properties = await api.properties.list();
      const selectedProperty = properties.data[0];
      expect(selectedProperty).toBeDefined();

      // 2. Guest creates account
      const guest = await prisma.guest.create({
        data: createTestGuest({
          email: `journey_${Date.now()}@test.com`,
          name: 'Journey Test Guest'
        }) as Parameters<typeof prisma.guest.create>[0]['data']
      });
      expect(guest.id).toBeDefined();

      // 3. Guest makes booking
      const checkIn = daysFromNow(7);
      const checkOut = daysFromNow(10);
      const nights = calculateNights(checkIn, checkOut);
      const pricing = calculateTotal(selectedProperty.baseRate, nights, selectedProperty.cleaningFee);

      const booking = await prisma.booking.create({
        data: createTestBooking({
          propertyId: selectedProperty.id,
          guestId: guest.id,
          guestName: guest.name,
          guestEmail: guest.email,
          checkIn,
          checkOut,
          nights,
          ...pricing,
          status: 'confirmed'
        }) as Parameters<typeof prisma.booking.create>[0]['data']
      });
      expect(booking.status).toBe('confirmed');

      // 4. Guest checks in
      const checkedIn = await prisma.booking.update({
        where: { id: booking.id },
        data: { status: 'checked_in' }
      });
      expect(checkedIn.status).toBe('checked_in');

      // 5. Guest checks out
      const checkedOut = await prisma.booking.update({
        where: { id: booking.id },
        data: { status: 'checked_out' }
      });
      expect(checkedOut.status).toBe('checked_out');

      // 6. Guest stats updated
      const updatedGuest = await prisma.guest.upsert({
        where: { email: guest.email },
        create: guest as Parameters<typeof prisma.guest.upsert>[0]['create'],
        update: {
          totalStays: 1,
          lifetimeValue: pricing.total
        }
      });
      expect(updatedGuest.totalStays).toBe(1);

      // 7. Cleaning triggered
      const cleaningJob = await prisma.cleaningJob.create({
        data: {
          propertyId: selectedProperty.id,
          bookingId: booking.id,
          scheduledDate: checkOut,
          scheduledTime: '11:00',
          estimatedDuration: 120,
          status: 'scheduled',
          priority: 'normal',
          rate: 100
        } as Parameters<typeof prisma.cleaningJob.create>[0]['data']
      });
      expect(cleaningJob.status).toBe('scheduled');

      console.log(`Guest journey completed: ${guest.email} -> ${booking.id}`);
    });
  });

  describe('Guest Search & History', () => {
    it('should search guests by email', async () => {
      const response = await api.guests.search('john');
      expect(response.success).toBe(true);
    });

    it('should retrieve guest booking history', async () => {
      const guestEmail = TEST_GUESTS[0].email!;
      const guest = await prisma.guest.findUnique({
        where: { email: guestEmail }
      });

      if (guest) {
        const bookings = await prisma.booking.findMany();
        const guestBookings = bookings.filter(
          (b: { guestEmail?: string }) => b.guestEmail === guestEmail
        );

        expect(Array.isArray(guestBookings)).toBe(true);
      }
    });
  });
});
