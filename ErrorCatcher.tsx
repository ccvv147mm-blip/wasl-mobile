import { useEffect, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useRouter } from "@tanstack/react-router";
import { toast } from "sonner";
import { reportError } from "@/lib/diagnostics.functions";
import { useAuth } from "@/lib/auth-context";

/**
 * يلتقط أخطاء JS غير الممسوكة + رفض الـ Promise، يحفظها ويطلب تشخيصاً من الذكاء الاصطناعي.
 * يعرض toast بـ "ما الذي حصل + ماذا تفعل".
 */
export function ErrorCatcher() {
  const { user } = useAuth();
  const router = useRouter();
  const report = useServerFn(reportError);
  const lastSig = useRef<{ sig: string; at: number } | null>(null);

  useEffect(() => {
    if (!user) return;

    const send = async (message: string, stack?: string) => {
      const sig = `${message}|${(stack ?? "").slice(0, 80)}`;
      const now = Date.now();
      if (lastSig.current && lastSig.current.sig === sig && now - lastSig.current.at < 15000) return;
      lastSig.current = { sig, at: now };

      try {
        const route =
          router.state.location.pathname + (router.state.location.search ? `?${new URLSearchParams(router.state.location.search as any).toString()}` : "");
        const res = await report({
          data: {
            route,
            message: message.slice(0, 1900),
            stack: stack?.slice(0, 7900),
            user_agent: navigator.userAgent.slice(0, 480),
          },
        });
        if (res?.suggestion) {
          toast.error("حدث خطأ", {
            description: `${res.diagnosis ? res.diagnosis + " — " : ""}${res.suggestion}`,
            duration: 8000,
          });
        }
      } catch {
        /* صامت — لا نريد حلقة أخطاء */
      }
    };

    const onError = (ev: ErrorEvent) => {
      if (!ev.message) return;
      void send(ev.message, ev.error?.stack);
    };
    const onRejection = (ev: PromiseRejectionEvent) => {
      const reason: any = ev.reason;
      const msg = typeof reason === "string" ? reason : reason?.message ?? "Unhandled promise rejection";
      void send(String(msg), reason?.stack);
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, [user, router, report]);

  return null;
}
