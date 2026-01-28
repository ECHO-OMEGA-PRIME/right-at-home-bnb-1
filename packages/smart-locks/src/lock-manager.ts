/**
 * Right at Home BnB - Lock Manager
 * Central management for all smart lock operations
 */

import type {
  ILockProvider,
  LockProvider,
  SmartLockDevice,
  LockStatus,
  AccessCode,
  LockEvent,
  LockOperationResult,
  CreateAccessCodeRequest,
  BookingInfo,
  CodeGenerationOptions,
  LockManagerConfig,
  CodeNotification,
  LockHealthStatus,
  PropertyLockSummary,
  WebhookEvent,
  ProviderConfig,
  AccessCodeStatus,
} from './types';
import { SchlageLockProvider } from './providers/schlage';
import { AugustLockProvider } from './providers/august';

/**
 * Lock to property mapping
 */
interface LockPropertyMapping {
  lockId: string;
  propertyId: string;
  propertyName: string;
  provider: LockProvider;
  deviceId: string;
}

/**
 * Lock Manager - Central controller for all smart locks
 */
export class LockManager {
  private providers: Map<LockProvider, ILockProvider>;
  private lockMappings: Map<string, LockPropertyMapping>;
  private config: LockManagerConfig;
  private notificationHandler?: (notification: CodeNotification) => Promise<void>;

  constructor(config: LockManagerConfig) {
    this.config = config;
    this.providers = new Map();
    this.lockMappings = new Map();

    this.initializeProviders();
  }

  /**
   * Initialize lock providers from config
   */
  private initializeProviders(): void {
    for (const providerConfig of this.config.providers) {
      const provider = this.createProvider(providerConfig);
      if (provider) {
        this.providers.set(providerConfig.provider, provider);
      }
    }
  }

  /**
   * Create provider instance
   */
  private createProvider(config: ProviderConfig): ILockProvider | null {
    switch (config.provider) {
      case 'SCHLAGE':
        return new SchlageLockProvider(config.credentials, config.baseUrl, config.timeout);
      case 'AUGUST':
        return new AugustLockProvider(config.credentials, config.baseUrl, config.timeout);
      default:
        console.warn(`Unknown lock provider: ${config.provider}`);
        return null;
    }
  }

  /**
   * Set notification handler
   */
  setNotificationHandler(handler: (notification: CodeNotification) => Promise<void>): void {
    this.notificationHandler = handler;
  }

  /**
   * Register a lock with a property
   */
  registerLock(
    lockId: string,
    propertyId: string,
    propertyName: string,
    provider: LockProvider,
    deviceId: string
  ): void {
    this.lockMappings.set(lockId, {
      lockId,
      propertyId,
      propertyName,
      provider,
      deviceId,
    });
  }

  /**
   * Get provider for a lock
   */
  private getProviderForLock(lockId: string): ILockProvider | null {
    const mapping = this.lockMappings.get(lockId);
    if (!mapping) return null;
    return this.providers.get(mapping.provider) || null;
  }

  /**
   * Get all locks
   */
  async getAllLocks(): Promise<SmartLockDevice[]> {
    const allLocks: SmartLockDevice[] = [];

    for (const [providerType, provider] of this.providers) {
      try {
        const locks = await provider.listDevices();
        allLocks.push(...locks);
      } catch (error) {
        console.error(`Error fetching locks from ${providerType}:`, error);
      }
    }

    // Enrich with property mappings
    return allLocks.map((lock) => {
      const mapping = this.lockMappings.get(lock.id);
      if (mapping) {
        lock.propertyId = mapping.propertyId;
      }
      return lock;
    });
  }

  /**
   * Get locks for a property
   */
  async getLocksForProperty(propertyId: string): Promise<SmartLockDevice[]> {
    const allLocks = await this.getAllLocks();
    return allLocks.filter((lock) => lock.propertyId === propertyId);
  }

  /**
   * Get single lock
   */
  async getLock(lockId: string): Promise<SmartLockDevice | null> {
    const provider = this.getProviderForLock(lockId);
    if (!provider) return null;

    const mapping = this.lockMappings.get(lockId);
    const device = await provider.getDevice(mapping?.deviceId || lockId);

    if (device && mapping) {
      device.propertyId = mapping.propertyId;
    }

    return device;
  }

  /**
   * Lock a device
   */
  async lock(lockId: string): Promise<LockOperationResult> {
    const provider = this.getProviderForLock(lockId);
    if (!provider) {
      return {
        success: false,
        lockId,
        operation: 'LOCK',
        timestamp: new Date(),
        error: 'Lock not found or provider not configured',
      };
    }

    const mapping = this.lockMappings.get(lockId);
    return provider.lock(mapping?.deviceId || lockId);
  }

  /**
   * Unlock a device
   */
  async unlock(lockId: string): Promise<LockOperationResult> {
    const provider = this.getProviderForLock(lockId);
    if (!provider) {
      return {
        success: false,
        lockId,
        operation: 'UNLOCK',
        timestamp: new Date(),
        error: 'Lock not found or provider not configured',
      };
    }

    const mapping = this.lockMappings.get(lockId);
    return provider.unlock(mapping?.deviceId || lockId);
  }

  /**
   * Get lock status
   */
  async getLockStatus(lockId: string): Promise<LockStatus> {
    const provider = this.getProviderForLock(lockId);
    if (!provider) return 'UNKNOWN';

    const mapping = this.lockMappings.get(lockId);
    return provider.getStatus(mapping?.deviceId || lockId);
  }

  /**
   * Generate access code for a booking
   */
  async generateBookingCode(
    booking: BookingInfo,
    lockId: string,
    options?: CodeGenerationOptions
  ): Promise<AccessCode> {
    const provider = this.getProviderForLock(lockId);
    if (!provider) {
      throw new Error(`Lock ${lockId} not found or provider not configured`);
    }

    const mapping = this.lockMappings.get(lockId);

    // Generate unique code
    const code = options?.checkExisting
      ? await this.generateUniqueCode(lockId, options)
      : this.generateCode(options);

    // Calculate access times with offsets
    const startTime = new Date(booking.checkIn);
    startTime.setMinutes(startTime.getMinutes() - this.config.codeStartOffsetMinutes);

    const endTime = new Date(booking.checkOut);
    endTime.setMinutes(endTime.getMinutes() + this.config.codeEndOffsetMinutes);

    // Create the access code
    const request: CreateAccessCodeRequest = {
      lockId: mapping?.deviceId || lockId,
      bookingId: booking.id,
      name: `${booking.guestName} - ${booking.confirmationCode || booking.id}`,
      code,
      startTime,
      endTime,
      guestName: booking.guestName,
      notify: this.config.notifyOnCodeCreate,
    };

    const accessCode = await provider.createAccessCode(request);

    // Send notification if configured
    if (this.config.notifyOnCodeCreate && this.notificationHandler) {
      await this.notificationHandler({
        type: 'CODE_CREATED',
        bookingId: booking.id,
        guestName: booking.guestName,
        guestEmail: booking.guestEmail,
        guestPhone: booking.guestPhone,
        propertyName: mapping?.propertyName || 'Property',
        code: accessCode.code,
        validFrom: startTime,
        validUntil: endTime,
      });
    }

    return accessCode;
  }

  /**
   * Generate codes for all locks at a property
   */
  async generatePropertyCodes(
    booking: BookingInfo,
    options?: CodeGenerationOptions
  ): Promise<AccessCode[]> {
    const locks = await this.getLocksForProperty(booking.propertyId);
    const codes: AccessCode[] = [];

    // Use the same code for all locks at the property
    const sharedCode = this.generateCode(options);

    for (const lock of locks) {
      try {
        const code = await this.generateBookingCode(
          booking,
          lock.id,
          { ...options, checkExisting: false }
        );
        codes.push(code);
      } catch (error) {
        console.error(`Failed to create code for lock ${lock.id}:`, error);
      }
    }

    return codes;
  }

  /**
   * Revoke access code
   */
  async revokeCode(lockId: string, codeId: string): Promise<boolean> {
    const provider = this.getProviderForLock(lockId);
    if (!provider) return false;

    return provider.deleteAccessCode(codeId);
  }

  /**
   * Revoke all codes for a booking
   */
  async revokeBookingCodes(bookingId: string): Promise<number> {
    let revokedCount = 0;

    for (const [lockId] of this.lockMappings) {
      const codes = await this.getAccessCodes(lockId);
      const bookingCodes = codes.filter((code) => code.bookingId === bookingId);

      for (const code of bookingCodes) {
        const success = await this.revokeCode(lockId, code.id);
        if (success) revokedCount++;
      }
    }

    return revokedCount;
  }

  /**
   * Get access codes for a lock
   */
  async getAccessCodes(lockId: string): Promise<AccessCode[]> {
    const provider = this.getProviderForLock(lockId);
    if (!provider) return [];

    const mapping = this.lockMappings.get(lockId);
    return provider.listAccessCodes(mapping?.deviceId || lockId);
  }

  /**
   * Get all active codes across all locks
   */
  async getAllActiveCodes(): Promise<Array<AccessCode & { lockId: string; propertyId: string }>> {
    const allCodes: Array<AccessCode & { lockId: string; propertyId: string }> = [];

    for (const [lockId, mapping] of this.lockMappings) {
      const codes = await this.getAccessCodes(lockId);
      const activeCodes = codes
        .filter((code) => code.status === 'ACTIVE' || code.status === 'SCHEDULED')
        .map((code) => ({
          ...code,
          lockId,
          propertyId: mapping.propertyId,
        }));
      allCodes.push(...activeCodes);
    }

    return allCodes;
  }

  /**
   * Expire old codes
   */
  async expireOldCodes(): Promise<number> {
    if (!this.config.autoExpireCodes) return 0;

    let expiredCount = 0;
    const now = new Date();

    for (const [lockId] of this.lockMappings) {
      const codes = await this.getAccessCodes(lockId);
      const expiredCodes = codes.filter(
        (code) => code.status === 'ACTIVE' && code.endTime < now
      );

      for (const code of expiredCodes) {
        const success = await this.revokeCode(lockId, code.id);
        if (success) {
          expiredCount++;

          // Send expiration notification if configured
          if (this.config.notifyOnCodeExpire && this.notificationHandler) {
            const mapping = this.lockMappings.get(lockId);
            await this.notificationHandler({
              type: 'CODE_EXPIRED',
              bookingId: code.bookingId,
              propertyName: mapping?.propertyName || 'Property',
              code: code.code,
            });
          }
        }
      }
    }

    return expiredCount;
  }

  /**
   * Get lock history/events
   */
  async getLockHistory(lockId: string, since?: Date): Promise<LockEvent[]> {
    const provider = this.getProviderForLock(lockId);
    if (!provider) return [];

    const mapping = this.lockMappings.get(lockId);
    return provider.getHistory(mapping?.deviceId || lockId, since);
  }

  /**
   * Get lock health status
   */
  async getLockHealth(lockId: string): Promise<LockHealthStatus | null> {
    const lock = await this.getLock(lockId);
    if (!lock) return null;

    const mapping = this.lockMappings.get(lockId);
    const codes = await this.getAccessCodes(lockId);
    const activeCodes = codes.filter((c) => c.status === 'ACTIVE' || c.status === 'SCHEDULED');

    const recentIssues: string[] = [];

    // Check for issues
    if (!lock.isOnline) {
      recentIssues.push('Lock is offline');
    }

    if (lock.batteryLevel !== undefined && lock.batteryLevel < 20) {
      recentIssues.push(`Low battery: ${lock.batteryLevel}%`);
    }

    if (lock.status === 'JAMMED') {
      recentIssues.push('Lock is jammed');
    }

    // Determine battery status
    let batteryStatus: 'GOOD' | 'LOW' | 'CRITICAL' | 'UNKNOWN' = 'UNKNOWN';
    if (lock.batteryLevel !== undefined) {
      if (lock.batteryLevel >= 50) batteryStatus = 'GOOD';
      else if (lock.batteryLevel >= 20) batteryStatus = 'LOW';
      else batteryStatus = 'CRITICAL';
    }

    return {
      lockId,
      name: lock.name,
      provider: lock.provider,
      isOnline: lock.isOnline,
      batteryLevel: lock.batteryLevel ?? null,
      batteryStatus,
      lastSeen: lock.lastSeen,
      status: lock.status,
      activeCodesCount: activeCodes.length,
      recentIssues,
    };
  }

  /**
   * Get property lock summary
   */
  async getPropertyLockSummary(propertyId: string, propertyName: string): Promise<PropertyLockSummary> {
    const locks = await this.getLocksForProperty(propertyId);
    const healthStatuses: LockHealthStatus[] = [];
    const issues: string[] = [];

    for (const lock of locks) {
      const health = await this.getLockHealth(lock.id);
      if (health) {
        healthStatuses.push(health);
        issues.push(...health.recentIssues.map((issue) => `${lock.name}: ${issue}`));
      }
    }

    return {
      propertyId,
      propertyName,
      locks: healthStatuses,
      totalLocks: locks.length,
      onlineLocks: healthStatuses.filter((h) => h.isOnline).length,
      offlineLocks: healthStatuses.filter((h) => !h.isOnline).length,
      lowBatteryLocks: healthStatuses.filter(
        (h) => h.batteryStatus === 'LOW' || h.batteryStatus === 'CRITICAL'
      ).length,
      issues,
    };
  }

  /**
   * Handle webhook event
   */
  async handleWebhook(event: WebhookEvent): Promise<void> {
    const provider = this.providers.get(event.provider);
    if (provider) {
      await provider.handleWebhook(event);
    }
  }

  /**
   * Generate unique code that doesn't exist on any lock
   */
  private async generateUniqueCode(
    lockId: string,
    options?: CodeGenerationOptions
  ): Promise<string> {
    const existingCodes = await this.getAccessCodes(lockId);
    const existingSet = new Set(existingCodes.map((c) => c.code));

    let attempts = 0;
    const maxAttempts = 100;

    while (attempts < maxAttempts) {
      const code = this.generateCode(options);
      if (!existingSet.has(code)) {
        return code;
      }
      attempts++;
    }

    throw new Error('Failed to generate unique code after 100 attempts');
  }

  /**
   * Generate access code based on options
   */
  private generateCode(options?: CodeGenerationOptions): string {
    const length = options?.length || this.config.defaultCodeLength;
    const allowedChars = options?.allowedChars || '0123456789';
    const avoidSimilar = options?.avoidSimilar ?? true;
    const avoidSequential = options?.avoidSequential ?? true;

    // Characters to avoid if avoidSimilar is true
    const similarChars = '01IO';
    const chars = avoidSimilar
      ? allowedChars.split('').filter((c) => !similarChars.includes(c)).join('')
      : allowedChars;

    let code = options?.prefix || '';

    // Generate random digits
    while (code.length < length) {
      const randomChar = chars.charAt(Math.floor(Math.random() * chars.length));

      // Avoid sequential digits if enabled
      if (avoidSequential && code.length > 0) {
        const lastChar = code.charAt(code.length - 1);
        const lastNum = parseInt(lastChar);
        const currentNum = parseInt(randomChar);

        if (!isNaN(lastNum) && !isNaN(currentNum)) {
          if (Math.abs(currentNum - lastNum) === 1) {
            continue; // Skip sequential digit
          }
        }
      }

      code += randomChar;
    }

    return code;
  }

  /**
   * Validate access code format
   */
  validateCode(code: string, lockId: string): { valid: boolean; error?: string } {
    const lock = this.lockMappings.get(lockId);
    if (!lock) {
      return { valid: false, error: 'Lock not found' };
    }

    // Default validation rules
    if (code.length < 4) {
      return { valid: false, error: 'Code must be at least 4 digits' };
    }

    if (code.length > 8) {
      return { valid: false, error: 'Code must be at most 8 digits' };
    }

    if (!/^\d+$/.test(code)) {
      return { valid: false, error: 'Code must contain only digits' };
    }

    // Check for weak codes
    const weakCodes = ['0000', '1111', '1234', '4321', '0123', '9999', '1212'];
    if (weakCodes.includes(code)) {
      return { valid: false, error: 'Code is too simple' };
    }

    return { valid: true };
  }

  /**
   * Get codes expiring soon
   */
  async getExpiringCodes(withinHours: number = 24): Promise<Array<AccessCode & { lockId: string }>> {
    const allCodes = await this.getAllActiveCodes();
    const expirationThreshold = new Date();
    expirationThreshold.setHours(expirationThreshold.getHours() + withinHours);

    return allCodes.filter(
      (code) => code.status === 'ACTIVE' && code.endTime <= expirationThreshold
    );
  }

  /**
   * Lock all locks at a property
   */
  async lockProperty(propertyId: string): Promise<LockOperationResult[]> {
    const locks = await this.getLocksForProperty(propertyId);
    const results: LockOperationResult[] = [];

    for (const lock of locks) {
      const result = await this.lock(lock.id);
      results.push(result);
    }

    return results;
  }

  /**
   * Unlock all locks at a property
   */
  async unlockProperty(propertyId: string): Promise<LockOperationResult[]> {
    const locks = await this.getLocksForProperty(propertyId);
    const results: LockOperationResult[] = [];

    for (const lock of locks) {
      const result = await this.unlock(lock.id);
      results.push(result);
    }

    return results;
  }
}

export default LockManager;
