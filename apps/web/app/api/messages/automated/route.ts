/**
 * Right at Home BnB - Automated Messages API
 * Endpoint for managing and sending automated guest messages
 * @author ECHO OMEGA PRIME
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  AutomatedMessaging,
  AutomatedMessage,
  GuestInfo,
  BookingInfo,
  PropertyAccessInfo,
  MessageType,
  MessageChannel,
  MessageStatus,
} from '@/lib/automated-messages';

// In-memory storage for demo (replace with database in production)
const messageStore: Map<string, AutomatedMessage[]> = new Map();

// ============================================================================
// GET - List messages or get specific message
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const bookingId = searchParams.get('bookingId');
    const messageId = searchParams.get('messageId');
    const status = searchParams.get('status') as MessageStatus | null;
    const type = searchParams.get('type') as MessageType | null;

    // Get specific message by ID
    if (messageId) {
      for (const messages of Array.from(messageStore.values())) {
        const message = messages.find((m) => m.id === messageId);
        if (message) {
          return NextResponse.json({ success: true, message });
        }
      }
      return NextResponse.json(
        { success: false, error: 'Message not found' },
        { status: 404 }
      );
    }

    // Get messages for a booking
    if (bookingId) {
      const messages = messageStore.get(bookingId) || [];
      let filtered = messages;

      if (status) {
        filtered = filtered.filter((m) => m.status === status);
      }
      if (type) {
        filtered = filtered.filter((m) => m.type === type);
      }

      return NextResponse.json({
        success: true,
        bookingId,
        messages: filtered,
        total: filtered.length,
      });
    }

    // Get all messages (admin view)
    const allMessages: AutomatedMessage[] = [];
    for (const messages of Array.from(messageStore.values())) {
      allMessages.push(...messages);
    }

    let filtered = allMessages;
    if (status) {
      filtered = filtered.filter((m) => m.status === status);
    }
    if (type) {
      filtered = filtered.filter((m) => m.type === type);
    }

    // Sort by scheduled time
    filtered.sort((a, b) => a.scheduledFor.getTime() - b.scheduledFor.getTime());

    return NextResponse.json({
      success: true,
      messages: filtered.slice(0, 100), // Limit to 100 messages
      total: filtered.length,
    });
  } catch (error: any) {
    console.error('[Automated Messages API] GET Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch messages' },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST - Create scheduled messages for a booking
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    // Handle different actions
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
        // Default action: schedule messages
        return handleScheduleMessages(body);
    }
  } catch (error: any) {
    console.error('[Automated Messages API] POST Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to process request' },
      { status: 500 }
    );
  }
}

// ============================================================================
// PUT - Update message (cancel, reschedule, etc.)
// ============================================================================

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { messageId, bookingId, updates } = body;

    if (!messageId || !bookingId) {
      return NextResponse.json(
        { success: false, error: 'messageId and bookingId are required' },
        { status: 400 }
      );
    }

    const messages = messageStore.get(bookingId);
    if (!messages) {
      return NextResponse.json(
        { success: false, error: 'Booking not found' },
        { status: 404 }
      );
    }

    const messageIndex = messages.findIndex((m) => m.id === messageId);
    if (messageIndex === -1) {
      return NextResponse.json(
        { success: false, error: 'Message not found' },
        { status: 404 }
      );
    }

    const message = messages[messageIndex];

    // Apply updates
    if (updates.status) {
      message.status = updates.status;
    }
    if (updates.scheduledFor) {
      message.scheduledFor = new Date(updates.scheduledFor);
    }
    if (updates.content) {
      message.content = updates.content;
    }
    if (updates.channel) {
      message.channel = updates.channel;
    }

    message.updatedAt = new Date();
    messages[messageIndex] = message;
    messageStore.set(bookingId, messages);

    return NextResponse.json({
      success: true,
      message: 'Message updated successfully',
      data: message,
    });
  } catch (error: any) {
    console.error('[Automated Messages API] PUT Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update message' },
      { status: 500 }
    );
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

    if (!bookingId) {
      return NextResponse.json(
        { success: false, error: 'bookingId is required' },
        { status: 400 }
      );
    }

    const messages = messageStore.get(bookingId);
    if (!messages) {
      return NextResponse.json(
        { success: false, error: 'Booking not found' },
        { status: 404 }
      );
    }

    if (messageId) {
      // Delete specific message
      const filtered = messages.filter((m) => m.id !== messageId);
      if (filtered.length === messages.length) {
        return NextResponse.json(
          { success: false, error: 'Message not found' },
          { status: 404 }
        );
      }
      messageStore.set(bookingId, filtered);
      return NextResponse.json({
        success: true,
        message: 'Message deleted successfully',
      });
    } else {
      // Delete all messages for booking
      messageStore.delete(bookingId);
      return NextResponse.json({
        success: true,
        message: 'All messages for booking deleted successfully',
      });
    }
  } catch (error: any) {
    console.error('[Automated Messages API] DELETE Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to delete message' },
      { status: 500 }
    );
  }
}

// ============================================================================
// HANDLER FUNCTIONS
// ============================================================================

async function handleScheduleMessages(body: any) {
  const { bookingId, guest, booking, propertyId, channel = 'email' } = body;

  // Validate required fields
  if (!bookingId || !guest || !booking) {
    return NextResponse.json(
      { success: false, error: 'bookingId, guest, and booking are required' },
      { status: 400 }
    );
  }

  // Get property access info
  let access: PropertyAccessInfo | null = null;
  if (propertyId) {
    access = AutomatedMessaging.getPropertyAccess(propertyId);
  }

  if (!access) {
    // Use booking info to construct access (fallback)
    access = {
      doorCode: booking.doorCode || '****',
      wifiName: booking.wifiName || 'RightAtHome_Guest',
      wifiPassword: booking.wifiPassword || 'Welcome2Midland',
      address: booking.propertyAddress || booking.propertyName,
      parkingInfo: booking.parkingInfo || 'Free parking available on-site.',
      emergencyContact: '(432) 559-1904',
    };
  }

  // Parse dates
  const bookingInfo: BookingInfo = {
    ...booking,
    checkInDate: new Date(booking.checkInDate),
    checkOutDate: new Date(booking.checkOutDate),
  };

  const guestInfo: GuestInfo = {
    ...guest,
    firstName: guest.firstName || guest.name.split(' ')[0],
  };

  // Create scheduled messages
  const messages = AutomatedMessaging.createScheduledMessages(
    bookingId,
    guestInfo,
    bookingInfo,
    access,
    channel as MessageChannel
  );

  // Store messages
  messageStore.set(bookingId, messages);

  return NextResponse.json({
    success: true,
    message: `Scheduled ${messages.length} automated messages`,
    bookingId,
    messages: messages.map((m) => ({
      id: m.id,
      type: m.type,
      scheduledFor: m.scheduledFor,
      status: m.status,
      channel: m.channel,
    })),
  });
}

async function handleSendNow(body: any) {
  const { messageId, bookingId, messageType, guest, booking, propertyId, channel = 'email' } = body;

  // If messageId provided, send that specific message
  if (messageId && bookingId) {
    const messages = messageStore.get(bookingId);
    if (!messages) {
      return NextResponse.json(
        { success: false, error: 'Booking not found' },
        { status: 404 }
      );
    }

    const message = messages.find((m) => m.id === messageId);
    if (!message) {
      return NextResponse.json(
        { success: false, error: 'Message not found' },
        { status: 404 }
      );
    }

    // Simulate sending (replace with actual email/SMS sending)
    const sendResult = await simulateSendMessage(message);

    message.status = sendResult.success ? 'sent' : 'failed';
    message.sentAt = sendResult.success ? new Date() : undefined;
    message.lastError = sendResult.error;
    message.updatedAt = new Date();

    return NextResponse.json({
      success: sendResult.success,
      message: sendResult.success ? 'Message sent successfully' : 'Failed to send message',
      error: sendResult.error,
      data: {
        id: message.id,
        type: message.type,
        status: message.status,
        sentAt: message.sentAt,
      },
    });
  }

  // Generate and send a single message without storing
  if (messageType && guest && booking) {
    let access: PropertyAccessInfo | null = null;
    if (propertyId) {
      access = AutomatedMessaging.getPropertyAccess(propertyId);
    }

    if (!access) {
      access = {
        doorCode: booking.doorCode || '****',
        wifiName: booking.wifiName || 'RightAtHome_Guest',
        wifiPassword: booking.wifiPassword || 'Welcome2Midland',
        address: booking.propertyAddress || booking.propertyName,
        parkingInfo: booking.parkingInfo || 'Free parking available on-site.',
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

    const messageContent = AutomatedMessaging.getSingleMessage(
      messageType as MessageType,
      guestInfo,
      bookingInfo,
      access,
      channel as MessageChannel
    );

    // Simulate sending
    const sendResult = await simulateSendMessage({
      channel,
      content: messageContent.body,
      guest: guestInfo,
    } as any);

    return NextResponse.json({
      success: sendResult.success,
      message: sendResult.success ? 'Message sent successfully' : 'Failed to send message',
      error: sendResult.error,
      content: messageContent,
    });
  }

  return NextResponse.json(
    { success: false, error: 'Invalid request parameters' },
    { status: 400 }
  );
}

async function handlePreview(body: any) {
  const { messageType, guest, booking, propertyId, channel = 'email' } = body;

  if (!messageType || !guest || !booking) {
    return NextResponse.json(
      { success: false, error: 'messageType, guest, and booking are required' },
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
      wifiPassword: booking.wifiPassword || 'Welcome2Midland',
      address: booking.propertyAddress || booking.propertyName || '123 Main St, Midland, TX',
      parkingInfo: booking.parkingInfo || 'Free parking available on-site.',
      emergencyContact: '(432) 559-1904',
    };
  }

  const bookingInfo: BookingInfo = {
    ...booking,
    checkInDate: new Date(booking.checkInDate || Date.now() + 3 * 24 * 60 * 60 * 1000),
    checkOutDate: new Date(booking.checkOutDate || Date.now() + 5 * 24 * 60 * 60 * 1000),
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
  const allMessages: AutomatedMessage[] = [];
  for (const messages of Array.from(messageStore.values())) {
    allMessages.push(...messages);
  }

  const result = await AutomatedMessaging.processQueue(
    allMessages,
    simulateSendMessage
  );

  return NextResponse.json({
    success: true,
    message: `Processed ${result.sent + result.failed} messages`,
    sent: result.sent,
    failed: result.failed,
    results: result.results,
  });
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Simulate sending a message (replace with actual email/SMS service in production)
 */
async function simulateSendMessage(
  message: AutomatedMessage
): Promise<{ success: boolean; error?: string }> {
  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 100));

  // In production, integrate with:
  // - SendGrid/Resend for emails
  // - Twilio for SMS
  // - Platform APIs for Airbnb/VRBO messages

  // Simulate 95% success rate
  const success = Math.random() > 0.05;

  if (!success) {
    return {
      success: false,
      error: 'Simulated delivery failure (random)',
    };
  }

  console.log(`[Automated Messages] Sent ${message.type} message to ${message.guest.email} via ${message.channel}`);

  return { success: true };
}
