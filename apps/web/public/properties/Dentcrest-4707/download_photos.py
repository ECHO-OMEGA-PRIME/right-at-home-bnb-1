#!/usr/bin/env python3
"""
Download photos for Dentcrest-4707 (VRBO 2638481)
Right At Home-Midland Hot Tub Delight
37 images from lodging ID 74801028
"""
import asyncio
import httpx
from pathlib import Path
from PIL import Image
from io import BytesIO

IMAGE_URLS = [
    "https://media.vrbo.com/lodging/75000000/74810000/74801100/74801028/b957327c.jpg",
    "https://media.vrbo.com/lodging/75000000/74810000/74801100/74801028/d8f7f548.jpg",
    "https://media.vrbo.com/lodging/75000000/74810000/74801100/74801028/7352f081.jpg",
    "https://media.vrbo.com/lodging/75000000/74810000/74801100/74801028/1b573a90.jpg",
    "https://media.vrbo.com/lodging/75000000/74810000/74801100/74801028/3aaf2b39.jpg",
    "https://media.vrbo.com/lodging/75000000/74810000/74801100/74801028/eec6e966.jpg",
    "https://media.vrbo.com/lodging/75000000/74810000/74801100/74801028/53d36f6b.jpg",
    "https://media.vrbo.com/lodging/75000000/74810000/74801100/74801028/2a11c3b8.jpg",
    "https://media.vrbo.com/lodging/75000000/74810000/74801100/74801028/27c565a0.jpg",
    "https://media.vrbo.com/lodging/75000000/74810000/74801100/74801028/1337d44a.jpg",
    "https://media.vrbo.com/lodging/75000000/74810000/74801100/74801028/2632cf54.jpg",
    "https://media.vrbo.com/lodging/75000000/74810000/74801100/74801028/02c1625a.jpg",
    "https://media.vrbo.com/lodging/75000000/74810000/74801100/74801028/8893c5d0.jpg",
    "https://media.vrbo.com/lodging/75000000/74810000/74801100/74801028/e8d7e667.jpg",
    "https://media.vrbo.com/lodging/75000000/74810000/74801100/74801028/f9899078.jpg",
    "https://media.vrbo.com/lodging/75000000/74810000/74801100/74801028/68ae9e21.jpg",
    "https://media.vrbo.com/lodging/75000000/74810000/74801100/74801028/28d70a09.jpg",
    "https://media.vrbo.com/lodging/75000000/74810000/74801100/74801028/e5025fee.jpg",
    "https://media.vrbo.com/lodging/75000000/74810000/74801100/74801028/d3bc45e6.jpg",
    "https://media.vrbo.com/lodging/75000000/74810000/74801100/74801028/604b678e.jpg",
    "https://media.vrbo.com/lodging/75000000/74810000/74801100/74801028/f8785850.jpg",
    "https://media.vrbo.com/lodging/75000000/74810000/74801100/74801028/b6ba40b7.jpg",
    "https://media.vrbo.com/lodging/75000000/74810000/74801100/74801028/54e873f1.jpg",
    "https://media.vrbo.com/lodging/75000000/74810000/74801100/74801028/163e3895.jpg",
    "https://media.vrbo.com/lodging/75000000/74810000/74801100/74801028/7407b7a8.jpg",
    "https://media.vrbo.com/lodging/75000000/74810000/74801100/74801028/2a3830dc.jpg",
    "https://media.vrbo.com/lodging/75000000/74810000/74801100/74801028/3e644527.jpg",
    "https://media.vrbo.com/lodging/75000000/74810000/74801100/74801028/8d897fe0.jpg",
    "https://media.vrbo.com/lodging/75000000/74810000/74801100/74801028/f610e563.jpg",
    "https://media.vrbo.com/lodging/75000000/74810000/74801100/74801028/7a1ab51b.jpg",
    "https://media.vrbo.com/lodging/75000000/74810000/74801100/74801028/07f41ab6.jpg",
    "https://media.vrbo.com/lodging/75000000/74810000/74801100/74801028/64bde2e3.jpg",
    "https://media.vrbo.com/lodging/75000000/74810000/74801100/74801028/cb247a56.jpg",
    "https://media.vrbo.com/lodging/75000000/74810000/74801100/74801028/f7ecbcb0.jpg",
    "https://media.vrbo.com/lodging/75000000/74810000/74801100/74801028/ada8b554.jpg",
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
    print(f"Downloading {len(IMAGE_URLS)} photos for Dentcrest-4707...")

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
