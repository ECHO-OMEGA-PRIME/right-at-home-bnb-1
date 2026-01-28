#!/usr/bin/env python3
"""
Download photos for Daventry-1311 (VRBO 4179271)
Right At Home-Midland Santiago Dreams w/ man cave
64 images from lodging ID 108555050
"""
import asyncio
import httpx
from pathlib import Path
from PIL import Image
from io import BytesIO

IMAGE_URLS = [
    "https://media.vrbo.com/lodging/109000000/108560000/108555100/108555050/11e3f19d.jpg",
    "https://media.vrbo.com/lodging/109000000/108560000/108555100/108555050/0a8440f2.jpg",
    "https://media.vrbo.com/lodging/109000000/108560000/108555100/108555050/a9bc2b5d.jpg",
    "https://media.vrbo.com/lodging/109000000/108560000/108555100/108555050/ec933bdb.jpg",
    "https://media.vrbo.com/lodging/109000000/108560000/108555100/108555050/0beedd47.jpg",
    "https://media.vrbo.com/lodging/109000000/108560000/108555100/108555050/edd6be74.jpg",
    "https://media.vrbo.com/lodging/109000000/108560000/108555100/108555050/fc88a890.jpg",
    "https://media.vrbo.com/lodging/109000000/108560000/108555100/108555050/834a6fd2.jpg",
    "https://media.vrbo.com/lodging/109000000/108560000/108555100/108555050/85e86b1a.jpg",
    "https://media.vrbo.com/lodging/109000000/108560000/108555100/108555050/1dbb255d.jpg",
    "https://media.vrbo.com/lodging/109000000/108560000/108555100/108555050/93c3934f.jpg",
    "https://media.vrbo.com/lodging/109000000/108560000/108555100/108555050/20cc5b0b.jpg",
    "https://media.vrbo.com/lodging/109000000/108560000/108555100/108555050/03d2bb58.jpg",
    "https://media.vrbo.com/lodging/109000000/108560000/108555100/108555050/28b94759.jpg",
    "https://media.vrbo.com/lodging/109000000/108560000/108555100/108555050/8713e63e.jpg",
    "https://media.vrbo.com/lodging/109000000/108560000/108555100/108555050/65778804.jpg",
    "https://media.vrbo.com/lodging/109000000/108560000/108555100/108555050/d1b5daa7.jpg",
    "https://media.vrbo.com/lodging/109000000/108560000/108555100/108555050/41169ff2.jpg",
    "https://media.vrbo.com/lodging/109000000/108560000/108555100/108555050/20d38b9b.jpg",
    "https://media.vrbo.com/lodging/109000000/108560000/108555100/108555050/ff82aa27.jpg",
    "https://media.vrbo.com/lodging/109000000/108560000/108555100/108555050/1d6851a3.jpg",
    "https://media.vrbo.com/lodging/109000000/108560000/108555100/108555050/5b914423.jpg",
    "https://media.vrbo.com/lodging/109000000/108560000/108555100/108555050/e0c7afb1.jpg",
    "https://media.vrbo.com/lodging/109000000/108560000/108555100/108555050/e8a761bc.jpg",
    "https://media.vrbo.com/lodging/109000000/108560000/108555100/108555050/f1b5a2db.jpg",
    "https://media.vrbo.com/lodging/109000000/108560000/108555100/108555050/75f100a8.jpg",
    "https://media.vrbo.com/lodging/109000000/108560000/108555100/108555050/a71af28d.jpg",
    "https://media.vrbo.com/lodging/109000000/108560000/108555100/108555050/852cebe4.jpg",
    "https://media.vrbo.com/lodging/109000000/108560000/108555100/108555050/f3097c20.jpg",
    "https://media.vrbo.com/lodging/109000000/108560000/108555100/108555050/38679710.jpg",
    "https://media.vrbo.com/lodging/109000000/108560000/108555100/108555050/7f6034a2.jpg",
    "https://media.vrbo.com/lodging/109000000/108560000/108555100/108555050/62cd26e1.jpg",
    "https://media.vrbo.com/lodging/109000000/108560000/108555100/108555050/322b54ca.jpg",
    "https://media.vrbo.com/lodging/109000000/108560000/108555100/108555050/b2b9c69b.jpg",
    "https://media.vrbo.com/lodging/109000000/108560000/108555100/108555050/f1a9d8e3.jpg",
    "https://media.vrbo.com/lodging/109000000/108560000/108555100/108555050/bc3bc7e2.jpg",
    "https://media.vrbo.com/lodging/109000000/108560000/108555100/108555050/6a2b31a1.jpg",
    "https://media.vrbo.com/lodging/109000000/108560000/108555100/108555050/64afcfe5.jpg",
    "https://media.vrbo.com/lodging/109000000/108560000/108555100/108555050/7bf97720.jpg",
    "https://media.vrbo.com/lodging/109000000/108560000/108555100/108555050/cd05fc80.jpg",
    "https://media.vrbo.com/lodging/109000000/108560000/108555100/108555050/8ef948c8.jpg",
    "https://media.vrbo.com/lodging/109000000/108560000/108555100/108555050/e20a7dba.jpg",
    "https://media.vrbo.com/lodging/109000000/108560000/108555100/108555050/80145d49.jpg",
    "https://media.vrbo.com/lodging/109000000/108560000/108555100/108555050/419eeaa6.jpg",
    "https://media.vrbo.com/lodging/109000000/108560000/108555100/108555050/56acbdd3.jpg",
    "https://media.vrbo.com/lodging/109000000/108560000/108555100/108555050/c8861b4e.jpg",
    "https://media.vrbo.com/lodging/109000000/108560000/108555100/108555050/d6731e2b.jpg",
    "https://media.vrbo.com/lodging/109000000/108560000/108555100/108555050/34f94d61.jpg",
    "https://media.vrbo.com/lodging/109000000/108560000/108555100/108555050/45d759d9.jpg",
    "https://media.vrbo.com/lodging/109000000/108560000/108555100/108555050/0af6650a.jpg",
    "https://media.vrbo.com/lodging/109000000/108560000/108555100/108555050/3b392060.jpg",
    "https://media.vrbo.com/lodging/109000000/108560000/108555100/108555050/366fe7f6.jpg",
    "https://media.vrbo.com/lodging/109000000/108560000/108555100/108555050/648ba0b4.jpg",
    "https://media.vrbo.com/lodging/109000000/108560000/108555100/108555050/e15282b2.jpg",
    "https://media.vrbo.com/lodging/109000000/108560000/108555100/108555050/b7b0a367.jpg",
    "https://media.vrbo.com/lodging/109000000/108560000/108555100/108555050/f660a15c.jpg",
    "https://media.vrbo.com/lodging/109000000/108560000/108555100/108555050/56e1556d.jpg",
    "https://media.vrbo.com/lodging/109000000/108560000/108555100/108555050/444907bd.jpg",
    "https://media.vrbo.com/lodging/109000000/108560000/108555100/108555050/4cd4c1ea.jpg",
    "https://media.vrbo.com/lodging/109000000/108560000/108555100/108555050/d6133501.jpg",
    "https://media.vrbo.com/lodging/109000000/108560000/108555100/108555050/d3c5a208.jpg",
    "https://media.vrbo.com/lodging/109000000/108560000/108555100/108555050/890f50f8.jpg",
    "https://media.vrbo.com/lodging/109000000/108560000/108555100/108555050/543cc45b.jpg",
    "https://media.vrbo.com/lodging/109000000/108560000/108555100/108555050/1344b044.jpg",
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
    print(f"Downloading {len(IMAGE_URLS)} photos for Daventry-1311...")

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
