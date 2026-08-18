import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.wasl.receipt',
  appName: 'وَصْلُ',
  webDir: '.output/public',
  server: {
    url: "https://arab-spark-ai.lovable.app",
    cleartext: false,
    androidScheme: "https"
  },
  android: {
    allowMixedContent: false,
    versionCode: 2,
    versionName: "1.0.1"
  },
  ios: {
    contentInset: "always"
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      backgroundColor: "#0f172a",
      showSpinner: false
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#0f172a"
    }
  }
};

default export config;
