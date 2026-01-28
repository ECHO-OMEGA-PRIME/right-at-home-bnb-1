#!/usr/bin/env python3
"""
Download photos for Golf Course-3209 (VRBO 3005111)
Right At Home-Midland Adobe Compound with Pool and Fire Pits and Billiards
76 images from lodging ID 85641906
"""
import asyncio
import httpx
from pathlib import Path
from PIL import Image
from io import BytesIO

IMAGE_URLS = [
    "https://media.vrbo.com/lodging/86000000/85650000/85642000/85641906/1aae1b16.jpg",
    "https://media.vrbo.com/lodging/86000000/85650000/85642000/85641906/45302a49.jpg",
    "https://media.vrbo.com/lodging/86000000/85650000/85642000/85641906/792684d7.jpg",
    "https://media.vrbo.com/lodging/86000000/85650000/85642000/85641906/301ac2a9.jpg",
    "https://media.vrbo.com/lodging/86000000/85650000/85642000/85641906/93643570.jpg",
    "https://media.vrbo.com/lodging/86000000/85650000/85642000/85641906/e946921c.jpg",
    "https://media.vrbo.com/lodging/86000000/85650000/85642000/85641906/cf16d774.jpg",
    "https://media.vrbo.com/lodging/86000000/85650000/85642000/85641906/e308a761.jpg",
    "https://media.vrbo.com/lodging/86000000/85650000/85642000/85641906/5c8b6a36.jpg",
    "https://media.vrbo.com/lodging/86000000/85650000/85642000/85641906/8f2a01fe.jpg",
    "https://media.vrbo.com/lodging/86000000/85650000/85642000/85641906/9ae7b475.jpg",
    "https://media.vrbo.com/lodging/86000000/85650000/85642000/85641906/8c3d4596.jpg",
    "https://media.vrbo.com/lodging/86000000/85650000/85642000/85641906/43546299.jpg",
    "https://media.vrbo.com/lodging/86000000/85650000/85642000/85641906/2d033b4a.jpg",
    "https://media.vrbo.com/lodging/86000000/85650000/85642000/85641906/28e56089.jpg",
    "https://media.vrbo.com/lodging/86000000/85650000/85642000/85641906/e9af5921.jpg",
    "https://media.vrbo.com/lodging/86000000/85650000/85642000/85641906/39f4c949.jpg",
    "https://media.vrbo.com/lodging/86000000/85650000/85642000/85641906/50980ff9.jpg",
    "https://media.vrbo.com/lodging/86000000/85650000/85642000/85641906/8208fef8.jpg",
    "https://media.vrbo.com/lodging/86000000/85650000/85642000/85641906/acfadada.jpg",
    "https://media.vrbo.com/lodging/86000000/85650000/85642000/85641906/77050ed0.jpg",
    "https://media.vrbo.com/lodging/86000000/85650000/85642000/85641906/5759cfe3.jpg",
    "https://media.vrbo.com/lodging/86000000/85650000/85642000/85641906/c92451f8.jpg",
    "https://media.vrbo.com/lodging/86000000/85650000/85642000/85641906/4d301c85.jpg",
    "https://media.vrbo.com/lodging/86000000/85650000/85642000/85641906/4391b325.jpg",
    "https://media.vrbo.com/lodging/86000000/85650000/85642000/85641906/7908728d.jpg",
    "https://media.vrbo.com/lodging/86000000/85650000/85642000/85641906/9abb80e5.jpg",
    "https://media.vrbo.com/lodging/86000000/85650000/85642000/85641906/c3395ac9.jpg",
    "https://media.vrbo.com/lodging/86000000/85650000/85642000/85641906/69eea468.jpg",
    "https://media.vrbo.com/lodging/86000000/85650000/85642000/85641906/27ce8297.jpg",
    "https://media.vrbo.com/lodging/86000000/85650000/85642000/85641906/a9e77cbd.jpg",
    "https://media.vrbo.com/lodging/86000000/85650000/85642000/85641906/02721676.jpg",
    "https://media.vrbo.com/lodging/86000000/85650000/85642000/85641906/1240d84e.jpg",
    "https://media.vrbo.com/lodging/86000000/85650000/85642000/85641906/c7b84309.jpg",
    "https://media.vrbo.com/lodging/86000000/85650000/85642000/85641906/5430257d.jpg",
    "https://media.vrbo.com/lodging/86000000/85650000/85642000/85641906/f1a99ad3.jpg",
    "https://media.vrbo.com/lodging/86000000/85650000/85642000/85641906/7ca89ac5.jpg",
    "https://media.vrbo.com/lodging/86000000/85650000/85642000/85641906/ee748a21.jpg",
    "https://media.vrbo.com/lodging/86000000/85650000/85642000/85641906/6a142bfc.jpg",
    "https://media.vrbo.com/lodging/86000000/85650000/85642000/85641906/6c2d53ba.jpg",
    "https://media.vrbo.com/lodging/86000000/85650000/85642000/85641906/1b7b372d.jpg",
    "https://media.vrbo.com/lodging/86000000/85650000/85642000/85641906/ca8a5ea2.jpg",
    "https://media.vrbo.com/lodging/86000000/85650000/85642000/85641906/5666448e.jpg",
    "https://media.vrbo.com/lodging/86000000/85650000/85642000/85641906/b7ad3cd2.jpg",
    "https://media.vrbo.com/lodging/86000000/85650000/85642000/85641906/d033c27d.jpg",
    "https://media.vrbo.com/lodging/86000000/85650000/85642000/85641906/b70ef7ae.jpg",
    "https://media.vrbo.com/lodging/86000000/85650000/85642000/85641906/730ad503.jpg",
    "https://media.vrbo.com/lodging/86000000/85650000/85642000/85641906/068d420a.jpg",
    "https://media.vrbo.com/lodging/86000000/85650000/85642000/85641906/0e1220ff.jpg",
    "https://media.vrbo.com/lodging/86000000/85650000/85642000/85641906/1d258f97.jpg",
    "https://media.vrbo.com/lodging/86000000/85650000/85642000/85641906/033e5615.jpg",
    "https://media.vrbo.com/lodging/86000000/85650000/85642000/85641906/141dddf0.jpg",
    "https://media.vrbo.com/lodging/86000000/85650000/85642000/85641906/06f8b440.jpg",
    "https://media.vrbo.com/lodging/86000000/85650000/85642000/85641906/d507addc.jpg",
    "https://media.vrbo.com/lodging/86000000/85650000/85642000/85641906/c7f90a04.jpg",
    "https://media.vrbo.com/lodging/86000000/85650000/85642000/85641906/eb9af178.jpg",
    "https://media.vrbo.com/lodging/86000000/85650000/85642000/85641906/8137797f.jpg",
    "https://media.vrbo.com/lodging/86000000/85650000/85642000/85641906/6ccddd45.jpg",
    "https://media.vrbo.com/lodging/86000000/85650000/85642000/85641906/e9349ef0.jpg",
    "https://media.vrbo.com/lodging/86000000/85650000/85642000/85641906/e74163c8.jpg",
    "https://media.vrbo.com/lodging/86000000/85650000/85642000/85641906/e0257866.jpg",
    "https://media.vrbo.com/lodging/86000000/85650000/85642000/85641906/d6ec289f.jpg",
    "https://media.vrbo.com/lodging/86000000/85650000/85642000/85641906/46ef3c46.jpg",
    "https://media.vrbo.com/lodging/86000000/85650000/85642000/85641906/1f08fa77.jpg",
    "https://media.vrbo.com/lodging/86000000/85650000/85642000/85641906/ad59da56.jpg",
    "https://media.vrbo.com/lodging/86000000/85650000/85642000/85641906/cb991225.jpg",
    "https://media.vrbo.com/lodging/86000000/85650000/85642000/85641906/0da9d4b4.jpg",
    "https://media.vrbo.com/lodging/86000000/85650000/85642000/85641906/6ce3096c.jpg",
    "https://media.vrbo.com/lodging/86000000/85650000/85642000/85641906/c8128597.jpg",
    "https://media.vrbo.com/lodging/86000000/85650000/85642000/85641906/adfb4fb1.jpg",
    "https://media.vrbo.com/lodging/86000000/85650000/85642000/85641906/cdd31bf7.jpg",
    "https://media.vrbo.com/lodging/86000000/85650000/85642000/85641906/633e73ed.jpg",
    "https://media.vrbo.com/lodging/86000000/85650000/85642000/85641906/72f0a949.jpg",
    "https://media.vrbo.com/lodging/86000000/85650000/85642000/85641906/f76228a0.jpg",
    "https://media.vrbo.com/lodging/86000000/85650000/85642000/85641906/d5edc55e.jpg",
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
    print(f"Downloading {len(IMAGE_URLS)} photos for Golf Course-3209...")

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
