/**
 * Steven AI memory, on Postgres.
 *
 * The cases worth asserting are the ones the Firestore version got wrong or
 * could not express: an unknown guest must not become a CRM row, a malformed
 * JSON blob must not take down the assistant, and the reported conversation
 * total must be a real count rather than the length of the context window.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';

const { guestFindUnique, guestUpdate, messageFindMany, messageCount, messageCreate } = vi.hoisted(
  () => ({
    guestFindUnique: vi.fn(),
    guestUpdate: vi.fn(),
    messageFindMany: vi.fn(),
    messageCount: vi.fn(),
    messageCreate: vi.fn(),
  }),
);

vi.mock('@/lib/prisma', () => ({
  prisma: {
    guest: { findUnique: guestFindUnique, update: guestUpdate },
    stevenMessage: {
      findMany: messageFindMany,
      count: messageCount,
      create: messageCreate,
    },
  },
}));

import {
  addConversationEntry,
  addGuestTags,
  addSessionMessage,
  extractPreferencesFromConversation,
  getGuestSummary,
  getOrCreateGuestMemory,
  getOrCreateSession,
  updateGuestPreferences,
} from '../steven-memory';

function guestRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'guest-1',
    name: 'Ada Lovelace',
    email: 'ada@example.com',
    phone: '432-555-1212',
    preferences: '{"petOwner":true}',
    tags: '["repeat"]',
    notes: null,
    isVip: false,
    vipTier: 'gold',
    totalStays: 4,
    lastStay: new Date('2026-05-01T00:00:00.000Z'),
    createdAt: new Date('2025-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-06-01T00:00:00.000Z'),
    ...overrides,
  };
}

function messageRow(i: number, overrides: Record<string, unknown> = {}) {
  return {
    role: i % 2 === 0 ? 'user' : 'assistant',
    content: `turn ${i}`,
    emotion: null,
    propertyId: null,
    sessionId: 'sess-1',
    createdAt: new Date(2026, 0, 1, 0, i),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  messageFindMany.mockResolvedValue([]);
  messageCount.mockResolvedValue(0);
  messageCreate.mockResolvedValue({ id: 'm1' });
  guestUpdate.mockResolvedValue({});
});

describe('getOrCreateGuestMemory', () => {
  it('reads the real CRM row rather than a second guest store', async () => {
    guestFindUnique.mockResolvedValue(guestRow());
    messageCount.mockResolvedValue(137);

    const memory = await getOrCreateGuestMemory('guest-1');

    expect(memory.guestName).toBe('Ada Lovelace');
    expect(memory.vipStatus).toBe('gold');
    expect(memory.stayCount).toBe(4);
    expect(memory.preferences).toEqual({ petOwner: true });
    expect(memory.tags).toEqual(['repeat']);
  });

  it('does NOT create a CRM row for an unknown guest', async () => {
    // An assistant turn carries no verified email, and Guest.email is required
    // and unique -- creating here would seed the CRM from chat traffic.
    guestFindUnique.mockResolvedValue(null);

    const memory = await getOrCreateGuestMemory('who-dis', 'Unknown Caller');

    expect(memory.guestName).toBe('Unknown Caller');
    expect(memory.conversations).toEqual([]);
    expect(memory.conversationCount).toBe(0);
    expect(memory.stayCount).toBe(0);
    expect(memory.vipStatus).toBe('standard');
    expect(guestUpdate).not.toHaveBeenCalled();
  });

  it('reports the true conversation total, not the context window length', async () => {
    guestFindUnique.mockResolvedValue(guestRow());
    // The window caps at 50; the guest actually has 137 turns.
    messageFindMany.mockResolvedValue(
      Array.from({ length: 50 }, (_, i) => messageRow(i)).reverse(),
    );
    messageCount.mockResolvedValue(137);

    const memory = await getOrCreateGuestMemory('guest-1');

    expect(memory.conversations).toHaveLength(50);
    expect(memory.conversationCount).toBe(137);
  });

  it('returns history oldest-first so the model reads it in order', async () => {
    guestFindUnique.mockResolvedValue(guestRow());
    // Prisma returns newest-first from the index.
    messageFindMany.mockResolvedValue([messageRow(2), messageRow(1), messageRow(0)]);

    const memory = await getOrCreateGuestMemory('guest-1');

    expect(memory.conversations.map((c) => c.content)).toEqual(['turn 0', 'turn 1', 'turn 2']);
  });

  it('degrades a malformed preferences blob instead of throwing', async () => {
    guestFindUnique.mockResolvedValue(guestRow({ preferences: '{not json', tags: 'nope' }));

    const memory = await getOrCreateGuestMemory('guest-1');

    expect(memory.preferences).toEqual({});
    expect(memory.tags).toEqual([]);
  });

  it('falls back to isVip when no tier is set', async () => {
    guestFindUnique.mockResolvedValue(guestRow({ vipTier: null, isVip: true }));
    expect((await getOrCreateGuestMemory('guest-1')).vipStatus).toBe('vip');

    guestFindUnique.mockResolvedValue(guestRow({ vipTier: null, isVip: false }));
    expect((await getOrCreateGuestMemory('guest-1')).vipStatus).toBe('standard');
  });
});

describe('writes', () => {
  it('merges preferences into the existing blob rather than replacing it', async () => {
    guestFindUnique.mockResolvedValue({ preferences: '{"petOwner":true}' });

    await updateGuestPreferences('guest-1', { quietHours: true });

    expect(guestUpdate).toHaveBeenCalledWith({
      where: { id: 'guest-1' },
      data: { preferences: JSON.stringify({ petOwner: true, quietHours: true }) },
    });
  });

  it('de-duplicates tags', async () => {
    guestFindUnique.mockResolvedValue({ tags: '["repeat","vip"]' });

    await addGuestTags('guest-1', ['vip', 'quiet']);

    expect(guestUpdate).toHaveBeenCalledWith({
      where: { id: 'guest-1' },
      data: { tags: JSON.stringify(['repeat', 'vip', 'quiet']) },
    });
  });

  it('writes nothing for an unknown guest', async () => {
    guestFindUnique.mockResolvedValue(null);

    await updateGuestPreferences('nobody', { quietHours: true });
    await addGuestTags('nobody', ['vip']);

    expect(guestUpdate).not.toHaveBeenCalled();
  });

  it('stamps the guest on a durable entry and leaves it off a session turn', async () => {
    // The route records a guest turn to BOTH stores. Stamping the guest on both
    // would double every number in conversationCount.
    await addConversationEntry('guest-1', {
      timestamp: 'x',
      role: 'user',
      content: 'hello',
      sessionId: 'sess-1',
    });
    expect(messageCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ guestId: 'guest-1' }) }),
    );

    messageCreate.mockClear();
    await addSessionMessage('sess-1', { timestamp: 'x', role: 'user', content: 'hello' });
    expect(messageCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ guestId: null }) }),
    );
  });
});

describe('getOrCreateSession', () => {
  it('creates no row -- a session is just its messages', async () => {
    messageFindMany.mockResolvedValue([messageRow(1), messageRow(0)]);

    const session = await getOrCreateSession('sess-1', 'guest-1');

    expect(session.sessionId).toBe('sess-1');
    expect(session.messages.map((m) => m.content)).toEqual(['turn 0', 'turn 1']);
    expect(messageCreate).not.toHaveBeenCalled();
  });
});

describe('getGuestSummary', () => {
  it('summarises from CRM counters', async () => {
    guestFindUnique.mockResolvedValue(guestRow({ preferences: '{"travelReason":"business"}' }));
    messageCount.mockResolvedValue(12);

    const summary = await getGuestSummary('guest-1');

    expect(summary).toContain('Guest: Ada Lovelace');
    expect(summary).toContain('VIP Status: gold');
    expect(summary).toContain('Total Stays: 4');
    expect(summary).toContain('Total Conversations: 12');
    expect(summary).toContain('Travel Type: business');
    expect(summary).toContain('Last Stay: 2026-05-01');
  });

  it('degrades to the id when the store throws', async () => {
    guestFindUnique.mockRejectedValue(new Error('db down'));
    await expect(getGuestSummary('guest-9')).resolves.toBe('Guest ID: guest-9');
  });
});

describe('extractPreferencesFromConversation', () => {
  it('detects and persists what it inferred', async () => {
    guestFindUnique.mockResolvedValue({ preferences: null });

    const detected = await extractPreferencesFromConversation(
      'guest-1',
      'Here for a work trip, bringing my dog, need early check in',
    );

    expect(detected).toEqual({
      travelReason: 'business',
      petOwner: true,
      earlyCheckIn: true,
    });
    expect(guestUpdate).toHaveBeenCalled();
  });

  it('still reports its inference for a guest the CRM does not know', async () => {
    guestFindUnique.mockResolvedValue(null);

    const detected = await extractPreferencesFromConversation('nobody', 'travelling with kids');

    expect(detected).toEqual({ travelReason: 'family' });
    expect(guestUpdate).not.toHaveBeenCalled();
  });

  it('writes nothing when it infers nothing', async () => {
    const detected = await extractPreferencesFromConversation('guest-1', 'what time is checkout');

    expect(detected).toEqual({});
    expect(guestFindUnique).not.toHaveBeenCalled();
    expect(guestUpdate).not.toHaveBeenCalled();
  });
});
