import { NextRequest, NextResponse } from 'next/server';
import { requireOneOfRoles } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';

// Real Thermostat rows (queue #26855). This route held an in-memory array of
// two invented devices, reported them is_online: true with live-looking
// temperature readings, and answered every write with "Thermostat settings
// updated". Nothing was ever sent anywhere.
//
// That is the most physically consequential lie in this codebase: someone
// setting a vacant Midland property to 82F cooling to save money in July would
// have been told it worked. It did not. The house stays at whatever the device
// was already doing.
//
// There is no THERMOSTAT integration to fix this with. The Tuya client in this
// repo (src/lib/integrations/tuya-client.ts) is live and speaks to LOCKS --
// getLocks, setLockState, createGuestCode -- but has no thermostat surface at
// all. Locks can be driven; thermostats cannot.
//
// So this route now does the two honest things available:
//   GET  lists thermostats that are actually registered, and does not claim to
//        know their current temperature or whether they are online.
//   POST records the DESIRED settings and returns 501 with an explicit
//        applied:false, because a write that cannot reach the device must not
//        report success. 501 (permanent) rather than 503 (transient/retry me).

function toContract(t: {
  id: string;
  propertyId: string;
  name: string;
  deviceType: string;
  deviceId: string | null;
  targetTempF: number | null;
  mode: string;
  fanMode: string;
  scheduleEnabled: boolean;
  schedule: string | null;
  lastTempF: number | null;
  lastHumidity: number | null;
  lastSeenAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  let schedule: unknown = null;
  if (t.schedule) {
    try {
      schedule = JSON.parse(t.schedule);
    } catch {
      schedule = null;
    }
  }

  return {
    id: t.id,
    property_id: t.propertyId,
    name: t.name,
    device_type: t.deviceType,
    device_id: t.deviceId,

    // null, not true. We have no way to reach the device, so its online state
    // is unknown -- and "unknown" must not render as "fine".
    is_online: null,
    current_temp_f: null,
    humidity_percent: null,

    // Desired settings as recorded here. See settings_applied_to_device.
    mode: t.mode,
    target_temp_f: t.targetTempF,
    fan_mode: t.fanMode,
    schedule_enabled: t.scheduleEnabled,
    schedule,

    settings_applied_to_device: false,
    device_integration: 'none',

    // Last values genuinely observed, if anything ever observed them.
    last_reading:
      t.lastSeenAt !== null
        ? {
            temp_f: t.lastTempF,
            humidity_percent: t.lastHumidity,
            recorded_at: t.lastSeenAt.toISOString(),
          }
        : null,

    created_at: t.createdAt.toISOString(),
    updated_at: t.updatedAt.toISOString(),
  };
}

const NO_INTEGRATION =
  'No thermostat integration exists. The Tuya client in this deployment ' +
  'supports locks only, so thermostat settings cannot be sent to any device. ' +
  'The requested settings have been recorded but are NOT in effect at the property.';

// ── GET /api/smart-home/thermostats ─────────────────────────────────────────
export async function GET(request: NextRequest) {
  const auth = await requireOneOfRoles(request, ['worker', 'owner', 'admin']);
  if (auth.error) return auth.error;
  try {
    const propertyId = request.nextUrl.searchParams.get('property_id');

    const rows = await prisma.thermostat.findMany({
      where: propertyId ? { propertyId } : {},
      orderBy: [{ propertyId: 'asc' }, { name: 'asc' }],
    });
    const thermostats = rows.map(toContract);

    return NextResponse.json({
      thermostats,
      total: thermostats.length,
      device_integration: 'none',
      note: NO_INTEGRATION,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to list thermostats', detail: error.message },
      { status: 500 },
    );
  }
}

// ── POST /api/smart-home/thermostats ────────────────────────────────────────
export async function POST(request: NextRequest) {
  const auth = await requireOneOfRoles(request, ['worker', 'owner', 'admin']);
  if (auth.error) return auth.error;
  try {
    const body = await request.json();

    if (!body.thermostat_id) {
      return NextResponse.json(
        { error: 'Missing required field: thermostat_id' },
        { status: 400 },
      );
    }

    const thermostat = await prisma.thermostat.findUnique({
      where: { id: body.thermostat_id },
    });
    if (!thermostat) {
      return NextResponse.json({ error: 'Thermostat not found' }, { status: 404 });
    }

    // Validation runs before the write, and is unchanged.
    const data: Record<string, unknown> = {};

    if (body.target_temp_f !== undefined) {
      if (
        typeof body.target_temp_f !== 'number' ||
        body.target_temp_f < 50 ||
        body.target_temp_f > 90
      ) {
        return NextResponse.json(
          { error: 'target_temp_f must be between 50 and 90' },
          { status: 400 },
        );
      }
      data.targetTempF = body.target_temp_f;
    }

    if (body.mode) {
      const validModes = ['heat', 'cool', 'auto', 'off'];
      if (!validModes.includes(body.mode)) {
        return NextResponse.json(
          { error: `Invalid mode. Must be one of: ${validModes.join(', ')}` },
          { status: 400 },
        );
      }
      data.mode = body.mode;
    }

    if (body.fan_mode) {
      const validFanModes = ['auto', 'on', 'circulate'];
      if (!validFanModes.includes(body.fan_mode)) {
        return NextResponse.json(
          { error: `Invalid fan_mode. Must be one of: ${validFanModes.join(', ')}` },
          { status: 400 },
        );
      }
      data.fanMode = body.fan_mode;
    }

    if (body.schedule_enabled !== undefined) {
      data.scheduleEnabled = Boolean(body.schedule_enabled);
    }

    if (body.schedule) {
      let current: Record<string, unknown> = {};
      if (thermostat.schedule) {
        try {
          current = JSON.parse(thermostat.schedule);
        } catch {
          current = {};
        }
      }
      data.schedule = JSON.stringify({ ...current, ...body.schedule });
    }

    const updated = await prisma.thermostat.update({
      where: { id: thermostat.id },
      data,
    });

    // 501, not 200 -- and deliberately not 503. The settings are recorded; the
    // device did not receive them. 200 is what let an operator believe a vacant
    // house had been set back to 82F when it had not. But 503 means "transient,
    // retry me": uptime monitors page on it and generic fetch wrappers throw
    // before anyone reads `applied:false`, losing the "it WAS recorded" nuance.
    // 501 Not Implemented is the truthful code -- permanent, not retryable.
    return NextResponse.json(
      {
        thermostat: toContract(updated),
        applied: false,
        error: 'Settings recorded but NOT applied to the device',
        detail: NO_INTEGRATION,
      },
      { status: 501 },
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to update thermostat', detail: error.message },
      { status: 500 },
    );
  }
}
