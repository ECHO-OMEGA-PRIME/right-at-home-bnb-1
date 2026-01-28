/**
 * Right at Home BnB - Icon Builder
 * Converts SVG icons to PNG, ICO, and ICNS formats
 *
 * Run with: npm run build-icons
 * Requires: sharp, png-to-ico
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

// Check for required modules
let sharp, pngToIco;
try {
  sharp = require('sharp');
} catch (e) {
  console.error('Error: sharp is not installed. Run: npm install sharp');
  process.exit(1);
}

try {
  pngToIco = require('png-to-ico');
} catch (e) {
  console.error('Error: png-to-ico is not installed. Run: npm install png-to-ico');
  process.exit(1);
}

// Configuration
const ASSETS_DIR = path.join(__dirname, '..', 'assets');
const ICONS_DIR = path.join(ASSETS_DIR, 'icons');
const SVG_PATH = path.join(ICONS_DIR, 'icon.svg');
const TRAY_SVG_PATH = path.join(ASSETS_DIR, 'tray-icon.svg');

// Icon sizes for different purposes
const ICON_SIZES = {
  png: [16, 24, 32, 48, 64, 96, 128, 256, 512, 1024],
  ico: [16, 24, 32, 48, 64, 128, 256],
  tray: [16, 20, 22, 24, 32],
};

// Brand colors
const BRAND_COLORS = {
  maroon: '#500000',
  cream: '#F5F5F0',
  gold: '#C4A777',
};

/**
 * Ensure directory exists
 */
function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * Create the base SVG icon if it doesn't exist
 */
function createBaseSVG() {
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="maroonGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" style="stop-color:#6B0000;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#400000;stop-opacity:1" />
    </linearGradient>
  </defs>
  <circle cx="512" cy="512" r="480" fill="url(#maroonGrad)"/>
  <circle cx="512" cy="512" r="440" fill="none" stroke="${BRAND_COLORS.gold}" stroke-width="8"/>
  <g transform="translate(512, 512)">
    <path d="M-200 -80 L0 -220 L200 -80 L200 -60 L0 -200 L-200 -60 Z" fill="${BRAND_COLORS.cream}" stroke="${BRAND_COLORS.gold}" stroke-width="4"/>
    <rect x="100" y="-200" width="40" height="60" fill="${BRAND_COLORS.cream}" stroke="${BRAND_COLORS.gold}" stroke-width="3"/>
    <rect x="-180" y="-60" width="360" height="260" fill="${BRAND_COLORS.cream}" stroke="${BRAND_COLORS.gold}" stroke-width="4" rx="8"/>
    <rect x="-40" y="60" width="80" height="140" fill="${BRAND_COLORS.maroon}" stroke="${BRAND_COLORS.gold}" stroke-width="3" rx="4"/>
    <circle cx="25" cy="130" r="8" fill="${BRAND_COLORS.gold}"/>
    <rect x="-140" y="-20" width="70" height="70" fill="${BRAND_COLORS.maroon}" stroke="${BRAND_COLORS.gold}" stroke-width="3" rx="4"/>
    <rect x="70" y="-20" width="70" height="70" fill="${BRAND_COLORS.maroon}" stroke="${BRAND_COLORS.gold}" stroke-width="3" rx="4"/>
  </g>
  <text x="512" y="920" text-anchor="middle" font-family="Georgia, serif" font-size="100" font-weight="bold" fill="${BRAND_COLORS.cream}" letter-spacing="20">RAH</text>
  <polygon points="512,720 522,750 555,750 528,770 538,800 512,780 486,800 496,770 469,750 502,750" fill="${BRAND_COLORS.gold}"/>
</svg>`;

  return svg;
}

/**
 * Create the tray icon SVG
 */
function createTraySVG() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="64" height="64" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
  <path d="M32 8 L56 28 L56 56 L8 56 L8 28 Z" fill="${BRAND_COLORS.maroon}"/>
  <path d="M32 8 L56 28 L52 28 L32 12 L12 28 L8 28 Z" fill="${BRAND_COLORS.gold}"/>
  <rect x="26" y="38" width="12" height="18" fill="${BRAND_COLORS.cream}"/>
  <rect x="38" y="32" width="10" height="10" fill="${BRAND_COLORS.cream}"/>
  <rect x="16" y="32" width="10" height="10" fill="${BRAND_COLORS.cream}"/>
</svg>`;
}

/**
 * Convert SVG to PNG at specified size
 */
async function svgToPng(svgContent, outputPath, size) {
  await sharp(Buffer.from(svgContent))
    .resize(size, size, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toFile(outputPath);

  console.log(`  Created: ${path.basename(outputPath)} (${size}x${size})`);
}

/**
 * Create Windows ICO file from multiple PNG sizes
 */
async function createIco(pngPaths, outputPath) {
  const buf = await pngToIco(pngPaths);
  fs.writeFileSync(outputPath, buf);
  console.log(`  Created: ${path.basename(outputPath)}`);
}

/**
 * Create macOS ICNS file
 * Uses iconutil on macOS, creates iconset for manual conversion on other platforms
 */
async function createIcns(svgContent, outputPath) {
  const iconsetPath = path.join(path.dirname(outputPath), 'icon.iconset');
  ensureDir(iconsetPath);

  // macOS iconset sizes
  const icnsSizes = [
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

  // Generate all iconset PNGs
  for (const { size, name } of icnsSizes) {
    await svgToPng(svgContent, path.join(iconsetPath, name), size);
  }

  // If on macOS, use iconutil to create ICNS
  if (process.platform === 'darwin') {
    try {
      // Using execFileSync for safety - no shell injection risk
      execFileSync('iconutil', ['-c', 'icns', iconsetPath, '-o', outputPath], { stdio: 'inherit' });
      console.log(`  Created: ${path.basename(outputPath)} (via iconutil)`);
      // Clean up iconset directory
      fs.rmSync(iconsetPath, { recursive: true, force: true });
    } catch (error) {
      console.error('Warning: iconutil failed, ICNS not created:', error.message);
      console.log('  Note: Run "npm run build-icons" on macOS to generate ICNS');
    }
  } else {
    // On Windows/Linux, keep the iconset for manual conversion
    console.log(`  Created: icon.iconset (convert to ICNS on macOS with iconutil)`);
    console.log('  Note: Run the following on macOS:');
    console.log(`    iconutil -c icns "${iconsetPath}" -o "${outputPath}"`);

    // Create a placeholder ICNS (copy the 512x512 PNG)
    const placeholder512 = path.join(iconsetPath, 'icon_512x512.png');
    if (fs.existsSync(placeholder512)) {
      fs.copyFileSync(placeholder512, outputPath.replace('.icns', '.png'));
      console.log('  Created: icon.png (fallback for non-macOS)');
    }
  }
}

/**
 * Main build function
 */
async function buildIcons() {
  console.log('\n=== Right at Home BnB - Icon Builder ===\n');

  // Ensure directories exist
  ensureDir(ICONS_DIR);

  // Create or read base SVG
  let mainSvg;
  if (fs.existsSync(SVG_PATH)) {
    mainSvg = fs.readFileSync(SVG_PATH, 'utf-8');
    console.log('Using existing icon.svg');
  } else {
    mainSvg = createBaseSVG();
    fs.writeFileSync(SVG_PATH, mainSvg);
    console.log('Created icon.svg');
  }

  // Create or read tray SVG
  let traySvg;
  if (fs.existsSync(TRAY_SVG_PATH)) {
    traySvg = fs.readFileSync(TRAY_SVG_PATH, 'utf-8');
    console.log('Using existing tray-icon.svg');
  } else {
    traySvg = createTraySVG();
    fs.writeFileSync(TRAY_SVG_PATH, traySvg);
    console.log('Created tray-icon.svg');
  }

  console.log('\nGenerating PNG icons...');

  // Generate all PNG sizes for app icon
  const generatedPngs = [];
  for (const size of ICON_SIZES.png) {
    const pngPath = path.join(ICONS_DIR, `icon-${size}x${size}.png`);
    await svgToPng(mainSvg, pngPath, size);
    generatedPngs.push({ size, path: pngPath });
  }

  // Generate main icon.png (1024x1024)
  const mainPngPath = path.join(ICONS_DIR, 'icon.png');
  await svgToPng(mainSvg, mainPngPath, 1024);

  console.log('\nGenerating tray icons...');

  // Generate tray icons
  for (const size of ICON_SIZES.tray) {
    const trayPngPath = path.join(ICONS_DIR, `tray-icon-${size}x${size}.png`);
    await svgToPng(traySvg, trayPngPath, size);
  }

  // Main tray icon (default size 22 for most systems)
  const mainTrayPath = path.join(ICONS_DIR, 'tray-icon.png');
  await svgToPng(traySvg, mainTrayPath, 22);

  console.log('\nGenerating Windows ICO...');

  // Generate ICO for Windows
  const icoPngs = ICON_SIZES.ico.map(size =>
    path.join(ICONS_DIR, `icon-${size}x${size}.png`)
  );
  await createIco(icoPngs, path.join(ICONS_DIR, 'icon.ico'));

  console.log('\nGenerating macOS ICNS...');

  // Generate ICNS for macOS
  await createIcns(mainSvg, path.join(ICONS_DIR, 'icon.icns'));

  // Update manifest
  const manifest = {
    name: 'Right at Home BnB',
    version: '1.0.0',
    generated: new Date().toISOString(),
    icons: {
      svg: 'icons/icon.svg',
      png: ICON_SIZES.png.map(s => `icons/icon-${s}x${s}.png`),
      ico: 'icons/icon.ico',
      icns: 'icons/icon.icns',
      tray: {
        svg: 'tray-icon.svg',
        png: ICON_SIZES.tray.map(s => `icons/tray-icon-${s}x${s}.png`),
        default: 'icons/tray-icon.png',
      },
    },
    colors: BRAND_COLORS,
    platform: {
      win32: 'icons/icon.ico',
      darwin: 'icons/icon.icns',
      linux: 'icons/icon.png',
    },
  };

  fs.writeFileSync(
    path.join(ASSETS_DIR, 'icon-manifest.json'),
    JSON.stringify(manifest, null, 2)
  );
  console.log('\nUpdated icon-manifest.json');

  console.log('\n=== Icon generation complete! ===');
  console.log(`\nOutput directory: ${ICONS_DIR}`);
  console.log('\nGenerated files:');
  console.log(`  - ${ICON_SIZES.png.length} PNG icons (16x16 to 1024x1024)`);
  console.log(`  - ${ICON_SIZES.tray.length} tray icons`);
  console.log('  - icon.ico (Windows)');
  console.log('  - icon.icns or icon.iconset (macOS)');
  console.log('  - icon-manifest.json');
}

// Run the build
buildIcons().catch(error => {
  console.error('Error building icons:', error);
  process.exit(1);
});
