import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { UserPlus, UserCheck, Clock, Check, X } from "lucide-react";
import { toast } from "sonner";
import {
  getFriendshipStatus,
  sendFriendRequest,
  respondFriendRequest,
  removeFriend,
} from "@/lib/friends.functions";
import { friendlyError } from "@/lib/friendly-error";

export function FriendButton({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const statusFn = useServerFn(getFriendshipStatus);
  const sendFn = useServerFn(sendFriendRequest);
  const respondFn = useServerFn(respondFriendRequest);
  const removeFn = useServerFn(removeFriend);

  const q = useQuery({
    queryKey: ["friendship", userId],
    queryFn: () => statusFn({ data: { otherId: userId } }),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["friendship", userId] });
    qc.invalidateQueries({ queryKey: ["friends"] });
    qc.invalidateQueries({ queryKey: ["friend-requests"] });
    qc.invalidateQueries({ queryKey: ["friend-suggestions"] });
  };

  const wrap = async (p: Promise<unknown>, ok: string) => {
    try { await p; toast.success(ok); invalidate(); }
    catch (e) { toast.error(friendlyError(e, "تعذّر التنفيذ")); }
  };

  if (q.isLoading || !q.data) return <Button size="sm" variant="outline" disabled>...</Button>;

  switch (q.data.status) {
    case "none":
      return (
        <Button size="sm" onClick={() => wrap(sendFn({ data: { addresseeId: userId } }), "تم إرسال الطلب")}>
          <UserPlus className="h-4 w-4" /> إضافة صديق
        </Button>
      );
    case "pending_out":
      return (
        <Button size="sm" variant="outline" onClick={() => wrap(removeFn({ data: { otherId: userId } }), "تم الإلغاء")}>
          <Clock className="h-4 w-4" /> طلب مرسل
        </Button>
      );
    case "pending_in":
      return (
        <div className="flex gap-1">
          <Button size="sm" onClick={() => wrap(respondFn({ data: { requesterId: userId, accept: true } }), "تم القبول")}>
            <Check className="h-4 w-4" /> قبول
          </Button>
          <Button size="sm" variant="outline" onClick={() => wrap(respondFn({ data: { requesterId: userId, accept: false } }), "تم الرفض")}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      );
    case "accepted":
      return (
        <Button size="sm" variant="outline" onClick={() => wrap(removeFn({ data: { otherId: userId } }), "تمت الإزالة")}>
          <UserCheck className="h-4 w-4" /> أصدقاء
        </Button>
      );
  }
}
