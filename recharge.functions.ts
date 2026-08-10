import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const POINTS_PER_EGP = 10;
const DEFAULT_WALLET_NUMBER = "01065049558";


export const getWalletSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.from("app_settings").select("key,value");
    const map: Record<string, string> = {};
    (data ?? []).forEach((r: any) => (map[r.key] = r.value));
    return {
      vodafone_cash: map["vodafone_cash_number"] || DEFAULT_WALLET_NUMBER,
      instapay: map["instapay_handle"] || DEFAULT_WALLET_NUMBER,
      etisalat_cash: map["etisalat_cash_number"] || DEFAULT_WALLET_NUMBER,
      orange_cash: map["orange_cash_number"] || DEFAULT_WALLET_NUMBER,
      pointsPerEgp: POINTS_PER_EGP,
    };
  });

export const submitRecharge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        amount_egp: z.number().int().min(10).max(100000),
        method: z.enum(["vodafone_cash", "instapay", "etisalat_cash", "orange_cash"]),
        sender_phone: z.string().min(6).max(40),
        transaction_ref: z.string().max(120).optional(),
        proof_path: z.string().max(300).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    let proof_url: string | null = null;
    if (data.proof_path) {
      const { data: signed } = await supabase.storage
        .from("payment-proofs")
        .createSignedUrl(data.proof_path, 60 * 60 * 24 * 30);
      proof_url = signed?.signedUrl ?? data.proof_path;
    }
    const { data: row, error } = await supabase
      .from("recharge_requests")
      .insert({
        user_id: userId,
        amount_egp: data.amount_egp,
        points: data.amount_egp * POINTS_PER_EGP,
        method: data.method,
        sender_phone: data.sender_phone,
        transaction_ref: data.transaction_ref ?? null,
        proof_url,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row!.id };
  });

export const listMyRecharges = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("recharge_requests")
      .select("id, amount_egp, points, method, status, admin_note, created_at, reviewed_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const isAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    return { admin: !!data };
  });

export const listPendingRecharges = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: adm } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!adm) throw new Error("ليست لديك صلاحية");
    const { data, error } = await context.supabase
      .from("recharge_requests")
      .select("id, user_id, amount_egp, points, method, sender_phone, transaction_ref, proof_url, status, created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    const ids = Array.from(new Set((data ?? []).map((r: any) => r.user_id)));
    let profiles: Record<string, { username: string; full_name: string | null }> = {};
    if (ids.length) {
      const { data: prof } = await context.supabase
        .from("profiles")
        .select("id, username, full_name")
        .in("id", ids);
      (prof ?? []).forEach((p: any) => (profiles[p.id] = { username: p.username, full_name: p.full_name }));
    }
    return (data ?? []).map((r: any) => ({ ...r, profile: profiles[r.user_id] ?? null }));
  });

export const approveRecharge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid(), note: z.string().max(300).optional() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("approve_recharge", {
      _request_id: data.id,
      _note: data.note,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const rejectRecharge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid(), note: z.string().min(1).max(300) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("reject_recharge", {
      _request_id: data.id,
      _note: data.note,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
