import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function ensureAdmin(supabase: any, userId: string) {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (!data) throw new Error("ليست لديك صلاحية الوصول إلى لوحة التحكم");
}

export const adminStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await (context.supabase as any).rpc("admin_stats");
    if (error) throw new Error(error.message);
    return data as Record<string, number>;
  });

export const adminListUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ search: z.string().max(80).optional() }).parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await (context.supabase as any).rpc("admin_list_users", {
      _search: data.search ?? null,
      _limit: 100,
    });
    if (error) throw new Error(error.message);
    return (rows ?? []) as any[];
  });

export const adminSetRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        user_id: z.string().uuid(),
        role: z.enum(["admin", "moderator"]),
        grant: z.boolean(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any).rpc("admin_set_role", {
      _user_id: data.user_id,
      _role: data.role,
      _grant: data.grant,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminAdjustCredits = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        user_id: z.string().uuid(),
        delta: z.number().int().min(-1_000_000).max(1_000_000).refine((v) => v !== 0),
        note: z.string().max(200).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: bal, error } = await (context.supabase as any).rpc("admin_adjust_credits", {
      _user_id: data.user_id,
      _delta: data.delta,
      _note: data.note ?? null,
    });
    if (error) throw new Error(error.message);
    return { balance: bal as number };
  });

export const adminDeleteContent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ kind: z.enum(["post", "video", "listing", "comment"]), id: z.string().uuid() })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any).rpc("admin_delete_content", {
      _kind: data.kind,
      _id: data.id,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminSetSetting = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        key: z.enum([
          "vodafone_cash_number",
          "instapay_handle",
          "etisalat_cash_number",
          "orange_cash_number",
          "live_gift_fee_percent",
        ]),
        value: z.string().min(3).max(120),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any).rpc("admin_set_setting", {
      _key: data.key,
      _value: data.value.trim(),
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminListContent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ kind: z.enum(["post", "video", "listing"]) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.supabase, context.userId);
    const table = data.kind === "post" ? "posts" : data.kind === "video" ? "videos" : "listings";
    const cols =
      data.kind === "post"
        ? "id, author_id, content, image_url, video_url, created_at"
        : data.kind === "video"
          ? "id, author_id, title, url, platform, views_count, created_at"
          : "id, seller_id, title, price_points, status, created_at";
    const { data: rows, error } = await (context.supabase as any)
      .from(table)
      .select(cols)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);

    const ids = Array.from(
      new Set((rows ?? []).map((r: any) => r.author_id ?? r.seller_id).filter(Boolean)),
    );
    const profiles: Record<string, { username: string; full_name: string | null }> = {};
    if (ids.length) {
      const { data: prof } = await (context.supabase as any)
        .from("profiles")
        .select("id, username, full_name")
        .in("id", ids);
      (prof ?? []).forEach((p: any) => (profiles[p.id] = { username: p.username, full_name: p.full_name }));
    }
    return (rows ?? []).map((r: any) => ({
      ...r,
      profile: profiles[r.author_id ?? r.seller_id] ?? null,
    }));
  });

export const adminAuditLog = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ limit: z.number().int().min(1).max(500).optional() }).parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await (context.supabase as any).rpc("admin_list_audit_log", {
      _limit: data.limit ?? 200,
    });
    if (error) throw new Error(error.message);
    return (rows ?? []) as any[];
  });

export const adminListStreams = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ limit: z.number().int().min(1).max(500).optional() }).parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await (context.supabase as any).rpc("admin_list_streams", {
      _limit: data.limit ?? 100,
    });
    if (error) throw new Error(error.message);
    return (rows ?? []) as any[];
  });

export const adminEndStream = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ stream_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.supabase, context.userId);
    const { error } = await (context.supabase as any).rpc("end_live_stream", {
      _stream_id: data.stream_id,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminListGifts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ limit: z.number().int().min(1).max(500).optional() }).parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await (context.supabase as any).rpc("admin_list_gifts", {
      _limit: data.limit ?? 150,
    });
    if (error) throw new Error(error.message);
    return (rows ?? []) as any[];
  });

export const adminGetLiveFee = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await (context.supabase as any)
      .from("app_settings")
      .select("value")
      .eq("key", "live_gift_fee_percent")
      .maybeSingle();
    return { percent: Number(data?.value ?? 10) };
  });
