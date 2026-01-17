/**
 * Right at Home BnB - Debug & Diagnostics API
 * ============================================
 * System health check and environment verification
 *
 * @author ECHO OMEGA PRIME
 */

import { NextRequest, NextResponse } from 'next/server';

interface DiagnosticResult {
  timestamp: string;
  environment: string;
  vercel: {
    isVercel: boolean;
    env: string | null;
    region: string | null;
    gitCommit: string | null;
  };
  services: {
    firebase: ServiceStatus;
    groq: ServiceStatus;
    elevenlabs: ServiceStatus;
  };
  envVars: Record<string, boolean>;
  endpoints: EndpointCheck[];
}

interface ServiceStatus {
  configured: boolean;
  status: 'ok' | 'error' | 'unconfigured';
  message: string;
}

interface EndpointCheck {
  name: string;
  path: string;
  status: 'ok' | 'error' | 'unknown';
  responseTime?: number;
}

/**
 * GET /api/debug
 * Returns comprehensive system diagnostics
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();

  // Check for debug authorization (optional - can restrict in production)
  const debugKey = request.headers.get('x-debug-key');
  const isAuthorized = debugKey === process.env.DEBUG_SECRET_KEY || process.env.NODE_ENV === 'development';

  const result: DiagnosticResult = {
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'unknown',
    vercel: {
      isVercel: process.env.VERCEL === '1',
      env: process.env.VERCEL_ENV || null,
      region: process.env.VERCEL_REGION || null,
      gitCommit: process.env.VERCEL_GIT_COMMIT_SHA?.substring(0, 7) || null,
    },
    services: {
      firebase: checkFirebase(),
      groq: checkGroq(),
      elevenlabs: checkElevenLabs(),
    },
    envVars: getEnvStatus(),
    endpoints: [],
  };

  // Run endpoint checks
  result.endpoints = await checkEndpoints(request);

  const totalTime = Date.now() - startTime;

  return NextResponse.json({
    success: true,
    diagnostics: result,
    responseTimeMs: totalTime,
    authorized: isAuthorized,
    debug: isAuthorized ? getDetailedDebug() : undefined,
  });
}

/**
 * POST /api/debug
 * Perform specific diagnostic actions
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'test_firebase':
        return await testFirebaseConnection();
      case 'test_groq':
        return await testGroqConnection();
      case 'test_elevenlabs':
        return await testElevenLabsConnection();
      case 'test_voice':
        return await testVoiceGeneration(body.text || 'Hello, this is a test.');
      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function checkFirebase(): ServiceStatus {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

  if (!apiKey || !projectId) {
    return {
      configured: false,
      status: 'unconfigured',
      message: 'Firebase API key or Project ID not set',
    };
  }

  return {
    configured: true,
    status: 'ok',
    message: `Project: ${projectId}`,
  };
}

function checkGroq(): ServiceStatus {
  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    return {
      configured: false,
      status: 'unconfigured',
      message: 'GROQ_API_KEY not set - Steven AI will use fallback responses',
    };
  }

  return {
    configured: true,
    status: 'ok',
    message: 'Groq API configured',
  };
}

function checkElevenLabs(): ServiceStatus {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const voiceId = process.env.ELEVENLABS_STEVEN_VOICE_ID;

  if (!apiKey) {
    return {
      configured: false,
      status: 'unconfigured',
      message: 'ELEVENLABS_API_KEY not set - Voice output DISABLED',
    };
  }

  return {
    configured: true,
    status: 'ok',
    message: voiceId ? `Voice ID: ${voiceId.substring(0, 8)}...` : 'Using default voice',
  };
}

function getEnvStatus(): Record<string, boolean> {
  return {
    // Public (safe to expose existence)
    NEXT_PUBLIC_FIREBASE_API_KEY: !!process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: !!process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: !!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: !!process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: !!process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    NEXT_PUBLIC_FIREBASE_APP_ID: !!process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    // Server-side (only show boolean)
    GROQ_API_KEY: !!process.env.GROQ_API_KEY,
    ELEVENLABS_API_KEY: !!process.env.ELEVENLABS_API_KEY,
    ELEVENLABS_STEVEN_VOICE_ID: !!process.env.ELEVENLABS_STEVEN_VOICE_ID,
  };
}

async function checkEndpoints(request: NextRequest): Promise<EndpointCheck[]> {
  const baseUrl = new URL(request.url).origin;
  const endpoints = [
    { name: 'Steven AI', path: '/api/steven-ai' },
    { name: 'Automated Messages', path: '/api/messages/automated' },
  ];

  const results: EndpointCheck[] = [];

  for (const ep of endpoints) {
    const start = Date.now();
    try {
      const response = await fetch(`${baseUrl}${ep.path}`, { method: 'GET' });
      results.push({
        name: ep.name,
        path: ep.path,
        status: response.ok ? 'ok' : 'error',
        responseTime: Date.now() - start,
      });
    } catch {
      results.push({
        name: ep.name,
        path: ep.path,
        status: 'error',
        responseTime: Date.now() - start,
      });
    }
  }

  return results;
}

function getDetailedDebug(): Record<string, unknown> {
  return {
    nodeVersion: process.version,
    platform: process.platform,
    memory: process.memoryUsage ? {
      heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB',
      heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + 'MB',
    } : 'unavailable',
  };
}

async function testFirebaseConnection(): Promise<NextResponse> {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!projectId) {
    return NextResponse.json({
      success: false,
      error: 'Firebase not configured',
    });
  }

  // Basic connectivity test
  try {
    const response = await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)`, {
      method: 'GET',
    });

    return NextResponse.json({
      success: true,
      message: 'Firebase project accessible',
      status: response.status,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({
      success: false,
      error: message,
    });
  }
}

async function testGroqConnection(): Promise<NextResponse> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return NextResponse.json({
      success: false,
      error: 'GROQ_API_KEY not configured',
    });
  }

  try {
    const response = await fetch('https://api.groq.com/openai/v1/models', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });

    if (response.ok) {
      return NextResponse.json({
        success: true,
        message: 'Groq API connection successful',
      });
    } else {
      return NextResponse.json({
        success: false,
        error: `Groq API returned ${response.status}`,
      });
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({
      success: false,
      error: message,
    });
  }
}

async function testElevenLabsConnection(): Promise<NextResponse> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return NextResponse.json({
      success: false,
      error: 'ELEVENLABS_API_KEY not configured - THIS IS WHY VOICE IS NOT WORKING',
      fix: 'Add ELEVENLABS_API_KEY to Vercel environment variables',
    });
  }

  try {
    const response = await fetch('https://api.elevenlabs.io/v1/user', {
      headers: {
        'xi-api-key': apiKey,
      },
    });

    if (response.ok) {
      const data = await response.json();
      return NextResponse.json({
        success: true,
        message: 'ElevenLabs API connection successful',
        subscription: data.subscription?.tier || 'unknown',
      });
    } else {
      return NextResponse.json({
        success: false,
        error: `ElevenLabs API returned ${response.status}`,
      });
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({
      success: false,
      error: message,
    });
  }
}

async function testVoiceGeneration(text: string): Promise<NextResponse> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const voiceId = process.env.ELEVENLABS_STEVEN_VOICE_ID || 'keDMh3sQlEXKM4EQxvvi';

  if (!apiKey) {
    return NextResponse.json({
      success: false,
      error: 'ELEVENLABS_API_KEY not configured',
      fix: 'Add ELEVENLABS_API_KEY environment variable in Vercel dashboard',
    });
  }

  try {
    const startTime = Date.now();
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: text.substring(0, 100), // Limit test text
          model_id: 'eleven_v3_alpha',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
          },
        }),
      }
    );

    const responseTime = Date.now() - startTime;

    if (response.ok) {
      const audioBuffer = await response.arrayBuffer();
      return NextResponse.json({
        success: true,
        message: 'Voice generation successful',
        responseTimeMs: responseTime,
        audioSizeBytes: audioBuffer.byteLength,
        voiceId,
      });
    } else {
      const errorText = await response.text();
      return NextResponse.json({
        success: false,
        error: `Voice generation failed: ${response.status}`,
        details: errorText,
      });
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({
      success: false,
      error: message,
    });
  }
}
