/**
 * روابط التطبيق على المتاجر — عدّلها بعد نشر التطبيق فعلياً.
 * appId يجب أن يطابق capacitor.config.ts
 */
export const APP_ID = "app.lovable.arabsparkai";
export const APP_NAME = "وَصْل";
export const WEB_URL = "https://arab-spark-ai.lovable.app";





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
