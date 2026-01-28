#!/usr/bin/env python3
"""
VRBO VISIBLE BROWSER SCRAPER - Anti-Detection Edition
Runs visible browser with stealth settings to bypass VRBO anti-bot

@author ECHO OMEGA PRIME
@mode VISIBLE BROWSER - DEFEATS BOT DETECTION
"""

import asyncio
import json
import re
import sys
from pathlib import Path
from datetime import datetime

from playwright.async_api import async_playwright

# Output directory
OUTPUT_DIR = Path(__file__).parent / "vrbo_images"
OUTPUT_DIR.mkdir(exist_ok=True)

# Property configurations
PROPERTIES = [
    {"propertyId": "castleford-5001", "propertyName": "Oasis with Pool-Billiards @ Castleford", "vrboId": "2636389"},
    {"propertyId": "adobe-compound-gc", "propertyName": "Adobe Compound @ Golf Course", "vrboId": "3005111"},
    {"propertyId": "garfield-2702", "propertyName": "Patio Home with Hot Tub @ Garfield", "vrboId": "2634718"},
    {"propertyId": "douglas-4501", "propertyName": "Old Midland Living @ Douglas", "vrboId": "3355618"},
    {"propertyId": "dentcrest-4707", "propertyName": "Hot Tub Delight @ Dentcrest", "vrboId": "2638481"},
    {"propertyId": "safari-gameroom", "propertyName": "Safari Gameroom", "vrboId": "2638524"},
    {"propertyId": "storey-2103", "propertyName": "Destination Getaway @ Storey", "vrboId": "2643822"},
    {"propertyId": "chelsea-3210", "propertyName": "Retreat with Covered Patio @ Chelsea", "vrboId": "2643784"},
    {"propertyId": "oriole-6100", "propertyName": "Most Marvelous with Pool @ Oriole", "vrboId": "4471713"},
    {"propertyId": "lanham-1426", "propertyName": "Posh & Private with Billiards @ Lanham", "vrboId": "4437486"},
    {"propertyId": "humble-3106", "propertyName": "Outdoor Dream @ Humble", "vrboId": "4700881"},
    {"propertyId": "daventry-1311", "propertyName": "Santiago Dreams @ 1311 Daventry", "vrboId": "4179271"},
    {"propertyId": "lincoln-green-5055", "propertyName": "Sprawling Ranch House @ Lincoln Green (FLAGSHIP)", "vrboId": "4581977"},
    {"propertyId": "daventry-1309", "propertyName": "Saddle Club @ 1309 Daventry", "vrboId": "4750070"},
    {"propertyId": "monterrey-house", "propertyName": "Monterrey House", "vrboId": "3477668"},
]


def get_high_res_url(url: str) -> str:
    """Convert to highest resolution URL"""
    base = url.split('?')[0]
    base = re.sub(r'_[smtlzxy]\.', '_y.', base)
    base = re.sub(r'/[smtlzxy]\.', '/y.', base)
    base = base.replace('\\/', '/').replace('\\u002F', '/')
    return base


def extract_urls_from_text(text: str) -> set:
    """Extract all VRBO image URLs from text"""
    urls = set()
    patterns = [
        r'https://images\.trvl-media\.com/lodging/[^"\'<>\s\\]+',
        r'https://images\.trvl-media\.com/hotels/[^"\'<>\s\\]+',
        r'https://mediaim\.expedia\.com/[^"\'<>\s\\]+',
    ]
    for pattern in patterns:
        for match in re.findall(pattern, text):
            clean = match.replace('\\/', '/').replace('\\u002F', '/')
            if any(ext in clean.lower() for ext in ['.jpg', '.jpeg', '.png', '.webp']):
                urls.add(get_high_res_url(clean))
    return urls


async def scrape_property_visible(prop: dict, browser) -> dict:
    """
    Scrape property with VISIBLE browser to defeat bot detection
    """
    vrbo_id = prop['vrboId']
    property_id = prop['propertyId']
    property_name = prop['propertyName']

    main_url = f"https://www.vrbo.com/{vrbo_id}"
    all_images = set()

    print(f"\n{'='*70}")
    print(f"PROPERTY: {property_name}")
    print(f"VRBO ID: {vrbo_id}")
    print(f"{'='*70}")

    # Create context with realistic settings
    context = await browser.new_context(
        viewport={'width': 1920, 'height': 1080},
        user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        locale='en-US',
        timezone_id='America/Chicago',
        geolocation={'longitude': -102.0779, 'latitude': 31.9973},  # Midland, TX
        permissions=['geolocation'],
    )

    # Add stealth scripts to hide automation
    await context.add_init_script("""
        // Overwrite the webdriver property
        Object.defineProperty(navigator, 'webdriver', {
            get: () => undefined
        });

        // Overwrite plugins
        Object.defineProperty(navigator, 'plugins', {
            get: () => [1, 2, 3, 4, 5]
        });

        // Overwrite languages
        Object.defineProperty(navigator, 'languages', {
            get: () => ['en-US', 'en']
        });

        // Remove automation indicators
        delete window.cdc_adoQpoasnfa76pfcZLmcfl_Array;
        delete window.cdc_adoQpoasnfa76pfcZLmcfl_Promise;
        delete window.cdc_adoQpoasnfa76pfcZLmcfl_Symbol;
    """)

    page = await context.new_page()

    # Capture images from network
    async def capture_response(response):
        url = response.url
        if 'images.trvl-media.com' in url or 'mediaim.expedia.com' in url:
            all_images.add(get_high_res_url(url))

    page.on('response', capture_response)

    try:
        # STEP 1: Navigate to main page
        print(f"[1/7] Loading main page...")
        await page.goto(main_url, wait_until='networkidle', timeout=60000)
        await asyncio.sleep(5)  # Wait for JS to fully render

        # Extract from page
        html = await page.content()
        all_images.update(extract_urls_from_text(html))
        print(f"       Found {len(all_images)} images from main page")

        # STEP 2: Scroll down to load lazy images
        print(f"[2/7] Scrolling to load lazy images...")
        for _ in range(5):
            await page.evaluate('window.scrollBy(0, window.innerHeight)')
            await asyncio.sleep(1)
        await page.evaluate('window.scrollTo(0, 0)')
        await asyncio.sleep(2)

        html = await page.content()
        all_images.update(extract_urls_from_text(html))
        print(f"       Total after scroll: {len(all_images)} images")

        # STEP 3: Find and click gallery/photo button
        print(f"[3/7] Looking for gallery button...")

        gallery_buttons = [
            'button:has-text("See all")',
            'button:has-text("View all")',
            'button:has-text("photos")',
            'button:has-text("Photos")',
            '[data-stid="open-media-gallery"]',
            '[data-stid="property-media-0"]',
            '[class*="gallery-trigger"]',
            '[class*="all-photos"]',
            '[aria-label*="gallery"]',
            '[aria-label*="photos"]',
        ]

        for selector in gallery_buttons:
            try:
                btn = await page.wait_for_selector(selector, timeout=2000)
                if btn:
                    await btn.click()
                    print(f"       Clicked: {selector}")
                    await asyncio.sleep(3)
                    break
            except:
                continue

        # STEP 4: Try clicking on main image
        print(f"[4/7] Clicking on main property image...")

        image_selectors = [
            '[data-stid="property-media-0"] img',
            '[class*="hero"] img',
            '[class*="PropertyImage"] img',
            '[class*="media-gallery"] img',
            'img[alt*="Property"]',
            'img[alt*="property"]',
        ]

        for selector in image_selectors:
            try:
                img = await page.wait_for_selector(selector, timeout=2000)
                if img:
                    await img.click()
                    print(f"       Clicked image: {selector}")
                    await asyncio.sleep(3)
                    break
            except:
                continue

        # STEP 5: Extract images from current state
        print(f"[5/7] Extracting images...")
        html = await page.content()
        all_images.update(extract_urls_from_text(html))

        # Also get all img src attributes
        imgs = await page.query_selector_all('img')
        for img in imgs:
            try:
                src = await img.get_attribute('src')
                srcset = await img.get_attribute('srcset')
                data_src = await img.get_attribute('data-src')

                for url in [src, data_src]:
                    if url and 'trvl-media' in url:
                        all_images.add(get_high_res_url(url))

                if srcset:
                    for part in srcset.split(','):
                        url = part.strip().split(' ')[0]
                        if 'trvl-media' in url:
                            all_images.add(get_high_res_url(url))
            except:
                continue

        print(f"       Total images found: {len(all_images)}")

        # STEP 6: Navigate through gallery with keyboard
        print(f"[6/7] Navigating with arrow keys...")

        for i in range(50):  # Press right arrow up to 50 times
            await page.keyboard.press('ArrowRight')
            await asyncio.sleep(0.3)

            # Extract after each navigation
            if i % 10 == 9:
                html = await page.content()
                before = len(all_images)
                all_images.update(extract_urls_from_text(html))
                print(f"       After {i+1} navigations: {len(all_images)} images (+{len(all_images)-before})")

        # STEP 7: Final extraction
        print(f"[7/7] Final extraction...")
        await asyncio.sleep(2)

        # Get final page state
        html = await page.content()
        all_images.update(extract_urls_from_text(html))

        # Extract from all script tags
        scripts = await page.query_selector_all('script')
        for script in scripts:
            try:
                content = await script.inner_text()
                if content and 'trvl-media' in content:
                    all_images.update(extract_urls_from_text(content))
            except:
                continue

    except Exception as e:
        print(f"       ERROR: {e}")

    finally:
        await context.close()

    # Filter results
    final_images = []
    seen = set()
    for url in sorted(all_images):
        if '/icon' in url or '/logo' in url or '_t.' in url or len(url) < 50:
            continue
        base = re.sub(r'_[a-z]\.(jpg|jpeg|png|webp)', r'.\1', url.lower())
        if base not in seen:
            seen.add(base)
            final_images.append(url)

    # Save to file
    output_file = OUTPUT_DIR / f"{property_id}.json"
    result = {
        "propertyId": property_id,
        "propertyName": property_name,
        "vrboId": vrbo_id,
        "vrboUrl": main_url,
        "images": final_images,
        "count": len(final_images),
        "scrapedAt": datetime.now().isoformat()
    }

    with open(output_file, 'w') as f:
        json.dump(result, f, indent=2)

    print(f"\n{'='*70}")
    print(f"COMPLETE: {property_name}")
    print(f"IMAGES FOUND: {len(final_images)}")
    print(f"SAVED TO: {output_file}")
    print(f"{'='*70}\n")

    return result


async def run_visible_scrape():
    """Run scraper with VISIBLE browser"""
    print("\n" + "#"*70)
    print("#" + " "*68 + "#")
    print("#" + "     VRBO VISIBLE BROWSER SCRAPER".center(68) + "#")
    print("#" + "     Anti-Bot Detection Mode".center(68) + "#")
    print("#" + " "*68 + "#")
    print("#"*70 + "\n")

    start_time = datetime.now()
    all_results = {}

    async with async_playwright() as p:
        # Launch VISIBLE browser (not headless)
        browser = await p.chromium.launch(
            headless=False,  # VISIBLE to defeat bot detection
            args=[
                '--disable-blink-features=AutomationControlled',
                '--disable-dev-shm-usage',
                '--no-sandbox',
                '--start-maximized',
            ]
        )

        for i, prop in enumerate(PROPERTIES, 1):
            print(f"\n{'*'*70}")
            print(f"PROPERTY {i}/{len(PROPERTIES)}")
            print(f"{'*'*70}")

            try:
                result = await scrape_property_visible(prop, browser)
                all_results[prop['propertyId']] = result
            except Exception as e:
                print(f"FAILED: {prop['propertyName']} - {e}")
                all_results[prop['propertyId']] = {
                    "propertyId": prop['propertyId'],
                    "propertyName": prop['propertyName'],
                    "vrboId": prop['vrboId'],
                    "error": str(e),
                    "images": [],
                    "count": 0
                }

        await browser.close()

    # Save combined results
    combined_file = OUTPUT_DIR / "ALL_PROPERTIES.json"
    with open(combined_file, 'w') as f:
        json.dump(all_results, f, indent=2)

    # Print summary
    end_time = datetime.now()
    duration = end_time - start_time

    print("\n" + "="*70)
    print("SCRAPE COMPLETE")
    print("="*70)
    print(f"Duration: {duration}")
    print(f"\nResults:")

    total_images = 0
    for prop_id, result in all_results.items():
        count = result.get('count', 0)
        total_images += count
        status = "✓" if count > 0 else "✗"
        print(f"  {status} {result.get('propertyName', prop_id)}: {count} images")

    print(f"\nTOTAL IMAGES: {total_images}")
    print(f"Output: {OUTPUT_DIR}")
    print("="*70 + "\n")

    return all_results


if __name__ == '__main__':
    asyncio.run(run_visible_scrape())
