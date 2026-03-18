import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const start = Date.now();

  const health = {
    status: 'healthy',
    version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || 'local',
    environment: process.env.VERCEL_ENV || process.env.NODE_ENV || 'development',
    region: process.env.VERCEL_REGION || 'local',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    services: {
      web: 'ok',
      firebase: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ? 'configured' : 'not_configured',
      stripe: process.env.STRIPE_SECRET_KEY ? 'configured' : 'not_configured',
      twilio: process.env.TWILIO_ACCOUNT_SID ? 'configured' : 'not_configured',
      vrbo: process.env.VRBO_API_KEY ? 'configured' : 'not_configured',
    },
    responseTimeMs: Date.now() - start,
  };

  return NextResponse.json(health, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
