import { format, subDays } from 'date-fns';
import type { DailyLog, FoodItem, WeightLog } from '../types';
import { parseLocalDate } from './utils';

/** 页面上用到的统计，都由原始记录算出来；纯函数，方便测试 */

export const dateKey = (d: Date) => format(d, 'yyyy-MM-dd');
export type Totals = { calories: number; protein: number; carbs: number; fat: number };
export const ZERO: Totals = { calories: 0, protein: 0, carbs: 0, fat: 0 };

export function sumFoods(foods: FoodItem[]): Totals {
  return foods.reduce((a, f) => ({
    calories: a.calories + (f.calories || 0),
    protein: a.protein + (f.protein || 0),
    carbs: a.carbs + (f.carbs || 0),
    fat: a.fat + (f.fat || 0),
  }), { ...ZERO });
}

/** 日期 → 当天的合计（只含有记录的日子） */
export function totalsByDate(logs: DailyLog[]): Map<string, Totals> {
  const m = new Map<string, Totals>();
  logs.forEach((l) => { if (l.foods.length) m.set(l.date, sumFoods(l.foods)); });
  return m;
}

/**
 * 连续打卡天数：从今天往回数，每天至少记了一样。今天还没记时从昨天开始数（今天还有机会）。
 */
export function streak(logged: Set<string>, today: Date): number {
  let d = today;
  if (!logged.has(dateKey(d))) d = subDays(d, 1);
  let n = 0;
  while (logged.has(dateKey(d))) { n++; d = subDays(d, 1); }
  return n;
}

/** 最长连续天数 */
export function longestStreak(logged: Set<string>): number {
  const days = [...logged].sort();
  let best = 0, run = 0, prev: Date | null = null;
  for (const k of days) {
    const d = parseLocalDate(k);
    run = prev && dateKey(subDays(d, 1)) === dateKey(prev) ? run + 1 : 1;
    best = Math.max(best, run); prev = d;
  }
  return best;
}

/** 最近 n 天（含今天），从早到晚 */
export function lastDays(n: number, today: Date): string[] {
  return Array.from({ length: n }, (_, i) => dateKey(subDays(today, n - 1 - i)));
}

/** 最近 n 天里有记录那几天的平均（今天还没过完，不算） */
export function averages(byDate: Map<string, Totals>, days: string[], todayKey: string): Totals & { days: number } {
  const done = days.filter((d) => d !== todayKey && byDate.has(d));
  if (!done.length) return { ...ZERO, days: 0 };
  const s = done.reduce((a, d) => {
    const t = byDate.get(d)!;
    return { calories: a.calories + t.calories, protein: a.protein + t.protein, carbs: a.carbs + t.carbs, fat: a.fat + t.fat };
  }, { ...ZERO });
  const n = done.length;
  return { calories: s.calories / n, protein: s.protein / n, carbs: s.carbs / n, fat: s.fat / n, days: n };
}

/** 体重：范围内按日期排好的点，以及首末之差 */
export function weightSeries(weights: WeightLog[], days: string[]) {
  const set = new Set(days);
  const pts = weights.filter((w) => set.has(w.date)).sort((a, b) => a.date.localeCompare(b.date));
  const delta = pts.length > 1 ? +(pts[pts.length - 1].weight - pts[0].weight).toFixed(1) : 0;
  return { pts, delta };
}

/** 最近吃过的不同食物（按名字去重，最近的在前），用来「再记一次」 */
export function recentFoods(logs: DailyLog[], limit = 8): FoodItem[] {
  const seen = new Set<string>();
  const out: FoodItem[] = [];
  const sorted = [...logs].sort((a, b) => b.date.localeCompare(a.date));
  for (const l of sorted) {
    for (const f of [...l.foods].sort((a, b) => b.timestamp - a.timestamp)) {
      if (seen.has(f.name)) continue;
      seen.add(f.name); out.push(f);
      if (out.length >= limit) return out;
    }
  }
  return out;
}

/** 下一个里程碑：7、14、21、30、50、100… */
export function nextMilestone(n: number): number {
  const steps = [7, 14, 21, 30, 50, 100, 150, 200, 365];
  return steps.find((s) => s > n) ?? Math.ceil((n + 1) / 100) * 100;
}
