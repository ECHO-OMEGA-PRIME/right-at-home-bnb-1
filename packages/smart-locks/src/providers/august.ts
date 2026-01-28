/**
 * Right at Home BnB - August Lock Provider
 * Integration with August smart locks
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
  WebhookEvent,
  ProviderCredentials,
  LockCapabilities,
  LockEventType,
} from '../types';

/**
 * August API response types
 */
interface AugustLock {
  LockID: string;
  LockName: string;
  HouseName: string;
  Type: string;
  Created: string;
  Updated: string;
  LockStatus: {
    status: 'locked' | 'unlocked' | 'unknown';
    dateTime: string;
    isLockStatusChanged: boolean;
    doorState: 'open' | 'closed' | 'unknown';
  };
  Bridge: {
    _id: string;
    status: {
      current: 'online' | 'offline';
      lastOnline: string;
    };
  } | null;
  battery: number;
  SerialNumber: string;
  skuNumber: string;
  firmwareVersion: string;
}

interface AugustGuestAccess {
  accessID: string;
  lockID: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  accessCode?: string;
  accessType: 'guest' | 'owner' | 'manager';
  status: 'active' | 'pending' | 'revoked';
  startsAt?: string;
  endsAt?: string;
  createdAt: string;
  lastAccessed?: string;
  accessCount: number;
}

interface AugustActivity {
  activityID: string;
  lockID: string;
  dateTime: string;
  action: string;
  deviceType: string;
  deviceName?: string;
  callingUser?: {
    UserID: string;
    FirstName: string;
    LastName: string;
  };
  info?: Record<string, unknown>;
}

/**
 * August Lock Provider Implementation
 */
export class AugustLockProvider implements ILockProvider {
  readonly provider: LockProvider = 'AUGUST';

  private credentials: ProviderCredentials;
  private baseUrl: string;
  private timeout: number;

  constructor(credentials: ProviderCredentials, baseUrl?: string, timeout?: number) {
    this.credentials = credentials;
    this.baseUrl = baseUrl || 'https://api-production.august.com';
    this.timeout = timeout || 30000;
  }

  /**
   * Make authenticated API request
   */
  private async apiRequest<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    endpoint: string,
    body?: unknown
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-august-access-token': this.credentials.accessToken || '',
      'x-august-api-key': this.credentials.apiKey || '',
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`August API error: ${response.status} - ${error}`);
      }

      return response.json();
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('August API request timeout');
      }
      throw error;
    }
  }

  /**
   * List all devices
   */
  async listDevices(): Promise<SmartLockDevice[]> {
    const response = await this.apiRequest<Record<string, AugustLock>>('GET', '/locks');

    return Object.values(response).map((lock) => this.mapDevice(lock));
  }

  /**
   * Get single device
   */
  async getDevice(deviceId: string): Promise<SmartLockDevice | null> {
    try {
      const lock = await this.apiRequest<AugustLock>('GET', `/locks/${deviceId}`);
      return this.mapDevice(lock);
    } catch {
      return null;
    }
  }

  /**
   * Lock device
   */
  async lock(deviceId: string): Promise<LockOperationResult> {
    try {
      await this.apiRequest('PUT', `/remoteoperate/${deviceId}/lock`);

      return {
        success: true,
        lockId: deviceId,
        operation: 'LOCK',
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        success: false,
        lockId: deviceId,
        operation: 'LOCK',
        timestamp: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Unlock device
   */
  async unlock(deviceId: string): Promise<LockOperationResult> {
    try {
      await this.apiRequest('PUT', `/remoteoperate/${deviceId}/unlock`);

      return {
        success: true,
        lockId: deviceId,
        operation: 'UNLOCK',
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        success: false,
        lockId: deviceId,
        operation: 'UNLOCK',
        timestamp: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get lock status
   */
  async getStatus(deviceId: string): Promise<LockStatus> {
    const device = await this.getDevice(deviceId);
    return device?.status || 'UNKNOWN';
  }

  /**
   * Get battery level
   */
  async getBatteryLevel(deviceId: string): Promise<number | null> {
    const device = await this.getDevice(deviceId);
    return device?.batteryLevel ?? null;
  }

  /**
   * List access codes/guest access for device
   */
  async listAccessCodes(deviceId: string): Promise<AccessCode[]> {
    const response = await this.apiRequest<AugustGuestAccess[]>(
      'GET',
      `/locks/${deviceId}/guests`
    );

    return response
      .filter((guest) => guest.accessCode)
      .map((guest) => this.mapAccessCode(guest));
  }

  /**
   * Create access code (via guest invitation)
   */
  async createAccessCode(request: CreateAccessCodeRequest): Promise<AccessCode> {
    const payload = {
      lockID: request.lockId,
      firstName: request.guestName?.split(' ')[0] || 'Guest',
      lastName: request.guestName?.split(' ').slice(1).join(' ') || '',
      accessType: 'guest',
      pinCode: request.code || this.generateCode(),
      startsAt: request.startTime.toISOString(),
      endsAt: request.endTime.toISOString(),
    };

    const response = await this.apiRequest<AugustGuestAccess>(
      'POST',
      `/locks/${request.lockId}/guests`,
      payload
    );

    return this.mapAccessCode(response);
  }

  /**
   * Update access code
   */
  async updateAccessCode(codeId: string, updates: Partial<AccessCode>): Promise<AccessCode> {
    const payload: Record<string, unknown> = {};

    if (updates.name) {
      const nameParts = updates.name.split(' ');
      payload.firstName = nameParts[0];
      payload.lastName = nameParts.slice(1).join(' ');
    }
    if (updates.code) payload.pinCode = updates.code;
    if (updates.startTime) payload.startsAt = updates.startTime.toISOString();
    if (updates.endTime) payload.endsAt = updates.endTime.toISOString();
    if (updates.status) payload.status = updates.status === 'ACTIVE' ? 'active' : 'revoked';

    const response = await this.apiRequest<AugustGuestAccess>(
      'PUT',
      `/guests/${codeId}`,
      payload
    );

    return this.mapAccessCode(response);
  }

  /**
   * Delete access code (revoke guest access)
   */
  async deleteAccessCode(codeId: string): Promise<boolean> {
    try {
      await this.apiRequest('DELETE', `/guests/${codeId}`);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get lock history/activity
   */
  async getHistory(deviceId: string, since?: Date): Promise<LockEvent[]> {
    let endpoint = `/locks/${deviceId}/activities`;
    if (since) {
      endpoint += `?dateStart=${since.toISOString()}`;
    }

    const response = await this.apiRequest<AugustActivity[]>('GET', endpoint);

    return response.map((activity) => this.mapActivity(activity));
  }

  /**
   * Handle webhook event
   */
  async handleWebhook(event: WebhookEvent): Promise<void> {
    // Verify webhook signature if provided
    if (event.signature && this.credentials.webhookSecret) {
      const isValid = this.verifyWebhookSignature(event);
      if (!isValid) {
        throw new Error('Invalid webhook signature');
      }
    }

    // Process event based on type
    console.log(`August webhook received: ${event.eventType} for device ${event.deviceId}`);
  }

  /**
   * Map August lock to SmartLockDevice
   */
  private mapDevice(lock: AugustLock): SmartLockDevice {
    const isOnline = lock.Bridge?.status?.current === 'online';
    const lastSeen = lock.Bridge?.status?.lastOnline
      ? new Date(lock.Bridge.status.lastOnline)
      : new Date(lock.Updated);

    return {
      id: lock.LockID,
      propertyId: '', // Will be set by lock manager
      name: lock.LockName,
      provider: 'AUGUST',
      deviceId: lock.LockID,
      model: lock.Type,
      firmwareVersion: lock.firmwareVersion,
      batteryLevel: lock.battery,
      status: this.mapLockState(lock.LockStatus.status),
      isOnline,
      lastSeen,
      capabilities: this.getCapabilities(),
      metadata: {
        houseName: lock.HouseName,
        serialNumber: lock.SerialNumber,
        skuNumber: lock.skuNumber,
        doorState: lock.LockStatus.doorState,
        hasBridge: !!lock.Bridge,
      },
    };
  }

  /**
   * Map August guest access to AccessCode
   */
  private mapAccessCode(guest: AugustGuestAccess): AccessCode {
    const name = [guest.firstName, guest.lastName].filter(Boolean).join(' ');

    return {
      id: guest.accessID,
      lockId: guest.lockID,
      name: name || 'Guest',
      code: guest.accessCode || '',
      status: this.mapAccessStatus(guest.status),
      startTime: guest.startsAt ? new Date(guest.startsAt) : new Date(),
      endTime: guest.endsAt ? new Date(guest.endsAt) : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      usageCount: guest.accessCount,
      createdAt: new Date(guest.createdAt),
      lastUsed: guest.lastAccessed ? new Date(guest.lastAccessed) : undefined,
      createdBy: 'SYSTEM',
      metadata: {
        email: guest.email,
        phone: guest.phone,
        accessType: guest.accessType,
      },
    };
  }

  /**
   * Map August activity to LockEvent
   */
  private mapActivity(activity: AugustActivity): LockEvent {
    const source = activity.deviceType === 'keypad' ? 'CODE' :
                   activity.callingUser ? 'REMOTE' : 'MANUAL';

    return {
      id: activity.activityID,
      lockId: activity.lockID,
      type: this.mapActivityType(activity.action),
      timestamp: new Date(activity.dateTime),
      source,
      userId: activity.callingUser?.UserID,
      details: activity.callingUser
        ? `${activity.callingUser.FirstName} ${activity.callingUser.LastName}`
        : undefined,
      metadata: {
        deviceType: activity.deviceType,
        deviceName: activity.deviceName,
        ...activity.info,
      },
    };
  }

  /**
   * Map lock state string to LockStatus
   */
  private mapLockState(state: string): LockStatus {
    switch (state) {
      case 'locked':
        return 'LOCKED';
      case 'unlocked':
        return 'UNLOCKED';
      default:
        return 'UNKNOWN';
    }
  }

  /**
   * Map access status string to AccessCodeStatus
   */
  private mapAccessStatus(status: string): import('../types').AccessCodeStatus {
    switch (status) {
      case 'active':
        return 'ACTIVE';
      case 'pending':
        return 'SCHEDULED';
      case 'revoked':
        return 'REVOKED';
      default:
        return 'ACTIVE';
    }
  }

  /**
   * Map activity action to LockEventType
   */
  private mapActivityType(action: string): LockEventType {
    const mapping: Record<string, LockEventType> = {
      lock: 'LOCKED',
      unlock: 'UNLOCKED',
      onetouchlock: 'LOCKED_MANUALLY',
      manuallocked: 'LOCKED_MANUALLY',
      manualunlock: 'UNLOCKED_MANUALLY',
      keypad_lock: 'CODE_ENTERED',
      keypad_unlock: 'CODE_ENTERED',
      pin_entered: 'CODE_ENTERED',
      pin_failed: 'CODE_FAILED',
      dooropen: 'UNLOCKED',
      doorclosed: 'LOCKED',
      jam: 'JAMMED',
      lowbattery: 'BATTERY_LOW',
      offline: 'OFFLINE',
      online: 'ONLINE',
    };

    return mapping[action.toLowerCase()] || 'LOCKED';
  }

  /**
   * Get August lock capabilities
   */
  private getCapabilities(): LockCapabilities {
    return {
      canLock: true,
      canUnlock: true,
      canCreateCodes: true,
      canDeleteCodes: true,
      canScheduleCodes: true,
      maxCodes: 250, // August supports more guest codes
      codeLength: { min: 4, max: 8 },
      supportsBatteryReporting: true,
      supportsAutoLock: true,
      supportsHistory: true,
    };
  }

  /**
   * Generate random access code
   */
  private generateCode(length: number = 6): string {
    const chars = '0123456789';
    let code = '';

    // Avoid codes starting with 0
    code += chars.charAt(Math.floor(Math.random() * 9) + 1);

    for (let i = 1; i < length; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    return code;
  }

  /**
   * Verify webhook signature
   */
  private verifyWebhookSignature(event: WebhookEvent): boolean {
    if (!this.credentials.webhookSecret || !event.signature) {
      return true;
    }

    // Simplified verification - in production use proper HMAC
    const expectedSignature = this.credentials.webhookSecret;
    return event.signature === expectedSignature;
  }

  /**
   * Authenticate with August
   * August uses a phone-based two-factor authentication
   */
  async authenticate(email: string, password: string): Promise<void> {
    const installId = this.generateInstallId();

    // Step 1: Initial login
    const sessionResponse = await fetch(`${this.baseUrl}/session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-august-api-key': this.credentials.apiKey || '',
        'x-kease-api-key': this.credentials.apiKey || '',
      },
      body: JSON.stringify({
        identifier: `email:${email}`,
        password,
        installId,
      }),
    });

    if (!sessionResponse.ok) {
      throw new Error('August authentication failed');
    }

    const sessionData = await sessionResponse.json();

    // Store tokens
    this.credentials.accessToken = sessionResponse.headers.get('x-august-access-token') || sessionData.access_token;
    this.credentials.accountId = sessionData.userId;
  }

  /**
   * Generate install ID for August API
   */
  private generateInstallId(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  /**
   * Get user houses/locations
   */
  async getHouses(): Promise<Array<{ houseId: string; name: string; locks: string[] }>> {
    const response = await this.apiRequest<Record<string, {
      HouseName: string;
      HouseID: string;
      LockIDs: string[];
    }>>('GET', '/users/houses');

    return Object.values(response).map((house) => ({
      houseId: house.HouseID,
      name: house.HouseName,
      locks: house.LockIDs,
    }));
  }

  /**
   * Get door state for a lock
   */
  async getDoorState(deviceId: string): Promise<'OPEN' | 'CLOSED' | 'UNKNOWN'> {
    const device = await this.getDevice(deviceId);
    const doorState = device?.metadata?.doorState as string;

    switch (doorState) {
      case 'open':
        return 'OPEN';
      case 'closed':
        return 'CLOSED';
      default:
        return 'UNKNOWN';
    }
  }
}

export default AugustLockProvider;
