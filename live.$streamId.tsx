import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useCredits } from "@/hooks/use-credits";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, Eye, Gift, Radio, Send, PhoneOff, Mic, MicOff, VideoOff, Video as VideoIcon } from "lucide-react";
import { toast } from "sonner";
import { friendlyError } from "@/lib/friendly-error";
import { publicName } from "@/lib/display-name";
import { startHosting, startWatching } from "@/lib/live-rtc";

export const Route = createFileRoute("/live/$streamId")({
  component: LiveRoom,
  head: () => ({
    meta: [
      { title: "غرفة بث مباشر — وَصْل" },
      { name: "description", content: "شاهد البث المباشر بالكاميرا، شارك في الدردشة اللحظية، وأرسل هدايا للمضيف على وَصْل." },
      { property: "og:title", content: "غرفة بث مباشر — وَصْل" },
      { property: "og:description", content: "بث مباشر بالكاميرا مع دردشة لحظية وهدايا فورية للمضيف." },
      { property: "og:type", content: "video.other" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "غرفة بث مباشر — وَصْل" },
      { name: "twitter:description", content: "بث مباشر بالكاميرا مع دردشة لحظية وهدايا فورية للمضيف." },
    ],
  }),
});

const GIFTS = [
  { type: "rose", emoji: "🌹", name: "وردة", value: 5 },
  { type: "heart", emoji: "❤️", name: "قلب", value: 10 },
  { type: "star", emoji: "⭐", name: "نجمة", value: 25 },
  { type: "crown", emoji: "👑", name: "تاج", value: 100 },
  { type: "diamond", emoji: "💎", name: "ألماسة", value: 500 },
  { type: "lion", emoji: "🦁", name: "أسد", value: 5000 },
];

type ChatRow = {
  id: string;
  author_id: string;
  content: string;
  created_at: string;
  profiles: { username: string; full_name: string | null; avatar_url: string | null } | null;
};

function LiveRoom() {
  const { streamId } = Route.useParams();
  const { user, loading } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const hostSessionRef = useRef<{ stop: () => void } | null>(null);
  const [state, setState] = useState<"idle" | "connecting" | "live" | "ended" | "failed">("idle");
  const [viewers, setViewers] = useState(0);
  const [muted, setMuted] = useState(false);
  const [camOff, setCamOff] = useState(false);
  const [msg, setMsg] = useState("");
  const [chat, setChat] = useState<ChatRow[]>([]);
  const [floating, setFloating] = useState<{ id: string; emoji: string }[]>([]);
  const [sendingGift, setSendingGift] = useState<string | null>(null);

  const balance = useCredits(user?.id, true);

  const stream = useQuery({
    enabled: !!user,
    queryKey: ["live-stream", streamId],
    refetchInterval: 15000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("live_streams")
        .select("id, host_id, title, status, viewers_count, total_gift_points, profiles:host_id(username, full_name, avatar_url)")
        .eq("id", streamId)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as {
        id: string; host_id: string; title: string; status: string;
        viewers_count: number; total_gift_points: number;
        profiles: { username: string; full_name: string | null; avatar_url: string | null } | null;
      } | null;
    },
  });

  const isHost = !!user && stream.data?.host_id === user.id;
  const ended = stream.data?.status !== "live";

  // ---- الكاميرا / الاتصال ----
  useEffect(() => {
    if (!user || !stream.data || ended) return;
    let cancelled = false;

    if (isHost) {
      setState("connecting");
      void (async () => {
        try {
          const media = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: "user", width: { ideal: 1280 } },
            audio: true,
          });
          if (cancelled) { media.getTracks().forEach((t) => t.stop()); return; }
          localStreamRef.current = media;
          if (videoRef.current) {
            videoRef.current.srcObject = media;
            videoRef.current.muted = true;
            void videoRef.current.play().catch(() => {});
          }
          hostSessionRef.current = startHosting({
            streamId,
            stream: media,
            onViewersChange: (count) => {
              setViewers(count);
              void supabase.rpc("set_live_viewers", { _stream_id: streamId, _count: count });
            },
          });
          setState("live");
        } catch (e) {
          setState("failed");
          toast.error(friendlyError(e, "تعذّر الوصول للكاميرا أو الميكروفون"));
        }
      })();
    } else {
      const session = startWatching({
        streamId,
        onStream: (remote) => {
          if (videoRef.current) {
            videoRef.current.srcObject = remote;
            void videoRef.current.play().catch(() => {});
          }
        },
        onState: setState,
      });
      hostSessionRef.current = session;
    }

    return () => {
      cancelled = true;
      hostSessionRef.current?.stop();
      hostSessionRef.current = null;
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    };
  }, [user, isHost, streamId, stream.data?.id, ended]);

  // ---- الدردشة والهدايا اللحظية ----
  useEffect(() => {
    if (!user) return;
    void (async () => {
      const { data } = await supabase
        .from("live_chat_messages")
        .select("id, author_id, content, created_at, profiles:author_id(username, full_name, avatar_url)")
        .eq("stream_id", streamId)
        .order("created_at", { ascending: true })
        .limit(100);
      setChat((data ?? []) as unknown as ChatRow[]);
    })();

    const ch = supabase
      .channel(`live-room-${streamId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "live_chat_messages", filter: `stream_id=eq.${streamId}` },
        async ({ new: row }) => {
          const r = row as { id: string; author_id: string; content: string; created_at: string };
          const { data: p } = await supabase.from("profiles").select("username, full_name, avatar_url").eq("id", r.author_id).maybeSingle();
          setChat((prev) => [...prev, { ...r, profiles: p as ChatRow["profiles"] }].slice(-120));
        })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "live_gifts", filter: `stream_id=eq.${streamId}` },
        ({ new: row }) => {
          const g = row as { id: string; gift_type: string };
          const emoji = GIFTS.find((x) => x.type === g.gift_type)?.emoji ?? "🎁";
          setFloating((prev) => [...prev, { id: g.id, emoji }]);
          setTimeout(() => setFloating((prev) => prev.filter((f) => f.id !== g.id)), 3000);
          void stream.refetch();
        })
      .subscribe();

    return () => void supabase.removeChannel(ch);
  }, [user, streamId]);

  const sendMessage = async () => {
    const content = msg.trim();
    if (!content) return;
    setMsg("");
    const { error } = await supabase.from("live_chat_messages").insert({ stream_id: streamId, author_id: user!.id, content });
    if (error) toast.error(friendlyError(error, "تعذّر إرسال الرسالة"));
  };

  const sendGift = async (type: string, value: number) => {
    setSendingGift(type);
    try {
      const { error } = await supabase.rpc("send_live_gift", { _stream_id: streamId, _gift_type: type, _value: value });
      if (error) throw error;
      toast.success("تم إرسال الهدية 🎁");
      void balance.refetch();
    } catch (e) {
      toast.error(friendlyError(e, "رصيد غير كافٍ أو خطأ"));
    } finally {
      setSendingGift(null);
    }
  };

  const endStream = async () => {
    if (!confirm("إنهاء البث المباشر؟")) return;
    try {
      const { error } = await supabase.rpc("end_live_stream", { _stream_id: streamId });
      if (error) throw error;
      hostSessionRef.current?.stop();
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      toast.success("تم إنهاء البث");
      void stream.refetch();
    } catch (e) {
      toast.error(friendlyError(e, "تعذّر إنهاء البث"));
    }
  };

  const toggleMic = () => {
    const track = localStreamRef.current?.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setMuted(!track.enabled);
  };
  const toggleCam = () => {
    const track = localStreamRef.current?.getVideoTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setCamOff(!track.enabled);
  };

  if (loading) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="animate-spin" /></div>;
  if (!user) return <Navigate to="/login" />;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-3xl px-3 py-4">
        {stream.isLoading ? (
          <div className="flex justify-center py-10"><Loader2 className="animate-spin text-muted-foreground" /></div>
        ) : !stream.data ? (
          <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            هذا البث غير موجود. <Link to="/live" className="text-primary underline">عودة للبثوث</Link>
          </div>
        ) : (
          <>
            <div className="relative overflow-hidden rounded-2xl border border-border bg-black shadow-card">
              <video ref={videoRef} playsInline autoPlay className="aspect-[9/12] w-full bg-black object-cover sm:aspect-video" />

              <div className="absolute start-3 top-3 flex items-center gap-2">
                {!ended ? (
                  <span className="flex items-center gap-1 rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-bold text-white">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" /> مباشر
                  </span>
                ) : (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold">انتهى البث</span>
                )}
                <span className="flex items-center gap-1 rounded-full bg-black/50 px-2 py-0.5 text-[10px] text-white">
                  <Eye className="h-3 w-3" /> {isHost ? viewers : stream.data.viewers_count}
                </span>
                <span className="flex items-center gap-1 rounded-full bg-black/50 px-2 py-0.5 text-[10px] text-white">
                  <Gift className="h-3 w-3 text-amber-400" /> {stream.data.total_gift_points}
                </span>
              </div>

              <div className="absolute bottom-3 start-3 flex items-center gap-2 rounded-full bg-black/50 px-2 py-1">
                <Avatar className="h-7 w-7">
                  <AvatarImage src={stream.data.profiles?.avatar_url ?? undefined} />
                  <AvatarFallback>{publicName(stream.data.profiles).charAt(0)}</AvatarFallback>
                </Avatar>
                <span className="text-xs font-semibold text-white" data-no-translate>{publicName(stream.data.profiles)}</span>
              </div>

              {/* هدايا متطايرة */}
              <div className="pointer-events-none absolute inset-0 overflow-hidden">
                {floating.map((f) => (
                  <span key={f.id} className="absolute bottom-6 end-8 animate-[float-up_3s_ease-out_forwards] text-4xl">
                    {f.emoji}
                  </span>
                ))}
              </div>

              {state === "connecting" && !ended && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-sm text-white">
                  <Loader2 className="me-2 h-4 w-4 animate-spin" /> جارٍ الاتصال بالبث...
                </div>
              )}
              {state === "failed" && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/70 p-4 text-center text-sm text-white">
                  تعذّر الاتصال بالبث. تأكد من الإنترنت وحاول تحديث الصفحة.
                </div>
              )}
            </div>

            <h1 className="mt-3 flex items-center gap-2 text-base font-bold">
              <Radio className="h-4 w-4 text-red-500" /> {stream.data.title}
            </h1>

            {isHost ? (
              <div className="mt-3 flex gap-2">
                <Button variant="secondary" size="sm" onClick={toggleMic} className="gap-1">
                  {muted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />} {muted ? "تشغيل الصوت" : "كتم"}
                </Button>
                <Button variant="secondary" size="sm" onClick={toggleCam} className="gap-1">
                  {camOff ? <VideoOff className="h-4 w-4" /> : <VideoIcon className="h-4 w-4" />} {camOff ? "تشغيل الكاميرا" : "إيقاف الكاميرا"}
                </Button>
                {!ended && (
                  <Button variant="destructive" size="sm" onClick={endStream} className="gap-1">
                    <PhoneOff className="h-4 w-4" /> إنهاء
                  </Button>
                )}
              </div>
            ) : (
              !ended && (
                <div className="mt-3 rounded-2xl border border-border bg-card p-3">
                  <p className="mb-2 text-xs text-muted-foreground">
                    رصيدك: <span className="font-bold text-foreground">{balance.data ?? "..."}</span> نقطة
                  </p>
                  <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
                    {GIFTS.map((g) => (
                      <button
                        key={g.type}
                        onClick={() => sendGift(g.type, g.value)}
                        disabled={sendingGift !== null || (balance.data ?? 0) < g.value}
                        className="flex shrink-0 flex-col items-center rounded-xl border border-border px-3 py-2 text-center transition hover:border-primary/60 disabled:opacity-40"
                      >
                        <span className="text-2xl">{g.emoji}</span>
                        <span className="text-[11px] font-semibold">{g.name}</span>
                        <span className="text-[10px] text-muted-foreground">{g.value} نقطة</span>
                      </button>
                    ))}
                  </div>
                </div>
              )
            )}

            {/* الدردشة */}
            <div className="mt-4 rounded-2xl border border-border bg-card">
              <div className="max-h-72 space-y-2 overflow-y-auto p-3">
                {chat.length === 0 ? (
                  <p className="py-6 text-center text-xs text-muted-foreground">لا رسائل بعد — ابدأ الدردشة</p>
                ) : (
                  chat.map((c) => (
                    <div key={c.id} className="flex items-start gap-2">
                      <Avatar className="h-7 w-7">
                        <AvatarImage src={c.profiles?.avatar_url ?? undefined} />
                        <AvatarFallback>{publicName(c.profiles).charAt(0)}</AvatarFallback>
                      </Avatar>
                      <p className="text-sm">
                        <span className="font-semibold" data-no-translate>{publicName(c.profiles)}</span>{" "}
                        <span className="text-muted-foreground">{c.content}</span>
                      </p>
                    </div>
                  ))
                )}
              </div>
              {!ended && (
                <form
                  onSubmit={(e) => { e.preventDefault(); void sendMessage(); }}
                  className="flex gap-2 border-t border-border p-2"
                >
                  <Input value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="اكتب رسالة..." maxLength={300} />
                  <Button type="submit" size="sm" className="shrink-0"><Send className="h-4 w-4" /></Button>
                </form>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
