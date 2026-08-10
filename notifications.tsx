import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { arSA } from "date-fns/locale";
import { Bell, CheckCheck, Loader2, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { kindIcon, type AppNotification } from "@/components/NotificationsBell";

export const Route = createFileRoute("/notifications")({
  component: NotificationsPage,
  head: () => ({
    meta: [
      { title: "الإشعارات — وَصْل" },
      {
        name: "description",
        content: "كل التفاعلات على صفحتك في وَصْل: الإعجابات، التعليقات، المشاركات، الهدايا، طلبات الصداقة والرسائل في مكان واحد.",
      },
      { property: "og:title", content: "الإشعارات — وَصْل" },
      {
        property: "og:description",
        content: "تابع من تفاعل مع منشوراتك وفيديوهاتك على وَصْل لحظة بلحظة.",
      },
      { name: "robots", content: "noindex, follow" },
    ],
  }),
});

function NotificationsPage() {
  const { user, loading } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const list = useQuery({
    enabled: !!user,
    queryKey: ["notifications-all", user?.id],
    queryFn: async (): Promise<AppNotification[]> => {
      const { data, error } = await supabase
        .from("notifications")
        .select("id, kind, title, body, link, read, created_at")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["notifications-all", user?.id] });
    void qc.invalidateQueries({ queryKey: ["notifications", user?.id] });
  };

  if (loading) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="animate-spin" /></div>;
  if (!user) return <Navigate to="/login" />;

  const unread = (list.data ?? []).filter((n) => !n.read).length;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-2xl px-4 py-6">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl gradient-primary shadow-elegant">
              <Bell className="h-4 w-4 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-bold">الإشعارات</h1>
              <p className="text-xs text-muted-foreground">
                {unread > 0 ? `${unread} إشعار غير مقروء` : "كل الإشعارات مقروءة"}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            {unread > 0 && (
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  await supabase.from("notifications").update({ read: true }).eq("read", false);
                  refresh();
                }}
              >
                <CheckCheck className="h-4 w-4" /> تعليم الكل
              </Button>
            )}
            {(list.data?.length ?? 0) > 0 && (
              <Button
                size="sm"
                variant="ghost"
                onClick={async () => {
                  await supabase.from("notifications").delete().eq("user_id", user.id);
                  refresh();
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {list.isLoading && <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>}
        {list.data && list.data.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border p-10 text-center">
            <p className="text-muted-foreground">لا توجد إشعارات بعد. ستظهر هنا كل تفاعلات الآخرين مع صفحتك.</p>
          </div>
        )}

        <div className="space-y-2">
          {list.data?.map((n) => (
            <button
              key={n.id}
              onClick={async () => {
                if (!n.read) {
                  await supabase.from("notifications").update({ read: true }).eq("id", n.id);
                  refresh();
                }
                if (n.link) navigate({ to: n.link });
              }}
              className={`flex w-full items-start gap-3 rounded-2xl border border-border p-3 text-start transition hover:shadow-card ${n.read ? "bg-card" : "bg-primary/5"}`}
            >
              <span className="mt-0.5 shrink-0">{kindIcon(n.kind)}</span>
              <span className="min-w-0 flex-1">
                <span className={`block text-sm ${n.read ? "" : "font-semibold"}`}>{n.title}</span>
                {n.body && <span className="block truncate text-xs text-muted-foreground">{n.body}</span>}
                <span className="mt-1 block text-[11px] text-muted-foreground">
                  {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: arSA })}
                </span>
              </span>
              {!n.read && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary" />}
            </button>
          ))}
        </div>
      </main>
    </div>
  );
}
