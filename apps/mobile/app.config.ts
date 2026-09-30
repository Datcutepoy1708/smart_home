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
  ios: {
    bundleIdentifier: 'com.smarthome.mobile',
    supportsTablet: true,
  },
  android: {
    package: 'com.smarthome.mobile',
    googleServicesFile: './google-services.json',
    adaptiveIcon: {
      backgroundColor: '#07111F',
      foregroundImage: './assets/images/android-icon-foreground.png',
      backgroundImage: './assets/images/android-icon-background.png',
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
  },
  web: {
    output: 'static',
    favicon: './assets/images/favicon.png',
  },
  plugins: [
    'expo-router',
    'expo-secure-store',
    'expo-font',
    'expo-image',
    'expo-status-bar',
    'expo-web-browser',
    '@react-native-firebase/app',
    '@react-native-firebase/messaging',
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
  experiments: { reactCompiler: true },
});
