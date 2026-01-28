/**
 * Right at Home BnB - Schlage Lock Provider
 * Integration with Schlage Encode smart locks
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
 * Schlage API response types
 */
interface SchlageDevice {
  deviceId: string;
  name: string;
  model: string;
  firmwareVersion: string;
  batteryLevel: number;
  lockState: 'locked' | 'unlocked' | 'unknown';
  connected: boolean;
  lastActivityAt: string;
}

interface SchlageAccessCode {
  accessCodeId: string;
  deviceId: string;
  code: string;
  name: string;
  status: 'enabled' | 'disabled';
  scheduleType: 'always' | 'temporary' | 'recurring';
  startsAt?: string;
  endsAt?: string;
  accessCount: number;
  createdAt: string;
  lastAccessedAt?: string;
}

interface SchlageEvent {
  eventId: string;
  deviceId: string;
  eventType: string;
  occurredAt: string;
  accessCodeId?: string;
  accessCodeName?: string;
  details?: Record<string, unknown>;
}

/**
 * Schlage Lock Provider Implementation
 */
export class SchlageLockProvider implements ILockProvider {
  readonly provider: LockProvider = 'SCHLAGE';

  private credentials: ProviderCredentials;
  private baseUrl: string;
  private timeout: number;

  constructor(credentials: ProviderCredentials, baseUrl?: string, timeout?: number) {
    this.credentials = credentials;
    this.baseUrl = baseUrl || 'https://api.schlage.com/v1';
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
      Authorization: `Bearer ${this.credentials.accessToken}`,
    };

    if (this.credentials.apiKey) {
      headers['X-Api-Key'] = this.credentials.apiKey;
    }

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
        throw new Error(`Schlage API error: ${response.status} - ${error}`);
      }

      return response.json();
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Schlage API request timeout');
      }
      throw error;
    }
  }

  /**
   * List all devices
   */
  async listDevices(): Promise<SmartLockDevice[]> {
    const response = await this.apiRequest<{ devices: SchlageDevice[] }>('GET', '/devices');

    return response.devices.map((device) => this.mapDevice(device));
  }

  /**
   * Get single device
   */
  async getDevice(deviceId: string): Promise<SmartLockDevice | null> {
    try {
      const device = await this.apiRequest<SchlageDevice>('GET', `/devices/${deviceId}`);
      return this.mapDevice(device);
    } catch {
      return null;
    }
  }

  /**
   * Lock device
   */
  async lock(deviceId: string): Promise<LockOperationResult> {
    try {
      await this.apiRequest('POST', `/devices/${deviceId}/lock`);

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
      await this.apiRequest('POST', `/devices/${deviceId}/unlock`);

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
   * List access codes for device
   */
  async listAccessCodes(deviceId: string): Promise<AccessCode[]> {
    const response = await this.apiRequest<{ accessCodes: SchlageAccessCode[] }>(
      'GET',
      `/devices/${deviceId}/access-codes`
    );

    return response.accessCodes.map((code) => this.mapAccessCode(code));
  }

  /**
   * Create access code
   */
  async createAccessCode(request: CreateAccessCodeRequest): Promise<AccessCode> {
    const payload = {
      deviceId: request.lockId,
      code: request.code || this.generateCode(),
      name: request.name,
      scheduleType: 'temporary',
      startsAt: request.startTime.toISOString(),
      endsAt: request.endTime.toISOString(),
    };

    const response = await this.apiRequest<SchlageAccessCode>(
      'POST',
      `/devices/${request.lockId}/access-codes`,
      payload
    );

    return this.mapAccessCode(response);
  }

  /**
   * Update access code
   */
  async updateAccessCode(codeId: string, updates: Partial<AccessCode>): Promise<AccessCode> {
    const payload: Record<string, unknown> = {};

    if (updates.name) payload.name = updates.name;
    if (updates.code) payload.code = updates.code;
    if (updates.startTime) payload.startsAt = updates.startTime.toISOString();
    if (updates.endTime) payload.endsAt = updates.endTime.toISOString();
    if (updates.status) payload.status = updates.status === 'ACTIVE' ? 'enabled' : 'disabled';

    const response = await this.apiRequest<SchlageAccessCode>(
      'PUT',
      `/access-codes/${codeId}`,
      payload
    );

    return this.mapAccessCode(response);
  }

  /**
   * Delete access code
   */
  async deleteAccessCode(codeId: string): Promise<boolean> {
    try {
      await this.apiRequest('DELETE', `/access-codes/${codeId}`);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get lock history
   */
  async getHistory(deviceId: string, since?: Date): Promise<LockEvent[]> {
    let endpoint = `/devices/${deviceId}/events`;
    if (since) {
      endpoint += `?since=${since.toISOString()}`;
    }

    const response = await this.apiRequest<{ events: SchlageEvent[] }>('GET', endpoint);

    return response.events.map((event) => this.mapEvent(event));
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
    // Implementation would store event, update device status, send notifications, etc.
    console.log(`Schlage webhook received: ${event.eventType} for device ${event.deviceId}`);
  }

  /**
   * Map Schlage device to SmartLockDevice
   */
  private mapDevice(device: SchlageDevice): SmartLockDevice {
    return {
      id: device.deviceId,
      propertyId: '', // Will be set by lock manager
      name: device.name,
      provider: 'SCHLAGE',
      deviceId: device.deviceId,
      model: device.model,
      firmwareVersion: device.firmwareVersion,
      batteryLevel: device.batteryLevel,
      status: this.mapLockState(device.lockState),
      isOnline: device.connected,
      lastSeen: new Date(device.lastActivityAt),
      capabilities: this.getCapabilities(),
    };
  }

  /**
   * Map Schlage access code to AccessCode
   */
  private mapAccessCode(code: SchlageAccessCode): AccessCode {
    return {
      id: code.accessCodeId,
      lockId: code.deviceId,
      name: code.name,
      code: code.code,
      status: code.status === 'enabled' ? 'ACTIVE' : 'REVOKED',
      startTime: code.startsAt ? new Date(code.startsAt) : new Date(),
      endTime: code.endsAt ? new Date(code.endsAt) : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      usageCount: code.accessCount,
      createdAt: new Date(code.createdAt),
      lastUsed: code.lastAccessedAt ? new Date(code.lastAccessedAt) : undefined,
      createdBy: 'SYSTEM',
    };
  }

  /**
   * Map Schlage event to LockEvent
   */
  private mapEvent(event: SchlageEvent): LockEvent {
    return {
      id: event.eventId,
      lockId: event.deviceId,
      type: this.mapEventType(event.eventType),
      timestamp: new Date(event.occurredAt),
      codeId: event.accessCodeId,
      codeName: event.accessCodeName,
      source: event.accessCodeId ? 'CODE' : 'MANUAL',
      details: event.details ? JSON.stringify(event.details) : undefined,
      metadata: event.details,
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
   * Map event type string to LockEventType
   */
  private mapEventType(type: string): LockEventType {
    const mapping: Record<string, LockEventType> = {
      lock: 'LOCKED',
      unlock: 'UNLOCKED',
      manual_lock: 'LOCKED_MANUALLY',
      manual_unlock: 'UNLOCKED_MANUALLY',
      keypad_lock: 'CODE_ENTERED',
      keypad_unlock: 'CODE_ENTERED',
      code_failed: 'CODE_FAILED',
      jam: 'JAMMED',
      battery_low: 'BATTERY_LOW',
      tamper: 'TAMPER_DETECTED',
      offline: 'OFFLINE',
      online: 'ONLINE',
    };

    return mapping[type] || 'LOCKED';
  }

  /**
   * Get Schlage lock capabilities
   */
  private getCapabilities(): LockCapabilities {
    return {
      canLock: true,
      canUnlock: true,
      canCreateCodes: true,
      canDeleteCodes: true,
      canScheduleCodes: true,
      maxCodes: 100,
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
    // In production, implement HMAC signature verification
    // using the webhook secret and event data
    if (!this.credentials.webhookSecret || !event.signature) {
      return true; // Skip verification if not configured
    }

    // Simplified verification - in production use crypto.createHmac
    const expectedSignature = this.credentials.webhookSecret;
    return event.signature === expectedSignature;
  }

  /**
   * Refresh access token if expired
   */
  async refreshToken(): Promise<void> {
    if (!this.credentials.refreshToken) {
      throw new Error('No refresh token available');
    }

    const response = await fetch(`${this.baseUrl}/oauth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        grant_type: 'refresh_token',
        refresh_token: this.credentials.refreshToken,
        client_id: this.credentials.apiKey,
        client_secret: this.credentials.apiSecret,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to refresh Schlage token');
    }

    const data = await response.json();
    this.credentials.accessToken = data.access_token;
    this.credentials.refreshToken = data.refresh_token;
    this.credentials.expiresAt = new Date(Date.now() + data.expires_in * 1000);
  }
}

export default SchlageLockProvider;
