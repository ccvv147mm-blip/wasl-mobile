import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { callLovableAI } from "./ai-gateway.server";

/**
 * المحادثة مع الصفحة الشخصية: يستقبل سؤال المستخدم وبيانات صفحته
 * ويرد بإجابة عربية ذكية.
 */
export const chatWithProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        question: z.string().min(1).max(500),
        history: z
          .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(2000) }))
          .max(20)
          .optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Aggregate profile data
    const [{ data: profile }, { data: posts }, { data: videos }, { count: likesCount }] = await Promise.all([
      supabase.from("profiles").select("username, full_name, bio, interests").eq("id", userId).single(),
      supabase.from("posts").select("content, created_at").eq("author_id", userId).order("created_at", { ascending: false }).limit(20),
      supabase.from("videos").select("title, platform, views_count").eq("author_id", userId).order("created_at", { ascending: false }).limit(20),
      supabase.from("likes").select("*", { count: "exact", head: true }).eq("user_id", userId),
    ]);

    const totalViews = (videos ?? []).reduce((s, v: any) => s + (v.views_count ?? 0), 0);
    const summary = `أنت صفحة شخصية ذكية للمستخدم على شبكة "وَصْل" الاجتماعية العربية. تتحدث بصيغة المتكلم كأنك أنت الصفحة.

بيانات الصفحة:
- الاسم: ${profile?.full_name || profile?.username || "بدون اسم"}
- المعرّف: @${profile?.username}
- النبذة: ${profile?.bio || "لا يوجد"}
- الاهتمامات: ${profile?.interests || "لا يوجد"}
- عدد المنشورات: ${posts?.length ?? 0}
- عدد الفيديوهات: ${videos?.length ?? 0}
- إجمالي مشاهدات الفيديوهات: ${totalViews}
- عدد الإعجابات التي أبداها: ${likesCount ?? 0}

آخر المنشورات:
${(posts ?? []).slice(0, 5).map((p: any, i) => `${i + 1}. ${p.content.slice(0, 120)}`).join("\n") || "لا يوجد"}

آخر الفيديوهات:
${(videos ?? []).slice(0, 5).map((v: any, i) => `${i + 1}. ${v.title} (${v.views_count} مشاهدة)`).join("\n") || "لا يوجد"}

أجب بإيجاز وبالعربية الفصحى الواضحة. لا تستخدم رموز Markdown.`;

    const history = (data.history ?? []).map((m) => ({ role: m.role, content: m.content }));
    const content = await callLovableAI({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: summary },
        ...history,
        { role: "user", content: data.question },
      ],
      temperature: 0.7,
    });
    return { reply: content.trim() };
  });

/**
 * تحويل نص إلى صوت عربي عبر ElevenLabs. يُرجع base64 mp3.
 */
export const textToSpeech = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ text: z.string().min(1).max(2000) }).parse(input),
  )
  .handler(async ({ data }) => {
    const lovableKey = process.env.LOVABLE_API_KEY;

    // 1) صوت الذكاء الاصطناعي (Gemini TTS) — واضح ومرتفع
    if (lovableKey) {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/audio/speech", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${lovableKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-pro-tts",
          contents: [
            {
              role: "user",
              parts: [
                {
                  text: `اقرأ النص التالي بصوت أنثوي واضح ومرتفع وبنبرة كلاسيكية دافئة:\n${data.text}`,
                },
              ],
            },
          ],
          generationConfig: {
            responseModalities: ["AUDIO"],
            speechConfig: {
              voiceConfig: { prebuiltVoiceConfig: { voiceName: "Kore" } },
            },
          },
        }),
      });
      if (res.ok) {
        const buf = await res.arrayBuffer();
        return { audioBase64: Buffer.from(buf).toString("base64"), mime: "audio/wav" };
      }
      console.error("Gemini TTS error:", res.status, await res.text().catch(() => ""));
    }

    // 2) بديل: ElevenLabs (Sarah)
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (apiKey) {
      const voiceId = "EXAVITQu4vr4xnSDxMaL";
      const res = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
        {
          method: "POST",
          headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
          body: JSON.stringify({
            text: data.text,
            model_id: "eleven_multilingual_v2",
            voice_settings: {
              stability: 0.5,
              similarity_boost: 0.9,
              style: 0.45,
              use_speaker_boost: true,
              speed: 1.0,
            },
          }),
        },
      );
      if (res.ok) {
        const buf = await res.arrayBuffer();
        return { audioBase64: Buffer.from(buf).toString("base64"), mime: "audio/mpeg" };
      }
      console.error("ElevenLabs error:", res.status, await res.text().catch(() => ""));
    }

    // 3) بديل أخير: خدمة الصوت المدمجة
    if (!lovableKey) throw new Error("خدمة تحويل النص إلى صوت غير متاحة حالياً");
    const res = await fetch("https://ai.gateway.lovable.dev/v1/audio/speech", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-4o-mini-tts",
        input: data.text,
        voice: "shimmer",
        instructions: "اقرأ بصوت أنثوي واضح ومرتفع بنبرة كلاسيكية دافئة.",
        speed: 1.05,
        response_format: "mp3",
      }),
    });
    if (!res.ok) {
      console.error("Lovable TTS error:", res.status, await res.text().catch(() => ""));
      throw new Error("تعذّر تحويل النص إلى صوت حالياً، حاول لاحقاً");
    }
    const buf = await res.arrayBuffer();
    return { audioBase64: Buffer.from(buf).toString("base64"), mime: "audio/mpeg" };
  });




/**
 * إحصائيات الأرباح التقديرية.
 */
export const getEarnings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    // Get user's post IDs first, then count likes/comments on them
    const { data: userPosts } = await supabase.from("posts").select("id").eq("author_id", userId);
    const postIds = (userPosts ?? []).map((p) => p.id);

    const [{ data: videos }, likesRes, commentsRes, sharesRes, referralsRes, { data: profile }] = await Promise.all([
      supabase.from("videos").select("views_count, title, platform").eq("author_id", userId),
      postIds.length
        ? supabase.from("likes").select("post_id", { count: "exact", head: true }).in("post_id", postIds)
        : Promise.resolve({ count: 0 } as any),
      postIds.length
        ? supabase.from("comments").select("id", { count: "exact", head: true }).in("post_id", postIds)
        : Promise.resolve({ count: 0 } as any),
      supabase.from("shares").select("post_id", { count: "exact", head: true }).eq("user_id", userId),
      supabase.from("referrals").select("invitee_id", { count: "exact", head: true }).eq("referrer_id", userId),
      supabase.from("profiles").select("username").eq("id", userId).single(),
    ]);

    const postsCount = postIds.length;
    const likesReceived = likesRes.count ?? 0;
    const commentsReceived = commentsRes.count ?? 0;
    const appShares = sharesRes.count ?? 0;
    const referralsCount = referralsRes.count ?? 0;

    const totalVideoViews = (videos ?? []).reduce((s, v: any) => s + (v.views_count ?? 0), 0);

    const RATE_PER_1K_VIEWS = 0.04;
    const RATE_PER_LIKE = 0.001;
    const RATE_PER_COMMENT = 0.003;
    const RATE_PER_POST = 0.01;

    const videoEarnings = (totalVideoViews / 1000) * RATE_PER_1K_VIEWS;
    const likeEarnings = likesReceived * RATE_PER_LIKE;
    const commentEarnings = commentsReceived * RATE_PER_COMMENT;
    const postEarnings = postsCount * RATE_PER_POST;
    const total = videoEarnings + likeEarnings + commentEarnings + postEarnings;

    const MIN_WITHDRAW = 100;
    const REQUIRED_REFERRALS = 100;

    return {
      stats: {
        postsCount,
        videosCount: videos?.length ?? 0,
        totalVideoViews,
        likesReceived,
        commentsReceived,
        appShares,
        referralsCount,
      },
      earnings: {
        videos: Number(videoEarnings.toFixed(4)),
        likes: Number(likeEarnings.toFixed(4)),
        comments: Number(commentEarnings.toFixed(4)),
        posts: Number(postEarnings.toFixed(4)),
        total: Number(total.toFixed(2)),
      },
      referralCode: profile?.username ?? "",
      withdrawal: {
        minAmount: MIN_WITHDRAW,
        requiredReferrals: REQUIRED_REFERRALS,
        currentReferrals: referralsCount,
        meetsAmount: total >= MIN_WITHDRAW,
        meetsReferrals: referralsCount >= REQUIRED_REFERRALS,
        eligible: total >= MIN_WITHDRAW && referralsCount >= REQUIRED_REFERRALS,
      },
      topVideos: (videos ?? [])
        .slice()
        .sort((a: any, b: any) => (b.views_count ?? 0) - (a.views_count ?? 0))
        .slice(0, 5),
    };
  });
