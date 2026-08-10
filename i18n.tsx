import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { translateTexts } from "@/lib/translate.functions";

export type LangOption = { code: string; name: string; native: string; rtl?: boolean };

/** لغات مقترحة (الترجمة تعمل مع أي كود لغة عالمي) */
export const LANGUAGES: LangOption[] = [
  { code: "ar", name: "Arabic", native: "العربية", rtl: true },
  { code: "en", name: "English", native: "English" },
  { code: "fr", name: "French", native: "Français" },
  { code: "es", name: "Spanish", native: "Español" },
  { code: "pt", name: "Portuguese", native: "Português" },
  { code: "de", name: "German", native: "Deutsch" },
  { code: "it", name: "Italian", native: "Italiano" },
  { code: "ru", name: "Russian", native: "Русский" },
  { code: "tr", name: "Turkish", native: "Türkçe" },
  { code: "fa", name: "Persian", native: "فارسی", rtl: true },
  { code: "ur", name: "Urdu", native: "اردو", rtl: true },
  { code: "he", name: "Hebrew", native: "עברית", rtl: true },
  { code: "hi", name: "Hindi", native: "हिन्दी" },
  { code: "bn", name: "Bengali", native: "বাংলা" },
  { code: "id", name: "Indonesian", native: "Bahasa Indonesia" },
  { code: "ms", name: "Malay", native: "Bahasa Melayu" },
  { code: "sw", name: "Swahili", native: "Kiswahili" },
  { code: "zh", name: "Chinese", native: "中文" },
  { code: "ja", name: "Japanese", native: "日本語" },
  { code: "ko", name: "Korean", native: "한국어" },
  { code: "nl", name: "Dutch", native: "Nederlands" },
  { code: "pl", name: "Polish", native: "Polski" },
  { code: "uk", name: "Ukrainian", native: "Українська" },
  { code: "ro", name: "Romanian", native: "Română" },
  { code: "el", name: "Greek", native: "Ελληνικά" },
  { code: "sv", name: "Swedish", native: "Svenska" },
  { code: "th", name: "Thai", native: "ไทย" },
  { code: "vi", name: "Vietnamese", native: "Tiếng Việt" },
  { code: "ha", name: "Hausa", native: "Hausa" },
  { code: "am", name: "Amharic", native: "አማርኛ" },
  { code: "so", name: "Somali", native: "Soomaali" },
  { code: "az", name: "Azerbaijani", native: "Azərbaycan" },
  { code: "kk", name: "Kazakh", native: "Қазақша" },
  { code: "fil", name: "Filipino", native: "Filipino" },
];

const RTL = new Set(["ar", "fa", "ur", "he", "ps", "sd", "ckb", "dv", "yi"]);
const STORAGE_KEY = "wasl.lang";
const CACHE_KEY = "wasl.tr.";
const ARABIC = /[\u0600-\u06FF]/;
const BRAND = new Set(["وَصْل", "وصل", "Wasl"]);
const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA", "CODE", "PRE", "SVG"]);

export function detectLang(): string {
  if (typeof navigator === "undefined") return "ar";
  const raw = navigator.languages?.[0] ?? navigator.language ?? "ar";
  const base = raw.toLowerCase().split("-")[0]!;
  return base || "ar";
}

type Ctx = {
  lang: string;
  rtl: boolean;
  setLang: (code: string) => void;
  translating: boolean;
  /** ترجمة نص واحد يدوياً (للمنشورات مثلاً) */
  translate: (text: string) => Promise<string>;
};

const I18nContext = createContext<Ctx>({
  lang: "ar",
  rtl: true,
  setLang: () => {},
  translating: false,
  translate: async (t) => t,
});

export const useI18n = () => useContext(I18nContext);

function loadCache(lang: string): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY + lang) || "{}") as Record<string, string>;
  } catch {
    return {};
  }
}

function saveCache(lang: string, cache: Record<string, string>) {
  try {
    localStorage.setItem(CACHE_KEY + lang, JSON.stringify(cache));
  } catch {
    /* التخزين ممتلئ — نتجاهل */
  }
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState("ar");
  const [translating, setTranslating] = useState(false);
  const cacheRef = useRef<Record<string, string>>({});
  const pendingRef = useRef<Set<Text>>(new Set());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const langRef = useRef("ar");

  // اكتشاف اللغة من الجهاز/البلد مع احترام اختيار المستخدم
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    const next = saved || detectLang();
    langRef.current = next;
    cacheRef.current = loadCache(next);
    setLangState(next);
  }, []);

  const rtl = RTL.has(lang);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = rtl ? "rtl" : "ltr";
  }, [lang, rtl]);

  const flush = useCallback(async () => {
    const target = langRef.current;
    if (target === "ar") return;
    const nodes = Array.from(pendingRef.current);
    pendingRef.current.clear();
    if (!nodes.length) return;

    const cache = cacheRef.current;
    const missing = new Set<string>();
    const groups = new Map<string, Text[]>();

    for (const node of nodes) {
      if (!node.isConnected) continue;
      const text = (node.nodeValue ?? "").trim();
      if (!text || BRAND.has(text) || !ARABIC.test(text) || text.length > 1500) continue;
      const list = groups.get(text) ?? [];
      list.push(node);
      groups.set(text, list);
      if (!(text in cache)) missing.add(text);
    }
    if (!groups.size) return;

    const apply = () => {
      for (const [source, list] of groups) {
        const out = cache[source];
        if (!out || out === source) continue;
        for (const node of list) {
          if (!node.isConnected) continue;
          const value = node.nodeValue ?? "";
          const lead = value.match(/^\s*/)?.[0] ?? "";
          const tail = value.match(/\s*$/)?.[0] ?? "";
          node.nodeValue = lead + out + tail;
        }
      }
    };

    apply();

    const list = Array.from(missing);
    if (!list.length) return;

    setTranslating(true);
    try {
      for (let i = 0; i < list.length; i += 40) {
        const chunk = list.slice(i, i + 40);
        const res = await translateTexts({ data: { lang: target, texts: chunk } });
        if (langRef.current !== target) return;
        Object.assign(cache, res.translations);
        saveCache(target, cache);
        apply();
      }
    } catch (e) {
      console.error("translate flush:", e);
    } finally {
      setTranslating(false);
    }
  }, []);

  const schedule = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => void flush(), 120);
  }, [flush]);

  const collect = useCallback(
    (root: Node) => {
      if (root.nodeType === Node.TEXT_NODE) {
        const parent = (root as Text).parentElement;
        if (!parent || SKIP_TAGS.has(parent.tagName) || parent.closest("[data-no-translate]")) return;
        pendingRef.current.add(root as Text);
        return;
      }
      if (root.nodeType !== Node.ELEMENT_NODE) return;
      const el = root as Element;
      if (SKIP_TAGS.has(el.tagName) || el.hasAttribute("data-no-translate")) return;
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
          const p = (node as Text).parentElement;
          if (!p || SKIP_TAGS.has(p.tagName) || p.closest("[data-no-translate]")) return NodeFilter.FILTER_REJECT;
          const t = node.nodeValue?.trim() ?? "";
          return t && !BRAND.has(t) && ARABIC.test(t) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
        },
      });
      let n = walker.nextNode();
      while (n) {
        pendingRef.current.add(n as Text);
        n = walker.nextNode();
      }
    },
    [],
  );

  // مراقبة الصفحة وترجمة أي محتوى جديد (منشورات، رسائل، قوائم…)
  useEffect(() => {
    langRef.current = lang;
    if (lang === "ar") return;
    cacheRef.current = loadCache(lang);
    collect(document.body);
    schedule();

    const observer = new MutationObserver((records) => {
      for (const r of records) {
        if (r.type === "childList") r.addedNodes.forEach((n) => collect(n));
        else if (r.type === "characterData") collect(r.target);
      }
      schedule();
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, [lang, collect, schedule]);

  const setLang = useCallback((code: string) => {
    const next = code.toLowerCase();
    localStorage.setItem(STORAGE_KEY, next);
    // إعادة التحميل تضمن عرض النصوص الأصلية ثم ترجمتها بالكامل
    window.location.reload();
  }, []);

  const translate = useCallback(async (text: string) => {
    const target = langRef.current;
    if (target === "ar" || !text.trim()) return text;
    const cache = cacheRef.current;
    if (cache[text]) return cache[text]!;
    const res = await translateTexts({ data: { lang: target, texts: [text] } });
    Object.assign(cache, res.translations);
    saveCache(target, cache);
    return res.translations[text] ?? text;
  }, []);

  const value = useMemo<Ctx>(() => ({ lang, rtl, setLang, translating, translate }), [lang, rtl, setLang, translating, translate]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
