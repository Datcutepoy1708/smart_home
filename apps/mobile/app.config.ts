import type { ConfigContext, ExpoConfig } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Smart Home',
  slug: 'smart-home',
  version: '0.1.0',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  scheme: 'smarthome',
  userInterfaceStyle: 'automatic',
  newArchEnabled: true,
  ios: {
    bundleIdentifier: 'com.smarthome.mobile',
    supportsTablet: true,
  },
  android: {
    package: 'com.smarthome.mobile',
    adaptiveIcon: {
      backgroundColor: '#07111F',
      foregroundImage: './assets/images/android-icon-foreground.png',
      backgroundImage: './assets/images/android-icon-background.png',
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
    edgeToEdgeEnabled: true,
    predictiveBackGestureEnabled: false,
  },
  web: {
    output: 'static',
    favicon: './assets/images/favicon.png',
  },
  plugins: [
    'expo-router',
    'expo-secure-store',
    // @react-native-firebase/app and @react-native-firebase/messaging are
    // listed as dependencies but their Expo config plugins require
    // google-services.json (Android) and GoogleService-Info.plist (iOS)
    // which are not committed. Add them back in Sprint 3 once Firebase
    // credentials are available. The JS packages remain installed so
    // imports compile, but FCM will not function until Sprint 3.
    [
      'expo-splash-screen',
      {
        image: './assets/images/splash-icon.png',
        imageWidth: 200,
        resizeMode: 'contain',
        backgroundColor: '#07111F',
      },
    ],
  ],
  experiments: { typedRoutes: true, reactCompiler: true },
});
