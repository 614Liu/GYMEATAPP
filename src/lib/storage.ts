/**
 * localStorage 的读写集中在这里。key 名沿用旧版本（jianshi_ 前缀），老用户数据不受影响。
 * 隐私模式或存储已满时 localStorage 会抛错，这里统一吞掉，不让它弄崩界面。
 */

export const STORAGE_KEYS = {
  logs: 'jianshi_logs',
  goals: 'jianshi_goals',
  library: 'jianshi_library',
  weight: 'jianshi_weight',
  water: 'jianshi_water',
  fitnessGoal: 'jianshi_fitness_goal',
  aiProvider: 'ai_provider',
  geminiKey: 'user_gemini_api_key',
  deepseekKey: 'user_deepseek_api_key',
} as const;

/** 按天生成的缓存（AI 小建议、对话记录） */
export const tipCacheKey = (date: string, goal: string) => `jianshi_tip_${date}_${goal}`;
export const chatCacheKey = (date: string) => `jianshi_chat_${date}`;
const DAILY_CACHE_PATTERN = /^jianshi_(?:tip|chat)_(\d{4}-\d{2}-\d{2})/;

export function readString(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeString(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch (e) {
    console.error(`Failed to save ${key} to localStorage`, e);
  }
}

export function removeKey(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch { /* ignore */ }
}

export function readJSON<T>(key: string, fallback: T, isValid: (v: unknown) => v is T): T {
  const raw = readString(key);
  if (!raw) return fallback;
  try {
    const parsed: unknown = JSON.parse(raw);
    return isValid(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

export function writeJSON(key: string, value: unknown): void {
  writeString(key, JSON.stringify(value));
}

/** 删除 7 天前的按天缓存，不清理会一直堆在 localStorage 里 */
export function pruneDailyCaches(cutoffDate: string): void {
  try {
    for (const key of Object.keys(localStorage)) {
      const m = key.match(DAILY_CACHE_PATTERN);
      if (m && m[1] < cutoffDate) localStorage.removeItem(key);
    }
  } catch { /* ignore */ }
}

/**
 * 清掉游客模式存在本机的个人数据。登录后游客数据已经上传到云端时调用。
 * API Key 和 AI 引擎选择属于设备设置，保留。
 */
export function clearGuestData(): void {
  for (const key of [STORAGE_KEYS.logs, STORAGE_KEYS.goals, STORAGE_KEYS.library, STORAGE_KEYS.weight, STORAGE_KEYS.water, STORAGE_KEYS.fitnessGoal]) {
    removeKey(key);
  }
}

/** 清掉按天缓存的 AI 建议和对话（退出登录时，免得下一个人看到） */
export function clearDailyCaches(): void {
  try {
    for (const key of Object.keys(localStorage)) {
      if (DAILY_CACHE_PATTERN.test(key)) localStorage.removeItem(key);
    }
  } catch { /* ignore */ }
}

export const isArray = <T>(v: unknown): v is T[] => Array.isArray(v);
export const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
