#!/usr/bin/env python3
"""
Download photos for storey-4801 (VRBO 2643822)
Right At Home-Midland Destination Getaway
38 images from lodging ID 74873930
"""
import asyncio
import httpx
from pathlib import Path
from PIL import Image
from io import BytesIO

IMAGE_URLS = [
    "https://media.vrbo.com/lodging/75000000/74880000/74874000/74873930/6db7cfb6.jpg",
    "https://media.vrbo.com/lodging/75000000/74880000/74874000/74873930/d4b8c033.jpg",
    "https://media.vrbo.com/lodging/75000000/74880000/74874000/74873930/212c1502.jpg",
    "https://media.vrbo.com/lodging/75000000/74880000/74874000/74873930/07fbc037.jpg",
    "https://media.vrbo.com/lodging/75000000/74880000/74874000/74873930/11c222b9.jpg",
    "https://media.vrbo.com/lodging/75000000/74880000/74874000/74873930/2422d38e.jpg",
    "https://media.vrbo.com/lodging/75000000/74880000/74874000/74873930/2497205c.jpg",
    "https://media.vrbo.com/lodging/75000000/74880000/74874000/74873930/254ebdac.jpg",
    "https://media.vrbo.com/lodging/75000000/74880000/74874000/74873930/3cdc4d29.jpg",
    "https://media.vrbo.com/lodging/75000000/74880000/74874000/74873930/3f0ba081.jpg",
    "https://media.vrbo.com/lodging/75000000/74880000/74874000/74873930/425c0335.jpg",
    "https://media.vrbo.com/lodging/75000000/74880000/74874000/74873930/46114158.jpg",
    "https://media.vrbo.com/lodging/75000000/74880000/74874000/74873930/4949794b.jpg",
    "https://media.vrbo.com/lodging/75000000/74880000/74874000/74873930/4b83be09.jpg",
    "https://media.vrbo.com/lodging/75000000/74880000/74874000/74873930/4ba2d4ef.jpg",
    "https://media.vrbo.com/lodging/75000000/74880000/74874000/74873930/534697f3.jpg",
    "https://media.vrbo.com/lodging/75000000/74880000/74874000/74873930/5b35bd4f.jpg",
    "https://media.vrbo.com/lodging/75000000/74880000/74874000/74873930/627bf913.jpg",
    "https://media.vrbo.com/lodging/75000000/74880000/74874000/74873930/63a521e5.jpg",
    "https://media.vrbo.com/lodging/75000000/74880000/74874000/74873930/7b9bffbe.jpg",
    "https://media.vrbo.com/lodging/75000000/74880000/74874000/74873930/7f70babc.jpg",
    "https://media.vrbo.com/lodging/75000000/74880000/74874000/74873930/8535d132.jpg",
    "https://media.vrbo.com/lodging/75000000/74880000/74874000/74873930/8daefe93.jpg",
    "https://media.vrbo.com/lodging/75000000/74880000/74874000/74873930/8ecf61f2.jpg",
    "https://media.vrbo.com/lodging/75000000/74880000/74874000/74873930/913aac60.jpg",
    "https://media.vrbo.com/lodging/75000000/74880000/74874000/74873930/944fa51a.jpg",
    "https://media.vrbo.com/lodging/75000000/74880000/74874000/74873930/9cd1b0dd.jpg",
    "https://media.vrbo.com/lodging/75000000/74880000/74874000/74873930/ae061554.jpg",
    "https://media.vrbo.com/lodging/75000000/74880000/74874000/74873930/afaf2622.jpg",
    "https://media.vrbo.com/lodging/75000000/74880000/74874000/74873930/b4c1517a.jpg",
    "https://media.vrbo.com/lodging/75000000/74880000/74874000/74873930/d00e62f8.jpg",
    "https://media.vrbo.com/lodging/75000000/74880000/74874000/74873930/d38870ef.jpg",
    "https://media.vrbo.com/lodging/75000000/74880000/74874000/74873930/e652533a.jpg",
    "https://media.vrbo.com/lodging/75000000/74880000/74874000/74873930/ee659559.jpg",
    "https://media.vrbo.com/lodging/75000000/74880000/74874000/74873930/f2203f42.jpg",
    "https://media.vrbo.com/lodging/75000000/74880000/74874000/74873930/f542c2d6.jpg",
    "https://media.vrbo.com/lodging/75000000/74880000/74874000/74873930/f873e818.jpg",
    "https://media.vrbo.com/lodging/75000000/74880000/74874000/74873930/efce43d0.jpg",
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
    print(f"Downloading {len(IMAGE_URLS)} photos for storey-4801...")

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
