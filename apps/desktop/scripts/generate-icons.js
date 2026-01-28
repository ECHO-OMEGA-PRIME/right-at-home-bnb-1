/**
 * Right at Home BnB Desktop - Complete Icon Generation Script
 * Generates ALL required icon formats from SVG for all platforms
 *
 * Run: npm install sharp && node scripts/generate-icons.js
 *
 * @author ECHO OMEGA PRIME
 */

const fs = require('fs');
const path = require('path');

// Configuration
const ASSETS_DIR = path.join(__dirname, '..', 'assets');
const ICONS_DIR = path.join(ASSETS_DIR, 'icons');
const SVG_PATH = path.join(ICONS_DIR, 'icon.svg');

// Icon sizes for different platforms
const ICON_SIZES = {
  // Standard PNG sizes for all platforms
  png: [16, 24, 32, 48, 64, 96, 128, 256, 512, 1024],
  // Windows ICO needs these sizes
  ico: [16, 24, 32, 48, 64, 128, 256],
  // macOS ICNS needs these sizes
  icns: [16, 32, 64, 128, 256, 512, 1024],
  // Tray icons (small)
  tray: [16, 18, 20, 22, 24, 32],
  // Linux icon sizes
  linux: [16, 24, 32, 48, 64, 96, 128, 256, 512],
};

// Brand colors
const BRAND = {
  maroon: '#500000',
  maroonLight: '#722F37',
  maroonDark: '#3D0000',
  white: '#FFFFFF',
  cream: '#F5F5F0',
};

/**
 * Create fallback SVG if source is missing
 */
function createFallbackSVG() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="maroonGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${BRAND.maroonLight}"/>
      <stop offset="50%" style="stop-color:${BRAND.maroon}"/>
      <stop offset="100%" style="stop-color:${BRAND.maroonDark}"/>
    </linearGradient>
    <filter id="textShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="4" dy="4" stdDeviation="4" flood-color="#000" flood-opacity="0.4"/>
    </filter>
  </defs>
  <rect width="512" height="512" fill="url(#maroonGrad)" rx="100"/>
  <text
    x="256"
    y="310"
    text-anchor="middle"
    font-family="Impact, Arial Black, Helvetica, sans-serif"
    font-size="180"
    font-weight="900"
    font-style="italic"
    fill="${BRAND.white}"
    filter="url(#textShadow)"
    letter-spacing="8"
  >RAH</text>
  <path
    d="M 80 360 Q 256 420 432 360"
    fill="none"
    stroke="${BRAND.white}"
    stroke-width="12"
    stroke-linecap="round"
    opacity="0.9"
  />
</svg>`;
}

/**
 * Create tray-specific SVG (simpler for small sizes)
 */
function createTraySVG() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
  <rect width="24" height="24" fill="${BRAND.maroon}" rx="4"/>
  <text
    x="12"
    y="17"
    text-anchor="middle"
    font-family="Impact, Arial Black, sans-serif"
    font-size="13"
    font-weight="900"
    fill="${BRAND.white}"
  >R</text>
</svg>`;
}

/**
 * Ensure all required directories exist
 */
function ensureDirectories() {
  const dirs = [
    ASSETS_DIR,
    ICONS_DIR,
    path.join(ICONS_DIR, 'png'),
    path.join(ICONS_DIR, 'win'),
    path.join(ICONS_DIR, 'mac'),
    path.join(ICONS_DIR, 'mac', 'icon.iconset'),
    path.join(ICONS_DIR, 'linux'),
    path.join(ICONS_DIR, 'tray'),
  ];

  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`  Created directory: ${path.relative(ASSETS_DIR, dir)}`);
    }
  });
}

/**
 * Create ICO file buffer from PNG buffers
 */
function createICO(images) {
  const headerSize = 6;
  const entrySize = 16;
  const numImages = images.length;

  let dataOffset = headerSize + (entrySize * numImages);
  const entries = [];
  const imageData = [];

  for (const { size, buffer } of images) {
    entries.push({
      width: size >= 256 ? 0 : size,
      height: size >= 256 ? 0 : size,
      colorCount: 0,
      reserved: 0,
      planes: 1,
      bitCount: 32,
      bytesInRes: buffer.length,
      imageOffset: dataOffset
    });

    imageData.push(buffer);
    dataOffset += buffer.length;
  }

  const icoBuffer = Buffer.alloc(dataOffset);
  let offset = 0;

  // ICO header
  icoBuffer.writeUInt16LE(0, offset); offset += 2;
  icoBuffer.writeUInt16LE(1, offset); offset += 2;
  icoBuffer.writeUInt16LE(numImages, offset); offset += 2;

  // Write entries
  for (const entry of entries) {
    icoBuffer.writeUInt8(entry.width, offset); offset += 1;
    icoBuffer.writeUInt8(entry.height, offset); offset += 1;
    icoBuffer.writeUInt8(entry.colorCount, offset); offset += 1;
    icoBuffer.writeUInt8(entry.reserved, offset); offset += 1;
    icoBuffer.writeUInt16LE(entry.planes, offset); offset += 2;
    icoBuffer.writeUInt16LE(entry.bitCount, offset); offset += 2;
    icoBuffer.writeUInt32LE(entry.bytesInRes, offset); offset += 4;
    icoBuffer.writeUInt32LE(entry.imageOffset, offset); offset += 4;
  }

  // Write image data
  for (const data of imageData) {
    data.copy(icoBuffer, offset);
    offset += data.length;
  }

  return icoBuffer;
}

/**
 * Main icon generation function
 */
async function generateIcons() {
  console.log('========================================');
  console.log('Right at Home BnB - Icon Generator');
  console.log('========================================\n');

  // Load sharp
  let sharp;
  try {
    sharp = require('sharp');
    console.log('[OK] Sharp library loaded\n');
  } catch (e) {
    console.error('[ERROR] Sharp not installed!');
    console.log('Run: npm install sharp');
    console.log('\nCreating instructions file instead...');

    ensureDirectories();

    const instructions = `# Icon Generation Instructions

Since sharp is not installed, generate icons manually:

## Quick Method (Online)
1. Visit https://realfavicongenerator.net/
2. Upload icon.svg
3. Download and extract icons

## Required Files
- icon.ico (Windows) - sizes: 16, 24, 32, 48, 64, 128, 256
- icon.icns (macOS) - sizes: 16, 32, 64, 128, 256, 512, 1024
- icon.png (Linux/general) - 512x512

## Install sharp and regenerate
\`\`\`bash
cd apps/desktop
npm install sharp
node scripts/generate-icons.js
\`\`\`
`;
    fs.writeFileSync(path.join(ICONS_DIR, 'GENERATE_ICONS.md'), instructions);
    return;
  }

  // Ensure directories
  console.log('Creating directories...');
  ensureDirectories();

  // Check/create SVG
  let svgBuffer;
  if (fs.existsSync(SVG_PATH)) {
    svgBuffer = fs.readFileSync(SVG_PATH);
    console.log('\n[OK] Using existing icon.svg');
  } else {
    console.log('\n[INFO] Creating new icon.svg...');
    const svgContent = createFallbackSVG();
    fs.writeFileSync(SVG_PATH, svgContent);
    svgBuffer = Buffer.from(svgContent);
  }

  try {
    // 1. Generate all PNG sizes
    console.log('\n--- Generating PNG Icons ---');
    const allSizes = [...new Set([...ICON_SIZES.png])].sort((a, b) => a - b);

    for (const size of allSizes) {
      await sharp(svgBuffer)
        .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png({ quality: 100, compressionLevel: 9 })
        .toFile(path.join(ICONS_DIR, 'png', `icon-${size}x${size}.png`));
      console.log(`  [OK] icon-${size}x${size}.png`);
    }

    // 2. Linux icons
    console.log('\n--- Generating Linux Icons ---');
    for (const size of ICON_SIZES.linux) {
      await sharp(svgBuffer)
        .resize(size, size)
        .png()
        .toFile(path.join(ICONS_DIR, 'linux', `${size}x${size}.png`));
    }
    console.log(`  [OK] Generated ${ICON_SIZES.linux.length} Linux icons`);

    // 3. Windows ICO
    console.log('\n--- Generating Windows ICO ---');
    const pngBuffers = [];
    for (const size of ICON_SIZES.ico) {
      const pngBuffer = await sharp(svgBuffer)
        .resize(size, size)
        .png()
        .toBuffer();
      pngBuffers.push({ size, buffer: pngBuffer });
    }

    const icoBuffer = createICO(pngBuffers);
    fs.writeFileSync(path.join(ICONS_DIR, 'icon.ico'), icoBuffer);
    fs.writeFileSync(path.join(ICONS_DIR, 'win', 'icon.ico'), icoBuffer);
    console.log('  [OK] icon.ico');

    // 4. macOS Iconset
    console.log('\n--- Generating macOS Iconset ---');
    const iconsetDir = path.join(ICONS_DIR, 'mac', 'icon.iconset');
    const macSizes = [
      { size: 16, name: 'icon_16x16.png' },
      { size: 32, name: 'icon_16x16@2x.png' },
      { size: 32, name: 'icon_32x32.png' },
      { size: 64, name: 'icon_32x32@2x.png' },
      { size: 128, name: 'icon_128x128.png' },
      { size: 256, name: 'icon_128x128@2x.png' },
      { size: 256, name: 'icon_256x256.png' },
      { size: 512, name: 'icon_256x256@2x.png' },
      { size: 512, name: 'icon_512x512.png' },
      { size: 1024, name: 'icon_512x512@2x.png' },
    ];

    for (const { size, name } of macSizes) {
      await sharp(svgBuffer)
        .resize(size, size)
        .png()
        .toFile(path.join(iconsetDir, name));
    }
    console.log('  [OK] mac/icon.iconset/ (10 files)');
    console.log('  [INFO] Run on macOS: iconutil -c icns icon.iconset -o icon.icns');

    // 5. Tray icons
    console.log('\n--- Generating Tray Icons ---');
    const traySvg = Buffer.from(createTraySVG());
    const trayDir = path.join(ICONS_DIR, 'tray');

    for (const size of ICON_SIZES.tray) {
      await sharp(traySvg)
        .resize(size, size)
        .png()
        .toFile(path.join(trayDir, `tray-${size}.png`));

      // Template (grayscale) for macOS
      await sharp(traySvg)
        .resize(size, size)
        .grayscale()
        .png()
        .toFile(path.join(trayDir, `trayTemplate-${size}.png`));
    }
    console.log(`  [OK] Generated ${ICON_SIZES.tray.length * 2} tray icons`);

    // 6. Main asset icons
    console.log('\n--- Generating Main Asset Icons ---');

    await sharp(svgBuffer).resize(256, 256).png().toFile(path.join(ASSETS_DIR, 'icon.png'));
    console.log('  [OK] icon.png (256x256)');

    await sharp(svgBuffer).resize(48, 48).png().toFile(path.join(ASSETS_DIR, 'icon-small.png'));
    console.log('  [OK] icon-small.png (48x48)');

    await sharp(svgBuffer).resize(1024, 1024).png().toFile(path.join(ASSETS_DIR, 'icon-large.png'));
    console.log('  [OK] icon-large.png (1024x1024)');

    await sharp(traySvg).resize(16, 16).png().toFile(path.join(ASSETS_DIR, 'tray-icon.png'));
    console.log('  [OK] tray-icon.png (16x16)');

    await sharp(traySvg).resize(32, 32).png().toFile(path.join(ASSETS_DIR, 'tray-icon@2x.png'));
    console.log('  [OK] tray-icon@2x.png (32x32)');

    // Copy ICO to assets root for convenience
    fs.copyFileSync(path.join(ICONS_DIR, 'icon.ico'), path.join(ASSETS_DIR, 'icon.ico'));

    console.log('\n========================================');
    console.log('Icon Generation Complete!');
    console.log('========================================');
    console.log('\nGenerated files summary:');
    console.log('  - assets/icon.png (main app icon)');
    console.log('  - assets/icon.ico (Windows)');
    console.log('  - assets/tray-icon.png (system tray)');
    console.log('  - assets/icons/png/ (all PNG sizes)');
    console.log('  - assets/icons/win/ (Windows icons)');
    console.log('  - assets/icons/mac/icon.iconset/ (macOS)');
    console.log('  - assets/icons/linux/ (Linux icons)');
    console.log('  - assets/icons/tray/ (tray icons)');
    console.log('\nNote: For macOS .icns, run iconutil on a Mac.');

  } catch (error) {
    console.error('\n[ERROR] Icon generation failed:', error.message);
    process.exit(1);
  }
}

// Run
generateIcons().catch(console.error);
