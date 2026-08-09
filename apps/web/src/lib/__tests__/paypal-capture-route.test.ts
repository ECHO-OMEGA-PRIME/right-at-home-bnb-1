import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  bookingFindUnique: vi.fn(),
  bookingUpdate: vi.fn(),
  getPayPalOrder: vi.fn(),
  capturePayPalOrder: vi.fn(),
  createAndSendInvoice: vi.fn(),
}));

vi.mock('@/lib/prisma', () => {
  const prisma = {
    booking: {
      findUnique: mocks.bookingFindUnique,
      update: mocks.bookingUpdate,
    },
  };
  return { default: prisma, prisma };
});

vi.mock('@/lib/integrations/paypal-client', () => ({
  getPayPalOrder: mocks.getPayPalOrder,
  capturePayPalOrder: mocks.capturePayPalOrder,
  createAndSendInvoice: mocks.createAndSendInvoice,
}));

import { POST } from '../../../app/api/bookings/capture/route';

function request(body: Record<string, unknown>) {
  return new NextRequest('https://rah-midland.com/api/bookings/capture', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function pendingBooking(overrides: Record<string, unknown> = {}) {
  return {
    id: 'booking-1',
    confirmCode: 'RAH-BOOKING-1',
    paypalOrderRef: 'RAH-BOOKING-1',
    paypalCaptureId: null,
    totalPrice: 725,
    status: 'PENDING',
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.bookingFindUnique.mockResolvedValue(pendingBooking());
});

describe('POST /api/bookings/capture', () => {
  it('returns the existing capture on a retry without calling PayPal again', async () => {
    mocks.bookingFindUnique.mockResolvedValue(
      pendingBooking({ status: 'CONFIRMED', paypalCaptureId: 'capture-existing' }),
    );

    const response = await POST(
      request({ paypalOrderId: 'order-existing', bookingId: 'booking-1' }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ alreadyCaptured: true, transactionId: 'capture-existing' });
    expect(mocks.getPayPalOrder).not.toHaveBeenCalled();
    expect(mocks.capturePayPalOrder).not.toHaveBeenCalled();
    expect(mocks.bookingUpdate).not.toHaveBeenCalled();
  });

  it('rejects a mismatched booking reference before capture', async () => {
    mocks.getPayPalOrder.mockResolvedValue({
      status: 'APPROVED',
      referenceId: 'another-booking',
      amount: 725,
      currency: 'USD',
    });

    const response = await POST(
      request({ paypalOrderId: 'order-1', bookingId: 'booking-1' }),
    );

    expect(response.status).toBe(400);
    expect(mocks.capturePayPalOrder).not.toHaveBeenCalled();
    expect(mocks.bookingUpdate).not.toHaveBeenCalled();
  });

  it('rejects a mismatched amount before capture', async () => {
    mocks.getPayPalOrder.mockResolvedValue({
      status: 'APPROVED',
      referenceId: 'RAH-BOOKING-1',
      amount: 1,
      currency: 'USD',
    });

    const response = await POST(
      request({ paypalOrderId: 'order-1', bookingId: 'booking-1' }),
    );

    expect(response.status).toBe(400);
    expect(mocks.capturePayPalOrder).not.toHaveBeenCalled();
    expect(mocks.bookingUpdate).not.toHaveBeenCalled();
  });

  it('captures only after the order is verified and persists the capture id', async () => {
    mocks.getPayPalOrder.mockResolvedValue({
      status: 'APPROVED',
      referenceId: 'RAH-BOOKING-1',
      amount: 725,
      currency: 'USD',
    });
    mocks.capturePayPalOrder.mockResolvedValue({
      status: 'COMPLETED',
      referenceId: 'RAH-BOOKING-1',
      amount: 725,
      currency: 'USD',
      transactionId: 'capture-new',
    });
    mocks.bookingUpdate.mockResolvedValue({
      id: 'booking-1',
      propertyId: 'property-1',
      checkIn: new Date('2026-09-01T00:00:00.000Z'),
      checkOut: new Date('2026-09-03T00:00:00.000Z'),
      totalNights: 2,
      nightlyRate: 300,
      cleaningFee: 125,
      totalPrice: 725,
      confirmCode: 'capture-new',
      guest: { name: 'Guest', email: 'guest@example.test' },
    });
    mocks.createAndSendInvoice.mockResolvedValue({ invoiceId: 'invoice-1', invoiceUrl: '' });

    const response = await POST(
      request({ paypalOrderId: 'order-1', bookingId: 'booking-1' }),
    );

    expect(response.status).toBe(200);
    expect(mocks.getPayPalOrder).toHaveBeenCalledWith('order-1');
    expect(mocks.capturePayPalOrder).toHaveBeenCalledWith('order-1');
    expect(mocks.getPayPalOrder.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.capturePayPalOrder.mock.invocationCallOrder[0],
    );
    expect(mocks.bookingUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'booking-1' },
        data: expect.objectContaining({
          status: 'CONFIRMED',
          paypalCaptureId: 'capture-new',
        }),
      }),
    );
  });
});
