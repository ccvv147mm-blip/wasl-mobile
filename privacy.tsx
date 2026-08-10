import { createFileRoute, Link } from "@tanstack/react-router";
import { Header } from "@/components/Header";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "سياسة الخصوصية — وَصْل" },
      {
        name: "description",
        content: "سياسة خصوصية وَصْل: ما البيانات التي نجمعها، كيف نستخدمها ونحميها، وحقوقك في حذف حسابك، وفقاً لمتطلبات Google Play.",
      },
      { property: "og:title", content: "سياسة الخصوصية — وَصْل" },
      {
        property: "og:description",
        content: "تعرّف على كيفية جمع بياناتك واستخدامها وحمايتها داخل شبكة وَصْل العربية.",
      },
      { property: "og:url", content: "https://arab-spark-ai.lovable.app/privacy" },
    ],
    links: [{ rel: "canonical", href: "https://arab-spark-ai.lovable.app/privacy" }],
  }),
  component: PrivacyPage,
});


function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-3xl px-4 py-8 leading-loose" dir="rtl">
        <h1 className="mb-2 text-3xl font-black">سياسة الخصوصية</h1>
        <p className="text-sm text-muted-foreground">آخر تحديث: 2026</p>

        <section className="mt-6 space-y-4 text-sm">
          <p>
            نحن في تطبيق <strong>وَصْل</strong> نحترم خصوصيتك ونلتزم بحماية بياناتك الشخصية. تشرح هذه السياسة
            كيف نجمع ونستخدم ونحمي معلوماتك عند استخدامك لتطبيقنا، وفقاً لمتطلبات Google Play.
          </p>

          <h2 className="mt-6 text-xl font-bold">1. البيانات التي نجمعها</h2>
          <ul className="list-disc space-y-1 pe-6">
            <li>بيانات الحساب: البريد الإلكتروني، اسم المستخدم، الصورة الشخصية، النبذة.</li>
            <li>المحتوى الذي تنشره: منشورات، تعليقات، صور، فيديوهات، رسائل، قوائم متجر.</li>
            <li>بيانات الاستخدام: تفاعلاتك، إعجاباتك، مشاهداتك، الدولة (لتخصيص الأخبار).</li>
            <li>الصوت: تسجيلات صوتية تختار رفعها كتعليقات.</li>
          </ul>

          <h2 className="mt-6 text-xl font-bold">2. كيف نستخدم بياناتك</h2>
          <ul className="list-disc space-y-1 pe-6">
            <li>توفير وتحسين خدمات التطبيق.</li>
            <li>تخصيص الخلاصة والأخبار حسب اهتماماتك وبلدك.</li>
            <li>تشغيل ميزات الذكاء الاصطناعي (تحسين النصوص، تحويل النص إلى صوت، المحادثة مع الصفحة).</li>
            <li>حساب الأرباح التقديرية وعرض الإحصاءات.</li>
          </ul>

          <h2 className="mt-6 text-xl font-bold">3. مشاركة البيانات</h2>
          <p>
            لا نبيع بياناتك لأي طرف ثالث. قد نستخدم خدمات معتمدة (Lovable Cloud لتخزين البيانات،
            ElevenLabs لتحويل النص إلى صوت، Google Gemini للذكاء الاصطناعي) ضمن سياسات صارمة.
          </p>

          <h2 className="mt-6 text-xl font-bold">4. حقوقك</h2>
          <ul className="list-disc space-y-1 pe-6">
            <li>الوصول إلى بياناتك وتعديلها من صفحتك الشخصية.</li>
            <li>حذف منشوراتك وتعليقاتك وقوائمك في أي وقت.</li>
            <li>طلب حذف حسابك بالكامل عبر التواصل معنا.</li>
          </ul>

          <h2 className="mt-6 text-xl font-bold">5. أمان البيانات</h2>
          <p>
            نستخدم تشفيراً متقدماً وسياسات وصول صارمة (Row-Level Security) لحماية بياناتك. لا يمكن لأي مستخدم
            رؤية رسائلك الخاصة أو بياناتك الحساسة إلا أنت.
          </p>

          <h2 className="mt-6 text-xl font-bold">6. الأطفال</h2>
          <p>التطبيق غير مخصص للأطفال دون 13 عاماً. لا نجمع عمداً أي بيانات منهم.</p>

          <h2 className="mt-6 text-xl font-bold">7. التغييرات على هذه السياسة</h2>
          <p>قد نحدّث هذه السياسة من وقت لآخر. سيُعلَن أي تغيير جوهري داخل التطبيق.</p>

          <h2 className="mt-6 text-xl font-bold">8. التواصل</h2>
          <p>لأي استفسار حول الخصوصية، تواصل معنا عبر صفحة <Link to="/messages" search={{}} className="text-primary underline">الرسائل</Link>.</p>

          <p className="pt-6 text-xs text-muted-foreground">
            بالإضافة إلى <Link to="/terms" className="text-primary underline">شروط الاستخدام</Link>.
          </p>
        </section>
      </main>
    </div>
  );
}
