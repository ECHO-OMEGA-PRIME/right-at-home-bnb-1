/**
 * Right at Home BnB - iCal Export for Airbnb
 * Airbnb polls this endpoint to sync our calendar
 * @author ECHO OMEGA PRIME
 */

import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Firebase Admin if not already initialized
function getFirestoreAdmin() {
  if (getApps().length === 0) {
    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID || 'echo-prime-ai',
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }),
    });
  }
  return getFirestore();
}

// Format date for iCal (YYYYMMDD)
function formatICalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

// Format datetime for iCal (YYYYMMDDTHHMMSSZ)
function formatICalDateTime(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

// Booking interface for Firestore data
interface BookingData {
  id: string;
  propertyId?: string;
  source?: string;
  checkIn?: string;
  checkOut?: string;
  guestName?: string;
  [key: string]: unknown;
}

export async function GET(
  request: NextRequest,
  { params }: { params: { propertyId: string } }
) {
  try {
    const propertyId = params.propertyId;

    if (!propertyId) {
      return new NextResponse('Property ID required', { status: 400 });
    }

    // Get bookings from Firestore
    const db = getFirestoreAdmin();
    const bookingsRef = db.collection('bookings');

    // Get all non-Airbnb bookings for this property (to avoid duplication)
    const snapshot = await bookingsRef
      .where('propertyId', '==', propertyId)
      .orderBy('checkIn')
      .get();

    const bookings: BookingData[] = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as BookingData));

    // Build iCal content
    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Right at Home BnB//Booking Calendar//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'X-WR-CALNAME:Right at Home BnB Calendar',
      'X-WR-TIMEZONE:America/Chicago',
    ];

    for (const booking of bookings) {
      // Skip Airbnb bookings to prevent circular sync
      if (booking.source === 'airbnb') continue;

      // Skip bookings without valid dates
      if (!booking.checkIn || !booking.checkOut) continue;

      const uid = `rah-${booking.id}@rightathomebnb.com`;
      const checkIn = new Date(booking.checkIn);
      const checkOut = new Date(booking.checkOut);
      const dtstart = formatICalDate(checkIn);
      const dtend = formatICalDate(checkOut);
      const dtstamp = formatICalDateTime(new Date());

      // Use generic "Blocked" summary for privacy
      const summary = `Blocked - ${booking.guestName ? booking.guestName.split(' ')[0] : 'Reserved'}`;
      const description = `Booking from Right at Home BnB\\nSource: ${booking.source || 'direct'}`;

      lines.push(
        'BEGIN:VEVENT',
        `UID:${uid}`,
        `DTSTART;VALUE=DATE:${dtstart}`,
        `DTEND;VALUE=DATE:${dtend}`,
        `DTSTAMP:${dtstamp}`,
        `SUMMARY:${summary}`,
        `DESCRIPTION:${description}`,
        'STATUS:CONFIRMED',
        'TRANSP:OPAQUE',
        'END:VEVENT'
      );
    }

    lines.push('END:VCALENDAR');
    const icalContent = lines.join('\r\n');

    // Return with proper content type for iCal
    return new NextResponse(icalContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': `attachment; filename="property_${propertyId}_airbnb.ics"`,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[iCal Export Error]', error);
    return new NextResponse(`Error generating calendar: ${errorMessage}`, {
      status: 500,
    });
  }
}
