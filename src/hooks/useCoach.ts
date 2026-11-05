import { useCallback, useEffect, useState } from 'react';
import type { MacroGoals } from '../types';
import { getDailyTip, sendChatMessage, parseAiError, type ChatMessage } from '../lib/gemini';
import { readString, writeString, readJSON, writeJSON, tipCacheKey, chatCacheKey, isArray } from '../lib/storage';

type Totals = { calories: number; protein: number; carbs: number; fat: number };

interface Options {
  date: string;
  fitnessGoal: string;
  totals: Totals;
  goals: MacroGoals;
  recentFoods: { name: string; calories: number }[];
}

/**
 * AI 营养教练：每日小建议 + 对话。
 *
 * 这一块之后要整体重做（不再用 Gemini / DeepSeek），所以和 AI 相关的状态都收在这里，
 * 重做时替换这个 hook 和 lib/gemini.ts 即可，界面只依赖返回值的形状。
 */
export function useCoach({ date, fitnessGoal, totals, goals, recentFoods }: Options) {
  const [dailyTip, setDailyTip] = useState('');
  const [tipLoading, setTipLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatLoading, setChatLoading] = useState(false);

  // 切换日期或目标时，读当天缓存的建议
  useEffect(() => {
    setDailyTip(readString(tipCacheKey(date, fitnessGoal)) || '');
  }, [date, fitnessGoal]);

  // 切换日期时，读当天保存的对话
  useEffect(() => {
    setMessages(readJSON(chatCacheKey(date), [], isArray<ChatMessage>));
  }, [date]);

  const refreshTip = useCallback(async () => {
    setTipLoading(true);
    try {
      const tip = await getDailyTip({ goal: fitnessGoal, totals, goals });
      setDailyTip(tip);
      writeString(tipCacheKey(date, fitnessGoal), tip);
    } catch {
      setDailyTip('');
    } finally {
      setTipLoading(false);
    }
  }, [date, fitnessGoal, totals, goals]);

  /** 发送一条消息，返回是否已发出（正在等回复时不发） */
  const send = useCallback(async (text: string): Promise<boolean> => {
    const content = text.trim();
    if (!content || chatLoading) return false;
    const withUser: ChatMessage[] = [...messages, { role: 'user', content }];
    setMessages(withUser);
    setChatLoading(true);
    try {
      const reply = await sendChatMessage(withUser, { goal: fitnessGoal, totals, goals, recentFoods });
      const withReply: ChatMessage[] = [...withUser, { role: 'assistant', content: reply }];
      setMessages(withReply);
      writeJSON(chatCacheKey(date), withReply);
    } catch (e) {
      setMessages([...withUser, { role: 'assistant', content: parseAiError(e) }]);
    } finally {
      setChatLoading(false);
    }
    return true;
  }, [messages, chatLoading, fitnessGoal, totals, goals, recentFoods, date]);

  return { dailyTip, tipLoading, refreshTip, messages, chatLoading, send };
}
