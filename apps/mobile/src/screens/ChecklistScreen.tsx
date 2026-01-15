/**
 * Right at Home BnB - Checklist Screen
 * Interactive cleaning checklist with photo requirements
 * @author ECHO OMEGA PRIME
 */

import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, Image, RefreshControl, Animated, Dimensions
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PHOTO_REQUIREMENTS, PhotoResult } from '../services/camera';
import { COLORS } from '../theme/colors';

const { width } = Dimensions.get('window');

interface ChecklistItem {
  id: string;
  category: keyof typeof PHOTO_REQUIREMENTS;
  title: string;
  description: string;
  photoRequired: boolean;
  photosNeeded: number;
  photosTaken: number;
  photos: PhotoResult[];
  isCompleted: boolean;
  isOptional: boolean;
  estimatedMinutes: number;
  notes?: string;
}

interface ChecklistScreenProps {
  navigation: any;
  route: {
    params: {
      jobId: string;
      propertyName: string;
      propertyType: 'studio' | '1bed' | '2bed' | '3bed' | 'house';
      onComplete?: (completedItems: ChecklistItem[]) => void;
    };
  };
}

// Generate checklist based on property type
const generateChecklist = (propertyType: string): ChecklistItem[] => {
  const baseItems: ChecklistItem[] = [
    {
      id: 'entry',
      category: 'exterior',
      title: 'Entry & Porch',
      description: 'Sweep, clean doormat, check welcome items',
      photoRequired: true,
      photosNeeded: 1,
      photosTaken: 0,
      photos: [],
      isCompleted: false,
      isOptional: false,
      estimatedMinutes: 5,
    },
    {
      id: 'living',
      category: 'livingRoom',
      title: 'Living Room',
      description: 'Vacuum/mop, dust surfaces, arrange cushions, clean TV area',
      photoRequired: true,
      photosNeeded: 1,
      photosTaken: 0,
      photos: [],
      isCompleted: false,
      isOptional: false,
      estimatedMinutes: 15,
    },
    {
      id: 'kitchen',
      category: 'kitchen',
      title: 'Kitchen',
      description: 'Clean counters, appliances, sink, check supplies',
      photoRequired: true,
      photosNeeded: 2,
      photosTaken: 0,
      photos: [],
      isCompleted: false,
      isOptional: false,
      estimatedMinutes: 20,
    },
    {
      id: 'bathroom_main',
      category: 'bathroom',
      title: 'Main Bathroom',
      description: 'Toilet, sink, shower/tub, mirror, restock toiletries',
      photoRequired: true,
      photosNeeded: 3,
      photosTaken: 0,
      photos: [],
      isCompleted: false,
      isOptional: false,
      estimatedMinutes: 20,
    },
    {
      id: 'bedroom_master',
      category: 'bedroom',
      title: 'Master Bedroom',
      description: 'Make bed, dust, vacuum, check linens',
      photoRequired: true,
      photosNeeded: 2,
      photosTaken: 0,
      photos: [],
      isCompleted: false,
      isOptional: false,
      estimatedMinutes: 15,
    },
    {
      id: 'walkthrough',
      category: 'finalWalkthrough',
      title: 'Final Walkthrough',
      description: 'Complete check of all areas, lights, locks, thermostat',
      photoRequired: true,
      photosNeeded: 3,
      photosTaken: 0,
      photos: [],
      isCompleted: false,
      isOptional: false,
      estimatedMinutes: 10,
    },
  ];

  // Add extra rooms based on property type
  if (['2bed', '3bed', 'house'].includes(propertyType)) {
    baseItems.splice(5, 0, {
      id: 'bedroom_2',
      category: 'bedroom',
      title: 'Bedroom 2',
      description: 'Make bed, dust, vacuum, check linens',
      photoRequired: true,
      photosNeeded: 2,
      photosTaken: 0,
      photos: [],
      isCompleted: false,
      isOptional: false,
      estimatedMinutes: 15,
    });
  }

  if (['3bed', 'house'].includes(propertyType)) {
    baseItems.splice(6, 0, {
      id: 'bedroom_3',
      category: 'bedroom',
      title: 'Bedroom 3',
      description: 'Make bed, dust, vacuum, check linens',
      photoRequired: true,
      photosNeeded: 2,
      photosTaken: 0,
      photos: [],
      isCompleted: false,
      isOptional: false,
      estimatedMinutes: 15,
    });

    baseItems.splice(5, 0, {
      id: 'bathroom_2',
      category: 'bathroom',
      title: 'Bathroom 2',
      description: 'Toilet, sink, shower/tub, mirror, restock',
      photoRequired: true,
      photosNeeded: 3,
      photosTaken: 0,
      photos: [],
      isCompleted: false,
      isOptional: false,
      estimatedMinutes: 15,
    });
  }

  return baseItems;
};

export default function ChecklistScreen({ navigation, route }: ChecklistScreenProps) {
  const { jobId, propertyName, propertyType, onComplete } = route.params;

  const [checklist, setChecklist] = useState<ChecklistItem[]>(() =>
    generateChecklist(propertyType)
  );
  const [refreshing, setRefreshing] = useState(false);
  const [expandedItem, setExpandedItem] = useState<string | null>(null);

  const completedCount = checklist.filter((item) => item.isCompleted).length;
  const totalItems = checklist.length;
  const completionPercent = Math.round((completedCount / totalItems) * 100);
  const totalPhotosNeeded = checklist.reduce((sum, item) => sum + item.photosNeeded, 0);
  const totalPhotosTaken = checklist.reduce((sum, item) => sum + item.photosTaken, 0);
  const estimatedTimeRemaining = checklist
    .filter((item) => !item.isCompleted)
    .reduce((sum, item) => sum + item.estimatedMinutes, 0);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    // Simulate refresh
    setTimeout(() => setRefreshing(false), 1000);
  }, []);

  const toggleItemComplete = (itemId: string) => {
    setChecklist((prev) =>
      prev.map((item) => {
        if (item.id === itemId) {
          // Check if photos are required and taken
          if (item.photoRequired && item.photosTaken < item.photosNeeded) {
            Alert.alert(
              'Photos Required',
              `Please take ${item.photosNeeded - item.photosTaken} more photo(s) for this task.`,
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Take Photos',
                  onPress: () => handleTakePhotos(item),
                },
              ]
            );
            return item;
          }

          return { ...item, isCompleted: !item.isCompleted };
        }
        return item;
      })
    );
  };

  const handleTakePhotos = (item: ChecklistItem) => {
    navigation.navigate('PhotoCapture', {
      jobId,
      taskType: item.category,
      taskName: item.title,
      existingPhotos: item.photos,
      onPhotoCaptured: (photo: PhotoResult) => {
        setChecklist((prev) =>
          prev.map((i) => {
            if (i.id === item.id) {
              const updatedPhotos = [...i.photos, photo];
              return {
                ...i,
                photos: updatedPhotos,
                photosTaken: updatedPhotos.length,
              };
            }
            return i;
          })
        );
      },
    });
  };

  const handleComplete = () => {
    const incompleteRequired = checklist.filter(
      (item) => !item.isCompleted && !item.isOptional
    );

    if (incompleteRequired.length > 0) {
      Alert.alert(
        'Incomplete Tasks',
        `You have ${incompleteRequired.length} required task(s) remaining. Complete all required tasks before finishing.`,
        [{ text: 'OK' }]
      );
      return;
    }

    const missingPhotos = checklist.filter(
      (item) => item.photoRequired && item.photosTaken < item.photosNeeded
    );

    if (missingPhotos.length > 0) {
      Alert.alert(
        'Photos Missing',
        `You're missing photos for ${missingPhotos.length} task(s). All required photos must be taken.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Complete Anyway',
            style: 'destructive',
            onPress: () => {
              onComplete?.(checklist);
              navigation.goBack();
            },
          },
        ]
      );
      return;
    }

    Alert.alert(
      'Confirm Completion',
      'Are you sure you want to mark this job as complete?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Complete',
          onPress: () => {
            onComplete?.(checklist);
            navigation.goBack();
          },
        },
      ]
    );
  };

  const renderChecklistItem = (item: ChecklistItem, index: number) => {
    const isExpanded = expandedItem === item.id;
    const photoProgress = item.photosTaken / item.photosNeeded;

    return (
      <TouchableOpacity
        key={item.id}
        style={[
          styles.checklistItem,
          item.isCompleted && styles.checklistItemCompleted,
        ]}
        onPress={() => setExpandedItem(isExpanded ? null : item.id)}
        activeOpacity={0.7}
      >
        {/* Main Row */}
        <View style={styles.itemRow}>
          <TouchableOpacity
            style={[
              styles.checkbox,
              item.isCompleted && styles.checkboxChecked,
            ]}
            onPress={() => toggleItemComplete(item.id)}
          >
            {item.isCompleted && <Text style={styles.checkboxIcon}>✓</Text>}
          </TouchableOpacity>

          <View style={styles.itemContent}>
            <View style={styles.itemHeader}>
              <Text
                style={[
                  styles.itemTitle,
                  item.isCompleted && styles.itemTitleCompleted,
                ]}
              >
                {item.title}
              </Text>
              {item.isOptional && (
                <View style={styles.optionalBadge}>
                  <Text style={styles.optionalText}>Optional</Text>
                </View>
              )}
            </View>
            <Text style={styles.itemDescription}>{item.description}</Text>

            {/* Photo Progress */}
            {item.photoRequired && (
              <View style={styles.photoProgress}>
                <View style={styles.photoProgressBar}>
                  <View
                    style={[
                      styles.photoProgressFill,
                      {
                        width: `${photoProgress * 100}%`,
                        backgroundColor:
                          photoProgress >= 1 ? COLORS.success : COLORS.gold,
                      },
                    ]}
                  />
                </View>
                <Text style={styles.photoProgressText}>
                  📷 {item.photosTaken}/{item.photosNeeded}
                </Text>
              </View>
            )}
          </View>

          <View style={styles.itemMeta}>
            <Text style={styles.itemTime}>{item.estimatedMinutes}m</Text>
            <Text style={styles.expandIcon}>{isExpanded ? '▲' : '▼'}</Text>
          </View>
        </View>

        {/* Expanded Content */}
        {isExpanded && (
          <View style={styles.expandedContent}>
            {/* Photo Thumbnails */}
            {item.photos.length > 0 && (
              <ScrollView horizontal style={styles.photoThumbnails}>
                {item.photos.map((photo, idx) => (
                  <Image
                    key={idx}
                    source={{ uri: photo.uri }}
                    style={styles.photoThumb}
                  />
                ))}
              </ScrollView>
            )}

            {/* Photo Requirements */}
            {item.photoRequired && (
              <View style={styles.photoRequirements}>
                <Text style={styles.requirementsTitle}>Photo Requirements:</Text>
                <Text style={styles.requirementsText}>
                  {PHOTO_REQUIREMENTS[item.category]?.description || 'Take photos as needed'}
                </Text>
                {PHOTO_REQUIREMENTS[item.category]?.tips?.map((tip, idx) => (
                  <Text key={idx} style={styles.tipText}>• {tip}</Text>
                ))}
              </View>
            )}

            {/* Action Button */}
            <TouchableOpacity
              style={styles.takePhotoButton}
              onPress={() => handleTakePhotos(item)}
            >
              <Text style={styles.takePhotoIcon}>📷</Text>
              <Text style={styles.takePhotoText}>
                {item.photosTaken >= item.photosNeeded ? 'Add More Photos' : 'Take Photos'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Cleaning Checklist</Text>
          <Text style={styles.headerSubtitle}>{propertyName}</Text>
        </View>
      </View>

      {/* Progress Summary */}
      <View style={styles.progressSummary}>
        <View style={styles.progressCircle}>
          <Text style={styles.progressPercent}>{completionPercent}%</Text>
          <Text style={styles.progressLabel}>Complete</Text>
        </View>
        <View style={styles.progressStats}>
          <View style={styles.progressStat}>
            <Text style={styles.statValue}>{completedCount}/{totalItems}</Text>
            <Text style={styles.statLabel}>Tasks</Text>
          </View>
          <View style={styles.progressStat}>
            <Text style={styles.statValue}>{totalPhotosTaken}/{totalPhotosNeeded}</Text>
            <Text style={styles.statLabel}>Photos</Text>
          </View>
          <View style={styles.progressStat}>
            <Text style={styles.statValue}>{estimatedTimeRemaining}m</Text>
            <Text style={styles.statLabel}>Remaining</Text>
          </View>
        </View>
      </View>

      {/* Progress Bar */}
      <View style={styles.progressBarContainer}>
        <View style={styles.mainProgressBar}>
          <View
            style={[
              styles.mainProgressFill,
              {
                width: `${completionPercent}%`,
                backgroundColor: completionPercent === 100 ? COLORS.success : COLORS.maroon,
              },
            ]}
          />
        </View>
      </View>

      {/* Checklist */}
      <ScrollView
        style={styles.checklist}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        contentContainerStyle={styles.checklistContent}
      >
        {checklist.map((item, index) => renderChecklistItem(item, index))}
      </ScrollView>

      {/* Complete Button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[
            styles.completeButton,
            completionPercent === 100 && styles.completeButtonReady,
          ]}
          onPress={handleComplete}
        >
          <Text style={styles.completeButtonIcon}>
            {completionPercent === 100 ? '✓' : '📋'}
          </Text>
          <Text style={styles.completeButtonText}>
            {completionPercent === 100 ? 'Mark Job Complete' : `${completedCount}/${totalItems} Complete`}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.cream,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: COLORS.maroon,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: {
    fontSize: 24,
    color: COLORS.white,
  },
  headerContent: {
    marginLeft: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.white,
  },
  headerSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
  },

  // Progress Summary
  progressSummary: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    margin: 16,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  progressCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    borderColor: COLORS.maroon,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressPercent: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.maroon,
  },
  progressLabel: {
    fontSize: 10,
    color: COLORS.gray,
  },
  progressStats: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginLeft: 16,
  },
  progressStat: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.charcoal,
  },
  statLabel: {
    fontSize: 11,
    color: COLORS.gray,
    marginTop: 2,
  },

  // Progress Bar
  progressBarContainer: {
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  mainProgressBar: {
    height: 6,
    backgroundColor: COLORS.grayLighter,
    borderRadius: 3,
    overflow: 'hidden',
  },
  mainProgressFill: {
    height: '100%',
    borderRadius: 3,
  },

  // Checklist
  checklist: {
    flex: 1,
  },
  checklistContent: {
    padding: 16,
    paddingBottom: 100,
  },
  checklistItem: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
    overflow: 'hidden',
  },
  checklistItemCompleted: {
    opacity: 0.7,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
  },
  checkbox: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: COLORS.maroon,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    marginTop: 2,
  },
  checkboxChecked: {
    backgroundColor: COLORS.maroon,
  },
  checkboxIcon: {
    fontSize: 16,
    color: COLORS.white,
    fontWeight: 'bold',
  },
  itemContent: {
    flex: 1,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.charcoal,
  },
  itemTitleCompleted: {
    textDecorationLine: 'line-through',
    color: COLORS.gray,
  },
  optionalBadge: {
    backgroundColor: `${COLORS.gold}30`,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  optionalText: {
    fontSize: 10,
    color: COLORS.goldDark,
    fontWeight: '600',
  },
  itemDescription: {
    fontSize: 13,
    color: COLORS.gray,
    lineHeight: 18,
  },
  photoProgress: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 8,
  },
  photoProgressBar: {
    flex: 1,
    height: 4,
    backgroundColor: COLORS.grayLighter,
    borderRadius: 2,
    overflow: 'hidden',
  },
  photoProgressFill: {
    height: '100%',
    borderRadius: 2,
  },
  photoProgressText: {
    fontSize: 12,
    color: COLORS.gray,
    fontWeight: '500',
  },
  itemMeta: {
    alignItems: 'flex-end',
    marginLeft: 8,
  },
  itemTime: {
    fontSize: 12,
    color: COLORS.grayLight,
    fontWeight: '500',
  },
  expandIcon: {
    fontSize: 10,
    color: COLORS.grayLight,
    marginTop: 4,
  },

  // Expanded Content
  expandedContent: {
    borderTopWidth: 1,
    borderTopColor: COLORS.grayLighter,
    padding: 16,
    backgroundColor: `${COLORS.cream}50`,
  },
  photoThumbnails: {
    marginBottom: 12,
  },
  photoThumb: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 8,
  },
  photoRequirements: {
    backgroundColor: `${COLORS.gold}15`,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  requirementsTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.charcoal,
    marginBottom: 4,
  },
  requirementsText: {
    fontSize: 12,
    color: COLORS.gray,
    marginBottom: 8,
  },
  tipText: {
    fontSize: 11,
    color: COLORS.goldDark,
  },
  takePhotoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.maroon,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  takePhotoIcon: {
    fontSize: 18,
  },
  takePhotoText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.white,
  },

  // Footer
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.white,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  completeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.grayLight,
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  completeButtonReady: {
    backgroundColor: COLORS.success,
  },
  completeButtonIcon: {
    fontSize: 20,
  },
  completeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.white,
  },
});
