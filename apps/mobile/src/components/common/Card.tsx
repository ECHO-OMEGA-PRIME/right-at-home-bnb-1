/**
 * Right at Home BnB - Card Component
 * Reusable card with consistent styling
 * @author ECHO OMEGA PRIME
 */

import React from 'react';
import { View, StyleSheet, TouchableOpacity, ViewStyle } from 'react-native';
import { COLORS } from '../../theme/colors';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  onPress?: () => void;
  variant?: 'default' | 'elevated' | 'outlined';
  padding?: number;
}

export function Card({
  children,
  style,
  onPress,
  variant = 'default',
  padding = 16,
}: CardProps) {
  const cardStyle = [
    styles.card,
    variant === 'elevated' && styles.elevated,
    variant === 'outlined' && styles.outlined,
    { padding },
    style,
  ];

  if (onPress) {
    return (
      <TouchableOpacity style={cardStyle} onPress={onPress} activeOpacity={0.7}>
        {children}
      </TouchableOpacity>
    );
  }

  return <View style={cardStyle}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  elevated: {
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  outlined: {
    shadowOpacity: 0,
    elevation: 0,
    borderWidth: 1,
    borderColor: COLORS.grayLighter,
  },
});
