/**
 * Steven AI - Infinite Guest Memory System
 * Firebase-backed persistent memory for guest interactions
 * @author ECHO OMEGA PRIME
 */

import { db } from './auth';
import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';

// ============================================
// TYPES
// ============================================

export interface GuestMemory {
  guestId: string;
  guestName: string;
  email?: string;
  phone?: string;
  conversations: ConversationEntry[];
  preferences: GuestPreferences;
  stays: StayHistory[];
  tags: string[];
  vipStatus: 'standard' | 'bronze' | 'silver' | 'gold' | 'platinum';
  notes?: string;
  createdAt: Date;
  lastInteraction: Date;
}

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

export interface StayHistory {
  propertyId: string;
  propertyName?: string;
  checkIn: string;
  checkOut: string;
  rating?: number;
  issues?: string[];
  notes?: string;
  revenue?: number;
}

// ============================================
// COLLECTIONS
// ============================================

const COLLECTIONS = {
  GUESTS: 'steven_guests',
  CONVERSATIONS: 'steven_conversations',
  SESSIONS: 'steven_sessions',
};

// ============================================
// GUEST MEMORY FUNCTIONS
// ============================================

/**
 * Get or create a guest memory record
 */
export async function getOrCreateGuestMemory(
  guestId: string,
  guestName?: string
): Promise<GuestMemory> {
  try {
    const guestRef = doc(db(), COLLECTIONS.GUESTS, guestId);
    const guestSnap = await getDoc(guestRef);

    if (guestSnap.exists()) {
      const data = guestSnap.data();

      // Update name if provided and different
      if (guestName && guestName !== data.guestName) {
        await updateDoc(guestRef, {
          guestName,
          lastInteraction: serverTimestamp()
        });
      }

      return {
        guestId,
        guestName: guestName || data.guestName,
        email: data.email,
        phone: data.phone,
        conversations: data.conversations || [],
        preferences: data.preferences || {},
        stays: data.stays || [],
        tags: data.tags || [],
        vipStatus: data.vipStatus || 'standard',
        notes: data.notes,
        createdAt: data.createdAt?.toDate() || new Date(),
        lastInteraction: new Date(),
      };
    }

    // Create new guest memory
    const newGuest: Omit<GuestMemory, 'createdAt' | 'lastInteraction'> & {
      createdAt: any;
      lastInteraction: any;
    } = {
      guestId,
      guestName: guestName || 'Guest',
      conversations: [],
      preferences: {},
      stays: [],
      tags: [],
      vipStatus: 'standard',
      createdAt: serverTimestamp(),
      lastInteraction: serverTimestamp(),
    };

    await setDoc(guestRef, newGuest);

    return {
      ...newGuest,
      createdAt: new Date(),
      lastInteraction: new Date(),
    };
  } catch (error) {
    console.error('Error getting guest memory:', error);
    // Return in-memory fallback if Firebase fails
    return {
      guestId,
      guestName: guestName || 'Guest',
      conversations: [],
      preferences: {},
      stays: [],
      tags: [],
      vipStatus: 'standard',
      createdAt: new Date(),
      lastInteraction: new Date(),
    };
  }
}

/**
 * Add a conversation entry to guest memory
 */
export async function addConversationEntry(
  guestId: string,
  entry: ConversationEntry
): Promise<void> {
  try {
    const guestRef = doc(db(), COLLECTIONS.GUESTS, guestId);
    const guestSnap = await getDoc(guestRef);

    if (!guestSnap.exists()) {
      // Create guest if doesn't exist
      await getOrCreateGuestMemory(guestId);
    }

    const conversations = guestSnap.data()?.conversations || [];
    conversations.push(entry);

    // Keep last 200 conversations per guest
    const trimmedConversations = conversations.slice(-200);

    await updateDoc(guestRef, {
      conversations: trimmedConversations,
      lastInteraction: serverTimestamp(),
    });

    // Also store in conversations collection for analytics
    const convRef = doc(
      db(),
      COLLECTIONS.CONVERSATIONS,
      `${guestId}_${Date.now()}`
    );
    await setDoc(convRef, {
      ...entry,
      guestId,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error adding conversation entry:', error);
  }
}

/**
 * Update guest preferences
 */
export async function updateGuestPreferences(
  guestId: string,
  preferences: Partial<GuestPreferences>
): Promise<void> {
  try {
    const guestRef = doc(db(), COLLECTIONS.GUESTS, guestId);
    const guestSnap = await getDoc(guestRef);

    if (!guestSnap.exists()) return;

    const existingPrefs = guestSnap.data().preferences || {};
    await updateDoc(guestRef, {
      preferences: { ...existingPrefs, ...preferences },
      lastInteraction: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error updating guest preferences:', error);
  }
}

/**
 * Add a stay to guest history
 */
export async function addStayHistory(
  guestId: string,
  stay: StayHistory
): Promise<void> {
  try {
    const guestRef = doc(db(), COLLECTIONS.GUESTS, guestId);
    const guestSnap = await getDoc(guestRef);

    if (!guestSnap.exists()) return;

    const stays = guestSnap.data().stays || [];
    stays.push(stay);

    // Update VIP status based on stay count
    let vipStatus: GuestMemory['vipStatus'] = 'standard';
    if (stays.length >= 10) vipStatus = 'platinum';
    else if (stays.length >= 5) vipStatus = 'gold';
    else if (stays.length >= 3) vipStatus = 'silver';
    else if (stays.length >= 1) vipStatus = 'bronze';

    await updateDoc(guestRef, {
      stays,
      vipStatus,
      lastInteraction: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error adding stay history:', error);
  }
}

/**
 * Add tags to guest
 */
export async function addGuestTags(
  guestId: string,
  newTags: string[]
): Promise<void> {
  try {
    const guestRef = doc(db(), COLLECTIONS.GUESTS, guestId);
    const guestSnap = await getDoc(guestRef);

    if (!guestSnap.exists()) return;

    const existingTags = guestSnap.data().tags || [];
    const uniqueTags = Array.from(new Set([...existingTags, ...newTags]));

    await updateDoc(guestRef, {
      tags: uniqueTags,
      lastInteraction: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error adding guest tags:', error);
  }
}

/**
 * Search guests by tag or name
 */
export async function searchGuests(
  searchQuery: string,
  maxResults: number = 10
): Promise<GuestMemory[]> {
  try {
    const guestsRef = collection(db(), COLLECTIONS.GUESTS);
    const q = query(
      guestsRef,
      orderBy('lastInteraction', 'desc'),
      limit(maxResults)
    );

    const snapshot = await getDocs(q);
    const searchLower = searchQuery.toLowerCase();

    return snapshot.docs
      .map(doc => ({
        guestId: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
        lastInteraction: doc.data().lastInteraction?.toDate(),
      } as GuestMemory))
      .filter(guest =>
        guest.guestName.toLowerCase().includes(searchLower) ||
        guest.tags?.some(tag => tag.toLowerCase().includes(searchLower)) ||
        guest.email?.toLowerCase().includes(searchLower)
      );
  } catch (error) {
    console.error('Error searching guests:', error);
    return [];
  }
}

/**
 * Get recent conversations for a guest
 */
export async function getRecentConversations(
  guestId: string,
  count: number = 20
): Promise<ConversationEntry[]> {
  try {
    const guestRef = doc(db(), COLLECTIONS.GUESTS, guestId);
    const guestSnap = await getDoc(guestRef);

    if (!guestSnap.exists()) return [];

    const conversations = guestSnap.data().conversations || [];
    return conversations.slice(-count);
  } catch (error) {
    console.error('Error getting recent conversations:', error);
    return [];
  }
}

/**
 * Get guest summary for AI context
 */
export async function getGuestSummary(guestId: string): Promise<string> {
  try {
    const memory = await getOrCreateGuestMemory(guestId);

    const parts: string[] = [];
    parts.push(`Guest: ${memory.guestName}`);
    parts.push(`VIP Status: ${memory.vipStatus}`);
    parts.push(`Total Stays: ${memory.stays.length}`);
    parts.push(`Total Conversations: ${memory.conversations.length}`);

    if (memory.preferences.travelReason) {
      parts.push(`Travel Type: ${memory.preferences.travelReason}`);
    }

    if (memory.preferences.preferredProperties?.length) {
      parts.push(`Preferred Properties: ${memory.preferences.preferredProperties.join(', ')}`);
    }

    if (memory.tags.length > 0) {
      parts.push(`Tags: ${memory.tags.join(', ')}`);
    }

    // Add recent stay info
    if (memory.stays.length > 0) {
      const lastStay = memory.stays[memory.stays.length - 1];
      parts.push(`Last Stay: ${lastStay.propertyName || lastStay.propertyId}`);
      if (lastStay.rating) {
        parts.push(`Last Rating: ${lastStay.rating}/5`);
      }
    }

    return parts.join('\n');
  } catch (error) {
    console.error('Error getting guest summary:', error);
    return `Guest ID: ${guestId}`;
  }
}

/**
 * Extract and save preferences from conversation
 */
export async function extractPreferencesFromConversation(
  guestId: string,
  conversation: string
): Promise<Partial<GuestPreferences>> {
  const preferences: Partial<GuestPreferences> = {};
  const lower = conversation.toLowerCase();

  // Detect travel reason
  if (lower.includes('business') || lower.includes('work trip') || lower.includes('conference')) {
    preferences.travelReason = 'business';
  } else if (lower.includes('family') || lower.includes('kids') || lower.includes('children')) {
    preferences.travelReason = 'family';
  } else if (lower.includes('crew') || lower.includes('workers') || lower.includes('team')) {
    preferences.travelReason = 'work_crew';
  } else if (lower.includes('anniversary') || lower.includes('romantic') || lower.includes('honeymoon')) {
    preferences.travelReason = 'romantic';
  } else if (lower.includes('medical') || lower.includes('hospital') || lower.includes('treatment')) {
    preferences.travelReason = 'medical';
  }

  // Detect pet owner
  if (lower.includes('dog') || lower.includes('pet') || lower.includes('cat')) {
    preferences.petOwner = true;
  }

  // Detect early/late preferences
  if (lower.includes('early check') || lower.includes('arrive early')) {
    preferences.earlyCheckIn = true;
  }
  if (lower.includes('late check') || lower.includes('leave late')) {
    preferences.lateCheckOut = true;
  }

  // Detect quiet hours preference
  if (lower.includes('quiet') || lower.includes('noise') || lower.includes('early sleeper')) {
    preferences.quietHours = true;
  }

  // Save detected preferences
  if (Object.keys(preferences).length > 0) {
    await updateGuestPreferences(guestId, preferences);
  }

  return preferences;
}

// ============================================
// SESSION MANAGEMENT
// ============================================

/**
 * Create or get a Steven AI session
 */
export async function getOrCreateSession(
  sessionId: string,
  guestId?: string
): Promise<{
  sessionId: string;
  guestId?: string;
  messages: ConversationEntry[];
  startedAt: Date;
}> {
  try {
    const sessionRef = doc(db(), COLLECTIONS.SESSIONS, sessionId);
    const sessionSnap = await getDoc(sessionRef);

    if (sessionSnap.exists()) {
      const data = sessionSnap.data();
      await updateDoc(sessionRef, { lastActivity: serverTimestamp() });
      return {
        sessionId,
        guestId: data.guestId,
        messages: data.messages || [],
        startedAt: data.startedAt?.toDate() || new Date(),
      };
    }

    // Create new session
    const newSession = {
      sessionId,
      guestId,
      messages: [],
      startedAt: serverTimestamp(),
      lastActivity: serverTimestamp(),
    };

    await setDoc(sessionRef, newSession);

    return {
      sessionId,
      guestId,
      messages: [],
      startedAt: new Date(),
    };
  } catch (error) {
    console.error('Error getting session:', error);
    return {
      sessionId,
      guestId,
      messages: [],
      startedAt: new Date(),
    };
  }
}

/**
 * Add message to session
 */
export async function addSessionMessage(
  sessionId: string,
  entry: ConversationEntry
): Promise<void> {
  try {
    const sessionRef = doc(db(), COLLECTIONS.SESSIONS, sessionId);
    const sessionSnap = await getDoc(sessionRef);

    if (!sessionSnap.exists()) return;

    const messages = sessionSnap.data().messages || [];
    messages.push(entry);

    // Keep last 50 messages per session
    const trimmedMessages = messages.slice(-50);

    await updateDoc(sessionRef, {
      messages: trimmedMessages,
      lastActivity: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error adding session message:', error);
  }
}

// ============================================
// EXPORT
// ============================================

export const StevenMemory = {
  guest: {
    getOrCreate: getOrCreateGuestMemory,
    addConversation: addConversationEntry,
    updatePreferences: updateGuestPreferences,
    addStay: addStayHistory,
    addTags: addGuestTags,
    search: searchGuests,
    getRecent: getRecentConversations,
    getSummary: getGuestSummary,
    extractPreferences: extractPreferencesFromConversation,
  },
  session: {
    getOrCreate: getOrCreateSession,
    addMessage: addSessionMessage,
  },
};

export default StevenMemory;
