// Food scoring: rates a food against the user's fitness goal using the three
// macros + calorie density. No AI, instant, local.
// Note: with only macros we can't perfectly tell e.g. fried vs whole foods,
// so we use calorie density + fat/carb share + protein density as proxies.

export type FoodGrade = 'great' | 'good' | 'ok' | 'avoid';

export interface FoodScoreResult {
  grade: FoodGrade;
  label: string;
  reason: string;
  color: string;
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

function proteinDensity(m: Macros): number {
  if (m.calories <= 0) return 0;
  return (m.protein / m.calories) * 100; // g protein per 100 kcal
}
function fatShare(m: Macros): number {
  if (m.calories <= 0) return 0;
  return Math.min((m.fat * 9) / m.calories, 1);
}
function carbShare(m: Macros): number {
  if (m.calories <= 0) return 0;
  return Math.min((m.carbs * 4) / m.calories, 1);
}

export function scoreFood(m: Macros, goal: string): FoodScoreResult {
  const P = proteinDensity(m);   // 蛋白密度
  const F = fatShare(m);         // 脂肪占比 0..1
  const C = carbShare(m);        // 碳水占比 0..1
  const kcal = m.calories || 0;  // 热量密度（约每100g）

  // 天然低热量食物豁免（牛奶、蔬菜、水果等，不算空热量）
  const lowCal = kcal < 100;
  // 精制高碳水空热量：碳水占比高 + 蛋白极低 + 热量密度高（油条、蛋糕、薯条）
  const junkCarb = C >= 0.5 && P < 4 && kcal >= 250;
  // 油炸类：脂肪占比高 + 蛋白不高 + 热量密度高（炸鸡、薯条）
  const fried = F >= 0.45 && P < 8 && kcal >= 200;
  const isEmpty = !lowCal && (junkCarb || fried);
  const highFat = F >= 0.5; // 脂肪占比过半

  let grade: FoodGrade;
  let reason: string;

  if (goal === 'gain') {
    // 增肌：蛋白最重要，优质碳水加分，油炸/精制压低
    if (isEmpty) {
      grade = F >= 0.5 ? 'avoid' : 'ok';
      reason = F >= 0.5 ? '油炸/高油，增肌期少吃' : '精制碳水空热量，营养一般';
    } else if (highFat && P < 10) {
      grade = 'ok';
      reason = '脂肪偏高，适量即可';
    } else if (P >= 10) {
      grade = F < 0.5 ? 'great' : 'good';
      reason = '高蛋白，很适合增肌';
    } else if (P >= 6) {
      grade = 'good';
      reason = '蛋白不错，适合补充';
    } else if (C >= 0.45 && P >= 2) {
      grade = 'good';
      reason = '优质碳水，利于增肌能量';
    } else {
      grade = 'ok';
      reason = '营养一般，可作搭配';
    }
  } else if (goal === 'lose') {
    // 减脂：高蛋白，碳水不能太高，脂肪偏低更好，空热量直接压低
    if (isEmpty) {
      grade = 'avoid';
      reason = fried ? '油炸/高油，减脂期尽量避免' : '精制碳水，减脂期少吃';
    } else if (highFat) {
      grade = P >= 10 ? 'ok' : 'avoid';
      reason = '脂肪偏高，减脂期少吃';
    } else if (P >= 10 && F < 0.35 && C < 0.5) {
      grade = 'great';
      reason = '高蛋白低脂，减脂优选';
    } else if (P >= 7 && C < 0.6) {
      grade = 'good';
      reason = '蛋白不错，适合减脂';
    } else if (C >= 0.65) {
      grade = 'ok';
      reason = '碳水偏高，控制份量';
    } else {
      grade = 'ok';
      reason = '营养一般，控制份量';
    }
  } else {
    // 维持：均衡即可，空热量压低
    if (isEmpty) {
      grade = F >= 0.5 ? 'avoid' : 'ok';
      reason = F >= 0.5 ? '油炸/高油，适量即可' : '精制碳水，营养一般';
    } else if (highFat && P < 8) {
      grade = 'ok';
      reason = '脂肪偏高，适量即可';
    } else {
      const balanced = P >= 5 && F <= 0.45 && C <= 0.65;
      if (balanced && P >= 8) {
        grade = 'great';
        reason = '营养均衡，蛋白充足';
      } else if (balanced || (C >= 0.45 && P >= 2 && F < 0.35)) {
        grade = 'good';
        reason = '营养较均衡';
      } else if (C >= 0.7) {
        grade = 'ok';
        reason = '碳水偏高，适量即可';
      } else {
        grade = 'ok';
        reason = '营养一般';
      }
    }
  }

  return {
    grade,
    label: GRADE_META[grade].label,
    reason,
    color: GRADE_META[grade].color,
  };
}

export function scoreLibraryFood(
  f: { caloriesPer100g: number; proteinPer100g: number; carbsPer100g: number; fatPer100g: number },
  goal: string
): FoodScoreResult {
  return scoreFood(
    { calories: f.caloriesPer100g, protein: f.proteinPer100g, carbs: f.carbsPer100g, fat: f.fatPer100g },
    goal
  );
}
