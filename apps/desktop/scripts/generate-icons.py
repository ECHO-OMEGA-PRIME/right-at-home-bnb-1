#!/usr/bin/env python3
"""
Right at Home BnB - Icon Generator (Python version)
Generates all required icon formats from PNG/Pillow without external dependencies

Run: python scripts/generate-icons.py

@author ECHO OMEGA PRIME
"""

import os
import sys
import struct
from pathlib import Path

# Try to import Pillow
try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError:
    print("Installing Pillow...")
    import subprocess
    subprocess.run([sys.executable, "-m", "pip", "install", "pillow"], check=True)
    from PIL import Image, ImageDraw, ImageFont

# Configuration
SCRIPT_DIR = Path(__file__).parent
ASSETS_DIR = SCRIPT_DIR.parent / "assets"
ICONS_DIR = ASSETS_DIR / "icons"
SVG_PATH = ICONS_DIR / "icon.svg"

# Icon sizes for different platforms
ICON_SIZES = {
    "png": [16, 24, 32, 48, 64, 96, 128, 256, 512, 1024],
    "ico": [16, 24, 32, 48, 64, 128, 256],
    "icns": [16, 32, 64, 128, 256, 512, 1024],
    "tray": [16, 18, 20, 22, 24, 32],
    "linux": [16, 24, 32, 48, 64, 96, 128, 256, 512],
}

# Brand colors
BRAND = {
    "maroon": "#500000",
    "maroonLight": "#722F37",
    "maroonDark": "#3D0000",
    "white": "#FFFFFF",
    "cream": "#F5F5F0",
}


def hex_to_rgb(hex_color: str) -> tuple:
    """Convert hex color to RGB tuple"""
    hex_color = hex_color.lstrip('#')
    return tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))


def create_base_icon(size: int) -> Image.Image:
    """Create base icon image using Pillow (no SVG dependency)"""
    # Create RGBA image with transparent background
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Colors
    maroon = hex_to_rgb(BRAND["maroon"])
    maroon_light = hex_to_rgb(BRAND["maroonLight"])
    white = hex_to_rgb(BRAND["white"])

    # Draw rounded rectangle background with gradient effect
    corner_radius = int(size * 0.195)  # ~100/512

    # Main background (maroon)
    draw.rounded_rectangle(
        [(0, 0), (size - 1, size - 1)],
        radius=corner_radius,
        fill=maroon + (255,)
    )

    # Add slight gradient effect (lighter top-left)
    for i in range(min(size // 4, 50)):
        alpha = int(30 * (1 - i / min(size // 4, 50)))
        draw.rounded_rectangle(
            [(i, i), (size - 1 - i, size - 1 - i)],
            radius=max(corner_radius - i, 0),
            fill=None,
            outline=maroon_light + (alpha,)
        )

    # Draw "RAH" text
    text = "RAH"
    # Calculate font size based on image size
    font_size = int(size * 0.35)  # ~180/512

    # Try to use Impact font, fall back to default
    try:
        font = ImageFont.truetype("impact.ttf", font_size)
    except (OSError, IOError):
        try:
            font = ImageFont.truetype("Impact", font_size)
        except (OSError, IOError):
            try:
                font = ImageFont.truetype("arial.ttf", font_size)
            except (OSError, IOError):
                font = ImageFont.load_default()

    # Get text bounding box
    bbox = draw.textbbox((0, 0), text, font=font)
    text_width = bbox[2] - bbox[0]
    text_height = bbox[3] - bbox[1]

    # Center text position (slightly above center)
    x = (size - text_width) // 2
    y = int(size * 0.35) - bbox[1]  # Adjusted for better centering

    # Draw text shadow
    shadow_offset = max(1, size // 128)
    draw.text((x + shadow_offset, y + shadow_offset), text, font=font, fill=(0, 0, 0, 100))

    # Draw main text
    draw.text((x, y), text, font=font, fill=white + (255,))

    # Draw swoosh underline
    swoosh_y = int(size * 0.7)
    swoosh_x1 = int(size * 0.156)  # ~80/512
    swoosh_x2 = int(size * 0.844)  # ~432/512
    swoosh_height = int(size * 0.117)  # curve height
    line_width = max(1, int(size * 0.023))  # ~12/512

    # Simple curved line approximation using arc
    points = []
    import math
    for i in range(100):
        t = i / 99
        x_pos = swoosh_x1 + t * (swoosh_x2 - swoosh_x1)
        # Parabolic curve
        curve = swoosh_height * 4 * t * (1 - t)
        y_pos = swoosh_y + curve
        points.append((x_pos, y_pos))

    # Draw the swoosh line
    for i in range(len(points) - 1):
        draw.line([points[i], points[i + 1]], fill=white + (230,), width=line_width)

    return img


def create_tray_icon(size: int) -> Image.Image:
    """Create tray icon (simpler, just 'R')"""
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    maroon = hex_to_rgb(BRAND["maroon"])
    white = hex_to_rgb(BRAND["white"])

    # Rounded rectangle background
    corner_radius = max(1, int(size * 0.167))
    draw.rounded_rectangle(
        [(0, 0), (size - 1, size - 1)],
        radius=corner_radius,
        fill=maroon + (255,)
    )

    # Draw "R"
    font_size = int(size * 0.6)
    try:
        font = ImageFont.truetype("impact.ttf", font_size)
    except (OSError, IOError):
        try:
            font = ImageFont.truetype("arial.ttf", font_size)
        except (OSError, IOError):
            font = ImageFont.load_default()

    text = "R"
    bbox = draw.textbbox((0, 0), text, font=font)
    text_width = bbox[2] - bbox[0]
    text_height = bbox[3] - bbox[1]
    x = (size - text_width) // 2
    y = (size - text_height) // 2 - bbox[1]

    draw.text((x, y), text, font=font, fill=white + (255,))

    return img


def ensure_directories():
    """Ensure all required directories exist"""
    dirs = [
        ASSETS_DIR,
        ICONS_DIR,
        ICONS_DIR / "png",
        ICONS_DIR / "win",
        ICONS_DIR / "mac",
        ICONS_DIR / "mac" / "icon.iconset",
        ICONS_DIR / "linux",
        ICONS_DIR / "tray",
    ]

    for d in dirs:
        d.mkdir(parents=True, exist_ok=True)
        print(f"  [OK] {d.relative_to(ASSETS_DIR)}")


def create_ico(images: list, output_path: Path):
    """Create ICO file from list of PIL Images"""
    # ICO file format
    header_size = 6
    entry_size = 16
    num_images = len(images)

    data_offset = header_size + (entry_size * num_images)
    entries = []
    image_data = []

    for size, img_data in images:
        entries.append({
            "width": 0 if size >= 256 else size,
            "height": 0 if size >= 256 else size,
            "color_count": 0,
            "reserved": 0,
            "planes": 1,
            "bit_count": 32,
            "bytes_in_res": len(img_data),
            "image_offset": data_offset
        })
        image_data.append(img_data)
        data_offset += len(img_data)

    # Build ICO file
    ico_data = bytearray()

    # Header: reserved (2), type (2), count (2)
    ico_data.extend(struct.pack("<HHH", 0, 1, num_images))

    # Entries
    for entry in entries:
        ico_data.extend(struct.pack(
            "<BBBBHHII",
            entry["width"],
            entry["height"],
            entry["color_count"],
            entry["reserved"],
            entry["planes"],
            entry["bit_count"],
            entry["bytes_in_res"],
            entry["image_offset"]
        ))

    # Image data
    for img in image_data:
        ico_data.extend(img)

    with open(output_path, "wb") as f:
        f.write(ico_data)


def get_png_bytes(img: Image.Image) -> bytes:
    """Convert PIL Image to PNG bytes"""
    import io
    buffer = io.BytesIO()
    img.save(buffer, format='PNG')
    return buffer.getvalue()


def generate_icons():
    """Main icon generation function using pure Pillow (no SVG dependencies)"""
    print("=" * 50)
    print("Right at Home BnB - Icon Generator (Python/Pillow)")
    print("=" * 50)
    print()

    # Ensure directories
    print("Creating directories...")
    ensure_directories()

    try:
        # 1. Generate all PNG sizes
        print("\n--- Generating PNG Icons ---")
        for size in sorted(set(ICON_SIZES["png"])):
            output_path = ICONS_DIR / "png" / f"icon-{size}x{size}.png"
            icon = create_base_icon(size)
            icon.save(output_path, "PNG")
            print(f"  [OK] icon-{size}x{size}.png")

        # 2. Linux icons
        print("\n--- Generating Linux Icons ---")
        for size in ICON_SIZES["linux"]:
            output_path = ICONS_DIR / "linux" / f"{size}x{size}.png"
            icon = create_base_icon(size)
            icon.save(output_path, "PNG")
        print(f"  [OK] Generated {len(ICON_SIZES['linux'])} Linux icons")

        # 3. Windows ICO
        print("\n--- Generating Windows ICO ---")
        ico_images = []
        for size in ICON_SIZES["ico"]:
            icon = create_base_icon(size)
            png_data = get_png_bytes(icon)
            ico_images.append((size, png_data))

        create_ico(ico_images, ICONS_DIR / "icon.ico")
        create_ico(ico_images, ICONS_DIR / "win" / "icon.ico")
        print("  [OK] icon.ico")

        # 4. macOS Iconset
        print("\n--- Generating macOS Iconset ---")
        iconset_dir = ICONS_DIR / "mac" / "icon.iconset"
        mac_sizes = [
            (16, "icon_16x16.png"),
            (32, "icon_16x16@2x.png"),
            (32, "icon_32x32.png"),
            (64, "icon_32x32@2x.png"),
            (128, "icon_128x128.png"),
            (256, "icon_128x128@2x.png"),
            (256, "icon_256x256.png"),
            (512, "icon_256x256@2x.png"),
            (512, "icon_512x512.png"),
            (1024, "icon_512x512@2x.png"),
        ]

        for size, name in mac_sizes:
            output_path = iconset_dir / name
            icon = create_base_icon(size)
            icon.save(output_path, "PNG")
        print("  [OK] mac/icon.iconset/ (10 files)")
        print("  [INFO] Run on macOS: iconutil -c icns icon.iconset -o icon.icns")

        # 5. Tray icons
        print("\n--- Generating Tray Icons ---")
        tray_dir = ICONS_DIR / "tray"

        for size in ICON_SIZES["tray"]:
            # Regular tray icon
            tray_icon = create_tray_icon(size)
            output_path = tray_dir / f"tray-{size}.png"
            tray_icon.save(output_path, "PNG")

            # Template (grayscale) for macOS
            gray = tray_icon.convert("LA")
            template_path = tray_dir / f"trayTemplate-{size}.png"
            gray.save(template_path, "PNG")

        print(f"  [OK] Generated {len(ICON_SIZES['tray']) * 2} tray icons")

        # 6. Main asset icons
        print("\n--- Generating Main Asset Icons ---")

        icon_256 = create_base_icon(256)
        icon_256.save(ASSETS_DIR / "icon.png", "PNG")
        print("  [OK] icon.png (256x256)")

        icon_48 = create_base_icon(48)
        icon_48.save(ASSETS_DIR / "icon-small.png", "PNG")
        print("  [OK] icon-small.png (48x48)")

        icon_1024 = create_base_icon(1024)
        icon_1024.save(ASSETS_DIR / "icon-large.png", "PNG")
        print("  [OK] icon-large.png (1024x1024)")

        tray_16 = create_tray_icon(16)
        tray_16.save(ASSETS_DIR / "tray-icon.png", "PNG")
        print("  [OK] tray-icon.png (16x16)")

        tray_32 = create_tray_icon(32)
        tray_32.save(ASSETS_DIR / "tray-icon@2x.png", "PNG")
        print("  [OK] tray-icon@2x.png (32x32)")

        # Copy ICO to assets root
        import shutil
        shutil.copy(ICONS_DIR / "icon.ico", ASSETS_DIR / "icon.ico")
        print("  [OK] icon.ico (copied to assets root)")

        print("\n" + "=" * 50)
        print("Icon Generation Complete!")
        print("=" * 50)
        print("\nGenerated files summary:")
        print("  - assets/icon.png (main app icon)")
        print("  - assets/icon.ico (Windows)")
        print("  - assets/tray-icon.png (system tray)")
        print("  - assets/icons/png/ (all PNG sizes)")
        print("  - assets/icons/win/ (Windows icons)")
        print("  - assets/icons/mac/icon.iconset/ (macOS)")
        print("  - assets/icons/linux/ (Linux icons)")
        print("  - assets/icons/tray/ (tray icons)")
        print("\nNote: For macOS .icns, run iconutil on a Mac.")

    except Exception as e:
        print(f"\n[ERROR] Icon generation failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    generate_icons()
