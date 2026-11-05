import type { LibraryFood, MacroGoals, StoredFood, WaterLog, WeightLog } from '../types';
import * as cloud from './cloud';
import { groupFoodsByDate, missingRecords, sanitizeRecords, stripOwner, type RecordSet } from './records';

/** 云端数据结构版本，以后改结构时递增并在 setupAccount 里加迁移 */
export const SCHEMA_VERSION = 1;

export interface GuestData extends RecordSet {
  goals: MacroGoals;
  fitnessGoal: string;
}

export function hasRecords(r: RecordSet): boolean {
  return r.logs.some((l) => l.foods?.length) || r.library.length > 0 || r.weightLogs.length > 0 || r.waterLogs.length > 0;
}

/** 一次性读取账号下的全部记录（导出、迁移、导入时用） */
export async function fetchAllRecords(uid: string): Promise<RecordSet> {
  const [foods, library, weightLogs, waterLogs] = await Promise.all([
    cloud.fetchCollection<StoredFood>(uid, 'foods'),
    cloud.fetchCollection<LibraryFood>(uid, 'library'),
    cloud.fetchCollection<WeightLog>(uid, 'weightLogs'),
    cloud.fetchCollection<WaterLog>(uid, 'waterLogs'),
  ]);
  return {
    logs: groupFoodsByDate(foods.map(stripOwner)),
    library: library.map(stripOwner),
    weightLogs: weightLogs.map(stripOwner),
    waterLogs: waterLogs.map(stripOwner),
  };
}

/** 把记录里云端还没有的部分上传（只补不改），返回上传了多少条 */
export async function uploadMissing(uid: string, existing: RecordSet, incoming: RecordSet): Promise<number> {
  // 先清洗：旧数据和备份文件里可能有安全规则不接受的字段或数值
  const add = missingRecords(existing, sanitizeRecords(incoming));
  await cloud.saveItems(uid, 'foods', add.foods.map((f) => ({ id: f.id, data: f })));
  await cloud.saveItems(uid, 'library', add.library.map((f) => ({ id: f.id, data: f })));
  await cloud.saveItems(uid, 'weightLogs', add.weightLogs.map((l) => ({ id: l.date, data: l })));
  await cloud.saveItems(uid, 'waterLogs', add.waterLogs.map((l) => ({ id: l.date, data: l })));
  return add.foods.length + add.library.length + add.weightLogs.length + add.waterLogs.length;
}

/**
 * 登录后跑一次：
 * 1. 新账号：建用户文档，沿用游客时设的目标；
 * 2. 游客期间记的数据：只补不改地传到云端。
 *
 * 以后数据结构要升级时，在这里按 schemaVersion 加迁移步骤。
 * 失败会抛错，本机数据保留，下次启动再试。
 */
export async function setupAccount(uid: string, email: string | null, guest: GuestData): Promise<void> {
  const userDoc = await cloud.fetchUserDoc(uid);
  if (!userDoc) {
    await cloud.saveUserDoc(uid, { uid, email, goals: guest.goals, fitnessGoal: guest.fitnessGoal, schemaVersion: SCHEMA_VERSION });
  }
  if (hasRecords(guest)) {
    await uploadMissing(uid, await fetchAllRecords(uid), guest);
  }
}
