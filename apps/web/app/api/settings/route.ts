/**
 * Right at Home BnB - Settings API
 * Stores owner preferences including AI call routing settings
 * Uses Prisma Setting model for persistent storage
 * @author ECHO OMEGA PRIME
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Default call routing settings
const DEFAULT_CALL_ROUTING = {
  aiCallsEnabled: false,
  aiAssistantEnabled: true,
  availabilityMode: 'scheduled',
  quietHoursEnabled: true,
  quietHoursStart: '22:00',
  quietHoursEnd: '07:00',
  emergencyBypass: true,
  emergencyKeywords: ['emergency', 'urgent', 'help', 'fire', 'flood', 'locked out', 'police'],
  voicemailEnabled: true,
  callForwardNumber: '(432) 559-1904',
  maxRingsBeforeAI: 4,
  aiGreeting: "Hello! You've reached Right at Home BnB. I'm the AI concierge assistant. How can I help you today?",
  notifyOnAICall: true,
  callTranscriptionEnabled: true,
  aiEscalateKeywords: ['speak to someone', 'talk to steven', 'real person', 'human', 'manager', 'complaint', 'refund'],
  maxAiTurns: 3,
};

async function getSettings() {
  const rows = await prisma.setting.findMany({
    where: {
      key: { startsWith: 'callRouting.' },
    },
  });

  if (rows.length === 0) {
    return { callRouting: DEFAULT_CALL_ROUTING, updatedAt: new Date().toISOString() };
  }

  // Build settings from individual keys
  const callRouting: Record<string, any> = { ...DEFAULT_CALL_ROUTING };
  let updatedAt = new Date().toISOString();

  for (const row of rows) {
    const field = row.key.replace('callRouting.', '');
    try {
      callRouting[field] = JSON.parse(row.value);
    } catch {
      callRouting[field] = row.value;
    }
    updatedAt = row.updatedAt.toISOString();
  }

  return { callRouting, updatedAt };
}

export async function GET() {
  try {
    const settings = await getSettings();
    return NextResponse.json(settings);
  } catch (error: any) {
    console.error('[Settings GET]', error);
    // Return defaults on error so the app doesn't break
    return NextResponse.json({
      callRouting: DEFAULT_CALL_ROUTING,
      updatedAt: new Date().toISOString(),
    });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const callRouting = body.callRouting || body;

    // Save each setting as a key-value pair in Prisma
    for (const [key, value] of Object.entries(callRouting)) {
      const settingKey = `callRouting.${key}`;
      const settingValue = typeof value === 'string' ? value : JSON.stringify(value);

      await prisma.setting.upsert({
        where: { key: settingKey },
        update: { value: settingValue },
        create: { key: settingKey, value: settingValue },
      });
    }

    const settings = await getSettings();

    return NextResponse.json({
      success: true,
      settings,
    });
  } catch (error: any) {
    console.error('[Settings POST]', error);
    return NextResponse.json({ error: error.message || 'Failed to save settings' }, { status: 500 });
  }
}

// Check current AI status (used by phone system)
export async function PUT(request: NextRequest) {
  try {
    const { action } = await request.json();

    if (action === 'check-ai-status') {
      const { callRouting: settings } = await getSettings();

      if (!settings.aiCallsEnabled) {
        return NextResponse.json({
          aiActive: false,
          reason: 'AI calls disabled',
          forwardTo: settings.callForwardNumber,
        });
      }

      if (settings.availabilityMode === 'scheduled' && settings.quietHoursEnabled) {
        const now = new Date();
        const currentMinutes = now.getHours() * 60 + now.getMinutes();
        const [startH, startM] = settings.quietHoursStart.split(':').map(Number);
        const [endH, endM] = settings.quietHoursEnd.split(':').map(Number);
        const startMinutes = startH * 60 + startM;
        const endMinutes = endH * 60 + endM;

        const isQuietHours = startMinutes > endMinutes
          ? currentMinutes >= startMinutes || currentMinutes < endMinutes
          : currentMinutes >= startMinutes && currentMinutes < endMinutes;

        return NextResponse.json({
          aiActive: isQuietHours,
          reason: isQuietHours ? 'Quiet hours active' : 'Outside quiet hours',
          forwardTo: settings.callForwardNumber,
          greeting: settings.aiGreeting,
          emergencyKeywords: settings.emergencyKeywords,
          emergencyBypass: settings.emergencyBypass,
        });
      }

      if (settings.availabilityMode === 'always') {
        return NextResponse.json({
          aiActive: true,
          reason: 'AI always on',
          forwardTo: settings.callForwardNumber,
          greeting: settings.aiGreeting,
          emergencyKeywords: settings.emergencyKeywords,
          emergencyBypass: settings.emergencyBypass,
        });
      }

      return NextResponse.json({
        aiActive: false,
        reason: 'Manual mode - AI not active',
        forwardTo: settings.callForwardNumber,
      });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error: any) {
    console.error('[Settings PUT]', error);
    return NextResponse.json({ error: error.message || 'Failed to check AI status' }, { status: 500 });
  }
}
