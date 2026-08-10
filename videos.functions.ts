import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Platform = "youtube" | "tiktok" | "instagram" | "x";

function parseVideoUrl(url: string): { platform: Platform; videoId: string } | null {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    if (host === "youtube.com" || host === "m.youtube.com") {
      const v = u.searchParams.get("v");
      if (v) return { platform: "youtube", videoId: v };
      const m = u.pathname.match(/\/shorts\/([\w-]+)/);
      if (m) return { platform: "youtube", videoId: m[1] };
    }
    if (host === "youtu.be") {
      const id = u.pathname.slice(1);
      if (id) return { platform: "youtube", videoId: id };
    }
    if (host.endsWith("tiktok.com")) {
      const m = u.pathname.match(/\/video\/(\d+)/);
      if (m) return { platform: "tiktok", videoId: m[1] };
      const seg = u.pathname.split("/").filter(Boolean).pop();
      if (seg) return { platform: "tiktok", videoId: seg };
    }
    if (host === "instagram.com" || host.endsWith(".instagram.com")) {
      const m = u.pathname.match(/\/(reel|p|tv)\/([\w-]+)/);
      if (m) return { platform: "instagram", videoId: m[2] };
    }
    if (host === "x.com" || host === "twitter.com" || host.endsWith(".x.com") || host.endsWith(".twitter.com")) {
      const m = u.pathname.match(/\/status\/(\d+)/);
      if (m) return { platform: "x", videoId: m[1] };
    }
  } catch {
    return null;
  }
  return null;
}

export const addVideo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ url: z.string().url().max(500), title: z.string().min(1).max(200) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const parsed = parseVideoUrl(data.url);
    if (!parsed) {
      throw new Error("الرابط غير مدعوم. استخدم YouTube أو TikTok أو Instagram أو X.");
    }
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("videos")
      .insert({
        author_id: userId,
        title: data.title,
        url: data.url,
        platform: parsed.platform,
        video_id: parsed.videoId,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { video: row };
  });
