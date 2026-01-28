#!/usr/bin/env python3
"""Save Lanham images to JSON"""
import json
from datetime import datetime
from pathlib import Path

OUTPUT_DIR = Path(__file__).parent / "vrbo_images"
OUTPUT_DIR.mkdir(exist_ok=True)

images = [
    "https://media.vrbo.com/lodging/114000000/113140000/113137900/113137813/02bd0e8c.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/114000000/113140000/113137900/113137813/07b78246.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/114000000/113140000/113137900/113137813/0af39487.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/114000000/113140000/113137900/113137813/102954c3.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/114000000/113140000/113137900/113137813/1b8d4a1d.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/114000000/113140000/113137900/113137813/20c1de33.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/114000000/113140000/113137900/113137813/27ab2b62.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/114000000/113140000/113137900/113137813/290e9049.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/114000000/113140000/113137900/113137813/2968a0e2.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/114000000/113140000/113137900/113137813/2a518750.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/114000000/113140000/113137900/113137813/2a891513.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/114000000/113140000/113137900/113137813/32acf0a6.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/114000000/113140000/113137900/113137813/383383a7.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/114000000/113140000/113137900/113137813/3e3a6d80.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/114000000/113140000/113137900/113137813/4323867c.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/114000000/113140000/113137900/113137813/44239e9f.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/114000000/113140000/113137900/113137813/467c8a4f.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/114000000/113140000/113137900/113137813/493b40b1.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/114000000/113140000/113137900/113137813/4afa59d1.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/114000000/113140000/113137900/113137813/5b5ffe30.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/114000000/113140000/113137900/113137813/7759e8ee.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/114000000/113140000/113137900/113137813/843ad958.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/114000000/113140000/113137900/113137813/8abfab37.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/114000000/113140000/113137900/113137813/8e226785.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/114000000/113140000/113137900/113137813/8f176e84.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/114000000/113140000/113137900/113137813/930c7a20.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/114000000/113140000/113137900/113137813/9ba21b3d.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/114000000/113140000/113137900/113137813/9cb8d9a4.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/114000000/113140000/113137900/113137813/9e12b534.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/114000000/113140000/113137900/113137813/9f57bde3.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/114000000/113140000/113137900/113137813/a3bf65cb.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/114000000/113140000/113137900/113137813/a701ef63.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/114000000/113140000/113137900/113137813/aa4c9c8a.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/114000000/113140000/113137900/113137813/b52d5065.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/114000000/113140000/113137900/113137813/baba9c14.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/114000000/113140000/113137900/113137813/c3ab3e54.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/114000000/113140000/113137900/113137813/c49ed220.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/114000000/113140000/113137900/113137813/c68de35b.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/114000000/113140000/113137900/113137813/ce268758.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/114000000/113140000/113137900/113137813/cf36733b.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/114000000/113140000/113137900/113137813/f146d1de.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/114000000/113140000/113137900/113137813/ffe4b8e6.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/114000000/113140000/113137900/113137813/w2046h1365x2y0-e9193a7d.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/114000000/113140000/113137900/113137813/w2047h1365x1y0-593b8e3c.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/114000000/113140000/113137900/113137813/w2047h1365x1y0-7c57a810.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/114000000/113140000/113137900/113137813/w2048h1361x0y4-5cddf887.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/114000000/113140000/113137900/113137813/w2048h1362x0y3-f96a26ab.jpg?impolicy=resizecrop&rw=1200&ra=fit",
]

result = {
    "propertyId": "lanham-1426",
    "propertyName": "Right At Home-Midland Posh & Private with Billiards",
    "vrboId": "4437486",
    "vrboUrl": "https://www.vrbo.com/4437486",
    "galleryUrl": "https://www.vrbo.com/4437486?pwaThumbnailDialog=thumbnail-gallery",
    "images": images,
    "count": len(images),
    "scrapedAt": datetime.now().isoformat()
}

output_file = OUTPUT_DIR / "lanham-1426.json"
with open(output_file, 'w') as f:
    json.dump(result, f, indent=2)

print(f"Saved {len(images)} images to {output_file}")
