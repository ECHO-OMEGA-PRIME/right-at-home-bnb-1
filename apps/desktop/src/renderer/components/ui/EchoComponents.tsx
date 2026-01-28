/**
 * Right at Home BnB - ECHO Design System UI Components
 * Theme-aware components with ECHO Design Standards
 * @author ECHO OMEGA PRIME
 */

import React, { forwardRef } from 'react';
import { motion, HTMLMotionProps } from 'framer-motion';
import { useTheme, ECHO_COLORS } from '../../contexts/ThemeContext';
import { Sun, Moon, Monitor } from 'lucide-react';

// ============================================================================
// Glass Card Component
// ============================================================================

interface GlassCardProps extends HTMLMotionProps<'div'> {
  children: React.ReactNode;
  glow?: boolean;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  hover?: boolean;
}

export const GlassCard = forwardRef<HTMLDivElement, GlassCardProps>(
  ({ children, glow = false, padding = 'md', hover = false, className = '', style, ...props }, ref) => {
    const { colors } = useTheme();

    const paddingMap = {
      none: '0',
      sm: '12px',
      md: '16px',
      lg: '24px',
    };

    return (
      <motion.div
        ref={ref}
        className={`rounded-xl ${className}`}
        style={{
          background: colors.mode.glassBackground,
          backdropFilter: colors.mode.glassBackdrop,
          WebkitBackdropFilter: colors.mode.glassBackdrop,
          border: colors.mode.glassBorder,
          boxShadow: glow
            ? `${colors.mode.shadowGlow}, ${colors.mode.shadowMedium}`
            : colors.mode.shadowMedium,
          padding: paddingMap[padding],
          ...style,
        }}
        whileHover={hover ? { scale: 1.02, boxShadow: colors.mode.shadowGlow } : undefined}
        {...props}
      >
        {children}
      </motion.div>
    );
  }
);

GlassCard.displayName = 'GlassCard';

// ============================================================================
// Button Component
// ============================================================================

interface ButtonProps extends HTMLMotionProps<'button'> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      variant = 'primary',
      size = 'md',
      fullWidth = false,
      loading = false,
      icon,
      iconPosition = 'left',
      className = '',
      disabled,
      style,
      ...props
    },
    ref
  ) => {
    const { colors } = useTheme();

    const sizeStyles = {
      sm: { padding: '8px 16px', fontSize: '14px' },
      md: { padding: '12px 24px', fontSize: '15px' },
      lg: { padding: '16px 32px', fontSize: '16px' },
    };

    const variantStyles = {
      primary: {
        background: colors.core.primaryGradient,
        color: '#FFFFFF',
        border: 'none',
        boxShadow: '0 4px 15px rgba(139, 0, 139, 0.3)',
      },
      secondary: {
        background: colors.mode.inputBackground,
        color: colors.mode.textPrimary,
        border: colors.mode.inputBorder,
      },
      ghost: {
        background: 'transparent',
        color: colors.mode.textPrimary,
        border: 'none',
      },
      danger: {
        background: colors.core.error,
        color: '#FFFFFF',
        border: 'none',
        boxShadow: '0 4px 15px rgba(239, 68, 68, 0.3)',
      },
    };

    return (
      <motion.button
        ref={ref}
        className={`rounded-lg font-medium transition-all ${fullWidth ? 'w-full' : ''} ${className}`}
        style={{
          ...variantStyles[variant],
          ...sizeStyles[size],
          opacity: disabled || loading ? 0.6 : 1,
          cursor: disabled || loading ? 'not-allowed' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          ...style,
        }}
        disabled={disabled || loading}
        whileHover={!disabled && !loading ? { scale: 1.02 } : undefined}
        whileTap={!disabled && !loading ? { scale: 0.98 } : undefined}
        {...props}
      >
        {loading ? (
          <motion.div
            className="w-5 h-5 border-2 border-current border-t-transparent rounded-full"
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          />
        ) : (
          <>
            {icon && iconPosition === 'left' && icon}
            {children}
            {icon && iconPosition === 'right' && icon}
          </>
        )}
      </motion.button>
    );
  }
);

Button.displayName = 'Button';

// ============================================================================
// Input Component
// ============================================================================

interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string;
  error?: string;
  hint?: string;
  icon?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, icon, size = 'md', className = '', style, ...props }, ref) => {
    const { colors } = useTheme();

    const sizeStyles = {
      sm: { padding: '8px 12px', fontSize: '14px' },
      md: { padding: '12px 16px', fontSize: '15px' },
      lg: { padding: '16px 20px', fontSize: '16px' },
    };

    return (
      <div className={`space-y-1 ${className}`}>
        {label && (
          <label
            className="block text-sm font-medium mb-1"
            style={{ color: colors.mode.textSecondary }}
          >
            {label}
          </label>
        )}
        <div className="relative">
          {icon && (
            <div
              className="absolute left-3 top-1/2 -translate-y-1/2"
              style={{ color: colors.mode.textSecondary }}
            >
              {icon}
            </div>
          )}
          <input
            ref={ref}
            className={`w-full rounded-lg focus:outline-none focus:ring-2 transition-all ${icon ? 'pl-10' : ''}`}
            style={{
              background: colors.mode.inputBackground,
              border: error ? `2px solid ${colors.core.error}` : colors.mode.inputBorder,
              color: colors.mode.textPrimary,
              ...sizeStyles[size],
              ...style,
            }}
            {...props}
          />
        </div>
        {error && (
          <p className="text-sm" style={{ color: colors.core.error }}>
            {error}
          </p>
        )}
        {hint && !error && (
          <p className="text-sm" style={{ color: colors.mode.textTertiary }}>
            {hint}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

// ============================================================================
// Select Component
// ============================================================================

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: { value: string; label: string }[];
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, options, className = '', style, ...props }, ref) => {
    const { colors } = useTheme();

    return (
      <div className={`space-y-1 ${className}`}>
        {label && (
          <label
            className="block text-sm font-medium mb-1"
            style={{ color: colors.mode.textSecondary }}
          >
            {label}
          </label>
        )}
        <select
          ref={ref}
          className="w-full px-4 py-3 rounded-lg focus:outline-none focus:ring-2 transition-all"
          style={{
            background: colors.mode.inputBackground,
            border: error ? `2px solid ${colors.core.error}` : colors.mode.inputBorder,
            color: colors.mode.textPrimary,
            ...style,
          }}
          {...props}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {error && (
          <p className="text-sm" style={{ color: colors.core.error }}>
            {error}
          </p>
        )}
      </div>
    );
  }
);

Select.displayName = 'Select';

// ============================================================================
// Badge Component
// ============================================================================

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info';
  size?: 'sm' | 'md';
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'default',
  size = 'md',
  className = '',
}) => {
  const { colors } = useTheme();

  const variantStyles = {
    default: {
      background: colors.mode.surface,
      color: colors.mode.textPrimary,
      border: colors.mode.border,
    },
    success: {
      background: colors.mode.successBackground,
      color: colors.core.success,
      border: 'transparent',
    },
    warning: {
      background: colors.mode.warningBackground,
      color: colors.core.warning,
      border: 'transparent',
    },
    error: {
      background: colors.mode.errorBackground,
      color: colors.core.error,
      border: 'transparent',
    },
    info: {
      background: colors.mode.infoBackground,
      color: colors.core.info,
      border: 'transparent',
    },
  };

  const sizeStyles = {
    sm: { padding: '2px 8px', fontSize: '12px' },
    md: { padding: '4px 12px', fontSize: '13px' },
  };

  const styles = variantStyles[variant];

  return (
    <span
      className={`inline-flex items-center rounded-full font-medium ${className}`}
      style={{
        background: styles.background,
        color: styles.color,
        border: styles.border !== 'transparent' ? `1px solid ${styles.border}` : 'none',
        ...sizeStyles[size],
      }}
    >
      {children}
    </span>
  );
};

// ============================================================================
// Theme Toggle Component
// ============================================================================

interface ThemeToggleProps {
  showLabel?: boolean;
  variant?: 'icon' | 'buttons' | 'select';
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({
  showLabel = false,
  variant = 'buttons',
}) => {
  const { theme, setTheme, colors } = useTheme();

  if (variant === 'icon') {
    return (
      <motion.button
        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        className="p-2 rounded-lg"
        style={{ background: colors.mode.surface }}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
      >
        {theme === 'dark' ? (
          <Sun className="w-5 h-5" style={{ color: colors.core.echoOrange }} />
        ) : (
          <Moon className="w-5 h-5" style={{ color: colors.core.darkMagenta }} />
        )}
      </motion.button>
    );
  }

  if (variant === 'select') {
    return (
      <div className="flex items-center gap-3">
        {showLabel && (
          <span className="text-sm font-medium" style={{ color: colors.mode.textSecondary }}>
            Theme
          </span>
        )}
        <select
          value={theme}
          onChange={(e) => setTheme(e.target.value as 'light' | 'dark' | 'system')}
          className="px-3 py-2 rounded-lg"
          style={{
            background: colors.mode.inputBackground,
            border: colors.mode.inputBorder,
            color: colors.mode.textPrimary,
          }}
        >
          <option value="light">Light</option>
          <option value="dark">Dark</option>
          <option value="system">System</option>
        </select>
      </div>
    );
  }

  // Default: buttons variant
  return (
    <div className="flex items-center gap-2">
      {showLabel && (
        <span className="text-sm font-medium mr-2" style={{ color: colors.mode.textSecondary }}>
          Theme
        </span>
      )}
      <GlassCard padding="none" className="flex p-1">
        {[
          { value: 'light' as const, icon: <Sun className="w-4 h-4" />, label: 'Light' },
          { value: 'dark' as const, icon: <Moon className="w-4 h-4" />, label: 'Dark' },
          { value: 'system' as const, icon: <Monitor className="w-4 h-4" />, label: 'System' },
        ].map((option) => (
          <motion.button
            key={option.value}
            onClick={() => setTheme(option.value)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg"
            style={{
              background: theme === option.value ? colors.core.darkMagenta : 'transparent',
              color: theme === option.value ? '#fff' : colors.mode.textSecondary,
            }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            {option.icon}
            <span className="text-sm">{option.label}</span>
          </motion.button>
        ))}
      </GlassCard>
    </div>
  );
};

// ============================================================================
// Loading Spinner Component
// ============================================================================

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  color?: string;
}

export const Spinner: React.FC<SpinnerProps> = ({ size = 'md', color }) => {
  const { colors } = useTheme();

  const sizeMap = {
    sm: 'w-4 h-4 border-2',
    md: 'w-6 h-6 border-2',
    lg: 'w-8 h-8 border-3',
  };

  return (
    <motion.div
      className={`${sizeMap[size]} border-t-transparent rounded-full`}
      style={{ borderColor: color || colors.core.darkMagenta }}
      animate={{ rotate: 360 }}
      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
    />
  );
};

// ============================================================================
// Progress Bar Component
// ============================================================================

interface ProgressBarProps {
  value: number;
  max?: number;
  showLabel?: boolean;
  color?: 'primary' | 'success' | 'warning' | 'error';
  size?: 'sm' | 'md' | 'lg';
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  value,
  max = 100,
  showLabel = false,
  color = 'primary',
  size = 'md',
}) => {
  const { colors } = useTheme();
  const percentage = Math.min((value / max) * 100, 100);

  const colorMap = {
    primary: colors.core.primaryGradient,
    success: colors.core.success,
    warning: colors.core.warning,
    error: colors.core.error,
  };

  const sizeMap = {
    sm: 'h-1',
    md: 'h-2',
    lg: 'h-3',
  };

  return (
    <div className="w-full">
      {showLabel && (
        <div className="flex justify-between text-sm mb-1" style={{ color: colors.mode.textSecondary }}>
          <span>{Math.round(percentage)}%</span>
        </div>
      )}
      <div
        className={`w-full rounded-full overflow-hidden ${sizeMap[size]}`}
        style={{ background: colors.mode.surface }}
      >
        <motion.div
          className={`h-full rounded-full`}
          style={{ background: colorMap[color] }}
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
      </div>
    </div>
  );
};

// ============================================================================
// Avatar Component
// ============================================================================

interface AvatarProps {
  src?: string;
  alt?: string;
  name?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export const Avatar: React.FC<AvatarProps> = ({
  src,
  alt,
  name,
  size = 'md',
  className = '',
}) => {
  const { colors } = useTheme();

  const sizeMap = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-12 h-12 text-base',
    xl: 'w-16 h-16 text-lg',
  };

  const initials = name
    ? name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : '?';

  if (src) {
    return (
      <img
        src={src}
        alt={alt || name || 'Avatar'}
        className={`rounded-full object-cover ${sizeMap[size]} ${className}`}
        style={{ border: colors.mode.glassBorder }}
      />
    );
  }

  return (
    <div
      className={`rounded-full flex items-center justify-center font-medium ${sizeMap[size]} ${className}`}
      style={{
        background: colors.core.primaryGradient,
        color: '#FFFFFF',
      }}
    >
      {initials}
    </div>
  );
};

// ============================================================================
// Divider Component
// ============================================================================

interface DividerProps {
  orientation?: 'horizontal' | 'vertical';
  className?: string;
}

export const Divider: React.FC<DividerProps> = ({
  orientation = 'horizontal',
  className = '',
}) => {
  const { colors } = useTheme();

  if (orientation === 'vertical') {
    return (
      <div
        className={`w-px h-full ${className}`}
        style={{ background: colors.mode.border }}
      />
    );
  }

  return (
    <div
      className={`w-full h-px ${className}`}
      style={{ background: colors.mode.border }}
    />
  );
};

// ============================================================================
// Exports
// ============================================================================

export { ECHO_COLORS };
