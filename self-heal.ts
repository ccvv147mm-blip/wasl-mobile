/**
 * الإصلاح الذاتي: تصنيف الأخطاء الشائعة ومحاولة إصلاحها تلقائياً في المتصفح.
 */

const ENABLED_KEY = "self-heal-enabled";
const ATTEMPT_KEY = "self-heal-attempts";
const ATTEMPT_WINDOW = 5 * 60 * 1000; // 5 دقائق
const MAX_ATTEMPTS = 2;

export type HealKind = "chunk" | "network" | "storage" | "media" | "unknown";

export function isSelfHealEnabled(): boolean {
  if (typeof localStorage === "undefined") return true;
  return localStorage.getItem(ENABLED_KEY) !== "off";
}

export function setSelfHealEnabled(on: boolean) {
  try {
    localStorage.setItem(ENABLED_KEY, on ? "on" : "off");
  } catch {
    /* ignore */
  }
}

export function classifyError(message: string): HealKind {
  const m = (message || "").toLowerCase();
  if (
    m.includes("failed to fetch dynamically imported module") ||
    m.includes("importing a module script failed") ||
    m.includes("loading chunk") ||
    m.includes("chunkloaderror") ||
    m.includes("unexpected token '<'")
  )
    return "chunk";
  if (m.includes("failed to fetch") || m.includes("networkerror") || m.includes("load failed")) return "network";
  if (m.includes("quotaexceeded") || m.includes("exceeded the quota") || m.includes("localstorage")) return "storage";
  if (m.includes("play()") || m.includes("notallowederror") || m.includes("mediaerror") || m.includes("getusermedia"))
    return "media";
  return "unknown";
}

function attemptsInWindow(): number {
  try {
    const raw = sessionStorage.getItem(ATTEMPT_KEY);
    if (!raw) return 0;
    const list = (JSON.parse(raw) as number[]).filter((t) => Date.now() - t < ATTEMPT_WINDOW);
    return list.length;
  } catch {
    return 0;
  }
}

function recordAttempt() {
  try {
    const raw = sessionStorage.getItem(ATTEMPT_KEY);
    const list = raw ? (JSON.parse(raw) as number[]) : [];
    list.push(Date.now());
    sessionStorage.setItem(ATTEMPT_KEY, JSON.stringify(list.filter((t) => Date.now() - t < ATTEMPT_WINDOW)));
  } catch {
    /* ignore */
  }
}

/** يفرّغ الذاكرة المؤقتة للمتصفح ويلغي تسجيل خدمات العمل الخلفي. */
export async function clearAppCaches() {
  try {
    if (typeof caches !== "undefined") {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  } catch {
    /* ignore */
  }
  try {
    const regs = await navigator.serviceWorker?.getRegistrations?.();
    await Promise.all((regs ?? []).map((r) => r.unregister()));
  } catch {
    /* ignore */
  }
}

/** يحذف مفاتيح التخزين المؤقتة فقط (لا يمس تسجيل الدخول). */
export function clearVolatileStorage() {
  try {
    const keep = (k: string) => k.startsWith("sb-") || k.includes("auth");
    Object.keys(localStorage)
      .filter((k) => !keep(k))
      .forEach((k) => localStorage.removeItem(k));
  } catch {
    /* ignore */
  }
}

/**
 * يحاول إصلاح الخطأ تلقائياً. يعيد وصفاً عربياً للإجراء الذي تم، أو null إذا لا إجراء.
 */
export async function tryAutoHeal(kind: HealKind): Promise<string | null> {
  if (!isSelfHealEnabled()) return null;
  if (attemptsInWindow() >= MAX_ATTEMPTS) return null;

  if (kind === "chunk") {
    recordAttempt();
    await clearAppCaches();
    setTimeout(() => window.location.reload(), 900);
    return "تم تحديث نسخة التطبيق وإعادة تحميل الصفحة تلقائياً.";
  }

  if (kind === "storage") {
    recordAttempt();
    clearVolatileStorage();
    return "تم تفريغ البيانات المؤقتة لتحرير مساحة.";
  }

  if (kind === "network") {
    recordAttempt();
    return navigator.onLine
      ? "الاتصال ضعيف — سيتم إعادة المحاولة تلقائياً."
      : "لا يوجد اتصال بالإنترنت — سنكمل تلقائياً عند عودة الشبكة.";
  }

  return null;
}

/** إصلاح فوري كامل يطلبه المستخدم بنفسه. */
export async function runFullRepair() {
  clearVolatileStorage();
  await clearAppCaches();
  window.location.reload();
}
