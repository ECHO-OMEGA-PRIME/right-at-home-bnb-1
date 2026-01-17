/**
 * Right at Home BnB - Avatar Component
 * User avatar with fallback to initials
 * @author ECHO OMEGA PRIME
 */

import React from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity, ViewStyle } from 'react-native';
import { COLORS } from '../../theme/colors';

type AvatarSize = 'small' | 'medium' | 'large' | 'xlarge';

interface AvatarProps {
  uri?: string | null;
  name?: string;
  size?: AvatarSize;
  onPress?: () => void;
  showBadge?: boolean;
  badgeIcon?: string;
  style?: ViewStyle;
}

export function Avatar({
  uri,
  name = '',
  size = 'medium',
  onPress,
  showBadge = false,
  badgeIcon = '+',
  style,
}: AvatarProps) {
  const initials = name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const sizeStyles = {
    small: { width: 32, height: 32, borderRadius: 16, fontSize: 12 },
    medium: { width: 48, height: 48, borderRadius: 24, fontSize: 16 },
    large: { width: 64, height: 64, borderRadius: 32, fontSize: 20 },
    xlarge: { width: 90, height: 90, borderRadius: 45, fontSize: 32 },
  };

  const { width, height, borderRadius, fontSize } = sizeStyles[size];

  const content = (
    <View style={[styles.container, style]}>
      {uri ? (
        <Image
          source={{ uri }}
          style={[
            styles.image,
            { width, height, borderRadius },
          ]}
        />
      ) : (
        <View
          style={[
            styles.placeholder,
            { width, height, borderRadius },
          ]}
        >
          <Text style={[styles.initials, { fontSize }]}>{initials || '?'}</Text>
        </View>
      )}
      {showBadge && (
        <View
          style={[
            styles.badge,
            {
              width: width * 0.35,
              height: width * 0.35,
              borderRadius: width * 0.175,
            },
          ]}
        >
          <Text style={[styles.badgeText, { fontSize: width * 0.2 }]}>
            {badgeIcon}
          </Text>
        </View>
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

interface AvatarGroupProps {
  avatars: Array<{ uri?: string; name: string }>;
  max?: number;
  size?: AvatarSize;
  style?: ViewStyle;
}

export function AvatarGroup({
  avatars,
  max = 4,
  size = 'small',
  style,
}: AvatarGroupProps) {
  const displayed = avatars.slice(0, max);
  const remaining = avatars.length - max;

  const sizeOffset = {
    small: -8,
    medium: -12,
    large: -16,
    xlarge: -20,
  };

  return (
    <View style={[styles.group, style]}>
      {displayed.map((avatar, index) => (
        <View
          key={index}
          style={[
            styles.groupItem,
            index > 0 && { marginLeft: sizeOffset[size] },
          ]}
        >
          <Avatar uri={avatar.uri} name={avatar.name} size={size} />
        </View>
      ))}
      {remaining > 0 && (
        <View
          style={[
            styles.remaining,
            { marginLeft: sizeOffset[size] },
          ]}
        >
          <Text style={styles.remainingText}>+{remaining}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  image: {
    borderWidth: 2,
    borderColor: COLORS.white,
  },
  placeholder: {
    backgroundColor: COLORS.maroon,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: COLORS.gold,
  },
  initials: {
    fontWeight: 'bold',
    color: COLORS.white,
  },
  badge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: COLORS.gold,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: COLORS.white,
  },
  badgeText: {
    color: COLORS.charcoal,
    fontWeight: 'bold',
  },

  // Avatar Group
  group: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  groupItem: {
    zIndex: 1,
  },
  remaining: {
    backgroundColor: COLORS.grayLighter,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: COLORS.white,
    zIndex: 0,
  },
  remainingText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.gray,
  },
});
