import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "app.lovable.arabsparkai",
  appName: "وصل",
  webDir: ".output/public",
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

