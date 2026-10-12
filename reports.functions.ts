import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const targetType = z.enum(["post", "video", "comment", "listing", "user"]);

export const submitReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        target_type: targetType,
        target_id: z.string().uuid(),
        reason: z.string().trim().min(2).max(60),
        details: z.string().trim().max(1000).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: id, error } = await (context.supabase as any).rpc("submit_report", {
      _target_type: data.target_type,
      _target_id: data.target_id,
      _reason: data.reason,
      _details: data.details ?? null,
    });
    if (error) throw new Error(error.message);
    return { id: id as string };
  });

export const adminListReports = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ status: z.enum(["pending", "reviewed", "dismissed", "actioned"]).optional() })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await (context.supabase as any).rpc("admin_list_reports", {
      _status: data.status ?? null,
      _limit: 200,
    });
    if (error) throw new Error(error.message);
    return (rows ?? []) as any[];
  });

export const adminReviewReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(["reviewed", "dismissed", "actioned"]),
        note: z.string().trim().max(500).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any).rpc("admin_review_report", {
      _id: data.id,
      _status: data.status,
      _note: data.note ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
