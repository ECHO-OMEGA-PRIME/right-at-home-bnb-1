/**
 * Right at Home BnB - Settings Screen
 * Profile settings, preferences, and app configuration
 * @author ECHO OMEGA PRIME
 */

import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Switch, Alert, Image, Linking, Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';
import * as Application from 'expo-application';
import { COLORS } from '../theme/colors';
import { signOut, getCurrentUser } from '../services/auth';

interface SettingsScreenProps {
  navigation: any;
}

interface UserProfile {
  id: string;
  name: string;
  email: string;
  phone?: string;
  avatar?: string;
  role: 'cleaner' | 'host' | 'admin';
  memberSince: Date;
}

interface AppSettings {
  notifications: {
    enabled: boolean;
    jobAlerts: boolean;
    messages: boolean;
    payments: boolean;
    marketing: boolean;
  };
  privacy: {
    shareLocation: boolean;
    shareActivity: boolean;
    analyticsEnabled: boolean;
  };
  appearance: {
    darkMode: 'system' | 'light' | 'dark';
    reducedMotion: boolean;
  };
  security: {
    biometricEnabled: boolean;
    autoLockEnabled: boolean;
    autoLockTimeout: number;
  };
}

const DEFAULT_SETTINGS: AppSettings = {
  notifications: {
    enabled: true,
    jobAlerts: true,
    messages: true,
    payments: true,
    marketing: false,
  },
  privacy: {
    shareLocation: true,
    shareActivity: true,
    analyticsEnabled: true,
  },
  appearance: {
    darkMode: 'system',
    reducedMotion: false,
  },
  security: {
    biometricEnabled: false,
    autoLockEnabled: false,
    autoLockTimeout: 5,
  },
};

const SETTINGS_KEY = '@rightathome_settings';

export default function SettingsScreen({ navigation }: SettingsScreenProps) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricType, setBiometricType] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadData();
    checkBiometrics();
  }, []);

  const loadData = async () => {
    try {
      // Load user profile
      const user = getCurrentUser();
      if (user) {
        setProfile({
          id: user.uid,
          name: user.displayName || 'User',
          email: user.email || '',
          avatar: user.photoURL || undefined,
          role: 'cleaner',
          memberSince: new Date(),
        });
      } else {
        // Demo profile
        setProfile({
          id: 'demo123',
          name: 'John Smith',
          email: 'john.smith@example.com',
          phone: '+1 (432) 555-0123',
          role: 'cleaner',
          memberSince: new Date('2024-06-15'),
        });
      }

      // Load settings
      const storedSettings = await AsyncStorage.getItem(SETTINGS_KEY);
      if (storedSettings) {
        setSettings(JSON.parse(storedSettings));
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const checkBiometrics = async () => {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      setBiometricAvailable(hasHardware && isEnrolled);

      if (hasHardware) {
        const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
        if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
          setBiometricType('Face ID');
        } else if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
          setBiometricType('Touch ID');
        } else {
          setBiometricType('Biometric');
        }
      }
    } catch (error) {
      console.error('Biometric check failed:', error);
    }
  };

  const saveSettings = async (newSettings: AppSettings) => {
    try {
      await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(newSettings));
      setSettings(newSettings);
    } catch (error) {
      console.error('Failed to save settings:', error);
      Alert.alert('Error', 'Failed to save settings. Please try again.');
    }
  };

  const updateSetting = <T extends keyof AppSettings>(
    category: T,
    key: keyof AppSettings[T],
    value: any
  ) => {
    const newSettings = {
      ...settings,
      [category]: {
        ...settings[category],
        [key]: value,
      },
    };
    saveSettings(newSettings);
  };

  const handleLogout = () => {
    Alert.alert(
      'Log Out',
      'Are you sure you want to log out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log Out',
          style: 'destructive',
          onPress: async () => {
            try {
              await signOut();
              navigation.reset({
                index: 0,
                routes: [{ name: 'Login' }],
              });
            } catch (error) {
              console.error('Logout failed:', error);
              Alert.alert('Error', 'Failed to log out. Please try again.');
            }
          },
        },
      ]
    );
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'This will permanently delete your account and all associated data. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Confirm Deletion',
              'Type DELETE to confirm account deletion.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'I Understand',
                  style: 'destructive',
                  onPress: () => {
                    // In production, call API to delete account
                    Alert.alert('Account Deleted', 'Your account has been scheduled for deletion.');
                  },
                },
              ]
            );
          },
        },
      ]
    );
  };

  const openURL = (url: string) => {
    Linking.openURL(url).catch((err) => {
      console.error('Failed to open URL:', err);
      Alert.alert('Error', 'Could not open link.');
    });
  };

  const renderSettingRow = (
    icon: string,
    label: string,
    value?: React.ReactNode,
    onPress?: () => void
  ) => (
    <TouchableOpacity
      style={styles.settingRow}
      onPress={onPress}
      disabled={!onPress}
    >
      <View style={styles.settingLeft}>
        <Text style={styles.settingIcon}>{icon}</Text>
        <Text style={styles.settingLabel}>{label}</Text>
      </View>
      {value || (onPress && <Text style={styles.chevron}>›</Text>)}
    </TouchableOpacity>
  );

  const renderToggle = (
    icon: string,
    label: string,
    value: boolean,
    onToggle: (val: boolean) => void
  ) => (
    <View style={styles.settingRow}>
      <View style={styles.settingLeft}>
        <Text style={styles.settingIcon}>{icon}</Text>
        <Text style={styles.settingLabel}>{label}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ false: COLORS.grayLighter, true: `${COLORS.maroon}50` }}
        thumbColor={value ? COLORS.maroon : COLORS.white}
        ios_backgroundColor={COLORS.grayLighter}
      />
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Profile Section */}
        <View style={styles.profileSection}>
          <View style={styles.avatarContainer}>
            {profile?.avatar ? (
              <Image source={{ uri: profile.avatar }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarInitial}>
                  {profile?.name?.charAt(0) || 'U'}
                </Text>
              </View>
            )}
            <TouchableOpacity style={styles.editAvatarButton}>
              <Text style={styles.editAvatarIcon}>📷</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.profileName}>{profile?.name || 'Loading...'}</Text>
          <Text style={styles.profileEmail}>{profile?.email || ''}</Text>
          <View style={styles.roleBadge}>
            <Text style={styles.roleText}>
              {profile?.role === 'cleaner' ? '🧹 Cleaner' :
               profile?.role === 'host' ? '🏠 Host' : '⭐ Admin'}
            </Text>
          </View>
        </View>

        {/* Account Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <View style={styles.sectionContent}>
            {renderSettingRow('👤', 'Edit Profile', undefined, () => navigation.navigate('EditProfile'))}
            {renderSettingRow('📞', 'Phone Number',
              <Text style={styles.settingValue}>{profile?.phone || 'Not set'}</Text>,
              () => navigation.navigate('EditPhone')
            )}
            {renderSettingRow('💳', 'Payment Methods', undefined, () => navigation.navigate('PaymentMethods'))}
            {renderSettingRow('📄', 'Tax Documents', undefined, () => navigation.navigate('TaxDocuments'))}
          </View>
        </View>

        {/* Notifications Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notifications</Text>
          <View style={styles.sectionContent}>
            {renderToggle('🔔', 'Push Notifications',
              settings.notifications.enabled,
              (val) => updateSetting('notifications', 'enabled', val)
            )}
            {settings.notifications.enabled && (
              <>
                {renderToggle('🏠', 'Job Alerts',
                  settings.notifications.jobAlerts,
                  (val) => updateSetting('notifications', 'jobAlerts', val)
                )}
                {renderToggle('💬', 'Messages',
                  settings.notifications.messages,
                  (val) => updateSetting('notifications', 'messages', val)
                )}
                {renderToggle('💰', 'Payments',
                  settings.notifications.payments,
                  (val) => updateSetting('notifications', 'payments', val)
                )}
                {renderToggle('📧', 'Marketing',
                  settings.notifications.marketing,
                  (val) => updateSetting('notifications', 'marketing', val)
                )}
              </>
            )}
          </View>
        </View>

        {/* Privacy Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Privacy</Text>
          <View style={styles.sectionContent}>
            {renderToggle('📍', 'Share Location',
              settings.privacy.shareLocation,
              (val) => updateSetting('privacy', 'shareLocation', val)
            )}
            {renderToggle('📊', 'Share Activity',
              settings.privacy.shareActivity,
              (val) => updateSetting('privacy', 'shareActivity', val)
            )}
            {renderToggle('📈', 'Analytics',
              settings.privacy.analyticsEnabled,
              (val) => updateSetting('privacy', 'analyticsEnabled', val)
            )}
          </View>
        </View>

        {/* Security Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Security</Text>
          <View style={styles.sectionContent}>
            {biometricAvailable && renderToggle(
              biometricType === 'Face ID' ? '🔐' : '👆',
              biometricType,
              settings.security.biometricEnabled,
              (val) => updateSetting('security', 'biometricEnabled', val)
            )}
            {renderSettingRow('🔑', 'Change Password', undefined,
              () => navigation.navigate('ChangePassword')
            )}
            {renderToggle('⏰', 'Auto-Lock',
              settings.security.autoLockEnabled,
              (val) => updateSetting('security', 'autoLockEnabled', val)
            )}
          </View>
        </View>

        {/* Appearance Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Appearance</Text>
          <View style={styles.sectionContent}>
            {renderSettingRow('🌓', 'Theme',
              <Text style={styles.settingValue}>
                {settings.appearance.darkMode === 'system' ? 'System' :
                 settings.appearance.darkMode === 'dark' ? 'Dark' : 'Light'}
              </Text>,
              () => {
                Alert.alert('Select Theme', 'Choose your preferred theme', [
                  { text: 'System', onPress: () => updateSetting('appearance', 'darkMode', 'system') },
                  { text: 'Light', onPress: () => updateSetting('appearance', 'darkMode', 'light') },
                  { text: 'Dark', onPress: () => updateSetting('appearance', 'darkMode', 'dark') },
                  { text: 'Cancel', style: 'cancel' },
                ]);
              }
            )}
            {renderToggle('🎬', 'Reduce Motion',
              settings.appearance.reducedMotion,
              (val) => updateSetting('appearance', 'reducedMotion', val)
            )}
          </View>
        </View>

        {/* Support Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Support</Text>
          <View style={styles.sectionContent}>
            {renderSettingRow('❓', 'Help Center', undefined,
              () => openURL('https://rightathome.bnb/help')
            )}
            {renderSettingRow('💬', 'Contact Support', undefined,
              () => openURL('mailto:support@rightathome.bnb')
            )}
            {renderSettingRow('📝', 'Report a Problem', undefined,
              () => navigation.navigate('ReportProblem')
            )}
            {renderSettingRow('⭐', 'Rate the App', undefined,
              () => {
                const storeUrl = Platform.OS === 'ios'
                  ? 'https://apps.apple.com/app/rightathome-bnb/id000000000'
                  : 'https://play.google.com/store/apps/details?id=com.rightathome.bnb';
                openURL(storeUrl);
              }
            )}
          </View>
        </View>

        {/* Legal Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Legal</Text>
          <View style={styles.sectionContent}>
            {renderSettingRow('📋', 'Terms of Service', undefined,
              () => openURL('https://rightathome.bnb/terms')
            )}
            {renderSettingRow('🔒', 'Privacy Policy', undefined,
              () => openURL('https://rightathome.bnb/privacy')
            )}
            {renderSettingRow('📜', 'Licenses', undefined,
              () => navigation.navigate('Licenses')
            )}
          </View>
        </View>

        {/* App Info */}
        <View style={styles.appInfo}>
          <Text style={styles.appName}>Right at Home BnB</Text>
          <Text style={styles.appVersion}>
            Version {Application.nativeApplicationVersion || '1.0.0'}
            ({Application.nativeBuildVersion || '1'})
          </Text>
          <Text style={styles.copyright}>© 2024 Right at Home BnB. All rights reserved.</Text>
        </View>

        {/* Logout Button */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutIcon}>🚪</Text>
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>

        {/* Delete Account */}
        <TouchableOpacity style={styles.deleteButton} onPress={handleDeleteAccount}>
          <Text style={styles.deleteText}>Delete Account</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
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
    justifyContent: 'space-between',
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
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.white,
  },

  // Scroll
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },

  // Profile Section
  profileSection: {
    alignItems: 'center',
    paddingVertical: 24,
    backgroundColor: COLORS.white,
    marginBottom: 16,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 12,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: COLORS.maroon,
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: COLORS.maroon,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: COLORS.gold,
  },
  avatarInitial: {
    fontSize: 40,
    fontWeight: 'bold',
    color: COLORS.white,
  },
  editAvatarButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.gold,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: COLORS.white,
  },
  editAvatarIcon: {
    fontSize: 14,
  },
  profileName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.charcoal,
    marginBottom: 4,
  },
  profileEmail: {
    fontSize: 14,
    color: COLORS.gray,
    marginBottom: 8,
  },
  roleBadge: {
    backgroundColor: `${COLORS.maroon}15`,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
  },
  roleText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.maroon,
  },

  // Sections
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.gray,
    marginLeft: 16,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionContent: {
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: COLORS.grayLighter,
  },

  // Setting Row
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.grayLighter,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingIcon: {
    fontSize: 20,
    marginRight: 14,
    width: 28,
    textAlign: 'center',
  },
  settingLabel: {
    fontSize: 15,
    color: COLORS.charcoal,
  },
  settingValue: {
    fontSize: 14,
    color: COLORS.gray,
    marginRight: 8,
  },
  chevron: {
    fontSize: 20,
    color: COLORS.grayLight,
  },

  // App Info
  appInfo: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  appName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.charcoal,
    marginBottom: 4,
  },
  appVersion: {
    fontSize: 13,
    color: COLORS.gray,
    marginBottom: 4,
  },
  copyright: {
    fontSize: 11,
    color: COLORS.grayLight,
  },

  // Logout
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.white,
    marginHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.grayLighter,
    gap: 8,
  },
  logoutIcon: {
    fontSize: 18,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.charcoal,
  },

  // Delete Account
  deleteButton: {
    alignItems: 'center',
    marginTop: 16,
    paddingVertical: 12,
  },
  deleteText: {
    fontSize: 14,
    color: COLORS.error,
    fontWeight: '500',
  },
});
