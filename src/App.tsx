import React, { useState, useEffect, useMemo, useRef, ReactNode, Component } from 'react';
import { 
  Plus, 
  Search, 
  History, 
  Settings as SettingsIcon, 
  Flame, 
  Beef, 
  Wheat, 
  Droplets,
  Trash2,
  ChevronRight,
  ChevronLeft,
  Check,
  X,
  Coffee,
  Sun,
  Moon,
  Cookie,
  Scale,
  TrendingUp,
  GlassWater,
  Calendar,
  Pencil,
  LogOut,
  CheckCircle2,
  Info,
  Sparkles,
  Lightbulb,
  RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence, animate } from 'motion/react';
import { format, subDays, addDays, startOfDay, isBefore, startOfToday } from 'date-fns';
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  Tooltip, 
  LineChart, 
  Line, 
  AreaChart,
  Area,
  XAxis, 
  YAxis, 
  CartesianGrid 
} from 'recharts';
import { cn, parseLocalDate } from './lib/utils';
import { AnimatedNumber } from './components/ui/AnimatedNumber';
import { MacroStat } from './components/ui/MacroStat';
import { CustomCursor, CustomActiveDot } from './components/ui/ChartHelpers';
import { IS_CN_VERSION, DEFAULT_GOALS, COLORS, SCORE_BADGE_STYLES, MACRO_LABELS } from './constants';
import { compressImage } from './lib/image';
import { LogoutModal } from './components/modals/LogoutModal';
import { WeightModal } from './components/modals/WeightModal';
import { EditFoodModal } from './components/modals/EditFoodModal';
import { EditLibraryFoodModal } from './components/modals/EditLibraryFoodModal';
import { ChatModal } from './components/modals/ChatModal';
import { SettingsModal } from './components/modals/SettingsModal';
import { FoodLibraryModal } from './components/modals/FoodLibraryModal';
import { AiTab } from './components/modals/addfood/AiTab';
import { LibraryTab } from './components/modals/addfood/LibraryTab';
import { ManualTab } from './components/modals/addfood/ManualTab';
import { getAutoCalories, parseAmount } from './lib/nutrition';
import { mergeByKey, mergeLogs, libraryKey, dateKey } from './lib/sync';
import { estimateLogNutrition, estimateLibraryNutrition, NutritionResult, parseAiError, getDailyTip, getMealSuggestions, sendChatMessage, ChatMessage } from './lib/gemini';
import { scoreFood } from './lib/foodScore';
import { FoodItem, MacroGoals, DailyLog, LibraryFood, WeightLog, WaterLog, MealType } from './types';

import { auth, db } from './lib/firebase';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  User as FirebaseUser 
} from 'firebase/auth';
import { 
  doc, 
  setDoc, 
  onSnapshot,
  collection,
  deleteDoc
} from 'firebase/firestore';

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  
  // Initial state hydration from localStorage for smoother PWA experience
  const [logs, setLogs] = useState<DailyLog[]>(() => {
    try {
      const saved = localStorage.getItem('jianshi_logs');
      const parsed = saved ? JSON.parse(saved) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      console.error("Failed to parse logs from localStorage", e);
      return [];
    }
  });
  const [goals, setGoals] = useState<MacroGoals>(() => {
    try {
      const saved = localStorage.getItem('jianshi_goals');
      const parsed = saved ? JSON.parse(saved) : null;
      return (parsed && typeof parsed === 'object') ? { ...DEFAULT_GOALS, ...parsed } : DEFAULT_GOALS;
    } catch (e) {
      return DEFAULT_GOALS;
    }
  });
  const [library, setLibrary] = useState<LibraryFood[]>(() => {
    try {
      const saved = localStorage.getItem('jianshi_library');
      const parsed = saved ? JSON.parse(saved) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  });
  // Fitness goal for AI coach: 'gain' | 'lose' | 'maintain'
  const [fitnessGoal, setFitnessGoal] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('jianshi_fitness_goal') || 'maintain';
    }
    return 'maintain';
  });
  const [dailyTip, setDailyTip] = useState<string>('');
  const [tipLoading, setTipLoading] = useState(false);
  const [mealSuggestions, setMealSuggestions] = useState<any[]>([]);
  const [mealLoading, setMealLoading] = useState(false);
  // AI chat
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [weightLogs, setWeightLogs] = useState<WeightLog[]>(() => {
    try {
      const saved = localStorage.getItem('jianshi_weight');
      const parsed = saved ? JSON.parse(saved) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  });
  const [waterLogs, setWaterLogs] = useState<WaterLog[]>(() => {
    try {
      const saved = localStorage.getItem('jianshi_water');
      const parsed = saved ? JSON.parse(saved) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  });

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const [isWeightModalOpen, setIsWeightModalOpen] = useState(false);
  const [weightInput, setWeightInput] = useState('');
  const [editingFood, setEditingFood] = useState<FoodItem | null>(null);
  const [editingLibraryFood, setEditingLibraryFood] = useState<LibraryFood | null>(null);
  const [activeTab, setActiveTab] = useState<'ai' | 'manual' | 'library'>('ai');
  const [viewTab, setViewTab] = useState<'daily' | 'stats'>('daily');
  const [selectedMealType, setSelectedMealType] = useState<MealType>('breakfast');
  
  // AI Form State
  const [aiQuery, setAiQuery] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isEstimating, setIsEstimating] = useState(false);
  const [lastRequestTime, setLastRequestTime] = useState(0);
  const [estimatedResult, setEstimatedResult] = useState<NutritionResult | null>(null);
  const [portionMult, setPortionMult] = useState(1); // 份量倍数，用户可调
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error' | 'info'} | null>(null);
  const [apiKey, setApiKey] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('user_gemini_api_key') || '';
    }
    return '';
  });
  const [deepseekKey, setDeepseekKey] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('user_deepseek_api_key') || '';
    }
    return '';
  });
  const [aiProvider, setAiProvider] = useState<'gemini' | 'deepseek'>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('ai_provider') === 'deepseek' ? 'deepseek' : 'gemini';
    }
    return 'gemini';
  });

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Manual Form State
  const [manualFood, setManualFood] = useState({
    name: '',
    calories: '',
    protein: '',
    carbs: '',
    fat: '',
    amount: ''
  });

  // Library Entry State
  const [libraryEntry, setLibraryEntry] = useState({
    name: '',
    calories: '',
    protein: '',
    carbs: '',
    fat: '',
    amount: '100'
  });

  // Library Selection State
  const [selectedLibraryFood, setSelectedLibraryFood] = useState<LibraryFood | null>(null);
  const [libraryAmount, setLibraryAmount] = useState('100');

  const [selectedDate, setSelectedDate] = useState(new Date());
  const todayStr = format(selectedDate, 'yyyy-MM-dd');
  const todayLog = useMemo(() => {
    return logs.find(l => l.date === todayStr) || { date: todayStr, foods: [] };
  }, [logs, todayStr]);

  // 清理过期的按天缓存（AI 小建议、对话记录）。这两类 key 每天都会新增一条，
  // 不清理会一直堆在 localStorage 里，只保留最近 7 天。
  useEffect(() => {
    try {
      const cutoff = format(subDays(new Date(), 7), 'yyyy-MM-dd');
      for (const key of Object.keys(localStorage)) {
        const m = key.match(/^jianshi_(?:tip|chat)_(\d{4}-\d{2}-\d{2})/);
        if (m && m[1] < cutoff) localStorage.removeItem(key);
      }
    } catch (e) { /* 隐私模式下 localStorage 可能不可用，忽略 */ }
  }, []);

  // Firebase Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setIsAuthReady(true);
      // Ensure splash stays for at least 800ms to prevent flickering
      setTimeout(() => setShowSplash(false), 1000);
    });

    // Fallback timer to ensure splash screen disappears even if auth hangs
    const fallbackTimer = setTimeout(() => {
      setIsAuthReady(true);
      setShowSplash(false);
    }, 3000);

    return () => {
      unsubscribe();
      clearTimeout(fallbackTimer);
    };
  }, []);

  // Firestore Real-time Sync: Goals & User Profile
  useEffect(() => {
    if (!user) return;
    const userDocRef = doc(db, 'users', user.uid);
    const unsubscribe = onSnapshot(userDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.goals) setGoals(data.goals);
      } else {
        // Initialize user doc if it doesn't exist
        setDoc(userDocRef, { uid: user.uid, email: user.email, goals: DEFAULT_GOALS }, { merge: true });
      }
    }, (error) => {
      console.error("Firestore Error (Goals):", error);
    });
    return () => unsubscribe();
  }, [user]);

  // 本地数据的镜像。onSnapshot 回调里要读「当前本地值」来做合并，但副作用不能写在
  // setState 的 updater 里（StrictMode 会双调用），所以用 ref 读、在外面算好再 setState。
  const localDataRef = useRef({ logs, library, weightLogs, waterLogs });
  useEffect(() => {
    localDataRef.current = { logs, library, weightLogs, waterLogs };
  }, [logs, library, weightLogs, waterLogs]);

  // 每类数据「本次登录是否已做过首次合并」。合并只做一次，之后云端为准，
  // 否则别的设备删掉的条目会被本地残留一直复活。
  const mergedOnce = useRef({ logs: false, library: false, weight: false, water: false });
  useEffect(() => {
    mergedOnce.current = { logs: false, library: false, weight: false, water: false };
  }, [user]);

  // Firestore Real-time Sync: Library
  useEffect(() => {
    if (!user) return;
    const unsubscribe = onSnapshot(collection(db, 'users', user.uid, 'library'), (snapshot) => {
      const remote = snapshot.docs.map(d => d.data() as LibraryFood);
      const sortByNewest = (items: LibraryFood[]) =>
        [...items].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

      if (mergedOnce.current.library) {
        setLibrary(sortByNewest(remote));
        return;
      }
      mergedOnce.current.library = true;

      const { merged, localOnly } = mergeByKey(remote, localDataRef.current.library, libraryKey);
      setLibrary(sortByNewest(merged));
      // 本地独有的条目回传云端，下一次快照就会包含它们
      for (const item of localOnly) {
        setDoc(doc(db, 'users', user.uid, 'library', item.id), { ...item, ownerUid: user.uid })
          .catch(err => console.error("Library backfill error:", err));
      }
    }, (error) => {
      console.error("Firestore Error (Library):", error);
    });
    return () => unsubscribe();
  }, [user]);

  // Firestore Real-time Sync: Logs
  useEffect(() => {
    if (!user) return;
    const unsubscribe = onSnapshot(collection(db, 'users', user.uid, 'logs'), (snapshot) => {
      const remote = snapshot.docs.map(d => d.data() as DailyLog);

      if (mergedOnce.current.logs) {
        setLogs(remote);
        return;
      }
      mergedOnce.current.logs = true;

      const { merged, changedDates } = mergeLogs(remote, localDataRef.current.logs);
      setLogs(merged);
      for (const date of changedDates) {
        const dayLog = merged.find(l => l.date === date);
        if (!dayLog) continue;
        setDoc(doc(db, 'users', user.uid, 'logs', date), {
          date,
          ownerUid: user.uid,
          foods: dayLog.foods
        }, { merge: true }).catch(err => console.error("Logs backfill error:", err));
      }
    }, (error) => {
      console.error("Firestore Error (Logs):", error);
    });
    return () => unsubscribe();
  }, [user]);

  // Firestore Real-time Sync: Weight Logs
  useEffect(() => {
    if (!user) return;
    const unsubscribe = onSnapshot(collection(db, 'users', user.uid, 'weightLogs'), (snapshot) => {
      const remote = snapshot.docs.map(d => d.data() as WeightLog);

      if (mergedOnce.current.weight) {
        setWeightLogs(remote);
        return;
      }
      mergedOnce.current.weight = true;

      const { merged, localOnly } = mergeByKey(remote, localDataRef.current.weightLogs, dateKey);
      setWeightLogs(merged);
      for (const item of localOnly) {
        setDoc(doc(db, 'users', user.uid, 'weightLogs', item.date), { ...item, ownerUid: user.uid })
          .catch(err => console.error("Weight backfill error:", err));
      }
    }, (error) => {
      console.error("Firestore Error (Weight):", error);
    });
    return () => unsubscribe();
  }, [user]);

  // Firestore Real-time Sync: Water Logs
  useEffect(() => {
    if (!user) return;
    const unsubscribe = onSnapshot(collection(db, 'users', user.uid, 'waterLogs'), (snapshot) => {
      const remote = snapshot.docs.map(d => d.data() as WaterLog);

      if (mergedOnce.current.water) {
        setWaterLogs(remote);
        return;
      }
      mergedOnce.current.water = true;

      const { merged, localOnly } = mergeByKey(remote, localDataRef.current.waterLogs, dateKey);
      setWaterLogs(merged);
      for (const item of localOnly) {
        setDoc(doc(db, 'users', user.uid, 'waterLogs', item.date), { ...item, ownerUid: user.uid })
          .catch(err => console.error("Water backfill error:", err));
      }
    }, (error) => {
      console.error("Firestore Error (Water):", error);
    });
    return () => unsubscribe();
  }, [user]);

  const totals = useMemo(() => {
    const foods = todayLog?.foods || [];
    return foods.reduce((acc, food) => ({
      calories: acc.calories + (food?.calories || 0),
      protein: acc.protein + (food?.protein || 0),
      carbs: acc.carbs + (food?.carbs || 0),
      fat: acc.fat + (food?.fat || 0),
    }), { calories: 0, protein: 0, carbs: 0, fat: 0 });
  }, [todayLog]);

  useEffect(() => {
    try {
      localStorage.setItem('jianshi_logs', JSON.stringify(logs));
    } catch (e) {
      console.error('Failed to save logs to localStorage', e);
    }
  }, [logs]);

  useEffect(() => {
    try {
      localStorage.setItem('jianshi_goals', JSON.stringify(goals));
    } catch (e) {
      console.error('Failed to save goals to localStorage', e);
    }
  }, [goals]);

  useEffect(() => {
    try {
      localStorage.setItem('jianshi_library', JSON.stringify(library));
    } catch (e) {
      console.error('Failed to save library to localStorage', e);
    }
  }, [library]);

  useEffect(() => {
    try {
      localStorage.setItem('jianshi_weight', JSON.stringify(weightLogs));
    } catch (e) {
      console.error('Failed to save weight to localStorage', e);
    }
  }, [weightLogs]);

  useEffect(() => {
    try {
      localStorage.setItem('jianshi_water', JSON.stringify(waterLogs));
    } catch (e) {
      console.error('Failed to save water to localStorage', e);
    }
  }, [waterLogs]);

  /** 把某一天的食物列表写回 Firestore（未登录时是空操作） */
  const syncDayLog = (date: string, foods: FoodItem[], errLabel: string) => {
    if (!user) return;
    setDoc(doc(db, 'users', user.uid, 'logs', date), {
      date,
      ownerUid: user.uid,
      foods
    }, { merge: true }).catch(err => console.error(errLabel, err));
  };

  const handleAddFood = async (food: Omit<FoodItem, 'id' | 'timestamp' | 'mealType' | 'amountValue' | 'baseNutrition'>) => {
    const { value: amountVal, isGram } = parseAmount(food.amount);

    // For grams, baseNutrition is per 100g. For units, baseNutrition is per 1 unit.
    const ratio = isGram ? (100 / amountVal) : (1 / amountVal);

    const newFood: FoodItem = {
      ...food,
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 11),
      timestamp: Date.now(),
      mealType: selectedMealType,
      amountValue: amountVal,
      baseNutrition: {
        calories: food.calories * ratio,
        protein: food.protein * ratio,
        carbs: food.carbs * ratio,
        fat: food.fat * ratio,
        unit: isGram ? 'g' : 'unit'
      }
    };

    // Optimistic Update（先算好新数据，再 setState + 同步，避免在 updater 里做副作用）
    const prevLogs = localDataRef.current.logs;
    const existingLogIndex = prevLogs.findIndex(l => l.date === todayStr);
    const updatedFoods: FoodItem[] = existingLogIndex >= 0
      ? [newFood, ...prevLogs[existingLogIndex].foods]
      : [newFood];

    const newLogs = [...prevLogs];
    if (existingLogIndex >= 0) {
      newLogs[existingLogIndex] = { ...newLogs[existingLogIndex], foods: updatedFoods };
    } else {
      newLogs.push({ date: todayStr, foods: updatedFoods });
    }
    setLogs(newLogs);
    syncDayLog(todayStr, updatedFoods, "Add food sync error");

    setIsAddModalOpen(false);
    setEstimatedResult(null);
    setAiQuery('');
    setSelectedImage(null);
    setManualFood({ name: '', calories: '', protein: '', carbs: '', fat: '', amount: '' });
    setSelectedLibraryFood(null);
    setLibraryAmount('100');
    setToast({ message: `已添加 ${food.name}`, type: 'success' });
  };

  const handleAddToLibrary = async () => {
    if (!libraryEntry.name || !libraryEntry.calories) return;
    const foodId = crypto.randomUUID();
    
    const inputAmount = Number(libraryEntry.amount) || 100;
    const ratio = 100 / inputAmount;

    const newEntry: LibraryFood = {
      id: foodId,
      name: libraryEntry.name,
      caloriesPer100g: Math.round(Number(libraryEntry.calories) * ratio),
      proteinPer100g: Number((Number(libraryEntry.protein || 0) * ratio).toFixed(1)),
      carbsPer100g: Number((Number(libraryEntry.carbs || 0) * ratio).toFixed(1)),
      fatPer100g: Number((Number(libraryEntry.fat || 0) * ratio).toFixed(1)),
      createdAt: Date.now(),
    };

    // Optimistic Update
    setLibrary(prev => [newEntry, ...prev]);

    if (user) {
      const foodRef = doc(db, 'users', user.uid, 'library', foodId);
      setDoc(foodRef, { ...newEntry, ownerUid: user.uid }).catch(err => console.error("Library sync error:", err));
    }
    
    setLibraryEntry({ name: '', calories: '', protein: '', carbs: '', fat: '', amount: '100' });
    setToast({ message: `已保存 ${newEntry.name} 到食物库`, type: 'success' });
  };

  const handleAddFromLibrary = () => {
    if (!selectedLibraryFood) return;
    const ratio = Number(libraryAmount) / 100;
    handleAddFood({
      name: selectedLibraryFood.name,
      calories: Math.round(selectedLibraryFood.caloriesPer100g * ratio),
      protein: Number((selectedLibraryFood.proteinPer100g * ratio).toFixed(1)),
      carbs: Number((selectedLibraryFood.carbsPer100g * ratio).toFixed(1)),
      fat: Number((selectedLibraryFood.fatPer100g * ratio).toFixed(1)),
      amount: `${libraryAmount}g`
    });
  };

  const handleUpdateFood = async (updatedFood: FoodItem) => {
    if (!updatedFood) return;

    const prevLogs = localDataRef.current.logs;
    const logIndex = prevLogs.findIndex(l => l.date === todayStr);
    if (logIndex === -1) {
      setEditingFood(null);
      return;
    }

    const newFoods = prevLogs[logIndex].foods.map(f => f.id === updatedFood.id ? updatedFood : f);
    const newLogs = [...prevLogs];
    newLogs[logIndex] = { ...newLogs[logIndex], foods: newFoods };

    setLogs(newLogs);
    syncDayLog(todayStr, newFoods, "Update food sync error:");
    setEditingFood(null);
  };

  const handleUpdateLibraryFood = async (updatedFood: LibraryFood) => {
    // Optimistic update
    setLibrary(prev => prev.map(f => f.id === updatedFood.id ? updatedFood : f));

    if (user) {
      const foodRef = doc(db, 'users', user.uid, 'library', updatedFood.id);
      await setDoc(foodRef, { ...updatedFood, ownerUid: user.uid });
    }
    setEditingLibraryFood(null);
  };

  const handleRemoveLibraryFood = async (id: string) => {
    // Optimistic Update
    setLibrary(prev => prev.filter(f => f.id !== id));

    if (user) {
      const foodRef = doc(db, 'users', user.uid, 'library', id);
      deleteDoc(foodRef).catch(err => console.error("Library delete sync error:", err));
    }
    setToast({ message: '已从食物库删除', type: 'info' });
  };

  const handleRemoveFood = async (id: string) => {
    const prevLogs = localDataRef.current.logs;
    const logIndex = prevLogs.findIndex(l => l.date === todayStr);
    if (logIndex === -1) return;

    const newFoods = prevLogs[logIndex].foods.filter(f => f.id !== id);
    const newLogs = [...prevLogs];
    newLogs[logIndex] = { ...newLogs[logIndex], foods: newFoods };

    setLogs(newLogs);
    syncDayLog(todayStr, newFoods, "Remove sync error:");
    setToast({ message: '已删除记录', type: 'info' });
  };

  const handleUpdateGoals = async (newGoals: MacroGoals) => {
    setGoals(newGoals);
    if (user) {
      const userDocRef = doc(db, 'users', user.uid);
      await setDoc(userDocRef, { goals: newGoals }, { merge: true });
    }
  };

  // Persist fitness goal locally
  useEffect(() => {
    try {
      localStorage.setItem('jianshi_fitness_goal', fitnessGoal);
    } catch (e) { /* ignore */ }
  }, [fitnessGoal]);

  // Fetch a daily AI tip (once per day, cached in localStorage by date)
  const fetchDailyTip = async (force = false) => {
    const cacheKey = `jianshi_tip_${todayStr}_${fitnessGoal}`;
    if (!force) {
      const cached = localStorage.getItem(cacheKey);
      if (cached) { setDailyTip(cached); return; }
    }
    setTipLoading(true);
    try {
      const tip = await getDailyTip({ goal: fitnessGoal, totals, goals });
      setDailyTip(tip);
      localStorage.setItem(cacheKey, tip);
    } catch (e: any) {
      setDailyTip('');
    } finally {
      setTipLoading(false);
    }
  };

  const fetchMealSuggestions = async () => {
    setMealLoading(true);
    setMealSuggestions([]);
    try {
      const s = await getMealSuggestions({ goal: fitnessGoal, totals, goals });
      setMealSuggestions(s);
    } catch (e: any) {
      setToast({ message: parseAiError(e?.message || String(e)), type: 'error' });
    } finally {
      setMealLoading(false);
    }
  };

  const handleSendChat = async (presetText?: string) => {
    const text = (presetText ?? chatInput).trim();
    if (!text || chatLoading) return;
    const newMessages: ChatMessage[] = [...chatMessages, { role: 'user', content: text }];
    setChatMessages(newMessages);
    if (!presetText) setChatInput('');
    setChatLoading(true);
    try {
      const recentFoods = (todayLog?.foods || []).slice(0, 15).map((f: any) => ({ name: f.name, calories: f.calories }));
      const reply = await sendChatMessage(newMessages, { goal: fitnessGoal, totals, goals, recentFoods });
      const updated: ChatMessage[] = [...newMessages, { role: 'assistant', content: reply }];
      setChatMessages(updated);
      // 按天保存对话到本地
      try { localStorage.setItem(`jianshi_chat_${todayStr}`, JSON.stringify(updated)); } catch (e) {}
    } catch (e: any) {
      setChatMessages(prev => [...prev, { role: 'assistant', content: parseAiError(e?.message || String(e)) }]);
    } finally {
      setChatLoading(false);
    }
  };

  // 打开对话/切换日期时，加载当天已保存的对话
  useEffect(() => {
    try {
      const saved = localStorage.getItem(`jianshi_chat_${todayStr}`);
      setChatMessages(saved ? JSON.parse(saved) : []);
    } catch (e) {
      setChatMessages([]);
    }
  }, [todayStr]);

  // Auto-load cached tip when date/goal changes
  useEffect(() => {
    const cached = localStorage.getItem(`jianshi_tip_${todayStr}_${fitnessGoal}`);
    if (cached) setDailyTip(cached);
    else setDailyTip('');
  }, [todayStr, fitnessGoal]);

  const handleUpdateWater = async (amount: number) => {
    const currentAmount = waterLogs.find(l => l.date === todayStr)?.amount || 0;
    const newAmount = Math.max(0, currentAmount + amount);
    
    // Optimistic Update
    setWaterLogs(prev => {
      const index = prev.findIndex(l => l.date === todayStr);
      let next = [...prev];
      if (index >= 0) {
        next[index] = { ...next[index], amount: newAmount };
      } else {
        next.push({ date: todayStr, amount: newAmount });
      }
      return next;
    });

    if (user) {
      const waterRef = doc(db, 'users', user.uid, 'waterLogs', todayStr);
      await setDoc(waterRef, { date: todayStr, amount: newAmount, ownerUid: user.uid });
    }
  };

  const handleUpdateWeight = async (weight: number) => {
    // Optimistic Update
    setWeightLogs(prev => {
      const index = prev.findIndex(l => l.date === todayStr);
      let next = [...prev];
      if (index >= 0) {
        next[index] = { ...next[index], weight };
      } else {
        next.push({ date: todayStr, weight });
      }
      return next;
    });

    if (user) {
      const weightRef = doc(db, 'users', user.uid, 'weightLogs', todayStr);
      await setDoc(weightRef, { date: todayStr, weight, ownerUid: user.uid });
    }
    setToast({ message: `体重已更新为 ${weight}kg`, type: 'success' });
  };

  const weightChartData = useMemo(() => {
    return [...weightLogs]
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-7)
      .map(l => ({
        date: format(parseLocalDate(l.date), 'MM/dd'),
        weight: l.weight
      }));
  }, [weightLogs]);

  const macroHistoryData = useMemo(() => {
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const d = subDays(new Date(), i);
      return format(d, 'yyyy-MM-dd');
    }).reverse();

    return last7Days.map(date => {
      const log = logs.find(l => l.date === date);
      const dayTotals = log?.foods.reduce((acc, f) => ({
        calories: acc.calories + f.calories,
        protein: acc.protein + f.protein,
        carbs: acc.carbs + f.carbs,
        fat: acc.fat + f.fat,
      }), { calories: 0, protein: 0, carbs: 0, fat: 0 }) || { calories: 0, protein: 0, carbs: 0, fat: 0 };

      return {
        date: format(parseLocalDate(date), 'MM/dd'),
        ...dayTotals
      };
    });
  }, [logs]);

  const todayWater = waterLogs.find(l => l.date === todayStr)?.amount || 0;
  const todayWeight = weightLogs.find(l => l.date === todayStr)?.weight || null;

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Login failed:", error);
    }
  };

  const handleLogout = () => auth.signOut();

  const handleAiEstimate = async () => {
    if (!aiQuery.trim() && !selectedImage) return;
    
    const now = Date.now();
    if (now - lastRequestTime < 5000) {
      setError("识别太快了，请稍等几秒再试");
      return;
    }

    setIsEstimating(true);
    setError(null);
    setLastRequestTime(now);
    try {
      const result = await estimateLogNutrition(aiQuery, selectedImage || undefined);
      if (!result.isFood) {
        setError(result.reason || "未能识别出食物，请换张图片或重新描述");
        return;
      }
      setEstimatedResult(result);
      setPortionMult(1);
    } catch (err: any) {
      console.error("AI Estimation failed:", err);
      const errorMessage = parseAiError(err);
      setError(errorMessage);
    } finally {
      setIsEstimating(false);
    }
  };

  /**
   * AI 识别结果的「存入库中」：写进食物库并跳转到食物库弹窗。
   *
   * 注意：记录用的识别（isLibrary=false）返回的是「该份量的总营养」，而食物库存的是
   * 「每 100g」。份量是克时按比例换算；是「1个中等大小」这类没有克重的份量时无法换算，
   * 只能原样存下并提示用户核对。
   */
  const handleSaveEstimateToLibrary = async (result: NutritionResult) => {
    const foodId = crypto.randomUUID();
    const { value, isGram } = parseAmount(result.amount);
    const ratio = isGram && value > 0 ? 100 / value : 1;

    const newFood: LibraryFood = {
      id: foodId,
      name: result.name || "未命名食物",
      caloriesPer100g: Math.round((result.calories || 0) * ratio),
      proteinPer100g: Number(((result.protein || 0) * ratio).toFixed(1)),
      carbsPer100g: Number(((result.carbs || 0) * ratio).toFixed(1)),
      fatPer100g: Number(((result.fat || 0) * ratio).toFixed(1)),
      createdAt: Date.now()
    };

    setLibrary(prev => [newFood, ...prev]);

    if (user) {
      const foodRef = doc(db, 'users', user.uid, 'library', foodId);
      setDoc(foodRef, { ...newFood, ownerUid: user.uid }).catch(err => console.error("Library sync error:", err));
    }

    setToast(
      isGram
        ? { message: `已保存 ${newFood.name} 到食物库`, type: 'success' }
        : { message: `已保存 ${newFood.name}，但「${result.amount}」无法换算成每 100g，请核对`, type: 'info' }
    );
    setIsAddModalOpen(false);
    setIsLibraryOpen(true);
  };

  /** 食物库里的「相册识别 / 拍照识别」：识别营养表，填入每 100g 的草稿表单 */
  const handleLibraryImageSelect = async (file: File) => {
    setIsEstimating(true);
    setError(null);
    try {
      const compressedBase64 = await compressImage(file);
      const result = await estimateLibraryNutrition("请识别营养表并返回每100g的数值", compressedBase64);

      if (!result.isFood) {
        setError(result.reason || "未能识别出食物或营养表，请换张图片");
        setIsEstimating(false);
        return;
      }

      setLibraryEntry({
        name: result.name || "未命名食物",
        calories: result.calories ? Math.round(result.calories).toString() : "0",
        protein: result.protein ? result.protein.toFixed(1) : "0",
        carbs: result.carbs ? result.carbs.toFixed(1) : "0",
        fat: result.fat ? result.fat.toFixed(1) : "0",
        amount: '100'
      });
    } catch (err: any) {
      console.error("识别失败", err);
      const errorMessage = parseAiError(err);
      setError(errorMessage);
    } finally {
      setIsEstimating(false);
    }
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const compressedBase64 = await compressImage(file);
        setSelectedImage(compressedBase64);
      } catch (err) {
        console.error("Failed to compress image", err);
        setToast({ message: "图片处理失败，请重试", type: "error" });
      }
    }
  };

  const chartData = useMemo(() => [
    { name: 'protein', value: Math.round((totals?.protein || 0) * 4), color: COLORS.protein },
    { name: 'carbs', value: Math.round((totals?.carbs || 0) * 4), color: COLORS.carbs },
    { name: 'fat', value: Math.round((totals?.fat || 0) * 9), color: COLORS.fat },
  ].filter(d => d.value > 0), [totals]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-emerald-100 select-none [-webkit-touch-callout:none]">
      {/* Splash Screen / Loading Overlay */}
      <AnimatePresence mode="wait">
        {showSplash && (
          <motion.div 
            key="splash"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, filter: "blur(10px)" }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="fixed inset-0 z-[100] bg-slate-50 flex flex-col items-center justify-center p-8"
          >
            <motion.div 
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ 
                type: "spring",
                stiffness: 200,
                damping: 20,
                delay: 0.1 
              }}
              className="relative"
            >
              <motion.div 
                animate={{ 
                  scale: [1, 1.05, 1],
                  rotate: [0, 2, -2, 0]
                }}
                transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
                className="w-24 h-24 bg-gradient-to-br from-slate-800 to-slate-900 rounded-[2rem] flex items-center justify-center text-white shadow-2xl shadow-slate-900/20"
              >
                <Flame size={48} fill="currentColor" />
              </motion.div>
            </motion.div>
            <motion.div 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.6, ease: "easeOut" }}
              className="mt-8 text-center space-y-4"
            >
              <h1 className="text-4xl font-black tracking-tighter text-slate-900 leading-none">健食</h1>
              <p className="text-xs font-black text-slate-400 tracking-widest uppercase">by 614</p>
              <div className="flex items-center gap-2 justify-center pt-2">
                <div className="w-1.5 h-1.5 bg-slate-800 rounded-full animate-bounce [animation-delay:-0.3s]" />
                <div className="w-1.5 h-1.5 bg-slate-800 rounded-full animate-bounce [animation-delay:-0.15s]" />
                <div className="w-1.5 h-1.5 bg-slate-800 rounded-full animate-bounce" />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <motion.header 
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="sticky top-0 z-30 bg-white/60 backdrop-blur-xl border-b border-white/20 px-4 py-3 shadow-[0_4px_20px_rgb(0,0,0,0.02)]"
      >
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3 bg-white/80 backdrop-blur-xl px-4 py-2 rounded-full shadow-[0_4px_20px_rgb(0,0,0,0.04)] border border-white/60">
            <div className="w-8 h-8 bg-gradient-to-br from-slate-800 to-slate-900 rounded-full flex items-center justify-center text-white shadow-inner shrink-0">
              <Flame size={18} fill="currentColor" />
            </div>
            <div className="flex flex-col">
              <h1 className="text-lg font-black tracking-tight text-slate-900 leading-none">健食</h1>
              <span className="text-[10px] uppercase tracking-widest text-emerald-400 font-semibold mt-0.5">by 614</span>
            </div>
          </div>
          
          <div className="flex items-center gap-1.5 sm:gap-2">
            <AnimatePresence mode="wait">
              {!IS_CN_VERSION && isAuthReady && (
                user ? (
                  <motion.div 
                    key="user-profile"
                    initial={{ opacity: 0, scale: 0.9, x: 10 }}
                    animate={{ opacity: 1, scale: 1, x: 0 }}
                    exit={{ opacity: 0, scale: 0.9, x: 10 }}
                    transition={{ duration: 0.3, ease: "easeOut" }}
                    className="flex items-center gap-1.5 sm:gap-2 mr-1 sm:mr-2"
                  >
                    <img src={user.photoURL || ''} alt="avatar" className="w-8 h-8 rounded-full border border-slate-200 shadow-sm" />
                    <button 
                      onClick={() => setIsLogoutModalOpen(true)} 
                      className="p-2 hover:bg-slate-100 rounded-lg transition-all text-slate-600 border border-transparent hover:border-slate-200"
                      title="退出登录"
                    >
                      <LogOut size={20} />
                    </button>
                  </motion.div>
                ) : (
                  <motion.button 
                    key="login-btn"
                    initial={{ opacity: 0, scale: 0.9, x: 10 }}
                    animate={{ opacity: 1, scale: 1, x: 0 }}
                    exit={{ opacity: 0, scale: 0.9, x: 10 }}
                    transition={{ duration: 0.3, ease: "easeOut" }}
                    onClick={handleLogin}
                    className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 rounded-xl text-emerald-600 transition-all border border-emerald-100 shadow-sm mr-1 sm:mr-2"
                    title="登录同步数据"
                  >
                    <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                    <span className="text-[10px] font-black uppercase tracking-widest">登录</span>
                  </motion.button>
                )
              )}
            </AnimatePresence>
            <button 
              onClick={() => setIsLibraryOpen(true)}
              className="p-2 hover:bg-slate-100 rounded-lg transition-all text-slate-600 border border-transparent hover:border-slate-200"
              title="食物库"
            >
              <History size={20} />
            </button>
            <button 
              onClick={() => setIsSettingsOpen(true)}
              className="p-2 hover:bg-slate-100 rounded-lg transition-all text-slate-600 border border-transparent hover:border-slate-200"
              title="设置"
            >
              <SettingsIcon size={20} />
            </button>
          </div>
        </div>
      </motion.header>

      <main className="max-w-2xl mx-auto px-4 py-8 pb-32 space-y-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1, ease: "easeOut" }}
        >
          {/* Date Navigation */}
          <div className="flex items-center justify-center gap-4 bg-white p-2.5 rounded-[1.5rem] shadow-sm border border-slate-100 w-fit mx-auto">
          <div className="flex items-center bg-slate-50 p-0.5 rounded-lg border border-slate-100">
            <button 
              onClick={() => setSelectedDate(prev => subDays(prev, 1))}
              className="p-1.5 hover:bg-white rounded-md text-slate-400 hover:text-emerald-600 transition-all active:scale-90 shadow-none hover:shadow-sm"
              title="前一天"
            >
              <ChevronLeft size={16} />
            </button>
            <div className="px-3 text-center min-w-[100px]">
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.1em] leading-none mb-0.5">
                {format(selectedDate, 'yyyy年')}
              </p>
              <p className="text-xs font-black text-slate-900 tracking-tight">
                {format(selectedDate, 'MM月dd日')}
              </p>
            </div>
            <button 
              onClick={() => {
                const nextDay = addDays(selectedDate, 1);
                if (isBefore(nextDay, startOfToday()) || format(nextDay, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')) {
                  setSelectedDate(nextDay);
                }
              }}
              disabled={format(selectedDate, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')}
              className={cn(
                "p-1.5 rounded-md transition-all active:scale-90 shadow-none",
                format(selectedDate, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')
                  ? "text-slate-200 cursor-not-allowed"
                  : "text-slate-400 hover:bg-white hover:text-emerald-600 hover:shadow-sm"
              )}
              title="后一天"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          <button 
            onClick={() => setSelectedDate(new Date())}
            disabled={format(selectedDate, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')}
            className={cn(
              "px-4 py-2 text-[10px] font-black rounded-lg transition-all shadow-sm active:scale-95",
              format(selectedDate, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')
                ? "bg-slate-100 text-slate-300 cursor-not-allowed shadow-none"
                : "bg-emerald-500 text-white hover:bg-emerald-600 shadow-emerald-100"
            )}
          >
            回到今天
          </button>
        </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2, ease: "easeOut" }}
        >
        {/* View Switcher */}
        <div className="flex p-1 bg-slate-100 rounded-2xl w-fit mx-auto shadow-inner">
          <button 
            onClick={() => setViewTab('daily')}
            className={cn(
              "px-6 py-2.5 rounded-xl text-sm font-black transition-all flex items-center gap-2",
              viewTab === 'daily' ? "bg-white text-emerald-600 shadow-sm" : "text-slate-400 hover:text-slate-600"
            )}
          >
            <Calendar size={18} />
            今日记录
          </button>
          <button 
            onClick={() => setViewTab('stats')}
            className={cn(
              "px-6 py-2.5 rounded-xl text-sm font-black transition-all flex items-center gap-2",
              viewTab === 'stats' ? "bg-white text-emerald-600 shadow-sm" : "text-slate-400 hover:text-slate-600"
            )}
          >
            <TrendingUp size={18} />
            趋势分析
          </button>
        </div>
        </motion.div>

        <AnimatePresence mode="wait">
          {viewTab === 'daily' ? (
            <motion.div
              key="daily"
              initial="hidden"
              animate="visible"
              exit="hidden"
              variants={{
                hidden: { opacity: 0 },
                visible: {
                  opacity: 1,
                  transition: { staggerChildren: 0.1 }
                }
              }}
              className="space-y-8"
            >
              {/* Daily Summary Card */}
              <motion.section 
                variants={{
                  hidden: { opacity: 0, y: 20 },
                  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } }
                }}
                className="bg-white/70 backdrop-blur-xl rounded-[2.5rem] p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/50 relative overflow-hidden group"
              >
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50 rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-110 duration-700" />
          
          <div className="relative grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
            <div className="space-y-8">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-slate-400 uppercase tracking-widest">今日热量摄入</span>
                  </div>
                  <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg">
                    {Math.round((totals.calories / goals.calories) * 100)}%
                  </span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-5xl font-black tracking-tighter text-slate-900">
                    <AnimatedNumber value={totals.calories} />
                  </span>
                  <span className="text-slate-300 text-xl font-bold italic">/ {goals.calories}</span>
                </div>
                <div className="mt-4 w-full h-3 bg-slate-200/50 rounded-full overflow-hidden p-0.5 shadow-inner">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min((totals.calories / goals.calories) * 100, 100)}%` }}
                    className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-full shadow-[0_0_12px_rgba(16,185,129,0.6)] animate-pulse"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <MacroStat label="蛋白质" current={totals.protein} target={goals.protein} color={COLORS.protein} icon={<Beef size={14} />} />
                <MacroStat label="碳水" current={totals.carbs} target={goals.carbs} color={COLORS.carbs} icon={<Wheat size={14} />} />
                <MacroStat label="脂肪" current={totals.fat} target={goals.fat} color={COLORS.fat} icon={<Droplets size={14} />} />
              </div>
            </div>

            <div className="h-56 relative flex items-center justify-center outline-none">
              {chartData.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height="100%" className="outline-none">
                      <PieChart style={{ outline: 'none', border: 'none' }} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                        <defs>
                          <linearGradient id="grad-protein" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#c084fc" />
                            <stop offset="50%" stopColor="#a855f7" />
                            <stop offset="100%" stopColor="#7e22ce" />
                          </linearGradient>
                          <linearGradient id="grad-carbs" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#60a5fa" />
                            <stop offset="50%" stopColor="#3b82f6" />
                            <stop offset="100%" stopColor="#1d4ed8" />
                          </linearGradient>
                          <linearGradient id="grad-fat" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#fb923c" />
                            <stop offset="50%" stopColor="#f97316" />
                            <stop offset="100%" stopColor="#c2410c" />
                          </linearGradient>
                        </defs>
                        <Pie
                          data={chartData}
                          innerRadius={75}
                          outerRadius={95}
                          paddingAngle={6}
                          dataKey="value"
                          strokeWidth={0}
                          cornerRadius={16}
                          isAnimationActive={true}
                          cx="50%"
                          cy="50%"
                          style={{ outline: 'none', border: 'none', filter: 'drop-shadow(0px 10px 15px rgba(0,0,0,0.1))' }}
                        >
                          {chartData.map((entry, index) => {
                            let fillId = entry.color;
                            if (entry.name === 'protein') fillId = 'url(#grad-protein)';
                            if (entry.name === 'carbs') fillId = 'url(#grad-carbs)';
                            if (entry.name === 'fat') fillId = 'url(#grad-fat)';
                            return <Cell key={`cell-${index}`} fill={fillId} style={{ outline: 'none', border: 'none' }} />;
                          })}
                        </Pie>
                        <Tooltip 
                          wrapperStyle={{ zIndex: 100 }}
                          contentStyle={{ 
                            borderRadius: '20px', 
                            border: '1px solid rgba(255,255,255,0.5)', 
                            background: 'rgba(255,255,255,0.8)',
                            backdropFilter: 'blur(12px)',
                            boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)',
                            padding: '12px 16px',
                            outline: 'none'
                          }}
                          formatter={(value: number, name: string) => [`${Math.round(value)} kcal`, MACRO_LABELS[name.toLowerCase() as keyof typeof MACRO_LABELS] || name]}
                        />
                      </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <div 
                      className="w-[130px] h-[130px] rounded-full flex flex-col items-center justify-center relative"
                      style={{
                        background: 'conic-gradient(from 90deg at 50% 50%, #f8fafc, #e2e8f0, #f8fafc, #e2e8f0, #f8fafc)',
                        boxShadow: 'inset 0 0 20px rgba(255,255,255,0.8), 0 10px 20px rgba(0,0,0,0.1), 0 2px 5px rgba(0,0,0,0.05)',
                        border: '1px solid rgba(255,255,255,0.6)'
                      }}
                    >
                      <span className="text-4xl font-black tracking-tighter text-slate-800 drop-shadow-sm">
                        <AnimatedNumber value={goals.calories - totals.calories} />
                      </span>
                      <div className="flex items-center gap-1 mt-1">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">剩余热量</span>
                        <span className="text-[10px] font-black text-slate-800 uppercase tracking-widest">KCAL</span>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-200 gap-3">
                  <div 
                    className="w-[130px] h-[130px] rounded-full flex flex-col items-center justify-center relative"
                    style={{
                      background: 'conic-gradient(from 90deg at 50% 50%, #f8fafc, #e2e8f0, #f8fafc, #e2e8f0, #f8fafc)',
                      boxShadow: 'inset 0 0 20px rgba(255,255,255,0.8), 0 10px 20px rgba(0,0,0,0.1), 0 2px 5px rgba(0,0,0,0.05)',
                      border: '1px solid rgba(255,255,255,0.6)'
                    }}
                  >
                    <span className="text-4xl font-black tracking-tighter text-slate-800 drop-shadow-sm">
                      <AnimatedNumber value={goals.calories - totals.calories} />
                    </span>
                    <div className="flex items-center gap-1 mt-1">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">剩余热量</span>
                      <span className="text-[10px] font-black text-slate-800 uppercase tracking-widest">KCAL</span>
                    </div>
                  </div>
                  <span className="text-[8px] font-black uppercase tracking-[0.2em] text-slate-300">等待开启今日计划</span>
                </div>
              )}
            </div>
          </div>
        </motion.section>

        {/* AI Coach — independent card, light theme */}
        <motion.section
          variants={{
            hidden: { opacity: 0, y: 20 },
            visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } }
          }}
          className="bg-white/70 backdrop-blur-xl rounded-[2.5rem] p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/50"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-emerald-50 text-emerald-500 rounded-lg">
                <Sparkles size={16} />
              </div>
              <span className="text-sm font-black text-slate-900">AI 营养教练</span>
            </div>
            <button
              onClick={() => fetchDailyTip(true)}
              className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors text-slate-400"
              aria-label="刷新建议"
            >
              <RefreshCw size={14} className={tipLoading ? 'animate-spin' : ''} />
            </button>
          </div>

          {/* daily tip */}
          {dailyTip ? (
            <div className="flex gap-2 items-start mb-4 bg-emerald-50/60 rounded-2xl p-3.5">
              <Lightbulb size={16} className="text-emerald-500 mt-0.5 shrink-0" />
              <p className="text-sm text-slate-700 leading-relaxed font-medium">{dailyTip}</p>
            </div>
          ) : (
            <button
              onClick={() => fetchDailyTip(true)}
              disabled={tipLoading}
              className="w-full text-left text-sm text-slate-400 mb-4 hover:text-emerald-600 transition-colors bg-slate-50 rounded-2xl p-3.5"
            >
              {tipLoading ? '正在思考…' : '💡 点我获取今日营养建议 →'}
            </button>
          )}

          {/* action button */}
          <button
            onClick={() => setIsChatOpen(true)}
            className="w-full flex items-center justify-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white font-black py-3 rounded-2xl transition-colors text-sm"
          >
            <Sparkles size={15} />
            问教练 · 聊聊今天吃什么
          </button>
        </motion.section>

        <div className="grid grid-cols-2 gap-4">
          <motion.section 
            variants={{
              hidden: { opacity: 0, y: 20 },
              visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } }
            }}
            className="bg-white/70 backdrop-blur-xl rounded-[2.5rem] p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/50 flex flex-col justify-between"
          >
            <div className="flex flex-col gap-3 mb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <div className="p-1.5 bg-blue-50 text-blue-500 rounded-lg">
                    <GlassWater size={16} />
                  </div>
                  <span className="text-xs font-black text-slate-900 leading-none">饮水量</span>
                </div>
                <TrendingUp size={16} className="text-slate-100" />
              </div>
              <div className="flex items-center justify-between px-1">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">目标 2000ml</span>
                {todayWater >= 2000 && <Check size={12} className="text-emerald-500" />}
              </div>
            </div>
            <div className="flex items-baseline gap-1 mb-4">
              <span className="text-3xl font-black text-slate-900"><AnimatedNumber value={todayWater} /></span>
              <span className="text-xs font-bold text-slate-300">ml</span>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={() => handleUpdateWater(250)}
                className="flex-1 py-2 bg-blue-500 text-white rounded-xl text-xs font-black hover:bg-blue-600 transition-all active:scale-95"
              >
                +250ml
              </button>
              <button 
                onClick={() => handleUpdateWater(-250)}
                className="px-3 py-2 bg-slate-50 text-slate-400 rounded-xl text-xs font-black hover:bg-slate-100 transition-all"
              >
                -
              </button>
            </div>
          </motion.section>

          <motion.section 
            variants={{
              hidden: { opacity: 0, y: 20 },
              visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } }
            }}
            className="bg-white/70 backdrop-blur-xl rounded-[2.5rem] p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/50 flex flex-col justify-between"
          >
            <div className="flex flex-col gap-3 mb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <div className="p-1.5 bg-violet-50 text-violet-500 rounded-lg">
                    <Scale size={16} />
                  </div>
                  <span className="text-xs font-black text-slate-900 leading-none">今日体重</span>
                </div>
                <TrendingUp size={16} className="text-slate-100" />
              </div>
              <div className="px-1">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">追踪变化趋势</span>
              </div>
            </div>
            <div className="flex items-baseline gap-1 mb-4">
              <span className="text-3xl font-black text-slate-900">
                {todayWeight ? <AnimatedNumber value={todayWeight} /> : '--'}
              </span>
              <span className="text-xs font-bold text-slate-300">kg</span>
            </div>
            <button 
              onClick={() => {
                setWeightInput(todayWeight ? String(todayWeight) : '');
                setIsWeightModalOpen(true);
              }}
              className="w-full py-2 bg-violet-500 text-white rounded-xl text-xs font-black hover:bg-violet-600 transition-all active:scale-95"
            >
              更新体重
            </button>
          </motion.section>
        </div>

        {/* Food Log */}
        <motion.section 
          variants={{
            hidden: { opacity: 0, y: 20 },
            visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } }
          }}
          className="space-y-6"
        >
          <div className="flex items-center justify-between px-2">
            <h2 className="text-xl font-black tracking-tighter flex items-center gap-2 text-slate-900">
              <History size={22} className="text-emerald-500" />
              今日饮食清单
            </h2>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-100 px-3 py-1 rounded-full">
              {todayLog.foods.length} 条记录
            </span>
          </div>

          <div className="space-y-4">
            <AnimatePresence mode="popLayout">
              {todayLog.foods.length > 0 ? (
                (['breakfast', 'lunch', 'dinner', 'snack'] as MealType[]).map((mealType) => {
                  const mealFoods = todayLog.foods.filter(f => f.mealType === mealType || (!f.mealType && mealType === 'snack'));
                  if (mealFoods.length === 0) return null;

                  const mealIcons = {
                    breakfast: <Coffee size={18} className="text-amber-500" />,
                    lunch: <Sun size={18} className="text-emerald-500" />,
                    dinner: <Moon size={18} className="text-violet-500" />,
                    snack: <Cookie size={18} className="text-rose-500" />
                  };

                  const mealLabels = {
                    breakfast: '早餐',
                    lunch: '午餐',
                    dinner: '晚餐',
                    snack: '加餐'
                  };

                  return (
                    <motion.div 
                      key={mealType} 
                      layout="position"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ type: "spring", stiffness: 300, damping: 30 }}
                      className="space-y-3"
                    >
                      <div className="flex items-center gap-2 px-2">
                        {mealIcons[mealType]}
                        <span className="text-xs font-black text-slate-400 uppercase tracking-widest">{mealLabels[mealType]}</span>
                        <div className="flex-1 h-px bg-slate-100 ml-2" />
                      </div>
                      {mealFoods.map((food) => {
                        const score = scoreFood(food, fitnessGoal);
                        return (
                        <motion.div
                          key={food.id}
                          layout
                          initial={{ opacity: 0, scale: 0.95, y: 10 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95, y: -10 }}
                          transition={{ 
                            type: "spring",
                            stiffness: 400,
                            damping: 35
                          }}
                          className="group bg-white/70 backdrop-blur-xl p-4 sm:p-5 rounded-[2.5rem] border border-white/50 shadow-[0_4px_20px_rgb(0,0,0,0.02)] transition-all flex flex-col gap-4"
                        >
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-emerald-50 group-hover:text-emerald-500 transition-all duration-500 shadow-inner shrink-0">
                              <Beef size={24} className="sm:w-[28px] sm:h-[28px]" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="font-black text-slate-900 text-base sm:text-lg truncate leading-tight">{food.name}</h3>
                              <div className="flex items-center gap-2 mt-1 flex-wrap">
                                <span className="text-[10px] sm:text-xs text-slate-400 font-bold bg-slate-50 px-2 py-0.5 rounded-md">{food.amount}</span>
                                <span className="text-[10px] sm:text-xs text-emerald-600 font-black bg-emerald-50 px-2 py-0.5 rounded-md">{food.calories} kcal</span>
                                <span
                                  className={`text-[10px] sm:text-xs font-black px-2 py-0.5 rounded-md ${SCORE_BADGE_STYLES[score.grade]}`}
                                  title={score.reason}
                                >
                                  {score.label}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              <button 
                                onClick={() => setEditingFood(food)}
                                className="p-2.5 text-slate-300 hover:text-emerald-500 hover:bg-emerald-50 rounded-xl transition-all"
                              >
                                <Pencil size={18} />
                              </button>
                              <button 
                                onClick={() => handleRemoveFood(food.id)}
                                className="p-2.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all"
                              >
                                <Trash2 size={18} />
                              </button>
                            </div>
                          </div>

                          <div className="grid grid-cols-3 gap-2 p-3 bg-slate-50/50 rounded-2xl border border-slate-100/50">
                            <div className="flex flex-col items-center gap-1 border-r border-slate-100 last:border-0">
                              <span className="text-blue-500 font-black text-xs sm:text-sm">{food.protein.toFixed(1)}g</span>
                              <span className="text-slate-400 text-[9px] font-bold uppercase tracking-tighter">蛋白质</span>
                            </div>
                            <div className="flex flex-col items-center gap-1 border-r border-slate-100 last:border-0">
                              <span className="text-violet-500 font-black text-xs sm:text-sm">{food.carbs.toFixed(1)}g</span>
                              <span className="text-slate-400 text-[9px] font-bold uppercase tracking-tighter">碳水</span>
                            </div>
                            <div className="flex flex-col items-center gap-1 border-r border-slate-100 last:border-0">
                              <span className="text-amber-500 font-black text-xs sm:text-sm">{food.fat.toFixed(1)}g</span>
                              <span className="text-slate-400 text-[9px] font-bold uppercase tracking-tighter">脂肪</span>
                            </div>
                          </div>
                          <p className="text-[11px] text-slate-400 font-medium mt-2 px-1">
                            {score.label} · {score.reason}
                          </p>
                        </motion.div>
                        );
                      })}
                    </motion.div>
                  );
                })
              ) : (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.4, ease: "easeOut" }}
                  className="py-20 text-center space-y-6 bg-slate-50/50 rounded-[3rem] border-2 border-dashed border-slate-100"
                >
                  <motion.div 
                    animate={{ 
                      y: [0, -10, 0],
                    }}
                    transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
                    className="w-24 h-24 bg-white rounded-full mx-auto flex items-center justify-center text-slate-200 shadow-sm"
                  >
                    <Search size={40} />
                  </motion.div>
                  <div className="space-y-2">
                    <p className="text-slate-900 font-black text-xl tracking-tight">清单空空如也</p>
                    <p className="text-sm text-slate-400 font-bold">开启你的健康饮食第一步吧</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
              </motion.section>
            </motion.div>
          ) : (
            <motion.div
              key="stats"
              initial="hidden"
              animate="visible"
              exit="hidden"
              variants={{
                hidden: { opacity: 0 },
                visible: {
                  opacity: 1,
                  transition: { staggerChildren: 0.1 }
                }
              }}
              className="space-y-8"
            >
              {/* Weight Chart */}
            <motion.section 
              variants={{
                hidden: { opacity: 0, y: 20 },
                visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } }
              }}
              className="bg-white/70 backdrop-blur-xl rounded-[2.5rem] p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/50"
            >
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-xl font-black tracking-tighter flex items-center gap-2 text-slate-900">
                  <Scale size={22} className="text-blue-500" />
                  体重变化趋势
                </h3>
                <div className="flex items-center gap-2">
                  <input 
                    type="number" 
                    placeholder="录入体重"
                    className="w-24 p-2 bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold outline-none focus:border-blue-500"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleUpdateWeight(Number((e.target as HTMLInputElement).value));
                        (e.target as HTMLInputElement).value = '';
                      }
                    }}
                  />
                  <span className="text-xs font-black text-slate-400">kg</span>
                </div>
              </div>
              <div className="h-64 w-full">
                {weightChartData.length > 1 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={weightChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorWeight" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis 
                        dataKey="date" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} 
                        dy={10}
                      />
                      <YAxis hide domain={['dataMin - 2', 'dataMax + 2']} />
                      <Tooltip 
                        cursor={<CustomCursor stroke="#3b82f6" />}
                        isAnimationActive={true}
                        animationDuration={300}
                        animationEasing="ease-out"
                        contentStyle={{ 
                          borderRadius: '20px', 
                          border: '1px solid rgba(255,255,255,0.5)', 
                          background: 'rgba(255,255,255,0.8)',
                          backdropFilter: 'blur(12px)',
                          boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)',
                          padding: '12px 16px',
                          outline: 'none'
                        }}
                        labelStyle={{ fontWeight: 900, color: '#0f172a', marginBottom: '4px' }}
                        itemStyle={{ fontWeight: 700, color: '#3b82f6' }}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="weight" 
                        stroke="#3b82f6" 
                        strokeWidth={4} 
                        fillOpacity={1} 
                        fill="url(#colorWeight)" 
                        activeDot={<CustomActiveDot fill="#3b82f6" shadowColor="rgba(59,130,246,0.5)" />}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-slate-300 gap-2 italic text-sm font-bold">
                    需要至少两天的体重数据来生成图表
                  </div>
                )}
              </div>
            </motion.section>

            {/* Macro History Chart */}
            <motion.section 
              variants={{
                hidden: { opacity: 0, y: 20 },
                visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } }
              }}
              className="bg-white/70 backdrop-blur-xl rounded-[2.5rem] p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/50"
            >
              <h3 className="text-xl font-black tracking-tighter flex items-center gap-2 text-slate-900 mb-8">
                <TrendingUp size={22} className="text-emerald-500" />
                近 7 日热量摄入
              </h3>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={macroHistoryData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorCalories" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis 
                      dataKey="date" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} 
                      dy={10}
                    />
                    <YAxis hide />
                    <Tooltip 
                      cursor={<CustomCursor stroke="#10b981" />}
                      isAnimationActive={true}
                      animationDuration={300}
                      animationEasing="ease-out"
                      contentStyle={{ 
                        borderRadius: '20px', 
                        border: '1px solid rgba(255,255,255,0.5)', 
                        background: 'rgba(255,255,255,0.8)',
                        backdropFilter: 'blur(12px)',
                        boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)',
                        padding: '12px 16px',
                        outline: 'none'
                      }}
                      labelStyle={{ fontWeight: 900, color: '#0f172a', marginBottom: '4px' }}
                      itemStyle={{ fontWeight: 700, color: '#10b981' }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="calories" 
                      stroke="#10b981" 
                      strokeWidth={4} 
                      fillOpacity={1} 
                      fill="url(#colorCalories)" 
                      activeDot={<CustomActiveDot fill="#10b981" shadowColor="rgba(16,185,129,0.5)" />}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </motion.section>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Bottom Gradient Fade */}
      <div className="fixed bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-slate-50 to-transparent pointer-events-none z-30" />

      {/* Floating Action Button */}
      <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-40">
        <motion.button
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5, type: "spring", stiffness: 200, damping: 20 }}
          style={{ WebkitTapHighlightColor: 'transparent' }}
          onClick={() => setIsAddModalOpen(true)}
          className="bg-slate-900 text-white px-12 py-5 rounded-[2rem] shadow-2xl shadow-slate-900/30 flex items-center gap-3 font-black tracking-tighter text-lg whitespace-nowrap border border-slate-800 transition-all duration-200 hover:scale-105 active:scale-95 touch-manipulation"
        >
          <Plus size={24} />
          <span>添加食物</span>
        </motion.button>
      </div>

      {/* Add Food Modal */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddModalOpen(false)}
              className="absolute inset-0 bg-slate-900/60"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="relative w-full max-w-lg bg-white rounded-[3rem] overflow-hidden shadow-2xl border border-slate-100 flex flex-col max-h-[85dvh]"
            >
              <div className="p-6 sm:p-8 border-b border-slate-50 flex items-center justify-between bg-slate-50/50 shrink-0">
                <h2 className="text-2xl font-black tracking-tighter text-slate-900">记录美食</h2>
                <button onClick={() => setIsAddModalOpen(false)} className="p-3 hover:bg-white rounded-2xl transition-all shadow-sm border border-transparent hover:border-slate-100">
                  <X size={24} />
                </button>
              </div>

              <div className="p-6 sm:p-8 space-y-8 overflow-y-auto custom-scrollbar">
                <div className="space-y-4">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">选择用餐时段</label>
                  <div className="grid grid-cols-4 gap-2">
                    {(['breakfast', 'lunch', 'dinner', 'snack'] as MealType[]).map((type) => {
                      const icons = {
                        breakfast: <Coffee size={16} />,
                        lunch: <Sun size={16} />,
                        dinner: <Moon size={16} />,
                        snack: <Cookie size={16} />
                      };
                      const labels = {
                        breakfast: '早餐',
                        lunch: '午餐',
                        dinner: '晚餐',
                        snack: '加餐'
                      };
                      return (
                        <button
                          key={type}
                          onClick={() => setSelectedMealType(type)}
                          className={cn(
                            "flex flex-col items-center gap-2 p-3 rounded-2xl border-2 transition-all",
                            selectedMealType === type 
                              ? "bg-emerald-50 border-emerald-500 text-emerald-600 shadow-sm" 
                              : "bg-slate-50 border-slate-100 text-slate-400 hover:border-emerald-200"
                          )}
                        >
                          {icons[type]}
                          <span className="text-[10px] font-black">{labels[type]}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex p-1.5 bg-slate-100 rounded-[1.5rem] shadow-inner">
                  <button 
                    onClick={() => setActiveTab('ai')}
                    className={cn(
                      "flex-1 py-3 text-sm font-black rounded-[1.2rem] transition-all",
                      activeTab === 'ai' ? "bg-white shadow-md text-emerald-600" : "text-slate-400 hover:text-slate-600"
                    )}
                  >
                    AI 智能
                  </button>
                  <button 
                    onClick={() => setActiveTab('library')}
                    className={cn(
                      "flex-1 py-3 text-sm font-black rounded-[1.2rem] transition-all",
                      activeTab === 'library' ? "bg-white shadow-md text-emerald-600" : "text-slate-400 hover:text-slate-600"
                    )}
                  >
                    收藏库
                  </button>
                  <button 
                    onClick={() => setActiveTab('manual')}
                    className={cn(
                      "flex-1 py-3 text-sm font-black rounded-[1.2rem] transition-all",
                      activeTab === 'manual' ? "bg-white shadow-md text-emerald-600" : "text-slate-400 hover:text-slate-600"
                    )}
                  >
                    手动录入
                  </button>
                </div>

                {activeTab === 'ai' ? (
                  <AiTab
                    selectedImage={selectedImage}
                    setSelectedImage={setSelectedImage}
                    aiQuery={aiQuery}
                    setAiQuery={setAiQuery}
                    onImageChange={handleImageChange}
                    onEstimate={handleAiEstimate}
                    isEstimating={isEstimating}
                    error={error}
                    estimatedResult={estimatedResult}
                    portionMult={portionMult}
                    setPortionMult={setPortionMult}
                    fitnessGoal={fitnessGoal}
                    onAddFood={handleAddFood}
                    onSaveToLibrary={handleSaveEstimateToLibrary}
                  />
                ) : activeTab === 'library' ? (
                  <LibraryTab
                    library={library}
                    fitnessGoal={fitnessGoal}
                    selectedLibraryFood={selectedLibraryFood}
                    setSelectedLibraryFood={setSelectedLibraryFood}
                    onEditFood={setEditingLibraryFood}
                    onRemoveFood={handleRemoveLibraryFood}
                    libraryAmount={libraryAmount}
                    setLibraryAmount={setLibraryAmount}
                    onAddFromLibrary={handleAddFromLibrary}
                    onGoToLibrary={() => { setIsAddModalOpen(false); setIsLibraryOpen(true); }}
                  />
                ) : (
                  <ManualTab
                    manualFood={manualFood}
                    setManualFood={setManualFood}
                    onAddFood={handleAddFood}
                  />
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Logout Confirmation Modal */}
      <LogoutModal
        isOpen={isLogoutModalOpen}
        onClose={() => setIsLogoutModalOpen(false)}
        onConfirm={handleLogout}
      />

      {/* Weight Modal */}
      <WeightModal
        isOpen={isWeightModalOpen}
        onClose={() => setIsWeightModalOpen(false)}
        weightInput={weightInput}
        setWeightInput={setWeightInput}
        onSave={handleUpdateWeight}
      />

      {/* AI Chat Modal */}
      <ChatModal
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        messages={chatMessages}
        input={chatInput}
        setInput={setChatInput}
        loading={chatLoading}
        onSend={handleSendChat}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        goals={goals}
        onUpdateGoals={handleUpdateGoals}
        fitnessGoal={fitnessGoal}
        setFitnessGoal={setFitnessGoal}
        aiProvider={aiProvider}
        setAiProvider={setAiProvider}
        apiKey={apiKey}
        setApiKey={setApiKey}
        deepseekKey={deepseekKey}
        setDeepseekKey={setDeepseekKey}
        setToast={setToast}
      />

      {/* Food Library Modal */}
      <FoodLibraryModal
        isOpen={isLibraryOpen}
        onClose={() => setIsLibraryOpen(false)}
        libraryEntry={libraryEntry}
        setLibraryEntry={setLibraryEntry}
        error={error}
        isEstimating={isEstimating}
        onImageSelect={handleLibraryImageSelect}
        onAddToLibrary={handleAddToLibrary}
        library={library}
        fitnessGoal={fitnessGoal}
        onEditFood={setEditingLibraryFood}
        onRemoveFood={handleRemoveLibraryFood}
      />

      {/* Edit Food Modal */}
      <EditFoodModal
        editingFood={editingFood}
        setEditingFood={setEditingFood}
        onSave={handleUpdateFood}
      />

      {/* Edit Library Food Modal */}
      <EditLibraryFoodModal
        editingLibraryFood={editingLibraryFood}
        setEditingLibraryFood={setEditingLibraryFood}
        onSave={handleUpdateLibraryFood}
      />

      {/* Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 50, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: 20, x: '-50%' }}
            className="fixed bottom-28 left-1/2 z-[100] pointer-events-none"
          >
            <div className={cn(
              "px-6 py-3 rounded-full shadow-xl flex items-center gap-2 font-black text-sm border",
              toast.type === 'success' ? "bg-emerald-50 text-emerald-600 border-emerald-100" :
              toast.type === 'error' ? "bg-rose-50 text-rose-600 border-rose-100" :
              "bg-slate-800 text-white border-slate-700"
            )}>
              {toast.type === 'success' && <CheckCircle2 size={18} />}
              {toast.type === 'error' && <X size={18} />}
              {toast.type === 'info' && <Info size={18} />}
              {toast.message}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}


