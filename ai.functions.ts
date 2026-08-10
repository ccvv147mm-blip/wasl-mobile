import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { callLovableAI } from "./ai-gateway.server";

/**
 * يحسّن أو يصيغ منشوراً عربياً باستخدام الذكاء الاصطناعي.
 */
export const improvePost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        text: z.string().min(1).max(2000),
        mode: z.enum(["improve", "expand", "shorten", "ideas"]).default("improve"),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const systemByMode: Record<string, string> = {
      improve: "أعد صياغة هذا المنشور العربي ليصبح أكثر جاذبية وسلاسة دون تغيير المعنى. أعد النص فقط دون أي مقدمات.",
      expand: "وسّع هذا المنشور العربي بفقرة قصيرة إضافية تثري الفكرة. أعد النص الكامل فقط.",
      shorten: "اختصر هذا المنشور العربي مع الحفاظ على الفكرة الأساسية. أعد النص فقط.",
      ideas: "اقترح 3 أفكار قصيرة لمنشورات متعلقة بهذا الموضوع. أرجعها كقائمة مرقمة.",
    };
    const content = await callLovableAI({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: systemByMode[data.mode] },
        { role: "user", content: data.text },
      ],
      temperature: 0.7,
    });
    return { result: content.trim() };
  });

/**
 * يرتّب منشورات الخلاصة بناءً على اهتمامات المستخدم باستخدام الذكاء الاصطناعي.
 * يستقبل قائمة منشورات ويرجع ترتيب IDs بترتيب الأولوية.
 */
export const rankFeed = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        posts: z
          .array(
            z.object({
              id: z.string(),
              content: z.string().transform((s) => s.slice(0, 500)),
              likes: z.number(),
              comments: z.number(),
              author: z.string(),
            }),
          )
          .min(1)
          .max(40),
        interests: z.string().max(500).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const interests = data.interests?.trim() || "محتوى عربي متنوع";
    const postsForAI = data.posts.map((p, i) => `[${i}] (إعجابات:${p.likes} تعليقات:${p.comments}) ${p.content.slice(0, 200)}`).join("\n");
    const prompt = `اهتمامات المستخدم: ${interests}

المنشورات:
${postsForAI}

رتّب المنشورات من الأهم إلى الأقل أهمية للمستخدم بناءً على اهتماماته وجودة المحتوى والتفاعل. أعد JSON فقط بهذا الشكل:
{"order": [أرقام الفهارس مرتبة]}`;

    try {
      const raw = await callLovableAI({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "أنت محرّك ترتيب لشبكة اجتماعية عربية. أعد JSON صالحاً فقط." },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" },
        temperature: 0.3,
      });
      const parsed = JSON.parse(raw) as { order: number[] };
      const seen = new Set<number>();
      const orderedIds: string[] = [];
      for (const idx of parsed.order ?? []) {
        if (typeof idx === "number" && data.posts[idx] && !seen.has(idx)) {
          seen.add(idx);
          orderedIds.push(data.posts[idx].id);
        }
      }
      // append any missing
      data.posts.forEach((p, i) => {
        if (!seen.has(i)) orderedIds.push(p.id);
      });
      return { order: orderedIds };
    } catch (e) {
      console.error("rankFeed error:", e);
      return { order: data.posts.map((p) => p.id) };
    }
  });
