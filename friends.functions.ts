import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const uuid = z.string().uuid();

export const sendFriendRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ addresseeId: uuid }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (data.addresseeId === userId) throw new Error("لا يمكن إضافة نفسك");
    // If a row already exists either direction, return it
    const { data: existing } = await supabase
      .from("friendships")
      .select("*")
      .or(
        `and(requester_id.eq.${userId},addressee_id.eq.${data.addresseeId}),and(requester_id.eq.${data.addresseeId},addressee_id.eq.${userId})`,
      )
      .maybeSingle();
    if (existing) return { friendship: existing };
    const { data: row, error } = await supabase
      .from("friendships")
      .insert({ requester_id: userId, addressee_id: data.addresseeId, status: "pending" })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { friendship: row };
  });

export const respondFriendRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ requesterId: uuid, accept: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("friendships")
      .update({ status: data.accept ? "accepted" : "rejected", updated_at: new Date().toISOString() })
      .eq("requester_id", data.requesterId)
      .eq("addressee_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removeFriend = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ otherId: uuid }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("friendships")
      .delete()
      .or(
        `and(requester_id.eq.${userId},addressee_id.eq.${data.otherId}),and(requester_id.eq.${data.otherId},addressee_id.eq.${userId})`,
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listFriends = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: rows } = await supabase
      .from("friendships")
      .select("*")
      .eq("status", "accepted")
      .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`);
    const peerIds = (rows ?? []).map((r) => (r.requester_id === userId ? r.addressee_id : r.requester_id));
    if (peerIds.length === 0) return { friends: [] as any[] };
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, username, full_name, avatar_url, bio")
      .in("id", peerIds);
    return { friends: profiles ?? [] };
  });

export const listFriendRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: incomingRows } = await supabase
      .from("friendships")
      .select("requester_id, created_at")
      .eq("status", "pending")
      .eq("addressee_id", userId);
    const { data: outgoingRows } = await supabase
      .from("friendships")
      .select("addressee_id, created_at")
      .eq("status", "pending")
      .eq("requester_id", userId);
    const inIds = (incomingRows ?? []).map((r) => r.requester_id);
    const outIds = (outgoingRows ?? []).map((r) => r.addressee_id);
    const allIds = [...inIds, ...outIds];
    let profiles: any[] = [];
    if (allIds.length) {
      const { data } = await supabase
        .from("profiles")
        .select("id, username, full_name, avatar_url")
        .in("id", allIds);
      profiles = data ?? [];
    }
    const byId = new Map(profiles.map((p) => [p.id, p]));
    return {
      incoming: inIds.map((id) => byId.get(id)).filter(Boolean),
      outgoing: outIds.map((id) => byId.get(id)).filter(Boolean),
    };
  });

export const suggestFriends = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: rows } = await supabase
      .from("friendships")
      .select("requester_id, addressee_id, status")
      .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`);
    const excluded = new Set<string>([userId]);
    for (const r of rows ?? []) {
      if (r.status === "rejected") continue;
      excluded.add(r.requester_id === userId ? r.addressee_id : r.requester_id);
    }
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, username, full_name, avatar_url, bio, created_at")
      .order("created_at", { ascending: false })
      .limit(80);
    const suggestions = (profiles ?? []).filter((p) => !excluded.has(p.id)).slice(0, 24);
    return { suggestions };
  });

export const getFriendshipStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ otherId: uuid }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row } = await supabase
      .from("friendships")
      .select("*")
      .or(
        `and(requester_id.eq.${userId},addressee_id.eq.${data.otherId}),and(requester_id.eq.${data.otherId},addressee_id.eq.${userId})`,
      )
      .maybeSingle();
    if (!row) return { status: "none" as const };
    if (row.status === "accepted") return { status: "accepted" as const };
    if (row.status === "rejected") return { status: "none" as const };
    if (row.requester_id === userId) return { status: "pending_out" as const };
    return { status: "pending_in" as const };
  });
