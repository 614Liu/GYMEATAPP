import type { FoodItem, MealType, NewFood } from '../types';

/**
 * 解析份量串，判断它是「克」还是「件/份」。
 *
 * 例："200克" → {value:200, isGram:true}；"1个 (约150g)" → {value:150, isGram:true}；
 *     "1个中等大小" → {value:1, isGram:false}；"一碗" → {value:1, isGram:false}
 */
export function parseAmount(amountStr: string): { value: number; isGram: boolean } {
  const str = amountStr || '100g';

  // 优先找明确的克数（"1个 (约150g)" 里也能取到 150）
  const gramMatch = str.match(/(\d+(?:\.\d+)?)\s*(?:g|克)/i);
  if (gramMatch) return { value: Number(gramMatch[1]), isGram: true };

  // 没有克，退而取任意数字，按「件/份」处理
  const anyNumMatch = str.match(/(\d+(?:\.\d+)?)/);
  if (anyNumMatch) return { value: Number(anyNumMatch[1]), isGram: false };

  // 没有数字（"一碗"、"适量"）：当作 1 份。以前这里返回 100，会把每份营养除以 100。
  const looksGram = /g|克/i.test(str);
  return { value: looksGram ? 100 : 1, isGram: looksGram };
}

/** 份量是否可用于换算（大于 0 的有限数） */
export function isValidAmountValue(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * 把份量串按倍数放大。营养数值放大时份量文字要跟着变，否则换算基准会错。
 *
 * "200g" ×1.5 → "300g"；"1个 (约150g)" ×2 → "1个 (约300g)"；
 * "1个中等大小" ×1.5 → "1.5个中等大小"；"一碗" ×2 → "2 × 一碗"
 */
export function scaleAmount(amountStr: string, mult: number): string {
  if (mult === 1 || !isValidAmountValue(mult)) return amountStr;
  const str = amountStr || '100g';

  const gramMatch = str.match(/(\d+(?:\.\d+)?)(\s*(?:g|克))/i);
  if (gramMatch && gramMatch.index !== undefined) {
    const scaled = round1(Number(gramMatch[1]) * mult);
    return str.slice(0, gramMatch.index) + scaled + gramMatch[2] + str.slice(gramMatch.index + gramMatch[0].length);
  }

  const numMatch = str.match(/(\d+(?:\.\d+)?)/);
  if (numMatch && numMatch.index !== undefined) {
    const scaled = round1(Number(numMatch[1]) * mult);
    return str.slice(0, numMatch.index) + scaled + str.slice(numMatch.index + numMatch[0].length);
  }

  return `${round1(mult)} × ${str}`;
}

/** 由三大宏量营养素反算热量：蛋白 4 kcal/g、碳水 4 kcal/g、脂肪 9 kcal/g */
export const getAutoCalories = (p: string | number, c: string | number, f: string | number) => {
  const protein = typeof p === 'string' ? parseFloat(p) || 0 : p;
  const carbs = typeof c === 'string' ? parseFloat(c) || 0 : c;
  const fat = typeof f === 'string' ? parseFloat(f) || 0 : f;
  return Math.round(protein * 4 + carbs * 4 + fat * 9);
};

export function newId(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).substring(2, 11);
}

/**
 * 由界面给的营养数值生成一条完整记录。
 *
 * baseNutrition 约定：克类食物存「每 100g」，件类食物存「每 1 份」。修改摄入量时按它换算。
 * 份量无法换算（为 0 或负数）时返回 null，调用方应提示用户。
 */
export function createFoodItem(food: NewFood, mealType: MealType, now = Date.now()): FoodItem | null {
  const { value, isGram } = parseAmount(food.amount);
  if (!isValidAmountValue(value)) return null;

  const ratio = isGram ? 100 / value : 1 / value;
  return {
    ...food,
    id: newId(),
    timestamp: now,
    mealType,
    amountValue: value,
    baseNutrition: {
      calories: food.calories * ratio,
      protein: food.protein * ratio,
      carbs: food.carbs * ratio,
      fat: food.fat * ratio,
      unit: isGram ? 'g' : 'unit',
    },
  };
}

/** 把每 100g 的营养按克数换算成一条待添加的记录（食物库 → 今日记录） */
export function newFoodFromPer100g(
  f: { name: string; caloriesPer100g: number; proteinPer100g: number; carbsPer100g: number; fatPer100g: number },
  grams: number
): NewFood {
  const ratio = grams / 100;
  return {
    name: f.name,
    calories: Math.round(f.caloriesPer100g * ratio),
    protein: round1(f.proteinPer100g * ratio),
    carbs: round1(f.carbsPer100g * ratio),
    fat: round1(f.fatPer100g * ratio),
    amount: `${grams}g`,
  };
}

/** 把某一份量下的营养换算成每 100g；份量不是克时无法换算，原样返回并标记 */
export function toPer100g(
  n: { calories: number; protein: number; carbs: number; fat: number; amount: string }
): { calories: number; protein: number; carbs: number; fat: number; converted: boolean } {
  const { value, isGram } = parseAmount(n.amount);
  const converted = isGram && isValidAmountValue(value);
  const ratio = converted ? 100 / value : 1;
  return {
    calories: Math.round((n.calories || 0) * ratio),
    protein: round1((n.protein || 0) * ratio),
    carbs: round1((n.carbs || 0) * ratio),
    fat: round1((n.fat || 0) * ratio),
    converted,
  };
}

/**
 * 一条记录的换算基准：克类是「每 100g」，件类是「每 1 份」。
 * 老数据可能没有 baseNutrition，按当前份量反推补齐。
 */
export function foodBase(food: FoodItem): { base: FoodItem['baseNutrition']; isGram: boolean; unitLabel: string } {
  const unitLabel = food.amount.replace(/[\d.]+/g, '').trim() || '份';
  if (food.baseNutrition) return { base: food.baseNutrition, isGram: food.baseNutrition.unit === 'g', unitLabel };
  const { isGram } = parseAmount(food.amount);
  const per = food.amountValue || (isGram ? 100 : 1);
  const scale = (isGram ? 100 : 1) / per;
  return {
    isGram, unitLabel,
    base: { calories: food.calories * scale, protein: food.protein * scale, carbs: food.carbs * scale, fat: food.fat * scale, unit: isGram ? 'g' : 'unit' },
  };
}

/** 改份量：按固定基准换算（不能用会漂移的 amountValue 当除数） */
export function rescaleFood(food: FoodItem, value: number): FoodItem {
  const { base, isGram, unitLabel } = foodBase(food);
  const ratio = isGram ? value / 100 : value;
  return {
    ...food,
    amountValue: value,
    amount: isGram ? `${value}g` : `${value} ${unitLabel === 'g' ? '份' : unitLabel}`,
    calories: Math.round(base.calories * ratio),
    protein: round1(base.protein * ratio),
    carbs: round1(base.carbs * ratio),
    fat: round1(base.fat * ratio),
    baseNutrition: base,
  };
}

/** 已记过的一条 → 再记一次用的数据 */
export function toNewFood(f: FoodItem): NewFood {
  return { name: f.name, calories: f.calories, protein: f.protein, carbs: f.carbs, fat: f.fat, amount: f.amount };
}
