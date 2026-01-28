#!/usr/bin/env python3
"""
Download photos for Vanguard-1633 (VRBO 3559249)
Right At Home-Midland Vanguard Velvet Lounge
31 images from lodging ID 96755289
"""
import asyncio
import httpx
from pathlib import Path
from PIL import Image
from io import BytesIO

IMAGE_URLS = [
    "https://media.vrbo.com/lodging/97000000/96760000/96755300/96755289/7a543b1e.jpg",
    "https://media.vrbo.com/lodging/97000000/96760000/96755300/96755289/abecf908.jpg",
    "https://media.vrbo.com/lodging/97000000/96760000/96755300/96755289/1701f2a9.jpg",
    "https://media.vrbo.com/lodging/97000000/96760000/96755300/96755289/02afa5a9.jpg",
    "https://media.vrbo.com/lodging/97000000/96760000/96755300/96755289/5df27cb6.jpg",
    "https://media.vrbo.com/lodging/97000000/96760000/96755300/96755289/0b76c2f2.jpg",
    "https://media.vrbo.com/lodging/97000000/96760000/96755300/96755289/d1ac1bf7.jpg",
    "https://media.vrbo.com/lodging/97000000/96760000/96755300/96755289/dcd5acff.jpg",
    "https://media.vrbo.com/lodging/97000000/96760000/96755300/96755289/745c80d8.jpg",
    "https://media.vrbo.com/lodging/97000000/96760000/96755300/96755289/60f40e7d.jpg",
    "https://media.vrbo.com/lodging/97000000/96760000/96755300/96755289/40d56198.jpg",
    "https://media.vrbo.com/lodging/97000000/96760000/96755300/96755289/94bc77c3.jpg",
    "https://media.vrbo.com/lodging/97000000/96760000/96755300/96755289/5fb712a7.jpg",
    "https://media.vrbo.com/lodging/97000000/96760000/96755300/96755289/425bb6aa.jpg",
    "https://media.vrbo.com/lodging/97000000/96760000/96755300/96755289/841e0e31.jpg",
    "https://media.vrbo.com/lodging/97000000/96760000/96755300/96755289/7d945853.jpg",
    "https://media.vrbo.com/lodging/97000000/96760000/96755300/96755289/3db9562b.jpg",
    "https://media.vrbo.com/lodging/97000000/96760000/96755300/96755289/97a02bb4.jpg",
    "https://media.vrbo.com/lodging/97000000/96760000/96755300/96755289/73dd17a6.jpg",
    "https://media.vrbo.com/lodging/97000000/96760000/96755300/96755289/863a48ef.jpg",
    "https://media.vrbo.com/lodging/97000000/96760000/96755300/96755289/e39d4ad1.jpg",
    "https://media.vrbo.com/lodging/97000000/96760000/96755300/96755289/dd27e7c0.jpg",
    "https://media.vrbo.com/lodging/97000000/96760000/96755300/96755289/aaad331f.jpg",
    "https://media.vrbo.com/lodging/97000000/96760000/96755300/96755289/278e24a9.jpg",
    "https://media.vrbo.com/lodging/97000000/96760000/96755300/96755289/6d911d0a.jpg",
    "https://media.vrbo.com/lodging/97000000/96760000/96755300/96755289/352919de.jpg",
    "https://media.vrbo.com/lodging/97000000/96760000/96755300/96755289/0d88ba2d.jpg",
    "https://media.vrbo.com/lodging/97000000/96760000/96755300/96755289/3f171295.jpg",
    "https://media.vrbo.com/lodging/97000000/96760000/96755300/96755289/887f36f3.jpg",
    "https://media.vrbo.com/lodging/97000000/96760000/96755300/96755289/daab1414.jpg",
    "https://media.vrbo.com/lodging/97000000/96760000/96755300/96755289/949570fb.jpg",
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
    print(f"Downloading {len(IMAGE_URLS)} photos for Vanguard-1633...")

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
