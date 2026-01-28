#!/usr/bin/env python3
"""
Download photos for Daventry-1309 (VRBO 4750070)
Right At Home-Midland Saddle Club
50 images from lodging ID 119552315
"""
import asyncio
import httpx
from pathlib import Path
from PIL import Image
from io import BytesIO

IMAGE_URLS = [
    "https://media.vrbo.com/lodging/120000000/119560000/119552400/119552315/86cf11ba.jpg",
    "https://media.vrbo.com/lodging/120000000/119560000/119552400/119552315/fb8c48b2.jpg",
    "https://media.vrbo.com/lodging/120000000/119560000/119552400/119552315/0c6d063e.jpg",
    "https://media.vrbo.com/lodging/120000000/119560000/119552400/119552315/ae38f4f9.jpg",
    "https://media.vrbo.com/lodging/120000000/119560000/119552400/119552315/c7247428.jpg",
    "https://media.vrbo.com/lodging/120000000/119560000/119552400/119552315/9638d38a.jpg",
    "https://media.vrbo.com/lodging/120000000/119560000/119552400/119552315/aeaa263a.jpg",
    "https://media.vrbo.com/lodging/120000000/119560000/119552400/119552315/4e1e4731.jpg",
    "https://media.vrbo.com/lodging/120000000/119560000/119552400/119552315/8dcdcd21.jpg",
    "https://media.vrbo.com/lodging/120000000/119560000/119552400/119552315/38eafa21.jpg",
    "https://media.vrbo.com/lodging/120000000/119560000/119552400/119552315/1de4d5a8.jpg",
    "https://media.vrbo.com/lodging/120000000/119560000/119552400/119552315/815ef560.jpg",
    "https://media.vrbo.com/lodging/120000000/119560000/119552400/119552315/90f069f2.jpg",
    "https://media.vrbo.com/lodging/120000000/119560000/119552400/119552315/a02e34ad.jpg",
    "https://media.vrbo.com/lodging/120000000/119560000/119552400/119552315/9f431d65.jpg",
    "https://media.vrbo.com/lodging/120000000/119560000/119552400/119552315/5637ab80.jpg",
    "https://media.vrbo.com/lodging/120000000/119560000/119552400/119552315/56d5745e.jpg",
    "https://media.vrbo.com/lodging/120000000/119560000/119552400/119552315/74c05c12.jpg",
    "https://media.vrbo.com/lodging/120000000/119560000/119552400/119552315/43579ab1.jpg",
    "https://media.vrbo.com/lodging/120000000/119560000/119552400/119552315/800e186e.jpg",
    "https://media.vrbo.com/lodging/120000000/119560000/119552400/119552315/7615d207.jpg",
    "https://media.vrbo.com/lodging/120000000/119560000/119552400/119552315/e52f3bb4.jpg",
    "https://media.vrbo.com/lodging/120000000/119560000/119552400/119552315/802e5e18.jpg",
    "https://media.vrbo.com/lodging/120000000/119560000/119552400/119552315/15c7198a.jpg",
    "https://media.vrbo.com/lodging/120000000/119560000/119552400/119552315/7ae8950d.jpg",
    "https://media.vrbo.com/lodging/120000000/119560000/119552400/119552315/3f4be4e1.jpg",
    "https://media.vrbo.com/lodging/120000000/119560000/119552400/119552315/28604540.jpg",
    "https://media.vrbo.com/lodging/120000000/119560000/119552400/119552315/4fb4fdaf.jpg",
    "https://media.vrbo.com/lodging/120000000/119560000/119552400/119552315/f6ccf0d8.jpg",
    "https://media.vrbo.com/lodging/120000000/119560000/119552400/119552315/c89cecdb.jpg",
    "https://media.vrbo.com/lodging/120000000/119560000/119552400/119552315/d2dde48e.jpg",
    "https://media.vrbo.com/lodging/120000000/119560000/119552400/119552315/372a8196.jpg",
    "https://media.vrbo.com/lodging/120000000/119560000/119552400/119552315/914797f3.jpg",
    "https://media.vrbo.com/lodging/120000000/119560000/119552400/119552315/528cb8e3.jpg",
    "https://media.vrbo.com/lodging/120000000/119560000/119552400/119552315/e58cf7f3.jpg",
    "https://media.vrbo.com/lodging/120000000/119560000/119552400/119552315/e113fcc5.jpg",
    "https://media.vrbo.com/lodging/120000000/119560000/119552400/119552315/ce274b48.jpg",
    "https://media.vrbo.com/lodging/120000000/119560000/119552400/119552315/473d5347.jpg",
    "https://media.vrbo.com/lodging/120000000/119560000/119552400/119552315/2dd517c0.jpg",
    "https://media.vrbo.com/lodging/120000000/119560000/119552400/119552315/b8bda266.jpg",
    "https://media.vrbo.com/lodging/120000000/119560000/119552400/119552315/87024e3c.jpg",
    "https://media.vrbo.com/lodging/120000000/119560000/119552400/119552315/987cbd8e.jpg",
    "https://media.vrbo.com/lodging/120000000/119560000/119552400/119552315/760d4b82.jpg",
    "https://media.vrbo.com/lodging/120000000/119560000/119552400/119552315/81089222.jpg",
    "https://media.vrbo.com/lodging/120000000/119560000/119552400/119552315/15a663d4.jpg",
    "https://media.vrbo.com/lodging/120000000/119560000/119552400/119552315/da619c1e.jpg",
    "https://media.vrbo.com/lodging/120000000/119560000/119552400/119552315/2c830d20.jpg",
    "https://media.vrbo.com/lodging/120000000/119560000/119552400/119552315/052f31b4.jpg",
    "https://media.vrbo.com/lodging/120000000/119560000/119552400/119552315/e840349f.jpg",
    "https://media.vrbo.com/lodging/120000000/119560000/119552400/119552315/c2e4c6dd.jpg",
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
    print(f"Downloading {len(IMAGE_URLS)} photos for Daventry-1309...")

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
