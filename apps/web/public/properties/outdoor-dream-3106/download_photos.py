#!/usr/bin/env python3
"""
Download photos for Humble-3106 (VRBO 4700881)
Right At Home-Midland Outdoor Dream
49 images from lodging ID 118817770
"""
import asyncio
import httpx
from pathlib import Path
from PIL import Image
from io import BytesIO

IMAGE_URLS = [
    "https://media.vrbo.com/lodging/119000000/118820000/118817800/118817770/4c3af3fb.jpg",
    "https://media.vrbo.com/lodging/119000000/118820000/118817800/118817770/a37fcca8.jpg",
    "https://media.vrbo.com/lodging/119000000/118820000/118817800/118817770/66816361.jpg",
    "https://media.vrbo.com/lodging/119000000/118820000/118817800/118817770/18c7f145.jpg",
    "https://media.vrbo.com/lodging/119000000/118820000/118817800/118817770/a715d473.jpg",
    "https://media.vrbo.com/lodging/119000000/118820000/118817800/118817770/ad1d7f86.jpg",
    "https://media.vrbo.com/lodging/119000000/118820000/118817800/118817770/fa9b489b.jpg",
    "https://media.vrbo.com/lodging/119000000/118820000/118817800/118817770/e9ce8e73.jpg",
    "https://media.vrbo.com/lodging/119000000/118820000/118817800/118817770/69dfc936.jpg",
    "https://media.vrbo.com/lodging/119000000/118820000/118817800/118817770/4dc51ed7.jpg",
    "https://media.vrbo.com/lodging/119000000/118820000/118817800/118817770/8ccfea88.jpg",
    "https://media.vrbo.com/lodging/119000000/118820000/118817800/118817770/af5b5ed4.jpg",
    "https://media.vrbo.com/lodging/119000000/118820000/118817800/118817770/d3cf40d4.jpg",
    "https://media.vrbo.com/lodging/119000000/118820000/118817800/118817770/5948814d.jpg",
    "https://media.vrbo.com/lodging/119000000/118820000/118817800/118817770/70c07481.jpg",
    "https://media.vrbo.com/lodging/119000000/118820000/118817800/118817770/52b030f3.jpg",
    "https://media.vrbo.com/lodging/119000000/118820000/118817800/118817770/e67e9649.jpg",
    "https://media.vrbo.com/lodging/119000000/118820000/118817800/118817770/36ac4aa1.jpg",
    "https://media.vrbo.com/lodging/119000000/118820000/118817800/118817770/56eb3b23.jpg",
    "https://media.vrbo.com/lodging/119000000/118820000/118817800/118817770/f669241a.jpg",
    "https://media.vrbo.com/lodging/119000000/118820000/118817800/118817770/0b1599dc.jpg",
    "https://media.vrbo.com/lodging/119000000/118820000/118817800/118817770/87dbb50e.jpg",
    "https://media.vrbo.com/lodging/119000000/118820000/118817800/118817770/029694dc.jpg",
    "https://media.vrbo.com/lodging/119000000/118820000/118817800/118817770/cb2c8af6.jpg",
    "https://media.vrbo.com/lodging/119000000/118820000/118817800/118817770/c475e7d0.jpg",
    "https://media.vrbo.com/lodging/119000000/118820000/118817800/118817770/15d05a17.jpg",
    "https://media.vrbo.com/lodging/119000000/118820000/118817800/118817770/6bfb8d1c.jpg",
    "https://media.vrbo.com/lodging/119000000/118820000/118817800/118817770/19f1cafc.jpg",
    "https://media.vrbo.com/lodging/119000000/118820000/118817800/118817770/426221ea.jpg",
    "https://media.vrbo.com/lodging/119000000/118820000/118817800/118817770/d303408f.jpg",
    "https://media.vrbo.com/lodging/119000000/118820000/118817800/118817770/9dd0d6b2.jpg",
    "https://media.vrbo.com/lodging/119000000/118820000/118817800/118817770/dec6f02e.jpg",
    "https://media.vrbo.com/lodging/119000000/118820000/118817800/118817770/c83949a8.jpg",
    "https://media.vrbo.com/lodging/119000000/118820000/118817800/118817770/447b488f.jpg",
    "https://media.vrbo.com/lodging/119000000/118820000/118817800/118817770/6017c72d.jpg",
    "https://media.vrbo.com/lodging/119000000/118820000/118817800/118817770/5f7c7b6f.jpg",
    "https://media.vrbo.com/lodging/119000000/118820000/118817800/118817770/028b36fe.jpg",
    "https://media.vrbo.com/lodging/119000000/118820000/118817800/118817770/dd03050c.jpg",
    "https://media.vrbo.com/lodging/119000000/118820000/118817800/118817770/dfacd7c8.jpg",
    "https://media.vrbo.com/lodging/119000000/118820000/118817800/118817770/a3a38e55.jpg",
    "https://media.vrbo.com/lodging/119000000/118820000/118817800/118817770/cb1cde0d.jpg",
    "https://media.vrbo.com/lodging/119000000/118820000/118817800/118817770/a51dde6e.jpg",
    "https://media.vrbo.com/lodging/119000000/118820000/118817800/118817770/16ca4496.jpg",
    "https://media.vrbo.com/lodging/119000000/118820000/118817800/118817770/d63924eb.jpg",
    "https://media.vrbo.com/lodging/119000000/118820000/118817800/118817770/ee8827ae.jpg",
    "https://media.vrbo.com/lodging/119000000/118820000/118817800/118817770/5a094863.jpg",
    "https://media.vrbo.com/lodging/119000000/118820000/118817800/118817770/b1260c5e.jpg",
    "https://media.vrbo.com/lodging/119000000/118820000/118817800/118817770/f6c3606a.jpg",
    "https://media.vrbo.com/lodging/119000000/118820000/118817800/118817770/61a1b939.jpg",
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
    print(f"Downloading {len(IMAGE_URLS)} photos for Humble-3106...")

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
