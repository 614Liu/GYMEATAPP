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
  Loader2,
  Check,
  X,
  Camera,
  Image as ImageIcon,
  Coffee,
  Sun,
  Moon,
  Cookie,
  Scale,
  Leaf,
  TrendingUp,
  GlassWater,
  Calendar,
  Pencil,
  LogOut,
  CheckCircle2,
  Info,
  Sparkles,
  Lightbulb,
  Utensils,
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
import { cn } from './lib/utils';
import { estimateLogNutrition, estimateLibraryNutrition, NutritionResult, parseAiError, getDailyTip, getMealSuggestions, sendChatMessage, ChatMessage } from './lib/gemini';
import { scoreFood, scoreLibraryFood, FoodGrade } from './lib/foodScore';
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
  getDoc, 
  onSnapshot, 
  collection, 
  query, 
  orderBy,
  getDocFromServer,
  deleteDoc
} from 'firebase/firestore';

// Region flag: "cn" hides Google login (unusable in mainland China).
// Set via VITE_APP_REGION at build time. Defaults to global (login shown).
const IS_CN_VERSION = (import.meta as any).env?.VITE_APP_REGION === "cn";

const DEFAULT_GOALS: MacroGoals = {
  calories: 2000,
  protein: 150,
  carbs: 200,
  fat: 65,
};

const COLORS = {
  calories: '#10B981', // emerald-500
  protein: '#a855f7',  // purple-500
  carbs: '#3b82f6',    // blue-500
  fat: '#f97316',      // orange-500
};

// Food score badge — static class maps so Tailwind keeps them.
const SCORE_BADGE_STYLES: Record<FoodGrade, string> = {
  great: 'bg-emerald-50 text-emerald-600',
  good: 'bg-teal-50 text-teal-600',
  ok: 'bg-amber-50 text-amber-600',
  avoid: 'bg-rose-50 text-rose-600',
};

const MACRO_LABELS = {
  protein: '蛋白质',
  carbs: '碳水',
  fat: '脂肪',
  calories: '热量'
};

const CustomCursor = (props: any) => {
  const { points, height, stroke = "#10b981" } = props;
  if (!points || points.length === 0) return null;
  const { x } = points[0];
  return (
    <motion.line
      animate={{ x1: x, x2: x, y1: 0, y2: height }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      stroke={stroke}
      strokeWidth={2}
      strokeDasharray="4 4"
      strokeOpacity={0.5}
    />
  );
};

const CustomActiveDot = (props: any) => {
  const { cx, cy, fill, shadowColor } = props;
  if (!cx || !cy) return null;
  return (
    <motion.circle
      animate={{ cx, cy }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      r={6}
      fill={fill}
      stroke="#fff"
      strokeWidth={3}
      style={{ filter: `drop-shadow(0px 4px 8px ${shadowColor})` }}
    />
  );
};

export default function App() {
  console.log("App Rendering - showSplash:", true); // Initial log
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

  // Test Connection
  useEffect(() => {
    async function testConnection() {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if(error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration.");
        }
      }
    }
    testConnection();
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

  // Firestore Real-time Sync: Library
  useEffect(() => {
    if (!user) return;
    const libraryRef = collection(db, 'users', user.uid, 'library');
    const unsubscribe = onSnapshot(libraryRef, (snapshot) => {
      const items = snapshot.docs.map(doc => doc.data() as LibraryFood);
      items.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setLibrary(items);
    }, (error) => {
      console.error("Firestore Error (Library):", error);
    });
    return () => unsubscribe();
  }, [user]);

  // Firestore Real-time Sync: Logs
  useEffect(() => {
    if (!user) return;
    const logsRef = collection(db, 'users', user.uid, 'logs');
    const unsubscribe = onSnapshot(logsRef, (snapshot) => {
      const allLogs = snapshot.docs.map(doc => doc.data() as DailyLog);
      setLogs(allLogs);
    }, (error) => {
      console.error("Firestore Error (Logs):", error);
    });
    return () => unsubscribe();
  }, [user]);

  // Firestore Real-time Sync: Weight Logs
  useEffect(() => {
    if (!user) return;
    const weightRef = collection(db, 'users', user.uid, 'weightLogs');
    const unsubscribe = onSnapshot(weightRef, (snapshot) => {
      const allWeight = snapshot.docs.map(doc => doc.data() as WeightLog);
      setWeightLogs(allWeight);
    }, (error) => {
      console.error("Firestore Error (Weight):", error);
    });
    return () => unsubscribe();
  }, [user]);

  // Firestore Real-time Sync: Water Logs
  useEffect(() => {
    if (!user) return;
    const waterRef = collection(db, 'users', user.uid, 'waterLogs');
    const unsubscribe = onSnapshot(waterRef, (snapshot) => {
      const allWater = snapshot.docs.map(doc => doc.data() as WaterLog);
      setWaterLogs(allWater);
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

  const handleAddFood = async (food: Omit<FoodItem, 'id' | 'timestamp' | 'mealType' | 'amountValue' | 'baseNutrition'>) => {
    let amountVal = 100;
    let isGram = true;
    
    // Attempt to extract explicit gram value (e.g., "1个 (约150g)", "200克")
    const amountStr = food.amount || "100g";
    const gramMatch = amountStr.match(/(\d+(?:\.\d+)?)\s*(?:g|克)/i);
    if (gramMatch) {
      amountVal = Number(gramMatch[1]);
      isGram = true;
    } else {
      // If no gram unit found, look for any number (e.g., "1 份", "2 个")
      const anyNumMatch = amountStr.match(/(\d+(?:\.\d+)?)/);
      if (anyNumMatch) {
        amountVal = Number(anyNumMatch[1]);
        isGram = false; // Usually it's pieces/portions if no gram is mentioned
      } else {
        // Fallback
        isGram = amountStr.toLowerCase().includes('g') || amountStr.toLowerCase().includes('克');
      }
    }
    
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

    // Optimistic Update
    setLogs(prev => {
      const existingLogIndex = prev.findIndex(l => l.date === todayStr);
      let newLogs = [...prev];
      let updatedFoods: FoodItem[] = [];

      if (existingLogIndex >= 0) {
        updatedFoods = [newFood, ...newLogs[existingLogIndex].foods];
        newLogs[existingLogIndex] = {
          ...newLogs[existingLogIndex],
          foods: updatedFoods
        };
      } else {
        updatedFoods = [newFood];
        newLogs.push({ date: todayStr, foods: updatedFoods });
      }

      // Sync to Firestore if user is logged in
      if (user) {
        const logRef = doc(db, 'users', user.uid, 'logs', todayStr);
        setDoc(logRef, {
          date: todayStr,
          ownerUid: user.uid,
          foods: updatedFoods
        }, { merge: true }).catch(err => console.error("Add food sync error:", err));
      }

      return newLogs;
    });
    
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

  const getAutoCalories = (p: string | number, c: string | number, f: string | number) => {
    const protein = typeof p === 'string' ? parseFloat(p) || 0 : p;
    const carbs = typeof c === 'string' ? parseFloat(c) || 0 : c;
    const fat = typeof f === 'string' ? parseFloat(f) || 0 : f;
    return Math.round(protein * 4 + carbs * 4 + fat * 9);
  };

  const handleUpdateFood = async (updatedFood: FoodItem) => {
    if (!updatedFood) return;

    setLogs(prev => {
      const logIndex = prev.findIndex(l => l.date === todayStr);
      if (logIndex === -1) return prev;
      
      const newFoods = prev[logIndex].foods.map(f => f.id === updatedFood.id ? updatedFood : f);
      
      // Sync to Firestore if user is logged in
      if (user) {
        const logRef = doc(db, 'users', user.uid, 'logs', todayStr);
        setDoc(logRef, { 
          date: todayStr,
          foods: newFoods,
          ownerUid: user.uid 
        }, { merge: true }).catch(err => console.error("Sync error:", err));
      }
      
      const newLogs = [...prev];
      newLogs[logIndex] = { ...newLogs[logIndex], foods: newFoods };
      return newLogs;
    });
    
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
    setLogs(prev => {
      const logIndex = prev.findIndex(l => l.date === todayStr);
      if (logIndex === -1) return prev;
      
      const newFoods = prev[logIndex].foods.filter(f => f.id !== id);
      
      if (user) {
        const logRef = doc(db, 'users', user.uid, 'logs', todayStr);
        setDoc(logRef, { 
          date: todayStr,
          foods: newFoods,
          ownerUid: user.uid 
        }, { merge: true }).catch(err => console.error("Remove sync error:", err));
      }
      
      const newLogs = [...prev];
      newLogs[logIndex] = { ...newLogs[logIndex], foods: newFoods };
      return newLogs;
    });
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

  const handleSendChat = async () => {
    const text = chatInput.trim();
    if (!text || chatLoading) return;
    const newMessages: ChatMessage[] = [...chatMessages, { role: 'user', content: text }];
    setChatMessages(newMessages);
    setChatInput('');
    setChatLoading(true);
    try {
      const recentFoods = (todayLog?.foods || []).slice(0, 15).map((f: any) => ({ name: f.name, calories: f.calories }));
      const reply = await sendChatMessage(newMessages, { goal: fitnessGoal, totals, goals, recentFoods });
      setChatMessages(prev => [...prev, { role: 'assistant', content: reply }]);
    } catch (e: any) {
      setChatMessages(prev => [...prev, { role: 'assistant', content: parseAiError(e?.message || String(e)) }]);
    } finally {
      setChatLoading(false);
    }
  };

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
        date: format(new Date(l.date), 'MM/dd'),
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
        date: format(new Date(date), 'MM/dd'),
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
    } catch (err: any) {
      console.error("AI Estimation failed:", err);
      const errorMessage = parseAiError(err);
      setError(errorMessage);
    } finally {
      setIsEstimating(false);
    }
  };

  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          const MAX_SIZE = 600;
          
          if (width > height && width > MAX_SIZE) {
            height *= MAX_SIZE / width;
            width = MAX_SIZE;
          } else if (height > MAX_SIZE) {
            width *= MAX_SIZE / height;
            height = MAX_SIZE;
          }
          
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.6));
        };
        img.onerror = (e) => reject(e);
      };
      reader.onerror = (e) => reject(e);
    });
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

  const chartData = [
    { name: 'Protein', value: Math.round((totals?.protein || 0) * 4), color: COLORS.protein },
    { name: 'Carbs', value: Math.round((totals?.carbs || 0) * 4), color: COLORS.carbs },
    { name: 'Fat', value: Math.round((totals?.fat || 0) * 9), color: COLORS.fat },
  ].filter(d => d.value > 0);

  console.log("App Rendering - totals:", totals);

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

          {/* action buttons */}
          <div className="grid grid-cols-2 gap-2.5">
            <button
              onClick={fetchMealSuggestions}
              disabled={mealLoading}
              className="flex items-center justify-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-white font-black py-3 rounded-2xl transition-colors disabled:opacity-60 text-sm"
            >
              <Utensils size={15} />
              {mealLoading ? '搭配中…' : '下一餐吃啥'}
            </button>
            <button
              onClick={() => setIsChatOpen(true)}
              className="flex items-center justify-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white font-black py-3 rounded-2xl transition-colors text-sm"
            >
              <Sparkles size={15} />
              问教练
            </button>
          </div>

          {/* meal suggestions */}
          {mealSuggestions.length > 0 && (
            <div className="mt-4 space-y-2">
              {mealSuggestions.map((s, i) => (
                <div key={i} className="bg-slate-50 rounded-2xl p-3.5">
                  <div className="flex justify-between items-center mb-0.5">
                    <span className="font-black text-sm text-slate-900">{s.name}</span>
                    <span className="text-xs text-emerald-600 font-bold">{Math.round(s.calories)} kcal · 蛋白 {Math.round(s.protein)}g</span>
                  </div>
                  {s.reason && <p className="text-xs text-slate-500">{s.reason}</p>}
                </div>
              ))}
            </div>
          )}
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
                      {mealFoods.map((food) => (
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
                                {(() => {
                                  const s = scoreFood(food, fitnessGoal);
                                  return (
                                    <span
                                      className={`text-[10px] sm:text-xs font-black px-2 py-0.5 rounded-md ${SCORE_BADGE_STYLES[s.grade]}`}
                                      title={s.reason}
                                    >
                                      {s.label}
                                    </span>
                                  );
                                })()}
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
                          {(() => {
                            const s = scoreFood(food, fitnessGoal);
                            return (
                              <p className="text-[11px] text-slate-400 font-medium mt-2 px-1">
                                {s.label} · {s.reason}
                              </p>
                            );
                          })()}
                        </motion.div>
                      ))}
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
                  <div className="space-y-6">
                    <div className="relative group">
                      {selectedImage ? (
                        <div className="relative w-full aspect-video rounded-[2rem] overflow-hidden border-2 border-emerald-100 mb-4">
                          <img src={selectedImage} alt="Selected food" className="w-full h-full object-cover" />
                          <button 
                            onClick={() => setSelectedImage(null)}
                            className="absolute top-4 right-4 bg-rose-500 text-white p-2 rounded-full shadow-lg hover:bg-rose-600 transition-colors"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      ) : (
                        <div className="flex gap-4 mb-4">
                          <label className="flex-1 flex flex-col items-center justify-center gap-2 p-6 bg-slate-50 border-2 border-dashed border-slate-200 rounded-[2rem] cursor-pointer hover:bg-emerald-50 hover:border-emerald-200 transition-all group/upload">
                            <ImageIcon size={32} className="text-slate-300 group-hover/upload:text-emerald-500 transition-colors" />
                            <span className="text-xs font-black text-slate-400 uppercase tracking-widest">选择照片</span>
                            <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
                          </label>
                          <label className="flex-1 flex flex-col items-center justify-center gap-2 p-6 bg-slate-50 border-2 border-dashed border-slate-200 rounded-[2rem] cursor-pointer hover:bg-emerald-50 hover:border-emerald-200 transition-all group/camera">
                            <Camera size={32} className="text-slate-300 group-hover/camera:text-emerald-500 transition-colors" />
                            <span className="text-xs font-black text-slate-400 uppercase tracking-widest">拍照识别</span>
                            <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleImageChange} />
                          </label>
                        </div>
                      )}
                      
                      <textarea
                        value={aiQuery}
                        onChange={(e) => setAiQuery(e.target.value)}
                        placeholder={selectedImage ? "补充描述（可选）" : "例如：200克煎鸡胸肉和一碗糙米饭"}
                        className="w-full h-32 p-6 bg-slate-50 border-2 border-slate-100 rounded-[2rem] focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all resize-none text-base font-medium placeholder:text-slate-300"
                      />
                      <motion.button 
                        disabled={isEstimating || (!aiQuery.trim() && !selectedImage)}
                        onClick={handleAiEstimate}
                        className="absolute bottom-6 right-6 bg-gradient-to-r from-emerald-400 to-emerald-500 text-white p-4 rounded-full shadow-[0_8px_30px_rgba(16,185,129,0.3)] disabled:opacity-50 disabled:grayscale transition-all active:scale-95 touch-manipulation"
                      >
                        {isEstimating ? <Loader2 size={24} className="animate-spin" /> : <ChevronRight size={24} />}
                      </motion.button>
                    </div>

                    {error && (
                      <div className="p-4 bg-rose-50 text-rose-600 text-sm font-bold rounded-2xl flex items-center gap-3 border border-rose-100">
                        <X size={18} />
                        {error}
                      </div>
                    )}

                    {isEstimating && (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="p-6 bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 rounded-[2rem] flex flex-col items-center justify-center gap-4 text-emerald-600 font-black border border-emerald-100/50 relative overflow-hidden"
                      >
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent -translate-x-full animate-[shimmer_2s_infinite]" />
                        <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm relative">
                          <Loader2 size={24} className="animate-spin text-emerald-500" />
                          <div className="absolute inset-0 rounded-full border-2 border-emerald-500/20 animate-ping" />
                        </div>
                        <span className="tracking-widest">AI 正在努力识别中...</span>
                      </motion.div>
                    )}

                    {estimatedResult && !isEstimating && (
                      <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="p-6 bg-emerald-50/50 rounded-[2rem] border-2 border-emerald-100 space-y-6"
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-black text-emerald-900 text-xl tracking-tight">{estimatedResult.name || "未命名食物"}</h4>
                            <p className="text-xs text-emerald-600 font-black uppercase tracking-widest mt-1">{estimatedResult.amount || "未知份量"}</p>
                          </div>
                          <div className="text-right">
                            <span className="text-3xl font-black text-emerald-900 tracking-tighter">{estimatedResult.calories || 0}</span>
                            <span className="text-xs font-black text-emerald-600 uppercase ml-1">kcal</span>
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                          <MacroBadge label="蛋白质" value={estimatedResult.protein || 0} color="purple" />
                          <MacroBadge label="碳水" value={estimatedResult.carbs || 0} color="blue" />
                          <MacroBadge label="脂肪" value={estimatedResult.fat || 0} color="orange" />
                        </div>
                        {(() => {
                          const s = scoreFood({
                            calories: estimatedResult.calories || 0,
                            protein: estimatedResult.protein || 0,
                            carbs: estimatedResult.carbs || 0,
                            fat: estimatedResult.fat || 0,
                          }, fitnessGoal);
                          return (
                            <div className="flex items-center gap-2 px-1">
                              <span className={`text-xs font-black px-2.5 py-1 rounded-lg ${SCORE_BADGE_STYLES[s.grade]}`}>
                                {s.label}
                              </span>
                              <span className="text-xs text-emerald-700/70 font-medium">{s.reason}</span>
                            </div>
                          );
                        })()}
                        <div className="grid grid-cols-2 gap-3">
                          <motion.button 
                            onClick={() => handleAddFood(estimatedResult)}
                            className="flex-1 bg-gradient-to-r from-emerald-400 to-emerald-500 text-white py-4 rounded-full font-black text-sm shadow-[0_8px_30px_rgba(16,185,129,0.3)] flex items-center justify-center gap-2 transition-all active:scale-95 touch-manipulation"
                          >
                            <Check size={20} />
                            记录今日
                          </motion.button>
                          <button 
                            onClick={async () => {
                              const foodId = crypto.randomUUID();
                              const newFood: LibraryFood = {
                                id: foodId,
                                name: estimatedResult.name || "未命名食物",
                                caloriesPer100g: estimatedResult.calories || 0,
                                proteinPer100g: estimatedResult.protein || 0,
                                carbsPer100g: estimatedResult.carbs || 0,
                                fatPer100g: estimatedResult.fat || 0,
                                createdAt: Date.now()
                              };
                              
                              setLibrary(prev => [newFood, ...prev]);
                              
                              if (user) {
                                const foodRef = doc(db, 'users', user.uid, 'library', foodId);
                                setDoc(foodRef, { ...newFood, ownerUid: user.uid }).catch(err => console.error("Library sync error:", err));
                              }
                              
                              setToast({ message: `已保存 ${newFood.name} 到食物库`, type: 'success' });
                              setIsAddModalOpen(false);
                              setIsLibraryOpen(true);
                            }}
                            className="flex-1 bg-slate-900 text-white py-4 rounded-2xl font-black text-sm shadow-xl shadow-slate-900/20 flex items-center justify-center gap-2 hover:bg-slate-800 transition-all hover:-translate-y-1"
                          >
                            <Plus size={20} />
                            存入库中
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </div>
                ) : activeTab === 'library' ? (
                  <div className="space-y-6">
                    <div className="max-h-[300px] overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                      {library.length > 0 ? (
                        library.map((food) => (
                          <div
                            key={food.id}
                            onClick={() => setSelectedLibraryFood(food)}
                            className={cn(
                              "w-full p-4 sm:p-5 rounded-2xl border-2 transition-all flex items-center justify-between group cursor-pointer",
                              selectedLibraryFood?.id === food.id 
                                ? "bg-emerald-50 border-emerald-500 shadow-lg shadow-emerald-500/10" 
                                : "bg-slate-50 border-slate-100 hover:border-emerald-200"
                            )}
                          >
                            <div className="text-left flex-1 pr-2">
                              <h4 className="font-black text-slate-900 text-sm sm:text-base line-clamp-1">{food.name}</h4>
                              <div className="flex items-center gap-2 mt-1">
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">每 100g / {food.caloriesPer100g} kcal</p>
                                {(() => {
                                  const s = scoreLibraryFood(food, fitnessGoal);
                                  return (
                                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-md ${SCORE_BADGE_STYLES[s.grade]}`} title={s.reason}>
                                      {s.label}
                                    </span>
                                  );
                                })()}
                              </div>
                            </div>
                            <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingLibraryFood(food);
                                }}
                                className="p-2 text-slate-300 hover:text-emerald-500 transition-colors active:scale-95"
                              >
                                <Pencil size={16} />
                              </button>
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRemoveLibraryFood(food.id);
                                }}
                                className="p-2 text-slate-300 hover:text-rose-500 transition-colors active:scale-95"
                              >
                                <Trash2 size={16} />
                              </button>
                              {selectedLibraryFood?.id === food.id && (
                                <div className="w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center text-white ml-1">
                                  <Check size={14} strokeWidth={4} />
                                </div>
                              )}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="py-10 text-center space-y-4">
                          <p className="text-slate-400 font-bold">收藏库还是空的</p>
                          <button 
                            onClick={() => { setIsAddModalOpen(false); setIsLibraryOpen(true); }}
                            className="text-emerald-600 font-black text-sm hover:underline"
                          >
                            前往管理食物库
                          </button>
                        </div>
                      )}
                    </div>

                    {selectedLibraryFood && (
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-6 pt-4 border-t border-slate-100"
                      >
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">摄入重量 (克)</label>
                          <input 
                            type="number"
                            value={libraryAmount}
                            onChange={(e) => setLibraryAmount(e.target.value)}
                            className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none font-black text-xl"
                          />
                        </div>
                        <motion.button 
                          onClick={handleAddFromLibrary}
                          className="w-full bg-gradient-to-r from-emerald-400 to-emerald-500 text-white py-4 rounded-full font-black text-lg shadow-[0_8px_30px_rgba(16,185,129,0.3)] active:scale-95 transition-transform touch-manipulation"
                        >
                          添加到记录
                        </motion.button>
                      </motion.div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">食物名称</label>
                      <input
                        type="text"
                        placeholder="例如：全麦吐司"
                        value={manualFood.name}
                        onChange={(e) => setManualFood({...manualFood, name: e.target.value})}
                        className="w-full p-5 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 text-base font-bold"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">热量 (kcal)</label>
                        <input
                          type="number"
                          value={manualFood.calories}
                          onChange={(e) => setManualFood({...manualFood, calories: e.target.value})}
                          className="w-full p-5 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 text-base font-bold"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">份量 (如 100g)</label>
                        <input
                          type="text"
                          value={manualFood.amount}
                          onChange={(e) => setManualFood({...manualFood, amount: e.target.value})}
                          className="w-full p-5 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 text-base font-bold"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">蛋白质</label>
                        <input
                          type="number"
                          placeholder="克"
                          value={manualFood.protein}
                          onChange={(e) => {
                            const newProtein = e.target.value;
                            setManualFood({
                              ...manualFood, 
                              protein: newProtein,
                              calories: getAutoCalories(newProtein, manualFood.carbs, manualFood.fat).toString()
                            });
                          }}
                          className="w-full p-5 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 text-base font-bold"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">碳水</label>
                        <input
                          type="number"
                          placeholder="克"
                          value={manualFood.carbs}
                          onChange={(e) => {
                            const newCarbs = e.target.value;
                            setManualFood({
                              ...manualFood, 
                              carbs: newCarbs,
                              calories: getAutoCalories(manualFood.protein, newCarbs, manualFood.fat).toString()
                            });
                          }}
                          className="w-full p-5 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 text-base font-bold"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">脂肪</label>
                        <input
                          type="number"
                          placeholder="克"
                          value={manualFood.fat}
                          onChange={(e) => {
                            const newFat = e.target.value;
                            setManualFood({
                              ...manualFood, 
                              fat: newFat,
                              calories: getAutoCalories(manualFood.protein, manualFood.carbs, newFat).toString()
                            });
                          }}
                          className="w-full p-5 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 text-base font-bold"
                        />
                      </div>
                    </div>
                    <motion.button 
                      disabled={!manualFood.name || !manualFood.calories}
                      onClick={() => handleAddFood({
                        name: manualFood.name,
                        calories: Number(manualFood.calories),
                        protein: Number(manualFood.protein) || 0,
                        carbs: Number(manualFood.carbs) || 0,
                        fat: Number(manualFood.fat) || 0,
                        amount: manualFood.amount || '1 份'
                      })}
                      className="w-full bg-gradient-to-r from-emerald-400 to-emerald-500 text-white py-5 rounded-full font-black text-lg shadow-[0_8px_30px_rgba(16,185,129,0.3)] disabled:opacity-50 disabled:grayscale transition-all active:scale-95 touch-manipulation"
                    >
                      添加到记录
                    </motion.button>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Logout Confirmation Modal */}
      <AnimatePresence>
        {isLogoutModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsLogoutModalOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="relative w-full max-w-sm bg-white rounded-[2rem] p-6 shadow-2xl border border-slate-100 text-center"
            >
              <div className="w-16 h-16 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <LogOut size={32} />
              </div>
              <h3 className="text-xl font-black text-slate-900 mb-2">确定要退出登录吗？</h3>
              <p className="text-sm text-slate-500 font-bold mb-8">退出后将无法同步云端数据，但本地数据仍会保留。</p>
              
              <div className="flex gap-3">
                <button 
                  onClick={() => setIsLogoutModalOpen(false)}
                  className="flex-1 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl font-black transition-colors"
                >
                  取消
                </button>
                <button 
                  onClick={() => {
                    handleLogout();
                    setIsLogoutModalOpen(false);
                  }}
                  className="flex-1 py-3.5 bg-rose-500 hover:bg-rose-600 text-white rounded-2xl font-black transition-colors shadow-lg shadow-rose-500/20"
                >
                  确认退出
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Weight Modal */}
      <AnimatePresence>
        {isWeightModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
              onClick={() => setIsWeightModalOpen(false)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="relative w-full max-w-sm bg-white rounded-[2.5rem] p-6 shadow-2xl overflow-hidden"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-black tracking-tight text-slate-900 flex items-center gap-2">
                  <Scale size={24} className="text-violet-500" />
                  记录体重
                </h3>
                <button 
                  onClick={() => setIsWeightModalOpen(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
              
              <div className="space-y-4">
                <div className="relative">
                  <input
                    type="number"
                    step="0.1"
                    value={weightInput}
                    onChange={(e) => setWeightInput(e.target.value)}
                    placeholder="例如: 65.5"
                    className="w-full p-4 pr-12 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-violet-500 font-black text-2xl text-slate-900 placeholder:text-slate-300 transition-colors"
                    autoFocus
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">kg</span>
                </div>
                
                <motion.button
                  onClick={() => {
                    const w = Number(weightInput);
                    if (w > 0) {
                      handleUpdateWeight(w);
                      setIsWeightModalOpen(false);
                    }
                  }}
                  disabled={!weightInput || Number(weightInput) <= 0}
                  className="w-full py-4 bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white rounded-full font-black text-lg shadow-[0_8px_30px_rgba(139,92,246,0.3)] disabled:opacity-50 disabled:grayscale transition-all active:scale-95 touch-manipulation"
                >
                  保存记录
                </motion.button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* AI Chat Modal */}
      <AnimatePresence>
        {isChatOpen && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsChatOpen(false)}
              className="absolute inset-0 bg-slate-900/60"
            />
            <motion.div
              initial={{ y: '100%', opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: '100%', opacity: 0 }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="relative w-full max-w-md bg-white rounded-t-[2.5rem] sm:rounded-[2.5rem] overflow-hidden shadow-2xl flex flex-col h-[80dvh]"
            >
              {/* header */}
              <div className="p-5 border-b border-slate-100 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-emerald-50 text-emerald-500 rounded-lg">
                    <Sparkles size={18} />
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-slate-900 leading-tight">AI 营养教练</h2>
                    <p className="text-[11px] text-slate-400 font-bold">只回答饮食营养相关问题</p>
                  </div>
                </div>
                <button onClick={() => setIsChatOpen(false)} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
                  <X size={22} />
                </button>
              </div>

              {/* messages */}
              <div className="flex-1 overflow-y-auto p-5 space-y-3 custom-scrollbar">
                {chatMessages.length === 0 && (
                  <div className="text-center text-slate-400 mt-8 px-6">
                    <Sparkles size={32} className="mx-auto mb-3 text-emerald-200" />
                    <p className="text-sm font-medium">问我任何饮食、营养、热量相关的问题吧。</p>
                    <p className="text-xs mt-2 text-slate-300">比如："我今天蛋白够吗？""晚上还能吃点什么？"</p>
                  </div>
                )}
                {chatMessages.map((m, i) => (
                  <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${m.role === 'user' ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-700'}`}>
                      {m.content}
                    </div>
                  </div>
                ))}
                {chatLoading && (
                  <div className="flex justify-start">
                    <div className="bg-slate-100 text-slate-400 rounded-2xl px-4 py-2.5 text-sm">正在思考…</div>
                  </div>
                )}
              </div>

              {/* input */}
              <div className="p-4 border-t border-slate-100 shrink-0 flex gap-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSendChat(); }}
                  placeholder="输入你的问题…"
                  className="flex-1 px-4 py-3 bg-slate-50 rounded-2xl outline-none font-medium text-sm focus:bg-slate-100 transition-colors"
                />
                <button
                  onClick={handleSendChat}
                  disabled={chatLoading || !chatInput.trim()}
                  className="px-5 bg-emerald-500 hover:bg-emerald-600 text-white font-black rounded-2xl transition-colors disabled:opacity-40 text-sm"
                >
                  发送
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Settings Modal */}
      <AnimatePresence>
        {isSettingsOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSettingsOpen(false)}
              className="absolute inset-0 bg-slate-900/60"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="relative w-full max-w-md bg-white rounded-[3rem] overflow-hidden shadow-2xl border border-slate-100 flex flex-col max-h-[85dvh]"
            >
              <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-slate-50/50 shrink-0">
                <h2 className="text-3xl font-black tracking-tighter text-slate-900">目标设定</h2>
                <button onClick={() => setIsSettingsOpen(false)} className="p-3 hover:bg-white rounded-2xl transition-all shadow-sm border border-transparent hover:border-slate-100">
                  <X size={24} />
                </button>
              </div>

              <div className="p-8 space-y-8 overflow-y-auto custom-scrollbar">
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1 block">我的目标（影响 AI 教练建议）</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { key: 'gain', label: '增肌' },
                      { key: 'lose', label: '减脂' },
                      { key: 'maintain', label: '维持' },
                    ].map((opt) => (
                      <button
                        key={opt.key}
                        onClick={() => setFitnessGoal(opt.key)}
                        className={`py-3 rounded-2xl font-black transition-colors ${fitnessGoal === opt.key ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1 flex justify-between items-center">
                    <span>每日热量目标 (kcal)</span>
                    <span className="text-emerald-500 bg-emerald-50 px-2 py-0.5 rounded-full normal-case tracking-normal">自动计算</span>
                  </label>
                  <input 
                    type="number"
                    value={goals.calories}
                    readOnly
                    className="w-full p-5 bg-slate-50 border-2 border-slate-100 rounded-[2rem] outline-none font-black text-2xl text-emerald-600 opacity-80 cursor-not-allowed"
                  />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">蛋白质 (g)</label>
                    <input 
                      type="number"
                      value={goals.protein}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        handleUpdateGoals({
                          ...goals, 
                          protein: val,
                          calories: Math.round(val * 4 + goals.carbs * 4 + goals.fat * 9)
                        });
                      }}
                      className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none font-black text-center"
                    />
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">碳水 (g)</label>
                    <input 
                      type="number"
                      value={goals.carbs}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        handleUpdateGoals({
                          ...goals, 
                          carbs: val,
                          calories: Math.round(goals.protein * 4 + val * 4 + goals.fat * 9)
                        });
                      }}
                      className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:ring-4 focus:ring-violet-500/10 focus:border-violet-500 outline-none font-black text-center"
                    />
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">脂肪 (g)</label>
                    <input 
                      type="number"
                      value={goals.fat}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        handleUpdateGoals({
                          ...goals, 
                          fat: val,
                          calories: Math.round(goals.protein * 4 + goals.carbs * 4 + val * 9)
                        });
                      }}
                      className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 outline-none font-black text-center"
                    />
                  </div>
                </div>

                <div className="space-y-3 pt-6 border-t border-slate-100">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1 flex justify-between items-center">
                    <span>AI 识别引擎</span>
                  </label>
                  <p className="text-xs text-slate-400 font-bold mb-2">国内网络无法访问 Gemini，请切换到 DeepSeek。</p>
                  <div className="flex gap-2 mb-2">
                    <button
                      onClick={() => {
                        setAiProvider('gemini');
                        if (typeof window !== 'undefined') localStorage.setItem('ai_provider', 'gemini');
                      }}
                      className={`flex-1 py-3 rounded-xl font-black transition-colors ${aiProvider === 'gemini' ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                    >
                      Gemini
                    </button>
                    <button
                      onClick={() => {
                        setAiProvider('deepseek');
                        if (typeof window !== 'undefined') localStorage.setItem('ai_provider', 'deepseek');
                      }}
                      className={`flex-1 py-3 rounded-xl font-black transition-colors ${aiProvider === 'deepseek' ? 'bg-indigo-500 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                    >
                      DeepSeek（国内）
                    </button>
                  </div>

                  {aiProvider === 'gemini' ? (
                    <>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1 block">自定义 Gemini API Key</label>
                      <p className="text-xs text-slate-400 font-bold mb-2">在浏览器或手机中独立打开此应用时，请配置您的 API Key。</p>
                      <input
                        type="password"
                        placeholder="AIzaSy..."
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none font-bold placeholder:text-slate-300 focus:border-emerald-500"
                      />
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={() => {
                            if (typeof window !== 'undefined') {
                              localStorage.setItem('user_gemini_api_key', apiKey);
                            }
                            setToast({ message: "API Key 已保存", type: "success" });
                          }}
                          className="flex-1 bg-slate-200 text-slate-700 font-black py-3 rounded-xl hover:bg-slate-300 transition-colors"
                        >
                          保存 API Key
                        </button>
                        <button
                          onClick={() => {
                            setApiKey('');
                            if (typeof window !== 'undefined') {
                              localStorage.removeItem('user_gemini_api_key');
                            }
                            setToast({ message: "API Key 已清除", type: "info" });
                          }}
                          className="flex-1 bg-rose-50 text-rose-600 font-black py-3 rounded-xl hover:bg-rose-100 transition-colors"
                        >
                          清除记录
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1 block">DeepSeek API Key</label>
                      <p className="text-xs text-slate-400 font-bold mb-2">在 platform.deepseek.com 申请，格式以 sk- 开头。国内可直连，支持文字与拍照识别。</p>
                      <input
                        type="password"
                        placeholder="sk-..."
                        value={deepseekKey}
                        onChange={(e) => setDeepseekKey(e.target.value)}
                        className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none font-bold placeholder:text-slate-300 focus:border-indigo-500"
                      />
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={() => {
                            if (typeof window !== 'undefined') {
                              localStorage.setItem('user_deepseek_api_key', deepseekKey);
                            }
                            setToast({ message: "DeepSeek Key 已保存", type: "success" });
                          }}
                          className="flex-1 bg-slate-200 text-slate-700 font-black py-3 rounded-xl hover:bg-slate-300 transition-colors"
                        >
                          保存 API Key
                        </button>
                        <button
                          onClick={() => {
                            setDeepseekKey('');
                            if (typeof window !== 'undefined') {
                              localStorage.removeItem('user_deepseek_api_key');
                            }
                            setToast({ message: "DeepSeek Key 已清除", type: "info" });
                          }}
                          className="flex-1 bg-rose-50 text-rose-600 font-black py-3 rounded-xl hover:bg-rose-100 transition-colors"
                        >
                          清除记录
                        </button>
                      </div>
                    </>
                  )}
                </div>

                <motion.button 
                  onClick={() => setIsSettingsOpen(false)}
                  className="w-full bg-gradient-to-r from-slate-800 to-slate-900 text-white py-5 rounded-full font-black text-lg shadow-[0_8px_30px_rgb(0,0,0,0.12)] mt-8 active:scale-95 transition-transform touch-manipulation"
                >
                  保存修改
                </motion.button>
                <p className="text-center text-[11px] text-slate-300 font-bold mt-4">健食 GYMEAT · v1.6</p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Food Library Modal */}
      <AnimatePresence>
        {isLibraryOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsLibraryOpen(false)}
              className="absolute inset-0 bg-slate-900/60"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 30 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 30 }}
              transition={{ 
                type: "spring", 
                damping: 30, 
                stiffness: 300,
                mass: 0.8
              }}
              className="relative w-full max-w-2xl bg-white rounded-[3rem] overflow-hidden shadow-2xl flex flex-col max-h-[90vh] border border-slate-100"
            >
              <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
                <h2 className="text-3xl font-black tracking-tighter text-slate-900">专属食物库</h2>
                <button onClick={() => setIsLibraryOpen(false)} className="p-3 hover:bg-white rounded-2xl transition-all shadow-sm">
                  <X size={24} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-8 space-y-10 custom-scrollbar">
                {/* Add to Library Form */}
                <section className="space-y-6">
                  <div className="flex flex-col gap-4">
                    <h3 className="text-lg font-black tracking-tight text-slate-900 flex items-center gap-2 shrink-0">
                      <Plus size={20} className="text-emerald-500" />
                      新增常用食物 <span className="text-slate-400 text-xs font-bold">(每 100g)</span>
                    </h3>
                    <div className="flex gap-3 w-full">
                      <label className="flex-1 flex items-center justify-center gap-2 py-3 bg-emerald-50 text-emerald-600 rounded-2xl cursor-pointer hover:bg-emerald-100 transition-all text-sm font-black whitespace-nowrap">
                        <ImageIcon size={18} />
                        相册识别
                        <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (file) {
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
                          }
                        }} />
                      </label>
                      <label className="flex-1 flex items-center justify-center gap-2 py-3 bg-emerald-50 text-emerald-600 rounded-2xl cursor-pointer hover:bg-emerald-100 transition-all text-sm font-black whitespace-nowrap">
                        <Camera size={18} />
                        拍照识别
                        <input type="file" accept="image/*" capture="environment" className="hidden" onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (file) {
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
                          }
                        }} />
                      </label>
                    </div>
                  </div>
                  
                  {error && (
                    <div className="p-4 bg-rose-50 text-rose-600 text-sm font-bold rounded-2xl flex items-center gap-3 border border-rose-100">
                      <X size={18} />
                      {error}
                    </div>
                  )}

                  {isEstimating && (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="p-6 bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 rounded-[2rem] flex flex-col items-center justify-center gap-4 text-emerald-600 font-black border border-emerald-100/50 relative overflow-hidden"
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent -translate-x-full animate-[shimmer_2s_infinite]" />
                      <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm relative">
                        <Loader2 size={24} className="animate-spin text-emerald-500" />
                        <div className="absolute inset-0 rounded-full border-2 border-emerald-500/20 animate-ping" />
                      </div>
                      <span className="tracking-widest">AI 正在努力识别中...</span>
                    </motion.div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <input
                      type="text"
                      placeholder="食物名称 (如：乳清蛋白粉)"
                      value={libraryEntry.name}
                      onChange={(e) => setLibraryEntry({...libraryEntry, name: e.target.value})}
                      className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-emerald-500 font-bold sm:col-span-1"
                    />
                    <input
                      type="number"
                      placeholder="热量 (kcal)"
                      value={libraryEntry.calories}
                      onChange={(e) => setLibraryEntry({...libraryEntry, calories: e.target.value})}
                      className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-emerald-500 font-bold"
                    />
                    <div className="relative">
                      <input
                        type="number"
                        placeholder="份量"
                        value={libraryEntry.amount}
                        onChange={(e) => setLibraryEntry({...libraryEntry, amount: e.target.value})}
                        className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-emerald-500 font-bold pr-10"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">g</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <input
                      type="number"
                      placeholder="蛋白(g)"
                      value={libraryEntry.protein}
                      onChange={(e) => {
                        const newProtein = e.target.value;
                        setLibraryEntry({
                          ...libraryEntry, 
                          protein: newProtein,
                          calories: getAutoCalories(newProtein, libraryEntry.carbs, libraryEntry.fat).toString()
                        });
                      }}
                      className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-emerald-500 font-bold text-sm sm:text-base"
                    />
                    <input
                      type="number"
                      placeholder="碳水(g)"
                      value={libraryEntry.carbs}
                      onChange={(e) => {
                        const newCarbs = e.target.value;
                        setLibraryEntry({
                          ...libraryEntry, 
                          carbs: newCarbs,
                          calories: getAutoCalories(libraryEntry.protein, newCarbs, libraryEntry.fat).toString()
                        });
                      }}
                      className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-emerald-500 font-bold text-sm sm:text-base"
                    />
                    <input
                      type="number"
                      placeholder="脂肪(g)"
                      value={libraryEntry.fat}
                      onChange={(e) => {
                        const newFat = e.target.value;
                        setLibraryEntry({
                          ...libraryEntry, 
                          fat: newFat,
                          calories: getAutoCalories(libraryEntry.protein, libraryEntry.carbs, newFat).toString()
                        });
                      }}
                      className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-emerald-500 font-bold"
                    />
                  </div>
                  <motion.button 
                    onClick={handleAddToLibrary}
                    disabled={!libraryEntry.name || !libraryEntry.calories}
                    className="w-full bg-gradient-to-r from-emerald-400 to-emerald-500 text-white py-4 rounded-full font-black text-lg shadow-[0_8px_30px_rgba(16,185,129,0.3)] disabled:opacity-50 disabled:grayscale transition-all active:scale-95 touch-manipulation"
                  >
                    存入库中
                  </motion.button>
                </section>

                {/* Library List */}
                <section className="space-y-6">
                  <h3 className="text-lg font-black tracking-tight text-slate-900 flex items-center gap-2">
                    <History size={20} className="text-emerald-500" />
                    已保存的食物
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {library.length > 0 ? (
                      library.map((food) => (
                        <div key={food.id} className="p-4 sm:p-5 bg-white/60 backdrop-blur-md rounded-[2rem] border border-white/50 flex items-center justify-between group transition-all shadow-[0_4px_15px_rgb(0,0,0,0.02)]">
                          <div className="flex-1 pr-2">
                            <h4 className="font-black text-slate-900 text-sm sm:text-base line-clamp-1">{food.name}</h4>
                            <div className="flex items-center gap-2 mt-1">
                              <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">
                                {food.caloriesPer100g} kcal / 100g
                              </p>
                              {(() => {
                                const s = scoreLibraryFood(food, fitnessGoal);
                                return (
                                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-md ${SCORE_BADGE_STYLES[s.grade]}`} title={s.reason}>
                                    {s.label}
                                  </span>
                                );
                              })()}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button 
                              onClick={() => setEditingLibraryFood(food)}
                              className="p-2 text-slate-300 hover:text-emerald-500 transition-colors active:scale-95"
                            >
                              <Pencil size={18} />
                            </button>
                            <button 
                              onClick={() => handleRemoveLibraryFood(food.id)}
                              className="p-2 text-slate-300 hover:text-rose-500 transition-colors active:scale-95"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="col-span-full py-12 text-center space-y-4 bg-slate-50/50 rounded-[2rem] border-2 border-dashed border-slate-100">
                        <div className="w-16 h-16 bg-white rounded-full mx-auto flex items-center justify-center text-slate-200 shadow-sm">
                          <Leaf size={24} />
                        </div>
                        <div className="space-y-1">
                          <p className="text-slate-900 font-black text-base tracking-tight">食物库空空如也</p>
                          <p className="text-xs text-slate-400 font-bold">将常用食物存入库中，方便快速添加</p>
                        </div>
                      </div>
                    )}
                  </div>
                </section>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Food Modal */}
      <AnimatePresence>
        {editingFood && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setEditingFood(null)}
              className="absolute inset-0 bg-slate-900/60"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="relative w-full max-w-md bg-white rounded-[3rem] p-8 shadow-2xl border border-slate-100 max-h-[85dvh] overflow-y-auto custom-scrollbar"
            >
              <h2 className="text-2xl font-black tracking-tighter text-slate-900 mb-6">修改摄入量</h2>
              <div className="space-y-6">
                <div>
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 block">食物名称</label>
                  <p className="text-lg font-black text-slate-900">{editingFood.name}</p>
                </div>
                <div>
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 block">修改克数 (g)</label>
                  <input
                    type="number"
                    value={editingFood.amountValue || ''}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      // Fallback for baseNutrition if it's missing for some reason
                      const base = editingFood.baseNutrition || {
                        calories: editingFood.calories,
                        protein: editingFood.protein,
                        carbs: editingFood.carbs,
                        fat: editingFood.fat,
                        unit: editingFood.amount.toLowerCase().includes('g') ? 'g' : 'unit'
                      };
                      
                      const currentAmount = editingFood.amountValue || 100;
                      const ratio = base.unit === 'g' ? (val / 100) : (val / currentAmount);
                      
                      setEditingFood({
                        ...editingFood,
                        amountValue: val,
                        amount: `${val}${base.unit === 'g' ? 'g' : ''}`,
                        calories: Math.round(base.calories * ratio),
                        protein: Number((base.protein * ratio).toFixed(1)),
                        carbs: Number((base.carbs * ratio).toFixed(1)),
                        fat: Number((base.fat * ratio).toFixed(1)),
                        baseNutrition: base
                      });
                    }}
                    className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-emerald-500 font-black text-xl"
                  />
                </div>
                <div className="grid grid-cols-4 gap-2 text-center">
                  <div className="p-3 bg-slate-50 rounded-2xl">
                    <p className="text-[10px] font-bold text-slate-400">热量</p>
                    <p className="font-black text-emerald-600">{editingFood.calories}</p>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-2xl">
                    <p className="text-[10px] font-bold text-slate-400">蛋白</p>
                    <p className="font-black text-blue-500">{editingFood.protein}</p>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-2xl">
                    <p className="text-[10px] font-bold text-slate-400">碳水</p>
                    <p className="font-black text-violet-500">{editingFood.carbs}</p>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-2xl">
                    <p className="text-[10px] font-bold text-slate-400">脂肪</p>
                    <p className="font-black text-amber-500">{editingFood.fat}</p>
                  </div>
                </div>
                <motion.button
                  onClick={() => handleUpdateFood(editingFood)}
                  className="w-full py-4 bg-gradient-to-r from-emerald-400 to-emerald-500 text-white rounded-full font-black shadow-[0_8px_30px_rgba(16,185,129,0.3)] active:scale-95 transition-transform touch-manipulation"
                >
                  保存修改
                </motion.button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Library Food Modal */}
      <AnimatePresence>
        {editingLibraryFood && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setEditingLibraryFood(null)}
              className="absolute inset-0 bg-slate-900/60"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-md bg-white rounded-[3rem] p-8 shadow-2xl border border-slate-100"
            >
              <h2 className="text-2xl font-black tracking-tighter text-slate-900 mb-6">修改食物库数据</h2>
              <div className="space-y-4">
                <input
                  type="text"
                  placeholder="食物名称"
                  value={editingLibraryFood.name}
                  onChange={(e) => setEditingLibraryFood({...editingLibraryFood, name: e.target.value})}
                  className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-emerald-500 font-bold"
                />
                <input
                  type="number"
                  placeholder="热量 (每100g)"
                  value={editingLibraryFood.caloriesPer100g}
                  onChange={(e) => setEditingLibraryFood({...editingLibraryFood, caloriesPer100g: Number(e.target.value)})}
                  className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-emerald-500 font-bold"
                />
                <div className="grid grid-cols-3 gap-4">
                  <input
                    type="number"
                    placeholder="蛋白"
                    value={editingLibraryFood.proteinPer100g}
                    onChange={(e) => {
                      const newProtein = Number(e.target.value);
                      setEditingLibraryFood({
                        ...editingLibraryFood, 
                        proteinPer100g: newProtein,
                        caloriesPer100g: getAutoCalories(newProtein, editingLibraryFood.carbsPer100g, editingLibraryFood.fatPer100g)
                      });
                    }}
                    className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-emerald-500 font-bold"
                  />
                  <input
                    type="number"
                    placeholder="碳水"
                    value={editingLibraryFood.carbsPer100g}
                    onChange={(e) => {
                      const newCarbs = Number(e.target.value);
                      setEditingLibraryFood({
                        ...editingLibraryFood, 
                        carbsPer100g: newCarbs,
                        caloriesPer100g: getAutoCalories(editingLibraryFood.proteinPer100g, newCarbs, editingLibraryFood.fatPer100g)
                      });
                    }}
                    className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-emerald-500 font-bold"
                  />
                  <input
                    type="number"
                    placeholder="脂肪"
                    value={editingLibraryFood.fatPer100g}
                    onChange={(e) => {
                      const newFat = Number(e.target.value);
                      setEditingLibraryFood({
                        ...editingLibraryFood, 
                        fatPer100g: newFat,
                        caloriesPer100g: getAutoCalories(editingLibraryFood.proteinPer100g, editingLibraryFood.carbsPer100g, newFat)
                      });
                    }}
                    className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-emerald-500 font-bold"
                  />
                </div>
                <motion.button
                  onClick={() => handleUpdateLibraryFood(editingLibraryFood)}
                  className="w-full py-4 bg-gradient-to-r from-emerald-400 to-emerald-500 text-white rounded-full font-black shadow-[0_8px_30px_rgba(16,185,129,0.3)] mt-4 active:scale-95 transition-transform touch-manipulation"
                >
                  保存修改
                </motion.button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

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

function MacroStat({ label, current, target, color, icon }: { label: string, current: number, target: number, color: string, icon: ReactNode }) {
  const percentage = Math.min((current / target) * 100, 100);
  const diff = current - target;
  
  return (
    <div className="flex items-center justify-between bg-white/60 backdrop-blur-md p-3 sm:p-4 rounded-[1.5rem] border border-white/50 shadow-[0_4px_15px_rgb(0,0,0,0.02)] gap-4">
      <div className="flex items-center gap-2 w-20 shrink-0">
        <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ backgroundColor: `${color}20`, color }}>
          {icon}
        </div>
        <span className="text-xs font-black text-slate-600 whitespace-nowrap">{label}</span>
      </div>

      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          className="h-full rounded-full"
          style={{ backgroundColor: color }}
        />
      </div>

      <div className="flex flex-col items-start shrink-0 w-20 sm:w-24">
        <div className="flex items-baseline gap-0.5">
          <span className="text-sm font-black text-slate-900 tabular-nums"><AnimatedNumber value={current} /></span>
          <span className="text-[10px] text-slate-400 font-bold tabular-nums">/{target}g</span>
        </div>
        <span className={cn("text-[9px] font-bold tracking-wider", diff > 0 ? "text-rose-400" : "text-slate-400")}>
          {diff > 0 ? `超 ${Math.round(diff)}g` : `差 ${Math.round(-diff)}g`}
        </span>
      </div>
    </div>
  );
}

function AnimatedNumber({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  
  useEffect(() => {
    if (!ref.current) return;
    const node = ref.current;
    
    const controls = animate(Number(node.textContent) || 0, value, {
      duration: 0.8,
      ease: "easeOut",
      onUpdate: (v) => {
        node.textContent = Math.round(v).toString();
      }
    });
    
    return controls.stop;
  }, [value]);
  
  return <span ref={ref}>{Math.round(value)}</span>;
}

function MacroBadge({ label, value, color }: { label: string, value: number, color: 'purple' | 'blue' | 'orange' }) {
  const colors = {
    purple: 'bg-purple-50 text-purple-600 border-purple-100',
    blue: 'bg-blue-50 text-blue-600 border-blue-100',
    orange: 'bg-orange-50 text-orange-600 border-orange-100',
  };
  return (
    <div className={cn("p-3 rounded-2xl border-2 text-center transition-all hover:scale-105", colors[color])}>
      <div className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60 mb-1">{label}</div>
      <div className="text-lg font-black tracking-tighter">{value}g</div>
    </div>
  );
}
