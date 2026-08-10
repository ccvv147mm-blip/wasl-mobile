import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Header } from "@/components/Header";
import { Loader2, ShieldCheck, AlertTriangle, Sparkles } from "lucide-react";

export const Route = createFileRoute("/diagnostics")({ component: DiagnosticsPage });

type Row = {
  id: string;
  route: string | null;
  message: string;
  ai_diagnosis: string | null;
  ai_suggestion: string | null;
  status: string;
  created_at: string;
};

function DiagnosticsPage() {
  const { user, loading } = useAuth();

  const q = useQuery({
    enabled: !!user,
    queryKey: ["error-reports", user?.id],
    queryFn: async (): Promise<Row[]> => {
      const { data, error } = await supabase
        .from("error_reports")
        .select("id, route, message, ai_diagnosis, ai_suggestion, status, created_at")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  if (loading) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="animate-spin" /></div>;
  if (!user) return <Navigate to="/login" />;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-2xl px-4 py-6">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl gradient-primary text-primary-foreground shadow-elegant">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">الإصلاح الذاتي</h1>
            <p className="text-sm text-muted-foreground">يلتقط الأخطاء ويقترح حلولاً بالذكاء الاصطناعي.</p>
          </div>
        </div>

        {q.isLoading && <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>}

        {q.data && q.data.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border p-10 text-center">
            <ShieldCheck className="mx-auto h-10 w-10 text-emerald-500" />
            <p className="mt-3 font-semibold">لا توجد أخطاء — كل شيء يعمل بسلاسة.</p>
          </div>
        )}

        <div className="space-y-3">
          {q.data?.map((r) => (
            <div key={r.id} className="rounded-2xl border border-border bg-card p-4 shadow-card">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                <div className="flex-1 min-w-0">
                  <p className="break-words text-sm font-medium">{r.message}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {r.route ?? "—"} · {new Date(r.created_at).toLocaleString("ar")}
                  </p>
                </div>
              </div>

              {(r.ai_diagnosis || r.ai_suggestion) && (
                <div className="mt-3 rounded-xl border border-primary/20 bg-primary/5 p-3">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-primary">
                    <Sparkles className="h-3.5 w-3.5" />
                    تشخيص الذكاء الاصطناعي
                  </div>
                  {r.ai_diagnosis && <p className="mt-1.5 text-sm">{r.ai_diagnosis}</p>}
                  {r.ai_suggestion && (
                    <p className="mt-1.5 text-sm text-muted-foreground">
                      <span className="font-semibold text-foreground">الحل المقترح: </span>
                      {r.ai_suggestion}
                    </p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
