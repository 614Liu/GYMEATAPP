import { describe, expect, it } from 'vitest';
import { createFoodItem, newFoodFromPer100g, parseAmount, scaleAmount, toPer100g } from './nutrition';
import { scoreFood, scoreLoggedFood } from './foodScore';
import { flattenLogs, groupFoodsByDate, missingRecords, mergeIntoLocal, stripOwner, type RecordSet } from './records';
import type { FoodItem, StoredFood } from '../types';

describe('parseAmount', () => {
  it('读出克数，包括括号里的克数', () => {
    expect(parseAmount('200克')).toEqual({ value: 200, isGram: true });
    expect(parseAmount('1个 (约150g)')).toEqual({ value: 150, isGram: true });
  });
  it('没有克时按份处理', () => {
    expect(parseAmount('1个中等大小')).toEqual({ value: 1, isGram: false });
  });
  it('没有数字时当作 1 份，而不是 100', () => {
    expect(parseAmount('一碗')).toEqual({ value: 1, isGram: false });
  });
});

describe('scaleAmount', () => {
  it('克数跟着倍数放大', () => {
    expect(scaleAmount('200g', 1.5)).toBe('300g');
    expect(scaleAmount('1个 (约150g)', 2)).toBe('1个 (约300g)');
  });
  it('件数跟着倍数放大', () => {
    expect(scaleAmount('1个中等大小', 1.5)).toBe('1.5个中等大小');
  });
  it('没有数字时在前面加倍数', () => {
    expect(scaleAmount('一碗', 2)).toBe('2 × 一碗');
  });
  it('倍数为 1 时原样返回', () => {
    expect(scaleAmount('200g', 1)).toBe('200g');
  });
});

describe('createFoodItem', () => {
  const food = { name: '鸡胸肉', calories: 330, protein: 62, carbs: 0, fat: 7.2, amount: '200g' };

  it('克类记录的换算基准是每 100g', () => {
    const item = createFoodItem(food, 'lunch')!;
    expect(item.amountValue).toBe(200);
    expect(item.baseNutrition.unit).toBe('g');
    expect(item.baseNutrition.calories).toBeCloseTo(165);
  });

  it('AI 结果放大 1.5 倍后，基准仍是每 100g（份量文字同步放大）', () => {
    const mult = 1.5;
    const scaled = { ...food, calories: food.calories * mult, amount: scaleAmount(food.amount, mult) };
    const item = createFoodItem(scaled, 'lunch')!;
    expect(item.amount).toBe('300g');
    expect(item.baseNutrition.calories).toBeCloseTo(165);
  });

  it('份量为 0 时拒绝创建', () => {
    expect(createFoodItem({ ...food, amount: '0g' }, 'lunch')).toBeNull();
  });
});

describe('食物库换算', () => {
  it('每 100g 按克数换算成记录', () => {
    const f = newFoodFromPer100g({ name: '米饭', caloriesPer100g: 116, proteinPer100g: 2.6, carbsPer100g: 26, fatPer100g: 0.3 }, 150);
    expect(f).toEqual({ name: '米饭', calories: 174, protein: 3.9, carbs: 39, fat: 0.5, amount: '150g' });
  });
  it('整份营养换算成每 100g；份量不是克时标记无法换算', () => {
    expect(toPer100g({ calories: 330, protein: 62, carbs: 0, fat: 7.2, amount: '200g' }))
      .toEqual({ calories: 165, protein: 31, carbs: 0, fat: 3.6, converted: true });
    expect(toPer100g({ calories: 80, protein: 6, carbs: 1, fat: 5, amount: '1个' }).converted).toBe(false);
  });
});

describe('scoreLoggedFood', () => {
  it('大份鸡胸肉按每 100g 评分，减脂期仍是优选', () => {
    const item = createFoodItem({ name: '鸡胸肉', calories: 495, protein: 93, carbs: 0, fat: 10.8, amount: '300g' }, 'lunch') as FoodItem;
    expect(scoreLoggedFood(item, 'lose').grade).toBe('great');
  });
  it('小块蛋糕按每 100g 的热量密度评，不再被当成低热量食物豁免', () => {
    // 30g 蛋糕：整份只有 105 kcal，但每 100g 约 350 kcal
    const item = createFoodItem({ name: '蛋糕', calories: 105, protein: 1.5, carbs: 15, fat: 4.5, amount: '30g' }, 'snack') as FoodItem;
    expect(scoreFood(item, 'lose').grade).not.toBe('avoid'); // 旧算法：按整份评，漏判
    expect(scoreLoggedFood(item, 'lose').grade).toBe('avoid');
  });
});

describe('记录的分组与摊平', () => {
  const food = (id: string, date: string, timestamp: number): StoredFood => ({ id, date, timestamp } as StoredFood);

  it('按日期分组，同一天新的在前；摊平后能还原', () => {
    const logs = groupFoodsByDate([food('a', '2026-01-01', 1), food('b', '2026-01-01', 2), food('c', '2026-01-02', 3)]);
    expect(logs.find((l) => l.date === '2026-01-01')!.foods.map((f) => f.id)).toEqual(['b', 'a']);
    expect(flattenLogs(logs).map((f) => `${f.id}@${f.date}`).sort()).toEqual(['a@2026-01-01', 'b@2026-01-01', 'c@2026-01-02']);
  });

  it('stripOwner 去掉云端的 ownerUid 字段', () => {
    expect(stripOwner({ date: '2026-01-01', weight: 60, ownerUid: 'u1' })).toEqual({ date: '2026-01-01', weight: 60 });
  });
});

describe('导入 / 补传：只补没有的，不覆盖已有', () => {
  const f = (id: string) => ({ id, timestamp: 0 } as FoodItem);
  const existing: RecordSet = {
    logs: [{ date: '2026-01-01', foods: [f('1')] }],
    library: [{ id: 'L1', name: '米饭', caloriesPer100g: 116, proteinPer100g: 2.6, carbsPer100g: 26, fatPer100g: 0.3 }],
    weightLogs: [{ date: '2026-01-01', weight: 60 }],
    waterLogs: [],
  };
  const incoming: RecordSet = {
    logs: [{ date: '2026-01-01', foods: [f('1'), f('2')] }, { date: '2026-01-02', foods: [f('3')] }],
    library: [{ ...existing.library[0], name: '改过的米饭' }],
    weightLogs: [{ date: '2026-01-01', weight: 99 }, { date: '2026-01-02', weight: 61 }],
    waterLogs: [{ date: '2026-01-02', amount: 500 }],
  };

  it('missingRecords 挑出缺的部分', () => {
    const add = missingRecords(existing, incoming);
    expect(add.foods.map((x) => x.id)).toEqual(['2', '3']);
    expect(add.library).toEqual([]); // 同 id 已有，不覆盖
    expect(add.weightLogs).toEqual([{ date: '2026-01-02', weight: 61 }]); // 同一天已有，不覆盖
    expect(add.waterLogs).toEqual([{ date: '2026-01-02', amount: 500 }]);
  });

  it('mergeIntoLocal 并入后已有数据不变', () => {
    const merged = mergeIntoLocal(existing, missingRecords(existing, incoming));
    expect(flattenLogs(merged.logs).map((x) => x.id).sort()).toEqual(['1', '2', '3']);
    expect(merged.weightLogs.find((l) => l.date === '2026-01-01')!.weight).toBe(60);
    expect(merged.library[0].name).toBe('米饭');
  });
});
