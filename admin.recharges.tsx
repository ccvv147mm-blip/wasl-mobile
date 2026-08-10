import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, CheckCircle2, XCircle, ShieldCheck, ExternalLink, Banknote } from "lucide-react";
import { toast } from "sonner";
import { friendlyError } from "@/lib/friendly-error";
import {
  isAdmin,
  listPendingRecharges,
  approveRecharge,
  rejectRecharge,
} from "@/lib/recharge.functions";
import {
  listPendingWithdrawals,
  approveWithdrawal,
  rejectWithdrawal,
} from "@/lib/withdraw.functions";

export const Route = createFileRoute("/admin/recharges")({
  component: AdminRechargesPage,
  head: () => ({ meta: [{ title: "طلبات الشحن — لوحة المسؤول" }] }),
});

function AdminRechargesPage() {
  const { user, loading } = useAuth();
  const qc = useQueryClient();
  const checkAdmin = useServerFn(isAdmin);
  const listFn = useServerFn(listPendingRecharges);
  const approveFn = useServerFn(approveRecharge);
  const rejectFn = useServerFn(rejectRecharge);
  const listWdFn = useServerFn(listPendingWithdrawals);
  const approveWdFn = useServerFn(approveWithdrawal);
  const rejectWdFn = useServerFn(rejectWithdrawal);

  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const admin = useQuery({
    enabled: !!user,
    queryKey: ["is-admin", user?.id],
    queryFn: () => checkAdmin(),
  });

  const items = useQuery({
    enabled: !!user && !!admin.data?.admin,
    queryKey: ["pending-recharges"],
    queryFn: () => listFn(),
  });

  const withdrawals = useQuery({
    enabled: !!user && !!admin.data?.admin,
    queryKey: ["pending-withdrawals"],
    queryFn: () => listWdFn(),
  });

  const approve = useMutation({
    mutationFn: (id: string) => approveFn({ data: { id, note: notes[id] || undefined } }),
    onSuccess: () => { toast.success("تمت الموافقة"); qc.invalidateQueries({ queryKey: ["pending-recharges"] }); },
    onError: (e) => toast.error(friendlyError(e, "تعذّر التنفيذ")),
    onSettled: () => setBusy(null),
  });

  const reject = useMutation({
    mutationFn: (id: string) => rejectFn({ data: { id, note: notes[id] || "لم يتم التحقق من التحويل" } }),
    onSuccess: () => { toast.success("تم الرفض"); qc.invalidateQueries({ queryKey: ["pending-recharges"] }); },
    onError: (e) => toast.error(friendlyError(e, "تعذّر التنفيذ")),
    onSettled: () => setBusy(null),
  });

  const approveWd = useMutation({
    mutationFn: (id: string) => approveWdFn({ data: { id, note: notes[id] || undefined } }),
    onSuccess: () => { toast.success("تمت الموافقة على السحب"); qc.invalidateQueries({ queryKey: ["pending-withdrawals"] }); },
    onError: (e) => toast.error(friendlyError(e, "تعذّر التنفيذ")),
    onSettled: () => setBusy(null),
  });

  const rejectWd = useMutation({
    mutationFn: (id: string) => rejectWdFn({ data: { id, note: notes[id] || "تم رفض الطلب" } }),
    onSuccess: () => { toast.success("تم الرفض وإعادة النقاط"); qc.invalidateQueries({ queryKey: ["pending-withdrawals"] }); qc.invalidateQueries({ queryKey: ["credits"] }); },
    onError: (e) => toast.error(friendlyError(e, "تعذّر التنفيذ")),
    onSettled: () => setBusy(null),
  });

  if (loading) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (!user) return <Navigate to="/login" />;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-4xl px-4 py-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl gradient-primary shadow-elegant">
            <ShieldCheck className="h-6 w-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">طلبات شحن المحفظة</h1>
            <p className="text-sm text-muted-foreground">مراجعة وموافقة يدوية</p>
          </div>
        </div>

        {admin.isLoading && <div className="py-8 flex justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>}
        {admin.data && !admin.data.admin && <Navigate to="/" />}

        {items.isLoading && <div className="py-8 flex justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>}
        {items.data && items.data.length === 0 && (
          <div className="rounded-xl border border-border bg-card p-6 text-center text-muted-foreground">
            لا توجد طلبات حالياً.
          </div>
        )}

        <div className="space-y-3">
          {items.data?.map((r: any) => (
            <div key={r.id} className="rounded-2xl border border-border bg-card p-4 shadow-card">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-bold">
                    {r.profile?.full_name || r.profile?.username || r.user_id.slice(0, 8)}
                    <span className="text-muted-foreground"> (@{r.profile?.username || "?"})</span>
                  </p>
                  <p className="mt-1 text-sm">
                    <strong>{r.amount_egp} ج.م</strong> → {r.points} نقطة · {r.method}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    من رقم: <span dir="ltr">{r.sender_phone}</span>
                    {r.transaction_ref && <> · مرجع: <span dir="ltr">{r.transaction_ref}</span></>}
                  </p>
                  <p className="text-[11px] text-muted-foreground">{new Date(r.created_at).toLocaleString("ar-EG")}</p>
                </div>
                <StatusBadge status={r.status} />
              </div>

              {r.proof_url && (
                <a href={r.proof_url} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-sm text-primary hover:underline">
                  <ExternalLink className="h-3 w-3" /> عرض إيصال التحويل
                </a>
              )}

              {r.status === "pending" && (
                <div className="mt-3 space-y-2">
                  <Textarea
                    placeholder="ملاحظة اختيارية (سبب الرفض إن وُجد)"
                    value={notes[r.id] || ""}
                    onChange={(e) => setNotes((n) => ({ ...n, [r.id]: e.target.value }))}
                    className="min-h-[60px]"
                  />
                  <div className="flex gap-2">
                    <Button
                      className="flex-1"
                      disabled={busy === r.id}
                      onClick={() => { setBusy(r.id); approve.mutate(r.id); }}
                    >
                      <CheckCircle2 className="ml-1 h-4 w-4" /> موافقة وشحن الرصيد
                    </Button>
                    <Button
                      variant="destructive"
                      className="flex-1"
                      disabled={busy === r.id}
                      onClick={() => { setBusy(r.id); reject.mutate(r.id); }}
                    >
                      <XCircle className="ml-1 h-4 w-4" /> رفض
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Withdrawal requests */}
        <div className="mt-8 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-600 shadow-elegant">
            <Banknote className="h-6 w-6 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">طلبات سحب النقاط</h2>
            <p className="text-sm text-muted-foreground">تحويل الأرصدة إلى محافظ حقيقية</p>
          </div>
        </div>

        {withdrawals.isLoading && <div className="py-8 flex justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>}
        {withdrawals.data && withdrawals.data.length === 0 && (
          <div className="rounded-xl border border-border bg-card p-6 text-center text-muted-foreground">
            لا توجد طلبات سحب حالياً.
          </div>
        )}
        <div className="space-y-3">
          {withdrawals.data?.map((r: any) => (
            <div key={r.id} className="rounded-2xl border border-emerald-500/30 bg-card p-4 shadow-card">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-bold">
                    {r.profile?.full_name || r.profile?.username || r.user_id.slice(0, 8)}
                    <span className="text-muted-foreground"> (@{r.profile?.username || "?"})</span>
                  </p>
                  <p className="mt-1 text-sm">
                    <strong className="text-emerald-600">حوّل {r.amount_egp} ج.م</strong> · خصم {r.points} نقطة · {r.method}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    إلى: <span dir="ltr" className="font-mono font-bold">{r.recipient_number}</span>
                  </p>
                  <p className="text-[11px] text-muted-foreground">{new Date(r.created_at).toLocaleString("ar-EG")}</p>
                </div>
                <StatusBadge status={r.status} />
              </div>

              {r.status === "pending" && (
                <div className="mt-3 space-y-2">
                  <Textarea
                    placeholder="ملاحظة (مثل رقم عملية التحويل بعد إرساله)"
                    value={notes[r.id] || ""}
                    onChange={(e) => setNotes((n) => ({ ...n, [r.id]: e.target.value }))}
                    className="min-h-[60px]"
                  />
                  <div className="flex gap-2">
                    <Button
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                      disabled={busy === r.id}
                      onClick={() => { setBusy(r.id); approveWd.mutate(r.id); }}
                    >
                      <CheckCircle2 className="ml-1 h-4 w-4" /> تم التحويل — تأكيد
                    </Button>
                    <Button
                      variant="destructive"
                      className="flex-1"
                      disabled={busy === r.id}
                      onClick={() => { setBusy(r.id); rejectWd.mutate(r.id); }}
                    >
                      <XCircle className="ml-1 h-4 w-4" /> رفض وإعادة النقاط
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}


function StatusBadge({ status }: { status: string }) {
  if (status === "approved") return <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-600">تمت الموافقة</span>;
  if (status === "rejected") return <span className="rounded-full bg-red-500/10 px-3 py-1 text-xs font-semibold text-red-600">مرفوض</span>;
  return <span className="rounded-full bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-600">قيد المراجعة</span>;
}
