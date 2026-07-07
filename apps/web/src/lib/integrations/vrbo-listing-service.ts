/**
 * VRBO listing scrape + DB cache service.
 * Refreshes public listing data daily via cron.
 */

import prisma from '@/lib/prisma';
import {
  scrapeVrboListing,
  scrapeVrboListings,
  VRBO_LISTING_IDS,
  type VrboListingData,
} from '@rightathome/shared/vrbo';

export interface ListingScrapeResult {
  vrboId: string;
  propertyId: string | null;
  action: 'created' | 'updated' | 'skipped' | 'error';
  error?: string;
}

export async function cacheVrboListing(data: VrboListingData): Promise<ListingScrapeResult> {
  try {
    let property = await prisma.property.findFirst({
      where: { vrboId: data.vrboId },
    });

    const amenitiesJson = JSON.stringify(data.amenities);

    if (property) {
      await prisma.property.update({
        where: { id: property.id },
        data: {
          name: data.title || property.name,
          nightlyRate: data.nightlyRate ?? property.nightlyRate,
          bedrooms: data.bedrooms ?? property.bedrooms,
          bathrooms: data.bathrooms ?? property.bathrooms,
          maxGuests: data.maxGuests ?? property.maxGuests,
          amenities: amenitiesJson,
        },
      });

      if (data.photos.length > 0) {
        const existingPhotos = await prisma.propertyPhoto.count({
          where: { propertyId: property.id },
        });
        if (existingPhotos === 0) {
          await prisma.propertyPhoto.createMany({
            data: data.photos.slice(0, 10).map((url, i) => ({
              propertyId: property!.id,
              url,
              isPrimary: i === 0,
              sortOrder: i,
            })),
          });
        }
      }

      await prisma.vrboSync.upsert({
        where: { propertyId: property.id },
        update: { lastScrapeSync: new Date() },
        create: {
          propertyId: property.id,
          vrboListingId: data.vrboId,
          syncEnabled: true,
          lastScrapeSync: new Date(),
        },
      });

      await prisma.syncLog.create({
        data: {
          propertyId: property.id,
          syncType: 'scrape_listing',
          source: 'vrbo',
          status: 'success',
          itemsProcessed: 1,
          itemsUpdated: 1,
          metadata: JSON.stringify({ photos: data.photos.length, rate: data.nightlyRate }),
        },
      });

      return { vrboId: data.vrboId, propertyId: property.id, action: 'updated' };
    }

    return { vrboId: data.vrboId, propertyId: null, action: 'skipped', error: 'No matching property in DB' };
  } catch (err) {
    return {
      vrboId: data.vrboId,
      propertyId: null,
      action: 'error',
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function scrapeAndCacheAllListings(
  vrboIds: string[] = [...VRBO_LISTING_IDS]
): Promise<{ results: ListingScrapeResult[]; durationMs: number }> {
  const start = Date.now();
  const { listings, errors } = await scrapeVrboListings(vrboIds, { delayMs: 1500 });

  const results: ListingScrapeResult[] = [];
  for (const listing of listings) {
    results.push(await cacheVrboListing(listing));
  }
  for (const err of errors) {
    results.push({ vrboId: err.vrboId, propertyId: null, action: 'error', error: err.error });
  }

  return { results, durationMs: Date.now() - start };
}