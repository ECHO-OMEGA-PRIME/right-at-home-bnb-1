'use client';

/**
 * Right at Home BnB - Guest CRM System
 * Comprehensive guest tracking with auto-updating profiles
 * @author ECHO OMEGA PRIME
 */

import { db } from './auth';
import {
  doc, setDoc, getDoc, updateDoc, collection,
  query, where, getDocs, orderBy, serverTimestamp,
  increment, arrayUnion, Timestamp
} from 'firebase/firestore';

// Guest Profile Interface
export interface GuestProfile {
  id: string;
  // Basic Info
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  phone?: string;
  alternatePhone?: string;
  dateOfBirth?: string;
  // Address
  address?: {
    street?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    country?: string;
  };
  // Tracking
  totalVisits: number;
  totalNightsStayed: number;
  totalSpent: number;
  firstStay?: Timestamp;
  lastStay?: Timestamp;
  upcomingBookings: number;
  // Reviews
  reviewsGiven: GuestReview[];
  averageRatingGiven: number;
  // Owner-Only Fields (Hidden from guest)
  ownerRating: number; // 1-5 internal rating
  ownerNotes: string; // Private notes
  ownerTags: string[]; // e.g., 'VIP', 'Difficult', 'Repeat', 'Local'
  isBlacklisted: boolean;
  blacklistReason?: string;
  // Preferences
  preferredProperties: string[];
  specialRequests: string[];
  dietaryRestrictions?: string;
  accessibilityNeeds?: string;
  // Communication
  communicationPreference: 'email' | 'phone' | 'text' | 'all';
  marketingOptIn: boolean;
  lastContactedAt?: Timestamp;
  // Metadata
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy?: string;
  source: 'airbnb' | 'vrbo' | 'direct' | 'website' | 'referral' | 'other';
}

// Guest Review Interface
export interface GuestReview {
  id: string;
  bookingId: string;
  propertyId: string;
  propertyName: string;
  rating: number;
  title?: string;
  comment: string;
  stayDate: string;
  photos?: string[];
  response?: {
    text: string;
    respondedAt: Timestamp;
    respondedBy: string;
  };
  isPublic: boolean;
  createdAt: Timestamp;
  platform: 'airbnb' | 'vrbo' | 'google' | 'direct' | 'website';
}

// Booking History Entry
export interface BookingHistoryEntry {
  bookingId: string;
  propertyId: string;
  propertyName: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  guests: number;
  totalPaid: number;
  status: 'completed' | 'cancelled' | 'no-show' | 'upcoming';
  platform: string;
  reviewId?: string;
}

// CRM Statistics
export interface CRMStats {
  totalGuests: number;
  repeatGuests: number;
  averageOwnerRating: number;
  totalReviews: number;
  averageGuestRating: number;
  vipGuests: number;
  blacklistedGuests: number;
}

// Create or update guest profile
export async function upsertGuestProfile(
  guestData: Partial<GuestProfile> & { email: string }
): Promise<GuestProfile> {
  const guestRef = doc(db(), 'guests', guestData.email.toLowerCase());
  const guestSnap = await getDoc(guestRef);

  if (guestSnap.exists()) {
    // Update existing guest
    const updates: any = {
      ...guestData,
      updatedAt: serverTimestamp(),
    };

    // Don't overwrite these if not provided
    if (guestData.totalVisits === undefined) delete updates.totalVisits;
    if (guestData.totalSpent === undefined) delete updates.totalSpent;
    if (guestData.ownerRating === undefined) delete updates.ownerRating;
    if (guestData.ownerNotes === undefined) delete updates.ownerNotes;

    await updateDoc(guestRef, updates);

    const updated = await getDoc(guestRef);
    return { id: updated.id, ...updated.data() } as GuestProfile;
  } else {
    // Create new guest
    const newGuest: GuestProfile = {
      id: guestData.email.toLowerCase(),
      email: guestData.email.toLowerCase(),
      firstName: guestData.firstName || '',
      lastName: guestData.lastName || '',
      fullName: guestData.fullName || `${guestData.firstName || ''} ${guestData.lastName || ''}`.trim(),
      phone: guestData.phone,
      dateOfBirth: guestData.dateOfBirth,
      address: guestData.address,
      totalVisits: 0,
      totalNightsStayed: 0,
      totalSpent: 0,
      upcomingBookings: 0,
      reviewsGiven: [],
      averageRatingGiven: 0,
      ownerRating: 3, // Default neutral rating
      ownerNotes: '',
      ownerTags: [],
      isBlacklisted: false,
      preferredProperties: [],
      specialRequests: [],
      communicationPreference: 'email',
      marketingOptIn: true,
      source: guestData.source || 'website',
      createdAt: serverTimestamp() as Timestamp,
      updatedAt: serverTimestamp() as Timestamp,
    };

    await setDoc(guestRef, newGuest);
    return newGuest;
  }
}

// Record a booking completion (auto-updates guest profile)
export async function recordBookingCompletion(
  guestEmail: string,
  booking: BookingHistoryEntry
): Promise<void> {
  const guestRef = doc(db(), 'guests', guestEmail.toLowerCase());

  await updateDoc(guestRef, {
    totalVisits: increment(1),
    totalNightsStayed: increment(booking.nights),
    totalSpent: increment(booking.totalPaid),
    lastStay: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  // Add to booking history
  const historyRef = doc(collection(db(), 'guests', guestEmail.toLowerCase(), 'bookingHistory'), booking.bookingId);
  await setDoc(historyRef, {
    ...booking,
    createdAt: serverTimestamp(),
  });
}

// Add guest review
export async function addGuestReview(
  guestEmail: string,
  review: Omit<GuestReview, 'id' | 'createdAt'>
): Promise<GuestReview> {
  const reviewId = `${review.propertyId}-${Date.now()}`;
  const guestRef = doc(db(), 'guests', guestEmail.toLowerCase());

  const newReview: GuestReview = {
    ...review,
    id: reviewId,
    createdAt: serverTimestamp() as Timestamp,
  };

  // Add to guest's reviews array
  await updateDoc(guestRef, {
    reviewsGiven: arrayUnion(newReview),
    updatedAt: serverTimestamp(),
  });

  // Also add to property's reviews collection
  const propertyReviewRef = doc(db(), 'properties', review.propertyId, 'reviews', reviewId);
  await setDoc(propertyReviewRef, {
    ...newReview,
    guestEmail: guestEmail.toLowerCase(),
    guestName: (await getDoc(guestRef)).data()?.fullName || 'Anonymous',
  });

  // Update guest's average rating given
  const guestData = (await getDoc(guestRef)).data() as GuestProfile;
  const totalRating = guestData.reviewsGiven.reduce((sum, r) => sum + r.rating, 0) + review.rating;
  const avgRating = totalRating / (guestData.reviewsGiven.length + 1);

  await updateDoc(guestRef, {
    averageRatingGiven: avgRating,
  });

  return newReview;
}

// Update owner rating and notes (hidden from guest)
export async function updateOwnerRating(
  guestEmail: string,
  rating: number,
  notes?: string,
  tags?: string[]
): Promise<void> {
  const guestRef = doc(db(), 'guests', guestEmail.toLowerCase());

  const updates: any = {
    ownerRating: Math.min(5, Math.max(1, rating)),
    updatedAt: serverTimestamp(),
  };

  if (notes !== undefined) updates.ownerNotes = notes;
  if (tags !== undefined) updates.ownerTags = tags;

  await updateDoc(guestRef, updates);
}

// Blacklist/unblacklist guest
export async function toggleBlacklist(
  guestEmail: string,
  blacklist: boolean,
  reason?: string
): Promise<void> {
  const guestRef = doc(db(), 'guests', guestEmail.toLowerCase());

  await updateDoc(guestRef, {
    isBlacklisted: blacklist,
    blacklistReason: blacklist ? reason : null,
    updatedAt: serverTimestamp(),
  });
}

// Get guest profile
export async function getGuestProfile(email: string): Promise<GuestProfile | null> {
  const guestRef = doc(db(), 'guests', email.toLowerCase());
  const guestSnap = await getDoc(guestRef);

  if (guestSnap.exists()) {
    return { id: guestSnap.id, ...guestSnap.data() } as GuestProfile;
  }
  return null;
}

// Get guest booking history
export async function getGuestBookingHistory(email: string): Promise<BookingHistoryEntry[]> {
  const historyRef = collection(db(), 'guests', email.toLowerCase(), 'bookingHistory');
  const q = query(historyRef, orderBy('checkIn', 'desc'));
  const snapshot = await getDocs(q);

  return snapshot.docs.map(doc => doc.data() as BookingHistoryEntry);
}

// Search guests
export async function searchGuests(
  searchTerm: string,
  filters?: {
    minVisits?: number;
    minOwnerRating?: number;
    tags?: string[];
    excludeBlacklisted?: boolean;
  }
): Promise<GuestProfile[]> {
  const guestsRef = collection(db(), 'guests');
  let q = query(guestsRef);

  // Note: Complex filtering may need to be done client-side due to Firestore limitations
  const snapshot = await getDocs(q);

  let results = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as GuestProfile);

  // Client-side filtering
  const searchLower = searchTerm.toLowerCase();
  results = results.filter(guest => {
    const matchesSearch = !searchTerm ||
      guest.fullName?.toLowerCase().includes(searchLower) ||
      guest.email?.toLowerCase().includes(searchLower) ||
      guest.phone?.includes(searchTerm);

    const matchesMinVisits = !filters?.minVisits || guest.totalVisits >= filters.minVisits;
    const matchesMinRating = !filters?.minOwnerRating || guest.ownerRating >= filters.minOwnerRating;
    const matchesTags = !filters?.tags?.length ||
      filters.tags.some(tag => guest.ownerTags?.includes(tag));
    const notBlacklisted = !filters?.excludeBlacklisted || !guest.isBlacklisted;

    return matchesSearch && matchesMinVisits && matchesMinRating && matchesTags && notBlacklisted;
  });

  return results;
}

// Get CRM statistics
export async function getCRMStats(): Promise<CRMStats> {
  const guestsRef = collection(db(), 'guests');
  const snapshot = await getDocs(guestsRef);

  const guests = snapshot.docs.map(doc => doc.data() as GuestProfile);

  const repeatGuests = guests.filter(g => g.totalVisits > 1).length;
  const vipGuests = guests.filter(g => g.ownerTags?.includes('VIP')).length;
  const blacklistedGuests = guests.filter(g => g.isBlacklisted).length;

  const totalOwnerRating = guests.reduce((sum, g) => sum + (g.ownerRating || 3), 0);
  const totalReviews = guests.reduce((sum, g) => sum + (g.reviewsGiven?.length || 0), 0);
  const totalGuestRating = guests.reduce((sum, g) => sum + (g.averageRatingGiven || 0), 0);

  return {
    totalGuests: guests.length,
    repeatGuests,
    averageOwnerRating: guests.length ? totalOwnerRating / guests.length : 0,
    totalReviews,
    averageGuestRating: guests.length ? totalGuestRating / guests.length : 0,
    vipGuests,
    blacklistedGuests,
  };
}

// Get all guests (for admin dashboard)
export async function getAllGuests(
  limit = 50,
  sortBy: 'lastStay' | 'totalVisits' | 'totalSpent' | 'ownerRating' = 'lastStay'
): Promise<GuestProfile[]> {
  const guestsRef = collection(db(), 'guests');
  const q = query(guestsRef, orderBy(sortBy, 'desc'));
  const snapshot = await getDocs(q);

  return snapshot.docs
    .map(doc => ({ id: doc.id, ...doc.data() }) as GuestProfile)
    .slice(0, limit);
}

// Export guest data (for reports)
export async function exportGuestData(): Promise<GuestProfile[]> {
  const guestsRef = collection(db(), 'guests');
  const snapshot = await getDocs(guestsRef);

  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as GuestProfile);
}

// Tag presets for quick categorization
export const GUEST_TAGS = [
  'VIP',
  'Repeat Guest',
  'Local',
  'Business Traveler',
  'Family',
  'Quiet Guest',
  'Needs Extra Attention',
  'Referred Others',
  'Pet Owner',
  'Long-Term Stay',
  'Last-Minute Booker',
  'Special Occasion',
  'Difficult',
  'Potential Issue',
] as const;

export type GuestTag = typeof GUEST_TAGS[number];
