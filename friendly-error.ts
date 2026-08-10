// Maps raw Supabase/AI errors to user-friendly Arabic messages without leaking internals.
export function friendlyError(e: unknown, fallback = "حدث خطأ، حاول مرة أخرى"): string {
  if (!e) return fallback;
  // Log raw details server/client console only
  // eslint-disable-next-line no-console
  console.error(e);

  const err = e as { message?: string; code?: string; status?: number };
  const msg = (err.message || "").toLowerCase();
  const code = err.code || "";

  if (code === "23505" || msg.includes("duplicate key") || msg.includes("unique constraint")) {
    return "هذه القيمة مستخدمة بالفعل";
  }
  if (code === "23514" || msg.includes("violates check constraint")) {
    return "القيمة المدخلة غير صالحة";
  }
  if (code === "23502" || msg.includes("null value")) {
    return "يرجى تعبئة جميع الحقول المطلوبة";
  }
  if (msg.includes("invalid login") || msg.includes("invalid credentials")) {
    return "بيانات الدخول غير صحيحة";
  }
  if (msg.includes("email not confirmed")) {
    return "يرجى تأكيد البريد الإلكتروني أولاً";
  }
  if (msg.includes("user already registered")) {
    return "هذا البريد مسجّل بالفعل";
  }
  if (msg.includes("password")) {
    return "كلمة المرور غير صالحة";
  }
  if (msg.includes("network") || msg.includes("fetch")) {
    return "تعذّر الاتصال، تحقق من الإنترنت";
  }
  if (err.status && err.status >= 500) {
    return "خدمة غير متاحة حالياً، حاول لاحقاً";
  }
  return fallback;
}
