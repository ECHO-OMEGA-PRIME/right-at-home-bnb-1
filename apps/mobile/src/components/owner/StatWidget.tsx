/**
 * StatWidget Component
 * Metric display widget with various styles
 * @author ECHO OMEGA PRIME
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ViewStyle,
} from 'react-native';
import { COLORS } from '../../theme/colors';

export interface StatWidgetProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: string;
  trend?: {
    value: number;
    direction: 'up' | 'down' | 'neutral';
    label?: string;
  };
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'gradient';
  size?: 'small' | 'medium' | 'large';
  onPress?: () => void;
  style?: ViewStyle;
}

const variantStyles = {
  default: {
    background: COLORS.white,
    titleColor: COLORS.gray,
    valueColor: COLORS.charcoal,
  },
  primary: {
    background: COLORS.maroon,
    titleColor: COLORS.white + '90',
    valueColor: COLORS.white,
  },
  success: {
    background: COLORS.success + '15',
    titleColor: COLORS.charcoal,
    valueColor: COLORS.success,
  },
  warning: {
    background: COLORS.warning + '15',
    titleColor: COLORS.charcoal,
    valueColor: COLORS.warning,
  },
  gradient: {
    background: COLORS.maroon,
    titleColor: COLORS.white + '90',
    valueColor: COLORS.gold,
  },
};

const sizeStyles = {
  small: {
    padding: 12,
    iconSize: 20,
    titleSize: 11,
    valueSize: 18,
    subtitleSize: 10,
  },
  medium: {
    padding: 16,
    iconSize: 28,
    titleSize: 12,
    valueSize: 24,
    subtitleSize: 11,
  },
  large: {
    padding: 20,
    iconSize: 36,
    titleSize: 14,
    valueSize: 32,
    subtitleSize: 12,
  },
};

export function StatWidget({
  title,
  value,
  subtitle,
  icon,
  trend,
  variant = 'default',
  size = 'medium',
  onPress,
  style,
}: StatWidgetProps) {
  const colors = variantStyles[variant];
  const sizes = sizeStyles[size];

  const trendColor =
    trend?.direction === 'up'
      ? COLORS.success
      : trend?.direction === 'down'
      ? COLORS.error
      : COLORS.gray;

  const trendIcon =
    trend?.direction === 'up'
      ? '↑'
      : trend?.direction === 'down'
      ? '↓'
      : '→';

  const content = (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.background,
          padding: sizes.padding,
        },
        variant === 'gradient' && styles.gradientOverlay,
        style,
      ]}
    >
      {icon && (
        <Text style={[styles.icon, { fontSize: sizes.iconSize }]}>{icon}</Text>
      )}

      <Text
        style={[
          styles.title,
          { color: colors.titleColor, fontSize: sizes.titleSize },
        ]}
      >
        {title}
      </Text>

      <View style={styles.valueRow}>
        <Text
          style={[
            styles.value,
            { color: colors.valueColor, fontSize: sizes.valueSize },
          ]}
        >
          {value}
        </Text>

        {trend && (
          <View
            style={[
              styles.trendBadge,
              { backgroundColor: trendColor + '20' },
            ]}
          >
            <Text style={[styles.trendText, { color: trendColor }]}>
              {trendIcon} {Math.abs(trend.value)}%
            </Text>
          </View>
        )}
      </View>

      {subtitle && (
        <Text
          style={[
            styles.subtitle,
            {
              color: variant === 'primary' || variant === 'gradient'
                ? COLORS.white + '70'
                : COLORS.gray,
              fontSize: sizes.subtitleSize,
            },
          ]}
        >
          {subtitle}
        </Text>
      )}

      {trend?.label && (
        <Text
          style={[
            styles.trendLabel,
            {
              color: variant === 'primary' || variant === 'gradient'
                ? COLORS.white + '60'
                : COLORS.grayLight,
            },
          ]}
        >
          {trend.label}
        </Text>
      )}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
        {content}
      </TouchableOpacity>
    );
  }

  return content;
}

// Grid layout helper
export function StatGrid({
  children,
  columns = 2,
}: {
  children: React.ReactNode;
  columns?: 2 | 3 | 4;
}) {
  return (
    <View style={[styles.grid, columns === 3 && styles.grid3, columns === 4 && styles.grid4]}>
      {children}
    </View>
  );
}

// Large stat card for hero metrics
export function HeroStat({
  title,
  value,
  subtitle,
  icon,
  trend,
  onPress,
}: Omit<StatWidgetProps, 'variant' | 'size'>) {
  return (
    <StatWidget
      title={title}
      value={value}
      subtitle={subtitle}
      icon={icon}
      trend={trend}
      variant="gradient"
      size="large"
      onPress={onPress}
      style={styles.heroStat}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  gradientOverlay: {
    backgroundColor: COLORS.maroon,
    shadowColor: COLORS.maroon,
    shadowOpacity: 0.25,
  },
  icon: {
    marginBottom: 8,
  },
  title: {
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  value: {
    fontWeight: '700',
  },
  trendBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  trendText: {
    fontSize: 11,
    fontWeight: '600',
  },
  subtitle: {
    marginTop: 4,
  },
  trendLabel: {
    fontSize: 10,
    marginTop: 8,
  },

  // Grid layouts
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    paddingHorizontal: 16,
  },
  grid3: {
    gap: 8,
  },
  grid4: {
    gap: 6,
  },

  heroStat: {
    marginHorizontal: 16,
    marginBottom: 16,
  },
});

export default StatWidget;
