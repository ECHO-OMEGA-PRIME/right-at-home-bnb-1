/**
 * Right at Home BnB — Smart Lock API
 * Manages ARPHA D280W locks via Tuya Cloud API.
 * Falls back to in-memory mock data when Tuya is not configured.
 *
 * @author ECHO OMEGA PRIME
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  isTuyaConfigured,
  getLocks as tuyaGetLocks,
  getLockStatus,
  setLockState,
  createWorkerCode,
  createGuestCode,
  deleteCode,
  listCodes,
  getUnlockHistory,
  programWorkerCodeToAllLocks,
  generateSecurePin,
} from '@/lib/integrations/tuya-client';

// ─── Worker Registry (all workers + their permanent codes) ───────────────────
// In production, this would be in the database. Seeded with real team.

export interface WorkerEntry {
  id: string;
  name: string;
  type: 'cleaner' | 'pool' | 'maintenance' | 'yard' | 'owner' | 'admin';
  email: string;
  code: string;
}

const WORKER_REGISTRY: WorkerEntry[] = [
  { id: 'W-STEVEN', name: 'Steven Palma', type: 'owner', email: 'steven@rah-midland.com', code: '830522' },
  { id: 'W-BREE', name: 'Bree Belleville', type: 'cleaner', email: 'bree@rah-midland.com', code: '247391' },
  { id: 'W-BOBBY', name: 'Bobby McWilliams', type: 'admin', email: 'bobby@rah-midland.com', code: '197463' },
  { id: 'W-LISA', name: 'Lisa Hernandez', type: 'pool', email: 'lisa@rah-midland.com', code: '518642' },
  { id: 'W-CARLOS', name: 'Carlos Gutierrez', type: 'maintenance', email: 'carlos@rah-midland.com', code: '673815' },
  { id: 'W-JUAN', name: 'Juan Martinez', type: 'yard', email: 'juan@rah-midland.com', code: '904276' },
];

// Map code → worker for identification
const CODE_TO_WORKER = new Map(WORKER_REGISTRY.map(w => [w.code, w]));

// ─── Mock Lock Data (used when Tuya not configured) ──────────────────────────

const mockLocks: any[] = [
  { id: 'LOCK-001', property_id: 'PROP-001', property_name: 'The Oasis', name: 'Front Door', device_type: 'arpha_d280w', status: 'locked', battery_percent: 92, is_online: true, codes: [...WORKER_REGISTRY.map(w => ({ code: w.code, label: `${w.type === 'owner' ? 'Owner' : w.type.charAt(0).toUpperCase() + w.type.slice(1)} — ${w.name}`, permanent: true, active: true })), { code: '5519', label: 'Guest — Johnson Family', valid_from: '2026-03-20T15:00:00Z', valid_until: '2026-03-23T11:00:00Z', permanent: false, active: true }], last_activity: { action: 'locked', by: 'auto-lock', at: '2026-03-18T08:00:00Z' }, auto_lock_minutes: 5 },
  { id: 'LOCK-002', property_id: 'PROP-002', property_name: 'Desert Rose', name: 'Front Door', device_type: 'arpha_d280w', status: 'locked', battery_percent: 85, is_online: true, codes: WORKER_REGISTRY.map(w => ({ code: w.code, label: `${w.type === 'owner' ? 'Owner' : w.type.charAt(0).toUpperCase() + w.type.slice(1)} — ${w.name}`, permanent: true, active: true })), last_activity: { action: 'unlocked', by: `code-${WORKER_REGISTRY[1].code}`, by_name: 'Bree Belleville', at: '2026-03-18T09:02:00Z' }, auto_lock_minutes: 5 },
  { id: 'LOCK-003', property_id: 'PROP-003', property_name: 'Sunset Villa', name: 'Front Door', device_type: 'arpha_d280w', status: 'locked', battery_percent: 71, is_online: true, codes: WORKER_REGISTRY.map(w => ({ code: w.code, label: `${w.type === 'owner' ? 'Owner' : w.type.charAt(0).toUpperCase() + w.type.slice(1)} — ${w.name}`, permanent: true, active: true })), last_activity: { action: 'locked', by: 'auto-lock', at: '2026-03-17T22:00:00Z' }, auto_lock_minutes: 5 },
  { id: 'LOCK-004', property_id: 'PROP-004', property_name: 'Patio Home — Garfield', name: 'Front Door', device_type: 'arpha_d280w', status: 'unlocked', battery_percent: 48, is_online: true, codes: WORKER_REGISTRY.map(w => ({ code: w.code, label: `${w.type === 'owner' ? 'Owner' : w.type.charAt(0).toUpperCase() + w.type.slice(1)} — ${w.name}`, permanent: true, active: true })), last_activity: { action: 'unlocked', by: `code-${WORKER_REGISTRY[3].code}`, by_name: 'Carlos Gutierrez', at: '2026-03-18T10:15:00Z' }, auto_lock_minutes: 5 },
];

// ─── Mock Activity Log ───────────────────────────────────────────────────────

const mockActivityLog = [
  { id: 'EVT-001', lock_id: 'LOCK-002', property_name: 'Desert Rose', action: 'unlocked', method: 'code', code_used: '247391', worker_name: 'Bree Belleville', worker_type: 'cleaner', timestamp: '2026-03-18T09:02:00Z' },
  { id: 'EVT-002', lock_id: 'LOCK-002', property_name: 'Desert Rose', action: 'locked', method: 'auto-lock', code_used: null, worker_name: null, worker_type: null, timestamp: '2026-03-18T09:02:30Z' },
  { id: 'EVT-003', lock_id: 'LOCK-001', property_name: 'The Oasis', action: 'unlocked', method: 'code', code_used: '247391', worker_name: 'Bree Belleville', worker_type: 'cleaner', timestamp: '2026-03-18T10:15:00Z' },
  { id: 'EVT-004', lock_id: 'LOCK-004', property_name: 'Patio Home — Garfield', action: 'unlocked', method: 'code', code_used: '673815', worker_name: 'Carlos Gutierrez', worker_type: 'maintenance', timestamp: '2026-03-18T10:15:00Z' },
  { id: 'EVT-005', lock_id: 'LOCK-003', property_name: 'Sunset Villa', action: 'unlocked', method: 'code', code_used: '518642', worker_name: 'Lisa Hernandez', worker_type: 'pool', timestamp: '2026-03-18T08:30:00Z' },
  { id: 'EVT-006', lock_id: 'LOCK-003', property_name: 'Sunset Villa', action: 'locked', method: 'auto-lock', code_used: null, worker_name: null, worker_type: null, timestamp: '2026-03-18T08:30:30Z' },
  { id: 'EVT-007', lock_id: 'LOCK-001', property_name: 'The Oasis', action: 'unlocked', method: 'code', code_used: '518642', worker_name: 'Lisa Hernandez', worker_type: 'pool', timestamp: '2026-03-18T09:45:00Z' },
  { id: 'EVT-008', lock_id: 'LOCK-001', property_name: 'The Oasis', action: 'locked', method: 'auto-lock', code_used: null, worker_name: null, worker_type: null, timestamp: '2026-03-18T09:45:30Z' },
];

// ─── GET /api/smart-home/locks ───────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const propertyId = params.get('property_id');
    const view = params.get('view'); // 'activity' | 'workers' | 'time-tracking'

    // Activity log view
    if (view === 'activity') {
      if (isTuyaConfigured()) {
        // Pull from Tuya
        const deviceId = params.get('device_id');
        if (deviceId) {
          const logs = await getUnlockHistory(deviceId);
          // Enrich with worker names
          const enriched = logs.map((log: any) => {
            const worker = CODE_TO_WORKER.get(log.password);
            return {
              ...log,
              worker_name: worker?.name || null,
              worker_type: worker?.type || null,
            };
          });
          return NextResponse.json({ activity: enriched });
        }
      }
      // Mock activity
      const lockId = params.get('lock_id');
      let activity = [...mockActivityLog];
      if (lockId) activity = activity.filter(a => a.lock_id === lockId);
      return NextResponse.json({ activity, total: activity.length });
    }

    // Worker codes view
    if (view === 'workers') {
      return NextResponse.json({
        workers: WORKER_REGISTRY.map(w => ({
          id: w.id,
          name: w.name,
          type: w.type,
          email: w.email,
          code: w.code,
          active: true,
          lock_count: mockLocks.length,
        })),
      });
    }

    // Time tracking view
    if (view === 'time-tracking') {
      const date = params.get('date') || new Date().toISOString().split('T')[0];
      // Compute from activity log
      const dayEvents = mockActivityLog
        .filter(e => e.timestamp.startsWith(date) && e.worker_name)
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

      // Group by worker
      const workerSessions: Record<string, { worker_name: string; worker_type: string; entries: { property: string; arrived: string; departed: string | null; minutes: number | null }[] }> = {};

      for (const event of dayEvents) {
        if (!event.worker_name || event.action !== 'unlocked') continue;
        if (!workerSessions[event.worker_name]) {
          workerSessions[event.worker_name] = { worker_name: event.worker_name, worker_type: event.worker_type!, entries: [] };
        }
        // Close previous entry for this worker if at a different property
        const prev = workerSessions[event.worker_name].entries;
        if (prev.length > 0 && !prev[prev.length - 1].departed) {
          const lastEntry = prev[prev.length - 1];
          lastEntry.departed = event.timestamp;
          lastEntry.minutes = Math.round((new Date(event.timestamp).getTime() - new Date(lastEntry.arrived).getTime()) / 60000);
        }
        // Open new entry
        prev.push({
          property: event.property_name,
          arrived: event.timestamp,
          departed: null,
          minutes: null,
        });
      }

      return NextResponse.json({ date, sessions: Object.values(workerSessions) });
    }

    // Default: list locks
    if (isTuyaConfigured()) {
      const tuyaLocks = await tuyaGetLocks();
      return NextResponse.json({ locks: tuyaLocks, total: tuyaLocks.length, source: 'tuya' });
    }

    // Mock fallback
    let filtered = [...mockLocks];
    if (propertyId) filtered = filtered.filter(l => l.property_id === propertyId);

    const lowBattery = filtered.filter(l => l.battery_percent < 20);
    const offline = filtered.filter(l => !l.is_online);

    return NextResponse.json({
      locks: filtered,
      total: filtered.length,
      source: 'mock',
      workers: WORKER_REGISTRY.map(w => ({ id: w.id, name: w.name, type: w.type, code: w.code })),
      alerts: {
        low_battery: lowBattery.map(l => ({ id: l.id, name: l.name, property_name: l.property_name, battery_percent: l.battery_percent })),
        offline: offline.map(l => ({ id: l.id, name: l.name, property_name: l.property_name })),
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to list locks', detail: error.message }, { status: 500 });
  }
}

// ─── POST /api/smart-home/locks ──────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      // Lock/unlock a specific device
      case 'lock':
      case 'unlock': {
        const { lock_id, device_id } = body;
        if (isTuyaConfigured() && device_id) {
          await setLockState(device_id, action === 'lock');
          return NextResponse.json({ success: true, action, device_id });
        }
        // Mock
        const lock = mockLocks.find(l => l.id === lock_id);
        if (!lock) return NextResponse.json({ error: 'Lock not found' }, { status: 404 });
        lock.status = action === 'lock' ? 'locked' : 'unlocked';
        lock.last_activity = { action, by: 'api', at: new Date().toISOString() };
        return NextResponse.json({ success: true, lock });
      }

      // Generate a guest code for a booking
      case 'generate_guest_code': {
        const { device_id, lock_id, guest_name, starts_at, expires_at } = body;
        const code = generateSecurePin();
        if (isTuyaConfigured() && device_id) {
          const result = await createGuestCode(device_id, guest_name, code, new Date(starts_at), new Date(expires_at));
          return NextResponse.json({ success: true, code, code_id: result?.id, guest_name, starts_at, expires_at });
        }
        // Mock
        const mockLock = mockLocks.find(l => l.id === lock_id);
        if (mockLock) {
          mockLock.codes.push({ code, label: `Guest — ${guest_name}`, valid_from: starts_at, valid_until: expires_at, permanent: false, active: true });
        }
        return NextResponse.json({ success: true, code, guest_name, starts_at, expires_at });
      }

      // Program a worker code to all locks
      case 'program_worker': {
        const { worker_id } = body;
        const worker = WORKER_REGISTRY.find(w => w.id === worker_id);
        if (!worker) return NextResponse.json({ error: 'Worker not found' }, { status: 404 });

        if (isTuyaConfigured()) {
          const deviceIds = mockLocks.map(l => l.id); // In prod, fetch from Tuya
          const result = await programWorkerCodeToAllLocks(deviceIds, worker.name, worker.code);
          return NextResponse.json({ success: true, worker: worker.name, code: worker.code, ...result });
        }
        return NextResponse.json({ success: true, worker: worker.name, code: worker.code, message: 'Worker code registered (mock mode)' });
      }

      // Add a new worker
      case 'add_worker': {
        const { name, type, email } = body;
        if (!name || !type) return NextResponse.json({ error: 'name and type required' }, { status: 400 });
        const code = generateSecurePin();
        const id = `W-${name.split(' ')[0].toUpperCase()}`;
        const newWorker: WorkerEntry = { id, name, type, email: email || '', code };
        WORKER_REGISTRY.push(newWorker);
        CODE_TO_WORKER.set(code, newWorker);
        return NextResponse.json({ success: true, worker: newWorker });
      }

      // Revoke a code from a lock
      case 'revoke_code': {
        const { device_id, lock_id, code, password_id } = body;
        if (isTuyaConfigured() && device_id && password_id) {
          await deleteCode(device_id, password_id);
          return NextResponse.json({ success: true, message: 'Code revoked' });
        }
        // Mock
        const mLock = mockLocks.find(l => l.id === lock_id);
        if (mLock) {
          const ci = mLock.codes.findIndex((c: any) => c.code === code);
          if (ci !== -1) mLock.codes[ci].active = false;
        }
        return NextResponse.json({ success: true, message: 'Code revoked (mock)' });
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (error: any) {
    return NextResponse.json({ error: 'Lock action failed', detail: error.message }, { status: 500 });
  }
}
