import { useCredits } from "@/hooks/use-credits";
import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { toast } from "sonner";
import {
  Loader2, Plus, Eye, Trash2, Video as VideoIcon, Upload, Volume2, VolumeX,
  Scissors, Image as ImageIcon, X, Heart, MessageCircle, Share2, Gift, Send,
} from "lucide-react";
import { friendlyError } from "@/lib/friendly-error";
import { assertAllowedUpload } from "@/lib/upload-guard";
import { publicName } from "@/lib/display-name";

export const Route = createFileRoute("/videos")({
  component: VideosPage,
  head: () => ({
    meta: [
      { title: "الفيديوهات — وَصْل" },
      {
        name: "description",
        content: "شاهد فيديوهات مجتمع وَصْل العربية في مكان واحد: ارفع فيديوهاتك أو أضف روابط، وتفاعل بالإعجاب والتعليق والهدايا.",
      },
      { property: "og:title", content: "فيديوهات وَصْل — محتوى عربي قصير ومتنوّع" },
      {
        property: "og:description",
        content: "خلاصة فيديوهات عربية: ارفع فيديوك أو أضف رابطاً من يوتيوب وتيك توك، وتابع المشاهدات والتفاعل.",
      },
      { property: "og:url", content: "https://arab-spark-ai.lovable.app/videos" },
    ],
    links: [{ rel: "canonical", href: "https://arab-spark-ai.lovable.app/videos" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: "فيديوهات وَصْل",
          url: "https://arab-spark-ai.lovable.app/videos",
          inLanguage: "ar",
          description: "خلاصة فيديوهات مجتمع وَصْل العربية.",
          isPartOf: { "@id": "https://arab-spark-ai.lovable.app/#website" },
        }),
      },
    ],
  }),
});


type VideoRow = {
  id: string;
  title: string;
  url: string;
  platform: string;
  video_id: string | null;
  views_count: number;
  created_at: string;
  author_id: string;
  thumbnail_url: string | null;
  trim_start: number | null;
  trim_end: number | null;
  author: { username: string; full_name: string | null; avatar_url: string | null } | null;
  likes_count: number;
  comments_count: number;
  shares_count: number;
  gifts_count: number;
  liked_by_me: boolean;
  _playUrl?: string;
};

const VIDEO_GIFTS = [
  { type: "rose", emoji: "🌹", name: "وردة", value: 5 },
  { type: "heart", emoji: "❤️", name: "قلب", value: 10 },
  { type: "star", emoji: "⭐", name: "نجمة", value: 25 },
  { type: "crown", emoji: "👑", name: "تاج", value: 100 },
  { type: "diamond", emoji: "💎", name: "ألماسة", value: 500 },
  { type: "lion", emoji: "🦁", name: "أسد", value: 5000 },
] as const;

function fmt(s: number) {
  if (!isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${r.toString().padStart(2, "0")}`;
}

function VideoCard({
  v, userId, isMine, muted, onToggleMute, onView, onDelete,
}: {
  v: VideoRow; userId: string; isMine: boolean; muted: boolean;
  onToggleMute: () => void; onView: () => void; onDelete: () => void;
}) {
  const qc = useQueryClient();
  const ref = useRef<HTMLVideoElement>(null);
  const [showComments, setShowComments] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [commenting, setCommenting] = useState(false);
  const [giftOpen, setGiftOpen] = useState(false);
  const [sendingGift, setSendingGift] = useState<string | null>(null);
  const isNative = v.platform === "native";
  const embed = !isNative
    ? v.platform === "youtube"
      ? `https://www.youtube.com/embed/${v.video_id}`
      : `https://www.tiktok.com/embed/v2/${v.video_id}`
    : null;

  useEffect(() => {
    if (!isNative) return;
    const el = ref.current;
    if (!el) return;
    const start = v.trim_start ?? 0;
    const end = v.trim_end ?? null;
    const onLoaded = () => { if (start > 0) try { el.currentTime = start; } catch {} };
    const onTime = () => { if (end != null && el.currentTime >= end) { el.currentTime = start; } };
    el.addEventListener("loadedmetadata", onLoaded);
    el.addEventListener("timeupdate", onTime);
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting && e.intersectionRatio > 0.6) {
          el.play().catch(() => {});
          onView();
        } else el.pause();
      }
    }, { threshold: [0, 0.6, 1] });
    io.observe(el);
    return () => {
      io.disconnect();
      el.removeEventListener("loadedmetadata", onLoaded);
      el.removeEventListener("timeupdate", onTime);
    };
  }, [isNative, onView, v.trim_start, v.trim_end]);

  const name = publicName(v.author);
  const src = v._playUrl || v.url;

  const comments = useQuery({
    enabled: showComments,
    queryKey: ["video-comments", v.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("video_comments")
        .select("id, author_id, content, created_at")
        .eq("video_id", v.id)
        .order("created_at", { ascending: true })
        .limit(100);
      if (error) throw error;

      const rows = data ?? [];
      const ids = Array.from(new Set(rows.map((r) => r.author_id)));
      const profiles = new Map<string, { username: string; full_name: string | null }>();
      if (ids.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, username, full_name")
          .in("id", ids);
        profs?.forEach((p) => profiles.set(p.id, { username: p.username, full_name: p.full_name }));
      }
      return rows.map((r) => ({ ...r, author: profiles.get(r.author_id) ?? null }));
    },
  });

  const balance = useCredits(userId, giftOpen);


  const refreshVideos = () => qc.invalidateQueries({ queryKey: ["videos"] });

  const toggleLike = async () => {
    try {
      if (v.liked_by_me) {
        const { error } = await supabase.from("video_likes").delete().eq("video_id", v.id).eq("user_id", userId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("video_likes").insert({ video_id: v.id, user_id: userId });
        if (error) throw error;
      }
      refreshVideos();
    } catch (e) {
      toast.error(friendlyError(e, "تعذّر تحديث الإعجاب"));
    }
  };

  const addComment = async () => {
    const text = newComment.trim();
    if (!text) return;
    setCommenting(true);
    try {
      const { error } = await supabase.from("video_comments").insert({ video_id: v.id, author_id: userId, content: text });
      if (error) throw error;
      setNewComment("");
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["video-comments", v.id] }),
        qc.invalidateQueries({ queryKey: ["videos"] }),
      ]);
    } catch (e) {
      toast.error(friendlyError(e, "تعذّر إرسال التعليق"));
    } finally {
      setCommenting(false);
    }
  };

  const shareVideo = async () => {
    const url = `${window.location.origin}/videos?video=${v.id}`;
    const text = v.title ? `${v.title}\n${url}` : url;
    try {
      if (navigator.share) await navigator.share({ title: "فيديو على وَصْل", text: v.title, url });
      else {
        await navigator.clipboard.writeText(text);
        toast.success("تم نسخ رابط الفيديو");
      }
      const { error } = await supabase.from("video_shares").insert({ video_id: v.id, user_id: userId });
      if (error) throw error;
      refreshVideos();
    } catch (e) {
      if ((e as Error)?.name !== "AbortError") toast.error(friendlyError(e, "تعذّرت المشاركة"));
    }
  };

  const sendGift = async (type: string, value: number) => {
    setSendingGift(type);
    try {
      const { error } = await supabase.rpc("send_video_gift", {
        _video_id: v.id,
        _gift_type: type,
        _value: value,
      });
      if (error) throw error;
      toast.success("تم إرسال الهدية للفيديو 🎁");
      setGiftOpen(false);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["videos"] }),
        qc.invalidateQueries({ queryKey: ["credits"] }),
      ]);
    } catch (e) {
      toast.error(friendlyError(e, "رصيد غير كافٍ أو خطأ"));
    } finally {
      setSendingGift(null);
    }
  };

  return (
    <article className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
      <div className="flex items-center justify-between p-3">
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9">
            <AvatarFallback className="gradient-primary text-sm font-bold text-primary-foreground">
              {name.charAt(0)}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="text-sm font-semibold">{name}</p>
          </div>
        </div>
        {isMine && (
          <Button size="sm" variant="ghost" onClick={onDelete}>
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
      {v.title && <h2 className="px-3 pb-2 text-sm">{v.title}</h2>}
      <div className="relative aspect-[9/16] max-h-[80vh] bg-black">
        {isNative ? (
          <>
            <video
              ref={ref}
              src={src}
              poster={v.thumbnail_url ?? undefined}
              className="absolute inset-0 h-full w-full object-contain"
              playsInline
              muted={muted}
              loop
              preload="metadata"
              controls
            />
            <button
              type="button"
              onClick={onToggleMute}
              className="absolute bottom-3 left-3 rounded-full bg-black/60 p-2 text-white backdrop-blur"
              aria-label={muted ? "تشغيل الصوت" : "كتم"}
            >
              {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </button>
          </>
        ) : (
          <iframe
            src={embed!}
            className="absolute inset-0 h-full w-full"
            title={v.title}
            loading="lazy"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        )}
      </div>
      <div className="flex flex-wrap items-center gap-1 p-3 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1"><Eye className="h-3.5 w-3.5" /> {v.views_count}</span>
        <Button variant="ghost" size="sm" onClick={toggleLike} className={v.liked_by_me ? "text-destructive" : ""}>
          <Heart className={`h-4 w-4 ${v.liked_by_me ? "fill-current" : ""}`} />
          {v.likes_count > 0 && v.likes_count}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setShowComments((s) => !s)}>
          <MessageCircle className="h-4 w-4" />
          {v.comments_count > 0 && v.comments_count}
        </Button>
        <Button variant="ghost" size="sm" onClick={shareVideo}>
          <Share2 className="h-4 w-4" />
          {v.shares_count > 0 && v.shares_count}
        </Button>
        <div className="relative">
          <Button
            variant="ghost"
            size="sm"
            disabled={isMine}
            onClick={() => setGiftOpen((open) => !open)}
            className="text-amber-500 hover:text-amber-600"
          >
            <Gift className="h-4 w-4" />
            {v.gifts_count > 0 && v.gifts_count}
          </Button>
          {giftOpen && !isMine && (
            <div className="absolute bottom-full left-0 z-20 mb-2 w-64 rounded-2xl border border-border bg-popover p-3 shadow-elegant">
              <p className="mb-2 text-xs text-muted-foreground">
                رصيدك: <span className="font-bold text-foreground">{balance.data ?? "..."}</span> نقطة
              </p>
              <div className="grid grid-cols-3 gap-2">
                {VIDEO_GIFTS.map((gift) => {
                  const insufficient = (balance.data ?? 0) < gift.value;
                  return (
                    <button
                      key={gift.type}
                      type="button"
                      disabled={!!sendingGift || insufficient}
                      onClick={() => sendGift(gift.type, gift.value)}
                      className="flex flex-col items-center gap-1 rounded-xl border border-border bg-card p-2 transition hover:shadow-card disabled:opacity-40"
                    >
                      <span className="text-2xl">{gift.emoji}</span>
                      <span className="text-[11px] font-semibold text-foreground">{gift.name}</span>
                      <span className="text-[10px] text-muted-foreground">{gift.value}</span>
                      {sendingGift === gift.type && <Loader2 className="h-3 w-3 animate-spin" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {showComments && (
        <div className="space-y-3 border-t border-border p-3">
          {comments.isLoading && <div className="flex justify-center py-3"><Loader2 className="h-4 w-4 animate-spin" /></div>}
          {comments.data?.map((comment) => {
            const commentName = publicName(comment.author);
            return (
              <div key={comment.id} className="flex gap-2">
                <Avatar className="h-7 w-7">
                  <AvatarFallback className="text-xs">{commentName.charAt(0)}</AvatarFallback>
                </Avatar>
                <div className="flex-1 rounded-xl bg-muted px-3 py-2">
                  <p className="text-xs font-semibold">{commentName}</p>
                  <p className="text-sm">{comment.content}</p>
                </div>
              </div>
            );
          })}
          <div className="flex items-end gap-1">
            <Textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="اكتب تعليقاً على الفيديو..."
              rows={1}
              maxLength={500}
              className="resize-none"
              disabled={commenting}
            />
            <Button size="icon" onClick={addComment} disabled={commenting || !newComment.trim()}>
              {commenting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      )}
    </article>
  );
}

function UploadPanel({ userId, onDone, onClose }: { userId: string; onDone: () => void; onClose: () => void }) {
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [fileUrl, setFileUrl] = useState<string>("");
  const [duration, setDuration] = useState(0);
  const [range, setRange] = useState<[number, number]>([0, 0]);
  const [coverUrl, setCoverUrl] = useState<string>("");
  const [coverBlob, setCoverBlob] = useState<Blob | null>(null);
  const [progress, setProgress] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const previewRef = useRef<HTMLVideoElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => () => { if (fileUrl) URL.revokeObjectURL(fileUrl); if (coverUrl) URL.revokeObjectURL(coverUrl); }, [fileUrl, coverUrl]);

  const pickFile = (f: File | null) => {
    if (!f) return;
    if (!f.type.startsWith("video/")) return toast.error("الرجاء اختيار ملف فيديو");
    if (f.size > 200 * 1024 * 1024) return toast.error("الحد الأقصى لحجم الفيديو 200MB");
    if (fileUrl) URL.revokeObjectURL(fileUrl);
    if (coverUrl) URL.revokeObjectURL(coverUrl);
    setCoverBlob(null); setCoverUrl("");
    setFile(f);
    setFileUrl(URL.createObjectURL(f));
    setDuration(0); setRange([0, 0]);
  };

  const onLoadedMeta = () => {
    const el = previewRef.current; if (!el) return;
    const d = isFinite(el.duration) ? el.duration : 0;
    setDuration(d);
    setRange([0, d]);
  };

  const captureCover = async () => {
    const el = previewRef.current; if (!el || !duration) return;
    const w = el.videoWidth, h = el.videoHeight;
    if (!w || !h) return toast.error("لم يتم تحميل الفيديو بعد");
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    try { ctx.drawImage(el, 0, 0, w, h); } catch { return toast.error("تعذّر التقاط الإطار"); }
    canvas.toBlob((blob) => {
      if (!blob) return;
      if (coverUrl) URL.revokeObjectURL(coverUrl);
      setCoverBlob(blob);
      setCoverUrl(URL.createObjectURL(blob));
      toast.success("تم اختيار الغلاف");
    }, "image/jpeg", 0.85);
  };

  const previewSeek = (t: number) => {
    const el = previewRef.current; if (el) try { el.currentTime = t; } catch {}
  };

  const submit = async () => {
    if (!file || !title.trim()) return;
    setSubmitting(true);
    setProgress(0);
    try {
      const { contentType: videoType, ext } = assertAllowedUpload(file, ["video"]);
      const path = `${userId}/${Date.now()}.${ext}`;
      // Upload with the authenticated storage client so MIME metadata is
      // present when the bucket policy validates the new object. Creating a
      // signed upload URL first inserts an empty placeholder that the policy
      // rejects before the video bytes are sent.
      setProgress(15);
      const { error: uploadError } = await supabase.storage
        .from("videos")
        .upload(path, file, { contentType: videoType, cacheControl: "3600", upsert: false });
      if (uploadError) throw uploadError;
      setProgress(95);

      let thumbPath: string | null = null;
      if (coverBlob) {
        thumbPath = `${userId}/thumb-${Date.now()}.jpg`;
        const { error: tErr } = await supabase.storage.from("videos").upload(thumbPath, coverBlob, { contentType: "image/jpeg" });
        if (tErr) console.warn("thumb upload failed", tErr);
      }
      setProgress(98);

      // signed thumbnail URL (long lived) for poster display
      let thumbUrl: string | null = null;
      if (thumbPath) {
        const { data: tSigned } = await supabase.storage.from("videos").createSignedUrl(thumbPath, 60 * 60 * 24 * 365);
        thumbUrl = tSigned?.signedUrl ?? null;
      }

      const trimStart = range[0] > 0.1 ? range[0] : null;
      const trimEnd = duration && range[1] < duration - 0.1 ? range[1] : null;

      const { error: insErr } = await supabase.from("videos").insert({
        author_id: userId,
        title: title.trim(),
        url: "",
        platform: "native",
        video_id: path,
        thumbnail_url: thumbUrl,
        trim_start: trimStart,
        trim_end: trimEnd,
      });
      if (insErr) throw insErr;
      setProgress(100);
      toast.success("تم نشر الفيديو");
      onDone();
    } catch (e) {
      toast.error(friendlyError(e, "تعذّر رفع الفيديو"));
    } finally {
      setSubmitting(false);
      setProgress(0);
    }
  };

  return (
    <div className="mt-4 rounded-2xl border border-border bg-card p-4 shadow-card">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold">رفع فيديو جديد</h2>
        <Button size="icon" variant="ghost" onClick={onClose} disabled={submitting}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="space-y-4">
        <div>
          <Label htmlFor="vtitle">عنوان الفيديو</Label>
          <Input id="vtitle" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="اكتب وصفاً قصيراً" maxLength={200} />
        </div>

        <div>
          <Label htmlFor="vfile">ملف الفيديو (حتى 200MB)</Label>
          <Input id="vfile" ref={fileRef} type="file" accept="video/*" onChange={(e) => pickFile(e.target.files?.[0] ?? null)} />
          {file && <p className="mt-1 text-xs text-muted-foreground">{file.name} · {(file.size / 1024 / 1024).toFixed(1)}MB</p>}
        </div>

        {fileUrl && (
          <div className="space-y-3 rounded-xl border border-border bg-background p-3">
            <video
              ref={previewRef}
              src={fileUrl}
              onLoadedMetadata={onLoadedMeta}
              controls
              playsInline
              className="max-h-72 w-full rounded-lg bg-black"
            />

            {duration > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1"><Scissors className="h-3.5 w-3.5" /> قصّ المقطع</span>
                  <span>{fmt(range[0])} → {fmt(range[1])} (المدة {fmt(range[1] - range[0])})</span>
                </div>
                <Slider
                  min={0}
                  max={Math.max(0.1, duration)}
                  step={0.1}
                  value={range}
                  onValueChange={(v) => {
                    const a = Math.min(v[0], v[1] - 0.5);
                    const b = Math.max(v[1], v[0] + 0.5);
                    setRange([Math.max(0, a), Math.min(duration, b)]);
                    previewSeek(v[0] !== range[0] ? a : b);
                  }}
                />
              </div>
            )}

            <div className="flex items-center gap-2">
              <Button type="button" size="sm" variant="outline" onClick={captureCover} disabled={!duration}>
                <ImageIcon className="h-4 w-4" />
                التقاط الإطار غلافًا
              </Button>
              {coverUrl && (
                <div className="flex items-center gap-2">
                  <img src={coverUrl} alt="غلاف" className="h-12 w-12 rounded object-cover border border-border" />
                  <Button type="button" size="sm" variant="ghost" onClick={() => { URL.revokeObjectURL(coverUrl); setCoverUrl(""); setCoverBlob(null); }}>
                    إزالة
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}

        {submitting && (
          <div>
            <div className="mb-1 flex justify-between text-xs text-muted-foreground">
              <span>جارٍ الرفع…</span><span>{progress}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <Button onClick={submit} disabled={submitting || !file || !title.trim()}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            نشر
          </Button>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>إلغاء</Button>
        </div>
      </div>
    </div>
  );
}

function VideosPage() {
  const { user, loading } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [muted, setMuted] = useState(true);

  const videos = useQuery({
    enabled: !!user,
    queryKey: ["videos"],
    queryFn: async (): Promise<VideoRow[]> => {
      const { data, error } = await supabase
        .from("videos")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      const base = (data ?? []) as Omit<VideoRow, "author" | "_playUrl" | "likes_count" | "comments_count" | "shares_count" | "gifts_count" | "liked_by_me">[];
      const authorIds = Array.from(new Set(base.map((r) => r.author_id)));
      const authorMap = new Map<string, VideoRow["author"]>();
      if (authorIds.length) {
        const { data: profs } = await supabase
          .from("profiles").select("id, username, full_name, avatar_url").in("id", authorIds);
        profs?.forEach((p) => authorMap.set(p.id, { username: p.username, full_name: p.full_name, avatar_url: p.avatar_url }));
      }
      const videoIds = base.map((r) => r.id);
      const [likesRes, commentsRes, sharesRes, giftsRes] = videoIds.length
        ? await Promise.all([
            supabase.from("video_likes").select("video_id, user_id").in("video_id", videoIds),
            supabase.from("video_comments").select("video_id").in("video_id", videoIds),
            supabase.from("video_shares").select("video_id").in("video_id", videoIds),
            supabase.from("video_gifts").select("video_id").in("video_id", videoIds),
          ])
        : [{ data: [] }, { data: [] }, { data: [] }, { data: [] }];

      const countByVideo = (rows?: Array<{ video_id: string }> | null) => {
        const map = new Map<string, number>();
        rows?.forEach((row) => map.set(row.video_id, (map.get(row.video_id) ?? 0) + 1));
        return map;
      };
      const likes = countByVideo(likesRes.data);
      const comments = countByVideo(commentsRes.data);
      const shares = countByVideo(sharesRes.data);
      const gifts = countByVideo(giftsRes.data);
      const liked = new Set((likesRes.data ?? []).filter((row) => row.user_id === user!.id).map((row) => row.video_id));

      const rows: VideoRow[] = base.map((r) => ({
        ...r,
        author: authorMap.get(r.author_id) ?? null,
        likes_count: likes.get(r.id) ?? 0,
        comments_count: comments.get(r.id) ?? 0,
        shares_count: shares.get(r.id) ?? 0,
        gifts_count: gifts.get(r.id) ?? 0,
        liked_by_me: liked.has(r.id),
      }));
      const nativePaths = rows.filter((r) => r.platform === "native" && r.video_id).map((r) => r.video_id!) as string[];
      if (nativePaths.length) {
        const { data: signed } = await supabase.storage.from("videos").createSignedUrls(nativePaths, 60 * 60);
        const map = new Map<string, string>();
        signed?.forEach((s) => { if (s.path && s.signedUrl) map.set(s.path, s.signedUrl); });
        for (const r of rows) if (r.platform === "native" && r.video_id) r._playUrl = map.get(r.video_id);
      }
      return rows;
    },
  });

  const del = async (v: VideoRow) => {
    if (v.platform === "native" && v.video_id) {
      await supabase.storage.from("videos").remove([v.video_id]);
    }
    const { error } = await supabase.from("videos").delete().eq("id", v.id);
    if (error) return toast.error(friendlyError(error, "تعذّر الحذف"));
    qc.invalidateQueries({ queryKey: ["videos"] });
  };

  const onView = async (id: string) => { await supabase.rpc("increment_video_views", { _video_id: id }); };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" />;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-xl px-4 py-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">الفيديوهات</h1>
          <Button onClick={() => setOpen((v) => !v)} className="shadow-elegant">
            <Plus className="h-4 w-4" />
            رفع فيديو
          </Button>
        </div>

        {open && user && (
          <UploadPanel
            userId={user.id}
            onClose={() => setOpen(false)}
            onDone={() => { setOpen(false); qc.invalidateQueries({ queryKey: ["videos"] }); }}
          />
        )}

        <div className="mt-6 space-y-6">
          {videos.isLoading && (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          )}
          {videos.data && videos.data.length === 0 && (
            <div className="rounded-2xl border border-dashed border-border p-12 text-center">
              <VideoIcon className="mx-auto h-10 w-10 text-muted-foreground" />
              <p className="mt-3 text-muted-foreground">لا توجد فيديوهات بعد. شارك أول فيديو!</p>
            </div>
          )}
          {videos.data?.map((v) => (
            <VideoCard
              key={v.id}
              v={v}
              userId={user.id}
              isMine={v.author_id === user.id}
              muted={muted}
              onToggleMute={() => setMuted((m) => !m)}
              onView={() => onView(v.id)}
              onDelete={() => del(v)}
            />
          ))}
        </div>
      </main>
    </div>
  );
}
