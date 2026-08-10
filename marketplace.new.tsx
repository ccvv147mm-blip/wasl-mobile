import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, ImagePlus, X, Package, Wrench, Tag } from "lucide-react";
import { friendlyError } from "@/lib/friendly-error";
import { assertAllowedUpload } from "@/lib/upload-guard";
import { FEE_PERCENT, feePoints } from "@/lib/marketplace-fee";

export const Route = createFileRoute("/marketplace/new")({ component: NewListing });

function NewListing() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [kind, setKind] = useState<"product" | "service">("product");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState<number>(0);
  const [category, setCategory] = useState("");
  const [deliveryTerms, setDeliveryTerms] = useState("");
  const [images, setImages] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const addImages = (files: FileList | null) => {
    if (!files) return;
    const arr = Array.from(files).slice(0, 5 - images.length);
    for (const f of arr) if (f.size > 5 * 1024 * 1024) return toast.error("الحد الأقصى 5MB لكل صورة");
    setImages((s) => [...s, ...arr]);
    setPreviews((s) => [...s, ...arr.map((f) => URL.createObjectURL(f))]);
  };
  const removeImage = (i: number) => {
    setImages((s) => s.filter((_, idx) => idx !== i));
    setPreviews((s) => s.filter((_, idx) => idx !== i));
  };

  const submit = async () => {
    if (!title.trim() || !description.trim()) return toast.error("العنوان والوصف مطلوبان");
    setSaving(true);
    try {
      const urls: string[] = [];
      for (const f of images) {
        const { contentType, ext } = assertAllowedUpload(f, ["image"]);
        const path = `${user!.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error: upErr } = await supabase.storage.from("listing-media").upload(path, f, { contentType });
        if (upErr) throw upErr;
        urls.push(supabase.storage.from("listing-media").getPublicUrl(path).data.publicUrl);
      }
      const { data: prof } = await supabase.from("profiles").select("country").eq("id", user!.id).single();
      const { data: row, error } = await supabase.from("listings").insert({
        seller_id: user!.id,
        kind, title, description,
        price_egp: price,
        price_points: feePoints(price),
        category: category || null,
        images: urls, country: prof?.country ?? null,
        delivery_terms: deliveryTerms.trim() || null,
      } as any).select("id").single();
      if (error) throw error;
      toast.success("تم نشر القائمة");
      navigate({ to: "/marketplace/$listingId", params: { listingId: row.id } });
    } catch (e) {
      toast.error(friendlyError(e, "تعذّر النشر"));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="animate-spin" /></div>;
  if (!user) return <Navigate to="/login" />;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-2xl px-4 py-6">
        <h1 className="mb-4 text-2xl font-bold">إضافة قائمة جديدة</h1>
        <div className="space-y-4 rounded-2xl border border-border bg-card p-6 shadow-card">
          <div className="flex gap-2">
            {(["product", "service"] as const).map((k) => (
              <Button key={k} variant={kind === k ? "default" : "outline"} size="sm" onClick={() => setKind(k)} className="flex-1">
                {k === "product" ? <><Package className="h-4 w-4" /> سلعة</> : <><Wrench className="h-4 w-4" /> خدمة</>}
              </Button>
            ))}
          </div>
          <div>
            <Label>العنوان</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} />
          </div>
          <div>
            <Label>الوصف</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} maxLength={2000} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>السعر (جنيه مصري)</Label>
              <Input type="number" min={0} max={1000000} value={price} onChange={(e) => setPrice(parseInt(e.target.value) || 0)} />
            </div>
            <div>
              <Label>الفئة (اختياري)</Label>
              <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="مثلاً: إلكترونيات" />
            </div>
          </div>
          <div className="rounded-xl border border-border bg-muted/30 p-3 text-xs leading-relaxed text-muted-foreground">
            الدفع يتم نقداً بالجنيه المصري عند الاستلام بين البائع والمشتري. التطبيق لا يخصم قيمة السلعة،
            بل يخصم رسوم وساطة من المشتري بالنقاط فقط ({FEE_PERCENT}% من السعر) —
            تقديرياً <span className="font-bold text-amber-500">{feePoints(price)} نقطة</span>.
          </div>

          <div>
            <Label>شروط التوصيل أو التسليم</Label>
            <Textarea
              value={deliveryTerms}
              onChange={(e) => setDeliveryTerms(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder="مثلاً: التوصيل داخل القاهرة خلال 48 ساعة، الاستلام من المكان، الشحن على المشتري..."
            />
          </div>
          <div>
            <Label>الصور (حتى 5)</Label>
            <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => addImages(e.target.files)} />
            <div className="mt-2 flex flex-wrap gap-2">
              {previews.map((src, i) => (
                <div key={i} className="relative h-20 w-20 overflow-hidden rounded-lg border border-border">
                  <img src={src} alt="" className="h-full w-full object-cover" />
                  <button onClick={() => removeImage(i)} className="absolute end-0 top-0 flex h-5 w-5 items-center justify-center bg-destructive text-destructive-foreground">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              {images.length < 5 && (
                <button onClick={() => fileRef.current?.click()} className="flex h-20 w-20 items-center justify-center rounded-lg border-2 border-dashed border-border text-muted-foreground hover:border-primary">
                  <ImagePlus className="h-5 w-5" />
                </button>
              )}
            </div>
          </div>
          <Button onClick={submit} disabled={saving} className="w-full shadow-elegant">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            نشر القائمة
          </Button>
        </div>
      </main>
    </div>
  );
}
