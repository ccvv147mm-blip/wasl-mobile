import { VerifiedBadge } from "@/components/VerifiedBadge";
import { createFileRoute, Navigate, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Header } from "@/components/Header";
import { VoiceChat } from "@/components/VoiceChat";
import { StoriesBar } from "@/components/StoriesBar";
import { PostComposer } from "@/components/PostComposer";
import { PostCard, type FeedPost } from "@/components/PostCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { Loader2, Camera, ImagePlus, Coins, Wallet, Pencil, Users, ChevronDown, ChevronUp } from "lucide-react";
import { friendlyError } from "@/lib/friendly-error";
import { assertAllowedUpload } from "@/lib/upload-guard";
import { listFriends } from "@/lib/friends.functions";

export const Route = createFileRoute("/profile")({
  component: ProfilePage,
  head: () => ({
    meta: [
      { title: "صفحتي الشخصية — وَصْل" },
      {
        name: "description",
        content: "أدر صفحتك في وَصْل: صورتك وغلافك ونبذتك واهتماماتك، انشر منشوراتك، وتحدّث مع صفحتك عبر الذكاء الاصطناعي.",
      },
      { property: "og:title", content: "صفحتي الشخصية — وَصْل" },
      {
        property: "og:description",
        content: "صفحتك الشخصية في وَصْل: منشوراتك، رصيد نقاطك، والمحادثة الذكية مع صفحتك.",
      },
      { property: "og:url", content: "https://arab-spark-ai.lovable.app/profile" },
      { name: "robots", content: "noindex, follow" },
    ],
    links: [{ rel: "canonical", href: "https://arab-spark-ai.lovable.app/profile" }],
  }),
});


function ProfilePage() {
  const { user, loading } = useAuth();
  const qc = useQueryClient();
  const [fullName, setFullName] = useState("");
  const [bio, setBio] = useState("");
  const [interests, setInterests] = useState("");
  const [saving, setSaving] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [uploading, setUploading] = useState<"avatar" | "cover" | null>(null);
  const [friendsOpen, setFriendsOpen] = useState(false);
  const avatarRef = useRef<HTMLInputElement>(null);
  const coverRef = useRef<HTMLInputElement>(null);
  const friendsFn = useServerFn(listFriends);

  useEffect(() => {
    const f = localStorage.getItem("profile-friends-open");
    if (f !== null) setFriendsOpen(f === "1");
  }, []);

  useEffect(() => {
    localStorage.setItem("profile-friends-open", friendsOpen ? "1" : "0");
  }, [friendsOpen]);

  const profile = useQuery({
    enabled: !!user,
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, username, full_name, bio, avatar_url, cover_url, interests, country, credits, created_at, updated_at, is_verified")
        .eq("id", user!.id)
        .single();
      if (error) throw error;
      return data;
    },
    refetchInterval: 8000,
    refetchOnWindowFocus: true,
  });


  const myPosts = useQuery({
    enabled: !!user,
    queryKey: ["my-posts", user?.id],
    queryFn: async (): Promise<FeedPost[]> => {
      const { data, error } = await supabase
        .from("posts")
        .select("id, content, image_url, video_url, created_at, author_id, likes(user_id), comments(id), gifts(id), shares(id)")
        .eq("author_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return (data ?? []).map((p: any) => ({
        id: p.id, content: p.content, image_url: p.image_url, video_url: p.video_url, created_at: p.created_at, author_id: p.author_id,
        author: { username: profile.data?.username ?? "", full_name: profile.data?.full_name ?? null, avatar_url: profile.data?.avatar_url ?? null },
        likes_count: p.likes?.length ?? 0,
        comments_count: p.comments?.length ?? 0,
        gifts_count: p.gifts?.length ?? 0,
        shares_count: p.shares?.length ?? 0,
        liked_by_me: (p.likes ?? []).some((l: any) => l.user_id === user?.id),
      }));
    },
  });

  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel("my-posts-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "posts", filter: `author_id=eq.${user.id}` }, () => {
        qc.invalidateQueries({ queryKey: ["my-posts", user.id] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, qc]);

  useEffect(() => {
    if (profile.data) {
      setFullName(profile.data.full_name || "");
      setBio(profile.data.bio || "");
      setInterests(profile.data.interests || "");
    }
  }, [profile.data]);

  const friends = useQuery({
    enabled: !!user,
    queryKey: ["profile-friends", user?.id],
    queryFn: async () => {
      const { friends: rows } = await friendsFn({ data: undefined as any });
      return rows ?? [];
    },
  });

  const save = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: fullName, bio, interests, updated_at: new Date().toISOString() })
      .eq("id", user!.id);
    setSaving(false);
    if (error) return toast.error(friendlyError(error, "تعذّر حفظ التغييرات"));
    toast.success("تم الحفظ");
    setEditOpen(false);
    qc.invalidateQueries({ queryKey: ["profile"] });
  };

  const uploadImage = async (file: File, kind: "avatar" | "cover") => {
    if (file.size > 5 * 1024 * 1024) return toast.error("الحد الأقصى 5MB");
    setUploading(kind);
    try {
      const { contentType, ext } = assertAllowedUpload(file, ["image"]);
      const path = `${user!.id}/${kind}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, { contentType, upsert: false });
      if (upErr) throw upErr;
      const url = supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl;
      const update = kind === "avatar" ? { avatar_url: url } : { cover_url: url };
      const { error } = await supabase.from("profiles").update(update).eq("id", user!.id);
      if (error) throw error;
      toast.success("تم تحديث الصورة");
      qc.invalidateQueries({ queryKey: ["profile"] });
    } catch (e) {
      toast.error(friendlyError(e, "تعذّر الرفع"));
    } finally {
      setUploading(null);
    }
  };

  if (loading) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="animate-spin" /></div>;
  if (!user) return <Navigate to="/login" />;

  const name = profile.data?.full_name || profile.data?.username || "أنا";

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto w-full max-w-3xl px-0 py-4 sm:px-4 sm:py-6">
        <div className="overflow-hidden rounded-none border-x-0 border-t-0 border-b border-border bg-card shadow-none sm:rounded-2xl sm:border sm:border-border sm:shadow-card">
          {/* Cover */}
          <div className="relative h-32 w-full bg-muted sm:h-44">
            {profile.data?.cover_url ? (
              <img src={profile.data.cover_url} alt="غلاف" className="h-full w-full object-cover" />
            ) : (
              <div className="h-full w-full gradient-primary" />
            )}
            <input ref={coverRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && uploadImage(e.target.files[0], "cover")} />
            <Button
              size="sm" variant="secondary"
              className="absolute end-3 top-3 shadow-elegant"
              onClick={() => coverRef.current?.click()}
              disabled={uploading === "cover"}
            >
              {uploading === "cover" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />}
              غلاف
            </Button>
          </div>

          {/* Avatar + name */}
          <div className="-mt-10 flex items-end gap-4 px-4 sm:px-6">
            <div className="relative">
              <Avatar className="h-24 w-24 border-4 border-card">
                {profile.data?.avatar_url && <AvatarImage src={profile.data.avatar_url} />}
                <AvatarFallback className="gradient-primary text-2xl font-bold text-primary-foreground">{name.charAt(0)}</AvatarFallback>
              </Avatar>
              <input ref={avatarRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && uploadImage(e.target.files[0], "avatar")} />
              <button
                onClick={() => avatarRef.current?.click()}
                disabled={uploading === "avatar"}
                className="absolute -end-1 -bottom-1 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-elegant disabled:opacity-50"
                title="تغيير الصورة"
              >
                {uploading === "avatar" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-4 w-4" />}
              </button>
            </div>
            <div className="pb-2">
              <h1 className="flex items-center gap-1.5 text-2xl font-bold">{name}<VerifiedBadge show={(profile.data as any)?.is_verified} className="h-6 w-6" /></h1>
              <p className="text-xs text-muted-foreground">@{profile.data?.username} · خاص بك ولا يظهر للآخرين</p>
            </div>
          </div>

          {/* VoiceChat right under the avatar */}
          <div className="mt-4 px-4 sm:px-6">
            <VoiceChat />
          </div>

          {/* Credits + earnings link */}
          <div className="mt-4 flex flex-wrap items-center gap-2 px-4 pb-2 sm:px-6">
            <div className="flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-sm">
              <Coins className="h-4 w-4 text-amber-500" />
              <span className="font-bold">{profile.data?.credits ?? 0}</span>
              <span className="text-xs text-muted-foreground">نقطة</span>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link to="/earnings"><Wallet className="h-4 w-4" /> الأرباح</Link>
            </Button>
          </div>

          {/* Edit trigger — form lives in a side panel */}
          <div className="p-4 pt-2 sm:p-6 sm:pt-2">
            <Sheet open={editOpen} onOpenChange={setEditOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" className="w-full sm:w-auto">
                  <Pencil className="h-4 w-4" /> تعديل بياناتي
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[88vw] overflow-y-auto sm:max-w-md">
                <SheetHeader>
                  <SheetTitle>تعديل بياناتي</SheetTitle>
                </SheetHeader>
                <div className="mt-6 space-y-4">
                  <div>
                    <Label htmlFor="name">الاسم الكامل</Label>
                    <Input id="name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
                  </div>
                  <div>
                    <Label htmlFor="bio">النبذة</Label>
                    <Textarea id="bio" value={bio} onChange={(e) => setBio(e.target.value)} rows={3} maxLength={300} placeholder="عرّف عن نفسك..." />
                  </div>
                  <div>
                    <Label htmlFor="interests">اهتماماتك (تساعد الخلاصة الذكية)</Label>
                    <Textarea id="interests" value={interests} onChange={(e) => setInterests(e.target.value)} rows={2} maxLength={500} placeholder="مثلاً: تقنية، أدب، رياضة..." />
                  </div>
                  <Button onClick={save} disabled={saving} className="w-full shadow-elegant">
                    {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                    حفظ التغييرات
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>

        {/* Friends list */}
        {friends.data && friends.data.length > 0 && (
          <section className="mx-4 mt-4 rounded-2xl border border-border bg-card p-4 shadow-card sm:mx-0">
            <div className="mb-3 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setFriendsOpen((v) => !v)}
                className="flex items-center gap-2"
                aria-expanded={friendsOpen}
              >
                <Users className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-bold">أصدقائي</h2>
                {friendsOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
              </button>
              <Button asChild size="sm" variant="ghost"><Link to="/friends">الكل</Link></Button>
            </div>
            {friendsOpen && (
              <div className="flex gap-3 overflow-x-auto pb-1">
                {friends.data.map((f: any) => (
                  <Link key={f.id} to="/profile" search={{ userId: f.id }} className="shrink-0 flex flex-col items-center gap-1.5 w-16">
                    <div className="h-14 w-14 overflow-hidden rounded-full border-2 border-primary/20 bg-muted">
                      {f.avatar_url ? (
                        <img src={f.avatar_url} alt={f.username} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-xs font-bold text-muted-foreground">
                          {(f.full_name || f.username || "").slice(0, 1)}
                        </div>
                      )}
                    </div>
                    <p className="w-full truncate text-center text-[11px] font-semibold">{f.full_name || f.username}</p>
                  </Link>
                ))}
              </div>
            )}
          </section>
        )}

        <div className="mt-6 px-4 sm:px-0">
          <StoriesBar />
        </div>

        {/* Post composer + my posts (mirrors home feed) */}
        <div className="mt-6 px-4 sm:px-0">
          <PostComposer />
        </div>
        <div className="mt-6">
          <h2 className="mb-3 px-4 text-lg font-bold sm:px-0">منشوراتي</h2>
          <div>
            {myPosts.isLoading && <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>}
            {myPosts.data && myPosts.data.length === 0 && (
              <div className="mx-4 rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground sm:mx-0">
                لم تنشر شيئاً بعد.
              </div>
            )}
            {myPosts.data?.map((p) => <PostCard key={p.id} post={p} />)}
          </div>
        </div>
      </main>
    </div>
  );
}
