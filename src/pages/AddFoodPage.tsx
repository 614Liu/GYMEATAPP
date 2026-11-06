import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import type { LibraryFood, MealType, NewFood } from '../types';
import { MEAL_LABELS, MEAL_TYPES } from '../constants';
import { RM, elasticIn, shake, shrinkOut } from '../lib/fx';
import { compressImage } from '../lib/image';
import { estimateLogNutrition, parseAiError, type NutritionResult } from '../lib/gemini';
import { scoreFood } from '../lib/foodScore';
import { getAutoCalories, newId, scaleAmount, toPer100g } from '../lib/nutrition';
import { Roll } from '../components/ui/Roll';
import { Stepper } from '../components/ui/Stepper';
import { LoadingButton } from '../components/ui/LoadingButton';
import '../styles/addfood.css';

export type AddMode = 'camera' | 'manual';
const ESTIMATE_COOLDOWN_MS = 5000;
const round1 = (n: number) => Math.round(n * 10) / 10;

interface AddFoodPageProps {
  mode: AddMode | null;
  /** 每次打开都会变：用来重置并（拍照模式）直接打开相机 */
  openSeq: number;
  meal: MealType;
  fitnessGoal: string;
  onClose: () => void;
  onAdd: (food: NewFood, meal: MealType) => boolean;
  onSaveLib: (f: LibraryFood) => void;
  notify: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

/**
 * 记一笔：拍照识别 / 手动。从右边滑进来的整页（左上角返回），不是弹窗。
 * 拍照：照片上扫一道绿光 → 识别结果（可调份量）→ 选哪一顿 → 记进去，或存进食物库。
 */
export function AddFoodPage({ mode, openSeq, meal: meal0, fitnessGoal, onClose, onAdd, onSaveLib, notify }: AddFoodPageProps) {
  const [meal, setMeal] = useState<MealType>(meal0);
  const [img, setImg] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [est, setEst] = useState<NutritionResult | null>(null);
  const [mult, setMult] = useState(1);
  const last = useRef(0);
  const camRef = useRef<HTMLInputElement>(null), albRef = useRef<HTMLInputElement>(null);
  const [shownMode, setShownMode] = useState<AddMode | null>(mode);

  useEffect(() => {
    if (!mode) return;
    setShownMode(mode); setMeal(meal0); setImg(null); setQuery(''); setErr(null); setEst(null); setMult(1); setBusy(false);
    if (mode === 'camera') setTimeout(() => camRef.current?.click(), 80);
  }, [openSeq]); // eslint-disable-line react-hooks/exhaustive-deps
  // 安卓返回键 / Esc：关掉这一页
  useEffect(() => {
    if (!mode) return;
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [mode, onClose]);

  const onPhoto = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; e.target.value = '';
    if (!file) return;
    try { setImg(await compressImage(file)); setEst(null); setErr(null); }
    catch { notify('图片处理失败，请重试', 'error'); }
  };
  useEffect(() => { if (img && mode === 'camera') estimate(); }, [img]); // eslint-disable-line react-hooks/exhaustive-deps

  const estimate = async () => {
    if (!query.trim() && !img) return;
    if (Date.now() - last.current < ESTIMATE_COOLDOWN_MS) { setErr('识别太快了，请稍等几秒再试'); return; }
    last.current = Date.now();
    setBusy(true); setErr(null); setEst(null);
    try {
      const r = await estimateLogNutrition(query, img || undefined);
      if (!r.isFood) setErr(r.reason || '没认出是什么食物，换张照片或写一句描述试试');
      else { setEst(r); setMult(1); }
    } catch (e) { setErr(parseAiError(e)); }
    finally { setBusy(false); }
  };

  const scaled: NewFood | null = est ? {
    name: est.name || '未命名食物',
    amount: scaleAmount(est.amount || '1 份', mult),
    calories: Math.round((est.calories || 0) * mult),
    protein: round1((est.protein || 0) * mult),
    carbs: round1((est.carbs || 0) * mult),
    fat: round1((est.fat || 0) * mult),
  } : null;
  const score = est ? scoreFood(toPer100g(est), fitnessGoal) : null;

  const open = !!mode;
  return (
    <div className={`sheetpage ${open ? 'open' : ''}`} aria-hidden={!open} role="dialog" aria-label="记一笔"
      onTransitionEnd={() => { if (!mode) setShownMode(null); }}>
      <div className="sp-head">
        <button type="button" aria-label="返回" onClick={onClose}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M15 6l-6 6 6 6" /></svg></button>
        <h2>{shownMode === 'manual' ? '手动记一笔' : '拍照识别'}</h2><span />
      </div>
      <div className="sp-body">
        <div className="secl" style={{ marginTop: 4 }}>记进哪一顿</div>
        <div className="mealpick">{MEAL_TYPES.map((m) => <button key={m} type="button" className={meal === m ? 'on' : ''} onClick={() => setMeal(m)}>{MEAL_LABELS[m]}</button>)}</div>

        {shownMode === 'camera' ? (
          <>
            <div className={`shot ${busy ? 'run' : ''}`}>
              <div className="ph">
                {img ? <img src={img} alt="要识别的食物" /> : (
                  <svg viewBox="0 0 24 24" width="44" height="44" fill="none" stroke="#9aa39f" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></svg>
                )}
                <i className="cn a" /><i className="cn b" /><i className="cn c" /><i className="cn d" /><i className="line" />
                {img && !busy && <button type="button" className="x" aria-label="去掉照片" onClick={() => { setImg(null); setEst(null); }}>×</button>}
              </div>
              <div className="pick2">
                <button type="button" className="main pressable" onClick={() => camRef.current?.click()}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></svg>{img ? '重拍' : '拍一张'}</button>
                <button type="button" className="pressable" onClick={() => albRef.current?.click()}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="5" width="16" height="14" rx="3" /><circle cx="9" cy="10" r="1.6" /><path d="M20 16l-5-5-8 8" /></svg>相册</button>
              </div>
              <input ref={camRef} type="file" accept="image/*" capture="environment" hidden onChange={onPhoto} />
              <input ref={albRef} type="file" accept="image/*" hidden onChange={onPhoto} />
            </div>
            <div className="desc">
              <textarea value={query} onChange={(e) => setQuery(e.target.value)} placeholder={img ? '补充一句（可选），比如：半碗饭、少油' : '不拍照也行，写一句：200 克煎鸡胸和一碗糙米饭'} aria-label="描述" />
            </div>
            {!est && (
              <button type="button" className="btn dark pressable" style={{ width: '100%' }} disabled={busy || (!img && !query.trim())} onClick={estimate}>
                {busy ? '正在识别…' : '识别'}
              </button>
            )}
            {err && <div className="err" role="alert">{err}</div>}
            {est && scaled && (
              <div className="est">
                <div className="t">
                  <div><b>{scaled.name}</b><small>{scaled.amount}</small></div>
                  <div className="k"><b><Roll value={String(scaled.calories)} /></b><em>kcal</em></div>
                </div>
                <div className="mm">
                  <div><small style={{ color: '#c9323d' }}>蛋白质</small><b><Roll value={scaled.protein.toFixed(1)} /></b></div>
                  <div><small style={{ color: '#b26f05' }}>碳水</small><b><Roll value={scaled.carbs.toFixed(1)} /></b></div>
                  <div><small style={{ color: '#0d7f73' }}>脂肪</small><b><Roll value={scaled.fat.toFixed(1)} /></b></div>
                </div>
                <div className="por"><span>份量 × 倍数</span><Stepper value={mult} onChange={setMult} step={.25} min={.25} max={5} decimals={2} label="份量倍数" /></div>
                {score && <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 8 }}><span className={`badge g-${score.grade}`}>{score.label}</span><span style={{ fontSize: 12.5, color: 'var(--faint)' }}>{score.reason}</span></div>}
                <div className="acts2" style={{ marginTop: 18 }}>
                  <button type="button" className="btn ghost pressable" onClick={() => {
                    const per = toPer100g(est);
                    onSaveLib({ id: newId(), name: est.name || '未命名食物', caloriesPer100g: per.calories, proteinPer100g: per.protein, carbsPer100g: per.carbs, fatPer100g: per.fat, createdAt: Date.now() });
                    notify(per.converted ? `存进食物库了 · ${est.name}` : `存了 ${est.name}，但「${est.amount}」换不成每 100 g，请核对`, per.converted ? 'success' : 'info');
                  }}>存进食物库</button>
                  <LoadingButton className="btn green" label={`记进${MEAL_LABELS[meal]}`} doneLabel="记上了" minWork={250}
                    onPress={() => { const ok = onAdd(scaled, meal); if (ok) setTimeout(onClose, RM ? 0 : 900); else notify('份量需要大于 0', 'error'); return ok; }} />
                </div>
              </div>
            )}
          </>
        ) : shownMode === 'manual' ? (
          <ManualForm meal={meal} onAdd={(f) => { const ok = onAdd(f, meal); if (ok) setTimeout(onClose, RM ? 0 : 900); else notify('份量需要大于 0', 'error'); return ok; }} notify={notify} seq={openSeq} />
        ) : null}
      </div>
    </div>
  );
}

/* ---------------- 手动：名字（浮动标签 + 实时校验）、份量、三大营养素（热量自动算，也可以直接改） ---------------- */
function ManualForm({ meal, onAdd, notify, seq }: { meal: MealType; onAdd: (f: NewFood) => boolean; notify: AddFoodPageProps['notify']; seq: number }) {
  const [d, setD] = useState({ name: '', amount: '', kcal: '', p: '', c: '', f: '' });
  const [kcalTouched, setKcalTouched] = useState(false);
  const [focus, setFocus] = useState(false);
  useEffect(() => { setD({ name: '', amount: '', kcal: '', p: '', c: '', f: '' }); setKcalTouched(false); }, [seq]);
  const vck = useRef<HTMLSpanElement>(null), wasOk = useRef(false), formRef = useRef<HTMLDivElement>(null);
  const name = d.name.trim(), ok = name.length >= 1 && name.length <= 20, tooLong = name.length > 20;
  useEffect(() => { if (ok !== wasOk.current) { if (ok) elasticIn(vck.current); else shrinkOut(vck.current); wasOk.current = ok; } }, [ok]);
  const bad = (s: string) => s.trim() !== '' && (!Number.isFinite(Number(s)) || Number(s) < 0);
  const auto = getAutoCalories(d.p, d.c, d.f);
  const kcal = kcalTouched ? d.kcal : auto ? String(auto) : d.kcal;
  const cell = (key: 'p' | 'c' | 'f', label: string, cls: string) => (
    <label className={`mcell ${cls} ${bad(d[key]) ? 'bad' : ''}`}><small><i />{label}</small>
      <div><input inputMode="decimal" placeholder="0" value={d[key]} onChange={(e) => setD({ ...d, [key]: e.target.value })} aria-label={label} /><em>g</em></div></label>
  );
  return (
    <div ref={formRef}>
      <div className="secl">吃了什么</div>
      <label className={`fin fl ${focus || d.name ? 'up' : ''} ${tooLong ? 'bad' : ''}`} style={{ background: '#fff' }}>
        <span className="flb">名字</span>
        <input value={d.name} maxLength={30} placeholder="比如 全麦吐司" autoComplete="off" onFocus={() => setFocus(true)} onBlur={() => setFocus(false)} onChange={(e) => setD({ ...d, name: e.target.value })} />
        <span ref={vck} className="vck" aria-hidden><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5L19 7" /></svg></span>
      </label>
      <div className={`vmsg ${tooLong ? 'on' : ''}`} role="alert"><i>!</i><span>名字太长了，20 个字以内</span></div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 12 }}>
        <label className="fin" style={{ background: '#fff' }}><input value={d.amount} placeholder="份量，比如 100g" onChange={(e) => setD({ ...d, amount: e.target.value })} aria-label="份量" /></label>
        <label className={`fin ${bad(kcal) ? 'bad' : ''}`} style={{ background: '#fff' }}><input inputMode="decimal" value={kcal} placeholder="热量" onChange={(e) => { setKcalTouched(true); setD({ ...d, kcal: e.target.value }); }} aria-label="热量（kcal）" /><span style={{ fontSize: 13, color: 'var(--faint)', fontWeight: 600 }}>kcal</span></label>
      </div>
      <div className="secl">三大营养素（填了热量会自动算）</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>{cell('p', '蛋白质', 'p')}{cell('c', '碳水', 'c')}{cell('f', '脂肪', 'f')}</div>
      <div style={{ marginTop: 22 }}>
        <LoadingButton className="btn green" style={{ width: '100%' }} label={`记进${MEAL_LABELS[meal]}`} doneLabel="记上了" minWork={250}
          onPress={() => {
            const k = Number(kcal);
            if (!ok) { shake(formRef.current?.querySelector('.fin.fl') ?? null); notify(!name ? '先写吃了什么' : '名字太长了', 'error'); return false; }
            if ([d.p, d.c, d.f, kcal].some(bad) || !(k > 0)) { notify(!(k > 0) ? '热量要大于 0（或填三大营养素）' : '有一格不是数字', 'error'); return false; }
            return onAdd({ name, amount: d.amount.trim() || '1 份', calories: Math.round(k), protein: Number(d.p) || 0, carbs: Number(d.c) || 0, fat: Number(d.f) || 0 });
          }} />
      </div>
    </div>
  );
}
