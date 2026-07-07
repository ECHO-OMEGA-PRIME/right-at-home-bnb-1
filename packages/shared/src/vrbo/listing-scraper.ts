/**
 * VRBO public listing page scraper — title, photos, description, amenities, price.
 * No Partner Central API required; scrapes https://www.vrbo.com/<listingId>.
 */

export const VRBO_LISTING_IDS = [
  '2634718', '2636389', '2638481', '2638524', '2643784', '2643822',
  '3005111', '3355618', '3477668', '4179271', '4437486', '4471713',
  '4581977', '4700881', '4750070',
] as const;

export interface VrboListingData {
  vrboId: string;
  vrboUrl: string;
  title: string;
  description: string;
  nightlyRate: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  maxGuests: number | null;
  amenities: string[];
  photos: string[];
  scrapedAt: string;
}

const IMAGE_PATTERNS = [
  /https:\/\/images\.trvl-media\.com\/lodging\/[^"'\s\\]+/g,
  /https:\/\/images\.trvl-media\.com\/hotels\/[^"'\s\\]+/g,
  /https:\/\/a0\.muscache\.com\/[^"'\s\\]+/g,
  /https:\/\/mediaim\.expedia\.com\/[^"'\s\\]+/g,
];

const BROWSER_HEADERS: Record<string, string> = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
};

function getHighResUrl(url: string): string {
  let highRes = url.replace(/\\/g, '');
  const baseUrl = highRes.split('?')[0];
  highRes = baseUrl.replace(/_[smtlzxy]\./, '_y.');
  if (highRes.includes('trvl-media.com')) {
    highRes = highRes.replace(/(_[a-z])?\.(jpg|jpeg|png|webp)/i, '_y.$2');
  }
  return highRes;
}

function processImages(urls: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const url of urls) {
    if (url.includes('/icon') || url.includes('/logo') || url.includes('_t.') || url.length < 50) {
      continue;
    }
    const highRes = getHighResUrl(url);
    const normalized = highRes.replace(/https?:\/\//, '').split('?')[0];
    if (!seen.has(normalized)) {
      seen.add(normalized);
      result.push(highRes);
    }
  }
  return result;
}

function extractFromJsonBlob(html: string): Record<string, unknown> | null {
  const nextDataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([^<]+)<\/script>/);
  if (nextDataMatch) {
    try {
      return JSON.parse(nextDataMatch[1]) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
  return null;
}

function extractImages(html: string): string[] {
  const urls: string[] = [];
  const json = extractFromJsonBlob(html);
  if (json) {
    const dataStr = JSON.stringify(json);
    for (const pattern of IMAGE_PATTERNS) {
      urls.push(...(dataStr.match(pattern) ?? []));
    }
  }
  for (const pattern of IMAGE_PATTERNS) {
    urls.push(...(html.match(pattern) ?? []));
  }
  return processImages(urls);
}

function extractTitle(html: string): string {
  const ogTitle = html.match(/<meta[^>]+property="og:title"[^>]+content="([^"]+)"/i);
  if (ogTitle) return decodeHtmlEntities(ogTitle[1]);

  const h1 = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
  if (h1) return decodeHtmlEntities(h1[1].trim());

  const titleTag = html.match(/<title>([^<]+)<\/title>/i);
  if (titleTag) return decodeHtmlEntities(titleTag[1].split('|')[0].trim());

  return '';
}

function extractDescription(html: string): string {
  const ogDesc = html.match(/<meta[^>]+property="og:description"[^>]+content="([^"]+)"/i);
  if (ogDesc) return decodeHtmlEntities(ogDesc[1]);

  const metaDesc = html.match(/<meta[^>]+name="description"[^>]+content="([^"]+)"/i);
  if (metaDesc) return decodeHtmlEntities(metaDesc[1]);

  return '';
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function extractNightlyRate(html: string): number | null {
  const patterns = [
    /\$(\d{2,4})\s*(?:\/\s*night|per night|night)/i,
    /"nightlyPrice"\s*:\s*(\d+(?:\.\d+)?)/i,
    /"price"\s*:\s*\{[^}]*"value"\s*:\s*(\d+(?:\.\d+)?)/i,
    /"displayPrice"\s*:\s*"?\$?(\d+(?:\.\d+)?)/i,
  ];
  for (const p of patterns) {
    const m = html.match(p);
    if (m) {
      const rate = parseFloat(m[1]);
      if (!Number.isNaN(rate) && rate > 0 && rate < 10000) return rate;
    }
  }
  return null;
}

function extractAmenities(html: string): string[] {
  const amenities: string[] = [];
  const amenityMatches = html.matchAll(/"amenity(?:Name|Label)"\s*:\s*"([^"]+)"/gi);
  for (const m of amenityMatches) {
    const label = decodeHtmlEntities(m[1]);
    if (label && !amenities.includes(label)) amenities.push(label);
  }

  const listItems = html.matchAll(/class="[^"]*amenity[^"]*"[^>]*>([^<]+)</gi);
  for (const m of listItems) {
    const label = decodeHtmlEntities(m[1].trim());
    if (label && label.length < 80 && !amenities.includes(label)) amenities.push(label);
  }

  return amenities.slice(0, 50);
}

function extractRoomCounts(html: string): { bedrooms: number | null; bathrooms: number | null; maxGuests: number | null } {
  const bedrooms = html.match(/(\d+)\s*(?:bed(?:room)?s?|BR)\b/i);
  const bathrooms = html.match(/(\d+(?:\.\d+)?)\s*(?:bath(?:room)?s?|BA)\b/i);
  const guests = html.match(/(?:sleeps?|guests?|accommodates?)\s*(\d+)/i);

  return {
    bedrooms: bedrooms ? parseInt(bedrooms[1], 10) : null,
    bathrooms: bathrooms ? parseFloat(bathrooms[1]) : null,
    maxGuests: guests ? parseInt(guests[1], 10) : null,
  };
}

/**
 * Scrape a single VRBO listing page.
 */
export async function scrapeVrboListing(
  vrboId: string,
  fetchFn: typeof fetch = fetch
): Promise<VrboListingData> {
  const vrboUrl = `https://www.vrbo.com/${vrboId}`;
  const response = await fetchFn(vrboUrl, { headers: BROWSER_HEADERS });

  if (!response.ok) {
    throw new Error(`VRBO page fetch failed: ${response.status} for ${vrboUrl}`);
  }

  const html = await response.text();
  const { bedrooms, bathrooms, maxGuests } = extractRoomCounts(html);

  return {
    vrboId,
    vrboUrl,
    title: extractTitle(html) || `VRBO Listing ${vrboId}`,
    description: extractDescription(html),
    nightlyRate: extractNightlyRate(html),
    bedrooms,
    bathrooms,
    maxGuests,
    amenities: extractAmenities(html),
    photos: extractImages(html),
    scrapedAt: new Date().toISOString(),
  };
}

/**
 * Scrape multiple listings with delay between requests.
 */
export async function scrapeVrboListings(
  vrboIds: string[],
  options?: { delayMs?: number; fetchFn?: typeof fetch }
): Promise<{ listings: VrboListingData[]; errors: { vrboId: string; error: string }[] }> {
  const delayMs = options?.delayMs ?? 1000;
  const fetchFn = options?.fetchFn ?? fetch;
  const listings: VrboListingData[] = [];
  const errors: { vrboId: string; error: string }[] = [];

  for (const vrboId of vrboIds) {
    try {
      listings.push(await scrapeVrboListing(vrboId, fetchFn));
    } catch (err) {
      errors.push({
        vrboId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
    if (delayMs > 0) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }

  return { listings, errors };
}