/**
 * Right At Home BnB - Security Package
 * Comprehensive security utilities following OWASP best practices
 *
 * Made by ECHO OMEGA PRIME | Authority 11.0 SOVEREIGN
 */

// ============================================================================
// VALIDATION - Zod schemas for all API inputs
// ============================================================================
export {
  // Common schemas
  emailSchema,
  phoneSchema,
  idSchema,
  safeStringSchema,
  nameSchema,
  urlSchema,
  dateSchema,
  futureDateSchema,
  positiveNumberSchema,
  currencySchema,
  latitudeSchema,
  longitudeSchema,
  ratingSchema,

  // Enums
  UserRole as UserRoleEnum,
  PropertyType,
  PropertyStatus,
  BookingPlatform,
  VipTier,
  BookingStatus,
  CleaningJobType,
  CleaningJobStatus,
  ExpenseCategory,
  ExpenseStatus,
  MessageType,
  MessageChannel,
  MessageStatus,
  LockBrand,

  // Auth schemas
  loginSchema,
  registerSchema,
  userUpdateSchema,
  passwordChangeSchema,

  // Property schemas
  createPropertySchema,
  updatePropertySchema,

  // Guest schemas
  createGuestSchema,
  updateGuestSchema,

  // Booking schemas
  createBookingSchema,
  updateBookingSchema,

  // Cleaning job schemas
  createCleaningJobSchema,
  updateCleaningJobSchema,
  gpsCheckSchema,

  // Expense schemas
  createExpenseSchema,
  updateExpenseSchema,

  // Message schemas
  createMessageSchema,
  updateMessageSchema,

  // Smart lock schemas
  createSmartLockSchema,
  updateLockCodeSchema,

  // Concierge schemas
  createConciergeQuerySchema,
  rateConciergeSchema,

  // Search/filter schemas
  paginationSchema,
  dateRangeSchema,
  propertySearchSchema,
  bookingSearchSchema,
  guestSearchSchema,

  // Type exports
  type LoginInput,
  type RegisterInput,
  type UserUpdateInput,
  type PasswordChangeInput,
  type CreatePropertyInput,
  type UpdatePropertyInput,
  type CreateGuestInput,
  type UpdateGuestInput,
  type CreateBookingInput,
  type UpdateBookingInput,
  type CreateCleaningJobInput,
  type UpdateCleaningJobInput,
  type GpsCheckInput,
  type CreateExpenseInput,
  type UpdateExpenseInput,
  type CreateMessageInput,
  type UpdateMessageInput,
  type CreateSmartLockInput,
  type UpdateLockCodeInput,
  type CreateConciergeQueryInput,
  type RateConciergeInput,
  type PaginationInput,
  type DateRangeInput,
  type PropertySearchInput,
  type BookingSearchInput,
  type GuestSearchInput,

  // Validation utilities
  validateInput,
  withValidation,
  ValidationException,
  type ValidationError,
} from './validation';

// ============================================================================
// AUTHENTICATION - JWT, sessions, RBAC
// ============================================================================
export {
  // Types & Enums
  UserRole,
  ROLE_HIERARCHY,
  PERMISSIONS,
  type Permission,
  type JwtPayload,
  type SessionData,
  type AuthResult,

  // Initialization
  initializeAuth,

  // Password handling
  hashPassword,
  verifyPassword,

  // JWT operations
  createAccessToken,
  createRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  extractBearerToken,

  // RBAC
  hasPermission,
  getPermissionsForRole,
  meetsRoleLevel,
  canAccessOwnResource,

  // Session management
  createSessionFromToken,
  isSessionValid,

  // Auth helpers
  authenticate,
  authorize,
  requireRole,

  // Firebase integration
  verifyFirebaseToken,
  type FirebaseVerifyResult,

  // Rate limits
  RATE_LIMITS,
  type RateLimitConfig,

  // Exceptions
  AuthenticationError,
  AuthorizationError,
  TokenExpiredError,
} from './auth';

// ============================================================================
// SANITIZATION - XSS prevention, SQL injection protection
// ============================================================================
export {
  // XSS protection
  sanitizeXss,
  sanitizeHtmlContent,

  // SQL injection prevention
  escapeSql,
  detectSqlInjection,

  // Path traversal prevention
  sanitizePath,
  detectPathTraversal,

  // String sanitization
  stripHtml,
  normalizeWhitespace,
  removeControlChars,
  truncateSafe,

  // Type sanitization
  sanitizeEmail,
  sanitizePhone,
  sanitizeUrl,
  sanitizeInt,
  sanitizeFloat,
  sanitizeBoolean,
  sanitizeId,

  // Object sanitization
  sanitizeObject,

  // JSON handling
  safeJsonParse,
  safeJsonStringify,

  // Content type validation
  isValidMimeType,
  ALLOWED_IMAGE_TYPES,
  ALLOWED_DOCUMENT_TYPES,

  // Security headers
  SECURITY_HEADERS,

  // Exception
  SanitizationError,
} from './sanitize';

// ============================================================================
// CREDENTIALS - Secure environment variable loading
// ============================================================================
export {
  // Schema
  envSchema,
  type EnvConfig,

  // Loading
  loadCredentials,
  getCredentials,
  getCredential,
  hasCredential,
  reloadCredentials,

  // Masking
  isSensitiveKey,
  maskCredential,
  getSafeConfigForLogging,

  // Secure accessors
  getSecureDatabaseUrl,
  getFirebaseAdminCredentials,
  getTwilioCredentials,
  getStripeCredentials,

  // Service validation
  validateServiceCredentials,

  // Rotation
  checkCredentialRotation,
  type CredentialRotationStatus,

  // Exceptions
  CredentialError,
  MissingCredentialError,
} from './credentials';

// ============================================================================
// MIDDLEWARE - Express/Next.js/Fastify middleware
// ============================================================================
export {
  // Types
  type SecurityRequest,
  type SecurityResponse,
  type NextFunction,
  type AuthenticatedRequest,

  // Auth middleware
  authMiddleware,
  optionalAuthMiddleware,

  // Authorization middleware
  requirePermission,
  requireMinRole,
  requireRoles,

  // Validation middleware
  validateBody,
  validateQuery,
  validateParams,

  // Sanitization middleware
  sanitizeInput,

  // Security middleware
  securityHeaders,
  rateLimit,

  // Combined middleware
  protectedRoute,
  publicRoute,

  // Error handling
  errorHandler,

  // Helpers
  getCurrentUser,
  isAuthenticated,

  // Next.js helpers
  withAuth,
  withPublic,
} from './middleware';

// ============================================================================
// PRISMA SECURITY - Safe database query patterns
// ============================================================================
export {
  // Safe ID handling
  safeId,
  safeIds,

  // Safe filter building
  safeWhere,
  safeSelect,
  safeInclude,

  // Row-level security
  withRls,
  canAccessResource,
  filterByRls,
  type RlsContext,

  // Sensitive data handling
  SENSITIVE_FIELDS,
  stripSensitive,
  stripSensitiveArray,
  selectWithoutSensitive,

  // Pagination security
  safePagination,
  safeOrderBy,
  type SafePagination,

  // Audit logging
  createAuditEntry,
  consoleAuditLogger,
  type AuditLogEntry,
  type AuditLogger,

  // Transaction security
  getRecommendedIsolation,
  type IsolationLevel,

  // Query rate limiting
  checkQueryRateLimit,
  getRemainingQuota,

  // Exception
  DatabaseSecurityError,
} from './prisma-security';
