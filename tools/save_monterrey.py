#!/usr/bin/env python3
"""Save Monterrey House images to JSON"""
import json
from datetime import datetime
from pathlib import Path

OUTPUT_DIR = Path(__file__).parent / "vrbo_images"
OUTPUT_DIR.mkdir(exist_ok=True)

images = [
    "https://media.vrbo.com/lodging/96000000/95660000/95654800/95654775/01f91f6f.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/96000000/95660000/95654800/95654775/184cc42c.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/96000000/95660000/95654800/95654775/1fc163af.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/96000000/95660000/95654800/95654775/20e6b63f.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/96000000/95660000/95654800/95654775/2c2ea45f.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/96000000/95660000/95654800/95654775/2e4274e2.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/96000000/95660000/95654800/95654775/547f583e.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/96000000/95660000/95654800/95654775/56f80b69.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/96000000/95660000/95654800/95654775/6b739cf6.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/96000000/95660000/95654800/95654775/719ffcf0.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/96000000/95660000/95654800/95654775/739b9b7f.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/96000000/95660000/95654800/95654775/79acd7f3.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/96000000/95660000/95654800/95654775/7ed58f63.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/96000000/95660000/95654800/95654775/9059d21c.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/96000000/95660000/95654800/95654775/aa6c0248.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/96000000/95660000/95654800/95654775/c22355ec.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/96000000/95660000/95654800/95654775/c2a80a0b.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/96000000/95660000/95654800/95654775/cc07a7b4.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/96000000/95660000/95654800/95654775/cfe54007.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/96000000/95660000/95654800/95654775/d5d2c7f8.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/96000000/95660000/95654800/95654775/ddef33af.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/96000000/95660000/95654800/95654775/e0a02976.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/96000000/95660000/95654800/95654775/e149bbd3.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/96000000/95660000/95654800/95654775/e971612c.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/96000000/95660000/95654800/95654775/eb0ede37.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/96000000/95660000/95654800/95654775/ed941550.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/96000000/95660000/95654800/95654775/eed68f85.jpg?impolicy=resizecrop&rw=1200&ra=fit",
]

result = {
    "propertyId": "monterrey-house",
    "propertyName": "Right At Home-Midland Monterrey House",
    "vrboId": "3477668",
    "vrboUrl": "https://www.vrbo.com/3477668",
    "galleryUrl": "https://www.vrbo.com/3477668?pwaThumbnailDialog=thumbnail-gallery",
    "images": images,
    "count": len(images),
    "scrapedAt": datetime.now().isoformat()
}

output_file = OUTPUT_DIR / "monterrey-house.json"
with open(output_file, 'w') as f:
    json.dump(result, f, indent=2)

print(f"Saved {len(images)} images to {output_file}")
