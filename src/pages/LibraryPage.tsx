import { useEffect, useMemo, useRef, useState, type ChangeEvent, type RefObject } from 'react';
import type { LibraryFood, MealType, NewFood } from '../types';
import { MEAL_LABELS, MEAL_TYPES } from '../constants';
import { RM, elasticIn, like, shake, shrinkOut } from '../lib/fx';
import { scoreLibraryFood } from '../lib/foodScore';
import { getAutoCalories, newFoodFromPer100g, newId } from '../lib/nutrition';
import { compressImage } from '../lib/image';
import { estimateLibraryNutrition, parseAiError } from '../lib/gemini';
import { Segmented } from '../components/ui/Segmented';
import { Roll } from '../components/ui/Roll';
import { Stepper } from '../components/ui/Stepper';
import { LoadingButton } from '../components/ui/LoadingButton';
import { EmptyArt } from '../components/ui/EmptyArt';
import { mealByTime } from './TodayPage';
import '../styles/library.css';

type Filter = 'all' | 'protein' | 'light' | 'rec';
type Mode = null | 'scan' | 'form';
interface Draft { name: string; amount: string; p: string; c: string; f: string }
const EMPTY: Draft = { name: '', amount: '100', p: '', c: '', f: '' };
const round1 = (n: number) => Math.round(n * 10) / 10;
const num = (s: string) => (s.trim() === '' ? 0 : Number(s));
const badNum = (s: string, positive = false) => s.trim() !== '' && (!Number.isFinite(Number(s)) || Number(s) < 0 || (positive && Number(s) <= 0));

export interface LibraryPageProps {
  active: boolean;
  scrollRef: RefObject<HTMLDivElement | null>;
  library: LibraryFood[];
  fitnessGoal: string;
  loading: boolean;
  onAddLib: (f: LibraryFood) => void;
  onUpdateLib: (f: LibraryFood) => void;
  onRemoveLib: (f: LibraryFood) => void;
  onLog: (food: NewFood, meal: MealType) => boolean;
  notify: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export function LibraryPage(p: LibraryPageProps) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [mode, setMode] = useState<Mode>(null);
  const [way, setWay] = useState<'scan' | 'album' | 'manual' | null>(null);
  const [editing, setEditing] = useState<LibraryFood | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [scanImg, setScanImg] = useState<string | null>(null);
  const [scanMsg, setScanMsg] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const [fresh, setFresh] = useState<string | null>(null);
  const [swiped, setSwiped] = useState<string | null>(null);
  const camRef = useRef<HTMLInputElement>(null), albRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  const q = query.trim();
  const shown = useMemo(() => p.library.filter((f) => {
    const g = scoreLibraryFood(f, p.fitnessGoal).grade, dens = f.caloriesPer100g ? f.proteinPer100g / f.caloriesPer100g * 100 : 0;
    if (filter === 'protein' && dens < 8) return false;
    if (filter === 'light' && f.caloriesPer100g > 150) return false;
    if (filter === 'rec' && !(g === 'great' || g === 'good')) return false;
    return !q || f.name.toLowerCase().includes(q.toLowerCase());
  }), [p.library, p.fitnessGoal, filter, q]);

  const startManual = (name = '') => {
    setEditing(null); setDraft({ ...EMPTY, name }); setMode('form'); setWay('manual');
    setTimeout(() => nameRef.current?.focus({ preventScroll: true }), 320);
  };
  const close = () => { setMode(null); setWay(null); setEditing(null); setScanImg(null); };

  // 拍营养表 / 从相册：照片上扫一道绿光，识别出来以后数字一点点跑进表单
  const onPhoto = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; e.target.value = '';
    if (!file) { setWay(null); return; }
    setEditing(null); setDraft(EMPTY); setMode('scan'); setScanMsg('正在读营养成分表…');
    try {
      const img = await compressImage(file);
      setScanImg(img);
      const r = await estimateLibraryNutrition('请识别营养表并返回每100g的数值', img);
      if (!r.isFood) { p.notify(r.reason || '没认出营养表，换一张试试', 'error'); close(); return; }
      setScanMsg('读好了');
      setTimeout(() => {
        setMode('form');
        countIn({ name: r.name || '未命名食物', amount: '100', p: r.protein || 0, c: r.carbs || 0, f: r.fat || 0 });
        p.notify('读好了 · 看一眼没问题就存', 'success');
      }, RM ? 0 : 450);
    } catch (err) {
      p.notify(parseAiError(err), 'error'); close();
    }
  };
  const countIn = (v: { name: string; amount: string; p: number; c: number; f: number }) => {
    if (RM) { setDraft({ name: v.name, amount: v.amount, p: String(round1(v.p)), c: String(round1(v.c)), f: String(round1(v.f)) }); return; }
    const t0 = performance.now();
    const tick = (now: number) => {
      const k = Math.min(1, (now - t0) / 700), e = 1 - Math.pow(1 - k, 3);
      setDraft({ name: v.name, amount: v.amount, p: String(round1(v.p * e)), c: String(round1(v.c * e)), f: String(round1(v.f * e)) });
      if (k < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };

  const startEdit = (f: LibraryFood) => {
    setSwiped(null); setEditing(f); setWay(null); setMode('form');
    setDraft({ name: f.name, amount: '100', p: String(f.proteinPer100g), c: String(f.carbsPer100g), f: String(f.fatPer100g) });
    p.scrollRef.current?.scrollTo({ top: 0, behavior: RM ? 'auto' : 'smooth' });
  };

  const formRef = useRef<HTMLDivElement>(null);
  const save = () => {
    const name = draft.name.trim(), amt = num(draft.amount) || 100;
    const kcal = getAutoCalories(draft.p, draft.c, draft.f);
    if (!name || name.length > 20) { shake(formRef.current?.querySelector('.fin.fl') ?? null); p.notify(!name ? '先起个名字' : '名字太长了', 'error'); return false; }
    if ([draft.p, draft.c, draft.f].some((s) => badNum(s)) || badNum(draft.amount, true)) { p.notify('有一格不是数字', 'error'); return false; }
    if (!kcal) { shake(formRef.current?.querySelector('.fm') ?? null); p.notify('至少填一样营养素', 'error'); return false; }
    const r = 100 / amt, P = round1(num(draft.p) * r), C = round1(num(draft.c) * r), F = round1(num(draft.f) * r);
    const food: LibraryFood = {
      id: editing?.id ?? newId(), name, proteinPer100g: P, carbsPer100g: C, fatPer100g: F,
      caloriesPer100g: getAutoCalories(P, C, F), createdAt: editing?.createdAt ?? Date.now(),
    };
    setTimeout(() => {
      if (editing) { p.onUpdateLib(food); p.notify(`改好了 · ${name}`, 'success'); }
      else { p.onAddLib(food); p.notify(`存进库了 · ${name}`, 'success'); }
      setFresh(food.id); setQuery(''); close();
    }, RM ? 0 : 250);
    return true;
  };

  return (
    <div className="stack">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', paddingTop: 6 }}>
        <h1 className="ptitle">食物库</h1>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--sub)' }}><b className="num" style={{ fontSize: 17, color: 'var(--ink)' }}><Roll value={String(p.library.length)} /></b> 样</span>
      </div>

      <div>
        <label className={`search ${query ? 'has' : ''}`}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></svg>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜一下，比如 鸡胸" autoComplete="off" aria-label="搜索食物库" />
          <button type="button" className="clr" aria-label="清空" onClick={(e) => { e.preventDefault(); setQuery(''); }}>×</button>
        </label>
        <Segmented className="chips" options={[{ key: 'all', label: '全部' }, { key: 'protein', label: '高蛋白' }, { key: 'light', label: '低热量' }, { key: 'rec', label: '推荐' }]}
          value={filter} onChange={setFilter} label="筛选" />
      </div>

      <section className="addc">
        <div className="addh"><b>{editing ? `改 · ${editing.name}` : '存一样新食物'}</b><small>{editing ? '下面是每 100 g 的数' : '按包装上写的填，会自动换成每 100 g'}</small></div>
        {!editing && (
          <div className="ways">
            <button type="button" className={`main pressable ${way === 'scan' ? 'cur' : ''}`} onClick={() => { setWay('scan'); camRef.current?.click(); }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></svg>拍营养表</button>
            <button type="button" className={`pressable ${way === 'album' ? 'cur' : ''}`} onClick={() => { setWay('album'); albRef.current?.click(); }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="5" width="16" height="14" rx="3" /><circle cx="9" cy="10" r="1.6" /><path d="M20 16l-5-5-8 8" /></svg>从相册</button>
            <button type="button" className={`pressable ${way === 'manual' ? 'cur' : ''}`} onClick={() => startManual()}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 20h4L19 9l-4-4L4 16z" /></svg>手动填</button>
            <input ref={camRef} type="file" accept="image/*" capture="environment" hidden onChange={onPhoto} />
            <input ref={albRef} type="file" accept="image/*" hidden onChange={onPhoto} />
          </div>
        )}
        <div className={`inl ${mode ? 'open' : ''}`}><div>
          {mode === 'scan' && (
            <div className="scan run loop">
              <i className="cn a" /><i className="cn b" /><i className="cn c" /><i className="cn d" />
              <div className="photo">{scanImg ? <img src={scanImg} alt="要识别的照片" /> : <span className="sk" style={{ height: 160, width: '100%' }} />}</div>
              <i className="line" />
              <div className="st">{scanMsg}</div>
            </div>
          )}
          {mode === 'form' && <LibForm ref_={formRef} nameRef={nameRef} draft={draft} setDraft={setDraft} editing={!!editing} onCancel={close} onSave={save} />}
        </div></div>
      </section>

      <section>
        <div className="lh"><b>已存的</b><span>点一样就能记 · 往左滑改</span></div>
        {p.loading ? <ListSkeleton /> : shown.length ? (
          <div className="list">
            {shown.map((f) => (
              <LibRow key={f.id} food={f} q={q} fitnessGoal={p.fitnessGoal} open={open === f.id} fresh={fresh === f.id}
                swiped={swiped === f.id} onSwipe={(on) => setSwiped(on ? f.id : null)}
                onToggle={() => { if (swiped) { setSwiped(null); return; } setOpen(open === f.id ? null : f.id); }}
                onEdit={() => startEdit(f)} onDelete={() => { setSwiped(null); if (open === f.id) setOpen(null); p.onRemoveLib(f); }}
                onLog={(food, meal) => { const ok = p.onLog(food, meal); if (ok) setOpen(null); return ok; }} />
            ))}
          </div>
        ) : (
          <div className="lempty">
            <EmptyArt kind={q ? 'search' : 'bowl'} />
            <b>{q ? `没找到「${q}」` : p.library.length ? '这一类还没有' : '库里还是空的'}</b>
            <small>{q ? '库里还没有，可以现在存一个' : '常吃的东西存进来，以后点一下就能记'}</small>
            {(q || !p.library.length) && <button type="button" className="pressable" onClick={() => { startManual(q); p.scrollRef.current?.scrollTo({ top: 0, behavior: RM ? 'auto' : 'smooth' }); }}>{q ? '存成新食物' : '存第一样'}</button>}
          </div>
        )}
      </section>
    </div>
  );
}

/* ---------------- 新增 / 编辑表单（#158 浮动标签、#159 实时校验） ---------------- */
function LibForm({ ref_, nameRef, draft, setDraft, editing, onCancel, onSave }: {
  ref_: RefObject<HTMLDivElement | null>; nameRef: RefObject<HTMLInputElement | null>; draft: Draft; setDraft: (d: Draft) => void; editing: boolean;
  onCancel: () => void; onSave: () => boolean;
}) {
  const [focus, setFocus] = useState(false);
  const name = draft.name.trim(), ok = name.length >= 1 && name.length <= 20, tooLong = name.length > 20;
  const vck = useRef<HTMLSpanElement>(null), wasOk = useRef(false);
  useEffect(() => { if (ok !== wasOk.current) { if (ok) elasticIn(vck.current); else shrinkOut(vck.current); wasOk.current = ok; } }, [ok]);
  const P = num(draft.p) || 0, C = num(draft.c) || 0, F = num(draft.f) || 0, tot = P * 4 + C * 4 + F * 9;
  const kcal = Number.isFinite(tot) ? Math.round(tot) : 0;
  const pct = (x: number) => (tot ? Math.round(x / tot * 100) : 0);
  const cell = (key: 'p' | 'c' | 'f', label: string) => (
    <label className={`mcell ${key} ${badNum(draft[key]) ? 'bad' : ''}`}>
      <small><i />{label}</small>
      <div><input inputMode="decimal" placeholder="0" value={draft[key]} onChange={(e) => setDraft({ ...draft, [key]: e.target.value })} aria-label={label} /><em>g</em></div>
    </label>
  );
  return (
    <div ref={ref_} className="form">
      <label className={`fin fl ${focus || draft.name ? 'up' : ''} ${tooLong ? 'bad' : ''}`}>
        <span className="flb">名字</span>
        <input ref={nameRef} value={draft.name} maxLength={30} placeholder="比如 乳清蛋白粉" autoComplete="off"
          onFocus={() => setFocus(true)} onBlur={() => setFocus(false)} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
        <span ref={vck} className="vck" aria-hidden><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5L19 7" /></svg></span>
      </label>
      <div className={`vmsg ${tooLong ? 'on' : ''}`} role="alert"><i>!</i><span>名字太长了，20 个字以内</span></div>
      <div className="fk">
        <div className="kc"><small>热量 · 自动算</small><b><Roll value={String(kcal)} /></b><em>kcal</em></div>
        {!editing && <div className="amt">这些是<label className={`fin ${badNum(draft.amount, true) ? 'bad' : ''}`}><input inputMode="decimal" value={draft.amount} onChange={(e) => setDraft({ ...draft, amount: e.target.value })} aria-label="份量（克）" /></label>g 的</div>}
      </div>
      <div className="fm">{cell('p', '蛋白质')}{cell('c', '碳水')}{cell('f', '脂肪')}</div>
      <div className="share" style={{ marginTop: 14 }}>
        <i style={{ background: '#f0505a', width: `${pct(P * 4)}%` }} /><i style={{ background: '#f5a524', width: `${pct(C * 4)}%` }} /><i style={{ background: '#16a394', width: `${pct(F * 9)}%` }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 11.5, fontWeight: 600, color: 'var(--faint)' }}>
        <span>热量来自</span><span>{tot ? `蛋白 ${pct(P * 4)}% · 碳水 ${pct(C * 4)}% · 脂肪 ${pct(F * 9)}%` : '—'}</span>
      </div>
      <div className="fbtn">
        <button type="button" className="btn ghost pressable" onClick={onCancel}>取消</button>
        <LoadingButton className="btn dark" label={editing ? '保存修改' : '存进库'} doneLabel={editing ? '改好了' : '存好了'} onPress={onSave} />
      </div>
    </div>
  );
}

/* ---------------- 一行：往左滑露出编辑/删除；点开选克数、记进某顿 ---------------- */
const OPEN_X = -148;
function LibRow({ food, q, fitnessGoal, open, fresh, swiped, onSwipe, onToggle, onEdit, onDelete, onLog }: {
  food: LibraryFood; q: string; fitnessGoal: string; open: boolean; fresh: boolean; swiped: boolean;
  onSwipe: (on: boolean) => void; onToggle: () => void; onEdit: () => void; onDelete: () => void;
  onLog: (food: NewFood, meal: MealType) => boolean;
}) {
  const s = scoreLibraryFood(food, fitnessGoal);
  const tot = food.proteinPer100g * 4 + food.carbsPer100g * 4 + food.fatPer100g * 9 || 1;
  const rowRef = useRef<HTMLDivElement>(null);
  const x = useRef(0), moved = useRef(false);
  const [grams, setGrams] = useState(100);
  const [meal, setMeal] = useState<MealType>(mealByTime());
  const logBtn = useRef<HTMLDivElement>(null);
  useEffect(() => { if (!swiped && rowRef.current && x.current) { rowRef.current.classList.add('snap'); rowRef.current.style.transform = ''; x.current = 0; } }, [swiped]);
  useEffect(() => { if (open) { setGrams(100); setMeal(mealByTime()); } }, [open]);

  // 往左滑：跟手，过头有阻力，松手按速度往前推一点再决定停哪
  const down = (e: React.PointerEvent) => {
    const row = rowRef.current; if (!row || (e.target as Element).closest('.ex')) return;
    const x0 = e.clientX, y0 = e.clientY, base = x.current;
    let mode: 'x' | 'y' | null = null; const hist: [number, number][] = [[x0, performance.now()]];
    moved.current = false;
    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - x0, dy = ev.clientY - y0;
      if (!mode) { if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) { mode = 'x'; row.classList.remove('snap'); } else if (Math.abs(dy) > 8) mode = 'y'; }
      if (mode !== 'x') return;
      let nx = base + dx;
      if (nx > 0) nx *= .25;
      if (nx < OPEN_X) nx = OPEN_X + (nx - OPEN_X) * .3;
      x.current = nx; row.style.transform = `translateX(${nx}px)`;
      hist.push([ev.clientX, performance.now()]); if (hist.length > 5) hist.shift();
    };
    const up = () => {
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up);
      if (mode !== 'x') return;
      moved.current = true;
      const a = hist[0], b = hist[hist.length - 1], v = (b[0] - a[0]) / Math.max(1, b[1] - a[1]) * 1000;
      const proj = x.current + v * .998 / (1 - .998) / 1000;
      const to = proj < OPEN_X / 2 ? OPEN_X : 0;
      row.classList.add('snap'); row.style.transform = to ? `translateX(${to}px)` : ''; x.current = to;
      onSwipe(!!to);
    };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
  };

  const name = q && food.name.toLowerCase().includes(q.toLowerCase())
    ? (() => { const i = food.name.toLowerCase().indexOf(q.toLowerCase()); return <>{food.name.slice(0, i)}<mark>{food.name.slice(i, i + q.length)}</mark>{food.name.slice(i + q.length)}</>; })()
    : food.name;

  return (
    <div className={`fw ${fresh ? 'fresh' : ''}`}>
      <div className="acts">
        <button type="button" onClick={onEdit}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 20h4L19 9l-4-4L4 16z" /></svg>编辑</button>
        <button type="button" className="del" onClick={onDelete}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13" /></svg>删除</button>
      </div>
      <div ref={rowRef} className={`lfood ${open ? 'opened' : ''}`} onPointerDown={down}
        onClick={(e) => { if (moved.current || (e.target as Element).closest('.ex')) return; onToggle(); }}>
        <div className="ltop" role="button" aria-expanded={open} tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') onToggle(); }}>
          <div className="pic">{food.name.slice(0, 1)}</div>
          <div className="info"><b>{name}</b><small>每 100 g · <span>{food.caloriesPer100g}</span> kcal</small>
            <div className="mb"><i style={{ flex: food.proteinPer100g * 4 / tot, background: '#f0505a' }} /><i style={{ flex: food.carbsPer100g * 4 / tot, background: '#f5a524' }} /><i style={{ flex: food.fatPer100g * 9 / tot, background: '#16a394' }} /></div></div>
          <span className={`badge g-${s.grade}`} title={s.reason}>{s.label}</span>
        </div>
        <div className={`inl ${open ? 'open' : ''}`}><div>
          {open && (
            <div className="ex">
              <div className="gch">{[50, 100, 150, 200].map((g) => <button key={g} type="button" className={grams === g ? 'on' : ''} onClick={() => setGrams(g)}>{g} g</button>)}</div>
              <div className="exm">
                <Stepper value={grams} onChange={setGrams} step={10} min={10} max={2000} unit="g" label="克数" />
                <div className="res"><b><Roll value={String(Math.round(food.caloriesPer100g * grams / 100))} /></b><em>kcal</em>
                  <small>蛋白质 <span><Roll value={(Math.round(food.proteinPer100g * grams / 10) / 10).toFixed(1)} /></span> g</small></div>
              </div>
              <div className="lmeals">{MEAL_TYPES.map((m) => <button key={m} type="button" className={meal === m ? 'on' : ''} onClick={() => setMeal(m)}>{MEAL_LABELS[m]}</button>)}</div>
              <div ref={logBtn}>
                <button type="button" className="log pressable" onClick={() => { if (onLog(newFoodFromPer100g(food, grams), meal)) like(logBtn.current); }}>记进{MEAL_LABELS[meal]}</button>
              </div>
            </div>
          )}
        </div></div>
      </div>
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="list" aria-busy>
      {[0, 1, 2, 3].map((i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: '52px 1fr 52px', gap: 14, alignItems: 'center', background: '#fff', borderRadius: 22, padding: '11px 14px 11px 11px', height: 74, boxSizing: 'border-box' }}>
          <i className="sk" style={{ height: 52, borderRadius: 16 }} />
          <span style={{ display: 'grid', gap: 8 }}><i className="sk" style={{ height: 14, width: '60%' }} /><i className="sk" style={{ height: 10, width: '40%' }} /></span>
          <i className="sk" style={{ height: 22, borderRadius: 999 }} />
        </div>
      ))}
    </div>
  );
}
