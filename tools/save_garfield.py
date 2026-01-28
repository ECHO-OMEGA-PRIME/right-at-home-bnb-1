#!/usr/bin/env python3
import json
from datetime import datetime
from pathlib import Path

OUTPUT_DIR = Path(__file__).parent / "vrbo_images"
OUTPUT_DIR.mkdir(exist_ok=True)

images = [
    "https://media.vrbo.com/lodging/75000000/74750000/74749900/74749833/05fd4d8b.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/75000000/74750000/74749900/74749833/07537df8.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/75000000/74750000/74749900/74749833/09b23e29.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/75000000/74750000/74749900/74749833/0c668229.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/75000000/74750000/74749900/74749833/10cf671e.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/75000000/74750000/74749900/74749833/14de3425.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/75000000/74750000/74749900/74749833/16c69615.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/75000000/74750000/74749900/74749833/1a6243a0.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/75000000/74750000/74749900/74749833/1a856421.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/75000000/74750000/74749900/74749833/21737697.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/75000000/74750000/74749900/74749833/21a82880.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/75000000/74750000/74749900/74749833/22fb002b.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/75000000/74750000/74749900/74749833/2a5ea2e0.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/75000000/74750000/74749900/74749833/2b55ff63.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/75000000/74750000/74749900/74749833/2b670c53.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/75000000/74750000/74749900/74749833/2cec133d.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/75000000/74750000/74749900/74749833/314923ee.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/75000000/74750000/74749900/74749833/31d18f26.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/75000000/74750000/74749900/74749833/3ada0864.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/75000000/74750000/74749900/74749833/3ca1f198.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/75000000/74750000/74749900/74749833/3cfcd769.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/75000000/74750000/74749900/74749833/3d9b8c44.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/75000000/74750000/74749900/74749833/4406d6a2.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/75000000/74750000/74749900/74749833/4527fd6c.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/75000000/74750000/74749900/74749833/46397a0e.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/75000000/74750000/74749900/74749833/496d765a.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/75000000/74750000/74749900/74749833/4a4eeee7.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/75000000/74750000/74749900/74749833/51f27fff.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/75000000/74750000/74749900/74749833/56e0594e.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/75000000/74750000/74749900/74749833/5c3c17a3.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/75000000/74750000/74749900/74749833/5f133523.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/75000000/74750000/74749900/74749833/60618836.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/75000000/74750000/74749900/74749833/6c8e1ebe.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/75000000/74750000/74749900/74749833/6f77d40e.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/75000000/74750000/74749900/74749833/792ec25c.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/75000000/74750000/74749900/74749833/7e773159.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/75000000/74750000/74749900/74749833/821cc0bc.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/75000000/74750000/74749900/74749833/93b2494a.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/75000000/74750000/74749900/74749833/95d6237d.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/75000000/74750000/74749900/74749833/96e45f66.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/75000000/74750000/74749900/74749833/96e82168.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/75000000/74750000/74749900/74749833/a15af3a1.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/75000000/74750000/74749900/74749833/a91e5217.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/75000000/74750000/74749900/74749833/b1dc7529.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/75000000/74750000/74749900/74749833/b243c2d6.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/75000000/74750000/74749900/74749833/ba712daa.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/75000000/74750000/74749900/74749833/bac39da7.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/75000000/74750000/74749900/74749833/bc47778b.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/75000000/74750000/74749900/74749833/bd304a19.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/75000000/74750000/74749900/74749833/c0830f35.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/75000000/74750000/74749900/74749833/c333c6d3.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/75000000/74750000/74749900/74749833/c3368223.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/75000000/74750000/74749900/74749833/c3b8bbc8.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/75000000/74750000/74749900/74749833/c3f648cc.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/75000000/74750000/74749900/74749833/cabb0320.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/75000000/74750000/74749900/74749833/cb6db637.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/75000000/74750000/74749900/74749833/cec3fb4a.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/75000000/74750000/74749900/74749833/cef82cca.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/75000000/74750000/74749900/74749833/d192f540.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/75000000/74750000/74749900/74749833/d678f5a4.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/75000000/74750000/74749900/74749833/da37a86d.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/75000000/74750000/74749900/74749833/e0d14a1e.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/75000000/74750000/74749900/74749833/e5f5701d.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/75000000/74750000/74749900/74749833/e7535eb2.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/75000000/74750000/74749900/74749833/f68f1873.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/75000000/74750000/74749900/74749833/f929c3c7.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/75000000/74750000/74749900/74749833/f9930ba6.jpg?impolicy=resizecrop&rw=1200&ra=fit",
]

result = {
    "propertyId": "garfield-2702",
    "propertyName": "Patio Home with Hot Tub @ Garfield",
    "vrboId": "2634718",
    "vrboUrl": "https://www.vrbo.com/2634718",
    "galleryUrl": "https://www.vrbo.com/2634718?pwaThumbnailDialog=thumbnail-gallery",
    "images": images,
    "count": len(images),
    "scrapedAt": datetime.now().isoformat()
}

output_file = OUTPUT_DIR / "garfield-2702.json"
with open(output_file, 'w') as f:
    json.dump(result, f, indent=2)

print(f"Saved {len(images)} images to {output_file}")
