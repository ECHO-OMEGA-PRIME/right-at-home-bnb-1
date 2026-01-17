/**
 * Right at Home BnB - Badge Component
 * Status badges and labels
 * @author ECHO OMEGA PRIME
 */

import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { COLORS } from '../../theme/colors';

type BadgeVariant =
  | 'default'
  | 'success'
  | 'warning'
  | 'error'
  | 'info'
  | 'maroon'
  | 'gold';

interface BadgeProps {
  text: string;
  variant?: BadgeVariant;
  size?: 'small' | 'medium';
  icon?: string;
  style?: ViewStyle;
}

export function Badge({
  text,
  variant = 'default',
  size = 'medium',
  icon,
  style,
}: BadgeProps) {
  return (
    <View style={[styles.badge, styles[variant], styles[size], style]}>
      {icon && <Text style={styles.icon}>{icon}</Text>}
      <Text style={[styles.text, styles[`${variant}Text` as keyof typeof styles]]}>
        {text}
      </Text>
    </View>
  );
}

interface StatusBadgeProps {
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled' | 'urgent';
  style?: ViewStyle;
}

export function StatusBadge({ status, style }: StatusBadgeProps) {
  const config: Record<string, { text: string; variant: BadgeVariant }> = {
    scheduled: { text: 'SCHEDULED', variant: 'default' },
    in_progress: { text: 'IN PROGRESS', variant: 'warning' },
    completed: { text: 'COMPLETED', variant: 'success' },
    cancelled: { text: 'CANCELLED', variant: 'error' },
    urgent: { text: 'URGENT', variant: 'error' },
  };

  const { text, variant } = config[status] || config.scheduled;

  return <Badge text={text} variant={variant} size="small" style={style} />;
}

interface NotificationBadgeProps {
  count: number;
  style?: ViewStyle;
}

export function NotificationBadge({ count, style }: NotificationBadgeProps) {
  if (count <= 0) return null;

  return (
    <View style={[styles.notificationBadge, style]}>
      <Text style={styles.notificationText}>
        {count > 99 ? '99+' : count}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    gap: 4,
  },

  // Sizes
  small: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  medium: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },

  // Variants
  default: {
    backgroundColor: COLORS.grayLighter,
  },
  success: {
    backgroundColor: '#E8F5E9',
  },
  warning: {
    backgroundColor: '#FFF3E0',
  },
  error: {
    backgroundColor: '#FEE2E2',
  },
  info: {
    backgroundColor: '#E3F2FD',
  },
  maroon: {
    backgroundColor: `${COLORS.maroon}15`,
  },
  gold: {
    backgroundColor: `${COLORS.gold}30`,
  },

  // Text colors
  text: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  defaultText: {
    color: COLORS.gray,
  },
  successText: {
    color: '#2E7D32',
  },
  warningText: {
    color: '#E65100',
  },
  errorText: {
    color: '#C62828',
  },
  infoText: {
    color: '#1565C0',
  },
  maroonText: {
    color: COLORS.maroon,
  },
  goldText: {
    color: COLORS.goldDark,
  },

  icon: {
    fontSize: 12,
  },

  // Notification badge
  notificationBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: COLORS.error,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  notificationText: {
    color: COLORS.white,
    fontSize: 11,
    fontWeight: 'bold',
  },
});
