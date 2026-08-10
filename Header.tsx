import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NotificationsBell } from "@/components/NotificationsBell";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Sparkles, LogOut, User as UserIcon, Home, Video, Wallet, MessageSquare, Store, Users, ShieldCheck, Settings as SettingsIcon, Search, Gift, Radio } from "lucide-react";

export function Header() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [q, setQ] = useState("");

  const unread = useQuery({
    enabled: !!user,
    queryKey: ["unread", user?.id],
    refetchInterval: 30000,
    queryFn: async () => {
      const { count } = await supabase
        .from("messages")
        .select("*", { count: "exact", head: true })
        .eq("recipient_id", user!.id)
        .eq("read", false);
      return count ?? 0;
    },
  });

  const admin = useQuery({
    enabled: !!user,
    queryKey: ["header-is-admin", user?.id],
    queryFn: async () => {
      const { data } = await supabase.rpc("has_role", { _user_id: user!.id, _role: "admin" });
      return !!data;
    },
  });

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-card/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-5xl flex-col gap-2 px-3 py-3">
      <div className="flex items-center gap-3">
        <Link to="/" className="group flex shrink-0 items-center gap-2">
          <div className="relative flex h-10 w-10 items-center justify-center rounded-2xl gradient-primary shadow-elegant transition-transform duration-300 group-hover:scale-110 group-hover:rotate-[8deg]">
            {/* Two interlocking rings = "وَصْل" (connection) */}
            <svg viewBox="0 0 32 32" className="h-6 w-6 text-primary-foreground" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
              <circle cx="12" cy="16" r="6" />
              <circle cx="20" cy="16" r="6" />
            </svg>
            <span className="pointer-events-none absolute -end-0.5 -top-0.5 h-2.5 w-2.5 animate-ping rounded-full bg-[color:var(--ai)] opacity-75" />
            <span className="pointer-events-none absolute -end-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-[color:var(--ai)]" />
          </div>
          <span className="hidden bg-clip-text text-xl font-black tracking-tight text-transparent sm:inline" style={{ backgroundImage: "var(--gradient-primary)" }}>وَصْل</span>
        </Link>

        {/* Horizontally scrollable nav so the bar moves, not the page below */}
        <nav className="flex flex-1 items-center gap-1 overflow-x-auto scrollbar-none [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: "none" }}>
          {user ? (
            <>
              <NotificationsBell />
              <LanguageSwitcher />
              <NavBtn to="/" icon={<Home className="h-4 w-4" />} label="الرئيسية" />
              <NavBtn to="/feed" icon={<Sparkles className="h-4 w-4" />} label="الخلاصة" />
              <NavBtn to="/friends" icon={<Users className="h-4 w-4" />} label="أصدقاء" />
              <NavBtn to="/videos" icon={<Video className="h-4 w-4" />} label="فيديوهات" />
              <NavBtn to="/live" icon={<Radio className="h-4 w-4 text-red-500" />} label="بث مباشر" />
              <NavBtn to="/marketplace" icon={<Store className="h-4 w-4" />} label="المتجر" />
              <NavBtn to="/messages" icon={<MessageSquare className="h-4 w-4" />} label="رسائل" badge={unread.data} />
              <NavBtn to="/earnings" icon={<Wallet className="h-4 w-4" />} label="الأرباح" />
              <NavBtn to="/wallet" icon={<Gift className="h-4 w-4 text-amber-500" />} label="شحن الهدايا" />
              <NavBtn to="/profile" icon={<UserIcon className="h-4 w-4" />} label="ملفي" />
              <NavBtn to="/settings" icon={<SettingsIcon className="h-4 w-4" />} label="الإعدادات" />
              <NavBtn to="/diagnostics" icon={<ShieldCheck className="h-4 w-4" />} label="التشخيص" />
              {admin.data && (
                <NavBtn to="/admin" icon={<ShieldCheck className="h-4 w-4 text-primary" />} label="لوحة التحكم" />
              )}
              <Button
                variant="ghost"
                size="sm"
                className="shrink-0"
                onClick={async () => {
                  await signOut();
                  navigate({ to: "/login" });
                }}
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <div className="ms-auto flex items-center gap-2">
              <LanguageSwitcher />
              <Button variant="ghost" size="sm" asChild>
                <Link to="/login">دخول</Link>
              </Button>
              <Button size="sm" asChild>
                <Link to="/signup">إنشاء حساب</Link>
              </Button>
            </div>
          )}
        </nav>
        </div>
        {user ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const term = q.trim();
              if (term) navigate({ to: "/search", search: { q: term } });
            }}
            className="relative"
          >
            <Search className="pointer-events-none absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="ابحث عن أصدقاء، منشورات، فيديوهات، سلع..."
              className="h-9 pe-9"
            />
          </form>
        ) : null}
      </div>
    </header>
  );
}

function NavBtn({ to, icon, label, badge }: { to: string; icon: React.ReactNode; label: string; badge?: number }) {
  return (
    <Button variant="ghost" size="sm" asChild className="relative shrink-0">
      <Link to={to}>
        {icon}
        <span className="hidden md:inline">{label}</span>
        {badge && badge > 0 ? (
          <span className="absolute -end-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
            {badge > 9 ? "9+" : badge}
          </span>
        ) : null}
      </Link>
    </Button>
  );
}
