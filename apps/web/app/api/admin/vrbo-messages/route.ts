/**
 * VRBO Messages API — Receives scraped messages from CDP scraper and stores in DB.
 * GET — List recent VRBO messages
 * POST — Ingest scraped messages from the CDP message scraper
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

const API_SECRET = process.env.ADMIN_API_SECRET || 'rah-vrbo-sync-2026';

function verifySecret(request: NextRequest): boolean {
  const secret = request.headers.get('x-api-secret');
  return secret === API_SECRET;
}

export async function GET(request: NextRequest) {
  if (!verifySecret(request)) {
    const cookie = request.cookies.get('rah-auth-token')?.value;
    if (!cookie) return NextResponse.json({ error: 'Auth required' }, { status: 401 });
  }

  try {
    const messages = await prisma.message.findMany({
      where: { channel: 'VRBO' },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        guest: { select: { name: true, email: true } },
        booking: { select: { confirmCode: true, checkIn: true, checkOut: true, property: { select: { name: true } } } },
      },
    });

    return NextResponse.json({
      messages,
      count: messages.length,
      lastUpdated: messages[0]?.createdAt || null,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!verifySecret(request)) {
    return NextResponse.json({ error: 'Invalid API secret' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const scraped = body.messages || [];

    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const msg of scraped) {
      try {
        // Find the guest by name
        let guest = await prisma.guest.findFirst({
          where: { name: msg.guestName, platform: 'VRBO' },
        });

        if (!guest) {
          // Create guest placeholder
          guest = await prisma.guest.create({
            data: {
              email: `vrbo-msg-${Date.now()}@rah-midland.com`,
              name: msg.guestName || 'Unknown Guest',
              platform: 'VRBO',
              platformId: msg.threadId || `msg-${Date.now()}`,
            },
          });
        }

        // Check if this message already exists (by content hash)
        const contentHash = `vrbo-${msg.guestName}-${msg.preview?.slice(0, 50)}`;
        const existing = await prisma.message.findFirst({
          where: {
            guestId: guest.id,
            channel: 'VRBO',
            body: { startsWith: msg.preview?.slice(0, 50) || '' },
          },
        });

        if (existing) {
          skipped++;
          continue;
        }

        // Find related booking
        const booking = await prisma.booking.findFirst({
          where: { guestId: guest.id, platform: 'VRBO' },
          orderBy: { checkIn: 'desc' },
        });

        await prisma.message.create({
          data: {
            guestId: guest.id,
            bookingId: booking?.id || null,
            type: msg.isUnread ? 'INQUIRY' : 'GENERAL',
            channel: 'VRBO',
            subject: `VRBO message from ${msg.guestName}`,
            body: msg.preview || msg.text || '',
            status: msg.isUnread ? 'RECEIVED' : 'READ',
            sentAt: msg.date ? new Date(msg.date) : new Date(),
          },
        });
        imported++;
      } catch (err: any) {
        errors.push(`${msg.guestName}: ${err.message}`);
      }
    }

    return NextResponse.json({
      ok: true,
      imported,
      skipped,
      errors: errors.length > 0 ? errors : undefined,
      total: scraped.length,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
