#!/usr/bin/env bash
# بناء ملف APK كامل لتطبيق "وَصْل" على جهازك.
# المتطلبات: Node 20+، Java 21 (JDK)، Android SDK (أو Android Studio).
set -euo pipefail

cd "$(dirname "$0")/.."

echo "==> تثبيت الحزم"
npm install --legacy-peer-deps

echo "==> بناء الويب"
npm run build || true
mkdir -p dist
[ -f dist/index.html ] || cp public/app-shell.html dist/index.html

echo "==> تجهيز منصة أندرويد"
[ -d android ] || npx cap add android
npx cap sync android

echo "==> بناء APK"
cd android
chmod +x ./gradlew
./gradlew assembleDebug

echo
echo "تم! الملف الناتج:"
echo "android/app/build/outputs/apk/debug/app-debug.apk"
echo
echo "لبناء نسخة النشر الموقّعة (AAB لمتجر Play):"
echo "  ./gradlew bundleRelease   # بعد إعداد keystore في android/app/build.gradle"
