/**
 * Right at Home BnB - Notifications Hook
 * Hook for managing push notifications in the app
 * @author ECHO OMEGA PRIME
 */

import { useEffect, useRef, useCallback } from 'react';
import { useNavigation } from '@react-navigation/native';
import * as Notifications from 'expo-notifications';
import {
  registerForPushNotifications,
  setupNotificationListeners,
  removeNotificationListeners,
  registerTokenWithServer,
  NotificationData,
  clearBadge,
} from '../services/notifications';

interface UseNotificationsOptions {
  userId?: string;
  onNotificationReceived?: (notification: Notifications.Notification) => void;
  onNotificationTapped?: (data: NotificationData) => void;
}

export function useNotifications(options: UseNotificationsOptions = {}) {
  const { userId, onNotificationReceived, onNotificationTapped } = options;
  const navigation = useNavigation<any>();
  const pushToken = useRef<string | null>(null);

  // Handle notification navigation
  const handleNotificationResponse = useCallback(
    (response: Notifications.NotificationResponse) => {
      const data = response.notification.request.content.data as NotificationData;

      // Call custom handler if provided
      onNotificationTapped?.(data);

      // Navigate based on notification type
      switch (data.type) {
        case 'NEW_JOB':
        case 'JOB_REMINDER':
          if (data.jobId) {
            navigation.navigate('JobDetail', { jobId: data.jobId });
          } else {
            navigation.navigate('Home');
          }
          break;

        case 'URGENT':
          navigation.navigate('Home', { filter: 'urgent' });
          break;

        case 'MESSAGE':
          navigation.navigate('Messages');
          break;

        case 'BONUS_EARNED':
        case 'JOB_CANCELLED':
          navigation.navigate('Earnings');
          break;

        default:
          navigation.navigate('Home');
      }

      // Clear badge after handling
      clearBadge();
    },
    [navigation, onNotificationTapped]
  );

  // Initialize notifications on mount
  useEffect(() => {
    let mounted = true;

    const initNotifications = async () => {
      // Register for push notifications
      const token = await registerForPushNotifications();

      if (token && mounted) {
        pushToken.current = token;

        // Register with server if user ID is available
        if (userId) {
          await registerTokenWithServer(token, userId);
        }
      }

      // Set up listeners
      if (mounted) {
        setupNotificationListeners(
          (notification) => {
            // Notification received while app is open
            console.log('Notification received:', notification.request.content);
            onNotificationReceived?.(notification);
          },
          handleNotificationResponse
        );
      }
    };

    initNotifications();

    // Check for notification that launched the app
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response && mounted) {
        handleNotificationResponse(response);
      }
    });

    return () => {
      mounted = false;
      removeNotificationListeners();
    };
  }, [userId, handleNotificationResponse, onNotificationReceived]);

  // Re-register token when user ID changes
  useEffect(() => {
    if (userId && pushToken.current) {
      registerTokenWithServer(pushToken.current, userId);
    }
  }, [userId]);

  return {
    pushToken: pushToken.current,
  };
}
