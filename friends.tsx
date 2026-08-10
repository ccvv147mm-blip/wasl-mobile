import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/lib/auth-context";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Loader2, UserPlus, UserMinus, Check, X, MessageSquare, Users } from "lucide-react";
import { toast } from "sonner";
import {
  listFriends,
  listFriendRequests,
  respondFriendRequest,
  removeFriend,
  suggestFriends,
} from "@/lib/friends.functions";
import { friendlyError } from "@/lib/friendly-error";
import { SendGiftToFriend } from "@/components/SendGiftToFriend";
import { FriendButton } from "@/components/FriendButton";
import { publicName } from "@/lib/display-name";

export const Route = createFileRoute("/friends")({
  component: FriendsPage,
  head: () => ({ meta: [{ title: "الأصدقاء — وَصْل" }] }),
});

function FriendsPage() {
  const { user, loading } = useAuth();
  const qc = useQueryClient();
  const listFn = useServerFn(listFriends);
  const reqFn = useServerFn(listFriendRequests);
  const respondFn = useServerFn(respondFriendRequest);
  const removeFn = useServerFn(removeFriend);
  const suggestFn = useServerFn(suggestFriends);

  const friends = useQuery({ enabled: !!user, queryKey: ["friends"], queryFn: () => listFn() });
  const reqs = useQuery({ enabled: !!user, queryKey: ["friend-requests"], queryFn: () => reqFn() });
  const suggestions = useQuery({ enabled: !!user, queryKey: ["friend-suggestions"], queryFn: () => suggestFn() });

  const respond = async (requesterId: string, accept: boolean) => {
    try {
      await respondFn({ data: { requesterId, accept } });
      toast.success(accept ? "تم القبول" : "تم الرفض");
      qc.invalidateQueries({ queryKey: ["friends"] });
      qc.invalidateQueries({ queryKey: ["friend-requests"] });
    } catch (e) { toast.error(friendlyError(e, "تعذّر التنفيذ")); }
  };

  const unfriend = async (otherId: string) => {
    if (!confirm("إزالة هذا الصديق؟")) return;
    try {
      await removeFn({ data: { otherId } });
      toast.success("تمت الإزالة");
      qc.invalidateQueries({ queryKey: ["friends"] });
    } catch (e) { toast.error(friendlyError(e, "تعذّر التنفيذ")); }
  };

  if (loading) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="animate-spin" /></div>;
  if (!user) return <Navigate to="/login" />;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-2xl px-4 py-6">
        <div className="mb-4 flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl gradient-primary shadow-elegant">
            <Users className="h-5 w-5 text-primary-foreground" />
          </div>
          <h1 className="text-xl font-bold">الأصدقاء</h1>
        </div>

        <Tabs defaultValue="friends">
          <TabsList className="w-full overflow-x-auto">
            <TabsTrigger value="friends" className="flex-1">أصدقائي ({friends.data?.friends.length ?? 0})</TabsTrigger>
            <TabsTrigger value="incoming" className="flex-1">واردة ({reqs.data?.incoming.length ?? 0})</TabsTrigger>
            <TabsTrigger value="outgoing" className="flex-1">صادرة ({reqs.data?.outgoing.length ?? 0})</TabsTrigger>
            <TabsTrigger value="suggestions" className="flex-1">الاقتراحات</TabsTrigger>
          </TabsList>

          <TabsContent value="suggestions" className="space-y-2 pt-4">
            <p className="text-sm font-semibold text-muted-foreground">أشخاص قد تعرفهم</p>
            {suggestions.isLoading && <Loader2 className="mx-auto animate-spin" />}
            {suggestions.data?.suggestions.length === 0 && (
              <p className="rounded-2xl border border-dashed border-border p-8 text-center text-muted-foreground">لا اقتراحات حالياً.</p>
            )}
            {suggestions.data?.suggestions.map((u: any) => (
              <div key={u.id} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3">
                <Avatar className="h-11 w-11">
                  {u.avatar_url && <AvatarImage src={u.avatar_url} />}
                  <AvatarFallback className="gradient-primary text-primary-foreground font-bold">{(publicName(u)).charAt(0)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{publicName(u)}</p>
                </div>
                <FriendButton userId={u.id} />
              </div>
            ))}
          </TabsContent>


          <TabsContent value="friends" className="space-y-2 pt-4">
            {friends.isLoading && <Loader2 className="mx-auto animate-spin" />}
            {friends.data?.friends.length === 0 && (
              <p className="rounded-2xl border border-dashed border-border p-8 text-center text-muted-foreground">لا أصدقاء بعد. ابحث عن مستخدمين في الرسائل وأرسل طلبات.</p>
            )}
            {friends.data?.friends.map((f: any) => (
              <div key={f.id} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3">
                <Avatar className="h-11 w-11">
                  {f.avatar_url && <AvatarImage src={f.avatar_url} />}
                  <AvatarFallback className="gradient-primary text-primary-foreground font-bold">{(publicName(f)).charAt(0)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{publicName(f)}</p>
                </div>
                <SendGiftToFriend recipientId={f.id} recipientName={publicName(f)} />
                <Button asChild size="icon" variant="ghost"><Link to="/messages" search={{ to: f.id }}><MessageSquare className="h-4 w-4" /></Link></Button>
                <Button size="icon" variant="ghost" onClick={() => unfriend(f.id)}><UserMinus className="h-4 w-4 text-destructive" /></Button>
              </div>
            ))}
          </TabsContent>

          <TabsContent value="incoming" className="space-y-2 pt-4">
            {reqs.data?.incoming.length === 0 && <p className="rounded-2xl border border-dashed border-border p-8 text-center text-muted-foreground">لا طلبات واردة.</p>}
            {reqs.data?.incoming.map((u: any) => (
              <div key={u.id} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3">
                <Avatar className="h-11 w-11">
                  {u.avatar_url && <AvatarImage src={u.avatar_url} />}
                  <AvatarFallback>{(publicName(u)).charAt(0)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{publicName(u)}</p>
                </div>
                <Button size="sm" onClick={() => respond(u.id, true)}><Check className="h-4 w-4" /> قبول</Button>
                <Button size="sm" variant="outline" onClick={() => respond(u.id, false)}><X className="h-4 w-4" /></Button>
              </div>
            ))}
          </TabsContent>

          <TabsContent value="outgoing" className="space-y-2 pt-4">
            {reqs.data?.outgoing.length === 0 && <p className="rounded-2xl border border-dashed border-border p-8 text-center text-muted-foreground">لا طلبات صادرة.</p>}
            {reqs.data?.outgoing.map((u: any) => (
              <div key={u.id} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3">
                <Avatar className="h-11 w-11">
                  {u.avatar_url && <AvatarImage src={u.avatar_url} />}
                  <AvatarFallback>{(publicName(u)).charAt(0)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{publicName(u)}</p>
                  <p className="truncate text-xs text-muted-foreground">بانتظار الرد</p>
                </div>
                <Button size="sm" variant="outline" onClick={() => unfriend(u.id)}>إلغاء</Button>
              </div>
            ))}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
