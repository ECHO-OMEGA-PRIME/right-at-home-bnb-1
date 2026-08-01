import { NextRequest, NextResponse } from 'next/server';
import { requireOwnerActor } from '@/lib/operations-auth';
import {
  approveAndQueueFridayPayments,
  createFridayPayrollBatch,
  previewFridayPay,
} from '@/lib/operations-scheduler';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function parseWeekEnding(value: string | null): Date {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) throw new Error('Invalid weekEnding date');
  return date;
}

export async function GET(request: NextRequest) {
  const auth = await requireOwnerActor(request);
  if (auth.error) return auth.error;

  try {
    const preview = await previewFridayPay(parseWeekEnding(request.nextUrl.searchParams.get('weekEnding')));
    return NextResponse.json({ preview });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Payroll preview failed' },
      { status: 400 },
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireOwnerActor(request);
  if (auth.error) return auth.error;

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  try {
    if (body.action === 'create_batch') {
      const result = await createFridayPayrollBatch(parseWeekEnding(body.weekEnding || null));
      return NextResponse.json({ success: true, ...result }, { status: 201 });
    }

    if (body.action === 'approve_and_queue') {
      if (!body.batchId) return NextResponse.json({ error: 'batchId required' }, { status: 400 });
      const result = await approveAndQueueFridayPayments({
        batchId: body.batchId,
        approvedByUserId: auth.dbUser?.id || null,
        confirmation: body.confirmation,
      });
      return NextResponse.json({
        success: true,
        ...result,
        note: 'Payments are approved and queued. Provider execution requires a configured PayPal, Venmo, or Zelle adapter.',
      });
    }

    return NextResponse.json({ error: 'Unknown payroll action' }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Payroll action failed' },
      { status: 400 },
    );
  }
}
