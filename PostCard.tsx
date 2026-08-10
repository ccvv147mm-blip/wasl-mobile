import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Heart, MessageCircle, Trash2, Send, MessageSquare, Volume2, Square } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { arSA } from "date-fns/locale";
import { AudioRecorder, AudioPreview, UploadingHint } from "@/components/AudioRecorder";
import { GiftButton } from "@/components/GiftDialog";
import { ShareButton } from "@/components/ShareButton";
import { speakInstant, speakStream, unlockAudio } from "@/lib/tts-stream";
import { friendlyError } from "@/lib/friendly-error";
import { assertAllowedUpload } from "@/lib/upload-guard";
import { sfx } from "@/lib/sounds";
import { stopAllMedia } from "@/lib/media-lock";
import { publicName } from "@/lib/display-name";

export type FeedPost = {
  id: string;
  content: string;
  image_url: string | null;
  video_url?: string | null;
  created_at: string;
  author_id: string;
  author: { username: string; full_name: string | null; avatar_url: string | null } | null;
  likes_count: number;
  comments_count: number;
  gifts_count: number;
  shares_count: number;
  liked_by_me: boolean;
};

export function PostCard({ post }: { post: FeedPost }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [showComments, setShowComments] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [voice, setVoice] = useState<{ blob: Blob; ms: number } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const speechRef = useRef<{ stop: () => void } | null>(null);
  const speechStartingRef = useRef(false);
  const cardRef = useRef<HTMLElement | null>(null);

  const stopSpeech = () => {
    speechRef.current?.stop();
    speechRef.current = null;
    setSpeaking(false);
  };

  useEffect(() => () => stopSpeech(), []);

  // إيقاف القراءة تلقائياً عند تمرير الصفحة وخروج المنشور من الشاشة
  useEffect(() => {
    const el = cardRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const stopOnScroll = () => {
      if (speechRef.current) stopSpeech();
    };
    const obs = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting && speechRef.current) stopSpeech();
        }
      },
      { threshold: 0.35 },
    );
    obs.observe(el);
    window.addEventListener("scroll", stopOnScroll, { passive: true });
    return () => {
      obs.disconnect();
      window.removeEventListener("scroll", stopOnScroll);
    };
  }, []);

  const speakPost = async () => {
    if (!post.content) return;
    if (speaking || speechStartingRef.current) { stopSpeech(); speechStartingRef.current = false; return; }
    stopAllMedia();
    speechStartingRef.current = true;
    setSpeaking(true);
    const callbacks = {
      onEnd: () => { speechStartingRef.current = false; speechRef.current = null; setSpeaking(false); },
      onStopped: () => { speechStartingRef.current = false; speechRef.current = null; setSpeaking(false); },
    };

    // يبدأ محرّك الهاتف فوراً بلا انتظار الشبكة أو إنشاء الصوت في الخادم.
    const instantHandle = speakInstant(post.content.slice(0, 1500), callbacks);
    if (instantHandle) {
      speechRef.current = instantHandle;
      speechStartingRef.current = false;
      return;
    }

    // احتياطي للمتصفحات التي لا تدعم قارئ النظام.
    const ctx = unlockAudio();
    try {
      const handle = await speakStream(post.content.slice(0, 1500), {
        ctx,
        ...callbacks,
      });
      speechRef.current = handle;
      speechStartingRef.current = false;
    } catch (e) {
      speechStartingRef.current = false;
      setSpeaking(false);
      toast.error(friendlyError(e, "تعذّر تشغيل الصوت"));
    }
  };




  const toggleLike = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("غير مسجّل");
      if (post.liked_by_me) {
        await supabase.from("likes").delete().eq("post_id", post.id).eq("user_id", user.id);
      } else {
        sfx.like();
        await supabase.from("likes").insert({ post_id: post.id, user_id: user.id });
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["feed"] }),
  });

  const deletePost = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("posts").delete().eq("id", post.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم حذف المنشور");
      qc.invalidateQueries({ queryKey: ["feed"] });
    },
  });




  const comments = useQuery({
    queryKey: ["comments", post.id],
    enabled: showComments,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("comments")
        .select("id, content, audio_url, audio_duration_ms, created_at, author_id, profiles!comments_author_id_fkey(username, full_name)")
        .eq("post_id", post.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const addComment = async () => {
    if (!user) return;
    const text = newComment.trim();
    if (!text && !voice) return toast.error("اكتب تعليقاً أو سجّل صوتاً");
    setUploading(true);
    try {
      let audio_url: string | null = null;
      let audio_duration_ms: number | null = null;
      if (voice) {
        const type = voice.blob.type || "audio/webm";
        const ext = type.includes("ogg")
          ? "ogg"
          : type.includes("mp4") || type.includes("aac") || type.includes("m4a")
            ? "m4a"
            : type.includes("mpeg") || type.includes("mp3")
              ? "mp3"
              : type.includes("wav")
                ? "wav"
                : "webm";
        const { contentType, ext: safeExt } = assertAllowedUpload(
          { type: type || "audio/webm" },
          ["audio"],
        );
        void ext;
        const path = `${user.id}/${post.id}-${Date.now()}.${safeExt}`;
        const { error: upErr } = await supabase.storage.from("voice-comments").upload(path, voice.blob, {
          contentType,
          upsert: false,
        });
        if (upErr) {
          console.error("[voice-comment] upload failed", upErr);
          throw upErr;
        }
        const { data } = supabase.storage.from("voice-comments").getPublicUrl(path);
        audio_url = data.publicUrl;
        audio_duration_ms = voice.ms;
      }
      const { error } = await supabase.from("comments").insert({
        post_id: post.id,
        author_id: user.id,
        content: text || null,
        audio_url,
        audio_duration_ms,
      });
      if (error) {
        console.error("[voice-comment] insert failed", error);
        throw error;
      }
      sfx.comment();
      setNewComment("");
      setVoice(null);
      setShowComments(true);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["comments", post.id] }),
        qc.refetchQueries({ queryKey: ["comments", post.id] }),
        qc.invalidateQueries({ queryKey: ["feed"] }),
      ]);
      if (audio_url) toast.success("تم إضافة تعليقك الصوتي");
    } catch (e: any) {
      // keep the recording so the user can retry without re-recording
      toast.error(friendlyError(e, "تعذّر إرسال التعليق"));
    } finally {
      setUploading(false);
    }
  };

  const name = publicName(post.author);
  const initial = name.charAt(0);
  const isMine = user?.id === post.author_id;

  return (
    <article ref={cardRef} id={`post-${post.id}`} className="rounded-2xl border border-border bg-card p-5 shadow-card transition-all hover:shadow-elegant">
      <header className="flex items-start gap-3">
        <Avatar className="h-10 w-10">
          {post.author?.avatar_url && <AvatarImage src={post.author.avatar_url} />}
          <AvatarFallback className="gradient-primary text-primary-foreground font-bold">{initial}</AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold leading-tight" data-no-translate>{name}</p>
              <p className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(post.created_at), { addSuffix: true, locale: arSA })}
              </p>
            </div>
            <div className="flex items-center gap-1">
              {!isMine && (
                <Button asChild variant="ghost" size="icon" title="مراسلة">
                  <Link to="/messages" search={{ to: post.author_id }}>
                    <MessageSquare className="h-4 w-4 text-muted-foreground" />
                  </Link>
                </Button>
              )}
              {isMine && (
                <Button variant="ghost" size="icon" onClick={() => deletePost.mutate()}>
                  <Trash2 className="h-4 w-4 text-muted-foreground" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      {post.content && <p className="mt-3 whitespace-pre-wrap text-[15px] leading-relaxed">{post.content}</p>}
      {post.image_url && (
        <img src={post.image_url} alt="مرفق" loading="lazy" className="mt-3 max-h-[480px] w-full rounded-xl border border-border object-cover" />
      )}
      {post.video_url && (
        <video src={post.video_url} controls className="mt-3 max-h-[480px] w-full rounded-xl border border-border bg-black" />
      )}

      <div className="mt-4 flex flex-wrap items-center gap-1 border-t border-border pt-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => toggleLike.mutate()}
          className={post.liked_by_me ? "text-destructive" : ""}
        >
          <Heart className={`h-4 w-4 ${post.liked_by_me ? "fill-current" : ""}`} />
          {post.likes_count > 0 && post.likes_count}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setShowComments((s) => !s)}>
          <MessageCircle className="h-4 w-4" />
          {post.comments_count > 0 && post.comments_count}
        </Button>
        <ShareButton postId={post.id} count={post.shares_count} content={post.content} />
        <GiftButton postId={post.id} recipientId={post.author_id} count={post.gifts_count} />
        {post.content && (
          <Button variant="ghost" size="sm" onClick={speakPost} title="استمع للمنشور">
            {speaking ? <Square className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </Button>
        )}
      </div>

      {showComments && (
        <div className="mt-4 space-y-3 border-t border-border pt-4">
          {comments.data?.map((c: any) => (
            <div key={c.id} className="flex gap-2">
              <Avatar className="h-7 w-7">
                <AvatarFallback className="text-xs">
                  {(publicName(c.profiles)).charAt(0)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 rounded-xl bg-muted px-3 py-2">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs font-semibold" data-no-translate>{publicName(c.profiles)}</p>
                </div>
                {c.content && <p className="text-sm">{c.content}</p>}
                {c.audio_url && (
                  <div className="mt-1">
                    <audio src={c.audio_url} controls preload="metadata" className="h-8 w-full max-w-xs" />
                    <p className="mt-0.5 text-[10px] text-muted-foreground">تعليق صوتي</p>
                  </div>
                )}

              </div>
            </div>
          ))}


          {voice && <AudioPreview blob={voice.blob} onClear={() => setVoice(null)} />}

          <div className="flex items-end gap-1">
            <Textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="اكتب تعليقاً..."
              rows={1}
              className="resize-none"
              disabled={uploading}
            />
            <AudioRecorder onReady={(blob, ms) => setVoice({ blob, ms })} disabled={uploading || !!voice} />
            <Button size="icon" onClick={addComment} disabled={uploading || (!newComment.trim() && !voice)}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
          {uploading && <UploadingHint />}
        </div>
      )}
    </article>
  );
}
