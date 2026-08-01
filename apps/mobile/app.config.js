// Converted from app.json (P0 credential-exposure cleanup, 2026-07-30).
//
// The iOS Google Maps key was hardcoded here and committed across this repo's
// entire git history. Confirmed dead via a live Geocoding API call
// (REQUEST_DENIED / "API key is invalid"), so this is hygiene rather than an
// active exposure, but a static app.json cannot read environment variables at
// all -- Expo only expands env vars inside app.config.js/ts. Converting is the
// only way to stop committing the next real key the same way.
//
// Set GOOGLE_MAPS_API_KEY_IOS / GOOGLE_MAPS_API_KEY_ANDROID via
// `eas secret:create` (build-time) or your shell for local `expo start`.
// eas.json's per-profile `env` blocks are the existing precedent for how this
// project already injects EXPO_PUBLIC_API_URL.
module.exports = {
  expo: {
    name: 'Right at Home BnB',
    slug: 'rightathome-bnb',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'light',
    newArchEnabled: true,
    splash: {
      image: './assets/splash.png',
      resizeMode: 'contain',
      backgroundColor: '#500000',
    },
    assetBundlePatterns: ['**/*'],
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.rightathome.bnb.cleaner',
      buildNumber: '1',
      infoPlist: {
        NSLocationWhenInUseUsageDescription:
          'Right at Home BnB needs your location to verify property check-ins.',
        NSLocationAlwaysAndWhenInUseUsageDescription:
          'Right at Home BnB needs your location to verify property check-ins.',
        NSCameraUsageDescription:
          'Right at Home BnB needs camera access to document cleaning tasks.',
        NSPhotoLibraryUsageDescription:
          'Right at Home BnB needs photo library access to save cleaning photos.',
      },
      config: {
        googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY_IOS || 'YOUR_GOOGLE_MAPS_API_KEY',
      },
    },
    android: {
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#500000',
      },
      package: 'com.rightathome.bnb.cleaner',
      versionCode: 1,
      permissions: [
        'android.permission.ACCESS_COARSE_LOCATION',
        'android.permission.ACCESS_FINE_LOCATION',
        'android.permission.CAMERA',
        'android.permission.READ_EXTERNAL_STORAGE',
        'android.permission.WRITE_EXTERNAL_STORAGE',
        'android.permission.RECEIVE_BOOT_COMPLETED',
        'android.permission.VIBRATE',
        'android.permission.ACCESS_COARSE_LOCATION',
        'android.permission.ACCESS_FINE_LOCATION',
        'android.permission.FOREGROUND_SERVICE',
        'android.permission.CAMERA',
        'android.permission.RECORD_AUDIO',
      ],
      config: {
        googleMaps: {
          apiKey: process.env.GOOGLE_MAPS_API_KEY_ANDROID || 'YOUR_GOOGLE_MAPS_API_KEY',
        },
      },
      googleServicesFile: './google-services.json',
    },
    plugins: [
      [
        'expo-location',
        {
          locationAlwaysAndWhenInUsePermission:
            'Allow Right at Home BnB to use your location for property check-ins.',
        },
      ],
      [
        'expo-camera',
        {
          cameraPermission: 'Allow Right at Home BnB to access your camera for task photos.',
        },
      ],
      [
        'expo-image-picker',
        {
          photosPermission: 'Allow Right at Home BnB to access your photos.',
        },
      ],
      [
        'expo-notifications',
        {
          icon: './assets/notification-icon.png',
          color: '#500000',
          sounds: ['./assets/sounds/notification.wav'],
        },
      ],
    ],
    extra: {
      eas: {
        projectId: '97efd940-6011-44be-9993-79c71842d178',
      },
    },
    owner: 'echoprimeai',
    runtimeVersion: {
      policy: 'appVersion',
    },
  },
};
