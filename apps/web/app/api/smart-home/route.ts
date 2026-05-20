/**
 * Right at Home BnB - Smart Home Automation API
 * REAL Tuya lock integration + Prisma persistent storage
 * Lock codes, entry logging, thermostat control, notifications
 * @author ECHO OMEGA PRIME
 *
 * Replaces in-memory mock storage with:
 * - Tuya Cloud API for physical lock control (ARPHA D280W)
 * - Prisma/SQLite for persistent code & log storage
 * - Booking model accessCode field for guest code tracking
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { TuyaLockClient, getTuyaLockClient, PROPERTY_LOCK_MAP } from '@/lib/tuya-lock-client';

// ============================================================================
// TYPES
// ============================================================================

interface ThermostatState {
  currentTemp: number;
  targetTemp: number;
  mode: 'heat' | 'cool' | 'auto' | 'off';
}

// Property slug resolver — maps property IDs/names to Tuya lock slugs
function resolvePropertySlug(propertyId: string): string | null {
  const slugMap: Record<string, string> = {
    'garfield': 'garfield',
    'castleford': 'castleford',
    'lincoln-green': 'lincoln-green',
    'lincolngreen': 'lincoln-green',
    'lincoln_green': 'lincoln-green',
  };
  const normalized = propertyId.toLowerCase().replace(/[\s_]+/g, '-');
  return slugMap[normalized] || null;
}

// ============================================================================
// GET — Read lock status, codes, entry logs
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const propertyId = searchParams.get('propertyId');

    switch (action) {
      // Get lock status from Tuya (real-time)
      case 'lock-status': {
        if (!propertyId) {
          return NextResponse.json({ error: 'propertyId required' }, { status: 400 });
        }

        const slug = resolvePropertySlug(propertyId);
        if (!slug) {
          // Property doesn't have a Tuya lock yet
          return NextResponse.json({
            hasLock: false,
            message: `No smart lock configured for property: ${propertyId}`,
          });
        }

        try {
          const tuya = getTuyaLockClient();
          const status = await tuya.getLockStatus(slug);

          // Update Prisma SmartLock record
          await prisma.smartLock.upsert({
            where: { propertyId },
            update: {
              batteryLevel: status.battery_percent,
              isOnline: status.online,
              lastActivity: new Date(),
            },
            create: {
              propertyId,
              brand: 'ARPHA',
              model: 'D280W',
              deviceId: status.device_id,
              batteryLevel: status.battery_percent,
              isOnline: status.online,
              lastActivity: new Date(),
            },
          });

          return NextResponse.json({
            hasLock: true,
            status: {
              locked: status.locked,
              doorClosed: status.door_closed,
              batteryPercent: status.battery_percent,
              online: status.online,
              deviceId: status.device_id,
            },
          });
        } catch (e: any) {
          // If Tuya API fails, return cached data from Prisma
          const cached = await prisma.smartLock.findUnique({ where: { propertyId } });
          if (cached) {
            return NextResponse.json({
              hasLock: true,
              cached: true,
              status: {
                batteryPercent: cached.batteryLevel,
                online: cached.isOnline,
                lastSeen: cached.lastActivity,
              },
              error: e.message,
            });
          }
          return NextResponse.json({ hasLock: false, error: e.message }, { status: 502 });
        }
      }

      // Get all lock statuses across all properties with locks
      case 'all-lock-statuses': {
        try {
          const tuya = getTuyaLockClient();
          const statuses = await tuya.getAllLockStatuses();
          return NextResponse.json({ statuses });
        } catch (e: any) {
          // Fallback to Prisma cached data
          const locks = await prisma.smartLock.findMany();
          return NextResponse.json({
            cached: true,
            statuses: Object.fromEntries(
              locks.map((l) => [l.propertyId, {
                batteryPercent: l.batteryLevel,
                online: l.isOnline,
                lastSeen: l.lastActivity,
                currentCode: l.currentCode ? '******' : null,
              }])
            ),
          });
        }
      }

      // Get active codes for a property (from DB, not Tuya — codes are sensitive)
      case 'codes': {
        if (propertyId) {
          const lock = await prisma.smartLock.findUnique({ where: { propertyId } });
          const activeBookings = await prisma.booking.findMany({
            where: {
              propertyId,
              status: 'CONFIRMED',
              accessCode: { not: null },
              codeExpiresAt: { gt: new Date() },
            },
            include: { guest: { select: { name: true, email: true } } },
          });

          return NextResponse.json({
            lockInfo: lock ? {
              brand: lock.brand,
              model: lock.model,
              batteryLevel: lock.batteryLevel,
              isOnline: lock.isOnline,
            } : null,
            activeCodes: activeBookings.map((b) => ({
              bookingId: b.id,
              guestName: b.guest.name,
              code: b.accessCode,
              expiresAt: b.codeExpiresAt,
              checkIn: b.checkIn,
              checkOut: b.checkOut,
            })),
          });
        }

        // All properties with active codes
        const allActive = await prisma.booking.findMany({
          where: {
            status: 'CONFIRMED',
            accessCode: { not: null },
            codeExpiresAt: { gt: new Date() },
          },
          include: {
            guest: { select: { name: true } },
            property: { select: { name: true } },
          },
        });

        return NextResponse.json({
          activeCodes: allActive.map((b) => ({
            bookingId: b.id,
            propertyName: b.property.name,
            guestName: b.guest.name,
            expiresAt: b.codeExpiresAt,
          })),
        });
      }

      // Get entry logs from Tuya
      case 'entry-logs': {
        if (!propertyId) {
          return NextResponse.json({ error: 'propertyId required' }, { status: 400 });
        }

        const slug = resolvePropertySlug(propertyId);
        if (!slug) {
          return NextResponse.json({ logs: [], message: 'No lock configured' });
        }

        try {
          const tuya = getTuyaLockClient();
          const limit = parseInt(searchParams.get('limit') || '50');
          const logs = await tuya.getEntryLogs(slug, limit);
          return NextResponse.json({ logs, source: 'tuya' });
        } catch (e: any) {
          // Fallback to stored access log
          const lock = await prisma.smartLock.findUnique({ where: { propertyId } });
          const storedLogs = lock?.accessLog ? JSON.parse(lock.accessLog) : [];
          return NextResponse.json({ logs: storedLogs, source: 'cached', error: e.message });
        }
      }

      // List all configured locks
      case 'configured-locks': {
        const locks = await prisma.smartLock.findMany({
          include: { property: { select: { name: true, address: true } } },
        });

        const tuyaConfigured = Object.entries(PROPERTY_LOCK_MAP).map(([slug, info]) => ({
          slug,
          name: info.name,
          deviceId: info.device_id ? '***' + info.device_id.slice(-6) : 'NOT SET',
        }));

        return NextResponse.json({ dbLocks: locks, tuyaConfigured });
      }

      // Health check for the smart home system
      case 'health': {
        try {
          const tuya = getTuyaLockClient();
          const health = await tuya.healthCheck();
          const dbLocks = await prisma.smartLock.count();
          return NextResponse.json({
            tuya: health,
            database: { locks: dbLocks },
            timestamp: new Date().toISOString(),
          });
        } catch (e: any) {
          return NextResponse.json({
            tuya: { ok: false, error: e.message },
            database: { locks: await prisma.smartLock.count() },
            timestamp: new Date().toISOString(),
          });
        }
      }

      // Default: system overview
      default: {
        const lockCount = await prisma.smartLock.count();
        const activeCodeCount = await prisma.booking.count({
          where: {
            accessCode: { not: null },
            codeExpiresAt: { gt: new Date() },
          },
        });

        return NextResponse.json({
          system: 'Right at Home BnB Smart Home',
          locks: lockCount,
          activeCodes: activeCodeCount,
          tuyaProperties: Object.keys(PROPERTY_LOCK_MAP),
          actions: [
            'GET ?action=lock-status&propertyId=garfield',
            'GET ?action=all-lock-statuses',
            'GET ?action=codes&propertyId=garfield',
            'GET ?action=entry-logs&propertyId=garfield',
            'GET ?action=configured-locks',
            'GET ?action=health',
            'POST action=checkin-automation',
            'POST action=checkout-automation',
            'POST action=generate-guest-code',
            'POST action=deactivate-guest-code',
          ],
        });
      }
    }
  } catch (error: any) {
    console.error('[SmartHome GET]', error);
    return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 });
  }
}

// ============================================================================
// POST — Lock code management, automation triggers
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      // Generate guest code and push to physical lock via Tuya
      case 'generate-guest-code': {
        const { propertyId, bookingId, guestName, checkIn, checkOut } = body;

        if (!propertyId || !bookingId || !guestName || !checkIn || !checkOut) {
          return NextResponse.json(
            { error: 'Required: propertyId, bookingId, guestName, checkIn, checkOut' },
            { status: 400 }
          );
        }

        const slug = resolvePropertySlug(propertyId);

        // If property has a Tuya lock, push code to physical device
        if (slug) {
          try {
            const tuya = getTuyaLockClient();
            const result = await tuya.createGuestCode({
              property_slug: slug,
              guest_name: guestName,
              booking_id: bookingId,
              check_in: new Date(checkIn),
              check_out: new Date(checkOut),
            });

            if (result.success) {
              // Store code in booking record
              await prisma.booking.update({
                where: { id: bookingId },
                data: {
                  accessCode: result.code,
                  codeExpiresAt: new Date(checkOut),
                },
              });

              // Update SmartLock record
              await prisma.smartLock.upsert({
                where: { propertyId },
                update: {
                  currentCode: result.code,
                  codeExpiresAt: new Date(checkOut),
                  lastActivity: new Date(),
                },
                create: {
                  propertyId,
                  brand: 'ARPHA',
                  model: 'D280W',
                  deviceId: result.device_id,
                  currentCode: result.code,
                  codeExpiresAt: new Date(checkOut),
                  lastActivity: new Date(),
                },
              });

              // Log to audit trail
              await prisma.auditLog.create({
                data: {
                  action: 'GENERATE_GUEST_CODE',
                  entity: 'SmartLock',
                  entityId: slug,
                  newValues: JSON.stringify({
                    guestName,
                    bookingId,
                    passwordId: result.password_id,
                    activeFrom: result.active_from,
                    activeUntil: result.active_until,
                  }),
                },
              });

              return NextResponse.json({
                success: true,
                code: result.code,
                passwordId: result.password_id,
                activeFrom: result.active_from,
                activeUntil: result.active_until,
                pushedToLock: true,
              });
            }

            return NextResponse.json({ success: false, error: result.error }, { status: 500 });
          } catch (e: any) {
            console.error('[SmartHome] Tuya code generation failed:', e.message);
            return NextResponse.json(
              { success: false, error: `Tuya API error: ${e.message}`, pushedToLock: false },
              { status: 502 }
            );
          }
        }

        // Property doesn't have Tuya lock — generate code in DB only
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        await prisma.booking.update({
          where: { id: bookingId },
          data: {
            accessCode: code,
            codeExpiresAt: new Date(checkOut),
          },
        });

        return NextResponse.json({
          success: true,
          code,
          pushedToLock: false,
          message: 'Code generated but no smart lock configured — manual entry required',
        });
      }

      // Deactivate guest code at checkout
      case 'deactivate-guest-code': {
        const { propertyId, bookingId, passwordId } = body;

        if (!propertyId || !bookingId) {
          return NextResponse.json(
            { error: 'Required: propertyId, bookingId' },
            { status: 400 }
          );
        }

        const slug = resolvePropertySlug(propertyId);
        let tuyaDeleted = false;

        // Delete from physical lock if Tuya is configured
        if (slug && passwordId) {
          try {
            const tuya = getTuyaLockClient();
            await tuya.deleteGuestCode(slug, passwordId);
            tuyaDeleted = true;
          } catch (e: any) {
            console.error('[SmartHome] Tuya code deletion failed:', e.message);
          }
        }

        // Clear code from booking record
        await prisma.booking.update({
          where: { id: bookingId },
          data: {
            accessCode: null,
            codeExpiresAt: null,
          },
        });

        // Update SmartLock record
        if (slug) {
          await prisma.smartLock.updateMany({
            where: { propertyId },
            data: {
              currentCode: null,
              codeExpiresAt: null,
              lastActivity: new Date(),
            },
          });
        }

        await prisma.auditLog.create({
          data: {
            action: 'DEACTIVATE_GUEST_CODE',
            entity: 'SmartLock',
            entityId: slug || propertyId,
            newValues: JSON.stringify({ bookingId, tuyaDeleted }),
          },
        });

        return NextResponse.json({
          success: true,
          tuyaDeleted,
          message: tuyaDeleted
            ? 'Guest code removed from physical lock and database'
            : 'Guest code cleared from database (lock deletion failed or no lock)',
        });
      }

      // Full check-in automation: generate code + push to lock
      case 'checkin-automation': {
        const { propertyId, bookingId, guestName, checkIn, checkOut } = body;

        if (!propertyId || !bookingId || !guestName || !checkIn || !checkOut) {
          return NextResponse.json(
            { error: 'Required: propertyId, bookingId, guestName, checkIn, checkOut' },
            { status: 400 }
          );
        }

        const slug = resolvePropertySlug(propertyId);
        let lockResult = null;

        // 1. Generate and push lock code
        if (slug) {
          try {
            const tuya = getTuyaLockClient();
            lockResult = await tuya.checkInAutomation({
              property_slug: slug,
              guest_name: guestName,
              booking_id: bookingId,
              check_in: new Date(checkIn),
              check_out: new Date(checkOut),
            });

            if (lockResult.success) {
              await prisma.booking.update({
                where: { id: bookingId },
                data: {
                  accessCode: lockResult.code,
                  codeExpiresAt: new Date(checkOut),
                },
              });

              await prisma.smartLock.upsert({
                where: { propertyId },
                update: {
                  currentCode: lockResult.code,
                  codeExpiresAt: new Date(checkOut),
                  lastActivity: new Date(),
                },
                create: {
                  propertyId,
                  brand: 'ARPHA',
                  model: 'D280W',
                  deviceId: lockResult.device_id,
                  currentCode: lockResult.code,
                  codeExpiresAt: new Date(checkOut),
                  lastActivity: new Date(),
                },
              });
            }
          } catch (e: any) {
            console.error('[SmartHome] Check-in lock automation failed:', e.message);
          }
        }

        // 2. Update booking status
        await prisma.booking.update({
          where: { id: bookingId },
          data: { status: 'CHECKED_IN' },
        });

        // 3. Audit log
        await prisma.auditLog.create({
          data: {
            action: 'CHECKIN_AUTOMATION',
            entity: 'Booking',
            entityId: bookingId,
            newValues: JSON.stringify({
              guestName,
              propertyId,
              lockCodePushed: lockResult?.success || false,
              passwordId: lockResult?.password_id,
            }),
          },
        });

        return NextResponse.json({
          success: true,
          lockCode: lockResult?.success ? {
            code: lockResult.code,
            passwordId: lockResult.password_id,
            activeFrom: lockResult.active_from,
            activeUntil: lockResult.active_until,
            pushedToLock: true,
          } : {
            pushedToLock: false,
            reason: slug ? 'Tuya API error' : 'No smart lock configured',
          },
        });
      }

      // Full checkout automation: delete code + reset
      case 'checkout-automation': {
        const { propertyId, bookingId, passwordId } = body;

        if (!propertyId || !bookingId) {
          return NextResponse.json(
            { error: 'Required: propertyId, bookingId' },
            { status: 400 }
          );
        }

        const slug = resolvePropertySlug(propertyId);
        let lockStatus = null;

        // 1. Delete guest code from lock
        if (slug) {
          try {
            const tuya = getTuyaLockClient();
            const result = await tuya.checkOutAutomation(slug, passwordId || 0);
            lockStatus = result;
          } catch (e: any) {
            console.error('[SmartHome] Check-out lock automation failed:', e.message);
          }
        }

        // 2. Clear booking access code
        await prisma.booking.update({
          where: { id: bookingId },
          data: {
            accessCode: null,
            codeExpiresAt: null,
            status: 'CHECKED_OUT',
          },
        });

        // 3. Clear SmartLock current code
        if (slug) {
          await prisma.smartLock.updateMany({
            where: { propertyId },
            data: {
              currentCode: null,
              codeExpiresAt: null,
              lastActivity: new Date(),
            },
          });
        }

        // 4. Auto-schedule cleaning job
        const existingJob = await prisma.cleaningJob.findUnique({
          where: { bookingId },
        });

        if (!existingJob) {
          await prisma.cleaningJob.create({
            data: {
              propertyId,
              bookingId,
              scheduledAt: new Date(),
              jobType: 'TURNOVER',
              status: 'SCHEDULED',
            },
          });
        }

        // 5. Audit log
        await prisma.auditLog.create({
          data: {
            action: 'CHECKOUT_AUTOMATION',
            entity: 'Booking',
            entityId: bookingId,
            newValues: JSON.stringify({
              propertyId,
              codeDeleted: lockStatus?.code_deleted || false,
              lockSecured: lockStatus?.lock_status?.locked || null,
              cleaningScheduled: !existingJob,
            }),
          },
        });

        return NextResponse.json({
          success: true,
          lockResult: lockStatus ? {
            codeDeleted: lockStatus.code_deleted,
            lockStatus: lockStatus.lock_status,
          } : { codeDeleted: false, reason: 'No lock configured' },
          cleaningScheduled: !existingJob,
        });
      }

      // List temp passwords on a lock (from Tuya directly)
      case 'list-temp-passwords': {
        const { propertyId } = body;
        const slug = resolvePropertySlug(propertyId);

        if (!slug) {
          return NextResponse.json({ error: 'No lock for this property' }, { status: 400 });
        }

        const tuya = getTuyaLockClient();
        const passwords = await tuya.listTempPasswords(slug);
        return NextResponse.json({ passwords });
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error: any) {
    console.error('[SmartHome POST]', error);
    return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 });
  }
}
