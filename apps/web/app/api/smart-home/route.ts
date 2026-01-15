/**
 * Right at Home BnB - Smart Home Automation API
 * Lock codes, thermostat control, entry logging, notifications
 * @author ECHO OMEGA PRIME
 */

import { NextRequest, NextResponse } from 'next/server';

// Types
interface LockCode {
  id: string;
  propertyId: string;
  code: string;
  type: 'guest' | 'cleaner' | 'maintenance' | 'owner' | 'emergency';
  name: string;
  createdAt: string;
  expiresAt: string | null;
  isActive: boolean;
  bookingId?: string;
  guestName?: string;
}

interface EntryLog {
  id: string;
  propertyId: string;
  codeId: string;
  codeName: string;
  codeType: string;
  timestamp: string;
  action: 'unlock' | 'lock';
  notified: boolean;
}

interface ThermostatSchedule {
  id: string;
  propertyId: string;
  bookingId?: string;
  preConditionTime: string; // Hours before check-in to start
  checkInTemp: number;
  checkOutTemp: number; // Eco/preset temp
  mode: 'heat' | 'cool' | 'auto';
  isActive: boolean;
}

interface PropertyAutomation {
  propertyId: string;
  lockCodes: LockCode[];
  entryLogs: EntryLog[];
  thermostat: {
    currentTemp: number;
    targetTemp: number;
    mode: 'heat' | 'cool' | 'auto' | 'off';
    schedule: ThermostatSchedule | null;
  };
}

// Generate random 6-digit code
function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// In-memory storage (in production, use Firebase/PostgreSQL)
let automationData: Record<string, PropertyAutomation> = {};
let staffCodes: LockCode[] = [
  {
    id: 'staff-cleaner-1',
    propertyId: 'ALL',
    code: '247365',
    type: 'cleaner',
    name: 'Maria Rodriguez (Cleaning)',
    createdAt: new Date().toISOString(),
    expiresAt: null, // Never expires
    isActive: true,
  },
  {
    id: 'staff-maintenance-1',
    propertyId: 'ALL',
    code: '911247',
    type: 'maintenance',
    name: 'Carlos Maintenance',
    createdAt: new Date().toISOString(),
    expiresAt: null,
    isActive: true,
  },
  {
    id: 'staff-owner-1',
    propertyId: 'ALL',
    code: '559190',
    type: 'owner',
    name: 'Steven Palma (Owner)',
    createdAt: new Date().toISOString(),
    expiresAt: null,
    isActive: true,
  },
];

let entryLogs: EntryLog[] = [];

// Initialize property automation data
function getPropertyAutomation(propertyId: string): PropertyAutomation {
  if (!automationData[propertyId]) {
    automationData[propertyId] = {
      propertyId,
      lockCodes: [],
      entryLogs: [],
      thermostat: {
        currentTemp: 72,
        targetTemp: 72,
        mode: 'auto',
        schedule: null,
      },
    };
  }
  return automationData[propertyId];
}

// Send notification to Steven
async function notifySteven(message: string, type: 'entry' | 'code' | 'thermostat' | 'alert') {
  const notification = {
    to: '(432) 559-1904',
    message,
    type,
    timestamp: new Date().toISOString(),
  };

  // In production, integrate with Twilio SMS
  console.log('📱 NOTIFICATION TO STEVEN:', notification);

  // Store notification for dashboard
  return notification;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const propertyId = searchParams.get('propertyId');

    switch (action) {
      case 'codes': {
        if (propertyId) {
          const automation = getPropertyAutomation(propertyId);
          // Combine property-specific codes with staff codes
          const allCodes = [
            ...automation.lockCodes,
            ...staffCodes.filter(c => c.propertyId === 'ALL' || c.propertyId === propertyId)
          ];
          return NextResponse.json({ codes: allCodes });
        }
        // Return all staff codes
        return NextResponse.json({ staffCodes });
      }

      case 'entry-logs': {
        const logs = propertyId
          ? entryLogs.filter(l => l.propertyId === propertyId)
          : entryLogs;
        return NextResponse.json({ logs: logs.slice(-50).reverse() });
      }

      case 'thermostat': {
        if (!propertyId) {
          return NextResponse.json({ error: 'Property ID required' }, { status: 400 });
        }
        const automation = getPropertyAutomation(propertyId);
        return NextResponse.json({ thermostat: automation.thermostat });
      }

      case 'all': {
        return NextResponse.json({
          staffCodes,
          recentLogs: entryLogs.slice(-20).reverse(),
          properties: Object.values(automationData),
        });
      }

      default:
        return NextResponse.json({
          staffCodes,
          totalProperties: Object.keys(automationData).length,
          totalEntryLogs: entryLogs.length,
        });
    }
  } catch (error) {
    console.error('Smart home GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      // Generate guest code for booking
      case 'generate-guest-code': {
        const { propertyId, bookingId, guestName, checkIn, checkOut } = body;

        const code = generateCode();
        const newCode: LockCode = {
          id: `guest-${Date.now()}`,
          propertyId,
          code,
          type: 'guest',
          name: `${guestName} (Guest)`,
          guestName,
          bookingId,
          createdAt: new Date().toISOString(),
          expiresAt: checkOut, // Code expires at checkout
          isActive: true,
        };

        const automation = getPropertyAutomation(propertyId);
        automation.lockCodes.push(newCode);

        await notifySteven(
          `🔑 New guest code generated for ${guestName} at Property ${propertyId}: ${code} (Valid until ${new Date(checkOut).toLocaleDateString()})`,
          'code'
        );

        return NextResponse.json({ success: true, code: newCode });
      }

      // Delete/deactivate code at checkout
      case 'deactivate-guest-code': {
        const { propertyId, bookingId } = body;

        const automation = getPropertyAutomation(propertyId);
        const codeIndex = automation.lockCodes.findIndex(
          c => c.bookingId === bookingId && c.type === 'guest'
        );

        if (codeIndex >= 0) {
          const code = automation.lockCodes[codeIndex];
          code.isActive = false;

          await notifySteven(
            `🔒 Guest code deactivated for ${code.guestName} at Property ${propertyId} (Checkout complete)`,
            'code'
          );

          return NextResponse.json({ success: true, deactivated: code });
        }

        return NextResponse.json({ success: false, error: 'Code not found' });
      }

      // Add/update staff code
      case 'add-staff-code': {
        const { name, type, code, propertyId: propId } = body;

        const newStaffCode: LockCode = {
          id: `staff-${type}-${Date.now()}`,
          propertyId: propId || 'ALL',
          code: code || generateCode(),
          type,
          name,
          createdAt: new Date().toISOString(),
          expiresAt: null,
          isActive: true,
        };

        staffCodes.push(newStaffCode);

        await notifySteven(
          `👤 New ${type} code added: ${name} - Code: ${newStaffCode.code}`,
          'code'
        );

        return NextResponse.json({ success: true, code: newStaffCode });
      }

      // Log entry (when lock is used)
      case 'log-entry': {
        const { propertyId, codeUsed, lockAction } = body;

        // Find whose code was used
        const automation = getPropertyAutomation(propertyId);
        let codeInfo = automation.lockCodes.find(c => c.code === codeUsed && c.isActive);

        if (!codeInfo) {
          codeInfo = staffCodes.find(c => c.code === codeUsed && c.isActive);
        }

        const entry: EntryLog = {
          id: `entry-${Date.now()}`,
          propertyId,
          codeId: codeInfo?.id || 'unknown',
          codeName: codeInfo?.name || 'Unknown Code',
          codeType: codeInfo?.type || 'unknown',
          timestamp: new Date().toISOString(),
          action: lockAction,
          notified: true,
        };

        entryLogs.push(entry);
        automation.entryLogs.push(entry);

        // Notify Steven of entry
        const emoji = codeInfo?.type === 'cleaner' ? '🧹' :
                      codeInfo?.type === 'maintenance' ? '🔧' :
                      codeInfo?.type === 'guest' ? '🏠' :
                      codeInfo?.type === 'owner' ? '👔' : '🚪';

        await notifySteven(
          `${emoji} ${entry.codeName} ${lockAction}ed Property ${propertyId} at ${new Date().toLocaleTimeString()}`,
          'entry'
        );

        return NextResponse.json({ success: true, entry });
      }

      // Schedule thermostat for booking
      case 'schedule-thermostat': {
        const { propertyId, bookingId, checkIn, checkOut, preConditionHours = 3, targetTemp = 72 } = body;

        const automation = getPropertyAutomation(propertyId);

        // Determine mode based on season/current conditions
        const month = new Date().getMonth();
        const mode = month >= 4 && month <= 9 ? 'cool' : 'heat';

        automation.thermostat.schedule = {
          id: `schedule-${Date.now()}`,
          propertyId,
          bookingId,
          preConditionTime: new Date(new Date(checkIn).getTime() - preConditionHours * 60 * 60 * 1000).toISOString(),
          checkInTemp: targetTemp,
          checkOutTemp: 65, // Eco temp
          mode,
          isActive: true,
        };

        await notifySteven(
          `🌡️ Thermostat scheduled for Property ${propertyId}: ${mode} to ${targetTemp}°F starting ${preConditionHours}hrs before check-in`,
          'thermostat'
        );

        return NextResponse.json({ success: true, schedule: automation.thermostat.schedule });
      }

      // Set thermostat to checkout/eco mode
      case 'thermostat-checkout': {
        const { propertyId } = body;

        const automation = getPropertyAutomation(propertyId);
        automation.thermostat.targetTemp = 65; // Eco temp
        automation.thermostat.mode = 'auto';

        if (automation.thermostat.schedule) {
          automation.thermostat.schedule.isActive = false;
        }

        await notifySteven(
          `🌡️ Property ${propertyId} thermostat reset to eco mode (65°F) - Checkout complete`,
          'thermostat'
        );

        return NextResponse.json({ success: true, thermostat: automation.thermostat });
      }

      // Manual thermostat adjustment
      case 'set-thermostat': {
        const { propertyId, targetTemp, mode } = body;

        const automation = getPropertyAutomation(propertyId);
        automation.thermostat.targetTemp = targetTemp;
        if (mode) automation.thermostat.mode = mode;

        return NextResponse.json({ success: true, thermostat: automation.thermostat });
      }

      // Full check-in automation (code + thermostat)
      case 'checkin-automation': {
        const { propertyId, bookingId, guestName, checkIn, checkOut, preConditionHours = 3 } = body;

        // 1. Generate guest code
        const code = generateCode();
        const guestCode: LockCode = {
          id: `guest-${Date.now()}`,
          propertyId,
          code,
          type: 'guest',
          name: `${guestName} (Guest)`,
          guestName,
          bookingId,
          createdAt: new Date().toISOString(),
          expiresAt: checkOut,
          isActive: true,
        };

        const automation = getPropertyAutomation(propertyId);
        automation.lockCodes.push(guestCode);

        // 2. Schedule thermostat
        const month = new Date().getMonth();
        const mode = month >= 4 && month <= 9 ? 'cool' : 'heat';

        automation.thermostat.schedule = {
          id: `schedule-${Date.now()}`,
          propertyId,
          bookingId,
          preConditionTime: new Date(new Date(checkIn).getTime() - preConditionHours * 60 * 60 * 1000).toISOString(),
          checkInTemp: 72,
          checkOutTemp: 65,
          mode,
          isActive: true,
        };

        await notifySteven(
          `✅ Check-in automation set for ${guestName}:\n🔑 Code: ${code}\n🌡️ ${mode} to 72°F starts ${preConditionHours}hrs before check-in`,
          'alert'
        );

        return NextResponse.json({
          success: true,
          guestCode,
          thermostatSchedule: automation.thermostat.schedule,
        });
      }

      // Full checkout automation
      case 'checkout-automation': {
        const { propertyId, bookingId } = body;

        const automation = getPropertyAutomation(propertyId);

        // 1. Deactivate guest code
        const guestCode = automation.lockCodes.find(
          c => c.bookingId === bookingId && c.type === 'guest'
        );
        if (guestCode) {
          guestCode.isActive = false;
        }

        // 2. Reset thermostat
        automation.thermostat.targetTemp = 65;
        automation.thermostat.mode = 'auto';
        if (automation.thermostat.schedule) {
          automation.thermostat.schedule.isActive = false;
        }

        await notifySteven(
          `🏁 Checkout automation complete for Property ${propertyId}:\n🔒 Guest code deactivated\n🌡️ Thermostat reset to 65°F eco mode`,
          'alert'
        );

        return NextResponse.json({
          success: true,
          deactivatedCode: guestCode,
          thermostat: automation.thermostat,
        });
      }

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Smart home POST error:', error);
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 });
  }
}

// DELETE - Remove staff code
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const codeId = searchParams.get('codeId');

    if (!codeId) {
      return NextResponse.json({ error: 'Code ID required' }, { status: 400 });
    }

    const index = staffCodes.findIndex(c => c.id === codeId);
    if (index >= 0) {
      const removed = staffCodes.splice(index, 1)[0];
      await notifySteven(`🗑️ Staff code removed: ${removed.name}`, 'code');
      return NextResponse.json({ success: true, removed });
    }

    return NextResponse.json({ error: 'Code not found' }, { status: 404 });
  } catch (error) {
    console.error('Smart home DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}
