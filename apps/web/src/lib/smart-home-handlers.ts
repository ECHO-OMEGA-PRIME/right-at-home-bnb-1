import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireOneOfRoles, requireRole } from '@/lib/api-auth';
import { isUnrestricted, propertyScopeFor } from '@/lib/tenant-scope';
import {
  getLocks,
  getUnlockHistory,
  isTuyaConfigured,
  listCodes,
  setLockState,
  getLockStatus,
} from '@/lib/integrations/tuya-client';
import {
  processGuestAccessLifecycle,
  provisionGuestAccess,
  revokeGuestAccess,
} from '@/lib/access-orchestration';
import { createTurnoverWorkOrderForCheckout } from '@/lib/operations-service';

function constantTimeEquals(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function isAuthorizedService(request: NextRequest): boolean {
  const expected = process.env.INTERNAL_API_SECRET || process.env.CRON_SECRET || '';
  const provided = request.headers.get('x-api-secret') || '';
  return Boolean(expected && provided && constantTimeEquals(expected, provided));
}

function maskedDeviceId(deviceId?: string | number | null): string | null {
  if (deviceId === null || deviceId === undefined || deviceId === '') return null;
  // Coerce defensively: the FORGE lock proxy returns integer row ids, whereas the
  // legacy Tuya client returned string device ids. Either way this value is
  // display-only (masked), so String() keeps the masking robust for both shapes.
  const id = String(deviceId);
  return id.length <= 6 ? '******' : `***${id.slice(-6)}`;
}

async function ownerOrService(request: NextRequest) {
  if (isAuthorizedService(request)) {
    return { service: true as const, user: null, error: null };
  }
  const auth = await requireRole(request, 'owner');
  return { service: false as const, user: auth.user, error: auth.error };
}

export async function safeSmartHomeGet(request: NextRequest) {
  const auth = await requireOneOfRoles(request, ['owner', 'admin', 'worker']);
  if (auth.error) return auth.error;

  try {
    const params = request.nextUrl.searchParams;
    const view = params.get('view') || params.get('action') || 'locks';
    const propertyId = params.get('property_id') || params.get('propertyId');

    if (view === 'workers') {
      if (!['owner', 'admin'].includes(auth.user!.role)) {
        return NextResponse.json({ error: 'Owner access required', code: 'FORBIDDEN' }, { status: 403 });
      }
      const workers = await prisma.workerProfile.findMany({
        where: { user: { isActive: true } },
        include: { user: { select: { id: true, name: true, email: true, phone: true, isActive: true } } },
        orderBy: [{ workerType: 'asc' }, { dispatchPriority: 'asc' }],
      });
      return NextResponse.json({
        workers: workers.map((worker) => ({
          id: worker.id,
          userId: worker.userId,
          name: worker.user.name,
          email: worker.user.email,
          phone: worker.user.phone,
          workerType: worker.workerType,
          employmentClass: worker.employmentClass,
          dispatchPriority: worker.dispatchPriority,
          autoDispatchEligible: worker.autoDispatchEligible,
          isAvailable: worker.isAvailable,
          hasManagedLockIdentity: Boolean(worker.tuyaIdentityRef),
        })),
      });
    }

    if (view === 'access' || view === 'codes') {
      if (!['owner', 'admin'].includes(auth.user!.role)) {
        return NextResponse.json({ error: 'Owner access required', code: 'FORBIDDEN' }, { status: 403 });
      }
      const grants = await prisma.accessGrant.findMany({
        where: propertyId ? { propertyId } : undefined,
        include: {
          property: { select: { name: true } },
          booking: { select: { id: true, checkIn: true, checkOut: true, guest: { select: { name: true } } } },
          user: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 250,
      });
      return NextResponse.json({
        accessGrants: grants.map((grant) => ({
          id: grant.id,
          propertyId: grant.propertyId,
          propertyName: grant.property.name,
          bookingId: grant.bookingId,
          subjectType: grant.subjectType,
          subjectName: grant.booking?.guest.name || grant.user?.name || null,
          provider: grant.provider,
          status: grant.status,
          startsAt: grant.startsAt,
          endsAt: grant.endsAt,
          deliveredAt: grant.deliveredAt,
          revokedAt: grant.revokedAt,
          deliveryChannel: grant.deliveryChannel,
        })),
      });
    }

    if (view === 'activity' || view === 'entry-logs') {
      if (!propertyId) {
        return NextResponse.json({ error: 'propertyId required' }, { status: 400 });
      }
      const lock = await prisma.smartLock.findUnique({ where: { propertyId } });
      if (!lock?.deviceId || !isTuyaConfigured()) {
        return NextResponse.json({ activity: [], source: 'unavailable' });
      }
      const logs = await getUnlockHistory(lock.deviceId);
      return NextResponse.json({
        activity: logs.map((log: any) => ({
          id: log.id || log.record_id || null,
          deviceId: maskedDeviceId(lock.deviceId),
          timestamp: log.timestamp || log.time || null,
          unlockMethod: log.unlock_method || log.unlock_type || null,
          identityRef: log.password_id || log.user_id || null,
          status: log.status ?? null,
        })),
        source: 'tuya',
      });
    }

    if (view === 'temp-passwords') {
      if (!['owner', 'admin'].includes(auth.user!.role)) {
        return NextResponse.json({ error: 'Owner access required', code: 'FORBIDDEN' }, { status: 403 });
      }
      if (!propertyId) return NextResponse.json({ error: 'propertyId required' }, { status: 400 });
      const lock = await prisma.smartLock.findUnique({ where: { propertyId } });
      if (!lock?.deviceId || !isTuyaConfigured()) {
        return NextResponse.json({ grants: [], source: 'unavailable' });
      }
      const codes = await listCodes(lock.deviceId);
      return NextResponse.json({
        grants: codes.map((item: any) => ({
          id: item.id || item.password_id,
          name: item.name || null,
          effectiveTime: item.effective_time || null,
          invalidTime: item.invalid_time || null,
          status: item.status || null,
        })),
        source: 'tuya',
      });
    }

    if (view === 'health') {
      const dbLocks = await prisma.smartLock.findMany({
        select: { propertyId: true, isOnline: true, batteryLevel: true, lastActivity: true },
      });
      return NextResponse.json({
        configured: isTuyaConfigured(),
        locks: dbLocks,
        timestamp: new Date().toISOString(),
      });
    }

    // Property-level isolation (#26919). A lock list names the doors a person
    // can see; a worker should see the ones at properties they work at.
    //
    // The Tuya branch returns DEVICES, which carry no propertyId, so the scope
    // is applied by looking up which registered SmartLocks fall in scope and
    // filtering the device list to those deviceIds. A device with no SmartLock
    // row is EXCLUDED for a restricted caller: unregistered hardware cannot be
    // shown to belong to anyone.
    const lockScope = await propertyScopeFor(auth.user);
    let allowedDeviceIds: Set<string> | null = null;
    if (!isUnrestricted(lockScope)) {
      const rows = await prisma.smartLock.findMany({
        where: { propertyId: { in: lockScope } },
        select: { deviceId: true },
      });
      allowedDeviceIds = new Set(rows.map((r) => r.deviceId));
    }

    if (isTuyaConfigured()) {
      const all = await getLocks();
      const locks = allowedDeviceIds
        ? all.filter((l: any) => allowedDeviceIds!.has(String(l.id ?? l.device_id)))
        : all;

      // GET /locks on the proxy serves a STORED row, not a live poll: its
      // last_sync was 18 days old while every device was in fact online and
      // reporting minutes ago. Showing that cached `status: online` is the same
      // "presented as live, actually stale" failure this codebase has been
      // clearing out, so each lock's true state is read from Tuya here.
      //
      // Bounded and fail-soft: allSettled, so one unreachable device degrades
      // to `online: null` (unknown) instead of failing the whole list, and the
      // enrichment is skipped entirely past a sane fleet size.
      const LIVE_STATUS_MAX = 25;
      const live = new Map<string, { online: boolean | null; updatedAt: string | null }>();
      if (locks.length <= LIVE_STATUS_MAX) {
        const results = await Promise.allSettled(
          locks.map((l: any) => getLockStatus(String(l.id ?? l.device_id))),
        );
        results.forEach((res, i) => {
          // ONLY record an entry when the device actually answered. Setting a
          // placeholder on rejection made `live.has(key)` true for failures
          // too, so the response claimed onlineSource:'live' while serving the
          // cached value -- the exact mislabelling this whole change exists to
          // remove, reintroduced in the instrument itself.
          if (res.status !== 'fulfilled') return;
          const dev = (res.value as any)?.device ?? res.value;
          if (typeof dev?.online !== 'boolean') return;
          live.set(String(locks[i].id ?? locks[i].device_id), {
            online: dev.online,
            updatedAt: dev.update_time
              ? new Date(dev.update_time * 1000).toISOString()
              : null,
          });
        });
      }

      return NextResponse.json({
        locks: locks.map((lock: any) => ({
          id: maskedDeviceId(lock.id || lock.device_id),
          name: lock.name,
          // The proxy reports `status: "online"`, not an `online` boolean.
          // Reading only `lock.online` yielded undefined, which JSON drops
          // entirely -- so every lock rendered as unknown/offline on screen
          // while the hardware was reporting itself online.
          // Live device state wins. The cached row is the fallback, and when
          // neither is available this stays null -- unknown, never "fine".
          online:
            live.get(String(lock.id ?? lock.device_id))?.online ??
            (typeof lock.online === 'boolean'
              ? lock.online
              : typeof lock.status === 'string'
                ? lock.status.toLowerCase() === 'online'
                : null),
          batteryLevel: lock.battery_level ?? lock.battery_percent ?? null,
          locked: lock.locked ?? null,
          // When this came from the device it is a real heartbeat. When it came
          // from the stored row it can be weeks old, so say which.
          lastSync:
            live.get(String(lock.id ?? lock.device_id))?.updatedAt ??
            lock.last_sync ??
            null,
          onlineSource: live.has(String(lock.id ?? lock.device_id)) ? 'live' : 'cached',
        })),
        source: 'tuya',
      });
    }

    const locks = await prisma.smartLock.findMany({
      where: isUnrestricted(lockScope) ? {} : { propertyId: { in: lockScope } },
      include: { property: { select: { name: true, address: true } } },
      orderBy: { property: { name: 'asc' } },
    });
    return NextResponse.json({
      locks: locks.map((lock) => ({
        id: lock.id,
        propertyId: lock.propertyId,
        propertyName: lock.property.name,
        address: lock.property.address,
        brand: lock.brand,
        model: lock.model,
        online: lock.isOnline,
        batteryLevel: lock.batteryLevel,
        lastActivity: lock.lastActivity,
        hasCurrentGrant: Boolean(lock.codeExpiresAt && lock.codeExpiresAt > new Date()),
      })),
      source: 'database',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Smart-home request failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function safeSmartHomePost(request: NextRequest) {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const action = String(body.action || '').replaceAll('-', '_').toLowerCase();
  try {
    if (['provision_guest_access', 'generate_guest_code', 'checkin_automation'].includes(action)) {
      const auth = await ownerOrService(request);
      if (auth.error) return auth.error;
      const bookingId = body.bookingId || body.booking_id;
      if (!bookingId) return NextResponse.json({ error: 'bookingId required' }, { status: 400 });
      const result = await provisionGuestAccess(String(bookingId), { force: Boolean(body.force) });
      return NextResponse.json({ success: true, access: result });
    }

    if (['revoke_guest_access', 'deactivate_guest_code', 'checkout_automation'].includes(action)) {
      const auth = await ownerOrService(request);
      if (auth.error) return auth.error;
      const bookingId = body.bookingId || body.booking_id;
      if (!bookingId) return NextResponse.json({ error: 'bookingId required' }, { status: 400 });
      const result = await revokeGuestAccess(String(bookingId));
      let turnoverWorkOrder = null;
      if (action === 'checkout_automation') {
        await prisma.booking.update({
          where: { id: String(bookingId) },
          data: { status: 'CHECKED_OUT' },
        });
        turnoverWorkOrder = await createTurnoverWorkOrderForCheckout(String(bookingId));
      }
      return NextResponse.json({
        success: result.failures === 0,
        access: result,
        turnoverWorkOrder,
      });
    }

    if (action === 'process_access_lifecycle') {
      const auth = await ownerOrService(request);
      if (auth.error) return auth.error;
      const result = await processGuestAccessLifecycle();
      return NextResponse.json({ success: true, ...result });
    }

    if (action === 'lock') {
      const auth = await requireRole(request, 'owner');
      if (auth.error) return auth.error;
      const propertyId = body.propertyId || body.property_id;
      if (!propertyId) return NextResponse.json({ error: 'propertyId required' }, { status: 400 });
      const lock = await prisma.smartLock.findUnique({ where: { propertyId: String(propertyId) } });
      if (!lock?.deviceId) return NextResponse.json({ error: 'Lock not configured' }, { status: 404 });
      await setLockState(lock.deviceId, true);
      await prisma.auditLog.create({
        data: {
          userId: auth.user!.uid,
          action: 'REMOTE_LOCK',
          entity: 'SmartLock',
          entityId: lock.id,
          newValues: JSON.stringify({ propertyId }),
        },
      });
      return NextResponse.json({ success: true, state: 'LOCKED' });
    }

    if (action === 'unlock') {
      const auth = await requireRole(request, 'owner');
      if (auth.error) return auth.error;
      if (body.confirmation !== 'REMOTE_UNLOCK_APPROVED' || String(body.reason || '').trim().length < 20) {
        return NextResponse.json(
          { error: 'Remote unlock requires explicit confirmation and a reason of at least 20 characters' },
          { status: 400 },
        );
      }
      const propertyId = body.propertyId || body.property_id;
      if (!propertyId) return NextResponse.json({ error: 'propertyId required' }, { status: 400 });
      const lock = await prisma.smartLock.findUnique({ where: { propertyId: String(propertyId) } });
      if (!lock?.deviceId) return NextResponse.json({ error: 'Lock not configured' }, { status: 404 });

      const actionRecord = await prisma.conciergeAction.create({
        data: {
          actorType: 'OWNER',
          actionType: 'REMOTE_UNLOCK',
          targetType: 'PROPERTY',
          targetId: String(propertyId),
          riskLevel: 'CRITICAL',
          requiresApproval: true,
          approvalStatus: 'APPROVED',
          status: 'EXECUTING',
          idempotencyKey: body.idempotencyKey || crypto.randomUUID(),
          inputJson: JSON.stringify({ reason: String(body.reason).trim() }),
          approvedAt: new Date(),
        },
      });

      try {
        await setLockState(lock.deviceId, false);
        await prisma.conciergeAction.update({
          where: { id: actionRecord.id },
          data: { status: 'COMPLETED', executedAt: new Date(), resultJson: JSON.stringify({ unlocked: true }) },
        });
        return NextResponse.json({ success: true, state: 'UNLOCKED', actionId: actionRecord.id });
      } catch (error) {
        await prisma.conciergeAction.update({
          where: { id: actionRecord.id },
          data: {
            status: 'FAILED',
            failureReason: error instanceof Error ? error.message.slice(0, 500) : 'Remote unlock failed',
          },
        });
        throw error;
      }
    }

    if (['program_worker', 'add_worker'].includes(action)) {
      return NextResponse.json(
        {
          error: 'Plaintext worker-code management is disabled. Use managed worker access provisioning.',
          code: 'MANAGED_ACCESS_REQUIRED',
        },
        { status: 409 },
      );
    }

    return NextResponse.json({ error: `Unknown action: ${body.action || ''}` }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Smart-home action failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
