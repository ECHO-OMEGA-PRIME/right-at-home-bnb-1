/**
 * Right At Home BnB - Secure Credential Loading
 * OWASP-compliant environment variable and secret management
 *
 * Made by ECHO OMEGA PRIME | Authority 11.0 SOVEREIGN
 */

import { z } from 'zod';

// ============================================================================
// ENVIRONMENT SCHEMA DEFINITIONS
// ============================================================================

/**
 * Database configuration schema
 */
const databaseSchema = z.object({
  DATABASE_URL: z
    .string()
    .min(1, 'DATABASE_URL is required')
    .refine(
      (url) => {
        const validProtocols = ['postgresql://', 'mysql://', 'sqlite:', 'file:'];
        return validProtocols.some((proto) => url.startsWith(proto));
      },
      'DATABASE_URL must use a valid database protocol'
    ),
});

/**
 * Firebase configuration schema
 */
const firebaseSchema = z.object({
  FIREBASE_PROJECT_ID: z.string().min(1, 'FIREBASE_PROJECT_ID is required'),
  FIREBASE_CLIENT_EMAIL: z.string().email().optional(),
  FIREBASE_PRIVATE_KEY: z.string().optional(),
  NEXT_PUBLIC_FIREBASE_API_KEY: z.string().min(1).optional(),
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: z.string().optional(),
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: z.string().optional(),
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: z.string().optional(),
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: z.string().optional(),
  NEXT_PUBLIC_FIREBASE_APP_ID: z.string().optional(),
});

/**
 * AI services configuration schema
 */
const aiServicesSchema = z.object({
  OPENAI_API_KEY: z.string().startsWith('sk-').optional(),
  ANTHROPIC_API_KEY: z.string().startsWith('sk-ant-').optional(),
  ELEVENLABS_API_KEY: z.string().optional(),
});

/**
 * API configuration schema
 */
const apiConfigSchema = z.object({
  NEXT_PUBLIC_API_URL: z.string().url().optional(),
  API_SECRET_KEY: z.string().min(32, 'API_SECRET_KEY must be at least 32 characters').optional(),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters').optional(),
});

/**
 * Smart lock configuration schema
 */
const smartLockSchema = z.object({
  SCHLAGE_API_KEY: z.string().optional(),
  SCHLAGE_API_SECRET: z.string().optional(),
  YALE_API_KEY: z.string().optional(),
  AUGUST_API_KEY: z.string().optional(),
});

/**
 * External services configuration schema
 */
const externalServicesSchema = z.object({
  GOOGLE_MAPS_API_KEY: z.string().optional(),
  TWILIO_ACCOUNT_SID: z.string().startsWith('AC').optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_PHONE_NUMBER: z
    .string()
    .regex(/^\+1\d{10}$/)
    .optional(),
  STRIPE_SECRET_KEY: z.string().startsWith('sk_').optional(),
  STRIPE_PUBLISHABLE_KEY: z.string().startsWith('pk_').optional(),
  STRIPE_WEBHOOK_SECRET: z.string().startsWith('whsec_').optional(),
});

/**
 * Storage configuration schema
 */
const storageSchema = z.object({
  CLOUDFLARE_R2_ACCESS_KEY: z.string().optional(),
  CLOUDFLARE_R2_SECRET_KEY: z.string().optional(),
  CLOUDFLARE_R2_BUCKET: z.string().optional(),
  CLOUDFLARE_R2_ENDPOINT: z.string().url().optional(),
});

/**
 * Deployment configuration schema
 */
const deploymentSchema = z.object({
  VERCEL_TOKEN: z.string().optional(),
  GCP_PROJECT_ID: z.string().optional(),
  GCP_REGION: z.string().optional(),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
});

/**
 * Complete environment schema
 */
export const envSchema = databaseSchema
  .merge(firebaseSchema)
  .merge(aiServicesSchema)
  .merge(apiConfigSchema)
  .merge(smartLockSchema)
  .merge(externalServicesSchema)
  .merge(storageSchema)
  .merge(deploymentSchema);

export type EnvConfig = z.infer<typeof envSchema>;

// ============================================================================
// CREDENTIAL LOADING
// ============================================================================

/**
 * Loaded and validated environment configuration
 */
let loadedConfig: EnvConfig | null = null;

/**
 * Load and validate environment variables
 * Throws on invalid configuration in production
 */
export function loadCredentials(envSource?: Record<string, string | undefined>): EnvConfig {
  const source = envSource || process.env;

  const result = envSchema.safeParse(source);

  if (!result.success) {
    const errors = result.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`);
    const errorMessage = `Environment validation failed:\n${errors.join('\n')}`;

    if (process.env['NODE_ENV'] === 'production') {
      throw new CredentialError(errorMessage);
    } else {
      console.warn(`[SECURITY WARNING] ${errorMessage}`);
      // In development, return partial config with defaults
      return envSchema.parse({
        ...source,
        DATABASE_URL: source['DATABASE_URL'] || 'file:./dev.db',
        FIREBASE_PROJECT_ID: source['FIREBASE_PROJECT_ID'] || 'dev-project',
      });
    }
  }

  loadedConfig = result.data;
  return result.data;
}

/**
 * Get loaded configuration (throws if not loaded)
 */
export function getCredentials(): EnvConfig {
  if (!loadedConfig) {
    loadedConfig = loadCredentials();
  }
  return loadedConfig;
}

/**
 * Get a specific credential value
 */
export function getCredential<K extends keyof EnvConfig>(key: K): EnvConfig[K] {
  const config = getCredentials();
  return config[key];
}

/**
 * Check if a credential is set
 */
export function hasCredential(key: keyof EnvConfig): boolean {
  const config = getCredentials();
  const value = config[key];
  return value !== undefined && value !== null && value !== '';
}

// ============================================================================
// CREDENTIAL MASKING
// ============================================================================

/**
 * Patterns to identify sensitive values
 */
const SENSITIVE_PATTERNS = [
  /password/i,
  /secret/i,
  /api[_-]?key/i,
  /token/i,
  /auth/i,
  /private[_-]?key/i,
  /credential/i,
  /sid$/i,
];

/**
 * Check if a key name indicates sensitive data
 */
export function isSensitiveKey(key: string): boolean {
  return SENSITIVE_PATTERNS.some((pattern) => pattern.test(key));
}

/**
 * Mask a sensitive value for logging
 */
export function maskCredential(value: string, showChars: number = 4): string {
  if (!value || value.length <= showChars * 2) {
    return '*'.repeat(value?.length || 8);
  }

  const start = value.substring(0, showChars);
  const end = value.substring(value.length - showChars);
  const masked = '*'.repeat(Math.min(value.length - showChars * 2, 16));

  return `${start}${masked}${end}`;
}

/**
 * Create a safe representation of config for logging
 */
export function getSafeConfigForLogging(config: EnvConfig): Record<string, string> {
  const safe: Record<string, string> = {};

  for (const [key, value] of Object.entries(config)) {
    if (value === undefined || value === null) {
      safe[key] = '[NOT SET]';
    } else if (isSensitiveKey(key)) {
      safe[key] = maskCredential(String(value));
    } else {
      safe[key] = String(value);
    }
  }

  return safe;
}

// ============================================================================
// SECURE ACCESS PATTERNS
// ============================================================================

/**
 * Secure accessor for database URL
 * Masks password in connection string
 */
export function getSecureDatabaseUrl(): { url: string; maskedUrl: string } {
  const url = getCredential('DATABASE_URL');

  // Mask password in URL for logging
  const maskedUrl = url.replace(
    /(:\/\/[^:]+:)([^@]+)(@)/,
    (_, before, password, after) => `${before}${maskCredential(password)}${after}`
  );

  return { url, maskedUrl };
}

/**
 * Secure accessor for Firebase admin credentials
 */
export function getFirebaseAdminCredentials(): {
  projectId: string;
  clientEmail: string | undefined;
  privateKey: string | undefined;
} {
  return {
    projectId: getCredential('FIREBASE_PROJECT_ID'),
    clientEmail: getCredential('FIREBASE_CLIENT_EMAIL'),
    privateKey: getCredential('FIREBASE_PRIVATE_KEY')?.replace(/\\n/g, '\n'),
  };
}

/**
 * Secure accessor for Twilio credentials
 */
export function getTwilioCredentials(): {
  accountSid: string | undefined;
  authToken: string | undefined;
  phoneNumber: string | undefined;
} | null {
  const accountSid = getCredential('TWILIO_ACCOUNT_SID');
  const authToken = getCredential('TWILIO_AUTH_TOKEN');

  if (!accountSid || !authToken) {
    return null;
  }

  return {
    accountSid,
    authToken,
    phoneNumber: getCredential('TWILIO_PHONE_NUMBER'),
  };
}

/**
 * Secure accessor for Stripe credentials
 */
export function getStripeCredentials(): {
  secretKey: string | undefined;
  publishableKey: string | undefined;
  webhookSecret: string | undefined;
} | null {
  const secretKey = getCredential('STRIPE_SECRET_KEY');

  if (!secretKey) {
    return null;
  }

  return {
    secretKey,
    publishableKey: getCredential('STRIPE_PUBLISHABLE_KEY'),
    webhookSecret: getCredential('STRIPE_WEBHOOK_SECRET'),
  };
}

// ============================================================================
// RUNTIME VALIDATION
// ============================================================================

/**
 * Validate that required credentials are present for a service
 */
export function validateServiceCredentials(
  service: 'firebase' | 'twilio' | 'stripe' | 'ai' | 'storage'
): { valid: boolean; missing: string[] } {
  const missing: string[] = [];
  const config = getCredentials();

  switch (service) {
    case 'firebase':
      if (!config.FIREBASE_PROJECT_ID) missing.push('FIREBASE_PROJECT_ID');
      if (!config.NEXT_PUBLIC_FIREBASE_API_KEY) missing.push('NEXT_PUBLIC_FIREBASE_API_KEY');
      break;

    case 'twilio':
      if (!config.TWILIO_ACCOUNT_SID) missing.push('TWILIO_ACCOUNT_SID');
      if (!config.TWILIO_AUTH_TOKEN) missing.push('TWILIO_AUTH_TOKEN');
      if (!config.TWILIO_PHONE_NUMBER) missing.push('TWILIO_PHONE_NUMBER');
      break;

    case 'stripe':
      if (!config.STRIPE_SECRET_KEY) missing.push('STRIPE_SECRET_KEY');
      break;

    case 'ai':
      // At least one AI service should be configured
      if (!config.OPENAI_API_KEY && !config.ANTHROPIC_API_KEY) {
        missing.push('OPENAI_API_KEY or ANTHROPIC_API_KEY');
      }
      break;

    case 'storage':
      if (!config.CLOUDFLARE_R2_ACCESS_KEY) missing.push('CLOUDFLARE_R2_ACCESS_KEY');
      if (!config.CLOUDFLARE_R2_SECRET_KEY) missing.push('CLOUDFLARE_R2_SECRET_KEY');
      if (!config.CLOUDFLARE_R2_BUCKET) missing.push('CLOUDFLARE_R2_BUCKET');
      break;
  }

  return {
    valid: missing.length === 0,
    missing,
  };
}

// ============================================================================
// CREDENTIAL ROTATION SUPPORT
// ============================================================================

/**
 * Reload credentials from environment
 * Useful for credential rotation without restart
 */
export function reloadCredentials(): EnvConfig {
  loadedConfig = null;
  return loadCredentials();
}

/**
 * Check if credentials need rotation (stub for external rotation services)
 */
export interface CredentialRotationStatus {
  key: string;
  lastRotated?: Date;
  needsRotation: boolean;
  expiresAt?: Date;
}

export function checkCredentialRotation(): CredentialRotationStatus[] {
  // This would integrate with a secret manager like Google Secret Manager
  // For now, return empty - implement based on your rotation policy
  return [];
}

// ============================================================================
// EXCEPTIONS
// ============================================================================

export class CredentialError extends Error {
  public readonly statusCode = 500;

  constructor(message: string) {
    super(message);
    this.name = 'CredentialError';
  }
}

export class MissingCredentialError extends CredentialError {
  public readonly credential: string;

  constructor(credential: string) {
    super(`Missing required credential: ${credential}`);
    this.credential = credential;
  }
}
