export interface NutritionResult {
  isFood: boolean;
  reason?: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  amount: string; // e.g., "100g", "1 piece"
}

export function parseAiError(err: any): string {
  const rawError = err?.message || String(err || '');
  console.log("Parsing AI error:", rawError);

  const lowerError = rawError.toLowerCase();

  if (
    lowerError.includes('missing or invalid api key') ||
    lowerError.includes('missing api key') ||
    lowerError.includes('api key not valid') || 
    lowerError.includes('api_key_invalid') || 
    lowerError.includes('invalid_argument') ||
    /status["'\s]*:[\s]*400/i.test(rawError) ||
    /code["'\s]*:[\s]*400/i.test(rawError) ||
    (/\b400\b/.test(rawError) && !rawError.includes('ms') && !rawError.includes('px'))
  ) {
    return "API Key 校验失败。请确认在「设置」中填写的 Gemini API Key 是否正确（以 AIzaSy 开头且无前后空格），或点击「清除记录」以重新尝试系统默认渠道。";
  }

  if (
    lowerError.includes('503') || 
    lowerError.includes('unavailable') || 
    lowerError.includes('high demand') || 
    lowerError.includes('temporary') ||
    lowerError.includes('overloaded')
  ) {
    return "AI 估算服务暂时繁忙（Gemini 模型当前请求量过载），请稍后重试。您也可以在右上角「设置」中配置您专属的 Gemini API Key 解锁专属通道。";
  }

  if (
    lowerError.includes('429') || 
    lowerError.includes('rate limit') || 
    lowerError.includes('quota')
  ) {
    return "已达到当前的免费调用频率限制，请一分钟后再试。您可以在右上角「设置」中配置您专属的 API Key 以解决频率限制。";
  }

  if (
    lowerError.includes('model not found') || 
    lowerError.includes('404')
  ) {
    return "模型服务接口暂时不可用（404），请稍后再试。";
  }

  if (
    lowerError.includes('failed to fetch') || 
    lowerError.includes('network') || 
    lowerError.includes('fetch')
  ) {
    return "无法连接至 AI 服务端，请检查您的网络。如果是连接超时，在「设置」中填写您的专属 API Key 可帮助顺利访问。";
  }

  return `识别出错，请重试: ${rawError.substring(0, 150)}`;
}

function getProvider(): 'gemini' | 'deepseek' {
  if (typeof window === 'undefined') return 'gemini';
  return localStorage.getItem('ai_provider') === 'deepseek' ? 'deepseek' : 'gemini';
}

// In a web deployment the app and the API share an origin, so a relative
// path works. Inside a Capacitor native build the app runs from a local
// origin (capacitor://localhost), so we must call the deployed backend by
// its full URL. VITE_API_BASE is injected at build time for native builds.
const API_BASE = (import.meta as any).env?.VITE_API_BASE || '';

function apiUrl(path: string): string {
  return `${API_BASE}${path}`;
}

function getCustomApiKey() {
  if (typeof window === 'undefined') return null;
  // Use the key matching the selected provider
  const provider = getProvider();
  return provider === 'deepseek'
    ? localStorage.getItem('user_deepseek_api_key')
    : localStorage.getItem('user_gemini_api_key');
}

export async function estimateLogNutrition(query: string, imageBase64?: string): Promise<NutritionResult> {
  const customApiKey = getCustomApiKey();
  const provider = getProvider();
  const response = await fetch(apiUrl('/api/estimate'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      query,
      imageBase64,
      isLibrary: false,
      customApiKey,
      provider
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to fetch: ${response.statusText}`);
  }

  return response.json();
}

export async function estimateLibraryNutrition(query: string, imageBase64?: string): Promise<NutritionResult> {
  const customApiKey = getCustomApiKey();
  const provider = getProvider();
  const response = await fetch(apiUrl('/api/estimate'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      query,
      imageBase64,
      isLibrary: true,
      customApiKey,
      provider
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to fetch: ${response.statusText}`);
  }

  return response.json();
}

// ===== AI Coach: daily tip + next-meal recommendation =====

export interface MealSuggestion {
  name: string;
  calories: number;
  protein: number;
  reason: string;
}

async function callCoach(kind: 'tip' | 'meal', data: any): Promise<any> {
  const customApiKey = getCustomApiKey();
  const provider = getProvider();
  const response = await fetch(apiUrl('/api/coach'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ kind, data, customApiKey, provider }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `请求失败: ${response.statusText}`);
  }
  return response.json();
}

export async function getDailyTip(data: {
  goal: string;
  totals: { calories: number; protein: number; carbs: number; fat: number };
  goals: { calories: number; protein: number; carbs: number; fat: number };
}): Promise<string> {
  const res = await callCoach('tip', data);
  return res.tip || '';
}

export async function getMealSuggestions(data: {
  goal: string;
  totals: { calories: number; protein: number; carbs: number; fat: number };
  goals: { calories: number; protein: number; carbs: number; fat: number };
}): Promise<MealSuggestion[]> {
  const res = await callCoach('meal', data);
  return res.suggestions || [];
}

// ===== AI Chat: personalized nutrition Q&A =====

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export async function sendChatMessage(
  messages: ChatMessage[],
  data: {
    goal: string;
    totals: { calories: number; protein: number; carbs: number; fat: number };
    goals: { calories: number; protein: number; carbs: number; fat: number };
    recentFoods?: { name: string; calories: number }[];
  }
): Promise<string> {
  const customApiKey = getCustomApiKey();
  const provider = getProvider();
  const response = await fetch(apiUrl('/api/chat'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, data, customApiKey, provider }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `请求失败: ${response.statusText}`);
  }
  const res = await response.json();
  return res.reply || '';
}
