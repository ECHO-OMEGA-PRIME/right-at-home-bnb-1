import { NextRequest, NextResponse } from 'next/server';

// ── Shared tasks reference (in production, use DB) ──────────────────────────
const tasks: any[] = [
  {
    id: 'DSP-001',
    property_id: 'PROP-001',
    booking_id: 'BK-001',
    type: 'cleaning',
    status: 'pending',
    priority: 'high',
    title: 'Post-checkout deep clean',
    description: 'Full deep clean after guest checkout.',
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
];

const VALID_STATUSES = ['pending', 'assigned', 'in_progress', 'completed', 'cancelled'];
const STATUS_TRANSITIONS: Record<string, string[]> = {
  pending: ['assigned', 'in_progress', 'cancelled'],
  assigned: ['in_progress', 'cancelled'],
  in_progress: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

// ── GET /api/dispatch/tasks/:id ─────────────────────────────────────────────
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const task = tasks.find((t) => t.id === id);

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    const completedItems = task.checklist.filter((c: any) => c.completed).length;
    const totalItems = task.checklist.length;

    return NextResponse.json({
      task,
      checklist_progress: {
        completed: completedItems,
        total: totalItems,
        percent: totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to get task', detail: error.message },
      { status: 500 },
    );
  }
}

// ── PUT /api/dispatch/tasks/:id ─────────────────────────────────────────────
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const idx = tasks.findIndex((t) => t.id === id);

    if (idx === -1) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    const body = await request.json();
    const task = tasks[idx];

    // Validate status transition
    if (body.status) {
      if (!VALID_STATUSES.includes(body.status)) {
        return NextResponse.json(
          { error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` },
          { status: 400 },
        );
      }
      const allowed = STATUS_TRANSITIONS[task.status] || [];
      if (!allowed.includes(body.status)) {
        return NextResponse.json(
          {
            error: `Cannot transition from '${task.status}' to '${body.status}'. Allowed: ${allowed.join(', ') || 'none'}`,
          },
          { status: 400 },
        );
      }
    }

    // Updatable fields
    const updatable = [
      'status', 'priority', 'title', 'description', 'assigned_to', 'assigned_name',
      'scheduled_date', 'scheduled_time', 'estimated_duration_min', 'actual_duration_min',
      'checklist', 'notes',
    ];
    for (const field of updatable) {
      if (body[field] !== undefined) {
        task[field] = body[field];
      }
    }

    // Auto-set assigned status when assigning
    if (body.assigned_to && task.status === 'pending') {
      task.status = 'assigned';
    }

    task.updated_at = new Date().toISOString();
    tasks[idx] = task;

    return NextResponse.json({ task });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to update task', detail: error.message },
      { status: 500 },
    );
  }
}

// ── DELETE /api/dispatch/tasks/:id ──────────────────────────────────────────
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const idx = tasks.findIndex((t) => t.id === id);

    if (idx === -1) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    const task = tasks[idx];

    if (task.status === 'completed') {
      return NextResponse.json(
        { error: 'Cannot cancel a completed task' },
        { status: 400 },
      );
    }

    task.status = 'cancelled';
    task.updated_at = new Date().toISOString();

    return NextResponse.json({
      message: 'Task cancelled',
      task,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to cancel task', detail: error.message },
      { status: 500 },
    );
  }
}
