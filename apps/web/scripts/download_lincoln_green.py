"""
Download lincoln-green-5055 images extracted from VRBO Apollo state
"""
import asyncio
import re
from pathlib import Path
import httpx
from PIL import Image
import io

OUTPUT_DIR = Path(r"P:\SOVEREIGN_APPS\RightAtHomeBnB\apps\web\public\properties\lincoln-green-5055")
BASE_PATH = "lodging/117000000/116090000/116086400/116086340"

# Images extracted from Apollo state (84 unique images)
IMAGES = [
    {"hash": "8698d679", "label": "Exterior"},
    {"hash": "841f5313", "label": "Exterior"},
    {"hash": "a1cd59e1", "label": "Property grounds"},
    {"hash": "b6bf6011", "label": "Property grounds"},
    {"hash": "4328def4", "label": "Room"},
    {"hash": "9f12c949", "label": "Room"},
    {"hash": "c97579b9", "label": "Room"},
    {"hash": "0c5b11f5", "label": "Room"},
    {"hash": "6e1ebb11", "label": "Room"},
    {"hash": "b03ecfd5", "label": "Room"},
    {"hash": "45b153ed", "label": "Room"},
    {"hash": "04f2aa7c", "label": "Room"},
    {"hash": "99088f3a", "label": "Bathroom"},
    {"hash": "ae5508d7", "label": "Bathroom"},
    {"hash": "9dfc5129", "label": "Bathroom"},
    {"hash": "76fca7f0", "label": "Room"},
    {"hash": "d75ff611", "label": "Room"},
    {"hash": "660accaf", "label": "Room"},
    {"hash": "5e6cef14", "label": "Room"},
    {"hash": "4b98d46e", "label": "Room"},
    {"hash": "27776f82", "label": "Room"},
    {"hash": "fcc008fd", "label": "Room"},
    {"hash": "23434305", "label": "Room"},
    {"hash": "14bfe08b", "label": "Bathroom"},
    {"hash": "1db61d3a", "label": "Bathroom"},
    {"hash": "0a11b3cd", "label": "Spa"},
    {"hash": "4942c944", "label": "Room"},
    {"hash": "7844ad83", "label": "Room"},
    {"hash": "739f2ec9", "label": "Interior"},
    {"hash": "8698a3d2", "label": "Living area"},
    {"hash": "2e834717", "label": "Living area"},
    {"hash": "5885273f", "label": "Living area"},
    {"hash": "44000244", "label": "Living area"},
    {"hash": "98e7ecd9", "label": "Interior"},
    {"hash": "2bc15eb8", "label": "Dining"},
    {"hash": "d8f19063", "label": "Dining"},
    {"hash": "4e83178c", "label": "Dining"},
    {"hash": "cac984a1", "label": "Dining"},
    {"hash": "e59dc078", "label": "Interior"},
    {"hash": "b7c89ebb", "label": "Interior"},
    {"hash": "433ae4e8", "label": "Interior"},
    {"hash": "8e2a6fee", "label": "Room"},
    {"hash": "0d2a778a", "label": "Room"},
    {"hash": "5772aaf1", "label": "Room"},
    {"hash": "52cb3e67", "label": "Room"},
    {"hash": "ca4afe67", "label": "Bathroom"},
    {"hash": "6804b109", "label": "Bathroom"},
    {"hash": "b2572967", "label": "Bathroom"},
    {"hash": "d9e1a19a", "label": "Bathroom"},
    {"hash": "88f4886f", "label": "Interior"},
    {"hash": "55e68d01", "label": "Living area"},
    {"hash": "c3a8cb16", "label": "Living area"},
    {"hash": "aa68b76a", "label": "Interior"},
    {"hash": "30585a17", "label": "Living area"},
    {"hash": "9f32989b", "label": "Living area"},
    {"hash": "dcb378f4", "label": "Living area"},
    {"hash": "0e0f6cc7", "label": "Dining"},
    {"hash": "72fda321", "label": "Dining"},
    {"hash": "901ac5ed", "label": "Dining"},
    {"hash": "20bd4761", "label": "Dining"},
    {"hash": "867f8d1c", "label": "Interior"},
    {"hash": "317b91ba", "label": "Private kitchen"},
    {"hash": "a4bee6ed", "label": "Private kitchen"},
    {"hash": "2d370abd", "label": "Private kitchen"},
    {"hash": "944d2e1e", "label": "Private kitchen"},
    {"hash": "3ca8048b", "label": "Private kitchen"},
    {"hash": "095c0ca3", "label": "Private kitchen"},
    {"hash": "aa3e9152", "label": "Private kitchen"},
    {"hash": "b171681a", "label": "Bathroom"},
    {"hash": "426f1c3a", "label": "Interior"},
    {"hash": "d502661b", "label": "Outdoor dining"},
    {"hash": "204d68a3", "label": "Terrace-patio"},
    {"hash": "3f3a2ba1", "label": "Outdoor dining"},
    {"hash": "ef91242f", "label": "Childrens area"},
    {"hash": "cb526586", "label": "Pool"},
    {"hash": "a0fcb4b5", "label": "Pool"},
    {"hash": "f5c9dde1", "label": "Pool"},
    {"hash": "bce62797", "label": "Pool"},
    {"hash": "4a23fa95", "label": "Terrace-patio"},
    {"hash": "a90825a3", "label": "Outdoor dining"},
    {"hash": "d17b82c9", "label": "Pool"},
    {"hash": "1a828ae9", "label": "Terrace-patio"},
    {"hash": "932242eb", "label": "Bathroom"},
    {"hash": "ba351550", "label": "Property grounds"},
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
    print("Downloading lincoln-green-5055 images")
    print("=" * 60)

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "image/*,*/*;q=0.8",
        "Referer": "https://www.vrbo.com/4581977",
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
