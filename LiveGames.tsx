import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { friendlyError } from "@/lib/friendly-error";
import { publicName } from "@/lib/display-name";
import { Gamepad2, Trophy, Zap, HelpCircle, Smile, Loader2 } from "lucide-react";

/** أنواع ألعاب التحدي داخل البث المباشر */
export const GAME_KINDS = [
  { kind: "reaction", label: "تحدي السرعة", icon: Zap, hint: "أسرع من يضغط عند ظهور الإشارة يفوز" },
  { kind: "quiz", label: "سؤال وجواب", icon: HelpCircle, hint: "اكتب السؤال والإجابة الصحيحة" },
  { kind: "emoji", label: "تحدي الإيموجي", icon: Smile, hint: "خمّن الكلمة من الرموز" },
] as const;

type GameKind = (typeof GAME_KINDS)[number]["kind"];

type Game = {
  id: string;
  stream_id: string;
  host_id: string;
  kind: GameKind;
  title: string;
  prompt: string | null;
  prize_points: number;
  status: string;
  winner_id: string | null;
};

type Participant = {
  user_id: string;
  score: number;
  profiles: { username: string; full_name: string | null; avatar_url: string | null } | null;
};

export function LiveGames({
  streamId,
  isHost,
  userId,
  ended,
  onBalanceChange,
}: {
  streamId: string;
  isHost: boolean;
  userId: string;
  ended: boolean;
  onBalanceChange?: () => void;
}) {
  const [game, setGame] = useState<Game | null>(null);
  const [players, setPlayers] = useState<Participant[]>([]);
  const [busy, setBusy] = useState(false);

  // إنشاء تحدٍ (المضيف)
  const [kind, setKind] = useState<GameKind>("reaction");
  const [title, setTitle] = useState("");
  const [prompt, setPrompt] = useState("");
  const [answer, setAnswer] = useState("");
  const [prize, setPrize] = useState("50");

  // لعب تحدي السرعة
  const [reaction, setReaction] = useState<"idle" | "wait" | "go" | "done">("idle");
  const goAtRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [myAnswer, setMyAnswer] = useState("");
  const joined = players.some((p) => p.user_id === userId);

  const loadGame = useCallback(async () => {
    const { data } = await supabase
      .from("live_games")
      .select("id, stream_id, host_id, kind, title, prompt, prize_points, status, winner_id")
      .eq("stream_id", streamId)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setGame((data as Game | null) ?? null);
  }, [streamId]);

  const loadPlayers = useCallback(async (gameId: string) => {
    const { data } = await supabase
      .from("live_game_participants")
      .select("user_id, score, profiles:user_id(username, full_name, avatar_url)")
      .eq("game_id", gameId)
      .order("score", { ascending: false })
      .limit(20);
    setPlayers((data ?? []) as unknown as Participant[]);
  }, []);

  useEffect(() => {
    void loadGame();
    const ch = supabase
      .channel(`live-games-${streamId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "live_games", filter: `stream_id=eq.${streamId}` },
        () => void loadGame())
      .on("postgres_changes", { event: "*", schema: "public", table: "live_game_participants" },
        () => { if (game?.id) void loadPlayers(game.id); })
      .subscribe();
    return () => void supabase.removeChannel(ch);
  }, [streamId, loadGame, loadPlayers, game?.id]);

  useEffect(() => {
    if (!game?.id) { setPlayers([]); return; }
    void loadPlayers(game.id);
    setReaction("idle");
    setMyAnswer("");
  }, [game?.id, loadPlayers]);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  const createGame = async () => {
    setBusy(true);
    try {
      const { error } = await supabase.rpc("start_live_game", {
        _stream_id: streamId,
        _kind: kind,
        _title: title.trim() || GAME_KINDS.find((g) => g.kind === kind)!.label,
        _prompt: prompt.trim() || undefined,
        _answer: kind === "reaction" ? undefined : answer.trim() || undefined,
        _prize_points: Math.max(0, Number(prize) || 0),
      });
      if (error) throw error;
      toast.success("بدأ التحدي 🎮");
      setTitle(""); setPrompt(""); setAnswer("");
      onBalanceChange?.();
      await loadGame();
    } catch (e) {
      toast.error(friendlyError(e, "تعذّر بدء التحدي"));
    } finally {
      setBusy(false);
    }
  };

  const endGame = async () => {
    if (!game) return;
    setBusy(true);
    try {
      const { error } = await supabase.rpc("end_live_game", { _game_id: game.id });
      if (error) throw error;
      toast.success("تم إعلان الفائز 🏆");
      onBalanceChange?.();
      await loadGame();
    } catch (e) {
      toast.error(friendlyError(e, "تعذّر إنهاء التحدي"));
    } finally {
      setBusy(false);
    }
  };

  const submit = async (score: number, ans?: string) => {
    if (!game) return;
    try {
      const { error } = await supabase.rpc("submit_live_game_score", {
        _game_id: game.id, _score: score, _answer: ans ?? undefined,
      });
      if (error) throw error;
      toast.success("تم إرسال نتيجتك ✅");
      await loadPlayers(game.id);
    } catch (e) {
      toast.error(friendlyError(e, "تعذّر إرسال النتيجة"));
    }
  };

  const startReaction = () => {
    setReaction("wait");
    const delay = 1200 + Math.random() * 2500;
    timerRef.current = setTimeout(() => {
      goAtRef.current = performance.now();
      setReaction("go");
    }, delay);
  };

  const tapReaction = () => {
    if (reaction === "wait") {
      if (timerRef.current) clearTimeout(timerRef.current);
      setReaction("idle");
      toast.error("بدري! انتظر الإشارة الخضراء");
      return;
    }
    if (reaction !== "go") return;
    const ms = Math.round(performance.now() - goAtRef.current);
    setReaction("done");
    // نتيجة أعلى = زمن أسرع
    void submit(Math.max(1, 5000 - ms), `${ms} مللي ثانية`);
  };

  const open = game?.status === "open" && !ended;

  return (
    <div className="mt-4 rounded-2xl border border-border bg-card p-3">
      <h2 className="mb-2 flex items-center gap-2 text-sm font-bold">
        <Gamepad2 className="h-4 w-4 text-primary" /> الألعاب والتحديات
      </h2>

      {game && (
        <div className="mb-3 rounded-xl border border-border bg-muted/40 p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold">{game.title}</p>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${open ? "bg-red-500 text-white" : "bg-muted"}`}>
              {open ? "جارٍ الآن" : "منتهي"}
            </span>
          </div>
          {game.prompt && <p className="mt-1 text-xs text-muted-foreground">{game.prompt}</p>}
          {game.prize_points > 0 && (
            <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-amber-600">
              <Trophy className="h-3.5 w-3.5" /> الجائزة: {game.prize_points} نقطة
            </p>
          )}

          {/* اللعب */}
          {open && !isHost && !joined && (
            <div className="mt-3">
              {game.kind === "reaction" ? (
                reaction === "idle" ? (
                  <Button size="sm" onClick={startReaction} className="gap-1">
                    <Zap className="h-4 w-4" /> ابدأ تحدي السرعة
                  </Button>
                ) : (
                  <button
                    onClick={tapReaction}
                    className={`h-24 w-full rounded-xl text-lg font-bold text-white transition ${
                      reaction === "go" ? "bg-green-600" : "bg-muted-foreground/60"
                    }`}
                  >
                    {reaction === "go" ? "اضغط الآن!" : reaction === "done" ? "تم!" : "استعد..."}
                  </button>
                )
              ) : (
                <form
                  onSubmit={(e) => { e.preventDefault(); if (myAnswer.trim()) void submit(1, myAnswer.trim()); }}
                  className="flex gap-2"
                >
                  <Input value={myAnswer} onChange={(e) => setMyAnswer(e.target.value)} placeholder="إجابتك..." maxLength={80} />
                  <Button type="submit" size="sm" className="shrink-0">إرسال</Button>
                </form>
              )}
            </div>
          )}
          {open && !isHost && joined && (
            <p className="mt-2 text-xs text-muted-foreground">شاركت في هذا التحدي — انتظر إعلان الفائز.</p>
          )}

          {/* لوحة النتائج */}
          {players.length > 0 && (
            <ul className="mt-3 space-y-1">
              {players.map((p, i) => (
                <li key={p.user_id} className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1">
                    <span className="w-4 text-muted-foreground">{i + 1}.</span>
                    <span className="font-semibold" data-no-translate>{publicName(p.profiles)}</span>
                    {game.winner_id === p.user_id && <Trophy className="h-3.5 w-3.5 text-amber-500" />}
                  </span>
                  <span className="text-muted-foreground">{p.score}</span>
                </li>
              ))}
            </ul>
          )}

          {isHost && open && (
            <Button size="sm" variant="secondary" className="mt-3 gap-1" disabled={busy} onClick={endGame}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trophy className="h-4 w-4" />} إعلان الفائز
            </Button>
          )}
        </div>
      )}

      {/* إنشاء تحدٍ جديد — المضيف فقط */}
      {isHost && !ended && !open && (
        <div className="space-y-3">
          <div>
            <p className="mb-1 text-[11px] font-bold text-foreground">نوع التحدي</p>
            <div className="flex flex-wrap gap-2">
              {GAME_KINDS.map((g) => (
                <button
                  key={g.kind}
                  type="button"
                  onClick={() => setKind(g.kind)}
                  className={`flex items-center gap-1 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                    kind === g.kind ? "border-primary bg-primary/10 text-primary" : "border-border text-foreground"
                  }`}
                >
                  <g.icon className="h-3.5 w-3.5 shrink-0" />
                  <span>{g.label}</span>
                </button>
              ))}
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground">{GAME_KINDS.find((g) => g.kind === kind)!.hint}</p>

          <div>
            <p className="mb-1 text-[11px] font-bold text-foreground">عنوان التحدي (اختياري)</p>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="مثال: أسرع واحد يفوز" maxLength={80} />
          </div>

          {kind !== "reaction" && (
            <>
              <div>
                <p className="mb-1 text-[11px] font-bold text-foreground">{kind === "emoji" ? "الرموز" : "السؤال"}</p>
                <Input value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder={kind === "emoji" ? "مثال: 🦁👑" : "اكتب السؤال هنا" } maxLength={200} />
              </div>
              <div>
                <p className="mb-1 text-[11px] font-bold text-foreground">الإجابة الصحيحة</p>
                <Input value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="اكتب الإجابة" maxLength={80} />
              </div>
            </>
          )}

          <div>
            <p className="mb-1 text-[11px] font-bold text-foreground">الجائزة بالنقاط</p>
            <div className="flex items-center gap-2">
              <Input value={prize} onChange={(e) => setPrize(e.target.value.replace(/\D/g, ""))} inputMode="numeric" placeholder="50" className="w-28" />
              <Button size="sm" disabled={busy} onClick={createGame} className="shrink-0 gap-1">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Gamepad2 className="h-4 w-4" />} ابدأ التحدي
              </Button>
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground">تُحجز الجائزة من رصيدك وتُمنح للفائز، وتُعاد إليك إذا لم يشارك أحد.</p>
        </div>
      )}



      {!game && !isHost && (
        <p className="py-3 text-center text-xs text-muted-foreground">لا يوجد تحدٍ الآن — انتظر أن يبدأ المضيف لعبة.</p>
      )}
    </div>
  );
}
