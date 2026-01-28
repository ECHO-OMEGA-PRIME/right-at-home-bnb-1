"""
Download chelsea-3210 images extracted from VRBO Apollo state
"""
import asyncio
import re
from pathlib import Path
import httpx
from PIL import Image
import io

OUTPUT_DIR = Path(r"P:\SOVEREIGN_APPS\RightAtHomeBnB\apps\web\public\properties\chelsea-3210")
BASE_PATH = "lodging/75000000/74880000/74873800/74873782"

# Images extracted from Apollo state (36 unique images)
IMAGES = [
    {"hash": "b23f740c", "label": "Exterior"},
    {"hash": "415b3d4c", "label": "Outdoor dining"},
    {"hash": "48e87140", "label": "Living area"},
    {"hash": "7e6a7740", "label": "Terrace-patio"},
    {"hash": "dc098ad9", "label": "Private kitchen"},
    {"hash": "896dbc69", "label": "Living area"},
    {"hash": "bc815fcf", "label": "Private kitchen"},
    {"hash": "f13ff820", "label": "Dining"},
    {"hash": "6a879f74", "label": "Living area"},
    {"hash": "2fc488c7", "label": "Dining"},
    {"hash": "81ed1658", "label": "Bathroom"},
    {"hash": "cd11a1aa", "label": "Private kitchen"},
    {"hash": "1aad8dad", "label": "Bathroom"},
    {"hash": "08858d1f", "label": "Private kitchen"},
    {"hash": "b5d35829", "label": "Dining"},
    {"hash": "e7efcfb3", "label": "Bathroom"},
    {"hash": "4bade3ca", "label": "Bathroom"},
    {"hash": "721dac49", "label": "Living area"},
    {"hash": "74ae4297", "label": "Outdoor dining"},
    {"hash": "6eec90a6", "label": "Exterior"},
    {"hash": "b735448e", "label": "Property grounds"},
    {"hash": "480ec158", "label": "Exterior detail"},
    {"hash": "53aec0aa", "label": "Outdoor dining"},
    {"hash": "c9d3df04", "label": "Room"},
    {"hash": "7e369449", "label": "Room"},
    {"hash": "d16e141e", "label": "Interior"},
    {"hash": "4e6a583e", "label": "Room"},
    {"hash": "a39c85c7", "label": "Room"},
    {"hash": "df8940be", "label": "Room"},
    {"hash": "170fa1c2", "label": "Room"},
    {"hash": "44e53516", "label": "Room"},
    {"hash": "5b620499", "label": "Bathroom"},
    {"hash": "5b742d28", "label": "Room"},
    {"hash": "2f155d9f", "label": "Room"},
    {"hash": "deeb21a5", "label": "Room"},
    {"hash": "d9fd9666", "label": "Exterior"},
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
    print("Downloading chelsea-3210 images")
    print("=" * 60)

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "image/*,*/*;q=0.8",
        "Referer": "https://www.vrbo.com/2643784",
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
