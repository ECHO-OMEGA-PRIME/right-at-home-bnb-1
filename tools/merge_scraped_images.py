#!/usr/bin/env python3
"""
Merge all scraped VRBO images into ALL_PROPERTIES.json and create database seed data.
This script reads individual property JSON files and consolidates them.
"""
import json
from datetime import datetime
from pathlib import Path

VRBO_IMAGES_DIR = Path(__file__).parent / "vrbo_images"

def load_property_json(filepath: Path) -> dict | None:
    """Load a property JSON file."""
    try:
        with open(filepath, 'r') as f:
            return json.load(f)
    except Exception as e:
        print(f"Error loading {filepath}: {e}")
        return None

def main():
    print("=" * 60)
    print("Right At Home BnB - Image Merger")
    print("=" * 60)

    # Find all individual property JSON files (exclude ALL_PROPERTIES.json)
    json_files = [f for f in VRBO_IMAGES_DIR.glob("*.json")
                  if f.name != "ALL_PROPERTIES.json"]

    print(f"\nFound {len(json_files)} property JSON files")

    # Build merged properties dictionary
    all_properties = {}
    total_images = 0

    for json_file in sorted(json_files):
        data = load_property_json(json_file)
        if not data:
            continue

        prop_id = data.get("propertyId", json_file.stem)
        images = data.get("images", [])
        count = len(images)

        all_properties[prop_id] = {
            "propertyId": prop_id,
            "propertyName": data.get("propertyName", "Unknown"),
            "vrboId": data.get("vrboId", ""),
            "vrboUrl": data.get("vrboUrl", ""),
            "galleryUrl": data.get("galleryUrl", ""),
            "images": images,
            "count": count,
            "scrapedAt": data.get("scrapedAt", datetime.now().isoformat())
        }

        total_images += count
        status = "OK" if count > 0 else "SKIPPED"
        print(f"  [{status}] {prop_id}: {count} images")

    # Save merged ALL_PROPERTIES.json
    output_file = VRBO_IMAGES_DIR / "ALL_PROPERTIES.json"
    with open(output_file, 'w') as f:
        json.dump(all_properties, f, indent=2)

    print(f"\n{'=' * 60}")
    print(f"MERGED RESULTS")
    print(f"{'=' * 60}")
    print(f"Properties processed: {len(all_properties)}")
    print(f"Total images: {total_images}")
    print(f"Output: {output_file}")

    # Create seed data for Prisma
    seed_data = create_prisma_seed_data(all_properties)
    seed_file = VRBO_IMAGES_DIR.parent / "prisma_photo_seed.json"
    with open(seed_file, 'w') as f:
        json.dump(seed_data, f, indent=2)
    print(f"Prisma seed data: {seed_file}")

    # Create summary report
    report = create_summary_report(all_properties)
    report_file = VRBO_IMAGES_DIR.parent / "IMAGE_SCRAPE_REPORT.md"
    with open(report_file, 'w') as f:
        f.write(report)
    print(f"Summary report: {report_file}")

    print(f"\n{'=' * 60}")
    print("COMPLETE!")
    print(f"{'=' * 60}")

    return all_properties

def create_prisma_seed_data(properties: dict) -> dict:
    """Create seed data structure for Prisma database import."""
    seed_data = {
        "generatedAt": datetime.now().isoformat(),
        "totalProperties": len(properties),
        "totalPhotos": sum(p.get("count", 0) for p in properties.values()),
        "properties": []
    }

    for prop_id, prop_data in properties.items():
        if not prop_data.get("images"):
            continue

        property_entry = {
            "vrboId": prop_data.get("vrboId", ""),
            "propertyName": prop_data.get("propertyName", ""),
            "photos": []
        }

        for idx, url in enumerate(prop_data.get("images", [])):
            property_entry["photos"].append({
                "url": url,
                "sortOrder": idx,
                "isPrimary": idx == 0,
                "caption": f"Photo {idx + 1}"
            })

        seed_data["properties"].append(property_entry)

    return seed_data

def create_summary_report(properties: dict) -> str:
    """Create a markdown summary report."""
    total_images = sum(p.get("count", 0) for p in properties.values())

    report = f"""# Right At Home BnB - VRBO Image Scrape Report

**Generated:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
**Total Properties:** {len(properties)}
**Total Images:** {total_images}

## Property Summary

| Property | VRBO ID | Images | Status |
|----------|---------|--------|--------|
"""

    for prop_id, prop_data in sorted(properties.items()):
        vrbo_id = prop_data.get("vrboId", "N/A")
        count = prop_data.get("count", 0)
        status = "OK" if count > 0 else "SKIPPED"
        name = prop_data.get("propertyName", "Unknown")[:40]
        report += f"| {name} | {vrbo_id} | {count} | {status} |\n"

    report += f"""
## Files Generated

1. `vrbo_images/ALL_PROPERTIES.json` - Merged property data with all images
2. `prisma_photo_seed.json` - Database seed data for Prisma
3. `IMAGE_SCRAPE_REPORT.md` - This report

## Next Steps

1. Run `pnpm prisma:seed` to import photos into database
2. Or use the API to bulk import photos
3. Verify images display correctly in the app

---
*Scraped with Playwright Browser Automation*
*ECHO OMEGA PRIME | Authority 11.0*
"""

    return report

if __name__ == "__main__":
    main()
