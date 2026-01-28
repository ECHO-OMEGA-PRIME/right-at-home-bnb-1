/**
 * PhotoCarousel Component
 * Swipeable photo gallery with zoom capability
 * @author ECHO OMEGA PRIME
 */

import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Image,
  StyleSheet,
  Dimensions,
  FlatList,
  TouchableOpacity,
  Modal,
  Animated,
  PanResponder,
  Text,
} from 'react-native';
import { COLORS } from '../../theme/colors';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export interface Photo {
  id: string;
  url: string;
  thumbnail?: string;
  caption?: string;
}

export interface PhotoCarouselProps {
  photos: Photo[];
  height?: number;
  showDots?: boolean;
  showCount?: boolean;
  onPhotoPress?: (index: number) => void;
  autoPlay?: boolean;
  autoPlayInterval?: number;
}

export function PhotoCarousel({
  photos,
  height = 240,
  showDots = true,
  showCount = true,
  onPhotoPress,
  autoPlay = false,
  autoPlayInterval = 4000,
}: PhotoCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [fullScreenVisible, setFullScreenVisible] = useState(false);
  const [fullScreenIndex, setFullScreenIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const autoPlayTimer = useRef<NodeJS.Timeout | null>(null);

  // Zoom state for full screen
  const scale = useRef(new Animated.Value(1)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;

  const resetZoom = useCallback(() => {
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, useNativeDriver: true }),
      Animated.spring(translateX, { toValue: 0, useNativeDriver: true }),
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true }),
    ]).start();
  }, [scale, translateX, translateY]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        // Could add pinch-to-zoom logic here with gesture state
      },
      onPanResponderMove: (_, gesture) => {
        translateX.setValue(gesture.dx);
        translateY.setValue(gesture.dy);
      },
      onPanResponderRelease: (_, gesture) => {
        // If dragged far enough, dismiss
        if (Math.abs(gesture.dy) > 150) {
          setFullScreenVisible(false);
          resetZoom();
        } else {
          resetZoom();
        }
      },
    })
  ).current;

  // Auto play functionality
  React.useEffect(() => {
    if (autoPlay && photos.length > 1) {
      autoPlayTimer.current = setInterval(() => {
        const nextIndex = (activeIndex + 1) % photos.length;
        flatListRef.current?.scrollToIndex({ index: nextIndex, animated: true });
        setActiveIndex(nextIndex);
      }, autoPlayInterval);

      return () => {
        if (autoPlayTimer.current) {
          clearInterval(autoPlayTimer.current);
        }
      };
    }
  }, [autoPlay, autoPlayInterval, activeIndex, photos.length]);

  const handleScroll = useCallback((event: any) => {
    const index = Math.round(event.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    setActiveIndex(Math.min(index, photos.length - 1));
  }, [photos.length]);

  const handlePhotoPress = (index: number) => {
    if (onPhotoPress) {
      onPhotoPress(index);
    } else {
      setFullScreenIndex(index);
      setFullScreenVisible(true);
    }
  };

  const handleFullScreenScroll = useCallback((event: any) => {
    const index = Math.round(event.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    setFullScreenIndex(Math.min(index, photos.length - 1));
    resetZoom();
  }, [photos.length, resetZoom]);

  if (photos.length === 0) {
    return (
      <View style={[styles.placeholder, { height }]}>
        <Text style={styles.placeholderIcon}>📷</Text>
        <Text style={styles.placeholderText}>No photos available</Text>
      </View>
    );
  }

  const renderPhoto = ({ item, index }: { item: Photo; index: number }) => (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={() => handlePhotoPress(index)}
      style={{ width: SCREEN_WIDTH }}
    >
      <Image
        source={{ uri: item.url }}
        style={[styles.image, { height }]}
        resizeMode="cover"
      />
    </TouchableOpacity>
  );

  const renderFullScreenPhoto = ({ item }: { item: Photo }) => (
    <View style={styles.fullScreenImageContainer}>
      <Animated.Image
        source={{ uri: item.url }}
        style={[
          styles.fullScreenImage,
          {
            transform: [
              { scale },
              { translateX },
              { translateY },
            ],
          },
        ]}
        resizeMode="contain"
        {...panResponder.panHandlers}
      />
      {item.caption && (
        <View style={styles.captionContainer}>
          <Text style={styles.captionText}>{item.caption}</Text>
        </View>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        ref={flatListRef}
        data={photos}
        renderItem={renderPhoto}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScroll}
        getItemLayout={(_, index) => ({
          length: SCREEN_WIDTH,
          offset: SCREEN_WIDTH * index,
          index,
        })}
      />

      {showDots && photos.length > 1 && (
        <View style={styles.dotsContainer}>
          {photos.map((_, index) => (
            <View
              key={index}
              style={[
                styles.dot,
                index === activeIndex && styles.dotActive,
              ]}
            />
          ))}
        </View>
      )}

      {showCount && photos.length > 1 && (
        <View style={styles.countContainer}>
          <Text style={styles.countText}>
            {activeIndex + 1} / {photos.length}
          </Text>
        </View>
      )}

      {/* Full Screen Modal */}
      <Modal
        visible={fullScreenVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setFullScreenVisible(false)}
      >
        <View style={styles.fullScreenContainer}>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => {
              setFullScreenVisible(false);
              resetZoom();
            }}
          >
            <Text style={styles.closeText}>×</Text>
          </TouchableOpacity>

          <FlatList
            data={photos}
            renderItem={renderFullScreenPhoto}
            keyExtractor={(item) => `full-${item.id}`}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={handleFullScreenScroll}
            initialScrollIndex={fullScreenIndex}
            getItemLayout={(_, index) => ({
              length: SCREEN_WIDTH,
              offset: SCREEN_WIDTH * index,
              index,
            })}
          />

          <View style={styles.fullScreenCount}>
            <Text style={styles.fullScreenCountText}>
              {fullScreenIndex + 1} / {photos.length}
            </Text>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  image: {
    width: SCREEN_WIDTH,
    backgroundColor: COLORS.grayLighter,
  },
  placeholder: {
    backgroundColor: COLORS.grayLighter,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderIcon: {
    fontSize: 48,
    marginBottom: 8,
  },
  placeholderText: {
    fontSize: 14,
    color: COLORS.gray,
  },
  dotsContainer: {
    position: 'absolute',
    bottom: 16,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.white + '60',
  },
  dotActive: {
    backgroundColor: COLORS.white,
    width: 20,
  },
  countContainer: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  countText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: '500',
  },

  // Full Screen
  fullScreenContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
  },
  closeButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    color: COLORS.white,
    fontSize: 28,
    fontWeight: '300',
    lineHeight: 28,
  },
  fullScreenImageContainer: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullScreenImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.7,
  },
  captionContainer: {
    position: 'absolute',
    bottom: 100,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 12,
    borderRadius: 8,
  },
  captionText: {
    color: COLORS.white,
    fontSize: 14,
    textAlign: 'center',
  },
  fullScreenCount: {
    position: 'absolute',
    bottom: 50,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  fullScreenCountText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '500',
  },
});

export default PhotoCarousel;
