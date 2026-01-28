#!/usr/bin/env python3
"""
Download photos for Siesta-4217 (VRBO 4135262)
Right At Home-Midland Cowboy Siesta Corner Lot
16 images from lodging ID 107510406
"""
import asyncio
import httpx
from pathlib import Path
from PIL import Image
from io import BytesIO

IMAGE_URLS = [
    "https://media.vrbo.com/lodging/108000000/107520000/107510500/107510406/f262640f.jpg",
    "https://media.vrbo.com/lodging/108000000/107520000/107510500/107510406/f436f74d.jpg",
    "https://media.vrbo.com/lodging/108000000/107520000/107510500/107510406/4fe12a8f.jpg",
    "https://media.vrbo.com/lodging/108000000/107520000/107510500/107510406/2a3a515c.jpg",
    "https://media.vrbo.com/lodging/108000000/107520000/107510500/107510406/3c553cf8.jpg",
    "https://media.vrbo.com/lodging/108000000/107520000/107510500/107510406/66afa730.jpg",
    "https://media.vrbo.com/lodging/108000000/107520000/107510500/107510406/0d85edf8.jpg",
    "https://media.vrbo.com/lodging/108000000/107520000/107510500/107510406/8d81a051.jpg",
    "https://media.vrbo.com/lodging/108000000/107520000/107510500/107510406/7dfe25e0.jpg",
    "https://media.vrbo.com/lodging/108000000/107520000/107510500/107510406/714d26b3.jpg",
    "https://media.vrbo.com/lodging/108000000/107520000/107510500/107510406/4aa0a08f.jpg",
    "https://media.vrbo.com/lodging/108000000/107520000/107510500/107510406/98619f57.jpg",
    "https://media.vrbo.com/lodging/108000000/107520000/107510500/107510406/196033b8.jpg",
    "https://media.vrbo.com/lodging/108000000/107520000/107510500/107510406/1f0362bc.jpg",
    "https://media.vrbo.com/lodging/108000000/107520000/107510500/107510406/3cdc869c.jpg",
    "https://media.vrbo.com/lodging/108000000/107520000/107510500/107510406/8d9f0ffb.jpg",
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
    print(f"Downloading {len(IMAGE_URLS)} photos for Siesta-4217...")

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
