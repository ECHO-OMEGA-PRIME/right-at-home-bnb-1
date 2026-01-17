#!/usr/bin/env python3
"""
VRBO Image Scraper for Right at Home BnB
Scrapes property images from VRBO and uploads to Firebase Storage

Author: ECHO OMEGA PRIME
Usage: python vrbo_image_scraper.py [--property PROPERTY_ID] [--all] [--interactive]
"""

import asyncio
import json
import re
import sys
import os
from pathlib import Path
from datetime import datetime
from typing import Optional
from dataclasses import dataclass, field
from urllib.parse import urljoin, urlparse

# Add project paths
sys.path.insert(0, str(Path(__file__).parent.parent / "apps" / "web"))

try:
    from playwright.async_api import async_playwright, Page, Browser
    PLAYWRIGHT_AVAILABLE = True
except ImportError:
    PLAYWRIGHT_AVAILABLE = False
    print("⚠️  Playwright not installed. Run: pip install playwright && playwright install chromium")

try:
    import httpx
    HTTPX_AVAILABLE = True
except ImportError:
    HTTPX_AVAILABLE = False
    print("⚠️  httpx not installed. Run: pip install httpx")

try:
    import firebase_admin
    from firebase_admin import credentials, storage, firestore
    FIREBASE_AVAILABLE = True
except ImportError:
    FIREBASE_AVAILABLE = False
    print("⚠️  Firebase Admin SDK not installed. Run: pip install firebase-admin")


@dataclass
class PropertyConfig:
    """Property configuration with VRBO mapping"""
    property_id: str
    property_name: str
    vrbo_id: str
    vrbo_url: str


@dataclass
class ScrapedImage:
    """Scraped image data"""
    url: str
    alt: str = ""
    index: int = 0
    is_primary: bool = False
    local_path: Optional[str] = None
    firebase_url: Optional[str] = None


# All Right at Home properties with VRBO IDs
PROPERTIES: list[PropertyConfig] = [
    PropertyConfig("castleford-5001", "Oasis with Pool-Billiards", "2636389", "https://www.vrbo.com/2636389"),
    PropertyConfig("adobe-compound-gc", "Adobe Compound", "3005111", "https://www.vrbo.com/3005111"),
    PropertyConfig("garfield-2702", "Patio Home with Hot Tub", "2634718", "https://www.vrbo.com/2634718"),
    PropertyConfig("douglas-4501", "Old Midland Living", "3355618", "https://www.vrbo.com/3355618"),
    PropertyConfig("dentcrest-4707", "Hot Tub Delight", "2638481", "https://www.vrbo.com/2638481"),
    PropertyConfig("safari-gameroom", "Safari Gameroom", "2638524", "https://www.vrbo.com/2638524"),
    PropertyConfig("storey-2103", "Destination Getaway", "2643822", "https://www.vrbo.com/2643822"),
    PropertyConfig("chelsea-3210", "Retreat with Covered Patio", "2643784", "https://www.vrbo.com/2643784"),
    PropertyConfig("oriole-6100", "Most Marvelous with Pool", "4471713", "https://www.vrbo.com/4471713"),
    PropertyConfig("lanham-1426", "Posh & Private with Billiards", "4437486", "https://www.vrbo.com/4437486"),
    PropertyConfig("humble-3106", "Outdoor Dream", "4700881", "https://www.vrbo.com/4700881"),
    PropertyConfig("daventry-1311", "Santiago Dreams", "4179271", "https://www.vrbo.com/4179271"),
    PropertyConfig("lincoln-green-5055", "Sprawling Ranch House with Pool Cabana", "4581977", "https://www.vrbo.com/4581977"),
    PropertyConfig("daventry-1309", "Saddle Club", "4750070", "https://www.vrbo.com/4750070"),
    PropertyConfig("monterrey-house", "Monterrey House", "3477668", "https://www.vrbo.com/3477668"),
]


class VRBOImageScraper:
    """Scrapes images from VRBO listings"""

    def __init__(self, download_dir: Optional[Path] = None):
        self.download_dir = download_dir or Path(__file__).parent / "scraped_images"
        self.download_dir.mkdir(parents=True, exist_ok=True)
        self.browser: Optional[Browser] = None
        self.page: Optional[Page] = None

    async def start_browser(self, headless: bool = False):
        """Start Playwright browser"""
        if not PLAYWRIGHT_AVAILABLE:
            raise RuntimeError("Playwright not available")

        self.playwright = await async_playwright().start()
        self.browser = await self.playwright.chromium.launch(
            headless=headless,
            args=[
                '--disable-blink-features=AutomationControlled',
                '--no-sandbox',
            ]
        )
        self.context = await self.browser.new_context(
            viewport={'width': 1920, 'height': 1080},
            user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        )
        self.page = await self.context.new_page()

    async def close_browser(self):
        """Close browser"""
        if self.browser:
            await self.browser.close()
        if hasattr(self, 'playwright'):
            await self.playwright.stop()

    async def navigate_to_property(self, prop: PropertyConfig) -> bool:
        """Navigate to VRBO property page"""
        if not self.page:
            raise RuntimeError("Browser not started")

        print(f"\n🏠 Navigating to: {prop.property_name}")
        print(f"   URL: {prop.vrbo_url}")

        try:
            await self.page.goto(prop.vrbo_url, wait_until='networkidle', timeout=30000)
            await asyncio.sleep(2)  # Wait for images to load
            return True
        except Exception as e:
            print(f"   ❌ Navigation failed: {e}")
            return False

    async def scrape_images(self, prop: PropertyConfig) -> list[ScrapedImage]:
        """Scrape all images from current VRBO page"""
        if not self.page:
            return []

        images: list[ScrapedImage] = []

        # Try to click "See all photos" button if available
        try:
            see_all_btn = self.page.locator('button:has-text("See all"), button:has-text("photos"), [data-stid="open-gallery"]')
            if await see_all_btn.count() > 0:
                await see_all_btn.first.click()
                await asyncio.sleep(2)
        except Exception:
            pass

        # Extract image URLs from various sources
        image_urls = set()

        # Method 1: Find img elements with high-res sources
        img_elements = await self.page.query_selector_all('img[src*="images.trvl-media.com"], img[src*="lodging"], picture img')
        for img in img_elements:
            src = await img.get_attribute('src')
            srcset = await img.get_attribute('srcset')
            alt = await img.get_attribute('alt') or ""

            if src and 'images.trvl-media.com' in src:
                # Get highest resolution version
                high_res_url = self._get_high_res_url(src)
                image_urls.add((high_res_url, alt))

            if srcset:
                # Parse srcset for highest resolution
                for part in srcset.split(','):
                    url_part = part.strip().split(' ')[0]
                    if 'images.trvl-media.com' in url_part:
                        high_res_url = self._get_high_res_url(url_part)
                        image_urls.add((high_res_url, alt))

        # Method 2: Find background images in styles
        elements_with_bg = await self.page.query_selector_all('[style*="background-image"]')
        for elem in elements_with_bg:
            style = await elem.get_attribute('style')
            if style:
                urls = re.findall(r'url\(["\']?(https://images\.trvl-media\.com[^"\')\s]+)["\']?\)', style)
                for url in urls:
                    high_res_url = self._get_high_res_url(url)
                    image_urls.add((high_res_url, ""))

        # Method 3: Check for gallery data in page JSON
        try:
            scripts = await self.page.query_selector_all('script[type="application/json"]')
            for script in scripts:
                content = await script.text_content()
                if content and 'trvl-media.com' in content:
                    urls = re.findall(r'https://images\.trvl-media\.com[^"\'}\s]+', content)
                    for url in urls:
                        high_res_url = self._get_high_res_url(url.rstrip('\\'))
                        image_urls.add((high_res_url, ""))
        except Exception:
            pass

        # Convert to ScrapedImage objects
        for i, (url, alt) in enumerate(sorted(image_urls)):
            images.append(ScrapedImage(
                url=url,
                alt=alt or f"{prop.property_name} - Image {i+1}",
                index=i,
                is_primary=(i == 0)
            ))

        print(f"   📸 Found {len(images)} images")
        return images

    def _get_high_res_url(self, url: str) -> str:
        """Convert VRBO image URL to highest resolution version"""
        # Remove size parameters and get full resolution
        url = re.sub(r'\?.*$', '', url)  # Remove query params
        url = re.sub(r'_[a-z]\.', '_z.', url)  # Replace size indicator with 'z' (largest)

        # Ensure we're using the full size
        if 'lodging' in url and not url.endswith('.jpg'):
            url = url + '/0/images/00.jpg'

        return url

    async def download_image(self, image: ScrapedImage, prop: PropertyConfig) -> Optional[Path]:
        """Download image to local storage"""
        if not HTTPX_AVAILABLE:
            print("   ⚠️  httpx not available for download")
            return None

        prop_dir = self.download_dir / prop.property_id
        prop_dir.mkdir(parents=True, exist_ok=True)

        # Generate filename
        ext = Path(urlparse(image.url).path).suffix or '.jpg'
        filename = f"{prop.property_id}_{image.index:02d}{ext}"
        filepath = prop_dir / filename

        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(image.url, follow_redirects=True, timeout=30.0)
                response.raise_for_status()

                filepath.write_bytes(response.content)
                image.local_path = str(filepath)
                print(f"   ✅ Downloaded: {filename}")
                return filepath
        except Exception as e:
            print(f"   ❌ Download failed: {e}")
            return None


class FirebaseUploader:
    """Uploads images to Firebase Storage and updates Firestore"""

    def __init__(self, project_id: str = "echo-prime-ai"):
        self.project_id = project_id
        self.bucket_name = f"{project_id}.appspot.com"
        self._initialized = False

    def initialize(self, credentials_path: Optional[str] = None):
        """Initialize Firebase Admin SDK"""
        if not FIREBASE_AVAILABLE:
            raise RuntimeError("Firebase Admin SDK not available")

        if self._initialized:
            return

        try:
            # Try to use default credentials or service account
            if credentials_path and Path(credentials_path).exists():
                cred = credentials.Certificate(credentials_path)
            else:
                # Use Application Default Credentials
                cred = credentials.ApplicationDefault()

            firebase_admin.initialize_app(cred, {
                'storageBucket': self.bucket_name
            })
            self._initialized = True
            print(f"✅ Firebase initialized for project: {self.project_id}")
        except Exception as e:
            print(f"❌ Firebase initialization failed: {e}")
            raise

    async def upload_image(self, image: ScrapedImage, prop: PropertyConfig) -> Optional[str]:
        """Upload image to Firebase Storage"""
        if not image.local_path or not Path(image.local_path).exists():
            return None

        try:
            bucket = storage.bucket()
            blob_name = f"properties/{prop.property_id}/images/{Path(image.local_path).name}"
            blob = bucket.blob(blob_name)

            blob.upload_from_filename(image.local_path, content_type='image/jpeg')
            blob.make_public()

            image.firebase_url = blob.public_url
            print(f"   ☁️  Uploaded: {blob_name}")
            return image.firebase_url
        except Exception as e:
            print(f"   ❌ Upload failed: {e}")
            return None

    def update_firestore(self, prop: PropertyConfig, images: list[ScrapedImage]):
        """Update Firestore property document with new images"""
        if not self._initialized:
            return

        try:
            db = firestore.client()

            # Prepare image data
            image_data = []
            for img in images:
                if img.firebase_url:
                    image_data.append({
                        'id': f"{prop.property_id}-{img.index}",
                        'url': img.firebase_url,
                        'alt': img.alt,
                        'isPrimary': img.is_primary,
                        'source': 'vrbo',
                        'scrapedAt': datetime.now().isoformat()
                    })

            # Update property document
            doc_ref = db.collection('properties').document(prop.property_id)
            doc_ref.set({
                'images': image_data,
                'coverImage': image_data[0]['url'] if image_data else None,
                'imagesUpdatedAt': firestore.SERVER_TIMESTAMP
            }, merge=True)

            print(f"   📝 Firestore updated with {len(image_data)} images")
        except Exception as e:
            print(f"   ❌ Firestore update failed: {e}")


async def interactive_mode(scraper: VRBOImageScraper, uploader: Optional[FirebaseUploader] = None):
    """Interactive mode - browse properties and select images"""

    print("\n" + "="*60)
    print("🏠 VRBO Image Scraper - Interactive Mode")
    print("="*60)

    while True:
        print("\n📋 Available Properties:")
        print("-" * 40)
        for i, prop in enumerate(PROPERTIES, 1):
            print(f"  {i:2}. {prop.property_name} (VRBO #{prop.vrbo_id})")
        print(f"  {len(PROPERTIES)+1}. 🔄 Scrape ALL properties")
        print(f"  {len(PROPERTIES)+2}. ❌ Exit")

        try:
            choice = input("\nSelect property (number): ").strip()
            choice_num = int(choice)

            if choice_num == len(PROPERTIES) + 2:
                print("\n👋 Goodbye!")
                break
            elif choice_num == len(PROPERTIES) + 1:
                # Scrape all
                for prop in PROPERTIES:
                    await process_property(scraper, prop, uploader)
            elif 1 <= choice_num <= len(PROPERTIES):
                prop = PROPERTIES[choice_num - 1]
                await process_property(scraper, prop, uploader, interactive=True)
            else:
                print("❌ Invalid selection")
        except ValueError:
            print("❌ Please enter a number")
        except KeyboardInterrupt:
            print("\n\n👋 Interrupted. Goodbye!")
            break


async def process_property(
    scraper: VRBOImageScraper,
    prop: PropertyConfig,
    uploader: Optional[FirebaseUploader] = None,
    interactive: bool = False
):
    """Process a single property"""

    # Navigate to property
    if not await scraper.navigate_to_property(prop):
        return

    # Scrape images
    images = await scraper.scrape_images(prop)

    if not images:
        print("   ⚠️  No images found")
        return

    # In interactive mode, show images and ask for confirmation
    if interactive:
        print(f"\n   Found {len(images)} images:")
        for i, img in enumerate(images[:10]):  # Show first 10
            print(f"   {i+1}. {img.url[:80]}...")
        if len(images) > 10:
            print(f"   ... and {len(images) - 10} more")

        confirm = input("\n   Download these images? (y/n): ").strip().lower()
        if confirm != 'y':
            print("   ⏭️  Skipped")
            return

    # Download images
    print(f"\n   📥 Downloading {len(images)} images...")
    for img in images:
        await scraper.download_image(img, prop)

    # Upload to Firebase if available
    if uploader:
        print(f"\n   ☁️  Uploading to Firebase...")
        for img in images:
            if img.local_path:
                await uploader.upload_image(img, prop)

        # Update Firestore
        uploader.update_firestore(prop, images)

    print(f"\n   ✅ Done processing {prop.property_name}")


async def main():
    """Main entry point"""
    import argparse

    parser = argparse.ArgumentParser(description='VRBO Image Scraper for Right at Home BnB')
    parser.add_argument('--property', '-p', help='Specific property ID to scrape')
    parser.add_argument('--all', '-a', action='store_true', help='Scrape all properties')
    parser.add_argument('--interactive', '-i', action='store_true', help='Interactive mode')
    parser.add_argument('--headless', action='store_true', help='Run browser in headless mode')
    parser.add_argument('--no-upload', action='store_true', help='Skip Firebase upload')
    parser.add_argument('--list', '-l', action='store_true', help='List all properties')

    args = parser.parse_args()

    # List properties
    if args.list:
        print("\n📋 Right at Home BnB Properties with VRBO IDs:\n")
        for prop in PROPERTIES:
            print(f"  • {prop.property_id}")
            print(f"    Name: {prop.property_name}")
            print(f"    VRBO: {prop.vrbo_url}")
            print()
        return

    # Check requirements
    if not PLAYWRIGHT_AVAILABLE:
        print("\n❌ Playwright is required. Install with:")
        print("   pip install playwright")
        print("   playwright install chromium")
        return

    # Initialize scraper
    scraper = VRBOImageScraper()

    # Initialize uploader if not disabled
    uploader = None
    if not args.no_upload and FIREBASE_AVAILABLE:
        try:
            uploader = FirebaseUploader()
            # Try default credentials
            uploader.initialize()
        except Exception as e:
            print(f"⚠️  Firebase not configured: {e}")
            print("   Continuing without upload capability")
            uploader = None

    # Start browser
    print("\n🚀 Starting browser...")
    await scraper.start_browser(headless=args.headless)

    try:
        if args.interactive or (not args.property and not args.all):
            # Interactive mode
            await interactive_mode(scraper, uploader)
        elif args.all:
            # Process all properties
            for prop in PROPERTIES:
                await process_property(scraper, prop, uploader)
        elif args.property:
            # Find and process specific property
            prop = next((p for p in PROPERTIES if p.property_id == args.property), None)
            if prop:
                await process_property(scraper, prop, uploader)
            else:
                print(f"❌ Property not found: {args.property}")
                print("   Use --list to see available properties")
    finally:
        await scraper.close_browser()

    print("\n✅ All done!")


if __name__ == '__main__':
    asyncio.run(main())
