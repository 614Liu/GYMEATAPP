import type { MacroGoals, MealType } from './types';
import type { FoodGrade } from './lib/foodScore';

// Region flag: "cn" hides Google login (unusable in mainland China).
// Set via VITE_APP_REGION at build time. Defaults to global (login shown).
export const IS_CN_VERSION = import.meta.env.VITE_APP_REGION === 'cn';

export const DEFAULT_GOALS: MacroGoals = {
  calories: 2000,
  protein: 150,
  carbs: 200,
  fat: 65,
};

export const WATER_GOAL_ML = 2000;

/**
 * 三大营养素的配色，全应用统一：蛋白=紫、碳水=蓝、脂肪=橙。
 * 以前饼图和进度条用这一套，食物清单和修改弹窗却是蛋白蓝、碳水紫、脂肪琥珀，同一个营养素两种颜色。
 */
export const COLORS = {
  calories: '#10B981', // emerald-500
  protein: '#a855f7',  // purple-500
  carbs: '#3b82f6',    // blue-500
  fat: '#f97316',      // orange-500
};

// Tailwind 需要完整的类名字面量才会生成样式，所以这里写死而不是拼字符串。
export const MACRO_TEXT = {
  protein: 'text-purple-500',
  carbs: 'text-blue-500',
  fat: 'text-orange-500',
} as const;

// Food score badge — static class maps so Tailwind keeps them.
export const SCORE_BADGE_STYLES: Record<FoodGrade, string> = {
  great: 'bg-emerald-50 text-emerald-600',
  good: 'bg-teal-50 text-teal-600',
  ok: 'bg-amber-50 text-amber-600',
  avoid: 'bg-rose-50 text-rose-600',
};

export const MACRO_LABELS = {
  protein: '蛋白质',
  carbs: '碳水',
  fat: '脂肪',
  calories: '热量',
};

export const MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];

export const MEAL_LABELS: Record<MealType, string> = {
  breakfast: '早餐',
  lunch: '午餐',
  dinner: '晚餐',
  snack: '加餐',
};

export type FitnessGoal = 'gain' | 'lose' | 'maintain';

export const FITNESS_GOAL_OPTIONS: { key: FitnessGoal; label: string }[] = [
  { key: 'gain', label: '增肌' },
  { key: 'lose', label: '减脂' },
  { key: 'maintain', label: '维持' },
];
