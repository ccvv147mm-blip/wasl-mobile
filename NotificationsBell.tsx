import { useEffect, useRef } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { arSA } from "date-fns/locale";
import { Bell, Heart, MessageCircle, Gift, Share2, UserPlus, Mail, CheckCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export type AppNotification = {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  link: string | null;
  read: boolean;
  created_at: string;
};

export function kindIcon(kind: string) {
  switch (kind) {
    case "like":
      return <Heart className="h-4 w-4 text-rose-500" />;
    case "comment":
      return <MessageCircle className="h-4 w-4 text-sky-500" />;
    case "gift":
      return <Gift className="h-4 w-4 text-amber-500" />;
    case "share":
      return <Share2 className="h-4 w-4 text-emerald-500" />;
    case "friend_request":
    case "friend_accept":
      return <UserPlus className="h-4 w-4 text-primary" />;
    case "message":
      return <Mail className="h-4 w-4 text-indigo-500" />;
    default:
      return <Bell className="h-4 w-4 text-muted-foreground" />;
  }
}

/** يطلب إذن إشعارات النظام مرة واحدة ويعرض إشعاراً أصلياً عند وصول تفاعل جديد */
function showSystemNotification(n: AppNotification) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  try {
    const note = new Notification(n.title, {
      body: n.body ?? undefined,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: n.id,
    });
    note.onclick = () => {
      window.focus();
      if (n.link) window.location.assign(n.link);
      note.close();
    };
  } catch {
    /* ignore */
  }
}

export function NotificationsBell() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const asked = useRef(false);

  const list = useQuery({
    enabled: !!user,
    queryKey: ["notifications", user?.id],
    refetchInterval: 60000,
    queryFn: async (): Promise<AppNotification[]> => {
      const { data, error } = await supabase
        .from("notifications")
        .select("id, kind, title, body, link, read, created_at")
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return data ?? [];
    },
  });

  const unread = (list.data ?? []).filter((n) => !n.read).length;

  // طلب إذن إشعارات الجهاز مرة واحدة
  useEffect(() => {
    if (!user || asked.current) return;
    asked.current = true;
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission === "default") {
      const ask = () => {
        void Notification.requestPermission();
        window.removeEventListener("pointerdown", ask);
      };
      window.addEventListener("pointerdown", ask, { once: true });
    }
  }, [user]);

  // بث لحظي
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`notifications-${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        (payload) => {
          const n = payload.new as AppNotification;
          qc.setQueryData<AppNotification[]>(["notifications", user.id], (prev) =>
            prev ? [n, ...prev].slice(0, 30) : [n],
          );
          showSystemNotification(n);
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user, qc]);

  const markAllRead = async () => {
    await supabase.from("notifications").update({ read: true }).eq("read", false);
    void qc.invalidateQueries({ queryKey: ["notifications", user?.id] });
  };

  const open = async (n: AppNotification) => {
    if (!n.read) {
      await supabase.from("notifications").update({ read: true }).eq("id", n.id);
      void qc.invalidateQueries({ queryKey: ["notifications", user?.id] });
    }
    if (n.link) navigate({ to: n.link });
  };

  if (!user) return null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="relative shrink-0" aria-label="الإشعارات">
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute -end-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[22rem] p-0">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <p className="text-sm font-bold">الإشعارات</p>
          {unread > 0 && (
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => void markAllRead()}>
              <CheckCheck className="h-3.5 w-3.5" /> تعليم الكل كمقروء
            </Button>
          )}
        </div>
        <div className="max-h-80 overflow-y-auto">
          {list.isLoading && <p className="p-4 text-center text-sm text-muted-foreground">جارِ التحميل...</p>}
          {list.data && list.data.length === 0 && (
            <p className="p-6 text-center text-sm text-muted-foreground">لا توجد إشعارات بعد.</p>
          )}
          {list.data?.map((n) => (
            <button
              key={n.id}
              onClick={() => void open(n)}
              className={`flex w-full items-start gap-2 px-3 py-2.5 text-start transition hover:bg-muted ${n.read ? "" : "bg-primary/5"}`}
            >
              <span className="mt-0.5 shrink-0">{kindIcon(n.kind)}</span>
              <span className="min-w-0 flex-1">
                <span className={`block truncate text-sm ${n.read ? "" : "font-semibold"}`}>{n.title}</span>
                {n.body && <span className="block truncate text-xs text-muted-foreground">{n.body}</span>}
                <span className="mt-0.5 block text-[11px] text-muted-foreground">
                  {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: arSA })}
                </span>
              </span>
              {!n.read && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary" />}
            </button>
          ))}
        </div>
        <div className="border-t border-border p-2">
          <Button asChild variant="outline" size="sm" className="w-full">
            <Link to="/notifications">عرض كل الإشعارات</Link>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
