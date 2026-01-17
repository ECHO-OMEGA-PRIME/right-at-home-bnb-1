/**
 * Right at Home BnB - Firebase Infinite Memory System
 * Persistent context storage for website, mobile app, and desktop
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
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  Timestamp,
  DocumentData,
} from 'firebase/firestore';

// ============================================
// TYPES
// ============================================

export interface MemoryEntry {
  id: string;
  key: string;
  value: any;
  category: 'property' | 'guest' | 'booking' | 'message' | 'setting' | 'context' | 'ai_interaction';
  propertyId?: string;
  guestId?: string;
  userId?: string;
  sessionId?: string;
  platform: 'web' | 'mobile' | 'desktop' | 'api';
  createdAt: Date;
  updatedAt: Date;
  expiresAt?: Date;
  metadata?: Record<string, any>;
}

export interface SessionContext {
  sessionId: string;
  userId?: string;
  platform: 'web' | 'mobile' | 'desktop';
  startedAt: Date;
  lastActivity: Date;
  messages: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
  }>;
  context: Record<string, any>;
}

export interface PropertyMemory {
  propertyId: string;
  address: string;
  zillowData?: {
    photos: string[];
    description: string;
    zestimate?: number;
    bedrooms: number;
    bathrooms: number;
    sqft: number;
    yearBuilt?: number;
    lastUpdated: Date;
  };
  bookingHistory: Array<{
    guestId: string;
    checkIn: Date;
    checkOut: Date;
    rating?: number;
  }>;
  notes: string[];
  issues: Array<{
    description: string;
    reportedAt: Date;
    resolvedAt?: Date;
  }>;
}

// ============================================
// COLLECTIONS
// ============================================

const COLLECTIONS = {
  MEMORY: 'rah_memory',
  SESSIONS: 'rah_sessions',
  PROPERTIES: 'rah_properties',
  CONTEXT: 'rah_context',
  AI_LOGS: 'rah_ai_logs',
};

// ============================================
// MEMORY FUNCTIONS
// ============================================

/**
 * Store a memory entry
 */
export async function remember(
  key: string,
  value: any,
  options: {
    category?: MemoryEntry['category'];
    propertyId?: string;
    guestId?: string;
    userId?: string;
    sessionId?: string;
    platform?: MemoryEntry['platform'];
    expiresIn?: number; // milliseconds
    metadata?: Record<string, any>;
  } = {}
): Promise<string> {
  const id = `${options.category || 'context'}_${key}_${Date.now()}`;
  const memoryRef = doc(db(), COLLECTIONS.MEMORY, id);

  const entry: Omit<MemoryEntry, 'id' | 'createdAt' | 'updatedAt'> & {
    createdAt: any;
    updatedAt: any;
    expiresAt?: any;
  } = {
    key,
    value,
    category: options.category || 'context',
    propertyId: options.propertyId,
    guestId: options.guestId,
    userId: options.userId,
    sessionId: options.sessionId,
    platform: options.platform || 'web',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    metadata: options.metadata,
  };

  if (options.expiresIn) {
    entry.expiresAt = Timestamp.fromDate(new Date(Date.now() + options.expiresIn));
  }

  await setDoc(memoryRef, entry);
  return id;
}

/**
 * Recall a memory by key
 */
export async function recall(
  key: string,
  options: {
    category?: MemoryEntry['category'];
    propertyId?: string;
    guestId?: string;
  } = {}
): Promise<any | null> {
  const memoryRef = collection(db(), COLLECTIONS.MEMORY);
  let q = query(memoryRef, where('key', '==', key), orderBy('createdAt', 'desc'), limit(1));

  if (options.category) {
    q = query(memoryRef, where('key', '==', key), where('category', '==', options.category), orderBy('createdAt', 'desc'), limit(1));
  }

  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;

  const doc = snapshot.docs[0];
  const data = doc.data();

  // Check expiration
  if (data.expiresAt && data.expiresAt.toDate() < new Date()) {
    await deleteDoc(doc.ref);
    return null;
  }

  return data.value;
}

/**
 * Search memories by category
 */
export async function searchMemories(
  options: {
    category?: MemoryEntry['category'];
    propertyId?: string;
    guestId?: string;
    userId?: string;
    limit?: number;
  } = {}
): Promise<MemoryEntry[]> {
  const memoryRef = collection(db(), COLLECTIONS.MEMORY);
  let constraints: any[] = [orderBy('createdAt', 'desc')];

  if (options.category) {
    constraints.unshift(where('category', '==', options.category));
  }
  if (options.propertyId) {
    constraints.unshift(where('propertyId', '==', options.propertyId));
  }
  if (options.guestId) {
    constraints.unshift(where('guestId', '==', options.guestId));
  }
  if (options.userId) {
    constraints.unshift(where('userId', '==', options.userId));
  }
  if (options.limit) {
    constraints.push(limit(options.limit));
  }

  const q = query(memoryRef, ...constraints);
  const snapshot = await getDocs(q);

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
    createdAt: doc.data().createdAt?.toDate(),
    updatedAt: doc.data().updatedAt?.toDate(),
    expiresAt: doc.data().expiresAt?.toDate(),
  })) as MemoryEntry[];
}

/**
 * Forget (delete) a memory
 */
export async function forget(id: string): Promise<void> {
  const memoryRef = doc(db(), COLLECTIONS.MEMORY, id);
  await deleteDoc(memoryRef);
}

// ============================================
// SESSION CONTEXT
// ============================================

/**
 * Create or get session context
 */
export async function getOrCreateSession(
  sessionId: string,
  platform: SessionContext['platform'],
  userId?: string
): Promise<SessionContext> {
  const sessionRef = doc(db(), COLLECTIONS.SESSIONS, sessionId);
  const sessionSnap = await getDoc(sessionRef);

  if (sessionSnap.exists()) {
    const data = sessionSnap.data();
    await updateDoc(sessionRef, { lastActivity: serverTimestamp() });
    return {
      sessionId,
      userId: data.userId,
      platform: data.platform,
      startedAt: data.startedAt?.toDate(),
      lastActivity: new Date(),
      messages: data.messages || [],
      context: data.context || {},
    };
  }

  const newSession: Omit<SessionContext, 'startedAt' | 'lastActivity'> & {
    startedAt: any;
    lastActivity: any;
  } = {
    sessionId,
    userId,
    platform,
    startedAt: serverTimestamp(),
    lastActivity: serverTimestamp(),
    messages: [],
    context: {},
  };

  await setDoc(sessionRef, newSession);
  return {
    ...newSession,
    startedAt: new Date(),
    lastActivity: new Date(),
  };
}

/**
 * Add message to session
 */
export async function addSessionMessage(
  sessionId: string,
  role: 'user' | 'assistant',
  content: string
): Promise<void> {
  const sessionRef = doc(db(), COLLECTIONS.SESSIONS, sessionId);
  const sessionSnap = await getDoc(sessionRef);

  if (!sessionSnap.exists()) return;

  const messages = sessionSnap.data().messages || [];
  messages.push({
    role,
    content,
    timestamp: new Date().toISOString(),
  });

  // Keep last 50 messages
  const trimmedMessages = messages.slice(-50);

  await updateDoc(sessionRef, {
    messages: trimmedMessages,
    lastActivity: serverTimestamp(),
  });
}

/**
 * Update session context
 */
export async function updateSessionContext(
  sessionId: string,
  context: Record<string, any>
): Promise<void> {
  const sessionRef = doc(db(), COLLECTIONS.SESSIONS, sessionId);
  const sessionSnap = await getDoc(sessionRef);

  if (!sessionSnap.exists()) return;

  const existingContext = sessionSnap.data().context || {};
  await updateDoc(sessionRef, {
    context: { ...existingContext, ...context },
    lastActivity: serverTimestamp(),
  });
}

// ============================================
// PROPERTY MEMORY
// ============================================

/**
 * Store property data including Zillow info
 */
export async function savePropertyMemory(
  propertyId: string,
  data: Partial<PropertyMemory>
): Promise<void> {
  const propRef = doc(db(), COLLECTIONS.PROPERTIES, propertyId);
  const propSnap = await getDoc(propRef);

  if (propSnap.exists()) {
    await updateDoc(propRef, {
      ...data,
      updatedAt: serverTimestamp(),
    });
  } else {
    await setDoc(propRef, {
      propertyId,
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }
}

/**
 * Get property memory
 */
export async function getPropertyMemory(propertyId: string): Promise<PropertyMemory | null> {
  const propRef = doc(db(), COLLECTIONS.PROPERTIES, propertyId);
  const propSnap = await getDoc(propRef);

  if (!propSnap.exists()) return null;

  return propSnap.data() as PropertyMemory;
}

/**
 * Add Zillow data to property
 */
export async function addZillowData(
  propertyId: string,
  zillowData: PropertyMemory['zillowData']
): Promise<void> {
  await savePropertyMemory(propertyId, { zillowData });
}

// ============================================
// AI INTERACTION LOGGING
// ============================================

/**
 * Log AI interaction for learning
 */
export async function logAIInteraction(
  sessionId: string,
  query: string,
  response: string,
  metadata: {
    category?: string;
    propertyId?: string;
    guestId?: string;
    sentiment?: 'positive' | 'neutral' | 'negative';
    helpful?: boolean;
  } = {}
): Promise<void> {
  const logRef = doc(db(), COLLECTIONS.AI_LOGS, `${sessionId}_${Date.now()}`);

  await setDoc(logRef, {
    sessionId,
    query,
    response,
    ...metadata,
    createdAt: serverTimestamp(),
  });
}

// ============================================
// CROSS-PLATFORM SYNC
// ============================================

/**
 * Sync context across platforms (web, mobile, desktop)
 */
export async function syncCrossPlatform(
  userId: string,
  platform: 'web' | 'mobile' | 'desktop',
  context: Record<string, any>
): Promise<void> {
  const syncRef = doc(db(), COLLECTIONS.CONTEXT, userId);
  const syncSnap = await getDoc(syncRef);

  const platformKey = `${platform}Context`;
  const update: Record<string, any> = {
    [platformKey]: context,
    [`${platform}LastSync`]: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  if (syncSnap.exists()) {
    await updateDoc(syncRef, update);
  } else {
    await setDoc(syncRef, {
      userId,
      ...update,
      createdAt: serverTimestamp(),
    });
  }
}

/**
 * Get synced context for user
 */
export async function getSyncedContext(userId: string): Promise<{
  webContext?: Record<string, any>;
  mobileContext?: Record<string, any>;
  desktopContext?: Record<string, any>;
} | null> {
  const syncRef = doc(db(), COLLECTIONS.CONTEXT, userId);
  const syncSnap = await getDoc(syncRef);

  if (!syncSnap.exists()) return null;

  const data = syncSnap.data();
  return {
    webContext: data.webContext,
    mobileContext: data.mobileContext,
    desktopContext: data.desktopContext,
  };
}

// ============================================
// UTILITY EXPORTS
// ============================================

export const FirebaseMemory = {
  remember,
  recall,
  search: searchMemories,
  forget,
  session: {
    getOrCreate: getOrCreateSession,
    addMessage: addSessionMessage,
    updateContext: updateSessionContext,
  },
  property: {
    save: savePropertyMemory,
    get: getPropertyMemory,
    addZillow: addZillowData,
  },
  ai: {
    log: logAIInteraction,
  },
  sync: {
    cross: syncCrossPlatform,
    get: getSyncedContext,
  },
};

export default FirebaseMemory;
