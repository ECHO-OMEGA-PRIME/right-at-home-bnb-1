# Right at Home BnB

**Premium Property Management System for Steven Palma's 22 Midland TX Rentals**

## Overview

Right at Home BnB is a comprehensive property management platform featuring:
- **Web Dashboard** - Full management interface (Next.js 14)
- **Mobile App** - Cleaner app with GPS check-in (React Native/Expo)
- **Desktop App** - System tray monitoring (Electron)
- **Backend API** - RESTful services (FastAPI/Python)
- **AI Concierge** - Guest messaging (OpenAI GPT-4)
- **Voice Service** - TTS for guests (ElevenLabs)
- **Smart Locks** - Schlage/Yale/August integration

## Brand Colors (Texas A&M Aggies)

| Color | Hex | Usage |
|-------|-----|-------|
| Aggie Maroon | `#500000` | Primary, headers, buttons |
| White | `#FFFFFF` | Text on maroon, backgrounds |
| Maroon Dark | `#3D0000` | Hover states, gradients |
| Charcoal | `#2D2D2D` | Body text |

### RAH Logo
Baseball-style italic lettering "RAH" (Right At Home)
- White text on maroon background
- Impact/Arial Black font, italic, bold
- Swoosh underline

## Project Structure

```
RightAtHomeBnB/
├── apps/
│   ├── web/          # Next.js 14 dashboard
│   ├── mobile/       # React Native cleaner app
│   └── desktop/      # Electron desktop app
├── backend/
│   ├── api/          # FastAPI routes
│   ├── services/     # Business logic
│   └── database/     # SQLAlchemy models
└── deploy.ps1        # Deployment script
```

## Quick Start

### Prerequisites
- Node.js 18+
- Python 3.11+
- PostgreSQL 15+

### Development

```bash
# Backend
cd backend
pip install -r requirements.txt
python main.py

# Web
cd apps/web
npm install
npm run dev

# Mobile
cd apps/mobile
npm install
npx expo start
```

### Deployment

```powershell
# Deploy all platforms
.\deploy.ps1 -Target all -Environment production

# Deploy specific platform
.\deploy.ps1 -Target web
.\deploy.ps1 -Target backend
.\deploy.ps1 -Target mobile
.\deploy.ps1 -Target desktop
```

## Properties

Steven Palma operates 22 properties in Midland, TX:
- Castleford Estate - 123 Oak Lane, Midland, TX 79705
- Permian Palace - 456 Basin Blvd, Midland, TX 79701
- Sunset Retreat - 789 Desert Rose Dr, Midland, TX 79703
- Basin View Cottage
- ...and 18 more

## Features

### Web Dashboard
- Real-time occupancy tracking
- Revenue analytics with Recharts
- Guest CRM with communication history
- Cleaner scheduling and ranking
- Smart lock management
- AI-powered message drafting

### Mobile App (Cleaners)
- GPS-verified check-in (100m radius)
- Photo documentation per room
- Push notifications for urgent jobs
- Weekly performance ranking
- Task checklist management

### Desktop App
- System tray with live stats
- Quick actions for lock control
- Desktop notifications
- Multi-monitor support

### AI Services
- GPT-4 powered guest concierge
- Automated message drafting
- Review response generation
- Sentiment analysis
- Property description writing

### Voice Services
- ElevenLabs TTS for welcome messages
- IVR greeting generation
- Checkout reminders
- Multiple voice personas

### Smart Locks
- Schlage, Yale, August support
- Time-limited guest codes
- Cleaner access windows
- Activity logging
- Battery monitoring
- Remote lock/unlock

## API Endpoints

Base URL: `https://rightathome-api.run.app`

| Endpoint | Description |
|----------|-------------|
| `/api/properties` | Property CRUD |
| `/api/guests` | Guest management |
| `/api/cleaners` | Cleaner operations |
| `/api/locks` | Smart lock control |
| `/api/finance` | Revenue tracking |
| `/api/concierge` | AI messaging |
| `/api/messages` | Communication hub |

## License

Proprietary - © 2026 Steven Palma / Right at Home BnB

Built with ❤️ by ECHO OMEGA PRIME
