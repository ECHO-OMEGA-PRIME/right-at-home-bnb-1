/**
 * Right at Home BnB — Tuya Smart Lock Integration
 * Manages ARPHA D280W locks via Tuya Cloud API.
 *
 * Features:
 *  - Worker permanent codes (unlock any property, logged by name)
 *  - Guest temporary codes (time-bound to booking dates)
 *  - Unlock activity logs with worker identification
 *  - Time-on-site tracking per worker per property
 *
 * ENV:
 *  TUYA_CLIENT_ID     — Tuya Cloud project client ID
 *  TUYA_CLIENT_SECRET — Tuya Cloud project secret
 *  TUYA_BASE_URL      — Region endpoint (default: https://openapi.tuyaus.com)
 *
 * @author ECHO OMEGA PRIME
 */

import crypto from 'crypto';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface TuyaLock {
  device_id: string;
  name: string;
  property_id: string;
  property_name: string;
  online: boolean;
  battery_level?: number;
  locked: boolean;
}

export interface WorkerCode {
  worker_id: string;
  worker_name: string;
  worker_type: 'cleaner' | 'pool' | 'maintenance' | 'yard' | 'owner' | 'admin';
  code: string; // 6-digit PIN
  code_id?: string; // Tuya password ID
  active: boolean;
}

export interface GuestCode {
  booking_id: string;
  guest_name: string;
  code: string;
  code_id?: string;
  starts_at: string; // ISO datetime
  expires_at: string; // ISO datetime
  property_device_id: string;
}

export interface UnlockEvent {
  device_id: string;
  property_name: string;
  timestamp: string;
  unlock_method: 'code' | 'fingerprint' | 'app' | 'key' | 'ekey';
  code_user?: string; // Worker name if identified by PIN
  worker_type?: string;
}

export interface WorkerTimeEntry {
  worker_id: string;
  worker_name: string;
  property_name: string;
  arrived_at: string;
  departed_at: string | null;
  duration_minutes: number | null;
}

// ─── Tuya Auth ───────────────────────────────────────────────────────────────

const TUYA_BASE_URL = process.env.TUYA_BASE_URL || 'https://openapi.tuyaus.com';
const TUYA_CLIENT_ID = process.env.TUYA_CLIENT_ID || process.env.TUYA_ACCESS_ID || '';
const TUYA_CLIENT_SECRET = process.env.TUYA_CLIENT_SECRET || process.env.TUYA_ACCESS_SECRET || '';

let _accessToken: string | null = null;
let _tokenExpiry = 0;

/**
 * Generate HMAC-SHA256 signature for Tuya API requests.
 */
function generateSign(
  clientId: string,
  secret: string,
  timestamp: string,
  accessToken: string,
  nonce: string,
  method: string,
  path: string,
  body: string,
): string {
  const contentHash = crypto.createHash('sha256').update(body || '').digest('hex');
  const stringToSign = [method, contentHash, '', path].join('\n');
  const signStr = clientId + accessToken + timestamp + nonce + stringToSign;
  return crypto.createHmac('sha256', secret).update(signStr).digest('hex').toUpperCase();
}

/**
 * Get an access token from Tuya Cloud (cached).
 */
async function getAccessToken(): Promise<string> {
  if (_accessToken && Date.now() < _tokenExpiry) {
    return _accessToken;
  }

  const timestamp = Date.now().toString();
  const nonce = crypto.randomUUID();
  const path = '/v1.0/token?grant_type=1';
  const sign = generateSign(TUYA_CLIENT_ID, TUYA_CLIENT_SECRET, timestamp, '', nonce, 'GET', path, '');

  const res = await fetch(`${TUYA_BASE_URL}${path}`, {
    method: 'GET',
    headers: {
      'client_id': TUYA_CLIENT_ID,
      'sign': sign,
      'sign_method': 'HMAC-SHA256',
      't': timestamp,
      'nonce': nonce,
    },
  });

  const data = await res.json();
  if (!data.success) {
    throw new Error(`Tuya auth failed: ${data.msg || JSON.stringify(data)}`);
  }

  _accessToken = data.result.access_token;
  _tokenExpiry = Date.now() + (data.result.expire_time * 1000) - 60000; // 60s buffer
  return _accessToken!;
}

/**
 * Make an authenticated Tuya API request.
 */
async function tuyaFetch(method: string, path: string, body?: Record<string, unknown>): Promise<any> {
  const token = await getAccessToken();
  const timestamp = Date.now().toString();
  const nonce = crypto.randomUUID();
  const bodyStr = body ? JSON.stringify(body) : '';
  const sign = generateSign(TUYA_CLIENT_ID, TUYA_CLIENT_SECRET, timestamp, token, nonce, method, path, bodyStr);

  const res = await fetch(`${TUYA_BASE_URL}${path}`, {
    method,
    headers: {
      'client_id': TUYA_CLIENT_ID,
      'access_token': token,
      'sign': sign,
      'sign_method': 'HMAC-SHA256',
      't': timestamp,
      'nonce': nonce,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: bodyStr } : {}),
  });

  const data = await res.json();
  if (!data.success) {
    throw new Error(`Tuya API error: ${data.msg || JSON.stringify(data)}`);
  }
  return data.result;
}

// ─── Lock Management ─────────────────────────────────────────────────────────

/**
 * Get all smart lock devices registered in Tuya.
 */
export async function getLocks(): Promise<any[]> {
  const result = await tuyaFetch('GET', '/v1.0/devices?category=ms');
  return result?.devices || result || [];
}

/**
 * Get lock status (online, battery, locked state).
 */
export async function getLockStatus(deviceId: string): Promise<any> {
  return tuyaFetch('GET', `/v1.0/devices/${deviceId}/status`);
}

/**
 * Lock or unlock a device remotely.
 */
export async function setLockState(deviceId: string, locked: boolean): Promise<any> {
  return tuyaFetch('POST', `/v1.0/devices/${deviceId}/commands`, {
    commands: [{ code: locked ? 'lock' : 'unlock', value: true }],
  });
}

// ─── Password / Code Management ──────────────────────────────────────────────

/**
 * Create a permanent worker code on a specific lock.
 * Workers get the same PIN across all locks.
 */
export async function createWorkerCode(
  deviceId: string,
  workerName: string,
  code: string,
): Promise<any> {
  return tuyaFetch('POST', `/v1.0/devices/${deviceId}/door-lock/temp-password`, {
    name: `Worker: ${workerName}`,
    password: code,
    password_type: 'ticket', // permanent until deleted
    effective_time: Math.floor(Date.now() / 1000),
    invalid_time: Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60), // 1 year
    type: 0, // 0 = custom password
  });
}

/**
 * Program a worker's code to ALL locks in the system.
 */
export async function programWorkerCodeToAllLocks(
  lockDeviceIds: string[],
  workerName: string,
  code: string,
): Promise<{ success: string[]; failed: string[] }> {
  const success: string[] = [];
  const failed: string[] = [];

  for (const deviceId of lockDeviceIds) {
    try {
      await createWorkerCode(deviceId, workerName, code);
      success.push(deviceId);
    } catch {
      failed.push(deviceId);
    }
  }

  return { success, failed };
}

/**
 * Create a time-bound guest code for a specific lock.
 */
export async function createGuestCode(
  deviceId: string,
  guestName: string,
  code: string,
  startsAt: Date,
  expiresAt: Date,
): Promise<any> {
  return tuyaFetch('POST', `/v1.0/devices/${deviceId}/door-lock/temp-password`, {
    name: `Guest: ${guestName}`,
    password: code,
    password_type: 'ticket',
    effective_time: Math.floor(startsAt.getTime() / 1000),
    invalid_time: Math.floor(expiresAt.getTime() / 1000),
    type: 0,
  });
}

/**
 * Delete a code from a lock.
 */
export async function deleteCode(deviceId: string, passwordId: string): Promise<any> {
  return tuyaFetch('DELETE', `/v1.0/devices/${deviceId}/door-lock/temp-password/${passwordId}`);
}

/**
 * List all codes on a lock.
 */
export async function listCodes(deviceId: string): Promise<any[]> {
  const result = await tuyaFetch('GET', `/v1.0/devices/${deviceId}/door-lock/temp-passwords`);
  return result || [];
}

// ─── Activity Logs ───────────────────────────────────────────────────────────

/**
 * Get unlock history for a device.
 */
export async function getUnlockHistory(
  deviceId: string,
  startTime?: Date,
  endTime?: Date,
): Promise<any[]> {
  const start = startTime ? Math.floor(startTime.getTime() / 1000) : Math.floor((Date.now() - 7 * 86400000) / 1000);
  const end = endTime ? Math.floor(endTime.getTime() / 1000) : Math.floor(Date.now() / 1000);
  const result = await tuyaFetch(
    'GET',
    `/v1.0/devices/${deviceId}/door-lock/open-logs?start_time=${start}&end_time=${end}&page_no=1&page_size=100`,
  );
  return result?.records || result || [];
}

// ─── Worker Time Tracking ────────────────────────────────────────────────────

/**
 * Known worker codes — maps PIN to worker identity.
 * In production, this lives in the database. Hardcoded here as default.
 */
const WORKER_CODE_REGISTRY: Record<string, WorkerCode> = {};

/**
 * Register a worker code in the local registry.
 */
export function registerWorkerCode(code: string, worker: WorkerCode): void {
  WORKER_CODE_REGISTRY[code] = worker;
}

/**
 * Identify a worker from their unlock PIN.
 */
export function identifyWorkerByCode(code: string): WorkerCode | null {
  return WORKER_CODE_REGISTRY[code] || null;
}

/**
 * Process unlock logs and compute worker time-on-site.
 * Groups sequential unlock events by worker to estimate arrival/departure.
 */
export function computeWorkerTimeOnSite(
  events: UnlockEvent[],
  workerCodes: WorkerCode[],
): WorkerTimeEntry[] {
  // Build code → worker lookup
  const codeLookup = new Map<string, WorkerCode>();
  for (const wc of workerCodes) {
    codeLookup.set(wc.code, wc);
  }

  // Sort events by timestamp
  const sorted = [...events]
    .filter(e => e.code_user)
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  // Track open sessions: worker_id+device_id → entry time
  const openSessions = new Map<string, { arrived: string; property: string }>();
  const entries: WorkerTimeEntry[] = [];

  for (const event of sorted) {
    if (!event.code_user) continue;

    const worker = workerCodes.find(w => w.worker_name === event.code_user);
    if (!worker) continue;

    const sessionKey = `${worker.worker_id}`;
    const existingSession = openSessions.get(sessionKey);

    if (existingSession && existingSession.property !== event.property_name) {
      // Worker moved to a different property — close previous session
      const arrived = new Date(existingSession.arrived);
      const departed = new Date(event.timestamp);
      const duration = Math.round((departed.getTime() - arrived.getTime()) / 60000);

      entries.push({
        worker_id: worker.worker_id,
        worker_name: worker.worker_name,
        property_name: existingSession.property,
        arrived_at: existingSession.arrived,
        departed_at: event.timestamp,
        duration_minutes: duration,
      });
    }

    // Open new session at current property
    openSessions.set(sessionKey, {
      arrived: event.timestamp,
      property: event.property_name,
    });
  }

  // Close any remaining open sessions (still on-site)
  for (const [key, session] of openSessions) {
    const workerId = key;
    const worker = workerCodes.find(w => w.worker_id === workerId);
    if (!worker) continue;

    const arrived = new Date(session.arrived);
    const now = new Date();
    const duration = Math.round((now.getTime() - arrived.getTime()) / 60000);

    entries.push({
      worker_id: worker.worker_id,
      worker_name: worker.worker_name,
      property_name: session.property,
      arrived_at: session.arrived,
      departed_at: null, // Still on-site
      duration_minutes: duration,
    });
  }

  return entries.sort((a, b) => new Date(b.arrived_at).getTime() - new Date(a.arrived_at).getTime());
}

// ─── Utilities ───────────────────────────────────────────────────────────────

/**
 * Generate a random 6-digit PIN that avoids simple patterns.
 */
export function generateSecurePin(): string {
  let pin: string;
  do {
    pin = Math.floor(100000 + Math.random() * 900000).toString();
  } while (
    /(.)\1{3,}/.test(pin) || // No 4+ repeated digits
    pin === '123456' ||
    pin === '654321' ||
    pin === '111111' ||
    pin === '000000'
  );
  return pin;
}

/**
 * Check if Tuya credentials are configured.
 */
export function isTuyaConfigured(): boolean {
  return !!(TUYA_CLIENT_ID && TUYA_CLIENT_SECRET);
}
