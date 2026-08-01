import { NextRequest, NextResponse } from 'next/server';
import { requireWorkerActor, canManageAllWorkOrders } from '@/lib/operations-auth';
import { completeWorkOrder } from '@/lib/operations-service';

export const runtime = 'nodejs';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireWorkerActor(request);
  if (auth.error) return auth.error;

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!String(body.reportSummary || '').trim()) {
    return NextResponse.json({ error: 'reportSummary is required' }, { status: 400 });
  }

  try {
    const workOrder = await completeWorkOrder({
      workOrderId: params.id,
      workerProfileId: auth.workerProfile?.id || '',
      reportSummary: String(body.reportSummary).trim(),
      damageReported: Boolean(body.damageReported),
      theftReported: Boolean(body.theftReported),
      maintenanceNeeded: Boolean(body.maintenanceNeeded),
      yardNeeded: Boolean(body.yardNeeded),
      poolNeeded: Boolean(body.poolNeeded),
      latitude: body.latitude ?? null,
      longitude: body.longitude ?? null,
      ownerOverride: canManageAllWorkOrders(auth.user!.role),
    });
    return NextResponse.json({ success: true, workOrder });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Completion failed' },
      { status: 400 },
    );
  }
}
