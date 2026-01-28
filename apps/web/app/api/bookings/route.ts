/**
 * Right at Home BnB - Bookings API
 * Full CRUD operations for booking management
 * @author ECHO OMEGA PRIME
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export interface BookingResponse {
  id: string;
  propertyId: string;
  propertyName: string;
  guestId: string;
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  guests: number;
  status: string;
  platform: string;
  totalPrice: number;
  cleaningFee: number | null;
  serviceFee: number | null;
  taxes: number | null;
  nightlyRate: number;
  subtotal: number;
  confirmCode: string | null;
  specialReqs: string | null;
  createdAt: string;
  updatedAt: string;
}

// Calculate nights between two dates
function calculateNights(checkIn: Date, checkOut: Date): number {
  const diffTime = checkOut.getTime() - checkIn.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

// Generate confirmation code
function generateConfirmationCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// GET /api/bookings - List bookings with filters
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const propertyId = searchParams.get('propertyId');
    const guestId = searchParams.get('guestId');
    const status = searchParams.get('status');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const platform = searchParams.get('platform');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    // Build filter conditions
    const where: any = {};

    if (propertyId) {
      where.propertyId = propertyId;
    }

    if (guestId) {
      where.guestId = guestId;
    }

    if (status) {
      where.status = status;
    }

    if (platform) {
      where.platform = platform;
    }

    // Date range filter
    if (startDate || endDate) {
      where.OR = [
        // Bookings that start within the range
        {
          checkIn: {
            gte: startDate ? new Date(startDate) : undefined,
            lte: endDate ? new Date(endDate) : undefined,
          },
        },
        // Bookings that end within the range
        {
          checkOut: {
            gte: startDate ? new Date(startDate) : undefined,
            lte: endDate ? new Date(endDate) : undefined,
          },
        },
        // Bookings that span the entire range
        {
          AND: [
            { checkIn: { lte: startDate ? new Date(startDate) : new Date() } },
            { checkOut: { gte: endDate ? new Date(endDate) : new Date() } },
          ],
        },
      ];
    }

    // Fetch bookings with relations
    const [bookings, total] = await Promise.all([
      prisma.booking.findMany({
        where,
        include: {
          property: {
            select: {
              id: true,
              name: true,
              address: true,
            },
          },
          guest: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
            },
          },
        },
        orderBy: { checkIn: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.booking.count({ where }),
    ]);

    // Transform bookings
    const data: BookingResponse[] = bookings.map((booking) => {
      return {
        id: booking.id,
        propertyId: booking.propertyId,
        propertyName: booking.property.name,
        guestId: booking.guestId,
        guestName: booking.guest.name,
        guestEmail: booking.guest.email,
        guestPhone: booking.guest.phone || '',
        checkIn: booking.checkIn.toISOString(),
        checkOut: booking.checkOut.toISOString(),
        nights: booking.totalNights,
        guests: booking.guestCount,
        status: booking.status,
        platform: booking.platform,
        totalPrice: booking.totalPrice,
        cleaningFee: booking.cleaningFee,
        serviceFee: booking.serviceFee,
        taxes: booking.taxes,
        nightlyRate: booking.nightlyRate,
        subtotal: booking.subtotal,
        confirmCode: booking.confirmCode,
        specialReqs: booking.specialReqs,
        createdAt: booking.createdAt.toISOString(),
        updatedAt: booking.updatedAt.toISOString(),
      };
    });

    return NextResponse.json({
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching bookings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch bookings', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// POST /api/bookings - Create new booking
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      propertyId,
      guestId,
      checkIn,
      checkOut,
      guestCount = 1,
      platform = 'DIRECT',
      nightlyRate,
      cleaningFee = null,
      serviceFee = null,
      taxes = null,
      specialReqs = null,
    } = body;

    // Validate required fields
    if (!propertyId || !guestId || !checkIn || !checkOut || !nightlyRate) {
      return NextResponse.json(
        { error: 'Missing required fields: propertyId, guestId, checkIn, checkOut, nightlyRate' },
        { status: 400 }
      );
    }

    // Check for date conflicts
    const conflictingBookings = await prisma.booking.findMany({
      where: {
        propertyId,
        status: { not: 'CANCELLED' },
        OR: [
          {
            AND: [
              { checkIn: { lte: new Date(checkIn) } },
              { checkOut: { gt: new Date(checkIn) } },
            ],
          },
          {
            AND: [
              { checkIn: { lt: new Date(checkOut) } },
              { checkOut: { gte: new Date(checkOut) } },
            ],
          },
          {
            AND: [
              { checkIn: { gte: new Date(checkIn) } },
              { checkOut: { lte: new Date(checkOut) } },
            ],
          },
        ],
      },
    });

    if (conflictingBookings.length > 0) {
      return NextResponse.json(
        { error: 'Booking conflicts with existing reservation' },
        { status: 409 }
      );
    }

    // Calculate nights and totals
    const totalNights = calculateNights(new Date(checkIn), new Date(checkOut));
    const subtotal = nightlyRate * totalNights;
    const totalPrice = subtotal + (cleaningFee || 0) + (serviceFee || 0) + (taxes || 0);

    // Create booking
    const booking = await prisma.booking.create({
      data: {
        propertyId,
        guestId,
        checkIn: new Date(checkIn),
        checkOut: new Date(checkOut),
        guestCount,
        platform,
        nightlyRate,
        totalNights,
        subtotal,
        cleaningFee,
        serviceFee,
        taxes,
        totalPrice,
        confirmCode: generateConfirmationCode(),
        specialReqs,
        status: 'CONFIRMED',
      },
      include: {
        property: { select: { id: true, name: true } },
        guest: { select: { id: true, name: true, email: true } },
      },
    });

    return NextResponse.json({
      id: booking.id,
      confirmCode: booking.confirmCode,
      propertyName: booking.property.name,
      guestName: booking.guest.name,
      checkIn: booking.checkIn.toISOString(),
      checkOut: booking.checkOut.toISOString(),
      totalPrice: booking.totalPrice,
      status: booking.status,
      createdAt: booking.createdAt.toISOString(),
    }, { status: 201 });

  } catch (error) {
    console.error('Error creating booking:', error);
    return NextResponse.json(
      { error: 'Failed to create booking', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// PATCH /api/bookings - Update booking
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: 'Booking ID is required' }, { status: 400 });
    }

    // Validate booking exists
    const existing = await prisma.booking.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    // Prepare update data
    const updateData: any = {};

    if (updates.status) updateData.status = updates.status;
    if (updates.checkIn) updateData.checkIn = new Date(updates.checkIn);
    if (updates.checkOut) updateData.checkOut = new Date(updates.checkOut);
    if (updates.guestCount) updateData.guestCount = updates.guestCount;
    if (updates.specialReqs !== undefined) updateData.specialReqs = updates.specialReqs;
    if (updates.nightlyRate !== undefined) updateData.nightlyRate = updates.nightlyRate;
    if (updates.cleaningFee !== undefined) updateData.cleaningFee = updates.cleaningFee;
    if (updates.serviceFee !== undefined) updateData.serviceFee = updates.serviceFee;
    if (updates.taxes !== undefined) updateData.taxes = updates.taxes;

    // Recalculate totals if dates or prices changed
    const checkIn = updateData.checkIn || existing.checkIn;
    const checkOut = updateData.checkOut || existing.checkOut;
    const nightlyRate = updateData.nightlyRate ?? existing.nightlyRate;

    if (updateData.checkIn || updateData.checkOut || updateData.nightlyRate !== undefined) {
      updateData.totalNights = calculateNights(new Date(checkIn), new Date(checkOut));
      updateData.subtotal = nightlyRate * updateData.totalNights;
    }

    // Recalculate total price if any price component changed
    if (updateData.subtotal !== undefined || updates.cleaningFee !== undefined ||
        updates.serviceFee !== undefined || updates.taxes !== undefined) {
      const subtotal = updateData.subtotal ?? existing.subtotal;
      const cleaningFee = updateData.cleaningFee ?? existing.cleaningFee ?? 0;
      const serviceFee = updateData.serviceFee ?? existing.serviceFee ?? 0;
      const taxes = updateData.taxes ?? existing.taxes ?? 0;
      updateData.totalPrice = subtotal + cleaningFee + serviceFee + taxes;
    }

    const booking = await prisma.booking.update({
      where: { id },
      data: updateData,
      include: {
        property: { select: { name: true } },
        guest: { select: { name: true } },
      },
    });

    return NextResponse.json({
      id: booking.id,
      status: booking.status,
      propertyName: booking.property.name,
      guestName: booking.guest.name,
      totalPrice: booking.totalPrice,
      updatedAt: booking.updatedAt.toISOString(),
    });

  } catch (error) {
    console.error('Error updating booking:', error);
    return NextResponse.json(
      { error: 'Failed to update booking', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// DELETE /api/bookings - Cancel booking
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Booking ID is required' }, { status: 400 });
    }

    // Soft delete by setting status to cancelled
    const booking = await prisma.booking.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });

    return NextResponse.json({
      id: booking.id,
      status: 'CANCELLED',
      message: 'Booking cancelled successfully',
    });

  } catch (error) {
    console.error('Error cancelling booking:', error);
    return NextResponse.json(
      { error: 'Failed to cancel booking', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
