/**
 * Right At Home BnB - Photo Seed Script
 * Seeds property photos from VRBO scrape data into the database
 *
 * Usage: npx prisma db seed
 * Or: npx ts-node prisma/seed-photos.ts
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

interface PhotoData {
  url: string;
  sortOrder: number;
  isPrimary: boolean;
  caption: string;
}

interface PropertySeedData {
  vrboId: string;
  propertyName: string;
  photos: PhotoData[];
}

interface SeedData {
  generatedAt: string;
  totalProperties: number;
  totalPhotos: number;
  properties: PropertySeedData[];
}

async function main() {
  console.log('='.repeat(60));
  console.log('Right At Home BnB - Photo Seed');
  console.log('='.repeat(60));

  // Load seed data
  const seedDataPath = path.join(__dirname, '..', 'tools', 'prisma_photo_seed.json');

  if (!fs.existsSync(seedDataPath)) {
    console.error(`Seed data not found: ${seedDataPath}`);
    console.error('Run merge_scraped_images.py first to generate seed data');
    process.exit(1);
  }

  const seedData: SeedData = JSON.parse(fs.readFileSync(seedDataPath, 'utf-8'));

  console.log(`\nLoaded seed data:`);
  console.log(`  Generated: ${seedData.generatedAt}`);
  console.log(`  Properties: ${seedData.totalProperties}`);
  console.log(`  Total Photos: ${seedData.totalPhotos}`);
  console.log('');

  let propertiesUpdated = 0;
  let photosAdded = 0;
  let errors: string[] = [];

  for (const propData of seedData.properties) {
    console.log(`Processing ${propData.propertyName} (VRBO: ${propData.vrboId})...`);

    // Find property by VRBO ID
    const property = await prisma.property.findFirst({
      where: { vrboId: propData.vrboId },
    });

    if (!property) {
      const msg = `  [SKIP] Property not found for VRBO ID: ${propData.vrboId}`;
      console.log(msg);
      errors.push(msg);
      continue;
    }

    // Delete existing photos for this property (to avoid duplicates on re-run)
    const deleted = await prisma.propertyPhoto.deleteMany({
      where: { propertyId: property.id },
    });

    if (deleted.count > 0) {
      console.log(`  Removed ${deleted.count} existing photos`);
    }

    // Create new photos
    const photoCreateData = propData.photos.map((photo) => ({
      propertyId: property.id,
      url: photo.url,
      caption: photo.caption,
      isPrimary: photo.isPrimary,
      sortOrder: photo.sortOrder,
    }));

    await prisma.propertyPhoto.createMany({
      data: photoCreateData,
    });

    console.log(`  [OK] Added ${propData.photos.length} photos`);
    propertiesUpdated++;
    photosAdded += propData.photos.length;
  }

  console.log('\n' + '='.repeat(60));
  console.log('SEED COMPLETE');
  console.log('='.repeat(60));
  console.log(`Properties updated: ${propertiesUpdated}`);
  console.log(`Photos added: ${photosAdded}`);

  if (errors.length > 0) {
    console.log(`\nWarnings (${errors.length}):`);
    errors.forEach((e) => console.log(e));
  }
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
