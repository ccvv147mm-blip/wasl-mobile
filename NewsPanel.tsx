import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { getCountryNews } from "@/lib/news.functions";
import { Newspaper, Loader2, Sparkles, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";

async function detectCountry(): Promise<string | null> {
  try {
    const res = await fetch("https://ipapi.co/json/");
    if (!res.ok) return null;
    const j = (await res.json()) as { country_name?: string };
    return j.country_name ?? null;
  } catch {
    return null;
  }
}

export function NewsPanel() {
  const { user } = useAuth();
  const [country, setCountry] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const newsFn = useServerFn(getCountryNews);

  useEffect(() => {
    if (!user) return;
    void (async () => {
      const { data: p } = await supabase.from("profiles").select("country").eq("id", user.id).single();
      if (p?.country) {
        setCountry(p.country);
        return;
      }
      const detected = await detectCountry();
      if (detected) {
        setCountry(detected);
        await supabase.from("profiles").update({ country: detected }).eq("id", user.id);
      }
    })();
  }, [user]);

  const today = new Date().toISOString().slice(0, 10);

  const news = useQuery({
    enabled: !!country,
    queryKey: ["news", country, today],
    staleTime: 1000 * 60 * 60 * 6,
    gcTime: 1000 * 60 * 60 * 24,
    refetchOnMount: "always",
    queryFn: async () => newsFn({ data: { country: country! } }),
  });

  if (!country) return null;

  const dateLabel = news.data?.dateLabel ?? new Intl.DateTimeFormat("ar-EG", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 p-3 text-start transition hover:bg-muted/40"
        aria-expanded={open}
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-lg gradient-ai">
          <Newspaper className="h-4 w-4 text-primary-foreground" />
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-bold">أخبار وترند {country} — اليوم</h3>
          <p className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <Sparkles className="h-2.5 w-2.5" /> {dateLabel} · تحديث يومي تلقائي
          </p>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>


      <div className={`grid transition-[grid-template-rows] duration-300 ease-out ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
        <div className="overflow-hidden">
          <div className="border-t border-border px-4 pb-4 pt-3">
            <div className="mb-2 flex justify-end">
              <Button size="sm" variant="ghost" onClick={() => news.refetch()} disabled={news.isFetching}>
                {news.isFetching ? <Loader2 className="h-3 w-3 animate-spin" /> : "تحديث"}
              </Button>
            </div>
            {news.isLoading && (
              <div className="flex justify-center py-4">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            )}
            <ul className="space-y-2">
              {(news.data?.items ?? []).map((item, i) => (
                <li key={i} className="border-s-2 border-primary/40 ps-3">
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-primary">{item.category}</span>
                  </div>
                  <p className="mt-1 text-sm font-medium">{item.title}</p>
                  <p className="text-xs text-muted-foreground">{item.summary}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
