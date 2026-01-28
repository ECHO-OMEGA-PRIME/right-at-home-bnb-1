/**
 * Right at Home BnB - Rate Limiting Service
 * In-memory rate limiting with sliding window algorithm
 *
 * @packageDocumentation
 * @module @rightathome/services/rate-limiter
 */

import { RateLimitError } from './errors';

// ============================================
// TYPES
// ============================================

/** Rate limiter configuration */
export interface RateLimiterConfig {
  /** Maximum requests allowed in the window */
  maxRequests: number;
  /** Time window in milliseconds */
  windowMs: number;
  /** Optional key prefix for namespacing */
  keyPrefix?: string;
  /** Message to return when rate limited */
  message?: string;
  /** Whether to skip successful requests (only count errors) */
  skipSuccessfulRequests?: boolean;
  /** Whether to skip failed requests (only count successes) */
  skipFailedRequests?: boolean;
}

/** Rate limit status */
export interface RateLimitStatus {
  /** Whether the limit has been exceeded */
  limited: boolean;
  /** Current request count in window */
  current: number;
  /** Maximum allowed requests */
  limit: number;
  /** Remaining requests allowed */
  remaining: number;
  /** Time until window resets (ms) */
  resetIn: number;
  /** Timestamp when window resets */
  resetAt: Date;
}

/** Rate limit hit record */
interface HitRecord {
  timestamp: number;
}

// ============================================
// RATE LIMITER CLASS
// ============================================

/**
 * In-memory rate limiter using sliding window algorithm.
 * Tracks requests per key (IP, user ID, API key, etc.)
 *
 * @example
 * ```typescript
 * const limiter = new RateLimiter({
 *   maxRequests: 100,
 *   windowMs: 60 * 1000, // 1 minute
 * });
 *
 * // Check if request should be allowed
 * const status = limiter.check('user:123');
 * if (status.limited) {
 *   throw new RateLimitError(status.resetIn);
 * }
 *
 * // Record a hit
 * limiter.hit('user:123');
 * ```
 */
export class RateLimiter {
  private config: Required<RateLimiterConfig>;
  private store: Map<string, HitRecord[]> = new Map();
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor(config: RateLimiterConfig) {
    this.config = {
      maxRequests: config.maxRequests,
      windowMs: config.windowMs,
      keyPrefix: config.keyPrefix ?? '',
      message: config.message ?? 'Too many requests, please try again later',
      skipSuccessfulRequests: config.skipSuccessfulRequests ?? false,
      skipFailedRequests: config.skipFailedRequests ?? false,
    };

    // Start cleanup interval to prevent memory leaks
    this.startCleanup();
  }

  // ============================================
  // PUBLIC METHODS
  // ============================================

  /**
   * Check rate limit status without recording a hit
   * @param key - Rate limit key (e.g., IP, user ID)
   * @returns Rate limit status
   */
  check(key: string): RateLimitStatus {
    const fullKey = this.getFullKey(key);
    const now = Date.now();
    const windowStart = now - this.config.windowMs;

    // Get hits in current window
    const hits = this.getValidHits(fullKey, windowStart);
    const current = hits.length;
    const remaining = Math.max(0, this.config.maxRequests - current);
    const limited = current >= this.config.maxRequests;

    // Calculate reset time
    const oldestHit = hits[0]?.timestamp ?? now;
    const resetIn = limited ? oldestHit + this.config.windowMs - now : 0;

    return {
      limited,
      current,
      limit: this.config.maxRequests,
      remaining,
      resetIn: Math.max(0, resetIn),
      resetAt: new Date(now + resetIn),
    };
  }

  /**
   * Record a hit and return updated status
   * @param key - Rate limit key
   * @returns Rate limit status after recording hit
   */
  hit(key: string): RateLimitStatus {
    const fullKey = this.getFullKey(key);
    const now = Date.now();
    const windowStart = now - this.config.windowMs;

    // Clean old hits and add new one
    const hits = this.getValidHits(fullKey, windowStart);
    hits.push({ timestamp: now });
    this.store.set(fullKey, hits);

    // Return updated status
    const current = hits.length;
    const remaining = Math.max(0, this.config.maxRequests - current);
    const limited = current > this.config.maxRequests;
    const oldestHit = hits[0]?.timestamp ?? now;
    const resetIn = oldestHit + this.config.windowMs - now;

    return {
      limited,
      current,
      limit: this.config.maxRequests,
      remaining,
      resetIn: Math.max(0, resetIn),
      resetAt: new Date(now + resetIn),
    };
  }

  /**
   * Check and hit in one operation - throws if limited
   * @param key - Rate limit key
   * @throws RateLimitError if limit exceeded
   * @returns Rate limit status
   */
  consume(key: string): RateLimitStatus {
    const status = this.check(key);
    if (status.limited) {
      throw new RateLimitError(status.resetIn, this.config.message);
    }
    return this.hit(key);
  }

  /**
   * Reset rate limit for a key
   * @param key - Rate limit key
   */
  reset(key: string): void {
    const fullKey = this.getFullKey(key);
    this.store.delete(fullKey);
  }

  /**
   * Clear all rate limit data
   */
  clear(): void {
    this.store.clear();
  }

  /**
   * Get headers to include in HTTP response
   * @param status - Rate limit status
   * @returns Header object
   */
  getHeaders(status: RateLimitStatus): Record<string, string> {
    return {
      'X-RateLimit-Limit': String(status.limit),
      'X-RateLimit-Remaining': String(status.remaining),
      'X-RateLimit-Reset': String(Math.ceil(status.resetAt.getTime() / 1000)),
      ...(status.limited && { 'Retry-After': String(Math.ceil(status.resetIn / 1000)) }),
    };
  }

  /**
   * Stop the cleanup interval
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  // ============================================
  // PRIVATE METHODS
  // ============================================

  private getFullKey(key: string): string {
    return this.config.keyPrefix ? `${this.config.keyPrefix}:${key}` : key;
  }

  private getValidHits(key: string, windowStart: number): HitRecord[] {
    const hits = this.store.get(key) ?? [];
    return hits.filter((hit) => hit.timestamp > windowStart);
  }

  private startCleanup(): void {
    // Clean up expired entries every minute
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      const windowStart = now - this.config.windowMs;

      for (const [key, hits] of this.store.entries()) {
        const validHits = hits.filter((hit) => hit.timestamp > windowStart);
        if (validHits.length === 0) {
          this.store.delete(key);
        } else if (validHits.length !== hits.length) {
          this.store.set(key, validHits);
        }
      }
    }, 60 * 1000);

    // Don't keep process alive just for cleanup
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
  }
}

// ============================================
// PRESET CONFIGURATIONS
// ============================================

/** Pre-configured rate limiters for common use cases */
export const rateLimiters = {
  /**
   * API rate limiter - 100 requests per minute
   */
  api: new RateLimiter({
    maxRequests: 100,
    windowMs: 60 * 1000,
    keyPrefix: 'api',
    message: 'API rate limit exceeded. Please wait before making more requests.',
  }),

  /**
   * Auth rate limiter - 5 login attempts per 15 minutes
   */
  auth: new RateLimiter({
    maxRequests: 5,
    windowMs: 15 * 60 * 1000,
    keyPrefix: 'auth',
    message: 'Too many login attempts. Please try again in 15 minutes.',
  }),

  /**
   * Strict rate limiter - 10 requests per minute (for sensitive operations)
   */
  strict: new RateLimiter({
    maxRequests: 10,
    windowMs: 60 * 1000,
    keyPrefix: 'strict',
    message: 'Rate limit exceeded for this operation.',
  }),

  /**
   * Burst rate limiter - 20 requests per 10 seconds
   */
  burst: new RateLimiter({
    maxRequests: 20,
    windowMs: 10 * 1000,
    keyPrefix: 'burst',
    message: 'Too many requests in a short period. Please slow down.',
  }),

  /**
   * Daily rate limiter - 1000 requests per day
   */
  daily: new RateLimiter({
    maxRequests: 1000,
    windowMs: 24 * 60 * 60 * 1000,
    keyPrefix: 'daily',
    message: 'Daily request limit exceeded. Limit resets at midnight.',
  }),
};

// ============================================
// MIDDLEWARE FACTORY
// ============================================

/**
 * Configuration for rate limit middleware
 */
export interface RateLimitMiddlewareConfig extends RateLimiterConfig {
  /** Function to extract key from request */
  keyGenerator?: (req: unknown) => string;
  /** Function to skip rate limiting for certain requests */
  skip?: (req: unknown) => boolean;
  /** Custom handler when rate limited */
  handler?: (req: unknown, res: unknown, status: RateLimitStatus) => void;
}

/**
 * Create a rate limiting middleware for Next.js API routes
 *
 * @example
 * ```typescript
 * const limiter = createRateLimitMiddleware({
 *   maxRequests: 100,
 *   windowMs: 60 * 1000,
 * });
 *
 * export default async function handler(req, res) {
 *   const limitResult = await limiter(req);
 *   if (!limitResult.success) {
 *     return res.status(429).json(limitResult.error);
 *   }
 *   // Handle request...
 * }
 * ```
 */
export function createRateLimitMiddleware(config: RateLimitMiddlewareConfig) {
  const limiter = new RateLimiter(config);

  const keyGenerator =
    config.keyGenerator ??
    ((req: unknown) => {
      // Try to extract IP from common patterns
      const r = req as Record<string, unknown>;
      const ip =
        (r.headers as Record<string, string | string[] | undefined>)?.['x-forwarded-for'] ||
        (r.headers as Record<string, string | string[] | undefined>)?.['x-real-ip'] ||
        (r.socket as { remoteAddress?: string })?.remoteAddress ||
        'anonymous';
      return Array.isArray(ip) ? ip[0] : (ip as string);
    });

  return async (
    req: unknown
  ): Promise<
    | { success: true; status: RateLimitStatus; headers: Record<string, string> }
    | { success: false; error: { code: string; message: string; retryAfter: number }; headers: Record<string, string> }
  > => {
    // Check skip condition
    if (config.skip?.(req)) {
      const mockStatus: RateLimitStatus = {
        limited: false,
        current: 0,
        limit: config.maxRequests,
        remaining: config.maxRequests,
        resetIn: 0,
        resetAt: new Date(),
      };
      return { success: true, status: mockStatus, headers: {} };
    }

    const key = keyGenerator(req);
    const status = limiter.check(key);
    const headers = limiter.getHeaders(status);

    if (status.limited) {
      return {
        success: false,
        error: {
          code: 'RATE_LIMITED',
          message: config.message ?? 'Too many requests',
          retryAfter: Math.ceil(status.resetIn / 1000),
        },
        headers,
      };
    }

    // Record the hit
    limiter.hit(key);

    return { success: true, status, headers };
  };
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Create a rate-limited function wrapper
 *
 * @example
 * ```typescript
 * const limitedFetch = withRateLimit(
 *   fetch,
 *   { maxRequests: 10, windowMs: 1000 },
 *   'api-fetch'
 * );
 * ```
 */
export function withRateLimit<T extends (...args: unknown[]) => unknown>(
  fn: T,
  config: RateLimiterConfig,
  key: string
): T {
  const limiter = new RateLimiter(config);

  return ((...args: Parameters<T>) => {
    limiter.consume(key);
    return fn(...args);
  }) as T;
}

/**
 * Decorator for rate limiting class methods
 */
export function rateLimit(config: RateLimiterConfig, keyFn?: (...args: unknown[]) => string) {
  const limiter = new RateLimiter(config);

  return function (
    _target: unknown,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ): PropertyDescriptor {
    const originalMethod = descriptor.value;

    descriptor.value = function (...args: unknown[]) {
      const key = keyFn ? keyFn(...args) : `${propertyKey}`;
      limiter.consume(key);
      return originalMethod.apply(this, args);
    };

    return descriptor;
  };
}
