import { useEffect, useState } from "react";
import { BellRing, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { enablePush, listenForegroundPush, pushConfigured } from "@/lib/push-client";
import { savePushToken } from "@/lib/push.functions";

/** زر لتفعيل إشعارات الهاتف (تصل حتى والتطبيق مغلق) */
export function PushToggle({ className }: { className?: string }) {
  const { user } = useAuth();
  const save = useServerFn(savePushToken);
  const [busy, setBusy] = useState(false);
  const [on, setOn] = useState(false);

  // تسجيل صامت إذا كان الإذن ممنوحاً مسبقاً + إشعارات أثناء الاستخدام
  useEffect(() => {
    if (!user || typeof window === "undefined" || !("Notification" in window)) return;
    let stop: (() => void) | undefined;
    void (async () => {
      stop = await listenForegroundPush((title, body) => toast(title, { description: body }));
      if (Notification.permission !== "granted" || !pushConfigured()) return;
      const res = await enablePush().catch(() => null);
      if (res?.status === "registered") {
        setOn(true);
        await save({ data: { token: res.token, platform: "web" } }).catch(() => null);
      }
    })();
    return () => stop?.();
  }, [user, save]);

  if (!user) return null;

  const activate = async () => {
    setBusy(true);
    try {
      const res = await enablePush();
      if (res.status === "registered") {
        await save({ data: { token: res.token, platform: "web" } });
        setOn(true);
        toast.success("تم تشغيل إشعارات الهاتف");
        return;
      }
      const messages: Record<string, string> = {
        "open-in-new-tab": "افتح التطبيق في نافذة مستقلة أو من التطبيق المنشور لتشغيل الإشعارات.",
        denied: "الإشعارات محجوبة. اسمح بالإشعارات من إعدادات المتصفح لهذا الموقع.",
        unsupported: "هذا الجهاز أو المتصفح لا يدعم إشعارات الهاتف.",
        "not-configured": "خدمة الإشعارات غير مكتملة الإعداد بعد.",
      };
      toast.error(messages[res.status] ?? "تعذّر تشغيل الإشعارات");
    } catch {
      toast.error("تعذّر تشغيل الإشعارات، حاول مرة أخرى.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button
      size="sm"
      variant={on ? "secondary" : "default"}
      className={className}
      disabled={busy || on}
      onClick={() => void activate()}
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <BellRing className="h-4 w-4" />}
      {on ? "إشعارات الهاتف مفعّلة" : "تشغيل إشعارات الهاتف"}
    </Button>
  );
}
