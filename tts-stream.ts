import { supabase } from "@/integrations/supabase/client";
import { registerStopper } from "@/lib/media-lock";

export type SpeechHandle = { stop: () => void };

/**
 * قارئ فوري يعتمد على محرّك النطق الموجود في الهاتف، فلا ينتظر الشبكة أو
 * إنشاء ملف صوتي. تُقسّم الفقرة إلى أجزاء قصيرة حتى يبدأ أول جزء بسرعة.
 */
export function speakInstant(
  text: string,
  opts: { onEnd?: () => void; onStopped?: () => void } = {},
): SpeechHandle | null {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return null;

  const synth = window.speechSynthesis;
  const cleaned = text.trim();
  if (!cleaned) return null;

  synth.cancel();
  const voices = synth.getVoices();
  const arabicVoice = voices.find((voice) => voice.lang.toLowerCase().startsWith("ar"));
  const chunks = cleaned.match(/[^.!؟?،,؛;\n]+[.!؟?،,؛;\n]*/g) ?? [cleaned];
  const queue: string[] = [];

  for (const chunk of chunks) {
    const value = chunk.trim();
    if (!value) continue;
    if (value.length <= 220) {
      queue.push(value);
      continue;
    }
    for (let index = 0; index < value.length; index += 220) {
      queue.push(value.slice(index, index + 220));
    }
  }

  let stopped = false;
  let unregister = () => {};
  const stop = () => {
    if (stopped) return;
    stopped = true;
    unregister();
    synth.cancel();
    opts.onStopped?.();
  };
  unregister = registerStopper(stop);

  queue.forEach((chunk, index) => {
    const utterance = new SpeechSynthesisUtterance(chunk);
    utterance.lang = arabicVoice?.lang ?? "ar-EG";
    if (arabicVoice) utterance.voice = arabicVoice;
    utterance.volume = 1;
    utterance.rate = 1.08;
    utterance.pitch = 1;
    if (index === queue.length - 1) {
      utterance.onend = () => {
        if (stopped) return;
        stopped = true;
        unregister();
        opts.onEnd?.();
      };
    }
    synth.speak(utterance);
  });

  return { stop };
}

/**
 * يجب استدعاؤها **داخل حدث الضغط مباشرة** (بدون await قبلها) حتى يفتح
 * المتصفح قناة الصوت فوراً، فيبدأ التشغيل بلا تأخير على الهاتف.
 */
export function unlockAudio(): AudioContext | null {
  const Ctx: typeof AudioContext =
    (window as any).AudioContext || (window as any).webkitAudioContext;
  if (!Ctx) return null;
  const ctx = new Ctx({ sampleRate: 24000 });
  void ctx.resume().catch(() => {});
  // نبضة صامتة قصيرة لتثبيت فتح القناة على أجهزة الهاتف
  try {
    const buf = ctx.createBuffer(1, 1, 24000);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(ctx.destination);
    src.start(0);
  } catch {
    /* ignore */
  }
  return ctx;
}

/**
 * قراءة نص بصوت مرتفع: بثّ فوري (SSE) وتشغيل تدريجي لكل مقطع بمجرد وصوله.
 */
export async function speakStream(
  text: string,
  opts: {
    ctx?: AudioContext | null;
    onEnd?: () => void;
    onStopped?: () => void;
    gain?: number;
  } = {},
): Promise<SpeechHandle> {
  const ctx = opts.ctx ?? unlockAudio();
  if (!ctx) throw new Error("المتصفح لا يدعم تشغيل الصوت");

  const gainNode = ctx.createGain();
  gainNode.gain.value = opts.gain ?? 2.2;
  gainNode.connect(ctx.destination);

  const controller = new AbortController();
  const sources = new Set<AudioBufferSourceNode>();
  let stopped = false;
  let ended = false;
  let streamDone = false;
  let playhead = 0;
  let pending = new Uint8Array(0);
  let unregister: () => void = () => {};

  const cleanupCtx = () => {
    try {
      void ctx.close();
    } catch {
      /* ignore */
    }
  };

  const finish = () => {
    if (ended || stopped) return;
    ended = true;
    unregister();
    opts.onEnd?.();
    cleanupCtx();
  };

  const stop = () => {
    if (stopped) return;
    stopped = true;
    unregister();
    opts.onStopped?.();
    controller.abort();
    for (const s of sources) {
      try {
        s.onended = null;
        s.stop();
      } catch {
        /* ignore */
      }
    }
    sources.clear();
    cleanupCtx();
  };

  unregister = registerStopper(stop);

  const playChunk = (incoming: Uint8Array) => {
    if (stopped) return;
    const bytes = new Uint8Array(pending.length + incoming.length);
    bytes.set(pending);
    bytes.set(incoming, pending.length);
    const usable = bytes.length - (bytes.length % 2);
    pending = bytes.slice(usable);
    if (usable === 0) return;
    const samples = new Int16Array(bytes.buffer, 0, usable / 2);
    const floats = Float32Array.from(samples, (s) => s / 32768);
    const buffer = ctx.createBuffer(1, floats.length, 24000);
    buffer.copyToChannel(floats, 0);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(gainNode);
    if (playhead === 0) playhead = ctx.currentTime + 0.04;
    else playhead = Math.max(playhead, ctx.currentTime);
    source.start(playhead);
    playhead += buffer.duration;
    sources.add(source);
    source.onended = () => {
      sources.delete(source);
      if (!stopped && streamDone && sources.size === 0) finish();
    };
  };

  const { data } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token;
  if (!accessToken) {
    stop();
    throw new Error("يجب تسجيل الدخول لتشغيل القارئ الصوتي");
  }

  const res = await fetch("/api/tts", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ text }),
    signal: controller.signal,
  });
  if (!res.ok || !res.body) {
    stop();
    throw new Error("تعذّر تشغيل القارئ الصوتي حالياً");
  }
  if (ctx.state === "suspended") await ctx.resume().catch(() => {});

  // قراءة البثّ في الخلفية: كل مقطع يُشغَّل لحظة وصوله
  void (async () => {
    const reader = res.body!.pipeThrough(new TextDecoderStream()).getReader();
    let buf = "";
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += value;
        const parts = buf.split("\n\n");
        buf = parts.pop() ?? "";
        for (const part of parts) {
          for (const line of part.split("\n")) {
            if (!line.startsWith("data:")) continue;
            const raw = line.slice(5).trim();
            if (!raw || raw === "[DONE]") continue;
            try {
              const payload = JSON.parse(raw) as { type?: string; audio?: string };
              if (payload.type === "speech.audio.delta" && payload.audio) {
                const binary = atob(payload.audio);
                const bytes = new Uint8Array(binary.length);
                for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
                playChunk(bytes);
              }
            } catch {
              /* ignore */
            }
          }
        }
      }
    } catch {
      /* aborted or network error */
    }
    streamDone = true;
    if (!stopped && sources.size === 0) finish();
  })();

  return { stop };
}
