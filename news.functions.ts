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
  .handler(async ({ data, context }) => {
    const now = new Date();
    const dateKey = now.toISOString().slice(0, 10);
    const dateAr = new Intl.DateTimeFormat("ar-EG", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: "UTC",
    }).format(now);

    type NewsItem = { title: string; category: string; summary: string };

    // 1) أخبار اليوم المخزّنة (تولّد مرة واحدة يومياً لكل بلد)
    const { data: cached } = await context.supabase
      .from("daily_news")
      .select("items, date_label")
      .eq("country", data.country)
      .eq("news_date", dateKey)
      .maybeSingle();

    const cachedItems = (cached?.items as NewsItem[] | null) ?? [];
    if (cachedItems.length > 0) {
      return {
        items: cachedItems.slice(0, 5),
        country: data.country,
        date: dateKey,
        dateLabel: cached?.date_label ?? dateAr,
        error: null as string | null,
      };
    }

    // 2) المصدر المجاني أولاً (بدون أي رصيد ذكاء اصطناعي) — أخبار حقيقية لليوم
    try {
      const { fetchRssNews } = await import("./news-rss.server");
      const rssItems = await fetchRssNews(data.country, 5);
      if (rssItems.length > 0) {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        await supabaseAdmin
          .from("daily_news")
          .upsert(
            { country: data.country, news_date: dateKey, items: rssItems, date_label: dateAr },
            { onConflict: "country,news_date" },
          );
        return {
          items: rssItems,
          country: data.country,
          date: dateKey,
          dateLabel: dateAr,
          error: null as string | null,
        };
      }
    } catch (e0) {
      console.error("getCountryNews (rss-primary):", e0);
    }

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
      const parsed = JSON.parse(raw) as { items: NewsItem[] };
      const items = (parsed.items ?? []).slice(0, 5);

      if (items.length > 0) {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        await supabaseAdmin
          .from("daily_news")
          .upsert(
            { country: data.country, news_date: dateKey, items, date_label: dateAr },
            { onConflict: "country,news_date" },
          );
      }

      return { items, country: data.country, date: dateKey, dateLabel: dateAr, error: null as string | null };
    } catch (e) {
      console.error("getCountryNews (ai):", e);
      // بديل تلقائي بدون ذكاء اصطناعي حتى لا يظهر القسم فارغاً أبداً
      try {
        const { fetchRssNews } = await import("./news-rss.server");
        const items = await fetchRssNews(data.country, 5);
        if (items.length > 0) {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          await supabaseAdmin
            .from("daily_news")
            .upsert(
              { country: data.country, news_date: dateKey, items, date_label: dateAr },
              { onConflict: "country,news_date" },
            );
          return { items, country: data.country, date: dateKey, dateLabel: dateAr, error: null as string | null };
        }
      } catch (e2) {
        console.error("getCountryNews (rss):", e2);
      }
      const msg = e instanceof Error ? e.message : "تعذّر تحديث الأخبار الآن";
      return { items: [], country: data.country, date: dateKey, dateLabel: dateAr, error: msg };
    }
  });


