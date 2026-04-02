/**
 * Right at Home BnB — Database Seed Script
 * Seeds 22 properties from property-knowledge.ts into Supabase PostgreSQL
 * Run: npx ts-node prisma/seed.ts
 * @author ECHO OMEGA PRIME
 */

import { PrismaClient } from '@prisma/client';
import { properties } from '../src/lib/property-knowledge';
import { propertyImages } from '../src/lib/property-images';

const prisma = new PrismaClient();

async function main() {
  console.log('🏠 Seeding Right at Home BnB database...');
  console.log(`   Properties to seed: ${properties.length}`);

  // Create admin user (Steven)
  const steven = await prisma.user.upsert({
    where: { email: 'sp3158@sbcglobal.net' },
    update: {},
    create: {
      email: 'sp3158@sbcglobal.net',
      name: 'Steven Palma',
      role: 'ADMIN',
    },
  });
  console.log(`   ✅ Admin user: ${steven.name} (${steven.id})`);

  // Seed all 22 properties
  let created = 0;
  let skipped = 0;

  for (const prop of properties) {
    const existing = await prisma.property.findFirst({
      where: { name: prop.name },
    });

    if (existing) {
      skipped++;
      continue;
    }

    // Calculate nightly rate based on amenities
    let nightlyRate = 149;
    if (prop.bedrooms >= 4) nightlyRate = 249;
    else if (prop.bedrooms >= 3) nightlyRate = 199;
    if (prop.amenities.pool && prop.amenities.hotTub) nightlyRate = 349;
    else if (prop.amenities.pool || prop.amenities.hotTub) nightlyRate = 279;

    // Build amenities list
    const amenitiesList = Object.entries(prop.amenities)
      .filter(([_, v]) => v === true)
      .map(([k]) => k.replace(/([A-Z])/g, ' $1').trim());

    // Extract zip from address
    const zipMatch = prop.address.match(/(\d{5})$/);
    const zipCode = zipMatch ? zipMatch[1] : '79703';

    const property = await prisma.property.create({
      data: {
        name: prop.name,
        address: prop.address.split(',')[0],
        city: 'Midland',
        state: 'TX',
        zipCode,
        bedrooms: prop.bedrooms,
        bathrooms: prop.bathrooms,
        maxGuests: prop.maxGuests,
        squareFeet: prop.sqft,
        propertyType: 'HOUSE',
        nightlyRate,
        wifiNetwork: prop.wifiName,
        checkInInstr: `Check-in: ${prop.checkIn}. ${prop.parkingInfo}`,
        checkOutInstr: `Check-out: ${prop.checkOut}`,
        vrboId: prop.vrboId || null,
        status: 'ACTIVE',
      },
    });

    // Seed property photos from property-images.ts
    const imageData = propertyImages.find(
      (pi) => pi.propertyId === prop.id || pi.propertyName === prop.name
    );

    if (imageData) {
      for (let i = 0; i < imageData.images.length; i++) {
        const img = imageData.images[i];
        await prisma.propertyPhoto.create({
          data: {
            propertyId: property.id,
            url: img.url,
            caption: img.alt,
            isPrimary: img.isPrimary || i === 0,
            sortOrder: i,
          },
        });
      }
    }

    created++;
    console.log(`   ✅ ${prop.name} (${prop.bedrooms}BR/${prop.bathrooms}BA, $${nightlyRate}/night)`);
  }

  // Seed default settings
  const defaultSettings = [
    { key: 'callRouting.enabled', value: 'true' },
    { key: 'callRouting.afterHours', value: 'voicemail' },
    { key: 'callRouting.emergencyForward', value: '+14325591904' },
    { key: 'business.name', value: 'Right at Home BnB' },
    { key: 'business.phone', value: '(432) 289-5613' },
    { key: 'business.email', value: 'info@rah-midland.com' },
    { key: 'business.owner', value: 'Steven Palma' },
    { key: 'business.ownerPhone', value: '(432) 559-1904' },
    { key: 'checkout.defaultTime', value: '11:00 AM' },
    { key: 'checkin.defaultTime', value: '4:00 PM' },
  ];

  for (const setting of defaultSettings) {
    await prisma.setting.upsert({
      where: { key: setting.key },
      update: { value: setting.value },
      create: setting,
    });
  }
  console.log(`   ✅ Default settings seeded (${defaultSettings.length})`);

  console.log(`\n🏁 Seed complete: ${created} created, ${skipped} skipped`);
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
