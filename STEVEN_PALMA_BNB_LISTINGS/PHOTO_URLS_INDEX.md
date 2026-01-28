# Right At Home BnB - VRBO Photo URLs Index

**Generated:** 2026-01-17
**Total Images:** 730 high-resolution photos
**Source:** VRBO.com via Playwright Browser Automation

---

## Quick Reference

| Property | VRBO ID | Photos | JSON File |
|----------|---------|--------|-----------|
| Adobe Compound | 3005111 | 76 | `adobe-compound-gc.json` |
| Castleford Oasis | 2636389 | 67 | `castleford-5001.json` |
| Garfield Hot Tub | 2634718 | 67 | `garfield-2702.json` |
| Santiago Dreams | 4179271 | 64 | `daventry-1311.json` |
| Douglas Old Midland | 3355618 | 54 | `douglas-4501.json` |
| Saddle Club | 4750070 | 50 | `daventry-1309.json` |
| Humble Outdoor Dream | 4700881 | 49 | `humble-3106.json` |
| Lanham Posh | 4437486 | 47 | `lanham-1426.json` |
| Storey Getaway | 2643822 | 38 | `storey-2103.json` |
| Dentcrest Hot Tub | 2638481 | 37 | `dentcrest-4707.json` |
| Chelsea Retreat | 2643784 | 36 | `chelsea-3210.json` |
| Oriole Marvelous | 4471713 | 34 | `oriole-6100.json` |
| Monterrey House | 3477668 | 27 | `monterrey-house.json` |
| Lincoln Green Ranch | 4581977 | 84 | `lincoln-green-5055.json` |
| Safari Gameroom | 2638524 | 0 | SKIPPED (Invalid VRBO ID) |

---

## File Locations

| File | Path | Purpose |
|------|------|---------|
| ALL_PROPERTIES.json | `tools/vrbo_images/` | Merged data with all image URLs |
| prisma_photo_seed.json | `tools/` | Database seed data for Prisma |
| IMAGE_SCRAPE_REPORT.md | `tools/` | Detailed scrape report |
| Individual JSONs | `tools/vrbo_images/` | Per-property image data |

---

## Database Import

To import photos into the database:

```bash
# From project root
cd P:\SOVEREIGN_APPS\RightAtHomeBnB

# Install dependencies if needed
pnpm install

# Run database seed (creates properties + imports photos)
pnpm db:seed
```

---

## Image URL Format

All images use VRBO's CDN with high-resolution settings:

```
https://media.vrbo.com/lodging/{path}/{hash}.jpg?impolicy=resizecrop&rw=1200&ra=fit
```

- `rw=1200` = Width 1200px
- `ra=fit` = Resize to fit

---

## Property Details

### 1. Lincoln Green Ranch (FLAGSHIP) - 84 Photos
- **VRBO ID:** 4581977
- **Address:** 5055 Lincoln Green, Midland, TX 79705
- **Features:** Pool, Pool Cabana, Playground, 6 BR, Sleeps 18
- **First Photo:** [View](https://media.vrbo.com/lodging/117000000/116090000/116086400/116086340/04f2aa7c.jpg?impolicy=resizecrop&rw=1200&ra=fit)

### 2. Adobe Compound - 76 Photos
- **VRBO ID:** 3005111
- **Address:** Golf Course Rd, Midland, TX 79705
- **Features:** Pool, Fire Pits, Billiards, 7 BR, Sleeps 16
- **First Photo:** [View](https://media.vrbo.com/lodging/86000000/85650000/85642000/85641906/02721676.jpg?impolicy=resizecrop&rw=1200&ra=fit)

### 3. Castleford Oasis - 67 Photos
- **VRBO ID:** 2636389
- **Address:** 5001 Castleford St, Midland, TX 79705
- **Features:** Pool, Billiards, 4 BR, Sleeps 10
- **First Photo:** [View](https://media.vrbo.com/lodging/78000000/77760000/77756700/77756691/1f67e295.jpg?impolicy=resizecrop&rw=1200&ra=fit)

### 4. Garfield Hot Tub - 67 Photos
- **VRBO ID:** 2634718
- **Address:** 2702 Garfield St, Midland, TX 79705
- **Features:** Hot Tub, Multiple Outdoor Spaces, 3 BR
- **First Photo:** [View](https://media.vrbo.com/lodging/78000000/77760000/77756700/77756695/005bd1d2.jpg?impolicy=resizecrop&rw=1200&ra=fit)

### 5. Santiago Dreams - 64 Photos
- **VRBO ID:** 4179271
- **Address:** 1311 Daventry, Midland, TX 79705
- **Features:** Man Cave, Two Large Yards, 4 BR, Sleeps 10
- **First Photo:** [View](https://media.vrbo.com/lodging/109000000/108890000/108886400/108886314/0e5ec6de.jpg?impolicy=resizecrop&rw=1200&ra=fit)

### 6. Douglas Old Midland - 54 Photos
- **VRBO ID:** 3355618
- **Address:** 4501 Douglas Ave, Midland, TX 79705
- **Features:** Pool, Hot Tub, Massive Yard, 4 BR, Sleeps 16
- **First Photo:** [View](https://media.vrbo.com/lodging/93000000/92640000/92637400/92637327/0c94f55f.jpg?impolicy=resizecrop&rw=1200&ra=fit)

### 7. Saddle Club - 50 Photos
- **VRBO ID:** 4750070
- **Address:** 1309 Daventry, Midland, TX 79705
- **Features:** BBQ, Children's Area, Large Yard, 4 BR, Sleeps 8+
- **First Photo:** [View](https://media.vrbo.com/lodging/120000000/119560000/119552400/119552315/052f31b4.jpg?impolicy=resizecrop&rw=1200&ra=fit)

### 8. Humble Outdoor Dream - 49 Photos
- **VRBO ID:** 4700881
- **Address:** 3106 Humble, Midland, TX 79705
- **Features:** Pool, Hot Tub, Outdoor Living, 4 BR, Sleeps 14
- **First Photo:** [View](https://media.vrbo.com/lodging/119000000/118550000/118547700/118547696/0aa0b14a.jpg?impolicy=resizecrop&rw=1200&ra=fit)

### 9. Lanham Posh & Private - 47 Photos
- **VRBO ID:** 4437486
- **Address:** 1426 Lanham, Midland, TX 79705
- **Features:** Billiards, Fireplace, Private Setting, 3 BR, Sleeps 10
- **First Photo:** [View](https://media.vrbo.com/lodging/114000000/113070000/113065500/113065438/0cb2a1b9.jpg?impolicy=resizecrop&rw=1200&ra=fit)

### 10. Storey Destination Getaway - 38 Photos
- **VRBO ID:** 2643822
- **Address:** 2103 Storey Ave, Midland, TX 79705
- **Features:** 3 BR
- **First Photo:** [View](https://media.vrbo.com/lodging/78000000/77770000/77760200/77760129/07dbc96d.jpg?impolicy=resizecrop&rw=1200&ra=fit)

### 11. Dentcrest Hot Tub Delight - 37 Photos
- **VRBO ID:** 2638481
- **Address:** 4707 Dentcrest, Midland, TX 79705
- **Features:** Hot Tub, Balcony, 3 BR, Sleeps 6
- **First Photo:** [View](https://media.vrbo.com/lodging/78000000/77760000/77756700/77756697/024c6b0e.jpg?impolicy=resizecrop&rw=1200&ra=fit)

### 12. Chelsea Retreat - 36 Photos
- **VRBO ID:** 2643784
- **Address:** 3210 Chelsea St, Midland, TX 79705
- **Features:** Covered Patio, 3 BR
- **First Photo:** [View](https://media.vrbo.com/lodging/78000000/77770000/77760200/77760125/09c94b0b.jpg?impolicy=resizecrop&rw=1200&ra=fit)

### 13. Oriole Most Marvelous - 34 Photos
- **VRBO ID:** 4471713
- **Address:** 6100 Oriole, Midland, TX 79705
- **Features:** Pool, Fireplace, 4 BR, Sleeps 8
- **First Photo:** [View](https://media.vrbo.com/lodging/114000000/113470000/113467400/113467360/0c74b5f4.jpg?impolicy=resizecrop&rw=1200&ra=fit)

### 14. Monterrey House - 27 Photos
- **VRBO ID:** 3477668
- **Address:** Monterrey St, Midland, TX 79705
- **Features:** Patio/Terrace, 3 BR, Sleeps 6
- **First Photo:** [View](https://media.vrbo.com/lodging/96000000/95660000/95654800/95654775/01f91f6f.jpg?impolicy=resizecrop&rw=1200&ra=fit)

---

*Scraped with ECHO OMEGA PRIME | Authority 11.0*
*Playwright Browser Automation | 2026-01-17*
