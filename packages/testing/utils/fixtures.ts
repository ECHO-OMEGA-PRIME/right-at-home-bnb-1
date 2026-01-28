/**
 * Test Fixtures for RightAtHomeBnB
 * Real property data from Steven Palma's 14 Midland TX rentals
 */

import type { Property, Booking, Guest, CleaningJob, User } from '@rightathome/shared';

// ============================================
// STEVEN PALMA'S REAL PROPERTIES
// ============================================

export const REAL_PROPERTIES: Partial<Property>[] = [
  {
    id: 'prop_oasis_pool',
    name: 'Oasis Pool & Billiards',
    address: '2506 Castleford',
    city: 'Midland',
    state: 'TX',
    zip: '79705',
    type: 'house',
    bedrooms: 4,
    bathrooms: 2.5,
    maxGuests: 10,
    baseRate: 275,
    cleaningFee: 150,
    amenities: ['pool', 'billiards', 'hot_tub', 'grill', 'smart_tv', 'wifi'],
    status: 'active',
    cleaningDuration: 180
  },
  {
    id: 'prop_adobe_compound',
    name: 'Adobe Compound on Golf Course',
    address: '5105 Links Court',
    city: 'Midland',
    state: 'TX',
    zip: '79707',
    type: 'house',
    bedrooms: 5,
    bathrooms: 3.5,
    maxGuests: 14,
    baseRate: 350,
    cleaningFee: 200,
    amenities: ['golf_course_view', 'pool', 'hot_tub', 'game_room', 'wifi', 'smart_lock'],
    status: 'active',
    cleaningDuration: 240
  },
  {
    id: 'prop_patio_hot_tub',
    name: 'Patio Home with Hot Tub',
    address: '4702 Garfield',
    city: 'Midland',
    state: 'TX',
    zip: '79703',
    type: 'house',
    bedrooms: 3,
    bathrooms: 2,
    maxGuests: 8,
    baseRate: 200,
    cleaningFee: 125,
    amenities: ['hot_tub', 'patio', 'grill', 'wifi', 'washer_dryer'],
    status: 'active',
    cleaningDuration: 120
  },
  {
    id: 'prop_old_midland',
    name: 'Old Midland Living',
    address: '1306 Douglas',
    city: 'Midland',
    state: 'TX',
    zip: '79701',
    type: 'house',
    bedrooms: 3,
    bathrooms: 2,
    maxGuests: 6,
    baseRate: 175,
    cleaningFee: 100,
    amenities: ['vintage_charm', 'downtown', 'wifi', 'workspace'],
    status: 'active',
    cleaningDuration: 90
  },
  {
    id: 'prop_hot_tub_delight',
    name: 'Hot Tub Delight',
    address: '3805 Cimmaron',
    city: 'Midland',
    state: 'TX',
    zip: '79707',
    type: 'house',
    bedrooms: 3,
    bathrooms: 2,
    maxGuests: 8,
    baseRate: 225,
    cleaningFee: 125,
    amenities: ['hot_tub', 'fire_pit', 'patio', 'grill', 'wifi'],
    status: 'active',
    cleaningDuration: 120
  },
  {
    id: 'prop_safari_gameroom',
    name: 'Safari Gameroom',
    address: '5006 Neely',
    city: 'Midland',
    state: 'TX',
    zip: '79707',
    type: 'house',
    bedrooms: 4,
    bathrooms: 2,
    maxGuests: 10,
    baseRate: 250,
    cleaningFee: 150,
    amenities: ['game_room', 'safari_theme', 'arcade', 'wifi', 'smart_tv'],
    status: 'active',
    cleaningDuration: 150
  },
  {
    id: 'prop_destination_getaway',
    name: 'Destination Getaway',
    address: '4207 Storey',
    city: 'Midland',
    state: 'TX',
    zip: '79703',
    type: 'house',
    bedrooms: 3,
    bathrooms: 2,
    maxGuests: 8,
    baseRate: 195,
    cleaningFee: 125,
    amenities: ['patio', 'grill', 'wifi', 'family_friendly'],
    status: 'active',
    cleaningDuration: 120
  },
  {
    id: 'prop_retreat_patio',
    name: 'The Retreat - Covered Patio',
    address: '3702 Chelsea',
    city: 'Midland',
    state: 'TX',
    zip: '79707',
    type: 'house',
    bedrooms: 3,
    bathrooms: 2,
    maxGuests: 8,
    baseRate: 185,
    cleaningFee: 100,
    amenities: ['covered_patio', 'grill', 'wifi', 'workspace'],
    status: 'active',
    cleaningDuration: 90
  },
  {
    id: 'prop_clermont',
    name: 'Clermont House',
    address: '3506 Clermont',
    city: 'Midland',
    state: 'TX',
    zip: '79703',
    type: 'house',
    bedrooms: 3,
    bathrooms: 2,
    maxGuests: 6,
    baseRate: 165,
    cleaningFee: 100,
    amenities: ['patio', 'wifi', 'quiet_neighborhood'],
    status: 'active',
    cleaningDuration: 90
  },
  {
    id: 'prop_uptown_place',
    name: 'Uptown Place',
    address: '2302 Harvard',
    city: 'Midland',
    state: 'TX',
    zip: '79701',
    type: 'house',
    bedrooms: 2,
    bathrooms: 1,
    maxGuests: 4,
    baseRate: 145,
    cleaningFee: 75,
    amenities: ['downtown', 'wifi', 'compact', 'workspace'],
    status: 'active',
    cleaningDuration: 60
  },
  {
    id: 'prop_sprawling_ranch',
    name: 'Sprawling Ranch',
    address: '6301 County Road',
    city: 'Midland',
    state: 'TX',
    zip: '79706',
    type: 'house',
    bedrooms: 5,
    bathrooms: 3,
    maxGuests: 12,
    baseRate: 325,
    cleaningFee: 175,
    amenities: ['ranch', 'acreage', 'fire_pit', 'grill', 'pet_friendly'],
    status: 'active',
    cleaningDuration: 180
  },
  {
    id: 'prop_most_marvelous',
    name: 'Most Marvelous',
    address: '4501 Thomason',
    city: 'Midland',
    state: 'TX',
    zip: '79703',
    type: 'house',
    bedrooms: 3,
    bathrooms: 2,
    maxGuests: 6,
    baseRate: 185,
    cleaningFee: 100,
    amenities: ['modern', 'smart_home', 'wifi', 'grill'],
    status: 'active',
    cleaningDuration: 90
  },
  {
    id: 'prop_posh_private',
    name: 'Posh & Private',
    address: '3701 Stanolind',
    city: 'Midland',
    state: 'TX',
    zip: '79707',
    type: 'house',
    bedrooms: 3,
    bathrooms: 2,
    maxGuests: 6,
    baseRate: 195,
    cleaningFee: 100,
    amenities: ['private', 'modern', 'wifi', 'smart_lock'],
    status: 'active',
    cleaningDuration: 90
  },
  {
    id: 'prop_cowboy_siesta',
    name: 'Cowboy Siesta',
    address: '4005 Humble',
    city: 'Midland',
    state: 'TX',
    zip: '79703',
    type: 'house',
    bedrooms: 4,
    bathrooms: 2,
    maxGuests: 8,
    baseRate: 220,
    cleaningFee: 125,
    amenities: ['western_theme', 'patio', 'grill', 'wifi', 'family_friendly'],
    status: 'active',
    cleaningDuration: 120
  }
];

// ============================================
// TEST BOOKINGS
// ============================================

export const TEST_BOOKINGS: Partial<Booking>[] = [
  {
    id: 'book_1',
    propertyId: 'prop_oasis_pool',
    guestName: 'John Smith',
    guestEmail: 'john.smith@email.com',
    guestPhone: '+14325551234',
    checkIn: new Date('2026-02-15'),
    checkOut: new Date('2026-02-18'),
    guests: 4,
    nightlyRate: 275,
    nights: 3,
    subtotal: 825,
    cleaningFee: 150,
    serviceFee: 82.50,
    taxes: 95.38,
    total: 1152.88,
    status: 'confirmed',
    source: 'airbnb'
  },
  {
    id: 'book_2',
    propertyId: 'prop_adobe_compound',
    guestName: 'Sarah Johnson',
    guestEmail: 'sarah.johnson@email.com',
    guestPhone: '+14325555678',
    checkIn: new Date('2026-02-20'),
    checkOut: new Date('2026-02-27'),
    guests: 10,
    nightlyRate: 350,
    nights: 7,
    subtotal: 2450,
    cleaningFee: 200,
    serviceFee: 245,
    taxes: 260.55,
    total: 3155.55,
    status: 'confirmed',
    source: 'vrbo'
  },
  {
    id: 'book_3',
    propertyId: 'prop_hot_tub_delight',
    guestName: 'Michael Brown',
    guestEmail: 'mbrown@work.com',
    guestPhone: '+14325559012',
    checkIn: new Date('2026-03-01'),
    checkOut: new Date('2026-03-03'),
    guests: 2,
    nightlyRate: 225,
    nights: 2,
    subtotal: 450,
    cleaningFee: 125,
    serviceFee: 45,
    taxes: 55.80,
    total: 675.80,
    status: 'pending',
    source: 'direct'
  }
];

// ============================================
// TEST GUESTS
// ============================================

export const TEST_GUESTS: Partial<Guest>[] = [
  {
    id: 'guest_1',
    email: 'john.smith@email.com',
    name: 'John Smith',
    phone: '+14325551234',
    role: 'guest',
    totalStays: 3,
    lifetimeValue: 2500,
    vipStatus: false
  },
  {
    id: 'guest_2',
    email: 'sarah.johnson@email.com',
    name: 'Sarah Johnson',
    phone: '+14325555678',
    role: 'guest',
    totalStays: 8,
    lifetimeValue: 12500,
    vipStatus: true
  },
  {
    id: 'guest_3',
    email: 'mbrown@work.com',
    name: 'Michael Brown',
    phone: '+14325559012',
    role: 'guest',
    totalStays: 1,
    lifetimeValue: 675.80,
    vipStatus: false
  }
];

// ============================================
// TEST USERS (Staff)
// ============================================

export const TEST_USERS: Partial<User>[] = [
  {
    id: 'user_owner',
    email: 'steven@rightathomebnb.com',
    name: 'Steven Palma',
    phone: '+14325550001',
    role: 'owner'
  },
  {
    id: 'user_admin',
    email: 'admin@rightathomebnb.com',
    name: 'Admin User',
    phone: '+14325550002',
    role: 'admin'
  },
  {
    id: 'user_cleaner_1',
    email: 'maria@cleaners.com',
    name: 'Maria Garcia',
    phone: '+14325550003',
    role: 'cleaner'
  },
  {
    id: 'user_cleaner_2',
    email: 'jose@cleaners.com',
    name: 'Jose Martinez',
    phone: '+14325550004',
    role: 'cleaner'
  }
];

// ============================================
// TEST CLEANING JOBS
// ============================================

export const TEST_CLEANING_JOBS: Partial<CleaningJob>[] = [
  {
    id: 'clean_1',
    propertyId: 'prop_oasis_pool',
    bookingId: 'book_1',
    cleanerId: 'user_cleaner_1',
    scheduledDate: new Date('2026-02-18'),
    scheduledTime: '11:00',
    estimatedDuration: 180,
    status: 'scheduled',
    priority: 'high',
    rate: 150
  },
  {
    id: 'clean_2',
    propertyId: 'prop_adobe_compound',
    bookingId: 'book_2',
    cleanerId: 'user_cleaner_2',
    scheduledDate: new Date('2026-02-27'),
    scheduledTime: '10:00',
    estimatedDuration: 240,
    status: 'scheduled',
    priority: 'high',
    rate: 200
  }
];

// ============================================
// FACTORY FUNCTIONS
// ============================================

/**
 * Create a test property with optional overrides
 */
export function createTestProperty(overrides: Partial<Property> = {}): Partial<Property> {
  const base = REAL_PROPERTIES[Math.floor(Math.random() * REAL_PROPERTIES.length)];
  return {
    ...base,
    id: `prop_test_${Date.now()}`,
    ...overrides
  };
}

/**
 * Create a test booking with optional overrides
 */
export function createTestBooking(overrides: Partial<Booking> = {}): Partial<Booking> {
  const checkIn = new Date();
  checkIn.setDate(checkIn.getDate() + 7);
  const checkOut = new Date(checkIn);
  checkOut.setDate(checkOut.getDate() + 3);

  return {
    id: `book_test_${Date.now()}`,
    propertyId: 'prop_oasis_pool',
    guestName: 'Test Guest',
    guestEmail: 'test@example.com',
    guestPhone: '+14325550000',
    checkIn,
    checkOut,
    guests: 2,
    nightlyRate: 200,
    nights: 3,
    subtotal: 600,
    cleaningFee: 100,
    serviceFee: 60,
    taxes: 68.40,
    total: 828.40,
    status: 'confirmed',
    source: 'direct',
    ...overrides
  };
}

/**
 * Create a test guest with optional overrides
 */
export function createTestGuest(overrides: Partial<Guest> = {}): Partial<Guest> {
  return {
    id: `guest_test_${Date.now()}`,
    email: `test${Date.now()}@example.com`,
    name: 'Test Guest',
    phone: '+14325550000',
    role: 'guest',
    totalStays: 0,
    lifetimeValue: 0,
    vipStatus: false,
    ...overrides
  };
}

/**
 * Create a test cleaning job with optional overrides
 */
export function createTestCleaningJob(overrides: Partial<CleaningJob> = {}): Partial<CleaningJob> {
  const scheduledDate = new Date();
  scheduledDate.setDate(scheduledDate.getDate() + 1);

  return {
    id: `clean_test_${Date.now()}`,
    propertyId: 'prop_oasis_pool',
    scheduledDate,
    scheduledTime: '10:00',
    estimatedDuration: 120,
    status: 'scheduled',
    priority: 'normal',
    rate: 100,
    ...overrides
  };
}

// ============================================
// PHOTO COUNT DATA (From actual listings)
// ============================================

export const PROPERTY_PHOTO_COUNTS: Record<string, number> = {
  'prop_oasis_pool': 65,
  'prop_adobe_compound': 78,
  'prop_patio_hot_tub': 52,
  'prop_old_midland': 45,
  'prop_hot_tub_delight': 55,
  'prop_safari_gameroom': 62,
  'prop_destination_getaway': 48,
  'prop_retreat_patio': 42,
  'prop_clermont': 38,
  'prop_uptown_place': 35,
  'prop_sprawling_ranch': 72,
  'prop_most_marvelous': 44,
  'prop_posh_private': 46,
  'prop_cowboy_siesta': 48
};

export const TOTAL_EXPECTED_PHOTOS = Object.values(PROPERTY_PHOTO_COUNTS).reduce((a, b) => a + b, 0);
export const TOTAL_EXPECTED_PROPERTIES = REAL_PROPERTIES.length;
