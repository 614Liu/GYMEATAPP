import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { format, subDays } from 'date-fns';
import type { FoodItem, LibraryFood, MealType, NewFood } from './types';
import { IS_CN_VERSION } from './constants';
import { clearDailyCaches, pruneDailyCaches } from './lib/storage';
import { backupFileName, buildBackupJson, parseBackup, saveBackupFile } from './lib/backup';
import * as cloud from './lib/cloud';
import type { CloudUser } from './lib/cloud';
import { smoothScroll } from './lib/fx';
import { longestStreak, streak as calcStreak, sumFoods } from './lib/stats';
import { useNutritionData } from './hooks/useNutritionData';
import { useCoach } from './hooks/useCoach';
import { useToast } from './hooks/useToast';
import { SplashScreen } from './components/layout/SplashScreen';
import { BottomNav, type FanAction, type Tab } from './components/layout/BottomNav';
import { PageFrame } from './components/layout/PageFrame';
import { Toast } from './components/ui/Toast';
import { ChatModal } from './components/modals/ChatModal';
import { TodayPage, mealByTime } from './pages/TodayPage';
import { TrendsPage } from './pages/TrendsPage';
import { LibraryPage } from './pages/LibraryPage';
import { MePage } from './pages/MePage';
import { AddFoodPage, type AddMode } from './pages/AddFoodPage';

/** 登录状态迟迟没有结果时，最多等多久就进入应用 */
const SPLASH_MAX_MS = 3500;
const toDateKey = (d: Date) => format(d, 'yyyy-MM-dd');

export default function App() {
  const { toast, show: notify, hide: hideToast } = useToast();

  // ---------- 登录 ----------
  const [user, setUser] = useState<CloudUser | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [splashDone, setSplashDone] = useState(false);
  const [splashTimeout, setSplashTimeout] = useState(false);
  useEffect(() => {
    const unsubscribe = cloud.subscribeAuth((u) => { setUser(u); setIsAuthReady(true); });
    const fallback = setTimeout(() => { setIsAuthReady(true); setSplashTimeout(true); }, SPLASH_MAX_MS);
    return () => { unsubscribe(); clearTimeout(fallback); };
  }, []);
  useEffect(() => { pruneDailyCaches(toDateKey(subDays(new Date(), 7))); }, []);

  // ---------- 日期 ----------
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [todayKey, setTodayKey] = useState(() => toDateKey(new Date()));
  const dateStr = toDateKey(selectedDate);
  // 过了午夜：如果正在看「今天」，自动切到新的一天；手机切回前台时也检查一次
  const todayKeyRef = useRef(todayKey);
  useEffect(() => {
    const check = () => {
      const prev = todayKeyRef.current, now = toDateKey(new Date());
      if (prev === now) return;
      todayKeyRef.current = now; setTodayKey(now);
      setSelectedDate((sel) => (toDateKey(sel) === prev ? new Date() : sel));
    };
    const timer = setInterval(check, 60_000);
    document.addEventListener('visibilitychange', check);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', check); };
  }, []);

  // ---------- 数据 ----------
  const data = useNutritionData({ user, viewDate: dateStr, notify });
  const { goals, library, logs, weightLogs, waterLogs, fitnessGoal } = data;
  const foods = useMemo(() => logs.find((l) => l.date === dateStr)?.foods ?? [], [logs, dateStr]);
  const totals = useMemo(() => sumFoods(foods), [foods]);
  const recentFoods = useMemo(() => foods.slice(0, 15).map((f) => ({ name: f.name, calories: f.calories })), [foods]);
  const waterMl = waterLogs.find((l) => l.date === dateStr)?.amount ?? 0;
  const weight = weightLogs.find((l) => l.date === dateStr)?.weight ?? null;
  const logged = useMemo(() => new Set(logs.filter((l) => l.foods.length).map((l) => l.date)), [logs]);
  const streak = useMemo(() => calcStreak(logged, new Date()), [logged, todayKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const longest = useMemo(() => longestStreak(logged), [logged]);
  const coach = useCoach({ date: dateStr, fitnessGoal, totals, goals, recentFoods });

  // ---------- 界面状态 ----------
  const [tab, setTab] = useState<Tab>('today');
  const scrollRefs = {
    today: useRef<HTMLDivElement>(null), trends: useRef<HTMLDivElement>(null),
    library: useRef<HTMLDivElement>(null), me: useRef<HTMLDivElement>(null),
  };
  const [addMode, setAddMode] = useState<AddMode | null>(null);
  const [addSeq, setAddSeq] = useState(0);
  const [todayPing, setTodayPing] = useState(0);
  const [focusWeight, setFocusWeight] = useState(0);
  const [openReq, setOpenReq] = useState<{ meal: MealType; n: number }>({ meal: 'dinner', n: 0 });
  const [isChatOpen, setIsChatOpen] = useState(false);

  // 按压反馈：所有 .pressable 按下立刻缩一点，松手弹回
  useEffect(() => {
    const down = (e: PointerEvent) => {
      const el = (e.target as Element).closest?.('.pressable'); if (!el) return;
      el.classList.add('is-down');
      const up = () => { el.classList.remove('is-down'); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up); };
      window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
    };
    window.addEventListener('pointerdown', down);
    return () => window.removeEventListener('pointerdown', down);
  }, []);

  // ---------- 操作 ----------
  const addFood = useCallback((food: NewFood, meal: MealType): FoodItem | null => {
    const item = data.addFood(dateStr, food, meal);
    if (item) setTodayPing((n) => n + 1);
    return item;
  }, [data, dateStr]);

  const removeFood = (f: FoodItem) => {
    data.removeFood(dateStr, f.id);
    notify(`删了 ${f.name}`, 'info', { action: { label: '撤销', run: () => data.restoreFood(dateStr, f) } });
  };
  const removeLib = (f: LibraryFood) => {
    data.removeLibraryFood(f.id);
    notify(`删了 ${f.name}`, 'info', { action: { label: '撤销', run: () => data.addLibraryFood(f) } });
  };

  const handleLogin = async () => {
    try { await cloud.signInWithGoogle(); }
    catch (err) { console.error('Login failed:', err); notify('登录失败，请重试', 'error'); }
  };
  const handleLogout = async () => {
    try {
      await cloud.signOut(); clearDailyCaches();
      notify('已退出 · 这台手机的缓存清掉了', 'info');
      return true;
    } catch (err) {
      console.error('Logout failed:', err);
      notify(err instanceof cloud.UnsyncedChangesError ? err.message : '退出登录失败，请重试', 'error');
      return false;
    }
  };

  const goTab = (t: Tab) => { setTab(t); };
  const onFan = (a: FanAction) => {
    if (a === 'library') { setTab('today'); setOpenReq((r) => ({ meal: mealByTime(), n: r.n + 1 })); return; }
    setAddMode(a); setAddSeq((n) => n + 1);
  };
  const closeAdd = useCallback(() => setAddMode(null), []);

  const showSplash = !splashDone;
  return (
    <div className="app">
      <div className="shell">
        <PageFrame active={tab === 'today'} title="今天" scrollRef={scrollRefs.today}>
          <TodayPage active={tab === 'today'} scrollRef={scrollRefs.today} covered={showSplash}
            date={selectedDate} todayKey={todayKey} onDate={setSelectedDate}
            foods={foods} totals={totals} goals={goals} loading={!isAuthReady || data.loading}
            logs={logs} library={library} streak={streak} waterMl={waterMl} weight={weight}
            onAdd={addFood} onUpdate={(f) => data.updateFood(dateStr, f)} onRemove={removeFood}
            onWater={(d) => data.changeWater(dateStr, d)} onOpenChat={() => setIsChatOpen(true)}
            onGoLibrary={() => goTab('library')} onGoWeight={() => { goTab('trends'); setFocusWeight((n) => n + 1); }}
            openReq={openReq} notify={notify} />
        </PageFrame>
        <PageFrame active={tab === 'trends'} title="趋势" scrollRef={scrollRefs.trends}>
          <TrendsPage active={tab === 'trends'} scrollRef={scrollRefs.trends} todayKey={todayKey} logs={logs} weightLogs={weightLogs} goals={goals}
            onSaveWeight={(w) => data.setWeight(todayKey, w)} focusWeight={focusWeight} notify={notify} />
        </PageFrame>
        <PageFrame active={tab === 'library'} title="食物库" scrollRef={scrollRefs.library}>
          <LibraryPage active={tab === 'library'} scrollRef={scrollRefs.library} library={library} fitnessGoal={fitnessGoal} loading={!isAuthReady || data.loading}
            onAddLib={data.addLibraryFood} onUpdateLib={data.updateLibraryFood} onRemoveLib={removeLib}
            onLog={(food, meal) => {
              const ok = !!addFood(food, meal);
              notify(ok ? `记进${{ breakfast: '早餐', lunch: '午餐', dinner: '晚餐', snack: '加餐' }[meal]} · ${food.name} ${food.calories} kcal` : '份量需要大于 0', ok ? 'success' : 'error');
              return ok;
            }} notify={notify} />
        </PageFrame>
        <PageFrame active={tab === 'me'} title="我的" scrollRef={scrollRefs.me}>
          <MePage active={tab === 'me'} scrollRef={scrollRefs.me} user={user} canLogin={!IS_CN_VERSION && isAuthReady}
            todayKey={todayKey} streak={streak} longest={longest} daysLogged={logged.size} weightLogs={weightLogs}
            goals={goals} fitnessGoal={fitnessGoal} onSaveGoals={data.saveGoals} onSaveFitnessGoal={data.saveFitnessGoal}
            onLogin={handleLogin} onLogout={handleLogout}
            onExport={async () => { const now = new Date(); await saveBackupFile(buildBackupJson(await data.exportAll(), now), backupFileName(now)); }}
            onImport={async (file) => data.importBackup(parseBackup(await file.text()))}
            notify={notify} />
        </PageFrame>

        <BottomNav tab={tab} onTab={goTab} onReselect={(t) => { const sc = scrollRefs[t].current; if (sc) smoothScroll(sc, 0); }} onFan={onFan} todayPing={todayPing} />
        <AddFoodPage mode={addMode} openSeq={addSeq} meal={toDateKey(selectedDate) === todayKey ? mealByTime() : 'snack'} fitnessGoal={fitnessGoal}
          onClose={closeAdd} onAdd={(f, m) => { const ok = !!addFood(f, m); if (ok) notify(`记上了 · ${f.name} ${f.calories} kcal`, 'success'); return ok; }}
          onSaveLib={data.addLibraryFood} notify={notify} />
        <Toast toast={toast} onHide={hideToast} />
      </div>

      <ChatModal isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} messages={coach.messages} loading={coach.chatLoading} onSend={coach.send} />
      {showSplash && <SplashScreen ready={(isAuthReady && !data.loading) || splashTimeout} streak={streak} onDone={() => setSplashDone(true)} />}
    </div>
  );
}
