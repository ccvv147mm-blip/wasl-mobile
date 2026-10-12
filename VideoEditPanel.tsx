import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import { Image as ImageIcon, Loader2, Music2, Scissors, Sparkles, Trash2, VolumeX, Volume2, Wand2, X } from "lucide-react";
import { friendlyError } from "@/lib/friendly-error";
import { assertAllowedUpload } from "@/lib/upload-guard";
import { improvePost } from "@/lib/ai.functions";
import { StoryMusicPicker, type StoryMusic } from "@/components/StoryMusicPicker";

export type EditableVideo = {
  id: string;
  author_id: string;
  title: string;
  platform: string;
  video_id: string | null;
  thumbnail_url: string | null;
  trim_start: number | null;
  trim_end: number | null;
  filter: string | null;
  mute_original: boolean;
  music_path: string | null;
  music_title: string | null;
  _playUrl?: string;
};

export type VideoFilterOption = { key: string; name: string; css: string };

function fmt(s: number) {
  if (!isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${r.toString().padStart(2, "0")}`;
}

/** لوحة تعديل الفيديو: عنوان، فلاتر، قصّ، صوت، موسيقى، صورة الغلاف، وحذف. */
export function VideoEditPanel({
  video,
  filters,
  onClose,
  onSaved,
  onDelete,
}: {
  video: EditableVideo;
  filters: VideoFilterOption[];
  onClose: () => void;
  onSaved: () => void;
  onDelete: () => void;
}) {
  const isNative = video.platform === "native";
  const previewRef = useRef<HTMLVideoElement>(null);
  const improve = useServerFn(improvePost);

  const [title, setTitle] = useState(video.title ?? "");
  const [filter, setFilter] = useState(video.filter ?? "none");
  const [muteOriginal, setMuteOriginal] = useState(!!video.mute_original);
  const [duration, setDuration] = useState(0);
  const [range, setRange] = useState<[number, number]>([video.trim_start ?? 0, video.trim_end ?? 0]);
  const [music, setMusic] = useState<StoryMusic | null>(
    video.music_path ? { path: video.music_path, title: video.music_title ?? "موسيقى" } : null,
  );
  const [coverUrl, setCoverUrl] = useState("");
  const [coverBlob, setCoverBlob] = useState<Blob | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => () => { if (coverUrl) URL.revokeObjectURL(coverUrl); }, [coverUrl]);

  const css = filters.find((f) => f.key === filter)?.css ?? "none";

  const onLoadedMeta = () => {
    const el = previewRef.current;
    if (!el) return;
    const d = isFinite(el.duration) ? el.duration : 0;
    setDuration(d);
    setRange(([a, b]) => [Math.min(a, d), b > 0 ? Math.min(b, d) : d]);
  };

  const suggestTitle = async () => {
    const base = title.trim();
    if (!base) return toast.error("اكتب عنواناً أولاً ليقوم الذكاء الاصطناعي بتحسينه");
    setAiBusy(true);
    try {
      const res = await improve({ data: { text: base, mode: "improve" } });
      if (res?.result) {
        setTitle(res.result.replace(/\s+/g, " ").trim().slice(0, 200));
        toast.success("تم تحسين العنوان بالذكاء الاصطناعي ✨");
      }
    } catch (e) {
      toast.error(friendlyError(e, "تعذّر تحسين العنوان"));
    } finally {
      setAiBusy(false);
    }
  };

  const captureCover = () => {
    const el = previewRef.current;
    if (!el || !el.videoWidth) return toast.error("لم يتم تحميل الفيديو بعد");
    const canvas = document.createElement("canvas");
    canvas.width = el.videoWidth;
    canvas.height = el.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.filter = css === "none" ? "none" : css;
    try { ctx.drawImage(el, 0, 0, canvas.width, canvas.height); } catch { return toast.error("تعذّر التقاط الإطار"); }
    try {
      canvas.toBlob((blob) => {
        if (!blob) return toast.error("تعذّر التقاط الإطار");
        if (coverUrl) URL.revokeObjectURL(coverUrl);
        setCoverBlob(blob);
        setCoverUrl(URL.createObjectURL(blob));
        toast.success("تم اختيار الخلفية الجديدة");
      }, "image/jpeg", 0.85);
    } catch {
      toast.error("تعذّر التقاط الإطار من هذا الفيديو، اختر صورة من جهازك");
    }

  };

  const pickCoverImage = async (file: File | null) => {
    if (!file) return;
    try {
      assertAllowedUpload(file, ["image"]);
      if (coverUrl) URL.revokeObjectURL(coverUrl);
      setCoverBlob(file);
      setCoverUrl(URL.createObjectURL(file));
    } catch (e) {
      toast.error(friendlyError(e, "صورة غير مدعومة"));
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      let thumbnail_url = video.thumbnail_url;
      if (coverBlob) {
        const path = `${video.author_id}/covers/${Date.now()}.jpg`;
        const { error: upErr } = await supabase.storage
          .from("videos")
          .upload(path, coverBlob, { contentType: "image/jpeg", upsert: true });
        if (upErr) throw upErr;
        const { data: signed } = await supabase.storage.from("videos").createSignedUrl(path, 60 * 60 * 24 * 365);
        thumbnail_url = signed?.signedUrl ?? thumbnail_url;
      }

      const trimStart = range[0] > 0.1 ? range[0] : null;
      const trimEnd = duration && range[1] > 0 && range[1] < duration - 0.1 ? range[1] : null;

      const { error } = await supabase
        .from("videos")
        .update({
          title: title.trim() || video.title,
          filter: filter === "none" ? null : filter,
          mute_original: muteOriginal,
          music_path: music?.path ?? null,
          music_title: music?.title ?? null,
          thumbnail_url,
          ...(isNative ? { trim_start: trimStart, trim_end: trimEnd } : {}),
        })
        .eq("id", video.id);
      if (error) throw error;
      toast.success("تم حفظ التعديلات");
      onSaved();
    } catch (e) {
      toast.error(friendlyError(e, "تعذّر حفظ التعديلات"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-border bg-card p-4 shadow-elegant sm:rounded-2xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="inline-flex items-center gap-2 text-sm font-bold">
            <Wand2 className="h-4 w-4 text-primary" /> استوديو تعديل الفيديو
          </h2>
          <Button size="icon" variant="ghost" onClick={onClose} disabled={saving}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {isNative && (
          <video
            ref={previewRef}
            src={video._playUrl}
            crossOrigin="anonymous"
            onLoadedMetadata={onLoadedMeta}

            controls
            playsInline
            muted
            className="mb-4 max-h-64 w-full rounded-xl bg-black"
            style={{ filter: css }}
          />
        )}

        <div className="space-y-4">
          <div>
            <Label htmlFor="edit-title">العنوان</Label>
            <div className="flex gap-2">
              <Input id="edit-title" value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} />
              <Button type="button" variant="outline" size="icon" onClick={suggestTitle} disabled={aiBusy} aria-label="تحسين بالذكاء الاصطناعي">
                {aiBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <div>
            <Label className="mb-2 block">الفلاتر</Label>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {filters.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setFilter(f.key)}
                  className={`shrink-0 rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                    filter === f.key ? "border-primary bg-accent text-accent-foreground" : "border-border bg-background"
                  }`}
                >
                  {f.name}
                </button>
              ))}
            </div>
          </div>

          {isNative && duration > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1"><Scissors className="h-3.5 w-3.5" /> قصّ المقطع</span>
                <span>{fmt(range[0])} → {fmt(range[1])}</span>
              </div>
              <Slider
                min={0}
                max={Math.max(0.5, duration)}
                step={0.1}
                value={[range[0], range[1] || duration]}
                onValueChange={(v) => {
                  const a = Math.max(0, Math.min(v[0], v[1] - 0.5));
                  const b = Math.min(duration, Math.max(v[1], a + 0.5));
                  setRange([a, b]);
                  const el = previewRef.current;
                  if (el) try { el.currentTime = v[0] !== range[0] ? a : b; } catch { /* ignore */ }
                }}
              />
            </div>
          )}

          <div className="flex items-center justify-between rounded-xl border border-border bg-background p-3">
            <span className="inline-flex items-center gap-2 text-sm font-semibold">
              {muteOriginal ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              الصوت الأصلي للفيديو
            </span>
            <Button type="button" size="sm" variant={muteOriginal ? "default" : "outline"} onClick={() => setMuteOriginal((m) => !m)}>
              {muteOriginal ? "مكتوم" : "مسموع"}
            </Button>
          </div>

          <div className="rounded-xl border border-border bg-background p-3">
            <p className="mb-2 inline-flex items-center gap-2 text-sm font-semibold">
              <Music2 className="h-4 w-4" /> موسيقى الفيديو
            </p>
            <StoryMusicPicker value={music} onChange={setMusic} disabled={saving} />
          </div>

          <div className="rounded-xl border border-border bg-background p-3">
            <p className="mb-2 inline-flex items-center gap-2 text-sm font-semibold">
              <ImageIcon className="h-4 w-4" /> خلفية/صورة الفيديو
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {isNative && (
                <Button type="button" size="sm" variant="outline" onClick={captureCover}>
                  التقاط إطار بالفلتر
                </Button>
              )}
              <Input type="file" accept="image/*" className="max-w-[190px]" onChange={(e) => pickCoverImage(e.target.files?.[0] ?? null)} />
              {(coverUrl || video.thumbnail_url) && (
                <img
                  src={coverUrl || video.thumbnail_url!}
                  alt="خلفية الفيديو"
                  className="h-12 w-12 rounded border border-border object-cover"
                />
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            <Button onClick={save} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
              حفظ التعديلات
            </Button>
            <Button variant="ghost" onClick={onClose} disabled={saving}>إلغاء</Button>
            <Button
              variant="destructive"
              className="ms-auto"
              disabled={saving}
              onClick={() => {
                if (confirm("حذف هذا الفيديو نهائياً؟")) onDelete();
              }}
            >
              <Trash2 className="h-4 w-4" /> حذف الفيديو
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
