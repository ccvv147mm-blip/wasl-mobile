import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { callLovableAI } from "./ai-gateway.server";

const Input = z.object({
  lang: z.string().min(2).max(12),
  texts: z.array(z.string().min(1).max(2000)).min(1).max(60),
});

async function sha1(text: string) {
  const buf = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * يترجم مجموعة نصوص إلى أي لغة عالمية، مع تخزين النتائج في قاعدة البيانات
 * حتى لا تُترجم نفس العبارة أكثر من مرة (توفير للتكلفة وسرعة أعلى).
 */
export const translateTexts = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data }) => {
    const lang = data.lang.toLowerCase();
    const unique = Array.from(new Set(data.texts.map((t) => t.trim()).filter(Boolean)));
    const result: Record<string, string> = {};
    if (lang === "ar" || unique.length === 0) {
      for (const t of unique) result[t] = t;
      return { lang, translations: result };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const hashes = await Promise.all(unique.map((t) => sha1(t)));
    const byHash = new Map<string, string>();
    unique.forEach((t, i) => byHash.set(hashes[i]!, t));

    const { data: cached } = await supabaseAdmin
      .from("translations")
      .select("source_hash, translated")
      .eq("lang", lang)
      .in("source_hash", hashes);

    for (const row of cached ?? []) {
      const src = byHash.get(row.source_hash);
      if (src) result[src] = row.translated;
    }

    const missing = unique.filter((t) => !(t in result));
    if (missing.length === 0) return { lang, translations: result };

    try {
      const raw = await callLovableAI({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content:
              "You are a UI localization engine. Translate each string into the requested BCP-47 language. Keep meaning, tone, emojis, numbers, names, URLs and placeholders intact. Do not add explanations. Return ONLY JSON.",
          },
          {
            role: "user",
            content: `Target language code: ${lang}
Translate every item of this JSON array and return {"items":["...","..."]} with the SAME order and SAME length.
${JSON.stringify(missing)}`,
          },
        ],
        response_format: { type: "json_object" },
        temperature: 0.1,
      });
      const parsed = JSON.parse(raw) as { items?: string[] };
      const items = parsed.items ?? [];
      const rows: Array<{ lang: string; source_hash: string; source: string; translated: string }> = [];
      for (let i = 0; i < missing.length; i++) {
        const src = missing[i]!;
        const out = typeof items[i] === "string" && items[i]!.trim() ? items[i]! : src;
        result[src] = out;
        if (out !== src) {
          rows.push({ lang, source_hash: await sha1(src), source: src, translated: out });
        }
      }
      if (rows.length) {
        await supabaseAdmin.from("translations").upsert(rows, { onConflict: "lang,source_hash" });
      }
    } catch (e) {
      console.error("translateTexts:", e);
      for (const t of missing) result[t] = t;
    }

    return { lang, translations: result };
  });
