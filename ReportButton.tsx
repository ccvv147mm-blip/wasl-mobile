import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { Flag, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { submitReport } from "@/lib/reports.functions";
import { friendlyError } from "@/lib/friendly-error";
import { useAuth } from "@/lib/auth-context";

const REASONS = [
  "محتوى مسيء أو إساءة شخصية",
  "خطاب كراهية أو تحريض",
  "محتوى جنسي أو غير لائق",
  "عنف أو محتوى دموي",
  "احتيال أو نصب",
  "رسائل مزعجة أو إعلانات",
  "معلومات مضللة",
  "انتهاك خصوصية أو حقوق",
  "سبب آخر",
];

export type ReportTargetType = "post" | "video" | "comment" | "listing" | "user";

export function ReportButton({
  targetType,
  targetId,
  label,
  className,
}: {
  targetType: ReportTargetType;
  targetId: string;
  label?: string;
  className?: string;
}) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<string | null>(null);
  const [details, setDetails] = useState("");
  const send = useServerFn(submitReport);

  const mutation = useMutation({
    mutationFn: () =>
      send({
        data: {
          target_type: targetType,
          target_id: targetId,
          reason: reason!,
          details: details.trim() || undefined,
        },
      }),
    onSuccess: () => {
      toast.success("تم إرسال البلاغ، سيتم مراجعته من الإدارة");
      setOpen(false);
      setReason(null);
      setDetails("");
    },
    onError: (e) => toast.error(friendlyError(e, "تعذّر إرسال البلاغ")),
  });

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size={label ? "sm" : "icon"} title="إبلاغ عن مخالفة" className={className}>
          <Flag className="h-4 w-4 text-muted-foreground" />
          {label}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>الإبلاغ عن محتوى مخالف</DialogTitle>
          <DialogDescription>
            اختر سبب البلاغ. تُراجع الإدارة كل بلاغ ويُتخذ الإجراء اللازم، وبلاغك سرّي.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-2">
          {REASONS.map((r) => (
            <Button
              key={r}
              type="button"
              size="sm"
              variant={reason === r ? "default" : "outline"}
              className="h-auto whitespace-normal py-1.5 text-xs"
              onClick={() => setReason(r)}
            >
              {r}
            </Button>
          ))}
        </div>

        <Textarea
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          maxLength={1000}
          rows={3}
          placeholder="تفاصيل إضافية (اختياري)"
          className="resize-none"
        />

        <Button
          onClick={() => mutation.mutate()}
          disabled={!reason || mutation.isPending}
          className="w-full"
        >
          {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Flag className="h-4 w-4" />}
          إرسال البلاغ
        </Button>
      </DialogContent>
    </Dialog>
  );
}
