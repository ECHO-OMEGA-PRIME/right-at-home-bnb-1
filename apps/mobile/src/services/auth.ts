/**
 * Right at Home BnB - Authentication Service
 * Firebase Auth with Google/Apple OAuth and biometric support
 * @author ECHO OMEGA PRIME
 */

import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import {
  getAuth,
  signInWithCredential,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User,
  GoogleAuthProvider,
  OAuthProvider,
  Auth,
} from 'firebase/auth';
import * as Google from 'expo-auth-session/providers/google';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as LocalAuthentication from 'expo-local-authentication';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, Alert } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Crypto from 'expo-crypto';

// Complete OAuth redirects
WebBrowser.maybeCompleteAuthSession();

// Firebase configuration
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || '',
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || 'echo-prime-ai.firebaseapp.com',
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || 'echo-prime-ai',
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || 'echo-prime-ai.appspot.com',
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '249995513427',
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || '',
};

// Initialize Firebase
let app: FirebaseApp;
let auth: Auth;

function initFirebase() {
  if (getApps().length === 0) {
    app = initializeApp(firebaseConfig);
  } else {
    app = getApps()[0];
  }
  auth = getAuth(app);
  return { app, auth };
}

// Initialize on module load
initFirebase();

// Storage keys
const AUTH_STORAGE_KEY = '@rightathome_auth';
const BIOMETRIC_ENABLED_KEY = '@rightathome_biometric';

export interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  provider: 'google' | 'apple' | 'email';
  createdAt: string;
}

export interface AuthState {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;
}

/**
 * Convert Firebase User to AuthUser
 */
function firebaseUserToAuthUser(user: User, provider: 'google' | 'apple' | 'email'): AuthUser {
  return {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
    photoURL: user.photoURL,
    provider,
    createdAt: user.metadata.creationTime || new Date().toISOString(),
  };
}

/**
 * Check if biometric authentication is available
 */
export async function isBiometricAvailable(): Promise<{
  available: boolean;
  type: LocalAuthentication.AuthenticationType[];
}> {
  const hasHardware = await LocalAuthentication.hasHardwareAsync();
  const isEnrolled = await LocalAuthentication.isEnrolledAsync();
  const supportedTypes = await LocalAuthentication.supportedAuthenticationTypesAsync();

  return {
    available: hasHardware && isEnrolled,
    type: supportedTypes,
  };
}

/**
 * Authenticate with biometrics
 */
export async function authenticateWithBiometric(): Promise<boolean> {
  try {
    const { available } = await isBiometricAvailable();

    if (!available) {
      return false;
    }

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Authenticate to access Right at Home',
      cancelLabel: 'Cancel',
      disableDeviceFallback: false,
      fallbackLabel: 'Use passcode',
    });

    return result.success;
  } catch (error) {
    console.error('Biometric authentication error:', error);
    return false;
  }
}

/**
 * Enable/disable biometric authentication
 */
export async function setBiometricEnabled(enabled: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(BIOMETRIC_ENABLED_KEY, JSON.stringify(enabled));
  } catch (error) {
    console.error('Error saving biometric preference:', error);
  }
}

/**
 * Check if biometric is enabled for this app
 */
export async function isBiometricEnabled(): Promise<boolean> {
  try {
    const value = await AsyncStorage.getItem(BIOMETRIC_ENABLED_KEY);
    return value ? JSON.parse(value) : false;
  } catch (error) {
    return false;
  }
}

/**
 * Sign in with Google
 */
export async function signInWithGoogle(
  request: Google.GoogleAuthRequestConfig | null,
  response: Google.AuthSessionResult | null,
  promptAsync: () => Promise<Google.AuthSessionResult>
): Promise<AuthUser | null> {
  try {
    if (response?.type === 'success') {
      const { id_token } = response.params;
      const credential = GoogleAuthProvider.credential(id_token);
      const userCredential = await signInWithCredential(auth, credential);

      const authUser = firebaseUserToAuthUser(userCredential.user, 'google');
      await saveAuthUser(authUser);

      return authUser;
    }

    // Prompt for sign in
    const result = await promptAsync();
    if (result.type === 'success') {
      const { id_token } = result.params;
      const credential = GoogleAuthProvider.credential(id_token);
      const userCredential = await signInWithCredential(auth, credential);

      const authUser = firebaseUserToAuthUser(userCredential.user, 'google');
      await saveAuthUser(authUser);

      return authUser;
    }

    return null;
  } catch (error) {
    console.error('Google sign in error:', error);
    throw error;
  }
}

/**
 * Sign in with Apple (iOS only)
 */
export async function signInWithApple(): Promise<AuthUser | null> {
  if (Platform.OS !== 'ios') {
    Alert.alert('Not Available', 'Apple Sign In is only available on iOS devices');
    return null;
  }

  try {
    // Generate nonce for security
    const nonce = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      Math.random().toString()
    );

    const appleCredential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });

    const { identityToken, fullName } = appleCredential;

    if (!identityToken) {
      throw new Error('No identity token received from Apple');
    }

    // Create Firebase credential
    const provider = new OAuthProvider('apple.com');
    const credential = provider.credential({
      idToken: identityToken,
      rawNonce: nonce,
    });

    const userCredential = await signInWithCredential(auth, credential);

    // Update display name if provided by Apple (only on first sign in)
    let displayName = userCredential.user.displayName;
    if (!displayName && fullName) {
      displayName = [fullName.givenName, fullName.familyName].filter(Boolean).join(' ');
    }

    const authUser: AuthUser = {
      uid: userCredential.user.uid,
      email: userCredential.user.email,
      displayName,
      photoURL: userCredential.user.photoURL,
      provider: 'apple',
      createdAt: userCredential.user.metadata.creationTime || new Date().toISOString(),
    };

    await saveAuthUser(authUser);
    return authUser;
  } catch (error: any) {
    if (error.code === 'ERR_CANCELED') {
      // User cancelled
      return null;
    }
    console.error('Apple sign in error:', error);
    throw error;
  }
}

/**
 * Sign out
 */
export async function signOut(): Promise<void> {
  try {
    await firebaseSignOut(auth);
    await AsyncStorage.removeItem(AUTH_STORAGE_KEY);
  } catch (error) {
    console.error('Sign out error:', error);
    throw error;
  }
}

/**
 * Save auth user to local storage
 */
async function saveAuthUser(user: AuthUser): Promise<void> {
  try {
    await AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
  } catch (error) {
    console.error('Error saving auth user:', error);
  }
}

/**
 * Get saved auth user from local storage
 */
export async function getSavedAuthUser(): Promise<AuthUser | null> {
  try {
    const userData = await AsyncStorage.getItem(AUTH_STORAGE_KEY);
    return userData ? JSON.parse(userData) : null;
  } catch (error) {
    console.error('Error getting saved auth user:', error);
    return null;
  }
}

/**
 * Subscribe to auth state changes
 */
export function subscribeToAuthState(
  callback: (user: AuthUser | null) => void
): () => void {
  return onAuthStateChanged(auth, async (firebaseUser) => {
    if (firebaseUser) {
      const savedUser = await getSavedAuthUser();
      const provider = savedUser?.provider || 'email';
      const authUser = firebaseUserToAuthUser(firebaseUser, provider);
      callback(authUser);
    } else {
      callback(null);
    }
  });
}

/**
 * Get current Firebase user
 */
export function getCurrentUser(): User | null {
  return auth.currentUser;
}

/**
 * Check if Apple Sign In is available
 */
export async function isAppleSignInAvailable(): Promise<boolean> {
  if (Platform.OS !== 'ios') {
    return false;
  }
  return await AppleAuthentication.isAvailableAsync();
}

/**
 * Register push token with user
 */
export async function registerPushToken(token: string): Promise<void> {
  const user = getCurrentUser();
  if (!user) return;

  try {
    // Send token to backend
    const response = await fetch('https://api.rightathome.bnb/users/push-token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${await user.getIdToken()}`,
      },
      body: JSON.stringify({
        token,
        platform: Platform.OS,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to register push token');
    }
  } catch (error) {
    console.error('Error registering push token:', error);
  }
}
