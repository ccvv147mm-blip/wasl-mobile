import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "شروط الاستخدام — وَصْل" },
      {
        name: "description",
        content: "شروط استخدام تطبيق وَصْل: القواعد والحقوق والالتزامات التي تحكم استخدامك للمنصة، والمحتوى المحظور وسياسة الإشراف.",
      },
      { property: "og:title", content: "شروط الاستخدام — وَصْل" },
      {
        property: "og:description",
        content: "اطّلع على شروط استخدام شبكة وَصْل العربية الذكية: الأهلية، المحتوى، الإشراف، والملكية الفكرية.",
      },
      { property: "og:url", content: "https://arab-spark-ai.lovable.app/terms" },
    ],
    links: [{ rel: "canonical", href: "https://arab-spark-ai.lovable.app/terms" }],
  }),
  component: TermsPage,
});


function TermsPage() {
  const lastUpdated = "26 مايو 2026";

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <div className="mx-auto max-w-3xl px-4 py-10 sm:py-16">
        <nav className="mb-8 text-sm">
          <Link to="/" className="text-primary hover:underline">
            ← العودة للرئيسية
          </Link>
        </nav>

        <header className="mb-10">
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            شروط الاستخدام
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            آخر تحديث: {lastUpdated}
          </p>
        </header>

        <article className="space-y-8 text-foreground leading-relaxed">
          <section>
            <p className="text-muted-foreground">
              مرحباً بك في <strong className="text-foreground">وَصْل</strong> ("التطبيق"، "نحن"، "خدمتنا").
              باستخدامك للتطبيق فإنك توافق على الالتزام بهذه الشروط. إن لم توافق عليها، يرجى عدم استخدام التطبيق.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold">١. الأهلية</h2>
            <p className="text-muted-foreground">
              يجب أن يكون عمرك ١٣ عاماً فأكثر لإنشاء حساب. إذا كنت دون سن الرشد القانوني في بلدك،
              فيجب الحصول على موافقة وليّ الأمر قبل استخدام الخدمة.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold">٢. الحساب وكلمة المرور</h2>
            <ul className="list-inside list-disc space-y-2 text-muted-foreground">
              <li>أنت مسؤول عن الحفاظ على سرية بيانات حسابك.</li>
              <li>يجب تقديم معلومات صحيحة وحديثة عند التسجيل.</li>
              <li>أنت مسؤول عن جميع الأنشطة التي تتم عبر حسابك.</li>
              <li>أبلغنا فوراً عند أي استخدام غير مصرّح به لحسابك.</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold">٣. المحتوى الذي تنشره</h2>
            <p className="mb-3 text-muted-foreground">
              تحتفظ بملكية المحتوى الذي تنشره، لكنك تمنحنا ترخيصاً عالمياً غير حصري ومجانياً
              لعرضه وتوزيعه داخل التطبيق لأغراض تشغيل الخدمة.
            </p>
            <p className="text-muted-foreground">
              أنت وحدك المسؤول عن محتواك وعن أي عواقب قانونية تترتب عليه.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold">٤. الاستخدام المحظور</h2>
            <p className="mb-3 text-muted-foreground">يُحظر استخدام التطبيق في:</p>
            <ul className="list-inside list-disc space-y-2 text-muted-foreground">
              <li>نشر محتوى مخالف للشرع، أو القانون، أو الآداب العامة.</li>
              <li>التحريض على العنف، الكراهية، العنصرية، أو الطائفية.</li>
              <li>نشر محتوى إباحي أو غير لائق أو يستهدف القاصرين.</li>
              <li>انتحال شخصية الآخرين أو نشر معلومات كاذبة.</li>
              <li>الإزعاج، التنمّر، التحرّش، أو تهديد المستخدمين.</li>
              <li>نشر برامج ضارة، فيروسات، أو محاولة اختراق النظام.</li>
              <li>إرسال الرسائل المزعجة (Spam) أو الإعلانات غير المصرّح بها.</li>
              <li>انتهاك حقوق الملكية الفكرية للآخرين.</li>
              <li>جمع بيانات المستخدمين دون إذنهم.</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold">٥. الذكاء الاصطناعي</h2>
            <p className="text-muted-foreground">
              يستخدم التطبيق تقنيات الذكاء الاصطناعي لترتيب المحتوى واقتراحه. قد تكون النتائج
              غير دقيقة أحياناً، ولا نتحمّل المسؤولية عن أي قرار تتخذه بناءً على هذه الاقتراحات.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold">٦. الإشراف والإيقاف</h2>
            <p className="text-muted-foreground">
              نحتفظ بالحق في حذف أي محتوى مخالف، وإيقاف أو إلغاء أي حساب ينتهك هذه الشروط،
              دون إشعار مسبق وبدون التزام بالتعويض.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold">٧. الملكية الفكرية</h2>
            <p className="text-muted-foreground">
              جميع حقوق التطبيق وشعاراته وتصميماته محفوظة لنا. لا يجوز نسخها أو إعادة استخدامها
              دون إذن خطّي مسبق.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold">٨. إخلاء المسؤولية</h2>
            <p className="text-muted-foreground">
              يُقدَّم التطبيق "كما هو" دون أي ضمانات صريحة أو ضمنية. لا نضمن خلوّ الخدمة من الأخطاء
              أو الانقطاعات، ولا نتحمّل المسؤولية عن أي خسائر مباشرة أو غير مباشرة ناتجة عن استخدامه.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold">٩. الخصوصية</h2>
            <p className="text-muted-foreground">
              تخضع معالجة بياناتك لسياسة الخصوصية الخاصة بنا، التي تُعتبر جزءاً لا يتجزأ من هذه الشروط.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold">١٠. تعديل الشروط</h2>
            <p className="text-muted-foreground">
              قد نُحدّث هذه الشروط من وقت لآخر. سيتم إعلامك بأي تغييرات جوهرية، واستمرارك في استخدام
              التطبيق بعد التحديث يُعدّ موافقة على الشروط الجديدة.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold">١١. إنهاء الخدمة</h2>
            <p className="text-muted-foreground">
              يحقّ لك حذف حسابك في أي وقت. كما يحقّ لنا تعليق أو إنهاء الخدمة كلياً أو جزئياً متى رأينا ذلك مناسباً.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold">١٢. القانون المعمول به</h2>
            <p className="text-muted-foreground">
              تخضع هذه الشروط للقوانين المعمول بها في بلد التشغيل، وأي نزاع ينشأ عنها يُحَلّ عبر الجهات القضائية المختصّة.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold">١٣. التواصل معنا</h2>
            <p className="text-muted-foreground">
              لأي استفسار يتعلّق بهذه الشروط، يمكنك التواصل معنا عبر صفحة الدعم داخل التطبيق.
            </p>
          </section>
        </article>

        <footer className="mt-12 border-t border-border pt-6 text-center text-sm text-muted-foreground">
          باستخدامك تطبيق وَصْل فإنك تقرّ بأنك قرأت هذه الشروط ووافقت عليها.
        </footer>
      </div>
    </div>
  );
}
