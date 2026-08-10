/**
 * تنقية نص البحث قبل استخدامه في مرشّحات PostgREST.
 * تُزال الرموز التي يعتبرها PostgREST فواصل/مجموعات/عوامل حتى لا يمكن
 * حَقْن شروط إضافية داخل تعبير .or()
 */
export function sanitizeFilterTerm(input: string): string {
  return input
    .replace(/[,()."'\\%*:;{}[\]]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
