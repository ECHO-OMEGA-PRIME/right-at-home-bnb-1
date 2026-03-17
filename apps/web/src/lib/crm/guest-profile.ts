/**
 * Right at Home BnB - Guest CRM Profile Manager
 * Manages guest profiles, stay history, preferences, VIP status,
 * tagging, and lifetime value calculations.
 */

import prisma from '../../src/lib/prisma';
import { toCents, formatMoney, addCents } from '../utils/money';

// ============================================
// TYPES
// ============================================

export interface GuestProfile {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  platform: string;

  // CRM data
  firstStay: Date | null;
  lastStay: Date | null;
  totalStays: number;
  totalSpentCents: number;
  avgRating: number | null;

  // VIP
  isVip: boolean;
  vipTier: string | null;

  // Tags & preferences
  tags: string[];
  notes: string | null;
  preferences: GuestPreferences;

  // Special dates
  birthday: Date | null;
  anniversary: Date | null;

  // Computed
  lifetimeValueCents: number;
  avgStayLengthNights: number;
  daysSinceLastStay: number | null;
  churnRisk: 'low' | 'medium' | 'high';
}

export interface GuestPreferences {
  temperatureF?: number;
  earlyCheckIn?: boolean;
  lateCheckOut?: boolean;
  petFriendly?: boolean;
  floorPreference?: 'ground' | 'upper';
  pillowType?: 'soft' | 'firm';
  allergies?: string[];
  dietaryRestrictions?: string[];
  communicationPreference?: 'email' | 'sms' | 'app';
  quietHours?: boolean;
  [key: string]: unknown;
}

export interface StayHistory {
  bookingId: string;
  propertyName: string;
  checkIn: Date;
  checkOut: Date;
  nights: number;
  totalPriceCents: number;
  platform: string;
  status: string;
  rating: number | null;
}

export interface GuestNote {
  id: string;
  content: string;
  createdBy: string;
  createdAt: string;
  category: 'general' | 'preference' | 'issue' | 'positive' | 'vip';
}

export interface GuestSearchFilters {
  query?: string;
  isVip?: boolean;
  platform?: string;
  minStays?: number;
  minSpentCents?: number;
  tags?: string[];
  hasUpcomingBooking?: boolean;
  limit?: number;
  offset?: number;
}

// ============================================
// VIP TIERS
// ============================================

const VIP_TIERS = {
  silver: { minStays: 3, minSpentCents: 150000, label: 'Silver' },
  gold: { minStays: 5, minSpentCents: 350000, label: 'Gold' },
  platinum: { minStays: 10, minSpentCents: 750000, label: 'Platinum' },
  diamond: { minStays: 20, minSpentCents: 1500000, label: 'Diamond' },
} as const;

// ============================================
// PROFILE OPERATIONS
// ============================================

/**
 * Get a complete guest profile with computed fields.
 */
export async function getGuestProfile(guestId: string): Promise<GuestProfile | null> {
  const guest = await prisma.guest.findUnique({
    where: { id: guestId },
    include: {
      bookings: {
        where: { status: { notIn: ['CANCELLED', 'DECLINED'] } },
        select: {
          checkIn: true,
          checkOut: true,
          totalPrice: true,
        },
        orderBy: { checkIn: 'desc' },
      },
    },
  });

  if (!guest) return null;

  // Parse JSON fields
  const tags = parseJsonArray(guest.tags);
  const preferences = parseJsonObject(guest.preferences) as GuestPreferences;

  // Calculate lifetime value (sum of all completed bookings)
  const totalSpentCents = toCents(guest.totalSpent);

  // Calculate average stay length
  let totalNights = 0;
  for (const booking of guest.bookings) {
    const nights = Math.ceil(
      (booking.checkOut.getTime() - booking.checkIn.getTime()) / (1000 * 60 * 60 * 24)
    );
    totalNights += nights;
  }
  const avgStayLengthNights = guest.bookings.length > 0
    ? Math.round((totalNights / guest.bookings.length) * 10) / 10
    : 0;

  // Days since last stay
  const daysSinceLastStay = guest.lastStay
    ? Math.floor((Date.now() - guest.lastStay.getTime()) / (1000 * 60 * 60 * 24))
    : null;

  // Churn risk based on recency
  const churnRisk = calculateChurnRisk(daysSinceLastStay, guest.totalStays);

  // Determine VIP tier
  const vipTier = determineVipTier(guest.totalStays, totalSpentCents);

  return {
    id: guest.id,
    email: guest.email,
    name: guest.name,
    phone: guest.phone,
    platform: guest.platform,
    firstStay: guest.firstStay,
    lastStay: guest.lastStay,
    totalStays: guest.totalStays,
    totalSpentCents,
    avgRating: guest.avgRating,
    isVip: guest.isVip || vipTier !== null,
    vipTier: vipTier || guest.vipTier,
    tags,
    notes: guest.notes,
    preferences,
    birthday: guest.birthday,
    anniversary: guest.anniversary,
    lifetimeValueCents: totalSpentCents,
    avgStayLengthNights,
    daysSinceLastStay,
    churnRisk,
  };
}

/**
 * Get a guest's complete stay history.
 */
export async function getStayHistory(guestId: string): Promise<StayHistory[]> {
  const bookings = await prisma.booking.findMany({
    where: {
      guestId,
      status: { notIn: ['CANCELLED', 'DECLINED'] },
    },
    include: {
      property: { select: { name: true } },
    },
    orderBy: { checkIn: 'desc' },
  });

  return bookings.map((b) => ({
    bookingId: b.id,
    propertyName: b.property.name,
    checkIn: b.checkIn,
    checkOut: b.checkOut,
    nights: Math.ceil((b.checkOut.getTime() - b.checkIn.getTime()) / (1000 * 60 * 60 * 24)),
    totalPriceCents: toCents(b.totalPrice),
    platform: b.platform,
    status: b.status,
    rating: null, // Rating would come from a reviews table if it existed
  }));
}

// ============================================
// PREFERENCES & TAGS
// ============================================

/**
 * Update a guest's preferences.
 * Merges with existing preferences (does not replace).
 */
export async function updatePreferences(
  guestId: string,
  newPreferences: Partial<GuestPreferences>
): Promise<GuestPreferences> {
  const guest = await prisma.guest.findUnique({
    where: { id: guestId },
    select: { preferences: true },
  });

  if (!guest) throw new Error(`Guest not found: ${guestId}`);

  const existing = parseJsonObject(guest.preferences) as GuestPreferences;
  const merged = { ...existing, ...newPreferences };

  await prisma.guest.update({
    where: { id: guestId },
    data: {
      preferences: JSON.stringify(merged),
      updatedAt: new Date(),
    },
  });

  return merged;
}

/**
 * Add tags to a guest profile.
 * Tags are deduplicated and lowercased.
 */
export async function addTags(guestId: string, newTags: string[]): Promise<string[]> {
  const guest = await prisma.guest.findUnique({
    where: { id: guestId },
    select: { tags: true },
  });

  if (!guest) throw new Error(`Guest not found: ${guestId}`);

  const existingTags = parseJsonArray(guest.tags);
  const normalizedNew = newTags.map((t) => t.toLowerCase().trim()).filter(Boolean);
  const merged = [...new Set([...existingTags, ...normalizedNew])];

  await prisma.guest.update({
    where: { id: guestId },
    data: { tags: JSON.stringify(merged) },
  });

  return merged;
}

/**
 * Remove tags from a guest profile.
 */
export async function removeTags(guestId: string, tagsToRemove: string[]): Promise<string[]> {
  const guest = await prisma.guest.findUnique({
    where: { id: guestId },
    select: { tags: true },
  });

  if (!guest) throw new Error(`Guest not found: ${guestId}`);

  const existingTags = parseJsonArray(guest.tags);
  const removeSet = new Set(tagsToRemove.map((t) => t.toLowerCase().trim()));
  const filtered = existingTags.filter((t) => !removeSet.has(t));

  await prisma.guest.update({
    where: { id: guestId },
    data: { tags: JSON.stringify(filtered) },
  });

  return filtered;
}

/**
 * Add a note to a guest's profile.
 * Notes are stored as a JSON array in the guest.notes field.
 */
export async function addNote(
  guestId: string,
  content: string,
  createdBy: string,
  category: GuestNote['category'] = 'general'
): Promise<GuestNote> {
  const guest = await prisma.guest.findUnique({
    where: { id: guestId },
    select: { notes: true },
  });

  if (!guest) throw new Error(`Guest not found: ${guestId}`);

  let notes: GuestNote[] = [];
  if (guest.notes) {
    try {
      notes = JSON.parse(guest.notes);
      if (!Array.isArray(notes)) notes = []; // Handle legacy string notes
    } catch {
      // If existing notes is a plain string, convert it to the first note
      notes = [{
        id: `note_legacy`,
        content: guest.notes,
        createdBy: 'system',
        createdAt: new Date().toISOString(),
        category: 'general',
      }];
    }
  }

  const newNote: GuestNote = {
    id: `note_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    content,
    createdBy,
    createdAt: new Date().toISOString(),
    category,
  };

  notes.push(newNote);

  await prisma.guest.update({
    where: { id: guestId },
    data: { notes: JSON.stringify(notes) },
  });

  return newNote;
}

// ============================================
// VIP MANAGEMENT
// ============================================

/**
 * Recalculate and update VIP status for a guest.
 * Called after booking completion or payment.
 */
export async function recalculateVipStatus(guestId: string): Promise<{ isVip: boolean; tier: string | null }> {
  const guest = await prisma.guest.findUnique({
    where: { id: guestId },
    select: { totalStays: true, totalSpent: true },
  });

  if (!guest) throw new Error(`Guest not found: ${guestId}`);

  const totalSpentCents = toCents(guest.totalSpent);
  const tier = determineVipTier(guest.totalStays, totalSpentCents);
  const isVip = tier !== null;

  await prisma.guest.update({
    where: { id: guestId },
    data: { isVip, vipTier: tier },
  });

  return { isVip, tier };
}

/**
 * Recalculate VIP status for ALL guests. Called periodically.
 */
export async function recalculateAllVipStatuses(): Promise<number> {
  const guests = await prisma.guest.findMany({
    select: { id: true, totalStays: true, totalSpent: true },
  });

  let updated = 0;
  for (const guest of guests) {
    const totalSpentCents = toCents(guest.totalSpent);
    const tier = determineVipTier(guest.totalStays, totalSpentCents);
    const isVip = tier !== null;

    await prisma.guest.update({
      where: { id: guest.id },
      data: { isVip, vipTier: tier },
    });
    updated++;
  }

  return updated;
}

// ============================================
// SEARCH
// ============================================

/**
 * Search and filter guests.
 */
export async function searchGuests(filters: GuestSearchFilters): Promise<{
  guests: GuestProfile[];
  total: number;
}> {
  const where: any = {};

  if (filters.query) {
    where.OR = [
      { name: { contains: filters.query } },
      { email: { contains: filters.query } },
      { phone: { contains: filters.query } },
    ];
  }

  if (filters.isVip !== undefined) {
    where.isVip = filters.isVip;
  }

  if (filters.platform) {
    where.platform = filters.platform;
  }

  if (filters.minStays !== undefined) {
    where.totalStays = { gte: filters.minStays };
  }

  if (filters.minSpentCents !== undefined) {
    where.totalSpent = { gte: filters.minSpentCents / 100 }; // Convert cents to dollars for DB
  }

  const total = await prisma.guest.count({ where });

  const guests = await prisma.guest.findMany({
    where,
    orderBy: { totalSpent: 'desc' },
    take: filters.limit || 50,
    skip: filters.offset || 0,
    include: {
      bookings: {
        where: { status: { notIn: ['CANCELLED', 'DECLINED'] } },
        select: { checkIn: true, checkOut: true, totalPrice: true },
        orderBy: { checkIn: 'desc' },
      },
    },
  });

  const profiles: GuestProfile[] = guests.map((guest) => {
    const tags = parseJsonArray(guest.tags);
    const preferences = parseJsonObject(guest.preferences) as GuestPreferences;
    const totalSpentCents = toCents(guest.totalSpent);

    let totalNights = 0;
    for (const booking of guest.bookings) {
      totalNights += Math.ceil(
        (booking.checkOut.getTime() - booking.checkIn.getTime()) / (1000 * 60 * 60 * 24)
      );
    }

    const daysSinceLastStay = guest.lastStay
      ? Math.floor((Date.now() - guest.lastStay.getTime()) / (1000 * 60 * 60 * 24))
      : null;

    return {
      id: guest.id,
      email: guest.email,
      name: guest.name,
      phone: guest.phone,
      platform: guest.platform,
      firstStay: guest.firstStay,
      lastStay: guest.lastStay,
      totalStays: guest.totalStays,
      totalSpentCents,
      avgRating: guest.avgRating,
      isVip: guest.isVip,
      vipTier: guest.vipTier,
      tags,
      notes: guest.notes,
      preferences,
      birthday: guest.birthday,
      anniversary: guest.anniversary,
      lifetimeValueCents: totalSpentCents,
      avgStayLengthNights: guest.bookings.length > 0
        ? Math.round((totalNights / guest.bookings.length) * 10) / 10
        : 0,
      daysSinceLastStay,
      churnRisk: calculateChurnRisk(daysSinceLastStay, guest.totalStays),
    };
  });

  // Post-filter by tags if specified (can't do JSON contains in SQLite easily)
  let filtered = profiles;
  if (filters.tags && filters.tags.length > 0) {
    const requiredTags = new Set(filters.tags.map((t) => t.toLowerCase()));
    filtered = profiles.filter((p) =>
      p.tags.some((t) => requiredTags.has(t.toLowerCase()))
    );
  }

  return { guests: filtered, total };
}

/**
 * Get guests with upcoming birthdays (within the next N days).
 * Useful for sending birthday greetings or special offers.
 */
export async function getUpcomingBirthdays(withinDays: number = 14): Promise<GuestProfile[]> {
  const guests = await prisma.guest.findMany({
    where: {
      birthday: { not: null },
    },
    select: { id: true, birthday: true },
  });

  const now = new Date();
  const upcomingIds: string[] = [];

  for (const guest of guests) {
    if (!guest.birthday) continue;

    // Check if birthday falls within the next N days (ignoring year)
    const bday = new Date(guest.birthday);
    const thisYearBday = new Date(now.getFullYear(), bday.getMonth(), bday.getDate());

    // If this year's birthday has passed, check next year
    if (thisYearBday < now) {
      thisYearBday.setFullYear(thisYearBday.getFullYear() + 1);
    }

    const daysUntil = Math.ceil((thisYearBday.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (daysUntil <= withinDays) {
      upcomingIds.push(guest.id);
    }
  }

  const profiles: GuestProfile[] = [];
  for (const id of upcomingIds) {
    const profile = await getGuestProfile(id);
    if (profile) profiles.push(profile);
  }

  return profiles;
}

/**
 * Update guest CRM data after a booking completes.
 * Recalculates totalStays, totalSpent, firstStay, lastStay, avgRating, and VIP status.
 */
export async function updateGuestAfterBooking(guestId: string): Promise<void> {
  const bookings = await prisma.booking.findMany({
    where: {
      guestId,
      status: { notIn: ['CANCELLED', 'DECLINED'] },
    },
    select: {
      checkIn: true,
      totalPrice: true,
    },
    orderBy: { checkIn: 'asc' },
  });

  if (bookings.length === 0) return;

  const totalStays = bookings.length;
  const totalSpent = bookings.reduce((sum, b) => sum + b.totalPrice, 0);
  const firstStay = bookings[0].checkIn;
  const lastStay = bookings[bookings.length - 1].checkIn;

  await prisma.guest.update({
    where: { id: guestId },
    data: {
      totalStays,
      totalSpent,
      firstStay,
      lastStay,
    },
  });

  // Recalculate VIP
  await recalculateVipStatus(guestId);
}

// ============================================
// HELPERS
// ============================================

function parseJsonArray(value: string | null): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parseJsonObject(value: string | null): Record<string, unknown> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    return typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function determineVipTier(totalStays: number, totalSpentCents: number): string | null {
  // Check tiers from highest to lowest
  if (totalStays >= VIP_TIERS.diamond.minStays && totalSpentCents >= VIP_TIERS.diamond.minSpentCents) {
    return 'diamond';
  }
  if (totalStays >= VIP_TIERS.platinum.minStays && totalSpentCents >= VIP_TIERS.platinum.minSpentCents) {
    return 'platinum';
  }
  if (totalStays >= VIP_TIERS.gold.minStays && totalSpentCents >= VIP_TIERS.gold.minSpentCents) {
    return 'gold';
  }
  if (totalStays >= VIP_TIERS.silver.minStays && totalSpentCents >= VIP_TIERS.silver.minSpentCents) {
    return 'silver';
  }
  return null;
}

function calculateChurnRisk(daysSinceLastStay: number | null, totalStays: number): 'low' | 'medium' | 'high' {
  if (daysSinceLastStay === null) return 'high'; // Never stayed
  if (totalStays >= 5 && daysSinceLastStay <= 90) return 'low';
  if (totalStays >= 3 && daysSinceLastStay <= 180) return 'low';
  if (daysSinceLastStay <= 365) return 'medium';
  return 'high';
}
