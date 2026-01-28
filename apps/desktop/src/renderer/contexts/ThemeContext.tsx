/**
 * Right at Home BnB - Theme Context
 * ECHO Design Standards Theme System
 * Supports dark/light modes with ECHO color palette
 * @author ECHO OMEGA PRIME
 */

import React, { createContext, useContext, useEffect, useState, ReactNode, useMemo } from 'react';

// ============================================================================
// ECHO Design Standards Color System
// ============================================================================

// Core ECHO colors that remain constant across themes
const ECHO_CORE = {
  // Primary brand colors
  darkMagenta: '#8B008B',
  matrixMagenta: '#9932CC',
  echoOrange: '#FF6B35',
  cobaltBlue: '#0047AB',

  // Gradient definitions
  primaryGradient: 'linear-gradient(135deg, #8B008B, #9932CC)',
  secondaryGradient: 'linear-gradient(135deg, #FF6B35, #FF8C42)',
  accentGradient: 'linear-gradient(135deg, #0047AB, #3366CC)',

  // Semantic colors
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',
  info: '#3B82F6',
};

// Theme-specific color palettes
const DARK_THEME = {
  // Backgrounds
  background: '#0A0A0A',
  backgroundSecondary: '#111111',
  backgroundTertiary: '#1A1A1A',
  surface: 'rgba(139, 0, 139, 0.08)',
  surfaceHover: 'rgba(139, 0, 139, 0.12)',
  surfaceActive: 'rgba(139, 0, 139, 0.18)',

  // Text colors
  textPrimary: '#E0E0E0',
  textSecondary: '#A0A0A0',
  textTertiary: '#707070',
  textInverse: '#0A0A0A',

  // Borders
  border: 'rgba(139, 0, 139, 0.2)',
  borderHover: 'rgba(139, 0, 139, 0.4)',
  borderActive: 'rgba(139, 0, 139, 0.6)',

  // Shadows
  shadowSmall: '0 2px 8px rgba(0, 0, 0, 0.4)',
  shadowMedium: '0 8px 32px rgba(0, 0, 0, 0.3)',
  shadowLarge: '0 16px 48px rgba(0, 0, 0, 0.4)',
  shadowGlow: '0 0 30px rgba(139, 0, 139, 0.15)',

  // Glassmorphism
  glassBackground: 'rgba(139, 0, 139, 0.08)',
  glassBackdrop: 'blur(12px)',
  glassBorder: '1px solid rgba(139, 0, 139, 0.2)',

  // Overlays
  overlay: 'rgba(0, 0, 0, 0.8)',
  overlayLight: 'rgba(0, 0, 0, 0.5)',

  // Input fields
  inputBackground: 'rgba(139, 0, 139, 0.1)',
  inputBorder: '1px solid rgba(139, 0, 139, 0.3)',
  inputFocusBorder: '2px solid #8B008B',
  inputPlaceholder: '#606060',

  // Scrollbar
  scrollbarTrack: 'rgba(139, 0, 139, 0.1)',
  scrollbarThumb: 'rgba(139, 0, 139, 0.3)',
  scrollbarThumbHover: 'rgba(139, 0, 139, 0.5)',

  // Status backgrounds
  successBackground: 'rgba(16, 185, 129, 0.15)',
  warningBackground: 'rgba(245, 158, 11, 0.15)',
  errorBackground: 'rgba(239, 68, 68, 0.15)',
  infoBackground: 'rgba(59, 130, 246, 0.15)',

  // Accent glow effects
  magentaGlow: '0 0 20px rgba(139, 0, 139, 0.3)',
  orangeGlow: '0 0 20px rgba(255, 107, 53, 0.3)',
  blueGlow: '0 0 20px rgba(0, 71, 171, 0.3)',
};

const LIGHT_THEME = {
  // Backgrounds
  background: '#FAFAFA',
  backgroundSecondary: '#FFFFFF',
  backgroundTertiary: '#F0F0F0',
  surface: 'rgba(139, 0, 139, 0.05)',
  surfaceHover: 'rgba(139, 0, 139, 0.08)',
  surfaceActive: 'rgba(139, 0, 139, 0.12)',

  // Text colors
  textPrimary: '#1A1A1A',
  textSecondary: '#4A4A4A',
  textTertiary: '#808080',
  textInverse: '#FFFFFF',

  // Borders
  border: 'rgba(139, 0, 139, 0.15)',
  borderHover: 'rgba(139, 0, 139, 0.25)',
  borderActive: 'rgba(139, 0, 139, 0.4)',

  // Shadows
  shadowSmall: '0 2px 8px rgba(0, 0, 0, 0.08)',
  shadowMedium: '0 8px 32px rgba(0, 0, 0, 0.1)',
  shadowLarge: '0 16px 48px rgba(0, 0, 0, 0.12)',
  shadowGlow: '0 0 30px rgba(139, 0, 139, 0.1)',

  // Glassmorphism
  glassBackground: 'rgba(255, 255, 255, 0.8)',
  glassBackdrop: 'blur(12px)',
  glassBorder: '1px solid rgba(139, 0, 139, 0.15)',

  // Overlays
  overlay: 'rgba(0, 0, 0, 0.5)',
  overlayLight: 'rgba(0, 0, 0, 0.3)',

  // Input fields
  inputBackground: 'rgba(139, 0, 139, 0.05)',
  inputBorder: '1px solid rgba(139, 0, 139, 0.2)',
  inputFocusBorder: '2px solid #8B008B',
  inputPlaceholder: '#A0A0A0',

  // Scrollbar
  scrollbarTrack: 'rgba(139, 0, 139, 0.05)',
  scrollbarThumb: 'rgba(139, 0, 139, 0.2)',
  scrollbarThumbHover: 'rgba(139, 0, 139, 0.35)',

  // Status backgrounds
  successBackground: 'rgba(16, 185, 129, 0.1)',
  warningBackground: 'rgba(245, 158, 11, 0.1)',
  errorBackground: 'rgba(239, 68, 68, 0.1)',
  infoBackground: 'rgba(59, 130, 246, 0.1)',

  // Accent glow effects
  magentaGlow: '0 0 20px rgba(139, 0, 139, 0.15)',
  orangeGlow: '0 0 20px rgba(255, 107, 53, 0.15)',
  blueGlow: '0 0 20px rgba(0, 71, 171, 0.15)',
};

// ============================================================================
// Types
// ============================================================================

type ThemeMode = 'light' | 'dark' | 'system';
type ResolvedTheme = 'light' | 'dark';

interface ThemeColors {
  core: typeof ECHO_CORE;
  mode: typeof DARK_THEME;
}

interface ThemeContextType {
  // Theme state
  theme: ThemeMode;
  resolvedTheme: ResolvedTheme;
  isDark: boolean;
  isLight: boolean;

  // Colors
  colors: ThemeColors;

  // Actions
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;

  // Utility functions
  getColor: (colorKey: keyof typeof DARK_THEME) => string;
  getCoreColor: (colorKey: keyof typeof ECHO_CORE) => string;

  // Component style helpers
  getGlassStyle: (glow?: boolean) => React.CSSProperties;
  getInputStyle: () => React.CSSProperties;
  getButtonStyle: (variant?: 'primary' | 'secondary' | 'ghost') => React.CSSProperties;
  getCardStyle: (glow?: boolean) => React.CSSProperties;
}

// ============================================================================
// Context
// ============================================================================

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// ============================================================================
// Provider
// ============================================================================

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>('dark'); // Default to dark (ECHO standard)
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>('dark');

  // Load saved theme on mount
  useEffect(() => {
    const loadTheme = async () => {
      try {
        const savedTheme = await window.electronAPI?.store?.get<ThemeMode>('theme');
        if (savedTheme) {
          setThemeState(savedTheme);
        }
      } catch (error) {
        console.error('Failed to load theme:', error);
      }
    };
    loadTheme();
  }, []);

  // Resolve and apply theme
  useEffect(() => {
    const updateResolvedTheme = async () => {
      let resolved: ResolvedTheme;

      if (theme === 'system') {
        try {
          const systemTheme = await window.electronAPI?.theme?.get();
          resolved = systemTheme || 'dark';
        } catch {
          // Fallback to media query
          resolved = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        }
      } else {
        resolved = theme;
      }

      setResolvedTheme(resolved);

      // Apply theme to document
      const root = document.documentElement;
      root.classList.remove('light', 'dark');
      root.classList.add(resolved);

      // Set CSS custom properties
      const colors = resolved === 'dark' ? DARK_THEME : LIGHT_THEME;
      Object.entries(colors).forEach(([key, value]) => {
        root.style.setProperty(`--${key}`, value);
      });

      // Set core ECHO colors
      Object.entries(ECHO_CORE).forEach(([key, value]) => {
        root.style.setProperty(`--echo-${key}`, value);
      });

      // Set meta theme color
      const metaThemeColor = document.querySelector('meta[name="theme-color"]');
      if (metaThemeColor) {
        metaThemeColor.setAttribute('content', colors.background);
      }
    };

    updateResolvedTheme();

    // Listen for system theme changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      if (theme === 'system') {
        updateResolvedTheme();
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme]);

  // Set theme with persistence
  const setTheme = async (newTheme: ThemeMode) => {
    setThemeState(newTheme);
    try {
      await window.electronAPI?.store?.set('theme', newTheme);
      await window.electronAPI?.theme?.set(newTheme);
    } catch (error) {
      console.error('Failed to save theme:', error);
    }
  };

  // Toggle between light and dark
  const toggleTheme = () => {
    const newTheme = resolvedTheme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
  };

  // Memoized colors
  const colors = useMemo<ThemeColors>(() => ({
    core: ECHO_CORE,
    mode: resolvedTheme === 'dark' ? DARK_THEME : LIGHT_THEME,
  }), [resolvedTheme]);

  // Color getters
  const getColor = (colorKey: keyof typeof DARK_THEME): string => {
    return colors.mode[colorKey];
  };

  const getCoreColor = (colorKey: keyof typeof ECHO_CORE): string => {
    return colors.core[colorKey];
  };

  // Style helpers
  const getGlassStyle = (glow = false): React.CSSProperties => ({
    background: colors.mode.glassBackground,
    backdropFilter: colors.mode.glassBackdrop,
    WebkitBackdropFilter: colors.mode.glassBackdrop,
    border: colors.mode.glassBorder,
    boxShadow: glow
      ? `${colors.mode.shadowGlow}, ${colors.mode.shadowMedium}`
      : colors.mode.shadowMedium,
  });

  const getInputStyle = (): React.CSSProperties => ({
    background: colors.mode.inputBackground,
    border: colors.mode.inputBorder,
    color: colors.mode.textPrimary,
  });

  const getButtonStyle = (variant: 'primary' | 'secondary' | 'ghost' = 'primary'): React.CSSProperties => {
    switch (variant) {
      case 'primary':
        return {
          background: colors.core.primaryGradient,
          color: '#FFFFFF',
          border: 'none',
          boxShadow: `0 4px 15px rgba(139, 0, 139, 0.3)`,
        };
      case 'secondary':
        return {
          background: colors.mode.inputBackground,
          color: colors.mode.textPrimary,
          border: colors.mode.inputBorder,
        };
      case 'ghost':
        return {
          background: 'transparent',
          color: colors.mode.textPrimary,
          border: 'none',
        };
    }
  };

  const getCardStyle = (glow = false): React.CSSProperties => ({
    background: colors.mode.glassBackground,
    backdropFilter: colors.mode.glassBackdrop,
    WebkitBackdropFilter: colors.mode.glassBackdrop,
    border: colors.mode.glassBorder,
    borderRadius: '12px',
    boxShadow: glow ? colors.mode.shadowGlow : colors.mode.shadowMedium,
  });

  const contextValue: ThemeContextType = {
    theme,
    resolvedTheme,
    isDark: resolvedTheme === 'dark',
    isLight: resolvedTheme === 'light',
    colors,
    setTheme,
    toggleTheme,
    getColor,
    getCoreColor,
    getGlassStyle,
    getInputStyle,
    getButtonStyle,
    getCardStyle,
  };

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
}

// ============================================================================
// Hook
// ============================================================================

export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

// ============================================================================
// Exports
// ============================================================================

// Export color constants for use outside React components
export const ECHO_COLORS = {
  ...ECHO_CORE,
  dark: DARK_THEME,
  light: LIGHT_THEME,
};

// Export theme types
export type { ThemeMode, ResolvedTheme, ThemeColors, ThemeContextType };
