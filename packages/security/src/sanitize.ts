/**
 * Right At Home BnB - Input Sanitization
 * OWASP-compliant sanitization to prevent XSS, injection, and other attacks
 *
 * Made by ECHO OMEGA PRIME | Authority 11.0 SOVEREIGN
 */

import xss from 'xss';
import sanitizeHtml from 'sanitize-html';
import validator from 'validator';

// ============================================================================
// XSS PROTECTION
// ============================================================================

/**
 * XSS filter options for different contexts
 */
const XSS_OPTIONS = {
  // Strict - no HTML allowed
  strict: {
    whiteList: {},
    stripIgnoreTag: true,
    stripIgnoreTagBody: ['script', 'style'],
  },

  // Basic - only safe inline formatting
  basic: {
    whiteList: {
      b: [],
      i: [],
      u: [],
      em: [],
      strong: [],
      br: [],
    },
    stripIgnoreTag: true,
    stripIgnoreTagBody: ['script', 'style'],
  },

  // Rich - for content that needs some formatting
  rich: {
    whiteList: {
      p: [],
      br: [],
      b: [],
      i: [],
      u: [],
      em: [],
      strong: [],
      ul: [],
      ol: [],
      li: [],
      a: ['href', 'title', 'target'],
      span: ['style'],
    },
    stripIgnoreTag: true,
    stripIgnoreTagBody: ['script', 'style', 'iframe', 'object', 'embed'],
  },
};

/**
 * Sanitize string to prevent XSS attacks
 */
export function sanitizeXss(
  input: string,
  mode: 'strict' | 'basic' | 'rich' = 'strict'
): string {
  if (typeof input !== 'string') {
    return '';
  }

  return xss(input, XSS_OPTIONS[mode]);
}

/**
 * Sanitize HTML content with fine-grained control
 */
export function sanitizeHtmlContent(
  input: string,
  options?: sanitizeHtml.IOptions
): string {
  if (typeof input !== 'string') {
    return '';
  }

  const defaultOptions: sanitizeHtml.IOptions = {
    allowedTags: ['p', 'br', 'b', 'i', 'em', 'strong', 'u', 'ul', 'ol', 'li'],
    allowedAttributes: {},
    disallowedTagsMode: 'discard',
    enforceHtmlBoundary: true,
    parseStyleAttributes: false,
  };

  return sanitizeHtml(input, options || defaultOptions);
}

// ============================================================================
// SQL INJECTION PREVENTION
// ============================================================================

/**
 * Characters that can be dangerous in SQL queries
 */
const SQL_DANGEROUS_CHARS = /[';"\-\-\/*\\]/g;
const SQL_KEYWORDS = /\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER|CREATE|TRUNCATE|EXEC|EXECUTE|XP_|SP_|0x)\b/gi;

/**
 * Escape string for SQL (use parameterized queries instead when possible)
 */
export function escapeSql(input: string): string {
  if (typeof input !== 'string') {
    return '';
  }

  return input
    .replace(/'/g, "''")
    .replace(/\\/g, '\\\\')
    .replace(/\x00/g, '\\0')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\x1a/g, '\\Z');
}

/**
 * Detect potential SQL injection attempt
 */
export function detectSqlInjection(input: string): boolean {
  if (typeof input !== 'string') {
    return false;
  }

  // Check for dangerous characters
  if (SQL_DANGEROUS_CHARS.test(input)) {
    // Check for SQL keywords
    if (SQL_KEYWORDS.test(input)) {
      return true;
    }
  }

  // Check for common injection patterns
  const injectionPatterns = [
    /'\s*OR\s*'1'\s*=\s*'1/i,
    /'\s*OR\s*1\s*=\s*1/i,
    /'\s*--/,
    /;\s*DROP/i,
    /;\s*DELETE/i,
    /;\s*UPDATE/i,
    /UNION\s+SELECT/i,
    /\/\*.*\*\//,
  ];

  return injectionPatterns.some((pattern) => pattern.test(input));
}

// ============================================================================
// PATH TRAVERSAL PREVENTION
// ============================================================================

/**
 * Sanitize file path to prevent directory traversal
 */
export function sanitizePath(input: string): string {
  if (typeof input !== 'string') {
    return '';
  }

  return input
    .replace(/\.\./g, '') // Remove ..
    .replace(/\/\//g, '/') // Normalize slashes
    .replace(/\\/g, '/') // Convert backslashes
    .replace(/^\/+/, '') // Remove leading slashes
    .replace(/[<>:"|?*]/g, ''); // Remove invalid filename chars
}

/**
 * Detect path traversal attempt
 */
export function detectPathTraversal(input: string): boolean {
  if (typeof input !== 'string') {
    return false;
  }

  const patterns = [
    /\.\./,
    /%2e%2e/i,
    /%252e%252e/i,
    /\.\.%2f/i,
    /%2f\.\./i,
    /\.\.\\/,
    /\\\.\./,
  ];

  return patterns.some((pattern) => pattern.test(input));
}

// ============================================================================
// STRING SANITIZATION
// ============================================================================

/**
 * Remove all HTML tags
 */
export function stripHtml(input: string): string {
  if (typeof input !== 'string') {
    return '';
  }

  return input
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'");
}

/**
 * Trim and collapse whitespace
 */
export function normalizeWhitespace(input: string): string {
  if (typeof input !== 'string') {
    return '';
  }

  return input.replace(/\s+/g, ' ').trim();
}

/**
 * Remove control characters
 */
export function removeControlChars(input: string): string {
  if (typeof input !== 'string') {
    return '';
  }

  // Remove all control characters except newlines and tabs
  return input.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
}

/**
 * Truncate string safely (UTF-8 aware)
 */
export function truncateSafe(input: string, maxLength: number): string {
  if (typeof input !== 'string') {
    return '';
  }

  if (input.length <= maxLength) {
    return input;
  }

  // Find last complete word
  const truncated = input.substring(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');

  return lastSpace > 0 ? truncated.substring(0, lastSpace) + '...' : truncated + '...';
}

// ============================================================================
// INPUT TYPE SANITIZATION
// ============================================================================

/**
 * Sanitize email address
 */
export function sanitizeEmail(input: string): string {
  if (typeof input !== 'string') {
    return '';
  }

  const trimmed = input.toLowerCase().trim();

  if (!validator.isEmail(trimmed)) {
    return '';
  }

  return validator.normalizeEmail(trimmed) || '';
}

/**
 * Sanitize phone number (US format)
 */
export function sanitizePhone(input: string): string {
  if (typeof input !== 'string') {
    return '';
  }

  // Remove all non-digits except leading +
  const cleaned = input.replace(/[^\d+]/g, '');

  // Validate US phone format
  const phoneRegex = /^\+?1?\d{10}$/;
  if (!phoneRegex.test(cleaned.replace(/^\+/, ''))) {
    return '';
  }

  return cleaned;
}

/**
 * Sanitize URL
 */
export function sanitizeUrl(input: string): string {
  if (typeof input !== 'string') {
    return '';
  }

  const trimmed = input.trim();

  // Only allow http and https
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
    return '';
  }

  // Check for javascript: or data: protocol injection
  const lowerUrl = trimmed.toLowerCase();
  if (
    lowerUrl.includes('javascript:') ||
    lowerUrl.includes('data:') ||
    lowerUrl.includes('vbscript:')
  ) {
    return '';
  }

  if (!validator.isURL(trimmed, { protocols: ['http', 'https'] })) {
    return '';
  }

  return trimmed;
}

/**
 * Sanitize integer
 */
export function sanitizeInt(input: unknown, min?: number, max?: number): number | null {
  const parsed = parseInt(String(input), 10);

  if (isNaN(parsed) || !isFinite(parsed)) {
    return null;
  }

  if (min !== undefined && parsed < min) {
    return null;
  }

  if (max !== undefined && parsed > max) {
    return null;
  }

  return parsed;
}

/**
 * Sanitize float/decimal
 */
export function sanitizeFloat(input: unknown, min?: number, max?: number, decimals?: number): number | null {
  const parsed = parseFloat(String(input));

  if (isNaN(parsed) || !isFinite(parsed)) {
    return null;
  }

  if (min !== undefined && parsed < min) {
    return null;
  }

  if (max !== undefined && parsed > max) {
    return null;
  }

  if (decimals !== undefined) {
    return parseFloat(parsed.toFixed(decimals));
  }

  return parsed;
}

/**
 * Sanitize boolean
 */
export function sanitizeBoolean(input: unknown): boolean {
  if (typeof input === 'boolean') {
    return input;
  }

  if (typeof input === 'string') {
    const lower = input.toLowerCase().trim();
    return lower === 'true' || lower === '1' || lower === 'yes';
  }

  if (typeof input === 'number') {
    return input !== 0;
  }

  return false;
}

/**
 * Sanitize UUID/CUID
 */
export function sanitizeId(input: string): string {
  if (typeof input !== 'string') {
    return '';
  }

  const trimmed = input.trim();

  // Valid ID: alphanumeric, underscore, hyphen, max 128 chars
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(trimmed)) {
    return '';
  }

  return trimmed;
}

// ============================================================================
// OBJECT SANITIZATION
// ============================================================================

/**
 * Deep sanitize an object, applying string sanitization recursively
 */
export function sanitizeObject<T extends Record<string, unknown>>(
  obj: T,
  options: {
    maxDepth?: number;
    maxStringLength?: number;
    stripHtml?: boolean;
    xssMode?: 'strict' | 'basic' | 'rich';
  } = {}
): T {
  const {
    maxDepth = 10,
    maxStringLength = 10000,
    stripHtml: shouldStripHtml = true,
    xssMode = 'strict',
  } = options;

  function sanitizeValue(value: unknown, depth: number): unknown {
    if (depth > maxDepth) {
      return null;
    }

    if (value === null || value === undefined) {
      return value;
    }

    if (typeof value === 'string') {
      let sanitized = value;

      if (shouldStripHtml) {
        sanitized = stripHtml(sanitized);
      } else {
        sanitized = sanitizeXss(sanitized, xssMode);
      }

      sanitized = removeControlChars(sanitized);
      sanitized = normalizeWhitespace(sanitized);

      if (sanitized.length > maxStringLength) {
        sanitized = sanitized.substring(0, maxStringLength);
      }

      return sanitized;
    }

    if (typeof value === 'number') {
      return isFinite(value) ? value : null;
    }

    if (typeof value === 'boolean') {
      return value;
    }

    if (Array.isArray(value)) {
      return value.map((item) => sanitizeValue(item, depth + 1));
    }

    if (typeof value === 'object') {
      const sanitized: Record<string, unknown> = {};

      for (const [key, val] of Object.entries(value)) {
        // Sanitize key as well
        const safeKey = sanitizeXss(key, 'strict').substring(0, 100);
        if (safeKey) {
          sanitized[safeKey] = sanitizeValue(val, depth + 1);
        }
      }

      return sanitized;
    }

    return null;
  }

  return sanitizeValue(obj, 0) as T;
}

// ============================================================================
// JSON SANITIZATION
// ============================================================================

/**
 * Safely parse JSON with sanitization
 */
export function safeJsonParse<T = unknown>(
  input: string,
  maxSize: number = 1000000 // 1MB default
): T | null {
  if (typeof input !== 'string') {
    return null;
  }

  if (input.length > maxSize) {
    return null;
  }

  try {
    const parsed = JSON.parse(input);
    return sanitizeObject(parsed) as T;
  } catch {
    return null;
  }
}

/**
 * Safely stringify JSON
 */
export function safeJsonStringify(
  input: unknown,
  maxSize: number = 1000000
): string | null {
  try {
    const str = JSON.stringify(input);

    if (str.length > maxSize) {
      return null;
    }

    return str;
  } catch {
    return null;
  }
}

// ============================================================================
// CONTENT TYPE VALIDATION
// ============================================================================

/**
 * Validate file MIME type
 */
export function isValidMimeType(
  mimeType: string,
  allowedTypes: string[]
): boolean {
  if (typeof mimeType !== 'string') {
    return false;
  }

  const normalized = mimeType.toLowerCase().split(';')[0]?.trim() ?? '';
  return allowedTypes.includes(normalized);
}

/**
 * Allowed image types
 */
export const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
];

/**
 * Allowed document types
 */
export const ALLOWED_DOCUMENT_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
];

// ============================================================================
// SECURITY HEADERS
// ============================================================================

/**
 * Recommended security headers for responses
 */
export const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'Content-Security-Policy':
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self' https://api.rah-midland.com",
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'geolocation=(self), microphone=(), camera=()',
};

// ============================================================================
// SANITIZATION EXCEPTION
// ============================================================================

export class SanitizationError extends Error {
  public readonly field: string;
  public readonly statusCode = 400;

  constructor(field: string, message: string) {
    super(message);
    this.name = 'SanitizationError';
    this.field = field;
  }
}
