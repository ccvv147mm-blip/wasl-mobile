import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";

import appCss from "../styles.css?url";
import { AuthProvider } from "@/lib/auth-context";
import { Toaster } from "@/components/ui/sonner";
import { ErrorCatcher } from "@/components/ErrorCatcher";
import { MediaLock } from "@/components/MediaLock";
import { I18nProvider } from "@/lib/i18n";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">٤٠٤</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">الصفحة غير موجودة</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          الصفحة التي تبحث عنها غير موجودة أو تم نقلها.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            الصفحة الرئيسية
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">حدث خطأ ما</h1>
        <p className="mt-2 text-sm text-muted-foreground">تعذّر تحميل الصفحة. يرجى المحاولة مرة أخرى.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            إعادة المحاولة
          </button>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "وَصْل — شبكة عربية مدعومة بالذكاء الاصطناعي" },
      {
        name: "description",
        content: "وَصْل شبكة تواصل عربية مدعومة بالذكاء الاصطناعي: انشر منشوراتك وفيديوهاتك، تابع أخبار بلدك، تسوّق من المتجر، واربح من تفاعل متابعيك.",
      },
      { property: "og:title", content: "وَصْل — شبكة عربية مدعومة بالذكاء الاصطناعي" },
      {
        property: "og:description",
        content: "شبكة تواصل عربية بالذكاء الاصطناعي: منشورات وفيديوهات وأخبار بلدك ومتجر للسلع والخدمات ونظام نقاط وهدايا وأرباح للمبدعين.",
      },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "وَصْل" },
      { name: "twitter:title", content: "وَصْل — شبكة عربية مدعومة بالذكاء الاصطناعي" },
      {
        name: "twitter:description",
        content: "شبكة تواصل عربية بالذكاء الاصطناعي: منشورات وفيديوهات وأخبار بلدك ومتجر للسلع والخدمات ونظام نقاط وهدايا وأرباح للمبدعين.",
      },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/8b4c3b15-894a-4d44-ba03-5dc6a10929f9/id-preview-4573bdee--2a26991d-944d-41ba-b079-e4402e540c00.lovable.app-1779725884391.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/8b4c3b15-894a-4d44-ba03-5dc6a10929f9/id-preview-4573bdee--2a26991d-944d-41ba-b079-e4402e540c00.lovable.app-1779725884391.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "theme-color", content: "#1877F2" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "default" },
      { name: "apple-mobile-web-app-title", content: "وَصْل" },
      { name: "mobile-web-app-capable", content: "yes" },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "WebSite",
              "@id": "https://arab-spark-ai.lovable.app/#website",
              name: "وَصْل",
              alternateName: "Wasl",
              url: "https://arab-spark-ai.lovable.app/",
              inLanguage: "ar",
              description:
                "شبكة تواصل عربية مدعومة بالذكاء الاصطناعي: منشورات وفيديوهات وأخبار ومتجر ونظام نقاط وهدايا.",
              publisher: { "@id": "https://arab-spark-ai.lovable.app/#organization" },
              potentialAction: {
                "@type": "SearchAction",
                target: "https://arab-spark-ai.lovable.app/search?q={search_term_string}",
                "query-input": "required name=search_term_string",
              },
            },
            {
              "@type": "Organization",
              "@id": "https://arab-spark-ai.lovable.app/#organization",
              name: "وَصْل",
              url: "https://arab-spark-ai.lovable.app/",
              logo: "https://arab-spark-ai.lovable.app/icon-512.png",
            },
          ],
        }),
      },
    ],

    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.json" },
      { rel: "icon", href: "/icon-192.png", type: "image/png" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&family=Tajawal:wght@400;500;700&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <AuthProvider>
          <MediaLock />
          <Outlet />
          <ErrorCatcher />
          <Toaster position="top-center" richColors />
        </AuthProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
}
