/**
 * Right at Home BnB - Stat Card Component
 * Display statistics with icon, value, and label
 * @author ECHO OMEGA PRIME
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ViewStyle } from 'react-native';
import { COLORS } from '../../theme/colors';

interface StatCardProps {
  icon: string;
  value: string | number;
  label: string;
  subValue?: string;
  highlight?: boolean;
  onPress?: () => void;
  style?: ViewStyle;
  compact?: boolean;
}

export function StatCard({
  icon,
  value,
  label,
  subValue,
  highlight = false,
  onPress,
  style,
  compact = false,
}: StatCardProps) {
  const content = (
    <View
      style={[
        styles.card,
        highlight && styles.cardHighlight,
        compact && styles.cardCompact,
        style,
      ]}
    >
      <Text style={[styles.icon, compact && styles.iconCompact]}>{icon}</Text>
      <Text
        style={[
          styles.value,
          highlight && styles.valueHighlight,
          compact && styles.valueCompact,
        ]}
      >
        {value}
      </Text>
      <Text style={[styles.label, compact && styles.labelCompact]}>{label}</Text>
      {subValue && <Text style={styles.subValue}>{subValue}</Text>}
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

interface QuickStatProps {
  label: string;
  value: string | number;
  icon?: string;
  trend?: 'up' | 'down' | 'neutral';
  style?: ViewStyle;
}

export function QuickStat({ label, value, icon, trend, style }: QuickStatProps) {
  return (
    <View style={[styles.quickStat, style]}>
      {icon && <Text style={styles.quickStatIcon}>{icon}</Text>}
      <View>
        <Text style={styles.quickStatValue}>{value}</Text>
        <Text style={styles.quickStatLabel}>{label}</Text>
      </View>
      {trend && (
        <Text
          style={[
            styles.trend,
            trend === 'up' && styles.trendUp,
            trend === 'down' && styles.trendDown,
          ]}
        >
          {trend === 'up' ? '+' : trend === 'down' ? '-' : ''}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardCompact: {
    padding: 12,
    minWidth: 'auto',
  },
  cardHighlight: {
    borderWidth: 2,
    borderColor: COLORS.gold,
  },
  icon: {
    fontSize: 24,
    marginBottom: 8,
  },
  iconCompact: {
    fontSize: 20,
    marginBottom: 4,
  },
  value: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.maroon,
  },
  valueCompact: {
    fontSize: 18,
  },
  valueHighlight: {
    color: COLORS.gold,
  },
  label: {
    fontSize: 12,
    color: COLORS.gray,
    marginTop: 4,
    textAlign: 'center',
  },
  labelCompact: {
    fontSize: 10,
  },
  subValue: {
    fontSize: 10,
    color: COLORS.grayLight,
    marginTop: 2,
  },

  // Quick stat styles
  quickStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.white,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  quickStatIcon: {
    fontSize: 18,
  },
  quickStatValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.charcoal,
  },
  quickStatLabel: {
    fontSize: 10,
    color: COLORS.gray,
  },
  trend: {
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 'auto',
  },
  trendUp: {
    color: COLORS.success,
  },
  trendDown: {
    color: COLORS.error,
  },
});
