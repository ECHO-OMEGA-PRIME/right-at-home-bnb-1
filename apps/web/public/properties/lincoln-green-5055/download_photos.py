#!/usr/bin/env python3
"""
Download photos for lincoln-green-5055 (VRBO 4581977)
Right at Home-Midland Sprawling Ranch House with Pool Cabana and Playground
84 images from lodging ID 116086340
"""
import asyncio
import httpx
from pathlib import Path
from PIL import Image
from io import BytesIO

IMAGE_URLS = [
    "https://media.vrbo.com/lodging/117000000/116090000/116086400/116086340/8698d679.jpg",
    "https://media.vrbo.com/lodging/117000000/116090000/116086400/116086340/841f5313.jpg",
    "https://media.vrbo.com/lodging/117000000/116090000/116086400/116086340/a1cd59e1.jpg",
    "https://media.vrbo.com/lodging/117000000/116090000/116086400/116086340/b6bf6011.jpg",
    "https://media.vrbo.com/lodging/117000000/116090000/116086400/116086340/4328def4.jpg",
    "https://media.vrbo.com/lodging/117000000/116090000/116086400/116086340/9f12c949.jpg",
    "https://media.vrbo.com/lodging/117000000/116090000/116086400/116086340/c97579b9.jpg",
    "https://media.vrbo.com/lodging/117000000/116090000/116086400/116086340/0c5b11f5.jpg",
    "https://media.vrbo.com/lodging/117000000/116090000/116086400/116086340/6e1ebb11.jpg",
    "https://media.vrbo.com/lodging/117000000/116090000/116086400/116086340/b03ecfd5.jpg",
    "https://media.vrbo.com/lodging/117000000/116090000/116086400/116086340/45b153ed.jpg",
    "https://media.vrbo.com/lodging/117000000/116090000/116086400/116086340/04f2aa7c.jpg",
    "https://media.vrbo.com/lodging/117000000/116090000/116086400/116086340/99088f3a.jpg",
    "https://media.vrbo.com/lodging/117000000/116090000/116086400/116086340/ae5508d7.jpg",
    "https://media.vrbo.com/lodging/117000000/116090000/116086400/116086340/9dfc5129.jpg",
    "https://media.vrbo.com/lodging/117000000/116090000/116086400/116086340/76fca7f0.jpg",
    "https://media.vrbo.com/lodging/117000000/116090000/116086400/116086340/d75ff611.jpg",
    "https://media.vrbo.com/lodging/117000000/116090000/116086400/116086340/660accaf.jpg",
    "https://media.vrbo.com/lodging/117000000/116090000/116086400/116086340/5e6cef14.jpg",
    "https://media.vrbo.com/lodging/117000000/116090000/116086400/116086340/4b98d46e.jpg",
    "https://media.vrbo.com/lodging/117000000/116090000/116086400/116086340/27776f82.jpg",
    "https://media.vrbo.com/lodging/117000000/116090000/116086400/116086340/fcc008fd.jpg",
    "https://media.vrbo.com/lodging/117000000/116090000/116086400/116086340/23434305.jpg",
    "https://media.vrbo.com/lodging/117000000/116090000/116086400/116086340/14bfe08b.jpg",
    "https://media.vrbo.com/lodging/117000000/116090000/116086400/116086340/1db61d3a.jpg",
    "https://media.vrbo.com/lodging/117000000/116090000/116086400/116086340/0a11b3cd.jpg",
    "https://media.vrbo.com/lodging/117000000/116090000/116086400/116086340/4942c944.jpg",
    "https://media.vrbo.com/lodging/117000000/116090000/116086400/116086340/7844ad83.jpg",
    "https://media.vrbo.com/lodging/117000000/116090000/116086400/116086340/739f2ec9.jpg",
    "https://media.vrbo.com/lodging/117000000/116090000/116086400/116086340/8698a3d2.jpg",
    "https://media.vrbo.com/lodging/117000000/116090000/116086400/116086340/2e834717.jpg",
    "https://media.vrbo.com/lodging/117000000/116090000/116086400/116086340/5885273f.jpg",
    "https://media.vrbo.com/lodging/117000000/116090000/116086400/116086340/44000244.jpg",
    "https://media.vrbo.com/lodging/117000000/116090000/116086400/116086340/98e7ecd9.jpg",
    "https://media.vrbo.com/lodging/117000000/116090000/116086400/116086340/2bc15eb8.jpg",
    "https://media.vrbo.com/lodging/117000000/116090000/116086400/116086340/d8f19063.jpg",
    "https://media.vrbo.com/lodging/117000000/116090000/116086400/116086340/4e83178c.jpg",
    "https://media.vrbo.com/lodging/117000000/116090000/116086400/116086340/cac984a1.jpg",
    "https://media.vrbo.com/lodging/117000000/116090000/116086400/116086340/e59dc078.jpg",
    "https://media.vrbo.com/lodging/117000000/116090000/116086400/116086340/b7c89ebb.jpg",
    "https://media.vrbo.com/lodging/117000000/116090000/116086400/116086340/433ae4e8.jpg",
    "https://media.vrbo.com/lodging/117000000/116090000/116086400/116086340/8e2a6fee.jpg",
    "https://media.vrbo.com/lodging/117000000/116090000/116086400/116086340/0d2a778a.jpg",
    "https://media.vrbo.com/lodging/117000000/116090000/116086400/116086340/5772aaf1.jpg",
    "https://media.vrbo.com/lodging/117000000/116090000/116086400/116086340/52cb3e67.jpg",
    "https://media.vrbo.com/lodging/117000000/116090000/116086400/116086340/ca4afe67.jpg",
    "https://media.vrbo.com/lodging/117000000/116090000/116086400/116086340/6804b109.jpg",
    "https://media.vrbo.com/lodging/117000000/116090000/116086400/116086340/b2572967.jpg",
    "https://media.vrbo.com/lodging/117000000/116090000/116086400/116086340/d9e1a19a.jpg",
    "https://media.vrbo.com/lodging/117000000/116090000/116086400/116086340/88f4886f.jpg",
    "https://media.vrbo.com/lodging/117000000/116090000/116086400/116086340/55e68d01.jpg",
    "https://media.vrbo.com/lodging/117000000/116090000/116086400/116086340/c3a8cb16.jpg",
    "https://media.vrbo.com/lodging/117000000/116090000/116086400/116086340/aa68b76a.jpg",
    "https://media.vrbo.com/lodging/117000000/116090000/116086400/116086340/30585a17.jpg",
    "https://media.vrbo.com/lodging/117000000/116090000/116086400/116086340/9f32989b.jpg",
    "https://media.vrbo.com/lodging/117000000/116090000/116086400/116086340/dcb378f4.jpg",
    "https://media.vrbo.com/lodging/117000000/116090000/116086400/116086340/0e0f6cc7.jpg",
    "https://media.vrbo.com/lodging/117000000/116090000/116086400/116086340/72fda321.jpg",
    "https://media.vrbo.com/lodging/117000000/116090000/116086400/116086340/901ac5ed.jpg",
    "https://media.vrbo.com/lodging/117000000/116090000/116086400/116086340/20bd4761.jpg",
    "https://media.vrbo.com/lodging/117000000/116090000/116086400/116086340/867f8d1c.jpg",
    "https://media.vrbo.com/lodging/117000000/116090000/116086400/116086340/317b91ba.jpg",
    "https://media.vrbo.com/lodging/117000000/116090000/116086400/116086340/a4bee6ed.jpg",
    "https://media.vrbo.com/lodging/117000000/116090000/116086400/116086340/2d370abd.jpg",
    "https://media.vrbo.com/lodging/117000000/116090000/116086400/116086340/944d2e1e.jpg",
    "https://media.vrbo.com/lodging/117000000/116090000/116086400/116086340/3ca8048b.jpg",
    "https://media.vrbo.com/lodging/117000000/116090000/116086400/116086340/095c0ca3.jpg",
    "https://media.vrbo.com/lodging/117000000/116090000/116086400/116086340/aa3e9152.jpg",
    "https://media.vrbo.com/lodging/117000000/116090000/116086400/116086340/b171681a.jpg",
    "https://media.vrbo.com/lodging/117000000/116090000/116086400/116086340/426f1c3a.jpg",
    "https://media.vrbo.com/lodging/117000000/116090000/116086400/116086340/d502661b.jpg",
    "https://media.vrbo.com/lodging/117000000/116090000/116086400/116086340/204d68a3.jpg",
    "https://media.vrbo.com/lodging/117000000/116090000/116086400/116086340/3f3a2ba1.jpg",
    "https://media.vrbo.com/lodging/117000000/116090000/116086400/116086340/ef91242f.jpg",
    "https://media.vrbo.com/lodging/117000000/116090000/116086400/116086340/cb526586.jpg",
    "https://media.vrbo.com/lodging/117000000/116090000/116086400/116086340/a0fcb4b5.jpg",
    "https://media.vrbo.com/lodging/117000000/116090000/116086400/116086340/f5c9dde1.jpg",
    "https://media.vrbo.com/lodging/117000000/116090000/116086400/116086340/bce62797.jpg",
    "https://media.vrbo.com/lodging/117000000/116090000/116086400/116086340/4a23fa95.jpg",
    "https://media.vrbo.com/lodging/117000000/116090000/116086400/116086340/a90825a3.jpg",
    "https://media.vrbo.com/lodging/117000000/116090000/116086400/116086340/d17b82c9.jpg",
    "https://media.vrbo.com/lodging/117000000/116090000/116086400/116086340/1a828ae9.jpg",
    "https://media.vrbo.com/lodging/117000000/116090000/116086400/116086340/932242eb.jpg",
    "https://media.vrbo.com/lodging/117000000/116090000/116086400/116086340/ba351550.jpg",
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
    print(f"Downloading {len(IMAGE_URLS)} photos for lincoln-green-5055...")

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
