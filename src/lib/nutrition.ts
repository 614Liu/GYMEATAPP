/**
 * 解析 AI 返回的份量串，判断它是「克」还是「件/份」。
 *
 * 例："200克" → {value:200, isGram:true}；"1个 (约150g)" → {value:150, isGram:true}；
 *     "1个中等大小" → {value:1, isGram:false}
 */
export function parseAmount(amountStr: string): { value: number; isGram: boolean } {
  const str = amountStr || '100g';

  // 优先找明确的克数（"1个 (约150g)" 里也能取到 150）
  const gramMatch = str.match(/(\d+(?:\.\d+)?)\s*(?:g|克)/i);
  if (gramMatch) return { value: Number(gramMatch[1]), isGram: true };

  // 没有克，退而取任意数字，按「件/份」处理
  const anyNumMatch = str.match(/(\d+(?:\.\d+)?)/);
  if (anyNumMatch) return { value: Number(anyNumMatch[1]), isGram: false };

  const looksGram = str.toLowerCase().includes('g') || str.includes('克');
  return { value: 100, isGram: looksGram };
}

/** 由三大宏量营养素反算热量：蛋白 4 kcal/g、碳水 4 kcal/g、脂肪 9 kcal/g */
export const getAutoCalories = (p: string | number, c: string | number, f: string | number) => {
  const protein = typeof p === 'string' ? parseFloat(p) || 0 : p;
  const carbs = typeof c === 'string' ? parseFloat(c) || 0 : c;
  const fat = typeof f === 'string' ? parseFloat(f) || 0 : f;
  return Math.round(protein * 4 + carbs * 4 + fat * 9);
};
