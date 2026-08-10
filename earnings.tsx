import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/lib/auth-context";
import { Header } from "@/components/Header";
import { getEarnings } from "@/lib/voice.functions";
import { Loader2, DollarSign, Eye, Heart, MessageCircle, FileText, Video, TrendingUp, Wallet, UserPlus, Copy, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/earnings")({
  component: EarningsPage,
  head: () => ({
    meta: [
      { title: "الأرباح والتحليلات — وَصْل" },
      {
        name: "description",
        content: "تابع أرباحك على وَصْل بالتفصيل: المشاهدات والإعجابات والتعليقات وعدد الدعوات، وشروط استلام الأرباح والحد الأدنى للسحب.",
      },
      { property: "og:title", content: "الأرباح والتحليلات — وَصْل" },
      {
        property: "og:description",
        content: "لوحة أرباح المبدعين في وَصْل: تحليلات التفاعل، عدد الدعوات، وشروط السحب.",
      },
      { property: "og:url", content: "https://arab-spark-ai.lovable.app/earnings" },
      { name: "robots", content: "noindex, follow" },
    ],
    links: [{ rel: "canonical", href: "https://arab-spark-ai.lovable.app/earnings" }],
  }),
});


function EarningsPage() {
  const { user, loading } = useAuth();
  const fn = useServerFn(getEarnings);
  const q = useQuery({
    enabled: !!user,
    queryKey: ["earnings", user?.id],
    queryFn: () => fn(),
  });

  if (loading) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (!user) return <Navigate to="/login" />;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-3xl px-4 py-6">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl gradient-primary shadow-elegant">
            <Wallet className="h-6 w-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">الأرباح</h1>
            <p className="text-sm text-muted-foreground">تحليل أداء صفحتك والأرباح التقديرية</p>
          </div>
        </div>

        {q.isLoading && <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>}

        {q.data && (
          <>
            {/* Total earnings hero */}
            <div className="mt-6 rounded-2xl gradient-primary p-6 text-primary-foreground shadow-elegant">
              <p className="text-sm opacity-90">إجمالي الأرباح التقديرية</p>
              <p className="mt-2 text-4xl font-extrabold tracking-tight">${q.data.earnings.total}</p>
              <p className="mt-2 text-xs opacity-80">يتم احتسابها بناءً على نموذج تطبيق وصل</p>
            </div>

            {/* Breakdown */}
            <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
              <Stat icon={<Video className="h-4 w-4" />} label="من الفيديوهات" value={`$${q.data.earnings.videos}`} />
              <Stat icon={<Heart className="h-4 w-4" />} label="من الإعجابات" value={`$${q.data.earnings.likes}`} />
              <Stat icon={<MessageCircle className="h-4 w-4" />} label="من التعليقات" value={`$${q.data.earnings.comments}`} />
              <Stat icon={<FileText className="h-4 w-4" />} label="من المنشورات" value={`$${q.data.earnings.posts}`} />
            </div>

            {/* Engagement stats */}
            <h2 className="mt-8 text-lg font-bold">إحصائيات الأداء</h2>
            <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-3">
              <Stat icon={<Eye className="h-4 w-4" />} label="مشاهدات الفيديوهات" value={q.data.stats.totalVideoViews.toLocaleString("ar-EG")} />
              <Stat icon={<Video className="h-4 w-4" />} label="عدد الفيديوهات" value={q.data.stats.videosCount.toString()} />
              <Stat icon={<FileText className="h-4 w-4" />} label="عدد المنشورات" value={q.data.stats.postsCount.toString()} />
              <Stat icon={<Heart className="h-4 w-4" />} label="إعجابات مستلَمة" value={q.data.stats.likesReceived.toString()} />
              <Stat icon={<MessageCircle className="h-4 w-4" />} label="تعليقات مستلَمة" value={q.data.stats.commentsReceived.toString()} />
              <Stat icon={<TrendingUp className="h-4 w-4" />} label="معدل التفاعل" value={`${q.data.stats.postsCount > 0 ? Math.round(((q.data.stats.likesReceived + q.data.stats.commentsReceived) / q.data.stats.postsCount) * 10) / 10 : 0}/منشور`} />
            </div>

            {/* Top videos */}
            {q.data.topVideos.length > 0 && (
              <>
                <h2 className="mt-8 text-lg font-bold">أفضل الفيديوهات</h2>
                <div className="mt-3 space-y-2">
                  {q.data.topVideos.map((v: any, i) => (
                    <div key={i} className="flex items-center justify-between rounded-xl border border-border bg-card p-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold">{i + 1}</div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">{v.title}</p>
                          <p className="text-xs text-muted-foreground uppercase">{v.platform}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Eye className="h-3.5 w-3.5" /> {v.views_count}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Invite friends CTA */}
            <div className="mt-8 rounded-2xl border border-primary/30 bg-primary/5 p-5">
              <div className="flex items-start gap-3">
                <UserPlus className="mt-0.5 h-5 w-5 text-primary" />
                <div className="flex-1">
                  <h3 className="font-bold">ادعُ أصدقاءك للتطبيق</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    كل شخص يقوم بتحميل التطبيق وإنشاء حساب عبر رابطك يُحتسب دعوة واحدة.
                  </p>
                  <InviteButtons referralCode={q.data.referralCode} />
                </div>
              </div>
            </div>

            {/* Withdraw CTA */}
            <div className="mt-6 rounded-2xl border border-border bg-card p-5 shadow-card">
              <div className="flex items-start gap-3">
                <DollarSign className="mt-0.5 h-5 w-5 text-primary" />
                <div className="flex-1">
                  <h3 className="font-bold">سحب الأرباح</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    لاستلام الأرباح يجب تحقيق شرطين:
                  </p>
                  <ul className="mt-3 space-y-2 text-sm">
                    <li className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2">
                      <span>الحد الأدنى للربح: <strong>${q.data.withdrawal.minAmount}</strong></span>
                      <span className={q.data.withdrawal.meetsAmount ? "text-green-600" : "text-muted-foreground"}>
                        {q.data.withdrawal.meetsAmount ? "✅ مكتمل" : `${q.data.earnings.total} / ${q.data.withdrawal.minAmount}$`}
                      </span>
                    </li>
                    <li className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2">
                      <span>دعوة <strong>{q.data.withdrawal.requiredReferrals}</strong> شخص لتحميل التطبيق</span>
                      <span className={q.data.withdrawal.meetsReferrals ? "text-green-600" : "text-muted-foreground"}>
                        {q.data.withdrawal.meetsReferrals ? "✅ مكتمل" : `${q.data.withdrawal.currentReferrals} / ${q.data.withdrawal.requiredReferrals}`}
                      </span>
                    </li>
                  </ul>
                  {!q.data.withdrawal.meetsReferrals && (
                    <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full gradient-primary transition-all"
                        style={{ width: `${Math.min(100, (q.data.withdrawal.currentReferrals / q.data.withdrawal.requiredReferrals) * 100)}%` }}
                      />
                    </div>
                  )}
                  <Button
                    className="mt-4 w-full"
                    disabled={!q.data.withdrawal.eligible}
                    onClick={() => {
                      if (!q.data.withdrawal.eligible) return;
                      toast.info("ميزة السحب ستكون متاحة قريباً بعد تفعيل Stripe Connect");
                    }}
                  >
                    {q.data.withdrawal.eligible
                      ? "طلب سحب الأرباح"
                      : !q.data.withdrawal.meetsAmount
                        ? `أحتاج ${(q.data.withdrawal.minAmount - q.data.earnings.total).toFixed(2)}$ إضافية`
                        : `ادعُ ${q.data.withdrawal.requiredReferrals - q.data.withdrawal.currentReferrals} شخص آخر لتحميل التطبيق`}
                  </Button>
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    يُحتسب فقط من ينشئ حساباً جديداً عبر رابط دعوتك.
                  </p>
                </div>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">{icon}{label}</div>
      <p className="mt-1 text-lg font-bold">{value}</p>
    </div>
  );
}

function InviteButtons({ referralCode }: { referralCode: string }) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const link = referralCode ? `${origin}/?ref=${encodeURIComponent(referralCode)}` : origin;
  const message = `انضم إليّ في تطبيق وَصْل — شبكة عربية ذكية!\n${link}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      toast.success("تم نسخ رابط الدعوة");
    } catch {
      toast.error("تعذّر النسخ");
    }
  };

  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: "وَصْل", text: message, url: link });
      } catch {
        /* user cancelled */
      }
    } else {
      await copy();
    }
  };

  return (
    <div className="mt-3 space-y-2">
      <div className="flex min-w-0 items-center gap-2 overflow-hidden rounded-lg border border-border bg-background px-2 py-1.5 text-[10px] sm:text-xs">
        <span className="min-w-0 flex-1 truncate" dir="ltr">{link}</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Button onClick={share} size="sm" className="w-full text-xs">
          <Share2 className="ml-1 h-3.5 w-3.5 shrink-0" /> شارك الرابط
        </Button>
        <Button onClick={copy} size="sm" variant="outline" className="w-full text-xs">
          <Copy className="ml-1 h-3.5 w-3.5 shrink-0" /> نسخ
        </Button>
      </div>
    </div>
  );
}
