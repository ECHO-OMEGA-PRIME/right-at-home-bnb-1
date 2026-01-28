# Right at Home BnB - Icon Creation Script
# Creates SVG icons and placeholder files for the desktop app

$iconsDir = "P:\SOVEREIGN_APPS\RightAtHomeBnB\apps\desktop\assets\icons"
$assetsDir = "P:\SOVEREIGN_APPS\RightAtHomeBnB\apps\desktop\assets"

# Create directories if they don't exist
New-Item -ItemType Directory -Force -Path $iconsDir | Out-Null

# Main icon SVG content
$iconSvg = @"
<?xml version="1.0" encoding="UTF-8"?>
<svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="maroonGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" style="stop-color:#6B0000;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#400000;stop-opacity:1" />
    </linearGradient>
  </defs>
  <circle cx="512" cy="512" r="480" fill="url(#maroonGrad)"/>
  <circle cx="512" cy="512" r="440" fill="none" stroke="#C4A777" stroke-width="8"/>
  <g transform="translate(512, 512)">
    <path d="M-200 -80 L0 -220 L200 -80 L200 -60 L0 -200 L-200 -60 Z" fill="#F5F5F0" stroke="#C4A777" stroke-width="4"/>
    <rect x="100" y="-200" width="40" height="60" fill="#F5F5F0" stroke="#C4A777" stroke-width="3"/>
    <rect x="-180" y="-60" width="360" height="260" fill="#F5F5F0" stroke="#C4A777" stroke-width="4" rx="8"/>
    <rect x="-40" y="60" width="80" height="140" fill="#500000" stroke="#C4A777" stroke-width="3" rx="4"/>
    <circle cx="25" cy="130" r="8" fill="#C4A777"/>
    <rect x="-140" y="-20" width="70" height="70" fill="#500000" stroke="#C4A777" stroke-width="3" rx="4"/>
    <rect x="70" y="-20" width="70" height="70" fill="#500000" stroke="#C4A777" stroke-width="3" rx="4"/>
  </g>
  <text x="512" y="920" text-anchor="middle" font-family="Georgia, serif" font-size="100" font-weight="bold" fill="#F5F5F0" letter-spacing="20">RAH</text>
  <polygon points="512,720 522,750 555,750 528,770 538,800 512,780 486,800 496,770 469,750 502,750" fill="#C4A777"/>
</svg>
"@

# Tray icon SVG (simpler)
$traySvg = @"
<?xml version="1.0" encoding="UTF-8"?>
<svg width="64" height="64" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
  <path d="M32 8 L56 28 L56 56 L8 56 L8 28 Z" fill="#500000"/>
  <path d="M32 8 L56 28 L52 28 L32 12 L12 28 L8 28 Z" fill="#C4A777"/>
  <rect x="26" y="38" width="12" height="18" fill="#F5F5F0"/>
  <rect x="38" y="32" width="10" height="10" fill="#F5F5F0"/>
  <rect x="16" y="32" width="10" height="10" fill="#F5F5F0"/>
</svg>
"@

# Write main icon SVG
$iconSvg | Out-File -FilePath "$iconsDir\icon.svg" -Encoding UTF8
Write-Host "Created: $iconsDir\icon.svg"

# Write tray icon SVG
$traySvg | Out-File -FilePath "$assetsDir\tray-icon.svg" -Encoding UTF8
Write-Host "Created: $assetsDir\tray-icon.svg"

# Create icon manifest
$manifest = @{
    name = "Right at Home BnB"
    version = "1.0.0"
    generated = (Get-Date).ToString("yyyy-MM-ddTHH:mm:ssZ")
    icons = @{
        svg = "icons/icon.svg"
        tray = "tray-icon.svg"
        note = "Use sharp or Inkscape to convert SVG to PNG/ICO/ICNS"
    }
    colors = @{
        maroon = "#500000"
        cream = "#F5F5F0"
        gold = "#C4A777"
    }
    conversionCommands = @{
        inkscape = "inkscape icon.svg -w 1024 -h 1024 -o icon.png"
        icns = "png2icns icon.icns icon.png"
        ico = "convert icon.png -define icon:auto-resize=256,128,96,64,48,32,16 icon.ico"
    }
}

$manifest | ConvertTo-Json -Depth 5 | Out-File -FilePath "$assetsDir\icon-manifest.json" -Encoding UTF8
Write-Host "Created: $assetsDir\icon-manifest.json"

Write-Host ""
Write-Host "Icon files created successfully!"
Write-Host ""
Write-Host "Next steps to generate platform-specific icons:"
Write-Host "1. Install Inkscape or ImageMagick"
Write-Host "2. Convert SVG to PNG: inkscape icon.svg -w 1024 -h 1024 -o icon.png"
Write-Host "3. For macOS ICNS: Use png2icns or iconutil"
Write-Host "4. For Windows ICO: Use ImageMagick convert command"
Write-Host ""
Write-Host "Or use npm packages: sharp, png-to-ico, icns-lib"
