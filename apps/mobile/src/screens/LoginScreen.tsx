/**
 * Right at Home BnB - Login Screen
 * Google/Apple OAuth with Firebase + Biometric Authentication
 * @author ECHO OMEGA PRIME
 */

import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Image,
  ActivityIndicator, Alert, Platform, Dimensions, Animated
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Google from 'expo-auth-session/providers/google';
import * as AppleAuthentication from 'expo-apple-authentication';
import {
  signInWithGoogle,
  signInWithApple,
  getSavedAuthUser,
  isBiometricAvailable,
  authenticateWithBiometric,
  isBiometricEnabled,
  isAppleSignInAvailable,
  AuthUser,
} from '../services/auth';
import { COLORS } from '../theme/colors';

const { width, height } = Dimensions.get('window');

interface LoginScreenProps {
  navigation: any;
  onLoginSuccess: (user: AuthUser) => void;
}

export default function LoginScreen({ navigation, onLoginSuccess }: LoginScreenProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [loadingProvider, setLoadingProvider] = useState<'google' | 'apple' | 'biometric' | null>(null);
  const [canUseBiometric, setCanUseBiometric] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [appleAvailable, setAppleAvailable] = useState(false);
  const [savedUser, setSavedUser] = useState<AuthUser | null>(null);

  // Animation values
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const slideAnim = React.useRef(new Animated.Value(50)).current;

  // Google OAuth config
  const [request, response, promptAsync] = Google.useAuthRequest({
    expoClientId: process.env.EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID,
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  });

  useEffect(() => {
    initializeLogin();
    startAnimations();
  }, []);

  const startAnimations = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 40,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const initializeLogin = async () => {
    // Check for saved user
    const user = await getSavedAuthUser();
    setSavedUser(user);

    // Check biometric availability
    const { available } = await isBiometricAvailable();
    setCanUseBiometric(available);

    const bioEnabled = await isBiometricEnabled();
    setBiometricEnabled(bioEnabled);

    // Check Apple Sign In availability
    const appleIsAvailable = await isAppleSignInAvailable();
    setAppleAvailable(appleIsAvailable);

    // Auto-prompt biometric if user has logged in before
    if (user && available && bioEnabled) {
      handleBiometricLogin();
    }
  };

  const handleGoogleLogin = async () => {
    try {
      setIsLoading(true);
      setLoadingProvider('google');

      const user = await signInWithGoogle(request, response, promptAsync);

      if (user) {
        onLoginSuccess(user);
      }
    } catch (error: any) {
      console.error('Google login error:', error);
      Alert.alert(
        'Sign In Failed',
        error.message || 'Unable to sign in with Google. Please try again.'
      );
    } finally {
      setIsLoading(false);
      setLoadingProvider(null);
    }
  };

  const handleAppleLogin = async () => {
    try {
      setIsLoading(true);
      setLoadingProvider('apple');

      const user = await signInWithApple();

      if (user) {
        onLoginSuccess(user);
      }
    } catch (error: any) {
      console.error('Apple login error:', error);
      Alert.alert(
        'Sign In Failed',
        error.message || 'Unable to sign in with Apple. Please try again.'
      );
    } finally {
      setIsLoading(false);
      setLoadingProvider(null);
    }
  };

  const handleBiometricLogin = async () => {
    if (!savedUser) {
      Alert.alert('No Account', 'Please sign in with Google or Apple first.');
      return;
    }

    try {
      setIsLoading(true);
      setLoadingProvider('biometric');

      const success = await authenticateWithBiometric();

      if (success) {
        onLoginSuccess(savedUser);
      }
    } catch (error: any) {
      console.error('Biometric login error:', error);
    } finally {
      setIsLoading(false);
      setLoadingProvider(null);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Logo Section */}
        <Animated.View
          style={[
            styles.logoSection,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <View style={styles.logoContainer}>
            <Text style={styles.logoIcon}>🏠</Text>
            <View style={styles.logoGlow} />
          </View>
          <Text style={styles.title}>Right at Home</Text>
          <Text style={styles.subtitle}>Professional Cleaning Services</Text>
        </Animated.View>

        {/* Welcome Back Message */}
        {savedUser && (
          <Animated.View
            style={[
              styles.welcomeBack,
              { opacity: fadeAnim }
            ]}
          >
            <Text style={styles.welcomeBackText}>
              Welcome back, {savedUser.displayName?.split(' ')[0]}!
            </Text>
          </Animated.View>
        )}

        {/* Login Buttons */}
        <Animated.View
          style={[
            styles.buttonSection,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          {/* Biometric Login */}
          {canUseBiometric && savedUser && biometricEnabled && (
            <TouchableOpacity
              style={[styles.biometricButton, isLoading && styles.buttonDisabled]}
              onPress={handleBiometricLogin}
              disabled={isLoading}
            >
              {loadingProvider === 'biometric' ? (
                <ActivityIndicator color={COLORS.maroon} size="small" />
              ) : (
                <>
                  <Text style={styles.biometricIcon}>
                    {Platform.OS === 'ios' ? '👤' : '🔓'}
                  </Text>
                  <Text style={styles.biometricText}>
                    {Platform.OS === 'ios' ? 'Sign in with Face ID' : 'Sign in with Fingerprint'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          )}

          {/* Divider */}
          {canUseBiometric && savedUser && biometricEnabled && (
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or continue with</Text>
              <View style={styles.dividerLine} />
            </View>
          )}

          {/* Google Sign In */}
          <TouchableOpacity
            style={[styles.socialButton, styles.googleButton, isLoading && styles.buttonDisabled]}
            onPress={handleGoogleLogin}
            disabled={isLoading}
          >
            {loadingProvider === 'google' ? (
              <ActivityIndicator color={COLORS.charcoal} size="small" />
            ) : (
              <>
                <View style={styles.socialIconContainer}>
                  <Text style={styles.socialIcon}>G</Text>
                </View>
                <Text style={styles.socialButtonText}>Continue with Google</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Apple Sign In */}
          {appleAvailable && (
            <TouchableOpacity
              style={[styles.socialButton, styles.appleButton, isLoading && styles.buttonDisabled]}
              onPress={handleAppleLogin}
              disabled={isLoading}
            >
              {loadingProvider === 'apple' ? (
                <ActivityIndicator color={COLORS.white} size="small" />
              ) : (
                <>
                  <View style={styles.socialIconContainer}>
                    <Text style={[styles.socialIcon, styles.appleIcon]}></Text>
                  </View>
                  <Text style={[styles.socialButtonText, styles.appleButtonText]}>
                    Continue with Apple
                  </Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </Animated.View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            By signing in, you agree to our{' '}
            <Text style={styles.footerLink}>Terms of Service</Text>
            {' '}and{' '}
            <Text style={styles.footerLink}>Privacy Policy</Text>
          </Text>
        </View>

        {/* Brand Badge */}
        <View style={styles.brandBadge}>
          <Text style={styles.brandText}>Powered by Steven's BnB Network</Text>
          <Text style={styles.brandSubtext}>22 Properties in Midland, TX</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.cream,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
  },

  // Logo Section
  logoSection: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    shadowColor: COLORS.maroon,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    position: 'relative',
  },
  logoGlow: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: COLORS.gold,
    opacity: 0.15,
  },
  logoIcon: {
    fontSize: 48,
    zIndex: 1,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: COLORS.maroon,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.gray,
  },

  // Welcome Back
  welcomeBack: {
    alignItems: 'center',
    marginBottom: 24,
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: `${COLORS.gold}20`,
    borderRadius: 20,
    alignSelf: 'center',
  },
  welcomeBackText: {
    fontSize: 14,
    color: COLORS.charcoal,
    fontWeight: '500',
  },

  // Button Section
  buttonSection: {
    gap: 12,
  },

  // Biometric Button
  biometricButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.white,
    borderWidth: 2,
    borderColor: COLORS.maroon,
    borderRadius: 12,
    paddingVertical: 16,
    gap: 12,
  },
  biometricIcon: {
    fontSize: 24,
  },
  biometricText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.maroon,
  },

  // Divider
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.grayLighter,
  },
  dividerText: {
    fontSize: 12,
    color: COLORS.gray,
  },

  // Social Buttons
  socialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingVertical: 16,
    gap: 12,
  },
  googleButton: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.grayLighter,
  },
  appleButton: {
    backgroundColor: COLORS.charcoal,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  socialIconContainer: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  socialIcon: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.charcoal,
  },
  appleIcon: {
    color: COLORS.white,
    fontSize: 20,
  },
  socialButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.charcoal,
  },
  appleButtonText: {
    color: COLORS.white,
  },

  // Footer
  footer: {
    marginTop: 32,
    paddingHorizontal: 16,
  },
  footerText: {
    fontSize: 12,
    color: COLORS.gray,
    textAlign: 'center',
    lineHeight: 18,
  },
  footerLink: {
    color: COLORS.maroon,
    fontWeight: '500',
  },

  // Brand Badge
  brandBadge: {
    position: 'absolute',
    bottom: 24,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  brandText: {
    fontSize: 12,
    color: COLORS.gray,
    fontWeight: '500',
  },
  brandSubtext: {
    fontSize: 11,
    color: COLORS.grayLight,
    marginTop: 2,
  },
});
