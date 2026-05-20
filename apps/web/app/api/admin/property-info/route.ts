/**
 * Property Info API — Receives property details from Cloudflare Worker questionnaire form.
 * GET  — Retrieve property info fields (single or all)
 * POST — Update property info fields (wifi, parking, check-in/out, rules, etc.)
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

const API_SECRET = process.env.ADMIN_API_SECRET || 'rah-vrbo-sync-2026';

function verifySecret(request: NextRequest): boolean {
  const secret = request.headers.get('x-api-secret');
  return secret === API_SECRET;
}

const INFO_FIELDS = {
  id: true,
  name: true,
  address: true,
  wifiNetwork: true,
  wifiPassword: true,
  parkingInfo: true,
  checkInInstr: true,
  checkOutInstr: true,
  houseRules: true,
} as const;

export async function GET(request: NextRequest) {
  if (!verifySecret(request)) {
    return NextResponse.json({ error: 'Invalid API secret' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const propertyId = searchParams.get('propertyId');

    if (propertyId) {
      const property = await prisma.property.findUnique({
        where: { id: propertyId },
        select: INFO_FIELDS,
      });

      if (!property) {
        return NextResponse.json({ error: 'Property not found' }, { status: 404 });
      }

      return NextResponse.json({ property });
    }

    const properties = await prisma.property.findMany({
      select: INFO_FIELDS,
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({ properties, count: properties.length });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!verifySecret(request)) {
    return NextResponse.json({ error: 'Invalid API secret' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { propertyId, wifiNetwork, wifiPassword, parkingInfo, checkInInstr, checkOutInstr, houseRules } = body;

    if (!propertyId) {
      return NextResponse.json({ error: 'propertyId is required' }, { status: 400 });
    }

    // Build update data with only provided fields
    const data: Record<string, string> = {};
    if (wifiNetwork !== undefined) data.wifiNetwork = wifiNetwork;
    if (wifiPassword !== undefined) data.wifiPassword = wifiPassword;
    if (parkingInfo !== undefined) data.parkingInfo = parkingInfo;
    if (checkInInstr !== undefined) data.checkInInstr = checkInInstr;
    if (checkOutInstr !== undefined) data.checkOutInstr = checkOutInstr;
    if (houseRules !== undefined) data.houseRules = houseRules;

    await prisma.property.update({
      where: { id: propertyId },
      data,
    });

    return NextResponse.json({ ok: true, updated: propertyId });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
