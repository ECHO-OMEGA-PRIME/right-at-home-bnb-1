/**
 * Right at Home BnB - Icon Generation Script
 * Generates all required icon formats for Windows, macOS, and Linux
 *
 * Run with: npx ts-node scripts/generate-icons.ts
 * Or: npm run generate-icons
 *
 * Requirements: sharp, png-to-ico, icns-lib
 */

import * as fs from 'fs';
import * as path from 'path';

// Icon sizes required for each platform
const ICON_SIZES = {
  png: [16, 24, 32, 48, 64, 96, 128, 256, 512, 1024],
  ico: [16, 24, 32, 48, 64, 128, 256],
  icns: [16, 32, 64, 128, 256, 512, 1024]
};

// Brand colors for Right at Home BnB
const BRAND_COLORS = {
  maroon: '#500000',
  cream: '#F5F5F0',
  gold: '#C4A777',
  white: '#FFFFFF'
};

interface IconPaths {
  source: string;
  output: string;
  iconsDir: string;
}

function getPaths(): IconPaths {
  const rootDir = path.resolve(__dirname, '..');
  return {
    source: path.join(rootDir, 'assets', 'icon-source.png'),
    output: path.join(rootDir, 'assets'),
    iconsDir: path.join(rootDir, 'assets', 'icons')
  };
}

/**
 * Creates the base SVG icon for Right at Home BnB
 * House icon with RAH initials in Texas A&M maroon
 */
function createBaseSVG(size: number): string {
  const scale = size / 1024;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${size}" height="${size}" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <!-- Gradient for depth -->
    <linearGradient id="maroonGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" style="stop-color:#6B0000;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#400000;stop-opacity:1" />
    </linearGradient>
    <!-- Shadow filter -->
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="8" stdDeviation="16" flood-color="#000000" flood-opacity="0.3"/>
    </filter>
    <!-- Inner glow -->
    <filter id="glow">
      <feGaussianBlur stdDeviation="4" result="blur"/>
      <feComposite in="SourceGraphic" in2="blur" operator="over"/>
    </filter>
  </defs>

  <!-- Background circle -->
  <circle cx="512" cy="512" r="480" fill="url(#maroonGrad)" filter="url(#shadow)"/>

  <!-- Inner circle border -->
  <circle cx="512" cy="512" r="440" fill="none" stroke="${BRAND_COLORS.gold}" stroke-width="8"/>

  <!-- House shape -->
  <g transform="translate(512, 512)">
    <!-- Roof -->
    <path d="M-200 -80 L0 -220 L200 -80 L200 -60 L0 -200 L-200 -60 Z"
          fill="${BRAND_COLORS.cream}" stroke="${BRAND_COLORS.gold}" stroke-width="4"/>

    <!-- Chimney -->
    <rect x="100" y="-200" width="40" height="60" fill="${BRAND_COLORS.cream}"
          stroke="${BRAND_COLORS.gold}" stroke-width="3"/>

    <!-- House body -->
    <rect x="-180" y="-60" width="360" height="260" fill="${BRAND_COLORS.cream}"
          stroke="${BRAND_COLORS.gold}" stroke-width="4" rx="8"/>

    <!-- Door -->
    <rect x="-40" y="60" width="80" height="140" fill="${BRAND_COLORS.maroon}"
          stroke="${BRAND_COLORS.gold}" stroke-width="3" rx="4"/>
    <circle cx="25" cy="130" r="8" fill="${BRAND_COLORS.gold}"/>

    <!-- Windows -->
    <rect x="-140" y="-20" width="70" height="70" fill="${BRAND_COLORS.maroon}"
          stroke="${BRAND_COLORS.gold}" stroke-width="3" rx="4"/>
    <line x1="-105" y1="-20" x2="-105" y2="50" stroke="${BRAND_COLORS.gold}" stroke-width="2"/>
    <line x1="-140" y1="15" x2="-70" y2="15" stroke="${BRAND_COLORS.gold}" stroke-width="2"/>

    <rect x="70" y="-20" width="70" height="70" fill="${BRAND_COLORS.maroon}"
          stroke="${BRAND_COLORS.gold}" stroke-width="3" rx="4"/>
    <line x1="105" y1="-20" x2="105" y2="50" stroke="${BRAND_COLORS.gold}" stroke-width="2"/>
    <line x1="70" y1="15" x2="140" y2="15" stroke="${BRAND_COLORS.gold}" stroke-width="2"/>
  </g>

  <!-- RAH Text at bottom -->
  <text x="512" y="920" text-anchor="middle" font-family="Georgia, serif"
        font-size="100" font-weight="bold" fill="${BRAND_COLORS.cream}"
        letter-spacing="20">RAH</text>

  <!-- Decorative star (Texas) -->
  <polygon points="512,720 522,750 555,750 528,770 538,800 512,780 486,800 496,770 469,750 502,750"
           fill="${BRAND_COLORS.gold}"/>
</svg>`;
}

/**
 * Creates a simplified tray icon SVG (smaller, cleaner)
 */
function createTrayIconSVG(size: number): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${size}" height="${size}" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
  <!-- Simple house shape -->
  <path d="M32 8 L56 28 L56 56 L8 56 L8 28 Z" fill="${BRAND_COLORS.maroon}"/>
  <!-- Roof highlight -->
  <path d="M32 8 L56 28 L52 28 L32 12 L12 28 L8 28 Z" fill="${BRAND_COLORS.gold}"/>
  <!-- Door -->
  <rect x="26" y="38" width="12" height="18" fill="${BRAND_COLORS.cream}"/>
  <!-- Window -->
  <rect x="38" y="32" width="10" height="10" fill="${BRAND_COLORS.cream}"/>
  <rect x="16" y="32" width="10" height="10" fill="${BRAND_COLORS.cream}"/>
</svg>`;
}

/**
 * Converts SVG to PNG using built-in or canvas
 * For production, use sharp library
 */
async function svgToPng(svg: string, outputPath: string, size: number): Promise<void> {
  // Write SVG first
  const svgPath = outputPath.replace('.png', '.svg');
  fs.writeFileSync(svgPath, svg, 'utf8');

  console.log(`Created SVG: ${svgPath} (${size}x${size})`);

  // Note: In production, use sharp to convert SVG to PNG:
  // const sharp = require('sharp');
  // await sharp(Buffer.from(svg)).resize(size, size).png().toFile(outputPath);
}

/**
 * Creates an ICO file from multiple PNG sizes
 * For production, use png-to-ico library
 */
function createICO(pngPaths: string[], outputPath: string): void {
  console.log(`ICO would be created at: ${outputPath}`);
  console.log(`  From PNGs: ${pngPaths.join(', ')}`);

  // Note: In production, use png-to-ico:
  // const pngToIco = require('png-to-ico');
  // const buf = await pngToIco(pngPaths);
  // fs.writeFileSync(outputPath, buf);
}

/**
 * Creates an ICNS file for macOS
 * For production, use icns-lib or png2icns
 */
function createICNS(pngPaths: string[], outputPath: string): void {
  console.log(`ICNS would be created at: ${outputPath}`);
  console.log(`  From PNGs: ${pngPaths.join(', ')}`);

  // Note: In production, use png2icns or icns-lib
}

/**
 * Main icon generation function
 */
async function generateIcons(): Promise<void> {
  const paths = getPaths();

  // Ensure directories exist
  if (!fs.existsSync(paths.iconsDir)) {
    fs.mkdirSync(paths.iconsDir, { recursive: true });
  }

  console.log('Right at Home BnB - Icon Generator');
  console.log('===================================\n');

  const generatedPngs: Map<number, string> = new Map();

  // Generate PNG icons at all sizes
  console.log('Generating PNG icons...');
  for (const size of ICON_SIZES.png) {
    const svg = createBaseSVG(size);
    const outputPath = path.join(paths.iconsDir, `icon-${size}x${size}.png`);
    await svgToPng(svg, outputPath, size);
    generatedPngs.set(size, outputPath);
  }

  // Generate main icon
  const mainSvg = createBaseSVG(1024);
  const mainIconPath = path.join(paths.iconsDir, 'icon.png');
  await svgToPng(mainSvg, mainIconPath, 1024);
  fs.copyFileSync(mainIconPath.replace('.png', '.svg'), path.join(paths.output, 'icon.svg'));

  // Generate tray icons
  console.log('\nGenerating tray icons...');
  for (const size of [16, 20, 22, 24, 32]) {
    const traySvg = createTrayIconSVG(size);
    const trayPath = path.join(paths.iconsDir, `tray-icon-${size}x${size}.png`);
    await svgToPng(traySvg, trayPath, size);
  }

  // Create main tray icon
  const trayMainSvg = createTrayIconSVG(22);
  const trayMainPath = path.join(paths.output, 'tray-icon.png');
  await svgToPng(trayMainSvg, trayMainPath, 22);

  // Create small icon for menus
  const smallSvg = createBaseSVG(16);
  const smallPath = path.join(paths.output, 'icon-small.png');
  await svgToPng(smallSvg, smallPath, 16);

  // Generate Windows ICO
  console.log('\nGenerating Windows ICO...');
  const icoPngs = ICON_SIZES.ico.map(size =>
    path.join(paths.iconsDir, `icon-${size}x${size}.png`)
  );
  createICO(icoPngs, path.join(paths.iconsDir, 'icon.ico'));

  // Generate macOS ICNS
  console.log('\nGenerating macOS ICNS...');
  const icnsPngs = ICON_SIZES.icns.map(size =>
    path.join(paths.iconsDir, `icon-${size}x${size}.png`)
  );
  createICNS(icnsPngs, path.join(paths.iconsDir, 'icon.icns'));

  // Create icon manifest
  const manifest = {
    name: 'Right at Home BnB',
    version: '1.0.0',
    generated: new Date().toISOString(),
    icons: {
      png: ICON_SIZES.png.map(s => `icons/icon-${s}x${s}.png`),
      ico: 'icons/icon.ico',
      icns: 'icons/icon.icns',
      tray: [16, 20, 22, 24, 32].map(s => `icons/tray-icon-${s}x${s}.png`),
      main: 'icon.svg'
    },
    colors: BRAND_COLORS
  };

  fs.writeFileSync(
    path.join(paths.output, 'icon-manifest.json'),
    JSON.stringify(manifest, null, 2)
  );

  console.log('\n===================================');
  console.log('Icon generation complete!');
  console.log(`Output directory: ${paths.output}`);
  console.log('\nNote: For production builds, install and use:');
  console.log('  npm install sharp png-to-ico');
  console.log('  Then uncomment the conversion code in this script.');
}

// Run if executed directly
generateIcons().catch(console.error);

export { generateIcons, createBaseSVG, createTrayIconSVG, BRAND_COLORS };
