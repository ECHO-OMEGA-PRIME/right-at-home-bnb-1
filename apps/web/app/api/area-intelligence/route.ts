import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getAreaIntelligence } from '@/lib/area-intelligence';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  try {
    const intelligence = await getAreaIntelligence();
    return NextResponse.json(intelligence, {
      headers: {
        'Cache-Control': 'private, max-age=300, stale-while-revalidate=600',
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Area intelligence unavailable',
        generatedAt: new Date().toISOString(),
      },
      { status: 503 },
    );
  }
}
