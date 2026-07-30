import { NextRequest, NextResponse } from 'next/server';
import { requireWorkerActor, canManageAllWorkOrders } from '@/lib/operations-auth';
import { updateChecklistItem } from '@/lib/operations-service';

export const runtime = 'nodejs';

export async function PATCH(
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

  if (!body.itemId || typeof body.completed !== 'boolean') {
    return NextResponse.json({ error: 'itemId and completed are required' }, { status: 400 });
  }

  try {
    const item = await updateChecklistItem({
      workOrderId: params.id,
      itemId: body.itemId,
      completed: body.completed,
      notes: body.notes,
      evidencePhotoUrl: body.evidencePhotoUrl,
      workerProfileId: auth.workerProfile?.id || '',
      ownerOverride: canManageAllWorkOrders(auth.user!.role),
    });
    return NextResponse.json({ success: true, item });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Checklist update failed' },
      { status: 400 },
    );
  }
}
