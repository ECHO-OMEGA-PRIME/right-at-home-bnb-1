/**
 * Right at Home BnB - Settings API
 * Stores owner preferences including AI call routing settings
 * @author ECHO OMEGA PRIME
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

// In production, this would be stored in Firebase/PostgreSQL
// For now, using a simple in-memory store that persists via cookies
interface OwnerSettings {
  callRouting: {
    aiCallsEnabled: boolean;
    availabilityMode: 'always' | 'scheduled' | 'manual';
    quietHoursEnabled: boolean;
    quietHoursStart: string;
    quietHoursEnd: string;
    emergencyBypass: boolean;
    emergencyKeywords: string[];
    voicemailEnabled: boolean;
    callForwardNumber: string;
    maxRingsBeforeAI: number;
    aiGreeting: string;
    notifyOnAICall: boolean;
    callTranscriptionEnabled: boolean;
  };
  updatedAt: string;
}

const DEFAULT_SETTINGS: OwnerSettings = {
  callRouting: {
    aiCallsEnabled: false,
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
  },
  updatedAt: new Date().toISOString(),
};

// In-memory storage (in production, use Firebase)
let settingsStore: OwnerSettings = { ...DEFAULT_SETTINGS };

export async function GET(request: NextRequest) {
  try {
    // Try to load from cookie first
    const cookieStore = await cookies();
    const savedSettings = cookieStore.get('rah_settings');

    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings.value);
        settingsStore = { ...DEFAULT_SETTINGS, ...parsed };
      } catch {
        // Invalid cookie, use defaults
      }
    }

    return NextResponse.json(settingsStore);
  } catch (error) {
    console.error('Error fetching settings:', error);
    return NextResponse.json(DEFAULT_SETTINGS);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Merge with existing settings
    settingsStore = {
      ...settingsStore,
      ...body,
      updatedAt: new Date().toISOString(),
    };

    // Create response with cookie
    const response = NextResponse.json({
      success: true,
      settings: settingsStore,
    });

    // Save to cookie (in production, save to database)
    response.cookies.set('rah_settings', JSON.stringify(settingsStore), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 24 * 365, // 1 year
    });

    return response;
  } catch (error) {
    console.error('Error saving settings:', error);
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
  }
}

// API to check current AI status (used by phone system)
export async function PUT(request: NextRequest) {
  try {
    const { action } = await request.json();

    if (action === 'check-ai-status') {
      const settings = settingsStore.callRouting;

      if (!settings.aiCallsEnabled) {
        return NextResponse.json({
          aiActive: false,
          reason: 'AI calls disabled',
          forwardTo: settings.callForwardNumber,
        });
      }

      // Check if currently in quiet hours
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
  } catch (error) {
    console.error('Error checking AI status:', error);
    return NextResponse.json({ error: 'Failed to check AI status' }, { status: 500 });
  }
}
