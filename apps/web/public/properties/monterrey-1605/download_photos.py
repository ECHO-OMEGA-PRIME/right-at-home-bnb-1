#!/usr/bin/env python3
"""
Download photos for monterrey-1605 (VRBO 3477668)
Right At Home-Midland Monterrey House
27 images from lodging ID 95654775
"""
import asyncio
import httpx
from pathlib import Path
from PIL import Image
from io import BytesIO

IMAGE_URLS = [
    "https://media.vrbo.com/lodging/96000000/95660000/95654800/95654775/719ffcf0.jpg",
    "https://media.vrbo.com/lodging/96000000/95660000/95654800/95654775/c22355ec.jpg",
    "https://media.vrbo.com/lodging/96000000/95660000/95654800/95654775/eed68f85.jpg",
    "https://media.vrbo.com/lodging/96000000/95660000/95654800/95654775/20e6b63f.jpg",
    "https://media.vrbo.com/lodging/96000000/95660000/95654800/95654775/79acd7f3.jpg",
    "https://media.vrbo.com/lodging/96000000/95660000/95654800/95654775/56f80b69.jpg",
    "https://media.vrbo.com/lodging/96000000/95660000/95654800/95654775/cc07a7b4.jpg",
    "https://media.vrbo.com/lodging/96000000/95660000/95654800/95654775/cfe54007.jpg",
    "https://media.vrbo.com/lodging/96000000/95660000/95654800/95654775/2c2ea45f.jpg",
    "https://media.vrbo.com/lodging/96000000/95660000/95654800/95654775/e149bbd3.jpg",
    "https://media.vrbo.com/lodging/96000000/95660000/95654800/95654775/7ed58f63.jpg",
    "https://media.vrbo.com/lodging/96000000/95660000/95654800/95654775/01f91f6f.jpg",
    "https://media.vrbo.com/lodging/96000000/95660000/95654800/95654775/d5d2c7f8.jpg",
    "https://media.vrbo.com/lodging/96000000/95660000/95654800/95654775/ed941550.jpg",
    "https://media.vrbo.com/lodging/96000000/95660000/95654800/95654775/eb0ede37.jpg",
    "https://media.vrbo.com/lodging/96000000/95660000/95654800/95654775/aa6c0248.jpg",
    "https://media.vrbo.com/lodging/96000000/95660000/95654800/95654775/6b739cf6.jpg",
    "https://media.vrbo.com/lodging/96000000/95660000/95654800/95654775/739b9b7f.jpg",
    "https://media.vrbo.com/lodging/96000000/95660000/95654800/95654775/c2a80a0b.jpg",
    "https://media.vrbo.com/lodging/96000000/95660000/95654800/95654775/184cc42c.jpg",
    "https://media.vrbo.com/lodging/96000000/95660000/95654800/95654775/547f583e.jpg",
    "https://media.vrbo.com/lodging/96000000/95660000/95654800/95654775/e0a02976.jpg",
    "https://media.vrbo.com/lodging/96000000/95660000/95654800/95654775/9059d21c.jpg",
    "https://media.vrbo.com/lodging/96000000/95660000/95654800/95654775/e971612c.jpg",
    "https://media.vrbo.com/lodging/96000000/95660000/95654800/95654775/2e4274e2.jpg",
    "https://media.vrbo.com/lodging/96000000/95660000/95654800/95654775/1fc163af.jpg",
    "https://media.vrbo.com/lodging/96000000/95660000/95654800/95654775/ddef33af.jpg",
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
    print(f"Downloading {len(IMAGE_URLS)} photos for monterrey-1605...")

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
