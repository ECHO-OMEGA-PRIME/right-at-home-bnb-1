#!/usr/bin/env python3
"""
Download photos for Lanham-1426 (VRBO 4437486)
Right At Home-Midland Posh & Private with Billiards
47 images from lodging ID 113137813
"""
import asyncio
import httpx
from pathlib import Path
from PIL import Image
from io import BytesIO

IMAGE_URLS = [
    "https://media.vrbo.com/lodging/114000000/113140000/113137900/113137813/f146d1de.jpg",
    "https://media.vrbo.com/lodging/114000000/113140000/113137900/113137813/27ab2b62.jpg",
    "https://media.vrbo.com/lodging/114000000/113140000/113137900/113137813/c3ab3e54.jpg",
    "https://media.vrbo.com/lodging/114000000/113140000/113137900/113137813/ffe4b8e6.jpg",
    "https://media.vrbo.com/lodging/114000000/113140000/113137900/113137813/2a891513.jpg",
    "https://media.vrbo.com/lodging/114000000/113140000/113137900/113137813/930c7a20.jpg",
    "https://media.vrbo.com/lodging/114000000/113140000/113137900/113137813/9f57bde3.jpg",
    "https://media.vrbo.com/lodging/114000000/113140000/113137900/113137813/8f176e84.jpg",
    "https://media.vrbo.com/lodging/114000000/113140000/113137900/113137813/493b40b1.jpg",
    "https://media.vrbo.com/lodging/114000000/113140000/113137900/113137813/cf36733b.jpg",
    "https://media.vrbo.com/lodging/114000000/113140000/113137900/113137813/3e3a6d80.jpg",
    "https://media.vrbo.com/lodging/114000000/113140000/113137900/113137813/a3bf65cb.jpg",
    "https://media.vrbo.com/lodging/114000000/113140000/113137900/113137813/9cb8d9a4.jpg",
    "https://media.vrbo.com/lodging/114000000/113140000/113137900/113137813/102954c3.jpg",
    "https://media.vrbo.com/lodging/114000000/113140000/113137900/113137813/2968a0e2.jpg",
    "https://media.vrbo.com/lodging/114000000/113140000/113137900/113137813/a701ef63.jpg",
    "https://media.vrbo.com/lodging/114000000/113140000/113137900/113137813/0af39487.jpg",
    "https://media.vrbo.com/lodging/114000000/113140000/113137900/113137813/b52d5065.jpg",
    "https://media.vrbo.com/lodging/114000000/113140000/113137900/113137813/44239e9f.jpg",
    "https://media.vrbo.com/lodging/114000000/113140000/113137900/113137813/8e226785.jpg",
    "https://media.vrbo.com/lodging/114000000/113140000/113137900/113137813/20c1de33.jpg",
    "https://media.vrbo.com/lodging/114000000/113140000/113137900/113137813/290e9049.jpg",
    "https://media.vrbo.com/lodging/114000000/113140000/113137900/113137813/467c8a4f.jpg",
    "https://media.vrbo.com/lodging/114000000/113140000/113137900/113137813/8abfab37.jpg",
    "https://media.vrbo.com/lodging/114000000/113140000/113137900/113137813/4323867c.jpg",
    "https://media.vrbo.com/lodging/114000000/113140000/113137900/113137813/5b5ffe30.jpg",
    "https://media.vrbo.com/lodging/114000000/113140000/113137900/113137813/aa4c9c8a.jpg",
    "https://media.vrbo.com/lodging/114000000/113140000/113137900/113137813/07b78246.jpg",
    "https://media.vrbo.com/lodging/114000000/113140000/113137900/113137813/32acf0a6.jpg",
    "https://media.vrbo.com/lodging/114000000/113140000/113137900/113137813/02bd0e8c.jpg",
    "https://media.vrbo.com/lodging/114000000/113140000/113137900/113137813/baba9c14.jpg",
    "https://media.vrbo.com/lodging/114000000/113140000/113137900/113137813/843ad958.jpg",
    "https://media.vrbo.com/lodging/114000000/113140000/113137900/113137813/c49ed220.jpg",
    "https://media.vrbo.com/lodging/114000000/113140000/113137900/113137813/9ba21b3d.jpg",
    "https://media.vrbo.com/lodging/114000000/113140000/113137900/113137813/2a518750.jpg",
    "https://media.vrbo.com/lodging/114000000/113140000/113137900/113137813/ce268758.jpg",
    "https://media.vrbo.com/lodging/114000000/113140000/113137900/113137813/c68de35b.jpg",
    "https://media.vrbo.com/lodging/114000000/113140000/113137900/113137813/1b8d4a1d.jpg",
    "https://media.vrbo.com/lodging/114000000/113140000/113137900/113137813/7759e8ee.jpg",
    "https://media.vrbo.com/lodging/114000000/113140000/113137900/113137813/4afa59d1.jpg",
    "https://media.vrbo.com/lodging/114000000/113140000/113137900/113137813/383383a7.jpg",
    "https://media.vrbo.com/lodging/114000000/113140000/113137900/113137813/9e12b534.jpg",
]

OUTPUT_DIR = Path(__file__).parent

async def download_image(client: httpx.AsyncClient, url: str, index: int) -> bool:
    """Download and convert image to WebP format."""
    try:
        response = await client.get(url, follow_redirects=True)
        response.raise_for_status()

        img = Image.open(BytesIO(response.content))
        if img.mode in ('RGBA', 'P'):
            img = img.convert('RGB')

        if index == 0:
            output_path = OUTPUT_DIR / "main.webp"
        else:
            output_path = OUTPUT_DIR / f"photo-{index}.webp"

        img.save(output_path, 'WEBP', quality=85)
        print(f"Downloaded: {output_path.name}")
        return True
    except Exception as e:
        print(f"Error downloading {url}: {e}")
        return False

async def main():
    """Download all property photos."""
    print(f"Downloading {len(IMAGE_URLS)} photos for Lanham-1426...")

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    }

    async with httpx.AsyncClient(headers=headers, timeout=30.0) as client:
        tasks = [download_image(client, url, i) for i, url in enumerate(IMAGE_URLS)]
        results = await asyncio.gather(*tasks)

    success = sum(results)
    print(f"\nCompleted: {success}/{len(IMAGE_URLS)} photos downloaded")

if __name__ == "__main__":
    asyncio.run(main())
