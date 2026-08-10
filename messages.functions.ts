import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { sanitizeFilterTerm } from "@/lib/search-sanitize";

/** قائمة المحادثات: آخر رسالة مع كل شخص */
export const listConversations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: rows, error } = await supabase
      .from("messages")
      .select("id, sender_id, recipient_id, content, read, created_at")
      .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);

    const byPeer = new Map<string, typeof rows[number]>();
    for (const m of rows ?? []) {
      const peer = m.sender_id === userId ? m.recipient_id : m.sender_id;
      if (!byPeer.has(peer)) byPeer.set(peer, m);
    }
    const peerIds = Array.from(byPeer.keys());
    if (peerIds.length === 0) return { conversations: [] };

    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, username, full_name, avatar_url")
      .in("id", peerIds);

    const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));

    return {
      conversations: peerIds.map((id) => {
        const last = byPeer.get(id)!;
        return {
          peerId: id,
          peer: profileMap.get(id) ?? null,
          lastMessage: last.content,
          lastAt: last.created_at,
          unread: last.recipient_id === userId && !last.read,
        };
      }),
    };
  });

/** البحث عن مستخدمين بالاسم/المعرّف/رقم الهاتف لبدء محادثة — رقم الهاتف لا يُعاد إلى العميل */
export const searchUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ q: z.string().min(1).max(60) }).parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const q = sanitizeFilterTerm(data.q);
    if (!q) return { users: [] };
    const isPhoneLike = /^[+\d\s-]+$/.test(q);
    const phoneDigits = isPhoneLike ? q.replace(/\D/g, "") : "";
    const filter = isPhoneLike && phoneDigits.length >= 4
      ? `username.ilike."%${q}%",full_name.ilike."%${q}%",phone.ilike."%${phoneDigits}%"`
      : `username.ilike."%${q}%",full_name.ilike."%${q}%"`;
    // Use admin client for phone matching, but only return non-sensitive columns
    const { data: rows } = await supabaseAdmin
      .from("profiles")
      .select("id, username, full_name, avatar_url")
      .or(filter)
      .neq("id", userId)
      .limit(15);
    return { users: rows ?? [] };
  });


/** سلسلة الرسائل مع مستخدم محدد + تعليم المستلَمة كمقروءة */
export const getThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ peerId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: rows, error } = await supabase
      .from("messages")
      .select("*")
      .or(
        `and(sender_id.eq.${userId},recipient_id.eq.${data.peerId}),and(sender_id.eq.${data.peerId},recipient_id.eq.${userId})`,
      )
      .order("created_at", { ascending: true })
      .limit(500);
    if (error) throw new Error(error.message);

    await supabase
      .from("messages")
      .update({ read: true })
      .eq("sender_id", data.peerId)
      .eq("recipient_id", userId)
      .eq("read", false);

    const { data: peer } = await supabase
      .from("profiles")
      .select("id, username, full_name, avatar_url")
      .eq("id", data.peerId)
      .single();

    return { messages: rows ?? [], peer };
  });

/** إرسال رسالة */
export const sendMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ peerId: z.string().uuid(), content: z.string().min(1).max(2000) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: msg, error } = await supabase
      .from("messages")
      .insert({ sender_id: userId, recipient_id: data.peerId, content: data.content.trim() })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { message: msg };
  });
