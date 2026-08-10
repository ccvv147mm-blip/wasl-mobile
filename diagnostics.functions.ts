import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { callLovableAI } from "./ai-gateway.server";

const ReportInput = z.object({
  route: z.string().max(300).optional(),
  message: z.string().min(1).max(2000),
  stack: z.string().max(8000).optional(),
  user_agent: z.string().max(500).optional(),
  context: z.record(z.string(), z.unknown()).optional(),
});

/**
 * يستقبل خطأ من العميل، يحفظه، ويستدعي الذكاء الاصطناعي للتشخيص واقتراح حل بالعربية.
 */
export const reportError = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ReportInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // 1) احفظ الخطأ مبدئياً
    const { data: row, error } = await supabase
      .from("error_reports")
      .insert({
        user_id: userId,
        route: data.route ?? null,
        message: data.message,
        stack: data.stack ?? null,
        user_agent: data.user_agent ?? null,
        context: (data.context ?? null) as any,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    // 2) اطلب من الذكاء الاصطناعي تشخيصاً مختصراً
    let diagnosis = "";
    let suggestion = "";
    try {
      const raw = await callLovableAI({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content:
              "أنت مساعد دعم فني عربي. حلّل خطأ تطبيق ويب وأعد JSON فقط بالشكل: " +
              '{"diagnosis":"سبب محتمل بجملة قصيرة","suggestion":"خطوة عملية يفعلها المستخدم الآن"}. ' +
              "اكتب باللغة العربية، بدون مصطلحات تقنية مخيفة.",
          },
          {
            role: "user",
            content: `المسار: ${data.route ?? "غير معروف"}
الرسالة: ${data.message}
Stack (مختصر): ${(data.stack ?? "").slice(0, 1500)}`,
          },
        ],
        response_format: { type: "json_object" },
        temperature: 0.2,
      });
      const parsed = JSON.parse(raw) as { diagnosis?: string; suggestion?: string };
      diagnosis = parsed.diagnosis ?? "";
      suggestion = parsed.suggestion ?? "";
      await supabase
        .from("error_reports")
        .update({ ai_diagnosis: diagnosis, ai_suggestion: suggestion, status: "diagnosed" })
        .eq("id", row.id);
    } catch (e) {
      console.error("AI diagnose failed:", e);
    }

    return { id: row.id, diagnosis, suggestion };
  });
