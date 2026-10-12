import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listFriends, sendFriendRequest } from "@/lib/friends.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, UserPlus, Send } from "lucide-react";
import { toast } from "sonner";
import { friendlyError } from "@/lib/friendly-error";
import { publicName } from "@/lib/display-name";

type Viewer = {
  id: string;
  profiles: { username: string; full_name: string | null; avatar_url: string | null } | null;
};

/** دعوة الأصدقاء والمشاركين للعب التحديات داخل البث */
export function LiveInvite({
  streamId,
  userId,
  viewers,
}: {
  streamId: string;
  userId: string;
  viewers: Viewer[];
}) {
  const [tab, setTab] = useState<"friends" | "viewers">("friends");
  const [busy, setBusy] = useState<string | null>(null);
  const fetchFriends = useServerFn(listFriends);
  const addFriend = useServerFn(sendFriendRequest);

  const friends = useQuery({
    queryKey: ["live-invite-friends"],
    queryFn: () => fetchFriends(),
  });

  const link = `${typeof window !== "undefined" ? window.location.origin : ""}/live/${streamId}`;

  const invite = async (id: string) => {
    setBusy(id);
    try {
      const { error } = await supabase.from("messages").insert({
        sender_id: userId,
        recipient_id: id,
        content: `انضم إليّ في البث المباشر والتحديات 🎮 ${link}`,
      });
      if (error) throw error;
      toast.success("تم إرسال الدعوة");
    } catch (e) {
      toast.error(friendlyError(e, "تعذّر إرسال الدعوة"));
    } finally {
      setBusy(null);
    }
  };

  const request = async (id: string) => {
    setBusy(id);
    try {
      await addFriend({ data: { addresseeId: id } });
      toast.success("تم إرسال طلب الصداقة");
    } catch (e) {
      toast.error(friendlyError(e, "تعذّر إرسال الطلب"));
    } finally {
      setBusy(null);
    }
  };

  const others = viewers.filter((v) => v.id !== userId);

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
      <div className="mb-2 flex gap-2">
        <button
          onClick={() => setTab("friends")}
          className={`rounded-full px-3 py-1 text-xs font-semibold ${tab === "friends" ? "bg-primary text-primary-foreground" : "bg-white/10 text-white"}`}
        >
          دعوة أصدقاء
        </button>
        <button
          onClick={() => setTab("viewers")}
          className={`rounded-full px-3 py-1 text-xs font-semibold ${tab === "viewers" ? "bg-primary text-primary-foreground" : "bg-white/10 text-white"}`}
        >
          المشاركون في البث
        </button>
      </div>

      {tab === "friends" ? (
        friends.isLoading ? (
          <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin text-white/70" /></div>
        ) : (friends.data?.friends ?? []).length === 0 ? (
          <p className="py-3 text-center text-xs text-white/60">لا أصدقاء بعد — أضف أصدقاء لتدعوهم للتحديات.</p>
        ) : (
          <ul className="max-h-52 space-y-1 overflow-y-auto">
            {(friends.data!.friends as any[]).map((f: any) => (
              <li key={f.id} className="flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-2">
                  <Avatar className="h-7 w-7 shrink-0">
                    <AvatarImage src={f.avatar_url ?? undefined} />
                    <AvatarFallback>{publicName(f).charAt(0)}</AvatarFallback>
                  </Avatar>
                  <span className="truncate text-xs font-semibold text-white" data-no-translate>{publicName(f)}</span>
                </span>
                <Button size="sm" variant="secondary" className="h-7 shrink-0 gap-1 text-[11px]" disabled={busy === f.id} onClick={() => void invite(f.id)}>
                  {busy === f.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />} دعوة
                </Button>
              </li>
            ))}
          </ul>
        )
      ) : others.length === 0 ? (
        <p className="py-3 text-center text-xs text-white/60">لا مشاركين في الدردشة بعد.</p>
      ) : (
        <ul className="max-h-52 space-y-1 overflow-y-auto">
          {others.map((v) => (
            <li key={v.id} className="flex items-center justify-between gap-2">
              <span className="flex min-w-0 items-center gap-2">
                <Avatar className="h-7 w-7 shrink-0">
                  <AvatarImage src={v.profiles?.avatar_url ?? undefined} />
                  <AvatarFallback>{publicName(v.profiles).charAt(0)}</AvatarFallback>
                </Avatar>
                <span className="truncate text-xs font-semibold text-white" data-no-translate>{publicName(v.profiles)}</span>
              </span>
              <Button size="sm" variant="secondary" className="h-7 shrink-0 gap-1 text-[11px]" disabled={busy === v.id} onClick={() => void request(v.id)}>
                {busy === v.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <UserPlus className="h-3 w-3" />} صداقة
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
