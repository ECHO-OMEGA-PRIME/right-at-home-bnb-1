#!/usr/bin/env python3
"""
Generate app icons and splash screens for Right At Home BnB mobile app
Uses cairosvg for SVG to PNG conversion
"""
import os
import subprocess
from pathlib import Path

# Paths
ASSETS_DIR = Path(__file__).parent / "assets"
SOURCE_SVG = Path(__file__).parent.parent.parent / "assets" / "icon-rah.svg"

def create_icon_png(output_path: Path, size: int = 1024):
    """Create app icon PNG from SVG using cairosvg"""
    try:
        import cairosvg
        cairosvg.svg2png(
            url=str(SOURCE_SVG),
            write_to=str(output_path),
            output_width=size,
            output_height=size
        )
        print(f"Created: {output_path} ({size}x{size})")
        return True
    except ImportError:
        # Fallback: try using Inkscape or ImageMagick
        try:
            subprocess.run([
                "magick", "convert", "-background", "none",
                "-resize", f"{size}x{size}",
                str(SOURCE_SVG), str(output_path)
            ], check=True)
            print(f"Created (magick): {output_path} ({size}x{size})")
            return True
        except Exception as e:
            print(f"ImageMagick fallback failed: {e}")
            return False

def create_splash_png(output_path: Path, width: int = 1284, height: int = 2778):
    """Create splash screen PNG"""
    try:
        from PIL import Image, ImageDraw, ImageFont

        # Create maroon gradient background
        img = Image.new('RGB', (width, height), '#500000')
        draw = ImageDraw.Draw(img)

        # Draw gradient effect
        for y in range(height):
            ratio = y / height
            r = int(80 + (50 - 80) * ratio)  # From #500000 to #320000
            g = 0
            b = 0
            draw.line([(0, y), (width, y)], fill=(r, g, b))

        # Load and paste icon in center
        icon_path = ASSETS_DIR / "icon.png"
        if icon_path.exists():
            icon = Image.open(icon_path)
            icon_size = min(width, height) // 3  # Icon takes 1/3 of smaller dimension
            icon = icon.resize((icon_size, icon_size), Image.Resampling.LANCZOS)
            x = (width - icon_size) // 2
            y = (height - icon_size) // 2 - 100  # Slightly above center
            img.paste(icon, (x, y), icon if icon.mode == 'RGBA' else None)

        # Add "Right at Home" text below icon
        try:
            font = ImageFont.truetype("arial.ttf", 72)
        except:
            font = ImageFont.load_default()

        text = "Right at Home"
        bbox = draw.textbbox((0, 0), text, font=font)
        text_width = bbox[2] - bbox[0]
        text_x = (width - text_width) // 2
        text_y = height // 2 + 200
        draw.text((text_x, text_y), text, fill="white", font=font)

        img.save(output_path, "PNG")
        print(f"Created: {output_path} ({width}x{height})")
        return True
    except ImportError as e:
        print(f"PIL not available: {e}")
        return False

def create_notification_icon(output_path: Path, size: int = 96):
    """Create notification icon (white on transparent)"""
    try:
        from PIL import Image, ImageDraw, ImageFont

        # Create transparent image
        img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
        draw = ImageDraw.Draw(img)

        # Draw white circle background
        padding = size // 10
        draw.ellipse([padding, padding, size-padding, size-padding], fill='white')

        # Draw RAH text
        try:
            font_size = size // 3
            font = ImageFont.truetype("arial.ttf", font_size)
        except:
            font = ImageFont.load_default()

        text = "RAH"
        bbox = draw.textbbox((0, 0), text, font=font)
        text_width = bbox[2] - bbox[0]
        text_height = bbox[3] - bbox[1]
        text_x = (size - text_width) // 2
        text_y = (size - text_height) // 2
        draw.text((text_x, text_y), text, fill='#500000', font=font)

        img.save(output_path, "PNG")
        print(f"Created: {output_path} ({size}x{size})")
        return True
    except ImportError as e:
        print(f"PIL not available: {e}")
        return False

def create_silent_wav(output_path: Path):
    """Create a simple notification sound (silent for now)"""
    try:
        import wave
        import struct

        # Create a short silent WAV file
        sample_rate = 44100
        duration = 0.1  # 100ms
        num_samples = int(sample_rate * duration)

        with wave.open(str(output_path), 'w') as wav_file:
            wav_file.setnchannels(1)  # Mono
            wav_file.setsampwidth(2)  # 16-bit
            wav_file.setframerate(sample_rate)

            # Write silent samples
            for _ in range(num_samples):
                wav_file.writeframes(struct.pack('<h', 0))

        print(f"Created: {output_path}")
        return True
    except Exception as e:
        print(f"Failed to create WAV: {e}")
        return False

def main():
    print("Generating app assets for Right At Home BnB...")
    print(f"Source SVG: {SOURCE_SVG}")
    print(f"Assets directory: {ASSETS_DIR}")

    # Ensure assets directory exists
    ASSETS_DIR.mkdir(parents=True, exist_ok=True)
    (ASSETS_DIR / "sounds").mkdir(exist_ok=True)

    # Check source SVG exists
    if not SOURCE_SVG.exists():
        print(f"ERROR: Source SVG not found: {SOURCE_SVG}")
        return False

    success = True

    # Create app icon (1024x1024 for iOS)
    if not create_icon_png(ASSETS_DIR / "icon.png", 1024):
        success = False

    # Create adaptive icon for Android (1024x1024)
    if not create_icon_png(ASSETS_DIR / "adaptive-icon.png", 1024):
        success = False

    # Create splash screen
    if not create_splash_png(ASSETS_DIR / "splash.png", 1284, 2778):
        success = False

    # Create notification icon
    if not create_notification_icon(ASSETS_DIR / "notification-icon.png", 96):
        success = False

    # Create notification sound
    if not create_silent_wav(ASSETS_DIR / "sounds" / "notification.wav"):
        success = False

    if success:
        print("\n✅ All assets generated successfully!")
    else:
        print("\n⚠️ Some assets may not have been generated")

    return success

if __name__ == "__main__":
    main()
