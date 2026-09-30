import { Platform } from 'react-native';

let messagingInstance: any = null;

function getMessaging() {
  if (Platform.OS === 'web') return null;
  if (!messagingInstance) {
    try {
      // Dynamic require to prevent crash when running in standard Expo Go without native build
      const messagingModule = require('@react-native-firebase/messaging');
      messagingInstance = messagingModule.default ?? messagingModule;
    } catch (err) {
      console.warn(
        '[FCM] Firebase messaging native module is not available in current environment (e.g. Expo Go). Push notifications require a native build (APK/development build).',
      );
      return null;
    }
  }
  return messagingInstance;
}

export async function requestNotificationPermission(): Promise<boolean> {
  const messaging = getMessaging();
  if (!messaging) return false;

  try {
    const authStatus = await messaging().requestPermission();
    const enabled =
      authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
      authStatus === messaging.AuthorizationStatus.PROVISIONAL;
    return enabled;
  } catch (error) {
    console.warn('[FCM] Permission request failed:', error);
    return false;
  }
}

export async function getDeviceFcmToken(): Promise<string | null> {
  const messaging = getMessaging();
  if (!messaging) return null;

  try {
    const hasPermission = await requestNotificationPermission();
    if (!hasPermission) {
      console.warn('[FCM] User did not grant push notification permission');
      return null;
    }
    const token = await messaging().getToken();
    return token;
  } catch (error) {
    console.warn('[FCM] Failed to retrieve device FCM token:', error);
    return null;
  }
}

interface SessionApi {
  post: (path: string, body?: unknown) => Promise<unknown>;
}

export async function registerFcmToken(session: SessionApi): Promise<boolean> {
  try {
    const token = await getDeviceFcmToken();
    if (!token) return false;

    await session.post('/notifications/fcm-token', {
      token,
      platform: Platform.OS,
    });
    console.log('[FCM] Successfully registered FCM token with backend');
    return true;
  } catch (error) {
    console.warn('[FCM] Failed to register FCM token with server:', error);
    return false;
  }
}

export async function unregisterFcmToken(session: SessionApi): Promise<boolean> {
  try {
    const messaging = getMessaging();
    if (!messaging) return false;

    const token = await messaging().getToken().catch(() => null);
    if (!token) return false;

    await session.post('/notifications/fcm-token/unregister', { token });
    return true;
  } catch (error) {
    console.warn('[FCM] Failed to unregister token:', error);
    return false;
  }
}

export function setupNotificationListeners(
  onForegroundMessage?: (remoteMessage: any) => void,
) {
  const messaging = getMessaging();
  if (!messaging) return () => {};

  try {
    const unsubscribeOnMessage = messaging().onMessage(async (remoteMessage: any) => {
      console.log('[FCM] Received foreground notification:', remoteMessage);
      if (onForegroundMessage) {
        onForegroundMessage(remoteMessage);
      }
    });

    const unsubscribeOnTokenRefresh = messaging().onTokenRefresh(async (newToken: string) => {
      console.log('[FCM] Token refreshed:', newToken);
    });

    return () => {
      unsubscribeOnMessage();
      unsubscribeOnTokenRefresh();
    };
  } catch (error) {
    console.warn('[FCM] Failed to register notification listeners:', error);
    return () => {};
  }
}
