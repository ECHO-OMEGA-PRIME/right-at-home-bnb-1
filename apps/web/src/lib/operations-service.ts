import { prisma } from '@/lib/prisma';
import { deliverSensitiveGuestMessage } from '@/lib/secure-notifications';
import { serviceWorkerTypes } from '@/lib/operations-policy';

const ACTIVE_WORK_ORDER_STATUSES = ['PENDING', 'UNASSIGNED', 'ASSIGNED', 'ACCEPTED', 'IN_PROGRESS'];

export interface CreateWorkOrderInput {
  propertyId: string;
  bookingId?: string | null;
  requestedByUserId?: string | null;
  assignedWorkerId?: string | null;
  serviceType: string;
  source?: string;
  dispatchMode?: 'AUTO' | 'MANUAL';
  priority?: number;
  title: string;
  description?: string | null;
  scheduledStart?: Date | null;
  dueAt?: Date | null;
}

interface ChecklistTemplateItem {
  id?: string;
  key?: string;
  itemId?: string;
  label?: string;
  task?: string;
  required?: boolean;
  requiresPhoto?: boolean;
  sortOrder?: number;
}

function parseBooleanSetting(value: string | undefined | null, fallback: boolean): boolean {
  if (value === undefined || value === null) return fallback;
  const normalized = value.trim().toLowerCase();
  if (['true', '1', 'yes', 'on', 'enabled'].includes(normalized)) return true;
  if (['false', '0', 'no', 'off', 'disabled'].includes(normalized)) return false;
  try {
    return Boolean(JSON.parse(value));
  } catch {
    return fallback;
  }
}

export async function isAutoDispatchEnabled(propertyId: string): Promise<boolean> {
  const keys = [`dispatch.auto.property.${propertyId}`, 'dispatch.auto.enabled'];
  const settings = await prisma.setting.findMany({ where: { key: { in: keys } } });
  const propertySetting = settings.find((setting) => setting.key === keys[0]);
  const globalSetting = settings.find((setting) => setting.key === keys[1]);
  if (propertySetting) return parseBooleanSetting(propertySetting.value, false);
  return parseBooleanSetting(globalSetting?.value, false);
}

export async function selectAutoDispatchWorker(serviceType: string) {
  const workerTypes = serviceWorkerTypes(serviceType);
  const candidates = await prisma.workerProfile.findMany({
    where: {
      workerType: { in: workerTypes },
      isAvailable: true,
      autoDispatchEligible: true,
      user: { isActive: true },
    },
    include: {
      user: { select: { id: true, name: true, phone: true, email: true } },
      workOrders: {
        where: { status: { in: ACTIVE_WORK_ORDER_STATUSES } },
        select: { id: true, scheduledStart: true, dueAt: true },
      },
    },
    orderBy: [{ dispatchPriority: 'asc' }, { createdAt: 'asc' }],
  });

  return (
    candidates.find((candidate) => candidate.workOrders.length < candidate.maxConcurrentJobs) || null
  );
}

function parseChecklist(itemsJson: string | null | undefined): ChecklistTemplateItem[] {
  if (!itemsJson) return [];
  try {
    const parsed = JSON.parse(itemsJson);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function checklistCreateData(items: ChecklistTemplateItem[]) {
  return items.map((item, index) => ({
    templateItemKey: String(item.key || item.itemId || item.id || `item-${index + 1}`),
    label: String(item.label || item.task || `Task ${index + 1}`),
    sortOrder: Number.isFinite(item.sortOrder) ? Number(item.sortOrder) : index,
    required: item.required !== false,
    requiresPhoto: Boolean(item.requiresPhoto),
  }));
}

export async function createWorkOrder(input: CreateWorkOrderInput) {
  const serviceType = input.serviceType.trim().toUpperCase();
  const dispatchMode = input.dispatchMode || 'MANUAL';
  const now = new Date();

  const property = await prisma.property.findUnique({
    where: { id: input.propertyId },
    select: { id: true, name: true, status: true },
  });
  if (!property) throw new Error('Property not found');
  if (property.status !== 'ACTIVE') throw new Error('Cannot dispatch work to an inactive property');

  let assignedWorkerId = input.assignedWorkerId || null;
  let selectedWorker: Awaited<ReturnType<typeof selectAutoDispatchWorker>> = null;
  if (!assignedWorkerId && dispatchMode === 'AUTO') {
    selectedWorker = await selectAutoDispatchWorker(serviceType);
    assignedWorkerId = selectedWorker?.id || null;
  }

  const [rate, template] = await Promise.all([
    prisma.propertyServiceRate.findFirst({
      where: {
        propertyId: input.propertyId,
        serviceType,
        isActive: true,
        effectiveFrom: { lte: now },
        OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }],
      },
      orderBy: { effectiveFrom: 'desc' },
    }),
    prisma.propertyChecklistTemplate.findFirst({
      where: { propertyId: input.propertyId, serviceType, isActive: true },
      orderBy: { version: 'desc' },
    }),
  ]);

  const checklist = checklistCreateData(parseChecklist(template?.itemsJson));
  const status = assignedWorkerId ? 'ASSIGNED' : 'UNASSIGNED';

  const workOrder = await prisma.workOrder.create({
    data: {
      propertyId: input.propertyId,
      bookingId: input.bookingId || null,
      requestedByUserId: input.requestedByUserId || null,
      assignedWorkerId,
      serviceType,
      source: input.source || 'OWNER',
      status,
      dispatchMode,
      priority: Math.max(1, Math.min(100, input.priority || 50)),
      title: input.title,
      description: input.description || null,
      scheduledStart: input.scheduledStart || null,
      dueAt: input.dueAt || null,
      payAmountCents: rate?.amountCents || null,
      checklistItems: checklist.length ? { create: checklist } : undefined,
    },
    include: {
      property: { select: { name: true, address: true } },
      assignedWorker: { include: { user: { select: { name: true, phone: true, email: true } } } },
      checklistItems: { orderBy: { sortOrder: 'asc' } },
    },
  });

  if (!assignedWorkerId) {
    await prisma.operationalAlert.create({
      data: {
        propertyId: input.propertyId,
        bookingId: input.bookingId || null,
        workOrderId: workOrder.id,
        alertType: 'NO_WORKER_AVAILABLE',
        severity: dispatchMode === 'AUTO' ? 'HIGH' : 'NORMAL',
        title: `Unassigned ${serviceType.toLowerCase()} work order`,
        message: `${workOrder.title} at ${property.name} requires manual assignment.`,
      },
    });
  }

  return workOrder;
}

function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const radius = 6_371_000;
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * radius * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function checkInWorkOrder(input: {
  workOrderId: string;
  workerProfileId: string;
  latitude?: number | null;
  longitude?: number | null;
  ownerOverride?: boolean;
}) {
  const workOrder = await prisma.workOrder.findUnique({
    where: { id: input.workOrderId },
    include: { property: true, assignedWorker: true },
  });
  if (!workOrder) throw new Error('Work order not found');
  if (!input.ownerOverride && workOrder.assignedWorkerId !== input.workerProfileId) {
    throw new Error('Work order is not assigned to this worker');
  }
  if (!['ASSIGNED', 'ACCEPTED'].includes(workOrder.status)) {
    throw new Error(`Work order cannot be checked in from status ${workOrder.status}`);
  }

  if (
    !input.ownerOverride &&
    workOrder.property.latitude !== null &&
    workOrder.property.longitude !== null &&
    input.latitude !== null &&
    input.latitude !== undefined &&
    input.longitude !== null &&
    input.longitude !== undefined
  ) {
    const meters = distanceMeters(
      workOrder.property.latitude,
      workOrder.property.longitude,
      input.latitude,
      input.longitude,
    );
    const allowedMeters = Number.parseInt(process.env.WORKER_CHECKIN_RADIUS_METERS || '500', 10);
    if (meters > allowedMeters) {
      throw new Error(`Worker is outside the ${allowedMeters} meter check-in radius`);
    }
  }

  return prisma.workOrder.update({
    where: { id: workOrder.id },
    data: {
      status: 'IN_PROGRESS',
      checkedInAt: new Date(),
      checkInLat: input.latitude ?? null,
      checkInLng: input.longitude ?? null,
    },
    include: {
      property: { select: { name: true, address: true } },
      checklistItems: { orderBy: { sortOrder: 'asc' } },
    },
  });
}

export async function updateChecklistItem(input: {
  workOrderId: string;
  itemId: string;
  completed: boolean;
  notes?: string | null;
  evidencePhotoUrl?: string | null;
  workerProfileId: string;
  ownerOverride?: boolean;
}) {
  const item = await prisma.workOrderChecklistItem.findUnique({
    where: { id: input.itemId },
    include: { workOrder: { select: { id: true, assignedWorkerId: true, status: true } } },
  });
  if (!item || item.workOrderId !== input.workOrderId) throw new Error('Checklist item not found');
  if (!input.ownerOverride && item.workOrder.assignedWorkerId !== input.workerProfileId) {
    throw new Error('Checklist item does not belong to this worker');
  }
  if (item.workOrder.status !== 'IN_PROGRESS') {
    throw new Error('Checklist can only be updated while work is in progress');
  }
  if (input.completed && item.requiresPhoto && !input.evidencePhotoUrl && !item.evidencePhotoUrl) {
    throw new Error('Photo evidence is required for this task');
  }

  return prisma.workOrderChecklistItem.update({
    where: { id: item.id },
    data: {
      completed: input.completed,
      completedAt: input.completed ? new Date() : null,
      notes: input.notes === undefined ? item.notes : input.notes,
      evidencePhotoUrl:
        input.evidencePhotoUrl === undefined ? item.evidencePhotoUrl : input.evidencePhotoUrl,
    },
  });
}

async function notifyStevenOfWorkOrder(workOrder: any): Promise<void> {
  const email = process.env.STEVEN_EMAIL || 'steven.palma@rah-midland.com';
  const issueLines = (workOrder.issues || []).map(
    (issue: any) => `- ${issue.severity}: ${issue.issueType} — ${issue.description}`,
  );
  const message = [
    `${workOrder.assignedWorker?.user?.name || 'A worker'} completed ${workOrder.serviceType.toLowerCase()} at ${workOrder.property.name}.`,
    `Time on site: ${workOrder.timerSeconds ? Math.round(workOrder.timerSeconds / 60) : 0} minutes.`,
    `Pay earned: $${((workOrder.payAmountCents || 0) / 100).toFixed(2)}.`,
    workOrder.reportSummary ? `Report: ${workOrder.reportSummary}` : '',
    issueLines.length ? `Issues:\n${issueLines.join('\n')}` : 'No issues were reported.',
  ]
    .filter(Boolean)
    .join('\n\n');

  await deliverSensitiveGuestMessage({
    email,
    subject: `Completed: ${workOrder.property.name} — ${workOrder.serviceType}`,
    message,
  });
}

export async function completeWorkOrder(input: {
  workOrderId: string;
  workerProfileId: string;
  reportSummary: string;
  damageReported?: boolean;
  theftReported?: boolean;
  maintenanceNeeded?: boolean;
  yardNeeded?: boolean;
  poolNeeded?: boolean;
  latitude?: number | null;
  longitude?: number | null;
  ownerOverride?: boolean;
}) {
  const workOrder = await prisma.workOrder.findUnique({
    where: { id: input.workOrderId },
    include: {
      property: true,
      assignedWorker: { include: { user: true } },
      checklistItems: { orderBy: { sortOrder: 'asc' } },
      photos: true,
      issues: true,
    },
  });
  if (!workOrder) throw new Error('Work order not found');
  if (!input.ownerOverride && workOrder.assignedWorkerId !== input.workerProfileId) {
    throw new Error('Work order is not assigned to this worker');
  }
  if (workOrder.status !== 'IN_PROGRESS') {
    throw new Error(`Work order cannot be completed from status ${workOrder.status}`);
  }

  const incomplete = workOrder.checklistItems.filter((item) => item.required && !item.completed);
  if (incomplete.length) {
    throw new Error(`Required checklist tasks remain incomplete: ${incomplete.map((item) => item.label).join(', ')}`);
  }
  const missingPhotos = workOrder.checklistItems.filter(
    (item) => item.requiresPhoto && !item.evidencePhotoUrl,
  );
  if (missingPhotos.length) {
    throw new Error(`Photo evidence is missing for: ${missingPhotos.map((item) => item.label).join(', ')}`);
  }

  const completedAt = new Date();
  const timerSeconds = workOrder.checkedInAt
    ? Math.max(0, Math.round((completedAt.getTime() - workOrder.checkedInAt.getTime()) / 1000))
    : null;

  const updated = await prisma.$transaction(async (tx) => {
    const completed = await tx.workOrder.update({
      where: { id: workOrder.id },
      data: {
        status: 'COMPLETED',
        completedAt,
        checkedOutAt: completedAt,
        checkOutLat: input.latitude ?? null,
        checkOutLng: input.longitude ?? null,
        timerSeconds,
        reportSummary: input.reportSummary,
        damageReported: Boolean(input.damageReported),
        theftReported: Boolean(input.theftReported),
        maintenanceNeeded: Boolean(input.maintenanceNeeded),
        yardNeeded: Boolean(input.yardNeeded),
        poolNeeded: Boolean(input.poolNeeded),
        reportSubmittedAt: completedAt,
        paymentStatus: workOrder.payAmountCents ? 'EARNED' : 'NO_RATE',
      },
      include: {
        property: true,
        assignedWorker: { include: { user: true } },
        checklistItems: true,
        photos: true,
        issues: true,
      },
    });

    if (completed.assignedWorkerId && completed.payAmountCents) {
      await tx.workerPayEntry.upsert({
        where: { workOrderId: completed.id },
        create: {
          workerId: completed.assignedWorkerId,
          workOrderId: completed.id,
          amountCents: completed.payAmountCents,
          status: 'EARNED',
          earnedAt: completedAt,
        },
        update: {
          amountCents: completed.payAmountCents,
          status: 'EARNED',
          earnedAt: completedAt,
        },
      });
    }

    const hasIssue =
      completed.damageReported ||
      completed.theftReported ||
      completed.maintenanceNeeded ||
      completed.yardNeeded ||
      completed.poolNeeded ||
      completed.issues.length > 0;

    if (hasIssue) {
      await tx.operationalAlert.create({
        data: {
          propertyId: completed.propertyId,
          bookingId: completed.bookingId,
          workOrderId: completed.id,
          alertType: 'WORK_ORDER_ISSUE_REPORT',
          severity: completed.theftReported || completed.damageReported ? 'HIGH' : 'NORMAL',
          title: `Issue report: ${completed.property.name}`,
          message: input.reportSummary.slice(0, 2000),
        },
      });
    }
    return completed;
  });

  const followUps: Array<{ serviceType: string; title: string }> = [];
  if (updated.maintenanceNeeded) followUps.push({ serviceType: 'MAINTENANCE', title: 'Maintenance follow-up' });
  if (updated.yardNeeded) followUps.push({ serviceType: 'YARD', title: 'Yard-service follow-up' });
  if (updated.poolNeeded) followUps.push({ serviceType: 'POOL', title: 'Pool-service follow-up' });

  for (const followUp of followUps) {
    const auto = await isAutoDispatchEnabled(updated.propertyId);
    await createWorkOrder({
      propertyId: updated.propertyId,
      bookingId: updated.bookingId,
      serviceType: followUp.serviceType,
      source: 'WORKER_REPORT',
      dispatchMode: auto ? 'AUTO' : 'MANUAL',
      priority: updated.damageReported || updated.theftReported ? 90 : 60,
      title: `${followUp.title}: ${updated.property.name}`,
      description: updated.reportSummary,
      dueAt: new Date(Date.now() + 24 * 60 * 60_000),
    });
  }

  try {
    await notifyStevenOfWorkOrder(updated);
  } catch (error) {
    await prisma.operationalAlert.create({
      data: {
        propertyId: updated.propertyId,
        bookingId: updated.bookingId,
        workOrderId: updated.id,
        alertType: 'OWNER_REPORT_DELIVERY_FAILED',
        severity: 'HIGH',
        title: 'Completed report could not be emailed to Steven',
        message: error instanceof Error ? error.message.slice(0, 1000) : 'Unknown delivery failure',
      },
    });
  }

  return updated;
}

function guestRequestServiceType(category: string): string {
  const normalized = category.trim().toUpperCase();
  if (['TOWELS', 'LINENS', 'CLEANING', 'TOILETRIES', 'SUPPLIES'].includes(normalized)) return 'CLEANING';
  if (['POOL', 'HOT_TUB'].includes(normalized)) return 'POOL';
  if (['YARD', 'IRRIGATION', 'OUTDOOR'].includes(normalized)) return 'YARD';
  return 'MAINTENANCE';
}

export async function createGuestRequest(input: {
  bookingId: string;
  guestId: string;
  category: string;
  description: string;
  urgency?: 'NORMAL' | 'HIGH' | 'EMERGENCY';
  sourceChannel?: string;
}) {
  const booking = await prisma.booking.findFirst({
    where: { id: input.bookingId, guestId: input.guestId },
    include: { property: true, guest: true },
  });
  if (!booking) throw new Error('Booking was not found for this guest');
  if (!['CONFIRMED', 'CHECKED_IN'].includes(booking.status)) {
    throw new Error('Guest requests require an active or upcoming confirmed stay');
  }

  const urgency = input.urgency || 'NORMAL';
  const request = await prisma.guestRequest.create({
    data: {
      propertyId: booking.propertyId,
      bookingId: booking.id,
      guestId: booking.guestId,
      category: input.category.trim().toUpperCase(),
      description: input.description,
      urgency,
      sourceChannel: input.sourceChannel || 'WEB',
    },
  });

  const autoDispatch = await isAutoDispatchEnabled(booking.propertyId);
  let workOrder = null;
  if (autoDispatch || urgency === 'EMERGENCY') {
    const serviceType = guestRequestServiceType(input.category);
    workOrder = await createWorkOrder({
      propertyId: booking.propertyId,
      bookingId: booking.id,
      serviceType,
      source: 'GUEST_REQUEST',
      dispatchMode: 'AUTO',
      priority: urgency === 'EMERGENCY' ? 100 : urgency === 'HIGH' ? 85 : 60,
      title: `${input.category}: guest request at ${booking.property.name}`,
      description: input.description,
      dueAt: new Date(Date.now() + (urgency === 'EMERGENCY' ? 30 : 120) * 60_000),
    });
    await prisma.guestRequest.update({
      where: { id: request.id },
      data: { assignedWorkOrderId: workOrder.id, status: workOrder.assignedWorkerId ? 'DISPATCHED' : 'PENDING_ASSIGNMENT' },
    });
  }

  await prisma.operationalAlert.create({
    data: {
      propertyId: booking.propertyId,
      bookingId: booking.id,
      workOrderId: workOrder?.id || null,
      alertType: 'GUEST_REQUEST',
      severity: urgency,
      title: `${input.category} request from ${booking.guest.name}`,
      message: input.description,
    },
  });

  if (urgency === 'EMERGENCY') {
    await prisma.conciergeAction.create({
      data: {
        actorType: 'CONCIERGE_AI',
        actionType: 'CALL_STEVEN',
        targetType: 'GUEST_REQUEST',
        targetId: request.id,
        riskLevel: 'HIGH',
        requiresApproval: false,
        approvalStatus: 'NOT_REQUIRED',
        status: 'QUEUED',
        idempotencyKey: `guest-request-call-${request.id}`,
        inputJson: JSON.stringify({
          propertyId: booking.propertyId,
          bookingId: booking.id,
          category: input.category,
          urgency,
        }),
      },
    });
  }

  return { request, workOrder, autoDispatch };
}

export async function createTurnoverWorkOrderForCheckout(bookingId: string) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { property: true },
  });
  if (!booking) throw new Error('Booking not found');

  const existing = await prisma.workOrder.findFirst({
    where: { bookingId, serviceType: 'CLEANING', source: 'BOOKING_CHECKOUT' },
  });
  if (existing) return existing;

  const autoDispatch = await isAutoDispatchEnabled(booking.propertyId);
  return createWorkOrder({
    propertyId: booking.propertyId,
    bookingId: booking.id,
    serviceType: 'CLEANING',
    source: 'BOOKING_CHECKOUT',
    dispatchMode: autoDispatch ? 'AUTO' : 'MANUAL',
    priority: 80,
    title: `Turnover cleaning: ${booking.property.name}`,
    description: `Checkout turnover for booking ${booking.id}.`,
    scheduledStart: booking.checkOut,
    dueAt: new Date(booking.checkOut.getTime() + 4 * 60 * 60_000),
  });
}
