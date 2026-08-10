/**
 * الاسم الظاهر للآخرين. لا يُستخدم اسم المستخدم (المشتق من البريد) أبداً
 * في الواجهات العامة حفاظاً على خصوصية بريد المستخدم.
 */
export function publicName(p?: { full_name?: string | null } | null): string {
  const n = p?.full_name?.trim();
  return n && n.length > 0 ? n : "مستخدم";
}
