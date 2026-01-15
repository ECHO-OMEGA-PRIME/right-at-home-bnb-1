/**
 * Right at Home BnB - Camera Service
 * Photo documentation for cleaning jobs
 * @author ECHO OMEGA PRIME
 */

import * as ImagePicker from 'expo-image-picker';
import { Camera } from 'expo-camera';
import { Alert, Linking, Platform } from 'react-native';

export interface PhotoResult {
  uri: string;
  width: number;
  height: number;
  base64?: string;
  exif?: Record<string, any>;
  timestamp: Date;
}

export interface PhotoUploadResult {
  success: boolean;
  photoId?: string;
  url?: string;
  error?: string;
}

/**
 * Request camera permissions
 */
export async function requestCameraPermission(): Promise<boolean> {
  try {
    const { status: existingStatus } = await Camera.getCameraPermissionsAsync();

    if (existingStatus === 'granted') {
      return true;
    }

    const { status } = await Camera.requestCameraPermissionsAsync();

    if (status !== 'granted') {
      Alert.alert(
        'Camera Required',
        'Photo documentation requires camera access. Please enable camera in settings.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Open Settings',
            onPress: () => {
              if (Platform.OS === 'ios') {
                Linking.openURL('app-settings:');
              } else {
                Linking.openSettings();
              }
            }
          }
        ]
      );
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error requesting camera permission:', error);
    return false;
  }
}

/**
 * Request media library permissions (for picking from gallery)
 */
export async function requestMediaLibraryPermission(): Promise<boolean> {
  try {
    const { status: existingStatus } = await ImagePicker.getMediaLibraryPermissionsAsync();

    if (existingStatus === 'granted') {
      return true;
    }

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (status !== 'granted') {
      Alert.alert(
        'Photo Library Required',
        'Access to photo library is needed to select photos.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Open Settings',
            onPress: () => {
              if (Platform.OS === 'ios') {
                Linking.openURL('app-settings:');
              } else {
                Linking.openSettings();
              }
            }
          }
        ]
      );
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error requesting media library permission:', error);
    return false;
  }
}

/**
 * Take photo with camera
 */
export async function takePhoto(options?: {
  quality?: number;
  includeBase64?: boolean;
  includeExif?: boolean;
}): Promise<PhotoResult | null> {
  try {
    const hasPermission = await requestCameraPermission();
    if (!hasPermission) {
      return null;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: options?.quality ?? 0.8,
      base64: options?.includeBase64 ?? false,
      exif: options?.includeExif ?? true,
    });

    if (result.canceled || !result.assets || result.assets.length === 0) {
      return null;
    }

    const asset = result.assets[0];
    return {
      uri: asset.uri,
      width: asset.width,
      height: asset.height,
      base64: asset.base64,
      exif: asset.exif,
      timestamp: new Date(),
    };
  } catch (error) {
    console.error('Error taking photo:', error);
    Alert.alert('Camera Error', 'Failed to take photo. Please try again.');
    return null;
  }
}

/**
 * Pick photo from gallery
 */
export async function pickPhotoFromGallery(options?: {
  quality?: number;
  includeBase64?: boolean;
  allowsMultipleSelection?: boolean;
  selectionLimit?: number;
}): Promise<PhotoResult[] | null> {
  try {
    const hasPermission = await requestMediaLibraryPermission();
    if (!hasPermission) {
      return null;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      allowsMultipleSelection: options?.allowsMultipleSelection ?? false,
      selectionLimit: options?.selectionLimit ?? 1,
      quality: options?.quality ?? 0.8,
      base64: options?.includeBase64 ?? false,
    });

    if (result.canceled || !result.assets || result.assets.length === 0) {
      return null;
    }

    return result.assets.map((asset) => ({
      uri: asset.uri,
      width: asset.width,
      height: asset.height,
      base64: asset.base64,
      exif: asset.exif ?? undefined,
      timestamp: new Date(),
    }));
  } catch (error) {
    console.error('Error picking photo:', error);
    Alert.alert('Gallery Error', 'Failed to select photo. Please try again.');
    return null;
  }
}

/**
 * Upload photo to server
 */
export async function uploadPhoto(
  photo: PhotoResult,
  jobId: string,
  taskId?: number
): Promise<PhotoUploadResult> {
  try {
    // Create form data for upload
    const formData = new FormData();

    // Get file extension from URI
    const uriParts = photo.uri.split('.');
    const fileType = uriParts[uriParts.length - 1];

    formData.append('photo', {
      uri: photo.uri,
      name: `job_${jobId}_${Date.now()}.${fileType}`,
      type: `image/${fileType}`,
    } as any);

    formData.append('jobId', jobId);
    if (taskId) {
      formData.append('taskId', taskId.toString());
    }
    formData.append('timestamp', photo.timestamp.toISOString());

    // Upload to API
    const response = await fetch('https://api.rightathome.bnb/photos/upload', {
      method: 'POST',
      headers: {
        'Content-Type': 'multipart/form-data',
        // Add auth header
      },
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.status}`);
    }

    const data = await response.json();
    return {
      success: true,
      photoId: data.id,
      url: data.url,
    };
  } catch (error) {
    console.error('Photo upload error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Upload failed',
    };
  }
}

/**
 * Upload multiple photos in batch
 */
export async function uploadPhotos(
  photos: PhotoResult[],
  jobId: string,
  onProgress?: (completed: number, total: number) => void
): Promise<{
  successful: PhotoUploadResult[];
  failed: PhotoUploadResult[];
}> {
  const successful: PhotoUploadResult[] = [];
  const failed: PhotoUploadResult[] = [];

  for (let i = 0; i < photos.length; i++) {
    const result = await uploadPhoto(photos[i], jobId);

    if (result.success) {
      successful.push(result);
    } else {
      failed.push(result);
    }

    onProgress?.(i + 1, photos.length);
  }

  return { successful, failed };
}

/**
 * Compress photo if too large
 */
export async function compressPhoto(
  photo: PhotoResult,
  maxWidth: number = 1920
): Promise<PhotoResult> {
  // If already small enough, return as-is
  if (photo.width <= maxWidth) {
    return photo;
  }

  // Use ImageManipulator for compression if needed
  // For now, the quality setting in takePhoto handles most cases
  return photo;
}

// Photo requirements for different task types
export const PHOTO_REQUIREMENTS = {
  bedroom: {
    required: 2,
    description: 'Bed made + overall room shot',
    tips: ['Show all pillows arranged', 'Capture whole bed in frame'],
  },
  bathroom: {
    required: 3,
    description: 'Toilet, sink/vanity, shower/tub',
    tips: ['Show toilet paper stocked', 'Capture mirror reflection for cleanliness'],
  },
  kitchen: {
    required: 2,
    description: 'Counters + appliances',
    tips: ['Show stovetop clean', 'Open fridge if restocked'],
  },
  livingRoom: {
    required: 1,
    description: 'Overall room shot',
    tips: ['Show cushions arranged', 'Capture TV area'],
  },
  exterior: {
    required: 1,
    description: 'Front entrance/porch',
    tips: ['Show doormat clean', 'Capture welcome items'],
  },
  finalWalkthrough: {
    required: 3,
    description: 'Entry, main living area, key handoff location',
    tips: ['Timestamp visible helps', 'Show property looking ready for guests'],
  },
};
