import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

/**
 * بثّ فوري للنص المقروء (SSE) حتى يبدأ الصوت خلال أقل من ثانية.
 * يتطلب توكن مستخدم مسجّل.
 */
export const Route = createFileRoute("/api/tts")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const SUPABASE_URL = process.env.SUPABASE_URL;
        const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
        const lovableKey = process.env.LOVABLE_API_KEY;
        if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY || !lovableKey) {
          return new Response("Service unavailable", { status: 503 });
        }

        const authHeader = request.headers.get("authorization") ?? "";
        if (!authHeader.startsWith("Bearer ")) {
          return new Response("Unauthorized", { status: 401 });
        }
        const token = authHeader.slice("Bearer ".length);
        const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const { data: claims, error } = await supabase.auth.getClaims(token);
        if (error || !claims?.claims?.sub) {
          return new Response("Unauthorized", { status: 401 });
        }

        let text = "";
        try {
          const body = (await request.json()) as { text?: unknown };
          text = typeof body.text === "string" ? body.text.trim().slice(0, 1500) : "";
        } catch {
          text = "";
        }
        if (!text) return new Response("Bad request", { status: 400 });

        try {
          const res = await fetch("https://ai.gateway.lovable.dev/v1/audio/speech", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${lovableKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "openai/gpt-4o-mini-tts",
              input: text,
              voice: "shimmer",
              instructions:
                "اقرأ النص العربي بصوت أنثوي كلاسيكي واضح ومرتفع، بنبرة دافئة وإيقاع طبيعي.",
              speed: 1.05,
              stream_format: "sse",
              response_format: "pcm",
            }),
            signal: request.signal,
          });
          if (!res.ok || !res.body) {
            const detail = await res.text().catch(() => "");
            console.error("TTS stream error:", res.status, detail);
            return new Response("TTS failed", { status: 502 });
          }
          return new Response(res.body, {
            headers: {
              "Content-Type": "text/event-stream",
              "Cache-Control": "no-cache",
            },
          });
        } catch (err) {
          if (request.signal.aborted) return new Response(null, { status: 499 });
          throw err;
        }
      },
    },
  },
});
