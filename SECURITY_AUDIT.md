# Right At Home BnB - Security Audit & Hardening

**Date:** January 17, 2026
**Auditor:** ECHO OMEGA PRIME
**Status:** COMPLETE

---

## Executive Summary

Comprehensive security hardening has been implemented following OWASP best practices:

| Area | Status | Files Created/Modified |
|------|--------|----------------------|
| Validation Schemas | COMPLETE | `packages/security/src/validation.ts` |
| Auth & RBAC | COMPLETE | `packages/security/src/auth.ts` |
| Input Sanitization | COMPLETE | `packages/security/src/sanitize.ts` |
| Credential Management | COMPLETE | `packages/security/src/credentials.ts` |
| Middleware | COMPLETE | `packages/security/src/middleware.ts` |
| Database Security | COMPLETE | `packages/security/src/prisma-security.ts` |
| Environment Config | COMPLETE | `.env.example` updated |

---

## 1. Input Validation (Zod Schemas)

**File:** `packages/security/src/validation.ts`

### Schemas Created

| Category | Schemas |
|----------|---------|
| **Common** | email, phone, id, safeString, name, url, date, currency, latitude, longitude, rating |
| **User/Auth** | login, register, userUpdate, passwordChange |
| **Property** | createProperty, updateProperty |
| **Guest** | createGuest, updateGuest |
| **Booking** | createBooking, updateBooking |
| **Cleaning** | createCleaningJob, updateCleaningJob, gpsCheck |
| **Expense** | createExpense, updateExpense |
| **Message** | createMessage, updateMessage |
| **Smart Lock** | createSmartLock, updateLockCode |
| **Concierge** | createConciergeQuery, rateConcierge |
| **Search** | pagination, dateRange, propertySearch, bookingSearch, guestSearch |

### Validation Features

- Script injection detection
- Event handler blocking
- String length limits
- Date validation (future dates, ranges)
- Phone number format validation (US)
- Email RFC 5322 compliance
- Currency precision (2 decimal places)
- GPS coordinate bounds checking

### Usage

```typescript
import { validateInput, createBookingSchema } from '@rightathome/security';

const result = validateInput(createBookingSchema, requestBody);
if (!result.success) {
  return res.status(400).json({ errors: result.errors });
}
// result.data is validated and typed
```

---

## 2. Authentication & Authorization

**File:** `packages/security/src/auth.ts`

### Role-Based Access Control (RBAC)

| Role | Level | Description |
|------|-------|-------------|
| GUEST | 1 | Limited to own bookings and concierge |
| CLEANER | 2 | Can view/complete assigned jobs |
| ADMIN | 3 | Full operational access |
| OWNER | 4 | Complete system access including settings |

### Permission Matrix

| Resource | GUEST | CLEANER | ADMIN | OWNER |
|----------|-------|---------|-------|-------|
| Properties:read | Yes | Yes | Yes | Yes |
| Properties:create | - | - | Yes | Yes |
| Properties:update | - | - | Yes | Yes |
| Properties:delete | - | - | - | Yes |
| Bookings:read:own | Yes | - | - | - |
| Bookings:read | - | Yes | Yes | Yes |
| Jobs:read:own | - | Yes | - | - |
| Jobs:complete | - | Yes | Yes | Yes |
| Finance:read | - | - | Yes | Yes |
| Finance:reports | - | - | - | Yes |
| Settings:update | - | - | - | Yes |

### JWT Configuration

- Access token: 15 minutes
- Refresh token: 7 days
- Minimum secret length: 32 characters
- Algorithm: HS256

### Usage

```typescript
import { initializeAuth, createAccessToken, authenticate } from '@rightathome/security';

// Initialize on startup
initializeAuth({ secret: process.env.JWT_SECRET });

// Create token
const token = createAccessToken({ id, email, name, role });

// Authenticate request
const result = authenticate(req.headers.authorization);
```

---

## 3. Input Sanitization

**File:** `packages/security/src/sanitize.ts`

### Protection Against

| Attack Type | Function | Method |
|-------------|----------|--------|
| XSS | `sanitizeXss()` | HTML tag stripping, event handler removal |
| HTML Injection | `sanitizeHtmlContent()` | Whitelist-based HTML filtering |
| SQL Injection | `detectSqlInjection()`, `escapeSql()` | Pattern detection, escaping |
| Path Traversal | `sanitizePath()`, `detectPathTraversal()` | `..` removal, pattern detection |
| JSON Attacks | `safeJsonParse()` | Size limits, sanitization |

### String Sanitization

- `stripHtml()` - Remove all HTML tags
- `normalizeWhitespace()` - Collapse multiple spaces
- `removeControlChars()` - Remove control characters
- `truncateSafe()` - UTF-8 safe truncation

### Type Sanitization

- `sanitizeEmail()` - Validation and normalization
- `sanitizePhone()` - US format validation
- `sanitizeUrl()` - Protocol validation, injection prevention
- `sanitizeInt()`, `sanitizeFloat()` - Range validation
- `sanitizeBoolean()` - Type coercion
- `sanitizeId()` - ID format validation

### Security Headers

Recommended headers are provided via `SECURITY_HEADERS`:

```typescript
{
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'Content-Security-Policy': "default-src 'self'; ...",
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'geolocation=(self), microphone=(), camera=()'
}
```

---

## 4. Credential Management

**File:** `packages/security/src/credentials.ts`

### Features

- Environment variable validation with Zod
- Sensitive value masking for logs
- Service-specific credential accessors
- Credential rotation support
- Production vs development mode handling

### Validated Credentials

| Service | Required Variables |
|---------|-------------------|
| Database | DATABASE_URL |
| Firebase | FIREBASE_PROJECT_ID, NEXT_PUBLIC_FIREBASE_API_KEY |
| Twilio | TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER |
| Stripe | STRIPE_SECRET_KEY |
| AI | OPENAI_API_KEY or ANTHROPIC_API_KEY |
| Storage | CLOUDFLARE_R2_ACCESS_KEY, CLOUDFLARE_R2_SECRET_KEY, CLOUDFLARE_R2_BUCKET |

### Usage

```typescript
import { loadCredentials, getSecureDatabaseUrl, validateServiceCredentials } from '@rightathome/security';

// Load and validate all credentials
const config = loadCredentials();

// Get masked URL for logging
const { url, maskedUrl } = getSecureDatabaseUrl();
console.log(`Connecting to: ${maskedUrl}`);

// Validate service availability
const { valid, missing } = validateServiceCredentials('stripe');
if (!valid) {
  console.warn(`Missing: ${missing.join(', ')}`);
}
```

---

## 5. Middleware

**File:** `packages/security/src/middleware.ts`

### Available Middleware

| Middleware | Purpose |
|------------|---------|
| `authMiddleware()` | JWT authentication |
| `optionalAuthMiddleware()` | Parse token if present |
| `requirePermission()` | Check specific permission |
| `requireMinRole()` | Check minimum role level |
| `requireRoles()` | Check for any of specified roles |
| `validateBody()` | Validate request body with Zod |
| `validateQuery()` | Validate query parameters |
| `validateParams()` | Validate URL parameters |
| `sanitizeInput()` | Sanitize all inputs |
| `securityHeaders()` | Add security headers |
| `rateLimit()` | Request rate limiting |
| `errorHandler()` | Security error handling |

### Combined Middleware

```typescript
import { protectedRoute, publicRoute } from '@rightathome/security';

// Protected route with validation
app.post('/api/bookings', protectedRoute({
  permission: 'bookings:create',
  validate: createBookingSchema
}), createBookingHandler);

// Public route with rate limiting
app.post('/api/auth/login', publicRoute({
  validate: loginSchema,
  rateLimit: { windowMs: 900000, maxRequests: 5 }
}), loginHandler);
```

### Next.js API Route Helpers

```typescript
import { withAuth, withPublic } from '@rightathome/security';

// Protected API route
export default withAuth(async (req, res) => {
  // req.session and req.user are available
  const { userId, role } = req.user;
}, { permission: 'bookings:read' });
```

---

## 6. Database Security (Prisma)

**File:** `packages/security/src/prisma-security.ts`

### Safe Query Patterns

| Function | Purpose |
|----------|---------|
| `safeId()`, `safeIds()` | Validate entity IDs |
| `safeWhere()` | Build injection-safe filters |
| `safeSelect()` | Build safe field selection |
| `safeInclude()` | Build safe relation includes |
| `safePagination()` | Limit pagination abuse |
| `safeOrderBy()` | Validate sort fields |

### Row-Level Security

```typescript
import { withRls, filterByRls } from '@rightathome/security';

// Add RLS to query
const bookings = await prisma.booking.findMany({
  where: withRls({ status: 'CONFIRMED' }, rlsContext)
});

// Filter results by RLS
const safeResults = filterByRls(bookings, rlsContext);
```

### Sensitive Data Handling

```typescript
import { stripSensitive, selectWithoutSensitive } from '@rightathome/security';

// Remove sensitive fields from response
const safeUser = stripSensitive(user);

// Exclude sensitive fields in select
const select = selectWithoutSensitive(['id', 'email', 'name', 'password']);
```

### Audit Logging

```typescript
import { createAuditEntry, consoleAuditLogger } from '@rightathome/security';

const entry = createAuditEntry(session, 'UPDATE', 'Booking', bookingId, {
  oldValues: existingBooking,
  newValues: updatedBooking,
  ipAddress: req.ip
});

await consoleAuditLogger.log(entry);
```

---

## 7. Environment Configuration

**File:** `.env.example`

### Security Improvements

1. Added security notes at top of file
2. Added JWT_SECRET and API_SECRET_KEY requirements
3. Added SESSION_SECRET for cookie security
4. Added CORS_ALLOWED_ORIGINS configuration
5. Added rate limiting configuration
6. Clear documentation of expected value formats
7. Placeholder values that indicate required changes

### Required Secrets (Generate with OpenSSL)

```bash
# JWT Secret (32+ characters)
openssl rand -base64 32

# API Secret (64 hex characters)
openssl rand -hex 32

# Session Secret (32+ characters)
openssl rand -base64 32
```

---

## 8. Security Checklist

### Immediate Actions Required

- [ ] Generate and set JWT_SECRET in production
- [ ] Generate and set API_SECRET_KEY in production
- [ ] Generate and set SESSION_SECRET in production
- [ ] Configure CORS_ALLOWED_ORIGINS for production domains
- [ ] Set up rate limiting in production
- [ ] Enable HTTPS-only cookies in production
- [ ] Review and update Content-Security-Policy for production

### Ongoing Security Practices

- [ ] Rotate secrets every 90 days
- [ ] Monitor audit logs for suspicious activity
- [ ] Review permission matrix quarterly
- [ ] Update dependencies regularly for security patches
- [ ] Run security scanning in CI/CD pipeline

---

## Installation

```bash
cd packages/security
pnpm install
pnpm build
```

## Integration

Add to your app's package.json:

```json
{
  "dependencies": {
    "@rightathome/security": "workspace:*"
  }
}
```

---

## Files Created

```
packages/security/
  package.json
  tsconfig.json
  src/
    index.ts           - Main exports
    validation.ts      - Zod schemas
    auth.ts            - JWT & RBAC
    sanitize.ts        - Input sanitization
    credentials.ts     - Env management
    middleware.ts      - Express/Next.js middleware
    prisma-security.ts - Database security
```

---

**Made by ECHO OMEGA PRIME | Authority 11.0 SOVEREIGN**
