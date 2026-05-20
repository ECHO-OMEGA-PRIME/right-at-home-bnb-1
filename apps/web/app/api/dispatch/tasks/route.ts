import { NextRequest, NextResponse } from 'next/server';

// ── In-memory dispatch store ────────────────────────────────────────────────
const tasks: any[] = [
  {
    id: 'DSP-001',
    property_id: 'PROP-001',
    booking_id: 'BK-001',
    type: 'cleaning',
    status: 'pending',
    priority: 'high',
    title: 'Post-checkout deep clean',
    description: 'Full deep clean after guest checkout. Laundry, kitchen, bathrooms, floors.',
    assigned_to: 'EMP-001',
    assigned_name: 'Maria Garcia',
    scheduled_date: '2026-03-23',
    scheduled_time: '11:00',
    estimated_duration_min: 120,
    actual_duration_min: null,
    checklist: [
      { item: 'Strip beds and start laundry', completed: false },
      { item: 'Clean all bathrooms', completed: false },
      { item: 'Kitchen deep clean', completed: false },
      { item: 'Vacuum and mop all floors', completed: false },
      { item: 'Restock supplies', completed: false },
    ],
    notes: '',
    created_at: '2026-03-20T10:00:00Z',
    updated_at: '2026-03-20T10:00:00Z',
  },
  {
    id: 'DSP-002',
    property_id: 'PROP-002',
    booking_id: null,
    type: 'maintenance',
    status: 'in_progress',
    priority: 'medium',
    title: 'Fix leaky kitchen faucet',
    description: 'Guest reported dripping faucet in kitchen. Needs washer replacement.',
    assigned_to: 'EMP-002',
    assigned_name: 'James Wilson',
    scheduled_date: '2026-03-18',
    scheduled_time: '09:00',
    estimated_duration_min: 60,
    actual_duration_min: null,
    checklist: [
      { item: 'Turn off water supply', completed: true },
      { item: 'Remove faucet handle', completed: true },
      { item: 'Replace washer', completed: false },
      { item: 'Test for leaks', completed: false },
    ],
    notes: 'Parts picked up from Home Depot',
    created_at: '2026-03-17T08:00:00Z',
    updated_at: '2026-03-18T09:30:00Z',
  },
  {
    id: 'DSP-003',
    property_id: 'PROP-001',
    booking_id: 'BK-001',
    type: 'inspection',
    status: 'completed',
    priority: 'low',
    title: 'Pre-check-in inspection',
    description: 'Verify property is guest-ready before 3pm check-in.',
    assigned_to: 'EMP-001',
    assigned_name: 'Maria Garcia',
    scheduled_date: '2026-03-20',
    scheduled_time: '14:00',
    estimated_duration_min: 30,
    actual_duration_min: 25,
    checklist: [
      { item: 'Check all lights and outlets', completed: true },
      { item: 'Verify HVAC working', completed: true },
      { item: 'Confirm smart lock code set', completed: true },
      { item: 'Check welcome basket', completed: true },
    ],
    notes: 'Everything looks great. Ready for guest.',
    created_at: '2026-03-19T12:00:00Z',
    updated_at: '2026-03-20T14:25:00Z',
  },
];

function generateId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}`;
}

// ── GET /api/dispatch/tasks ─────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const status = params.get('status');
    const type = params.get('type');
    const propertyId = params.get('property_id');
    const assignedTo = params.get('assigned_to');
    const priority = params.get('priority');
    const date = params.get('date');

    let filtered = [...tasks];

    if (status) {
      filtered = filtered.filter((t) => t.status === status);
    }
    if (type) {
      filtered = filtered.filter((t) => t.type === type);
    }
    if (propertyId) {
      filtered = filtered.filter((t) => t.property_id === propertyId);
    }
    if (assignedTo) {
      filtered = filtered.filter((t) => t.assigned_to === assignedTo);
    }
    if (priority) {
      filtered = filtered.filter((t) => t.priority === priority);
    }
    if (date) {
      filtered = filtered.filter((t) => t.scheduled_date === date);
    }

    return NextResponse.json({
      tasks: filtered,
      total: filtered.length,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to list tasks', detail: error.message },
      { status: 500 },
    );
  }
}

// ── POST /api/dispatch/tasks ────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const required = ['property_id', 'type', 'title'];
    for (const field of required) {
      if (!body[field]) {
        return NextResponse.json(
          { error: `Missing required field: ${field}` },
          { status: 400 },
        );
      }
    }

    const validTypes = ['cleaning', 'maintenance', 'inspection', 'turnover', 'emergency', 'other'];
    if (!validTypes.includes(body.type)) {
      return NextResponse.json(
        { error: `Invalid type. Must be one of: ${validTypes.join(', ')}` },
        { status: 400 },
      );
    }

    const validPriorities = ['low', 'medium', 'high', 'urgent'];
    if (body.priority && !validPriorities.includes(body.priority)) {
      return NextResponse.json(
        { error: `Invalid priority. Must be one of: ${validPriorities.join(', ')}` },
        { status: 400 },
      );
    }

    const now = new Date().toISOString();
    const task = {
      id: generateId('DSP'),
      property_id: body.property_id,
      booking_id: body.booking_id ?? null,
      type: body.type,
      status: 'pending',
      priority: body.priority ?? 'medium',
      title: body.title,
      description: body.description ?? '',
      assigned_to: body.assigned_to ?? null,
      assigned_name: body.assigned_name ?? null,
      scheduled_date: body.scheduled_date ?? null,
      scheduled_time: body.scheduled_time ?? null,
      estimated_duration_min: body.estimated_duration_min ?? null,
      actual_duration_min: null,
      checklist: body.checklist ?? [],
      notes: body.notes ?? '',
      created_at: now,
      updated_at: now,
    };

    tasks.push(task);

    return NextResponse.json({ task }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to create task', detail: error.message },
      { status: 500 },
    );
  }
}
