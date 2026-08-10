# دليل رفع تطبيق "وَصْل" على Google Play و App Store

التطبيق مُجهّز بـ Capacitor (`capacitor.config.ts`) ويحمّل الموقع المنشور
`https://arab-spark-ai.lovable.app` داخل تطبيق أصلي (Android / iOS).

## 1) التجهيز مرة واحدة (على جهازك)

```bash
git clone <رابط مستودع المشروع>
cd <المجلد>
npm install
npx cap add android
npx cap add ios        # على macOS فقط
npm run build
npx cap sync
```

## 2) بناء ملف Android للنشر (AAB)

```bash
npx cap open android
```
ثم في Android Studio:
- Build → Generate Signed Bundle / APK → **Android App Bundle**
- أنشئ مفتاح توقيع (Keystore) واحفظه في مكان آمن (لا يمكن تغييره لاحقاً)
- الناتج: `android/app/release/app-release.aab` ← ارفعه على Play Console

## 3) بناء ملف iOS للنشر

```bash
npx cap open ios
```
في Xcode: اختر فريق التوقيع → Product → Archive → Distribute App → App Store Connect.

## 4) بيانات المتجر (جاهزة)

- اسم التطبيق: **وَصْل**
- المعرّف (Package / Bundle ID): `app.lovable.arabsparkai`
- الفئة: التواصل الاجتماعي
- الوصف القصير: شبكة اجتماعية عربية للمنشورات والفيديو والمتجر والمحادثات.
- سياسة الخصوصية: `https://arab-spark-ai.lovable.app/privacy`
- شروط الاستخدام: `https://arab-spark-ai.lovable.app/terms`
- الأيقونات: `public/icon-512.png` و`public/icon-192.png`
- الحد الأدنى للعمر: 13+ (يحتوي محتوى من المستخدمين)
- مطلوب في Play Console: نموذج "أمان البيانات" (Data safety) — التطبيق يجمع
  البريد الإلكتروني، الاسم، الصور/الصوت المرفوعة، ورقم الهاتف (اختياري)،
  ويستخدمها لتشغيل الحساب فقط، والاتصال مشفّر (HTTPS)، ويمكن للمستخدم حذف حسابه.

## 5) عند نشر التطبيق فعلياً

حدّث ملف `src/lib/app-stores.ts`:
- `APP_STORE_ID` = رقم Apple ID للتطبيق بعد قبوله.
- رابط Google Play يعمل تلقائياً بعد النشر بنفس `APP_ID`.

بعد ذلك تعمل خيارات "مشاركة عبر متجر Play" و"مشاركة عبر App Store" في كل منشور
ورابط الدعوة بشكل صحيح.

## 6) الحصول على الملف الجاهز للرفع على متجر Play (AAB)

متجر Play يطلب ملف **AAB موقّعاً** (وليس APK). أسهل طريقة — بدون تثبيت أي شيء:

1. اربط المشروع بـ GitHub من Lovable (زر GitHub في الأعلى).
2. في المستودع: **Actions** → **بناء ملف APK** → **Run workflow**.
3. بعد ~6-8 دقائق حمّل من قسم **Artifacts**:
   - `wasl-apk` → يحتوي `app-release.aab` (هذا الملف يُرفع على Play Console)
     و`app-debug.apk` (للتجربة المباشرة على الهاتف).
   - `wasl-keystore` → مفتاح التوقيع (يظهر فقط إذا لم تضع مفتاحك في Secrets).
     **احفظه ولا تفقده**: كل تحديث مستقبلي يجب أن يُوقّع بنفس المفتاح.
     كلمة المرور والـ alias: `waslapp2026` / `wasl`.
4. في Play Console: أنشئ تطبيقاً بالمعرّف `app.lovable.arabsparkai` ثم
   Production أو Internal testing → **Create new release** → ارفع `app-release.aab`.

> لبناء الملف على جهازك بدلاً من ذلك (يتطلب Node 20، Java 21، Android SDK):
> ```bash
> bash scripts/build-apk.sh          # APK للتجربة
> cd android && ./gradlew bundleRelease   # AAB للمتجر
> ```


## 7) الرفع التلقائي إلى Internal testing في Google Play

عند نجاح البناء في GitHub Actions يتم رفع ملف `app-release.aab` تلقائياً إلى
مسار **الاختبار الداخلي (internal)** في Play Console. المطلوب مرة واحدة:

### أ) مفتاح التوقيع (Keystore)
```bash
keytool -genkey -v -keystore wasl-release.keystore -alias wasl \
  -keyalg RSA -keysize 2048 -validity 10000
base64 -w0 wasl-release.keystore > keystore.b64   # على macOS: base64 -i ...
```

### ب) حساب خدمة Google Play
1. Play Console → Setup → **API access** → اربط مشروع Google Cloud.
2. أنشئ **Service Account** في Google Cloud وحمّل مفتاح JSON.
3. في Play Console امنح الحساب صلاحية **Release to testing tracks**.

### ج) أضف هذه الـ Secrets في GitHub (Settings → Secrets → Actions)
| الاسم | القيمة |
| --- | --- |
| `ANDROID_KEYSTORE_BASE64` | محتوى `keystore.b64` |
| `ANDROID_KEYSTORE_PASSWORD` | كلمة مرور الـ keystore |
| `ANDROID_KEY_ALIAS` | `wasl` |
| `ANDROID_KEY_PASSWORD` | كلمة مرور المفتاح |
| `PLAY_SERVICE_ACCOUNT_JSON` | كامل محتوى ملف JSON لحساب الخدمة |

ملاحظات:
- بدون هذه الـ Secrets يستمر البناء ويُنتج APK للتجربة فقط، دون رفع للمتجر.
- يجب رفع أول إصدار **يدوياً** مرة واحدة في Play Console لإنشاء التطبيق
  بالمعرّف `app.lovable.arabsparkai`، وبعدها تعمل الرفعات التلقائية.
- زد `versionCode` في `android/app/build.gradle` قبل كل رفعة (Play يرفض نفس الرقم).
- ملاحظات الإصدار تُقرأ من `distribution/whatsnew/`.

> ملاحظة: التطبيق يعمل بتقنية SSR ويحمّل الموقع المنشور داخل الغلاف الأصلي،
> لذلك ملف `public/app-shell.html` هو شاشة الانتظار حتى يُحمّل الموقع.
