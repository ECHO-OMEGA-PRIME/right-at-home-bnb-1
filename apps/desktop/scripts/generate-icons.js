/**
 * RightAtHome BnB Desktop - Icon Generation Script
 *
 * This script generates all required icon formats from the source SVG.
 * Run: node scripts/generate-icons.js
 *
 * Requirements:
 * - npm install sharp png-to-ico
 * - For .icns: use iconutil on macOS or electron-icon-maker
 */

const fs = require('fs');
const path = require('path');

// Try to load sharp for image processing
let sharp;
try {
  sharp = require('sharp');
} catch (e) {
  console.log('sharp not installed. Install with: npm install sharp');
  console.log('For now, creating placeholder PNG files...');
  sharp = null;
}

const ICONS_DIR = path.join(__dirname, '..', 'assets', 'icons');
const SVG_PATH = path.join(ICONS_DIR, 'icon.svg');

// Sizes needed for each platform
const ICON_SIZES = {
  // Windows ICO needs multiple sizes
  windows: [16, 24, 32, 48, 64, 128, 256],
  // macOS ICNS needs specific sizes
  mac: [16, 32, 64, 128, 256, 512, 1024],
  // Linux/tray icons
  linux: [16, 24, 32, 48, 64, 128, 256, 512],
  // Tray icon (small)
  tray: [16, 24, 32],
};

async function generateIcons() {
  console.log('Generating icons for RightAtHome BnB Desktop...\n');

  // Ensure icons directory exists
  if (!fs.existsSync(ICONS_DIR)) {
    fs.mkdirSync(ICONS_DIR, { recursive: true });
  }

  if (!sharp) {
    // Create placeholder files without sharp
    console.log('Creating placeholder icon references...');

    // For development, electron-builder can use the SVG directly
    // or you can manually create icons using online tools

    const instructions = `
# Icon Generation Instructions

Since sharp is not installed, please generate icons manually:

## Option 1: Use Online Tools
1. Go to https://realfavicongenerator.net/
2. Upload assets/icons/icon.svg
3. Download and extract the generated icons

## Option 2: Use Electron Icon Maker
npm install -g electron-icon-maker
electron-icon-maker --input=assets/icons/icon.svg --output=assets/icons

## Option 3: Install sharp and run this script again
npm install sharp png-to-ico
node scripts/generate-icons.js

## Required Files for electron-builder:
- assets/icons/icon.ico (Windows)
- assets/icons/icon.icns (macOS)
- assets/icons/icon.png (Linux, 512x512)
- assets/icons/tray-icon.png (16x16 or 24x24)
- assets/icons/tray-icon@2x.png (32x32 or 48x48 for Retina)
`;

    fs.writeFileSync(path.join(ICONS_DIR, 'ICON_INSTRUCTIONS.md'), instructions);
    console.log('Created ICON_INSTRUCTIONS.md with manual generation steps.');
    return;
  }

  try {
    const svgBuffer = fs.readFileSync(SVG_PATH);

    // Generate PNG at all sizes
    console.log('Generating PNG icons...');
    for (const size of [...new Set([...ICON_SIZES.windows, ...ICON_SIZES.mac, ...ICON_SIZES.linux])]) {
      const outputPath = path.join(ICONS_DIR, `icon-${size}.png`);
      await sharp(svgBuffer)
        .resize(size, size)
        .png()
        .toFile(outputPath);
      console.log(`  Created: icon-${size}.png`);
    }

    // Main icon.png (512x512 for Linux)
    await sharp(svgBuffer)
      .resize(512, 512)
      .png()
      .toFile(path.join(ICONS_DIR, 'icon.png'));
    console.log('  Created: icon.png (512x512)');

    // Tray icons
    console.log('\nGenerating tray icons...');
    await sharp(svgBuffer)
      .resize(16, 16)
      .png()
      .toFile(path.join(ICONS_DIR, 'tray-icon.png'));
    console.log('  Created: tray-icon.png (16x16)');

    await sharp(svgBuffer)
      .resize(32, 32)
      .png()
      .toFile(path.join(ICONS_DIR, 'tray-icon@2x.png'));
    console.log('  Created: tray-icon@2x.png (32x32)');

    // Windows ICO
    console.log('\nGenerating Windows ICO...');
    try {
      const pngToIco = require('png-to-ico');
      const pngBuffers = await Promise.all(
        ICON_SIZES.windows.map(size =>
          sharp(svgBuffer).resize(size, size).png().toBuffer()
        )
      );
      const icoBuffer = await pngToIco(pngBuffers);
      fs.writeFileSync(path.join(ICONS_DIR, 'icon.ico'), icoBuffer);
      console.log('  Created: icon.ico');
    } catch (e) {
      console.log('  Could not create ICO. Install png-to-ico: npm install png-to-ico');
    }

    // macOS ICNS instructions
    console.log('\n');
    console.log('For macOS ICNS, run on a Mac:');
    console.log('  1. Create iconset folder: mkdir icon.iconset');
    console.log('  2. Copy PNGs with correct names:');
    console.log('     - icon_16x16.png, icon_16x16@2x.png (32)');
    console.log('     - icon_32x32.png, icon_32x32@2x.png (64)');
    console.log('     - icon_128x128.png, icon_128x128@2x.png (256)');
    console.log('     - icon_256x256.png, icon_256x256@2x.png (512)');
    console.log('     - icon_512x512.png, icon_512x512@2x.png (1024)');
    console.log('  3. Run: iconutil -c icns icon.iconset -o icon.icns');

    console.log('\nIcon generation complete!');
  } catch (error) {
    console.error('Error generating icons:', error);
  }
}

generateIcons();
