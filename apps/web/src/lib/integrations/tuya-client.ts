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
 * ENV (edge → FORGE proxy; Tuya secret is NOT on the edge anymore):
 *  RAH_API_BASE  — echo-rah-api base (default: https://rah-api.echo-op.com)
 *  RAH_API_TOKEN — edge service token; sent as `Bearer owner:<token>`
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

// ─── RAH API proxy (edge → FORGE echo-rah-api) ───────────────────────────────
// SECURITY: the Tuya Access Secret NO LONGER lives on the Vercel edge. Every
// Tuya call is proxied through echo-rah-api on FORGE (single egress
// 107.219.15.225), which holds the Tuya creds server-side and is the only IP
// allowlisted at Tuya. This is the rah-midland "Exposed RAH provider credentials
// require rotation" remediation (Tuya portion): a leaked Tuya secret is now
// useless from any other origin. Rotate RAH_API_TOKEN (not the Tuya secret) if
// this edge token ever leaks — echo-rah-api tokens are freely rotatable.

const RAH_API_BASE = process.env.RAH_API_BASE || 'https://rah-api.echo-op.com';
const RAH_API_TOKEN = process.env.RAH_API_TOKEN || '';

/**
 * Call an echo-rah-api lock endpoint on FORGE with the edge service token.
 * Throws on transport error, non-2xx, or an {ok:false} body.
 */
async function rahFetch(method: string, path: string, body?: Record<string, unknown>): Promise<any> {
  if (!RAH_API_TOKEN) {
    throw new Error('RAH_API_TOKEN not configured — edge→FORGE lock proxy unavailable');
  }
  const res = await fetch(`${RAH_API_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer owner:${RAH_API_TOKEN}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    cache: 'no-store',
  });
  const text = await res.text();
  let data: any = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  if (!res.ok || data?.ok === false) {
    const detail = data?.detail ?? data?.error ?? res.statusText;
    throw new Error(
      `RAH lock API ${method} ${path} -> ${res.status}: ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`,
    );
  }
  return data;
}

// ─── Lock Management ─────────────────────────────────────────────────────────

/**
 * Get all smart lock devices registered in Tuya.
 */
export async function getLocks(): Promise<any[]> {
  const data = await rahFetch('GET', '/locks');
  return data?.locks || [];
}

/**
 * Get lock status (online, battery, locked state).
 */
export async function getLockStatus(deviceId: string): Promise<any> {
  const data = await rahFetch('GET', `/locks/status?lock=${encodeURIComponent(deviceId)}`);
  return data?.status ?? data?.device ?? data;
}

/**
 * Lock or unlock a device remotely.
 */
export async function setLockState(deviceId: string, locked: boolean): Promise<any> {
  return rahFetch('POST', '/locks/state', { lock: deviceId, locked });
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
  const now = new Date();
  const oneYear = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
  return rahFetch('POST', '/locks/set-code', {
    property_or_lock: deviceId,
    code,
    guest_name: `Worker: ${workerName}`,
    valid_from: now.toISOString(),
    valid_to: oneYear.toISOString(),
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
  return rahFetch('POST', '/locks/set-code', {
    property_or_lock: deviceId,
    code,
    guest_name: `Guest: ${guestName}`,
    valid_from: startsAt.toISOString(),
    valid_to: expiresAt.toISOString(),
  });
}

/**
 * Delete a code from a lock.
 */
export async function deleteCode(deviceId: string, passwordId: string): Promise<any> {
  return rahFetch('POST', '/locks/clear-code', { lock: deviceId, password_id: passwordId });
}

/**
 * List all codes on a lock.
 */
export async function listCodes(deviceId: string): Promise<any[]> {
  const data = await rahFetch('GET', `/locks/codes?lock=${encodeURIComponent(deviceId)}`);
  return data?.codes || [];
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
  const start = startTime ? startTime.getTime() : Date.now() - 7 * 86400000;
  const end = endTime ? endTime.getTime() : Date.now();
  const data = await rahFetch(
    'GET',
    `/locks/history?lock=${encodeURIComponent(deviceId)}&start=${start}&end=${end}`,
  );
  return data?.records || [];
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
    pin = crypto.randomInt(100000, 1000000).toString();
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
 * Check if the lock backend is reachable — now the FORGE edge→backend token,
 * not the (removed) Tuya secret. Callers gate lock ops on this.
 */
export function isTuyaConfigured(): boolean {
  return !!RAH_API_TOKEN;
}
