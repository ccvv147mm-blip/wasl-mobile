import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/lib/auth-context";
import { Header } from "@/components/Header";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Send, ArrowRight, MessageSquare, Search } from "lucide-react";
import { listConversations, getThread, sendMessage, searchUsers } from "@/lib/messages.functions";
import { FriendButton } from "@/components/FriendButton";
import { formatDistanceToNow } from "date-fns";
import { arSA } from "date-fns/locale";
import { toast } from "sonner";
import { friendlyError } from "@/lib/friendly-error";
import { publicName } from "@/lib/display-name";

export const Route = createFileRoute("/messages")({
  component: MessagesPage,
  validateSearch: (s: Record<string, unknown>) => ({ to: typeof s.to === "string" ? s.to : undefined }),
  head: () => ({ meta: [{ title: "الرسائل — وَصْل" }] }),
});

function MessagesPage() {
  const { user, loading } = useAuth();
  const search = Route.useSearch();
  const [peerId, setPeerId] = useState<string | null>(search.to ?? null);

  useEffect(() => {
    if (search.to) setPeerId(search.to);
  }, [search.to]);

  if (loading) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="animate-spin" /></div>;
  if (!user) return <Navigate to="/login" />;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-3xl px-3 py-4">
        {peerId ? <Thread peerId={peerId} onBack={() => setPeerId(null)} /> : <Inbox onOpen={setPeerId} />}
      </main>
    </div>
  );
}

function Inbox({ onOpen }: { onOpen: (id: string) => void }) {
  const listFn = useServerFn(listConversations);
  const searchFn = useServerFn(searchUsers);
  const [q, setQ] = useState("");
  const list = useQuery({ queryKey: ["conversations"], queryFn: () => listFn() });
  const found = useQuery({
    queryKey: ["search-users", q],
    enabled: q.trim().length >= 2,
    queryFn: () => searchFn({ data: { q: q.trim() } }),
  });

  return (
    <div>
      <h1 className="mb-3 text-2xl font-bold">الرسائل</h1>
      <div className="relative">
        <Search className="absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث بالاسم، المعرّف، أو رقم الهاتف..." className="pe-10" />
      </div>

      {q.trim().length >= 2 && (
        <div className="mt-3 rounded-2xl border border-border bg-card p-2 shadow-card">
          {found.isLoading && <div className="p-3 text-center text-sm text-muted-foreground">بحث...</div>}
          {found.data?.users.length === 0 && <div className="p-3 text-center text-sm text-muted-foreground">لا نتائج</div>}
          {found.data?.users.map((u) => (
            <div key={u.id} className="flex items-center gap-2 rounded-xl px-2 py-1.5 hover:bg-muted">
              <button onClick={() => onOpen(u.id)} className="flex flex-1 items-center gap-3 text-start">
                <Avatar className="h-9 w-9">
                  {u.avatar_url && <AvatarImage src={u.avatar_url} />}
                  <AvatarFallback className="gradient-primary text-sm font-bold text-primary-foreground">
                    {(publicName(u)).charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{publicName(u)}</p>
                </div>
              </button>
              <FriendButton userId={u.id} />
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 space-y-2">
        {list.isLoading && <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>}
        {list.data && list.data.conversations.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border p-12 text-center">
            <MessageSquare className="mx-auto h-10 w-10 text-muted-foreground" />
            <p className="mt-3 text-muted-foreground">لا توجد محادثات بعد. ابحث عن مستخدم وابدأ.</p>
          </div>
        )}
        {list.data?.conversations.map((c) => (
          <button
            key={c.peerId}
            onClick={() => onOpen(c.peerId)}
            className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-3 text-start transition hover:shadow-card"
          >
            <Avatar className="h-11 w-11">
              {c.peer?.avatar_url && <AvatarImage src={c.peer.avatar_url} />}
              <AvatarFallback className="gradient-primary text-sm font-bold text-primary-foreground">
                {(publicName(c.peer)).charAt(0)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <p className="truncate font-semibold">{publicName(c.peer)}</p>
                <span className="shrink-0 text-[11px] text-muted-foreground">
                  {formatDistanceToNow(new Date(c.lastAt), { addSuffix: true, locale: arSA })}
                </span>
              </div>
              <p className={`mt-0.5 truncate text-sm ${c.unread ? "font-semibold text-foreground" : "text-muted-foreground"}`}>{c.lastMessage}</p>
            </div>
            {c.unread && <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-primary" />}
          </button>
        ))}
      </div>
    </div>
  );
}

function Thread({ peerId, onBack }: { peerId: string; onBack: () => void }) {
  const threadFn = useServerFn(getThread);
  const sendFn = useServerFn(sendMessage);
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const t = useQuery({
    queryKey: ["thread", peerId],
    queryFn: () => threadFn({ data: { peerId } }),
    refetchInterval: 5000,
  });

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [t.data?.messages.length]);

  const send = async () => {
    const c = text.trim();
    if (!c) return;
    setSending(true);
    try {
      await sendFn({ data: { peerId, content: c } });
      setText("");
      qc.invalidateQueries({ queryKey: ["thread", peerId] });
      qc.invalidateQueries({ queryKey: ["conversations"] });
    } catch (e) {
      toast.error(friendlyError(e, "تعذّر الإرسال"));
    } finally {
      setSending(false);
    }
  };

  const peer = t.data?.peer;
  const { user } = useAuth();


  return (
    <div className="flex h-[calc(100vh-5rem)] flex-col">
      <header className="flex items-center gap-2 border-b border-border pb-3">
        <Button size="icon" variant="ghost" onClick={onBack}><ArrowRight className="h-4 w-4" /></Button>
        <Avatar className="h-9 w-9">
          {peer?.avatar_url && <AvatarImage src={peer.avatar_url} />}
          <AvatarFallback className="gradient-primary text-sm font-bold text-primary-foreground">
            {(publicName(peer)).charAt(0)}
          </AvatarFallback>
        </Avatar>
        <div>
          <p className="font-semibold">{publicName(peer)}</p>
        </div>
      </header>

      <div className="flex-1 space-y-2 overflow-y-auto py-4">
        {t.isLoading && <div className="flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>}
        {t.data?.messages.map((m) => {
          const mine = m.sender_id === user?.id;
          return (
            <div key={m.id} className={mine ? "flex justify-end" : "flex"}>
              <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${mine ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                <p className="whitespace-pre-wrap">{m.content}</p>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      <form
        className="flex gap-2 border-t border-border pt-3"
        onSubmit={(e) => { e.preventDefault(); void send(); }}
      >
        <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="اكتب رسالتك..." disabled={sending} maxLength={2000} />
        <Button type="submit" size="icon" disabled={sending || !text.trim()}>
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </form>
    </div>
  );
}
