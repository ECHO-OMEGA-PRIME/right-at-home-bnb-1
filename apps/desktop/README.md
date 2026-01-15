# RightAtHome BnB Desktop Application

A comprehensive Electron desktop application for vacation rental property management with the Texas A&M Aggie Maroon (#500000) brand theme.

## Features

### Core Screens
- **Dashboard** - At-a-glance stats, revenue charts, occupancy metrics
- **Properties** - Full property management with grid/list views
- **Guests** - CRM with booking history, tags, export to Excel
- **Cleaning Schedule** - Calendar view with job management
- **Finance** - Revenue/expense reports with print and PDF export
- **Smart Locks** - Control panel for lock status and access codes
- **Settings** - App preferences, appearance, data backup

### Desktop Features
- System tray with quick actions
- Desktop notifications
- Keyboard shortcuts (Ctrl+N new booking, Ctrl+P properties, etc.)
- Print reports directly
- Export to Excel (.xlsx)
- Local data backup
- Import/export data
- Auto-updates from GitHub releases
- Offline mode support
- Dark/light/system theme

## Tech Stack

- **Electron 28** - Cross-platform desktop framework
- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Fast build tool
- **Tailwind CSS** - Utility-first styling
- **Framer Motion** - Animations
- **Recharts** - Data visualization
- **React Big Calendar** - Calendar component
- **electron-store** - Persistent settings
- **electron-updater** - Auto-updates

## Development

### Prerequisites
- Node.js 18+
- npm 9+

### Setup
```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Build for production
npm run build

# Package for current platform
npm run package

# Package for specific platforms
npm run package:win   # Windows
npm run package:mac   # macOS
npm run package:linux # Linux
npm run package:all   # All platforms
```

### Project Structure
```
apps/desktop/
├── assets/
│   ├── icons/           # App icons (ico, icns, png)
│   ├── entitlements.mac.plist
│   └── installer.nsh    # NSIS customization
├── src/
│   ├── main/
│   │   ├── main.ts      # Electron main process
│   │   └── preload.ts   # IPC bridge
│   ├── renderer/
│   │   ├── components/  # React components
│   │   ├── contexts/    # React contexts
│   │   ├── screens/     # Screen components
│   │   ├── styles/      # CSS/Tailwind
│   │   ├── App.tsx      # Main app
│   │   ├── main.tsx     # Entry point
│   │   └── index.html   # HTML template
│   └── shared/
│       └── types.ts     # TypeScript definitions
├── scripts/
│   └── generate-icons.js # Icon generation
├── package.json
├── tsconfig.json        # Renderer TypeScript config
├── tsconfig.main.json   # Main process TypeScript config
├── vite.config.ts       # Vite configuration
├── tailwind.config.js   # Tailwind configuration
└── postcss.config.js    # PostCSS configuration
```

## Brand Colors

| Color | Hex | Usage |
|-------|-----|-------|
| Aggie Maroon | #500000 | Primary brand color |
| Maroon Dark | #3D0000 | Darker variant |
| Maroon Light | #7A0000 | Lighter variant |
| Gold Accent | #D4AF37 | Accent color |

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| Ctrl+N | New Booking |
| Ctrl+P | Properties |
| Ctrl+G | Guests |
| Ctrl+F | Finance |
| Ctrl+L | Smart Locks |
| Ctrl+, | Settings |
| Ctrl+R | Refresh Data |
| Ctrl+Q | Quit |

## Building Installers

### Windows (NSIS)
```bash
npm run package:win
```
Outputs: `release/Right at Home BnB-1.0.0-win-x64.exe`

### macOS (DMG)
```bash
npm run package:mac
```
Outputs: `release/Right at Home BnB-1.0.0-mac-arm64.dmg`

### Linux (AppImage)
```bash
npm run package:linux
```
Outputs: `release/Right at Home BnB-1.0.0-linux-x86_64.AppImage`

## Auto-Updates

The app checks for updates on startup and can be configured to auto-install.
Updates are published via GitHub Releases.

## Icon Generation

To generate icons from the SVG source:
```bash
npm install sharp png-to-ico
node scripts/generate-icons.js
```

Or use an online tool like https://realfavicongenerator.net/

## License

Copyright (c) 2024-2026 Right At Home Midland LLC. Proprietary software.
