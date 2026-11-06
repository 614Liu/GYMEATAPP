import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { format, subDays } from 'date-fns';
import type { DailyLog, FoodItem, LibraryFood, MacroGoals, MealType, NewFood, StoredFood, WaterLog, WeightLog } from '../types';
import { DEFAULT_GOALS, FITNESS_GOAL_OPTIONS } from '../constants';
import { createFoodItem } from '../lib/nutrition';
import { dedupeById, groupFoodsByDate, mergeIntoLocal, missingRecords, stripOwner } from '../lib/records';
import type { BackupContent } from '../lib/backup';
import { STORAGE_KEYS, readJSON, readString, writeJSON, writeString, clearGuestData, isArray, isObject } from '../lib/storage';
import { fetchAllRecords, hasRecords, setupAccount, uploadMissing, type GuestData } from '../lib/accountSetup';
import * as cloud from '../lib/cloud';
import type { CloudUser } from '../lib/cloud';

/** 饮食和饮水只加载最近这么多天；更早的日期在翻到时单独加载 */
const RECENT_DAYS = 60;
/** 体重数据量很小，加载一年，够画趋势 */
const WEIGHT_DAYS = 365;

export function isValidGoals(v: unknown): v is MacroGoals {
  if (!isObject(v)) return false;
  const { calories, protein, carbs, fat } = v as Record<string, unknown>;
  return [calories, protein, carbs, fat].every((n) => typeof n === 'number' && Number.isFinite(n) && n >= 0)
    && (calories as number) > 0;
}

const isFitnessGoal = (v: unknown): v is string => FITNESS_GOAL_OPTIONS.some((o) => o.key === v);

function loadGuestGoals(): MacroGoals {
  const saved = readJSON<Record<string, unknown>>(STORAGE_KEYS.goals, {}, isObject);
  const merged = { ...DEFAULT_GOALS, ...saved };
  return isValidGoals(merged) ? merged : DEFAULT_GOALS;
}

function loadGuestData(): GuestData {
  const fitness = readString(STORAGE_KEYS.fitnessGoal);
  return {
    logs: readJSON(STORAGE_KEYS.logs, [], isArray<DailyLog>),
    library: readJSON(STORAGE_KEYS.library, [], isArray<LibraryFood>),
    weightLogs: readJSON(STORAGE_KEYS.weight, [], isArray<WeightLog>),
    waterLogs: readJSON(STORAGE_KEYS.water, [], isArray<WaterLog>),
    goals: loadGuestGoals(),
    fitnessGoal: isFitnessGoal(fitness) ? fitness : 'maintain',
  };
}

const EMPTY_GUEST: GuestData = { logs: [], library: [], weightLogs: [], waterLogs: [], goals: DEFAULT_GOALS, fitnessGoal: 'maintain' };

const sortByNewest = (items: LibraryFood[]) => [...items].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
const daysAgo = (n: number) => format(subDays(new Date(), n), 'yyyy-MM-dd');

/** 按日期替换或追加一条（体重、饮水） */
function upsertByDate<T extends { date: string }>(list: T[], item: T): T[] {
  const index = list.findIndex((l) => l.date === item.date);
  if (index < 0) return [...list, item];
  const next = [...list];
  next[index] = item;
  return next;
}

/** 云端数据：一组监听结果，按日期窗口 + 额外一天拼起来 */
interface CloudState {
  foods: StoredFood[];
  extraFoods: StoredFood[];
  /** 首次快照到了没有：没到之前界面应显示加载中，而不是「没有记录」 */
  foodsLoaded: boolean;
  extraLoaded: boolean;
  library: LibraryFood[];
  weightLogs: WeightLog[];
  waterLogs: WaterLog[];
  extraWater: WaterLog[];
  goals: MacroGoals;
  fitnessGoal: string;
}

const EMPTY_CLOUD: CloudState = {
  foods: [], extraFoods: [], library: [], weightLogs: [], waterLogs: [], extraWater: [],
  foodsLoaded: false, extraLoaded: false,
  goals: DEFAULT_GOALS, fitnessGoal: 'maintain',
};


interface Options {
  user: CloudUser | null;
  /** 正在查看的日期；比最近窗口更早时会单独加载这一天 */
  viewDate: string;
  /** 提示用户（云端操作失败、游客数据同步结果） */
  notify: (message: string, type: 'success' | 'error' | 'info') => void;
}

/**
 * 应用的全部个人数据：饮食记录、目标、食物库、体重、饮水。
 *
 * 两种模式，任何时刻只有一份数据，不再做本地/云端合并：
 * - 游客（未登录、国内版）：存在本机 localStorage。
 * - 登录：只认云端。Firestore 开了离线缓存，离线照常读写，联网后自动同步。
 *   登录那一刻把游客期间的数据补传上去，然后清掉本机那份。
 */
export function useNutritionData({ user, viewDate, notify }: Options) {
  const uid = user?.uid ?? null;
  const notifyRef = useRef(notify);
  notifyRef.current = notify;

  // ================= 游客模式（本机） =================
  const [guest, setGuestState] = useState<GuestData>(loadGuestData);
  const guestRef = useRef(guest);
  const setGuest = useCallback((update: (g: GuestData) => GuestData) => {
    guestRef.current = update(guestRef.current);
    setGuestState(guestRef.current);
  }, []);

  useEffect(() => writeJSON(STORAGE_KEYS.logs, guest.logs), [guest.logs]);
  useEffect(() => writeJSON(STORAGE_KEYS.goals, guest.goals), [guest.goals]);
  useEffect(() => writeJSON(STORAGE_KEYS.library, guest.library), [guest.library]);
  useEffect(() => writeJSON(STORAGE_KEYS.weight, guest.weightLogs), [guest.weightLogs]);
  useEffect(() => writeJSON(STORAGE_KEYS.water, guest.waterLogs), [guest.waterLogs]);
  useEffect(() => writeString(STORAGE_KEYS.fitnessGoal, guest.fitnessGoal), [guest.fitnessGoal]);

  // ================= 登录模式（云端） =================
  const [cloudState, setCloudState] = useState<CloudState>(EMPTY_CLOUD);
  const patchCloud = useCallback((patch: Partial<CloudState>) => setCloudState((s) => ({ ...s, ...patch })), []);

  // 窗口起点在登录时算一次
  const windows = useMemo(() => ({ recent: daysAgo(RECENT_DAYS), weight: daysAgo(WEIGHT_DAYS) }), [uid]);

  useEffect(() => {
    setCloudState(EMPTY_CLOUD);
    if (!uid) return;
    const unsubs = [
      cloud.subscribeUserDoc(uid, (data) => {
        if (!data) return;
        patchCloud({
          goals: isValidGoals(data.goals) ? data.goals : DEFAULT_GOALS,
          fitnessGoal: isFitnessGoal(data.fitnessGoal) ? data.fitnessGoal : 'maintain',
        });
      }),
      cloud.subscribeCollection<StoredFood>(uid, 'foods', (items) => patchCloud({ foods: items.map(stripOwner), foodsLoaded: true }), { since: windows.recent }),
      cloud.subscribeCollection<WaterLog>(uid, 'waterLogs', (items) => patchCloud({ waterLogs: items.map(stripOwner) }), { since: windows.recent }),
      cloud.subscribeCollection<WeightLog>(uid, 'weightLogs', (items) => patchCloud({ weightLogs: items.map(stripOwner) }), { since: windows.weight }),
      cloud.subscribeCollection<LibraryFood>(uid, 'library', (items) => patchCloud({ library: sortByNewest(items.map(stripOwner)) })),
    ];
    return () => unsubs.forEach((u) => u());
  }, [uid, windows, patchCloud]);

  // 翻到比窗口更早的日期时，单独加载那一天
  const isOldDate = !!uid && viewDate < windows.recent;
  useEffect(() => {
    patchCloud({ extraFoods: [], extraWater: [], extraLoaded: false });
    if (!uid || !isOldDate) return;
    const unsubs = [
      cloud.subscribeCollection<StoredFood>(uid, 'foods', (items) => patchCloud({ extraFoods: items.map(stripOwner), extraLoaded: true }), { on: viewDate }),
      cloud.subscribeCollection<WaterLog>(uid, 'waterLogs', (items) => patchCloud({ extraWater: items.map(stripOwner) }), { on: viewDate }),
    ];
    return () => unsubs.forEach((u) => u());
  }, [uid, isOldDate, viewDate, patchCloud]);

  // 登录后：建档、补传游客数据，成功后清掉本机那份
  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    setupAccount(uid, user?.email ?? null, guestRef.current)
      .then(() => {
        if (cancelled) return;
        if (hasRecords(guestRef.current)) notifyRef.current('已把未登录时的记录同步到账号', 'success');
        clearGuestData();
        setGuest(() => EMPTY_GUEST);
      })
      .catch((err) => {
        console.error('Account setup failed:', err);
        if (!cancelled && hasRecords(guestRef.current)) {
          notifyRef.current('未登录时的记录暂时没能同步，下次打开会再试', 'error');
        }
      });
    return () => { cancelled = true; };
    // user.email 只在建档时用，不需要因为它变化而重跑，所以依赖里没有它
  }, [uid, setGuest]);

  // ================= 对外的数据 =================
  const cloudLogs = useMemo(
    () => groupFoodsByDate(dedupeById([...cloudState.foods, ...cloudState.extraFoods])),
    [cloudState.foods, cloudState.extraFoods]
  );
  const cloudWater = useMemo(
    () => [...cloudState.waterLogs, ...cloudState.extraWater.filter((w) => !cloudState.waterLogs.some((x) => x.date === w.date))],
    [cloudState.waterLogs, cloudState.extraWater]
  );

  const logs = uid ? cloudLogs : guest.logs;
  const library = uid ? cloudState.library : guest.library;
  const weightLogs = uid ? cloudState.weightLogs : guest.weightLogs;
  const waterLogs = uid ? cloudWater : guest.waterLogs;
  const goals = uid ? cloudState.goals : guest.goals;
  const fitnessGoal = uid ? cloudState.fitnessGoal : guest.fitnessGoal;

  // ================= 操作 =================
  const cloudWrite = useCallback((label: string, task: (uid: string) => Promise<void>) => {
    if (!uid) return;
    task(uid).catch((err) => {
      console.error(`${label} error:`, err);
      notifyRef.current('保存到云端失败，请检查网络后重试', 'error');
    });
  }, [uid]);

  const setGuestDay = useCallback((date: string, update: (foods: FoodItem[]) => FoodItem[]) => {
    setGuest((g) => {
      const index = g.logs.findIndex((l) => l.date === date);
      const foods = update(index >= 0 ? g.logs[index].foods : []);
      const logs = [...g.logs];
      if (index >= 0) logs[index] = { ...logs[index], foods };
      else logs.push({ date, foods });
      return { ...g, logs };
    });
  }, [setGuest]);

  /** 添加一条记录；份量无法换算时返回 null */
  const addFood = useCallback((date: string, food: NewFood, mealType: MealType): FoodItem | null => {
    const item = createFoodItem(food, mealType);
    if (!item) return null;
    if (uid) cloudWrite('Add food', (u) => cloud.saveItem(u, 'foods', item.id, { ...item, date }));
    else setGuestDay(date, (foods) => [item, ...foods]);
    return item;
  }, [uid, cloudWrite, setGuestDay]);

  const updateFood = useCallback((date: string, food: FoodItem) => {
    if (uid) cloudWrite('Update food', (u) => cloud.saveItem(u, 'foods', food.id, { ...food, date }));
    else setGuestDay(date, (foods) => foods.map((f) => (f.id === food.id ? food : f)));
  }, [uid, cloudWrite, setGuestDay]);

  /** 撤销删除：原样放回（同一个 id） */
  const restoreFood = useCallback((date: string, food: FoodItem) => {
    if (uid) cloudWrite('Restore food', (u) => cloud.saveItem(u, 'foods', food.id, { ...food, date }));
    else setGuestDay(date, (foods) => (foods.some((f) => f.id === food.id) ? foods : [food, ...foods]));
  }, [uid, cloudWrite, setGuestDay]);

  const removeFood = useCallback((date: string, id: string) => {
    if (uid) cloudWrite('Remove food', (u) => cloud.deleteItem(u, 'foods', id));
    else setGuestDay(date, (foods) => foods.filter((f) => f.id !== id));
  }, [uid, cloudWrite, setGuestDay]);

  const addLibraryFood = useCallback((food: LibraryFood) => {
    if (uid) cloudWrite('Add library', (u) => cloud.saveItem(u, 'library', food.id, food));
    else setGuest((g) => ({ ...g, library: [food, ...g.library] }));
  }, [uid, cloudWrite, setGuest]);

  const updateLibraryFood = useCallback((food: LibraryFood) => {
    if (uid) cloudWrite('Update library', (u) => cloud.saveItem(u, 'library', food.id, food));
    else setGuest((g) => ({ ...g, library: g.library.map((f) => (f.id === food.id ? food : f)) }));
  }, [uid, cloudWrite, setGuest]);

  const removeLibraryFood = useCallback((id: string) => {
    if (uid) cloudWrite('Remove library', (u) => cloud.deleteItem(u, 'library', id));
    else setGuest((g) => ({ ...g, library: g.library.filter((f) => f.id !== id) }));
  }, [uid, cloudWrite, setGuest]);

  const changeWater = useCallback((date: string, delta: number) => {
    const current = waterLogs.find((l) => l.date === date)?.amount ?? 0;
    const applied = Math.max(-current, delta); // 不减到 0 以下
    if (applied === 0) return;
    if (uid) {
      cloudWrite('Water', (u) => cloud.addWater(u, date, applied));
    } else {
      setGuest((g) => {
        const prev = g.waterLogs.find((l) => l.date === date)?.amount ?? 0;
        return { ...g, waterLogs: upsertByDate(g.waterLogs, { date, amount: Math.max(0, prev + delta) }) };
      });
    }
  }, [uid, waterLogs, cloudWrite, setGuest]);

  /** 记录体重；不合理的数值（≤0 或 >500）不保存，返回 false */
  const setWeight = useCallback((date: string, weight: number): boolean => {
    if (!Number.isFinite(weight) || weight <= 0 || weight > 500) return false;
    if (uid) cloudWrite('Weight', (u) => cloud.saveItem(u, 'weightLogs', date, { date, weight }));
    else setGuest((g) => ({ ...g, weightLogs: upsertByDate(g.weightLogs, { date, weight }) }));
    return true;
  }, [uid, cloudWrite, setGuest]);

  /** 保存目标；不合理（热量为 0 等）时不保存，返回 false */
  const saveGoals = useCallback((next: MacroGoals): boolean => {
    if (!isValidGoals(next)) return false;
    if (uid) cloudWrite('Goals', (u) => cloud.saveUserDoc(u, { goals: next }));
    else setGuest((g) => ({ ...g, goals: next }));
    return true;
  }, [uid, cloudWrite, setGuest]);

  const saveFitnessGoal = useCallback((goal: string) => {
    if (!isFitnessGoal(goal)) return;
    if (uid) cloudWrite('Fitness goal', (u) => cloud.saveUserDoc(u, { fitnessGoal: goal }));
    else setGuest((g) => ({ ...g, fitnessGoal: goal }));
  }, [uid, cloudWrite, setGuest]);

  // ================= 导出 / 导入 =================
  /** 取全部数据（登录时从云端读全量，不只是最近 60 天） */
  const exportAll = useCallback(async (): Promise<BackupContent> => {
    if (uid) {
      const records = await fetchAllRecords(uid);
      return { ...records, goals: cloudState.goals, fitnessGoal: cloudState.fitnessGoal };
    }
    const g = guestRef.current;
    return { logs: g.logs, library: g.library, weightLogs: g.weightLogs, waterLogs: g.waterLogs, goals: g.goals, fitnessGoal: g.fitnessGoal };
  }, [uid, cloudState.goals, cloudState.fitnessGoal]);

  /** 导入备份：记录只补上没有的，目标用备份里的；返回新增了多少条 */
  const importBackup = useCallback(async (backup: BackupContent): Promise<number> => {
    if (uid) {
      const existing = await fetchAllRecords(uid);
      const added = await uploadMissing(uid, existing, backup);
      await cloud.saveUserDoc(uid, { goals: backup.goals, fitnessGoal: backup.fitnessGoal });
      return added;
    }
    const g = guestRef.current;
    const add = missingRecords(g, backup);
    setGuest((cur) => ({ ...cur, ...mergeIntoLocal(cur, add), goals: backup.goals, fitnessGoal: backup.fitnessGoal }));
    return add.foods.length + add.library.length + add.weightLogs.length + add.waterLogs.length;
  }, [uid, setGuest]);

  /** 登录后云端数据还没到（游客模式数据在本机，永远是 false） */
  const loading = !!uid && (!cloudState.foodsLoaded || (isOldDate && !cloudState.extraLoaded));

  return {
    loading,
    logs, goals, library, weightLogs, waterLogs, fitnessGoal,
    addFood, updateFood, removeFood, restoreFood,
    addLibraryFood, updateLibraryFood, removeLibraryFood,
    changeWater, setWeight, saveGoals, saveFitnessGoal,
    exportAll, importBackup,
  };
}

