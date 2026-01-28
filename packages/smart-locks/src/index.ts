/**
 * Right at Home BnB - Smart Locks Package
 * Smart lock integration for vacation rental properties
 *
 * Supported providers:
 * - Schlage Encode smart locks
 * - August smart locks
 */

// Type exports
export type {
  LockProvider,
  LockStatus,
  AccessCodeStatus,
  LockEventType,
  SmartLockDevice,
  LockCapabilities,
  AccessCode,
  CreateAccessCodeRequest,
  LockEvent,
  LockOperationResult,
  ProviderCredentials,
  ProviderConfig,
  WebhookEvent,
  ILockProvider,
  BookingInfo,
  CodeGenerationOptions,
  LockManagerConfig,
  CodeNotification,
  LockHealthStatus,
  PropertyLockSummary,
} from './types';

// Lock Manager
export { LockManager, default as LockManagerClass } from './lock-manager';

// Providers
export { SchlageLockProvider } from './providers/schlage';
export { AugustLockProvider } from './providers/august';

/**
 * Create a pre-configured lock manager for Right at Home BnB
 */
export function createLockManager(config: {
  schlage?: {
    apiKey: string;
    apiSecret: string;
    accessToken: string;
    refreshToken?: string;
  };
  august?: {
    apiKey: string;
    accessToken: string;
  };
  options?: {
    defaultCodeLength?: number;
    codeStartOffsetMinutes?: number;
    codeEndOffsetMinutes?: number;
    autoExpireCodes?: boolean;
    notifyOnCodeCreate?: boolean;
    notifyOnCodeExpire?: boolean;
    webhookBaseUrl?: string;
  };
}): import('./lock-manager').LockManager {
  const { LockManager } = require('./lock-manager');

  const providers: import('./types').ProviderConfig[] = [];

  // Add Schlage provider if configured
  if (config.schlage) {
    providers.push({
      provider: 'SCHLAGE',
      credentials: {
        provider: 'SCHLAGE',
        apiKey: config.schlage.apiKey,
        apiSecret: config.schlage.apiSecret,
        accessToken: config.schlage.accessToken,
        refreshToken: config.schlage.refreshToken,
      },
    });
  }

  // Add August provider if configured
  if (config.august) {
    providers.push({
      provider: 'AUGUST',
      credentials: {
        provider: 'AUGUST',
        apiKey: config.august.apiKey,
        accessToken: config.august.accessToken,
      },
    });
  }

  const managerConfig: import('./types').LockManagerConfig = {
    providers,
    defaultCodeLength: config.options?.defaultCodeLength ?? 6,
    codeStartOffsetMinutes: config.options?.codeStartOffsetMinutes ?? 60, // 1 hour before check-in
    codeEndOffsetMinutes: config.options?.codeEndOffsetMinutes ?? 60, // 1 hour after check-out
    autoExpireCodes: config.options?.autoExpireCodes ?? true,
    notifyOnCodeCreate: config.options?.notifyOnCodeCreate ?? true,
    notifyOnCodeExpire: config.options?.notifyOnCodeExpire ?? false,
    webhookBaseUrl: config.options?.webhookBaseUrl,
  };

  return new LockManager(managerConfig);
}

/**
 * Utility functions for access code generation
 */
export const codeUtils = {
  /**
   * Generate a random numeric code
   */
  generateCode(length: number = 6): string {
    const chars = '23456789'; // Avoid 0, 1 for clarity
    let code = '';

    for (let i = 0; i < length; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    return code;
  },

  /**
   * Generate a memorable code (easy to remember patterns)
   */
  generateMemorableCode(): string {
    // Generate codes like 2468, 3579, 1357
    const patterns = [
      () => {
        const start = Math.floor(Math.random() * 4) + 2;
        return [start, start + 2, start + 4, start + 6].map((n) => n % 10).join('');
      },
      () => {
        const digit = Math.floor(Math.random() * 9) + 1;
        return `${digit}${digit}${digit}${digit}`;
      },
      () => {
        const a = Math.floor(Math.random() * 9) + 1;
        const b = Math.floor(Math.random() * 9) + 1;
        return `${a}${b}${a}${b}`;
      },
    ];

    const pattern = patterns[Math.floor(Math.random() * patterns.length)];
    return pattern();
  },

  /**
   * Validate code strength
   */
  validateCodeStrength(code: string): {
    score: number;
    issues: string[];
  } {
    const issues: string[] = [];
    let score = 100;

    // Check length
    if (code.length < 4) {
      issues.push('Code is too short');
      score -= 30;
    }

    // Check for repeating digits
    if (/(.)\1{2,}/.test(code)) {
      issues.push('Contains repeated digits');
      score -= 20;
    }

    // Check for sequential digits
    if (/012|123|234|345|456|567|678|789|987|876|765|654|543|432|321|210/.test(code)) {
      issues.push('Contains sequential digits');
      score -= 20;
    }

    // Check for common codes
    const commonCodes = ['0000', '1111', '1234', '4321', '0123', '9999', '1212', '2580'];
    if (commonCodes.includes(code)) {
      issues.push('Code is too common');
      score -= 40;
    }

    return {
      score: Math.max(0, score),
      issues,
    };
  },

  /**
   * Format code for display (e.g., "1234" -> "12-34")
   */
  formatCode(code: string, separator: string = '-'): string {
    if (code.length <= 4) {
      return code.slice(0, 2) + separator + code.slice(2);
    }
    return code.slice(0, 3) + separator + code.slice(3);
  },
};

/**
 * Constants for lock management
 */
export const LOCK_CONSTANTS = {
  PROVIDERS: ['SCHLAGE', 'AUGUST', 'YALE', 'KWIKSET'] as const,

  DEFAULT_CODE_LENGTH: 6,

  BATTERY_THRESHOLDS: {
    GOOD: 50,
    LOW: 20,
    CRITICAL: 10,
  },

  OFFLINE_THRESHOLD_MINUTES: 30,

  CODE_VALIDITY_BUFFER_MINUTES: 60,
};

/**
 * Example usage and integration patterns
 *
 * @example
 * ```typescript
 * import { createLockManager, codeUtils } from '@rightathome/smart-locks';
 *
 * // Create lock manager with provider credentials
 * const lockManager = createLockManager({
 *   schlage: {
 *     apiKey: process.env.SCHLAGE_API_KEY!,
 *     apiSecret: process.env.SCHLAGE_API_SECRET!,
 *     accessToken: process.env.SCHLAGE_ACCESS_TOKEN!,
 *   },
 *   august: {
 *     apiKey: process.env.AUGUST_API_KEY!,
 *     accessToken: process.env.AUGUST_ACCESS_TOKEN!,
 *   },
 *   options: {
 *     defaultCodeLength: 6,
 *     codeStartOffsetMinutes: 60,
 *     codeEndOffsetMinutes: 60,
 *     autoExpireCodes: true,
 *   },
 * });
 *
 * // Register locks with properties
 * lockManager.registerLock('lock-123', 'prop-456', 'Sunset Retreat', 'SCHLAGE', 'device-abc');
 *
 * // Generate code for a booking
 * const code = await lockManager.generateBookingCode({
 *   id: 'booking-789',
 *   propertyId: 'prop-456',
 *   guestName: 'John Smith',
 *   guestEmail: 'john@example.com',
 *   checkIn: new Date('2024-02-15T15:00:00'),
 *   checkOut: new Date('2024-02-18T11:00:00'),
 * }, 'lock-123');
 *
 * // Lock/unlock operations
 * await lockManager.lock('lock-123');
 * await lockManager.unlock('lock-123');
 *
 * // Get lock health
 * const health = await lockManager.getLockHealth('lock-123');
 * if (health?.batteryStatus === 'LOW') {
 *   console.log('Battery is low!');
 * }
 *
 * // Clean up expired codes
 * const expiredCount = await lockManager.expireOldCodes();
 * ```
 */
