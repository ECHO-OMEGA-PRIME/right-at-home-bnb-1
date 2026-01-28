/**
 * Owner Navigator
 * Bottom tab navigator with nested stack navigators for property management
 * @author ECHO OMEGA PRIME
 */

import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { COLORS } from '../theme/colors';

// Import screens
import {
  OwnerHomeScreen,
  PropertiesScreen,
  PropertyDetailScreen,
  BookingsScreen,
  BookingDetailScreen,
  CalendarScreen,
  CleaningScreen,
  NotificationsScreen,
  SettingsScreen,
} from '../screens/owner';

// Types
export type HomeStackParamList = {
  Home: undefined;
  Notifications: undefined;
  PropertyDetail: { propertyId: string };
  BookingDetail: { bookingId: string };
};

export type PropertiesStackParamList = {
  PropertiesList: undefined;
  PropertyDetail: { propertyId: string };
  AddProperty: undefined;
  EditProperty: { propertyId: string };
};

export type BookingsStackParamList = {
  BookingsList: { propertyId?: string } | undefined;
  BookingDetail: { bookingId: string };
  Calendar: { propertyId?: string } | undefined;
};

export type MoreStackParamList = {
  MoreMenu: undefined;
  CleaningTasks: undefined;
  CleaningDetail: { taskId: string };
  AddCleaningTask: undefined;
  Settings: undefined;
  EditProfile: undefined;
  BusinessInfo: undefined;
  PaymentMethods: undefined;
  Subscription: undefined;
  ConnectedChannels: undefined;
  TeamMembers: undefined;
  MessageTemplates: undefined;
  PricingRules: undefined;
  SmartHomeIntegrations: undefined;
  CalendarSync: undefined;
  AccountingIntegrations: undefined;
  Language: undefined;
  Currency: undefined;
  HelpCenter: undefined;
  ContactSupport: undefined;
  SendFeedback: undefined;
  PrivacyPolicy: undefined;
  TermsOfService: undefined;
  Licenses: undefined;
};

export type OwnerTabParamList = {
  HomeTab: undefined;
  PropertiesTab: undefined;
  BookingsTab: undefined;
  MoreTab: undefined;
};

// Stack Navigators
const HomeStack = createNativeStackNavigator<HomeStackParamList>();
const PropertiesStack = createNativeStackNavigator<PropertiesStackParamList>();
const BookingsStack = createNativeStackNavigator<BookingsStackParamList>();
const MoreStack = createNativeStackNavigator<MoreStackParamList>();

// Tab Navigator
const Tab = createBottomTabNavigator<OwnerTabParamList>();

// Tab Icon Component
const TabIcon = ({ name, focused }: { name: string; focused: boolean }) => {
  const icons: Record<string, { active: string; inactive: string }> = {
    Home: { active: '🏠', inactive: '🏠' },
    Properties: { active: '🏘️', inactive: '🏘️' },
    Bookings: { active: '📅', inactive: '📅' },
    More: { active: '☰', inactive: '☰' },
  };

  const icon = icons[name] || { active: '●', inactive: '○' };

  return (
    <View style={styles.iconContainer}>
      <Text style={[styles.icon, focused && styles.iconActive]}>
        {focused ? icon.active : icon.inactive}
      </Text>
      {focused && <View style={styles.activeIndicator} />}
    </View>
  );
};

// Home Stack Navigator
function HomeStackNavigator() {
  return (
    <HomeStack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: COLORS.white,
        },
        headerTintColor: COLORS.maroon,
        headerTitleStyle: {
          fontWeight: '600',
        },
        headerShadowVisible: false,
      }}
    >
      <HomeStack.Screen
        name="Home"
        component={OwnerHomeScreen}
        options={{ headerShown: false }}
      />
      <HomeStack.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{ title: 'Notifications' }}
      />
      <HomeStack.Screen
        name="PropertyDetail"
        component={PropertyDetailScreen}
        options={{ title: 'Property Details' }}
      />
      <HomeStack.Screen
        name="BookingDetail"
        component={BookingDetailScreen}
        options={{ title: 'Booking Details' }}
      />
    </HomeStack.Navigator>
  );
}

// Properties Stack Navigator
function PropertiesStackNavigator() {
  return (
    <PropertiesStack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: COLORS.white,
        },
        headerTintColor: COLORS.maroon,
        headerTitleStyle: {
          fontWeight: '600',
        },
        headerShadowVisible: false,
      }}
    >
      <PropertiesStack.Screen
        name="PropertiesList"
        component={PropertiesScreen}
        options={{ title: 'Properties' }}
      />
      <PropertiesStack.Screen
        name="PropertyDetail"
        component={PropertyDetailScreen}
        options={{ title: 'Property Details' }}
      />
      <PropertiesStack.Screen
        name="AddProperty"
        component={PlaceholderScreen}
        options={{ title: 'Add Property' }}
      />
      <PropertiesStack.Screen
        name="EditProperty"
        component={PlaceholderScreen}
        options={{ title: 'Edit Property' }}
      />
    </PropertiesStack.Navigator>
  );
}

// Bookings Stack Navigator
function BookingsStackNavigator() {
  return (
    <BookingsStack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: COLORS.white,
        },
        headerTintColor: COLORS.maroon,
        headerTitleStyle: {
          fontWeight: '600',
        },
        headerShadowVisible: false,
      }}
    >
      <BookingsStack.Screen
        name="BookingsList"
        component={BookingsScreen}
        options={{ title: 'Bookings' }}
      />
      <BookingsStack.Screen
        name="BookingDetail"
        component={BookingDetailScreen}
        options={{ title: 'Booking Details' }}
      />
      <BookingsStack.Screen
        name="Calendar"
        component={CalendarScreen}
        options={{ title: 'Calendar' }}
      />
    </BookingsStack.Navigator>
  );
}

// More Menu Screen
function MoreMenuScreen() {
  const navigation = require('@react-navigation/native').useNavigation();

  const menuItems = [
    { icon: '🧹', label: 'Cleaning Tasks', screen: 'CleaningTasks' },
    { icon: '📅', label: 'Calendar', screen: 'Calendar', stack: 'BookingsTab' },
    { icon: '⚙️', label: 'Settings', screen: 'Settings' },
  ];

  return (
    <View style={moreStyles.container}>
      {menuItems.map((item, index) => (
        <React.Fragment key={item.label}>
          <View
            style={moreStyles.menuItem}
            onTouchEnd={() => navigation.navigate(item.screen)}
          >
            <Text style={moreStyles.menuIcon}>{item.icon}</Text>
            <Text style={moreStyles.menuLabel}>{item.label}</Text>
            <Text style={moreStyles.chevron}>›</Text>
          </View>
          {index < menuItems.length - 1 && <View style={moreStyles.divider} />}
        </React.Fragment>
      ))}
    </View>
  );
}

// More Stack Navigator
function MoreStackNavigator() {
  return (
    <MoreStack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: COLORS.white,
        },
        headerTintColor: COLORS.maroon,
        headerTitleStyle: {
          fontWeight: '600',
        },
        headerShadowVisible: false,
      }}
    >
      <MoreStack.Screen
        name="MoreMenu"
        component={MoreMenuScreen}
        options={{ title: 'More' }}
      />
      <MoreStack.Screen
        name="CleaningTasks"
        component={CleaningScreen}
        options={{ title: 'Cleaning Tasks' }}
      />
      <MoreStack.Screen
        name="CleaningDetail"
        component={PlaceholderScreen}
        options={{ title: 'Task Details' }}
      />
      <MoreStack.Screen
        name="AddCleaningTask"
        component={PlaceholderScreen}
        options={{ title: 'Add Task' }}
      />
      <MoreStack.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ title: 'Settings' }}
      />
      {/* Settings Sub-screens */}
      <MoreStack.Screen name="EditProfile" component={PlaceholderScreen} options={{ title: 'Edit Profile' }} />
      <MoreStack.Screen name="BusinessInfo" component={PlaceholderScreen} options={{ title: 'Business Info' }} />
      <MoreStack.Screen name="PaymentMethods" component={PlaceholderScreen} options={{ title: 'Payment Methods' }} />
      <MoreStack.Screen name="Subscription" component={PlaceholderScreen} options={{ title: 'Subscription' }} />
      <MoreStack.Screen name="ConnectedChannels" component={PlaceholderScreen} options={{ title: 'Connected Channels' }} />
      <MoreStack.Screen name="TeamMembers" component={PlaceholderScreen} options={{ title: 'Team Members' }} />
      <MoreStack.Screen name="MessageTemplates" component={PlaceholderScreen} options={{ title: 'Message Templates' }} />
      <MoreStack.Screen name="PricingRules" component={PlaceholderScreen} options={{ title: 'Pricing Rules' }} />
      <MoreStack.Screen name="SmartHomeIntegrations" component={PlaceholderScreen} options={{ title: 'Smart Home' }} />
      <MoreStack.Screen name="CalendarSync" component={PlaceholderScreen} options={{ title: 'Calendar Sync' }} />
      <MoreStack.Screen name="AccountingIntegrations" component={PlaceholderScreen} options={{ title: 'Accounting' }} />
      <MoreStack.Screen name="Language" component={PlaceholderScreen} options={{ title: 'Language' }} />
      <MoreStack.Screen name="Currency" component={PlaceholderScreen} options={{ title: 'Currency' }} />
      <MoreStack.Screen name="HelpCenter" component={PlaceholderScreen} options={{ title: 'Help Center' }} />
      <MoreStack.Screen name="ContactSupport" component={PlaceholderScreen} options={{ title: 'Contact Support' }} />
      <MoreStack.Screen name="SendFeedback" component={PlaceholderScreen} options={{ title: 'Send Feedback' }} />
      <MoreStack.Screen name="PrivacyPolicy" component={PlaceholderScreen} options={{ title: 'Privacy Policy' }} />
      <MoreStack.Screen name="TermsOfService" component={PlaceholderScreen} options={{ title: 'Terms of Service' }} />
      <MoreStack.Screen name="Licenses" component={PlaceholderScreen} options={{ title: 'Licenses' }} />
    </MoreStack.Navigator>
  );
}

// Placeholder for screens not yet implemented
function PlaceholderScreen({ route }: any) {
  return (
    <View style={placeholderStyles.container}>
      <Text style={placeholderStyles.icon}>🚧</Text>
      <Text style={placeholderStyles.title}>Coming Soon</Text>
      <Text style={placeholderStyles.subtitle}>
        This screen is under development
      </Text>
    </View>
  );
}

// Main Owner Tab Navigator
export default function OwnerNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: COLORS.maroon,
        tabBarInactiveTintColor: COLORS.gray,
        tabBarLabelStyle: styles.tabLabel,
      }}
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeStackNavigator}
        options={{
          tabBarLabel: 'Home',
          tabBarIcon: ({ focused }) => <TabIcon name="Home" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="PropertiesTab"
        component={PropertiesStackNavigator}
        options={{
          tabBarLabel: 'Properties',
          tabBarIcon: ({ focused }) => <TabIcon name="Properties" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="BookingsTab"
        component={BookingsStackNavigator}
        options={{
          tabBarLabel: 'Bookings',
          tabBarIcon: ({ focused }) => <TabIcon name="Bookings" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="MoreTab"
        component={MoreStackNavigator}
        options={{
          tabBarLabel: 'More',
          tabBarIcon: ({ focused }) => <TabIcon name="More" focused={focused} />,
        }}
      />
    </Tab.Navigator>
  );
}

// Styles
const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: COLORS.white,
    borderTopWidth: 0,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    height: Platform.OS === 'ios' ? 88 : 64,
    paddingBottom: Platform.OS === 'ios' ? 28 : 8,
    paddingTop: 8,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    fontSize: 22,
    opacity: 0.6,
  },
  iconActive: {
    opacity: 1,
  },
  activeIndicator: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.maroon,
    marginTop: 2,
  },
});

const moreStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    padding: 16,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  menuIcon: {
    fontSize: 24,
    marginRight: 16,
  },
  menuLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.charcoal,
  },
  chevron: {
    fontSize: 22,
    color: COLORS.grayLight,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.grayLighter,
    marginLeft: 56,
  },
});

const placeholderStyles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.background,
    padding: 40,
  },
  icon: {
    fontSize: 64,
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.charcoal,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.gray,
    textAlign: 'center',
  },
});
