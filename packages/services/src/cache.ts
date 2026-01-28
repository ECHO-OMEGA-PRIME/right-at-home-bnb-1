/**
 * Right at Home BnB - Caching Service
 * In-memory caching with TTL, tags, and cache invalidation patterns
 *
 * @packageDocumentation
 * @module @rightathome/services/cache
 */

import { LRUCache } from 'lru-cache';

// ============================================
// TYPES
// ============================================

/** Cache entry with metadata */
export interface CacheEntry<T> {
  value: T;
  tags: string[];
  createdAt: number;
  expiresAt: number;
}

/** Cache configuration options */
export interface CacheConfig {
  /** Maximum number of items in cache */
  maxSize?: number;
  /** Default TTL in milliseconds */
  defaultTtl?: number;
  /** Whether to update TTL on access */
  updateAgeOnGet?: boolean;
}

/** Cache statistics */
export interface CacheStats {
  size: number;
  hits: number;
  misses: number;
  hitRate: number;
}

// ============================================
// DEFAULT TTLS (in milliseconds)
// ============================================

/** Pre-defined TTL values for common use cases */
export const CACHE_TTL = {
  /** 30 seconds - for rapidly changing data */
  SHORT: 30 * 1000,
  /** 5 minutes - for frequently accessed data */
  MEDIUM: 5 * 60 * 1000,
  /** 30 minutes - for relatively stable data */
  LONG: 30 * 60 * 1000,
  /** 1 hour - for stable data */
  HOUR: 60 * 60 * 1000,
  /** 24 hours - for rarely changing data */
  DAY: 24 * 60 * 60 * 1000,
} as const;

// ============================================
// CACHE CLASS
// ============================================

/**
 * In-memory cache with LRU eviction, TTL support, and tag-based invalidation.
 *
 * @example
 * ```typescript
 * const cache = new Cache<Property[]>({ maxSize: 100 });
 *
 * // Set with tags
 * cache.set('properties:all', properties, {
 *   ttl: CACHE_TTL.MEDIUM,
 *   tags: ['properties']
 * });
 *
 * // Get cached value
 * const cached = cache.get('properties:all');
 *
 * // Invalidate by tag
 * cache.invalidateByTag('properties');
 * ```
 */
export class Cache<T = unknown> {
  private cache: LRUCache<string, CacheEntry<T>>;
  private tagIndex: Map<string, Set<string>> = new Map();
  private hits = 0;
  private misses = 0;
  private defaultTtl: number;

  constructor(config: CacheConfig = {}) {
    const { maxSize = 1000, defaultTtl = CACHE_TTL.MEDIUM, updateAgeOnGet = false } = config;

    this.defaultTtl = defaultTtl;
    this.cache = new LRUCache<string, CacheEntry<T>>({
      max: maxSize,
      ttl: defaultTtl,
      updateAgeOnGet,
      dispose: (value, key) => {
        // Clean up tag index when entry is disposed
        this.removeFromTagIndex(key, value.tags);
      },
    });
  }

  // ============================================
  // CORE METHODS
  // ============================================

  /**
   * Get a value from cache
   * @param key - Cache key
   * @returns Cached value or undefined if not found/expired
   */
  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (entry) {
      this.hits++;
      return entry.value;
    }
    this.misses++;
    return undefined;
  }

  /**
   * Set a value in cache
   * @param key - Cache key
   * @param value - Value to cache
   * @param options - Cache options (ttl, tags)
   */
  set(
    key: string,
    value: T,
    options: { ttl?: number; tags?: string[] } = {}
  ): void {
    const { ttl = this.defaultTtl, tags = [] } = options;
    const now = Date.now();

    const entry: CacheEntry<T> = {
      value,
      tags,
      createdAt: now,
      expiresAt: now + ttl,
    };

    // Remove from old tag index if key exists
    const existing = this.cache.peek(key);
    if (existing) {
      this.removeFromTagIndex(key, existing.tags);
    }

    // Set in cache
    this.cache.set(key, entry, { ttl });

    // Add to tag index
    this.addToTagIndex(key, tags);
  }

  /**
   * Check if key exists in cache
   * @param key - Cache key
   * @returns True if key exists and is not expired
   */
  has(key: string): boolean {
    return this.cache.has(key);
  }

  /**
   * Delete a specific key from cache
   * @param key - Cache key to delete
   * @returns True if key was deleted
   */
  delete(key: string): boolean {
    const entry = this.cache.peek(key);
    if (entry) {
      this.removeFromTagIndex(key, entry.tags);
    }
    return this.cache.delete(key);
  }

  /**
   * Clear all entries from cache
   */
  clear(): void {
    this.cache.clear();
    this.tagIndex.clear();
    this.hits = 0;
    this.misses = 0;
  }

  // ============================================
  // TAG-BASED INVALIDATION
  // ============================================

  /**
   * Invalidate all entries with a specific tag
   * @param tag - Tag to invalidate
   * @returns Number of entries invalidated
   */
  invalidateByTag(tag: string): number {
    const keys = this.tagIndex.get(tag);
    if (!keys) return 0;

    let count = 0;
    for (const key of keys) {
      if (this.cache.delete(key)) {
        count++;
      }
    }

    this.tagIndex.delete(tag);
    return count;
  }

  /**
   * Invalidate entries matching multiple tags (AND logic)
   * @param tags - Array of tags
   * @returns Number of entries invalidated
   */
  invalidateByTags(tags: string[]): number {
    if (tags.length === 0) return 0;

    // Find keys that have ALL tags
    const keySets = tags.map((tag) => this.tagIndex.get(tag) || new Set<string>());
    const intersection = keySets.reduce((acc, set) => {
      return new Set([...acc].filter((key) => set.has(key)));
    });

    let count = 0;
    for (const key of intersection) {
      if (this.delete(key)) {
        count++;
      }
    }

    return count;
  }

  /**
   * Get all keys associated with a tag
   * @param tag - Tag to query
   * @returns Array of cache keys
   */
  getKeysByTag(tag: string): string[] {
    const keys = this.tagIndex.get(tag);
    return keys ? [...keys] : [];
  }

  // ============================================
  // PATTERN-BASED OPERATIONS
  // ============================================

  /**
   * Invalidate entries matching a key pattern
   * @param pattern - Regex pattern or string prefix
   * @returns Number of entries invalidated
   */
  invalidateByPattern(pattern: string | RegExp): number {
    const regex = typeof pattern === 'string' ? new RegExp(`^${pattern}`) : pattern;
    const keysToDelete: string[] = [];

    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        keysToDelete.push(key);
      }
    }

    let count = 0;
    for (const key of keysToDelete) {
      if (this.delete(key)) {
        count++;
      }
    }

    return count;
  }

  /**
   * Get all keys matching a pattern
   * @param pattern - Regex pattern or string prefix
   * @returns Array of matching keys
   */
  getKeysByPattern(pattern: string | RegExp): string[] {
    const regex = typeof pattern === 'string' ? new RegExp(`^${pattern}`) : pattern;
    const keys: string[] = [];

    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        keys.push(key);
      }
    }

    return keys;
  }

  // ============================================
  // UTILITY METHODS
  // ============================================

  /**
   * Get cache statistics
   * @returns Cache statistics object
   */
  getStats(): CacheStats {
    const total = this.hits + this.misses;
    return {
      size: this.cache.size,
      hits: this.hits,
      misses: this.misses,
      hitRate: total > 0 ? this.hits / total : 0,
    };
  }

  /**
   * Get the remaining TTL for a key in milliseconds
   * @param key - Cache key
   * @returns Remaining TTL or 0 if not found/expired
   */
  getRemainingTtl(key: string): number {
    const remaining = this.cache.getRemainingTTL(key);
    return remaining > 0 ? remaining : 0;
  }

  /**
   * Get or set a value (cache-aside pattern)
   * @param key - Cache key
   * @param factory - Function to create value if not cached
   * @param options - Cache options
   * @returns Cached or newly created value
   */
  async getOrSet(
    key: string,
    factory: () => Promise<T>,
    options: { ttl?: number; tags?: string[] } = {}
  ): Promise<T> {
    const cached = this.get(key);
    if (cached !== undefined) {
      return cached;
    }

    const value = await factory();
    this.set(key, value, options);
    return value;
  }

  /**
   * Get or set a value synchronously
   * @param key - Cache key
   * @param factory - Function to create value if not cached
   * @param options - Cache options
   * @returns Cached or newly created value
   */
  getOrSetSync(
    key: string,
    factory: () => T,
    options: { ttl?: number; tags?: string[] } = {}
  ): T {
    const cached = this.get(key);
    if (cached !== undefined) {
      return cached;
    }

    const value = factory();
    this.set(key, value, options);
    return value;
  }

  // ============================================
  // PRIVATE METHODS
  // ============================================

  private addToTagIndex(key: string, tags: string[]): void {
    for (const tag of tags) {
      if (!this.tagIndex.has(tag)) {
        this.tagIndex.set(tag, new Set());
      }
      this.tagIndex.get(tag)!.add(key);
    }
  }

  private removeFromTagIndex(key: string, tags: string[]): void {
    for (const tag of tags) {
      const keys = this.tagIndex.get(tag);
      if (keys) {
        keys.delete(key);
        if (keys.size === 0) {
          this.tagIndex.delete(tag);
        }
      }
    }
  }
}

// ============================================
// SINGLETON CACHES
// ============================================

/** Global cache instance for general use */
export const globalCache = new Cache({ maxSize: 1000, defaultTtl: CACHE_TTL.MEDIUM });

/** Pre-configured caches for different domains */
export const caches = {
  /** Property data cache */
  properties: new Cache({ maxSize: 100, defaultTtl: CACHE_TTL.LONG }),
  /** Booking data cache */
  bookings: new Cache({ maxSize: 500, defaultTtl: CACHE_TTL.MEDIUM }),
  /** Guest data cache */
  guests: new Cache({ maxSize: 200, defaultTtl: CACHE_TTL.LONG }),
  /** Dashboard/stats cache */
  stats: new Cache({ maxSize: 50, defaultTtl: CACHE_TTL.SHORT }),
  /** API response cache */
  api: new Cache({ maxSize: 200, defaultTtl: CACHE_TTL.SHORT }),
};

// ============================================
// CACHE KEY GENERATORS
// ============================================

/**
 * Generate cache keys with consistent naming
 */
export const cacheKeys = {
  /** Property cache keys */
  property: {
    single: (id: string) => `property:${id}`,
    list: (filter?: string) => `properties:list:${filter || 'all'}`,
    occupancy: (id: string) => `property:${id}:occupancy`,
    financials: (id: string) => `property:${id}:financials`,
    photos: (id: string) => `property:${id}:photos`,
    reviews: (id: string) => `property:${id}:reviews`,
  },
  /** Booking cache keys */
  booking: {
    single: (id: string) => `booking:${id}`,
    list: (filter?: string) => `bookings:list:${filter || 'all'}`,
    byProperty: (propertyId: string) => `bookings:property:${propertyId}`,
    byGuest: (guestId: string) => `bookings:guest:${guestId}`,
    upcoming: () => 'bookings:upcoming',
  },
  /** Guest cache keys */
  guest: {
    single: (id: string) => `guest:${id}`,
    list: (filter?: string) => `guests:list:${filter || 'all'}`,
    vip: () => 'guests:vip',
  },
  /** Stats/dashboard cache keys */
  stats: {
    dashboard: () => 'stats:dashboard',
    occupancy: (period?: string) => `stats:occupancy:${period || 'current'}`,
    revenue: (period?: string) => `stats:revenue:${period || 'current'}`,
  },
  /** Cleaning cache keys */
  cleaning: {
    jobs: (filter?: string) => `cleaning:jobs:${filter || 'all'}`,
    byCleaner: (cleanerId: string) => `cleaning:cleaner:${cleanerId}`,
    byProperty: (propertyId: string) => `cleaning:property:${propertyId}`,
    schedule: (date: string) => `cleaning:schedule:${date}`,
  },
};

// ============================================
// CACHE TAGS
// ============================================

/**
 * Standard cache tags for invalidation
 */
export const cacheTags = {
  PROPERTIES: 'properties',
  BOOKINGS: 'bookings',
  GUESTS: 'guests',
  CLEANING: 'cleaning',
  LOCKS: 'locks',
  MESSAGES: 'messages',
  EXPENSES: 'expenses',
  STATS: 'stats',
  USER: (userId: string) => `user:${userId}`,
  PROPERTY: (propertyId: string) => `property:${propertyId}`,
  GUEST: (guestId: string) => `guest:${guestId}`,
};
