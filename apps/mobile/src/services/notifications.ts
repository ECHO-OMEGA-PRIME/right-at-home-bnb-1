/**
 * Right at Home BnB - Push Notifications Service
 * Real-time job alerts and updates for cleaners
 * @author ECHO OMEGA PRIME
 */

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform, Alert } from 'react-native';
import Constants from 'expo-constants';

export interface NotificationData {
  type: 'NEW_JOB' | 'JOB_REMINDER' | 'JOB_CANCELLED' | 'BONUS_EARNED' | 'MESSAGE' | 'URGENT';
  jobId?: string;
  propertyId?: string;
  title: string;
  body: string;
  data?: Record<string, any>;
}

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

let expoPushToken: string | null = null;
let notificationListener: Notifications.Subscription | null = null;
let responseListener: Notifications.Subscription | null = null;

/**
 * Register for push notifications and get token
 */
export async function registerForPushNotifications(): Promise<string | null> {
  let token: string | null = null;

  // Check if physical device (emulators can't receive push)
  if (!Device.isDevice) {
    console.log('Push notifications require a physical device');
    return null;
  }

  // Check and request permissions
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    Alert.alert(
      'Notifications Required',
      'Enable push notifications to receive job alerts and updates.',
      [{ text: 'OK' }]
    );
    return null;
  }

  // Get Expo push token
  try {
    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;

    if (!projectId) {
      console.warn('Project ID not found for push notifications');
    }

    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId,
    });
    token = tokenData.data;
    expoPushToken = token;

    console.log('Push token:', token);
  } catch (error) {
    console.error('Error getting push token:', error);
  }

  // Configure Android notification channel
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#500000', // Aggie Maroon
    });

    // High priority channel for urgent jobs
    await Notifications.setNotificationChannelAsync('urgent', {
      name: 'Urgent Jobs',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 500, 200, 500],
      lightColor: '#FF0000',
      sound: 'urgent.wav',
    });

    // Job reminders channel
    await Notifications.setNotificationChannelAsync('reminders', {
      name: 'Job Reminders',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#C4A777', // Gold
    });
  }

  return token;
}

/**
 * Get current push token
 */
export function getPushToken(): string | null {
  return expoPushToken;
}

/**
 * Send push token to server for registration
 */
export async function registerTokenWithServer(
  token: string,
  userId: string
): Promise<boolean> {
  try {
    const response = await fetch('https://api.rightathome.bnb/notifications/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Add auth header
      },
      body: JSON.stringify({
        token,
        userId,
        platform: Platform.OS,
        deviceName: Device.deviceName,
      }),
    });

    return response.ok;
  } catch (error) {
    console.error('Error registering push token:', error);
    return false;
  }
}

/**
 * Set up notification listeners
 */
export function setupNotificationListeners(
  onNotificationReceived?: (notification: Notifications.Notification) => void,
  onNotificationResponse?: (response: Notifications.NotificationResponse) => void
) {
  // Clear existing listeners
  removeNotificationListeners();

  // Listener for when notification is received while app is foregrounded
  notificationListener = Notifications.addNotificationReceivedListener((notification) => {
    console.log('Notification received:', notification);
    onNotificationReceived?.(notification);
  });

  // Listener for when user taps on notification
  responseListener = Notifications.addNotificationResponseReceivedListener((response) => {
    console.log('Notification response:', response);
    onNotificationResponse?.(response);

    // Handle navigation based on notification type
    const data = response.notification.request.content.data as NotificationData;
    handleNotificationNavigation(data);
  });
}

/**
 * Remove notification listeners (cleanup)
 */
export function removeNotificationListeners() {
  if (notificationListener) {
    Notifications.removeNotificationSubscription(notificationListener);
    notificationListener = null;
  }
  if (responseListener) {
    Notifications.removeNotificationSubscription(responseListener);
    responseListener = null;
  }
}

/**
 * Handle navigation when notification is tapped
 */
function handleNotificationNavigation(data: NotificationData) {
  // Navigation would be handled by the app's navigation system
  // This is a placeholder for the navigation logic
  switch (data.type) {
    case 'NEW_JOB':
    case 'JOB_REMINDER':
      // Navigate to job detail
      console.log('Navigate to job:', data.jobId);
      break;
    case 'URGENT':
      // Navigate to urgent jobs list
      console.log('Navigate to urgent jobs');
      break;
    case 'MESSAGE':
      // Navigate to messages
      console.log('Navigate to messages');
      break;
    case 'BONUS_EARNED':
      // Navigate to earnings
      console.log('Navigate to earnings');
      break;
    default:
      // Navigate to home
      console.log('Navigate to home');
  }
}

/**
 * Schedule a local notification (for reminders)
 */
export async function scheduleLocalNotification(
  data: NotificationData,
  triggerDate: Date
): Promise<string | null> {
  try {
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: data.title,
        body: data.body,
        data: data as any,
        sound: data.type === 'URGENT' ? 'urgent.wav' : 'default',
      },
      trigger: {
        date: triggerDate,
      },
    });

    return notificationId;
  } catch (error) {
    console.error('Error scheduling notification:', error);
    return null;
  }
}

/**
 * Schedule job reminder (30 minutes before)
 */
export async function scheduleJobReminder(
  jobId: string,
  propertyName: string,
  scheduledTime: Date
): Promise<string | null> {
  const reminderTime = new Date(scheduledTime.getTime() - 30 * 60 * 1000); // 30 min before

  // Don't schedule if reminder time has passed
  if (reminderTime <= new Date()) {
    return null;
  }

  return scheduleLocalNotification(
    {
      type: 'JOB_REMINDER',
      jobId,
      title: 'Job Starting Soon',
      body: `${propertyName} cleaning starts in 30 minutes`,
    },
    reminderTime
  );
}

/**
 * Cancel a scheduled notification
 */
export async function cancelNotification(notificationId: string): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(notificationId);
}

/**
 * Cancel all scheduled notifications
 */
export async function cancelAllNotifications(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

/**
 * Get all scheduled notifications
 */
export async function getScheduledNotifications(): Promise<Notifications.NotificationRequest[]> {
  return await Notifications.getAllScheduledNotificationsAsync();
}

/**
 * Set badge count (iOS)
 */
export async function setBadgeCount(count: number): Promise<void> {
  await Notifications.setBadgeCountAsync(count);
}

/**
 * Clear badge count
 */
export async function clearBadge(): Promise<void> {
  await Notifications.setBadgeCountAsync(0);
}

/**
 * Send a test notification (for debugging)
 */
export async function sendTestNotification(): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Test Notification',
      body: 'Right at Home BnB notifications are working!',
      data: { type: 'TEST' },
    },
    trigger: null, // Immediate
  });
}

// Notification templates for different scenarios
export const NOTIFICATION_TEMPLATES = {
  newJob: (propertyName: string, time: string) => ({
    type: 'NEW_JOB' as const,
    title: 'New Job Available!',
    body: `${propertyName} - ${time}`,
  }),

  urgentJob: (propertyName: string, time: string) => ({
    type: 'URGENT' as const,
    title: '🚨 URGENT JOB',
    body: `Last-minute cleaning needed: ${propertyName} - ${time}. 1.5x pay!`,
  }),

  jobCancelled: (propertyName: string) => ({
    type: 'JOB_CANCELLED' as const,
    title: 'Job Cancelled',
    body: `${propertyName} cleaning has been cancelled.`,
  }),

  bonusEarned: (amount: number, reason: string) => ({
    type: 'BONUS_EARNED' as const,
    title: 'Bonus Earned! 🎉',
    body: `You earned a $${amount.toFixed(2)} bonus for ${reason}!`,
  }),

  message: (from: string, preview: string) => ({
    type: 'MESSAGE' as const,
    title: `Message from ${from}`,
    body: preview.substring(0, 100) + (preview.length > 100 ? '...' : ''),
  }),
};
