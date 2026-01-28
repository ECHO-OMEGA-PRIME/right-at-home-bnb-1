/**
 * Right At Home BnB - Security Middleware
 * Express/Next.js/Fastify middleware for authentication, authorization, and input validation
 *
 * Made by ECHO OMEGA PRIME | Authority 11.0 SOVEREIGN
 */

import type { z } from 'zod';
import {
  authenticate,
  authorize,
  requireRole,
  type SessionData,
  type Permission,
  UserRole,
  type AuthResult,
} from './auth';
import { validateInput, type ValidationError, ValidationException } from './validation';
import { sanitizeObject, SECURITY_HEADERS } from './sanitize';

// ============================================================================
// REQUEST/RESPONSE TYPES
// ============================================================================

/**
 * Generic request interface for framework compatibility
 */
export interface SecurityRequest {
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
  query?: Record<string, string | string[] | undefined>;
  params?: Record<string, string | undefined>;
  method?: string;
  url?: string;
  ip?: string;
}

/**
 * Generic response interface for framework compatibility
 */
export interface SecurityResponse {
  status: (code: number) => SecurityResponse;
  json: (data: unknown) => void;
  setHeader: (name: string, value: string) => void;
  send: (data: unknown) => void;
}

/**
 * Next function for middleware chain
 */
export type NextFunction = (error?: Error) => void;

/**
 * Authenticated request with session data
 */
export interface AuthenticatedRequest extends SecurityRequest {
  session: SessionData;
  user: {
    id: string;
    email: string;
    name: string;
    role: UserRole;
  };
}

// ============================================================================
// AUTHENTICATION MIDDLEWARE
// ============================================================================

/**
 * Create authentication middleware
 * Validates JWT token and attaches session to request
 */
export function authMiddleware() {
  return (req: SecurityRequest, res: SecurityResponse, next: NextFunction): void => {
    const authHeader = getHeader(req, 'authorization');
    const result = authenticate(authHeader);

    if (!result.success || !result.session) {
      res.status(result.statusCode || 401).json({
        error: result.error || 'Authentication failed',
        statusCode: result.statusCode || 401,
      });
      return;
    }

    // Attach session to request
    const authenticatedReq = req as AuthenticatedRequest;
    authenticatedReq.session = result.session;
    authenticatedReq.user = {
      id: result.session.userId,
      email: result.session.email,
      name: result.session.name,
      role: result.session.role,
    };

    next();
  };
}

/**
 * Optional authentication - doesn't fail if no token, but parses if present
 */
export function optionalAuthMiddleware() {
  return (req: SecurityRequest, res: SecurityResponse, next: NextFunction): void => {
    const authHeader = getHeader(req, 'authorization');

    if (!authHeader) {
      next();
      return;
    }

    const result = authenticate(authHeader);

    if (result.success && result.session) {
      const authenticatedReq = req as AuthenticatedRequest;
      authenticatedReq.session = result.session;
      authenticatedReq.user = {
        id: result.session.userId,
        email: result.session.email,
        name: result.session.name,
        role: result.session.role,
      };
    }

    next();
  };
}

// ============================================================================
// AUTHORIZATION MIDDLEWARE
// ============================================================================

/**
 * Create authorization middleware for specific permission
 */
export function requirePermission(permission: Permission, resourceOwnerIdGetter?: (req: SecurityRequest) => string | undefined) {
  return (req: SecurityRequest, res: SecurityResponse, next: NextFunction): void => {
    const authenticatedReq = req as AuthenticatedRequest;

    if (!authenticatedReq.session) {
      res.status(401).json({
        error: 'Authentication required',
        statusCode: 401,
      });
      return;
    }

    const resourceOwnerId = resourceOwnerIdGetter?.(req);
    const result = authorize(authenticatedReq.session, permission, resourceOwnerId);

    if (!result.success) {
      res.status(result.statusCode || 403).json({
        error: result.error || 'Access denied',
        statusCode: result.statusCode || 403,
      });
      return;
    }

    next();
  };
}

/**
 * Create middleware requiring minimum role level
 */
export function requireMinRole(minRole: UserRole) {
  return (req: SecurityRequest, res: SecurityResponse, next: NextFunction): void => {
    const authenticatedReq = req as AuthenticatedRequest;

    if (!authenticatedReq.session) {
      res.status(401).json({
        error: 'Authentication required',
        statusCode: 401,
      });
      return;
    }

    const result = requireRole(authenticatedReq.session, minRole);

    if (!result.success) {
      res.status(result.statusCode || 403).json({
        error: result.error || 'Insufficient role',
        statusCode: result.statusCode || 403,
      });
      return;
    }

    next();
  };
}

/**
 * Require specific roles (any of the listed)
 */
export function requireRoles(...allowedRoles: UserRole[]) {
  return (req: SecurityRequest, res: SecurityResponse, next: NextFunction): void => {
    const authenticatedReq = req as AuthenticatedRequest;

    if (!authenticatedReq.session) {
      res.status(401).json({
        error: 'Authentication required',
        statusCode: 401,
      });
      return;
    }

    if (!allowedRoles.includes(authenticatedReq.session.role)) {
      res.status(403).json({
        error: `Access denied. Required roles: ${allowedRoles.join(', ')}`,
        statusCode: 403,
      });
      return;
    }

    next();
  };
}

// ============================================================================
// VALIDATION MIDDLEWARE
// ============================================================================

/**
 * Create body validation middleware
 */
export function validateBody<T>(schema: z.ZodSchema<T>) {
  return (req: SecurityRequest, res: SecurityResponse, next: NextFunction): void => {
    const result = validateInput(schema, req.body);

    if (!result.success) {
      res.status(400).json({
        error: 'Validation failed',
        statusCode: 400,
        details: result.errors,
      });
      return;
    }

    // Replace body with validated data
    req.body = result.data;
    next();
  };
}

/**
 * Create query validation middleware
 */
export function validateQuery<T>(schema: z.ZodSchema<T>) {
  return (req: SecurityRequest, res: SecurityResponse, next: NextFunction): void => {
    const result = validateInput(schema, req.query);

    if (!result.success) {
      res.status(400).json({
        error: 'Query validation failed',
        statusCode: 400,
        details: result.errors,
      });
      return;
    }

    req.query = result.data as Record<string, string | string[] | undefined>;
    next();
  };
}

/**
 * Create params validation middleware
 */
export function validateParams<T>(schema: z.ZodSchema<T>) {
  return (req: SecurityRequest, res: SecurityResponse, next: NextFunction): void => {
    const result = validateInput(schema, req.params);

    if (!result.success) {
      res.status(400).json({
        error: 'Parameter validation failed',
        statusCode: 400,
        details: result.errors,
      });
      return;
    }

    req.params = result.data as Record<string, string | undefined>;
    next();
  };
}

// ============================================================================
// SANITIZATION MIDDLEWARE
// ============================================================================

/**
 * Create input sanitization middleware
 */
export function sanitizeInput(options?: {
  body?: boolean;
  query?: boolean;
  params?: boolean;
  maxStringLength?: number;
  stripHtml?: boolean;
}) {
  const opts = {
    body: options?.body ?? true,
    query: options?.query ?? true,
    params: options?.params ?? true,
    maxStringLength: options?.maxStringLength ?? 10000,
    stripHtml: options?.stripHtml ?? true,
  };

  return (req: SecurityRequest, _res: SecurityResponse, next: NextFunction): void => {
    if (opts.body && req.body && typeof req.body === 'object') {
      req.body = sanitizeObject(req.body as Record<string, unknown>, {
        maxStringLength: opts.maxStringLength,
        stripHtml: opts.stripHtml,
      });
    }

    if (opts.query && req.query) {
      req.query = sanitizeObject(req.query as Record<string, unknown>, {
        maxStringLength: opts.maxStringLength,
        stripHtml: opts.stripHtml,
      }) as Record<string, string | string[] | undefined>;
    }

    if (opts.params && req.params) {
      req.params = sanitizeObject(req.params as Record<string, unknown>, {
        maxStringLength: opts.maxStringLength,
        stripHtml: opts.stripHtml,
      }) as Record<string, string | undefined>;
    }

    next();
  };
}

// ============================================================================
// SECURITY HEADERS MIDDLEWARE
// ============================================================================

/**
 * Add security headers to all responses
 */
export function securityHeaders() {
  return (_req: SecurityRequest, res: SecurityResponse, next: NextFunction): void => {
    for (const [header, value] of Object.entries(SECURITY_HEADERS)) {
      res.setHeader(header, value);
    }
    next();
  };
}

// ============================================================================
// RATE LIMITING MIDDLEWARE
// ============================================================================

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

/**
 * Create rate limiting middleware
 */
export function rateLimit(options: {
  windowMs: number;
  maxRequests: number;
  message?: string;
  keyGenerator?: (req: SecurityRequest) => string;
}) {
  const {
    windowMs,
    maxRequests,
    message = 'Too many requests, please try again later',
    keyGenerator = (req) => req.ip || 'unknown',
  } = options;

  // Clean up expired entries periodically
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of rateLimitStore.entries()) {
      if (entry.resetTime < now) {
        rateLimitStore.delete(key);
      }
    }
  }, windowMs);

  return (req: SecurityRequest, res: SecurityResponse, next: NextFunction): void => {
    const key = keyGenerator(req);
    const now = Date.now();

    let entry = rateLimitStore.get(key);

    if (!entry || entry.resetTime < now) {
      entry = { count: 0, resetTime: now + windowMs };
      rateLimitStore.set(key, entry);
    }

    entry.count++;

    res.setHeader('X-RateLimit-Limit', String(maxRequests));
    res.setHeader('X-RateLimit-Remaining', String(Math.max(0, maxRequests - entry.count)));
    res.setHeader('X-RateLimit-Reset', String(Math.ceil(entry.resetTime / 1000)));

    if (entry.count > maxRequests) {
      res.status(429).json({
        error: message,
        statusCode: 429,
        retryAfter: Math.ceil((entry.resetTime - now) / 1000),
      });
      return;
    }

    next();
  };
}

// ============================================================================
// COMBINED MIDDLEWARE
// ============================================================================

/**
 * Create a combined middleware chain for protected routes
 */
export function protectedRoute(options: {
  permission?: Permission;
  minRole?: UserRole;
  roles?: UserRole[];
  validate?: z.ZodSchema<unknown>;
  resourceOwnerIdGetter?: (req: SecurityRequest) => string | undefined;
}) {
  const middlewares: Array<(req: SecurityRequest, res: SecurityResponse, next: NextFunction) => void> = [
    sanitizeInput(),
    authMiddleware(),
  ];

  if (options.permission) {
    middlewares.push(requirePermission(options.permission, options.resourceOwnerIdGetter));
  }

  if (options.minRole) {
    middlewares.push(requireMinRole(options.minRole));
  }

  if (options.roles) {
    middlewares.push(requireRoles(...options.roles));
  }

  if (options.validate) {
    middlewares.push(validateBody(options.validate));
  }

  return (req: SecurityRequest, res: SecurityResponse, next: NextFunction): void => {
    let index = 0;

    const runNext = (error?: Error) => {
      if (error) {
        next(error);
        return;
      }

      const middleware = middlewares[index++];
      if (middleware) {
        middleware(req, res, runNext);
      } else {
        next();
      }
    };

    runNext();
  };
}

/**
 * Create middleware for public routes with rate limiting
 */
export function publicRoute(options?: {
  validate?: z.ZodSchema<unknown>;
  rateLimit?: { windowMs: number; maxRequests: number };
}) {
  const middlewares: Array<(req: SecurityRequest, res: SecurityResponse, next: NextFunction) => void> = [
    sanitizeInput(),
  ];

  if (options?.rateLimit) {
    middlewares.push(rateLimit(options.rateLimit));
  }

  if (options?.validate) {
    middlewares.push(validateBody(options.validate));
  }

  return (req: SecurityRequest, res: SecurityResponse, next: NextFunction): void => {
    let index = 0;

    const runNext = (error?: Error) => {
      if (error) {
        next(error);
        return;
      }

      const middleware = middlewares[index++];
      if (middleware) {
        middleware(req, res, runNext);
      } else {
        next();
      }
    };

    runNext();
  };
}

// ============================================================================
// ERROR HANDLING MIDDLEWARE
// ============================================================================

/**
 * Error handling middleware
 */
export function errorHandler() {
  return (err: Error, _req: SecurityRequest, res: SecurityResponse, _next: NextFunction): void => {
    console.error('[Security Error]', err);

    if (err instanceof ValidationException) {
      res.status(400).json(err.toJSON());
      return;
    }

    // Check for known error types
    const statusCode = (err as Error & { statusCode?: number }).statusCode || 500;

    res.status(statusCode).json({
      error: err.message || 'Internal server error',
      statusCode,
    });
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get a header value (handles string arrays)
 */
function getHeader(req: SecurityRequest, name: string): string | undefined {
  const value = req.headers[name.toLowerCase()];

  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

/**
 * Get the current authenticated user from a request
 */
export function getCurrentUser(req: SecurityRequest): SessionData | undefined {
  return (req as AuthenticatedRequest).session;
}

/**
 * Check if request is authenticated
 */
export function isAuthenticated(req: SecurityRequest): boolean {
  return !!(req as AuthenticatedRequest).session;
}

// ============================================================================
// NEXT.JS API ROUTE HELPERS
// ============================================================================

/**
 * Create a protected Next.js API handler
 */
export function withAuth<TBody = unknown>(
  handler: (req: AuthenticatedRequest, res: SecurityResponse) => Promise<void>,
  options?: {
    permission?: Permission;
    minRole?: UserRole;
    validate?: z.ZodSchema<TBody>;
  }
) {
  return async (req: SecurityRequest, res: SecurityResponse): Promise<void> => {
    // Apply security headers
    for (const [header, value] of Object.entries(SECURITY_HEADERS)) {
      res.setHeader(header, value);
    }

    // Authenticate
    const authHeader = getHeader(req, 'authorization');
    const authResult = authenticate(authHeader);

    if (!authResult.success || !authResult.session) {
      res.status(authResult.statusCode || 401).json({
        error: authResult.error || 'Authentication failed',
        statusCode: authResult.statusCode || 401,
      });
      return;
    }

    // Authorize
    if (options?.permission) {
      const authzResult = authorize(authResult.session, options.permission);
      if (!authzResult.success) {
        res.status(authzResult.statusCode || 403).json({
          error: authzResult.error || 'Access denied',
          statusCode: authzResult.statusCode || 403,
        });
        return;
      }
    }

    if (options?.minRole) {
      const roleResult = requireRole(authResult.session, options.minRole);
      if (!roleResult.success) {
        res.status(roleResult.statusCode || 403).json({
          error: roleResult.error || 'Insufficient role',
          statusCode: roleResult.statusCode || 403,
        });
        return;
      }
    }

    // Validate body
    if (options?.validate && req.body) {
      const validation = validateInput(options.validate, req.body);
      if (!validation.success) {
        res.status(400).json({
          error: 'Validation failed',
          statusCode: 400,
          details: validation.errors,
        });
        return;
      }
      req.body = validation.data;
    }

    // Sanitize inputs
    if (req.body && typeof req.body === 'object') {
      req.body = sanitizeObject(req.body as Record<string, unknown>);
    }

    // Build authenticated request
    const authenticatedReq: AuthenticatedRequest = {
      ...req,
      session: authResult.session,
      user: {
        id: authResult.session.userId,
        email: authResult.session.email,
        name: authResult.session.name,
        role: authResult.session.role,
      },
    };

    try {
      await handler(authenticatedReq, res);
    } catch (error) {
      console.error('[API Error]', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Internal server error',
        statusCode: 500,
      });
    }
  };
}

/**
 * Create a public Next.js API handler with rate limiting
 */
export function withPublic<TBody = unknown>(
  handler: (req: SecurityRequest, res: SecurityResponse) => Promise<void>,
  options?: {
    validate?: z.ZodSchema<TBody>;
    rateLimit?: { windowMs: number; maxRequests: number };
  }
) {
  return async (req: SecurityRequest, res: SecurityResponse): Promise<void> => {
    // Apply security headers
    for (const [header, value] of Object.entries(SECURITY_HEADERS)) {
      res.setHeader(header, value);
    }

    // Validate body
    if (options?.validate && req.body) {
      const validation = validateInput(options.validate, req.body);
      if (!validation.success) {
        res.status(400).json({
          error: 'Validation failed',
          statusCode: 400,
          details: validation.errors,
        });
        return;
      }
      req.body = validation.data;
    }

    // Sanitize inputs
    if (req.body && typeof req.body === 'object') {
      req.body = sanitizeObject(req.body as Record<string, unknown>);
    }

    try {
      await handler(req, res);
    } catch (error) {
      console.error('[API Error]', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Internal server error',
        statusCode: 500,
      });
    }
  };
}
