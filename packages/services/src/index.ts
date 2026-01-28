/**
 * Right at Home BnB - Services Package
 * Comprehensive services for logging, caching, error handling, and API utilities
 *
 * @packageDocumentation
 * @module @rightathome/services
 */

// ============================================
// LOGGER
// ============================================
export {
  Logger,
  logger,
  loggers,
  createRequestLogger,
  generateRequestId,
  type LogLevel,
  type LogEntry,
  type LoggerConfig,
} from './logger';

// ============================================
// CACHE
// ============================================
export {
  Cache,
  globalCache,
  caches,
  cacheKeys,
  cacheTags,
  CACHE_TTL,
  type CacheEntry,
  type CacheConfig,
  type CacheStats,
} from './cache';

// ============================================
// ERRORS
// ============================================
export {
  // Error codes
  ErrorCode,
  type ErrorCodeType,

  // Base error
  AppError,

  // Specific errors
  ValidationError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
  RateLimitError,
  DatabaseError,
  ExternalServiceError,
  BookingError,
  SmartLockError,

  // Utilities
  isOperationalError,
  toAppError,
  createErrorResponse,
  withErrorHandling,
  tryCatch,
  tryCatchSync,
  type Result,
} from './errors';

// ============================================
// RATE LIMITER
// ============================================
export {
  RateLimiter,
  rateLimiters,
  createRateLimitMiddleware,
  withRateLimit,
  rateLimit,
  type RateLimiterConfig,
  type RateLimitStatus,
  type RateLimitMiddlewareConfig,
} from './rate-limiter';

// ============================================
// API UTILITIES
// ============================================
export {
  // Response helpers
  success,
  failure,
  paginated,

  // Request parsing
  parsePagination,
  parseSort,
  parseDateRange,
  parseRequired,

  // Handler creators
  createApiHandler,
  createMethodHandler,

  // Utilities
  getClientIp,
  validateBody,
  setCorsHeaders,

  // Types
  type HttpMethod,
  type ApiResponse,
  type PaginationParams,
  type PaginatedResponse,
  type SortParams,
  type ApiContext,
  type ApiHandler,
  type ApiRouteConfig,
  type MethodHandlers,
} from './api';
