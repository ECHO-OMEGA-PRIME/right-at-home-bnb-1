#!/usr/bin/env node
/**
 * Property Amenity Sync Script
 *
 * Updates all property.json files with:
 * - serviceFees (cleaning, deep clean, pool, lawn)
 * - waiverRequirements (pool, hotTub, firePit, general)
 * - hasPool, hasHotTub, hasFirePit flags
 *
 * Auto-detects from existing amenities:
 * - "Private pool" or "Pool" -> hasPool: true
 * - "Hot tub" or "Spa" or "Jetted bathtub" -> hasHotTub: true
 * - "Fire pit" -> hasFirePit: true
 * - "Barbecue" or "Grill" or "Barbecue grill" -> waiverRequirements.general: true
 *
 * Usage: node scripts/sync-property-amenities.mjs
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Default service fees by property type
const DEFAULT_SERVICE_FEES = {
  cleaningFee: 150,
  deepCleanFee: 300,
  poolServiceFee: 50,
  lawnServiceFee: 75
};

// Pool-related keywords
const POOL_KEYWORDS = [
  'pool', 'private pool', 'heated pool', 'outdoor pool', 'swimming pool'
];

// Hot tub/spa keywords
const HOT_TUB_KEYWORDS = [
  'hot tub', 'spa', 'jetted bathtub', 'jacuzzi', 'whirlpool'
];

// Fire pit keywords
const FIRE_PIT_KEYWORDS = [
  'fire pit', 'firepit', 'outdoor fireplace', 'fire table'
];

// Grill/BBQ keywords (require general waiver)
const GRILL_KEYWORDS = [
  'barbecue', 'bbq', 'grill', 'barbecue grill', 'outdoor grill'
];

function normalizeString(str) {
  return str.toLowerCase().trim();
}

function checkKeywords(text, keywords) {
  const normalized = normalizeString(text);
  return keywords.some(keyword => normalized.includes(keyword));
}

function detectAmenities(property) {
  let hasPool = false;
  let hasHotTub = false;
  let hasFirePit = false;
  let hasGrill = false;

  // Check all amenity categories
  const amenities = property.amenities || {};
  const allAmenities = [];

  // Collect all amenities from all categories
  for (const category of Object.values(amenities)) {
    if (Array.isArray(category)) {
      allAmenities.push(...category);
    }
  }

  // Check spaces
  if (property.spaces && Array.isArray(property.spaces)) {
    allAmenities.push(...property.spaces);
  }

  // Check each amenity
  for (const amenity of allAmenities) {
    if (checkKeywords(amenity, POOL_KEYWORDS)) hasPool = true;
    if (checkKeywords(amenity, HOT_TUB_KEYWORDS)) hasHotTub = true;
    if (checkKeywords(amenity, FIRE_PIT_KEYWORDS)) hasFirePit = true;
    if (checkKeywords(amenity, GRILL_KEYWORDS)) hasGrill = true;
  }

  // Check bathroom features for jetted tub
  if (property.bathrooms && Array.isArray(property.bathrooms)) {
    for (const bathroom of property.bathrooms) {
      if (bathroom.features && Array.isArray(bathroom.features)) {
        for (const feature of bathroom.features) {
          if (checkKeywords(feature, HOT_TUB_KEYWORDS)) {
            hasHotTub = true;
          }
        }
      }
    }
  }

  // Also check title and tagline
  const titleText = `${property.title || ''} ${property.tagline || ''}`;
  if (checkKeywords(titleText, POOL_KEYWORDS)) hasPool = true;
  if (checkKeywords(titleText, HOT_TUB_KEYWORDS)) hasHotTub = true;

  return { hasPool, hasHotTub, hasFirePit, hasGrill };
}

function calculateServiceFees(property, detected) {
  const baseFees = { ...DEFAULT_SERVICE_FEES };

  // If no pool, set pool service fee to 0
  if (!detected.hasPool) {
    baseFees.poolServiceFee = 0;
  }

  // Adjust cleaning fee based on property size
  const bedrooms = property.specs?.bedrooms || 3;
  if (bedrooms >= 5) {
    baseFees.cleaningFee = 200;
    baseFees.deepCleanFee = 400;
  } else if (bedrooms >= 4) {
    baseFees.cleaningFee = 175;
    baseFees.deepCleanFee = 350;
  }

  return baseFees;
}

function buildWaiverRequirements(detected) {
  return {
    pool: detected.hasPool,
    hotTub: detected.hasHotTub,
    firePit: detected.hasFirePit,
    general: detected.hasGrill || detected.hasPool || detected.hasHotTub || detected.hasFirePit
  };
}

function syncPropertyFile(filePath) {
  const result = {
    propertyId: '',
    path: filePath,
    hasPool: false,
    hasHotTub: false,
    hasFirePit: false,
    hasGrill: false,
    updated: false,
    error: null
  };

  try {
    // Read existing property file
    const content = fs.readFileSync(filePath, 'utf-8');
    const property = JSON.parse(content);

    result.propertyId = property.id || path.dirname(filePath).split(path.sep).pop() || 'unknown';

    // Detect amenities
    const detected = detectAmenities(property);
    result.hasPool = detected.hasPool;
    result.hasHotTub = detected.hasHotTub;
    result.hasFirePit = detected.hasFirePit;
    result.hasGrill = detected.hasGrill;

    // Calculate service fees
    const serviceFees = calculateServiceFees(property, detected);

    // Build waiver requirements
    const waiverRequirements = buildWaiverRequirements(detected);

    // Update property object
    const updatedProperty = {
      ...property,
      serviceFees,
      waiverRequirements,
      hasPool: detected.hasPool,
      hasHotTub: detected.hasHotTub,
      hasFirePit: detected.hasFirePit
    };

    // Write back to file with pretty formatting
    fs.writeFileSync(filePath, JSON.stringify(updatedProperty, null, 2) + '\n');
    result.updated = true;

  } catch (error) {
    result.error = error.message;
  }

  return result;
}

function findPropertyFiles(baseDir) {
  const propertyFiles = [];

  if (!fs.existsSync(baseDir)) {
    console.error(`Directory not found: ${baseDir}`);
    return propertyFiles;
  }

  const entries = fs.readdirSync(baseDir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isDirectory()) {
      const propertyJsonPath = path.join(baseDir, entry.name, 'property.json');
      if (fs.existsSync(propertyJsonPath)) {
        propertyFiles.push(propertyJsonPath);
      }
    }
  }

  return propertyFiles;
}

function main() {
  console.log('========================================');
  console.log('  Property Amenity Sync Script');
  console.log('  Right At Home BnB');
  console.log('========================================\n');

  const baseDir = path.resolve(__dirname, '../apps/web/public/properties');
  console.log(`Scanning: ${baseDir}\n`);

  const propertyFiles = findPropertyFiles(baseDir);
  console.log(`Found ${propertyFiles.length} property files\n`);

  if (propertyFiles.length === 0) {
    console.log('No property files found. Exiting.');
    return;
  }

  const results = [];

  for (const filePath of propertyFiles) {
    const result = syncPropertyFile(filePath);
    results.push(result);

    const status = result.updated ? '[UPDATED]' : result.error ? '[ERROR]' : '[SKIPPED]';
    const amenities = [
      result.hasPool ? 'Pool' : null,
      result.hasHotTub ? 'HotTub' : null,
      result.hasFirePit ? 'FirePit' : null,
      result.hasGrill ? 'Grill' : null
    ].filter(Boolean).join(', ') || 'None';

    console.log(`${status} ${result.propertyId.padEnd(25)} Amenities: ${amenities}`);

    if (result.error) {
      console.log(`         Error: ${result.error}`);
    }
  }

  // Summary
  console.log('\n========================================');
  console.log('  SUMMARY');
  console.log('========================================');

  const updated = results.filter(r => r.updated).length;
  const errors = results.filter(r => r.error).length;
  const withPool = results.filter(r => r.hasPool).length;
  const withHotTub = results.filter(r => r.hasHotTub).length;
  const withFirePit = results.filter(r => r.hasFirePit).length;
  const withGrill = results.filter(r => r.hasGrill).length;

  console.log(`\nTotal Properties: ${results.length}`);
  console.log(`Updated:          ${updated}`);
  console.log(`Errors:           ${errors}`);
  console.log(`\nAmenity Detection:`);
  console.log(`  With Pool:      ${withPool}`);
  console.log(`  With Hot Tub:   ${withHotTub}`);
  console.log(`  With Fire Pit:  ${withFirePit}`);
  console.log(`  With Grill:     ${withGrill}`);

  // Generate seed data for database
  console.log('\n========================================');
  console.log('  DATABASE RECORDS (for seed file)');
  console.log('========================================\n');

  console.log('const propertyServiceFees = [');
  for (const result of results.filter(r => r.updated)) {
    const fees = result.hasPool
      ? '{ cleaningFee: 175, deepCleanFee: 350, poolServiceFee: 50, lawnServiceFee: 75 }'
      : '{ cleaningFee: 150, deepCleanFee: 300, poolServiceFee: 0, lawnServiceFee: 75 }';
    console.log(`  { propertyId: "${result.propertyId}", ...${fees} },`);
  }
  console.log('];');

  console.log('\nSync complete!');
}

main();
