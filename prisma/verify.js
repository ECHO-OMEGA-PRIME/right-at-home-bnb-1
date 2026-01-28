/**
 * Verify seed data was inserted correctly
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Count properties
  const propertyCount = await prisma.property.count();
  console.log(`\nProperties in database: ${propertyCount}`);

  // Count photos
  const photoCount = await prisma.propertyPhoto.count();
  console.log(`Photos in database: ${photoCount}`);

  // Show each property with photo count
  console.log('\n=== PROPERTY SUMMARY ===\n');

  const properties = await prisma.property.findMany({
    include: {
      _count: {
        select: { photos: true }
      }
    },
    orderBy: { name: 'asc' }
  });

  for (const prop of properties) {
    const firstPhoto = await prisma.propertyPhoto.findFirst({
      where: { propertyId: prop.id, isPrimary: true }
    });
    console.log(`${prop.name}`);
    console.log(`  VRBO: ${prop.vrboId} | Photos: ${prop._count.photos}`);
    console.log(`  Address: ${prop.address}, ${prop.city}, ${prop.state}`);
    console.log(`  Beds: ${prop.bedrooms} | Baths: ${prop.bathrooms} | Guests: ${prop.maxGuests}`);
    console.log(`  Rate: $${prop.nightlyRate}/night | Cleaning: $${prop.cleaningFee}`);
    if (firstPhoto) {
      console.log(`  Primary Photo: ${firstPhoto.url.substring(0, 80)}...`);
    }
    console.log('');
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
