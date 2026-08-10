import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles, Send, Loader2, ImagePlus, X, Video as VideoIcon } from "lucide-react";
import { toast } from "sonner";
import { improvePost } from "@/lib/ai.functions";
import { friendlyError } from "@/lib/friendly-error";
import { assertAllowedUpload } from "@/lib/upload-guard";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

export function PostComposer() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [content, setContent] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");
  const [video, setVideo] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState<string>("");
  const [aiLoading, setAiLoading] = useState(false);
  const improveFn = useServerFn(improvePost);
  const fileRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);

  const onPickImage = (f: File | null) => {
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) return toast.error("الحد الأقصى للصور 5MB");
    setImage(f);
    setImagePreview(URL.createObjectURL(f));
  };
  const onPickVideo = (f: File | null) => {
    if (!f) return;
    if (f.size > 50 * 1024 * 1024) return toast.error("الحد الأقصى للفيديو 50MB");
    setVideo(f);
    setVideoPreview(URL.createObjectURL(f));
  };

  const publish = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("غير مسجّل");
      const text = content.trim();
      if (!text && !image && !video) throw new Error("اكتب شيئاً أو ارفع وسائط");
      let image_url: string | null = null;
      let video_url: string | null = null;
      if (image) {
        const { contentType, ext } = assertAllowedUpload(image, ["image"]);
        const path = `${user.id}/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("post-media").upload(path, image, { contentType });
        if (upErr) throw upErr;
        image_url = supabase.storage.from("post-media").getPublicUrl(path).data.publicUrl;
      }
      if (video) {
        const { contentType, ext } = assertAllowedUpload(video, ["video"]);
        const path = `${user.id}/v-${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("post-media").upload(path, video, { contentType });
        if (upErr) throw upErr;
        video_url = supabase.storage.from("post-media").getPublicUrl(path).data.publicUrl;
      }
      const { error } = await supabase.from("posts").insert({
        author_id: user.id,
        content: text || "",
        image_url,
        video_url,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setContent("");
      setImage(null); setImagePreview("");
      setVideo(null); setVideoPreview("");
      if (fileRef.current) fileRef.current.value = "";
      if (videoRef.current) videoRef.current.value = "";
      qc.invalidateQueries({ queryKey: ["feed"] });
      qc.invalidateQueries({ queryKey: ["my-posts"] });
      toast.success("تم النشر!");
    },
    onError: (e: Error) => toast.error(friendlyError(e, "تعذّر النشر")),
  });

  const runAI = async (mode: "improve" | "expand" | "shorten" | "ideas") => {
    if (!content.trim()) return toast.error("اكتب نصاً أولاً");
    setAiLoading(true);
    try {
      const { result } = await improveFn({ data: { text: content, mode } });
      setContent(result);
      toast.success("تم بالذكاء الاصطناعي");
    } catch (e) {
      toast.error(friendlyError(e, "تعذّر تنفيذ الطلب"));
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
      <Textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="بِمَ تفكّر؟"
        rows={3}
        maxLength={5000}
        className="resize-none border-0 bg-transparent text-base shadow-none focus-visible:ring-0"
      />

      {imagePreview && (
        <div className="relative mt-2 overflow-hidden rounded-xl border border-border">
          <img src={imagePreview} alt="معاينة" className="max-h-72 w-full object-cover" />
          <Button
            size="icon"
            variant="secondary"
            className="absolute end-2 top-2 h-7 w-7"
            onClick={() => { setImage(null); setImagePreview(""); if (fileRef.current) fileRef.current.value = ""; }}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      {videoPreview && (
        <div className="relative mt-2 overflow-hidden rounded-xl border border-border">
          <video src={videoPreview} controls className="max-h-72 w-full" />
          <Button
            size="icon"
            variant="secondary"
            className="absolute end-2 top-2 h-7 w-7"
            onClick={() => { setVideo(null); setVideoPreview(""); if (videoRef.current) videoRef.current.value = ""; }}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      <div className="mt-3 flex items-center justify-between gap-2 border-t border-border pt-3">
        <div className="flex items-center gap-1">
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onPickImage(e.target.files?.[0] ?? null)} />
          <input ref={videoRef} type="file" accept="video/*" className="hidden" onChange={(e) => onPickVideo(e.target.files?.[0] ?? null)} />
          <Button variant="ghost" size="sm" onClick={() => fileRef.current?.click()} title="إرفاق صورة">
            <ImagePlus className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => videoRef.current?.click()} title="إرفاق فيديو">
            <VideoIcon className="h-4 w-4" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" disabled={aiLoading} className="text-[color:var(--ai)]">
                {aiLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                <span className="hidden sm:inline">مساعد ذكي</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={() => runAI("improve")}>✨ حسّن الصياغة</DropdownMenuItem>
              <DropdownMenuItem onClick={() => runAI("expand")}>📝 وسّع الفكرة</DropdownMenuItem>
              <DropdownMenuItem onClick={() => runAI("shorten")}>✂️ اختصر النص</DropdownMenuItem>
              <DropdownMenuItem onClick={() => runAI("ideas")}>💡 اقترح أفكاراً</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <Button
          onClick={() => publish.mutate()}
          disabled={(!content.trim() && !image && !video) || publish.isPending}
          className="shadow-elegant"
        >
          {publish.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          نشر
        </Button>
      </div>
    </div>
  );
}
