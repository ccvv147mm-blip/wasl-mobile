/**
 * روابط التطبيق على المتاجر — عدّلها بعد نشر التطبيق فعلياً.
 * appId يجب أن يطابق capacitor.config.ts
 */
export const APP_ID = "app.lovable.arabsparkai";
export const APP_NAME = "وَصْل";
export const WEB_URL = "https://arab-spark-ai.lovable.app";

/**
 * بصمة مفتاح توقيع التطبيق (SHA-256) الصادرة من Google Play App Signing.
 * تُنشر في /.well-known/assetlinks.json لربط الموقع بالتطبيق على متجر Play.
 */
export const ANDROID_CERT_SHA256 = [
  "8E:F2:43:D1:70:67:A7:80:9A:0D:B4:BF:2F:D6:64:7D:C7:66:31:BC:9C:E8:7A:A3:A4:16:31:C8:90:6E:D6:05",
];


/** رابط جوجل بلاي (يعمل مباشرة بعد نشر التطبيق بنفس appId) */
export const PLAY_STORE_URL = `https://play.google.com/store/apps/details?id=${APP_ID}`;

/** رابط آب ستور — ضع رقم التطبيق (Apple ID) بعد قبوله في المتجر */
export const APP_STORE_ID = "";
export const APP_STORE_URL = APP_STORE_ID
  ? `https://apps.apple.com/app/id${APP_STORE_ID}`
  : `https://apps.apple.com/search?term=${encodeURIComponent(APP_NAME)}`;

/** رابط ذكي: يوجّه المستخدم للمتجر المناسب لجهازه */
export function storeUrlForDevice(): string {
  if (typeof navigator === "undefined") return WEB_URL;
  const ua = navigator.userAgent || "";
  if (/iPhone|iPad|iPod/i.test(ua)) return APP_STORE_URL;
  if (/Android/i.test(ua)) return PLAY_STORE_URL;
  return WEB_URL;
}

/** نص دعوة لتحميل التطبيق من المتاجر */
export function storeInviteText(refUrl?: string): string {
  return [
    `حمّل تطبيق ${APP_NAME} الآن:`,
    `Google Play: ${PLAY_STORE_URL}`,
    `App Store: ${APP_STORE_URL}`,
    refUrl ? `أو من المتصفح: ${refUrl}` : `أو من المتصفح: ${WEB_URL}`,
  ].join("\n");
}
