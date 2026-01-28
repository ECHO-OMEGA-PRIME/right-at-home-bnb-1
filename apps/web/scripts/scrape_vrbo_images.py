"""
VRBO Image Scraper for Right at Home BnB
Downloads all property images from VRBO listing
"""
import os
import re
import json
import httpx
import asyncio
from pathlib import Path

# Property info
VRBO_PROPERTY_ID = "3005111"
OUTPUT_DIR = Path(r"P:\SOVEREIGN_APPS\RightAtHomeBnB\apps\web\public\properties\adobe-compound")

# Known image hashes from the page (base path: https://media.vrbo.com/lodging/86000000/85650000/85642000/85641906/)
IMAGE_BASE = "https://media.vrbo.com/lodging/86000000/85650000/85642000/85641906"

# Image hashes extracted from page source / network requests
# We'll extract these dynamically
IMAGE_HASHES = [
    "1aae1b16",  # Pool
    "45302a49",  # Room
    "792684d7",  # Room
    "301ac2a9",  # Room
    "93643570",  # Living area
]

async def fetch_page_for_images():
    """Fetch the VRBO page and extract all image hashes"""
    url = f"https://www.vrbo.com/{VRBO_PROPERTY_ID}"

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    }

    async with httpx.AsyncClient(timeout=30, follow_redirects=True) as client:
        response = await client.get(url, headers=headers)
        html = response.text

        # Find all image hashes in the page source
        # Pattern: media.vrbo.com/lodging/86000000/85650000/85642000/85641906/{hash}.jpg
        pattern = r'media\.vrbo\.com/lodging/86000000/85650000/85642000/85641906/([a-f0-9]+)\.jpg'
        matches = set(re.findall(pattern, html))

        print(f"Found {len(matches)} unique image hashes in page source")
        return list(matches)

async def download_image(client: httpx.AsyncClient, image_hash: str, index: int, alt_name: str = None):
    """Download a single image"""
    url = f"{IMAGE_BASE}/{image_hash}.jpg?impolicy=resizecrop&rw=1200&ra=fit"

    try:
        response = await client.get(url)
        if response.status_code == 200:
            # Create filename
            if index == 0:
                filename = "main.webp"  # First image is main
            else:
                name = alt_name.lower().replace(" ", "-").replace("/", "-") if alt_name else f"image-{index:02d}"
                filename = f"{name}.webp"

            filepath = OUTPUT_DIR / filename

            # Save as JPG first (we'd need pillow to convert to webp)
            jpg_path = OUTPUT_DIR / f"{filename.replace('.webp', '.jpg')}"
            with open(jpg_path, 'wb') as f:
                f.write(response.content)

            print(f"  Downloaded: {jpg_path.name}")
            return jpg_path
        else:
            print(f"  Failed: {image_hash} - Status {response.status_code}")
            return None
    except Exception as e:
        print(f"  Error downloading {image_hash}: {e}")
        return None

async def main():
    """Main download function"""
    print(f"VRBO Image Scraper for Property {VRBO_PROPERTY_ID}")
    print(f"Output directory: {OUTPUT_DIR}")
    print("-" * 50)

    # Ensure output directory exists
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    # Get image hashes from page
    print("Fetching page to extract image URLs...")
    image_hashes = await fetch_page_for_images()

    if not image_hashes:
        print("No images found, using known hashes...")
        image_hashes = IMAGE_HASHES

    print(f"\nDownloading {len(image_hashes)} images...")

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "image/*,*/*;q=0.8",
        "Referer": f"https://www.vrbo.com/{VRBO_PROPERTY_ID}",
    }

    async with httpx.AsyncClient(timeout=30, headers=headers) as client:
        tasks = []
        for i, hash in enumerate(image_hashes):
            tasks.append(download_image(client, hash, i))

        results = await asyncio.gather(*tasks)

        successful = [r for r in results if r]
        print(f"\nDownloaded {len(successful)} of {len(image_hashes)} images")

        # Rename first image to main.jpg if it exists
        if successful:
            first_image = successful[0]
            main_path = OUTPUT_DIR / "main.jpg"
            if first_image != main_path and first_image.exists():
                if main_path.exists():
                    main_path.unlink()
                first_image.rename(main_path)
                print(f"\nRenamed first image to main.jpg")

if __name__ == "__main__":
    asyncio.run(main())
