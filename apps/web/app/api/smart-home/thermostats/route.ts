import { NextRequest, NextResponse } from 'next/server';

// ── In-memory thermostat store ──────────────────────────────────────────────
const thermostats: any[] = [
  {
    id: 'THERM-001',
    property_id: 'PROP-001',
    name: 'Main Thermostat',
    device_type: 'ecobee_smart_thermostat',
    is_online: true,
    mode: 'cool',
    target_temp_f: 72,
    current_temp_f: 73,
    humidity_percent: 45,
    fan_mode: 'auto',
    schedule_enabled: true,
    schedule: {
      occupied: { heat_to: 70, cool_to: 74 },
      unoccupied: { heat_to: 60, cool_to: 82 },
    },
    readings: [
      { temp_f: 73, humidity_percent: 45, recorded_at: '2026-03-17T22:00:00Z' },
      { temp_f: 74, humidity_percent: 44, recorded_at: '2026-03-17T21:00:00Z' },
      { temp_f: 75, humidity_percent: 43, recorded_at: '2026-03-17T20:00:00Z' },
      { temp_f: 76, humidity_percent: 42, recorded_at: '2026-03-17T19:00:00Z' },
    ],
    created_at: '2025-06-01T00:00:00Z',
    updated_at: '2026-03-17T22:00:00Z',
  },
  {
    id: 'THERM-002',
    property_id: 'PROP-002',
    name: 'Main Thermostat',
    device_type: 'nest_learning_thermostat',
    is_online: true,
    mode: 'heat',
    target_temp_f: 68,
    current_temp_f: 67,
    humidity_percent: 38,
    fan_mode: 'auto',
    schedule_enabled: true,
    schedule: {
      occupied: { heat_to: 70, cool_to: 74 },
      unoccupied: { heat_to: 55, cool_to: 85 },
    },
    readings: [
      { temp_f: 67, humidity_percent: 38, recorded_at: '2026-03-17T22:00:00Z' },
      { temp_f: 66, humidity_percent: 39, recorded_at: '2026-03-17T21:00:00Z' },
      { temp_f: 65, humidity_percent: 40, recorded_at: '2026-03-17T20:00:00Z' },
    ],
    created_at: '2025-08-15T00:00:00Z',
    updated_at: '2026-03-17T22:00:00Z',
  },
];

// ── GET /api/smart-home/thermostats ─────────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const propertyId = params.get('property_id');

    let filtered = [...thermostats];
    if (propertyId) {
      filtered = filtered.filter((t) => t.property_id === propertyId);
    }

    return NextResponse.json({
      thermostats: filtered,
      total: filtered.length,
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
  try {
    const body = await request.json();

    if (!body.thermostat_id) {
      return NextResponse.json(
        { error: 'Missing required field: thermostat_id' },
        { status: 400 },
      );
    }

    const thermostat = thermostats.find((t) => t.id === body.thermostat_id);
    if (!thermostat) {
      return NextResponse.json({ error: 'Thermostat not found' }, { status: 404 });
    }

    if (!thermostat.is_online) {
      return NextResponse.json({ error: 'Thermostat is offline' }, { status: 503 });
    }

    const now = new Date().toISOString();

    // Set target temperature
    if (body.target_temp_f !== undefined) {
      if (typeof body.target_temp_f !== 'number' || body.target_temp_f < 50 || body.target_temp_f > 90) {
        return NextResponse.json(
          { error: 'target_temp_f must be between 50 and 90' },
          { status: 400 },
        );
      }
      thermostat.target_temp_f = body.target_temp_f;
    }

    // Set mode
    if (body.mode) {
      const validModes = ['heat', 'cool', 'auto', 'off'];
      if (!validModes.includes(body.mode)) {
        return NextResponse.json(
          { error: `Invalid mode. Must be one of: ${validModes.join(', ')}` },
          { status: 400 },
        );
      }
      thermostat.mode = body.mode;
    }

    // Set fan mode
    if (body.fan_mode) {
      const validFanModes = ['auto', 'on', 'circulate'];
      if (!validFanModes.includes(body.fan_mode)) {
        return NextResponse.json(
          { error: `Invalid fan_mode. Must be one of: ${validFanModes.join(', ')}` },
          { status: 400 },
        );
      }
      thermostat.fan_mode = body.fan_mode;
    }

    // Toggle schedule
    if (body.schedule_enabled !== undefined) {
      thermostat.schedule_enabled = Boolean(body.schedule_enabled);
    }

    // Update schedule
    if (body.schedule) {
      thermostat.schedule = { ...thermostat.schedule, ...body.schedule };
    }

    thermostat.updated_at = now;

    return NextResponse.json({
      thermostat,
      message: 'Thermostat settings updated',
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to update thermostat', detail: error.message },
      { status: 500 },
    );
  }
}
