/**
 * Right at Home BnB - Progress Bar Component
 * Animated progress indicator
 * @author ECHO OMEGA PRIME
 */

import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, ViewStyle } from 'react-native';
import { COLORS } from '../../theme/colors';

interface ProgressBarProps {
  progress: number; // 0-100
  height?: number;
  color?: string;
  backgroundColor?: string;
  showLabel?: boolean;
  labelPosition?: 'inside' | 'outside' | 'above';
  animated?: boolean;
  style?: ViewStyle;
}

export function ProgressBar({
  progress,
  height = 8,
  color = COLORS.maroon,
  backgroundColor = COLORS.grayLighter,
  showLabel = false,
  labelPosition = 'outside',
  animated = true,
  style,
}: ProgressBarProps) {
  const animatedWidth = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (animated) {
      Animated.timing(animatedWidth, {
        toValue: progress,
        duration: 500,
        useNativeDriver: false,
      }).start();
    } else {
      animatedWidth.setValue(progress);
    }
  }, [progress, animated]);

  const widthInterpolated = animatedWidth.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
    extrapolate: 'clamp',
  });

  const clampedProgress = Math.min(100, Math.max(0, progress));

  return (
    <View style={[styles.container, style]}>
      {showLabel && labelPosition === 'above' && (
        <Text style={styles.labelAbove}>{Math.round(clampedProgress)}%</Text>
      )}
      <View style={[styles.track, { height, backgroundColor }]}>
        <Animated.View
          style={[
            styles.fill,
            {
              height,
              backgroundColor: color,
              width: widthInterpolated,
            },
          ]}
        />
        {showLabel && labelPosition === 'inside' && clampedProgress > 20 && (
          <Text style={styles.labelInside}>{Math.round(clampedProgress)}%</Text>
        )}
      </View>
      {showLabel && labelPosition === 'outside' && (
        <Text style={styles.labelOutside}>{Math.round(clampedProgress)}%</Text>
      )}
    </View>
  );
}

interface TaskProgressProps {
  completed: number;
  total: number;
  label?: string;
  style?: ViewStyle;
}

export function TaskProgress({
  completed,
  total,
  label = 'Tasks',
  style,
}: TaskProgressProps) {
  const progress = total > 0 ? (completed / total) * 100 : 0;

  return (
    <View style={[styles.taskProgress, style]}>
      <View style={styles.taskHeader}>
        <Text style={styles.taskLabel}>{label}</Text>
        <Text style={styles.taskCount}>
          {completed}/{total}
        </Text>
      </View>
      <ProgressBar
        progress={progress}
        color={progress === 100 ? COLORS.success : COLORS.maroon}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  track: {
    borderRadius: 4,
    overflow: 'hidden',
    position: 'relative',
  },
  fill: {
    borderRadius: 4,
  },
  labelAbove: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.charcoal,
    marginBottom: 4,
    textAlign: 'right',
  },
  labelOutside: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.maroon,
    marginTop: 4,
    textAlign: 'right',
  },
  labelInside: {
    position: 'absolute',
    right: 8,
    top: '50%',
    transform: [{ translateY: -6 }],
    fontSize: 10,
    fontWeight: 'bold',
    color: COLORS.white,
  },
  taskProgress: {
    width: '100%',
  },
  taskHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  taskLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.charcoal,
  },
  taskCount: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.maroon,
  },
});
