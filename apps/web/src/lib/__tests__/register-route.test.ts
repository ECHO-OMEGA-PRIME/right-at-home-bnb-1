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

const { requireAuth, userUpsert, userFindUnique, guestUpsert, staffApplicationCreate } =
  vi.hoisted(() => ({
    requireAuth: vi.fn(),
    userUpsert: vi.fn(),
    userFindUnique: vi.fn(),
    guestUpsert: vi.fn(),
    staffApplicationCreate: vi.fn(),
  }));

vi.mock('@/lib/api-auth', () => ({ requireAuth }));
vi.mock('@/lib/prisma', () => ({
  default: {
    user: { upsert: userUpsert, findUnique: userFindUnique },
    guest: { upsert: guestUpsert },
    staffApplication: { create: staffApplicationCreate },
  },
}));

import { POST } from '../../../app/api/register/route';

function request(body: Record<string, unknown>) {
  return { json: async () => body } as never;
}

function signedInAs(overrides: Partial<{ uid: string; email: string | null }> = {}) {
  requireAuth.mockResolvedValue({
    user: {
      uid: 'uid-123',
      email: 'Guest@Example.com',
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
  userFindUnique.mockResolvedValue(null);
  userUpsert.mockResolvedValue({
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
    expect(userUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { email: 'guest@example.com' },
        create: expect.objectContaining({ authUid: 'uid-123', role: 'GUEST' }),
        update: expect.objectContaining({
          authUid: 'uid-123',
          name: 'Ada Lovelace',
          phone: '432-555-1212',
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
        email: 'sp3158@sbcglobal.net',
        accountType: 'guest',
      }),
    );

    expect(userFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { email: 'real@example.com' } }),
    );
    expect(userUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { email: 'real@example.com' } }),
    );
  });

  it('refuses to create an account when the token carries no verified email', async () => {
    // The body still offers one. Accepting it was the account-takeover path:
    // the RAH admin row has a NULL authUid, so a rebind would have handed over
    // an ADMIN role to whoever asked first.
    signedInAs({ email: null });

    const res = await POST(
      request({
        firstName: 'Ada',
        lastName: 'Lovelace',
        email: 'sp3158@sbcglobal.net',
        accountType: 'guest',
      }),
    );

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({ code: 'VERIFIED_EMAIL_REQUIRED' });
    expect(userUpsert).not.toHaveBeenCalled();
    expect(guestUpsert).not.toHaveBeenCalled();
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

    const [{ create, update }] = userUpsert.mock.calls[0];
    expect(create.role).toBe('GUEST');
    expect(update).not.toHaveProperty('role');

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
    expect(userUpsert).not.toHaveBeenCalled();
    expect(staffApplicationCreate).not.toHaveBeenCalled();
  });

  it('does not demote or reactivate an existing account', async () => {
    // Re-registering must not touch role or isActive. An owner who submits the
    // form again stays an owner; a deactivated account stays deactivated.
    signedInAs({ email: 'owner@example.com' });
    userFindUnique.mockResolvedValue({ id: 'user-9', authUid: 'uid-123' });

    await POST(request({ firstName: 'Ada', lastName: 'Lovelace', accountType: 'guest' }));

    const [{ update }] = userUpsert.mock.calls[0];
    expect(update).not.toHaveProperty('role');
    expect(update).not.toHaveProperty('isActive');
  });

  it('refuses to rebind a row that already belongs to a different uid', async () => {
    signedInAs({ uid: 'attacker-uid', email: 'shared@example.com' });
    userFindUnique.mockResolvedValue({ id: 'user-9', authUid: 'someone-else' });

    const res = await POST(
      request({ firstName: 'Ada', lastName: 'Lovelace', accountType: 'guest' }),
    );

    expect(res.status).toBe(409);
    await expect(res.json()).resolves.toMatchObject({ code: 'EMAIL_ALREADY_REGISTERED' });
    expect(userUpsert).not.toHaveBeenCalled();
  });

  it('lets a verified caller claim an unclaimed row, keeping its role', async () => {
    // The positive control for the rule above, and the case that unblocks the
    // RAH admin: seeded in Postgres, authUid NULL, no way to sign in.
    signedInAs({ uid: 'steven-uid', email: 'sp3158@sbcglobal.net' });
    userFindUnique.mockResolvedValue({ id: 'user-admin', authUid: null });
    userUpsert.mockResolvedValue({
      id: 'user-admin',
      email: 'sp3158@sbcglobal.net',
      role: 'ADMIN',
      name: 'Steven',
    });

    const res = await POST(
      request({ firstName: 'Steven', lastName: 'P', accountType: 'guest' }),
    );

    expect(res.status).toBe(201);
    const [{ update }] = userUpsert.mock.calls[0];
    expect(update.authUid).toBe('steven-uid');
    expect(update).not.toHaveProperty('role');
    await expect(res.json()).resolves.toMatchObject({ user: { role: 'ADMIN' } });
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
    expect(userUpsert).not.toHaveBeenCalled();
  });
});
