import type { DailyLog, FoodItem, LibraryFood, WeightLog, WaterLog } from '../types';

/**
 * 首次登录时把本地与云端的数据合并。
 *
 * 背景：onSnapshot 拿到的是云端全量数据，直接 setState 会把「登出状态下攒的本地记录」
 * 整个冲掉，而本地持久化 effect 紧接着又把空数组写回 localStorage —— 数据永久丢失。
 *
 * 策略：登录后的**第一次**快照做合并（云端优先，本地独有的补上并回传云端），
 * 之后的快照按云端为准直接替换。这样既不丢数据，也不会让别的设备删掉的条目复活。
 */

/** 合并两组按 key 去重的记录，云端优先 */
export function mergeByKey<T>(remote: T[], local: T[], keyOf: (item: T) => string): { merged: T[]; localOnly: T[] } {
  const remoteKeys = new Set(remote.map(keyOf));
  const localOnly = local.filter(item => !remoteKeys.has(keyOf(item)));
  return { merged: [...remote, ...localOnly], localOnly };
}

/**
 * 合并每日记录。同一天两边都有时，按食物 id 取并集（云端条目优先），
 * 避免「同一天在两台设备各加了几条」时丢掉一边。
 */
export function mergeLogs(remote: DailyLog[], local: DailyLog[]): { merged: DailyLog[]; changedDates: string[] } {
  const byDate = new Map<string, DailyLog>();
  for (const log of remote) byDate.set(log.date, log);

  const changedDates: string[] = [];

  for (const localLog of local) {
    const remoteLog = byDate.get(localLog.date);
    if (!remoteLog) {
      byDate.set(localLog.date, localLog);
      changedDates.push(localLog.date);
      continue;
    }

    const remoteIds = new Set(remoteLog.foods.map(f => f.id));
    const extras = localLog.foods.filter(f => !remoteIds.has(f.id));
    if (extras.length > 0) {
      byDate.set(localLog.date, { ...remoteLog, foods: [...remoteLog.foods, ...extras] });
      changedDates.push(localLog.date);
    }
  }

  return { merged: [...byDate.values()], changedDates };
}

export const foodKey = (f: FoodItem) => f.id;
export const libraryKey = (f: LibraryFood) => f.id;
export const dateKey = (l: WeightLog | WaterLog) => l.date;
