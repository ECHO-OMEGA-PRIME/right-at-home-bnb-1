/**
 * Right at Home BnB - Automated Messages API
 * Manages and sends automated guest messages
 * Uses Prisma for persistent storage (replaces in-memory Map)
 * @author ECHO OMEGA PRIME
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendSMS } from '@/lib/twilio';
import {
  AutomatedMessaging,
  GuestInfo,
  BookingInfo,
  PropertyAccessInfo,
  MessageType,
  MessageChannel,
  MessageStatus,
} from '@/lib/automated-messages';

// ============================================================================
// GET - List messages or get specific message
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const bookingId = searchParams.get('bookingId');
    const messageId = searchParams.get('messageId');
    const status = searchParams.get('status');
    const type = searchParams.get('type');

    // Get specific message by ID
    if (messageId) {
      const message = await prisma.message.findUnique({
        where: { id: messageId },
        include: {
          guest: { select: { name: true, email: true, phone: true } },
          booking: { select: { id: true, checkIn: true, checkOut: true } },
        },
      });

      if (!message) {
        return NextResponse.json({ success: false, error: 'Message not found' }, { status: 404 });
      }

      return NextResponse.json({ success: true, message });
    }

    // Build filter
    const where: any = {};
    if (bookingId) where.bookingId = bookingId;
    if (status) where.status = status;
    if (type) where.type = type;

    const messages = await prisma.message.findMany({
      where,
      include: {
        guest: { select: { name: true, email: true } },
      },
      orderBy: { scheduledFor: 'asc' },
      take: 100,
    });

    return NextResponse.json({
      success: true,
      messages,
      total: messages.length,
    });
  } catch (error: any) {
    console.error('[Automated Messages GET]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// ============================================================================
// POST - Create scheduled messages for a booking
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'schedule':
        return handleScheduleMessages(body);
      case 'send_now':
        return handleSendNow(body);
      case 'preview':
        return handlePreview(body);
      case 'process_queue':
        return handleProcessQueue();
      default:
        return handleScheduleMessages(body);
    }
  } catch (error: any) {
    console.error('[Automated Messages POST]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// ============================================================================
// PUT - Update message (cancel, reschedule, etc.)
// ============================================================================

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { messageId, updates } = body;

    if (!messageId) {
      return NextResponse.json({ success: false, error: 'messageId required' }, { status: 400 });
    }

    const data: any = {};
    if (updates.status) data.status = updates.status;
    if (updates.scheduledFor) data.scheduledFor = new Date(updates.scheduledFor);
    if (updates.body) data.body = updates.body;
    if (updates.channel) data.channel = updates.channel;

    const message = await prisma.message.update({
      where: { id: messageId },
      data,
    });

    return NextResponse.json({ success: true, message: 'Updated', data: message });
  } catch (error: any) {
    console.error('[Automated Messages PUT]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// ============================================================================
// DELETE - Cancel/delete scheduled messages
// ============================================================================

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const messageId = searchParams.get('messageId');
    const bookingId = searchParams.get('bookingId');

    if (messageId) {
      await prisma.message.delete({ where: { id: messageId } });
      return NextResponse.json({ success: true, message: 'Message deleted' });
    }

    if (bookingId) {
      const result = await prisma.message.deleteMany({
        where: { bookingId, status: { in: ['DRAFT', 'SCHEDULED'] } },
      });
      return NextResponse.json({
        success: true,
        message: `Deleted ${result.count} scheduled messages for booking`,
      });
    }

    return NextResponse.json({ success: false, error: 'messageId or bookingId required' }, { status: 400 });
  } catch (error: any) {
    console.error('[Automated Messages DELETE]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// ============================================================================
// HANDLER FUNCTIONS
// ============================================================================

async function handleScheduleMessages(body: any) {
  const { bookingId, guest, booking, propertyId, channel = 'EMAIL' } = body;

  if (!bookingId || !guest || !booking) {
    return NextResponse.json(
      { success: false, error: 'bookingId, guest, and booking required' },
      { status: 400 }
    );
  }

  // Resolve property access info
  let access: PropertyAccessInfo | null = null;
  if (propertyId) {
    access = AutomatedMessaging.getPropertyAccess(propertyId);
  }
  if (!access) {
    // Get from booking's property in DB
    const dbBooking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { property: true },
    });
    if (dbBooking?.property) {
      access = {
        doorCode: dbBooking.accessCode || '****',
        wifiName: dbBooking.property.wifiNetwork || 'RightAtHome_Guest',
        wifiPassword: dbBooking.property.wifiPassword || '',
        address: dbBooking.property.address,
        parkingInfo: dbBooking.property.parkingInfo || 'Free parking available on-site.',
        emergencyContact: '(432) 559-1904',
      };
    }
  }
  if (!access) {
    access = {
      doorCode: booking.doorCode || '****',
      wifiName: booking.wifiName || 'RightAtHome_Guest',
      wifiPassword: booking.wifiPassword || '',
      address: booking.propertyAddress || booking.propertyName,
      parkingInfo: 'Free parking available on-site.',
      emergencyContact: '(432) 559-1904',
    };
  }

  const bookingInfo: BookingInfo = {
    ...booking,
    checkInDate: new Date(booking.checkInDate),
    checkOutDate: new Date(booking.checkOutDate),
  };

  const guestInfo: GuestInfo = {
    ...guest,
    firstName: guest.firstName || guest.name.split(' ')[0],
  };

  // Generate message content using the messaging system
  const scheduledMessages = AutomatedMessaging.createScheduledMessages(
    bookingId,
    guestInfo,
    bookingInfo,
    access,
    channel as MessageChannel
  );

  // Ensure guest exists in DB
  let dbGuest = await prisma.guest.findFirst({
    where: { email: guest.email },
  });
  if (!dbGuest) {
    dbGuest = await prisma.guest.create({
      data: {
        email: guest.email,
        name: guest.name,
        phone: guest.phone || null,
        platform: guest.platform || 'DIRECT',
      },
    });
  }

  // Store each message in Prisma
  const created = [];
  for (const msg of scheduledMessages) {
    const dbMsg = await prisma.message.create({
      data: {
        guestId: dbGuest.id,
        bookingId,
        type: msg.type.toUpperCase(),
        channel: channel.toUpperCase(),
        subject: msg.content?.subject || `${msg.type} message`,
        body: msg.content?.body || msg.content?.smsBody || '',
        status: 'SCHEDULED',
        scheduledFor: msg.scheduledFor,
      },
    });
    created.push({
      id: dbMsg.id,
      type: dbMsg.type,
      scheduledFor: dbMsg.scheduledFor,
      status: dbMsg.status,
      channel: dbMsg.channel,
    });
  }

  return NextResponse.json({
    success: true,
    message: `Scheduled ${created.length} automated messages`,
    bookingId,
    messages: created,
  });
}

async function handleSendNow(body: any) {
  const { messageId } = body;

  if (!messageId) {
    return NextResponse.json({ success: false, error: 'messageId required' }, { status: 400 });
  }

  const message = await prisma.message.findUnique({
    where: { id: messageId },
    include: { guest: true },
  });

  if (!message) {
    return NextResponse.json({ success: false, error: 'Message not found' }, { status: 404 });
  }

  // Send via real channel (Twilio SMS or Email API)
  let sendError: string | null = null;

  try {
    if (message.channel === 'SMS' && message.guest.phone) {
      const smsResult = await sendSMS(message.guest.phone, message.body);
      if (!smsResult.success) {
        sendError = smsResult.error || 'SMS send failed';
      }
    } else if (message.channel === 'EMAIL' && message.guest.email) {
      const emailRes = await fetch(new URL('/api/email/send', process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: message.guest.email,
          subject: message.subject || `Right at Home BnB - ${message.type}`,
          html: message.body,
          from: 'Right at Home BnB <noreply@rah-midland.com>',
        }),
      });
      if (!emailRes.ok) {
        const errData = await emailRes.json().catch(() => ({}));
        sendError = errData.error || `Email API returned ${emailRes.status}`;
      }
    } else {
      sendError = `No ${message.channel === 'SMS' ? 'phone' : 'email'} for guest ${message.guest.name}`;
    }
  } catch (e: any) {
    sendError = e.message || 'Send failed';
  }

  const updated = await prisma.message.update({
    where: { id: messageId },
    data: {
      status: sendError ? 'FAILED' : 'SENT',
      sentAt: sendError ? undefined : new Date(),
    },
  });

  if (sendError) {
    console.error(`[Automated Messages] Failed to send ${message.type} to ${message.guest.email}: ${sendError}`);
    return NextResponse.json({ success: false, error: sendError, data: { id: updated.id, status: updated.status } }, { status: 500 });
  }

  console.log(`[Automated Messages] Sent ${message.type} to ${message.guest.email} via ${message.channel}`);

  return NextResponse.json({
    success: true,
    message: 'Message sent',
    data: {
      id: updated.id,
      type: updated.type,
      status: updated.status,
      sentAt: updated.sentAt,
    },
  });
}

async function handlePreview(body: any) {
  const { messageType, guest, booking, propertyId, channel = 'EMAIL' } = body;

  if (!messageType || !guest || !booking) {
    return NextResponse.json(
      { success: false, error: 'messageType, guest, and booking required' },
      { status: 400 }
    );
  }

  let access: PropertyAccessInfo | null = null;
  if (propertyId) {
    access = AutomatedMessaging.getPropertyAccess(propertyId);
  }
  if (!access) {
    access = {
      doorCode: booking.doorCode || '1234',
      wifiName: booking.wifiName || 'RightAtHome_Guest',
      wifiPassword: booking.wifiPassword || '',
      address: booking.propertyAddress || '123 Main St, Midland, TX',
      parkingInfo: 'Free parking available on-site.',
      emergencyContact: '(432) 559-1904',
    };
  }

  const bookingInfo: BookingInfo = {
    ...booking,
    checkInDate: new Date(booking.checkInDate || Date.now() + 3 * 86400000),
    checkOutDate: new Date(booking.checkOutDate || Date.now() + 5 * 86400000),
  };

  const guestInfo: GuestInfo = {
    name: guest.name || 'John Doe',
    firstName: guest.firstName || guest.name?.split(' ')[0] || 'John',
    email: guest.email || 'guest@example.com',
    phone: guest.phone || '(555) 123-4567',
    platform: guest.platform || 'direct',
  };

  const messageContent = AutomatedMessaging.getSingleMessage(
    messageType as MessageType,
    guestInfo,
    bookingInfo,
    access,
    channel as MessageChannel
  );

  const schedule = AutomatedMessaging.calculateSchedule(bookingInfo);

  return NextResponse.json({
    success: true,
    preview: {
      type: messageType,
      channel,
      scheduledFor: schedule[messageType as MessageType],
      subject: messageContent.subject,
      body: messageContent.body,
      smsBody: messageContent.smsBody,
    },
  });
}

async function handleProcessQueue() {
  // Find all scheduled messages that are due
  const dueMessages = await prisma.message.findMany({
    where: {
      status: 'SCHEDULED',
      scheduledFor: { lte: new Date() },
    },
    include: { guest: true },
    take: 50,
  });

  let sent = 0;
  let failed = 0;

  for (const msg of dueMessages) {
    try {
      console.log(`[Queue] Sending ${msg.type} to ${msg.guest.email || msg.guest.phone}`);

      let sendOk = false;

      if (msg.channel === 'SMS' && msg.guest.phone) {
        const result = await sendSMS(msg.guest.phone, msg.body);
        sendOk = result.success;
        if (!sendOk) console.error(`[Queue] SMS failed for ${msg.id}: ${result.error}`);
      } else if (msg.channel === 'EMAIL' && msg.guest.email) {
        const emailRes = await fetch(new URL('/api/email/send', process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: msg.guest.email,
            subject: msg.subject || `Right at Home BnB - ${msg.type}`,
            html: msg.body,
            from: 'Right at Home BnB <noreply@rah-midland.com>',
          }),
        });
        sendOk = emailRes.ok;
        if (!sendOk) console.error(`[Queue] Email failed for ${msg.id}: ${emailRes.status}`);
      } else {
        // No valid channel/contact — mark failed
        console.warn(`[Queue] No contact info for ${msg.id}, channel=${msg.channel}`);
      }

      await prisma.message.update({
        where: { id: msg.id },
        data: sendOk ? { status: 'SENT', sentAt: new Date() } : { status: 'FAILED' },
      });
      if (sendOk) sent++;
      else failed++;
    } catch (e: any) {
      console.error(`[Queue] Failed to send ${msg.id}:`, e.message);
      await prisma.message.update({
        where: { id: msg.id },
        data: { status: 'FAILED' },
      });
      failed++;
    }
  }

  return NextResponse.json({
    success: true,
    message: `Processed ${sent + failed} messages`,
    sent,
    failed,
    pending: dueMessages.length - sent - failed,
  });
}
