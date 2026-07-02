// Food scoring: rates a food against the user's fitness goal using only
// the three macros + calories (data we already have). No AI, instant, local.

export type FoodGrade = 'great' | 'good' | 'ok' | 'avoid';

export interface FoodScoreResult {
  grade: FoodGrade;
  label: string;   // 强烈推荐 / 推荐 / 一般 / 不推荐
  reason: string;  // one-line explanation
  color: string;   // tailwind-ish semantic; used by UI
}

const GRADE_META: Record<FoodGrade, { label: string; color: string }> = {
  great: { label: '强烈推荐', color: 'emerald' },
  good:  { label: '推荐',     color: 'teal' },
  ok:    { label: '一般',     color: 'amber' },
  avoid: { label: '不推荐',   color: 'rose' },
};

interface Macros {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

// Protein density = grams of protein per 100 kcal. A robust, portion-independent
// signal of "how protein-rich is this food".
function proteinDensity(m: Macros): number {
  if (m.calories <= 0) return 0;
  return (m.protein / m.calories) * 100;
}

// Fat share of calories (fat has 9 kcal/g)
function fatShare(m: Macros): number {
  if (m.calories <= 0) return 0;
  return Math.min((m.fat * 9) / m.calories, 1);
}

// Carb share of calories (carbs have 4 kcal/g)
function carbShare(m: Macros): number {
  if (m.calories <= 0) return 0;
  return Math.min((m.carbs * 4) / m.calories, 1);
}

export function scoreFood(m: Macros, goal: string): FoodScoreResult {
  const pd = proteinDensity(m);     // g protein per 100 kcal
  const fs = fatShare(m);           // 0..1
  const cs = carbShare(m);          // 0..1

  let grade: FoodGrade;
  let reason: string;

  if (goal === 'gain') {
    // 增肌：蛋白质最重要，高碳水也加分，脂肪适中不苛求
    if (pd >= 10 && fs < 0.5) {
      grade = 'great';
      reason = '高蛋白，很适合增肌';
    } else if (pd >= 6 || cs >= 0.5) {
      grade = 'good';
      reason = pd >= 6 ? '蛋白不错，适合补充' : '碳水充足，利于增肌能量';
    } else if (fs >= 0.6) {
      grade = 'ok';
      reason = '脂肪偏高，增肌期适量即可';
    } else {
      grade = 'ok';
      reason = '营养一般，可作搭配';
    }
  } else if (goal === 'lose') {
    // 减脂：高蛋白，碳水不能太高，脂肪偏低更好
    if (pd >= 10 && fs < 0.35 && cs < 0.5) {
      grade = 'great';
      reason = '高蛋白低脂，减脂优选';
    } else if (pd >= 7 && cs < 0.6) {
      grade = 'good';
      reason = '蛋白不错，适合减脂';
    } else if (cs >= 0.65 || fs >= 0.5) {
      grade = 'avoid';
      reason = cs >= 0.65 ? '碳水偏高，减脂期少吃' : '脂肪偏高，减脂期少吃';
    } else {
      grade = 'ok';
      reason = '营养一般，控制份量';
    }
  } else {
    // 维持：三大营养素均衡即可
    const balanced = pd >= 5 && fs <= 0.45 && cs <= 0.6;
    if (balanced && pd >= 8) {
      grade = 'great';
      reason = '营养均衡，蛋白充足';
    } else if (balanced) {
      grade = 'good';
      reason = '营养较均衡';
    } else if (fs >= 0.6 || cs >= 0.7) {
      grade = 'ok';
      reason = fs >= 0.6 ? '脂肪偏高，适量即可' : '碳水偏高，适量即可';
    } else {
      grade = 'ok';
      reason = '营养一般';
    }
  }

  return {
    grade,
    label: GRADE_META[grade].label,
    reason,
    color: GRADE_META[grade].color,
  };
}
