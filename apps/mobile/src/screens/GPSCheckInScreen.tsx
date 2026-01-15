/**
 * Right at Home BnB - GPS Check-In Screen
 * Location verification with map view and check-in button
 * @author ECHO OMEGA PRIME
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert,
  ActivityIndicator, Animated, Dimensions, Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker, Circle, PROVIDER_GOOGLE } from 'react-native-maps';
import {
  getCurrentLocation,
  verifyPropertyCheckIn,
  watchLocation,
  PropertyLocation,
  Coordinates,
  LocationCheckResult,
} from '../services/location';
import { COLORS } from '../theme/colors';

const { width, height } = Dimensions.get('window');

interface GPSCheckInScreenProps {
  navigation: any;
  route: {
    params: {
      jobId: string;
      property: PropertyLocation & { name: string; id: string };
      onCheckIn?: (result: LocationCheckResult) => void;
    };
  };
}

export default function GPSCheckInScreen({ navigation, route }: GPSCheckInScreenProps) {
  const { jobId, property, onCheckIn } = route.params;

  const [userLocation, setUserLocation] = useState<Coordinates | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [distance, setDistance] = useState<number | null>(null);
  const [isWithinRange, setIsWithinRange] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [checkInResult, setCheckInResult] = useState<LocationCheckResult | null>(null);

  const mapRef = useRef<MapView>(null);
  const locationWatcher = useRef<{ remove: () => void } | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const checkInAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    initializeLocation();
    startPulseAnimation();

    return () => {
      if (locationWatcher.current) {
        locationWatcher.current.remove();
      }
    };
  }, []);

  const startPulseAnimation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  const initializeLocation = async () => {
    setIsLoading(true);
    setLocationError(null);

    try {
      const location = await getCurrentLocation();

      if (!location) {
        setLocationError('Unable to get your location. Please enable GPS.');
        setIsLoading(false);
        return;
      }

      setUserLocation(location);
      updateDistance(location);

      // Start watching location for live updates
      locationWatcher.current = await watchLocation(
        (newLocation) => {
          setUserLocation(newLocation);
          updateDistance(newLocation);
        },
        (error) => {
          console.error('Location watch error:', error);
        }
      );

      // Center map on property with user visible
      if (mapRef.current) {
        mapRef.current.fitToCoordinates(
          [
            { latitude: property.latitude, longitude: property.longitude },
            location,
          ],
          {
            edgePadding: { top: 100, right: 50, bottom: 200, left: 50 },
            animated: true,
          }
        );
      }
    } catch (error) {
      console.error('Location initialization error:', error);
      setLocationError('Failed to initialize location services.');
    } finally {
      setIsLoading(false);
    }
  };

  const updateDistance = (location: Coordinates) => {
    const R = 6371e3; // Earth's radius in meters
    const phi1 = (location.latitude * Math.PI) / 180;
    const phi2 = (property.latitude * Math.PI) / 180;
    const deltaPhi = ((property.latitude - location.latitude) * Math.PI) / 180;
    const deltaLambda = ((property.longitude - location.longitude) * Math.PI) / 180;

    const a =
      Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
      Math.cos(phi1) * Math.cos(phi2) *
      Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distanceMeters = R * c;

    setDistance(Math.round(distanceMeters));
    setIsWithinRange(distanceMeters <= property.radius);
  };

  const handleCheckIn = async () => {
    if (!isWithinRange) {
      Alert.alert(
        'Too Far Away',
        `You need to be within ${property.radius}m of the property to check in. You are currently ${distance}m away.`,
        [{ text: 'OK' }]
      );
      return;
    }

    setIsCheckingIn(true);

    try {
      const result = await verifyPropertyCheckIn(property);

      setCheckInResult(result);

      if (result.success && result.withinRange) {
        // Animate success
        Animated.spring(checkInAnim, {
          toValue: 1,
          tension: 40,
          friction: 5,
          useNativeDriver: true,
        }).start();

        // Callback
        onCheckIn?.(result);

        // Show success and navigate back after delay
        setTimeout(() => {
          navigation.goBack();
        }, 2000);
      } else {
        Alert.alert(
          'Check-In Failed',
          result.errorMessage || 'Unable to verify your location. Please try again.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Check-in error:', error);
      Alert.alert('Error', 'Failed to check in. Please try again.');
    } finally {
      setIsCheckingIn(false);
    }
  };

  const formatDistance = (meters: number): string => {
    if (meters < 1000) {
      return `${meters}m`;
    }
    return `${(meters / 1000).toFixed(1)}km`;
  };

  const renderStatusBadge = () => {
    if (isLoading) {
      return (
        <View style={[styles.statusBadge, styles.statusLoading]}>
          <ActivityIndicator color={COLORS.white} size="small" />
          <Text style={styles.statusText}>Getting location...</Text>
        </View>
      );
    }

    if (locationError) {
      return (
        <View style={[styles.statusBadge, styles.statusError]}>
          <Text style={styles.statusIcon}>⚠️</Text>
          <Text style={styles.statusText}>{locationError}</Text>
        </View>
      );
    }

    if (checkInResult?.success && checkInResult.withinRange) {
      return (
        <Animated.View
          style={[
            styles.statusBadge,
            styles.statusSuccess,
            { transform: [{ scale: checkInAnim }] },
          ]}
        >
          <Text style={styles.statusIcon}>✓</Text>
          <Text style={styles.statusText}>Checked In!</Text>
        </Animated.View>
      );
    }

    if (isWithinRange) {
      return (
        <View style={[styles.statusBadge, styles.statusReady]}>
          <Text style={styles.statusIcon}>✓</Text>
          <Text style={styles.statusText}>Ready to check in</Text>
        </View>
      );
    }

    return (
      <View style={[styles.statusBadge, styles.statusOutOfRange]}>
        <Text style={styles.statusIcon}>📍</Text>
        <Text style={styles.statusText}>
          {distance !== null ? `${formatDistance(distance)} away` : 'Calculating...'}
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Map View */}
      <View style={styles.mapContainer}>
        <MapView
          ref={mapRef}
          style={styles.map}
          provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
          initialRegion={{
            latitude: property.latitude,
            longitude: property.longitude,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          }}
          showsUserLocation
          showsMyLocationButton={false}
          showsCompass={false}
        >
          {/* Property Marker */}
          <Marker
            coordinate={{
              latitude: property.latitude,
              longitude: property.longitude,
            }}
            title={property.name}
            description={property.address}
          >
            <View style={styles.propertyMarker}>
              <Text style={styles.propertyMarkerIcon}>🏠</Text>
            </View>
          </Marker>

          {/* Check-in Radius Circle */}
          <Circle
            center={{
              latitude: property.latitude,
              longitude: property.longitude,
            }}
            radius={property.radius}
            strokeColor={isWithinRange ? COLORS.success : COLORS.maroon}
            fillColor={
              isWithinRange
                ? `${COLORS.success}20`
                : `${COLORS.maroon}15`
            }
            strokeWidth={2}
          />

          {/* User Location Marker (custom) */}
          {userLocation && (
            <Marker coordinate={userLocation} anchor={{ x: 0.5, y: 0.5 }}>
              <Animated.View
                style={[
                  styles.userMarker,
                  { transform: [{ scale: pulseAnim }] },
                ]}
              >
                <View style={styles.userMarkerInner} />
              </Animated.View>
            </Marker>
          )}
        </MapView>

        {/* Recenter Button */}
        <TouchableOpacity
          style={styles.recenterButton}
          onPress={() => {
            if (userLocation && mapRef.current) {
              mapRef.current.animateToRegion({
                ...userLocation,
                latitudeDelta: 0.005,
                longitudeDelta: 0.005,
              });
            }
          }}
        >
          <Text style={styles.recenterIcon}>◎</Text>
        </TouchableOpacity>
      </View>

      {/* Bottom Panel */}
      <View style={styles.bottomPanel}>
        {/* Property Info */}
        <View style={styles.propertyInfo}>
          <Text style={styles.propertyName}>{property.name}</Text>
          <Text style={styles.propertyAddress}>{property.address}</Text>
        </View>

        {/* Status Badge */}
        {renderStatusBadge()}

        {/* Distance Indicator */}
        {distance !== null && !locationError && (
          <View style={styles.distanceContainer}>
            <View style={styles.distanceBar}>
              <View
                style={[
                  styles.distanceProgress,
                  {
                    width: `${Math.min(100, (1 - distance / (property.radius * 5)) * 100)}%`,
                    backgroundColor: isWithinRange ? COLORS.success : COLORS.gold,
                  },
                ]}
              />
            </View>
            <View style={styles.distanceLabels}>
              <Text style={styles.distanceLabel}>
                {isWithinRange ? 'Within check-in zone' : formatDistance(distance)}
              </Text>
              <Text style={styles.distanceLabelRight}>
                Zone: {property.radius}m radius
              </Text>
            </View>
          </View>
        )}

        {/* Check-In Button */}
        <TouchableOpacity
          style={[
            styles.checkInButton,
            !isWithinRange && styles.checkInButtonDisabled,
            checkInResult?.success && styles.checkInButtonSuccess,
          ]}
          onPress={handleCheckIn}
          disabled={isLoading || isCheckingIn || !isWithinRange || checkInResult?.success}
        >
          {isCheckingIn ? (
            <ActivityIndicator color={COLORS.white} size="small" />
          ) : checkInResult?.success ? (
            <>
              <Text style={styles.checkInIcon}>✓</Text>
              <Text style={styles.checkInText}>Checked In!</Text>
            </>
          ) : (
            <>
              <Text style={styles.checkInIcon}>📍</Text>
              <Text style={styles.checkInText}>
                {isWithinRange ? 'Check In Now' : 'Move Closer to Check In'}
              </Text>
            </>
          )}
        </TouchableOpacity>

        {/* Help Text */}
        <Text style={styles.helpText}>
          You must be within {property.radius} meters of the property to check in
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.cream,
  },

  // Map
  mapContainer: {
    flex: 1,
    position: 'relative',
  },
  map: {
    flex: 1,
  },
  recenterButton: {
    position: 'absolute',
    right: 16,
    top: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  recenterIcon: {
    fontSize: 24,
    color: COLORS.maroon,
  },

  // Markers
  propertyMarker: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  propertyMarkerIcon: {
    fontSize: 24,
  },
  userMarker: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: `${COLORS.maroon}30`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userMarkerInner: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: COLORS.maroon,
    borderWidth: 3,
    borderColor: COLORS.white,
  },

  // Bottom Panel
  bottomPanel: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: Platform.OS === 'ios' ? 24 : 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },

  // Property Info
  propertyInfo: {
    marginBottom: 16,
  },
  propertyName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.charcoal,
    marginBottom: 4,
  },
  propertyAddress: {
    fontSize: 14,
    color: COLORS.gray,
  },

  // Status Badge
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 16,
    gap: 8,
  },
  statusLoading: {
    backgroundColor: COLORS.grayLight,
  },
  statusError: {
    backgroundColor: `${COLORS.error}15`,
  },
  statusReady: {
    backgroundColor: `${COLORS.success}15`,
  },
  statusOutOfRange: {
    backgroundColor: `${COLORS.gold}20`,
  },
  statusSuccess: {
    backgroundColor: COLORS.success,
  },
  statusIcon: {
    fontSize: 18,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.charcoal,
  },

  // Distance
  distanceContainer: {
    marginBottom: 16,
  },
  distanceBar: {
    height: 6,
    backgroundColor: COLORS.grayLighter,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 8,
  },
  distanceProgress: {
    height: '100%',
    borderRadius: 3,
  },
  distanceLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  distanceLabel: {
    fontSize: 12,
    color: COLORS.gray,
    fontWeight: '500',
  },
  distanceLabelRight: {
    fontSize: 12,
    color: COLORS.grayLight,
  },

  // Check-In Button
  checkInButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.maroon,
    paddingVertical: 18,
    borderRadius: 16,
    gap: 10,
    marginBottom: 12,
  },
  checkInButtonDisabled: {
    backgroundColor: COLORS.grayLight,
  },
  checkInButtonSuccess: {
    backgroundColor: COLORS.success,
  },
  checkInIcon: {
    fontSize: 20,
  },
  checkInText: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.white,
  },

  // Help Text
  helpText: {
    fontSize: 12,
    color: COLORS.gray,
    textAlign: 'center',
  },
});
