import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, Eye, Gamepad2, MessageCircle, Radio } from "lucide-react";
import { toast } from "sonner";
import { friendlyError } from "@/lib/friendly-error";
import { publicName } from "@/lib/display-name";

type Row = {
  id: string;
  host_id: string;
  title: string;
  viewers_count: number;
  total_gift_points: number;
  profiles: { username: string; full_name: string | null; avatar_url: string | null } | null;
};

/** قائمة كل المستخدمين الذين يبثون مباشرة الآن + طلب دعوة للعب أو الدردشة */
export function LiveNowList({ userId, currentStreamId }: { userId: string; currentStreamId?: string }) {
  const [busy, setBusy] = useState<string | null>(null);

  const streams = useQuery({
    queryKey: ["live-now-list"],
    refetchInterval: 15000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("live_streams")
        .select("id, host_id, title, viewers_count, total_gift_points, profiles:host_id(username, full_name, avatar_url)")
        .eq("status", "live")
        .order("started_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as unknown as Row[];
    },
  });

  const origin = typeof window !== "undefined" ? window.location.origin : "";

  const ask = async (row: Row, kind: "play" | "chat") => {
    setBusy(`${row.id}-${kind}`);
    try {
      const link = `${origin}/live/${currentStreamId ?? row.id}`;
      const content =
        kind === "play"
          ? `دعوة للعب والتحديات 🎮 — هل تنضم إلينا في البث؟ ${link}`
          : `طلب دردشة في البث المباشر 💬 — ${link}`;
      const { error } = await supabase.from("messages").insert({
        sender_id: userId,
        recipient_id: row.host_id,
        content,
      });
      if (error) throw error;
      toast.success(kind === "play" ? "تم إرسال طلب الدعوة للعب" : "تم إرسال طلب الدردشة");
    } catch (e) {
      toast.error(friendlyError(e, "تعذّر إرسال الطلب"));
    } finally {
      setBusy(null);
    }
  };

  const rows = (streams.data ?? []).filter((s) => s.id !== currentStreamId);

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
      <p className="mb-2 flex items-center gap-1.5 text-xs font-bold text-white">
        <Radio className="h-3.5 w-3.5 text-red-500" /> بثوث مباشرة الآن
      </p>

      {streams.isLoading ? (
        <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin text-white/70" /></div>
      ) : rows.length === 0 ? (
        <p className="py-3 text-center text-xs text-white/60">لا يوجد بث مباشر آخر حالياً.</p>
      ) : (
        <ul className="max-h-64 space-y-2 overflow-y-auto">
          {rows.map((s) => (
            <li key={s.id} className="rounded-xl bg-black/30 p-2">
              <div className="flex items-center gap-2">
                <Avatar className="h-8 w-8 shrink-0 ring-2 ring-red-500">
                  <AvatarImage src={s.profiles?.avatar_url ?? undefined} />
                  <AvatarFallback>{publicName(s.profiles).charAt(0)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-white" data-no-translate>{publicName(s.profiles)}</p>
                  <p className="truncate text-[11px] text-white/60">{s.title || "بث مباشر"}</p>
                </div>
                <span className="flex shrink-0 items-center gap-1 text-[11px] text-white/70">
                  <Eye className="h-3 w-3" /> {s.viewers_count}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Button
                  size="sm"
                  variant="secondary"
                  className="h-7 gap-1 text-[11px]"
                  disabled={busy === `${s.id}-play`}
                  onClick={() => void ask(s, "play")}
                >
                  {busy === `${s.id}-play` ? <Loader2 className="h-3 w-3 animate-spin" /> : <Gamepad2 className="h-3 w-3" />} دعوة للعب
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  className="h-7 gap-1 text-[11px]"
                  disabled={busy === `${s.id}-chat`}
                  onClick={() => void ask(s, "chat")}
                >
                  {busy === `${s.id}-chat` ? <Loader2 className="h-3 w-3 animate-spin" /> : <MessageCircle className="h-3 w-3" />} طلب دردشة
                </Button>
                <Button asChild size="sm" className="h-7 text-[11px]">
                  <Link to="/live/$streamId" params={{ streamId: s.id }}>دخول البث</Link>
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
