#!/usr/bin/env python3
"""
Download photos for Gleneagles-4735 (VRBO 2643808)
Right At Home-Midland Northtown Place
32 images from lodging ID 74873870
"""
import asyncio
import httpx
from pathlib import Path
from PIL import Image
from io import BytesIO

IMAGE_URLS = [
    "https://media.vrbo.com/lodging/75000000/74880000/74873900/74873870/381a10fa.jpg",
    "https://media.vrbo.com/lodging/75000000/74880000/74873900/74873870/6687aba1.jpg",
    "https://media.vrbo.com/lodging/75000000/74880000/74873900/74873870/8e161ab6.jpg",
    "https://media.vrbo.com/lodging/75000000/74880000/74873900/74873870/a0da3320.jpg",
    "https://media.vrbo.com/lodging/75000000/74880000/74873900/74873870/56e56fea.jpg",
    "https://media.vrbo.com/lodging/75000000/74880000/74873900/74873870/50da0b33.jpg",
    "https://media.vrbo.com/lodging/75000000/74880000/74873900/74873870/3d4c4e07.jpg",
    "https://media.vrbo.com/lodging/75000000/74880000/74873900/74873870/0b4461f0.jpg",
    "https://media.vrbo.com/lodging/75000000/74880000/74873900/74873870/56eca79e.jpg",
    "https://media.vrbo.com/lodging/75000000/74880000/74873900/74873870/6f7cea61.jpg",
    "https://media.vrbo.com/lodging/75000000/74880000/74873900/74873870/71a42b04.jpg",
    "https://media.vrbo.com/lodging/75000000/74880000/74873900/74873870/c6cbd4f2.jpg",
    "https://media.vrbo.com/lodging/75000000/74880000/74873900/74873870/c0f88acb.jpg",
    "https://media.vrbo.com/lodging/75000000/74880000/74873900/74873870/57706776.jpg",
    "https://media.vrbo.com/lodging/75000000/74880000/74873900/74873870/b32d8494.jpg",
    "https://media.vrbo.com/lodging/75000000/74880000/74873900/74873870/63a71f55.jpg",
    "https://media.vrbo.com/lodging/75000000/74880000/74873900/74873870/0a8acb70.jpg",
    "https://media.vrbo.com/lodging/75000000/74880000/74873900/74873870/f6fdb13b.jpg",
    "https://media.vrbo.com/lodging/75000000/74880000/74873900/74873870/877e7aa8.jpg",
    "https://media.vrbo.com/lodging/75000000/74880000/74873900/74873870/b4a5d213.jpg",
    "https://media.vrbo.com/lodging/75000000/74880000/74873900/74873870/8a632df1.jpg",
    "https://media.vrbo.com/lodging/75000000/74880000/74873900/74873870/3cbe46d3.jpg",
    "https://media.vrbo.com/lodging/75000000/74880000/74873900/74873870/e20d8935.jpg",
    "https://media.vrbo.com/lodging/75000000/74880000/74873900/74873870/aeac87bd.jpg",
    "https://media.vrbo.com/lodging/75000000/74880000/74873900/74873870/fd3c58aa.jpg",
    "https://media.vrbo.com/lodging/75000000/74880000/74873900/74873870/8c8b591d.jpg",
    "https://media.vrbo.com/lodging/75000000/74880000/74873900/74873870/d8f5d4fd.jpg",
    "https://media.vrbo.com/lodging/75000000/74880000/74873900/74873870/8c0c4887.jpg",
    "https://media.vrbo.com/lodging/75000000/74880000/74873900/74873870/d0ab954a.jpg",
    "https://media.vrbo.com/lodging/75000000/74880000/74873900/74873870/bfc3b059.jpg",
    "https://media.vrbo.com/lodging/75000000/74880000/74873900/74873870/5b05471d.jpg",
    "https://media.vrbo.com/lodging/75000000/74880000/74873900/74873870/1e37cac3.jpg",
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
    print(f"Downloading {len(IMAGE_URLS)} photos for Gleneagles-4735...")

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
