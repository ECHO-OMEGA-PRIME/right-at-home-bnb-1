#!/usr/bin/env python3
"""Save Oriole images to JSON"""
import json
from datetime import datetime
from pathlib import Path

OUTPUT_DIR = Path(__file__).parent / "vrbo_images"
OUTPUT_DIR.mkdir(exist_ok=True)

images = [
    "https://media.vrbo.com/lodging/114000000/113700000/113699700/113699697/00703d06.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/114000000/113700000/113699700/113699697/23c7798c.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/114000000/113700000/113699700/113699697/26f8301b.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/114000000/113700000/113699700/113699697/2a3b2b52.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/114000000/113700000/113699700/113699697/2ced55b1.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/114000000/113700000/113699700/113699697/315dec8a.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/114000000/113700000/113699700/113699697/36ecff41.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/114000000/113700000/113699700/113699697/477694ae.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/114000000/113700000/113699700/113699697/5005ffef.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/114000000/113700000/113699700/113699697/58d9b316.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/114000000/113700000/113699700/113699697/6228f4bd.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/114000000/113700000/113699700/113699697/66d07ac2.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/114000000/113700000/113699700/113699697/67083949.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/114000000/113700000/113699700/113699697/72a35b05.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/114000000/113700000/113699700/113699697/7358ff50.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/114000000/113700000/113699700/113699697/77b69212.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/114000000/113700000/113699700/113699697/7b694c33.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/114000000/113700000/113699700/113699697/825d6551.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/114000000/113700000/113699700/113699697/830e7391.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/114000000/113700000/113699700/113699697/83c2f5fb.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/114000000/113700000/113699700/113699697/83c61fc3.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/114000000/113700000/113699700/113699697/99feec6f.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/114000000/113700000/113699700/113699697/a07e7cd9.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/114000000/113700000/113699700/113699697/a1a5914d.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/114000000/113700000/113699700/113699697/a287313d.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/114000000/113700000/113699700/113699697/a79649ec.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/114000000/113700000/113699700/113699697/acd16944.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/114000000/113700000/113699700/113699697/ae4af253.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/114000000/113700000/113699700/113699697/c0608ec8.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/114000000/113700000/113699700/113699697/c5777f1f.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/114000000/113700000/113699700/113699697/cfa291d9.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/114000000/113700000/113699700/113699697/d2d3e252.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/114000000/113700000/113699700/113699697/d9ace4a3.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/114000000/113700000/113699700/113699697/fa77ed19.jpg?impolicy=resizecrop&rw=1200&ra=fit",
]

result = {
    "propertyId": "oriole-6100",
    "propertyName": "Right At Home-Midland's Most Marvelous with Pool",
    "vrboId": "4471713",
    "vrboUrl": "https://www.vrbo.com/4471713",
    "galleryUrl": "https://www.vrbo.com/4471713?pwaThumbnailDialog=thumbnail-gallery",
    "images": images,
    "count": len(images),
    "scrapedAt": datetime.now().isoformat()
}

output_file = OUTPUT_DIR / "oriole-6100.json"
with open(output_file, 'w') as f:
    json.dump(result, f, indent=2)

print(f"Saved {len(images)} images to {output_file}")
