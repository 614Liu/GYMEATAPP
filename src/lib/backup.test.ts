import { describe, expect, it } from 'vitest';
import { buildBackupJson, parseBackup, type BackupContent } from './backup';
import { flattenLogs } from './records';

const content: BackupContent = {
  logs: [{
    date: '2026-01-01',
    foods: [{
      id: 'f1', name: '鸡胸肉', calories: 330, protein: 62, carbs: 0, fat: 7.2, amount: '200g', amountValue: 200,
      baseNutrition: { calories: 165, protein: 31, carbs: 0, fat: 3.6, unit: 'g' }, timestamp: 1, mealType: 'lunch',
    }],
  }],
  library: [{ id: 'L1', name: '米饭', caloriesPer100g: 116, proteinPer100g: 2.6, carbsPer100g: 26, fatPer100g: 0.3, createdAt: 1 }],
  weightLogs: [{ date: '2026-01-01', weight: 65.5 }],
  waterLogs: [{ date: '2026-01-01', amount: 750 }],
  goals: { calories: 2025, protein: 160, carbs: 200, fat: 65 },
  fitnessGoal: 'lose',
};

describe('备份文件', () => {
  it('导出再导入，内容不变', () => {
    expect(parseBackup(buildBackupJson(content))).toEqual(content);
  });

  it('不是本应用的文件时报错', () => {
    expect(() => parseBackup('不是 JSON')).toThrow('无法解析');
    expect(() => parseBackup(JSON.stringify({ app: 'other' }))).toThrow('不是健食的备份');
    expect(() => parseBackup(JSON.stringify({ app: 'gymeat', version: 99 }))).toThrow('更新的版本');
  });

  it('清洗多余字段和不合理的数值', () => {
    const dirty = JSON.parse(buildBackupJson(content));
    dirty.logs[0].foods[0].isFood = true; // 旧版 AI 识别留下的字段
    dirty.logs[0].foods[0].calories = -50;
    dirty.weightLogs.push({ date: '2026-01-02', weight: 0 });
    dirty.goals = { calories: 0 };
    const parsed = parseBackup(JSON.stringify(dirty));
    const food = flattenLogs(parsed.logs)[0] as unknown as Record<string, unknown>;
    expect(food.isFood).toBeUndefined();
    expect(food.calories).toBe(0);
    expect(parsed.weightLogs).toHaveLength(1);
    expect(parsed.goals.calories).toBeGreaterThan(0); // 不合理的目标回退为默认
  });
});
