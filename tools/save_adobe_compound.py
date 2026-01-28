#!/usr/bin/env python3
"""Save Adobe Compound images to JSON"""
import json
from datetime import datetime
from pathlib import Path

OUTPUT_DIR = Path(__file__).parent / "vrbo_images"
OUTPUT_DIR.mkdir(exist_ok=True)

images = [
    "https://media.vrbo.com/lodging/86000000/85650000/85642000/85641906/02721676.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/86000000/85650000/85642000/85641906/0571e1f5.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/86000000/85650000/85642000/85641906/0cf5ba5e.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/86000000/85650000/85642000/85641906/101d2a13.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/86000000/85650000/85642000/85641906/14a854a2.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/86000000/85650000/85642000/85641906/15006c7e.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/86000000/85650000/85642000/85641906/19220db9.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/86000000/85650000/85642000/85641906/1c8bb19e.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/86000000/85650000/85642000/85641906/1e7d86d6.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/86000000/85650000/85642000/85641906/23505ba0.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/86000000/85650000/85642000/85641906/27cc03d5.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/86000000/85650000/85642000/85641906/29a29e4b.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/86000000/85650000/85642000/85641906/2d455afe.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/86000000/85650000/85642000/85641906/2e4d07f8.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/86000000/85650000/85642000/85641906/30f05f7c.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/86000000/85650000/85642000/85641906/32095c03.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/86000000/85650000/85642000/85641906/35adfa53.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/86000000/85650000/85642000/85641906/3c54f5f9.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/86000000/85650000/85642000/85641906/3df88f33.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/86000000/85650000/85642000/85641906/3e1ab2e9.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/86000000/85650000/85642000/85641906/41eb2f60.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/86000000/85650000/85642000/85641906/44e0ba60.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/86000000/85650000/85642000/85641906/482f8c1a.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/86000000/85650000/85642000/85641906/4abc47f6.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/86000000/85650000/85642000/85641906/4c5e6e83.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/86000000/85650000/85642000/85641906/4ecd6ff3.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/86000000/85650000/85642000/85641906/51c4a2e4.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/86000000/85650000/85642000/85641906/538acbb9.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/86000000/85650000/85642000/85641906/5477e8f4.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/86000000/85650000/85642000/85641906/5590e9ff.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/86000000/85650000/85642000/85641906/5a09f923.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/86000000/85650000/85642000/85641906/5dc1a3a3.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/86000000/85650000/85642000/85641906/5dcc46fb.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/86000000/85650000/85642000/85641906/66b89b6f.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/86000000/85650000/85642000/85641906/694f0c87.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/86000000/85650000/85642000/85641906/6b04e390.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/86000000/85650000/85642000/85641906/6d95cbf3.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/86000000/85650000/85642000/85641906/6e65a13f.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/86000000/85650000/85642000/85641906/72b8b2c9.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/86000000/85650000/85642000/85641906/77d58b6b.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/86000000/85650000/85642000/85641906/79011842.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/86000000/85650000/85642000/85641906/7bc2da13.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/86000000/85650000/85642000/85641906/7f1f5e2b.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/86000000/85650000/85642000/85641906/80e4f7c6.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/86000000/85650000/85642000/85641906/8215d595.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/86000000/85650000/85642000/85641906/85f21939.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/86000000/85650000/85642000/85641906/8c5adc2e.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/86000000/85650000/85642000/85641906/8f9ce217.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/86000000/85650000/85642000/85641906/90ce62a0.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/86000000/85650000/85642000/85641906/932e5aab.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/86000000/85650000/85642000/85641906/9574df93.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/86000000/85650000/85642000/85641906/9d8f31fa.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/86000000/85650000/85642000/85641906/9fe5dbe6.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/86000000/85650000/85642000/85641906/a5acf05f.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/86000000/85650000/85642000/85641906/a770f45d.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/86000000/85650000/85642000/85641906/a9a7b3cf.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/86000000/85650000/85642000/85641906/ac6ffb14.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/86000000/85650000/85642000/85641906/b2a45f22.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/86000000/85650000/85642000/85641906/b92f9d5c.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/86000000/85650000/85642000/85641906/bab37cac.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/86000000/85650000/85642000/85641906/bc1a16ac.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/86000000/85650000/85642000/85641906/beb44e1a.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/86000000/85650000/85642000/85641906/c11f2afb.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/86000000/85650000/85642000/85641906/c3c4b7bb.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/86000000/85650000/85642000/85641906/c4ff8dfc.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/86000000/85650000/85642000/85641906/c9a6efc7.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/86000000/85650000/85642000/85641906/ca438bc0.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/86000000/85650000/85642000/85641906/cd5b1d97.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/86000000/85650000/85642000/85641906/d72ef1ec.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/86000000/85650000/85642000/85641906/dd1a1da6.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/86000000/85650000/85642000/85641906/dddfe4f9.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/86000000/85650000/85642000/85641906/e2ad16d5.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/86000000/85650000/85642000/85641906/e6cf8ea5.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/86000000/85650000/85642000/85641906/e9b9e9f0.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/86000000/85650000/85642000/85641906/f2c7bd38.jpg?impolicy=resizecrop&rw=1200&ra=fit",
    "https://media.vrbo.com/lodging/86000000/85650000/85642000/85641906/f63a5acf.jpg?impolicy=resizecrop&rw=1200&ra=fit",
]

result = {
    "propertyId": "adobe-compound-gc",
    "propertyName": "Adobe Compound @ Golf Course",
    "vrboId": "3005111",
    "vrboUrl": "https://www.vrbo.com/3005111",
    "galleryUrl": "https://www.vrbo.com/3005111?pwaThumbnailDialog=thumbnail-gallery",
    "images": images,
    "count": len(images),
    "scrapedAt": datetime.now().isoformat()
}

output_file = OUTPUT_DIR / "adobe-compound-gc.json"
with open(output_file, 'w') as f:
    json.dump(result, f, indent=2)

print(f"Saved {len(images)} images to {output_file}")
