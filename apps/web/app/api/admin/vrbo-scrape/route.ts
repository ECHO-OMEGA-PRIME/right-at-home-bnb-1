import { NextRequest, NextResponse } from 'next/server';

/**
 * VRBO Image Scraper API
 * Fetches image URLs from VRBO listing pages
 * Uses thumbnail gallery URL for complete image access
 *
 * @author ECHO OMEGA PRIME
 */

// VRBO image patterns - comprehensive list
const VRBO_IMAGE_PATTERNS = [
  /https:\/\/images\.trvl-media\.com\/lodging\/[^"'\s\\]+/g,
  /https:\/\/images\.trvl-media\.com\/hotels\/[^"'\s\\]+/g,
  /https:\/\/a0\.muscache\.com\/[^"'\s\\]+/g,
  /https:\/\/mediaim\.expedia\.com\/[^"'\s\\]+/g,
];

// High-res size suffixes to try
const HIGH_RES_SIZES = ['y', 'z', 'x', 'w', 'l'];

// Convert to high-res URL
function getHighResUrl(url: string): string {
  // Clean up escaped characters
  let highRes = url.replace(/\\/g, '');

  // Remove query params for normalization but keep for some URLs
  const baseUrl = highRes.split('?')[0];

  // Replace size indicators with largest size
  // Pattern: _s, _m, _t, _l, _z, _y (small to large)
  highRes = baseUrl.replace(/_[smtlzxy]\./, '_y.');
  highRes = highRes.replace(/\/[smtlzxy]\./, '/y.');

  // For trvl-media URLs, try to get the largest version
  if (highRes.includes('trvl-media.com')) {
    // Remove any size suffix and add the largest
    highRes = highRes.replace(/(_[a-z])?\.(jpg|jpeg|png|webp)/i, '_y.$2');
  }

  return highRes;
}

// Deduplicate and filter images
function processImages(urls: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const url of urls) {
    // Skip small thumbnails and icons
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

// Common headers to mimic a real browser
const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'Cache-Control': 'no-cache',
  'Pragma': 'no-cache',
  'Sec-Ch-Ua': '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
  'Sec-Ch-Ua-Mobile': '?0',
  'Sec-Ch-Ua-Platform': '"Windows"',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Sec-Fetch-User': '?1',
  'Upgrade-Insecure-Requests': '1',
};

// Extract images from __NEXT_DATA__ JSON
function extractFromNextData(html: string): string[] {
  const urls: string[] = [];

  // Look for __NEXT_DATA__ script tag
  const nextDataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([^<]+)<\/script>/);
  if (nextDataMatch) {
    try {
      const data = JSON.parse(nextDataMatch[1]);
      const dataStr = JSON.stringify(data);

      // Extract all image URLs
      for (const pattern of VRBO_IMAGE_PATTERNS) {
        const matches = dataStr.match(pattern) || [];
        urls.push(...matches);
      }
    } catch {
      // Ignore parse errors
    }
  }

  return urls;
}

// Extract images from __PRELOADED_STATE__
function extractFromPreloadedState(html: string): string[] {
  const urls: string[] = [];

  const stateMatch = html.match(/window\.__PRELOADED_STATE__\s*=\s*({[\s\S]*?});?\s*(?:<\/script>|window\.)/);
  if (stateMatch) {
    try {
      // Extract all image URLs from the stringified state
      for (const pattern of VRBO_IMAGE_PATTERNS) {
        const matches = stateMatch[1].match(pattern) || [];
        urls.push(...matches);
      }
    } catch {
      // Ignore errors
    }
  }

  return urls;
}

// Extract from property gallery data structures
function extractFromGalleryData(html: string): string[] {
  const urls: string[] = [];

  // Look for propertyGallery or similar data structures
  const galleryPatterns = [
    /"propertyGallery":\s*(\{[^}]+\}|\[[^\]]+\])/g,
    /"images":\s*\[[^\]]+\]/g,
    /"photos":\s*\[[^\]]+\]/g,
    /"mediaItems":\s*\[[^\]]+\]/g,
    /"gallery":\s*\[[^\]]+\]/g,
  ];

  for (const pattern of galleryPatterns) {
    const matches = Array.from(html.matchAll(pattern));
    for (const match of matches) {
      for (const imgPattern of VRBO_IMAGE_PATTERNS) {
        const imgUrls = match[0].match(imgPattern) || [];
        urls.push(...imgUrls);
      }
    }
  }

  return urls;
}

export async function POST(request: NextRequest) {
  try {
    const { vrboId, vrboUrl } = await request.json();

    if (!vrboId || !vrboUrl) {
      return NextResponse.json(
        { error: 'Missing vrboId or vrboUrl' },
        { status: 400 }
      );
    }

    const allUrls: string[] = [];
    const errors: string[] = [];

    // Build the gallery URL with thumbnail dialog parameter
    const baseUrl = vrboUrl.split('?')[0];
    const galleryPageUrl = `${baseUrl}?pwaThumbnailDialog=thumbnail-gallery`;

    // Strategy 1: Fetch the gallery page directly
    try {
      const galleryResponse = await fetch(galleryPageUrl, {
        headers: BROWSER_HEADERS,
      });

      if (galleryResponse.ok) {
        const galleryHtml = await galleryResponse.text();

        // Extract from various data structures
        allUrls.push(...extractFromNextData(galleryHtml));
        allUrls.push(...extractFromPreloadedState(galleryHtml));
        allUrls.push(...extractFromGalleryData(galleryHtml));

        // Direct pattern matching on HTML
        for (const pattern of VRBO_IMAGE_PATTERNS) {
          const matches = galleryHtml.match(pattern) || [];
          allUrls.push(...matches);
        }
      } else {
        errors.push(`Gallery page returned ${galleryResponse.status}`);
      }
    } catch (e: any) {
      errors.push(`Gallery fetch failed: ${e.message}`);
    }

    // Strategy 2: If gallery failed or found few images, try main page
    if (allUrls.length < 10) {
      try {
        const mainResponse = await fetch(vrboUrl, {
          headers: BROWSER_HEADERS,
        });

        if (mainResponse.ok) {
          const mainHtml = await mainResponse.text();

          allUrls.push(...extractFromNextData(mainHtml));
          allUrls.push(...extractFromPreloadedState(mainHtml));
          allUrls.push(...extractFromGalleryData(mainHtml));

          for (const pattern of VRBO_IMAGE_PATTERNS) {
            const matches = mainHtml.match(pattern) || [];
            allUrls.push(...matches);
          }
        }
      } catch (e: any) {
        errors.push(`Main page fetch failed: ${e.message}`);
      }
    }

    // Strategy 3: Try the BFF/API endpoints VRBO uses internally
    const apiEndpoints = [
      `https://www.vrbo.com/serp/api/property/${vrboId}`,
      `https://www.vrbo.com/pwa/api/v1/property/${vrboId}`,
      `https://www.vrbo.com/api/pdp/property/${vrboId}`,
    ];

    for (const endpoint of apiEndpoints) {
      if (allUrls.length >= 20) break; // We have enough

      try {
        const apiResponse = await fetch(endpoint, {
          headers: {
            ...BROWSER_HEADERS,
            'Accept': 'application/json',
          },
        });

        if (apiResponse.ok) {
          const apiData = await apiResponse.text();
          for (const pattern of VRBO_IMAGE_PATTERNS) {
            const matches = apiData.match(pattern) || [];
            allUrls.push(...matches);
          }
        }
      } catch {
        // API endpoint failed, continue to next
      }
    }

    // Process and deduplicate all found URLs
    const images = processImages(allUrls);

    // If we still have very few images, return what we have with a warning
    const response: {
      vrboId: string;
      images: string[];
      count: number;
      galleryUrl: string;
      warning?: string;
      errors?: string[];
    } = {
      vrboId,
      images,
      count: images.length,
      galleryUrl: galleryPageUrl,
    };

    if (images.length < 5 && errors.length > 0) {
      response.warning = 'Few images found - VRBO may be blocking requests. Try opening the gallery URL directly.';
      response.errors = errors;
    }

    return NextResponse.json(response);
  } catch (error: any) {
    console.error('VRBO scrape error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to scrape images' },
      { status: 500 }
    );
  }
}
