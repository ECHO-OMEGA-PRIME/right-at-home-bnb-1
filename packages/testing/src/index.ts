/**
 * RightAtHomeBnB Testing Suite
 * Export all testing utilities and fixtures
 */

// Test utilities
export * from '../utils/fixtures';
export * from '../utils/helpers';
export * from '../utils/mocks';

// Test constants
export const TEST_CONFIG = {
  /** Expected number of properties in Steven Palma's portfolio */
  EXPECTED_PROPERTIES: 14,

  /** Expected number of photos across all properties */
  EXPECTED_PHOTOS: 730,

  /** Firebase project ID for testing */
  FIREBASE_PROJECT: 'echo-prime-ai',

  /** Test database URL */
  DATABASE_URL: 'file:./test.db',

  /** API base URL for testing */
  API_BASE_URL: 'http://localhost:8000',

  /** Default timeout for async operations */
  DEFAULT_TIMEOUT: 5000
} as const;

// Property IDs from Steven's portfolio
export const STEVEN_PALMA_PROPERTY_IDS = [
  'oasis_pool_billiards',
  'adobe_compound_golf',
  'patio_home_hot_tub',
  'old_midland_living',
  'hot_tub_delight',
  'safari_gameroom',
  'destination_getaway',
  'retreat_covered_patio',
  'clermont_house',
  'uptown_place',
  'sprawling_ranch',
  'most_marvelous',
  'posh_private',
  'cowboy_siesta'
] as const;

export type StevenPalmaPropertyId = typeof STEVEN_PALMA_PROPERTY_IDS[number];
