/**
 * POST /api/admin/save-property-images and the route that serves the bytes.
 *
 * The assertions that matter are the ones the Firebase version had no answer
 * for: the source URL is caller-supplied, so host, scheme, size and content
 * type all have to be enforced before anything is persisted; and a store
 * failure while serving must not be reported as a missing image.
 */

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

const {
  propertyFindUnique,
  photoFindMany,
  photoFindFirst,
  photoCreate,
  photoUpdate,
  photoUpdateMany,
  photoCount,
  blobFindUnique,
} = vi.hoisted(() => ({
  propertyFindUnique: vi.fn(),
  photoFindMany: vi.fn(),
  photoFindFirst: vi.fn(),
  photoCreate: vi.fn(),
  photoUpdate: vi.fn(),
  photoUpdateMany: vi.fn(),
  photoCount: vi.fn(),
  blobFindUnique: vi.fn(),
}));

const { requireOneOfRoles } = vi.hoisted(() => ({ requireOneOfRoles: vi.fn() }));

vi.mock('@/lib/api-auth', () => ({ requireOneOfRoles }));
vi.mock('@/lib/prisma', () => ({
  default: {
    property: { findUnique: propertyFindUnique },
    propertyPhoto: {
      findMany: photoFindMany,
      findFirst: photoFindFirst,
      create: photoCreate,
      update: photoUpdate,
      updateMany: photoUpdateMany,
      count: photoCount,
    },
    propertyPhotoBlob: { findUnique: blobFindUnique },
  },
}));

import { POST } from '../../../app/api/admin/save-property-images/route';
import { GET } from '../../../app/api/properties/photos/[photoId]/route';

const fetchMock = vi.fn();

function request(body: unknown) {
  return { json: async () => body } as never;
}

function imageResponse(contentType = 'image/jpeg', bytes = 1024) {
  return {
    ok: true,
    status: 200,
    headers: {
      get: (name: string) =>
        name.toLowerCase() === 'content-type'
          ? contentType
          : name.toLowerCase() === 'content-length'
            ? String(bytes)
            : null,
    },
    arrayBuffer: async () => new ArrayBuffer(bytes),
  };
}

const GOOD_URL = 'https://images.vrbo.com/lodging/1.jpg';

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('fetch', fetchMock);

  requireOneOfRoles.mockResolvedValue({
    user: { uid: 'u1', email: 'a@b.c', role: 'admin', workerType: null, isDevMode: false },
    error: null,
  });
  propertyFindUnique.mockResolvedValue({ id: 'prop-1' });
  photoFindMany.mockResolvedValue([]);
  photoCreate.mockResolvedValue({ id: 'photo-1' });
  photoUpdate.mockResolvedValue({});
  photoUpdateMany.mockResolvedValue({ count: 0 });
  photoCount.mockResolvedValue(1);
  photoFindFirst.mockResolvedValue({ id: 'photo-1', url: '/api/properties/photos/photo-1.jpg' });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('POST /api/admin/save-property-images', () => {
  it('imports an allowed image and stores it under our own origin', async () => {
    fetchMock.mockResolvedValue(imageResponse());

    const res = await POST(
      request({ propertyId: 'prop-1', images: [{ url: GOOD_URL, alt: 'Front', isPrimary: true }] }),
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    // The whole point: a path on our own origin, which is what the CSP allows.
    expect(body.images[0].url).toBe('/api/properties/photos/photo-1.jpg');
    expect(body.coverImage).toBe('/api/properties/photos/photo-1.jpg');

    const created = photoCreate.mock.calls[0][0];
    expect(created.data.sourceUrl).toBe(GOOD_URL);
    expect(created.data.blob.create.contentType).toBe('image/jpeg');
    expect(created.data.blob.create.byteSize).toBe(1024);
  });

  it('refuses a host outside the allowlist without fetching it', async () => {
    // The URL is caller-supplied and the route runs server-side; an internal
    // address must never be requested, let alone persisted.
    const res = await POST(
      request({ propertyId: 'prop-1', images: [{ url: 'https://169.254.169.254/latest/meta-data' }] }),
    );

    expect(fetchMock).not.toHaveBeenCalled();
    expect(photoCreate).not.toHaveBeenCalled();
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.skipped[0].reason).toMatch(/not an allowed image source/);
  });

  it('refuses a non-https scheme', async () => {
    const res = await POST(
      request({ propertyId: 'prop-1', images: [{ url: 'http://images.vrbo.com/1.jpg' }] }),
    );

    expect(fetchMock).not.toHaveBeenCalled();
    expect(res.status).toBe(422);
    expect((await res.json()).skipped[0].reason).toMatch(/only https/);
  });

  it('does not treat a lookalike domain as allowed', async () => {
    const res = await POST(
      request({ propertyId: 'prop-1', images: [{ url: 'https://vrbo.com.evil.test/1.jpg' }] }),
    );

    expect(fetchMock).not.toHaveBeenCalled();
    expect(res.status).toBe(422);
  });

  it('refuses a response that is not an image', async () => {
    fetchMock.mockResolvedValue(imageResponse('text/html'));

    const res = await POST(request({ propertyId: 'prop-1', images: [{ url: GOOD_URL }] }));

    expect(photoCreate).not.toHaveBeenCalled();
    expect((await res.json()).skipped[0].reason).toMatch(/unsupported content type/);
  });

  it('refuses an oversized image', async () => {
    fetchMock.mockResolvedValue(imageResponse('image/jpeg', 16 * 1024 * 1024));

    const res = await POST(request({ propertyId: 'prop-1', images: [{ url: GOOD_URL }] }));

    expect(photoCreate).not.toHaveBeenCalled();
    expect((await res.json()).skipped[0].reason).toMatch(/over the/);
  });

  it('refuses to follow a redirect off the allowlist', async () => {
    // Otherwise one permitted host becomes an open fetch of whatever it
    // chooses to redirect to.
    fetchMock.mockResolvedValue(imageResponse());

    await POST(request({ propertyId: 'prop-1', images: [{ url: GOOD_URL }] }));

    expect(fetchMock.mock.calls[0][1]).toMatchObject({ redirect: 'error' });
  });

  it('keeps the good images when one source fails', async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: false, status: 404, headers: { get: () => null } })
      .mockResolvedValueOnce(imageResponse());

    const res = await POST(
      request({
        propertyId: 'prop-1',
        images: [{ url: 'https://images.vrbo.com/dead.jpg' }, { url: GOOD_URL }],
      }),
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.images).toHaveLength(1);
    expect(body.skipped[0].reason).toMatch(/404/);
  });

  it('skips a source it has already imported', async () => {
    photoFindMany.mockResolvedValue([{ id: 'old', sourceUrl: GOOD_URL, sortOrder: 0 }]);

    const res = await POST(request({ propertyId: 'prop-1', images: [{ url: GOOD_URL }] }));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(photoCreate).not.toHaveBeenCalled();
    expect((await res.json()).skipped[0].reason).toBe('already imported');
  });

  it('rejects an unknown property before fetching anything', async () => {
    propertyFindUnique.mockResolvedValue(null);

    const res = await POST(request({ propertyId: 'nope', images: [{ url: GOOD_URL }] }));

    expect(res.status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('propagates the auth error without touching the database', async () => {
    requireOneOfRoles.mockResolvedValue({ user: null, error: new Response(null, { status: 403 }) });

    const res = await POST(request({ propertyId: 'prop-1', images: [{ url: GOOD_URL }] }));

    expect(res.status).toBe(403);
    expect(propertyFindUnique).not.toHaveBeenCalled();
  });

  it('leaves exactly one primary photo', async () => {
    fetchMock.mockResolvedValue(imageResponse());

    await POST(
      request({ propertyId: 'prop-1', images: [{ url: GOOD_URL, isPrimary: true }] }),
    );

    expect(photoUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ isPrimary: true, id: { not: 'photo-1' } }),
        data: { isPrimary: false },
      }),
    );
  });
});

describe('GET /api/properties/photos/[photoId]', () => {
  it('serves the stored bytes with the stored content type', async () => {
    blobFindUnique.mockResolvedValue({
      data: Buffer.from([1, 2, 3]),
      contentType: 'image/png',
      byteSize: 3,
    });

    const res = await GET({} as never, { params: { photoId: 'photo-1.png' } });

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('image/png');
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(res.headers.get('Cache-Control')).toMatch(/immutable/);
    // The cosmetic extension must be stripped before the lookup.
    expect(blobFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { photoId: 'photo-1' } }),
    );
  });

  it('404s an unknown photo', async () => {
    blobFindUnique.mockResolvedValue(null);
    const res = await GET({} as never, { params: { photoId: 'nope' } });
    expect(res.status).toBe(404);
  });

  it('503s rather than 404s when the store is down', async () => {
    // A 404 would tell every caller and crawler the image is permanently gone.
    blobFindUnique.mockRejectedValue(new Error('connection refused'));

    const res = await GET({} as never, { params: { photoId: 'photo-1' } });

    expect(res.status).toBe(503);
    expect(res.headers.get('Retry-After')).toBe('30');
  });
});
