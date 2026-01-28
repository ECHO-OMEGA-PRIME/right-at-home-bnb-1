#!/usr/bin/env python3
"""
Download photos for chelsea-3210 (VRBO 2643784)
Right At Home-Midland Retreat with covered patio
36 images from lodging ID 74873782
"""
import asyncio
import httpx
from pathlib import Path
from PIL import Image
from io import BytesIO

IMAGE_URLS = [
    "https://media.vrbo.com/lodging/75000000/74880000/74873800/74873782/b23f740c.jpg",
    "https://media.vrbo.com/lodging/75000000/74880000/74873800/74873782/415b3d4c.jpg",
    "https://media.vrbo.com/lodging/75000000/74880000/74873800/74873782/48e87140.jpg",
    "https://media.vrbo.com/lodging/75000000/74880000/74873800/74873782/7e6a7740.jpg",
    "https://media.vrbo.com/lodging/75000000/74880000/74873800/74873782/dc098ad9.jpg",
    "https://media.vrbo.com/lodging/75000000/74880000/74873800/74873782/896dbc69.jpg",
    "https://media.vrbo.com/lodging/75000000/74880000/74873800/74873782/bc815fcf.jpg",
    "https://media.vrbo.com/lodging/75000000/74880000/74873800/74873782/f13ff820.jpg",
    "https://media.vrbo.com/lodging/75000000/74880000/74873800/74873782/6a879f74.jpg",
    "https://media.vrbo.com/lodging/75000000/74880000/74873800/74873782/2fc488c7.jpg",
    "https://media.vrbo.com/lodging/75000000/74880000/74873800/74873782/81ed1658.jpg",
    "https://media.vrbo.com/lodging/75000000/74880000/74873800/74873782/cd11a1aa.jpg",
    "https://media.vrbo.com/lodging/75000000/74880000/74873800/74873782/1aad8dad.jpg",
    "https://media.vrbo.com/lodging/75000000/74880000/74873800/74873782/08858d1f.jpg",
    "https://media.vrbo.com/lodging/75000000/74880000/74873800/74873782/b5d35829.jpg",
    "https://media.vrbo.com/lodging/75000000/74880000/74873800/74873782/e7efcfb3.jpg",
    "https://media.vrbo.com/lodging/75000000/74880000/74873800/74873782/4bade3ca.jpg",
    "https://media.vrbo.com/lodging/75000000/74880000/74873800/74873782/721dac49.jpg",
    "https://media.vrbo.com/lodging/75000000/74880000/74873800/74873782/74ae4297.jpg",
    "https://media.vrbo.com/lodging/75000000/74880000/74873800/74873782/6eec90a6.jpg",
    "https://media.vrbo.com/lodging/75000000/74880000/74873800/74873782/b735448e.jpg",
    "https://media.vrbo.com/lodging/75000000/74880000/74873800/74873782/480ec158.jpg",
    "https://media.vrbo.com/lodging/75000000/74880000/74873800/74873782/53aec0aa.jpg",
    "https://media.vrbo.com/lodging/75000000/74880000/74873800/74873782/c9d3df04.jpg",
    "https://media.vrbo.com/lodging/75000000/74880000/74873800/74873782/7e369449.jpg",
    "https://media.vrbo.com/lodging/75000000/74880000/74873800/74873782/d16e141e.jpg",
    "https://media.vrbo.com/lodging/75000000/74880000/74873800/74873782/4e6a583e.jpg",
    "https://media.vrbo.com/lodging/75000000/74880000/74873800/74873782/a39c85c7.jpg",
    "https://media.vrbo.com/lodging/75000000/74880000/74873800/74873782/df8940be.jpg",
    "https://media.vrbo.com/lodging/75000000/74880000/74873800/74873782/170fa1c2.jpg",
    "https://media.vrbo.com/lodging/75000000/74880000/74873800/74873782/44e53516.jpg",
    "https://media.vrbo.com/lodging/75000000/74880000/74873800/74873782/5b620499.jpg",
    "https://media.vrbo.com/lodging/75000000/74880000/74873800/74873782/5b742d28.jpg",
    "https://media.vrbo.com/lodging/75000000/74880000/74873800/74873782/2f155d9f.jpg",
    "https://media.vrbo.com/lodging/75000000/74880000/74873800/74873782/deeb21a5.jpg",
    "https://media.vrbo.com/lodging/75000000/74880000/74873800/74873782/d9fd9666.jpg",
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
    print(f"Downloading {len(IMAGE_URLS)} photos for chelsea-3210...")

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
