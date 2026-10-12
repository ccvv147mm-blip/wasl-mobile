import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { MUSIC_PRESETS } from "./music-presets";

/**
 * مكتبة الأغاني الجاهزة: الأغاني مخزّنة في مساحة التطبيق ومتاحة مجاناً
 * لجميع المستخدمين فوراً بدون أي خدمة خارجية.
 */
export const ensureMusicTrack = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ key: z.string().min(1).max(60) }).parse(input))
  .handler(async ({ data }) => {
    const preset = MUSIC_PRESETS.find((p) => p.key === data.key);
    if (!preset) throw new Error("أغنية غير معروفة");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: existing } = await supabaseAdmin
      .from("music_tracks")
      .select("key, title, url")
      .eq("key", preset.key)
      .maybeSingle();

    if (existing?.url) return { key: existing.key, title: existing.title, path: existing.url };

    return { error: "هذه الأغنية غير متاحة حالياً، اختر أغنية أخرى أو ارفع أغنيتك" as const };
  });
