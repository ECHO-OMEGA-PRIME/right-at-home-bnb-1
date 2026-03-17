/**
 * VRBO Guest Messaging Bridge
 */
import { NextRequest, NextResponse } from 'next/server';
import { fetchMessages, sendMessage } from '@/lib/integrations/vrbo-client';

export async function GET(request: NextRequest) {
  const params = new URL(request.url).searchParams;
  const listingId = params.get('listingId');
  const reservationId = params.get('reservationId');
  if (!listingId || !reservationId) {
    return NextResponse.json({ error: 'listingId and reservationId are required' }, { status: 400 });
  }
  try {
    const messages = await fetchMessages(listingId, reservationId);
    return NextResponse.json({ messages, count: messages.length, reservationId, platform: 'vrbo' });
  } catch (error) {
    console.error('VRBO message fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { listingId, reservationId, content, source } = body;
    if (!listingId || !reservationId || !content) {
      return NextResponse.json({ error: 'listingId, reservationId, and content are required' }, { status: 400 });
    }
    const sender = source || 'steven';
    const success = await sendMessage(listingId, reservationId, content);
    if (!success) {
      return NextResponse.json({ error: 'Failed to send message via VRBO' }, { status: 502 });
    }
    await fetch(
      `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/api/concierge/chat`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `[OUTBOUND via VRBO] ${content}`,
          conversationId: `vrbo_${reservationId}`,
          channel: 'vrbo', sender, reservationId,
        }),
      }
    );
    return NextResponse.json({ success: true, platform: 'vrbo', sender, reservationId, sentAt: new Date().toISOString() });
  } catch (error) {
    console.error('VRBO message send error:', error);
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 });
  }
}
