import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { addDays, format, isAfter, startOfWeek, subDays } from 'date-fns';
import { Coffee, Cookie, Moon, Sun } from 'lucide-react';
import type { DailyLog, FoodItem, LibraryFood, MacroGoals, MealType, NewFood } from '../types';
import { MEAL_LABELS, MEAL_TYPES, WATER_GOAL_ML } from '../constants';
import { RM, like, pulse, smoothScroll } from '../lib/fx';
import { dateKey, recentFoods, type Totals } from '../lib/stats';
import { foodBase, newFoodFromPer100g, rescaleFood, toNewFood } from '../lib/nutrition';
import { Ring } from '../components/ui/Ring';
import { Roll } from '../components/ui/Roll';
import { Stepper } from '../components/ui/Stepper';
import { EmptyArt } from '../components/ui/EmptyArt';
import { FlameIcon } from '../components/layout/SplashScreen';
import '../styles/today.css';

const MACROS = [
  { key: 'protein', name: '蛋白质', a: '#ff8a7a', b: '#f0505a', ink: '#c9323d', track: 'rgba(240,80,90,.16)', glow: 'rgba(240,80,90,.45)' },
  { key: 'carbs', name: '碳水', a: '#ffd36a', b: '#f5a524', ink: '#b26f05', track: 'rgba(245,165,36,.18)', glow: 'rgba(245,165,36,.45)' },
  { key: 'fat', name: '脂肪', a: '#6ee0c8', b: '#16a394', ink: '#0d7f73', track: 'rgba(22,163,148,.16)', glow: 'rgba(22,163,148,.45)' },
] as const;
const MEAL_ICON: Record<MealType, typeof Coffee> = { breakfast: Coffee, lunch: Sun, snack: Cookie, dinner: Moon };
const WEEK = ['日', '一', '二', '三', '四', '五', '六'];
const CHECK = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5L19 7" /></svg>;

/** 按现在几点猜这一笔是哪顿 */
export function mealByTime(d = new Date()): MealType {
  const h = d.getHours();
  return h < 10 ? 'breakfast' : h < 15 ? 'lunch' : h < 17 ? 'snack' : 'dinner';
}

export interface TodayPageProps {
  active: boolean;
  scrollRef: RefObject<HTMLDivElement | null>;
  /** 启动画面还盖着：圆环先别动 */
  covered: boolean;
  date: Date;
  todayKey: string;
  onDate: (d: Date) => void;
  foods: FoodItem[];
  totals: Totals;
  goals: MacroGoals;
  loading: boolean;
  logs: DailyLog[];
  library: LibraryFood[];
  streak: number;
  waterMl: number;
  weight: number | null;
  onAdd: (food: NewFood, meal: MealType) => FoodItem | null;
  onUpdate: (food: FoodItem) => void;
  onRemove: (food: FoodItem) => void;
  onWater: (delta: number) => void;
  onOpenChat: () => void;
  onGoLibrary: () => void;
  onGoWeight: () => void;
  /** 从中间 + 的「收藏库」过来：展开某一顿的常吃 */
  openReq?: { meal: MealType; n: number };
  notify: (msg: string, type?: 'success' | 'error' | 'info', opts?: { action?: { label: string; run: () => void } }) => void;
}

export function TodayPage(p: TodayPageProps) {
  const { scrollRef, totals, goals, foods } = p;
  const dateStr = dateKey(p.date);
  const isToday = dateStr === p.todayKey;
  const heroRef = useRef<HTMLElement>(null);
  const donutRef = useRef<HTMLDivElement>(null);
  const bigRef = useRef<HTMLSpanElement>(null);
  const [inView, setInView] = useState(true);
  const [openMeal, setOpenMeal] = useState<MealType | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  useEffect(() => {
    if (!p.openReq?.n) return;
    setOpenMeal(p.openReq.meal);
    setTimeout(() => {
      const sc = scrollRef.current, el = sc?.querySelector<HTMLElement>(`[data-meal="${p.openReq!.meal}"]`);
      if (sc && el) smoothScroll(sc, Math.max(0, el.offsetTop - sc.clientHeight / 3));
    }, 120);
  }, [p.openReq?.n]); // eslint-disable-line react-hooks/exhaustive-deps

  // 圆环在屏幕上才播变化；不在就先停着，等划回去看见了再从旧值涨上去
  useEffect(() => {
    const el = heroRef.current, root = scrollRef.current;
    if (!el || !root) return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { root, rootMargin: '-90px 0px -120px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [scrollRef]);
  const hold = p.covered || !p.active || !inView;
  const wasHeld = useRef(hold);
  useEffect(() => {
    if (wasHeld.current && !hold && !RM && donutRef.current) {
      donutRef.current.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.05)' }, { transform: 'scale(.98)' }, { transform: 'scale(1)' }], { duration: 520, delay: 120, easing: 'cubic-bezier(.3,1.4,.5,1)' });
    }
    wasHeld.current = hold;
  }, [hold]);

  // 火苗：首页出来时跳一下（#125）
  const flame = useRef<HTMLSpanElement>(null);
  useEffect(() => { if (!p.covered && p.streak > 0) setTimeout(() => pulse(flame.current), 500); }, [p.covered]); // eslint-disable-line react-hooks/exhaustive-deps

  const left = Math.round(goals.calories - totals.calories);
  const byMeal = useMemo(() => {
    const m: Record<MealType, FoodItem[]> = { breakfast: [], lunch: [], dinner: [], snack: [] };
    foods.forEach((f) => m[f.mealType ?? 'snack'].push(f));
    return m;
  }, [foods]);
  const recents = useMemo(() => recentFoods(p.logs, 10), [p.logs]);
  // 教练建议不推今天已经吃过的
  const eatenNames = useMemo(() => new Set(foods.map((f) => f.name)), [foods]);

  /** 记一样：圆环在屏幕上就飞进圆环中心，不在就往上飞走（不把页面拉回顶部） */
  const quickAdd = (food: NewFood, meal: MealType, from: Element | null) => {
    const commit = () => {
      const item = p.onAdd(food, meal);
      if (item) p.notify(`记上了 · ${food.name} ${food.calories} kcal`, 'success');
      else p.notify('份量需要大于 0', 'error');
    };
    setOpenMeal(null);
    const shell = from?.closest('.shell') as HTMLElement | null;
    if (RM || !from || !shell || !donutRef.current) { commit(); return; }
    const sr = shell.getBoundingClientRect(), a = from.getBoundingClientRect(), d = donutRef.current.getBoundingClientRect();
    const ghost = from.cloneNode(true) as HTMLElement;
    Object.assign(ghost.style, { position: 'absolute', zIndex: '60', pointerEvents: 'none', margin: '0', left: `${a.left - sr.left}px`, top: `${a.top - sr.top}px`, width: `${a.width}px`, height: `${a.height}px`, boxShadow: '0 10px 24px rgba(0,0,0,.25)' });
    shell.appendChild(ghost);
    const dx = d.left + d.width / 2 - a.left - a.width / 2, dy = d.top + d.height / 2 - a.top - a.height / 2;
    const anim = inView
      ? ghost.animate([
        { transform: 'translate(0,0) scale(1) rotate(0deg)', borderRadius: '14px', opacity: 1 },
        { transform: `translate(${dx * .55}px, ${dy * .55 - 60}px) scale(1.15) rotate(-8deg)`, borderRadius: '50%', opacity: 1, offset: .5 },
        { transform: `translate(${dx}px, ${dy}px) scale(.15) rotate(10deg)`, borderRadius: '50%', opacity: 0 },
      ], { duration: 720, easing: 'cubic-bezier(.45,0,.2,1)', fill: 'forwards' })
      : ghost.animate([
        { transform: 'translate(0,0) scale(1)', opacity: 1, borderRadius: '14px' },
        { transform: `translate(${dx * .3}px, ${-(a.top - sr.top) - 40}px) scale(.35)`, opacity: 0, borderRadius: '50%' },
      ], { duration: 560, easing: 'cubic-bezier(.5,0,.2,1)', fill: 'forwards' });
    anim.onfinish = () => { ghost.remove(); commit(); };
  };

  return (
    <div className="stack">
      <Header streak={p.streak} flameRef={flame} />
      <WeekStrip date={p.date} todayKey={p.todayKey} logs={p.logs} onDate={p.onDate} />

      <section ref={heroRef} className="hero">
        <div ref={donutRef} className="donut" style={{ width: 264 }}>
          <Ring size={264} r={112} w={22} value={totals.calories} max={goals.calories || 1} hold={hold}
            track="#e7ecea" from="#a7f3d0" to="#059669" overColors={['#ffb4a8', '#e5484d']} shadow="0 2px 3px rgba(5,80,60,.35)"
            onFrame={(v) => { const l = Math.round(goals.calories - Math.max(0, v)); if (bigRef.current) bigRef.current.textContent = String(Math.abs(l)); }}>
            <div className="disc">
              <span ref={bigRef} className="big">{Math.abs(left)}</span>
              <span className="lab">{left >= 0 ? '还能吃 · kcal' : '多吃了 · kcal'}</span>
            </div>
          </Ring>
        </div>
        <div className="eaten">已吃 <b>{Math.round(totals.calories)}</b> / 目标 <b>{goals.calories}</b> kcal</div>
        <div className="macros">
          {MACROS.map((m) => {
            const v = totals[m.key], max = goals[m.key] || 1, full = v >= max - .5;
            return (
              <div key={m.key} className="mc">
                <Ring size={84} r={34} w={10} value={v} max={max} hold={hold} track={m.track} from={m.a} to={m.b} shadow={`0 1px 2px ${m.glow}`}>
                  <b><Roll value={String(Math.round(v))} /></b>
                </Ring>
                <div className="n" style={{ color: m.ink }}>{m.name}{full && <i style={{ background: m.b }}>{CHECK}</i>}</div>
                <div className="g">目标 {goals[m.key]} g</div>
              </div>
            );
          })}
        </div>
      </section>

      <CoachCard isToday={isToday} totals={totals} goals={goals} hasFood={foods.length > 0} library={p.library} recents={recents.filter((f) => !eatenNames.has(f.name))}
        onAsk={p.onOpenChat} onPick={(food, el) => quickAdd(food, isToday ? mealByTime() : 'snack', el)} />

      <Tasks totals={totals} goals={goals} waterMl={p.waterMl} weight={p.weight} byMeal={byMeal} isToday={isToday}
        onProtein={() => { const sc = scrollRef.current, c = sc?.querySelector<HTMLElement>('.coach'); if (sc && c) smoothScroll(sc, c.offsetTop - 80); }}
        onWater={() => { p.onWater(250); p.notify('喝了一杯 · +250 ml', 'success', { action: { label: '撤销', run: () => p.onWater(-250) } }); }}
        onMeals={() => { const miss = (['breakfast', 'lunch', 'dinner'] as MealType[]).find((k) => !byMeal[k].length); setOpenMeal(miss ?? mealByTime()); }}
        onWeight={p.onGoWeight}
        notify={p.notify} />

      <section className="card">
        <div className="card-h">{isToday ? '今天吃的' : `${format(p.date, 'M月d日')}吃的`}<span>{foods.length} 样</span></div>
        {p.loading ? <MealSkeleton /> : MEAL_TYPES.map((k) => {
          const Icon = MEAL_ICON[k], items = byMeal[k], sum = Math.round(items.reduce((a, f) => a + f.calories, 0)), open = openMeal === k;
          return (
            <div key={k} className="meal-g" data-meal={k}>
              <div className="meal-h"><Icon />{MEAL_LABELS[k]}<span className="sum">{items.length ? `${sum} kcal` : ''}</span>
                <button type="button" className={`add ${open ? 'open' : ''}`} aria-label={`给${MEAL_LABELS[k]}记一笔`} aria-expanded={open} onClick={() => setOpenMeal(open ? null : k)}>+</button>
              </div>
              <div className={`inl ${open ? 'open' : ''}`}><div>
                <div className="qrow">
                  {recents.map((f) => (
                    <button key={f.id} type="button" className="qc pressable" onClick={(e) => quickAdd(toNewFood(f), k, e.currentTarget.querySelector('.pic'))}>
                      <span className="pic">{f.name.slice(0, 1)}</span><span><b>{f.name}</b><small>{Math.round(f.calories)} kcal</small></span>
                    </button>
                  ))}
                  <button type="button" className="qc more pressable" onClick={() => { setOpenMeal(null); p.onGoLibrary(); }}><span><b>从食物库选 ›</b></span></button>
                </div>
                {!recents.length && <p style={{ fontSize: 12.5, color: 'var(--faint)', padding: '4px 4px 0' }}>记过的东西会出现在这里，点一下就能再记一次</p>}
              </div></div>
              {items.length ? items.map((f) => (
                <FoodRow key={f.id} food={f} open={editId === f.id} onToggle={() => setEditId(editId === f.id ? null : f.id)}
                  onUpdate={p.onUpdate} onRemove={() => { setEditId(null); p.onRemove(f); }} />
              )) : (
                <div className="empty-meal">
                  <EmptyArt kind="bowl" size={48} />
                  <div><b>{MEAL_LABELS[k]}还没记</b><small>{k === 'snack' ? '饿了就吃点水果或酸奶' : `建议不超过 ${Math.round(goals.calories * (k === 'breakfast' ? .25 : .35))} kcal`}</small></div>
                  <button type="button" className="pressable" onClick={() => setOpenMeal(k)}>记一笔</button>
                </div>
              )}
            </div>
          );
        })}
      </section>
    </div>
  );
}

/* ---------------- 品牌头 ---------------- */
function Header({ streak, flameRef }: { streak: number; flameRef: RefObject<HTMLSpanElement | null> }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div className="brand"><span className="logo"><FlameIcon /></span><span><b>健食</b><small>BY 614</small></span></div>
      <div className="streak" aria-label={`连续 ${streak} 天`}><span ref={flameRef} style={{ display: 'grid' }}><FlameIcon size={16} /></span>连续 <b>{streak}</b> 天</div>
    </div>
  );
}

/* ---------------- 一周日期条：黑色胶囊滑过去；左右滑换一周 ---------------- */
function WeekStrip({ date, todayKey, logs, onDate }: { date: Date; todayKey: string; logs: DailyLog[]; onDate: (d: Date) => void }) {
  const weekStart = startOfWeek(date, { weekStartsOn: 1 });
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const logged = useMemo(() => new Set(logs.filter((l) => l.foods.length).map((l) => l.date)), [logs]);
  const wrap = useRef<HTMLDivElement>(null);
  const pill = useRef<HTMLSpanElement>(null);
  const dk = dateKey(date);
  const today = new Date();
  const isToday = dk === todayKey;

  useEffect(() => {
    const w = wrap.current, pl = pill.current; if (!w || !pl) return;
    const btn = w.querySelector<HTMLElement>('.day.on'); if (!btn) return;
    pl.style.width = `${btn.offsetWidth}px`;
    pl.style.transform = `translateX(${btn.offsetLeft}px)`;
  }, [dk]);

  // 左右滑：上一周 / 下一周（不超过本周）
  const x0 = useRef<number | null>(null);
  const swipe = (dx: number) => {
    if (Math.abs(dx) < 50) return;
    const next = dx > 0 ? subDays(date, 7) : addDays(date, 7);
    onDate(isAfter(next, today) ? today : next);
  };

  return (
    <div>
      <div className="week-h">
        <span>{format(date, 'M月d日')} 周{WEEK[date.getDay()]}{isToday ? ' · 今天' : ''}</span>
        {!isToday && <button type="button" className="pressable" onClick={() => onDate(new Date())}>回到今天</button>}
      </div>
      <div className="week-wrap" onPointerDown={(e) => (x0.current = e.clientX)} onPointerUp={(e) => { if (x0.current != null) swipe(e.clientX - x0.current); x0.current = null; }}>
        <div ref={wrap} className="week">
          <span ref={pill} className="day-pill" />
          {days.map((d) => {
            const k = dateKey(d), future = k > todayKey;
            return (
              <button key={k} type="button" className={`day ${k === dk ? 'on' : ''} ${future ? 'future' : ''}`} disabled={future}
                aria-label={format(d, 'M月d日')} aria-pressed={k === dk} onClick={() => onDate(d)}>
                {k === todayKey ? '今天' : WEEK[d.getDay()]}<b>{d.getDate()}</b><i className={logged.has(k) ? '' : 'no'} />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ---------------- AI 教练卡（先用本地规则算；AI 重做后换成真的分析） ---------------- */
function CoachCard({ isToday, totals, goals, hasFood, library, recents, onAsk, onPick }: {
  isToday: boolean; totals: Totals; goals: MacroGoals; hasFood: boolean; library: LibraryFood[]; recents: FoodItem[];
  onAsk: () => void; onPick: (food: NewFood, el: Element | null) => void;
}) {
  const left = Math.round(goals.calories - totals.calories);
  const lack = Math.max(0, Math.round(goals.protein - totals.protein));
  let head: React.ReactNode, why: string;
  if (!hasFood) { head = isToday ? '今天还没记' : '那天没有记录'; why = isToday ? '先记一样，教练会跟着你今天的情况给建议。' : '这一天没有饮食记录。'; }
  else if (left < 0) { head = `多吃了 ${-left} kcal`; why = '没关系，明天清淡一点、多走走就回来了。'; }
  else if (lack > 0) { head = <>再补 <em>{lack} g</em> 蛋白质</>; why = `还剩 ${left} kcal，选高蛋白、低油的，正好吃满不超。`; }
  else { head = '蛋白质够了'; why = `还剩 ${left} kcal，清淡收尾就是完美的一天。`; }

  // 两条建议：只推还装得下、能补蛋白的（先看食物库每 100 g，再看最近吃过的）
  const picks = useMemo(() => {
    if (!isToday || lack <= 0 || left <= 0) return [];
    const fromLib = library.filter((f) => f.caloriesPer100g > 0 && f.proteinPer100g / f.caloriesPer100g >= .08 && f.caloriesPer100g <= left)
      .sort((a, b) => b.proteinPer100g / b.caloriesPer100g - a.proteinPer100g / a.caloriesPer100g)
      .map((f) => newFoodFromPer100g(f, 100));
    const fromRecent = recents.filter((f) => f.calories > 0 && f.protein / f.calories >= .06 && f.calories <= left).map(toNewFood);
    const seen = new Set<string>();
    return [...fromLib, ...fromRecent].filter((f) => (seen.has(f.name) ? false : (seen.add(f.name), true))).slice(0, 2);
  }, [isToday, lack, left, library, recents]);

  return (
    <section className="coach">
      <div className="hd">
        <span className="label"><span className="dot" /><b>AI 教练</b>· {isToday ? '实时分析' : '回顾'}</span>
        <button type="button" className="ask pressable" onClick={onAsk}>问教练<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M9 6l6 6-6 6" /></svg></button>
      </div>
      <div className="head">{head}</div>
      <div className="why">{why}</div>
      {hasFood && lack > 0 && (
        <div className="gap">
          <div className="row"><span>蛋白质</span><span><b>{Math.round(totals.protein * 10) / 10}</b> / {goals.protein} g</span></div>
          <div className="track"><i style={{ width: `${Math.min(100, totals.protein / (goals.protein || 1) * 100)}%` }} /></div>
        </div>
      )}
      {picks.length > 0 && (
        <div className="picks">
          {picks.map((f) => (
            <button key={f.name} type="button" className="pick pressable" onClick={(e) => onPick(f, e.currentTarget.querySelector('.pic'))}>
              <span className="pic">{f.name.slice(0, 1)}</span>
              <span><b>{f.name}</b><small>+{f.protein}g 蛋白 · {f.calories}</small></span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

/* ---------------- 今日任务 2×2 ---------------- */
function Tasks({ totals, goals, waterMl, weight, byMeal, isToday, onProtein, onWater, onMeals, onWeight, notify }: {
  totals: Totals; goals: MacroGoals; waterMl: number; weight: number | null; byMeal: Record<MealType, FoodItem[]>; isToday: boolean;
  onProtein: () => void; onWater: () => void; onMeals: () => void; onWeight: () => void;
  notify: TodayPageProps['notify'];
}) {
  const cupsMax = Math.round(WATER_GOAL_ML / 250);
  const mealsDone = (['breakfast', 'lunch', 'dinner'] as MealType[]).filter((k) => byMeal[k].length).length;
  const list = [
    { key: 'protein', name: '蛋白质吃够', v: totals.protein, max: goals.protein || 1, shown: (Math.round(totals.protein * 10) / 10).toString(), unit: ` / ${goals.protein} g`, go: onProtein },
    { key: 'water', name: `喝够 ${cupsMax} 杯水`, v: Math.round(waterMl / 250), max: cupsMax, shown: String(Math.round(waterMl / 250)), unit: ` / ${cupsMax} 杯`, go: onWater },
    { key: 'meals', name: '三餐都记上', v: mealsDone, max: 3, shown: String(mealsDone), unit: ' / 3', go: onMeals },
    { key: 'weight', name: '称一次体重', v: weight ? 1 : 0, max: 1, shown: weight ? `${weight} kg` : '—', unit: '', go: onWeight },
  ];
  const done = list.filter((t) => t.v >= t.max).length;
  const prev = useRef<Record<string, boolean> | null>(null);
  const marks = useRef<Record<string, HTMLSpanElement | null>>({});
  useEffect(() => {
    const now = Object.fromEntries(list.map((t) => [t.key, t.v >= t.max]));
    if (prev.current && isToday) {
      list.forEach((t) => {
        if (now[t.key] && !prev.current![t.key]) { like(marks.current[t.key]); notify(`${t.name} · 完成`, 'success'); }
      });
    }
    prev.current = now;
  }); // 每次渲染都比一下：刚刚从没完成变成完成的那一格点赞一下

  return (
    <section className="card">
      <div className="card-h">{isToday ? '今日任务' : '那天的任务'}<span>完成 {done}/4</span></div>
      <div className="tgrid">
        {list.map((t) => {
          const ok = t.v >= t.max;
          return (
            <button key={t.key} type="button" className={`tile pressable ${ok ? 'done' : ''}`} onClick={t.go}>
              <div className="n">{t.name}</div>
              <div className="v">{t.shown}<em>{t.unit}</em></div>
              <div className={`bar ${ok ? 'green' : ''}`}><i style={{ width: `${Math.min(100, t.v / t.max * 100)}%` }} /></div>
              <span ref={(el) => { marks.current[t.key] = el; }} className="mark">{ok ? CHECK : '+'}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

/* ---------------- 吃过的一样：点开原地改份量 / 删除 ---------------- */
function FoodRow({ food, open, onToggle, onUpdate, onRemove }: { food: FoodItem; open: boolean; onToggle: () => void; onUpdate: (f: FoodItem) => void; onRemove: () => void }) {
  const { isGram, unitLabel } = foodBase(food);
  const [draft, setDraft] = useState(food.amountValue || (isGram ? 100 : 1));
  const [shown, setShown] = useState(food);
  useEffect(() => { setDraft(food.amountValue || (isGram ? 100 : 1)); setShown(food); }, [food, isGram]);
  // 停手 0.6 s 才写进记录（按住加速时不会每一步都存一次）
  useEffect(() => {
    if (draft === (food.amountValue || 0) || draft <= 0) return;
    const next = rescaleFood(food, draft);
    setShown(next);
    const t = setTimeout(() => onUpdate(next), 600);
    return () => clearTimeout(t);
  }, [draft]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="mfood">
      <button type="button" className="row1" onClick={onToggle} aria-expanded={open}>
        <span className="pic">{food.name.slice(0, 1)}</span>
        <span className="n">{food.name}<small>{shown.amount}</small></span>
        <span className="k"><Roll value={String(Math.round(shown.calories))} /></span>
      </button>
      <div className={`inl ${open ? 'open' : ''}`}><div>
        <div className="fedit">
          <Stepper value={draft} onChange={setDraft} step={isGram ? 10 : .5} min={isGram ? 10 : .5} max={isGram ? 2000 : 20}
            decimals={isGram ? 0 : 1} unit={isGram ? 'g' : unitLabel} label="份量" showTotal />
          <button type="button" className="del pressable" onClick={onRemove}>删除</button>
        </div>
      </div></div>
    </div>
  );
}

function MealSkeleton() {
  return (
    <div aria-busy>
      {[0, 1, 2].map((i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: '52px 1fr 48px', gap: 14, alignItems: 'center', marginTop: 14 }}>
          <i className="sk" style={{ height: 52 }} /><i className="sk" style={{ height: 14, width: '70%' }} /><i className="sk" style={{ height: 18 }} />
        </div>
      ))}
    </div>
  );
}
