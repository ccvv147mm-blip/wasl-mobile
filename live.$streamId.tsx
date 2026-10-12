import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useCredits } from "@/hooks/use-credits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, Eye, Gift, Send, PhoneOff, Mic, MicOff, VideoOff, Video as VideoIcon, Gamepad2, X, ArrowRight, Users, Sparkles, Radio } from "lucide-react";
import { toast } from "sonner";
import { friendlyError } from "@/lib/friendly-error";
import { publicName } from "@/lib/display-name";
import { startHosting, startWatching } from "@/lib/live-rtc";
import { LiveGames } from "@/components/LiveGames";
import { LiveInvite } from "@/components/LiveInvite";
import { LiveNowList } from "@/components/LiveNowList";

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

const FILTERS = [
  { id: "none", name: "بدون", css: "none" },
  { id: "bright", name: "إشراق", css: "brightness(1.15) saturate(1.15)" },
  { id: "soft", name: "ناعم", css: "brightness(1.08) contrast(0.95) saturate(1.05) blur(0.4px)" },
  { id: "glow", name: "توهج", css: "brightness(1.2) contrast(1.05) saturate(1.3)" },
  { id: "warm", name: "دافئ", css: "sepia(0.25) saturate(1.3) brightness(1.05)" },
  { id: "cool", name: "بارد", css: "hue-rotate(-15deg) saturate(1.2) brightness(1.05)" },
  { id: "vivid", name: "حيوي", css: "contrast(1.25) saturate(1.6)" },
  { id: "mono", name: "أبيض وأسود", css: "grayscale(1) contrast(1.1)" },
  { id: "retro", name: "قديم", css: "sepia(0.6) contrast(1.1) saturate(0.9)" },
  { id: "night", name: "ليلي", css: "brightness(1.35) contrast(1.15) saturate(0.9)" },
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
  const [showUI, setShowUI] = useState(true);
  const [panel, setPanel] = useState<null | "games" | "gifts" | "chat" | "filters" | "livenow">(null);
  const [filterId, setFilterId] = useState("none");

  useEffect(() => {
    const saved = localStorage.getItem("wasl-live-filter");
    if (saved && FILTERS.some((f) => f.id === saved)) setFilterId(saved);
  }, []);

  const activeFilter = FILTERS.find((f) => f.id === filterId) ?? FILTERS[0];
  const pickFilter = (id: string) => {
    setFilterId(id);
    localStorage.setItem("wasl-live-filter", id);
  };

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

  // المشاركون في البث (من الدردشة)
  const participants = useMemo(() => {
    const map = new Map<string, { id: string; profiles: ChatRow["profiles"] }>();
    for (const c of chat) map.set(c.author_id, { id: c.author_id, profiles: c.profiles });
    if (stream.data) map.set(stream.data.host_id, { id: stream.data.host_id, profiles: stream.data.profiles });
    return [...map.values()];
  }, [chat, stream.data]);

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

  if (stream.isLoading) {
    return <div className="flex min-h-screen items-center justify-center bg-black"><Loader2 className="animate-spin text-white" /></div>;
  }
  if (!stream.data) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-black p-6 text-center text-sm text-white/80">
        هذا البث غير موجود.
        <Link to="/live" className="text-primary underline">عودة للبثوث</Link>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black">
      {/* الفيديو بملء الشاشة */}
      <video
        ref={videoRef}
        playsInline
        autoPlay
        onClick={() => { if (panel) setPanel(null); else setShowUI((v) => !v); }}
        className="h-full w-full object-cover transition-[filter] duration-300"
        style={{ filter: activeFilter.css }}
      />

      {/* شرائح المعلومات أعلى الشاشة */}
      <div className={`pointer-events-none absolute inset-x-0 top-0 p-3 transition-opacity ${showUI ? "opacity-100" : "opacity-0"}`}>
        <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2">
          <Link
            to="/live"
            className="pointer-events-auto grid h-9 w-9 shrink-0 place-items-center rounded-full bg-black/50 text-white"
            aria-label="رجوع"
          >
            <ArrowRight className="h-4 w-4" />
          </Link>
          <div className="pointer-events-auto flex min-w-0 items-center gap-2 rounded-full bg-black/45 px-2 py-1 backdrop-blur-sm">
            <Avatar className="h-7 w-7 shrink-0">
              <AvatarImage src={stream.data.profiles?.avatar_url ?? undefined} />
              <AvatarFallback>{publicName(stream.data.profiles).charAt(0)}</AvatarFallback>
            </Avatar>
            <span className="truncate text-xs font-semibold text-white" data-no-translate>{publicName(stream.data.profiles)}</span>
            {!ended ? (
              <span className="flex shrink-0 items-center gap-1 rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-bold text-white">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" /> مباشر
              </span>
            ) : (
              <span className="shrink-0 rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-bold text-white">انتهى</span>
            )}
          </div>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1 rounded-full bg-black/50 px-2 py-0.5 text-[10px] text-white">
            <Eye className="h-3 w-3" /> {isHost ? viewers : stream.data.viewers_count}
          </span>
          <span className="flex items-center gap-1 rounded-full bg-black/50 px-2 py-0.5 text-[10px] text-white">
            <Gift className="h-3 w-3 text-amber-400" /> {stream.data.total_gift_points}
          </span>
          <span className="flex items-center gap-1 rounded-full bg-black/50 px-2 py-0.5 text-[10px] text-white">
            <Users className="h-3 w-3" /> {participants.length}
          </span>
          <span className="max-w-[60vw] truncate rounded-full bg-black/50 px-2 py-0.5 text-[10px] text-white">{stream.data.title}</span>
        </div>
      </div>

      {/* تعليقات متطايرة */}
      <div className={`pointer-events-none absolute bottom-28 start-3 end-16 flex flex-col justify-end gap-1 transition-opacity ${showUI ? "opacity-100" : "opacity-0"}`}>
        {chat.slice(-5).map((c) => (
          <div key={c.id} className="flex items-center gap-2 self-start rounded-full bg-black/45 px-2 py-1 backdrop-blur-sm">
            <Avatar className="h-5 w-5">
              <AvatarImage src={c.profiles?.avatar_url ?? undefined} />
              <AvatarFallback className="text-[9px]">{publicName(c.profiles).charAt(0)}</AvatarFallback>
            </Avatar>
            <span className="text-[11px] font-bold text-white" data-no-translate>{publicName(c.profiles)}</span>
            <span className="max-w-[55vw] truncate text-[11px] text-white/90">{c.content}</span>
          </div>
        ))}
      </div>

      {/* هدايا متطايرة */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {floating.map((f) => (
          <span key={f.id} className="absolute bottom-24 end-8 animate-[float-up_3s_ease-out_forwards] text-4xl">{f.emoji}</span>
        ))}
      </div>

      {state === "connecting" && !ended && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/50 text-sm text-white">
          <Loader2 className="me-2 h-4 w-4 animate-spin" /> جارٍ الاتصال بالبث...
        </div>
      )}
      {state === "failed" && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-white">
          تعذّر الاتصال بالبث. تأكد من الإنترنت وحاول تحديث الصفحة.
        </div>
      )}

      {/* شريط الأدوات السفلي */}
      <div className={`absolute inset-x-0 bottom-0 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] transition-opacity ${showUI ? "opacity-100" : "pointer-events-none opacity-0"}`}>
        {!ended && (
          <form
            onSubmit={(e) => { e.preventDefault(); void sendMessage(); }}
            className="mb-2 flex gap-2"
          >
            <Input
              value={msg}
              onChange={(e) => setMsg(e.target.value)}
              placeholder="اكتب رسالة..."
              maxLength={300}
              className="border-white/20 bg-black/45 text-white placeholder:text-white/50"
            />
            <Button type="submit" size="sm" className="shrink-0"><Send className="h-4 w-4" /></Button>
          </form>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="secondary" className="gap-1" onClick={() => setPanel("games")}>
            <Gamepad2 className="h-4 w-4" /> الألعاب
          </Button>
          {!isHost && !ended && (
            <Button size="sm" variant="secondary" className="gap-1" onClick={() => setPanel("gifts")}>
              <Gift className="h-4 w-4" /> هدايا
            </Button>
          )}
          <Button size="sm" variant="secondary" className="gap-1" onClick={() => setPanel("chat")}>
            <Users className="h-4 w-4" /> الدردشة
          </Button>
          <Button size="sm" variant="secondary" className="gap-1" onClick={() => setPanel("filters")}>
            <Sparkles className="h-4 w-4" /> فلاتر
          </Button>
          <Button size="sm" variant="secondary" className="gap-1" onClick={() => setPanel("livenow")}>
            <Radio className="h-4 w-4 text-red-500" /> بثوث الآن
          </Button>
          {isHost && (
            <>
              <Button size="sm" variant="secondary" className="gap-1" onClick={toggleMic}>
                {muted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </Button>
              <Button size="sm" variant="secondary" className="gap-1" onClick={toggleCam}>
                {camOff ? <VideoOff className="h-4 w-4" /> : <VideoIcon className="h-4 w-4" />}
              </Button>
              {!ended && (
                <Button size="sm" variant="destructive" className="gap-1" onClick={endStream}>
                  <PhoneOff className="h-4 w-4" /> إنهاء
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {/* لوحة منبثقة داخل البث */}
      {panel && (
        <div className="absolute inset-0 z-10 flex flex-col justify-end bg-black/40" onClick={() => setPanel(null)}>
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-h-[78%] overflow-y-auto rounded-t-3xl border-t border-white/10 bg-neutral-900/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] text-white backdrop-blur-md"
          >
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-bold">
                {panel === "games" ? "الألعاب والتحديات" : panel === "gifts" ? "إرسال هدية" : panel === "filters" ? "فلاتر الصورة" : panel === "livenow" ? "بثوث مباشرة الآن" : "الدردشة والمشاركون"}
              </h2>
              <button onClick={() => setPanel(null)} aria-label="إغلاق" className="grid h-8 w-8 place-items-center rounded-full bg-white/10">
                <X className="h-4 w-4" />
              </button>
            </div>

            {panel === "filters" && (
              <div>
                <p className="mb-2 text-xs text-white/70">اختر فلتراً لتحسين صورة البث — يُحفظ اختيارك تلقائياً.</p>
                <div className="grid grid-cols-4 gap-2">
                  {FILTERS.map((f) => (
                    <button
                      key={f.id}
                      onClick={() => pickFilter(f.id)}
                      className={`flex flex-col items-center gap-1 rounded-xl border p-1.5 transition ${
                        filterId === f.id ? "border-primary bg-primary/15" : "border-white/15 hover:border-white/40"
                      }`}
                    >
                      <span
                        className="h-12 w-full rounded-lg bg-gradient-to-br from-amber-200 via-rose-400 to-indigo-600"
                        style={{ filter: f.css }}
                      />
                      <span className="text-[10px] font-semibold">{f.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {panel === "livenow" && (
              <div className="space-y-2">
                <p className="text-xs text-white/70">
                  كل المستخدمين الذين يبثون مباشرة الآن — أرسل لهم طلب دعوة للعب أو للدردشة، أو ادخل بثهم.
                </p>
                <LiveNowList userId={user.id} currentStreamId={streamId} />
              </div>
            )}

            {panel === "games" && (
              <div className="space-y-3">
                <LiveGames
                  streamId={streamId}
                  isHost={isHost}
                  userId={user.id}
                  ended={ended}
                  onBalanceChange={() => void balance.refetch()}
                />
                <LiveInvite streamId={streamId} userId={user.id} viewers={participants} />
              </div>
            )}

            {panel === "gifts" && (
              <div>
                <p className="mb-2 text-xs text-white/70">
                  رصيدك: <span className="font-bold text-white">{balance.data ?? "..."}</span> نقطة
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {GIFTS.map((g) => (
                    <button
                      key={g.type}
                      onClick={() => sendGift(g.type, g.value)}
                      disabled={sendingGift !== null || (balance.data ?? 0) < g.value}
                      className="flex flex-col items-center rounded-xl border border-white/15 px-3 py-2 text-center transition hover:border-primary/60 disabled:opacity-40"
                    >
                      <span className="text-2xl">{g.emoji}</span>
                      <span className="text-[11px] font-semibold">{g.name}</span>
                      <span className="text-[10px] text-white/60">{g.value} نقطة</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {panel === "chat" && (
              <div className="space-y-3">
                <div className="max-h-56 space-y-2 overflow-y-auto">
                  {chat.length === 0 ? (
                    <p className="py-6 text-center text-xs text-white/60">لا رسائل بعد — ابدأ الدردشة</p>
                  ) : (
                    chat.map((c) => (
                      <div key={c.id} className="flex items-start gap-2">
                        <Avatar className="h-7 w-7">
                          <AvatarImage src={c.profiles?.avatar_url ?? undefined} />
                          <AvatarFallback>{publicName(c.profiles).charAt(0)}</AvatarFallback>
                        </Avatar>
                        <p className="text-sm">
                          <span className="font-semibold" data-no-translate>{publicName(c.profiles)}</span>{" "}
                          <span className="text-white/70">{c.content}</span>
                        </p>
                      </div>
                    ))
                  )}
                </div>
                <LiveInvite streamId={streamId} userId={user.id} viewers={participants} />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
