/**
 * GET /api/properties/photos/[photoId]
 *
 * Serves a property photo's bytes from our own origin.
 *
 * This exists because the site's CSP allows `img-src 'self'` and a short list
 * of third parties that has never included any bucket we upload to. Photos
 * re-hosted on Firebase Storage were blocked by the browser, and so were the
 * raw channel-CDN URLs used as a fallback. Serving from our own origin is the
 * only variant the page can actually render.
 *
 * Deliberately PUBLIC and unauthenticated: property listings are public
 * marketing pages, and their photos have to load for anonymous visitors. Only
 * photo bytes are reachable here -- an id names one image and nothing else.
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

/** Strips the cosmetic extension the import route appends to the URL. */
function photoIdFrom(param: string): string {
  const dot = param.lastIndexOf('.');
  return dot === -1 ? param : param.slice(0, dot);
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { photoId: string } },
) {
  const photoId = photoIdFrom(params.photoId);
  if (!photoId) {
    return NextResponse.json({ error: 'Photo not found' }, { status: 404 });
  }

  try {
    const blob = await prisma.propertyPhotoBlob.findUnique({
      where: { photoId },
      select: { data: true, contentType: true, byteSize: true },
    });

    if (!blob) {
      return NextResponse.json({ error: 'Photo not found' }, { status: 404 });
    }

    return new NextResponse(new Uint8Array(blob.data), {
      status: 200,
      headers: {
        'Content-Type': blob.contentType,
        'Content-Length': String(blob.byteSize),
        // The bytes for a given id never change -- a re-import creates a new
        // row with a new id -- so this is safe to cache hard.
        'Cache-Control': 'public, max-age=31536000, immutable',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    // A database failure is an outage, not a missing photo. Returning 404 here
    // would tell every caller and crawler that the image is permanently gone.
    console.error('[property-photo] failed to read blob', { photoId, error });
    return NextResponse.json(
      { error: 'Photo store temporarily unavailable', code: 'PHOTO_STORE_UNAVAILABLE' },
      { status: 503, headers: { 'Retry-After': '30' } },
    );
  }
}
