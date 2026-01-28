/**
 * Right At Home BnB - Authentication & Authorization
 * OWASP-compliant auth with Firebase integration and RBAC
 *
 * Made by ECHO OMEGA PRIME | Authority 11.0 SOVEREIGN
 */

import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

// ============================================================================
// TYPES & ENUMS
// ============================================================================

/**
 * User roles with hierarchical permissions
 * OWNER > ADMIN > CLEANER > GUEST
 */
export enum UserRole {
  GUEST = 'GUEST',
  CLEANER = 'CLEANER',
  ADMIN = 'ADMIN',
  OWNER = 'OWNER',
}

/**
 * Permission levels for role-based access control
 */
export const ROLE_HIERARCHY: Record<UserRole, number> = {
  [UserRole.GUEST]: 1,
  [UserRole.CLEANER]: 2,
  [UserRole.ADMIN]: 3,
  [UserRole.OWNER]: 4,
};

/**
 * Resource-based permissions matrix
 */
export const PERMISSIONS = {
  // Properties
  'properties:read': [UserRole.GUEST, UserRole.CLEANER, UserRole.ADMIN, UserRole.OWNER],
  'properties:create': [UserRole.ADMIN, UserRole.OWNER],
  'properties:update': [UserRole.ADMIN, UserRole.OWNER],
  'properties:delete': [UserRole.OWNER],
  'properties:sensitive': [UserRole.ADMIN, UserRole.OWNER], // WiFi passwords, access codes

  // Bookings
  'bookings:read': [UserRole.CLEANER, UserRole.ADMIN, UserRole.OWNER],
  'bookings:read:own': [UserRole.GUEST],
  'bookings:create': [UserRole.GUEST, UserRole.ADMIN, UserRole.OWNER],
  'bookings:update': [UserRole.ADMIN, UserRole.OWNER],
  'bookings:delete': [UserRole.ADMIN, UserRole.OWNER],
  'bookings:cancel': [UserRole.GUEST, UserRole.ADMIN, UserRole.OWNER],

  // Guests (CRM)
  'guests:read': [UserRole.ADMIN, UserRole.OWNER],
  'guests:read:own': [UserRole.GUEST],
  'guests:create': [UserRole.ADMIN, UserRole.OWNER],
  'guests:update': [UserRole.ADMIN, UserRole.OWNER],
  'guests:delete': [UserRole.OWNER],

  // Cleaners
  'cleaners:read': [UserRole.ADMIN, UserRole.OWNER],
  'cleaners:read:own': [UserRole.CLEANER],
  'cleaners:create': [UserRole.ADMIN, UserRole.OWNER],
  'cleaners:update': [UserRole.ADMIN, UserRole.OWNER],
  'cleaners:delete': [UserRole.OWNER],
  'cleaners:assign': [UserRole.ADMIN, UserRole.OWNER],

  // Cleaning Jobs
  'jobs:read': [UserRole.CLEANER, UserRole.ADMIN, UserRole.OWNER],
  'jobs:read:own': [UserRole.CLEANER],
  'jobs:create': [UserRole.ADMIN, UserRole.OWNER],
  'jobs:update': [UserRole.CLEANER, UserRole.ADMIN, UserRole.OWNER],
  'jobs:complete': [UserRole.CLEANER, UserRole.ADMIN, UserRole.OWNER],
  'jobs:verify': [UserRole.ADMIN, UserRole.OWNER],
  'jobs:delete': [UserRole.ADMIN, UserRole.OWNER],

  // Expenses & Finance
  'finance:read': [UserRole.ADMIN, UserRole.OWNER],
  'finance:create': [UserRole.CLEANER, UserRole.ADMIN, UserRole.OWNER],
  'finance:update': [UserRole.ADMIN, UserRole.OWNER],
  'finance:delete': [UserRole.OWNER],
  'finance:reports': [UserRole.OWNER],

  // Smart Locks
  'locks:read': [UserRole.ADMIN, UserRole.OWNER],
  'locks:create': [UserRole.ADMIN, UserRole.OWNER],
  'locks:update': [UserRole.ADMIN, UserRole.OWNER],
  'locks:generate-code': [UserRole.ADMIN, UserRole.OWNER],
  'locks:delete': [UserRole.OWNER],

  // Messages
  'messages:read': [UserRole.ADMIN, UserRole.OWNER],
  'messages:read:own': [UserRole.GUEST],
  'messages:create': [UserRole.ADMIN, UserRole.OWNER],
  'messages:send': [UserRole.ADMIN, UserRole.OWNER],
  'messages:approve': [UserRole.OWNER],

  // Concierge
  'concierge:use': [UserRole.GUEST, UserRole.CLEANER, UserRole.ADMIN, UserRole.OWNER],
  'concierge:admin': [UserRole.ADMIN, UserRole.OWNER],

  // Settings & System
  'settings:read': [UserRole.ADMIN, UserRole.OWNER],
  'settings:update': [UserRole.OWNER],
  'audit:read': [UserRole.OWNER],
  'users:manage': [UserRole.OWNER],
} as const;

export type Permission = keyof typeof PERMISSIONS;

/**
 * JWT Payload structure
 */
export interface JwtPayload {
  sub: string; // User ID
  email: string;
  name: string;
  role: UserRole;
  iat: number;
  exp: number;
  jti: string; // JWT ID for token revocation
}

/**
 * Session data
 */
export interface SessionData {
  userId: string;
  email: string;
  name: string;
  role: UserRole;
  permissions: Permission[];
  firebaseUid?: string;
  isActive: boolean;
  lastActivity: Date;
}

/**
 * Auth result
 */
export interface AuthResult {
  success: boolean;
  session?: SessionData;
  error?: string;
  statusCode?: number;
}

// ============================================================================
// JWT CONFIGURATION
// ============================================================================

interface JwtConfig {
  secret: string;
  accessTokenExpiry: string;
  refreshTokenExpiry: string;
  issuer: string;
  audience: string;
}

let jwtConfig: JwtConfig | null = null;

/**
 * Initialize JWT configuration
 * MUST be called before using JWT functions
 */
export function initializeAuth(config: Partial<JwtConfig> & { secret: string }): void {
  if (!config.secret || config.secret.length < 32) {
    throw new Error('JWT secret must be at least 32 characters');
  }

  jwtConfig = {
    secret: config.secret,
    accessTokenExpiry: config.accessTokenExpiry || '15m',
    refreshTokenExpiry: config.refreshTokenExpiry || '7d',
    issuer: config.issuer || 'rightathome-bnb',
    audience: config.audience || 'rightathome-bnb-api',
  };
}

function getConfig(): JwtConfig {
  if (!jwtConfig) {
    throw new Error('Auth not initialized. Call initializeAuth() first.');
  }
  return jwtConfig;
}

// ============================================================================
// PASSWORD HASHING
// ============================================================================

const BCRYPT_ROUNDS = 12;

/**
 * Hash a password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  if (password.length < 8) {
    throw new Error('Password must be at least 8 characters');
  }
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

/**
 * Verify a password against a hash
 */
export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// ============================================================================
// JWT TOKEN MANAGEMENT
// ============================================================================

/**
 * Generate a unique JWT ID
 */
function generateJti(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
}

/**
 * Create an access token
 */
export function createAccessToken(user: {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}): string {
  const config = getConfig();

  const payload: Omit<JwtPayload, 'iat' | 'exp'> = {
    sub: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    jti: generateJti(),
  };

  return jwt.sign(payload, config.secret, {
    expiresIn: config.accessTokenExpiry,
    issuer: config.issuer,
    audience: config.audience,
  });
}

/**
 * Create a refresh token
 */
export function createRefreshToken(userId: string): string {
  const config = getConfig();

  return jwt.sign(
    { sub: userId, jti: generateJti(), type: 'refresh' },
    config.secret,
    {
      expiresIn: config.refreshTokenExpiry,
      issuer: config.issuer,
      audience: config.audience,
    }
  );
}

/**
 * Verify and decode an access token
 */
export function verifyAccessToken(token: string): JwtPayload | null {
  const config = getConfig();

  try {
    const decoded = jwt.verify(token, config.secret, {
      issuer: config.issuer,
      audience: config.audience,
    }) as JwtPayload;

    return decoded;
  } catch (error) {
    return null;
  }
}

/**
 * Verify a refresh token
 */
export function verifyRefreshToken(
  token: string
): { sub: string; jti: string } | null {
  const config = getConfig();

  try {
    const decoded = jwt.verify(token, config.secret, {
      issuer: config.issuer,
      audience: config.audience,
    }) as { sub: string; jti: string; type: string };

    if (decoded.type !== 'refresh') {
      return null;
    }

    return { sub: decoded.sub, jti: decoded.jti };
  } catch (error) {
    return null;
  }
}

/**
 * Extract token from Authorization header
 */
export function extractBearerToken(authHeader: string | undefined): string | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.substring(7);
}

// ============================================================================
// RBAC - ROLE-BASED ACCESS CONTROL
// ============================================================================

/**
 * Check if a role has a specific permission
 */
export function hasPermission(role: UserRole, permission: Permission): boolean {
  const allowedRoles = PERMISSIONS[permission];
  if (!allowedRoles) {
    return false;
  }
  return (allowedRoles as readonly UserRole[]).includes(role);
}

/**
 * Get all permissions for a role
 */
export function getPermissionsForRole(role: UserRole): Permission[] {
  const permissions: Permission[] = [];

  for (const [permission, roles] of Object.entries(PERMISSIONS)) {
    if ((roles as readonly UserRole[]).includes(role)) {
      permissions.push(permission as Permission);
    }
  }

  return permissions;
}

/**
 * Check if a role meets minimum level
 */
export function meetsRoleLevel(
  userRole: UserRole,
  requiredRole: UserRole
): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}

/**
 * Check if user can access their own resource
 */
export function canAccessOwnResource(
  userId: string,
  resourceOwnerId: string,
  role: UserRole,
  basePermission: Permission
): boolean {
  // Higher roles can access all
  if (hasPermission(role, basePermission)) {
    return true;
  }

  // Check for :own permission variant
  const ownPermission = `${basePermission}:own` as Permission;
  if (hasPermission(role, ownPermission) && userId === resourceOwnerId) {
    return true;
  }

  return false;
}

// ============================================================================
// SESSION MANAGEMENT
// ============================================================================

/**
 * Create session data from JWT payload
 */
export function createSessionFromToken(payload: JwtPayload): SessionData {
  return {
    userId: payload.sub,
    email: payload.email,
    name: payload.name,
    role: payload.role,
    permissions: getPermissionsForRole(payload.role),
    isActive: true,
    lastActivity: new Date(),
  };
}

/**
 * Validate session is still active
 */
export function isSessionValid(session: SessionData): boolean {
  if (!session.isActive) {
    return false;
  }

  // Session timeout after 24 hours of inactivity
  const maxInactivity = 24 * 60 * 60 * 1000; // 24 hours in ms
  const timeSinceActivity = Date.now() - session.lastActivity.getTime();

  return timeSinceActivity < maxInactivity;
}

// ============================================================================
// AUTH MIDDLEWARE HELPERS
// ============================================================================

/**
 * Authenticate a request and return session data
 */
export function authenticate(authHeader: string | undefined): AuthResult {
  const token = extractBearerToken(authHeader);

  if (!token) {
    return {
      success: false,
      error: 'No authentication token provided',
      statusCode: 401,
    };
  }

  const payload = verifyAccessToken(token);

  if (!payload) {
    return {
      success: false,
      error: 'Invalid or expired token',
      statusCode: 401,
    };
  }

  const session = createSessionFromToken(payload);

  return {
    success: true,
    session,
  };
}

/**
 * Authorize a request for a specific permission
 */
export function authorize(
  session: SessionData,
  requiredPermission: Permission,
  resourceOwnerId?: string
): AuthResult {
  // Check direct permission
  if (hasPermission(session.role, requiredPermission)) {
    return { success: true, session };
  }

  // Check own resource permission if owner ID provided
  if (resourceOwnerId) {
    const canAccess = canAccessOwnResource(
      session.userId,
      resourceOwnerId,
      session.role,
      requiredPermission
    );

    if (canAccess) {
      return { success: true, session };
    }
  }

  return {
    success: false,
    error: `Insufficient permissions: ${requiredPermission} required`,
    statusCode: 403,
  };
}

/**
 * Require a minimum role level
 */
export function requireRole(
  session: SessionData,
  minimumRole: UserRole
): AuthResult {
  if (meetsRoleLevel(session.role, minimumRole)) {
    return { success: true, session };
  }

  return {
    success: false,
    error: `Insufficient role: ${minimumRole} or higher required`,
    statusCode: 403,
  };
}

// ============================================================================
// FIREBASE AUTH INTEGRATION
// ============================================================================

/**
 * Firebase token verification result
 */
export interface FirebaseVerifyResult {
  success: boolean;
  uid?: string;
  email?: string;
  name?: string;
  error?: string;
}

/**
 * Verify Firebase ID token
 * Requires firebase-admin to be initialized in your app
 */
export async function verifyFirebaseToken(
  idToken: string,
  firebaseAdmin: {
    auth: () => { verifyIdToken: (token: string) => Promise<{ uid: string; email?: string; name?: string }> };
  }
): Promise<FirebaseVerifyResult> {
  try {
    const decodedToken = await firebaseAdmin.auth().verifyIdToken(idToken);

    return {
      success: true,
      uid: decodedToken.uid,
      email: decodedToken.email,
      name: decodedToken.name,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Firebase token verification failed',
    };
  }
}

// ============================================================================
// RATE LIMITING HELPERS
// ============================================================================

/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  message: string;
}

/**
 * Default rate limits by endpoint type
 */
export const RATE_LIMITS: Record<string, RateLimitConfig> = {
  auth: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5, // 5 login attempts
    message: 'Too many login attempts. Please try again later.',
  },
  api: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 100, // 100 requests per minute
    message: 'Too many requests. Please slow down.',
  },
  sensitive: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 10, // 10 sensitive operations per hour
    message: 'Too many sensitive operations. Please try again later.',
  },
};

// ============================================================================
// AUTH EXCEPTIONS
// ============================================================================

export class AuthenticationError extends Error {
  public readonly statusCode = 401;

  constructor(message: string = 'Authentication failed') {
    super(message);
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends Error {
  public readonly statusCode = 403;

  constructor(message: string = 'Access denied') {
    super(message);
    this.name = 'AuthorizationError';
  }
}

export class TokenExpiredError extends Error {
  public readonly statusCode = 401;

  constructor(message: string = 'Token has expired') {
    super(message);
    this.name = 'TokenExpiredError';
  }
}
