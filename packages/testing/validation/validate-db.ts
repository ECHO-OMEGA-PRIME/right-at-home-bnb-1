/**
 * Database Validation Script
 * Verifies database integrity: 14 properties, 730 photos, relationships
 */

import { PrismaClient } from '@prisma/client';
import path from 'path';
import fs from 'fs';

interface ValidationResult {
  check: string;
  status: 'PASS' | 'FAIL' | 'WARN';
  expected?: number | string;
  actual?: number | string;
  message?: string;
}

const EXPECTED_PROPERTIES = 14;
const EXPECTED_PHOTOS = 730;
const EXPECTED_CITY = 'Midland';
const EXPECTED_STATE = 'TX';

async function validateDatabase(): Promise<ValidationResult[]> {
  const results: ValidationResult[] = [];
  let prisma: PrismaClient | null = null;

  console.log('='.repeat(60));
  console.log('RightAtHomeBnB Database Validation');
  console.log('='.repeat(60));
  console.log();

  try {
    // Check if database file exists
    const dbPath = path.resolve(process.cwd(), 'prisma', 'dev.db');
    const dbExists = fs.existsSync(dbPath);

    results.push({
      check: 'Database File Exists',
      status: dbExists ? 'PASS' : 'FAIL',
      message: dbExists ? `Found at ${dbPath}` : `Not found at ${dbPath}`
    });

    if (!dbExists) {
      console.log('Database file not found. Run `npm run db:push` first.');
      return results;
    }

    // Connect to database
    prisma = new PrismaClient();
    await prisma.$connect();

    results.push({
      check: 'Database Connection',
      status: 'PASS',
      message: 'Successfully connected to database'
    });

    // 1. Validate Property Count
    const propertyCount = await prisma.property.count();
    results.push({
      check: 'Property Count',
      status: propertyCount === EXPECTED_PROPERTIES ? 'PASS' : 'FAIL',
      expected: EXPECTED_PROPERTIES,
      actual: propertyCount,
      message: `Found ${propertyCount} properties (expected ${EXPECTED_PROPERTIES})`
    });

    // 2. Validate Photo Count
    const photoCount = await prisma.propertyPhoto.count();
    results.push({
      check: 'Photo Count',
      status: photoCount >= EXPECTED_PHOTOS ? 'PASS' : 'WARN',
      expected: EXPECTED_PHOTOS,
      actual: photoCount,
      message: `Found ${photoCount} photos (expected ~${EXPECTED_PHOTOS})`
    });

    // 3. Validate All Properties in Midland, TX
    const properties = await prisma.property.findMany();
    const allInMidland = properties.every(
      p => p.city === EXPECTED_CITY && p.state === EXPECTED_STATE
    );
    results.push({
      check: 'All Properties in Midland, TX',
      status: allInMidland ? 'PASS' : 'FAIL',
      message: allInMidland
        ? 'All properties are in Midland, TX'
        : 'Some properties are not in Midland, TX'
    });

    // 4. Validate Unique Property Addresses
    const addresses = properties.map(p => p.address);
    const uniqueAddresses = new Set(addresses);
    results.push({
      check: 'Unique Property Addresses',
      status: uniqueAddresses.size === addresses.length ? 'PASS' : 'FAIL',
      expected: addresses.length,
      actual: uniqueAddresses.size,
      message: uniqueAddresses.size === addresses.length
        ? 'All property addresses are unique'
        : 'Duplicate addresses found'
    });

    // 5. Validate Required Fields
    const requiredFields = ['name', 'address', 'bedrooms', 'bathrooms', 'nightlyRate'];
    const invalidProperties = properties.filter(p =>
      requiredFields.some(field => (p as Record<string, unknown>)[field] === null || (p as Record<string, unknown>)[field] === undefined)
    );
    results.push({
      check: 'Required Fields Present',
      status: invalidProperties.length === 0 ? 'PASS' : 'FAIL',
      message: invalidProperties.length === 0
        ? 'All properties have required fields'
        : `${invalidProperties.length} properties missing required fields`
    });

    // 6. Validate Positive Prices
    const invalidPrices = properties.filter(
      p => p.nightlyRate <= 0 || (p.cleaningFee !== null && p.cleaningFee < 0)
    );
    results.push({
      check: 'Valid Pricing',
      status: invalidPrices.length === 0 ? 'PASS' : 'FAIL',
      message: invalidPrices.length === 0
        ? 'All properties have valid pricing'
        : `${invalidPrices.length} properties have invalid pricing`
    });

    // 7. Validate Photo-Property Relationships
    const photosWithInvalidProperty = await prisma.propertyPhoto.findMany({
      where: {
        property: undefined
      }
    });
    results.push({
      check: 'Photo-Property Relationships',
      status: photosWithInvalidProperty.length === 0 ? 'PASS' : 'WARN',
      message: photosWithInvalidProperty.length === 0
        ? 'All photos linked to valid properties'
        : `${photosWithInvalidProperty.length} orphaned photos found`
    });

    // 8. Validate Each Property Has Photos
    const propertiesWithPhotos = await prisma.property.findMany({
      include: { photos: true }
    });
    const propertiesWithoutPhotos = propertiesWithPhotos.filter(p => p.photos.length === 0);
    results.push({
      check: 'Properties Have Photos',
      status: propertiesWithoutPhotos.length === 0 ? 'PASS' : 'WARN',
      message: propertiesWithoutPhotos.length === 0
        ? 'All properties have at least one photo'
        : `${propertiesWithoutPhotos.length} properties without photos`
    });

    // 9. Validate Booking Table Structure
    const bookingCount = await prisma.booking.count();
    results.push({
      check: 'Booking Table Accessible',
      status: 'PASS',
      actual: bookingCount,
      message: `Booking table accessible with ${bookingCount} records`
    });

    // 10. Validate Guest Table Structure
    const guestCount = await prisma.guest.count();
    results.push({
      check: 'Guest Table Accessible',
      status: 'PASS',
      actual: guestCount,
      message: `Guest table accessible with ${guestCount} records`
    });

    // 11. Validate User Table Structure
    const userCount = await prisma.user.count();
    results.push({
      check: 'User Table Accessible',
      status: 'PASS',
      actual: userCount,
      message: `User table accessible with ${userCount} records`
    });

    // 12. Validate Cleaning Job Table Structure
    const cleaningJobCount = await prisma.cleaningJob.count();
    results.push({
      check: 'CleaningJob Table Accessible',
      status: 'PASS',
      actual: cleaningJobCount,
      message: `CleaningJob table accessible with ${cleaningJobCount} records`
    });

  } catch (error) {
    results.push({
      check: 'Database Connection',
      status: 'FAIL',
      message: `Connection failed: ${(error as Error).message}`
    });
  } finally {
    if (prisma) {
      await prisma.$disconnect();
    }
  }

  return results;
}

function printResults(results: ValidationResult[]): void {
  console.log();
  console.log('Validation Results:');
  console.log('-'.repeat(60));

  let passCount = 0;
  let failCount = 0;
  let warnCount = 0;

  for (const result of results) {
    const icon = result.status === 'PASS' ? '[PASS]' : result.status === 'FAIL' ? '[FAIL]' : '[WARN]';
    console.log(`${icon} ${result.check}`);
    if (result.message) {
      console.log(`       ${result.message}`);
    }
    if (result.expected !== undefined && result.actual !== undefined) {
      console.log(`       Expected: ${result.expected}, Actual: ${result.actual}`);
    }

    if (result.status === 'PASS') passCount++;
    else if (result.status === 'FAIL') failCount++;
    else warnCount++;
  }

  console.log();
  console.log('='.repeat(60));
  console.log(`Summary: ${passCount} passed, ${failCount} failed, ${warnCount} warnings`);
  console.log('='.repeat(60));

  if (failCount > 0) {
    console.log('\nDatabase validation FAILED. Please fix the issues above.');
    process.exit(1);
  } else if (warnCount > 0) {
    console.log('\nDatabase validation passed with warnings.');
  } else {
    console.log('\nDatabase validation PASSED!');
  }
}

// Run validation
validateDatabase()
  .then(printResults)
  .catch(error => {
    console.error('Validation error:', error);
    process.exit(1);
  });
