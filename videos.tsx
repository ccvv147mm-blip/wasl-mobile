import { useCredits } from "@/hooks/use-credits";
import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { VideoShareButton } from "@/components/VideoShareButton";
import { toast } from "sonner";
import {
  Loader2, Plus, Eye, Trash2, Video as VideoIcon, Upload, Volume2, VolumeX,
  Scissors, Image as ImageIcon, X, Heart, MessageCircle, Gift, Send,
  ChevronLeft, Search, Wand2, Music2,
} from "lucide-react";
import { friendlyError } from "@/lib/friendly-error";
import { assertAllowedUpload } from "@/lib/upload-guard";
import { publicName } from "@/lib/display-name";
import { stopAllMedia } from "@/lib/media-lock";
import { VideoEditPanel } from "@/components/VideoEditPanel";



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
  filter: string | null;
  mute_original: boolean;
  music_path: string | null;
  music_title: string | null;
  author: { username: string; full_name: string | null; avatar_url: string | null } | null;
  likes_count: number;
  comments_count: number;
  shares_count: number;
  gifts_count: number;
  liked_by_me: boolean;
  _playUrl?: string;
  _musicUrl?: string;
};

/** فلاتر بصرية فورية للفيديو (CSS) */
export const VIDEO_FILTERS: { key: string; name: string; css: string }[] = [
  { key: "none", name: "بدون", css: "none" },
  { key: "warm", name: "دافئ", css: "saturate(1.3) sepia(0.15) contrast(1.05)" },
  { key: "cool", name: "بارد", css: "saturate(1.1) hue-rotate(-12deg) brightness(1.05)" },
  { key: "cinema", name: "سينمائي", css: "contrast(1.25) saturate(0.9) brightness(0.95)" },
  { key: "mono", name: "أبيض وأسود", css: "grayscale(1) contrast(1.1)" },
  { key: "vintage", name: "قديم", css: "sepia(0.45) contrast(1.05) saturate(0.85)" },
  { key: "vivid", name: "زاهي", css: "saturate(1.6) contrast(1.1)" },
  { key: "dream", name: "حلم", css: "blur(0.6px) brightness(1.12) saturate(1.2)" },
  { key: "night", name: "ليلي", css: "brightness(0.85) contrast(1.2) hue-rotate(200deg)" },
  { key: "glow", name: "توهّج", css: "brightness(1.15) saturate(1.25) contrast(0.95)" },
];

function filterCss(key: string | null | undefined) {
  return VIDEO_FILTERS.find((f) => f.key === key)?.css ?? "none";
}

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

function useVideoInteractions({ v, userId }: { v: VideoRow; userId: string }) {
  const qc = useQueryClient();
  const [showComments, setShowComments] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [commenting, setCommenting] = useState(false);
  const [giftOpen, setGiftOpen] = useState(false);
  const [sendingGift, setSendingGift] = useState<string | null>(null);

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

  const sendGift = async (type: string, value: number) => {

    setSendingGift(type);
    try {
      const { error } = await supabase.rpc("send_video_gift", { _video_id: v.id, _gift_type: type, _value: value });
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
        const { data: profs } = await supabase.from("profiles").select("id, username, full_name").in("id", ids);
        profs?.forEach((p) => profiles.set(p.id, { username: p.username, full_name: p.full_name }));
      }
      return rows.map((r) => ({ ...r, author: profiles.get(r.author_id) ?? null }));
    },
  });

  const balance = useCredits(userId, giftOpen);

  return {
    showComments, setShowComments,
    newComment, setNewComment,
    commenting,
    giftOpen, setGiftOpen,
    sendingGift,
    comments,
    balance,
    toggleLike, addComment, sendGift,
  };
}


function ReelItem({
  v, userId, isMine, muted, onToggleMute, onView, onDelete, onEdit,
}: {
  v: VideoRow; userId: string; isMine: boolean; muted: boolean;
  onToggleMute: () => void; onView: () => void; onDelete: () => void; onEdit: () => void;
}) {
  const musicRef = useRef<HTMLAudioElement>(null);

  const ref = useRef<HTMLVideoElement>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const isNative = v.platform === "native";
  const embed = !isNative
    ? v.platform === "youtube"
      ? `https://www.youtube.com/embed/${v.video_id}`
      : `https://www.tiktok.com/embed/v2/${v.video_id}`
    : null;
  const name = publicName(v.author);
  const src = v._playUrl || v.url;

  const {
    showComments, setShowComments,
    newComment, setNewComment,
    commenting,
    giftOpen, setGiftOpen,
    sendingGift,
    comments,
    balance,
    toggleLike, addComment, sendGift,
  } = useVideoInteractions({ v, userId });


  useEffect(() => {
    if (!isNative) return;
    const el = ref.current;
    if (!el) return;
    const start = v.trim_start ?? 0;
    const end = v.trim_end ?? null;
    const onLoaded = () => { if (start > 0) try { el.currentTime = start; } catch {} };
    const onTime = () => { if (end != null && el.currentTime >= end) el.currentTime = start; };
    el.addEventListener("loadedmetadata", onLoaded);
    el.addEventListener("timeupdate", onTime);
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting && e.intersectionRatio > 0.6) {
          stopAllMedia(el);
          el.play().catch(() => {});
          const m = musicRef.current;
          if (m && !muted) { m.currentTime = 0; m.play().catch(() => {}); }
          onView();
        } else {
          el.pause();
          musicRef.current?.pause();
          try { el.currentTime = start; } catch { /* ignore */ }
        }
      }
    }, { threshold: [0, 0.6, 1] });
    io.observe(el);
    return () => {
      io.disconnect();
      el.pause();
      musicRef.current?.pause();
      el.removeEventListener("loadedmetadata", onLoaded);
      el.removeEventListener("timeupdate", onTime);
    };
  }, [isNative, onView, muted, v.trim_start, v.trim_end]);


  return (
    <section
      ref={sectionRef}
      className="relative h-[100dvh] w-full shrink-0 snap-start snap-always overflow-hidden bg-black"
    >
      {/* Video media fills the screen */}
      {isNative ? (
        <video
          ref={ref}
          src={src}
          poster={v.thumbnail_url ?? undefined}
          className="absolute inset-0 h-full w-full object-cover"
          style={{ filter: filterCss(v.filter) }}
          playsInline
          muted={muted || v.mute_original}
          loop
          preload="metadata"
        />
      ) : (

        <iframe
          src={embed!}
          className="absolute inset-0 h-full w-full"
          title={v.title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      )}

      {/* موسيقى مرفقة بالفيديو */}
      {v._musicUrl && (
        <audio ref={musicRef} src={v._musicUrl} loop muted={muted} preload="none" className="hidden" />
      )}


      {/* Dark gradient overlays for readability */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/30" />






      {/* Right-side actions */}
      <div className="absolute bottom-32 right-3 z-20 flex flex-col items-center gap-4 sm:bottom-36 sm:right-5">
        <button
          type="button"
          onClick={toggleLike}
          className="flex flex-col items-center gap-1 text-white drop-shadow"
        >
          <div className={`rounded-full bg-black/40 p-2.5 backdrop-blur ${v.liked_by_me ? "text-destructive" : ""}`}>
            <Heart className={`h-6 w-6 ${v.liked_by_me ? "fill-current" : ""}`} />
          </div>
          <span className="text-xs font-semibold">{v.likes_count || "إعجاب"}</span>
        </button>

        <button
          type="button"
          onClick={() => setShowComments(true)}
          className="flex flex-col items-center gap-1 text-white drop-shadow"
        >
          <div className="rounded-full bg-black/40 p-2.5 backdrop-blur">
            <MessageCircle className="h-6 w-6" />
          </div>
          <span className="text-xs font-semibold">{v.comments_count || "تعليق"}</span>
        </button>

        <VideoShareButton videoId={v.id} title={v.title} count={v.shares_count} vertical />


        <div className="relative flex flex-col items-center gap-1 text-white drop-shadow">
          <button
            type="button"
            onClick={() => {
              if (isMine) {
                toast.message("صندوق الهدايا", { description: "الآخرون يمكنهم إرسال الهدايا لفيديوك" });
                return;
              }
              setGiftOpen((o) => !o);
            }}
            className={`rounded-full bg-black/40 p-2.5 backdrop-blur ${giftOpen ? "text-amber-400" : ""}`}
            aria-label="صندوق الهدايا"
          >
              <Gift className="h-6 w-6" />
            </button>
            <span className="text-xs font-semibold">{v.gifts_count || "هدية"}</span>
            {giftOpen && (
              <div className="absolute bottom-full right-0 z-30 mb-2 w-64 rounded-2xl border border-border bg-popover p-3 shadow-elegant">
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


      {/* Bottom info */}
      <div className="absolute bottom-0 left-0 right-0 z-20 p-4 pb-[env(safe-area-inset-bottom,16px)]">
        <div className="flex items-end gap-3">
          <div className="w-[calc(100%-4.5rem)]">
            <div className="mb-2 flex items-center gap-2">
              <Avatar className="h-10 w-10 shrink-0 border-2 border-white/30">
                {v.author?.avatar_url ? (
                  <img src={v.author.avatar_url} alt={name} className="h-full w-full object-cover" />
                ) : (
                  <AvatarFallback className="gradient-primary font-bold text-primary-foreground">
                    {name.charAt(0)}
                  </AvatarFallback>
                )}
              </Avatar>
              <div>
                <p className="text-sm font-bold text-white drop-shadow">{name}</p>
                <p className="text-xs text-white/80 drop-shadow">@{v.author?.username || "user"}</p>
              </div>
            </div>
            {v.title && <p className="text-sm font-semibold text-white drop-shadow line-clamp-2">{v.title}</p>}
            <p className="mt-1 inline-flex items-center gap-1 text-xs text-white/80 drop-shadow">
              <Eye className="h-3.5 w-3.5" /> {v.views_count} مشاهدة
            </p>
            {v.music_title && (
              <p className="mt-1 inline-flex items-center gap-1 text-xs text-white/80 drop-shadow">
                <Music2 className="h-3.5 w-3.5" /> {v.music_title}
              </p>
            )}

          </div>
        </div>

        {/* Bottom control bar: sound + effects/edit + gift box */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onToggleMute}
            className="flex items-center gap-1.5 rounded-full bg-black/45 px-3 py-2 text-white backdrop-blur"
            aria-label={muted ? "تشغيل الصوت" : "كتم الصوت"}
          >
            {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
            <span className="text-xs font-semibold">{muted ? "تشغيل الصوت" : "الصوت"}</span>
          </button>

          {isMine && (
            <>
              <button
                type="button"
                onClick={onEdit}
                className="flex items-center gap-1.5 rounded-full bg-black/45 px-3 py-2 text-white backdrop-blur"
                aria-label="المؤثرات والتعديل"
              >
                <Wand2 className="h-5 w-5" />
                <span className="text-xs font-semibold">المؤثرات والتعديل</span>
              </button>
              <button
                type="button"
                onClick={onDelete}
                className="rounded-full bg-black/45 p-2 text-white backdrop-blur"
                aria-label="حذف"
              >
                <Trash2 className="h-5 w-5" />
              </button>
            </>
          )}

          {!isMine && (
            <button
              type="button"
              onClick={() => setGiftOpen((o) => !o)}
              className={`flex items-center gap-1.5 rounded-full bg-black/45 px-3 py-2 text-white backdrop-blur ${giftOpen ? "text-amber-400" : ""}`}
              aria-label="صندوق الهدايا"
            >
              <Gift className="h-5 w-5" />
              <span className="text-xs font-semibold">صندوق الهدايا</span>
            </button>
          )}
        </div>

      </div>


      {/* Comments bottom sheet */}
      {showComments && (
        <div
          className="absolute inset-0 z-40 flex flex-col justify-end bg-black/60 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) setShowComments(false); }}
        >
          <div className="max-h-[70vh] rounded-t-3xl border-t border-border bg-card p-4 shadow-elegant">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-bold">التعليقات</h3>
              <button type="button" onClick={() => setShowComments(false)} className="rounded-full p-2 hover:bg-muted">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-3 overflow-y-auto pb-4" style={{ maxHeight: "45vh" }}>
              {comments.isLoading && <div className="flex justify-center py-3"><Loader2 className="h-4 w-4 animate-spin" /></div>}
              {comments.data?.map((comment) => {
                const commentName = publicName(comment.author);
                return (
                  <div key={comment.id} className="flex gap-2">
                    <Avatar className="h-7 w-7 shrink-0">
                      <AvatarFallback className="text-xs">{commentName.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 rounded-xl bg-muted px-3 py-2">
                      <p className="text-xs font-semibold">{commentName}</p>
                      <p className="text-sm">{comment.content}</p>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex items-end gap-1 border-t border-border pt-3">
              <Textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="اكتب تعليقاً..."
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
        </div>
      )}
    </section>
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-border bg-card p-4 shadow-elegant">
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
              <video ref={previewRef} src={fileUrl} onLoadedMetadata={onLoadedMeta} controls playsInline className="max-h-72 w-full rounded-lg bg-black" />

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
    </div>
  );
}

function VideosPage() {
  const { user, loading } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [muted, setMuted] = useState(true);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<VideoRow | null>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);


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
      const musicPaths = Array.from(new Set(rows.map((r) => r.music_path).filter(Boolean) as string[]));
      if (musicPaths.length) {
        const { data: signedMusic } = await supabase.storage.from("story-music").createSignedUrls(musicPaths, 60 * 60);
        const mmap = new Map<string, string>();
        signedMusic?.forEach((s) => { if (s.path && s.signedUrl) mmap.set(s.path, s.signedUrl); });
        for (const r of rows) if (r.music_path) r._musicUrl = mmap.get(r.music_path);
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

  const q = search.trim().toLowerCase();
  const list = (videos.data ?? []).filter((v) => {
    if (!q) return true;
    return (
      v.title.toLowerCase().includes(q) ||
      (v.author?.username ?? "").toLowerCase().includes(q) ||
      (v.author?.full_name ?? "").toLowerCase().includes(q) ||
      (v.music_title ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="relative h-screen w-full overflow-hidden bg-black">
      {/* Minimal floating top bar for the immersive feed */}
      <div className="fixed top-0 left-0 right-0 z-30 flex items-center gap-2 p-4 pt-[env(safe-area-inset-top,16px)]">
        <Link to="/" className="flex shrink-0 items-center gap-1 rounded-full bg-black/40 px-3 py-1.5 text-white backdrop-blur">
          <ChevronLeft className="h-4 w-4" />
          <span className="text-sm font-bold">وَصْل</span>
        </Link>

        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-white/70" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ابحث في الفيديوهات…"
            className="h-9 w-full rounded-full border border-white/20 bg-black/40 pe-9 ps-3 text-sm text-white placeholder:text-white/60 backdrop-blur outline-none focus:border-primary"
          />
        </div>

        <Button
          size="sm"
          onClick={() => setOpen(true)}
          className="shrink-0 gap-1 rounded-full shadow-elegant"
        >
          <Plus className="h-4 w-4" />
          رفع
        </Button>
      </div>

      <main className="h-screen w-full overflow-y-auto snap-y snap-mandatory bg-black" ref={scrollerRef}>
        {videos.isLoading && (
          <div className="flex h-screen w-full items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}
        {videos.data && list.length === 0 && (
          <div className="flex h-screen w-full flex-col items-center justify-center p-8 text-center text-white">
            <VideoIcon className="mx-auto h-16 w-16 text-white/50" />
            <p className="mt-4 text-lg font-semibold">{q ? "لا نتائج مطابقة" : "لا توجد فيديوهات بعد"}</p>
            <p className="text-white/70">{q ? "جرّب كلمة بحث أخرى" : 'اضغط "رفع" لمشاركة أول فيديو'}</p>
          </div>
        )}
        {list.map((v) => (
          <ReelItem
            key={v.id}
            v={v}
            userId={user.id}
            isMine={v.author_id === user.id}
            muted={muted}
            onToggleMute={() => setMuted((m) => !m)}
            onView={() => onView(v.id)}
            onDelete={() => del(v)}
            onEdit={() => setEditing(v)}
          />
        ))}
      </main>

      {open && user && (
        <UploadPanel
          userId={user.id}
          onClose={() => setOpen(false)}
          onDone={() => { setOpen(false); qc.invalidateQueries({ queryKey: ["videos"] }); }}
        />
      )}

      {editing && (
        <VideoEditPanel
          video={editing}
          filters={VIDEO_FILTERS}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); qc.invalidateQueries({ queryKey: ["videos"] }); }}
          onDelete={() => { const v = editing; setEditing(null); del(v); }}
        />
      )}
    </div>
  );
}

