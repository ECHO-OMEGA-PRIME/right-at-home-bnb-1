/**
 * Save Property Images API
 *
 * Imports listing photos from a channel CDN into our own store: the bytes go to
 * Postgres and are served from our own origin by
 * `/api/properties/photos/[photoId]`, and the metadata goes to PropertyPhoto.
 *
 * This replaces an upload to Firebase Storage plus a write to a Firestore
 * `properties` document. Three things were wrong with that, beyond the Google
 * dependency:
 *
 *  1. IT NEVER PRODUCED A DISPLAYABLE IMAGE. The route returned
 *     `https://storage.googleapis.com/...` URLs, but this site's own CSP allows
 *     `img-src 'self' data: blob: images.unsplash.com lh3.googleusercontent.com
 *     *.rah-midland.com`, and `next.config.js` images.domains does not list
 *     storage.googleapis.com either. Every re-hosted image was blocked by the
 *     browser. The "Firebase not configured" fallback returned raw VRBO CDN
 *     URLs, which are equally not allowed -- so both paths were dead. Serving
 *     from our own origin is what actually makes the feature work.
 *
 *  2. It wrote photos to a Firestore `properties` document -- a SECOND property
 *     store, parallel to the Postgres `Property` those photos belong to and
 *     which the rest of the app reads.
 *
 *  3. It fetched a caller-supplied URL with no restriction on host, scheme,
 *     size or content type, then stored whatever came back. An owner/admin
 *     could point it at an internal address and have the response persisted.
 *
 * The fetch is now restricted to https on an allowlist of listing-photo CDNs,
 * capped in size, and required to actually be an image.
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireOneOfRoles } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

interface ImageInput {
  url: string;
  alt?: string;
  isPrimary?: boolean;
}

/** 15 MB. A listing photo is well under this; anything larger is not one. */
const MAX_BYTES = 15 * 1024 * 1024;

const ALLOWED_CONTENT_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif']);

const EXTENSION_BY_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
};

/**
 * Hosts we will pull listing photos from.
 *
 * An allowlist rather than a denylist of internal ranges: enumerating what is
 * permitted is the only form that stays correct as infrastructure changes, and
 * DNS rebinding makes address-based blocking unreliable anyway.
 */
const ALLOWED_IMAGE_HOSTS = [
  'vrbo.com',
  'homeaway.com',
  'expediagroup.com',
  'muscache.com', // Airbnb's photo CDN
  'airbnb.com',
];

function hostIsAllowed(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return ALLOWED_IMAGE_HOSTS.some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
}

type FetchFailure = { ok: false; reason: string };
type FetchSuccess = { ok: true; data: Buffer; contentType: string };

async function fetchImage(rawUrl: string): Promise<FetchSuccess | FetchFailure> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { ok: false, reason: 'not a valid URL' };
  }

  if (parsed.protocol !== 'https:') {
    return { ok: false, reason: 'only https sources are allowed' };
  }
  if (!hostIsAllowed(parsed.hostname)) {
    return { ok: false, reason: `host ${parsed.hostname} is not an allowed image source` };
  }

  let response: Response;
  try {
    response = await fetch(parsed.toString(), {
      // Do not follow a redirect off the allowlist -- that would turn one
      // permitted host into an open fetch of anything it chooses to point at.
      redirect: 'error',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : 'fetch failed' };
  }

  if (!response.ok) {
    return { ok: false, reason: `source responded ${response.status}` };
  }

  const contentType = (response.headers.get('content-type') || '')
    .split(';')[0]
    .trim()
    .toLowerCase();
  if (!ALLOWED_CONTENT_TYPES.has(contentType)) {
    return { ok: false, reason: `unsupported content type "${contentType || 'unknown'}"` };
  }

  // Check the declared length first, then the real one: a source can lie about
  // or omit Content-Length, so the header is an early out, not the enforcement.
  const declared = Number(response.headers.get('content-length') ?? NaN);
  if (Number.isFinite(declared) && declared > MAX_BYTES) {
    return { ok: false, reason: `image is ${declared} bytes, over the ${MAX_BYTES} limit` };
  }

  const data = Buffer.from(await response.arrayBuffer());
  if (data.byteLength === 0) return { ok: false, reason: 'source returned an empty body' };
  if (data.byteLength > MAX_BYTES) {
    return { ok: false, reason: `image is ${data.byteLength} bytes, over the ${MAX_BYTES} limit` };
  }

  return { ok: true, data, contentType };
}

export async function POST(request: NextRequest) {
  const auth = await requireOneOfRoles(request, ['owner', 'admin']);
  if (auth.error) return auth.error;

  try {
    const { propertyId, images } = (await request.json()) as {
      propertyId?: string;
      images?: ImageInput[];
    };

    if (!propertyId || !Array.isArray(images) || images.length === 0) {
      return NextResponse.json({ error: 'Missing propertyId or images' }, { status: 400 });
    }

    const property = await prisma.property.findUnique({
      where: { id: propertyId },
      select: { id: true },
    });
    if (!property) {
      return NextResponse.json({ error: 'Property not found' }, { status: 404 });
    }

    const existing = await prisma.propertyPhoto.findMany({
      where: { propertyId },
      select: { id: true, sourceUrl: true, sortOrder: true },
      orderBy: { sortOrder: 'asc' },
    });
    const alreadyImported = new Set(
      existing.map((p) => p.sourceUrl).filter((s): s is string => Boolean(s)),
    );
    let nextSortOrder = existing.reduce((max, p) => Math.max(max, p.sortOrder), -1) + 1;

    const saved: Array<{ id: string; url: string; alt: string; isPrimary: boolean }> = [];
    const skipped: Array<{ url: string; reason: string }> = [];

    for (const image of images) {
      if (!image?.url || typeof image.url !== 'string') {
        skipped.push({ url: String(image?.url ?? ''), reason: 'missing url' });
        continue;
      }
      if (alreadyImported.has(image.url)) {
        skipped.push({ url: image.url, reason: 'already imported' });
        continue;
      }

      const fetched = await fetchImage(image.url);
      if (!fetched.ok) {
        // Report per-image rather than failing the batch: one dead CDN link
        // should not discard the images that did download.
        console.warn('[save-property-images] skipped', { url: image.url, reason: fetched.reason });
        skipped.push({ url: image.url, reason: fetched.reason });
        continue;
      }

      const photo = await prisma.propertyPhoto.create({
        data: {
          propertyId,
          // Replaced immediately below with our own origin path, which is what
          // the CSP permits. The id is only known after the insert.
          url: 'pending',
          caption: image.alt || null,
          isPrimary: Boolean(image.isPrimary),
          sortOrder: nextSortOrder,
          sourceUrl: image.url,
          blob: {
            create: {
              data: fetched.data,
              contentType: fetched.contentType,
              byteSize: fetched.data.byteLength,
            },
          },
        },
        select: { id: true },
      });

      // The extension is cosmetic -- the serving route sends the stored content
      // type -- but it keeps the URL recognisable to humans and crawlers.
      const ext = EXTENSION_BY_TYPE[fetched.contentType] ?? 'jpg';
      const url = `/api/properties/photos/${photo.id}.${ext}`;
      await prisma.propertyPhoto.update({ where: { id: photo.id }, data: { url } });

      saved.push({
        id: photo.id,
        url,
        alt: image.alt || '',
        isPrimary: Boolean(image.isPrimary),
      });
      nextSortOrder += 1;
      alreadyImported.add(image.url);
    }

    if (saved.length === 0) {
      return NextResponse.json(
        { error: 'No images could be imported', propertyId, skipped },
        { status: 422 },
      );
    }

    // Exactly one primary. Resolved from stored state after the writes rather
    // than from what this request happened to send, so a second import cannot
    // leave a property with two cover images.
    const primary =
      (await prisma.propertyPhoto.findFirst({
        where: { propertyId, isPrimary: true },
        orderBy: { sortOrder: 'asc' },
        select: { id: true, url: true },
      })) ??
      (await prisma.propertyPhoto.findFirst({
        where: { propertyId },
        orderBy: { sortOrder: 'asc' },
        select: { id: true, url: true },
      }));

    if (primary) {
      await prisma.propertyPhoto.updateMany({
        where: { propertyId, isPrimary: true, id: { not: primary.id } },
        data: { isPrimary: false },
      });
      await prisma.propertyPhoto.update({
        where: { id: primary.id },
        data: { isPrimary: true },
      });
    }

    const totalImages = await prisma.propertyPhoto.count({ where: { propertyId } });

    return NextResponse.json({
      propertyId,
      images: saved,
      skipped,
      totalImages,
      uploaded: true,
      coverImage: primary?.url ?? null,
    });
  } catch (error: unknown) {
    console.error('Save images error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to save images' },
      { status: 500 },
    );
  }
}
