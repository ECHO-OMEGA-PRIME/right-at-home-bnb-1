/**
 * Right at Home BnB - Properties API
 * Returns real property data from Steven's portfolio
 * @author ECHO OMEGA PRIME
 */

import { NextRequest, NextResponse } from 'next/server';
import { properties, PropertyDetails } from '@/lib/property-knowledge';

// Transform PropertyDetails to Property format expected by frontend
function transformProperty(p: PropertyDetails) {
  // Calculate nightly rate based on amenities and size
  let nightlyRate = 149;
  if (p.bedrooms >= 4) nightlyRate = 249;
  if (p.bedrooms >= 3) nightlyRate = 199;
  if (p.amenities.pool && p.amenities.hotTub) nightlyRate = 349;
  else if (p.amenities.pool || p.amenities.hotTub) nightlyRate = 279;

  return {
    id: p.id,
    name: p.name,
    address: p.address.split(',')[0],
    city: 'Midland',
    state: 'TX',
    zipCode: p.address.includes('79707') ? '79707' : p.address.includes('79705') ? '79705' : '79703',
    propertyType: 'HOUSE' as const,
    bedrooms: p.bedrooms,
    bathrooms: p.bathrooms,
    maxGuests: p.maxGuests,
    nightlyRate,
    status: 'ACTIVE' as const,
    description: p.description,
    amenities: Object.entries(p.amenities)
      .filter(([_, v]) => v === true)
      .map(([k]) => k),
    createdAt: new Date('2024-01-01').toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    // If ID provided, return single property
    if (id) {
      const property = properties.find(p => p.id === id);
      if (!property) {
        return NextResponse.json({ error: 'Property not found' }, { status: 404 });
      }
      return NextResponse.json(transformProperty(property));
    }

    // Return all properties
    const transformedProperties = properties.map(transformProperty);
    return NextResponse.json(transformedProperties);
  } catch (error) {
    console.error('Error fetching properties:', error);
    return NextResponse.json({ error: 'Failed to fetch properties' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    // In production, this would save to Firebase
    // For now, return the body with a generated ID
    return NextResponse.json({
      id: `prop-${Date.now()}`,
      ...body,
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error creating property:', error);
    return NextResponse.json({ error: 'Failed to create property' }, { status: 500 });
  }
}
