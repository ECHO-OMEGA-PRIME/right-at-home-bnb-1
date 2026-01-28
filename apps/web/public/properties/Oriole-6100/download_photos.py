#!/usr/bin/env python3
"""
Download photos for Oriole-6100 (VRBO 4471713)
Right At Home-Midland's Most Marvelous with Pool
34 images from lodging ID 113699697
"""
import asyncio
import httpx
from pathlib import Path
from PIL import Image
from io import BytesIO

IMAGE_URLS = [
    "https://media.vrbo.com/lodging/114000000/113700000/113699700/113699697/23c7798c.jpg",
    "https://media.vrbo.com/lodging/114000000/113700000/113699700/113699697/77b69212.jpg",
    "https://media.vrbo.com/lodging/114000000/113700000/113699700/113699697/825d6551.jpg",
    "https://media.vrbo.com/lodging/114000000/113700000/113699700/113699697/83c2f5fb.jpg",
    "https://media.vrbo.com/lodging/114000000/113700000/113699700/113699697/67083949.jpg",
    "https://media.vrbo.com/lodging/114000000/113700000/113699700/113699697/a1a5914d.jpg",
    "https://media.vrbo.com/lodging/114000000/113700000/113699700/113699697/d9ace4a3.jpg",
    "https://media.vrbo.com/lodging/114000000/113700000/113699700/113699697/99feec6f.jpg",
    "https://media.vrbo.com/lodging/114000000/113700000/113699700/113699697/72a35b05.jpg",
    "https://media.vrbo.com/lodging/114000000/113700000/113699700/113699697/5005ffef.jpg",
    "https://media.vrbo.com/lodging/114000000/113700000/113699700/113699697/7b694c33.jpg",
    "https://media.vrbo.com/lodging/114000000/113700000/113699700/113699697/315dec8a.jpg",
    "https://media.vrbo.com/lodging/114000000/113700000/113699700/113699697/83c61fc3.jpg",
    "https://media.vrbo.com/lodging/114000000/113700000/113699700/113699697/00703d06.jpg",
    "https://media.vrbo.com/lodging/114000000/113700000/113699700/113699697/fa77ed19.jpg",
    "https://media.vrbo.com/lodging/114000000/113700000/113699700/113699697/2a3b2b52.jpg",
    "https://media.vrbo.com/lodging/114000000/113700000/113699700/113699697/26f8301b.jpg",
    "https://media.vrbo.com/lodging/114000000/113700000/113699700/113699697/ae4af253.jpg",
    "https://media.vrbo.com/lodging/114000000/113700000/113699700/113699697/a79649ec.jpg",
    "https://media.vrbo.com/lodging/114000000/113700000/113699700/113699697/830e7391.jpg",
    "https://media.vrbo.com/lodging/114000000/113700000/113699700/113699697/cfa291d9.jpg",
    "https://media.vrbo.com/lodging/114000000/113700000/113699700/113699697/7358ff50.jpg",
    "https://media.vrbo.com/lodging/114000000/113700000/113699700/113699697/6228f4bd.jpg",
    "https://media.vrbo.com/lodging/114000000/113700000/113699700/113699697/2ced55b1.jpg",
    "https://media.vrbo.com/lodging/114000000/113700000/113699700/113699697/a287313d.jpg",
    "https://media.vrbo.com/lodging/114000000/113700000/113699700/113699697/a07e7cd9.jpg",
    "https://media.vrbo.com/lodging/114000000/113700000/113699700/113699697/d2d3e252.jpg",
    "https://media.vrbo.com/lodging/114000000/113700000/113699700/113699697/c5777f1f.jpg",
    "https://media.vrbo.com/lodging/114000000/113700000/113699700/113699697/c0608ec8.jpg",
    "https://media.vrbo.com/lodging/114000000/113700000/113699700/113699697/36ecff41.jpg",
    "https://media.vrbo.com/lodging/114000000/113700000/113699700/113699697/acd16944.jpg",
    "https://media.vrbo.com/lodging/114000000/113700000/113699700/113699697/66d07ac2.jpg",
    "https://media.vrbo.com/lodging/114000000/113700000/113699700/113699697/58d9b316.jpg",
    "https://media.vrbo.com/lodging/114000000/113700000/113699700/113699697/477694ae.jpg",
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
    print(f"Downloading {len(IMAGE_URLS)} photos for Oriole-6100...")

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
