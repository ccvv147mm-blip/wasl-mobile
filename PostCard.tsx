import { VerifiedBadge } from "@/components/VerifiedBadge";
import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Heart, MessageCircle, Trash2, Send, MessageSquare, Volume2, Square, Pencil, Loader2, X } from "lucide-react";
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
import { ReportButton } from "@/components/ReportButton";
import { isAbortError } from "@/lib/abort-error";

export type FeedPost = {
  id: string;
  content: string;
  image_url: string | null;
  video_url?: string | null;
  created_at: string;
  author_id: string;
  author: { username: string; full_name: string | null; avatar_url: string | null; is_verified?: boolean | null } | null;
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
  const [voiceState, setVoice] = useState<{ blob: Blob; ms: number } | null>(null);
  const voice = voiceState;
  const [uploading, setUploading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(post.content ?? "");
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
      if (isAbortError(e)) return;
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

  const editPost = useMutation({
    mutationFn: async () => {
      const text = editText.trim();
      const { error } = await supabase.from("posts").update({ content: text }).eq("id", post.id);
      if (error) throw error;
    },
    onSuccess: () => {
      setEditing(false);
      toast.success("تم تعديل المنشور");
      qc.invalidateQueries({ queryKey: ["feed"] });
      qc.invalidateQueries({ queryKey: ["feed-friends"] });
      qc.invalidateQueries({ queryKey: ["my-posts"] });
    },
    onError: (e: Error) => toast.error(friendlyError(e, "تعذّر تعديل المنشور")),
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

  const addComment = async (voiceOverride?: { blob: Blob; ms: number }) => {
    if (!user) return;
    const voice = voiceOverride ?? voiceState;
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

  const isAdmin = useQuery({
    queryKey: ["is-admin", user?.id],
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data } = await supabase.rpc("has_role", { _user_id: user!.id, _role: "admin" });
      return !!data;
    },
  });

  const deleteComment = async (commentId: string) => {
    try {
      const { error } = await supabase.from("comments").delete().eq("id", commentId);
      if (error) throw error;
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["comments", post.id] }),
        qc.invalidateQueries({ queryKey: ["feed"] }),
      ]);
      toast.success("تم حذف التعليق");
    } catch (e) {
      toast.error(friendlyError(e, "تعذّر حذف التعليق"));
    }
  };

  const name = publicName(post.author);
  const initial = name.charAt(0);
  const isMine = user?.id === post.author_id;

  return (
    <article ref={cardRef} id={`post-${post.id}`} className="w-full border-b border-border bg-card shadow-sm transition-all sm:rounded-2xl sm:border-b-0 sm:p-5 sm:shadow-card sm:hover:shadow-elegant">
      <header className="flex items-start gap-3 px-4 py-3 sm:px-0 sm:py-0">
        <Avatar className="h-10 w-10 shrink-0">
          {post.author?.avatar_url && <AvatarImage src={post.author.avatar_url} />}
          <AvatarFallback className="gradient-primary text-primary-foreground font-bold">{initial}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="flex items-center gap-1 truncate font-semibold leading-tight" data-no-translate><span className="truncate">{name}</span><VerifiedBadge show={post.author?.is_verified} /></p>
              <p className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(post.created_at), { addSuffix: true, locale: arSA })}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {!isMine && (
                <Button asChild variant="ghost" size="icon" title="مراسلة">
                  <Link to="/messages" search={{ to: post.author_id }}>
                    <MessageSquare className="h-4 w-4 text-muted-foreground" />
                  </Link>
                </Button>
              )}
              {!isMine && <ReportButton targetType="post" targetId={post.id} />}
              {isMine && (
                <Button
                  variant="ghost"
                  size="icon"
                  title="تعديل المنشور"
                  onClick={() => { setEditText(post.content ?? ""); setEditing((s) => !s); }}
                >
                  <Pencil className="h-4 w-4 text-muted-foreground" />
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

      {editing ? (
        <div className="mt-3 space-y-2 px-4 sm:px-0">
          <Textarea
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            rows={4}
            maxLength={5000}
            className="resize-none"
          />
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={() => editPost.mutate()} disabled={editPost.isPending}>
              {editPost.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pencil className="h-4 w-4" />}
              حفظ التعديل
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
              <X className="h-4 w-4" /> إلغاء
            </Button>
          </div>
        </div>
      ) : (
        post.content && <p className="mt-3 whitespace-pre-wrap break-words px-4 text-post font-medium text-foreground sm:px-0">{post.content}</p>
      )}
      {post.image_url && (
        <img src={post.image_url} alt="مرفق" loading="lazy" className="mt-3 max-h-[78vh] w-full object-cover sm:rounded-xl" />
      )}
      {post.video_url && (
        <video src={post.video_url} controls className="mt-3 max-h-[78vh] w-full bg-black sm:rounded-xl" />
      )}

      <div className="mt-4 flex flex-wrap items-center gap-1 px-4 pt-3 sm:px-0">
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
        <div className="mt-4 space-y-3 px-4 pt-4 sm:px-0">
          {comments.data?.map((c: any) => (
            <div key={c.id} className="flex gap-2">
              <Avatar className="h-7 w-7 shrink-0">
                <AvatarFallback className="text-xs">
                  {(publicName(c.profiles)).charAt(0)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1 rounded-xl bg-muted px-3 py-2">
                <div className="flex items-start justify-between gap-2">
                  <p className="min-w-0 truncate text-xs font-semibold" data-no-translate>{publicName(c.profiles)}</p>
                  {c.author_id !== user?.id && (
                    <ReportButton targetType="comment" targetId={c.id} className="h-6 w-6 shrink-0" />
                  )}
                  {(c.author_id === user?.id || isMine || isAdmin.data) && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 shrink-0"
                      title="حذف التعليق"
                      onClick={() => deleteComment(c.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                  )}
                </div>
                {c.content && <p className="break-words text-base text-foreground">{c.content}</p>}
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
            <AudioRecorder
              onReady={(blob, ms) => { setVoice({ blob, ms }); void addComment({ blob, ms }); }}
              disabled={uploading || !!voice}
            />
            <Button size="icon" onClick={() => addComment()} disabled={uploading || (!newComment.trim() && !voice)}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
          {uploading && <UploadingHint />}
        </div>
      )}
    </article>
  );
}
