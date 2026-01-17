import { NextRequest, NextResponse } from 'next/server';

/**
 * VRBO Image Scraper API
 * Fetches image URLs from VRBO listing pages
 *
 * @author ECHO OMEGA PRIME
 */

// VRBO image patterns
const VRBO_IMAGE_PATTERNS = [
  /https:\/\/images\.trvl-media\.com\/lodging\/[^"'\s]+/g,
  /https:\/\/a0\.muscache\.com\/[^"'\s]+/g,
];

// Convert to high-res URL
function getHighResUrl(url: string): string {
  // Remove query params and size indicators
  let highRes = url.split('?')[0];

  // Replace size indicators with largest size
  highRes = highRes.replace(/_[smt]\./, '_z.');
  highRes = highRes.replace(/\/[smt]\./, '/z.');

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

export async function POST(request: NextRequest) {
  try {
    const { vrboId, vrboUrl } = await request.json();

    if (!vrboId || !vrboUrl) {
      return NextResponse.json(
        { error: 'Missing vrboId or vrboUrl' },
        { status: 400 }
      );
    }

    // Fetch VRBO page
    const response = await fetch(vrboUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
    });

    if (!response.ok) {
      throw new Error(`VRBO returned ${response.status}`);
    }

    const html = await response.text();

    // Extract image URLs from HTML
    const allUrls: string[] = [];

    for (const pattern of VRBO_IMAGE_PATTERNS) {
      const matches = html.match(pattern) || [];
      allUrls.push(...matches);
    }

    // Also try to find JSON data with images
    const jsonMatches = html.match(/\{[^{}]*"image[^{}]*"[^{}]*\}/g) || [];
    for (const jsonStr of jsonMatches) {
      try {
        const urls = jsonStr.match(/https:\/\/images\.trvl-media\.com[^"'\s]+/g) || [];
        allUrls.push(...urls);
      } catch {
        // Ignore JSON parse errors
      }
    }

    // Look for gallery data
    const galleryMatch = html.match(/window\.__PRELOADED_STATE__\s*=\s*({[^<]+})/);
    if (galleryMatch) {
      try {
        const urls = galleryMatch[1].match(/https:\/\/images\.trvl-media\.com[^"'\s\\]+/g) || [];
        allUrls.push(...urls.map(u => u.replace(/\\/g, '')));
      } catch {
        // Ignore errors
      }
    }

    // Process and deduplicate
    const images = processImages(allUrls);

    // If we found very few images, try alternate approach
    if (images.length < 5) {
      // Try fetching the media gallery endpoint directly
      const galleryUrl = `https://www.vrbo.com/api/gallery/${vrboId}`;
      try {
        const galleryResponse = await fetch(galleryUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'application/json',
          },
        });

        if (galleryResponse.ok) {
          const galleryData = await galleryResponse.json();
          const galleryUrls = JSON.stringify(galleryData).match(/https:\/\/images\.trvl-media\.com[^"'\s\\]+/g) || [];
          images.push(...processImages(galleryUrls.map(u => u.replace(/\\/g, ''))));
        }
      } catch {
        // Ignore gallery fetch errors
      }
    }

    // Final dedup
    const uniqueImages = [...new Set(images)];

    return NextResponse.json({
      vrboId,
      images: uniqueImages,
      count: uniqueImages.length,
    });
  } catch (error: any) {
    console.error('VRBO scrape error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to scrape images' },
      { status: 500 }
    );
  }
}
