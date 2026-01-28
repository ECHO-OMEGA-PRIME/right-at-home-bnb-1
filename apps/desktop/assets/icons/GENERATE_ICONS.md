# Icon Generation Instructions

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
```bash
cd apps/desktop
npm install sharp
node scripts/generate-icons.js
```
