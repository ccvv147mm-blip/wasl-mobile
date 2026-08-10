import type { CapacitorConfig } from "@capacitor/cli";

/**
 * إعداد Capacitor لتغليف تطبيق "وَصْل" ورفعه على Google Play و App Store.
 * التطبيق يعمل بتقنية SSR، لذلك يُحمّل الموقع المنشور داخل التطبيق الأصلي.
 */
const config: CapacitorConfig = {
  appId: "app.lovable.arabsparkai",
  appName: "وَصْل",
  webDir: "dist",
  server: {
    url: "https://arab-spark-ai.lovable.app",
    cleartext: false,
    androidScheme: "https",
  },
  android: {
    allowMixedContent: false,
  },
  ios: {
    contentInset: "always",
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      backgroundColor: "#0f172a",
      showSpinner: false,
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#0f172a",
    },
  },
};

export default config;
