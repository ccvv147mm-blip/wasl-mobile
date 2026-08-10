import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Coins, Banknote, Store, Loader2, Package, Wrench, Plus, BarChart3, Eye, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

type MyListing = {
  id: string;
  kind: "product" | "service";
  title: string;
  description: string;
  price_points: number;
  price_egp: number | null;
  category: string | null;
  images: string[];
  status: string;
  created_at: string;
};

export const Route = createFileRoute("/marketplace/my")({ component: MyListingsPage });

function MyListingsPage() {
  const { user, loading } = useAuth();
  const [deleting, setDeleting] = useState<string | null>(null);

  const listings = useQuery({
    enabled: !!user,
    queryKey: ["my-listings", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("listings")
        .select("id, kind, title, description, price_points, price_egp, category, images, status, created_at")
        .eq("seller_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as MyListing[];
    },
  });

  const remove = async (id: string) => {
    if (!confirm("هل أنت متأكد من حذف هذه القائمة؟")) return;
    setDeleting(id);
    const { error } = await supabase.from("listings").delete().eq("id", id).eq("seller_id", user!.id);
    setDeleting(null);
    if (error) return toast.error("تعذّر الحذف");
    toast.success("تم الحذف");
    listings.refetch();
  };

  if (loading) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="animate-spin" /></div>;
  if (!user) return <Navigate to="/login" />;

  const activeCount = listings.data?.filter((l) => l.status === "active").length ?? 0;
  const totalCount = listings.data?.length ?? 0;

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
              <h1 className="text-xl font-bold">قائمتي</h1>
              <p className="text-xs text-muted-foreground">إدارة سلعي وخدماتي في المتجر</p>
            </div>
          </div>
          <Button asChild className="shadow-elegant">
            <Link to="/marketplace/new"><Plus className="h-4 w-4" /> إضافة جديدة</Link>
          </Button>
        </div>

        {/* Stats */}
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
            <div className="flex items-center gap-2 text-muted-foreground"><BarChart3 className="h-4 w-4" /><span className="text-xs">القوائم الكلية</span></div>
            <p className="mt-1 text-2xl font-bold">{totalCount}</p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
            <div className="flex items-center gap-2 text-muted-foreground"><Eye className="h-4 w-4" /><span className="text-xs">النشطة</span></div>
            <p className="mt-1 text-2xl font-bold">{activeCount}</p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
            <div className="flex items-center gap-2 text-muted-foreground"><Coins className="h-4 w-4 text-amber-500" /><span className="text-xs">متوسط السعر (جنيه)</span></div>
            <p className="mt-1 text-2xl font-bold">
              {totalCount > 0 ? Math.round((listings.data?.reduce((s, l) => s + (l.price_egp ?? l.price_points), 0) ?? 0) / totalCount) : 0}
            </p>
          </div>
        </div>

        {listings.isLoading && <div className="flex justify-center py-12"><Loader2 className="animate-spin text-muted-foreground" /></div>}

        {listings.data && listings.data.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border p-12 text-center">
            <Store className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
            <p className="mb-4 text-muted-foreground">لا توجد قوائم في متجرك. ابدأ بإضافة أول سلعة أو خدمة!</p>
            <Button asChild className="shadow-elegant">
              <Link to="/marketplace/new"><Plus className="h-4 w-4" /> أضف قائمة</Link>
            </Button>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {listings.data?.map((l) => (
            <div key={l.id} className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
              <div className="aspect-square w-full overflow-hidden bg-muted">
                {l.images[0] ? (
                  <img src={l.images[0]} alt={l.title} className="h-full w-full object-cover" />
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
                  <span className={`rounded-full px-2 py-0.5 text-[10px] ${l.status === "active" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>
                    {l.status === "active" ? "نشط" : "غير نشط"}
                  </span>
                </div>
                <h3 className="mt-1 line-clamp-1 font-bold">{l.title}</h3>
                <p className="line-clamp-2 text-xs text-muted-foreground">{l.description}</p>
                <div className="mt-2 flex items-center justify-between">
                  <div className="flex items-center gap-1 text-emerald-600">
                    <Banknote className="h-4 w-4" />
                    <span className="font-bold">{l.price_egp ?? l.price_points}</span>
                    <span className="text-xs text-muted-foreground">جنيه</span>
                  </div>
                  <div className="flex gap-1">
                    <Button asChild size="sm" variant="outline">
                      <Link to="/marketplace/$listingId" params={{ listingId: l.id }}>عرض</Link>
                    </Button>
                    <Button size="sm" variant="ghost" className="text-destructive" onClick={() => remove(l.id)} disabled={deleting === l.id}>
                      {deleting === l.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
