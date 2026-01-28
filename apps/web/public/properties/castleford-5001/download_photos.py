#!/usr/bin/env python3
"""
Download photos for castleford-5001 (VRBO 2636389)
Right At Home-Midland Oasis with pool-billiards
67 images from lodging ID 74782010
"""
import asyncio
import httpx
from pathlib import Path
from PIL import Image
from io import BytesIO

IMAGE_URLS = [
    "https://media.vrbo.com/lodging/75000000/74790000/74782100/74782010/cac98e74.jpg",
    "https://media.vrbo.com/lodging/75000000/74790000/74782100/74782010/1445401e.jpg",
    "https://media.vrbo.com/lodging/75000000/74790000/74782100/74782010/db98f0a9.jpg",
    "https://media.vrbo.com/lodging/75000000/74790000/74782100/74782010/59f66812.jpg",
    "https://media.vrbo.com/lodging/75000000/74790000/74782100/74782010/1fc7c866.jpg",
    "https://media.vrbo.com/lodging/75000000/74790000/74782100/74782010/264ce0d8.jpg",
    "https://media.vrbo.com/lodging/75000000/74790000/74782100/74782010/9bb3c7d0.jpg",
    "https://media.vrbo.com/lodging/75000000/74790000/74782100/74782010/70453c3c.jpg",
    "https://media.vrbo.com/lodging/75000000/74790000/74782100/74782010/d2dbe623.jpg",
    "https://media.vrbo.com/lodging/75000000/74790000/74782100/74782010/0a55c4f1.jpg",
    "https://media.vrbo.com/lodging/75000000/74790000/74782100/74782010/e6d29739.jpg",
    "https://media.vrbo.com/lodging/75000000/74790000/74782100/74782010/1850554a.jpg",
    "https://media.vrbo.com/lodging/75000000/74790000/74782100/74782010/7e9e2f52.jpg",
    "https://media.vrbo.com/lodging/75000000/74790000/74782100/74782010/2040bae8.jpg",
    "https://media.vrbo.com/lodging/75000000/74790000/74782100/74782010/2c316ed7.jpg",
    "https://media.vrbo.com/lodging/75000000/74790000/74782100/74782010/74ddcc38.jpg",
    "https://media.vrbo.com/lodging/75000000/74790000/74782100/74782010/a36fead3.jpg",
    "https://media.vrbo.com/lodging/75000000/74790000/74782100/74782010/e8564fed.jpg",
    "https://media.vrbo.com/lodging/75000000/74790000/74782100/74782010/1a73259c.jpg",
    "https://media.vrbo.com/lodging/75000000/74790000/74782100/74782010/724f541d.jpg",
    "https://media.vrbo.com/lodging/75000000/74790000/74782100/74782010/6a0965c9.jpg",
    "https://media.vrbo.com/lodging/75000000/74790000/74782100/74782010/e8c01099.jpg",
    "https://media.vrbo.com/lodging/75000000/74790000/74782100/74782010/3eabf5c8.jpg",
    "https://media.vrbo.com/lodging/75000000/74790000/74782100/74782010/dab9de9d.jpg",
    "https://media.vrbo.com/lodging/75000000/74790000/74782100/74782010/8ccdd004.jpg",
    "https://media.vrbo.com/lodging/75000000/74790000/74782100/74782010/eb9680bf.jpg",
    "https://media.vrbo.com/lodging/75000000/74790000/74782100/74782010/589ef51e.jpg",
    "https://media.vrbo.com/lodging/75000000/74790000/74782100/74782010/61c727f4.jpg",
    "https://media.vrbo.com/lodging/75000000/74790000/74782100/74782010/0e05a33f.jpg",
    "https://media.vrbo.com/lodging/75000000/74790000/74782100/74782010/53eb72a4.jpg",
    "https://media.vrbo.com/lodging/75000000/74790000/74782100/74782010/a3364ca0.jpg",
    "https://media.vrbo.com/lodging/75000000/74790000/74782100/74782010/ffb2930a.jpg",
    "https://media.vrbo.com/lodging/75000000/74790000/74782100/74782010/216c78d7.jpg",
    "https://media.vrbo.com/lodging/75000000/74790000/74782100/74782010/45054229.jpg",
    "https://media.vrbo.com/lodging/75000000/74790000/74782100/74782010/917600f4.jpg",
    "https://media.vrbo.com/lodging/75000000/74790000/74782100/74782010/fb2f8a58.jpg",
    "https://media.vrbo.com/lodging/75000000/74790000/74782100/74782010/0ec81094.jpg",
    "https://media.vrbo.com/lodging/75000000/74790000/74782100/74782010/991d39a3.jpg",
    "https://media.vrbo.com/lodging/75000000/74790000/74782100/74782010/3b92e0c3.jpg",
    "https://media.vrbo.com/lodging/75000000/74790000/74782100/74782010/9430aff5.jpg",
    "https://media.vrbo.com/lodging/75000000/74790000/74782100/74782010/fa97dd7b.jpg",
    "https://media.vrbo.com/lodging/75000000/74790000/74782100/74782010/72978527.jpg",
    "https://media.vrbo.com/lodging/75000000/74790000/74782100/74782010/73a7b5af.jpg",
    "https://media.vrbo.com/lodging/75000000/74790000/74782100/74782010/47910dec.jpg",
    "https://media.vrbo.com/lodging/75000000/74790000/74782100/74782010/e6d49500.jpg",
    "https://media.vrbo.com/lodging/75000000/74790000/74782100/74782010/d5d779e3.jpg",
    "https://media.vrbo.com/lodging/75000000/74790000/74782100/74782010/a4f3717a.jpg",
    "https://media.vrbo.com/lodging/75000000/74790000/74782100/74782010/7122816f.jpg",
    "https://media.vrbo.com/lodging/75000000/74790000/74782100/74782010/57838f61.jpg",
    "https://media.vrbo.com/lodging/75000000/74790000/74782100/74782010/9751b277.jpg",
    "https://media.vrbo.com/lodging/75000000/74790000/74782100/74782010/21adfc40.jpg",
    "https://media.vrbo.com/lodging/75000000/74790000/74782100/74782010/780f6500.jpg",
    "https://media.vrbo.com/lodging/75000000/74790000/74782100/74782010/e56840ba.jpg",
    "https://media.vrbo.com/lodging/75000000/74790000/74782100/74782010/91f076dd.jpg",
    "https://media.vrbo.com/lodging/75000000/74790000/74782100/74782010/d51d9d70.jpg",
    "https://media.vrbo.com/lodging/75000000/74790000/74782100/74782010/8c6b821e.jpg",
    "https://media.vrbo.com/lodging/75000000/74790000/74782100/74782010/f2d8b117.jpg",
    "https://media.vrbo.com/lodging/75000000/74790000/74782100/74782010/840243be.jpg",
    "https://media.vrbo.com/lodging/75000000/74790000/74782100/74782010/7a52948b.jpg",
    "https://media.vrbo.com/lodging/75000000/74790000/74782100/74782010/900c87e7.jpg",
    "https://media.vrbo.com/lodging/75000000/74790000/74782100/74782010/ade7addb.jpg",
    "https://media.vrbo.com/lodging/75000000/74790000/74782100/74782010/9bf5d55b.jpg",
    "https://media.vrbo.com/lodging/75000000/74790000/74782100/74782010/7f7ce968.jpg",
    "https://media.vrbo.com/lodging/75000000/74790000/74782100/74782010/147f9d79.jpg",
    "https://media.vrbo.com/lodging/75000000/74790000/74782100/74782010/8d82dd64.jpg",
    "https://media.vrbo.com/lodging/75000000/74790000/74782100/74782010/d42cea1c.jpg",
    "https://media.vrbo.com/lodging/75000000/74790000/74782100/74782010/1737d64d.jpg",
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
    print(f"Downloading {len(IMAGE_URLS)} photos for castleford-5001...")

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
