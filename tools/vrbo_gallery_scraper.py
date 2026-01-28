#!/usr/bin/env python3
"""
VRBO Gallery Scraper - Autonomous Browser Edition
Opens VRBO gallery, clicks through all images, saves URLs

@author ECHO OMEGA PRIME
"""

import asyncio
import json
import re
import sys
from pathlib import Path
from datetime import datetime

try:
    from playwright.async_api import async_playwright, TimeoutError as PlaywrightTimeout
except ImportError:
    print("Installing playwright...")
    import subprocess
    subprocess.run([sys.executable, "-m", "pip", "install", "playwright"], check=True)
    subprocess.run([sys.executable, "-m", "playwright", "install", "chromium"], check=True)
    from playwright.async_api import async_playwright, TimeoutError as PlaywrightTimeout

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
    """Convert thumbnail URL to high-res version"""
    # Remove query params
    base = url.split('?')[0]
    # Replace size indicators with largest
    base = re.sub(r'_[smtlzxy]\.', '_y.', base)
    base = re.sub(r'/[smtlzxy]\.', '/y.', base)
    return base


async def scrape_gallery(vrbo_id: str, headless: bool = False) -> list[str]:
    """
    Autonomously scrape all images from VRBO gallery

    Args:
        vrbo_id: VRBO property ID
        headless: Run browser in headless mode (False shows browser)

    Returns:
        List of high-res image URLs
    """
    gallery_url = f"https://www.vrbo.com/{vrbo_id}?pwaThumbnailDialog=thumbnail-gallery"
    images = set()

    print(f"\n{'='*60}")
    print(f"Scraping VRBO Gallery: {vrbo_id}")
    print(f"URL: {gallery_url}")
    print(f"{'='*60}\n")

    async with async_playwright() as p:
        # Launch browser (visible so user can see progress)
        browser = await p.chromium.launch(
            headless=headless,
            args=['--disable-blink-features=AutomationControlled']
        )

        context = await browser.new_context(
            viewport={'width': 1920, 'height': 1080},
            user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
        )

        page = await context.new_page()

        # Intercept network requests to capture image URLs
        async def handle_response(response):
            url = response.url
            if 'images.trvl-media.com' in url or 'mediaim.expedia.com' in url:
                if any(ext in url.lower() for ext in ['.jpg', '.jpeg', '.png', '.webp']):
                    images.add(get_high_res_url(url))

        page.on('response', handle_response)

        try:
            # Navigate to gallery
            print("[1/5] Opening gallery page...")
            await page.goto(gallery_url, wait_until='networkidle', timeout=30000)
            await asyncio.sleep(2)

            # Wait for gallery to load
            print("[2/5] Waiting for gallery to load...")
            try:
                # Try different selectors for the gallery
                gallery_selectors = [
                    '[data-stid="gallery-dialog"]',
                    '[class*="gallery"]',
                    '[class*="Gallery"]',
                    '[data-testid="gallery"]',
                    'dialog',
                    '[role="dialog"]',
                ]

                for selector in gallery_selectors:
                    try:
                        await page.wait_for_selector(selector, timeout=5000)
                        print(f"   Found gallery with selector: {selector}")
                        break
                    except:
                        continue

            except PlaywrightTimeout:
                print("   Gallery dialog not found, trying to click gallery button...")

                # Try clicking on the main image to open gallery
                click_selectors = [
                    '[data-stid="property-media-0"]',
                    '[class*="hero-image"]',
                    'button[aria-label*="gallery"]',
                    'button[aria-label*="photo"]',
                    '[class*="photo-gallery"]',
                    'img[class*="property"]',
                ]

                for selector in click_selectors:
                    try:
                        await page.click(selector, timeout=3000)
                        print(f"   Clicked: {selector}")
                        await asyncio.sleep(2)
                        break
                    except:
                        continue

            # Extract images from page content
            print("[3/5] Extracting image URLs from page...")

            # Get all image elements
            img_elements = await page.query_selector_all('img')
            for img in img_elements:
                src = await img.get_attribute('src')
                srcset = await img.get_attribute('srcset')

                if src and 'trvl-media.com' in src:
                    images.add(get_high_res_url(src))

                if srcset:
                    for part in srcset.split(','):
                        url = part.strip().split(' ')[0]
                        if 'trvl-media.com' in url:
                            images.add(get_high_res_url(url))

            # Get images from background styles
            elements_with_bg = await page.query_selector_all('[style*="background"]')
            for el in elements_with_bg:
                style = await el.get_attribute('style')
                if style:
                    urls = re.findall(r'url\(["\']?(https://[^"\')\s]+)["\']?\)', style)
                    for url in urls:
                        if 'trvl-media.com' in url:
                            images.add(get_high_res_url(url))

            # Extract from page HTML and scripts
            html = await page.content()

            # Find all image URLs in the HTML
            url_patterns = [
                r'https://images\.trvl-media\.com/lodging/[^"\'<>\s\\]+',
                r'https://images\.trvl-media\.com/hotels/[^"\'<>\s\\]+',
                r'https://mediaim\.expedia\.com/[^"\'<>\s\\]+',
            ]

            for pattern in url_patterns:
                matches = re.findall(pattern, html)
                for url in matches:
                    clean_url = url.replace('\\/', '/').replace('\\u002F', '/')
                    if any(ext in clean_url.lower() for ext in ['.jpg', '.jpeg', '.png', '.webp']):
                        images.add(get_high_res_url(clean_url))

            # Click through gallery images to load more
            print("[4/5] Clicking through gallery to load all images...")

            # Find and click navigation buttons
            nav_selectors = [
                'button[aria-label*="next"]',
                'button[aria-label*="Next"]',
                '[class*="next"]',
                '[class*="arrow-right"]',
                '[data-stid="gallery-next"]',
            ]

            clicks = 0
            max_clicks = 50  # Safety limit

            while clicks < max_clicks:
                clicked = False
                for selector in nav_selectors:
                    try:
                        btn = await page.query_selector(selector)
                        if btn:
                            is_disabled = await btn.get_attribute('disabled')
                            if not is_disabled:
                                await btn.click()
                                await asyncio.sleep(0.5)
                                clicks += 1
                                clicked = True

                                # Extract images after each click
                                new_html = await page.content()
                                for pattern in url_patterns:
                                    matches = re.findall(pattern, new_html)
                                    for url in matches:
                                        clean_url = url.replace('\\/', '/').replace('\\u002F', '/')
                                        images.add(get_high_res_url(clean_url))

                                if clicks % 10 == 0:
                                    print(f"   Clicked {clicks} times, found {len(images)} unique images...")
                                break
                    except:
                        continue

                if not clicked:
                    break

            print(f"   Navigation complete. Clicked {clicks} times.")

            # Final extraction
            print("[5/5] Final image extraction...")
            await asyncio.sleep(1)

            final_html = await page.content()
            for pattern in url_patterns:
                matches = re.findall(pattern, final_html)
                for url in matches:
                    clean_url = url.replace('\\/', '/').replace('\\u002F', '/')
                    if any(ext in clean_url.lower() for ext in ['.jpg', '.jpeg', '.png', '.webp']):
                        images.add(get_high_res_url(clean_url))

        except Exception as e:
            print(f"Error during scraping: {e}")

        finally:
            await browser.close()

    # Filter and deduplicate
    final_images = []
    seen_bases = set()

    for url in sorted(images):
        # Skip tiny thumbnails and icons
        if '/icon' in url or '/logo' in url or '_t.' in url:
            continue
        if len(url) < 50:
            continue

        # Normalize for deduplication
        base = re.sub(r'_[a-z]\.(jpg|jpeg|png|webp)', r'.\1', url.lower())
        if base not in seen_bases:
            seen_bases.add(base)
            final_images.append(url)

    print(f"\n{'='*60}")
    print(f"RESULTS: Found {len(final_images)} unique images")
    print(f"{'='*60}\n")

    return final_images


async def scrape_all_properties(headless: bool = False) -> dict:
    """Scrape all properties and save results"""
    results = {}

    for prop in PROPERTIES:
        print(f"\n\n{'#'*60}")
        print(f"Property: {prop['propertyName']}")
        print(f"{'#'*60}")

        try:
            images = await scrape_gallery(prop['vrboId'], headless=headless)
            results[prop['propertyId']] = {
                'propertyName': prop['propertyName'],
                'vrboId': prop['vrboId'],
                'images': images,
                'count': len(images),
                'scrapedAt': datetime.now().isoformat()
            }
            print(f"SUCCESS: {len(images)} images for {prop['propertyName']}")
        except Exception as e:
            print(f"ERROR scraping {prop['propertyName']}: {e}")
            results[prop['propertyId']] = {
                'propertyName': prop['propertyName'],
                'vrboId': prop['vrboId'],
                'images': [],
                'count': 0,
                'error': str(e),
                'scrapedAt': datetime.now().isoformat()
            }

    return results


def save_results(results: dict, output_path: Path):
    """Save results to JSON file"""
    with open(output_path, 'w') as f:
        json.dump(results, f, indent=2)
    print(f"\nResults saved to: {output_path}")


def print_menu():
    """Print interactive menu"""
    print("\n" + "="*60)
    print("VRBO GALLERY SCRAPER - Autonomous Browser Edition")
    print("="*60)
    print("\nProperties:")
    for i, prop in enumerate(PROPERTIES, 1):
        print(f"  {i:2}. {prop['propertyName'][:45]:<45} (VRBO #{prop['vrboId']})")
    print(f"\n  {len(PROPERTIES)+1}. Scrape ALL properties")
    print(f"  0. Exit")
    print("="*60)


async def interactive_mode():
    """Run in interactive mode"""
    while True:
        print_menu()

        try:
            choice = input("\nSelect property (number): ").strip()

            if choice == '0':
                print("Goodbye!")
                break

            choice_num = int(choice)

            if choice_num == len(PROPERTIES) + 1:
                # Scrape all
                headless = input("Run headless? (y/n, default=n): ").strip().lower() == 'y'
                results = await scrape_all_properties(headless=headless)

                output_path = Path(__file__).parent / 'vrbo_all_images.json'
                save_results(results, output_path)

            elif 1 <= choice_num <= len(PROPERTIES):
                prop = PROPERTIES[choice_num - 1]
                headless = input("Run headless? (y/n, default=n): ").strip().lower() == 'y'

                images = await scrape_gallery(prop['vrboId'], headless=headless)

                # Display results
                print(f"\n{'='*60}")
                print(f"Found {len(images)} images for {prop['propertyName']}")
                print(f"{'='*60}\n")

                for i, url in enumerate(images, 1):
                    print(f"{i:3}. {url}")

                # Save option
                if images:
                    save = input("\nSave to JSON? (y/n): ").strip().lower()
                    if save == 'y':
                        output_path = Path(__file__).parent / f"vrbo_{prop['propertyId']}_images.json"
                        save_results({
                            prop['propertyId']: {
                                'propertyName': prop['propertyName'],
                                'vrboId': prop['vrboId'],
                                'images': images,
                                'count': len(images),
                                'scrapedAt': datetime.now().isoformat()
                            }
                        }, output_path)
            else:
                print("Invalid choice!")

        except ValueError:
            print("Please enter a number!")
        except KeyboardInterrupt:
            print("\n\nGoodbye!")
            break


async def main():
    """Main entry point"""
    if len(sys.argv) > 1:
        if sys.argv[1] == '--all':
            # Scrape all properties
            headless = '--headless' in sys.argv
            results = await scrape_all_properties(headless=headless)
            output_path = Path(__file__).parent / 'vrbo_all_images.json'
            save_results(results, output_path)

        elif sys.argv[1].isdigit():
            # Scrape specific VRBO ID
            vrbo_id = sys.argv[1]
            headless = '--headless' in sys.argv
            images = await scrape_gallery(vrbo_id, headless=headless)

            print("\nImages found:")
            for i, url in enumerate(images, 1):
                print(f"{i}. {url}")

            # Output as JSON
            output_path = Path(__file__).parent / f'vrbo_{vrbo_id}_images.json'
            save_results({'images': images, 'count': len(images)}, output_path)

        elif sys.argv[1] == '--help':
            print("""
VRBO Gallery Scraper - Autonomous Browser Edition

Usage:
  python vrbo_gallery_scraper.py                    # Interactive mode
  python vrbo_gallery_scraper.py <vrbo_id>          # Scrape specific property
  python vrbo_gallery_scraper.py --all              # Scrape all properties
  python vrbo_gallery_scraper.py --all --headless   # Scrape all (headless)
  python vrbo_gallery_scraper.py <vrbo_id> --headless

Examples:
  python vrbo_gallery_scraper.py 2636389            # Scrape Castleford
  python vrbo_gallery_scraper.py --all              # Scrape all 15 properties
""")
        else:
            print(f"Unknown argument: {sys.argv[1]}")
            print("Use --help for usage information")
    else:
        # Interactive mode
        await interactive_mode()


if __name__ == '__main__':
    asyncio.run(main())
