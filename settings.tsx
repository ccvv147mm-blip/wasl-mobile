import { createFileRoute, Navigate, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { useI18n, detectLang, LANGUAGES } from "@/lib/i18n";
import { friendlyError } from "@/lib/friendly-error";
import {
  Loader2, User as UserIcon, Lock, Bell, Shield, Globe, Palette, Volume2,
  Eye, Users, MessageSquare, HelpCircle, FileText, Info, LogOut, Trash2,
  ChevronLeft, Download, Smartphone, KeyRound, Mail, Ban, ShieldCheck,
} from "lucide-react";

export const Route = createFileRoute("/settings")({ component: SettingsPage });

type SectionKey =
  | "account" | "security" | "privacy" | "notifications" | "audio"
  | "appearance" | "language" | "blocked" | "sessions" | "data"
  | "help" | "about" | "legal";

function SettingsPage() {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const [section, setSection] = useState<SectionKey | null>(null);

  if (loading) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="animate-spin" /></div>;
  if (!user) return <Navigate to="/login" />;

  const groups: { title: string; items: { key: SectionKey; icon: any; label: string; desc: string }[] }[] = [
    {
      title: "الحساب",
      items: [
        { key: "account", icon: UserIcon, label: "معلومات الحساب", desc: "الاسم، اسم المستخدم، البريد" },
        { key: "security", icon: Lock, label: "الأمان وتسجيل الدخول", desc: "كلمة المرور والتحقق" },
        { key: "sessions", icon: Smartphone, label: "الأجهزة والجلسات", desc: "الجلسة الحالية وتسجيل الخروج" },
      ],
    },
    {
      title: "الخصوصية",
      items: [
        { key: "privacy", icon: Shield, label: "الخصوصية", desc: "من يرى منشوراتك ومعلوماتك" },
        { key: "blocked", icon: Ban, label: "المحظورون", desc: "إدارة قائمة الحظر" },
      ],
    },
    {
      title: "التفضيلات",
      items: [
        { key: "notifications", icon: Bell, label: "الإشعارات", desc: "تفعيل وإيقاف التنبيهات" },
        { key: "audio", icon: Volume2, label: "الأصوات", desc: "أصوات الإعجاب والمشاركة" },
        { key: "appearance", icon: Palette, label: "المظهر", desc: "الوضع الليلي والألوان" },
        { key: "language", icon: Globe, label: "اللغة والمنطقة", desc: "العربية / الإنجليزية" },
      ],
    },
    {
      title: "البيانات والمساعدة",
      items: [
        { key: "data", icon: Download, label: "بياناتك", desc: "تنزيل أو حذف بياناتك" },
        { key: "help", icon: HelpCircle, label: "مركز المساعدة", desc: "الأسئلة الشائعة والدعم" },
        { key: "legal", icon: FileText, label: "الشروط والخصوصية", desc: "الوثائق القانونية" },
        { key: "about", icon: Info, label: "حول التطبيق", desc: "الإصدار والمطوّر" },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-2xl px-3 py-5">
        <div className="mb-5 flex items-center gap-3">
          {section && (
            <Button variant="ghost" size="sm" onClick={() => setSection(null)} className="shrink-0">
              <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
            </Button>
          )}
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl gradient-primary text-primary-foreground shadow-elegant">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">الإعدادات</h1>
              <p className="text-sm text-muted-foreground">إدارة حسابك وتفضيلاتك</p>
            </div>
          </div>
        </div>

        {!section ? (
          <div className="space-y-6">
            {groups.map((g) => (
              <section key={g.title}>
                <h2 className="mb-2 px-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">{g.title}</h2>
                <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
                  {g.items.map((it, i) => (
                    <button
                      key={it.key}
                      onClick={() => setSection(it.key)}
                      className={`flex w-full items-center gap-3 px-4 py-3 text-start transition-colors hover:bg-muted/60 ${
                        i > 0 ? "border-t border-border" : ""
                      }`}
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted">
                        <it.icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">{it.label}</p>
                        <p className="truncate text-xs text-muted-foreground">{it.desc}</p>
                      </div>
                      <ChevronLeft className="h-4 w-4 text-muted-foreground rtl:rotate-180" />
                    </button>
                  ))}
                </div>
              </section>
            ))}

            <div className="space-y-2 rounded-2xl border border-destructive/30 bg-destructive/5 p-4">
              <Button
                variant="ghost"
                className="w-full justify-start text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={async () => {
                  await signOut();
                  navigate({ to: "/login" });
                }}
              >
                <LogOut className="h-4 w-4" /> تسجيل الخروج
              </Button>
              <Separator />
              <Button
                variant="ghost"
                className="w-full justify-start text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => setSection("data")}
              >
                <Trash2 className="h-4 w-4" /> حذف الحساب
              </Button>
            </div>
          </div>
        ) : (
          <SectionPanel section={section} />
        )}
      </main>
    </div>
  );
}

function SectionPanel({ section }: { section: SectionKey }) {
  switch (section) {
    case "account": return <AccountPanel />;
    case "security": return <SecurityPanel />;
    case "privacy": return <PrivacyPanel />;
    case "notifications": return <TogglePanel storeKey="notif" title="الإشعارات" icon={Bell} items={[
      { key: "likes", label: "إعجابات على منشوراتي", default: true },
      { key: "comments", label: "تعليقات جديدة", default: true },
      { key: "friends", label: "طلبات الصداقة", default: true },
      { key: "messages", label: "رسائل خاصة", default: true },
      { key: "marketing", label: "تحديثات التطبيق والعروض", default: false },
    ]} />;
    case "audio": return <TogglePanel storeKey="sound" title="الأصوات" icon={Volume2} items={[
      { key: "like", label: "صوت الإعجاب", default: true },
      { key: "share", label: "صوت المشاركة", default: true },
      { key: "send", label: "صوت إرسال الرسالة", default: true },
    ]} />;
    case "appearance": return <AppearancePanel />;
    case "language": return <LanguagePanel />;
    case "blocked": return <SimpleEmpty icon={Ban} title="المحظورون" desc="لا يوجد أحد في قائمة الحظر." />;
    case "sessions": return <SessionsPanel />;
    case "data": return <DataPanel />;
    case "help": return <HelpPanel />;
    case "legal": return <LegalPanel />;
    case "about": return <AboutPanel />;
  }
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl border border-border bg-card p-5 shadow-card">{children}</div>;
}

function AccountPanel() {
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [saving, setSaving] = useState(false);

  useState(() => {
    supabase.from("profiles").select("full_name, username").eq("id", user!.id).single().then(({ data }) => {
      if (data) { setName(data.full_name ?? ""); setUsername(data.username ?? ""); }
    });
  });

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from("profiles").update({ full_name: name, username }).eq("id", user!.id);
    setSaving(false);
    if (error) return toast.error(friendlyError(error, "تعذّر الحفظ"));
    toast.success("تم الحفظ");
  };

  return (
    <Card>
      <h2 className="mb-4 flex items-center gap-2 text-lg font-bold"><UserIcon className="h-5 w-5" /> معلومات الحساب</h2>
      <div className="space-y-4">
        <div><Label>الاسم الظاهر للآخرين</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="الاسم الذي يراه الآخرون" /><p className="mt-1 text-xs text-muted-foreground">هذا هو الاسم الوحيد الذي يظهر للمستخدمين الآخرين.</p></div>
        <div><Label>اسم المستخدم (خاص)</Label><Input value={username} onChange={(e) => setUsername(e.target.value)} /><p className="mt-1 text-xs text-muted-foreground">للاستخدام الداخلي فقط ولا يظهر للآخرين.</p></div>
        <div><Label>البريد الإلكتروني (مخفي)</Label><Input value={user?.email ?? ""} disabled /><p className="mt-1 text-xs text-muted-foreground">بريدك مخفي تماماً ولا يظهر لأي مستخدم آخر.</p></div>
        <Button onClick={save} disabled={saving}>{saving && <Loader2 className="h-4 w-4 animate-spin" />} حفظ</Button>
      </div>
    </Card>
  );
}

function SecurityPanel() {
  const [pwd, setPwd] = useState("");
  const [busy, setBusy] = useState(false);
  const change = async () => {
    if (pwd.length < 6) return toast.error("كلمة مرور قصيرة جداً");
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pwd });
    setBusy(false);
    if (error) return toast.error(friendlyError(error, "تعذّر التحديث"));
    toast.success("تم تحديث كلمة المرور");
    setPwd("");
  };
  return (
    <Card>
      <h2 className="mb-4 flex items-center gap-2 text-lg font-bold"><KeyRound className="h-5 w-5" /> الأمان</h2>
      <div className="space-y-4">
        <div>
          <Label>كلمة مرور جديدة</Label>
          <Input type="password" value={pwd} onChange={(e) => setPwd(e.target.value)} placeholder="••••••••" />
        </div>
        <Button onClick={change} disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" />} تحديث</Button>
        <Separator />
        <RowToggle storeKey="2fa" k="enabled" label="التحقق بخطوتين" desc="حماية إضافية عند الدخول" />
      </div>
    </Card>
  );
}

function PrivacyPanel() {
  return (
    <Card>
      <h2 className="mb-4 flex items-center gap-2 text-lg font-bold"><Shield className="h-5 w-5" /> الخصوصية</h2>
      <div className="space-y-1">
        <RowToggle storeKey="priv" k="public_profile" label="ملف عام" desc="يستطيع الجميع رؤية ملفك" def />
        <RowToggle storeKey="priv" k="show_email" label="إظهار البريد للأصدقاء" />
        <RowToggle storeKey="priv" k="friend_requests" label="السماح بطلبات الصداقة" def />
        <RowToggle storeKey="priv" k="dm_friends_only" label="الرسائل من الأصدقاء فقط" />
        <RowToggle storeKey="priv" k="search_engines" label="السماح لمحركات البحث بإيجاد ملفي" def />
      </div>
    </Card>
  );
}

function TogglePanel({ storeKey, title, icon: Icon, items }: { storeKey: string; title: string; icon: any; items: { key: string; label: string; default?: boolean }[] }) {
  return (
    <Card>
      <h2 className="mb-4 flex items-center gap-2 text-lg font-bold"><Icon className="h-5 w-5" /> {title}</h2>
      <div className="space-y-1">
        {items.map((it) => <RowToggle key={it.key} storeKey={storeKey} k={it.key} label={it.label} def={it.default} />)}
      </div>
    </Card>
  );
}

function RowToggle({ storeKey, k, label, desc, def }: { storeKey: string; k: string; label: string; desc?: string; def?: boolean }) {
  const id = `${storeKey}_${k}`;
  const [on, setOn] = useState<boolean>(() => {
    if (typeof window === "undefined") return !!def;
    const v = localStorage.getItem(id);
    return v == null ? !!def : v === "1";
  });
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        {desc && <p className="text-xs text-muted-foreground">{desc}</p>}
      </div>
      <Switch checked={on} onCheckedChange={(v) => { setOn(v); localStorage.setItem(id, v ? "1" : "0"); }} />
    </div>
  );
}

function AppearancePanel() {
  const [theme, setTheme] = useState<string>(() => (typeof window !== "undefined" ? document.documentElement.classList.contains("dark") ? "dark" : "light" : "light"));
  const apply = (t: string) => {
    setTheme(t);
    if (typeof window !== "undefined") {
      document.documentElement.classList.toggle("dark", t === "dark");
      localStorage.setItem("theme", t);
    }
  };
  return (
    <Card>
      <h2 className="mb-4 flex items-center gap-2 text-lg font-bold"><Palette className="h-5 w-5" /> المظهر</h2>
      <div className="grid grid-cols-2 gap-3">
        {[
          { v: "light", label: "فاتح" },
          { v: "dark", label: "ليلي" },
        ].map((o) => (
          <button key={o.v} onClick={() => apply(o.v)}
            className={`rounded-2xl border-2 p-4 text-center transition ${theme === o.v ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"}`}>
            <p className="font-medium">{o.label}</p>
          </button>
        ))}
      </div>
    </Card>
  );
}

function LanguagePanel() {
  const { lang, setLang } = useI18n();
  const auto = detectLang();
  const [q, setQ] = useState("");
  const list = LANGUAGES.filter(
    (l) => !q.trim() || l.native.includes(q) || l.name.toLowerCase().includes(q.toLowerCase()) || l.code === q.toLowerCase(),
  );
  return (
    <Card>
      <h2 className="mb-2 flex items-center gap-2 text-lg font-bold"><Globe className="h-5 w-5" /> اللغة والمنطقة</h2>
      <p className="mb-4 text-sm text-muted-foreground">
        يتم اختيار اللغة تلقائياً حسب لغة جهازك وبلدك، ويمكنك تغييرها في أي وقت. تُترجم واجهة التطبيق والمنشورات إلى اللغة المختارة.
      </p>
      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث عن لغة…" className="mb-3" />
      <div className="max-h-[26rem] space-y-2 overflow-y-auto pe-1" data-no-translate>
        {list.map((o) => (
          <button key={o.code} onClick={() => setLang(o.code)}
            className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 transition ${lang === o.code ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"}`}>
            <span className="flex items-center gap-2">
              {o.native}
              <span className="text-xs text-muted-foreground">{o.name}</span>
              {o.code === auto ? <span className="rounded-full bg-muted px-2 py-0.5 text-[10px]">auto</span> : null}
            </span>
            {lang === o.code && <ShieldCheck className="h-4 w-4 text-primary" />}
          </button>
        ))}
      </div>
    </Card>
  );
}

function SessionsPanel() {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  return (
    <Card>
      <h2 className="mb-4 flex items-center gap-2 text-lg font-bold"><Smartphone className="h-5 w-5" /> الجلسات</h2>
      <div className="space-y-3">
        <div className="rounded-xl border border-border p-3">
          <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-emerald-500" /><p className="font-medium">هذا الجهاز</p></div>
          <p className="mt-1 text-xs text-muted-foreground">{typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 60) : ""}</p>
        </div>
        <Button variant="destructive" onClick={async () => { await signOut(); navigate({ to: "/login" }); }}>
          <LogOut className="h-4 w-4" /> تسجيل الخروج من هذا الجهاز
        </Button>
      </div>
    </Card>
  );
}

function DataPanel() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  const download = async () => {
    const [{ data: profile }, { data: posts }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", user!.id).single(),
      supabase.from("posts").select("*").eq("author_id", user!.id),
    ]);
    const blob = new Blob([JSON.stringify({ profile, posts }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "my-data.json"; a.click();
    URL.revokeObjectURL(url);
  };

  const remove = async () => {
    if (!confirm("هل أنت متأكد؟ سيتم حذف حسابك وبياناتك نهائياً.")) return;
    setBusy(true);
    try {
      await supabase.from("posts").delete().eq("author_id", user!.id);
      await supabase.from("profiles").delete().eq("id", user!.id);
      await signOut();
      toast.success("تم حذف بياناتك");
      navigate({ to: "/signup" });
    } catch (e) {
      toast.error(friendlyError(e, "تعذّر الحذف"));
    } finally { setBusy(false); }
  };

  return (
    <Card>
      <h2 className="mb-4 flex items-center gap-2 text-lg font-bold"><Download className="h-5 w-5" /> بياناتك</h2>
      <div className="space-y-3">
        <Button variant="outline" onClick={download}><Download className="h-4 w-4" /> تنزيل نسخة من بياناتي</Button>
        <Separator />
        <p className="text-sm text-muted-foreground">حذف الحساب إجراء نهائي ولا يمكن التراجع عنه.</p>
        <Button variant="destructive" onClick={remove} disabled={busy}>
          {busy && <Loader2 className="h-4 w-4 animate-spin" />} <Trash2 className="h-4 w-4" /> حذف حسابي نهائياً
        </Button>
      </div>
    </Card>
  );
}

function HelpPanel() {
  const faq = [
    { q: "كيف أنشر منشوراً؟", a: "من الصفحة الرئيسية، استخدم مربع الكتابة في الأعلى." },
    { q: "كيف أربح من التطبيق؟", a: "شارك التطبيق واحصل على نقاط من تفاعل منشوراتك. الحد الأدنى للسحب 100$." },
    { q: "كيف أتواصل مع الدعم؟", a: "راسلنا عبر صفحة الرسائل أو من خلال البريد." },
    { q: "كيف أبلّغ عن منشور؟", a: "من قائمة المنشور اختر «إبلاغ»." },
  ];
  return (
    <Card>
      <h2 className="mb-4 flex items-center gap-2 text-lg font-bold"><HelpCircle className="h-5 w-5" /> المساعدة</h2>
      <div className="space-y-3">
        {faq.map((f, i) => (
          <details key={i} className="rounded-xl border border-border p-3">
            <summary className="cursor-pointer font-medium">{f.q}</summary>
            <p className="mt-2 text-sm text-muted-foreground">{f.a}</p>
          </details>
        ))}
        <Separator />
        <Button asChild variant="outline"><Link to="/messages" search={{}}><MessageSquare className="h-4 w-4" /> تواصل مع الدعم</Link></Button>
      </div>
    </Card>
  );
}

function LegalPanel() {
  return (
    <Card>
      <h2 className="mb-4 flex items-center gap-2 text-lg font-bold"><FileText className="h-5 w-5" /> الوثائق</h2>
      <div className="space-y-2">
        <Button asChild variant="outline" className="w-full justify-start"><Link to="/terms"><FileText className="h-4 w-4" /> شروط الاستخدام</Link></Button>
        <Button asChild variant="outline" className="w-full justify-start"><Link to="/privacy"><Shield className="h-4 w-4" /> سياسة الخصوصية</Link></Button>
      </div>
    </Card>
  );
}

function AboutPanel() {
  return (
    <Card>
      <h2 className="mb-4 flex items-center gap-2 text-lg font-bold"><Info className="h-5 w-5" /> حول التطبيق</h2>
      <div className="space-y-2 text-sm">
        <p><span className="font-bold">وَصْل</span> — منصة تواصل اجتماعي مدعومة بالذكاء الاصطناعي.</p>
        <p className="text-muted-foreground">الإصدار 1.0.0</p>
        <p className="text-muted-foreground">© {new Date().getFullYear()} جميع الحقوق محفوظة.</p>
      </div>
    </Card>
  );
}

function SimpleEmpty({ icon: Icon, title, desc }: { icon: any; title: string; desc: string }) {
  return (
    <Card>
      <div className="py-8 text-center">
        <Icon className="mx-auto h-10 w-10 text-muted-foreground" />
        <h2 className="mt-3 font-bold">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
      </div>
    </Card>
  );
}
