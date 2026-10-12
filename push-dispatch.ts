import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/firebase_messaging";

const payloadSchema = z.object({
  notification_id: z.string().optional(),
  user_id: z.string().uuid(),
  title: z.string().min(1).max(200),
  body: z.string().max(500).optional().default(""),
  link: z.string().max(300).optional().default("/notifications"),
});

export const Route = createFileRoute("/api/public/push-dispatch")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["PUSH_DISPATCH_SECRET"];
        if (!secret || request.headers.get("x-push-secret") !== secret) {
          return new Response("Unauthorized", { status: 401 });
        }

        const parsed = payloadSchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return new Response("Bad request", { status: 400 });
        const { user_id, title, body, link } = parsed.data;

        const lovableKey = process.env["LOVABLE_API_KEY"];
        const connectionKey = process.env["FIREBASE_MESSAGING_API_KEY"];
        if (!lovableKey || !connectionKey) {
          return new Response("Push not configured", { status: 503 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: tokens, error } = await supabaseAdmin
          .from("push_tokens")
          .select("token")
          .eq("user_id", user_id);
        if (error) {
          console.error("push token lookup failed", error.message);
          return new Response("token lookup failed", { status: 500 });
        }
        if (!tokens?.length) return new Response("no devices", { status: 200 });

        const headers = {
          Authorization: `Bearer ${lovableKey}`,
          "X-Connection-Api-Key": connectionKey,
          "Content-Type": "application/json",
        };

        const stale: string[] = [];
        await Promise.all(
          tokens.map(async ({ token }) => {
            const res = await fetch(`${GATEWAY_URL}/v1/projects/_/messages:send`, {
              method: "POST",
              headers,
              body: JSON.stringify({
                message: {
                  token,
                  notification: { title, body: body || undefined },
                  data: { link },
                  webpush: { fcmOptions: { link } },
                },
              }),
            });
            if (!res.ok) {
              const text = await res.text();
              console.error(`FCM send failed [${res.status}]: ${text}`);
              if (res.status === 404 || res.status === 400) stale.push(token);
            }
          }),
        );

        if (stale.length) {
          await supabaseAdmin.from("push_tokens").delete().in("token", stale);
        }

        return new Response("ok");
      },
    },
  },
});
