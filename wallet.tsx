import { createFileRoute, Navigate, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Wallet, Copy, Upload, Loader2, ShieldCheck, CheckCircle2, XCircle, Clock, Gift, Banknote } from "lucide-react";
import { toast } from "sonner";
import { friendlyError } from "@/lib/friendly-error";
import { useCredits } from "@/hooks/use-credits";
import { assertAllowedUpload } from "@/lib/upload-guard";
import {
  getWalletSettings,
  submitRecharge,
  listMyRecharges,
  isAdmin,
} from "@/lib/recharge.functions";
import { submitWithdrawal, listMyWithdrawals } from "@/lib/withdraw.functions";

export const Route = createFileRoute("/wallet")({
  component: WalletPage,
  head: () => ({
    meta: [
      { title: "المحفظة — وَصْل" },
      { name: "description", content: "شحن رصيد النقاط عبر فودافون كاش أو إنستاباي" },
    ],
  }),
});

type Method = "vodafone_cash" | "instapay" | "etisalat_cash" | "orange_cash";

const METHOD_LABEL: Record<Method, string> = {
  vodafone_cash: "فودافون كاش",
  instapay: "إنستاباي",
  etisalat_cash: "اتصالات كاش",
  orange_cash: "أورنج كاش",
};

const PACKS = [
  { egp: 20, bonus: 0 },
  { egp: 50, bonus: 25 },
  { egp: 100, bonus: 100 },
  { egp: 200, bonus: 300 },
  { egp: 500, bonus: 1000 },
];

function WalletPage() {
  const { user, loading } = useAuth();
  const qc = useQueryClient();
  const getSettings = useServerFn(getWalletSettings);
  const submit = useServerFn(submitRecharge);
  const listMine = useServerFn(listMyRecharges);
  const checkAdmin = useServerFn(isAdmin);
  const submitWd = useServerFn(submitWithdrawal);
  const listMyWd = useServerFn(listMyWithdrawals);

  const [method, setMethod] = useState<Method>("vodafone_cash");
  const [amount, setAmount] = useState<number>(50);
  const [senderPhone, setSenderPhone] = useState("");
  const [txRef, setTxRef] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  // Withdrawal form state
  const [wdPoints, setWdPoints] = useState<number>(500);
  const [wdMethod, setWdMethod] = useState<Method>("vodafone_cash");
  const [wdNumber, setWdNumber] = useState("");

  const settings = useQuery({
    enabled: !!user,
    queryKey: ["wallet-settings"],
    queryFn: () => getSettings(),
  });

  const mine = useQuery({
    enabled: !!user,
    queryKey: ["my-recharges", user?.id],
    queryFn: () => listMine(),
    refetchInterval: 5000,
    refetchOnWindowFocus: true,
  });

  const admin = useQuery({
    enabled: !!user,
    queryKey: ["is-admin", user?.id],
    queryFn: () => checkAdmin(),
  });

  const credits = useCredits(user?.id);


  const mut = useMutation({
    mutationFn: async () => {
      let proof_path: string | undefined;
      if (file) {
        setUploading(true);
        const { contentType, ext } = assertAllowedUpload(file, ["image", "pdf"]);
        const path = `${user!.id}/${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage.from("payment-proofs").upload(path, file, {
          contentType,
          cacheControl: "3600",
          upsert: false,
        });
        setUploading(false);
        if (error) throw new Error(error.message);
        proof_path = path;
      }
      return submit({
        data: {
          amount_egp: amount,
          method,
          sender_phone: senderPhone.trim(),
          transaction_ref: txRef.trim() || undefined,
          proof_path,
        },
      });
    },
    onSuccess: () => {
      toast.success("تم إرسال طلب الشحن. سيتم مراجعته خلال دقائق.");
      setSenderPhone("");
      setTxRef("");
      setFile(null);
      qc.invalidateQueries({ queryKey: ["my-recharges"] });
    },
    onError: (e) => toast.error(friendlyError(e, "تعذّر إرسال الطلب")),
  });

  const wdList = useQuery({
    enabled: !!user,
    queryKey: ["my-withdrawals", user?.id],
    queryFn: () => listMyWd(),
  });

  const wdMut = useMutation({
    mutationFn: () =>
      submitWd({
        data: { points: wdPoints, method: wdMethod, recipient_number: wdNumber.trim() },
      }),
    onSuccess: () => {
      toast.success("تم إرسال طلب السحب. سيتم التحويل بعد المراجعة.");
      setWdNumber("");
      qc.invalidateQueries({ queryKey: ["my-withdrawals"] });
      qc.invalidateQueries({ queryKey: ["credits"] });
    },
    onError: (e) => toast.error(friendlyError(e, "تعذّر إرسال طلب السحب")),
  });

  if (loading) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (!user) return <Navigate to="/login" />;

  const walletNumber =
    method === "vodafone_cash" ? settings.data?.vodafone_cash :
    method === "instapay" ? settings.data?.instapay :
    method === "etisalat_cash" ? settings.data?.etisalat_cash :
    settings.data?.orange_cash;

  const points = amount * (settings.data?.pointsPerEgp ?? 10);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-3xl px-4 py-6 space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl gradient-primary shadow-elegant">
              <Gift className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">شحن الهدايا</h1>
              <p className="text-sm text-muted-foreground">اشحن رصيد النقاط لإرسال الهدايا</p>
            </div>
          </div>
          {admin.data?.admin && (
            <Button asChild variant="outline" size="sm">
              <Link to="/admin/recharges"><ShieldCheck className="ml-1 h-4 w-4" /> لوحة المسؤول</Link>
            </Button>
          )}
        </div>

        <div className="rounded-2xl gradient-primary p-5 text-primary-foreground shadow-elegant">
          <p className="text-sm opacity-90">رصيدك الحالي (بالنقاط)</p>
          <p className="mt-1 text-3xl font-extrabold">{(credits.data ?? 0).toLocaleString("ar-EG")} نقطة</p>
          <p className="mt-2 text-xs opacity-80">1 جنيه = {settings.data?.pointsPerEgp ?? 10} نقطة · يظهر الرصيد الجديد فور قبول الدفع</p>
        </div>

        {/* Step 1: pick amount */}
        <section className="rounded-2xl border border-border bg-card p-5">
          <h2 className="text-lg font-bold">1. اختر المبلغ</h2>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
            {PACKS.map((p) => (
              <button
                key={p.egp}
                type="button"
                onClick={() => setAmount(p.egp)}
                className={`rounded-xl border p-3 text-center transition ${
                  amount === p.egp
                    ? "border-primary bg-primary/10 shadow-elegant"
                    : "border-border bg-background hover:border-primary/50"
                }`}
              >
                <p className="text-lg font-bold">{p.egp} ج.م</p>
                <p className="text-xs text-muted-foreground">
                  {(p.egp * (settings.data?.pointsPerEgp ?? 10) + p.bonus).toLocaleString("ar-EG")} نقطة
                </p>
                {p.bonus > 0 && <p className="text-[10px] font-bold text-emerald-600">+{p.bonus} مكافأة</p>}
              </button>
            ))}
          </div>
          <div className="mt-3">
            <Label htmlFor="custom">أو مبلغ آخر (بالجنيه)</Label>
            <Input
              id="custom"
              type="number"
              inputMode="numeric"
              value={amount === 0 ? "" : amount}
              onChange={(e) => setAmount(Number(e.target.value.replace(/[^\d]/g, "") || 0))}
              className="mt-1"
            />
            <p className="mt-1 text-xs text-muted-foreground">ستحصل على <strong>{points.toLocaleString("ar-EG")}</strong> نقطة</p>
          </div>
        </section>

        {/* Step 2: transfer */}
        <section className="rounded-2xl border border-border bg-card p-5">
          <h2 className="text-lg font-bold">2. حوّل المبلغ</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {(Object.keys(METHOD_LABEL) as Method[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMethod(m)}
                className={`rounded-full border px-4 py-2 text-sm transition ${
                  method === m ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background"
                }`}
              >
                {METHOD_LABEL[m]}
              </button>
            ))}
          </div>

          {walletNumber && (
            <div className="mt-4 rounded-xl border border-primary/30 bg-primary/5 p-4">
              <p className="text-xs text-muted-foreground">
                حوّل {amount} ج.م إلى (فودافون كاش / إنستاباي / اتصالات / أورنج):
              </p>
              <div className="mt-1 flex items-center justify-between gap-2">
                <span className="text-lg font-bold" dir="ltr">{walletNumber}</span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    await navigator.clipboard.writeText(walletNumber);
                    toast.success("تم النسخ");
                  }}
                >
                  <Copy className="ml-1 h-4 w-4" /> نسخ
                </Button>
              </div>
            </div>
          )}
        </section>

        {/* Step 3: proof */}
        <section className="rounded-2xl border border-border bg-card p-5">
          <h2 className="text-lg font-bold">3. أرسل إثبات التحويل</h2>
          <div className="mt-3 space-y-3">
            <div>
              <Label htmlFor="sender">رقم المحفظة الذي حوّلت منه *</Label>
              <Input
                id="sender"
                dir="ltr"
                placeholder="01xxxxxxxxx"
                value={senderPhone}
                onChange={(e) => setSenderPhone(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="ref">رقم عملية التحويل (اختياري)</Label>
              <Input
                id="ref"
                dir="ltr"
                placeholder="مثلاً MP2401..."
                value={txRef}
                onChange={(e) => setTxRef(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label>صورة إيصال التحويل (اختياري لكن يُسرّع الموافقة)</Label>
              <label className="mt-1 flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-background p-4 hover:border-primary/50">
                <Upload className="h-4 w-4" />
                <span className="text-sm">{file ? file.name : "اضغط لاختيار صورة"}</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </label>
            </div>

            <Button
              className="w-full"
              size="lg"
              disabled={mut.isPending || uploading || !senderPhone.trim() || amount < 10}
              onClick={() => mut.mutate()}
            >
              {(mut.isPending || uploading) && <Loader2 className="ml-1 h-4 w-4 animate-spin" />}
              إرسال طلب الشحن ({points.toLocaleString("ar-EG")} نقطة)
            </Button>
            <p className="text-[11px] text-muted-foreground text-center">
              تتم مراجعة الطلب من قبل الإدارة عادةً خلال أقل من ساعة، وستصلك رسالة عند الموافقة.
            </p>
          </div>
        </section>


        {/* Withdrawal section: cash-out gift points */}
        <section className="rounded-2xl border-2 border-emerald-500/40 bg-gradient-to-br from-emerald-500/5 to-transparent p-5">
          <div className="flex items-center gap-2">
            <Banknote className="h-5 w-5 text-emerald-600" />
            <h2 className="text-lg font-bold">💸 سحب النقاط كأموال حقيقية</h2>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            حوّل الهدايا التي وصلتك من الأصدقاء إلى رصيد فودافون كاش / إنستاباي.
            <br />
            <strong>10 نقاط = 1 جنيه</strong> · الحد الأدنى للسحب 500 نقطة (50 جنيه)
          </p>

          <div className="mt-4 space-y-3">
            <div>
              <Label htmlFor="wd-points">عدد النقاط للسحب</Label>
              <Input
                id="wd-points"
                type="number"
                inputMode="numeric"
                value={wdPoints === 0 ? "" : wdPoints}
                onChange={(e) => setWdPoints(Number(e.target.value.replace(/[^\d]/g, "") || 0))}
                className="mt-1"
              />
              {wdPoints > 0 && wdPoints < 500 && (
                <p className="mt-1 text-xs text-red-600">الحد الأدنى 500 نقطة (50 ج.م)</p>
              )}
              {wdPoints > (credits.data ?? 0) && (
                <p className="mt-1 text-xs text-red-600">رصيدك الحالي لا يكفي</p>
              )}
              <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-400">
                ستستلم <strong>{Math.floor(wdPoints / 10)} جنيه مصري</strong>
              </p>
            </div>

            <div>
              <Label>طريقة الاستلام</Label>
              <div className="mt-2 flex flex-wrap gap-2">
                {(Object.keys(METHOD_LABEL) as Method[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setWdMethod(m)}
                    className={`rounded-full border px-4 py-2 text-sm transition ${
                      wdMethod === m ? "border-emerald-600 bg-emerald-600 text-white" : "border-border bg-background"
                    }`}
                  >
                    {METHOD_LABEL[m]}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <Label htmlFor="wd-number">
                {wdMethod === "instapay" ? "حساب/رابط إنستاباي" : "رقم المحفظة الذي سيصله المبلغ"} *
              </Label>
              <Input
                id="wd-number"
                dir="ltr"
                placeholder={wdMethod === "instapay" ? "user@instapay" : "01xxxxxxxxx"}
                value={wdNumber}
                onChange={(e) => setWdNumber(e.target.value)}
                className="mt-1"
              />
            </div>

            <Button
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
              size="lg"
              disabled={
                wdMut.isPending ||
                !wdNumber.trim() ||
                wdPoints < 500 ||
                wdPoints > (credits.data ?? 0)
              }
              onClick={() => wdMut.mutate()}
            >
              {wdMut.isPending && <Loader2 className="ml-1 h-4 w-4 animate-spin" />}
              <Banknote className="ml-1 h-4 w-4" />
              طلب سحب {wdPoints.toLocaleString("ar-EG")} نقطة ({Math.floor(wdPoints / 10)} ج.م)
            </Button>
            <p className="text-[11px] text-muted-foreground text-center">
              تُخصم النقاط فور إرسال الطلب كضمان، وتُعاد لك تلقائياً إذا رُفض الطلب.
            </p>
          </div>

          {wdList.data && wdList.data.length > 0 && (
            <div className="mt-4 space-y-2">
              <h3 className="text-sm font-bold">طلبات السحب السابقة</h3>
              {wdList.data.map((r: any) => (
                <div key={r.id} className="flex items-center justify-between rounded-xl border border-border bg-background p-3">
                  <div>
                    <p className="font-semibold">{r.points} نقطة → {r.amount_egp} ج.م</p>
                    <p className="text-xs text-muted-foreground">
                      {METHOD_LABEL[r.method as Method]} · <span dir="ltr">{r.recipient_number}</span>
                    </p>
                    <p className="text-[11px] text-muted-foreground">{new Date(r.created_at).toLocaleString("ar-EG")}</p>
                    {r.admin_note && <p className="mt-1 text-xs text-muted-foreground">📝 {r.admin_note}</p>}
                  </div>
                  <StatusBadge status={r.status} />
                </div>
              ))}
            </div>
          )}
        </section>


        <section className="rounded-2xl border border-border bg-card p-5">
          <h2 className="text-lg font-bold">طلباتي السابقة</h2>
          {mine.isLoading && <div className="py-6 flex justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>}
          {mine.data && mine.data.length === 0 && (
            <p className="mt-3 text-sm text-muted-foreground">لا توجد طلبات بعد.</p>
          )}
          <div className="mt-3 space-y-2">
            {mine.data?.map((r: any) => (
              <div key={r.id} className="flex items-center justify-between rounded-xl border border-border bg-background p-3">
                <div>
                  <p className="font-semibold">{r.amount_egp} ج.م → {r.points} نقطة</p>
                  <p className="text-xs text-muted-foreground">
                    {METHOD_LABEL[r.method as Method]} · {new Date(r.created_at).toLocaleString("ar-EG")}
                  </p>
                  {r.admin_note && <p className="mt-1 text-xs text-muted-foreground">📝 {r.admin_note}</p>}
                </div>
                <StatusBadge status={r.status} />
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "approved") return <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-600"><CheckCircle2 className="h-3 w-3" /> تمت الموافقة</span>;
  if (status === "rejected") return <span className="flex items-center gap-1 rounded-full bg-red-500/10 px-3 py-1 text-xs font-semibold text-red-600"><XCircle className="h-3 w-3" /> مرفوض</span>;
  return <span className="flex items-center gap-1 rounded-full bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-600"><Clock className="h-3 w-3" /> قيد المراجعة</span>;
}
