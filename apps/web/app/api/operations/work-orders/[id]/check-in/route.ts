import { NextRequest, NextResponse } from 'next/server';
import { requireWorkerActor, canManageAllWorkOrders } from '@/lib/operations-auth';
import { checkInWorkOrder } from '@/lib/operations-service';

export const runtime = 'nodejs';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireWorkerActor(request);
  if (auth.error) return auth.error;

  let body: any = {};
  try {
    body = await request.json();
  } catch {
    // GPS is optional when an owner performs a manual override.
  }

  const ownerOverride = canManageAllWorkOrders(auth.user!.role);
  if (!ownerOverride && !auth.workerProfile) {
    return NextResponse.json({ error: 'Worker profile required' }, { status: 403 });
  }

  try {
    const workOrder = await checkInWorkOrder({
      workOrderId: params.id,
      workerProfileId: auth.workerProfile?.id || '',
      latitude: body.latitude ?? null,
      longitude: body.longitude ?? null,
      ownerOverride,
    });
    return NextResponse.json({ success: true, workOrder, timerStartedAt: workOrder.checkedInAt });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Check-in failed' },
      { status: 400 },
    );
  }
}
