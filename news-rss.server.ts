/** مصدر أخبار مجاني (بدون ذكاء اصطناعي) يُستخدم كبديل تلقائي عند نفاد رصيد الذكاء الاصطناعي. */

export type RssNewsItem = { title: string; category: string; summary: string };

const decode = (s: string) =>
  s
    .replace(/<!\[CDATA\[(.*?)\]\]>/gs, "$1")
    .replace(/<[^>]*>/g, "")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .trim();

export async function fetchRssNews(country: string, limit = 5): Promise<RssNewsItem[]> {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(country)}&hl=ar&gl=EG&ceid=EG:ar`;
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (compatible; WaslNews/1.0)" } });
  if (!res.ok) throw new Error(`news feed ${res.status}`);
  const xml = await res.text();

  const items: RssNewsItem[] = [];
  const blocks = xml.split("<item>").slice(1);
  for (const block of blocks) {
    const rawTitle = block.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? "";
    const rawSource = block.match(/<source[^>]*>([\s\S]*?)<\/source>/)?.[1] ?? "";
    const title = decode(rawTitle);
    if (!title) continue;
    const parts = title.split(" - ");
    const source = decode(rawSource) || (parts.length > 1 ? parts[parts.length - 1] : "");
    const headline = parts.length > 1 ? parts.slice(0, -1).join(" - ") : title;
    items.push({
      title: headline,
      category: "أخبار",
      summary: source ? `المصدر: ${source}` : "",
    });
    if (items.length >= limit) break;
  }
  return items;
}
