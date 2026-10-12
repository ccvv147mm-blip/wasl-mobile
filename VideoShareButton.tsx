import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Share2, Link2, Send, UserPlus, MessageCircle, Facebook, Twitter, Linkedin, Mail, Camera, Store, Apple } from "lucide-react";
import { toast } from "sonner";
import { sfx } from "@/lib/sounds";
import { PLAY_STORE_URL, APP_STORE_URL, storeInviteText } from "@/lib/app-stores";

export function VideoShareButton({
  videoId,
  title,
  count,
  vertical = true,
}: {
  videoId: string;
  title?: string | null;
  count: number;
  vertical?: boolean;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const url = typeof window !== "undefined" ? `${window.location.origin}/videos?video=${videoId}` : "";
  const text = (title ?? "").slice(0, 180);
  const shareText = text ? `${text}\n\n${url}` : url;

  const record = async () => {
    if (!user) return;
    sfx.share();
    await supabase.from("video_shares").insert({ video_id: videoId, user_id: user.id });
    qc.invalidateQueries({ queryKey: ["videos"] });
  };

  const openWin = (u: string) => window.open(u, "_blank", "noopener,noreferrer");

  const handlers = {
    copy: async () => {
      await navigator.clipboard.writeText(url);
      toast.success("تم نسخ رابط الفيديو");
      await record();
    },
    native: async () => {
      try {
        if (navigator.share) await navigator.share({ title: "فيديو على وَصْل", text, url });
      } catch {/* cancelled */}
      await record();
    },
    profile: async () => {
      if (!user) return;
      const { error } = await supabase.from("posts").insert({
        author_id: user.id,
        content: text ? `🔁 شاركت فيديو:\n\n"${text}"\n\n${url}` : `🔁 شاركت فيديو: ${url}`,
      });
      if (error) return toast.error("تعذّرت المشاركة");
      toast.success("تمت المشاركة على صفحتك");
      await record();
    },
    facebook: async () => { openWin(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`); await record(); },
    twitter: async () => { openWin(`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`); await record(); },
    whatsapp: async () => { openWin(`https://wa.me/?text=${encodeURIComponent(shareText)}`); await record(); },
    telegram: async () => { openWin(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`); await record(); },
    linkedin: async () => { openWin(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`); await record(); },
    messenger: async () => { openWin(`https://www.facebook.com/dialog/send?link=${encodeURIComponent(url)}&app_id=140586622674265&redirect_uri=${encodeURIComponent(url)}`); await record(); },
    email: async () => { openWin(`mailto:?subject=${encodeURIComponent("فيديو على وَصْل")}&body=${encodeURIComponent(shareText)}`); await record(); },
    playStore: async () => {
      const t = `${shareText}\n\n${storeInviteText(url)}`;
      try {
        if (navigator.share) await navigator.share({ title: "وَصْل على Google Play", text: t, url: PLAY_STORE_URL });
        else { await navigator.clipboard.writeText(t); toast.success("تم نسخ رابط المتجر والفيديو"); }
      } catch {/* cancelled */}
      await record();
    },
    appStore: async () => {
      const t = `${shareText}\n\n${storeInviteText(url)}`;
      try {
        if (navigator.share) await navigator.share({ title: "وَصْل على App Store", text: t, url: APP_STORE_URL });
        else { await navigator.clipboard.writeText(t); toast.success("تم نسخ رابط المتجر والفيديو"); }
      } catch {/* cancelled */}
      await record();
    },
    instagram: async () => {
      await navigator.clipboard.writeText(shareText);
      toast.success("تم نسخ النص — الصقه في قصتك أو منشورك");
      await record();
    },
  };

  const trigger = vertical ? (
    <button
      type="button"
      className="flex flex-col items-center gap-1 text-white drop-shadow"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="rounded-full bg-black/40 p-2.5 backdrop-blur">
        <Share2 className="h-6 w-6" />
      </div>
      <span className="text-xs font-semibold">{count || "مشاركة"}</span>
    </button>
  ) : (
    <Button variant="ghost" size="sm">
      <Share2 className="h-4 w-4" />
      {count > 0 && count}
    </Button>
  );


  return (
    <DropdownMenu open={open} onOpenChange={setOpen} modal={false}>
      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
        {trigger}
      </DropdownMenuTrigger>
      {open && (
        <div
          className="fixed inset-0 z-40"
          onPointerDown={() => setOpen(false)}
          onTouchStart={() => setOpen(false)}
          aria-hidden
        />
      )}
      <DropdownMenuContent
        align={vertical ? "end" : "center"}
        side={vertical ? "left" : "bottom"}
        className="z-50 w-56"
        onPointerDownOutside={() => setOpen(false)}
        onInteractOutside={() => setOpen(false)}
      >
        <DropdownMenuItem onClick={handlers.profile}>
          <UserPlus className="h-4 w-4" /> مشاركة على صفحتي
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handlers.copy}>
          <Link2 className="h-4 w-4" /> نسخ الرابط
        </DropdownMenuItem>
        {typeof navigator !== "undefined" && "share" in navigator && (
          <DropdownMenuItem onClick={handlers.native}>
            <Send className="h-4 w-4" /> مشاركة عبر الجهاز
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handlers.whatsapp}>
          <MessageCircle className="h-4 w-4 text-green-600" /> واتساب
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handlers.facebook}>
          <Facebook className="h-4 w-4 text-blue-600" /> فيسبوك
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handlers.messenger}>
          <Send className="h-4 w-4 text-blue-500" /> ماسنجر
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handlers.twitter}>
          <Twitter className="h-4 w-4" /> X (تويتر)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handlers.telegram}>
          <Send className="h-4 w-4 text-sky-500" /> تيليجرام
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handlers.linkedin}>
          <Linkedin className="h-4 w-4 text-blue-700" /> لينكدإن
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handlers.instagram}>
          <Camera className="h-4 w-4 text-pink-600" /> إنستجرام (نسخ)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handlers.email}>
          <Mail className="h-4 w-4" /> بريد إلكتروني
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handlers.playStore}>
          <Store className="h-4 w-4 text-emerald-600" /> مشاركة عبر متجر Play
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handlers.appStore}>
          <Apple className="h-4 w-4" /> مشاركة عبر App Store
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
