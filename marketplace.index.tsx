import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Coins, Plus, Store, Loader2, Package, Wrench, ListChecks, Banknote } from "lucide-react";
import { useState } from "react";

type Listing = {
  id: string;
  seller_id: string;
  kind: "product" | "service";
  title: string;
  description: string;
  price_points: number;
  price_egp: number | null;
  category: string | null;
  images: string[];
  country: string | null;
  status: string;
  created_at: string;
};

export const Route = createFileRoute("/marketplace/")({
  component: MarketplacePage,
  head: () => ({
    meta: [
      { title: "المتجر — سلع وخدمات على وَصْل" },
      {
        name: "description",
        content: "تسوّق سلعاً وخدمات يعرضها مستخدمو وَصْل بالنقاط، أو أضف إعلانك الخاص وابدأ البيع داخل المجتمع العربي.",
      },
      { property: "og:title", content: "المتجر — سلع وخدمات على وَصْل" },
      {
        property: "og:description",
        content: "سوق وَصْل: اعرض سلعك وخدماتك أو اشترِ من الآخرين باستخدام النقاط.",
      },
      { property: "og:url", content: "https://arab-spark-ai.lovable.app/marketplace" },
    ],
    links: [{ rel: "canonical", href: "https://arab-spark-ai.lovable.app/marketplace" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: "متجر وَصْل",
          url: "https://arab-spark-ai.lovable.app/marketplace",
          inLanguage: "ar",
          description: "سلع وخدمات يعرضها مستخدمو وَصْل بالنقاط.",
          isPartOf: { "@id": "https://arab-spark-ai.lovable.app/#website" },
        }),
      },
    ],
  }),
});


function MarketplacePage() {
  const { user, loading } = useAuth();
  const [filter, setFilter] = useState<"all" | "product" | "service">("all");

  const listings = useQuery({
    enabled: !!user,
    queryKey: ["listings", filter],
    queryFn: async () => {
      let q = supabase.from("listings").select("*").eq("status", "active").order("created_at", { ascending: false }).limit(60);
      if (filter !== "all") q = q.eq("kind", filter);
      const { data, error } = await q;
      if (error) throw error;
      return data as Listing[];
    },
  });

  if (loading) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="animate-spin" /></div>;
  if (!user) return <Navigate to="/login" />;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-5xl px-4 py-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl gradient-primary shadow-elegant">
              <Store className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold">المتجر</h1>
              <p className="text-xs text-muted-foreground">سلع وخدمات بالنقاط الداخلية</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link to="/marketplace/my"><ListChecks className="h-4 w-4" /> قائمتي</Link>
            </Button>
            <Button asChild className="shadow-elegant">
              <Link to="/marketplace/new"><Plus className="h-4 w-4" /> إضافة قائمة</Link>
            </Button>
          </div>
        </div>

        <div className="mb-4 flex gap-2">
          {(["all", "product", "service"] as const).map((k) => (
            <Button key={k} size="sm" variant={filter === k ? "default" : "outline"} onClick={() => setFilter(k)}>
              {k === "all" ? "الكل" : k === "product" ? <><Package className="h-3.5 w-3.5" /> سلع</> : <><Wrench className="h-3.5 w-3.5" /> خدمات</>}
            </Button>
          ))}
        </div>

        {listings.isLoading && <div className="flex justify-center py-12"><Loader2 className="animate-spin text-muted-foreground" /></div>}
        {listings.data && listings.data.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border p-12 text-center">
            <Store className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
            <p className="mb-4 text-muted-foreground">لا توجد قوائم بعد. كن أول من يضيف سلعة أو خدمة!</p>
            <Button asChild className="shadow-elegant">
              <Link to="/marketplace/new"><Plus className="h-4 w-4" /> أضف أول قائمة</Link>
            </Button>
          </div>
        )}

        <Button asChild size="lg" className="fixed bottom-6 end-6 z-40 h-14 w-14 rounded-full p-0 shadow-elegant md:hidden" aria-label="إضافة قائمة">
          <Link to="/marketplace/new"><Plus className="h-6 w-6" /></Link>
        </Button>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {listings.data?.map((l) => (
            <Link key={l.id} to="/marketplace/$listingId" params={{ listingId: l.id }} className="group">
              <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-card transition hover:shadow-elegant">
                <div className="aspect-square w-full overflow-hidden bg-muted">
                  {l.images[0] ? (
                    <img src={l.images[0]} alt={l.title} className="h-full w-full object-cover transition group-hover:scale-105" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-muted-foreground">
                      {l.kind === "product" ? <Package className="h-10 w-10" /> : <Wrench className="h-10 w-10" />}
                    </div>
                  )}
                </div>
                <div className="p-3">
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-primary">{l.kind === "product" ? "سلعة" : "خدمة"}</span>
                    {l.category && <span>· {l.category}</span>}
                  </div>
                  <h3 className="mt-1 line-clamp-1 font-bold">{l.title}</h3>
                  <p className="line-clamp-2 text-xs text-muted-foreground">{l.description}</p>
                  <div className="mt-2 flex items-center gap-1 text-emerald-600">
                    <Banknote className="h-4 w-4" />
                    <span className="font-bold">{l.price_egp ?? l.price_points}</span>
                    <span className="text-xs text-muted-foreground">جنيه · دفع عند الاستلام</span>
                  </div>

                </div>
              </div>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
