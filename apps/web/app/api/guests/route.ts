/**
 * Right at Home BnB - Guests API
 * Full CRUD operations for guest management
 * @author ECHO OMEGA PRIME
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export interface GuestResponse {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  platform: string;
  platformId: string | null;
  firstStay: string | null;
  lastStay: string | null;
  totalStays: number;
  totalSpent: number;
  avgRating: number | null;
  isVip: boolean;
  vipTier: string | null;
  tags: string | null;
  notes: string | null;
  preferences: string | null;
  birthday: string | null;
  anniversary: string | null;
  createdAt: string;
  updatedAt: string;
}

// GET /api/guests - List guests with filters
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const search = searchParams.get('search');
    const isVip = searchParams.get('isVip');
    const platform = searchParams.get('platform');
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortOrder = searchParams.get('sortOrder') || 'desc';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    // If ID provided, return single guest with full details
    if (id) {
      const guest = await prisma.guest.findUnique({
        where: { id },
        include: {
          bookings: {
            include: {
              property: {
                select: { id: true, name: true },
              },
            },
            orderBy: { checkIn: 'desc' },
            take: 10,
          },
        },
      });

      if (!guest) {
        return NextResponse.json({ error: 'Guest not found' }, { status: 404 });
      }

      return NextResponse.json({
        id: guest.id,
        name: guest.name,
        email: guest.email,
        phone: guest.phone,
        platform: guest.platform,
        platformId: guest.platformId,
        firstStay: guest.firstStay?.toISOString() || null,
        lastStay: guest.lastStay?.toISOString() || null,
        totalStays: guest.totalStays,
        totalSpent: guest.totalSpent,
        avgRating: guest.avgRating,
        isVip: guest.isVip,
        vipTier: guest.vipTier,
        tags: guest.tags,
        notes: guest.notes,
        preferences: guest.preferences,
        birthday: guest.birthday?.toISOString() || null,
        anniversary: guest.anniversary?.toISOString() || null,
        bookings: guest.bookings.map((b) => ({
          id: b.id,
          propertyId: b.propertyId,
          propertyName: b.property.name,
          checkIn: b.checkIn.toISOString(),
          checkOut: b.checkOut.toISOString(),
          status: b.status,
          totalPrice: b.totalPrice,
        })),
        createdAt: guest.createdAt.toISOString(),
        updatedAt: guest.updatedAt.toISOString(),
      });
    }

    // Build filter conditions
    const where: any = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
      ];
    }

    if (isVip === 'true') {
      where.isVip = true;
    }

    if (platform) {
      where.platform = platform;
    }

    // Build sort
    const orderBy: any = {};
    const validSortFields = ['name', 'email', 'totalStays', 'totalSpent', 'lastStay', 'createdAt'];
    if (validSortFields.includes(sortBy)) {
      orderBy[sortBy] = sortOrder;
    } else {
      orderBy.createdAt = 'desc';
    }

    // Fetch guests
    const [guests, total] = await Promise.all([
      prisma.guest.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.guest.count({ where }),
    ]);

    // Transform guests
    const data: GuestResponse[] = guests.map((guest) => ({
      id: guest.id,
      name: guest.name,
      email: guest.email,
      phone: guest.phone,
      platform: guest.platform,
      platformId: guest.platformId,
      firstStay: guest.firstStay?.toISOString() || null,
      lastStay: guest.lastStay?.toISOString() || null,
      totalStays: guest.totalStays,
      totalSpent: guest.totalSpent,
      avgRating: guest.avgRating,
      isVip: guest.isVip,
      vipTier: guest.vipTier,
      tags: guest.tags,
      notes: guest.notes,
      preferences: guest.preferences,
      birthday: guest.birthday?.toISOString() || null,
      anniversary: guest.anniversary?.toISOString() || null,
      createdAt: guest.createdAt.toISOString(),
      updatedAt: guest.updatedAt.toISOString(),
    }));

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
    console.error('Error fetching guests:', error);
    return NextResponse.json(
      { error: 'Failed to fetch guests', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// POST /api/guests - Create new guest
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      name,
      email,
      phone = null,
      platform = 'DIRECT',
      platformId = null,
      isVip = false,
      vipTier = null,
      tags = null,
      notes = null,
      preferences = null,
      birthday = null,
      anniversary = null,
    } = body;

    // Validate required fields
    if (!name || !email) {
      return NextResponse.json(
        { error: 'Missing required fields: name, email' },
        { status: 400 }
      );
    }

    // Check if email already exists
    const existingGuest = await prisma.guest.findUnique({
      where: { email },
    });

    if (existingGuest) {
      return NextResponse.json(
        { error: 'Guest with this email already exists', existingId: existingGuest.id },
        { status: 409 }
      );
    }

    // Create guest
    const guest = await prisma.guest.create({
      data: {
        name,
        email,
        phone,
        platform,
        platformId,
        isVip,
        vipTier,
        tags,
        notes,
        preferences,
        birthday: birthday ? new Date(birthday) : null,
        anniversary: anniversary ? new Date(anniversary) : null,
      },
    });

    return NextResponse.json({
      id: guest.id,
      name: guest.name,
      email: guest.email,
      createdAt: guest.createdAt.toISOString(),
    }, { status: 201 });

  } catch (error) {
    console.error('Error creating guest:', error);
    return NextResponse.json(
      { error: 'Failed to create guest', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// PATCH /api/guests - Update guest
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: 'Guest ID is required' }, { status: 400 });
    }

    // Validate guest exists
    const existing = await prisma.guest.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Guest not found' }, { status: 404 });
    }

    // Check email uniqueness if changing
    if (updates.email && updates.email !== existing.email) {
      const emailExists = await prisma.guest.findUnique({
        where: { email: updates.email },
      });
      if (emailExists) {
        return NextResponse.json({ error: 'Email already in use' }, { status: 409 });
      }
    }

    // Prepare update data
    const updateData: any = {};
    const allowedFields = [
      'name', 'email', 'phone', 'platform', 'platformId',
      'isVip', 'vipTier', 'tags', 'notes', 'preferences',
      'totalStays', 'totalSpent', 'avgRating',
    ];

    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        updateData[field] = updates[field];
      }
    }

    // Handle date fields
    if (updates.birthday !== undefined) {
      updateData.birthday = updates.birthday ? new Date(updates.birthday) : null;
    }
    if (updates.anniversary !== undefined) {
      updateData.anniversary = updates.anniversary ? new Date(updates.anniversary) : null;
    }
    if (updates.firstStay !== undefined) {
      updateData.firstStay = updates.firstStay ? new Date(updates.firstStay) : null;
    }
    if (updates.lastStay !== undefined) {
      updateData.lastStay = updates.lastStay ? new Date(updates.lastStay) : null;
    }

    const guest = await prisma.guest.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      id: guest.id,
      name: guest.name,
      email: guest.email,
      isVip: guest.isVip,
      updatedAt: guest.updatedAt.toISOString(),
    });

  } catch (error) {
    console.error('Error updating guest:', error);
    return NextResponse.json(
      { error: 'Failed to update guest', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// DELETE /api/guests - Delete guest (soft delete by anonymizing)
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Guest ID is required' }, { status: 400 });
    }

    // Check for active bookings
    const activeBookings = await prisma.booking.count({
      where: {
        guestId: id,
        status: { in: ['CONFIRMED', 'PENDING'] },
        checkOut: { gte: new Date() },
      },
    });

    if (activeBookings > 0) {
      return NextResponse.json(
        { error: 'Cannot delete guest with active bookings' },
        { status: 400 }
      );
    }

    // Soft delete by anonymizing
    const guest = await prisma.guest.update({
      where: { id },
      data: {
        name: 'Deleted Guest',
        email: `deleted-${id}@placeholder.local`,
        phone: null,
        platformId: null,
        tags: null,
        notes: 'Guest data deleted per request',
        preferences: null,
        birthday: null,
        anniversary: null,
      },
    });

    return NextResponse.json({
      id: guest.id,
      message: 'Guest data deleted successfully',
    });

  } catch (error) {
    console.error('Error deleting guest:', error);
    return NextResponse.json(
      { error: 'Failed to delete guest', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
