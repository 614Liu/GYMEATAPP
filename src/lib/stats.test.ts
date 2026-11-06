import { describe, expect, it } from 'vitest';
import { averages, longestStreak, nextMilestone, recentFoods, streak, totalsByDate, weightSeries } from './stats';
import type { DailyLog, FoodItem } from '../types';

const food = (name: string, calories: number, ts = 0): FoodItem => ({
  id: name + ts, name, calories, protein: 10, carbs: 10, fat: 5, amount: '100g', amountValue: 100,
  baseNutrition: { calories, protein: 10, carbs: 10, fat: 5, unit: 'g' }, timestamp: ts,
});
const today = new Date(2026, 10, 5);

describe('streak', () => {
  it('counts back from today', () => {
    expect(streak(new Set(['2026-11-05', '2026-11-04', '2026-11-03', '2026-11-01']), today)).toBe(3);
  });
  it('starts from yesterday when today is empty', () => {
    expect(streak(new Set(['2026-11-04', '2026-11-03']), today)).toBe(2);
  });
  it('is 0 with a gap of two days', () => {
    expect(streak(new Set(['2026-11-03']), today)).toBe(0);
  });
  it('longest run across months', () => {
    expect(longestStreak(new Set(['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-03']))).toBe(3);
  });
});

describe('averages', () => {
  it('skips today and empty days', () => {
    const logs: DailyLog[] = [
      { date: '2026-11-05', foods: [food('a', 500)] },
      { date: '2026-11-04', foods: [food('b', 2000)] },
      { date: '2026-11-03', foods: [food('c', 1000)] },
      { date: '2026-11-02', foods: [] },
    ];
    const a = averages(totalsByDate(logs), ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05'], '2026-11-05');
    expect(a.calories).toBe(1500);
    expect(a.days).toBe(2);
  });
});

describe('weightSeries', () => {
  it('sorts and gives first-to-last change', () => {
    const w = weightSeries([{ date: '2026-11-05', weight: 66.4 }, { date: '2026-11-01', weight: 67.1 }, { date: '2026-10-01', weight: 70 }], ['2026-11-01', '2026-11-05']);
    expect(w.pts.map((p) => p.weight)).toEqual([67.1, 66.4]);
    expect(w.delta).toBe(-0.7);
  });
});

describe('recentFoods', () => {
  it('dedupes by name, newest first', () => {
    const logs: DailyLog[] = [
      { date: '2026-11-04', foods: [food('鸡胸', 200, 1), food('苹果', 50, 2)] },
      { date: '2026-11-05', foods: [food('鸡胸', 210, 3)] },
    ];
    expect(recentFoods(logs).map((f) => [f.name, f.calories])).toEqual([['鸡胸', 210], ['苹果', 50]]);
  });
});

describe('nextMilestone', () => {
  it('picks the next step', () => {
    expect(nextMilestone(12)).toBe(14);
    expect(nextMilestone(400)).toBe(500);
  });
});
