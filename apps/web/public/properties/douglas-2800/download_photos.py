#!/usr/bin/env python3
"""
Download photos for douglas-2800 (VRBO 3355618)
Right At Home-Old Midland Living with massive yard
54 images from lodging ID 92903489
"""
import asyncio
import httpx
from pathlib import Path
from PIL import Image
from io import BytesIO

IMAGE_URLS = [
    "https://media.vrbo.com/lodging/93000000/92910000/92903500/92903489/fc43b430.jpg",
    "https://media.vrbo.com/lodging/93000000/92910000/92903500/92903489/20ee4cd6.jpg",
    "https://media.vrbo.com/lodging/93000000/92910000/92903500/92903489/ef30f755.jpg",
    "https://media.vrbo.com/lodging/93000000/92910000/92903500/92903489/46923f43.jpg",
    "https://media.vrbo.com/lodging/93000000/92910000/92903500/92903489/52b9b4f6.jpg",
    "https://media.vrbo.com/lodging/93000000/92910000/92903500/92903489/c5f962a7.jpg",
    "https://media.vrbo.com/lodging/93000000/92910000/92903500/92903489/659f90fb.jpg",
    "https://media.vrbo.com/lodging/93000000/92910000/92903500/92903489/8736653d.jpg",
    "https://media.vrbo.com/lodging/93000000/92910000/92903500/92903489/7f3c4847.jpg",
    "https://media.vrbo.com/lodging/93000000/92910000/92903500/92903489/e562393a.jpg",
    "https://media.vrbo.com/lodging/93000000/92910000/92903500/92903489/8620c109.jpg",
    "https://media.vrbo.com/lodging/93000000/92910000/92903500/92903489/d9b8bfa0.jpg",
    "https://media.vrbo.com/lodging/93000000/92910000/92903500/92903489/67ec6e7a.jpg",
    "https://media.vrbo.com/lodging/93000000/92910000/92903500/92903489/c1be3c76.jpg",
    "https://media.vrbo.com/lodging/93000000/92910000/92903500/92903489/2e82eaf7.jpg",
    "https://media.vrbo.com/lodging/93000000/92910000/92903500/92903489/ab52ef9a.jpg",
    "https://media.vrbo.com/lodging/93000000/92910000/92903500/92903489/86b1093b.jpg",
    "https://media.vrbo.com/lodging/93000000/92910000/92903500/92903489/91130cc9.jpg",
    "https://media.vrbo.com/lodging/93000000/92910000/92903500/92903489/8c0a9976.jpg",
    "https://media.vrbo.com/lodging/93000000/92910000/92903500/92903489/0b585b54.jpg",
    "https://media.vrbo.com/lodging/93000000/92910000/92903500/92903489/4e85c1ee.jpg",
    "https://media.vrbo.com/lodging/93000000/92910000/92903500/92903489/70eb179c.jpg",
    "https://media.vrbo.com/lodging/93000000/92910000/92903500/92903489/cb461cde.jpg",
    "https://media.vrbo.com/lodging/93000000/92910000/92903500/92903489/92f88315.jpg",
    "https://media.vrbo.com/lodging/93000000/92910000/92903500/92903489/d459ff0d.jpg",
    "https://media.vrbo.com/lodging/93000000/92910000/92903500/92903489/cd5e3602.jpg",
    "https://media.vrbo.com/lodging/93000000/92910000/92903500/92903489/47c51e46.jpg",
    "https://media.vrbo.com/lodging/93000000/92910000/92903500/92903489/7bcbf904.jpg",
    "https://media.vrbo.com/lodging/93000000/92910000/92903500/92903489/2d1fcf03.jpg",
    "https://media.vrbo.com/lodging/93000000/92910000/92903500/92903489/c5b7d36a.jpg",
    "https://media.vrbo.com/lodging/93000000/92910000/92903500/92903489/f550e141.jpg",
    "https://media.vrbo.com/lodging/93000000/92910000/92903500/92903489/37a6e54e.jpg",
    "https://media.vrbo.com/lodging/93000000/92910000/92903500/92903489/2c365d57.jpg",
    "https://media.vrbo.com/lodging/93000000/92910000/92903500/92903489/07417845.jpg",
    "https://media.vrbo.com/lodging/93000000/92910000/92903500/92903489/69841c29.jpg",
    "https://media.vrbo.com/lodging/93000000/92910000/92903500/92903489/7296fbaf.jpg",
    "https://media.vrbo.com/lodging/93000000/92910000/92903500/92903489/756c4478.jpg",
    "https://media.vrbo.com/lodging/93000000/92910000/92903500/92903489/2221310e.jpg",
    "https://media.vrbo.com/lodging/93000000/92910000/92903500/92903489/05ab1dd3.jpg",
    "https://media.vrbo.com/lodging/93000000/92910000/92903500/92903489/03f033dd.jpg",
    "https://media.vrbo.com/lodging/93000000/92910000/92903500/92903489/d72b2c34.jpg",
    "https://media.vrbo.com/lodging/93000000/92910000/92903500/92903489/78f5036d.jpg",
    "https://media.vrbo.com/lodging/93000000/92910000/92903500/92903489/116a08ec.jpg",
    "https://media.vrbo.com/lodging/93000000/92910000/92903500/92903489/b385fd54.jpg",
    "https://media.vrbo.com/lodging/93000000/92910000/92903500/92903489/b8ca8eaa.jpg",
    "https://media.vrbo.com/lodging/93000000/92910000/92903500/92903489/9d0ed019.jpg",
    "https://media.vrbo.com/lodging/93000000/92910000/92903500/92903489/3db97db1.jpg",
    "https://media.vrbo.com/lodging/93000000/92910000/92903500/92903489/d5db2932.jpg",
    "https://media.vrbo.com/lodging/93000000/92910000/92903500/92903489/1e46318f.jpg",
    "https://media.vrbo.com/lodging/93000000/92910000/92903500/92903489/af7ec035.jpg",
    "https://media.vrbo.com/lodging/93000000/92910000/92903500/92903489/f43b258a.jpg",
    "https://media.vrbo.com/lodging/93000000/92910000/92903500/92903489/0da84868.jpg",
    "https://media.vrbo.com/lodging/93000000/92910000/92903500/92903489/93916ec9.jpg",
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
    print(f"Downloading {len(IMAGE_URLS)} photos for douglas-2800...")

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
