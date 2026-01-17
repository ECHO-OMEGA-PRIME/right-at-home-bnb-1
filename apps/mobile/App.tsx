/**
 * Right at Home BnB - Main App Entry
 * Complete navigation with all screens
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

// Core Screens
import HomeScreen from './src/screens/HomeScreen';
import JobsScreen from './src/screens/JobsScreen';
import JobDetailScreen from './src/screens/JobDetailScreen';
import ConciergeScreen from './src/screens/ConciergeScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import PropertyScreen from './src/screens/PropertyScreen';

// New Screens
import LoginScreen from './src/screens/LoginScreen';
import GPSCheckInScreen from './src/screens/GPSCheckInScreen';
import PhotoCaptureScreen from './src/screens/PhotoCaptureScreen';
import ChecklistScreen from './src/screens/ChecklistScreen';
import IssueReportScreen from './src/screens/IssueReportScreen';
import LeaderboardScreen from './src/screens/LeaderboardScreen';
import MessagesScreen from './src/screens/MessagesScreen';
import NotificationsScreen from './src/screens/NotificationsScreen';
import SettingsScreen from './src/screens/SettingsScreen';

// Theme
import { ThemeProvider } from './src/theme/ThemeContext';
import { COLORS } from './src/theme/colors';

// Cross-Platform Sync
import { SyncProvider } from './src/context/SyncContext';

// Types
export type RootStackParamList = {
  Login: undefined;
  Main: undefined;
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

// Jobs Stack Navigator
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

// Main Tab Navigator
function MainTabs() {
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

// Auth State Check
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

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      // Check for stored auth token
      const token = await AsyncStorage.getItem('@rightathome_auth_token');
      setIsAuthenticated(!!token);
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

      <Stack.Screen name="Main" component={MainTabs} />

      {/* Job Flow Screens */}
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
        options={{
          headerShown: false,
        }}
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
      <Stack.Screen
        name="Leaderboard"
        component={LeaderboardScreen}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="Messages"
        component={MessagesScreen}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{
          headerShown: false,
        }}
      />

      {/* Settings */}
      <Stack.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          headerShown: false,
        }}
      />
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
