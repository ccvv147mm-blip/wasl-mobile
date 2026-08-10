// رسوم الوساطة التي يخصمها التطبيق من المشتري بالنقاط.
// الدفع الفعلي للسلعة يكون نقداً بالجنيه المصري عند الاستلام بين البائع والمشتري.
export const FEE_PERCENT = 5;

export function feePoints(priceEgp: number): number {
  if (!priceEgp || priceEgp <= 0) return 1;
  return Math.max(1, Math.ceil((priceEgp * FEE_PERCENT) / 100));
}
