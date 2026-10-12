type ImproveMode = "improve" | "expand" | "shorten" | "ideas";

function cleanText(text: string) {
  return text
    .replace(/\s+/g, " ")
    .replace(/\s+([،.!؟])/g, "$1")
    .trim();
}

function ensureEnding(text: string) {
  if (!text) return text;
  return /[.!؟]$/.test(text) ? text : `${text}.`;
}

function splitSentences(text: string) {
  return cleanText(text)
    .split(/(?<=[.!؟])\s+|[\n\r]+/)
    .map((part) => cleanText(part))
    .filter(Boolean);
}

export function improvePostFreeFallback(text: string, mode: ImproveMode) {
  const cleaned = ensureEnding(cleanText(text));
  if (!cleaned) return text;

  if (mode === "shorten") {
    const sentences = splitSentences(cleaned);
    const shortened = sentences.slice(0, Math.max(1, Math.min(2, sentences.length))).join(" ");
    return ensureEnding(shortened.length > 280 ? `${shortened.slice(0, 277).trim()}...` : shortened);
  }

  if (mode === "expand") {
    return `${cleaned}\n\nما رأيكم؟ شاركونا أفكاركم وتجاربكم في التعليقات.`;
  }

  if (mode === "ideas") {
    const topic = cleaned.replace(/[.!؟]+$/g, "");
    return [
      `1. اطرح سؤالاً مباشراً حول: ${topic}`,
      `2. شارك تجربة قصيرة أو موقفاً شخصياً مرتبطاً بهذا الموضوع.`,
      `3. اطلب من المتابعين اقتراح حلول أو آراء عملية.`,
    ].join("\n");
  }

  return ensureEnding(
    cleaned
      .replace(/\bجدا\b/g, "للغاية")
      .replace(/\bعايز\b/g, "أريد")
      .replace(/\bمش\b/g, "ليس")
      .replace(/\bازاي\b/g, "كيف"),
  );
}

export function rankFeedFreeFallback<T extends { id: string; likes: number; comments: number; content: string }>(posts: T[]) {
  return [...posts]
    .sort((a, b) => {
      const scoreA = a.likes * 2 + a.comments * 3 + Math.min(a.content.length, 500) / 100;
      const scoreB = b.likes * 2 + b.comments * 3 + Math.min(b.content.length, 500) / 100;
      return scoreB - scoreA;
    })
    .map((post) => post.id);
}

export function diagnoseErrorFreeFallback(message: string) {
  const normalized = message.toLowerCase();
  if (normalized.includes("رصيد") || normalized.includes("credit")) {
    return {
      diagnosis: "الخدمة الذكية المدفوعة غير متاحة الآن، وتم تشغيل البديل المجاني.",
      suggestion: "أعد المحاولة؛ سيواصل التطبيق العمل بالمعالجة المجانية الأساسية.",
    };
  }
  if (normalized.includes("network") || normalized.includes("fetch")) {
    return {
      diagnosis: "قد تكون المشكلة من الاتصال أو تحميل البيانات.",
      suggestion: "تأكد من الإنترنت ثم حدّث الصفحة مرة واحدة.",
    };
  }
  return {
    diagnosis: "حدث خطأ مؤقت داخل التطبيق.",
    suggestion: "جرّب تحديث الصفحة، وإذا تكرر الخطأ أرسل البلاغ مرة أخرى.",
  };
}

export function profileChatFreeFallback(question: string, displayName: string) {
  const cleaned = cleanText(question);
  return `أنا صفحة ${displayName || "المستخدم"}. استقبلت سؤالك: "${cleaned}". حالياً أعمل بالرد المجاني السريع، ويمكنني مساعدتك في مراجعة منشوراتك، أفكار المحتوى، وتنظيم صفحتك.`;
}