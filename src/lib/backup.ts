/**
 * 数据备份文件：导出成一个 JSON，换手机或重装后导入恢复。
 * 国内版没有云同步，这是数据不丢的唯一办法；海外版也能用来留一份自己的备份。
 */
import { format } from 'date-fns';
import type { MacroGoals } from '../types';
import { DEFAULT_GOALS, FITNESS_GOAL_OPTIONS } from '../constants';
import { sanitizeRecords, type RecordSet } from './records';

export const BACKUP_APP = 'gymeat';
export const BACKUP_VERSION = 1;

export interface BackupContent extends RecordSet {
  goals: MacroGoals;
  fitnessGoal: string;
}

interface BackupFile extends BackupContent {
  app: typeof BACKUP_APP;
  version: number;
  exportedAt: string;
}

export function buildBackupJson(content: BackupContent, now = new Date()): string {
  const file: BackupFile = { app: BACKUP_APP, version: BACKUP_VERSION, exportedAt: now.toISOString(), ...content };
  return JSON.stringify(file, null, 2);
}

export function backupFileName(now = new Date()): string {
  return `健食备份_${format(now, 'yyyyMMdd_HHmm')}.json`;
}

function parseGoals(v: unknown): MacroGoals {
  const g = (v ?? {}) as Record<string, unknown>;
  const nums = ['calories', 'protein', 'carbs', 'fat'].map((k) => Number(g[k]));
  if (nums.every((n) => Number.isFinite(n) && n >= 0) && nums[0] > 0) {
    const [calories, protein, carbs, fat] = nums;
    return { calories, protein, carbs, fat };
  }
  return DEFAULT_GOALS;
}

/** 解析并清洗备份文件；不是本应用的备份时抛错（错误信息可直接给用户看） */
export function parseBackup(text: string): BackupContent {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('文件不是有效的备份（无法解析）');
  }
  const obj = raw as Partial<BackupFile> | null;
  if (!obj || typeof obj !== 'object' || obj.app !== BACKUP_APP) {
    throw new Error('这不是健食的备份文件');
  }
  if (typeof obj.version !== 'number' || obj.version > BACKUP_VERSION) {
    throw new Error('备份文件来自更新的版本，请先升级应用');
  }
  return {
    ...sanitizeRecords(obj),
    goals: parseGoals(obj.goals),
    fitnessGoal: FITNESS_GOAL_OPTIONS.some((o) => o.key === obj.fitnessGoal) ? (obj.fitnessGoal as string) : 'maintain',
  };
}

/**
 * 把备份交给用户保存。
 * 网页：直接下载。安卓 App：WebView 不支持下载链接，写到缓存目录再调起系统分享（可存到文件、发给自己）。
 */
export async function saveBackupFile(json: string, fileName: string): Promise<void> {
  const { Capacitor } = await import('@capacitor/core');
  if (Capacitor.isNativePlatform()) {
    const [{ Filesystem, Directory, Encoding }, { Share }] = await Promise.all([
      import('@capacitor/filesystem'),
      import('@capacitor/share'),
    ]);
    const { uri } = await Filesystem.writeFile({ path: fileName, data: json, directory: Directory.Cache, encoding: Encoding.UTF8 });
    await Share.share({ title: '健食数据备份', files: [uri] });
    return;
  }
  const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
