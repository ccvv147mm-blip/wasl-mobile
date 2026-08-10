import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const submitWithdrawal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        points: z.number().int().min(500).max(1_000_000),
        method: z.enum(["vodafone_cash", "instapay", "etisalat_cash", "orange_cash"]),
        recipient_number: z.string().min(6).max(60),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error, data: id } = await context.supabase.rpc("submit_withdrawal", {
      _points: data.points,
      _method: data.method,
      _recipient_number: data.recipient_number.trim(),
    });
    if (error) throw new Error(error.message);
    return { id };
  });

export const listMyWithdrawals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await (context.supabase as any)
      .from("withdrawal_requests")
      .select("id, points, amount_egp, method, recipient_number, status, admin_note, created_at, reviewed_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const listPendingWithdrawals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: adm } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!adm) throw new Error("ليست لديك صلاحية");
    const { data, error } = await (context.supabase as any)
      .from("withdrawal_requests")
      .select("id, user_id, points, amount_egp, method, recipient_number, status, created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    const ids = Array.from(new Set((data ?? []).map((r: any) => r.user_id)));
    const profiles: Record<string, { username: string; full_name: string | null }> = {};
    if (ids.length) {
      const { data: prof } = await context.supabase
        .from("profiles")
        .select("id, username, full_name")
        .in("id", ids as string[]);
      (prof ?? []).forEach((p: any) => (profiles[p.id] = { username: p.username, full_name: p.full_name }));
    }
    return (data ?? []).map((r: any) => ({ ...r, profile: profiles[r.user_id] ?? null }));
  });

export const approveWithdrawal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid(), note: z.string().max(300).optional() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("approve_withdrawal", {
      _id: data.id,
      _note: data.note,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const rejectWithdrawal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid(), note: z.string().min(1).max(300) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("reject_withdrawal", {
      _id: data.id,
      _note: data.note,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
