import { createFileRoute, Link } from "@tanstack/react-router";
import { Trash2 } from "lucide-react";

export const Route = createFileRoute("/data-deletion")({
  component: DataDeletionPage,
  head: () => ({
    meta: [
      { title: "حذف الحساب والبيانات — وَصْل" },
      {
        name: "description",
        content:
          "طريقة حذف حسابك في وَصْل وحذف بياناتك نهائياً: الخطوات من داخل التطبيق، وما يُحذف، ومدة الحذف، وطريقة التواصل معنا.",
      },
      { property: "og:title", content: "حذف الحساب والبيانات — وَصْل" },
      {
        property: "og:description",
        content: "خطوات حذف حسابك وبياناتك نهائياً من تطبيق وَصْل.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: "https://arab-spark-ai.lovable.app/data-deletion" }],
  }),
});

function DataDeletionPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <div className="mb-8 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-destructive/10">
          <Trash2 className="h-5 w-5 text-destructive" />
        </div>
        <h1 className="text-3xl font-bold">حذف الحساب والبيانات</h1>
      </div>

      <div className="space-y-6 text-sm leading-7 text-muted-foreground">
        <section>
          <h2 className="text-lg font-semibold text-foreground">اسم التطبيق</h2>
          <p>وَصْل — المعرّف: app.lovable.arabsparkai</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">كيف تحذف حسابك</h2>
          <ol className="list-decimal space-y-1 pr-5">
            <li>سجّل الدخول إلى حسابك.</li>
            <li>
              افتح <Link to="/settings" className="font-semibold text-primary hover:underline">الإعدادات</Link>.
            </li>
            <li>اختر «حذف الحساب» في قسم الخصوصية والأمان، ثم أكّد الحذف.</li>
          </ol>
          <p className="mt-2">
            إن لم تستطع الدخول إلى حسابك، أرسل طلب حذف من البريد المسجَّل لدينا وسنحذفه بعد التحقق من هويتك.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">ما يُحذف نهائياً</h2>
          <ul className="list-disc space-y-1 pr-5">
            <li>الحساب والبريد الإلكتروني واسم العرض والصورة الشخصية.</li>
            <li>المنشورات والتعليقات والفيديوهات والصور والمقاطع الصوتية المرفوعة.</li>
            <li>الرسائل، الأصدقاء، الإشعارات، إعلانات المتجر، وسجل الهدايا الشخصي.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">ما قد يُحفظ مؤقتاً</h2>
          <p>
            سجلات المعاملات المالية (الشحن والسحب ورسوم الوساطة) تُحفظ بشكل مجهول الهوية للمدة التي يفرضها
            القانون المحاسبي، دون أي بيانات تعريف شخصية.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">مدة التنفيذ</h2>
          <p>الحذف من داخل التطبيق فوري، ويُستكمل حذف النسخ الاحتياطية خلال ٣٠ يوماً كحد أقصى.</p>
        </section>

        <section>
          <p>
            اطّلع أيضاً على{" "}
            <Link to="/privacy" className="font-semibold text-primary hover:underline">سياسة الخصوصية</Link> و
            <Link to="/terms" className="font-semibold text-primary hover:underline"> شروط الاستخدام</Link>.
          </p>
        </section>
      </div>
    </div>
  );
}
