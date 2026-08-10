import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Gift, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { friendlyError } from "@/lib/friendly-error";
import { useCredits } from "@/hooks/use-credits";

const GIFTS = [
  { type: "rose", emoji: "🌹", name: "وردة", value: 5 },
  { type: "heart", emoji: "❤️", name: "قلب", value: 10 },
  { type: "star", emoji: "⭐", name: "نجمة", value: 25 },
  { type: "crown", emoji: "👑", name: "تاج", value: 100 },
  { type: "diamond", emoji: "💎", name: "ألماسة", value: 500 },
  { type: "lion", emoji: "🦁", name: "أسد", value: 5000 },
] as const;

export function GiftButton({ postId, recipientId, count }: { postId: string; recipientId: string; count: number }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState<string | null>(null);
  const [custom, setCustom] = useState("");

  const balance = useCredits(user?.id, open);


  const isMine = user?.id === recipientId;

  const send = async (type: string, value: number) => {
    setSending(type);
    try {
      const { error } = await supabase.rpc("send_gift", {
        _post_id: postId,
        _recipient_id: recipientId,
        _gift_type: type,
        _value: value,
      });
      if (error) throw error;
      toast.success("تم إرسال الهدية 🎁");
      qc.invalidateQueries({ queryKey: ["feed"] });
      qc.invalidateQueries({ queryKey: ["credits"] });
      setOpen(false);
    } catch (e) {
      toast.error(friendlyError(e, "رصيد غير كافٍ أو خطأ"));
    } finally {
      setSending(null);
    }
  };

  if (isMine) {
    return (
      <Button variant="ghost" size="sm" disabled>
        <Gift className="h-4 w-4" />
        {count > 0 && count}
      </Button>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="text-amber-500 hover:text-amber-600">
          <Gift className="h-4 w-4" />
          {count > 0 && count}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>أرسل هدية</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          رصيدك: <span className="font-bold text-foreground">{balance.data ?? "..."}</span> نقطة
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {GIFTS.map((g) => {
            const insufficient = (balance.data ?? 0) < g.value;
            return (
              <button
                key={g.type}
                disabled={!!sending || insufficient}
                onClick={() => send(g.type, g.value)}
                className="flex flex-col items-center gap-1 rounded-2xl border border-border bg-card p-3 transition hover:shadow-elegant disabled:opacity-40"
              >
                <span className="text-3xl">{g.emoji}</span>
                <span className="text-xs font-semibold">{g.name}</span>
                <span className="text-[11px] text-muted-foreground">{g.value} نقطة</span>
                {sending === g.type && <Loader2 className="h-3 w-3 animate-spin" />}
              </button>
            );
          })}
        </div>
        <div className="mt-2 flex items-center gap-2">
          <input
            type="number"
            min={1}
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            placeholder="أي قيمة نقاط تريدها"
            className="flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm"
          />
          <Button
            size="sm"
            disabled={!!sending || !Number(custom) || Number(custom) < 1 || (balance.data ?? 0) < Number(custom)}
            onClick={() => send("custom", Math.floor(Number(custom)))}
          >
            {sending === "custom" ? <Loader2 className="h-4 w-4 animate-spin" /> : "إرسال"}
          </Button>
        </div>
        <a
          href="/wallet"
          className="mt-2 block rounded-xl bg-primary/10 px-4 py-2 text-center text-sm font-semibold text-primary hover:bg-primary/20"
        >
          💳 شحن رصيدي عبر فودافون كاش / إنستاباي
        </a>
        <p className="text-center text-[11px] text-muted-foreground">
          الهدايا تُضاف لرصيد المُهدى إليه فوراً.
        </p>
      </DialogContent>
    </Dialog>
  );
}
