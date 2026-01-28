"""
VRBO Multi-Property Image Scraper
Downloads all property images from multiple VRBO listings
"""
import os
import asyncio
import httpx
from pathlib import Path
from PIL import Image
import io

# Properties to scrape (property_id, internal_id, output_folder, image_hashes)
PROPERTIES = {
    "2643822": {
        "internal_id": "74873930",
        "output": Path(r"P:\SOVEREIGN_APPS\RightAtHomeBnB\apps\web\public\properties\storey-4801"),
        "base_url": "https://media.vrbo.com/lodging/75000000/74880000/74874000/74873930",
        "hashes": [
            "6db7cfb6", "d4b8c033", "212c1502", "07fbc037", "11c222b9",
            "2422d38e", "2497205c", "254ebdac", "3cdc4d29", "3f0ba081",
            "425c0335", "46114158", "4949794b", "4b83be09", "4ba2d4ef",
            "534697f3", "5b35bd4f", "627bf913", "63a521e5", "7b9bffbe",
            "7f70babc", "8535d132", "8daefe93", "8ecf61f2", "913aac60",
            "944fa51a", "9cd1b0dd", "ae061554", "b4c1517a", "d00e62f8",
            "d38870ef", "e652533a", "ee659559", "f2203f42", "f542c2d6",
            "f873e818", "efce43d0"
        ]
    }
}

async def download_and_convert(client: httpx.AsyncClient, url: str, output_path: Path) -> bool:
    """Download image and convert to webp"""
    try:
        response = await client.get(url)
        if response.status_code == 200:
            # Convert to webp using PIL
            img = Image.open(io.BytesIO(response.content))
            img.save(output_path, 'WEBP', quality=90)
            print(f"  ✓ {output_path.name}")
            return True
        else:
            print(f"  ✗ Failed: {output_path.name} - Status {response.status_code}")
            return False
    except Exception as e:
        print(f"  ✗ Error: {output_path.name} - {e}")
        return False

async def scrape_property(prop_id: str, config: dict):
    """Scrape all images for a single property"""
    output_dir = config["output"]
    base_url = config["base_url"]
    hashes = config["hashes"]

    print(f"\n{'='*60}")
    print(f"Scraping Property {prop_id}")
    print(f"Output: {output_dir}")
    print(f"Images: {len(hashes)}")
    print('='*60)

    # Ensure output directory exists
    output_dir.mkdir(parents=True, exist_ok=True)

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "image/*,*/*;q=0.8",
        "Referer": f"https://www.vrbo.com/{prop_id}",
    }

    async with httpx.AsyncClient(timeout=60, headers=headers) as client:
        tasks = []
        for i, hash_val in enumerate(hashes):
            url = f"{base_url}/{hash_val}.jpg?impolicy=resizecrop&rw=1200&ra=fit"

            # Name files: main.webp for first, then image-01.webp, etc.
            if i == 0:
                filename = "main.webp"
            else:
                filename = f"image-{i:02d}.webp"

            output_path = output_dir / filename
            tasks.append(download_and_convert(client, url, output_path))

        results = await asyncio.gather(*tasks)

        successful = sum(results)
        print(f"\n✓ Downloaded {successful}/{len(hashes)} images")
        return successful

async def main():
    print("VRBO Multi-Property Image Scraper")
    print("="*60)

    total_success = 0
    total_images = 0

    for prop_id, config in PROPERTIES.items():
        success = await scrape_property(prop_id, config)
        total_success += success
        total_images += len(config["hashes"])

    print(f"\n{'='*60}")
    print(f"COMPLETE: {total_success}/{total_images} images downloaded")
    print('='*60)

if __name__ == "__main__":
    asyncio.run(main())
