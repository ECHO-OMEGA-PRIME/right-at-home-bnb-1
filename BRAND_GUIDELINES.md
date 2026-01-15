# Right At Home BnB - Brand Guidelines

## Texas A&M Aggies Color Scheme

### Primary Colors

| Color | Hex Code | RGB | Usage |
|-------|----------|-----|-------|
| **Aggie Maroon** | `#500000` | rgb(80, 0, 0) | Primary brand color, headers, buttons, logos |
| **White** | `#FFFFFF` | rgb(255, 255, 255) | Text on maroon, backgrounds, clean space |

### Secondary Colors

| Color | Hex Code | RGB | Usage |
|-------|----------|-----|-------|
| Maroon Dark | `#3D0000` | rgb(61, 0, 0) | Hover states, gradients, depth |
| Maroon Light | `#722F37` | rgb(114, 47, 55) | Subtle accents, borders |
| Charcoal | `#2D2D2D` | rgb(45, 45, 45) | Body text, secondary text |
| Gray | `#666666` | rgb(102, 102, 102) | Muted text, placeholders |

---

## RAH Logo

### Logo Style
- **Baseball Script Style** - Italic, bold, athletic aesthetic
- **Font**: Impact, Arial Black, or similar bold sans-serif
- **Styling**: Italic, 900 weight (extra bold)
- **Letter Spacing**: 2-6px depending on size

### Logo Components

```
┌─────────────────────────────┐
│                             │
│         ╱ ╲ ╱ ╲             │
│        ╱   ▼   ╲            │
│       │  RAH   │  ← Baseball italic lettering
│        ╲      ╱             │
│    ═════════════  ← Swoosh underline
│    RIGHT AT HOME  ← Subtitle (optional)
│                             │
└─────────────────────────────┘
```

### Logo Files

| File | Description | Use Case |
|------|-------------|----------|
| `logo-rah.svg` | Maroon logo on transparent | Light backgrounds |
| `logo-rah-white.svg` | White logo on maroon | Dark backgrounds, headers |
| `icon-rah.svg` | Square app icon | App icons, favicons |

### Logo Usage Rules

**DO:**
- Use the maroon logo on white/light backgrounds
- Use the white logo on maroon/dark backgrounds
- Maintain the italic styling
- Keep the swoosh underline intact

**DON'T:**
- Change the maroon color to any other shade
- Use a non-italic version
- Remove the swoosh
- Add drop shadows beyond the approved styling
- Distort the proportions

---

## Typography

### Primary Font Stack
```css
/* Headings - Serif for elegance */
font-family: 'Playfair Display', Georgia, serif;

/* Body - Clean sans-serif */
font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;

/* Logo - Baseball style */
font-family: 'Impact', 'Arial Black', 'Helvetica Neue Bold', sans-serif;
```

### Font Weights
- Logo: 900 (Black/Extra Bold)
- Headings: 600-700 (SemiBold to Bold)
- Body: 400-500 (Regular to Medium)

---

## Button Styles

### Primary Button (Maroon)
```css
.btn-primary {
  background-color: #500000;
  color: #FFFFFF;
  border-radius: 12px;
  padding: 12px 24px;
  font-weight: 500;
}

.btn-primary:hover {
  background-color: #722F37;
}
```

### Secondary Button (White/Outline)
```css
.btn-secondary {
  background-color: #FFFFFF;
  color: #500000;
  border: 2px solid #500000;
  border-radius: 12px;
}

.btn-secondary:hover {
  background-color: #500000;
  color: #FFFFFF;
}
```

---

## Card & Container Styles

### Standard Card
```css
.card {
  background: #FFFFFF;
  border-radius: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  border: 1px solid #F0F0F0;
}
```

### Stat Card (Maroon Gradient)
```css
.stat-card {
  background: linear-gradient(135deg, #500000 0%, #3D0000 100%);
  color: #FFFFFF;
  border-radius: 16px;
  box-shadow: 0 4px 14px rgba(80, 0, 0, 0.25);
}
```

---

## Platform-Specific

### Web (Next.js)
- CSS Variables: `--aggie-maroon: #500000;`
- Tailwind class: `bg-maroon-800`

### Mobile (React Native)
```javascript
const COLORS = {
  maroon: '#500000',
  maroonDark: '#3D0000',
  white: '#FFFFFF',
};
```

### Desktop (Electron)
```javascript
const COLORS = {
  maroon: '#500000',
  maroonLight: '#722F37',
  white: '#FFFFFF',
};
```

---

## Gig 'Em! 👍

*Right At Home BnB - Steven Palma - Midland, TX*
*Texas A&M Aggies Maroon & White Forever*
