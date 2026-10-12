import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Plus, X, Eye, Trash2, Sparkles, UserRoundCheck, ChevronLeft, ChevronRight, Music2, Volume2, VolumeX } from "lucide-react";
import { toast } from "sonner";
import { friendlyError } from "@/lib/friendly-error";
import { assertAllowedUpload } from "@/lib/upload-guard";
import { publicName } from "@/lib/display-name";
import { StoryMusicPicker, signMusic, type StoryMusic } from "@/components/StoryMusicPicker";

type Story = {
  id: string;
  author_id: string;
  image_url: string;
  caption: string | null;
  created_at: string;
  expires_at: string;
  music_url: string | null;
  music_title: string | null;
  author: { full_name: string | null; avatar_url: string | null } | null;
};

type Group = { author_id: string; author: Story["author"]; stories: Story[] };

const STORY_MS = 5000;

export function StoriesBar() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<File | null>(null);
  const [caption, setCaption] = useState("");
  const [alsoAvatar, setAlsoAvatar] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [music, setMusic] = useState<StoryMusic | null>(null);
  const [openGroup, setOpenGroup] = useState<number | null>(null);

  const stories = useQuery({
    enabled: !!user,
    queryKey: ["stories"],
    refetchInterval: 60000,
    queryFn: async (): Promise<Story[]> => {
      const { data, error } = await supabase
        .from("stories")
        .select("id, author_id, image_url, caption, created_at, expires_at, music_url, music_title, author:profiles!stories_author_id_fkey(full_name, avatar_url)")
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: true })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as unknown as Story[];
    },
  });

  const groups = useMemo<Group[]>(() => {
    const map = new Map<string, Group>();
    for (const s of stories.data ?? []) {
      const g = map.get(s.author_id) ?? { author_id: s.author_id, author: s.author, stories: [] };
      g.stories.push(s);
      map.set(s.author_id, g);
    }
    const all = Array.from(map.values());
    // My own glimpses first
    all.sort((a, b) => (a.author_id === user?.id ? -1 : b.author_id === user?.id ? 1 : 0));
    return all;
  }, [stories.data, user?.id]);

  const upload = async () => {
    if (!pending || !user) return;
    if (pending.size > 8 * 1024 * 1024) return toast.error("الحد الأقصى 8MB");
    setUploading(true);
    try {
      const { contentType, ext } = assertAllowedUpload(pending, ["image"]);
      const path = `${user.id}/story-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("avatars").upload(path, pending, { contentType });
      if (upErr) throw upErr;
      const url = supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl;
      const { error } = await supabase.from("stories").insert({
        author_id: user.id,
        image_url: url,
        caption: caption.trim() ? caption.trim().slice(0, 120) : null,
        music_url: music?.path ?? null,
        music_title: music?.title ?? null,
      });
      if (error) throw error;
      if (alsoAvatar) {
        const { error: pErr } = await supabase.from("profiles").update({ avatar_url: url }).eq("id", user.id);
        if (pErr) throw pErr;
        qc.invalidateQueries({ queryKey: ["profile"] });
      }
      toast.success("تم نشر لمحتك ✨ تختفي بعد ٢٤ ساعة");
      setPending(null);
      setCaption("");
      setAlsoAvatar(false);
      setMusic(null);
      qc.invalidateQueries({ queryKey: ["stories"] });
    } catch (e) {
      toast.error(friendlyError(e, "تعذّر نشر اللمحة"));
    } finally {
      setUploading(false);
    }
  };

  if (!user) return null;

  return (
    <section className="rounded-2xl border border-border bg-card p-3 shadow-card">
      <div className="mb-2 flex items-center gap-2 px-1">
        <Sparkles className="h-4 w-4 text-[color:var(--ai)]" />
        <h2 className="text-sm font-bold">لمحات اليوم</h2>
        <span className="text-[11px] text-muted-foreground">تختفي بعد ٢٤ ساعة</span>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: "none" }}>
        {/* Add */}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) setPending(f);
            e.target.value = "";
          }}
        />
        <button type="button" onClick={() => fileRef.current?.click()} className="group w-20 shrink-0 text-center">
          <div className="relative mx-auto flex h-20 w-20 items-center justify-center rounded-2xl border border-dashed border-border bg-muted/50 transition group-hover:border-primary">
            <Plus className="h-6 w-6 text-primary" />
          </div>
          <p className="mt-1 line-clamp-1 text-[11px] font-semibold">أضف لمحة</p>
        </button>

        {groups.map((g, i) => (
          <button key={g.author_id} type="button" onClick={() => setOpenGroup(i)} className="w-20 shrink-0 text-center">
            <div className="relative mx-auto h-20 w-20 overflow-hidden rounded-2xl p-[2px]" style={{ backgroundImage: "var(--gradient-primary)" }}>
              <img src={g.stories[g.stories.length - 1]!.image_url} alt="" className="h-full w-full rounded-[14px] object-cover" />
              <span className="absolute bottom-1 start-1">
                <Avatar className="h-6 w-6 border-2 border-card">
                  {g.author?.avatar_url && <AvatarImage src={g.author.avatar_url} />}
                  <AvatarFallback className="text-[9px]">{publicName(g.author).charAt(0)}</AvatarFallback>
                </Avatar>
              </span>
              {g.stories.length > 1 && (
                <span className="absolute end-1 top-1 rounded-full bg-background/80 px-1.5 text-[10px] font-bold">{g.stories.length}</span>
              )}
            </div>
            <p className="mt-1 line-clamp-1 text-[11px] font-semibold">
              {g.author_id === user.id ? "لمحاتي" : publicName(g.author)}
            </p>
          </button>
        ))}

        {stories.isLoading && (
          <div className="flex h-20 items-center px-3"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
        )}
      </div>

      {/* Composer sheet */}
      {pending && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => !uploading && setPending(null)}>
          <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-4" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-bold">لمحة جديدة</h3>
              <Button size="icon" variant="ghost" onClick={() => setPending(null)} disabled={uploading}><X className="h-4 w-4" /></Button>
            </div>
            <img src={URL.createObjectURL(pending)} alt="معاينة اللمحة" className="mb-3 max-h-64 w-full rounded-xl object-cover" />
            <Input value={caption} onChange={(e) => setCaption(e.target.value)} maxLength={120} placeholder="اكتب تعليقاً قصيراً (اختياري)" />
            <StoryMusicPicker value={music} onChange={setMusic} disabled={uploading} />
            <label className="mt-3 flex cursor-pointer items-center gap-2 rounded-xl border border-border p-2 text-xs">
              <input type="checkbox" checked={alsoAvatar} onChange={(e) => setAlsoAvatar(e.target.checked)} />
              <UserRoundCheck className="h-4 w-4 text-primary" />
              اجعلها أيضاً صورتي الشخصية
            </label>
            <Button className="mt-3 w-full shadow-elegant" onClick={upload} disabled={uploading}>
              {uploading && <Loader2 className="h-4 w-4 animate-spin" />} نشر اللمحة
            </Button>
          </div>
        </div>
      )}

      {openGroup !== null && groups[openGroup] && (
        <StoryViewer
          groups={groups}
          startIndex={openGroup}
          onClose={() => setOpenGroup(null)}
          onDeleted={() => qc.invalidateQueries({ queryKey: ["stories"] })}
        />
      )}
    </section>
  );
}

function StoryViewer({
  groups,
  startIndex,
  onClose,
  onDeleted,
}: {
  groups: Group[];
  startIndex: number;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const { user } = useAuth();
  const [gi, setGi] = useState(startIndex);
  const [si, setSi] = useState(0);
  const [progress, setProgress] = useState(0);
  const [muted, setMuted] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const group = groups[gi]!;
  const story = group.stories[si];

  // تشغيل أغنية اللمحة تلقائياً مع تبديل اللمحات
  useEffect(() => {
    let cancelled = false;
    audioRef.current?.pause();
    audioRef.current = null;
    const path = story?.music_url;
    if (!path) return;
    (async () => {
      const url = await signMusic(path);
      if (!url || cancelled) return;
      const a = new Audio(url);
      a.loop = true;
      a.muted = muted;
      a.volume = 1;
      audioRef.current = a;
      await a.play().catch(() => {});
    })();
    return () => {
      cancelled = true;
      audioRef.current?.pause();
      audioRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [story?.id]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.muted = muted;
  }, [muted]);

  const [viewersOpen, setViewersOpen] = useState(false);
  useEffect(() => { setViewersOpen(false); }, [gi, si]);


  const next = () => {
    if (si + 1 < group.stories.length) { setSi(si + 1); return; }
    if (gi + 1 < groups.length) { setGi(gi + 1); setSi(0); return; }
    onClose();
  };
  const prev = () => {
    if (si > 0) { setSi(si - 1); return; }
    if (gi > 0) { const g = groups[gi - 1]!; setGi(gi - 1); setSi(g.stories.length - 1); }
  };

  // auto-advance
  useEffect(() => {
    setProgress(0);
    const started = Date.now();
    const t = setInterval(() => {
      const p = Math.min(1, (Date.now() - started) / STORY_MS);
      setProgress(p);
      if (p >= 1) { clearInterval(t); next(); }
    }, 60);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gi, si]);

  // record view
  useEffect(() => {
    if (!user || !story || story.author_id === user.id) return;
    supabase.from("story_views").upsert({ story_id: story.id, viewer_id: user.id }, { ignoreDuplicates: true }).then(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [story?.id]);

  const views = useQuery({
    enabled: !!story && story.author_id === user?.id,
    queryKey: ["story-views", story?.id],
    queryFn: async () => {
      const { count } = await supabase
        .from("story_views")
        .select("*", { count: "exact", head: true })
        .eq("story_id", story!.id);
      return count ?? 0;
    },
  });

  const viewers = useQuery({
    enabled: !!story && story.author_id === user?.id && viewersOpen,
    queryKey: ["story-viewers", story?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("story_views")
        .select("viewer_id, created_at, viewer:profiles!story_views_viewer_id_fkey(full_name, avatar_url)")
        .eq("story_id", story!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Array<{
        viewer_id: string;
        created_at: string;
        viewer: { full_name: string | null; avatar_url: string | null } | null;
      }>;
    },
  });


  if (!story) return null;

  const remove = async () => {
    const { error } = await supabase.from("stories").delete().eq("id", story.id);
    if (error) return toast.error(friendlyError(error, "تعذّر الحذف"));
    toast.success("تم حذف اللمحة");
    onDeleted();
    onClose();
  };

  const hoursLeft = Math.max(0, Math.round((new Date(story.expires_at).getTime() - Date.now()) / 3600000));

  return (
    <div className="fixed inset-0 z-50 bg-black">
      {/* progress bars */}
      <div className="absolute inset-x-0 top-0 z-10 flex gap-1 p-2">
        {group.stories.map((_, i) => (
          <div key={i} className="h-0.5 flex-1 overflow-hidden rounded-full bg-white/30">
            <div className="h-full bg-white" style={{ width: i < si ? "100%" : i === si ? `${progress * 100}%` : "0%" }} />
          </div>
        ))}
      </div>

      <div className="absolute inset-x-0 top-4 z-10 flex items-center gap-2 px-3 pt-2">
        <Avatar className="h-8 w-8 border border-white/40">
          {group.author?.avatar_url && <AvatarImage src={group.author.avatar_url} />}
          <AvatarFallback className="text-xs">{publicName(group.author).charAt(0)}</AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <p className="text-sm font-bold text-white">{group.author_id === user?.id ? "لمحاتي" : publicName(group.author)}</p>
          <p className="text-[11px] text-white/70">تختفي بعد {hoursLeft} ساعة</p>
        </div>
        {story.music_url && (
          <button
            onClick={() => setMuted((m) => !m)}
            className="rounded-full bg-white/15 p-2 text-white"
            title={muted ? "تشغيل الصوت" : "كتم الصوت"}
          >
            {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>
        )}
        {story.author_id === user?.id && (
          <>
            <button
              onClick={() => setViewersOpen((v) => !v)}
              className="flex items-center gap-1 rounded-full bg-white/15 px-2 py-1 text-[11px] text-white"
              title="من شاهد لمحتي"
            >
              <Eye className="h-3.5 w-3.5" /> {views.data ?? 0}
            </button>
            <button onClick={remove} className="rounded-full bg-white/15 p-2 text-white" title="حذف">
              <Trash2 className="h-4 w-4" />
            </button>
          </>
        )}

        <button onClick={onClose} className="rounded-full bg-white/15 p-2 text-white" title="إغلاق">
          <X className="h-4 w-4" />
        </button>
      </div>

      <img src={story.image_url} alt={story.caption ?? "لمحة"} className="h-full w-full object-contain" />

      {story.caption && (
        <p className="absolute inset-x-0 bottom-16 px-6 text-center text-base font-semibold text-white drop-shadow-lg">{story.caption}</p>
      )}

      {story.music_url && (
        <div className="pointer-events-none absolute inset-x-0 bottom-28 flex justify-center">
          <span className="flex max-w-[80%] items-center gap-2 rounded-full bg-black/50 px-3 py-1 text-[11px] font-semibold text-white">
            <Music2 className="h-3.5 w-3.5 animate-pulse" />
            <span className="line-clamp-1">{story.music_title || "أغنية"}</span>
          </span>
        </div>
      )}

      {/* tap zones */}
      <button onClick={prev} className="absolute inset-y-0 start-0 w-1/3" aria-label="السابق" />
      <button onClick={next} className="absolute inset-y-0 end-0 w-1/3" aria-label="التالي" />
      <div className="absolute bottom-4 inset-x-0 flex items-center justify-center gap-6 text-white/70">
        <button onClick={prev} aria-label="السابق"><ChevronRight className="h-6 w-6" /></button>
        <button onClick={next} aria-label="التالي"><ChevronLeft className="h-6 w-6" /></button>
      </div>

      {viewersOpen && story.author_id === user?.id && (
        <div className="absolute inset-x-0 bottom-0 z-20 max-h-[55%] overflow-y-auto rounded-t-2xl bg-background p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-bold">من شاهد لمحتي ({views.data ?? 0})</p>
            <button onClick={() => setViewersOpen(false)} aria-label="إغلاق"><X className="h-4 w-4" /></button>
          </div>
          {viewers.isLoading ? (
            <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : (viewers.data?.length ?? 0) === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">لا أحد شاهد هذه اللمحة بعد</p>
          ) : (
            <ul className="space-y-3">
              {viewers.data!.map((v) => (
                <li key={v.viewer_id} className="flex items-center gap-3">
                  <Avatar className="h-9 w-9">
                    {v.viewer?.avatar_url && <AvatarImage src={v.viewer.avatar_url} />}
                    <AvatarFallback className="text-xs">{publicName(v.viewer).charAt(0)}</AvatarFallback>
                  </Avatar>
                  <span className="flex-1 truncate text-sm font-medium">{publicName(v.viewer)}</span>
                  <span className="text-[11px] text-muted-foreground">
                    {new Date(v.created_at).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );

}
