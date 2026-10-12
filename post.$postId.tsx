import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { PostCard, type FeedPost } from "@/components/PostCard";

export const Route = createFileRoute("/post/$postId")({
  component: PostPage,
  head: () => ({
    meta: [
      { title: "منشور — وَصْل" },
      { name: "description", content: "شاهد المنشور والتعليقات والتفاعلات عليه في تطبيق وَصْل." },
      { property: "og:title", content: "منشور — وَصْل" },
      { property: "og:description", content: "شاهد المنشور والتعليقات والتفاعلات عليه في تطبيق وَصْل." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

function PostPage() {
  const { postId } = Route.useParams();
  const { user } = useAuth();

  const post = useQuery({
    queryKey: ["post", postId, user?.id],
    queryFn: async (): Promise<FeedPost | null> => {
      const { data, error } = await supabase
        .from("posts")
        .select(`
          id, content, image_url, video_url, created_at, author_id,
          author:profiles!posts_author_id_fkey(username, full_name, avatar_url, is_verified),
          likes(user_id), comments(id), gifts(id), shares(id)
        `)
        .eq("id", postId)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const p = data as any;
      return {
        id: p.id,
        content: p.content,
        image_url: p.image_url,
        video_url: p.video_url,
        created_at: p.created_at,
        author_id: p.author_id,
        author: p.author,
        likes_count: p.likes?.length ?? 0,
        comments_count: p.comments?.length ?? 0,
        gifts_count: p.gifts?.length ?? 0,
        shares_count: p.shares?.length ?? 0,
        liked_by_me: (p.likes ?? []).some((l: any) => l.user_id === user?.id),
      };
    },
  });

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-2xl px-4 py-6">
        <Button asChild variant="ghost" size="sm" className="mb-3">
          <Link to="/">
            <ArrowRight className="h-4 w-4" /> رجوع إلى الرئيسية
          </Link>
        </Button>

        {post.isLoading && (
          <div className="flex justify-center py-16">
            <Loader2 className="animate-spin text-muted-foreground" />
          </div>
        )}

        {!post.isLoading && !post.data && (
          <div className="rounded-2xl border border-border bg-card p-8 text-center">
            <h1 className="mb-1 text-lg font-bold">المنشور غير متاح</h1>
            <p className="text-sm text-muted-foreground">قد يكون صاحبه حذفه أو أن الرابط غير صحيح.</p>
          </div>
        )}

        {post.data && (
          <>
            <h1 className="sr-only">منشور في وَصْل</h1>
            <PostCard post={post.data} />
          </>
        )}
      </main>
    </div>
  );
}
