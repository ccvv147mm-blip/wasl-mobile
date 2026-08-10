import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { callLovableAI } from "./ai-gateway.server";

/**
 * يولّد أخبار وترند حسب البلد عبر الذكاء الاصطناعي.
 */
export const getCountryNews = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ country: z.string().min(2).max(60) }).parse(input),
  )
  .handler(async ({ data }) => {
    const now = new Date();
    const dateKey = now.toISOString().slice(0, 10);
    const dateAr = new Intl.DateTimeFormat("ar-EG", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: "UTC",
    }).format(now);

    const prompt = `اليوم هو ${dateAr} (${dateKey}).
أعطني أهم 5 عناوين أخبار وترند اليوم فقط في ${data.country} (سياسة، رياضة، تقنية، ثقافة، اقتصاد).
يجب أن تكون الأخبار خاصة بتاريخ اليوم وليست عامة أو قديمة.
أعد JSON فقط بهذا الشكل:
{"items":[{"title":"...","category":"سياسة|رياضة|تقنية|ثقافة|اقتصاد|ترفيه","summary":"جملة قصيرة"}]}`;

    try {
      const raw = await callLovableAI({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content:
              "أنت محرّر أخبار عربي يومي. أعد أخبار اليوم الحالي فقط، وأعد JSON صالحاً فقط دون أي نص إضافي.",
          },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" },
        temperature: 0.5,
      });
      const parsed = JSON.parse(raw) as { items: Array<{ title: string; category: string; summary: string }> };
      return {
        items: (parsed.items ?? []).slice(0, 5),
        country: data.country,
        date: dateKey,
        dateLabel: dateAr,
      };
    } catch (e) {
      console.error("getCountryNews:", e);
      return { items: [], country: data.country, date: dateKey, dateLabel: dateAr };
    }
  });
