/**
 * Right at Home BnB - Brand Colors & Theme
 * Texas A&M Aggies inspired color palette
 * @author ECHO OMEGA PRIME
 */

export const COLORS = {
  // Primary Brand Colors
  maroon: '#500000',
  maroonDark: '#3D0000',
  maroonLight: '#722F37',

  // Accent Colors
  gold: '#C4A777',
  goldDark: '#9D8456',
  goldLight: '#D4BC92',

  // Neutral Colors
  white: '#FFFFFF',
  cream: '#F5F5F0',
  charcoal: '#2D2D2D',
  gray: '#666666',
  grayLight: '#999999',
  grayLighter: '#E5E5E5',

  // Status Colors
  success: '#4CAF50',
  successLight: '#81C784',
  warning: '#FFA500',
  warningLight: '#FFD54F',
  error: '#EF4444',
  errorLight: '#F87171',
  info: '#2196F3',
  infoLight: '#64B5F6',

  // Background Colors
  background: '#F5F5F0',
  backgroundDark: '#0A0A0A',
  surface: '#FFFFFF',
  surfaceDark: '#1A1A1A',

  // Transparent overlays
  overlay: 'rgba(0, 0, 0, 0.5)',
  overlayLight: 'rgba(0, 0, 0, 0.3)',
} as const;

export const DARK_COLORS = {
  // Primary Brand Colors (same)
  maroon: '#500000',
  maroonDark: '#3D0000',
  maroonLight: '#722F37',

  // Accent Colors (same)
  gold: '#C4A777',
  goldDark: '#9D8456',
  goldLight: '#D4BC92',

  // Inverted Neutral Colors
  white: '#0A0A0A',
  cream: '#1A1A1A',
  charcoal: '#E0E0E0',
  gray: '#B0B0B0',
  grayLight: '#808080',
  grayLighter: '#2D2D2D',

  // Status Colors (same for accessibility)
  success: '#4CAF50',
  successLight: '#81C784',
  warning: '#FFA500',
  warningLight: '#FFD54F',
  error: '#EF4444',
  errorLight: '#F87171',
  info: '#2196F3',
  infoLight: '#64B5F6',

  // Background Colors (inverted)
  background: '#0A0A0A',
  backgroundDark: '#000000',
  surface: '#1A1A1A',
  surfaceDark: '#0D0D0D',

  // Transparent overlays
  overlay: 'rgba(255, 255, 255, 0.1)',
  overlayLight: 'rgba(255, 255, 255, 0.05)',
} as const;

export type ColorTheme = typeof COLORS;
