/**
 * Right at Home BnB - Empty State Component
 * Display when no data is available
 * @author ECHO OMEGA PRIME
 */

import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { COLORS } from '../../theme/colors';
import { Button } from './Button';

interface EmptyStateProps {
  icon?: string;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  style?: ViewStyle;
}

export function EmptyState({
  icon = '(empty)',
  title,
  message,
  actionLabel,
  onAction,
  style,
}: EmptyStateProps) {
  return (
    <View style={[styles.container, style]}>
      <Text style={styles.icon}>{icon}</Text>
      <Text style={styles.title}>{title}</Text>
      {message && <Text style={styles.message}>{message}</Text>}
      {actionLabel && onAction && (
        <Button
          title={actionLabel}
          onPress={onAction}
          variant="outline"
          size="small"
          style={styles.button}
        />
      )}
    </View>
  );
}

interface NoJobsProps {
  onRefresh?: () => void;
  style?: ViewStyle;
}

export function NoJobs({ onRefresh, style }: NoJobsProps) {
  return (
    <EmptyState
      icon="*"
      title="No Jobs Today"
      message="You're all caught up! Enjoy your break."
      actionLabel={onRefresh ? 'Refresh' : undefined}
      onAction={onRefresh}
      style={style}
    />
  );
}

interface AllDoneProps {
  style?: ViewStyle;
}

export function AllDone({ style }: AllDoneProps) {
  return (
    <EmptyState
      icon="*"
      title="All Done!"
      message="Great work! All tasks are completed."
      style={style}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  icon: {
    fontSize: 64,
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.charcoal,
    textAlign: 'center',
    marginBottom: 8,
  },
  message: {
    fontSize: 14,
    color: COLORS.gray,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
  },
  button: {
    marginTop: 8,
  },
});
