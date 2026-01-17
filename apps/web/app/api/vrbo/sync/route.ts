/**
 * Right at Home BnB - VRBO Sync API
 * Handles calendar synchronization with VRBO
 * @author ECHO OMEGA PRIME
 */

import { NextRequest, NextResponse } from 'next/server';

// Sync VRBO calendar for a property
export async function POST(request: NextRequest) {
  try {
    const { listingId } = await request.json();

    if (!listingId) {
      return NextResponse.json(
        { error: 'Missing listingId parameter' },
        { status: 400 }
      );
    }

    // Call the backend sync service
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:8000';
    const response = await fetch(`${backendUrl}/api/vrbo/sync/${listingId}`, {
      method: 'GET',
    });

    if (!response.ok) {
      const error = await response.json();
      return NextResponse.json(
        { error: error.detail || 'Sync failed' },
        { status: response.status }
      );
    }

    const result = await response.json();
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[VRBO Sync Error]', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

// Get sync status
export async function GET(request: NextRequest) {
  try {
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:8000';
    const response = await fetch(`${backendUrl}/api/vrbo/status`);

    if (!response.ok) {
      throw new Error('Failed to get VRBO status');
    }

    const status = await response.json();
    return NextResponse.json(status);
  } catch (error: any) {
    console.error('[VRBO Status Error]', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get status' },
      { status: 500 }
    );
  }
}
