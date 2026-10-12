import { createFileRoute, Navigate, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Flag, CheckCircle2, XCircle, Trash2, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { arSA } from "date-fns/locale";
import { friendlyError } from "@/lib/friendly-error";
import { adminListReports, adminReviewReport } from "@/lib/reports.functions";
import { isAdmin } from "@/lib/recharge.functions";
import { adminDeleteContent } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/reports")({
  component: AdminReportsPage,
  head: () => ({
    meta: [
      { title: "بلاغات المحتوى — لوحة المسؤول" },
      { name: "description", content: "مراجعة بلاغات المستخدمين على المنشورات والمحتوى المخالف في وَصْل." },
      { name: "robots", content: "noindex" },
    ],
  }),
});

const TARGET_LABEL: Record<string, string> = {
  post: "منشور",
  video: "فيديو",
  comment: "تعليق",
  listing: "سلعة",
  user: "مستخدم",
};

function AdminReportsPage() {
  const { user, loading } = useAuth();
  const qc = useQueryClient();
  const checkAdmin = useServerFn(isAdmin);
  const listFn = useServerFn(adminListReports);
  const reviewFn = useServerFn(adminReviewReport);
  const delFn = useServerFn(adminDeleteContent);
  const [filter, setFilter] = useState<"pending" | "all">("pending");
  const [notes, setNotes] = useState<Record<string, string>>({});

  const admin = useQuery({
    enabled: !!user,
    queryKey: ["is-admin", user?.id],
    queryFn: () => checkAdmin(),
  });

  const reports = useQuery({
    enabled: !!user && !!admin.data?.admin,
    queryKey: ["admin-reports", filter],
    queryFn: () => listFn({ data: filter === "pending" ? { status: "pending" } : {} }),
  });

  const review = useMutation({
    mutationFn: (v: { id: string; status: "reviewed" | "dismissed" | "actioned" }) =>
      reviewFn({ data: { ...v, note: notes[v.id]?.trim() || undefined } }),
    onSuccess: () => {
      toast.success("تم تحديث حالة البلاغ");
      qc.invalidateQueries({ queryKey: ["admin-reports"] });
    },
    onError: (e) => toast.error(friendlyError(e, "تعذّر تحديث البلاغ")),
  });

  const removeContent = useMutation({
    mutationFn: (v: { id: string; kind: string; target_id: string }) =>
      delFn({ data: { kind: v.kind as any, id: v.target_id } }),
    onSuccess: async (_d, v) => {
      await reviewFn({ data: { id: v.id, status: "actioned", note: "تم حذف المحتوى" } });
      toast.success("تم حذف المحتوى وإغلاق البلاغ");
      qc.invalidateQueries({ queryKey: ["admin-reports"] });
    },
    onError: (e) => toast.error(friendlyError(e, "تعذّر حذف المحتوى")),
  });

  if (loading || (user && admin.isLoading))
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  if (!user) return <Navigate to="/login" />;
  if (!admin.data?.admin) return <Navigate to="/" />;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-3xl px-4 py-6">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl gradient-primary">
              <Flag className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold">بلاغات المحتوى</h1>
              <p className="text-sm text-muted-foreground">مراجعة ما أبلغ عنه المستخدمون</p>
            </div>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link to="/admin">
              <ArrowRight className="ml-1 h-4 w-4" /> اللوحة
            </Link>
          </Button>
        </div>

        <div className="mb-4 flex gap-2">
          <Button size="sm" variant={filter === "pending" ? "default" : "outline"} onClick={() => setFilter("pending")}>
            المعلّقة
          </Button>
          <Button size="sm" variant={filter === "all" ? "default" : "outline"} onClick={() => setFilter("all")}>
            كل البلاغات
          </Button>
        </div>

        {reports.isLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : !reports.data?.length ? (
          <p className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
            لا توجد بلاغات حالياً.
          </p>
        ) : (
          <div className="space-y-3">
            {reports.data.map((r: any) => (
              <div key={r.id} className="rounded-xl border border-border bg-card p-4">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded-full bg-destructive/10 px-2 py-0.5 font-bold text-destructive">
                    {TARGET_LABEL[r.target_type] ?? r.target_type}
                  </span>
                  <span className="rounded-full bg-muted px-2 py-0.5">{r.status}</span>
                  <span className="text-muted-foreground">
                    {formatDistanceToNow(new Date(r.created_at), { addSuffix: true, locale: arSA })}
                  </span>
                </div>
                <p className="mt-2 font-semibold">{r.reason}</p>
                {r.details && <p className="mt-1 text-sm text-muted-foreground">{r.details}</p>}
                <p className="mt-1 text-[11px] text-muted-foreground">
                  المُبلِّغ: {r.reporter_username ?? "—"} · المعرّف: {r.target_id}
                </p>
                {r.admin_note && <p className="mt-1 text-xs text-primary">ملاحظة: {r.admin_note}</p>}

                {r.status === "pending" && (
                  <div className="mt-3 space-y-2">
                    <Textarea
                      rows={2}
                      maxLength={500}
                      placeholder="ملاحظة الإدارة (اختياري)"
                      className="resize-none"
                      value={notes[r.id] ?? ""}
                      onChange={(e) => setNotes((s) => ({ ...s, [r.id]: e.target.value }))}
                    />
                    <div className="flex flex-wrap gap-2">
                      {["post", "video", "comment", "listing"].includes(r.target_type) && (
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={removeContent.isPending}
                          onClick={() =>
                            removeContent.mutate({ id: r.id, kind: r.target_type, target_id: r.target_id })
                          }
                        >
                          <Trash2 className="h-4 w-4" /> حذف المحتوى
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={review.isPending}
                        onClick={() => review.mutate({ id: r.id, status: "reviewed" })}
                      >
                        <CheckCircle2 className="h-4 w-4" /> تمت المراجعة
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={review.isPending}
                        onClick={() => review.mutate({ id: r.id, status: "dismissed" })}
                      >
                        <XCircle className="h-4 w-4" /> رفض البلاغ
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
