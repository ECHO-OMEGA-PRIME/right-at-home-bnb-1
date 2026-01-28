"""
Download castleford-5001 images extracted from VRBO Apollo state
"""
import asyncio
import re
from pathlib import Path
import httpx
from PIL import Image
import io

OUTPUT_DIR = Path(r"P:\SOVEREIGN_APPS\RightAtHomeBnB\apps\web\public\properties\castleford-5001")
BASE_PATH = "lodging/75000000/74790000/74782100/74782010"

# Images extracted from Apollo state (deduplicated, with labels)
IMAGES = [
    {"hash": "cac98e74", "label": "Pool"},
    {"hash": "1445401e", "label": "Private kitchen"},
    {"hash": "db98f0a9", "label": "Dining"},
    {"hash": "59f66812", "label": "Living area"},
    {"hash": "1fc7c866", "label": "Games room"},
    {"hash": "264ce0d8", "label": "Room"},
    {"hash": "9bb3c7d0", "label": "Room"},
    {"hash": "70453c3c", "label": "Room"},
    {"hash": "d2dbe623", "label": "Room"},
    {"hash": "0a55c4f1", "label": "Room"},
    {"hash": "e6d29739", "label": "Room"},
    {"hash": "1850554a", "label": "Room"},
    {"hash": "7e9e2f52", "label": "Room"},
    {"hash": "2040bae8", "label": "Exterior"},
    {"hash": "2c316ed7", "label": "Room"},
    {"hash": "74ddcc38", "label": "Bathroom"},
    {"hash": "a36fead3", "label": "Bathroom"},
    {"hash": "e8564fed", "label": "Room"},
    {"hash": "1a73259c", "label": "Bathroom"},
    {"hash": "724f541d", "label": "Bathroom"},
    {"hash": "6a0965c9", "label": "Bathroom"},
    {"hash": "e8c01099", "label": "Bathroom"},
    {"hash": "3eabf5c8", "label": "Room"},
    {"hash": "dab9de9d", "label": "Interior"},
    {"hash": "8ccdd004", "label": "Exterior"},
    {"hash": "eb9680bf", "label": "Room"},
    {"hash": "589ef51e", "label": "Room"},
    {"hash": "61c727f4", "label": "Room"},
    {"hash": "0e05a33f", "label": "Exterior"},
    {"hash": "53eb72a4", "label": "Dining"},
    {"hash": "a3364ca0", "label": "Exterior"},
    {"hash": "ffb2930a", "label": "Dining"},
    {"hash": "216c78d7", "label": "Living area"},
    {"hash": "45054229", "label": "Private kitchen"},
    {"hash": "917600f4", "label": "Private kitchen"},
    {"hash": "fb2f8a58", "label": "Private kitchen"},
    {"hash": "0ec81094", "label": "Exterior"},
    {"hash": "991d39a3", "label": "Private kitchen"},
    {"hash": "3b92e0c3", "label": "Private kitchen"},
    {"hash": "9430aff5", "label": "Living area"},
    {"hash": "fa97dd7b", "label": "Living area"},
    {"hash": "72978527", "label": "Living area"},
    {"hash": "73a7b5af", "label": "Games room"},
    {"hash": "47910dec", "label": "Games room"},
    {"hash": "e6d49500", "label": "Games room"},
    {"hash": "d5d779e3", "label": "Exterior"},
    {"hash": "a4f3717a", "label": "Games room"},
    {"hash": "7122816f", "label": "Bathroom"},
    {"hash": "57838f61", "label": "Outdoor dining"},
    {"hash": "9751b277", "label": "Bathroom"},
    {"hash": "21adfc40", "label": "Outdoor dining"},
    {"hash": "780f6500", "label": "Outdoor dining"},
    {"hash": "e56840ba", "label": "Pool"},
    {"hash": "91f076dd", "label": "Pool"},
    {"hash": "d51d9d70", "label": "Terrace-patio"},
    {"hash": "8c6b821e", "label": "Exterior"},
    {"hash": "f2d8b117", "label": "Pool"},
    {"hash": "840243be", "label": "Exterior"},
    {"hash": "7a52948b", "label": "Exterior detail"},
    {"hash": "900c87e7", "label": "Room"},
    {"hash": "ade7addb", "label": "Bathroom"},
    {"hash": "9bf5d55b", "label": "Bathroom"},
    {"hash": "7f7ce968", "label": "Bathroom"},
    {"hash": "147f9d79", "label": "Room"},
    {"hash": "8d82dd64", "label": "Bathroom"},
    {"hash": "d42cea1c", "label": "Interior"},
    {"hash": "1737d64d", "label": "Room"},
]


async def download_and_convert(client: httpx.AsyncClient, hash_val: str, output_path: Path) -> bool:
    """Download image and convert to webp"""
    url = f"https://media.vrbo.com/{BASE_PATH}/{hash_val}.jpg?impolicy=resizecrop&rw=1200&ra=fit"

    try:
        response = await client.get(url)
        if response.status_code == 200:
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


async def main():
    print("Downloading castleford-5001 images")
    print("=" * 60)

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "image/*,*/*;q=0.8",
        "Referer": "https://www.vrbo.com/2636389",
    }

    # Track label counts for unique filenames
    label_counts = {}

    async with httpx.AsyncClient(timeout=60, headers=headers) as client:
        successful = 0
        for i, img in enumerate(IMAGES):
            label = img['label']
            hash_val = img['hash']

            # Create unique filename based on label
            if label not in label_counts:
                label_counts[label] = 0
            label_counts[label] += 1

            # First image is main, rest have labeled names
            if i == 0:
                filename = "main.webp"
            else:
                count = label_counts[label]
                base_name = label.lower().replace(' ', '-').replace('/', '-')
                base_name = re.sub(r'[^\w-]', '', base_name)
                if count > 1:
                    filename = f"{base_name}-{count}.webp"
                else:
                    filename = f"{base_name}.webp"

            output_path = OUTPUT_DIR / filename

            if await download_and_convert(client, hash_val, output_path):
                successful += 1

        print(f"\n✓ Downloaded {successful}/{len(IMAGES)} images")


if __name__ == "__main__":
    asyncio.run(main())
