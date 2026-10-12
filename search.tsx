import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useEffect } from "react";
import { z } from "zod";
import { globalSearch } from "@/lib/search.functions";
import { Header } from "@/components/Header";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Search, Users, FileText, Video, Store } from "lucide-react";
import { publicName } from "@/lib/display-name";

const schema = z.object({ q: z.string().optional().default("") });

export const Route = createFileRoute("/search")({
  validateSearch: (input: Record<string, unknown>) => schema.parse(input),
  head: () => ({ meta: [{ title: "بحث — وَصْل" }] }),
  component: SearchPage,
});

function SearchPage() {
  const { q } = Route.useSearch();
  const navigate = useNavigate({ from: "/search" });
  const [term, setTerm] = useState(q);
  const search = useServerFn(globalSearch);

  useEffect(() => setTerm(q), [q]);

  const query = useQuery({
    enabled: q.trim().length > 0,
    queryKey: ["search", q],
    queryFn: () => search({ data: { q } }),
  });

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <Header />
      <main className="mx-auto w-full max-w-3xl px-0 py-4 sm:px-4 sm:py-6">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            navigate({ search: { q: term.trim() } });
          }}
          className="flex gap-2 px-4 sm:px-0"
        >
          <div className="relative flex-1">
            <Search className="absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="ابحث عن أصدقاء، منشورات، فيديوهات، سلع..."
              className="pe-9"
            />
          </div>
          <Button type="submit">بحث</Button>
        </form>

        {!q ? (
          <p className="px-4 pt-6 text-center text-muted-foreground sm:px-0">اكتب كلمة للبحث في التطبيق كله</p>
        ) : query.isLoading ? (
          <p className="px-4 pt-6 text-center text-muted-foreground sm:px-0">جارٍ البحث...</p>
        ) : (
          <div className="mt-6 space-y-6 sm:space-y-6">
            <Section icon={<Users className="h-4 w-4" />} title="أشخاص" count={query.data?.users.length ?? 0}>
              {query.data?.users.map((u) => (
                <Link
                  key={u.id}
                  to="/messages"
                  search={{ to: u.id }}
                  className="flex items-center gap-3 border-b border-border p-3 transition hover:bg-accent last:border-b-0 sm:rounded-lg sm:border-b-0 sm:p-2"
                >
                  <Avatar className="h-10 w-10 shrink-0">
                    <AvatarImage src={u.avatar_url ?? undefined} />
                    <AvatarFallback>{publicName(u).charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <div className="truncate font-medium">{publicName(u)}</div>
                  </div>
                </Link>
              ))}
            </Section>

            <Section icon={<FileText className="h-4 w-4" />} title="منشورات" count={query.data?.posts.length ?? 0}>
              {query.data?.posts.map((p) => (
                <div key={p.id} className="border-b border-border p-3 transition hover:bg-accent last:border-b-0 sm:rounded-lg sm:border-b-0 sm:p-2">
                  <p className="line-clamp-3 text-sm">{p.content}</p>
                </div>
              ))}
            </Section>

            <Section icon={<Video className="h-4 w-4" />} title="فيديوهات" count={query.data?.videos.length ?? 0}>
              {query.data?.videos.map((v) => (
                <a
                  key={v.id}
                  href={v.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-3 border-b border-border p-3 transition hover:bg-accent last:border-b-0 sm:rounded-lg sm:border-b-0 sm:p-2"
                >
                  {v.thumbnail_url ? (
                    <img src={v.thumbnail_url} alt="" className="h-14 w-20 shrink-0 rounded object-cover" />
                  ) : (
                    <div className="flex h-14 w-20 shrink-0 items-center justify-center rounded bg-muted">
                      <Video className="h-5 w-5 text-muted-foreground" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="truncate font-medium">{v.title}</div>
                    <div className="text-xs text-muted-foreground">{v.platform} · {v.views_count ?? 0} مشاهدة</div>
                  </div>
                </a>
              ))}
            </Section>

            <Section icon={<Store className="h-4 w-4" />} title="سلع وخدمات" count={query.data?.listings.length ?? 0}>
              {query.data?.listings.map((l) => (
                <Link
                  key={l.id}
                  to="/marketplace/$listingId"
                  params={{ listingId: l.id }}
                  className="flex items-center gap-3 border-b border-border p-3 transition hover:bg-accent last:border-b-0 sm:rounded-lg sm:border-b-0 sm:p-2"
                >
                  {l.images?.[0] ? (
                    <img src={l.images[0]} alt="" className="h-14 w-14 shrink-0 rounded object-cover" />
                  ) : (
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded bg-muted">
                      <Store className="h-5 w-5 text-muted-foreground" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{l.title}</div>
                    <div className="text-xs text-muted-foreground">{l.price_egp ?? l.price_points} جنيه · دفع عند الاستلام</div>
                  </div>
                </Link>
              ))}
            </Section>
          </div>
        )}
      </main>
    </div>
  );
}

function Section({
  icon,
  title,
  count,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <Card className="rounded-none border-x-0 border-b-0 border-t border-border bg-card sm:rounded-2xl sm:border sm:border-border sm:p-3 sm:shadow-card">
      <div className="mb-2 flex items-center gap-2 border-b border-border px-4 py-2 text-sm font-semibold sm:border-b-0 sm:px-0 sm:py-0">
        {icon}
        <span>{title}</span>
        <span className="text-muted-foreground">({count})</span>
      </div>
      {count === 0 ? (
        <p className="px-4 py-2 text-xs text-muted-foreground sm:px-0 sm:py-0">لا توجد نتائج</p>
      ) : (
        <div>{children}</div>
      )}
    </Card>
  );
}
