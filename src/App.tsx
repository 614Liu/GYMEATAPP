import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Plus } from 'lucide-react';
import { addDays, format, isBefore, startOfToday, subDays } from 'date-fns';
import type { FoodItem, MealType, NewFood } from './types';
import { IS_CN_VERSION } from './constants';
import { clearDailyCaches, pruneDailyCaches } from './lib/storage';
import { backupFileName, buildBackupJson, parseBackup, saveBackupFile } from './lib/backup';
import * as cloud from './lib/cloud';
import type { CloudUser } from './lib/cloud';
import { useNutritionData } from './hooks/useNutritionData';
import { useCoach } from './hooks/useCoach';
import { useToast } from './hooks/useToast';
import { SplashScreen } from './components/layout/SplashScreen';
import { AppHeader } from './components/layout/AppHeader';
import { DateNav } from './components/layout/DateNav';
import { ViewSwitcher, type ViewTab } from './components/layout/ViewSwitcher';
import { DailySummaryCard } from './components/daily/DailySummaryCard';
import { CoachCard } from './components/daily/CoachCard';
import { WaterCard, WeightCard } from './components/daily/TrackerCards';
import { FoodLogList } from './components/daily/FoodLogList';
import { StatsView } from './components/stats/StatsView';
import { AddFoodModal } from './components/modals/AddFoodModal';
import { LogoutModal } from './components/modals/LogoutModal';
import { WeightModal } from './components/modals/WeightModal';
import { EditFoodModal } from './components/modals/EditFoodModal';
import { EditLibraryFoodModal } from './components/modals/EditLibraryFoodModal';
import { ChatModal } from './components/modals/ChatModal';
import { SettingsModal } from './components/modals/SettingsModal';
import { FoodLibraryModal } from './components/modals/FoodLibraryModal';
import { Toast } from './components/ui/Toast';
import { staggerContainer } from './components/ui/motion';
import type { LibraryFood } from './types';

/** 启动画面至少显示多久，避免一闪而过 */
const SPLASH_MIN_MS = 1000;
/** 登录状态迟迟没有结果时，最多等多久就进入应用 */
const SPLASH_MAX_MS = 3000;

const toDateKey = (d: Date) => format(d, 'yyyy-MM-dd');

export default function App() {
  const { toast, show: notify } = useToast();

  // ---------- 登录 ----------
  const [user, setUser] = useState<CloudUser | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    let splashTimer: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = cloud.subscribeAuth((u) => {
      setUser(u);
      setIsAuthReady(true);
      clearTimeout(splashTimer);
      splashTimer = setTimeout(() => setShowSplash(false), SPLASH_MIN_MS);
    });
    const fallback = setTimeout(() => {
      setIsAuthReady(true);
      setShowSplash(false);
    }, SPLASH_MAX_MS);
    return () => {
      unsubscribe();
      clearTimeout(splashTimer);
      clearTimeout(fallback);
    };
  }, []);

  // 清理 7 天前的按天缓存
  useEffect(() => {
    pruneDailyCaches(toDateKey(subDays(new Date(), 7)));
  }, []);

  // ---------- 日期 ----------
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [todayKey, setTodayKey] = useState(() => toDateKey(new Date()));
  const dateStr = toDateKey(selectedDate);
  const isToday = dateStr === todayKey;

  // 过了午夜：如果正在看「今天」，自动切到新的一天，免得新记录记到前一天。
  // 手机切回前台时也检查一次（后台时定时器可能被暂停）。
  const todayKeyRef = useRef(todayKey);
  useEffect(() => {
    const check = () => {
      const prev = todayKeyRef.current;
      const now = toDateKey(new Date());
      if (prev === now) return;
      todayKeyRef.current = now;
      setTodayKey(now);
      setSelectedDate((sel) => (toDateKey(sel) === prev ? new Date() : sel));
    };
    const timer = setInterval(check, 60_000);
    document.addEventListener('visibilitychange', check);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', check);
    };
  }, []);

  // ---------- 数据 ----------
  const data = useNutritionData({ user, viewDate: dateStr, notify });
  const { goals, library, logs, weightLogs, waterLogs, fitnessGoal } = data;

  const foods = useMemo(() => logs.find((l) => l.date === dateStr)?.foods ?? [], [logs, dateStr]);
  const totals = useMemo(() => foods.reduce((acc, f) => ({
    calories: acc.calories + (f.calories || 0),
    protein: acc.protein + (f.protein || 0),
    carbs: acc.carbs + (f.carbs || 0),
    fat: acc.fat + (f.fat || 0),
  }), { calories: 0, protein: 0, carbs: 0, fat: 0 }), [foods]);
  const recentFoods = useMemo(() => foods.slice(0, 15).map((f) => ({ name: f.name, calories: f.calories })), [foods]);
  const todayWater = waterLogs.find((l) => l.date === dateStr)?.amount ?? 0;
  const todayWeight = weightLogs.find((l) => l.date === dateStr)?.weight ?? null;

  const coach = useCoach({ date: dateStr, fitnessGoal, totals, goals, recentFoods });

  // ---------- 界面状态 ----------
  const [viewTab, setViewTab] = useState<ViewTab>('daily');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [isLogoutOpen, setIsLogoutOpen] = useState(false);
  const [isWeightOpen, setIsWeightOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [weightInput, setWeightInput] = useState('');
  const [editingFood, setEditingFood] = useState<FoodItem | null>(null);
  const [editingLibraryFood, setEditingLibraryFood] = useState<LibraryFood | null>(null);

  // ---------- 操作 ----------
  const handleLogin = async () => {
    try {
      await cloud.signInWithGoogle();
    } catch (err) {
      console.error('Login failed:', err);
      notify('登录失败，请重试', 'error');
    }
  };

  const handleLogout = async () => {
    try {
      await cloud.signOut();
      clearDailyCaches();
      notify('已退出登录，数据保留在云端', 'info');
    } catch (err) {
      console.error('Logout failed:', err);
      notify('退出登录失败，请重试', 'error');
    }
  };

  const saveWeight = (weight: number): boolean => {
    if (!data.setWeight(dateStr, weight)) {
      notify('请输入 0 到 500 之间的体重', 'error');
      return false;
    }
    notify(`体重已更新为 ${weight}kg`, 'success');
    return true;
  };

  const goNextDay = () => {
    const next = addDays(selectedDate, 1);
    if (isBefore(next, startOfToday()) || toDateKey(next) === todayKey) setSelectedDate(next);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-emerald-100 select-none [-webkit-touch-callout:none]">
      <SplashScreen visible={showSplash} />

      <AppHeader
        showAccount={!IS_CN_VERSION && isAuthReady}
        user={user}
        onLogin={handleLogin}
        onLogoutClick={() => setIsLogoutOpen(true)}
        onOpenLibrary={() => setIsLibraryOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      <main className="max-w-2xl mx-auto px-4 py-8 pb-32 space-y-6">
        <DateNav
          selectedDate={selectedDate}
          isToday={isToday}
          onPrev={() => setSelectedDate((d) => subDays(d, 1))}
          onNext={goNextDay}
          onToday={() => setSelectedDate(new Date())}
        />
        <ViewSwitcher value={viewTab} onChange={setViewTab} />

        <AnimatePresence mode="wait">
          {viewTab === 'daily' ? (
            <motion.div key="daily" initial="hidden" animate="visible" exit="hidden" variants={staggerContainer} className="space-y-8">
              <DailySummaryCard totals={totals} goals={goals} />
              <CoachCard
                tip={coach.dailyTip}
                loading={coach.tipLoading}
                onRefresh={coach.refreshTip}
                onOpenChat={() => setIsChatOpen(true)}
              />
              <div className="grid grid-cols-2 gap-4">
                <WaterCard amount={todayWater} onChange={(delta) => data.changeWater(dateStr, delta)} />
                <WeightCard
                  weight={todayWeight}
                  onEdit={() => {
                    setWeightInput(todayWeight ? String(todayWeight) : '');
                    setIsWeightOpen(true);
                  }}
                />
              </div>
              <FoodLogList
                foods={foods}
                fitnessGoal={fitnessGoal}
                onEdit={setEditingFood}
                onRemove={(food) => {
                  data.removeFood(dateStr, food.id);
                  notify('已删除记录', 'info');
                }}
              />
            </motion.div>
          ) : (
            <StatsView logs={logs} weightLogs={weightLogs} onSaveWeight={saveWeight} />
          )}
        </AnimatePresence>
      </main>

      {/* 底部渐隐 + 添加按钮 */}
      <div className="fixed bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-slate-50 to-transparent pointer-events-none z-30" />
      <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-40">
        <motion.button
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5, type: 'spring', stiffness: 200, damping: 20 }}
          style={{ WebkitTapHighlightColor: 'transparent' }}
          onClick={() => setIsAddOpen(true)}
          className="bg-slate-900 text-white px-12 py-5 rounded-[2rem] shadow-2xl shadow-slate-900/30 flex items-center gap-3 font-black tracking-tighter text-lg whitespace-nowrap border border-slate-800 transition-all duration-200 hover:scale-105 active:scale-95 touch-manipulation"
        >
          <Plus size={24} />
          <span>添加食物</span>
        </motion.button>
      </div>

      <AddFoodModal
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        library={library}
        fitnessGoal={fitnessGoal}
        onAddFood={(food: NewFood, meal: MealType) => data.addFood(dateStr, food, meal) !== null}
        onSaveToLibrary={data.addLibraryFood}
        onEditLibraryFood={setEditingLibraryFood}
        onRemoveLibraryFood={(id) => {
          data.removeLibraryFood(id);
          notify('已从食物库删除', 'info');
        }}
        onOpenLibrary={() => setIsLibraryOpen(true)}
        notify={notify}
      />

      <LogoutModal isOpen={isLogoutOpen} onClose={() => setIsLogoutOpen(false)} onConfirm={handleLogout} />

      <WeightModal
        isOpen={isWeightOpen}
        onClose={() => setIsWeightOpen(false)}
        weightInput={weightInput}
        setWeightInput={setWeightInput}
        onSave={saveWeight}
      />

      <ChatModal
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        messages={coach.messages}
        loading={coach.chatLoading}
        onSend={coach.send}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        goals={goals}
        onSaveGoals={data.saveGoals}
        fitnessGoal={fitnessGoal}
        onSaveFitnessGoal={data.saveFitnessGoal}
        onExport={async () => {
          const now = new Date();
          await saveBackupFile(buildBackupJson(await data.exportAll(), now), backupFileName(now));
        }}
        onImport={async (file) => data.importBackup(parseBackup(await file.text()))}
        notify={notify}
      />

      <FoodLibraryModal
        isOpen={isLibraryOpen}
        onClose={() => setIsLibraryOpen(false)}
        library={library}
        fitnessGoal={fitnessGoal}
        onAddToLibrary={data.addLibraryFood}
        onEditFood={setEditingLibraryFood}
        onRemoveFood={(id) => {
          data.removeLibraryFood(id);
          notify('已从食物库删除', 'info');
        }}
        notify={notify}
      />

      <EditFoodModal
        editingFood={editingFood}
        setEditingFood={setEditingFood}
        onSave={(food) => {
          data.updateFood(dateStr, food);
          setEditingFood(null);
        }}
      />

      <EditLibraryFoodModal
        editingLibraryFood={editingLibraryFood}
        setEditingLibraryFood={setEditingLibraryFood}
        onSave={(food) => {
          data.updateLibraryFood(food);
          setEditingLibraryFood(null);
        }}
      />

      <Toast toast={toast} />
    </div>
  );
}
