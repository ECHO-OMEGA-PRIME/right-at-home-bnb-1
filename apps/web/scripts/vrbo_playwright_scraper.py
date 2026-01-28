"""
VRBO Playwright Image Scraper
Downloads all property images with proper labels using Playwright for full gallery extraction
"""
import asyncio
import re
from pathlib import Path
from playwright.async_api import async_playwright
import httpx
from PIL import Image
import io

# Properties to scrape: (vrbo_url, output_folder)
PROPERTIES = [
    ("https://www.vrbo.com/2636389", Path(r"P:\SOVEREIGN_APPS\RightAtHomeBnB\apps\web\public\properties\castleford-5001")),
    ("https://www.vrbo.com/3355618", Path(r"P:\SOVEREIGN_APPS\RightAtHomeBnB\apps\web\public\properties\douglas-2800")),
    ("https://www.vrbo.com/3724481", Path(r"P:\SOVEREIGN_APPS\RightAtHomeBnB\apps\web\public\properties\Mogford-1408")),
    ("https://www.vrbo.com/4437486", Path(r"P:\SOVEREIGN_APPS\RightAtHomeBnB\apps\web\public\properties\Lanham1426")),
    ("https://www.vrbo.com/3559249", Path(r"P:\SOVEREIGN_APPS\RightAtHomeBnB\apps\web\public\properties\Vanguard-1633")),
    ("https://www.vrbo.com/2638481", Path(r"P:\SOVEREIGN_APPS\RightAtHomeBnB\apps\web\public\properties\Dentcrest-4707")),
    ("https://www.vrbo.com/4056016", Path(r"P:\SOVEREIGN_APPS\RightAtHomeBnB\apps\web\public\properties\Gleneagles-4733")),
    ("https://www.vrbo.com/4894280", Path(r"P:\SOVEREIGN_APPS\RightAtHomeBnB\apps\web\public\properties\shandon-4600")),
]


def sanitize_filename(name: str, index: int) -> str:
    """Convert label to valid filename"""
    # Clean up the label
    name = name.lower().strip()
    name = re.sub(r'[^\w\s-]', '', name)
    name = re.sub(r'[\s]+', '-', name)

    if not name or name == 'image':
        name = f"image"

    return f"{name}-{index:02d}.webp"


async def extract_images_from_page(page) -> list[dict]:
    """Extract all images from the gallery by scrolling through it"""
    images = []

    # Open the gallery dialog
    await page.goto(page.url + "?pwaThumbnailDialog=thumbnail-gallery")
    await page.wait_for_timeout(2000)

    # Try to find and close any popups
    try:
        close_btn = page.locator('button:has-text("Close")').first
        if await close_btn.is_visible(timeout=1000):
            await close_btn.click()
            await page.wait_for_timeout(500)
    except:
        pass

    # Scroll through the dialog to load all images
    dialog = page.locator('dialog').first

    for _ in range(30):  # Scroll multiple times
        await page.keyboard.press('PageDown')
        await page.wait_for_timeout(200)

        # Extract visible images
        img_elements = await page.locator('img[src*="media.vrbo.com"]').all()
        for img in img_elements:
            try:
                src = await img.get_attribute('src')
                alt = await img.get_attribute('alt') or 'image'

                if src and 'lodging' in src:
                    # Extract hash - try both patterns
                    hash_match = re.search(r'-([a-f0-9]{8})\.jpg', src)
                    if not hash_match:
                        hash_match = re.search(r'/([a-f0-9]{8})\.jpg', src)

                    if hash_match:
                        hash_val = hash_match.group(1)
                        # Check if we already have this image
                        if not any(img['hash'] == hash_val for img in images):
                            # Extract base path
                            path_match = re.search(r'(lodging/\d+/\d+/\d+/\d+)', src)
                            base_path = path_match.group(1) if path_match else None

                            images.append({
                                'hash': hash_val,
                                'label': alt,
                                'base_path': base_path
                            })
            except:
                continue

    return images


async def download_and_convert(client: httpx.AsyncClient, base_url: str, hash_val: str,
                               output_path: Path, label_counts: dict) -> bool:
    """Download image and convert to webp with labeled filename"""
    # Try the direct hash URL first
    url = f"https://media.vrbo.com/{base_url}/{hash_val}.jpg?impolicy=resizecrop&rw=1200&ra=fit"

    try:
        response = await client.get(url)
        if response.status_code == 200:
            img = Image.open(io.BytesIO(response.content))
            img.save(output_path, 'WEBP', quality=90)
            print(f"  ✓ {output_path.name}")
            return True
        else:
            print(f"  ✗ Failed: {output_path.name} - Status {response.status_code}")
            return False
    except Exception as e:
        print(f"  ✗ Error: {output_path.name} - {e}")
        return False


async def scrape_property(browser, url: str, output_dir: Path):
    """Scrape all images for a single property"""
    print(f"\n{'='*60}")
    print(f"Scraping: {url}")
    print(f"Output: {output_dir}")
    print('='*60)

    output_dir.mkdir(parents=True, exist_ok=True)

    context = await browser.new_context(
        user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    )
    page = await context.new_page()

    try:
        await page.goto(url, wait_until='domcontentloaded', timeout=60000)
        await page.wait_for_timeout(3000)

        # Extract images
        images = await extract_images_from_page(page)
        print(f"Found {len(images)} unique images")

        if not images:
            print("  No images found!")
            return 0

        # Get the base path from first image
        base_path = images[0].get('base_path', '')
        if not base_path:
            print("  Could not determine base path!")
            return 0

        # Download images with httpx
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Accept": "image/*,*/*;q=0.8",
            "Referer": url,
        }

        # Track label counts for unique filenames
        label_counts = {}

        async with httpx.AsyncClient(timeout=60, headers=headers) as client:
            successful = 0
            for i, img in enumerate(images):
                label = img['label']
                hash_val = img['hash']

                # Create unique filename based on label
                if label not in label_counts:
                    label_counts[label] = 0
                label_counts[label] += 1

                # First image is main, rest have numbered labels
                if i == 0:
                    filename = "main.webp"
                else:
                    count = label_counts[label]
                    base_name = label.lower().replace(' ', '-').replace('/', '-')
                    base_name = re.sub(r'[^\w-]', '', base_name)
                    if count > 1:
                        filename = f"{base_name}-{count}.webp"
                    else:
                        filename = f"{base_name}.webp"

                output_path = output_dir / filename

                if await download_and_convert(client, base_path, hash_val, output_path, label_counts):
                    successful += 1

            print(f"\n✓ Downloaded {successful}/{len(images)} images")
            return successful

    finally:
        await context.close()


async def main():
    print("VRBO Playwright Image Scraper")
    print("="*60)

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)  # Visible for debugging

        total_success = 0
        total_images = 0

        for url, output_dir in PROPERTIES:
            try:
                success = await scrape_property(browser, url, output_dir)
                total_success += success
                total_images += success  # We count what we got
            except Exception as e:
                print(f"Error scraping {url}: {e}")

        await browser.close()

    print(f"\n{'='*60}")
    print(f"COMPLETE: Downloaded {total_success} images total")
    print('='*60)


if __name__ == "__main__":
    asyncio.run(main())
