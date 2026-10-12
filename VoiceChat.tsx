import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { chatWithProfile } from "@/lib/voice.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Loader2, Send, Volume2, Sparkles, Square, Star, ChevronDown, ChevronUp } from "lucide-react";
import { friendlyError } from "@/lib/friendly-error";
import { stopAllMedia } from "@/lib/media-lock";
import { speakInstant, type SpeechHandle } from "@/lib/tts-stream";

const OPEN_KEY = "profile-voicechat-open";

type Msg = { role: "user" | "assistant"; content: string };

export function VoiceChat() {
  const chatFn = useServerFn(chatWithProfile);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [speakingIdx, setSpeakingIdx] = useState<number | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const handleRef = useRef<SpeechHandle | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem(OPEN_KEY);
    if (saved !== null) setIsOpen(saved === "1");
  }, []);

  useEffect(() => {
    localStorage.setItem(OPEN_KEY, isOpen ? "1" : "0");
  }, [isOpen]);

  useEffect(() => () => { handleRef.current?.stop(); handleRef.current = null; }, []);

  useEffect(() => {
    if (!isOpen) {
      handleRef.current?.stop();
      handleRef.current = null;
      setSpeakingIdx(null);
    }
  }, [isOpen]);

  const send = async () => {
    const q = input.trim();
    if (!q || thinking) return;
    const next = [...messages, { role: "user" as const, content: q }];
    setMessages(next);
    setInput("");
    setThinking(true);
    try {
      const { reply } = await chatFn({
        data: {
          question: q,
          history: messages.slice(-10),
        },
      });
      const updated = [...next, { role: "assistant" as const, content: reply }];
      setMessages(updated);
      // قراءة الرد بصوت مسموع تلقائياً وفوراً (نفس قارئ المنشورات)
      speak(reply, updated.length - 1);
    } catch (e) {
      toast.error(friendlyError(e, "تعذّر الحصول على رد"));
    } finally {
      setThinking(false);
    }
  };

  const speak = (text: string, idx: number) => {
    stopSpeak();
    stopAllMedia();
    const handle = speakInstant(text, {
      onEnd: () => { handleRef.current = null; setSpeakingIdx(null); },
      onStopped: () => { handleRef.current = null; setSpeakingIdx(null); },
    });
    if (!handle) {
      toast.error("جهازك لا يدعم القارئ الصوتي");
      return;
    }
    handleRef.current = handle;
    setSpeakingIdx(idx);
  };

  const stopSpeak = () => {
    handleRef.current?.stop();
    handleRef.current = null;
    setSpeakingIdx(null);
  };


  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className="flex w-full items-center justify-between"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl gradient-primary shadow-elegant">
            <Sparkles className="h-4 w-4 text-primary-foreground" />
          </div>
          <div className="text-start">
            <h3 className="flex items-center gap-1.5 font-bold">
              تحدّث مع صفحتك
              <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />
            </h3>
            <p className="text-xs text-muted-foreground">اسأل صفحتك أي شيء — وستجيبك بصوت عربي</p>
          </div>
        </div>
        {isOpen ? (
          <ChevronUp className="h-5 w-5 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-5 w-5 text-muted-foreground" />
        )}
      </button>

      {isOpen && (
        <div className="animate-in fade-in slide-in-from-top-2 duration-200">
          {messages.length === 0 && (
            <div className="mt-4 rounded-xl bg-muted/50 p-4 text-sm text-muted-foreground">
              جرّب أن تسأل: <span className="font-medium text-foreground">"كم عدد المشاهدات على فيديوهاتي؟"</span> أو <span className="font-medium text-foreground">"اقترح لي موضوع منشور جديد"</span>
            </div>
          )}

          <div className="mt-4 max-h-80 space-y-3 overflow-y-auto">
            {messages.map((m, i) => (
              <div key={i} className={m.role === "user" ? "flex justify-end" : ""}>
                {m.role === "user" ? (
                  <div className="max-w-[85%] rounded-2xl bg-primary px-3 py-2 text-sm text-primary-foreground">
                    {m.content}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="whitespace-pre-wrap text-sm leading-relaxed">{m.content}</p>
                    <div className="flex gap-1">
                      {speakingIdx === i ? (
                        <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={stopSpeak}>
                          <Square className="h-3 w-3" /> إيقاف
                        </Button>
                      ) : (
                        <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={() => speak(m.content, i)}>
                          <Volume2 className="h-3 w-3" /> استمع
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
            {thinking && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> أفكر...
              </div>
            )}
          </div>

          <form
            className="mt-4 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="اكتب سؤالك..."
              disabled={thinking}
              maxLength={500}
            />
            <Button type="submit" size="icon" disabled={thinking || !input.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      )}
    </div>
  );
}
