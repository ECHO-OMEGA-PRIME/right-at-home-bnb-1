/**
 * Right at Home BnB - Issue Report Screen
 * Report maintenance issues with photos
 * @author ECHO OMEGA PRIME
 */

import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, Image, ActivityIndicator, KeyboardAvoidingView, Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { takePhoto, pickPhotoFromGallery, PhotoResult } from '../services/camera';
import { COLORS } from '../theme/colors';

interface IssueReportScreenProps {
  navigation: any;
  route: {
    params: {
      jobId?: string;
      propertyId: string;
      propertyName: string;
    };
  };
}

type IssuePriority = 'low' | 'medium' | 'high' | 'urgent';
type IssueCategory = 'plumbing' | 'electrical' | 'hvac' | 'appliance' | 'structural' | 'cleaning' | 'safety' | 'other';

interface IssueCategory {
  id: IssueCategory;
  label: string;
  icon: string;
}

const ISSUE_CATEGORIES: IssueCategory[] = [
  { id: 'plumbing', label: 'Plumbing', icon: '🚿' },
  { id: 'electrical', label: 'Electrical', icon: '💡' },
  { id: 'hvac', label: 'HVAC', icon: '❄️' },
  { id: 'appliance', label: 'Appliance', icon: '🔌' },
  { id: 'structural', label: 'Structural', icon: '🏠' },
  { id: 'cleaning', label: 'Cleaning', icon: '🧹' },
  { id: 'safety', label: 'Safety', icon: '⚠️' },
  { id: 'other', label: 'Other', icon: '📋' },
];

const PRIORITY_OPTIONS: { value: IssuePriority; label: string; color: string; description: string }[] = [
  { value: 'low', label: 'Low', color: COLORS.success, description: 'Can wait for routine maintenance' },
  { value: 'medium', label: 'Medium', color: COLORS.gold, description: 'Should be fixed within a few days' },
  { value: 'high', label: 'High', color: COLORS.warning, description: 'Needs attention within 24 hours' },
  { value: 'urgent', label: 'Urgent', color: COLORS.error, description: 'Immediate action required' },
];

export default function IssueReportScreen({ navigation, route }: IssueReportScreenProps) {
  const { jobId, propertyId, propertyName } = route.params;

  const [category, setCategory] = useState<string | null>(null);
  const [priority, setPriority] = useState<IssuePriority>('medium');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [photos, setPhotos] = useState<PhotoResult[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleTakePhoto = async () => {
    const photo = await takePhoto();
    if (photo) {
      setPhotos((prev) => [...prev, photo]);
    }
  };

  const handlePickPhoto = async () => {
    const picked = await pickPhotoFromGallery({ allowsMultipleSelection: true, selectionLimit: 5 - photos.length });
    if (picked) {
      setPhotos((prev) => [...prev, ...picked].slice(0, 5));
    }
  };

  const handleRemovePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const validateForm = (): boolean => {
    if (!category) {
      Alert.alert('Required', 'Please select an issue category.');
      return false;
    }
    if (!title.trim()) {
      Alert.alert('Required', 'Please enter an issue title.');
      return false;
    }
    if (!description.trim()) {
      Alert.alert('Required', 'Please describe the issue.');
      return false;
    }
    if (photos.length === 0) {
      Alert.alert(
        'Photos Recommended',
        'Adding photos helps resolve issues faster. Continue without photos?',
        [
          { text: 'Add Photos', style: 'cancel' },
          { text: 'Continue', onPress: () => submitReport() },
        ]
      );
      return false;
    }
    return true;
  };

  const submitReport = async () => {
    setIsSubmitting(true);

    try {
      // Prepare form data
      const formData = new FormData();
      formData.append('propertyId', propertyId);
      formData.append('category', category!);
      formData.append('priority', priority);
      formData.append('title', title.trim());
      formData.append('description', description.trim());
      formData.append('location', location.trim());
      if (jobId) formData.append('jobId', jobId);

      // Add photos
      photos.forEach((photo, index) => {
        const uriParts = photo.uri.split('.');
        const fileType = uriParts[uriParts.length - 1];

        formData.append('photos', {
          uri: photo.uri,
          name: `issue_photo_${index}.${fileType}`,
          type: `image/${fileType}`,
        } as any);
      });

      // Submit to API
      const response = await fetch('https://api.rightathome.bnb/issues/report', {
        method: 'POST',
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to submit issue report');
      }

      Alert.alert(
        'Issue Reported',
        'Your issue has been submitted and the property manager will be notified.',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (error: any) {
      console.error('Submit error:', error);
      Alert.alert('Error', 'Failed to submit issue. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = () => {
    if (validateForm()) {
      submitReport();
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>Report Issue</Text>
            <Text style={styles.headerSubtitle}>{propertyName}</Text>
          </View>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Category Selection */}
          <Text style={styles.sectionTitle}>Issue Category *</Text>
          <View style={styles.categoryGrid}>
            {ISSUE_CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat.id}
                style={[
                  styles.categoryButton,
                  category === cat.id && styles.categoryButtonSelected,
                ]}
                onPress={() => setCategory(cat.id)}
              >
                <Text style={styles.categoryIcon}>{cat.icon}</Text>
                <Text
                  style={[
                    styles.categoryLabel,
                    category === cat.id && styles.categoryLabelSelected,
                  ]}
                >
                  {cat.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Priority Selection */}
          <Text style={styles.sectionTitle}>Priority Level</Text>
          <View style={styles.priorityContainer}>
            {PRIORITY_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                style={[
                  styles.priorityButton,
                  priority === opt.value && { borderColor: opt.color, borderWidth: 2 },
                ]}
                onPress={() => setPriority(opt.value)}
              >
                <View style={[styles.priorityDot, { backgroundColor: opt.color }]} />
                <View style={styles.priorityContent}>
                  <Text style={styles.priorityLabel}>{opt.label}</Text>
                  <Text style={styles.priorityDescription}>{opt.description}</Text>
                </View>
                {priority === opt.value && (
                  <Text style={styles.priorityCheck}>✓</Text>
                )}
              </TouchableOpacity>
            ))}
          </View>

          {/* Issue Title */}
          <Text style={styles.sectionTitle}>Issue Title *</Text>
          <TextInput
            style={styles.titleInput}
            placeholder="e.g., Leaking faucet in master bathroom"
            placeholderTextColor={COLORS.grayLight}
            value={title}
            onChangeText={setTitle}
            maxLength={100}
          />

          {/* Location in Property */}
          <Text style={styles.sectionTitle}>Location in Property</Text>
          <TextInput
            style={styles.titleInput}
            placeholder="e.g., Master bathroom, upstairs hallway"
            placeholderTextColor={COLORS.grayLight}
            value={location}
            onChangeText={setLocation}
            maxLength={100}
          />

          {/* Description */}
          <Text style={styles.sectionTitle}>Description *</Text>
          <TextInput
            style={styles.descriptionInput}
            placeholder="Please describe the issue in detail. Include any relevant information that would help resolve it."
            placeholderTextColor={COLORS.grayLight}
            value={description}
            onChangeText={setDescription}
            multiline
            textAlignVertical="top"
            maxLength={1000}
          />
          <Text style={styles.charCount}>{description.length}/1000</Text>

          {/* Photos */}
          <Text style={styles.sectionTitle}>Photos ({photos.length}/5)</Text>
          <View style={styles.photosContainer}>
            {photos.map((photo, index) => (
              <View key={photo.uri} style={styles.photoWrapper}>
                <Image source={{ uri: photo.uri }} style={styles.photoThumb} />
                <TouchableOpacity
                  style={styles.removePhotoButton}
                  onPress={() => handleRemovePhoto(index)}
                >
                  <Text style={styles.removePhotoText}>✕</Text>
                </TouchableOpacity>
              </View>
            ))}

            {photos.length < 5 && (
              <>
                <TouchableOpacity
                  style={styles.addPhotoButton}
                  onPress={handleTakePhoto}
                >
                  <Text style={styles.addPhotoIcon}>📷</Text>
                  <Text style={styles.addPhotoText}>Camera</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.addPhotoButton}
                  onPress={handlePickPhoto}
                >
                  <Text style={styles.addPhotoIcon}>🖼️</Text>
                  <Text style={styles.addPhotoText}>Gallery</Text>
                </TouchableOpacity>
              </>
            )}
          </View>

          <View style={{ height: 100 }} />
        </ScrollView>

        {/* Submit Button */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator color={COLORS.white} size="small" />
            ) : (
              <>
                <Text style={styles.submitIcon}>📤</Text>
                <Text style={styles.submitText}>Submit Report</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.cream,
  },
  keyboardView: {
    flex: 1,
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

  // Content
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.charcoal,
    marginBottom: 12,
    marginTop: 16,
  },

  // Category Grid
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  categoryButton: {
    width: '23%',
    aspectRatio: 1,
    backgroundColor: COLORS.white,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: COLORS.grayLighter,
  },
  categoryButtonSelected: {
    borderColor: COLORS.maroon,
    backgroundColor: `${COLORS.maroon}10`,
  },
  categoryIcon: {
    fontSize: 24,
    marginBottom: 4,
  },
  categoryLabel: {
    fontSize: 10,
    color: COLORS.gray,
    fontWeight: '500',
    textAlign: 'center',
  },
  categoryLabelSelected: {
    color: COLORS.maroon,
  },

  // Priority
  priorityContainer: {
    gap: 8,
  },
  priorityButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.grayLighter,
  },
  priorityDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
  },
  priorityContent: {
    flex: 1,
  },
  priorityLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.charcoal,
  },
  priorityDescription: {
    fontSize: 12,
    color: COLORS.gray,
    marginTop: 2,
  },
  priorityCheck: {
    fontSize: 18,
    color: COLORS.maroon,
    fontWeight: 'bold',
  },

  // Inputs
  titleInput: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 16,
    fontSize: 15,
    color: COLORS.charcoal,
    borderWidth: 1,
    borderColor: COLORS.grayLighter,
  },
  descriptionInput: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 16,
    fontSize: 15,
    color: COLORS.charcoal,
    borderWidth: 1,
    borderColor: COLORS.grayLighter,
    minHeight: 120,
  },
  charCount: {
    fontSize: 11,
    color: COLORS.grayLight,
    textAlign: 'right',
    marginTop: 4,
  },

  // Photos
  photosContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  photoWrapper: {
    position: 'relative',
  },
  photoThumb: {
    width: 80,
    height: 80,
    borderRadius: 8,
  },
  removePhotoButton: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: COLORS.error,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removePhotoText: {
    fontSize: 12,
    color: COLORS.white,
    fontWeight: 'bold',
  },
  addPhotoButton: {
    width: 80,
    height: 80,
    borderRadius: 8,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: COLORS.grayLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addPhotoIcon: {
    fontSize: 24,
    marginBottom: 4,
  },
  addPhotoText: {
    fontSize: 10,
    color: COLORS.gray,
    fontWeight: '500',
  },

  // Footer
  footer: {
    padding: 16,
    backgroundColor: COLORS.white,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.maroon,
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitIcon: {
    fontSize: 20,
  },
  submitText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.white,
  },
});
