import { NextRequest, NextResponse } from 'next/server';

// ── In-memory locks store ───────────────────────────────────────────────────
const locks: any[] = [
  {
    id: 'LOCK-001',
    property_id: 'PROP-001',
    name: 'Front Door',
    device_type: 'schlage_encode_plus',
    status: 'locked',
    battery_percent: 78,
    is_online: true,
    current_code: '8432',
    codes: [
      { code: '8432', label: 'Guest BK-001', valid_from: '2026-03-20T15:00:00Z', valid_until: '2026-03-23T11:00:00Z', active: true },
      { code: '1234', label: 'Master - Owner', valid_from: null, valid_until: null, active: true },
      { code: '5678', label: 'Cleaner - Maria', valid_from: null, valid_until: null, active: true },
    ],
    last_activity: { action: 'locked', by: 'auto-lock', at: '2026-03-17T22:00:00Z' },
    auto_lock_minutes: 5,
    created_at: '2025-06-01T00:00:00Z',
    updated_at: '2026-03-17T22:00:00Z',
  },
  {
    id: 'LOCK-002',
    property_id: 'PROP-001',
    name: 'Back Door',
    device_type: 'schlage_encode_plus',
    status: 'locked',
    battery_percent: 65,
    is_online: true,
    current_code: null,
    codes: [
      { code: '1234', label: 'Master - Owner', valid_from: null, valid_until: null, active: true },
    ],
    last_activity: { action: 'locked', by: 'manual', at: '2026-03-16T18:00:00Z' },
    auto_lock_minutes: 5,
    created_at: '2025-06-01T00:00:00Z',
    updated_at: '2026-03-16T18:00:00Z',
  },
  {
    id: 'LOCK-003',
    property_id: 'PROP-002',
    name: 'Front Door',
    device_type: 'august_wifi_smart_lock',
    status: 'unlocked',
    battery_percent: 42,
    is_online: true,
    current_code: null,
    codes: [
      { code: '1234', label: 'Master - Owner', valid_from: null, valid_until: null, active: true },
      { code: '9999', label: 'Maintenance - James', valid_from: null, valid_until: null, active: true },
    ],
    last_activity: { action: 'unlocked', by: 'code-9999', at: '2026-03-18T09:00:00Z' },
    auto_lock_minutes: 10,
    created_at: '2025-08-15T00:00:00Z',
    updated_at: '2026-03-18T09:00:00Z',
  },
];

function generateCode(): string {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

// ── GET /api/smart-home/locks ───────────────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const propertyId = params.get('property_id');

    let filtered = [...locks];
    if (propertyId) {
      filtered = filtered.filter((l) => l.property_id === propertyId);
    }

    const lowBattery = locks.filter((l) => l.battery_percent < 20);
    const offline = locks.filter((l) => !l.is_online);

    return NextResponse.json({
      locks: filtered,
      total: filtered.length,
      alerts: {
        low_battery: lowBattery.map((l) => ({ id: l.id, name: l.name, property_id: l.property_id, battery_percent: l.battery_percent })),
        offline: offline.map((l) => ({ id: l.id, name: l.name, property_id: l.property_id })),
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to list locks', detail: error.message },
      { status: 500 },
    );
  }
}

// ── POST /api/smart-home/locks ──────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.lock_id || !body.action) {
      return NextResponse.json(
        { error: 'Missing required fields: lock_id, action' },
        { status: 400 },
      );
    }

    const lock = locks.find((l) => l.id === body.lock_id);
    if (!lock) {
      return NextResponse.json({ error: 'Lock not found' }, { status: 404 });
    }

    if (!lock.is_online) {
      return NextResponse.json({ error: 'Lock is offline' }, { status: 503 });
    }

    const now = new Date().toISOString();
    let result: any = {};

    switch (body.action) {
      case 'lock':
        lock.status = 'locked';
        lock.last_activity = { action: 'locked', by: body.by ?? 'api', at: now };
        lock.updated_at = now;
        result = { message: 'Lock engaged', status: 'locked' };
        break;

      case 'unlock':
        lock.status = 'unlocked';
        lock.last_activity = { action: 'unlocked', by: body.by ?? 'api', at: now };
        lock.updated_at = now;
        result = { message: 'Lock disengaged', status: 'unlocked' };
        break;

      case 'generate_code': {
        const code = generateCode();
        const newCode = {
          code,
          label: body.label ?? 'Generated Code',
          valid_from: body.valid_from ?? null,
          valid_until: body.valid_until ?? null,
          active: true,
        };
        lock.codes.push(newCode);
        lock.updated_at = now;
        result = { message: 'Code generated', code: newCode };
        break;
      }

      case 'revoke_code': {
        if (!body.code) {
          return NextResponse.json({ error: 'code is required for revoke_code action' }, { status: 400 });
        }
        const codeIdx = lock.codes.findIndex((c: any) => c.code === body.code);
        if (codeIdx === -1) {
          return NextResponse.json({ error: 'Code not found on this lock' }, { status: 404 });
        }
        lock.codes[codeIdx].active = false;
        lock.updated_at = now;
        result = { message: 'Code revoked', code: lock.codes[codeIdx] };
        break;
      }

      default:
        return NextResponse.json(
          { error: 'Invalid action. Must be one of: lock, unlock, generate_code, revoke_code' },
          { status: 400 },
        );
    }

    return NextResponse.json({ lock, result });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to perform lock action', detail: error.message },
      { status: 500 },
    );
  }
}
