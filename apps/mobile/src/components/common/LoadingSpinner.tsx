/**
 * Right at Home BnB - Loading Spinner Component
 * Full screen and inline loading indicators
 * @author ECHO OMEGA PRIME
 */

import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet, ViewStyle } from 'react-native';
import { COLORS } from '../../theme/colors';

interface LoadingSpinnerProps {
  message?: string;
  color?: string;
  size?: 'small' | 'large';
  style?: ViewStyle;
}

export function LoadingSpinner({
  message,
  color = COLORS.maroon,
  size = 'large',
  style,
}: LoadingSpinnerProps) {
  return (
    <View style={[styles.container, style]}>
      <ActivityIndicator size={size} color={color} />
      {message && <Text style={styles.message}>{message}</Text>}
    </View>
  );
}

interface FullScreenLoaderProps {
  message?: string;
  brandedBackground?: boolean;
}

export function FullScreenLoader({
  message = 'Loading...',
  brandedBackground = false,
}: FullScreenLoaderProps) {
  return (
    <View
      style={[
        styles.fullScreen,
        brandedBackground && styles.brandedBackground,
      ]}
    >
      {brandedBackground && (
        <>
          <Text style={styles.brandIcon}>*</Text>
          <Text style={styles.brandTitle}>Right at Home BnB</Text>
        </>
      )}
      <ActivityIndicator
        size="large"
        color={brandedBackground ? COLORS.gold : COLORS.maroon}
      />
      <Text
        style={[
          styles.fullScreenMessage,
          brandedBackground && styles.brandedMessage,
        ]}
      >
        {message}
      </Text>
    </View>
  );
}

interface InlineLoaderProps {
  message?: string;
  style?: ViewStyle;
}

export function InlineLoader({ message, style }: InlineLoaderProps) {
  return (
    <View style={[styles.inline, style]}>
      <ActivityIndicator size="small" color={COLORS.maroon} />
      {message && <Text style={styles.inlineMessage}>{message}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  message: {
    marginTop: 12,
    fontSize: 14,
    color: COLORS.gray,
    textAlign: 'center',
  },

  // Full screen
  fullScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.cream,
  },
  brandedBackground: {
    backgroundColor: COLORS.maroon,
  },
  brandIcon: {
    fontSize: 48,
    marginBottom: 12,
    color: COLORS.white,
  },
  brandTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.white,
    marginBottom: 24,
  },
  fullScreenMessage: {
    marginTop: 16,
    fontSize: 16,
    color: COLORS.gray,
  },
  brandedMessage: {
    color: COLORS.white,
    opacity: 0.9,
  },

  // Inline
  inline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
    gap: 8,
  },
  inlineMessage: {
    fontSize: 13,
    color: COLORS.gray,
  },
});
