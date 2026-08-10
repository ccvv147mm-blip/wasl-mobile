import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { sanitizeFilterTerm } from "@/lib/search-sanitize";

export const globalSearch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ q: z.string().min(1).max(80) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const q = sanitizeFilterTerm(data.q);
    if (!q) {
      return { users: [], posts: [], videos: [], listings: [] };
    }
    const like = `%${q}%`;

    const [usersRes, postsRes, videosRes, listingsRes] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, username, full_name, avatar_url")
        .or(`username.ilike."${like}",full_name.ilike."${like}"`)
        .neq("id", userId)
        .limit(20),
      supabase
        .from("posts")
        .select("id, content, image_url, author_id, created_at")
        .ilike("content", like)
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("videos")
        .select("id, title, url, platform, thumbnail_url, author_id, views_count, created_at")
        .ilike("title", like)
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("listings")
        .select("id, title, description, price_points, price_egp, images, seller_id, status")
        .or(`title.ilike."${like}",description.ilike."${like}"`)
        .eq("status", "active")
        .limit(20),
    ]);

    return {
      users: usersRes.data ?? [],
      posts: postsRes.data ?? [],
      videos: videosRes.data ?? [],
      listings: listingsRes.data ?? [],
    };
  });
