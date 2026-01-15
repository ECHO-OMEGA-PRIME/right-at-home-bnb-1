/**
 * Right at Home BnB - Location Service
 * Real GPS verification for cleaner check-ins
 * @author ECHO OMEGA PRIME
 */

import * as Location from 'expo-location';
import { Alert, Linking, Platform } from 'react-native';

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface PropertyLocation extends Coordinates {
  address: string;
  radius: number; // Meters allowed for check-in
}

export interface LocationCheckResult {
  success: boolean;
  withinRange: boolean;
  distance: number; // Meters from property
  currentLocation: Coordinates | null;
  timestamp: Date;
  errorMessage?: string;
}

/**
 * Calculate distance between two coordinates using Haversine formula
 */
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Earth's radius in meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) *
    Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
}

/**
 * Request location permissions
 */
export async function requestLocationPermission(): Promise<boolean> {
  try {
    const { status: existingStatus } = await Location.getForegroundPermissionsAsync();

    if (existingStatus === 'granted') {
      return true;
    }

    const { status } = await Location.requestForegroundPermissionsAsync();

    if (status !== 'granted') {
      Alert.alert(
        'Location Required',
        'GPS check-in requires location access. Please enable location in settings.',
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
    console.error('Error requesting location permission:', error);
    return false;
  }
}

/**
 * Get current GPS location with high accuracy
 */
export async function getCurrentLocation(): Promise<Coordinates | null> {
  try {
    const hasPermission = await requestLocationPermission();
    if (!hasPermission) {
      return null;
    }

    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });

    return {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
    };
  } catch (error) {
    console.error('Error getting current location:', error);
    return null;
  }
}

/**
 * Verify user is within range of property for check-in
 */
export async function verifyPropertyCheckIn(
  property: PropertyLocation
): Promise<LocationCheckResult> {
  const timestamp = new Date();

  try {
    const currentLocation = await getCurrentLocation();

    if (!currentLocation) {
      return {
        success: false,
        withinRange: false,
        distance: -1,
        currentLocation: null,
        timestamp,
        errorMessage: 'Unable to get current location. Please enable GPS.',
      };
    }

    const distance = calculateDistance(
      currentLocation.latitude,
      currentLocation.longitude,
      property.latitude,
      property.longitude
    );

    const withinRange = distance <= property.radius;

    return {
      success: true,
      withinRange,
      distance: Math.round(distance),
      currentLocation,
      timestamp,
      errorMessage: withinRange
        ? undefined
        : `You are ${Math.round(distance)}m away. Must be within ${property.radius}m to check in.`,
    };
  } catch (error) {
    return {
      success: false,
      withinRange: false,
      distance: -1,
      currentLocation: null,
      timestamp,
      errorMessage: `Location error: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Start watching location (for live tracking during job)
 */
export async function watchLocation(
  callback: (location: Coordinates) => void,
  errorCallback?: (error: string) => void
): Promise<{ remove: () => void } | null> {
  try {
    const hasPermission = await requestLocationPermission();
    if (!hasPermission) {
      errorCallback?.('Location permission denied');
      return null;
    }

    const subscription = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.Balanced,
        distanceInterval: 10, // Update every 10 meters
        timeInterval: 30000, // Or every 30 seconds
      },
      (location) => {
        callback({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });
      }
    );

    return subscription;
  } catch (error) {
    errorCallback?.(error instanceof Error ? error.message : 'Unknown error');
    return null;
  }
}

/**
 * Get formatted address from coordinates (reverse geocoding)
 */
export async function getAddressFromCoordinates(
  coords: Coordinates
): Promise<string | null> {
  try {
    const [result] = await Location.reverseGeocodeAsync(coords);

    if (result) {
      const parts = [
        result.streetNumber,
        result.street,
        result.city,
        result.region,
        result.postalCode,
      ].filter(Boolean);

      return parts.join(', ');
    }

    return null;
  } catch (error) {
    console.error('Reverse geocoding error:', error);
    return null;
  }
}

// Sample property locations for Steven's 22 properties in Midland, TX
export const MIDLAND_PROPERTIES: Record<string, PropertyLocation> = {
  'castleford-estate': {
    latitude: 31.9973,
    longitude: -102.0779,
    address: '123 Oak Lane, Midland, TX 79705',
    radius: 100, // 100 meter check-in radius
  },
  'permian-palace': {
    latitude: 32.0052,
    longitude: -102.1021,
    address: '456 Basin Blvd, Midland, TX 79701',
    radius: 100,
  },
  'sunset-retreat': {
    latitude: 31.9845,
    longitude: -102.0653,
    address: '789 Desert Rose Dr, Midland, TX 79703',
    radius: 100,
  },
  // Add more properties as needed
};
