import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * 把 "yyyy-MM-dd" 解析成**本地时区**的当天零点。
 *
 * 直接 new Date("2026-08-14") 会被当成 UTC 零点，在 UTC 负偏移的时区（美洲）
 * 会退回到前一天，图表日期就整体偏一格。海外版会踩到这个。
 */
export function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}
