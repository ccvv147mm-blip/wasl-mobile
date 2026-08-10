import { createFileRoute, Link, Navigate, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, Radio, Eye, Gift, Video } from "lucide-react";
import { toast } from "sonner";
import { friendlyError } from "@/lib/friendly-error";
import { publicName } from "@/lib/display-name";

export const Route = createFileRoute("/live/")({
  component: LiveIndex,
  head: () => ({
    meta: [
      { title: "البث المباشر — وَصْل" },
      {
        name: "description",
        content: "ابدأ بثاً مباشراً بالكاميرا على وَصْل أو شاهد البثوث الجارية الآن، وأرسل الهدايا للمضيفين لحظياً بنقاطك.",
      },
      { property: "og:title", content: "البث المباشر — وَصْل" },
      {
        property: "og:description",
        content: "بثوث مباشرة بالكاميرا مع دردشة لحظية وهدايا للمضيفين على شبكة وَصْل.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://arabsparkcommunity.app/live" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "البث المباشر — وَصْل" },
      { name: "twitter:description", content: "بثوث مباشرة بالكاميرا مع دردشة لحظية وهدايا للمضيفين." },
    ],
    links: [{ rel: "canonical", href: "https://arabsparkcommunity.app/live" }],
  }),
});

type StreamRow = {
  id: string;
  host_id: string;
  title: string;
  viewers_count: number;
  total_gift_points: number;
  started_at: string;
  profiles: { username: string; full_name: string | null; avatar_url: string | null } | null;
};

function LiveIndex() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [starting, setStarting] = useState(false);

  const streams = useQuery({
    enabled: !!user,
    queryKey: ["live-streams"],
    refetchInterval: 10000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("live_streams")
        .select("id, host_id, title, viewers_count, total_gift_points, started_at, profiles:host_id(username, full_name, avatar_url)")
        .eq("status", "live")
        .order("started_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as unknown as StreamRow[];
    },
  });

  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel("live-streams-list")
      .on("postgres_changes", { event: "*", schema: "public", table: "live_streams" }, () => {
        void streams.refetch();
      })
      .subscribe();
    return () => void supabase.removeChannel(ch);
  }, [user, streams]);

  const goLive = async () => {
    setStarting(true);
    try {
      const { data, error } = await supabase.rpc("start_live_stream", { _title: title.trim() });
      if (error) throw error;
      navigate({ to: "/live/$streamId", params: { streamId: data as unknown as string } });
    } catch (e) {
      toast.error(friendlyError(e, "تعذّر بدء البث"));
    } finally {
      setStarting(false);
    }
  };

  if (loading) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="animate-spin" /></div>;
  if (!user) return <Navigate to="/login" />;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-3xl px-3 py-4">
        <div className="mb-5 rounded-2xl border border-border bg-card p-4 shadow-card">
          <h1 className="flex items-center gap-2 text-lg font-bold">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-500/10">
              <Radio className="h-4 w-4 text-red-500" />
            </span>
            البث المباشر
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            ابدأ بثاً بالكاميرا واستقبل الهدايا من المشاهدين لحظياً — تُضاف النقاط إلى رصيدك فوراً بعد خصم نسبة التطبيق.
          </p>
          <div className="mt-3 flex gap-2">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="عنوان البث (اختياري)"
              maxLength={80}
            />
            <Button onClick={goLive} disabled={starting} className="shrink-0 gap-1">
              {starting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Video className="h-4 w-4" />}
              ابدأ البث
            </Button>
          </div>
        </div>

        <h2 className="mb-2 text-sm font-bold text-muted-foreground">بثوث جارية الآن</h2>

        {streams.isLoading ? (
          <div className="flex justify-center py-10"><Loader2 className="animate-spin text-muted-foreground" /></div>
        ) : (streams.data?.length ?? 0) === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            لا توجد بثوث مباشرة حالياً — كن أول من يبدأ!
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {streams.data!.map((s) => (
              <Link
                key={s.id}
                to="/live/$streamId"
                params={{ streamId: s.id }}
                className="group overflow-hidden rounded-2xl border border-border bg-card p-4 shadow-card transition hover:border-primary/50"
              >
                <div className="flex items-center gap-3">
                  <Avatar className="h-11 w-11 ring-2 ring-red-500">
                    <AvatarImage src={s.profiles?.avatar_url ?? undefined} />
                    <AvatarFallback>{publicName(s.profiles).charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold" data-no-translate>{publicName(s.profiles)}</p>
                    <p className="truncate text-xs text-muted-foreground">{s.title}</p>
                  </div>
                  <span className="flex shrink-0 items-center gap-1 rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-bold text-white">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" /> مباشر
                  </span>
                </div>
                <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Eye className="h-3.5 w-3.5" /> {s.viewers_count}</span>
                  <span className="flex items-center gap-1"><Gift className="h-3.5 w-3.5 text-amber-500" /> {s.total_gift_points} نقطة</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
