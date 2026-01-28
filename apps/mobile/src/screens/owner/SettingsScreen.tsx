/**
 * Settings Screen (Owner)
 * App settings, account management, and preferences
 * @author ECHO OMEGA PRIME
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Switch,
  Image,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { COLORS } from '../../theme/colors';

interface SettingItem {
  id: string;
  icon: string;
  label: string;
  subtitle?: string;
  type: 'navigation' | 'toggle' | 'action' | 'info';
  value?: boolean;
  onPress?: () => void;
  danger?: boolean;
}

interface SettingSection {
  title: string;
  items: SettingItem[];
}

export default function SettingsScreen() {
  const navigation = useNavigation<any>();

  // Toggle states
  const [pushEnabled, setPushEnabled] = useState(true);
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [smsEnabled, setSmsEnabled] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(true);
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);

  const handleLogout = useCallback(() => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: () => {
            // Handle logout
            navigation.reset({
              index: 0,
              routes: [{ name: 'Auth' }],
            });
          },
        },
      ]
    );
  }, [navigation]);

  const handleDeleteAccount = useCallback(() => {
    Alert.alert(
      'Delete Account',
      'This action cannot be undone. All your data will be permanently deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Confirm Deletion',
              'Please type DELETE to confirm account deletion.',
              [{ text: 'OK' }]
            );
          },
        },
      ]
    );
  }, []);

  const sections: SettingSection[] = [
    {
      title: 'Account',
      items: [
        {
          id: 'profile',
          icon: '👤',
          label: 'Profile',
          subtitle: 'Edit your personal information',
          type: 'navigation',
          onPress: () => navigation.navigate('EditProfile'),
        },
        {
          id: 'business',
          icon: '🏢',
          label: 'Business Info',
          subtitle: 'Company details, tax info',
          type: 'navigation',
          onPress: () => navigation.navigate('BusinessInfo'),
        },
        {
          id: 'payment',
          icon: '💳',
          label: 'Payment Methods',
          subtitle: 'Manage payout accounts',
          type: 'navigation',
          onPress: () => navigation.navigate('PaymentMethods'),
        },
        {
          id: 'subscription',
          icon: '⭐',
          label: 'Subscription',
          subtitle: 'Pro Plan - Active',
          type: 'navigation',
          onPress: () => navigation.navigate('Subscription'),
        },
      ],
    },
    {
      title: 'Notifications',
      items: [
        {
          id: 'push',
          icon: '🔔',
          label: 'Push Notifications',
          subtitle: 'Booking alerts, messages',
          type: 'toggle',
          value: pushEnabled,
          onPress: () => setPushEnabled(!pushEnabled),
        },
        {
          id: 'email',
          icon: '📧',
          label: 'Email Notifications',
          subtitle: 'Daily summaries, reports',
          type: 'toggle',
          value: emailEnabled,
          onPress: () => setEmailEnabled(!emailEnabled),
        },
        {
          id: 'sms',
          icon: '💬',
          label: 'SMS Alerts',
          subtitle: 'Urgent notifications only',
          type: 'toggle',
          value: smsEnabled,
          onPress: () => setSmsEnabled(!smsEnabled),
        },
        {
          id: 'sounds',
          icon: '🔊',
          label: 'Notification Sounds',
          type: 'toggle',
          value: soundEnabled,
          onPress: () => setSoundEnabled(!soundEnabled),
        },
      ],
    },
    {
      title: 'App Preferences',
      items: [
        {
          id: 'darkMode',
          icon: '🌙',
          label: 'Dark Mode',
          type: 'toggle',
          value: darkMode,
          onPress: () => setDarkMode(!darkMode),
        },
        {
          id: 'biometric',
          icon: '🔐',
          label: 'Face ID / Touch ID',
          subtitle: 'Quick and secure login',
          type: 'toggle',
          value: biometricEnabled,
          onPress: () => setBiometricEnabled(!biometricEnabled),
        },
        {
          id: 'autoSync',
          icon: '🔄',
          label: 'Auto-sync',
          subtitle: 'Keep data updated in background',
          type: 'toggle',
          value: autoSyncEnabled,
          onPress: () => setAutoSyncEnabled(!autoSyncEnabled),
        },
        {
          id: 'language',
          icon: '🌐',
          label: 'Language',
          subtitle: 'English',
          type: 'navigation',
          onPress: () => navigation.navigate('Language'),
        },
        {
          id: 'currency',
          icon: '💵',
          label: 'Currency',
          subtitle: 'USD ($)',
          type: 'navigation',
          onPress: () => navigation.navigate('Currency'),
        },
      ],
    },
    {
      title: 'Property Management',
      items: [
        {
          id: 'channels',
          icon: '📱',
          label: 'Connected Channels',
          subtitle: 'Airbnb, VRBO, Booking.com',
          type: 'navigation',
          onPress: () => navigation.navigate('ConnectedChannels'),
        },
        {
          id: 'team',
          icon: '👥',
          label: 'Team Members',
          subtitle: 'Manage cleaners, co-hosts',
          type: 'navigation',
          onPress: () => navigation.navigate('TeamMembers'),
        },
        {
          id: 'templates',
          icon: '📝',
          label: 'Message Templates',
          subtitle: 'Auto-replies, check-in instructions',
          type: 'navigation',
          onPress: () => navigation.navigate('MessageTemplates'),
        },
        {
          id: 'pricing',
          icon: '📊',
          label: 'Pricing Rules',
          subtitle: 'Dynamic pricing, discounts',
          type: 'navigation',
          onPress: () => navigation.navigate('PricingRules'),
        },
      ],
    },
    {
      title: 'Integrations',
      items: [
        {
          id: 'smartHome',
          icon: '🏠',
          label: 'Smart Home',
          subtitle: 'Locks, thermostats, cameras',
          type: 'navigation',
          onPress: () => navigation.navigate('SmartHomeIntegrations'),
        },
        {
          id: 'calendar',
          icon: '📅',
          label: 'Calendar Sync',
          subtitle: 'Google, iCloud, Outlook',
          type: 'navigation',
          onPress: () => navigation.navigate('CalendarSync'),
        },
        {
          id: 'accounting',
          icon: '📒',
          label: 'Accounting',
          subtitle: 'QuickBooks, Xero',
          type: 'navigation',
          onPress: () => navigation.navigate('AccountingIntegrations'),
        },
      ],
    },
    {
      title: 'Support',
      items: [
        {
          id: 'help',
          icon: '❓',
          label: 'Help Center',
          type: 'navigation',
          onPress: () => navigation.navigate('HelpCenter'),
        },
        {
          id: 'contact',
          icon: '💬',
          label: 'Contact Support',
          type: 'navigation',
          onPress: () => navigation.navigate('ContactSupport'),
        },
        {
          id: 'feedback',
          icon: '💡',
          label: 'Send Feedback',
          type: 'navigation',
          onPress: () => navigation.navigate('SendFeedback'),
        },
        {
          id: 'rate',
          icon: '⭐',
          label: 'Rate the App',
          type: 'action',
          onPress: () => {
            // Open app store
          },
        },
      ],
    },
    {
      title: 'Legal',
      items: [
        {
          id: 'privacy',
          icon: '🔒',
          label: 'Privacy Policy',
          type: 'navigation',
          onPress: () => navigation.navigate('PrivacyPolicy'),
        },
        {
          id: 'terms',
          icon: '📄',
          label: 'Terms of Service',
          type: 'navigation',
          onPress: () => navigation.navigate('TermsOfService'),
        },
        {
          id: 'licenses',
          icon: '📜',
          label: 'Open Source Licenses',
          type: 'navigation',
          onPress: () => navigation.navigate('Licenses'),
        },
      ],
    },
    {
      title: 'Account Actions',
      items: [
        {
          id: 'logout',
          icon: '🚪',
          label: 'Sign Out',
          type: 'action',
          onPress: handleLogout,
        },
        {
          id: 'delete',
          icon: '🗑️',
          label: 'Delete Account',
          type: 'action',
          danger: true,
          onPress: handleDeleteAccount,
        },
      ],
    },
  ];

  const renderSettingItem = (item: SettingItem) => (
    <TouchableOpacity
      key={item.id}
      style={styles.settingItem}
      onPress={item.type === 'toggle' ? undefined : item.onPress}
      activeOpacity={item.type === 'toggle' ? 1 : 0.7}
    >
      <View style={styles.settingLeft}>
        <View style={[styles.iconContainer, item.danger && styles.iconContainerDanger]}>
          <Text style={styles.icon}>{item.icon}</Text>
        </View>
        <View style={styles.settingText}>
          <Text style={[styles.settingLabel, item.danger && styles.settingLabelDanger]}>
            {item.label}
          </Text>
          {item.subtitle && (
            <Text style={styles.settingSubtitle}>{item.subtitle}</Text>
          )}
        </View>
      </View>

      <View style={styles.settingRight}>
        {item.type === 'toggle' && (
          <Switch
            value={item.value}
            onValueChange={item.onPress}
            trackColor={{ false: COLORS.grayLighter, true: COLORS.maroon + '60' }}
            thumbColor={item.value ? COLORS.maroon : COLORS.white}
          />
        )}
        {item.type === 'navigation' && (
          <Text style={styles.chevron}>›</Text>
        )}
      </View>
    </TouchableOpacity>
  );

  const renderSection = (section: SettingSection, index: number) => (
    <View key={section.title} style={styles.section}>
      <Text style={styles.sectionTitle}>{section.title}</Text>
      <View style={styles.sectionContent}>
        {section.items.map(renderSettingItem)}
      </View>
    </View>
  );

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Profile Card */}
      <View style={styles.profileCard}>
        <Image
          source={{ uri: 'https://i.pravatar.cc/200?img=3' }}
          style={styles.profileImage}
        />
        <View style={styles.profileInfo}>
          <Text style={styles.profileName}>Bobby McWilliams</Text>
          <Text style={styles.profileEmail}>bobmcwilliams4@outlook.com</Text>
          <View style={styles.proBadge}>
            <Text style={styles.proBadgeText}>PRO</Text>
          </View>
        </View>
        <TouchableOpacity
          style={styles.editButton}
          onPress={() => navigation.navigate('EditProfile')}
        >
          <Text style={styles.editIcon}>✏️</Text>
        </TouchableOpacity>
      </View>

      {/* Quick Stats */}
      <View style={styles.quickStats}>
        <View style={styles.quickStatItem}>
          <Text style={styles.quickStatValue}>6</Text>
          <Text style={styles.quickStatLabel}>Properties</Text>
        </View>
        <View style={styles.quickStatDivider} />
        <View style={styles.quickStatItem}>
          <Text style={styles.quickStatValue}>4.9</Text>
          <Text style={styles.quickStatLabel}>Avg Rating</Text>
        </View>
        <View style={styles.quickStatDivider} />
        <View style={styles.quickStatItem}>
          <Text style={styles.quickStatValue}>2y</Text>
          <Text style={styles.quickStatLabel}>Member</Text>
        </View>
      </View>

      {/* Settings Sections */}
      {sections.map(renderSection)}

      {/* App Version */}
      <View style={styles.versionContainer}>
        <Text style={styles.versionText}>Right at Home BnB v1.0.0</Text>
        <Text style={styles.versionSubtext}>Built with ECHO OMEGA PRIME</Text>
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  // Profile Card
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    margin: 16,
    padding: 16,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  profileImage: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 3,
    borderColor: COLORS.maroon,
  },
  profileInfo: {
    flex: 1,
    marginLeft: 14,
  },
  profileName: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.charcoal,
  },
  profileEmail: {
    fontSize: 13,
    color: COLORS.gray,
    marginTop: 2,
  },
  proBadge: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.gold,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 6,
  },
  proBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.charcoal,
  },
  editButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.grayLighter,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editIcon: {
    fontSize: 16,
  },

  // Quick Stats
  quickStats: {
    flexDirection: 'row',
    backgroundColor: COLORS.maroon,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    padding: 16,
  },
  quickStatItem: {
    flex: 1,
    alignItems: 'center',
  },
  quickStatValue: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.white,
  },
  quickStatLabel: {
    fontSize: 12,
    color: COLORS.white + '80',
    marginTop: 2,
  },
  quickStatDivider: {
    width: 1,
    backgroundColor: COLORS.white + '30',
  },

  // Sections
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.gray,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  sectionContent: {
    backgroundColor: COLORS.white,
    marginHorizontal: 16,
    borderRadius: 12,
    overflow: 'hidden',
  },

  // Setting Item
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.grayLighter,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: COLORS.grayLighter,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainerDanger: {
    backgroundColor: '#FEE2E2',
  },
  icon: {
    fontSize: 18,
  },
  settingText: {
    marginLeft: 12,
    flex: 1,
  },
  settingLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: COLORS.charcoal,
  },
  settingLabelDanger: {
    color: '#EF4444',
  },
  settingSubtitle: {
    fontSize: 12,
    color: COLORS.gray,
    marginTop: 2,
  },
  settingRight: {
    marginLeft: 8,
  },
  chevron: {
    fontSize: 22,
    color: COLORS.grayLight,
    fontWeight: '300',
  },

  // Version
  versionContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  versionText: {
    fontSize: 13,
    color: COLORS.gray,
  },
  versionSubtext: {
    fontSize: 11,
    color: COLORS.grayLight,
    marginTop: 2,
  },
});
