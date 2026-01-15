/**
 * Right at Home BnB - Photo Capture Screen
 * Camera with checklist overlay and AI quality hints
 * @author ECHO OMEGA PRIME
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert,
  ActivityIndicator, Image, ScrollView, Animated, Dimensions, Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import {
  takePhoto,
  pickPhotoFromGallery,
  uploadPhoto,
  PhotoResult,
  PHOTO_REQUIREMENTS,
} from '../services/camera';
import { COLORS } from '../theme/colors';

const { width, height } = Dimensions.get('window');

interface PhotoCaptureScreenProps {
  navigation: any;
  route: {
    params: {
      jobId: string;
      taskType: keyof typeof PHOTO_REQUIREMENTS;
      taskName: string;
      onPhotoCaptured?: (photo: PhotoResult) => void;
      existingPhotos?: PhotoResult[];
    };
  };
}

export default function PhotoCaptureScreen({ navigation, route }: PhotoCaptureScreenProps) {
  const { jobId, taskType, taskName, onPhotoCaptured, existingPhotos = [] } = route.params;

  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<CameraType>('back');
  const [capturedPhotos, setCapturedPhotos] = useState<PhotoResult[]>(existingPhotos);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showPreview, setShowPreview] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<PhotoResult | null>(null);
  const [showTips, setShowTips] = useState(true);
  const [flashMode, setFlashMode] = useState<'off' | 'on' | 'auto'>('auto');

  const cameraRef = useRef<CameraView>(null);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;

  const requirements = PHOTO_REQUIREMENTS[taskType] || {
    required: 1,
    description: 'Take a photo',
    tips: [],
  };

  const photosRemaining = Math.max(0, requirements.required - capturedPhotos.length);
  const isComplete = capturedPhotos.length >= requirements.required;

  useEffect(() => {
    if (showTips) {
      const timer = setTimeout(() => {
        hideTips();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [showTips]);

  const hideTips = () => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start(() => setShowTips(false));
  };

  if (!permission) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.maroon} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.permissionContainer}>
        <View style={styles.permissionContent}>
          <Text style={styles.permissionIcon}>📷</Text>
          <Text style={styles.permissionTitle}>Camera Access Required</Text>
          <Text style={styles.permissionText}>
            We need camera access to take photos of your completed cleaning tasks.
            Photos are required to verify job completion.
          </Text>
          <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
            <Text style={styles.permissionButtonText}>Enable Camera</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.permissionSecondary}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.permissionSecondaryText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const handleCapture = async () => {
    if (isCapturing || !cameraRef.current) return;

    setIsCapturing(true);

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        skipProcessing: Platform.OS === 'android',
      });

      if (photo) {
        const photoResult: PhotoResult = {
          uri: photo.uri,
          width: photo.width,
          height: photo.height,
          timestamp: new Date(),
        };

        setCapturedPhotos((prev) => [...prev, photoResult]);
        setSelectedPhoto(photoResult);
        setShowPreview(true);

        // Animate slide up
        Animated.spring(slideAnim, {
          toValue: 1,
          tension: 50,
          friction: 8,
          useNativeDriver: true,
        }).start();

        onPhotoCaptured?.(photoResult);
      }
    } catch (error) {
      console.error('Photo capture error:', error);
      Alert.alert('Error', 'Failed to take photo. Please try again.');
    } finally {
      setIsCapturing(false);
    }
  };

  const handlePickFromGallery = async () => {
    try {
      const photos = await pickPhotoFromGallery({
        allowsMultipleSelection: true,
        selectionLimit: photosRemaining,
      });

      if (photos && photos.length > 0) {
        setCapturedPhotos((prev) => [...prev, ...photos]);
        photos.forEach((photo) => onPhotoCaptured?.(photo));

        if (photos.length === 1) {
          setSelectedPhoto(photos[0]);
          setShowPreview(true);
        }
      }
    } catch (error) {
      console.error('Gallery pick error:', error);
    }
  };

  const handleDeletePhoto = (photo: PhotoResult) => {
    Alert.alert(
      'Delete Photo',
      'Are you sure you want to delete this photo?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            setCapturedPhotos((prev) => prev.filter((p) => p.uri !== photo.uri));
            if (selectedPhoto?.uri === photo.uri) {
              setShowPreview(false);
              setSelectedPhoto(null);
            }
          },
        },
      ]
    );
  };

  const handleUploadAll = async () => {
    if (capturedPhotos.length === 0) return;

    setIsUploading(true);
    setUploadProgress(0);

    try {
      for (let i = 0; i < capturedPhotos.length; i++) {
        const result = await uploadPhoto(capturedPhotos[i], jobId);
        setUploadProgress(((i + 1) / capturedPhotos.length) * 100);

        if (!result.success) {
          throw new Error(result.error || 'Upload failed');
        }
      }

      Alert.alert(
        'Upload Complete',
        `${capturedPhotos.length} photo(s) uploaded successfully!`,
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (error: any) {
      Alert.alert('Upload Failed', error.message || 'Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDone = () => {
    if (!isComplete) {
      Alert.alert(
        'Photos Required',
        `You need ${photosRemaining} more photo(s) for this task.`,
        [
          { text: 'Continue Anyway', style: 'destructive', onPress: () => navigation.goBack() },
          { text: 'Take More Photos', style: 'cancel' },
        ]
      );
      return;
    }

    navigation.goBack();
  };

  const toggleCameraFacing = () => {
    setFacing((current) => (current === 'back' ? 'front' : 'back'));
  };

  const cycleFlash = () => {
    const modes: ('off' | 'on' | 'auto')[] = ['auto', 'on', 'off'];
    const currentIndex = modes.indexOf(flashMode);
    setFlashMode(modes[(currentIndex + 1) % modes.length]);
  };

  return (
    <View style={styles.container}>
      {/* Camera View */}
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing={facing}
        flash={flashMode}
      >
        {/* Header Overlay */}
        <SafeAreaView style={styles.headerOverlay}>
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.headerButton}
              onPress={() => navigation.goBack()}
            >
              <Text style={styles.headerButtonText}>✕</Text>
            </TouchableOpacity>

            <View style={styles.headerCenter}>
              <Text style={styles.headerTitle}>{taskName}</Text>
              <Text style={styles.headerSubtitle}>
                {capturedPhotos.length}/{requirements.required} photos
              </Text>
            </View>

            <View style={styles.headerActions}>
              <TouchableOpacity style={styles.headerButton} onPress={cycleFlash}>
                <Text style={styles.headerButtonText}>
                  {flashMode === 'auto' ? '⚡A' : flashMode === 'on' ? '⚡' : '⚡✕'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>

        {/* Tips Overlay */}
        {showTips && requirements.tips.length > 0 && (
          <Animated.View style={[styles.tipsOverlay, { opacity: fadeAnim }]}>
            <TouchableOpacity
              style={styles.tipsContent}
              onPress={hideTips}
              activeOpacity={0.9}
            >
              <Text style={styles.tipsIcon}>💡</Text>
              <Text style={styles.tipsTitle}>Photo Tips</Text>
              {requirements.tips.map((tip, index) => (
                <Text key={index} style={styles.tipText}>• {tip}</Text>
              ))}
              <Text style={styles.tipsDescription}>{requirements.description}</Text>
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* Photo Thumbnails */}
        {capturedPhotos.length > 0 && (
          <View style={styles.thumbnailStrip}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {capturedPhotos.map((photo, index) => (
                <TouchableOpacity
                  key={photo.uri}
                  style={styles.thumbnail}
                  onPress={() => {
                    setSelectedPhoto(photo);
                    setShowPreview(true);
                  }}
                  onLongPress={() => handleDeletePhoto(photo)}
                >
                  <Image source={{ uri: photo.uri }} style={styles.thumbnailImage} />
                  <View style={styles.thumbnailIndex}>
                    <Text style={styles.thumbnailIndexText}>{index + 1}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Controls */}
        <View style={styles.controls}>
          {/* Gallery Button */}
          <TouchableOpacity
            style={styles.sideButton}
            onPress={handlePickFromGallery}
            disabled={isComplete}
          >
            <Text style={styles.sideButtonIcon}>🖼️</Text>
            <Text style={styles.sideButtonLabel}>Gallery</Text>
          </TouchableOpacity>

          {/* Capture Button */}
          <TouchableOpacity
            style={[styles.captureButton, isCapturing && styles.captureButtonActive]}
            onPress={handleCapture}
            disabled={isCapturing}
          >
            <View style={styles.captureButtonOuter}>
              {isCapturing ? (
                <ActivityIndicator color={COLORS.maroon} size="large" />
              ) : (
                <View style={styles.captureButtonInner} />
              )}
            </View>
          </TouchableOpacity>

          {/* Flip Camera Button */}
          <TouchableOpacity style={styles.sideButton} onPress={toggleCameraFacing}>
            <Text style={styles.sideButtonIcon}>🔄</Text>
            <Text style={styles.sideButtonLabel}>Flip</Text>
          </TouchableOpacity>
        </View>

        {/* Progress Bar */}
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${(capturedPhotos.length / requirements.required) * 100}%`,
                  backgroundColor: isComplete ? COLORS.success : COLORS.gold,
                },
              ]}
            />
          </View>
          <Text style={styles.progressText}>
            {isComplete
              ? '✓ All required photos captured'
              : `${photosRemaining} more photo(s) needed`}
          </Text>
        </View>

        {/* Done Button */}
        {capturedPhotos.length > 0 && (
          <TouchableOpacity
            style={[styles.doneButton, isComplete && styles.doneButtonComplete]}
            onPress={handleDone}
          >
            <Text style={styles.doneButtonText}>
              {isComplete ? 'Done' : 'Continue Anyway'}
            </Text>
          </TouchableOpacity>
        )}
      </CameraView>

      {/* Preview Modal */}
      {showPreview && selectedPhoto && (
        <Animated.View
          style={[
            styles.previewOverlay,
            {
              transform: [
                {
                  translateY: slideAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [height, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <SafeAreaView style={styles.previewContainer}>
            <View style={styles.previewHeader}>
              <TouchableOpacity
                style={styles.previewClose}
                onPress={() => {
                  setShowPreview(false);
                  slideAnim.setValue(0);
                }}
              >
                <Text style={styles.previewCloseText}>✕</Text>
              </TouchableOpacity>
              <Text style={styles.previewTitle}>Photo Preview</Text>
              <TouchableOpacity
                style={styles.previewDelete}
                onPress={() => handleDeletePhoto(selectedPhoto)}
              >
                <Text style={styles.previewDeleteText}>🗑️</Text>
              </TouchableOpacity>
            </View>

            <Image
              source={{ uri: selectedPhoto.uri }}
              style={styles.previewImage}
              resizeMode="contain"
            />

            <View style={styles.previewActions}>
              <TouchableOpacity
                style={styles.previewRetake}
                onPress={() => {
                  handleDeletePhoto(selectedPhoto);
                }}
              >
                <Text style={styles.previewRetakeText}>Retake</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.previewUse}
                onPress={() => {
                  setShowPreview(false);
                  slideAnim.setValue(0);
                }}
              >
                <Text style={styles.previewUseText}>Use Photo</Text>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </Animated.View>
      )}

      {/* Upload Progress */}
      {isUploading && (
        <View style={styles.uploadOverlay}>
          <View style={styles.uploadModal}>
            <ActivityIndicator size="large" color={COLORS.maroon} />
            <Text style={styles.uploadText}>Uploading photos...</Text>
            <View style={styles.uploadProgressBar}>
              <View
                style={[styles.uploadProgressFill, { width: `${uploadProgress}%` }]}
              />
            </View>
            <Text style={styles.uploadPercent}>{Math.round(uploadProgress)}%</Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000',
  },

  // Permission Screen
  permissionContainer: {
    flex: 1,
    backgroundColor: COLORS.cream,
  },
  permissionContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  permissionIcon: {
    fontSize: 64,
    marginBottom: 24,
  },
  permissionTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.charcoal,
    marginBottom: 12,
    textAlign: 'center',
  },
  permissionText: {
    fontSize: 16,
    color: COLORS.gray,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  permissionButton: {
    backgroundColor: COLORS.maroon,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    marginBottom: 16,
  },
  permissionButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '600',
  },
  permissionSecondary: {
    padding: 12,
  },
  permissionSecondaryText: {
    color: COLORS.gray,
    fontSize: 14,
  },

  // Camera
  camera: {
    flex: 1,
  },

  // Header
  headerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerButtonText: {
    fontSize: 20,
    color: COLORS.white,
  },
  headerCenter: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.white,
  },
  headerSubtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },

  // Tips
  tipsOverlay: {
    position: 'absolute',
    top: 120,
    left: 20,
    right: 20,
    zIndex: 5,
  },
  tipsContent: {
    backgroundColor: 'rgba(0,0,0,0.8)',
    borderRadius: 16,
    padding: 16,
  },
  tipsIcon: {
    fontSize: 24,
    marginBottom: 8,
  },
  tipsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.white,
    marginBottom: 12,
  },
  tipText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    marginBottom: 6,
  },
  tipsDescription: {
    fontSize: 12,
    color: COLORS.gold,
    marginTop: 8,
    fontStyle: 'italic',
  },

  // Thumbnails
  thumbnailStrip: {
    position: 'absolute',
    bottom: 200,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
  },
  thumbnail: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 8,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: COLORS.white,
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
  thumbnailIndex: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: COLORS.maroon,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbnailIndexText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: COLORS.white,
  },

  // Controls
  controls: {
    position: 'absolute',
    bottom: 100,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 40,
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.3)',
    padding: 4,
  },
  captureButtonActive: {
    opacity: 0.5,
  },
  captureButtonOuter: {
    flex: 1,
    borderRadius: 36,
    borderWidth: 3,
    borderColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureButtonInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.white,
  },
  sideButton: {
    alignItems: 'center',
    gap: 4,
  },
  sideButtonIcon: {
    fontSize: 28,
  },
  sideButtonLabel: {
    fontSize: 12,
    color: COLORS.white,
    fontWeight: '500',
  },

  // Progress
  progressContainer: {
    position: 'absolute',
    bottom: 60,
    left: 20,
    right: 20,
    alignItems: 'center',
  },
  progressBar: {
    width: '100%',
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  progressText: {
    fontSize: 12,
    color: COLORS.white,
    fontWeight: '500',
  },

  // Done Button
  doneButton: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
  },
  doneButtonComplete: {
    backgroundColor: COLORS.success,
  },
  doneButtonText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '600',
  },

  // Preview
  previewOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#000',
    zIndex: 20,
  },
  previewContainer: {
    flex: 1,
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  previewClose: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewCloseText: {
    fontSize: 20,
    color: COLORS.white,
  },
  previewTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.white,
  },
  previewDelete: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,0,0,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewDeleteText: {
    fontSize: 18,
  },
  previewImage: {
    flex: 1,
    width: '100%',
  },
  previewActions: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  previewRetake: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  previewRetakeText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '600',
  },
  previewUse: {
    flex: 1,
    backgroundColor: COLORS.maroon,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  previewUseText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '600',
  },

  // Upload
  uploadOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 30,
  },
  uploadModal: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    width: width - 80,
  },
  uploadText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.charcoal,
    marginTop: 16,
    marginBottom: 16,
  },
  uploadProgressBar: {
    width: '100%',
    height: 6,
    backgroundColor: COLORS.grayLighter,
    borderRadius: 3,
    overflow: 'hidden',
  },
  uploadProgressFill: {
    height: '100%',
    backgroundColor: COLORS.maroon,
    borderRadius: 3,
  },
  uploadPercent: {
    fontSize: 14,
    color: COLORS.gray,
    marginTop: 8,
  },
});
