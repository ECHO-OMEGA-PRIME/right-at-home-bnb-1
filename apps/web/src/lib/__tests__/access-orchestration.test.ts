import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const bookingFindUnique = vi.fn();
  const bookingFindMany = vi.fn();
  const bookingUpdate = vi.fn();
  const accessGrantFindMany = vi.fn();
  const accessGrantCreate = vi.fn();
  const accessGrantUpdate = vi.fn();
  const smartLockUpdate = vi.fn();
  const smartLockUpdateMany = vi.fn();
  const auditLogCreate = vi.fn();
  const queryRaw = vi.fn();
  const createGuestCode = vi.fn();
  const assertCodePresent = vi.fn();
  const deleteCode = vi.fn();
  const generateSecurePin = vi.fn();
  const isTuyaConfigured = vi.fn();
  const deliverSensitiveGuestMessage = vi.fn();
  const findOpenAlert = vi.fn();
  const createAlert = vi.fn();

  const prisma: any = {
    booking: { findUnique: bookingFindUnique, findMany: bookingFindMany, update: bookingUpdate },
    accessGrant: { findMany: accessGrantFindMany, create: accessGrantCreate, update: accessGrantUpdate },
    smartLock: { update: smartLockUpdate, updateMany: smartLockUpdateMany },
    auditLog: { create: auditLogCreate },
  };
  prisma.$transaction = vi.fn(async (work: any) => {
    if (typeof work === 'function') return work({ ...prisma, $queryRaw: queryRaw });
    return Promise.all(work);
  });

  return {
    prisma,
    bookingFindUnique,
    bookingFindMany,
    bookingUpdate,
    accessGrantFindMany,
    accessGrantCreate,
    accessGrantUpdate,
    smartLockUpdate,
    smartLockUpdateMany,
    auditLogCreate,
    queryRaw,
    createGuestCode,
    assertCodePresent,
    deleteCode,
    generateSecurePin,
    isTuyaConfigured,
    deliverSensitiveGuestMessage,
    findOpenAlert,
    createAlert,
  };
});

vi.mock('@/lib/prisma', () => ({ prisma: mocks.prisma }));
vi.mock('@/lib/integrations/tuya-client', () => ({
  createGuestCode: mocks.createGuestCode,
  assertCodePresent: mocks.assertCodePresent,
  deleteCode: mocks.deleteCode,
  generateSecurePin: mocks.generateSecurePin,
  isTuyaConfigured: mocks.isTuyaConfigured,
}));
vi.mock('@/lib/secure-notifications', () => ({
  deliverSensitiveGuestMessage: mocks.deliverSensitiveGuestMessage,
}));
vi.mock('@/lib/operational-alerts', () => ({
  ALERT_LOOKUP_UNKNOWN: Symbol.for('alert-lookup-unknown-test'),
  findOpenAlert: mocks.findOpenAlert,
  createAlert: mocks.createAlert,
}));

import {
  previewGuestAccessLifecycle,
  processGuestAccessLifecycle,
  provisionGuestAccess,
  revokeGuestAccess,
} from '../access-orchestration';

const checkIn = new Date('2026-07-15T00:00:00.000Z');
const checkOut = new Date('2026-07-18T00:00:00.000Z');

function booking(accessGrants: any[] = []) {
  return {
    id: 'booking-1',
    propertyId: 'property-1',
    status: 'CONFIRMED',
    checkIn,
    checkOut,
    guest: { name: 'Test Guest', email: 'sink@example.test', phone: null },
    property: { name: 'Test Property', smartLock: { deviceId: 'device-1' } },
    accessGrants,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.GUEST_ACCESS_AUTOMATION_MODE;
  mocks.bookingUpdate.mockResolvedValue({});
  mocks.accessGrantUpdate.mockResolvedValue({});
  mocks.smartLockUpdate.mockResolvedValue({});
  mocks.smartLockUpdateMany.mockResolvedValue({});
  mocks.auditLogCreate.mockResolvedValue({});
  mocks.isTuyaConfigured.mockReturnValue(true);
  mocks.findOpenAlert.mockResolvedValue(null);
  mocks.createAlert.mockResolvedValue({ id: 'alert-1' });
  mocks.queryRaw.mockResolvedValue([{ acquired: true }]);
});

describe('previewGuestAccessLifecycle', () => {
  it('uses local arrival time, normalizes statuses, and cleanly counts lockless properties', async () => {
    mocks.bookingFindMany.mockResolvedValue([
      {
        id: 'with-lock',
        checkIn,
        checkOut,
        property: { smartLock: { deviceId: 'device-1' } },
      },
      {
        id: 'without-lock',
        checkIn,
        checkOut,
        property: { smartLock: null },
      },
    ]);
    mocks.accessGrantFindMany.mockResolvedValue([]);

    const preview = await previewGuestAccessLifecycle(new Date('2026-07-15T18:00:00.000Z'));

    expect(preview.provision).toEqual({ eligible: 1, skippedNoLock: 1 });
    expect(preview.revoke).toEqual({ eligibleBookings: 0 });
    expect(mocks.bookingFindMany.mock.calls[0][0].where.status.in).toContain('confirmed');
    expect(mocks.bookingFindMany.mock.calls[0][0].orderBy).toEqual({ checkIn: 'asc' });
    expect(mocks.accessGrantFindMany.mock.calls[0][0].orderBy).toEqual([
      { updatedAt: 'asc' },
      { endsAt: 'asc' },
    ]);
    expect(mocks.createGuestCode).not.toHaveBeenCalled();
    expect(mocks.deliverSensitiveGuestMessage).not.toHaveBeenCalled();
  });
});

describe('provisionGuestAccess', () => {
  it('verifies device presence before delivery and never persists or returns the plaintext PIN', async () => {
    const lowerCaseBooking = booking();
    lowerCaseBooking.status = 'confirmed';
    mocks.bookingFindUnique.mockResolvedValue(lowerCaseBooking);
    mocks.generateSecurePin.mockReturnValue('824913');
    mocks.createGuestCode.mockResolvedValue({ password_id: 'provider-grant-1' });
    mocks.assertCodePresent.mockResolvedValue(undefined);
    mocks.deliverSensitiveGuestMessage.mockResolvedValue({
      channel: 'EMAIL',
      receiptId: 'receipt-1',
      deliveredAt: '2026-07-15T18:01:00.000Z',
    });
    mocks.accessGrantCreate.mockResolvedValue({
      id: 'grant-1',
      status: 'DELIVERED',
      startsAt: new Date('2026-07-15T20:30:00.000Z'),
      endsAt: new Date('2026-07-18T16:30:00.000Z'),
      deliveryChannel: 'EMAIL',
      deliveryReceiptRef: 'receipt-1',
    });

    const result = await provisionGuestAccess('booking-1');

    expect(mocks.createGuestCode.mock.invocationCallOrder[0])
      .toBeLessThan(mocks.assertCodePresent.mock.invocationCallOrder[0]);
    expect(mocks.assertCodePresent.mock.invocationCallOrder[0])
      .toBeLessThan(mocks.deliverSensitiveGuestMessage.mock.invocationCallOrder[0]);
    expect(mocks.bookingUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ accessCode: null }) }),
    );
    expect(mocks.smartLockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ currentCode: null }) }),
    );
    expect(JSON.stringify(result)).not.toContain('824913');
  });
});

describe('revokeGuestAccess', () => {
  it('fails closed for a missing provider mapping and emits one open alert across retries', async () => {
    const withoutLock = {
      ...booking([{ id: 'grant-1', provider: 'TUYA', externalGrantRef: 'provider-grant-1' }]),
      property: { name: 'Test Property', smartLock: null },
    };
    mocks.bookingFindUnique.mockResolvedValue(withoutLock);
    mocks.findOpenAlert
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'alert-1', status: 'OPEN' });

    const first = await revokeGuestAccess('booking-1');
    const second = await revokeGuestAccess('booking-1');

    expect(first.failures).toBe(1);
    expect(second.failures).toBe(1);
    expect(mocks.deleteCode).not.toHaveBeenCalled();
    expect(mocks.createAlert).toHaveBeenCalledTimes(1);
    expect(mocks.bookingUpdate).not.toHaveBeenCalled();
    expect(mocks.smartLockUpdateMany).not.toHaveBeenCalled();
  });
});

describe('processGuestAccessLifecycle', () => {
  it('does no provider or delivery work when another invocation holds the advisory lease', async () => {
    mocks.queryRaw.mockResolvedValue([{ acquired: false }]);

    const result = await processGuestAccessLifecycle(new Date('2026-07-15T18:00:00.000Z'));

    expect(result).toMatchObject({ skippedBecauseLeaseHeld: true });
    expect(mocks.bookingFindMany).not.toHaveBeenCalled();
    expect(mocks.createGuestCode).not.toHaveBeenCalled();
    expect(mocks.deliverSensitiveGuestMessage).not.toHaveBeenCalled();
  });
});
