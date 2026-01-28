/**
 * Right at Home BnB - API Utilities
 * Common utilities for building API routes in Next.js
 *
 * @packageDocumentation
 * @module @rightathome/services/api
 */

import { Logger, createRequestLogger, generateRequestId } from './logger';
import { AppError, ValidationError, UnauthorizedError, toAppError, ErrorCode } from './errors';
import { RateLimiter, RateLimitStatus } from './rate-limiter';

// ============================================
// TYPES
// ============================================

/** HTTP methods */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS' | 'HEAD';

/** Standard API response format */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  meta?: {
    requestId: string;
    timestamp: string;
    duration?: number;
  };
}

/** Pagination parameters */
export interface PaginationParams {
  page: number;
  limit: number;
  offset: number;
}

/** Paginated response */
export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

/** Sort parameters */
export interface SortParams {
  field: string;
  order: 'asc' | 'desc';
}

/** API handler context */
export interface ApiContext {
  requestId: string;
  logger: Logger;
  userId?: string;
  startTime: number;
}

// ============================================
// RESPONSE HELPERS
// ============================================

/**
 * Create a successful API response
 *
 * @example
 * ```typescript
 * return res.status(200).json(success(data, { requestId }));
 * ```
 */
export function success<T>(
  data: T,
  meta?: Partial<ApiResponse['meta']>
): ApiResponse<T> {
  return {
    success: true,
    data,
    meta: {
      requestId: meta?.requestId ?? generateRequestId(),
      timestamp: new Date().toISOString(),
      duration: meta?.duration,
    },
  };
}

/**
 * Create a failed API response
 */
export function failure(
  error: AppError | Error | string,
  meta?: Partial<ApiResponse['meta']>
): ApiResponse<never> {
  const appError = typeof error === 'string' ? new AppError(error) : toAppError(error);

  return {
    success: false,
    error: {
      code: appError.code,
      message: appError.message,
      details: appError.details,
    },
    meta: {
      requestId: meta?.requestId ?? generateRequestId(),
      timestamp: new Date().toISOString(),
      duration: meta?.duration,
    },
  };
}

/**
 * Create a paginated response
 */
export function paginated<T>(
  data: T[],
  pagination: {
    page: number;
    limit: number;
    total: number;
  },
  meta?: Partial<ApiResponse['meta']>
): PaginatedResponse<T> {
  const totalPages = Math.ceil(pagination.total / pagination.limit);

  return {
    success: true,
    data,
    pagination: {
      page: pagination.page,
      limit: pagination.limit,
      total: pagination.total,
      totalPages,
      hasMore: pagination.page < totalPages,
    },
    meta: {
      requestId: meta?.requestId ?? generateRequestId(),
      timestamp: new Date().toISOString(),
      duration: meta?.duration,
    },
  };
}

// ============================================
// REQUEST PARSING
// ============================================

/**
 * Parse pagination parameters from query string
 */
export function parsePagination(
  query: Record<string, string | string[] | undefined>,
  defaults: { page?: number; limit?: number } = {}
): PaginationParams {
  const page = Math.max(1, parseInt(String(query.page ?? defaults.page ?? 1), 10));
  const limit = Math.min(100, Math.max(1, parseInt(String(query.limit ?? defaults.limit ?? 20), 10)));
  const offset = (page - 1) * limit;

  return { page, limit, offset };
}

/**
 * Parse sort parameters from query string
 */
export function parseSort(
  query: Record<string, string | string[] | undefined>,
  allowedFields: string[],
  defaults: SortParams = { field: 'createdAt', order: 'desc' }
): SortParams {
  const sortField = String(query.sortBy ?? query.sort ?? defaults.field);
  const sortOrder = String(query.order ?? query.sortOrder ?? defaults.order).toLowerCase();

  return {
    field: allowedFields.includes(sortField) ? sortField : defaults.field,
    order: sortOrder === 'asc' ? 'asc' : 'desc',
  };
}

/**
 * Parse date range from query string
 */
export function parseDateRange(
  query: Record<string, string | string[] | undefined>,
  defaults?: { startDate?: Date; endDate?: Date }
): { startDate?: Date; endDate?: Date } {
  const startStr = query.startDate ?? query.start ?? query.from;
  const endStr = query.endDate ?? query.end ?? query.to;

  const startDate = startStr ? new Date(String(startStr)) : defaults?.startDate;
  const endDate = endStr ? new Date(String(endStr)) : defaults?.endDate;

  // Validate dates
  if (startDate && isNaN(startDate.getTime())) {
    throw new ValidationError('Invalid start date', { startDate: ['Invalid date format'] });
  }
  if (endDate && isNaN(endDate.getTime())) {
    throw new ValidationError('Invalid end date', { endDate: ['Invalid date format'] });
  }

  return { startDate, endDate };
}

/**
 * Parse and validate required fields from request body
 */
export function parseRequired<T extends Record<string, unknown>>(
  body: unknown,
  requiredFields: (keyof T)[]
): T {
  if (!body || typeof body !== 'object') {
    throw new ValidationError('Request body is required');
  }

  const errors: Record<string, string[]> = {};

  for (const field of requiredFields) {
    if (!(field in body) || (body as Record<string, unknown>)[field as string] === undefined) {
      errors[field as string] = ['This field is required'];
    }
  }

  if (Object.keys(errors).length > 0) {
    throw ValidationError.fields(errors);
  }

  return body as T;
}

// ============================================
// API HANDLER WRAPPER
// ============================================

/** Handler function type */
export type ApiHandler<T = unknown> = (
  req: NextApiRequest,
  res: NextApiResponse,
  ctx: ApiContext
) => Promise<T>;

/** Next.js API request type (simplified) */
interface NextApiRequest {
  method?: string;
  query: Record<string, string | string[] | undefined>;
  body?: unknown;
  headers: Record<string, string | string[] | undefined>;
  socket?: { remoteAddress?: string };
}

/** Next.js API response type (simplified) */
interface NextApiResponse {
  status(code: number): NextApiResponse;
  json(body: unknown): void;
  setHeader(name: string, value: string | number | string[]): NextApiResponse;
  end(): void;
}

/** API route configuration */
export interface ApiRouteConfig {
  /** Allowed HTTP methods */
  methods?: HttpMethod[];
  /** Rate limiter to use */
  rateLimiter?: RateLimiter;
  /** Whether authentication is required */
  requireAuth?: boolean;
  /** Custom authentication function */
  authenticate?: (req: NextApiRequest) => Promise<{ userId: string } | null>;
  /** Skip rate limiting for certain conditions */
  skipRateLimit?: (req: NextApiRequest) => boolean;
}

/**
 * Create a wrapped API handler with built-in error handling,
 * logging, rate limiting, and authentication.
 *
 * @example
 * ```typescript
 * export default createApiHandler(
 *   async (req, res, ctx) => {
 *     const properties = await db.property.findMany();
 *     return res.status(200).json(success(properties, { requestId: ctx.requestId }));
 *   },
 *   { methods: ['GET'], requireAuth: true }
 * );
 * ```
 */
export function createApiHandler<T>(
  handler: ApiHandler<T>,
  config: ApiRouteConfig = {}
): (req: NextApiRequest, res: NextApiResponse) => Promise<void> {
  const {
    methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    rateLimiter,
    requireAuth = false,
    authenticate,
    skipRateLimit,
  } = config;

  return async (req: NextApiRequest, res: NextApiResponse): Promise<void> => {
    const startTime = Date.now();
    const requestId = generateRequestId();
    const logger = createRequestLogger(requestId);

    // Initialize context
    const ctx: ApiContext = {
      requestId,
      logger,
      startTime,
    };

    try {
      // Log incoming request
      logger.info('Request received', {
        method: req.method,
        path: req.query,
      });

      // Check HTTP method
      if (!methods.includes(req.method as HttpMethod)) {
        res.setHeader('Allow', methods.join(', '));
        res.status(405).json(
          failure(new AppError(`Method ${req.method} not allowed`, ErrorCode.VALIDATION), {
            requestId,
            duration: Date.now() - startTime,
          })
        );
        return;
      }

      // Handle CORS preflight
      if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
      }

      // Rate limiting
      if (rateLimiter && !skipRateLimit?.(req)) {
        const ip = getClientIp(req);
        const status = rateLimiter.check(ip);
        const headers = rateLimiter.getHeaders(status);

        // Set rate limit headers
        Object.entries(headers).forEach(([key, value]) => {
          res.setHeader(key, value);
        });

        if (status.limited) {
          logger.warn('Rate limit exceeded', { ip });
          res.status(429).json(
            failure(new AppError('Too many requests', ErrorCode.RATE_LIMITED), {
              requestId,
              duration: Date.now() - startTime,
            })
          );
          return;
        }

        // Record the hit
        rateLimiter.hit(ip);
      }

      // Authentication
      if (requireAuth || authenticate) {
        const authResult = authenticate
          ? await authenticate(req)
          : await defaultAuthenticate(req);

        if (!authResult) {
          logger.warn('Authentication failed');
          res.status(401).json(
            failure(new UnauthorizedError(), {
              requestId,
              duration: Date.now() - startTime,
            })
          );
          return;
        }

        ctx.userId = authResult.userId;
        logger.setUserId(authResult.userId);
      }

      // Execute handler
      await handler(req, res, ctx);

      // Log completion
      const duration = Date.now() - startTime;
      logger.info('Request completed', { duration: `${duration}ms` });
    } catch (error) {
      const duration = Date.now() - startTime;
      const appError = toAppError(error);

      // Log error
      if (appError.isOperational) {
        logger.warn('Request failed with operational error', {
          code: appError.code,
          message: appError.message,
        });
      } else {
        logger.error('Request failed with unexpected error', error as Error);
      }

      // Send error response
      res.status(appError.statusCode).json(
        failure(appError, {
          requestId,
          duration,
        })
      );
    }
  };
}

// ============================================
// UTILITIES
// ============================================

/**
 * Extract client IP from request
 */
export function getClientIp(req: NextApiRequest): string {
  const forwarded = req.headers['x-forwarded-for'];
  const realIp = req.headers['x-real-ip'];
  const remoteAddress = req.socket?.remoteAddress;

  if (forwarded) {
    return Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0].trim();
  }

  if (realIp) {
    return Array.isArray(realIp) ? realIp[0] : realIp;
  }

  return remoteAddress ?? 'unknown';
}

/**
 * Default authentication function (checks for Bearer token)
 */
async function defaultAuthenticate(
  req: NextApiRequest
): Promise<{ userId: string } | null> {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.slice(7);

  // In production, you would verify the JWT token here
  // This is a placeholder implementation
  if (!token) {
    return null;
  }

  // Decode token (simplified - use proper JWT verification in production)
  try {
    // Placeholder: In real implementation, decode and verify JWT
    // const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // return { userId: decoded.sub };
    return { userId: 'placeholder-user-id' };
  } catch {
    return null;
  }
}

/**
 * Validate that request body matches expected schema
 */
export function validateBody<T>(
  body: unknown,
  validator: (value: unknown) => { valid: boolean; errors?: Record<string, string[]>; value?: T }
): T {
  const result = validator(body);

  if (!result.valid || result.errors) {
    throw ValidationError.fields(result.errors ?? { body: ['Invalid request body'] });
  }

  return result.value as T;
}

/**
 * CORS headers helper
 */
export function setCorsHeaders(
  res: NextApiResponse,
  options: {
    origin?: string | string[];
    methods?: HttpMethod[];
    headers?: string[];
    credentials?: boolean;
    maxAge?: number;
  } = {}
): void {
  const {
    origin = '*',
    methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    headers = ['Content-Type', 'Authorization'],
    credentials = false,
    maxAge = 86400,
  } = options;

  res.setHeader(
    'Access-Control-Allow-Origin',
    Array.isArray(origin) ? origin.join(', ') : origin
  );
  res.setHeader('Access-Control-Allow-Methods', methods.join(', '));
  res.setHeader('Access-Control-Allow-Headers', headers.join(', '));

  if (credentials) {
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }

  res.setHeader('Access-Control-Max-Age', String(maxAge));
}

// ============================================
// METHOD-SPECIFIC HANDLERS
// ============================================

/** Handler map for different HTTP methods */
export type MethodHandlers<T = unknown> = {
  [K in HttpMethod]?: ApiHandler<T>;
};

/**
 * Create an API handler that routes to different handlers based on HTTP method
 *
 * @example
 * ```typescript
 * export default createMethodHandler({
 *   GET: async (req, res, ctx) => {
 *     const properties = await db.property.findMany();
 *     return res.status(200).json(success(properties));
 *   },
 *   POST: async (req, res, ctx) => {
 *     const property = await db.property.create({ data: req.body });
 *     return res.status(201).json(success(property));
 *   },
 * });
 * ```
 */
export function createMethodHandler<T>(
  handlers: MethodHandlers<T>,
  baseConfig: Omit<ApiRouteConfig, 'methods'> = {}
): (req: NextApiRequest, res: NextApiResponse) => Promise<void> {
  const methods = Object.keys(handlers) as HttpMethod[];

  return createApiHandler(
    async (req, res, ctx) => {
      const handler = handlers[req.method as HttpMethod];
      if (!handler) {
        throw new AppError(`Method ${req.method} not allowed`, ErrorCode.VALIDATION);
      }
      return handler(req, res, ctx);
    },
    { ...baseConfig, methods }
  );
}
