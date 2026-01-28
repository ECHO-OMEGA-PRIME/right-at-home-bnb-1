/**
 * Right At Home BnB - Main Seed Script
 * Seeds properties and photos from VRBO scrape data
 *
 * Usage: npx prisma db seed
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

// Property definitions from VRBO listings
const PROPERTIES = [
  {
    name: 'Oasis with Pool-Billiards',
    address: '5001 Castleford St',
    vrboId: '2636389',
    bedrooms: 4,
    bathrooms: 3,
    maxGuests: 10,
    nightlyRate: 250,
    cleaningFee: 150,
    amenities: ['Pool', 'Billiards', 'Kitchen', 'Washer', 'Dryer', 'Pet friendly', 'Free WiFi'],
  },
  {
    name: 'Adobe Compound with Pool and Fire Pits',
    address: 'Golf Course Rd',
    vrboId: '3005111',
    bedrooms: 7,
    bathrooms: 2,
    maxGuests: 16,
    nightlyRate: 400,
    cleaningFee: 200,
    amenities: ['Pool', 'Fire Pits', 'Billiards', 'Kitchen', 'Washer', 'Dryer', 'Pet friendly', 'Free WiFi'],
  },
  {
    name: 'Patio Home with Hot Tub',
    address: '2702 Garfield St',
    vrboId: '2634718',
    bedrooms: 3,
    bathrooms: 2,
    maxGuests: 8,
    nightlyRate: 200,
    cleaningFee: 125,
    amenities: ['Hot Tub', 'Patio', 'Kitchen', 'Washer', 'Dryer', 'Pet friendly', 'Free WiFi'],
  },
  {
    name: 'Old Midland Living',
    address: '4501 Douglas Ave',
    vrboId: '3355618',
    bedrooms: 4,
    bathrooms: 3,
    maxGuests: 16,
    nightlyRate: 350,
    cleaningFee: 175,
    amenities: ['Pool', 'Hot Tub', 'Kitchen', 'Washer', 'Dryer', 'Pet friendly', 'Massive Yard'],
  },
  {
    name: 'Hot Tub Delight',
    address: '4707 Dentcrest St',
    vrboId: '2638481',
    bedrooms: 3,
    bathrooms: 2,
    maxGuests: 6,
    nightlyRate: 175,
    cleaningFee: 100,
    amenities: ['Hot Tub', 'Balcony', 'Kitchen', 'Washer', 'Dryer', 'Pet friendly', 'Free WiFi'],
  },
  {
    name: 'Destination Getaway',
    address: '2103 Storey Ave',
    vrboId: '2643822',
    bedrooms: 3,
    bathrooms: 2,
    maxGuests: 8,
    nightlyRate: 180,
    cleaningFee: 110,
    amenities: ['Kitchen', 'Washer', 'Dryer', 'Pet friendly', 'Free WiFi'],
  },
  {
    name: 'Retreat with Covered Patio',
    address: '3210 Chelsea St',
    vrboId: '2643784',
    bedrooms: 3,
    bathrooms: 2,
    maxGuests: 8,
    nightlyRate: 185,
    cleaningFee: 115,
    amenities: ['Covered Patio', 'Kitchen', 'Washer', 'Dryer', 'Pet friendly', 'Free WiFi'],
  },
  {
    name: 'Most Marvelous with Pool',
    address: '6100 Oriole St',
    vrboId: '4471713',
    bedrooms: 4,
    bathrooms: 2,
    maxGuests: 8,
    nightlyRate: 275,
    cleaningFee: 140,
    amenities: ['Pool', 'Fireplace', 'Kitchen', 'Washer', 'Dryer', 'Pet friendly', 'Air conditioning'],
  },
  {
    name: 'Posh & Private with Billiards',
    address: '1426 Lanham St',
    vrboId: '4437486',
    bedrooms: 3,
    bathrooms: 3,
    maxGuests: 10,
    nightlyRate: 225,
    cleaningFee: 135,
    amenities: ['Billiards', 'Fireplace', 'Private Setting', 'Kitchen', 'Washer', 'Dryer', 'Pet friendly'],
  },
  {
    name: 'Outdoor Dream',
    address: '3106 Humble Ave',
    vrboId: '4700881',
    bedrooms: 4,
    bathrooms: 2,
    maxGuests: 14,
    nightlyRate: 300,
    cleaningFee: 160,
    amenities: ['Pool', 'Hot Tub', 'Patio', 'Kitchen', 'Washer', 'Dryer', 'Pet friendly'],
  },
  {
    name: 'Santiago Dreams',
    address: '1311 Daventry Rd',
    vrboId: '4179271',
    bedrooms: 4,
    bathrooms: 3,
    maxGuests: 10,
    nightlyRate: 280,
    cleaningFee: 145,
    amenities: ['Man Cave', 'Two Large Yards', 'Extra Parking', 'Kitchen', 'Washer', 'Dryer', 'Pet friendly', 'Free WiFi'],
  },
  {
    name: 'Sprawling Ranch House with Pool Cabana and Playground',
    address: '5055 Lincoln Green',
    vrboId: '4581977',
    bedrooms: 6,
    bathrooms: 3,
    maxGuests: 18,
    nightlyRate: 450,
    cleaningFee: 225,
    amenities: ['Pool', 'Pool Cabana', 'Playground', 'Fireplace', 'Jetted Bathtub', 'Washer', 'Dryer', 'Pet friendly'],
  },
  {
    name: 'Saddle Club',
    address: '1309 Daventry Rd',
    vrboId: '4750070',
    bedrooms: 4,
    bathrooms: 3,
    maxGuests: 8,
    nightlyRate: 260,
    cleaningFee: 140,
    amenities: ['Barbecue Grill', "Children's Area", 'Large Yard with Trees', 'Washer', 'Dryer', 'Air conditioning', 'Parking'],
  },
  {
    name: 'Monterrey House',
    address: 'Monterrey St',
    vrboId: '3477668',
    bedrooms: 3,
    bathrooms: 2,
    maxGuests: 6,
    nightlyRate: 165,
    cleaningFee: 95,
    amenities: ['Patio/Terrace', 'Kitchen', 'Washer', 'Dryer', 'Pet friendly', 'Free WiFi', 'Air conditioning'],
  },
];

interface PhotoSeedData {
  url: string;
  sortOrder: number;
  isPrimary: boolean;
  caption: string;
}

interface PropertySeedEntry {
  vrboId: string;
  propertyName: string;
  photos: PhotoSeedData[];
}

interface SeedData {
  generatedAt: string;
  totalProperties: number;
  totalPhotos: number;
  properties: PropertySeedEntry[];
}

async function main() {
  console.log('='.repeat(60));
  console.log('Right At Home BnB - Database Seed');
  console.log('='.repeat(60));

  // Create admin user
  console.log('\nCreating admin user...');
  const admin = await prisma.user.upsert({
    where: { email: 'steven@rightathomebnb.com' },
    update: {},
    create: {
      email: 'steven@rightathomebnb.com',
      name: 'Steven Palma',
      phone: '+1-432-555-0100',
      role: 'ADMIN',
    },
  });
  console.log(`  Admin: ${admin.email}`);

  // Create properties
  console.log('\nCreating properties...');
  let propertiesCreated = 0;

  for (const prop of PROPERTIES) {
    const existing = await prisma.property.findFirst({
      where: { vrboId: prop.vrboId },
    });

    if (existing) {
      console.log(`  [EXISTS] ${prop.name} (VRBO: ${prop.vrboId})`);
      continue;
    }

    await prisma.property.create({
      data: {
        name: prop.name,
        address: prop.address,
        city: 'Midland',
        state: 'TX',
        zipCode: '79705',
        bedrooms: prop.bedrooms,
        bathrooms: prop.bathrooms,
        maxGuests: prop.maxGuests,
        propertyType: 'HOUSE',
        amenities: JSON.stringify(prop.amenities),
        nightlyRate: prop.nightlyRate,
        cleaningFee: prop.cleaningFee,
        vrboId: prop.vrboId,
        status: 'ACTIVE',
      },
    });

    console.log(`  [CREATED] ${prop.name} (VRBO: ${prop.vrboId})`);
    propertiesCreated++;
  }

  console.log(`\nProperties created: ${propertiesCreated}`);

  // Seed photos if seed data exists
  const seedDataPath = path.join(__dirname, '..', 'tools', 'prisma_photo_seed.json');

  if (fs.existsSync(seedDataPath)) {
    console.log('\nSeeding photos from VRBO scrape data...');

    const seedData: SeedData = JSON.parse(fs.readFileSync(seedDataPath, 'utf-8'));
    let photosAdded = 0;

    for (const propData of seedData.properties) {
      const property = await prisma.property.findFirst({
        where: { vrboId: propData.vrboId },
      });

      if (!property) {
        console.log(`  [SKIP] No property for VRBO ID: ${propData.vrboId}`);
        continue;
      }

      // Check if photos already exist
      const existingPhotos = await prisma.propertyPhoto.count({
        where: { propertyId: property.id },
      });

      if (existingPhotos > 0) {
        console.log(`  [EXISTS] ${property.name}: ${existingPhotos} photos`);
        continue;
      }

      // Create photos
      const photoData = propData.photos.map((photo) => ({
        propertyId: property.id,
        url: photo.url,
        caption: photo.caption,
        isPrimary: photo.isPrimary,
        sortOrder: photo.sortOrder,
      }));

      await prisma.propertyPhoto.createMany({ data: photoData });

      console.log(`  [ADDED] ${property.name}: ${propData.photos.length} photos`);
      photosAdded += propData.photos.length;
    }

    console.log(`\nPhotos added: ${photosAdded}`);
  } else {
    console.log('\nNo photo seed data found. Run merge_scraped_images.py first.');
  }

  console.log('\n' + '='.repeat(60));
  console.log('SEED COMPLETE');
  console.log('='.repeat(60));
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
