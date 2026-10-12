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
    // النطاق الأساسي مباشرة، حتى لا تُحوَّل الصفحة لنطاق آخر فتُفتح في Chrome
    url: "https://www.arabsparkcommunity.app",
    cleartext: false,
    androidScheme: "https",
    // أي تنقّل لهذه النطاقات يبقى داخل التطبيق بدل فتح المتصفح
    allowNavigation: [
      "arabsparkcommunity.app",
      "*.arabsparkcommunity.app",
      "arab-spark-ai.lovable.app",
      "*.lovable.app",
      "*.supabase.co",
      "accounts.google.com",
      "*.google.com",
    ],
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
      style: "LIGHT",
      backgroundColor: "#0f172a",
      overlaysWebView: true,
    },
  },
};

export default config;
