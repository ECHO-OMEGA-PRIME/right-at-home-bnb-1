/**
 * Right At Home BnB - Prisma Security Helpers
 * Secure patterns for database queries with audit logging
 *
 * Made by ECHO OMEGA PRIME | Authority 11.0 SOVEREIGN
 */

import { sanitizeId, sanitizeObject, detectSqlInjection } from './sanitize';
import type { SessionData } from './auth';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Audit log entry for database operations
 */
export interface AuditLogEntry {
  userId: string | null;
  action: 'CREATE' | 'READ' | 'UPDATE' | 'DELETE' | 'QUERY';
  entity: string;
  entityId: string | null;
  oldValues: Record<string, unknown> | null;
  newValues: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  timestamp: Date;
}

/**
 * Query filter for safe database operations
 */
export interface SafeQueryFilter {
  [key: string]: unknown;
}

/**
 * Row-level security context
 */
export interface RlsContext {
  userId: string;
  role: string;
  tenantId?: string;
}

// ============================================================================
// SAFE ID HANDLING
// ============================================================================

/**
 * Safely parse and validate an entity ID
 * Prevents ID injection attacks
 */
export function safeId(id: unknown): string {
  if (typeof id !== 'string') {
    throw new DatabaseSecurityError('Invalid ID type');
  }

  const sanitized = sanitizeId(id);
  if (!sanitized) {
    throw new DatabaseSecurityError('Invalid ID format');
  }

  return sanitized;
}

/**
 * Validate multiple IDs
 */
export function safeIds(ids: unknown[]): string[] {
  if (!Array.isArray(ids)) {
    throw new DatabaseSecurityError('Invalid IDs type');
  }

  return ids.map((id) => safeId(id));
}

// ============================================================================
// SAFE FILTER BUILDING
// ============================================================================

/**
 * Build a safe where clause for Prisma queries
 * Sanitizes all values and prevents injection
 */
export function safeWhere<T extends Record<string, unknown>>(
  filter: T
): T {
  // Check for SQL injection patterns in string values
  for (const [key, value] of Object.entries(filter)) {
    if (typeof value === 'string' && detectSqlInjection(value)) {
      throw new DatabaseSecurityError(`Potential injection detected in field: ${key}`);
    }
  }

  // Sanitize the entire filter object
  return sanitizeObject(filter) as T;
}

/**
 * Build a safe select clause
 * Only allows specified fields to prevent data leakage
 */
export function safeSelect<T extends string>(
  allowedFields: T[],
  requestedFields?: T[]
): Record<T, true> {
  const fields = requestedFields ?? allowedFields;
  const select: Partial<Record<T, true>> = {};

  for (const field of fields) {
    if (allowedFields.includes(field)) {
      select[field] = true;
    }
  }

  return select as Record<T, true>;
}

/**
 * Build a safe include clause for relations
 */
export function safeInclude(
  allowedRelations: string[],
  requestedRelations?: string[]
): Record<string, boolean> {
  const relations = requestedRelations ?? [];
  const include: Record<string, boolean> = {};

  for (const relation of relations) {
    if (allowedRelations.includes(relation)) {
      include[relation] = true;
    }
  }

  return include;
}

// ============================================================================
// ROW-LEVEL SECURITY PATTERNS
// ============================================================================

/**
 * Add row-level security filter based on user context
 */
export function withRls<T extends Record<string, unknown>>(
  filter: T,
  context: RlsContext,
  ownerField: string = 'userId'
): T {
  // Admin/Owner bypass RLS
  if (context.role === 'ADMIN' || context.role === 'OWNER') {
    return filter;
  }

  // Add owner restriction for other roles
  return {
    ...filter,
    [ownerField]: context.userId,
  };
}

/**
 * Check if user can access a specific resource
 */
export function canAccessResource(
  resource: { [key: string]: unknown },
  context: RlsContext,
  ownerField: string = 'userId'
): boolean {
  // Admin/Owner can access all
  if (context.role === 'ADMIN' || context.role === 'OWNER') {
    return true;
  }

  // Check ownership
  return resource[ownerField] === context.userId;
}

/**
 * Filter results based on row-level security
 */
export function filterByRls<T extends Record<string, unknown>>(
  results: T[],
  context: RlsContext,
  ownerField: string = 'userId'
): T[] {
  // Admin/Owner sees all
  if (context.role === 'ADMIN' || context.role === 'OWNER') {
    return results;
  }

  // Filter to owned resources
  return results.filter((r) => r[ownerField] === context.userId);
}

// ============================================================================
// SENSITIVE DATA HANDLING
// ============================================================================

/**
 * Fields that should never be returned in queries
 */
export const SENSITIVE_FIELDS = [
  'password',
  'passwordHash',
  'apiKey',
  'secretKey',
  'privateKey',
  'accessToken',
  'refreshToken',
  'wifiPassword',
  'accessCode',
  'currentCode',
] as const;

/**
 * Remove sensitive fields from query results
 */
export function stripSensitive<T extends Record<string, unknown>>(data: T): T {
  const stripped = { ...data };

  for (const field of SENSITIVE_FIELDS) {
    if (field in stripped) {
      delete stripped[field];
    }
  }

  return stripped;
}

/**
 * Strip sensitive fields from an array of results
 */
export function stripSensitiveArray<T extends Record<string, unknown>>(
  data: T[]
): T[] {
  return data.map(stripSensitive);
}

/**
 * Create a select object that excludes sensitive fields
 */
export function selectWithoutSensitive<T extends string>(
  allFields: T[]
): Record<Exclude<T, (typeof SENSITIVE_FIELDS)[number]>, true> {
  const select: Record<string, true> = {};

  for (const field of allFields) {
    if (!SENSITIVE_FIELDS.includes(field as (typeof SENSITIVE_FIELDS)[number])) {
      select[field] = true;
    }
  }

  return select as Record<Exclude<T, (typeof SENSITIVE_FIELDS)[number]>, true>;
}

// ============================================================================
// PAGINATION SECURITY
// ============================================================================

/**
 * Safe pagination parameters
 */
export interface SafePagination {
  skip: number;
  take: number;
}

/**
 * Create safe pagination from user input
 */
export function safePagination(
  page: unknown,
  limit: unknown,
  maxLimit: number = 100
): SafePagination {
  const pageNum = Math.max(1, parseInt(String(page)) || 1);
  const limitNum = Math.min(maxLimit, Math.max(1, parseInt(String(limit)) || 20));

  return {
    skip: (pageNum - 1) * limitNum,
    take: limitNum,
  };
}

/**
 * Safe orderBy from user input
 */
export function safeOrderBy(
  field: unknown,
  direction: unknown,
  allowedFields: string[]
): { [key: string]: 'asc' | 'desc' } | undefined {
  const fieldStr = String(field);
  const dirStr = String(direction).toLowerCase();

  if (!allowedFields.includes(fieldStr)) {
    return undefined;
  }

  const validDirection = dirStr === 'asc' ? 'asc' : 'desc';
  return { [fieldStr]: validDirection };
}

// ============================================================================
// AUDIT LOGGING
// ============================================================================

/**
 * Create an audit log entry
 */
export function createAuditEntry(
  session: SessionData | null,
  action: AuditLogEntry['action'],
  entity: string,
  entityId: string | null,
  options?: {
    oldValues?: Record<string, unknown>;
    newValues?: Record<string, unknown>;
    ipAddress?: string;
    userAgent?: string;
  }
): AuditLogEntry {
  return {
    userId: session?.userId ?? null,
    action,
    entity,
    entityId,
    oldValues: options?.oldValues ? stripSensitive(options.oldValues) : null,
    newValues: options?.newValues ? stripSensitive(options.newValues) : null,
    ipAddress: options?.ipAddress ?? null,
    userAgent: options?.userAgent ?? null,
    timestamp: new Date(),
  };
}

/**
 * Audit logger interface for dependency injection
 */
export interface AuditLogger {
  log(entry: AuditLogEntry): Promise<void>;
}

/**
 * Console audit logger (for development)
 */
export const consoleAuditLogger: AuditLogger = {
  async log(entry: AuditLogEntry): Promise<void> {
    console.log('[AUDIT]', JSON.stringify(entry, null, 2));
  },
};

// ============================================================================
// TRANSACTION SECURITY
// ============================================================================

/**
 * Transaction isolation levels
 */
export type IsolationLevel =
  | 'ReadUncommitted'
  | 'ReadCommitted'
  | 'RepeatableRead'
  | 'Serializable';

/**
 * Get recommended isolation level for operation type
 */
export function getRecommendedIsolation(
  operation: 'financial' | 'booking' | 'user' | 'general'
): IsolationLevel {
  switch (operation) {
    case 'financial':
      return 'Serializable'; // Highest isolation for money
    case 'booking':
      return 'RepeatableRead'; // Prevent double-booking
    case 'user':
      return 'ReadCommitted'; // Standard for user ops
    case 'general':
    default:
      return 'ReadCommitted';
  }
}

// ============================================================================
// QUERY RATE LIMITING
// ============================================================================

interface QueryStats {
  count: number;
  resetTime: number;
}

const queryStats = new Map<string, QueryStats>();

/**
 * Check if a user is within query rate limits
 */
export function checkQueryRateLimit(
  userId: string,
  maxQueries: number = 1000,
  windowMs: number = 60000
): boolean {
  const now = Date.now();
  let stats = queryStats.get(userId);

  if (!stats || stats.resetTime < now) {
    stats = { count: 0, resetTime: now + windowMs };
    queryStats.set(userId, stats);
  }

  stats.count++;

  return stats.count <= maxQueries;
}

/**
 * Get remaining query quota
 */
export function getRemainingQuota(
  userId: string,
  maxQueries: number = 1000
): number {
  const stats = queryStats.get(userId);
  if (!stats) return maxQueries;
  return Math.max(0, maxQueries - stats.count);
}

// ============================================================================
// EXCEPTION
// ============================================================================

export class DatabaseSecurityError extends Error {
  public readonly statusCode = 400;

  constructor(message: string) {
    super(message);
    this.name = 'DatabaseSecurityError';
  }
}
