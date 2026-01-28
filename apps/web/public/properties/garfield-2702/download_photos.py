#!/usr/bin/env python3
"""
Download photos for garfield-2702 (VRBO 2634718)
Right At Home-Midland Patio Home with Hot Tub and multiple outdoor spaces
67 images from lodging ID 74749833
"""
import asyncio
import httpx
from pathlib import Path
from PIL import Image
from io import BytesIO

IMAGE_URLS = [
    "https://media.vrbo.com/lodging/75000000/74750000/74749900/74749833/51f27fff.jpg",
    "https://media.vrbo.com/lodging/75000000/74750000/74749900/74749833/a91e5217.jpg",
    "https://media.vrbo.com/lodging/75000000/74750000/74749900/74749833/6f77d40e.jpg",
    "https://media.vrbo.com/lodging/75000000/74750000/74749900/74749833/496d765a.jpg",
    "https://media.vrbo.com/lodging/75000000/74750000/74749900/74749833/3ca1f198.jpg",
    "https://media.vrbo.com/lodging/75000000/74750000/74749900/74749833/16c69615.jpg",
    "https://media.vrbo.com/lodging/75000000/74750000/74749900/74749833/e0d14a1e.jpg",
    "https://media.vrbo.com/lodging/75000000/74750000/74749900/74749833/f68f1873.jpg",
    "https://media.vrbo.com/lodging/75000000/74750000/74749900/74749833/22fb002b.jpg",
    "https://media.vrbo.com/lodging/75000000/74750000/74749900/74749833/96e82168.jpg",
    "https://media.vrbo.com/lodging/75000000/74750000/74749900/74749833/21a82880.jpg",
    "https://media.vrbo.com/lodging/75000000/74750000/74749900/74749833/b1dc7529.jpg",
    "https://media.vrbo.com/lodging/75000000/74750000/74749900/74749833/4a4eeee7.jpg",
    "https://media.vrbo.com/lodging/75000000/74750000/74749900/74749833/07537df8.jpg",
    "https://media.vrbo.com/lodging/75000000/74750000/74749900/74749833/60618836.jpg",
    "https://media.vrbo.com/lodging/75000000/74750000/74749900/74749833/2cec133d.jpg",
    "https://media.vrbo.com/lodging/75000000/74750000/74749900/74749833/c3368223.jpg",
    "https://media.vrbo.com/lodging/75000000/74750000/74749900/74749833/5c3c17a3.jpg",
    "https://media.vrbo.com/lodging/75000000/74750000/74749900/74749833/3ada0864.jpg",
    "https://media.vrbo.com/lodging/75000000/74750000/74749900/74749833/bd304a19.jpg",
    "https://media.vrbo.com/lodging/75000000/74750000/74749900/74749833/bac39da7.jpg",
    "https://media.vrbo.com/lodging/75000000/74750000/74749900/74749833/0c668229.jpg",
    "https://media.vrbo.com/lodging/75000000/74750000/74749900/74749833/2b670c53.jpg",
    "https://media.vrbo.com/lodging/75000000/74750000/74749900/74749833/3d9b8c44.jpg",
    "https://media.vrbo.com/lodging/75000000/74750000/74749900/74749833/d192f540.jpg",
    "https://media.vrbo.com/lodging/75000000/74750000/74749900/74749833/a15af3a1.jpg",
    "https://media.vrbo.com/lodging/75000000/74750000/74749900/74749833/1a6243a0.jpg",
    "https://media.vrbo.com/lodging/75000000/74750000/74749900/74749833/314923ee.jpg",
    "https://media.vrbo.com/lodging/75000000/74750000/74749900/74749833/6c8e1ebe.jpg",
    "https://media.vrbo.com/lodging/75000000/74750000/74749900/74749833/21737697.jpg",
    "https://media.vrbo.com/lodging/75000000/74750000/74749900/74749833/05fd4d8b.jpg",
    "https://media.vrbo.com/lodging/75000000/74750000/74749900/74749833/93b2494a.jpg",
    "https://media.vrbo.com/lodging/75000000/74750000/74749900/74749833/1a856421.jpg",
    "https://media.vrbo.com/lodging/75000000/74750000/74749900/74749833/2b55ff63.jpg",
    "https://media.vrbo.com/lodging/75000000/74750000/74749900/74749833/cabb0320.jpg",
    "https://media.vrbo.com/lodging/75000000/74750000/74749900/74749833/d678f5a4.jpg",
    "https://media.vrbo.com/lodging/75000000/74750000/74749900/74749833/e5f5701d.jpg",
    "https://media.vrbo.com/lodging/75000000/74750000/74749900/74749833/56e0594e.jpg",
    "https://media.vrbo.com/lodging/75000000/74750000/74749900/74749833/3cfcd769.jpg",
    "https://media.vrbo.com/lodging/75000000/74750000/74749900/74749833/cec3fb4a.jpg",
    "https://media.vrbo.com/lodging/75000000/74750000/74749900/74749833/da37a86d.jpg",
    "https://media.vrbo.com/lodging/75000000/74750000/74749900/74749833/821cc0bc.jpg",
    "https://media.vrbo.com/lodging/75000000/74750000/74749900/74749833/f9930ba6.jpg",
    "https://media.vrbo.com/lodging/75000000/74750000/74749900/74749833/cb6db637.jpg",
    "https://media.vrbo.com/lodging/75000000/74750000/74749900/74749833/792ec25c.jpg",
    "https://media.vrbo.com/lodging/75000000/74750000/74749900/74749833/10cf671e.jpg",
    "https://media.vrbo.com/lodging/75000000/74750000/74749900/74749833/09b23e29.jpg",
    "https://media.vrbo.com/lodging/75000000/74750000/74749900/74749833/f929c3c7.jpg",
    "https://media.vrbo.com/lodging/75000000/74750000/74749900/74749833/bc47778b.jpg",
    "https://media.vrbo.com/lodging/75000000/74750000/74749900/74749833/2a5ea2e0.jpg",
    "https://media.vrbo.com/lodging/75000000/74750000/74749900/74749833/c3f648cc.jpg",
    "https://media.vrbo.com/lodging/75000000/74750000/74749900/74749833/ba712daa.jpg",
    "https://media.vrbo.com/lodging/75000000/74750000/74749900/74749833/7e773159.jpg",
    "https://media.vrbo.com/lodging/75000000/74750000/74749900/74749833/46397a0e.jpg",
    "https://media.vrbo.com/lodging/75000000/74750000/74749900/74749833/31d18f26.jpg",
    "https://media.vrbo.com/lodging/75000000/74750000/74749900/74749833/c0830f35.jpg",
    "https://media.vrbo.com/lodging/75000000/74750000/74749900/74749833/4527fd6c.jpg",
    "https://media.vrbo.com/lodging/75000000/74750000/74749900/74749833/e7535eb2.jpg",
    "https://media.vrbo.com/lodging/75000000/74750000/74749900/74749833/5f133523.jpg",
    "https://media.vrbo.com/lodging/75000000/74750000/74749900/74749833/14de3425.jpg",
    "https://media.vrbo.com/lodging/75000000/74750000/74749900/74749833/c3b8bbc8.jpg",
    "https://media.vrbo.com/lodging/75000000/74750000/74749900/74749833/b243c2d6.jpg",
    "https://media.vrbo.com/lodging/75000000/74750000/74749900/74749833/c333c6d3.jpg",
    "https://media.vrbo.com/lodging/75000000/74750000/74749900/74749833/4406d6a2.jpg",
    "https://media.vrbo.com/lodging/75000000/74750000/74749900/74749833/96e45f66.jpg",
    "https://media.vrbo.com/lodging/75000000/74750000/74749900/74749833/cef82cca.jpg",
    "https://media.vrbo.com/lodging/75000000/74750000/74749900/74749833/95d6237d.jpg",
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
    print(f"Downloading {len(IMAGE_URLS)} photos for garfield-2702...")

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
