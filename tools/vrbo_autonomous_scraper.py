#!/usr/bin/env python3
"""
VRBO AUTONOMOUS SCRAPER - Click Every Single Image Edition
Opens each VRBO property, clicks through ALL thumbnails, captures every URL

@author ECHO OMEGA PRIME
@mode FULL AUTONOMOUS - NO USER INTERACTION
"""

import asyncio
import json
import re
import sys
from pathlib import Path
from datetime import datetime

from playwright.async_api import async_playwright, TimeoutError as PlaywrightTimeout

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
    # Clean escaped characters
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


async def scrape_property(prop: dict, browser) -> dict:
    """
    Autonomously scrape ALL images from a single property
    Clicks through every thumbnail to ensure complete capture
    """
    vrbo_id = prop['vrboId']
    property_id = prop['propertyId']
    property_name = prop['propertyName']

    gallery_url = f"https://www.vrbo.com/{vrbo_id}?pwaThumbnailDialog=thumbnail-gallery"
    main_url = f"https://www.vrbo.com/{vrbo_id}"

    all_images = set()

    print(f"\n{'='*70}")
    print(f"PROPERTY: {property_name}")
    print(f"VRBO ID: {vrbo_id}")
    print(f"{'='*70}")

    context = await browser.new_context(
        viewport={'width': 1920, 'height': 1080},
        user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
    )

    page = await context.new_page()

    # Capture images from network requests
    async def capture_response(response):
        url = response.url
        if 'images.trvl-media.com' in url or 'mediaim.expedia.com' in url:
            all_images.add(get_high_res_url(url))

    page.on('response', capture_response)

    try:
        # STEP 1: Load the main listing page first
        print(f"[1/6] Loading main listing page...")
        await page.goto(main_url, wait_until='domcontentloaded', timeout=60000)
        await asyncio.sleep(3)

        # Extract from main page
        html = await page.content()
        all_images.update(extract_urls_from_text(html))
        print(f"       Found {len(all_images)} images from main page")

        # STEP 2: Click on the main hero image to open gallery
        print(f"[2/6] Opening photo gallery...")
        gallery_opened = False

        click_targets = [
            '[data-stid="property-media-0"]',
            '[data-stid="hero-media"]',
            'button[aria-label*="View all"]',
            'button[aria-label*="gallery"]',
            'button[aria-label*="photos"]',
            '[class*="hero"] img',
            '[class*="media-gallery"] img',
            'img[class*="property-image"]',
            '[data-testid="property-image"]',
        ]

        for selector in click_targets:
            try:
                element = await page.wait_for_selector(selector, timeout=3000)
                if element:
                    await element.click()
                    await asyncio.sleep(2)
                    gallery_opened = True
                    print(f"       Clicked: {selector}")
                    break
            except:
                continue

        if not gallery_opened:
            # Try direct gallery URL
            print(f"       Trying direct gallery URL...")
            await page.goto(gallery_url, wait_until='domcontentloaded', timeout=60000)
            await asyncio.sleep(3)

        # Extract after gallery opens
        html = await page.content()
        all_images.update(extract_urls_from_text(html))
        print(f"       Total images so far: {len(all_images)}")

        # STEP 3: Find all thumbnail elements and count them
        print(f"[3/6] Locating all thumbnail images...")

        thumbnail_selectors = [
            '[class*="thumbnail"]',
            '[class*="gallery"] img',
            '[class*="Gallery"] img',
            '[data-stid*="gallery"] img',
            '[role="dialog"] img',
            '[class*="filmstrip"] img',
            '[class*="carousel"] img',
            'button[aria-label*="Photo"] img',
            '[class*="photo-grid"] img',
        ]

        thumbnails = []
        for selector in thumbnail_selectors:
            try:
                elements = await page.query_selector_all(selector)
                if elements:
                    thumbnails.extend(elements)
                    print(f"       Found {len(elements)} elements with: {selector}")
            except:
                continue

        # Deduplicate thumbnails by position
        unique_thumbnails = []
        seen_positions = set()
        for thumb in thumbnails:
            try:
                box = await thumb.bounding_box()
                if box:
                    pos = (int(box['x']), int(box['y']))
                    if pos not in seen_positions:
                        seen_positions.add(pos)
                        unique_thumbnails.append(thumb)
            except:
                continue

        print(f"       Total unique thumbnails: {len(unique_thumbnails)}")

        # STEP 4: Click each thumbnail individually
        print(f"[4/6] Clicking through each thumbnail...")

        for i, thumb in enumerate(unique_thumbnails):
            try:
                await thumb.click()
                await asyncio.sleep(0.5)

                # Extract images after each click
                html = await page.content()
                new_urls = extract_urls_from_text(html)
                before = len(all_images)
                all_images.update(new_urls)
                after = len(all_images)

                if after > before:
                    print(f"       Thumbnail {i+1}/{len(unique_thumbnails)}: +{after-before} new images")

            except Exception as e:
                continue

        # STEP 5: Use arrow navigation to ensure we got everything
        print(f"[5/6] Navigating through gallery with arrows...")

        nav_selectors = [
            'button[aria-label*="Next"]',
            'button[aria-label*="next"]',
            '[class*="next"]',
            '[class*="right-arrow"]',
            '[data-stid*="next"]',
        ]

        nav_clicks = 0
        max_nav = 100

        while nav_clicks < max_nav:
            clicked = False
            for selector in nav_selectors:
                try:
                    btn = await page.query_selector(selector)
                    if btn:
                        disabled = await btn.get_attribute('disabled')
                        aria_disabled = await btn.get_attribute('aria-disabled')
                        if not disabled and aria_disabled != 'true':
                            await btn.click()
                            await asyncio.sleep(0.3)
                            nav_clicks += 1
                            clicked = True

                            # Capture new images
                            html = await page.content()
                            all_images.update(extract_urls_from_text(html))

                            if nav_clicks % 10 == 0:
                                print(f"       Arrow clicks: {nav_clicks}, Total images: {len(all_images)}")
                            break
                except:
                    continue

            if not clicked:
                break

        print(f"       Completed {nav_clicks} arrow navigations")

        # STEP 6: Final extraction from all page states
        print(f"[6/6] Final extraction pass...")

        # Try to get any remaining data from page scripts
        try:
            scripts = await page.query_selector_all('script')
            for script in scripts:
                content = await script.inner_text()
                if content and 'trvl-media' in content:
                    all_images.update(extract_urls_from_text(content))
        except:
            pass

        # Get all img elements one more time
        try:
            all_imgs = await page.query_selector_all('img')
            for img in all_imgs:
                src = await img.get_attribute('src')
                srcset = await img.get_attribute('srcset')
                if src and 'trvl-media' in src:
                    all_images.add(get_high_res_url(src))
                if srcset:
                    for part in srcset.split(','):
                        url = part.strip().split(' ')[0]
                        if 'trvl-media' in url:
                            all_images.add(get_high_res_url(url))
        except:
            pass

    except Exception as e:
        print(f"       ERROR: {e}")

    finally:
        await context.close()

    # Filter out thumbnails and icons
    final_images = []
    seen = set()
    for url in sorted(all_images):
        if '/icon' in url or '/logo' in url or '_t.' in url or len(url) < 50:
            continue
        # Normalize for deduplication
        base = re.sub(r'_[a-z]\.(jpg|jpeg|png|webp)', r'.\1', url.lower())
        if base not in seen:
            seen.add(base)
            final_images.append(url)

    # Save to individual file
    output_file = OUTPUT_DIR / f"{property_id}.json"
    result = {
        "propertyId": property_id,
        "propertyName": property_name,
        "vrboId": vrbo_id,
        "vrboUrl": main_url,
        "galleryUrl": gallery_url,
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


async def run_autonomous_scrape():
    """
    FULL AUTONOMOUS MODE
    Scrape ALL 15 properties with no user interaction
    """
    print("\n" + "#"*70)
    print("#" + " "*68 + "#")
    print("#" + "     VRBO AUTONOMOUS SCRAPER - FULL AUTONOMOUS MODE".center(68) + "#")
    print("#" + "     Scraping ALL 15 Properties".center(68) + "#")
    print("#" + " "*68 + "#")
    print("#"*70 + "\n")

    start_time = datetime.now()
    all_results = {}

    async with async_playwright() as p:
        # Launch browser in headless mode for speed
        browser = await p.chromium.launch(
            headless=True,  # Headless for autonomous operation
            args=[
                '--disable-blink-features=AutomationControlled',
                '--disable-dev-shm-usage',
                '--no-sandbox'
            ]
        )

        for i, prop in enumerate(PROPERTIES, 1):
            print(f"\n{'*'*70}")
            print(f"PROPERTY {i}/{len(PROPERTIES)}")
            print(f"{'*'*70}")

            try:
                result = await scrape_property(prop, browser)
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
    print("AUTONOMOUS SCRAPE COMPLETE")
    print("="*70)
    print(f"Duration: {duration}")
    print(f"Output Directory: {OUTPUT_DIR}")
    print(f"\nResults:")

    total_images = 0
    for prop_id, result in all_results.items():
        count = result.get('count', 0)
        total_images += count
        status = "✓" if count > 0 else "✗"
        print(f"  {status} {result.get('propertyName', prop_id)}: {count} images")

    print(f"\nTOTAL IMAGES CAPTURED: {total_images}")
    print(f"Combined file: {combined_file}")
    print("="*70 + "\n")

    return all_results


if __name__ == '__main__':
    asyncio.run(run_autonomous_scrape())
