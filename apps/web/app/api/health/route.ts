import { NextResponse } from 'next/server';
import { getFirebaseClientConfigurationStatus } from '@/lib/firebase-client-config';
import { getFirebaseAdminStatus } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const startedAt = Date.now();
  const clientFirebase = getFirebaseClientConfigurationStatus();
  const adminFirebase = getFirebaseAdminStatus();

  const firebaseHealthy =
    clientFirebase.configured &&
    clientFirebase.projectMatches &&
    adminFirebase.initialized &&
    adminFirebase.projectId === clientFirebase.expectedProjectId;

  const status = firebaseHealthy ? 'healthy' : 'degraded';

  return NextResponse.json(
    {
      status,
      version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) || 'local',
      environment: process.env.VERCEL_ENV || process.env.NODE_ENV || 'development',
      region: process.env.VERCEL_REGION || 'local',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      services: {
        web: 'ok',
        firebase: {
          status: firebaseHealthy ? 'ok' : 'configuration_required',
          expectedProjectId: clientFirebase.expectedProjectId,
          configuredProjectId: clientFirebase.configuredProjectId,
          projectMatches: clientFirebase.projectMatches,
          clientConfigured: clientFirebase.configured,
          adminInitialized: adminFirebase.initialized,
          adminMethod: adminFirebase.method,
        },
        api: process.env.NEXT_PUBLIC_API_URL ? 'configured' : 'not_configured',
      },
      responseTimeMs: Date.now() - startedAt,
    },
    {
      status: firebaseHealthy ? 200 : 503,
      headers: { 'Cache-Control': 'no-store' },
    },
  );
}
