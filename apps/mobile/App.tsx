/**
 * Right at Home BnB - Main App Entry
 * Complete navigation with cleaner and owner modes
 * @author ECHO OMEGA PRIME
 */

import React, { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { View, Text, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Cleaner Screens
import HomeScreen from './src/screens/HomeScreen';
import JobsScreen from './src/screens/JobsScreen';
import JobDetailScreen from './src/screens/JobDetailScreen';
import ConciergeScreen from './src/screens/ConciergeScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import PropertyScreen from './src/screens/PropertyScreen';
import LoginScreen from './src/screens/LoginScreen';
import GPSCheckInScreen from './src/screens/GPSCheckInScreen';
import PhotoCaptureScreen from './src/screens/PhotoCaptureScreen';
import ChecklistScreen from './src/screens/ChecklistScreen';
import IssueReportScreen from './src/screens/IssueReportScreen';
import LeaderboardScreen from './src/screens/LeaderboardScreen';
import MessagesScreen from './src/screens/MessagesScreen';
import NotificationsScreen from './src/screens/NotificationsScreen';
import SettingsScreen from './src/screens/SettingsScreen';

// Owner Navigator
import { OwnerNavigator } from './src/navigation';

// Theme
import { ThemeProvider } from './src/theme/ThemeContext';
import { COLORS } from './src/theme/colors';

// Cross-Platform Sync
import { SyncProvider } from './src/context/SyncContext';

// Types
export type UserRole = 'cleaner' | 'owner' | 'admin';

export type RootStackParamList = {
  Login: undefined;
  RoleSelect: undefined;
  CleanerMain: undefined;
  OwnerMain: undefined;
  JobDetail: { jobId: string };
  Property: { propertyId: string };
  GPSCheckIn: { jobId: string; propertyId: string; propertyName: string; lat: number; lng: number };
  PhotoCapture: { jobId: string; propertyId: string; taskType: string };
  Checklist: { jobId: string; propertyId: string; propertyName: string };
  IssueReport: { jobId?: string; propertyId: string; propertyName: string };
  Leaderboard: undefined;
  Messages: { conversationId?: string };
  Notifications: undefined;
  Settings: undefined;
};

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator<RootStackParamList>();
const JobStack = createNativeStackNavigator();
const queryClient = new QueryClient();

// Tab Icon Component
const TabIcon = ({ name, focused }: { name: string; focused: boolean }) => (
  <Text style={{ fontSize: 24, color: focused ? COLORS.maroon : '#999' }}>
    {name === 'Home' && '🏠'}
    {name === 'Jobs' && '🧹'}
    {name === 'Concierge' && '💬'}
    {name === 'Profile' && '👤'}
  </Text>
);

// Jobs Stack Navigator (Cleaner)
function JobsStackNavigator() {
  return (
    <JobStack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: COLORS.maroon },
        headerTintColor: COLORS.white,
        headerTitleStyle: { fontWeight: 'bold' },
      }}
    >
      <JobStack.Screen name="JobsList" component={JobsScreen} options={{ title: 'My Jobs' }} />
      <JobStack.Screen name="JobDetailInner" component={JobDetailScreen} options={{ title: 'Job Details' }} />
    </JobStack.Navigator>
  );
}

// Cleaner Tab Navigator
function CleanerTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused }) => <TabIcon name={route.name} focused={focused} />,
        tabBarActiveTintColor: COLORS.maroon,
        tabBarInactiveTintColor: '#999',
        tabBarStyle: {
          backgroundColor: COLORS.white,
          borderTopColor: '#E5E5E5',
          borderTopWidth: 1,
          paddingBottom: 8,
          paddingTop: 8,
          height: 60,
        },
        headerStyle: { backgroundColor: COLORS.maroon },
        headerTintColor: COLORS.white,
        headerTitleStyle: { fontWeight: 'bold' },
      })}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{ title: 'Right at Home' }}
      />
      <Tab.Screen
        name="Jobs"
        component={JobsStackNavigator}
        options={{ headerShown: false }}
      />
      <Tab.Screen
        name="Concierge"
        component={ConciergeScreen}
        options={{ title: 'AI Concierge' }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ title: 'My Profile' }}
      />
    </Tab.Navigator>
  );
}

// Role Selection Screen
function RoleSelectScreen({ navigation }: any) {
  const handleSelectRole = async (role: UserRole) => {
    await AsyncStorage.setItem('@rightathome_user_role', role);
    navigation.reset({
      index: 0,
      routes: [{ name: role === 'owner' || role === 'admin' ? 'OwnerMain' : 'CleanerMain' }],
    });
  };

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.background, padding: 20, justifyContent: 'center' }}>
      <Text style={{ fontSize: 28, fontWeight: '700', color: COLORS.charcoal, textAlign: 'center', marginBottom: 8 }}>
        Welcome!
      </Text>
      <Text style={{ fontSize: 16, color: COLORS.gray, textAlign: 'center', marginBottom: 40 }}>
        Select your account type
      </Text>

      {/* Owner Card */}
      <View
        style={{
          backgroundColor: COLORS.white,
          borderRadius: 16,
          padding: 20,
          marginBottom: 16,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 8,
          elevation: 3,
        }}
        onTouchEnd={() => handleSelectRole('owner')}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
          <Text style={{ fontSize: 36, marginRight: 12 }}>🏠</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 20, fontWeight: '700', color: COLORS.charcoal }}>Property Owner</Text>
            <Text style={{ fontSize: 14, color: COLORS.gray }}>Manage your rentals</Text>
          </View>
        </View>
        <Text style={{ fontSize: 13, color: COLORS.gray, lineHeight: 20 }}>
          View bookings, manage properties, coordinate cleaning, and track revenue.
        </Text>
      </View>

      {/* Cleaner Card */}
      <View
        style={{
          backgroundColor: COLORS.white,
          borderRadius: 16,
          padding: 20,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 8,
          elevation: 3,
        }}
        onTouchEnd={() => handleSelectRole('cleaner')}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
          <Text style={{ fontSize: 36, marginRight: 12 }}>🧹</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 20, fontWeight: '700', color: COLORS.charcoal }}>Cleaning Professional</Text>
            <Text style={{ fontSize: 14, color: COLORS.gray }}>Complete jobs & earn</Text>
          </View>
        </View>
        <Text style={{ fontSize: 13, color: COLORS.gray, lineHeight: 20 }}>
          View assigned jobs, check in with GPS, submit photos, and complete checklists.
        </Text>
      </View>
    </View>
  );
}

// Auth Loading Screen
function AuthLoadingScreen() {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.maroon }}>
      <Text style={{ fontSize: 32, marginBottom: 20, color: COLORS.white }}>🏠</Text>
      <Text style={{ fontSize: 20, fontWeight: 'bold', color: COLORS.white, marginBottom: 10 }}>
        Right at Home BnB
      </Text>
      <ActivityIndicator size="large" color={COLORS.gold} />
    </View>
  );
}

// Root Navigator with Auth Flow
function RootNavigator() {
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userRole, setUserRole] = useState<UserRole | null>(null);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const token = await AsyncStorage.getItem('@rightathome_auth_token');
      const role = await AsyncStorage.getItem('@rightathome_user_role') as UserRole | null;
      setIsAuthenticated(!!token);
      setUserRole(role);
    } catch (error) {
      console.error('Auth check failed:', error);
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return <AuthLoadingScreen />;
  }

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    >
      {!isAuthenticated ? (
        <Stack.Screen name="Login" component={LoginScreen} />
      ) : null}

      {/* Role Selection (shown after login if no role selected) */}
      <Stack.Screen name="RoleSelect" component={RoleSelectScreen} />

      {/* Cleaner Flow */}
      <Stack.Screen name="CleanerMain" component={CleanerTabs} />

      {/* Owner Flow */}
      <Stack.Screen name="OwnerMain" component={OwnerNavigator} />

      {/* Shared Screens - Job Flow */}
      <Stack.Screen
        name="JobDetail"
        component={JobDetailScreen}
        options={{
          headerShown: true,
          headerStyle: { backgroundColor: COLORS.maroon },
          headerTintColor: COLORS.white,
          headerTitle: 'Job Details',
        }}
      />
      <Stack.Screen
        name="GPSCheckIn"
        component={GPSCheckInScreen}
        options={{
          headerShown: false,
          presentation: 'fullScreenModal',
        }}
      />
      <Stack.Screen
        name="PhotoCapture"
        component={PhotoCaptureScreen}
        options={{
          headerShown: false,
          presentation: 'fullScreenModal',
        }}
      />
      <Stack.Screen
        name="Checklist"
        component={ChecklistScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="IssueReport"
        component={IssueReportScreen}
        options={{
          headerShown: false,
          presentation: 'modal',
        }}
      />

      {/* Property Screen */}
      <Stack.Screen
        name="Property"
        component={PropertyScreen}
        options={{
          headerShown: true,
          headerStyle: { backgroundColor: COLORS.maroon },
          headerTintColor: COLORS.white,
          headerTitle: 'Property Details',
        }}
      />

      {/* Social & Communication Screens */}
      <Stack.Screen name="Leaderboard" component={LeaderboardScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Messages" component={MessagesScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Settings" component={SettingsScreen} options={{ headerShown: false }} />
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <SyncProvider>
        <ThemeProvider>
          <SafeAreaProvider>
            <NavigationContainer>
              <StatusBar style="light" />
              <RootNavigator />
            </NavigationContainer>
          </SafeAreaProvider>
        </ThemeProvider>
      </SyncProvider>
    </QueryClientProvider>
  );
}
