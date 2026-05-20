import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// POST /api/properties/new - Create a new property from onboarding form
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate required fields
    const required = ['name', 'address', 'bedrooms', 'bathrooms', 'maxGuests', 'nightlyRate'];
    const missing = required.filter((f) => body[f] === undefined || body[f] === '' || body[f] === null);
    if (missing.length > 0) {
      return NextResponse.json(
        { error: `Missing required fields: ${missing.join(', ')}` },
        { status: 400 }
      );
    }

    // Build amenities JSON from checkbox selections
    const amenitiesList: string[] = [];
    const amenityKeys = [
      'pool', 'hotTub', 'billiards', 'wifi', 'washerDryer', 'garage',
      'coveredPatio', 'firePit', 'playground', 'smartTv', 'kitchen',
      'bbqGrill', 'fencedYard', 'evCharger', 'securityCameras',
      'smartLocks', 'kingBed', 'workspace',
    ];
    for (const key of amenityKeys) {
      if (body.amenities?.[key]) {
        const label = key
          .replace(/([A-Z])/g, ' $1')
          .replace(/^./, (s: string) => s.toUpperCase())
          .trim();
        amenitiesList.push(label);
      }
    }

    // Build house rules JSON
    const houseRules = {
      maxOccupancy: body.maxOccupancy || body.maxGuests,
      quietHoursStart: body.quietHoursStart || '22:00',
      quietHoursEnd: body.quietHoursEnd || '08:00',
      smokingAllowed: body.smokingAllowed || false,
      petsAllowed: body.petsAllowed || false,
      partiesAllowed: body.partiesAllowed || false,
      checkInTime: body.checkInTime || '15:00',
      checkOutTime: body.checkOutTime || '11:00',
      customRules: body.customRules || '',
    };

    // Build check-in instructions
    const checkInInstr = JSON.stringify({
      lockType: body.lockType || '',
      lockCode: body.lockCode || '',
      gateCode: body.gateCode || '',
      parkingInfo: body.parkingInfo || '',
      specialInstructions: body.checkInNotes || '',
    });

    // Build pricing extras as JSON in the amenities or separate
    const pricingExtras = {
      weekendRate: body.weekendRate || null,
      weeklyDiscount: body.weeklyDiscount || null,
      monthlyDiscount: body.monthlyDiscount || null,
      petFee: body.petFee || null,
      extraGuestFee: body.extraGuestFee || null,
    };

    // Create the property
    const property = await prisma.property.create({
      data: {
        name: body.name,
        address: body.address,
        city: body.city || 'Midland',
        state: body.state || 'TX',
        zipCode: body.zipCode || null,
        bedrooms: parseInt(body.bedrooms, 10),
        bathrooms: parseFloat(body.bathrooms),
        maxGuests: parseInt(body.maxGuests, 10),
        squareFeet: body.squareFeet ? parseInt(body.squareFeet, 10) : null,
        propertyType: body.propertyType || 'HOUSE',
        amenities: JSON.stringify({ list: amenitiesList, extras: pricingExtras }),
        wifiNetwork: body.wifiNetwork || null,
        wifiPassword: body.wifiPassword || null,
        parkingInfo: body.parkingInfo || null,
        checkInInstr: checkInInstr,
        houseRules: JSON.stringify(houseRules),
        nightlyRate: parseFloat(body.nightlyRate),
        cleaningFee: body.cleaningFee ? parseFloat(body.cleaningFee) : null,
        securityDeposit: body.securityDeposit ? parseFloat(body.securityDeposit) : null,
        airbnbId: body.airbnbId || null,
        vrboId: body.vrboId || null,
        status: 'ACTIVE',
      },
    });

    // Create photo records if URLs provided
    const photoUrls: string[] = (body.photoUrls || []).filter((u: string) => u && u.trim());
    if (photoUrls.length > 0) {
      await prisma.propertyPhoto.createMany({
        data: photoUrls.map((url: string, idx: number) => ({
          propertyId: property.id,
          url: url.trim(),
          caption: body.photoCaptions?.[idx] || null,
          isPrimary: idx === 0,
          sortOrder: idx,
        })),
      });
    }

    // Return success with property data
    return NextResponse.json({
      success: true,
      property: {
        id: property.id,
        name: property.name,
        address: property.address,
        city: property.city,
        state: property.state,
      },
      message: `Property "${property.name}" created successfully!`,
    }, { status: 201 });

  } catch (error: any) {
    console.error('[API] Property creation failed:', error);

    // Handle Prisma-specific errors
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'A property with these details already exists.' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to create property', detail: error.message },
      { status: 500 }
    );
  }
}
