/**
 * Right at Home BnB - Steven AI conversational memory, on Postgres.
 *
 * Replaces the `steven_guests` / `steven_sessions` Firestore collections.
 *
 * The change that matters is not the storage engine, it is the ELIMINATION OF A
 * SECOND GUEST TABLE. `steven_guests` was a parallel CRM: its own name, email,
 * phone, tags, preferences and VIP status for the same humans already sitting in
 * the Postgres `Guest` table. Two stores, no synchronisation -- so the assistant
 * could greet as "standard" a guest the CRM had marked platinum, and any
 * preference it learned was invisible to every other part of the product. Guest
 * memory now reads and writes the real `Guest` row, which is what makes what
 * Steven learns actually mean something.
 *
 * Sessions are no longer documents holding an array. See the StevenMessage
 * model comment: the old read-modify-write on a session document lost messages
 * when two turns overlapped.
 *
 * @author ECHO OMEGA PRIME
 */

import { prisma } from '@/lib/prisma';

// ============================================
// TYPES
// ============================================

export interface ConversationEntry {
  timestamp: string;
  role: 'user' | 'assistant';
  content: string;
  emotion?: string;
  context?: string;
  propertyId?: string;
  sessionId?: string;
}

export interface GuestPreferences {
  preferredProperties?: string[];
  dietaryRestrictions?: string[];
  petOwner?: boolean;
  travelReason?: 'business' | 'family' | 'work_crew' | 'romantic' | 'medical' | 'event' | 'other';
  communicationPreference?: 'text' | 'call' | 'email' | 'app';
  quietHours?: boolean;
  earlyCheckIn?: boolean;
  lateCheckOut?: boolean;
  accessibilityNeeds?: string[];
  specialRequests?: string[];
}

export interface GuestMemory {
  guestId: string;
  guestName: string;
  email?: string;
  phone?: string;
  /** The recent window used to prime the model, NOT the whole history. */
  conversations: ConversationEntry[];
  /**
   * The true total, which `conversations.length` is not -- that is capped at
   * CONTEXT_WINDOW. The route reports this number to callers, and a capped
   * count reported as a total is just a wrong number that looks plausible.
   */
  conversationCount: number;
  preferences: GuestPreferences;
  /** From the CRM's own counter rather than a second tally of the same stays. */
  stayCount: number;
  lastStay?: Date;
  tags: string[];
  vipStatus: string;
  notes?: string;
  createdAt: Date;
  lastInteraction: Date;
}

export interface SteveSession {
  sessionId: string;
  guestId?: string;
  messages: ConversationEntry[];
}

/** How many past turns prime the model, matching the old Firestore trim. */
const CONTEXT_WINDOW = 50;

const EMPTY_PREFERENCES: GuestPreferences = {};

const MESSAGE_SELECT = {
  role: true,
  content: true,
  emotion: true,
  propertyId: true,
  sessionId: true,
  createdAt: true,
} as const;

// ============================================
// SERIALISATION
//
// Guest.preferences and Guest.tags are JSON strings on String columns, not Json
// columns. Every parse is therefore defensive: one malformed blob must degrade
// that guest's memory, not 500 the assistant.
// ============================================

function parsePreferences(raw: string | null, guestId: string): GuestPreferences {
  if (!raw) return { ...EMPTY_PREFERENCES };
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as GuestPreferences)
      : { ...EMPTY_PREFERENCES };
  } catch {
    console.error('[steven-memory] malformed preferences JSON', { guestId });
    return { ...EMPTY_PREFERENCES };
  }
}

function parseTags(raw: string | null, guestId: string): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((t): t is string => typeof t === 'string') : [];
  } catch {
    console.error('[steven-memory] malformed tags JSON', { guestId });
    return [];
  }
}

function toEntry(row: {
  role: string;
  content: string;
  emotion: string | null;
  propertyId: string | null;
  sessionId: string;
  createdAt: Date;
}): ConversationEntry {
  return {
    timestamp: row.createdAt.toISOString(),
    role: row.role === 'assistant' ? 'assistant' : 'user',
    content: row.content,
    ...(row.emotion ? { emotion: row.emotion } : {}),
    ...(row.propertyId ? { propertyId: row.propertyId, context: row.propertyId } : {}),
    sessionId: row.sessionId,
  };
}

// ============================================
// GUEST MEMORY
// ============================================

/**
 * Read a guest's memory.
 *
 * Named "getOrCreate" for continuity with the Firestore version, but it
 * deliberately does NOT create a CRM row for an unknown id. `Guest.email` is
 * required and unique, and an assistant turn does not carry a verified email --
 * inventing a row would seed the CRM with junk identities from chat traffic.
 * An unknown guest gets empty memory and the assistant still answers.
 */
export async function getOrCreateGuestMemory(
  guestId: string,
  guestName?: string,
): Promise<GuestMemory> {
  const now = new Date();

  const guest = await prisma.guest.findUnique({
    where: { id: guestId },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      preferences: true,
      tags: true,
      notes: true,
      isVip: true,
      vipTier: true,
      totalStays: true,
      lastStay: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!guest) {
    return {
      guestId,
      guestName: guestName || 'Unknown',
      conversations: [],
      conversationCount: 0,
      preferences: { ...EMPTY_PREFERENCES },
      stayCount: 0,
      tags: [],
      vipStatus: 'standard',
      createdAt: now,
      lastInteraction: now,
    };
  }

  const [rows, conversationCount] = await Promise.all([
    prisma.stevenMessage.findMany({
      where: { guestId },
      orderBy: { createdAt: 'desc' },
      take: CONTEXT_WINDOW,
      select: MESSAGE_SELECT,
    }),
    prisma.stevenMessage.count({ where: { guestId } }),
  ]);

  return {
    guestId: guest.id,
    guestName: guestName || guest.name,
    email: guest.email,
    phone: guest.phone ?? undefined,
    // Newest-first from the index, reversed so the model reads them in order.
    conversations: rows.reverse().map(toEntry),
    conversationCount,
    preferences: parsePreferences(guest.preferences, guestId),
    stayCount: guest.totalStays,
    lastStay: guest.lastStay ?? undefined,
    tags: parseTags(guest.tags, guestId),
    vipStatus: guest.vipTier ?? (guest.isVip ? 'vip' : 'standard'),
    notes: guest.notes ?? undefined,
    createdAt: guest.createdAt,
    lastInteraction: guest.updatedAt,
  };
}

/** Merge learned preferences into the CRM row. No-op for an unknown guest. */
export async function updateGuestPreferences(
  guestId: string,
  preferences: Partial<GuestPreferences>,
): Promise<void> {
  if (Object.keys(preferences).length === 0) return;

  const guest = await prisma.guest.findUnique({
    where: { id: guestId },
    select: { preferences: true },
  });
  if (!guest) return;

  const merged = { ...parsePreferences(guest.preferences, guestId), ...preferences };
  await prisma.guest.update({
    where: { id: guestId },
    data: { preferences: JSON.stringify(merged) },
  });
}

/** Add tags to the CRM row, de-duplicated. No-op for an unknown guest. */
export async function addGuestTags(guestId: string, tags: string[]): Promise<void> {
  if (tags.length === 0) return;

  const guest = await prisma.guest.findUnique({
    where: { id: guestId },
    select: { tags: true },
  });
  if (!guest) return;

  const merged = Array.from(new Set([...parseTags(guest.tags, guestId), ...tags]));
  await prisma.guest.update({
    where: { id: guestId },
    data: { tags: JSON.stringify(merged) },
  });
}

/** Append one turn to a guest's durable history. */
export async function addConversationEntry(
  guestId: string,
  entry: ConversationEntry,
): Promise<void> {
  await prisma.stevenMessage.create({
    data: {
      sessionId: entry.sessionId ?? `guest-${guestId}`,
      guestId,
      role: entry.role,
      content: entry.content,
      emotion: entry.emotion ?? null,
      propertyId: entry.propertyId ?? null,
    },
  });
}

export async function getRecentConversations(
  guestId: string,
  limit: number = 20,
): Promise<ConversationEntry[]> {
  const rows = await prisma.stevenMessage.findMany({
    where: { guestId },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: MESSAGE_SELECT,
  });
  return rows.reverse().map(toEntry);
}

/** A short briefing on the guest, injected into the system prompt. */
export async function getGuestSummary(guestId: string): Promise<string> {
  try {
    const memory = await getOrCreateGuestMemory(guestId);

    const parts: string[] = [
      `Guest: ${memory.guestName}`,
      `VIP Status: ${memory.vipStatus}`,
      `Total Stays: ${memory.stayCount}`,
      `Total Conversations: ${memory.conversationCount}`,
    ];

    if (memory.preferences.travelReason) {
      parts.push(`Travel Type: ${memory.preferences.travelReason}`);
    }
    if (memory.preferences.preferredProperties?.length) {
      parts.push(`Preferred Properties: ${memory.preferences.preferredProperties.join(', ')}`);
    }
    if (memory.tags.length > 0) {
      parts.push(`Tags: ${memory.tags.join(', ')}`);
    }
    if (memory.lastStay) {
      parts.push(`Last Stay: ${memory.lastStay.toISOString().slice(0, 10)}`);
    }

    return parts.join('\n');
  } catch (error) {
    console.error('Error getting guest summary:', error);
    return `Guest ID: ${guestId}`;
  }
}

/**
 * Infer preferences from what the guest just said, and persist any hits.
 *
 * Pure keyword matching, unchanged from the Firestore version -- only the write
 * target moved. Returns what it detected even when the guest is unknown to the
 * CRM (where the write is a no-op), so callers can still use the inference
 * in-flight.
 */
export async function extractPreferencesFromConversation(
  guestId: string,
  conversation: string,
): Promise<Partial<GuestPreferences>> {
  const preferences: Partial<GuestPreferences> = {};
  const lower = conversation.toLowerCase();

  if (lower.includes('business') || lower.includes('work trip') || lower.includes('conference')) {
    preferences.travelReason = 'business';
  } else if (lower.includes('family') || lower.includes('kids') || lower.includes('children')) {
    preferences.travelReason = 'family';
  } else if (lower.includes('crew') || lower.includes('workers') || lower.includes('team')) {
    preferences.travelReason = 'work_crew';
  } else if (
    lower.includes('anniversary') ||
    lower.includes('romantic') ||
    lower.includes('honeymoon')
  ) {
    preferences.travelReason = 'romantic';
  } else if (
    lower.includes('medical') ||
    lower.includes('hospital') ||
    lower.includes('treatment')
  ) {
    preferences.travelReason = 'medical';
  }

  if (lower.includes('dog') || lower.includes('pet') || lower.includes('cat')) {
    preferences.petOwner = true;
  }
  if (lower.includes('early check') || lower.includes('arrive early')) {
    preferences.earlyCheckIn = true;
  }
  if (lower.includes('late check') || lower.includes('leave late')) {
    preferences.lateCheckOut = true;
  }
  if (lower.includes('quiet') || lower.includes('noise') || lower.includes('early sleeper')) {
    preferences.quietHours = true;
  }

  if (Object.keys(preferences).length > 0) {
    await updateGuestPreferences(guestId, preferences);
  }

  return preferences;
}

// ============================================
// SESSIONS
// ============================================

/**
 * Read a session's recent transcript.
 *
 * A session has no row of its own -- it is the messages sharing a sessionId --
 * so there is nothing to create and nothing to race.
 */
export async function getOrCreateSession(
  sessionId: string,
  guestId?: string,
): Promise<SteveSession> {
  const rows = await prisma.stevenMessage.findMany({
    where: { sessionId },
    orderBy: { createdAt: 'desc' },
    take: CONTEXT_WINDOW,
    select: MESSAGE_SELECT,
  });

  return {
    sessionId,
    guestId,
    messages: rows.reverse().map(toEntry),
  };
}

/**
 * Append one turn to a session transcript.
 *
 * `guestId` stays null here on purpose. The route records a guest turn twice --
 * once to the session and once to the guest's durable history -- and stamping
 * the guest on both would double every count in `conversationCount`.
 */
export async function addSessionMessage(
  sessionId: string,
  entry: ConversationEntry,
): Promise<void> {
  await prisma.stevenMessage.create({
    data: {
      sessionId,
      guestId: null,
      role: entry.role,
      content: entry.content,
      emotion: entry.emotion ?? null,
      propertyId: entry.propertyId ?? null,
    },
  });
}
