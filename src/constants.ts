import type { MacroGoals } from './types';
import type { FoodGrade } from './lib/foodScore';

// Region flag: "cn" hides Google login (unusable in mainland China).
// Set via VITE_APP_REGION at build time. Defaults to global (login shown).
export const IS_CN_VERSION = (import.meta as any).env?.VITE_APP_REGION === 'cn';

export const DEFAULT_GOALS: MacroGoals = {
  calories: 2000,
  protein: 150,
  carbs: 200,
  fat: 65,
};

export const COLORS = {
  calories: '#10B981', // emerald-500
  protein: '#a855f7',  // purple-500
  carbs: '#3b82f6',    // blue-500
  fat: '#f97316',      // orange-500
};

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
