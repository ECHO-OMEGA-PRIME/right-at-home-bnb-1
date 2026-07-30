/**
 * Weather API for Right at Home BnB
 * GET /api/weather - Get weather for Midland, TX (79705)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getWeather, checkWeatherImpact } from '@/lib/weather';
import { requireOneOfRoles } from '@/lib/api-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = await requireOneOfRoles(request, ['owner', 'admin']);
  if (auth.error) return auth.error;
  console.log('[Weather API] Fetching weather for 79705...');

  try {
    const weather = await getWeather();

    if (!weather) {
      return NextResponse.json(
        { success: false, error: 'Failed to fetch weather data' },
        { status: 500 }
      );
    }

    // Check for weather impacts on operations
    const warnings = checkWeatherImpact(weather);

    return NextResponse.json({
      success: true,
      data: weather,
      warnings,
      hasWarnings: warnings.length > 0
    });
  } catch (error) {
    console.error('[Weather API] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
