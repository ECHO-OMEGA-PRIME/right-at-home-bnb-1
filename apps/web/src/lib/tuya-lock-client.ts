/**
 * Right at Home BnB - Tuya Smart Lock Client
 * Controls Tuya-based smart locks for automated guest code management
 * @author ECHO OMEGA PRIME
 *
 * Locks installed: Garfield, Castleford, Lincoln Green
 * Integration: Tuya Cloud API via @tuya/tuya-connector-nodejs
 *
 * Flow:
 *   Booking confirmed → generate time-limited code → push to lock
 *   Check-out time → auto-delete code → lock secured
 */

// ============================================================================
// TYPES
// ============================================================================

export interface TuyaConfig {
  accessKey: string;
  secretKey: string;
  baseUrl?: string;
}

export interface TuyaDevice {
  id: string;
  name: string;
  category: string;
  product_id: string;
  online: boolean;
  status: Array<{ code: string; value: unknown }>;
}

export interface TempPassword {
  id: number;
  name: string;
  password: string;
  effective_time: number;
  invalid_time: number;
  device_id: string;
  property_slug: string;
}

export interface LockStatus {
  device_id: string;
  online: boolean;
  locked: boolean;
  door_closed: boolean;
  battery_percent: number;
}

export interface EntryLogEntry {
  id: number;
  user_id: string;
  unlock_name: string;
  unlock_type: number;
  time: number;
  status: number;
}

export interface GuestCodeRequest {
  property_slug: string;
  guest_name: string;
  booking_id: string;
  check_in: Date;
  check_out: Date;
  custom_code?: string;
}

export interface GuestCodeResult {
  success: boolean;
  code: string;
  password_id: number;
  device_id: string;
  property_slug: string;
  guest_name: string;
  active_from: string;
  active_until: string;
  error?: string;
}

// ============================================================================
// PROPERTY → DEVICE MAPPING
// ============================================================================

/**
 * Maps RAH property slugs to Tuya device IDs.
 * Device IDs are obtained from Tuya IoT Platform after linking the Smart Life app.
 *
 * TO GET DEVICE IDS:
 * 1. Log into https://iot.tuya.com
 * 2. Go to Cloud > your project > Devices
 * 3. Or call GET /v1.0/users/{uid}/devices after linking app account
 *
 * Update these mappings once Tuya developer account is set up.
 */
const PROPERTY_LOCK_MAP: Record<string, { device_id: string; name: string; address: string }> = {
  'garfield': {
    device_id: process.env.TUYA_LOCK_GARFIELD || 'eb066e65fa99294ea78miv',
    name: 'Garfield',
    address: '', // Garfield property, Midland TX
  },
  'castleford': {
    device_id: process.env.TUYA_LOCK_CASTLEFORD || 'eb51f7fbcf98b9d955wqb9',
    name: 'Castleford',
    address: '', // Castleford property, Midland TX
  },
  'lincoln-green': {
    device_id: process.env.TUYA_LOCK_LINCOLN_GREEN || 'eb6d7ec17a24e8948dnhee',
    name: 'Lincoln Green',
    address: '', // Lincoln Green property, Midland TX
  },
};

// ============================================================================
// CLIENT
// ============================================================================

export class TuyaLockClient {
  private accessKey: string;
  private secretKey: string;
  private baseUrl: string;
  private token: string | null = null;
  private tokenExpiry: number = 0;

  constructor(config?: TuyaConfig) {
    this.accessKey = config?.accessKey || process.env.TUYA_ACCESS_KEY || '';
    this.secretKey = config?.secretKey || process.env.TUYA_SECRET_KEY || '';
    this.baseUrl = config?.baseUrl || process.env.TUYA_BASE_URL || 'https://openapi.tuyaus.com';

    if (!this.accessKey || !this.secretKey) {
      throw new Error(
        'Tuya credentials required. Set TUYA_ACCESS_KEY and TUYA_SECRET_KEY env vars.'
      );
    }
  }

  // --------------------------------------------------------------------------
  // Auth — HMAC-SHA256 signature + token management
  // --------------------------------------------------------------------------

  private async getToken(): Promise<string> {
    if (this.token && Date.now() < this.tokenExpiry) {
      return this.token;
    }

    const timestamp = Date.now().toString();
    const nonce = '';
    const method = 'GET';
    const path = '/v1.0/token?grant_type=1';
    const body = '';

    const contentHash = await this.sha256(body);
    const stringToSign = `${method}\n${contentHash}\n\n${path}`;
    const signStr = this.accessKey + timestamp + nonce + stringToSign;
    const sign = await this.hmacSha256(this.secretKey, signStr);

    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'GET',
      headers: {
        'client_id': this.accessKey,
        'sign': sign.toUpperCase(),
        'sign_method': 'HMAC-SHA256',
        't': timestamp,
        'nonce': nonce,
      },
    });

    const data = await response.json();
    if (!data.success) {
      throw new Error(`Tuya token error: ${data.msg || JSON.stringify(data)}`);
    }

    this.token = data.result.access_token;
    this.tokenExpiry = Date.now() + (data.result.expire_time * 1000) - 60000; // 1min buffer
    return this.token!;
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const token = await this.getToken();
    const timestamp = Date.now().toString();
    const nonce = '';
    const bodyStr = body ? JSON.stringify(body) : '';

    const contentHash = await this.sha256(bodyStr);
    const stringToSign = `${method}\n${contentHash}\n\n${path}`;
    const signStr = this.accessKey + token + timestamp + nonce + stringToSign;
    const sign = await this.hmacSha256(this.secretKey, signStr);

    const headers: Record<string, string> = {
      'client_id': this.accessKey,
      'access_token': token,
      'sign': sign.toUpperCase(),
      'sign_method': 'HMAC-SHA256',
      't': timestamp,
      'nonce': nonce,
    };

    if (bodyStr) {
      headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: bodyStr || undefined,
    });

    const data = await response.json();
    if (!data.success) {
      throw new Error(`Tuya API error: ${data.msg || data.code || JSON.stringify(data)}`);
    }

    return data.result as T;
  }

  private async sha256(message: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }

  private async hmacSha256(key: string, message: string): Promise<string> {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(key);
    const msgData = encoder.encode(message);
    const cryptoKey = await crypto.subtle.importKey(
      'raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    );
    const signature = await crypto.subtle.sign('HMAC', cryptoKey, msgData);
    return Array.from(new Uint8Array(signature))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }

  // --------------------------------------------------------------------------
  // Device Management
  // --------------------------------------------------------------------------

  async listDevices(userId?: string): Promise<TuyaDevice[]> {
    if (userId) {
      return this.request<TuyaDevice[]>('GET', `/v1.0/users/${userId}/devices`);
    }
    // List all devices in the cloud project
    return this.request<TuyaDevice[]>('GET', '/v1.0/devices');
  }

  async getDeviceStatus(deviceId: string): Promise<Array<{ code: string; value: unknown }>> {
    return this.request('GET', `/v1.0/devices/${deviceId}/status`);
  }

  async getLockStatus(propertySlug: string): Promise<LockStatus> {
    const lock = PROPERTY_LOCK_MAP[propertySlug];
    if (!lock || !lock.device_id) {
      throw new Error(`No lock mapped for property: ${propertySlug}`);
    }

    const statuses = await this.getDeviceStatus(lock.device_id);
    const statusMap = Object.fromEntries(statuses.map((s) => [s.code, s.value]));

    return {
      device_id: lock.device_id,
      online: true, // If we got a response, it's online
      locked: statusMap['lock_motor_state'] === true,
      door_closed: statusMap['closed_opened'] === 'closed',
      battery_percent: (statusMap['battery_state'] as number) || (statusMap['residual_electricity'] as number) || 0,
    };
  }

  // --------------------------------------------------------------------------
  // Temporary Password Management — THE CORE FEATURE
  // --------------------------------------------------------------------------

  /**
   * Generate a time-limited door code for a guest booking.
   * Code is active from check-in to check-out only.
   */
  async createGuestCode(req: GuestCodeRequest): Promise<GuestCodeResult> {
    const lock = PROPERTY_LOCK_MAP[req.property_slug];
    if (!lock || !lock.device_id) {
      return {
        success: false,
        code: '',
        password_id: 0,
        device_id: '',
        property_slug: req.property_slug,
        guest_name: req.guest_name,
        active_from: '',
        active_until: '',
        error: `No lock configured for property: ${req.property_slug}`,
      };
    }

    // Generate a random 6-digit code or use custom
    const code = req.custom_code || generateSecureCode();

    const effectiveTime = Math.floor(req.check_in.getTime() / 1000);
    const invalidTime = Math.floor(req.check_out.getTime() / 1000);

    const result = await this.request<{ id: number }>('POST',
      `/v1.0/devices/${lock.device_id}/door-lock/temp-password`,
      {
        name: `${req.guest_name}_${req.booking_id}`,
        password: code,
        effective_time: effectiveTime,
        invalid_time: invalidTime,
        type: 0, // Custom password
      }
    );

    return {
      success: true,
      code,
      password_id: result.id,
      device_id: lock.device_id,
      property_slug: req.property_slug,
      guest_name: req.guest_name,
      active_from: req.check_in.toISOString(),
      active_until: req.check_out.toISOString(),
    };
  }

  /**
   * Deactivate a guest code at checkout (or early if needed).
   */
  async deleteGuestCode(propertySlug: string, passwordId: number): Promise<boolean> {
    const lock = PROPERTY_LOCK_MAP[propertySlug];
    if (!lock || !lock.device_id) {
      throw new Error(`No lock configured for property: ${propertySlug}`);
    }

    await this.request('DELETE',
      `/v1.0/devices/${lock.device_id}/door-lock/temp-password/${passwordId}`
    );
    return true;
  }

  /**
   * List all temporary passcodes on a lock.
   */
  async listTempPasswords(propertySlug: string): Promise<TempPassword[]> {
    const lock = PROPERTY_LOCK_MAP[propertySlug];
    if (!lock || !lock.device_id) {
      throw new Error(`No lock configured for property: ${propertySlug}`);
    }

    const result = await this.request<TempPassword[]>('GET',
      `/v1.0/devices/${lock.device_id}/door-lock/temp-passwords`
    );
    return result || [];
  }

  // --------------------------------------------------------------------------
  // Entry Logs
  // --------------------------------------------------------------------------

  async getEntryLogs(propertySlug: string, limit: number = 50): Promise<EntryLogEntry[]> {
    const lock = PROPERTY_LOCK_MAP[propertySlug];
    if (!lock || !lock.device_id) {
      throw new Error(`No lock configured for property: ${propertySlug}`);
    }

    const result = await this.request<{ logs: EntryLogEntry[] }>('GET',
      `/v1.0/devices/${lock.device_id}/door-lock/open-logs?page_no=1&page_size=${limit}`
    );
    return result?.logs || [];
  }

  // --------------------------------------------------------------------------
  // Bulk Operations — For vacation rental automation
  // --------------------------------------------------------------------------

  /**
   * Full check-in automation:
   * 1. Generate guest code with time limits
   * 2. Return code for sending to guest
   */
  async checkInAutomation(req: GuestCodeRequest): Promise<GuestCodeResult> {
    return this.createGuestCode(req);
  }

  /**
   * Full check-out automation:
   * 1. Delete guest code
   * 2. Verify lock is secured
   */
  async checkOutAutomation(
    propertySlug: string,
    passwordId: number
  ): Promise<{ code_deleted: boolean; lock_status: LockStatus | null }> {
    let codeDeleted = false;
    let lockStatus: LockStatus | null = null;

    try {
      codeDeleted = await this.deleteGuestCode(propertySlug, passwordId);
    } catch (e: any) {
      console.error(`[Tuya] Failed to delete code for ${propertySlug}:`, e.message);
    }

    try {
      lockStatus = await this.getLockStatus(propertySlug);
    } catch (e: any) {
      console.error(`[Tuya] Failed to get lock status for ${propertySlug}:`, e.message);
    }

    return { code_deleted: codeDeleted, lock_status: lockStatus };
  }

  /**
   * Get status of all configured locks across all properties.
   */
  async getAllLockStatuses(): Promise<Record<string, LockStatus | { error: string }>> {
    const results: Record<string, LockStatus | { error: string }> = {};

    for (const [slug, lock] of Object.entries(PROPERTY_LOCK_MAP)) {
      if (!lock.device_id) {
        results[slug] = { error: 'No device ID configured' } as any;
        continue;
      }
      try {
        results[slug] = await this.getLockStatus(slug);
      } catch (e: any) {
        results[slug] = { error: e.message } as any;
      }
    }

    return results;
  }

  // --------------------------------------------------------------------------
  // Health Check
  // --------------------------------------------------------------------------

  async healthCheck(): Promise<{ ok: boolean; locks: number; error?: string }> {
    try {
      await this.getToken();
      const configuredLocks = Object.values(PROPERTY_LOCK_MAP).filter((l) => l.device_id).length;
      return { ok: true, locks: configuredLocks };
    } catch (e: any) {
      return { ok: false, locks: 0, error: e.message };
    }
  }
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Generate a secure 6-digit numeric code.
 * Avoids easily guessable patterns (000000, 123456, etc.)
 */
function generateSecureCode(): string {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  const code = (array[0] % 900000 + 100000).toString();

  // Avoid obvious patterns
  const banned = ['000000', '111111', '123456', '654321', '999999', '112233'];
  if (banned.includes(code)) {
    return generateSecureCode();
  }

  return code;
}

// ============================================================================
// SINGLETON
// ============================================================================

let _tuyaClient: TuyaLockClient | null = null;

export function getTuyaLockClient(): TuyaLockClient {
  if (!_tuyaClient) {
    _tuyaClient = new TuyaLockClient();
  }
  return _tuyaClient;
}

// ============================================================================
// EXPORTS
// ============================================================================

export { PROPERTY_LOCK_MAP, generateSecureCode };
