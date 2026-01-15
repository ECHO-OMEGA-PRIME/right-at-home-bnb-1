/**
 * Right at Home BnB - Job Detail Screen
 * Real GPS check-in, camera documentation, and task completion
 * @author ECHO OMEGA PRIME
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Alert, Image, ActivityIndicator, Modal
} from 'react-native';
import {
  verifyPropertyCheckIn,
  PropertyLocation,
  LocationCheckResult,
  getCurrentLocation,
} from '../services/location';
import {
  takePhoto,
  pickPhotoFromGallery,
  PhotoResult,
  PHOTO_REQUIREMENTS,
} from '../services/camera';
import {
  scheduleJobReminder,
  cancelNotification,
  NOTIFICATION_TEMPLATES,
} from '../services/notifications';

const COLORS = {
  maroon: '#500000',
  cream: '#F5F5F0',
  gold: '#C4A777',
  charcoal: '#2D2D2D',
  white: '#FFFFFF',
  green: '#4CAF50',
  orange: '#FFA500',
  red: '#EF4444',
};

interface ChecklistItem {
  id: number;
  task: string;
  completed: boolean;
  photo_required: boolean;
  area: 'bedroom' | 'bathroom' | 'kitchen' | 'livingRoom' | 'exterior' | 'finalWalkthrough';
  photo_uri?: string;
}

interface JobData {
  id: string;
  property: string;
  address: string;
  scheduledTime: string;
  scheduledDate: Date;
  expectedDuration: string;
  guestCheckIn: string;
  notes: string;
  location: PropertyLocation;
  basePayment: number;
  bonusMultiplier?: number;
}

const ChecklistRow = ({
  item,
  onToggle,
  onTakePhoto,
}: {
  item: ChecklistItem;
  onToggle: () => void;
  onTakePhoto: () => void;
}) => (
  <View style={styles.checklistRow}>
    <TouchableOpacity style={styles.checklistContent} onPress={onToggle}>
      <View style={[styles.checkbox, item.completed && styles.checkboxChecked]}>
        {item.completed && <Text style={styles.checkmark}>✓</Text>}
      </View>
      <View style={styles.taskInfo}>
        <Text style={[styles.taskText, item.completed && styles.taskCompleted]}>
          {item.task}
        </Text>
        <Text style={styles.areaLabel}>{item.area.replace(/([A-Z])/g, ' $1').trim()}</Text>
      </View>
    </TouchableOpacity>
    {item.photo_required && (
      <TouchableOpacity
        style={[
          styles.photoButton,
          item.photo_uri ? styles.photoButtonCompleted : null,
        ]}
        onPress={onTakePhoto}
      >
        {item.photo_uri ? (
          <Image source={{ uri: item.photo_uri }} style={styles.photoThumbnail} />
        ) : (
          <Text style={styles.photoIcon}>📷</Text>
        )}
      </TouchableOpacity>
    )}
  </View>
);

export default function JobDetailScreen({ route, navigation }: any) {
  const [checkedIn, setCheckedIn] = useState(false);
  const [checkInTime, setCheckInTime] = useState<Date | null>(null);
  const [checkInLoading, setCheckInLoading] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [photos, setPhotos] = useState<PhotoResult[]>([]);
  const [photoModalVisible, setPhotoModalVisible] = useState(false);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reminderNotificationId, setReminderNotificationId] = useState<string | null>(null);

  const jobId = route?.params?.jobId || '1';

  // Mock job data - would come from API
  const job: JobData = {
    id: jobId,
    property: 'Castleford Estate',
    address: '123 Oak Lane, Midland, TX 79705',
    scheduledTime: '2:00 PM',
    scheduledDate: new Date(),
    expectedDuration: '2 hours',
    guestCheckIn: '4:00 PM',
    notes: 'VIP guest arriving. Please ensure wine glasses are spotless.',
    location: {
      latitude: 31.9973,
      longitude: -102.0779,
      address: '123 Oak Lane, Midland, TX 79705',
      radius: 100, // 100 meters
    },
    basePayment: 85,
    bonusMultiplier: 1.0,
  };

  // Initialize checklist
  useEffect(() => {
    setChecklist([
      { id: 1, task: 'Strip and make all beds', completed: false, photo_required: true, area: 'bedroom' },
      { id: 2, task: 'Clean all bathrooms', completed: false, photo_required: true, area: 'bathroom' },
      { id: 3, task: 'Vacuum all floors', completed: false, photo_required: false, area: 'livingRoom' },
      { id: 4, task: 'Mop hard floors', completed: false, photo_required: false, area: 'kitchen' },
      { id: 5, task: 'Clean kitchen surfaces', completed: false, photo_required: true, area: 'kitchen' },
      { id: 6, task: 'Empty all trash bins', completed: false, photo_required: false, area: 'kitchen' },
      { id: 7, task: 'Restock toilet paper', completed: false, photo_required: false, area: 'bathroom' },
      { id: 8, task: 'Restock towels', completed: false, photo_required: true, area: 'bathroom' },
      { id: 9, task: 'Check all locks/windows', completed: false, photo_required: false, area: 'exterior' },
      { id: 10, task: 'Final walkthrough', completed: false, photo_required: true, area: 'finalWalkthrough' },
    ]);

    // Schedule reminder
    scheduleReminderNotification();

    return () => {
      // Cancel reminder if leaving
      if (reminderNotificationId) {
        cancelNotification(reminderNotificationId);
      }
    };
  }, []);

  const scheduleReminderNotification = async () => {
    const notifId = await scheduleJobReminder(job.id, job.property, job.scheduledDate);
    if (notifId) {
      setReminderNotificationId(notifId);
    }
  };

  const completedCount = checklist.filter(c => c.completed).length;
  const progress = checklist.length > 0 ? (completedCount / checklist.length) * 100 : 0;
  const photoRequiredCount = checklist.filter(c => c.photo_required && c.photo_uri).length;
  const totalPhotoRequired = checklist.filter(c => c.photo_required).length;

  const handleCheckIn = async () => {
    setCheckInLoading(true);
    setLocationError(null);

    try {
      const result: LocationCheckResult = await verifyPropertyCheckIn(job.location);

      if (!result.success) {
        setLocationError(result.errorMessage || 'Unable to verify location');
        Alert.alert('Check-In Failed', result.errorMessage);
        return;
      }

      if (!result.withinRange) {
        setLocationError(result.errorMessage || `You are ${result.distance}m away from the property`);
        Alert.alert(
          'Too Far From Property',
          `You need to be within ${job.location.radius}m of the property to check in.\n\nCurrent distance: ${result.distance}m`,
          [{ text: 'OK' }]
        );
        return;
      }

      // Success!
      setCheckedIn(true);
      setCheckInTime(result.timestamp);
      Alert.alert(
        'Checked In! ✓',
        `GPS location verified at ${result.timestamp.toLocaleTimeString()}.\n\nStart your checklist when ready.`,
        [{ text: 'Let\'s Go!' }]
      );

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setLocationError(errorMessage);
      Alert.alert('Check-In Error', errorMessage);
    } finally {
      setCheckInLoading(false);
    }
  };

  const toggleTask = (id: number) => {
    setChecklist(prev => prev.map(item =>
      item.id === id ? { ...item, completed: !item.completed } : item
    ));
  };

  const handleTakePhotoForTask = async (taskId: number) => {
    Alert.alert(
      'Add Photo',
      'Choose photo source',
      [
        {
          text: 'Camera',
          onPress: async () => {
            const photo = await takePhoto({ quality: 0.8 });
            if (photo) {
              setPhotos(prev => [...prev, photo]);
              setChecklist(prev => prev.map(item =>
                item.id === taskId ? { ...item, photo_uri: photo.uri } : item
              ));
            }
          },
        },
        {
          text: 'Gallery',
          onPress: async () => {
            const selectedPhotos = await pickPhotoFromGallery();
            if (selectedPhotos && selectedPhotos.length > 0) {
              const photo = selectedPhotos[0];
              setPhotos(prev => [...prev, photo]);
              setChecklist(prev => prev.map(item =>
                item.id === taskId ? { ...item, photo_uri: photo.uri } : item
              ));
            }
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const handleTakeExtraPhoto = async () => {
    Alert.alert(
      'Add Extra Photo',
      'Choose photo source',
      [
        {
          text: 'Camera',
          onPress: async () => {
            const photo = await takePhoto({ quality: 0.8 });
            if (photo) {
              setPhotos(prev => [...prev, photo]);
            }
          },
        },
        {
          text: 'Gallery',
          onPress: async () => {
            const selectedPhotos = await pickPhotoFromGallery({ allowsMultipleSelection: true, selectionLimit: 5 });
            if (selectedPhotos) {
              setPhotos(prev => [...prev, ...selectedPhotos]);
            }
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const handleComplete = async () => {
    // Validate requirements
    const issues: string[] = [];

    if (photos.length < 5) {
      issues.push(`Need ${5 - photos.length} more photos (minimum 5 required)`);
    }

    if (completedCount < checklist.length) {
      issues.push(`${checklist.length - completedCount} tasks incomplete`);
    }

    const missingRequiredPhotos = checklist.filter(c => c.photo_required && !c.photo_uri);
    if (missingRequiredPhotos.length > 0) {
      issues.push(`${missingRequiredPhotos.length} required task photos missing`);
    }

    if (issues.length > 0) {
      Alert.alert(
        'Cannot Complete Job',
        issues.join('\n\n'),
        [{ text: 'OK' }]
      );
      return;
    }

    Alert.alert(
      'Complete Job?',
      `This will submit your work for review.\n\n• ${completedCount} tasks completed\n• ${photos.length} photos uploaded\n• Estimated payment: $${(job.basePayment * (job.bonusMultiplier || 1)).toFixed(2)}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Submit',
          onPress: async () => {
            setIsSubmitting(true);
            try {
              // Simulate API call
              await new Promise(resolve => setTimeout(resolve, 2000));

              // Calculate score (mock)
              const score = (9.5 + Math.random() * 0.4).toFixed(1);
              const bonusEarned = parseFloat(score) >= 9.5 ? 10 : 0;

              Alert.alert(
                'Job Completed! 🎉',
                `Great work!\n\nScore: ${score}/10\nPayment: $${job.basePayment.toFixed(2)}${bonusEarned > 0 ? `\nBonus: +$${bonusEarned.toFixed(2)}` : ''}`,
                [
                  {
                    text: 'Done',
                    onPress: () => navigation.goBack(),
                  },
                ]
              );
            } catch (error) {
              Alert.alert('Error', 'Failed to submit job. Please try again.');
            } finally {
              setIsSubmitting(false);
            }
          },
        },
      ]
    );
  };

  return (
    <ScrollView style={styles.container}>
      {/* Property Info */}
      <View style={styles.propertyCard}>
        <View style={styles.propertyHeader}>
          <Text style={styles.propertyName}>{job.property}</Text>
          {job.bonusMultiplier && job.bonusMultiplier > 1 && (
            <View style={styles.bonusBadge}>
              <Text style={styles.bonusText}>{job.bonusMultiplier}x PAY</Text>
            </View>
          )}
        </View>
        <Text style={styles.propertyAddress}>{job.address}</Text>
        <View style={styles.propertyMeta}>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Scheduled</Text>
            <Text style={styles.metaValue}>{job.scheduledTime}</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Duration</Text>
            <Text style={styles.metaValue}>{job.expectedDuration}</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Guest Arrives</Text>
            <Text style={styles.metaValue}>{job.guestCheckIn}</Text>
          </View>
        </View>
        <View style={styles.paymentInfo}>
          <Text style={styles.paymentLabel}>Payment:</Text>
          <Text style={styles.paymentValue}>
            ${(job.basePayment * (job.bonusMultiplier || 1)).toFixed(2)}
          </Text>
        </View>
        {job.notes && (
          <View style={styles.notesBox}>
            <Text style={styles.notesLabel}>⚠️ Special Notes</Text>
            <Text style={styles.notesText}>{job.notes}</Text>
          </View>
        )}
      </View>

      {/* Check-In Section */}
      {!checkedIn ? (
        <View style={styles.checkInSection}>
          <TouchableOpacity
            style={[styles.checkInButton, checkInLoading && styles.checkInButtonLoading]}
            onPress={handleCheckIn}
            disabled={checkInLoading}
          >
            {checkInLoading ? (
              <>
                <ActivityIndicator color={COLORS.white} />
                <Text style={styles.checkInText}>Verifying GPS...</Text>
              </>
            ) : (
              <>
                <Text style={styles.checkInIcon}>📍</Text>
                <Text style={styles.checkInText}>GPS Check-In</Text>
              </>
            )}
          </TouchableOpacity>
          {locationError && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{locationError}</Text>
            </View>
          )}
          <Text style={styles.checkInHint}>
            Must be within {job.location.radius}m of property
          </Text>
        </View>
      ) : (
        <View style={styles.checkedInBadge}>
          <Text style={styles.checkedInIcon}>✓</Text>
          <View>
            <Text style={styles.checkedInText}>Checked In</Text>
            <Text style={styles.checkedInTime}>
              {checkInTime?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
        </View>
      )}

      {/* Progress */}
      <View style={styles.progressSection}>
        <View style={styles.progressHeader}>
          <Text style={styles.progressTitle}>Checklist Progress</Text>
          <Text style={styles.progressCount}>{completedCount}/{checklist.length}</Text>
        </View>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${progress}%` }]} />
        </View>
        <View style={styles.progressStats}>
          <Text style={styles.progressStat}>📷 {photoRequiredCount}/{totalPhotoRequired} required photos</Text>
          <Text style={styles.progressStat}>📸 {photos.length} total photos</Text>
        </View>
      </View>

      {/* Checklist */}
      <View style={styles.checklistSection}>
        <Text style={styles.sectionTitle}>Tasks</Text>
        {checklist.map(item => (
          <ChecklistRow
            key={item.id}
            item={item}
            onToggle={() => toggleTask(item.id)}
            onTakePhoto={() => handleTakePhotoForTask(item.id)}
          />
        ))}
      </View>

      {/* Photos Section */}
      <View style={styles.photosSection}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Photos ({photos.length}/5 minimum)</Text>
        </View>
        <TouchableOpacity style={styles.addPhotoButton} onPress={handleTakeExtraPhoto}>
          <Text style={styles.addPhotoIcon}>📷</Text>
          <Text style={styles.addPhotoText}>Add Extra Photos</Text>
        </TouchableOpacity>
        {photos.length > 0 && (
          <View style={styles.photoGrid}>
            {photos.map((photo, i) => (
              <TouchableOpacity
                key={i}
                style={styles.photoThumb}
                onPress={() => {
                  setSelectedPhotoIndex(i);
                  setPhotoModalVisible(true);
                }}
              >
                <Image source={{ uri: photo.uri }} style={styles.photoImage} />
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {/* Complete Button */}
      <TouchableOpacity
        style={[
          styles.completeButton,
          (!checkedIn || photos.length < 5 || completedCount < checklist.length) && styles.completeButtonDisabled,
          isSubmitting && styles.completeButtonSubmitting,
        ]}
        onPress={handleComplete}
        disabled={!checkedIn || isSubmitting}
      >
        {isSubmitting ? (
          <>
            <ActivityIndicator color={COLORS.white} />
            <Text style={styles.completeText}>Submitting...</Text>
          </>
        ) : (
          <Text style={styles.completeText}>Complete Job</Text>
        )}
      </TouchableOpacity>

      {/* Photo Preview Modal */}
      <Modal
        visible={photoModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setPhotoModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setPhotoModalVisible(false)}
        >
          {selectedPhotoIndex !== null && photos[selectedPhotoIndex] && (
            <Image
              source={{ uri: photos[selectedPhotoIndex].uri }}
              style={styles.modalImage}
              resizeMode="contain"
            />
          )}
          <TouchableOpacity
            style={styles.modalCloseButton}
            onPress={() => setPhotoModalVisible(false)}
          >
            <Text style={styles.modalCloseText}>✕</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.cream },

  // Property Card
  propertyCard: {
    backgroundColor: COLORS.white,
    margin: 20,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  propertyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  propertyName: { fontSize: 22, fontWeight: 'bold', color: COLORS.maroon, flex: 1 },
  bonusBadge: {
    backgroundColor: COLORS.gold,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  bonusText: { fontSize: 12, fontWeight: 'bold', color: COLORS.white },
  propertyAddress: { fontSize: 14, color: '#666', marginTop: 4 },
  propertyMeta: { flexDirection: 'row', marginTop: 16, gap: 20 },
  metaItem: {},
  metaLabel: { fontSize: 11, color: '#999', marginBottom: 2 },
  metaValue: { fontSize: 14, fontWeight: '600', color: COLORS.charcoal },
  paymentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#EEE',
  },
  paymentLabel: { fontSize: 14, color: '#666' },
  paymentValue: { fontSize: 18, fontWeight: 'bold', color: COLORS.green, marginLeft: 8 },
  notesBox: { marginTop: 16, padding: 12, backgroundColor: '#FFF8E1', borderRadius: 10 },
  notesLabel: { fontSize: 12, fontWeight: '600', color: '#F57C00', marginBottom: 4 },
  notesText: { fontSize: 13, color: '#5D4037' },

  // Check-In
  checkInSection: { marginHorizontal: 20 },
  checkInButton: {
    backgroundColor: COLORS.maroon,
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  checkInButtonLoading: { backgroundColor: '#722F37' },
  checkInIcon: { fontSize: 24 },
  checkInText: { fontSize: 18, fontWeight: '600', color: COLORS.white },
  checkInHint: { textAlign: 'center', color: '#999', fontSize: 12, marginTop: 8 },
  errorBox: {
    backgroundColor: '#FEE2E2',
    padding: 12,
    borderRadius: 10,
    marginTop: 12,
  },
  errorText: { color: COLORS.red, fontSize: 13, textAlign: 'center' },
  checkedInBadge: {
    marginHorizontal: 20,
    backgroundColor: '#E8F5E9',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  checkedInIcon: { fontSize: 24, color: '#2E7D32' },
  checkedInText: { fontSize: 16, fontWeight: '600', color: '#2E7D32' },
  checkedInTime: { fontSize: 12, color: '#4CAF50' },

  // Progress
  progressSection: { marginHorizontal: 20, marginTop: 20 },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  progressTitle: { fontSize: 16, fontWeight: '600', color: COLORS.charcoal },
  progressCount: { fontSize: 14, color: COLORS.maroon, fontWeight: '600' },
  progressBar: { height: 8, backgroundColor: '#E0E0E0', borderRadius: 4 },
  progressFill: { height: '100%', backgroundColor: COLORS.maroon, borderRadius: 4 },
  progressStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  progressStat: { fontSize: 12, color: '#666' },

  // Checklist
  checklistSection: {
    margin: 20,
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 16,
  },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: COLORS.charcoal, marginBottom: 12 },
  checklistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  checklistContent: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  checkbox: {
    width: 26,
    height: 26,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#DDD',
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: { backgroundColor: COLORS.maroon, borderColor: COLORS.maroon },
  checkmark: { color: COLORS.white, fontWeight: 'bold', fontSize: 14 },
  taskInfo: { flex: 1 },
  taskText: { fontSize: 14, color: COLORS.charcoal },
  taskCompleted: { textDecorationLine: 'line-through', color: '#999' },
  areaLabel: { fontSize: 10, color: '#999', marginTop: 2, textTransform: 'capitalize' },
  photoButton: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#F0F0F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  photoButtonCompleted: { backgroundColor: '#E8F5E9' },
  photoIcon: { fontSize: 18 },
  photoThumbnail: { width: 44, height: 44, borderRadius: 10 },

  // Photos
  photosSection: { margin: 20 },
  sectionHeader: { marginBottom: 12 },
  addPhotoButton: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 20,
    borderWidth: 2,
    borderColor: COLORS.maroon,
    borderStyle: 'dashed',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  addPhotoIcon: { fontSize: 24 },
  addPhotoText: { fontSize: 16, fontWeight: '600', color: COLORS.maroon },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12 },
  photoThumb: {
    width: 80,
    height: 80,
    borderRadius: 10,
    overflow: 'hidden',
  },
  photoImage: { width: '100%', height: '100%' },

  // Complete
  completeButton: {
    marginHorizontal: 20,
    backgroundColor: COLORS.green,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
  },
  completeButtonDisabled: { backgroundColor: '#CCC' },
  completeButtonSubmitting: { backgroundColor: '#388E3C' },
  completeText: { fontSize: 18, fontWeight: '600', color: COLORS.white },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalImage: { width: '90%', height: '70%' },
  modalCloseButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCloseText: { color: COLORS.white, fontSize: 20, fontWeight: 'bold' },
});
