#!/usr/bin/env python3
"""
Download photos for shandon-3528 (VRBO 4894280)
Right At Home-Midland Groovy Times w/Pool
52 images from lodging ID 121667652
"""
import asyncio
import httpx
from pathlib import Path
from PIL import Image
from io import BytesIO

IMAGE_URLS = [
    "https://media.vrbo.com/lodging/122000000/121670000/121667700/121667652/d9e7671b.jpg",
    "https://media.vrbo.com/lodging/122000000/121670000/121667700/121667652/c9e4c0e9.jpg",
    "https://media.vrbo.com/lodging/122000000/121670000/121667700/121667652/0e8919e8.jpg",
    "https://media.vrbo.com/lodging/122000000/121670000/121667700/121667652/70dfdac0.jpg",
    "https://media.vrbo.com/lodging/122000000/121670000/121667700/121667652/94b6bd50.jpg",
    "https://media.vrbo.com/lodging/122000000/121670000/121667700/121667652/70127133.jpg",
    "https://media.vrbo.com/lodging/122000000/121670000/121667700/121667652/1c6ce80a.jpg",
    "https://media.vrbo.com/lodging/122000000/121670000/121667700/121667652/b9fd96fb.jpg",
    "https://media.vrbo.com/lodging/122000000/121670000/121667700/121667652/8df394b0.jpg",
    "https://media.vrbo.com/lodging/122000000/121670000/121667700/121667652/cad93ece.jpg",
    "https://media.vrbo.com/lodging/122000000/121670000/121667700/121667652/b8a44c70.jpg",
    "https://media.vrbo.com/lodging/122000000/121670000/121667700/121667652/a7b04a34.jpg",
    "https://media.vrbo.com/lodging/122000000/121670000/121667700/121667652/b808ba2e.jpg",
    "https://media.vrbo.com/lodging/122000000/121670000/121667700/121667652/2c6a2c3d.jpg",
    "https://media.vrbo.com/lodging/122000000/121670000/121667700/121667652/7f100a44.jpg",
    "https://media.vrbo.com/lodging/122000000/121670000/121667700/121667652/ea30674c.jpg",
    "https://media.vrbo.com/lodging/122000000/121670000/121667700/121667652/70c2dd49.jpg",
    "https://media.vrbo.com/lodging/122000000/121670000/121667700/121667652/5343f19b.jpg",
    "https://media.vrbo.com/lodging/122000000/121670000/121667700/121667652/71e3790f.jpg",
    "https://media.vrbo.com/lodging/122000000/121670000/121667700/121667652/59c0ca3a.jpg",
    "https://media.vrbo.com/lodging/122000000/121670000/121667700/121667652/cc4a36d9.jpg",
    "https://media.vrbo.com/lodging/122000000/121670000/121667700/121667652/cbb5ce95.jpg",
    "https://media.vrbo.com/lodging/122000000/121670000/121667700/121667652/cafcb754.jpg",
    "https://media.vrbo.com/lodging/122000000/121670000/121667700/121667652/9a636ae6.jpg",
    "https://media.vrbo.com/lodging/122000000/121670000/121667700/121667652/daad23ef.jpg",
    "https://media.vrbo.com/lodging/122000000/121670000/121667700/121667652/94907609.jpg",
    "https://media.vrbo.com/lodging/122000000/121670000/121667700/121667652/aad0603e.jpg",
    "https://media.vrbo.com/lodging/122000000/121670000/121667700/121667652/dec1eed1.jpg",
    "https://media.vrbo.com/lodging/122000000/121670000/121667700/121667652/4ecf3b96.jpg",
    "https://media.vrbo.com/lodging/122000000/121670000/121667700/121667652/4c9a2405.jpg",
    "https://media.vrbo.com/lodging/122000000/121670000/121667700/121667652/520fd4ff.jpg",
    "https://media.vrbo.com/lodging/122000000/121670000/121667700/121667652/0b743a3a.jpg",
    "https://media.vrbo.com/lodging/122000000/121670000/121667700/121667652/df8e59e7.jpg",
    "https://media.vrbo.com/lodging/122000000/121670000/121667700/121667652/9090fd6f.jpg",
    "https://media.vrbo.com/lodging/122000000/121670000/121667700/121667652/c043cf18.jpg",
    "https://media.vrbo.com/lodging/122000000/121670000/121667700/121667652/b475aaf4.jpg",
    "https://media.vrbo.com/lodging/122000000/121670000/121667700/121667652/dadafb7f.jpg",
    "https://media.vrbo.com/lodging/122000000/121670000/121667700/121667652/66dce374.jpg",
    "https://media.vrbo.com/lodging/122000000/121670000/121667700/121667652/536c64e5.jpg",
    "https://media.vrbo.com/lodging/122000000/121670000/121667700/121667652/3a5969c6.jpg",
    "https://media.vrbo.com/lodging/122000000/121670000/121667700/121667652/d4d2d477.jpg",
    "https://media.vrbo.com/lodging/122000000/121670000/121667700/121667652/d4427269.jpg",
    "https://media.vrbo.com/lodging/122000000/121670000/121667700/121667652/f6aa808f.jpg",
    "https://media.vrbo.com/lodging/122000000/121670000/121667700/121667652/fe375803.jpg",
    "https://media.vrbo.com/lodging/122000000/121670000/121667700/121667652/f48e9b62.jpg",
    "https://media.vrbo.com/lodging/122000000/121670000/121667700/121667652/1e8249b9.jpg",
    "https://media.vrbo.com/lodging/122000000/121670000/121667700/121667652/781a1e5a.jpg",
    "https://media.vrbo.com/lodging/122000000/121670000/121667700/121667652/ee331b02.jpg",
    "https://media.vrbo.com/lodging/122000000/121670000/121667700/121667652/739b7250.jpg",
    "https://media.vrbo.com/lodging/122000000/121670000/121667700/121667652/f07dea64.jpg",
    "https://media.vrbo.com/lodging/122000000/121670000/121667700/121667652/77d86f52.jpg",
    "https://media.vrbo.com/lodging/122000000/121670000/121667700/121667652/860c89c0.jpg",
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
    print(f"Downloading {len(IMAGE_URLS)} photos for shandon-3528...")

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
