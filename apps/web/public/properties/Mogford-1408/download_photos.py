#!/usr/bin/env python3
"""
Download photos for Mogford-1408 (VRBO 3724481)
Right At Home-Midland Clermont House w/ Pool and Billiards
35 images from lodging ID 100562347
"""
import asyncio
import httpx
from pathlib import Path
from PIL import Image
from io import BytesIO

IMAGE_URLS = [
    "https://media.vrbo.com/lodging/101000000/100570000/100562400/100562347/f6de8ace.jpg",
    "https://media.vrbo.com/lodging/101000000/100570000/100562400/100562347/90e7be2d.jpg",
    "https://media.vrbo.com/lodging/101000000/100570000/100562400/100562347/0d1a51ce.jpg",
    "https://media.vrbo.com/lodging/101000000/100570000/100562400/100562347/d2bd8169.jpg",
    "https://media.vrbo.com/lodging/101000000/100570000/100562400/100562347/e6a7887f.jpg",
    "https://media.vrbo.com/lodging/101000000/100570000/100562400/100562347/475bcdf5.jpg",
    "https://media.vrbo.com/lodging/101000000/100570000/100562400/100562347/bcb7b243.jpg",
    "https://media.vrbo.com/lodging/101000000/100570000/100562400/100562347/8d389cbe.jpg",
    "https://media.vrbo.com/lodging/101000000/100570000/100562400/100562347/d536e47d.jpg",
    "https://media.vrbo.com/lodging/101000000/100570000/100562400/100562347/a61f7a48.jpg",
    "https://media.vrbo.com/lodging/101000000/100570000/100562400/100562347/0c6a9383.jpg",
    "https://media.vrbo.com/lodging/101000000/100570000/100562400/100562347/0fe14266.jpg",
    "https://media.vrbo.com/lodging/101000000/100570000/100562400/100562347/ae009ae9.jpg",
    "https://media.vrbo.com/lodging/101000000/100570000/100562400/100562347/88b722f0.jpg",
    "https://media.vrbo.com/lodging/101000000/100570000/100562400/100562347/78ad322b.jpg",
    "https://media.vrbo.com/lodging/101000000/100570000/100562400/100562347/80905682.jpg",
    "https://media.vrbo.com/lodging/101000000/100570000/100562400/100562347/7580d596.jpg",
    "https://media.vrbo.com/lodging/101000000/100570000/100562400/100562347/3101c788.jpg",
    "https://media.vrbo.com/lodging/101000000/100570000/100562400/100562347/7815dd7c.jpg",
    "https://media.vrbo.com/lodging/101000000/100570000/100562400/100562347/a55d4918.jpg",
    "https://media.vrbo.com/lodging/101000000/100570000/100562400/100562347/c9584fcf.jpg",
    "https://media.vrbo.com/lodging/101000000/100570000/100562400/100562347/a4b2078f.jpg",
    "https://media.vrbo.com/lodging/101000000/100570000/100562400/100562347/80d81a82.jpg",
    "https://media.vrbo.com/lodging/101000000/100570000/100562400/100562347/a5009236.jpg",
    "https://media.vrbo.com/lodging/101000000/100570000/100562400/100562347/6c4eb407.jpg",
    "https://media.vrbo.com/lodging/101000000/100570000/100562400/100562347/2270a9d0.jpg",
    "https://media.vrbo.com/lodging/101000000/100570000/100562400/100562347/ba15bf25.jpg",
    "https://media.vrbo.com/lodging/101000000/100570000/100562400/100562347/1f55ea03.jpg",
    "https://media.vrbo.com/lodging/101000000/100570000/100562400/100562347/5708b554.jpg",
    "https://media.vrbo.com/lodging/101000000/100570000/100562400/100562347/5faf5dc9.jpg",
    "https://media.vrbo.com/lodging/101000000/100570000/100562400/100562347/bfd34aeb.jpg",
    "https://media.vrbo.com/lodging/101000000/100570000/100562400/100562347/52fab12d.jpg",
    "https://media.vrbo.com/lodging/101000000/100570000/100562400/100562347/07199770.jpg",
    "https://media.vrbo.com/lodging/101000000/100570000/100562400/100562347/0f4fd1f3.jpg",
    "https://media.vrbo.com/lodging/101000000/100570000/100562400/100562347/c1204287.jpg",
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
    print(f"Downloading {len(IMAGE_URLS)} photos for Mogford-1408...")

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
