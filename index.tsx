import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/Header";
import { PostComposer } from "@/components/PostComposer";
import { NewsPanel } from "@/components/NewsPanel";
import { PostCard, type FeedPost } from "@/components/PostCard";
import { Sparkles, Brain, Users, Heart, Loader2, Clock, Store, Video, Coins, ChevronDown, ChevronUp } from "lucide-react";
import { rankFeed } from "@/lib/ai.functions";
import { friendlyError } from "@/lib/friendly-error";
import { toast } from "sonner";

export const Route = createFileRoute("/")({
  component: HomePage,
  head: () => ({
    meta: [
      { title: "وَصْل — شبكة التواصل العربية الذكية" },
      {
        name: "description",
        content: "انضم إلى وَصْل: انشر منشوراتك وفيديوهاتك، تابع أخبار بلدك المرتبة بالذكاء الاصطناعي، تسوّق من المتجر، واربح من تفاعل متابعيك.",
      },
      { property: "og:title", content: "وَصْل — شبكة التواصل العربية الذكية" },
      {
        property: "og:description",
        content: "منشورات وفيديوهات وأخبار بلدك ومتجر للسلع والخدمات ونظام نقاط وهدايا وأرباح للمبدعين، كل ذلك بالعربية.",
      },
      { property: "og:url", content: "https://arab-spark-ai.lovable.app/" },
    ],
    links: [{ rel: "canonical", href: "https://arab-spark-ai.lovable.app/" }],
  }),
});


function HomePage() {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="animate-spin" /></div>;
  return user ? <AuthedHome /> : <Landing />;
}

/* ---------- Home for signed-in users: comprehensive feed of EVERYTHING ---------- */
function AuthedHome() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [smartOrder, setSmartOrder] = useState<string[] | null>(null);
  const [ranking, setRanking] = useState(false);
  const [storeOpen, setStoreOpen] = useState(false);
  const [videosOpen, setVideosOpen] = useState(false);
  const rankFn = useServerFn(rankFeed);

  useEffect(() => {
    const s = localStorage.getItem("home-store-open");
    if (s !== null) setStoreOpen(s === "1");
    const v = localStorage.getItem("home-videos-open");
    if (v !== null) setVideosOpen(v === "1");
  }, []);

  useEffect(() => {
    localStorage.setItem("home-store-open", storeOpen ? "1" : "0");
  }, [storeOpen]);

  useEffect(() => {
    localStorage.setItem("home-videos-open", videosOpen ? "1" : "0");
  }, [videosOpen]);


  useEffect(() => {
    const ch = supabase
      .channel("posts-feed")
      .on("postgres_changes", { event: "*", schema: "public", table: "posts" }, () => {
        qc.invalidateQueries({ queryKey: ["feed"] });
        qc.invalidateQueries({ queryKey: ["my-posts"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  const feed = useQuery({
    queryKey: ["feed"],
    queryFn: async (): Promise<FeedPost[]> => {
      const { data: posts, error } = await supabase
        .from("posts")
        .select(`
          id, content, image_url, video_url, created_at, author_id,
          author:profiles!posts_author_id_fkey(username, full_name, avatar_url),
          likes(user_id), comments(id), gifts(id), shares(id)
        `)
        .order("created_at", { ascending: false })
        .limit(60);
      if (error) throw error;
      return (posts ?? []).map((p: any) => ({
        id: p.id, content: p.content, image_url: p.image_url, video_url: p.video_url, created_at: p.created_at, author_id: p.author_id,
        author: p.author,
        likes_count: p.likes?.length ?? 0,
        comments_count: p.comments?.length ?? 0,
        gifts_count: p.gifts?.length ?? 0,
        shares_count: p.shares?.length ?? 0,
        liked_by_me: (p.likes ?? []).some((l: any) => l.user_id === user?.id),
      }));
    },
  });

  const listings = useQuery({
    queryKey: ["home-listings"],
    queryFn: async () => {
      const { data } = await supabase.from("listings").select("id, title, price_points, price_egp, images, kind").eq("status", "active").order("created_at", { ascending: false }).limit(6);
      return data ?? [];
    },
  });

  const videos = useQuery({
    queryKey: ["home-videos"],
    queryFn: async () => {
      const { data } = await supabase.from("videos").select("id, title, url, platform, video_id, views_count").order("created_at", { ascending: false }).limit(6);
      return data ?? [];
    },
  });

  const ordered = useMemo(() => {
    if (!feed.data) return [];
    if (!smartOrder) return feed.data;
    const map = new Map(feed.data.map((p) => [p.id, p]));
    const out: FeedPost[] = [];
    smartOrder.forEach((id) => { const p = map.get(id); if (p) { out.push(p); map.delete(id); } });
    return [...out, ...Array.from(map.values())];
  }, [feed.data, smartOrder]);

  const runSmartRank = async () => {
    if (!feed.data || feed.data.length < 2) return;
    setRanking(true);
    try {
      const { data: me } = await supabase.from("profiles").select("interests").eq("id", user!.id).single();
      const { order } = await rankFn({
        data: {
          posts: feed.data.slice(0, 30).map((p) => ({
            id: p.id, content: p.content, likes: p.likes_count, comments: p.comments_count,
            author: p.author?.username || "",
          })),
          interests: me?.interests || undefined,
        },
      });
      setSmartOrder(order);
      toast.success("تم الترتيب بالذكاء الاصطناعي");
    } catch (e) { toast.error(friendlyError(e, "تعذّر الترتيب")); }
    finally { setRanking(false); }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-2xl px-4 py-6 space-y-4">
        <NewsPanel />
        <PostComposer />

        {/* Marketplace highlights */}
        {listings.data && listings.data.length > 0 && (
          <section className="rounded-2xl border border-border bg-card p-4 shadow-card">
            <div className="mb-3 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setStoreOpen((v) => !v)}
                className="flex items-center gap-2"
                aria-expanded={storeOpen}
              >
                <Store className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-bold">أحدث المتجر</h2>
                {storeOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
              </button>
              <Button asChild size="sm" variant="ghost"><Link to="/marketplace">الكل</Link></Button>
            </div>
            {storeOpen && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {listings.data.map((l: any) => (
                  <Link key={l.id} to="/marketplace/$listingId" params={{ listingId: l.id }} className="shrink-0 w-32">
                    <div className="overflow-hidden rounded-xl border border-border">
                      <div className="aspect-square bg-muted">
                        {l.images?.[0] && <img src={l.images[0]} alt="" className="h-full w-full object-cover" />}
                      </div>
                      <div className="p-2">
                        <p className="line-clamp-1 text-xs font-semibold">{l.title}</p>
                        <p className="mt-0.5 text-[11px] font-semibold text-emerald-600">{l.price_egp ?? l.price_points} جنيه</p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>
        )}


        {/* Videos highlights */}
        {videos.data && videos.data.length > 0 && (
          <section className="rounded-2xl border border-border bg-card p-4 shadow-card">
            <div className="mb-3 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setVideosOpen((v) => !v)}
                className="flex items-center gap-2"
                aria-expanded={videosOpen}
              >
                <Video className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-bold">فيديوهات حديثة</h2>
                {videosOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
              </button>
              <Button asChild size="sm" variant="ghost"><Link to="/videos">الكل</Link></Button>
            </div>
            {videosOpen && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {videos.data.map((v: any) => (
                  <a key={v.id} href={v.url} target="_blank" rel="noreferrer" className="shrink-0 w-36 rounded-xl border border-border p-2">
                    <p className="line-clamp-2 text-xs font-semibold">{v.title}</p>
                    <p className="mt-1 text-[10px] text-muted-foreground">{v.platform} · {v.views_count} مشاهدة</p>
                  </a>
                ))}
              </div>
            )}

          </section>
        )}

        <div className="flex items-center justify-between pt-2">
          <h2 className="text-lg font-bold">الرئيسية</h2>
          <div className="flex items-center gap-1 rounded-full border border-border bg-card p-1 text-xs">
            <Button size="sm" variant={smartOrder ? "ghost" : "secondary"} onClick={() => setSmartOrder(null)} className="h-7 rounded-full">
              <Clock className="h-3.5 w-3.5" /> الأحدث
            </Button>
            <Button size="sm" variant={smartOrder ? "secondary" : "ghost"} onClick={runSmartRank} disabled={ranking} className="h-7 rounded-full">
              {ranking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 text-[color:var(--ai)]" />} ذكي
            </Button>
          </div>
        </div>

        <div className="space-y-4">
          {feed.isLoading && <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>}
          {feed.data && feed.data.length === 0 && (
            <div className="rounded-2xl border border-dashed border-border p-12 text-center">
              <p className="text-muted-foreground">لا توجد منشورات بعد. كن أول من يشارك!</p>
            </div>
          )}
          {ordered.map((p) => <PostCard key={p.id} post={p} />)}
        </div>
      </main>
    </div>
  );
}

/* ---------- Landing for guests ---------- */
function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-5xl px-4">
        <section className="py-20 text-center md:py-28">
          <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 text-xs text-muted-foreground shadow-card">
            <Sparkles className="h-3.5 w-3.5 text-primary" /> مدعومة بالذكاء الاصطناعي
          </div>
          <h1 className="text-balance text-5xl font-black leading-tight tracking-tight md:text-7xl">
            تواصل، شارك،<br />
            <span className="bg-clip-text text-transparent" style={{ backgroundImage: "var(--gradient-primary)" }}>واكتشف ما يهمّك</span>
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-balance text-lg text-muted-foreground">
            شبكة تواصل اجتماعي عربية ذكية. خلاصة مرتبة لك، ومساعد ذكي لكتابة منشوراتك، ومجتمع يفهم لغتك.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Button size="lg" asChild className="shadow-elegant"><Link to="/signup">ابدأ مجاناً</Link></Button>
            <Button size="lg" variant="outline" asChild><Link to="/login">لديك حساب؟ سجّل دخول</Link></Button>
          </div>
        </section>

        <section className="grid gap-4 pb-24 md:grid-cols-3">
          {[
            { icon: Brain, title: "خلاصة ذكية", desc: "ترتيب المنشورات حسب اهتماماتك بالذكاء الاصطناعي.", g: true },
            { icon: Sparkles, title: "مساعد كتابة", desc: "حسّن منشوراتك أو وسّعها أو اختصرها بنقرة.", g: true },
            { icon: Users, title: "مجتمع عربي", desc: "تفاعل بلغتك مع أشخاص يشاركونك الاهتمام.", g: false },
          ].map((f, i) => (
            <div key={i} className="rounded-2xl border border-border bg-card p-6 shadow-card">
              <div className={`mb-4 flex h-11 w-11 items-center justify-center rounded-xl ${f.g ? "gradient-ai" : "gradient-primary"}`}>
                <f.icon className="h-5 w-5 text-primary-foreground" />
              </div>
              <h3 className="text-lg font-bold">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </section>
      </main>
      <footer className="border-t border-border py-8 text-center text-sm text-muted-foreground">
        <Heart className="mx-auto mb-2 h-4 w-4" /> صُنع بحب للمجتمع العربي
        <div className="mt-3 flex justify-center gap-4 text-xs">
          <Link to="/privacy" className="hover:text-primary">سياسة الخصوصية</Link>
          <Link to="/terms" className="hover:text-primary">شروط الاستخدام</Link>
        </div>
      </footer>
    </div>
  );
}
