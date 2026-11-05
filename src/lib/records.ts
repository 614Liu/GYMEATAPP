import type { DailyLog, FoodItem, LibraryFood, MealType, StoredFood, WaterLog, WeightLog } from '../types';

// ---------- 清洗：上传前只保留合法字段，数值收进合理范围 ----------
// 旧版本的 AI 识别会把 isFood、reason 之类的字段一起写进记录；备份文件也可能被手改过。
// 云端安全规则只接受固定字段，不清洗的话整批上传会被拒。

const MEALS: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const clampNum = (v: unknown, max: number, fallback = 0): number => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? Math.min(Math.max(n, 0), max) : fallback;
};
const cleanName = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, 100) : '未命名食物');
const isNonEmptyId = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 200 && !v.includes('/');

/** 清洗一条饮食记录；没有 id 或日期不合法时返回 null */
export function sanitizeFood(raw: unknown, date: string): StoredFood | null {
  if (!raw || typeof raw !== 'object' || !DATE_RE.test(date)) return null;
  const f = raw as Record<string, unknown>;
  if (!isNonEmptyId(f.id)) return null;
  const base = f.baseNutrition as Record<string, unknown> | undefined;
  const hasBase = !!base && typeof base === 'object';
  // 很老的数据没有 baseNutrition，修改摄入量时 EditFoodModal 会按当前份量反推，这里不编造
  const food = {
    id: f.id,
    date,
    name: cleanName(f.name),
    calories: clampNum(f.calories, 20000),
    protein: clampNum(f.protein, 2000),
    carbs: clampNum(f.carbs, 2000),
    fat: clampNum(f.fat, 2000),
    amount: typeof f.amount === 'string' ? f.amount.slice(0, 60) : '1 份',
    amountValue: clampNum(f.amountValue, 100000, 1),
    timestamp: typeof f.timestamp === 'number' && Number.isFinite(f.timestamp) ? f.timestamp : Date.now(),
    ...(hasBase ? {
      baseNutrition: {
        calories: clampNum(base.calories, 100000),
        protein: clampNum(base.protein, 10000),
        carbs: clampNum(base.carbs, 10000),
        fat: clampNum(base.fat, 10000),
        unit: base.unit === 'unit' ? 'unit' as const : 'g' as const,
      },
    } : {}),
    ...(MEALS.includes(f.mealType as MealType) ? { mealType: f.mealType as MealType } : {}),
  };
  return food as StoredFood;
}

export function sanitizeLibraryFood(raw: unknown): LibraryFood | null {
  if (!raw || typeof raw !== 'object') return null;
  const f = raw as Record<string, unknown>;
  if (!isNonEmptyId(f.id)) return null;
  return {
    id: f.id,
    name: cleanName(f.name),
    caloriesPer100g: clampNum(f.caloriesPer100g, 20000),
    proteinPer100g: clampNum(f.proteinPer100g, 2000),
    carbsPer100g: clampNum(f.carbsPer100g, 2000),
    fatPer100g: clampNum(f.fatPer100g, 2000),
    ...(typeof f.createdAt === 'number' && Number.isFinite(f.createdAt) ? { createdAt: f.createdAt } : {}),
  };
}

export function sanitizeWeight(raw: unknown): WeightLog | null {
  const l = raw as Record<string, unknown> | null;
  if (!l || typeof l.date !== 'string' || !DATE_RE.test(l.date)) return null;
  const weight = Number(l.weight);
  return Number.isFinite(weight) && weight > 0 && weight <= 500 ? { date: l.date, weight } : null;
}

export function sanitizeWater(raw: unknown): WaterLog | null {
  const l = raw as Record<string, unknown> | null;
  if (!l || typeof l.date !== 'string' || !DATE_RE.test(l.date)) return null;
  return { date: l.date, amount: clampNum(l.amount, 20000) };
}

const notNull = <T,>(v: T | null): v is T => v !== null;

/** 清洗一整套记录（旧数据迁移、游客数据补传、导入备份时用） */
export function sanitizeRecords(r: { logs?: unknown; library?: unknown; weightLogs?: unknown; waterLogs?: unknown }): RecordSet {
  const logs = Array.isArray(r.logs) ? r.logs : [];
  const foods = logs.flatMap((log: unknown) => {
    const l = log as { date?: unknown; foods?: unknown } | null;
    if (!l || typeof l.date !== 'string' || !Array.isArray(l.foods)) return [];
    return l.foods.map((f) => sanitizeFood(f, l.date as string)).filter(notNull);
  });
  return {
    logs: groupFoodsByDate(foods),
    library: (Array.isArray(r.library) ? r.library : []).map(sanitizeLibraryFood).filter(notNull),
    weightLogs: (Array.isArray(r.weightLogs) ? r.weightLogs : []).map(sanitizeWeight).filter(notNull),
    waterLogs: (Array.isArray(r.waterLogs) ? r.waterLogs : []).map(sanitizeWater).filter(notNull),
  };
}

/** 按日期分组（同一天内新的在前），供界面按天展示 */
export function groupFoodsByDate(foods: StoredFood[]): DailyLog[] {
  const byDate = new Map<string, FoodItem[]>();
  for (const { date, ...food } of foods) {
    const list = byDate.get(date);
    if (list) list.push(food);
    else byDate.set(date, [food]);
  }
  return [...byDate.entries()].map(([date, list]) => ({
    date,
    foods: list.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)),
  }));
}

/** 按天分组的记录摊平成一条一条（迁移旧数据、上传、导出用） */
export function flattenLogs(logs: DailyLog[]): StoredFood[] {
  return logs.flatMap((log) => (log.foods || []).map((food) => ({ ...food, date: log.date })));
}

/** 按 id 去重，先出现的优先 */
export function dedupeById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((item) => (seen.has(item.id) ? false : (seen.add(item.id), true)));
}

/** 去掉 Firestore 里多出来的 ownerUid 等字段，只保留界面需要的 */
export function stripOwner<T extends object>(item: T): T {
  const { ownerUid: _owner, ...rest } = item as T & { ownerUid?: unknown };
  return rest as T;
}

export interface RecordSet {
  logs: DailyLog[];
  library: LibraryFood[];
  weightLogs: WeightLog[];
  waterLogs: WaterLog[];
}

/** 导入时只「补上没有的」，不覆盖已有：饮食和食物库按 id，体重和饮水按日期 */
export function missingRecords(existing: RecordSet, incoming: RecordSet) {
  const foodIds = new Set(flattenLogs(existing.logs).map((f) => f.id));
  const libraryIds = new Set(existing.library.map((f) => f.id));
  const weightDates = new Set(existing.weightLogs.map((l) => l.date));
  const waterDates = new Set(existing.waterLogs.map((l) => l.date));
  return {
    foods: dedupeById(flattenLogs(incoming.logs)).filter((f) => !foodIds.has(f.id)),
    library: dedupeById(incoming.library).filter((f) => !libraryIds.has(f.id)),
    weightLogs: incoming.weightLogs.filter((l) => !weightDates.has(l.date)),
    waterLogs: incoming.waterLogs.filter((l) => !waterDates.has(l.date)),
  };
}

/** 把 missingRecords 的结果并入本地数据 */
export function mergeIntoLocal(existing: RecordSet, add: ReturnType<typeof missingRecords>): RecordSet {
  return {
    logs: groupFoodsByDate([...flattenLogs(existing.logs), ...add.foods]),
    library: [...add.library, ...existing.library],
    weightLogs: [...existing.weightLogs, ...add.weightLogs],
    waterLogs: [...existing.waterLogs, ...add.waterLogs],
  };
}
