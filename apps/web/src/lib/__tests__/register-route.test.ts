/**
 * POST /api/register.
 *
 * The interesting cases here are the ones that USED to succeed: a caller
 * naming somebody else's email, and a caller electing their own staff role.
 * Both are asserted on the arguments handed to Prisma rather than on the
 * response body, because the response was never the thing that granted
 * anything -- the write was.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';

const {
  requireAuth,
  userFindFirst,
  userFindMany,
  userFindUnique,
  userFindUniqueOrThrow,
  userUpdateMany,
  userCreate,
  guestUpsert,
  staffApplicationCreate,
} =
  vi.hoisted(() => ({
    requireAuth: vi.fn(),
    userFindFirst: vi.fn(),
    userFindMany: vi.fn(),
    userFindUnique: vi.fn(),
    userFindUniqueOrThrow: vi.fn(),
    userUpdateMany: vi.fn(),
    userCreate: vi.fn(),
    guestUpsert: vi.fn(),
    staffApplicationCreate: vi.fn(),
  }));

vi.mock('@/lib/api-auth', () => ({ requireAuth }));
vi.mock('@/lib/prisma', () => ({
  default: {
    user: {
      findFirst: userFindFirst,
      findMany: userFindMany,
      findUnique: userFindUnique,
      findUniqueOrThrow: userFindUniqueOrThrow,
      updateMany: userUpdateMany,
      create: userCreate,
    },
    guest: { upsert: guestUpsert },
    staffApplication: { create: staffApplicationCreate },
  },
}));

import { POST } from '../../../app/api/register/route';

function request(body: Record<string, unknown>) {
  return { json: async () => body } as never;
}

function signedInAs(
  overrides: Partial<{ uid: string; email: string | null; emailVerified: boolean }> = {},
) {
  requireAuth.mockResolvedValue({
    user: {
      uid: 'uid-123',
      email: 'Guest@Example.com',
      emailVerified: true,
      role: 'guest',
      workerType: null,
      isDevMode: false,
      ...overrides,
    },
    error: null,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  userFindFirst.mockResolvedValue(null);
  userFindMany.mockResolvedValue([]);
  userFindUnique.mockResolvedValue(null);
  userUpdateMany.mockResolvedValue({ count: 0 });
  userCreate.mockResolvedValue({
    id: 'user-1',
    email: 'guest@example.com',
    role: 'GUEST',
    name: 'Ada Lovelace',
  });
  guestUpsert.mockResolvedValue({
    id: 'guest-1',
    email: 'guest@example.com',
    name: 'Ada Lovelace',
  });
  staffApplicationCreate.mockResolvedValue({ id: 'app-1' });
});

describe('POST /api/register', () => {
  it('uses the verified identity and persists the caller profile', async () => {
    signedInAs();

    const res = await POST(
      request({
        firstName: 'Ada',
        lastName: 'Lovelace',
        phone: ' 432-555-1212 ',
        accountType: 'guest',
      }),
    );

    expect(res.status).toBe(201);
    expect(userCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          authUid: 'uid-123',
          name: 'Ada Lovelace',
          phone: '432-555-1212',
          role: 'GUEST',
        }),
      }),
    );
    expect(guestUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { email: 'guest@example.com' },
        create: expect.objectContaining({
          platform: 'DIRECT',
          platformId: 'uid-123',
          tags: '["registered_user"]',
        }),
      }),
    );
    await expect(res.json()).resolves.toMatchObject({ ok: true, status: 'ACTIVE' });
  });

  it('ignores an email in the body and keys the write on the verified one', async () => {
    signedInAs({ email: 'real@example.com' });

    await POST(
      request({
        firstName: 'Ada',
        lastName: 'Lovelace',
        email: 'seeded-admin@example.test',
        accountType: 'guest',
      }),
    );

    expect(userFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { email: { equals: 'real@example.com', mode: 'insensitive' } },
      }),
    );
    expect(userCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ email: 'real@example.com' }) }),
    );
  });

  it('refuses to create an account when the token carries no verified email', async () => {
    // The body still offers one. Accepting it was the account-takeover path:
    // a seeded admin row with a NULL authUid would hand ADMIN to the first
    // caller if the route trusted a body-supplied address.
    signedInAs({ email: null });

    const res = await POST(
      request({
        firstName: 'Ada',
        lastName: 'Lovelace',
        email: 'seeded-admin@example.test',
        accountType: 'guest',
      }),
    );

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({ code: 'VERIFIED_EMAIL_REQUIRED' });
    expect(userCreate).not.toHaveBeenCalled();
    expect(guestUpsert).not.toHaveBeenCalled();
  });

  it('refuses an unverified token email even when it is non-null', async () => {
    signedInAs({ emailVerified: false });

    const res = await POST(
      request({ firstName: 'Ada', lastName: 'Lovelace', accountType: 'guest' }),
    );

    expect(res.status).toBe(400);
    expect(userCreate).not.toHaveBeenCalled();
    expect(userUpdateMany).not.toHaveBeenCalled();
  });

  it('never lets a staff signup elect its own role', async () => {
    // `CLEANER` maps to the `worker` role in api-auth, so writing the submitted
    // staffType into User.role granted worker permissions on submit.
    signedInAs();

    const res = await POST(
      request({
        firstName: 'Ada',
        lastName: 'Lovelace',
        accountType: 'staff',
        staffType: 'cleaner',
      }),
    );

    expect(res.status).toBe(201);

    const [{ data }] = userCreate.mock.calls[0];
    expect(data.role).toBe('GUEST');

    expect(staffApplicationCreate).toHaveBeenCalledWith({
      data: { userId: 'user-1', requestedType: 'cleaner', status: 'PENDING' },
    });
    await expect(res.json()).resolves.toMatchObject({ status: 'PENDING_APPROVAL' });
  });

  it('rejects a staffType outside the allowlist instead of storing it', async () => {
    signedInAs();

    const res = await POST(
      request({
        firstName: 'Ada',
        lastName: 'Lovelace',
        accountType: 'staff',
        staffType: 'OWNER',
      }),
    );

    expect(res.status).toBe(400);
    expect(userCreate).not.toHaveBeenCalled();
    expect(staffApplicationCreate).not.toHaveBeenCalled();
  });

  it('does not demote or reactivate an existing account', async () => {
    // Re-registering must not touch role or isActive. An owner who submits the
    // form again stays an owner; a deactivated account stays deactivated.
    signedInAs({ email: 'owner@example.com' });
    userFindFirst.mockResolvedValue({ id: 'user-9', authUid: 'uid-123', isActive: true });
    userFindUniqueOrThrow.mockResolvedValue({
      id: 'user-9', email: 'owner@example.com', role: 'OWNER', name: 'Owner',
    });

    await POST(request({ firstName: 'Ada', lastName: 'Lovelace', accountType: 'guest' }));

    expect(userCreate).not.toHaveBeenCalled();
    expect(userUpdateMany).not.toHaveBeenCalled();
  });

  it('refuses to rebind a row that already belongs to a different uid', async () => {
    signedInAs({ uid: 'attacker-uid', email: 'shared@example.com' });
    userFindMany.mockResolvedValue([{ id: 'user-9', authUid: 'someone-else', isActive: true }]);

    const res = await POST(
      request({ firstName: 'Ada', lastName: 'Lovelace', accountType: 'guest' }),
    );

    expect(res.status).toBe(409);
    await expect(res.json()).resolves.toMatchObject({ code: 'EMAIL_ALREADY_REGISTERED' });
    expect(userCreate).not.toHaveBeenCalled();
  });

  it('lets a verified caller claim an unclaimed row, keeping its role', async () => {
    // The positive control for the rule above, and the case that unblocks the
    // Seeded in Postgres, authUid NULL, with no identity link yet.
    signedInAs({ uid: 'owner-uid', email: 'seeded-admin@example.test' });
    userFindMany.mockResolvedValue([{ id: 'user-admin', authUid: null, isActive: true }]);
    userUpdateMany.mockResolvedValue({ count: 1 });
    userFindUniqueOrThrow.mockResolvedValue({
      id: 'user-admin',
      email: 'seeded-admin@example.test',
      role: 'ADMIN',
      name: 'Owner',
    });

    const res = await POST(
      request({ firstName: 'Owner', lastName: 'Operator', accountType: 'guest' }),
    );

    expect(res.status).toBe(201);
    expect(userUpdateMany).toHaveBeenCalledWith({
      where: { id: 'user-admin', authUid: null, isActive: true },
      data: { authUid: 'owner-uid' },
    });
    expect(userCreate).not.toHaveBeenCalled();
    await expect(res.json()).resolves.toMatchObject({ user: { role: 'ADMIN' } });
  });

  it('fails closed when case-insensitive email lookup is ambiguous', async () => {
    signedInAs({ email: 'owner@example.test' });
    userFindMany.mockResolvedValue([
      { id: 'user-1', authUid: null, isActive: true },
      { id: 'user-2', authUid: null, isActive: true },
    ]);

    const res = await POST(
      request({ firstName: 'Owner', lastName: 'Operator', accountType: 'guest' }),
    );

    expect(res.status).toBe(409);
    expect(userUpdateMany).not.toHaveBeenCalled();
    expect(userCreate).not.toHaveBeenCalled();
  });

  it('does not write a CRM guest record for a staff signup', async () => {
    // The old update set notes/tags/preferences to null for non-guests, which
    // erased real CRM history from a Guest row sharing the address.
    signedInAs();

    await POST(
      request({
        firstName: 'Ada',
        lastName: 'Lovelace',
        accountType: 'staff',
        staffType: 'handyman',
      }),
    );

    expect(guestUpsert).not.toHaveBeenCalled();
  });

  it('propagates the auth error without writing anything', async () => {
    requireAuth.mockResolvedValue({
      user: null,
      error: new Response(null, { status: 401 }),
    });

    const res = await POST(request({ firstName: 'Ada', lastName: 'Lovelace' }));

    expect(res.status).toBe(401);
    expect(userCreate).not.toHaveBeenCalled();
  });
});
