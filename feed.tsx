import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Header } from "@/components/Header";
import { PostCard, type FeedPost } from "@/components/PostCard";
import { Loader2, Users, UserPlus } from "lucide-react";
import { listFriends } from "@/lib/friends.functions";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/feed")({
  component: FeedPage,
  head: () => ({
    meta: [
      { title: "خلاصة الأصدقاء — وَصْل" },
      {
        name: "description",
        content: "خلاصة خاصة بأصدقائك على وَصْل: منشورات وصور وفيديوهات من قبلتَ صداقتهم فقط، مرتّبة بأحدث المشاركات.",
      },
      { property: "og:title", content: "خلاصة الأصدقاء — وَصْل" },
      {
        property: "og:description",
        content: "تابع منشورات أصدقائك المقبولين على وَصْل في خلاصة واحدة هادئة ومرتّبة.",
      },
      { property: "og:url", content: "https://arab-spark-ai.lovable.app/feed" },
      { name: "robots", content: "noindex, follow" },
    ],
    links: [{ rel: "canonical", href: "https://arab-spark-ai.lovable.app/feed" }],
  }),
});


function FeedPage() {
  const { user, loading } = useAuth();
  const friendsFn = useServerFn(listFriends);

  const friends = useQuery({
    enabled: !!user,
    queryKey: ["friends"],
    queryFn: () => friendsFn(),
  });

  const friendIds = (friends.data?.friends ?? []).map((f: any) => f.id);

  const feed = useQuery({
    enabled: !!user && !!friends.data,
    queryKey: ["feed-friends", friendIds.length],
    queryFn: async (): Promise<FeedPost[]> => {
      const ids = [...friendIds, user!.id];
      if (ids.length === 0) return [];
      const { data: posts, error } = await supabase
        .from("posts")
        .select(`
          id, content, image_url, video_url, created_at, author_id,
          author:profiles!posts_author_id_fkey(username, full_name, avatar_url),
          likes(user_id), comments(id), gifts(id), shares(id)
        `)
        .in("author_id", ids)
        .order("created_at", { ascending: false })
        .limit(80);
      if (error) throw error;
      return (posts ?? []).map((p: any) => ({
        id: p.id, content: p.content, image_url: p.image_url, video_url: p.video_url, created_at: p.created_at, author_id: p.author_id,
        author: p.author,
        likes_count: p.likes?.length ?? 0,
        comments_count: p.comments?.length ?? 0,
        gifts_count: p.gifts?.length ?? 0,
        shares_count: p.shares?.length ?? 0,
        liked_by_me: (p.likes ?? []).some((l: any) => l.user_id === user?.id),
      }));
    },
  });

  if (loading) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="animate-spin" /></div>;
  if (!user) return <Navigate to="/login" />;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-2xl px-4 py-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl gradient-primary shadow-elegant">
              <Users className="h-4 w-4 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-bold">خلاصة الأصدقاء</h1>
              <p className="text-xs text-muted-foreground">منشورات من قبلتَ صداقتهم</p>
            </div>
          </div>
          <Button asChild size="sm" variant="outline"><Link to="/friends"><UserPlus className="h-4 w-4" /> إدارة</Link></Button>
        </div>

        {(feed.isLoading || friends.isLoading) && <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>}
        {feed.data && feed.data.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border p-10 text-center">
            <p className="text-muted-foreground">لا توجد منشورات من أصدقائك بعد.</p>
            <Button asChild className="mt-4"><Link to="/friends">أضف أصدقاء</Link></Button>
          </div>
        )}
        <div className="space-y-4">
          {feed.data?.map((p) => <PostCard key={p.id} post={p} />)}
        </div>
      </main>
    </div>
  );
}
