import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Loader2, Music2, Pause, Play, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { MUSIC_PRESETS } from "@/lib/music-presets";
import { ensureMusicTrack } from "@/lib/music.functions";
import { friendlyError } from "@/lib/friendly-error";
import { assertAllowedUpload } from "@/lib/upload-guard";

export type StoryMusic = { path: string; title: string };

/** يوقّع مسار ملف صوتي في مساحة الأغاني ويعيد رابطاً قابلاً للتشغيل. */
export async function signMusic(path: string): Promise<string | null> {
  const { data } = await supabase.storage.from("story-music").createSignedUrl(path, 60 * 60 * 6);
  return data?.signedUrl ?? null;
}

export function StoryMusicPicker({
  value,
  onChange,
  disabled,
}: {
  value: StoryMusic | null;
  onChange: (m: StoryMusic | null) => void;
  disabled?: boolean;
}) {
  const { user } = useAuth();
  const ensure = useServerFn(ensureMusicTrack);
  const fileRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);

  // الأغاني الجاهزة الموجودة فعلاً في المكتبة
  const ready = useQuery({
    queryKey: ["music-tracks"],
    queryFn: async () => {
      const { data } = await supabase.from("music_tracks").select("key").limit(200);
      return new Set((data ?? []).map((t: { key: string }) => t.key));
    },
  });

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      audioRef.current = null;
    };
  }, []);

  const preview = async (path: string) => {
    audioRef.current?.pause();
    const url = await signMusic(path);
    if (!url) return;
    const a = new Audio(url);
    a.loop = true;
    a.volume = 0.9;
    audioRef.current = a;
    a.onended = () => setPlaying(false);
    await a.play().catch(() => {});
    setPlaying(true);
  };

  const stopPreview = () => {
    audioRef.current?.pause();
    setPlaying(false);
  };

  const pickPreset = async (key: string, title: string) => {
    setBusy(key);
    try {
      const res: any = await ensure({ data: { key } });
      if (res?.error) return toast.error(res.error);
      onChange({ path: res.path, title: res.title ?? title });
      setOpen(false);
      void preview(res.path);
      toast.success(`تمت إضافة «${res.title ?? title}» إلى لمحتك 🎵`);
    } catch (e) {
      toast.error(friendlyError(e, "تعذّر تجهيز الأغنية"));
    } finally {
      setBusy(null);
    }
  };

  const uploadOwn = async (file: File) => {
    if (!user) return;
    if (file.size > 12 * 1024 * 1024) return toast.error("الحد الأقصى 12MB");
    setBusy("upload");
    try {
      const { contentType, ext } = assertAllowedUpload(file, ["audio"]);
      const path = `${user.id}/music-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("story-music").upload(path, file, { contentType });
      if (error) throw error;
      const title = file.name.replace(/\.[^.]+$/, "").slice(0, 60) || "أغنيتي";
      onChange({ path, title });
      setOpen(false);
      void preview(path);
      toast.success("تمت إضافة أغنيتك 🎵");
    } catch (e) {
      toast.error(friendlyError(e, "تعذّر رفع الأغنية"));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="mt-3">
      {value ? (
        <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/40 p-2">
          <Music2 className="h-4 w-4 shrink-0 text-[color:var(--ai)]" />
          <span className="line-clamp-1 flex-1 text-xs font-semibold">{value.title}</span>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            onClick={() => (playing ? stopPreview() : preview(value.path))}
            title="معاينة"
          >
            {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            disabled={disabled}
            onClick={() => {
              stopPreview();
              onChange(null);
            }}
            title="إزالة الأغنية"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      ) : (
        <Button type="button" variant="outline" className="w-full" disabled={disabled} onClick={() => setOpen(true)}>
          <Music2 className="h-4 w-4" /> أضف أغنية
        </Button>
      )}

      {open && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 p-3" onClick={() => setOpen(false)}>
          <div
            className="max-h-[75vh] w-full max-w-sm overflow-y-auto rounded-2xl border border-border bg-card p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-sm font-bold">
                <Music2 className="h-4 w-4 text-[color:var(--ai)]" /> اختر أغنية
              </h3>
              <Button size="icon" variant="ghost" onClick={() => setOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <input
              ref={fileRef}
              type="file"
              accept="audio/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void uploadOwn(f);
                e.target.value = "";
              }}
            />
            <Button
              type="button"
              variant="secondary"
              className="mb-3 w-full"
              disabled={busy === "upload"}
              onClick={() => fileRef.current?.click()}
            >
              {busy === "upload" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              ارفع أغنيتك من جهازك
            </Button>

            <p className="mb-2 text-[11px] text-muted-foreground">أغانٍ جاهزة مجانية (بدون حقوق) — تُجهَّز مرة واحدة ثم تكون فورية للجميع</p>
            <div className="grid grid-cols-2 gap-2">
              {MUSIC_PRESETS.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  disabled={!!busy}
                  onClick={() => pickPreset(p.key, p.title)}
                  className="flex items-center gap-2 rounded-xl border border-border p-2 text-start text-xs font-semibold transition hover:border-primary disabled:opacity-60"
                >
                  <span className="text-base">{p.emoji}</span>
                  <span className="line-clamp-1 flex-1">{p.title}</span>
                  {busy === p.key ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : ready.data?.has(p.key) ? (
                    <Play className="h-3.5 w-3.5 text-primary" />
                  ) : null}
                </button>
              ))}
            </div>
            <p className="mt-3 text-[11px] text-muted-foreground">
              الأغنية تُشغّل تلقائياً مع لمحتك، ويمكن للمشاهد كتم الصوت.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
