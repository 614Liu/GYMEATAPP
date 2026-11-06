import { useEffect, useMemo, useRef, useState, type ChangeEvent, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import type { MacroGoals, WeightLog } from '../types';
import { FITNESS_GOAL_OPTIONS, type FitnessGoal } from '../constants';
import type { CloudUser } from '../lib/cloud';
import { RM, pop, pulse, sweep } from '../lib/fx';
import { lastDays, nextMilestone, weightSeries } from '../lib/stats';
import { parseLocalDate } from '../lib/utils';
import { Segmented } from '../components/ui/Segmented';
import { Roll } from '../components/ui/Roll';
import { Stepper } from '../components/ui/Stepper';
import { LoadingButton } from '../components/ui/LoadingButton';
import { FlameIcon } from '../components/layout/SplashScreen';
import '../styles/me.css';

const HINT: Record<FitnessGoal, string> = {
  gain: '增肌：热量比消耗多一点，蛋白质要够',
  lose: '减脂：热量比消耗少一点，蛋白质要高',
  maintain: '维持：吃多少用多少，三大营养素均衡',
};
const MAC = [
  { key: 'protein', name: '蛋白质', color: '#f0505a', note: '体重 × 2 左右' },
  { key: 'carbs', name: '碳水', color: '#f5a524', note: '练得多的日子可以多一点' },
  { key: 'fat', name: '脂肪', color: '#16a394', note: '别低于 40 g' },
] as const;
const ARROW = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M9 6l6 6-6 6" /></svg>;
const CHECK = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5L19 7" /></svg>;

export interface MePageProps {
  active: boolean;
  scrollRef: RefObject<HTMLDivElement | null>;
  user: CloudUser | null;
  /** 国内版没有登录 */
  canLogin: boolean;
  todayKey: string;
  streak: number;
  longest: number;
  daysLogged: number;
  weightLogs: WeightLog[];
  goals: MacroGoals;
  fitnessGoal: string;
  onSaveGoals: (g: MacroGoals) => boolean;
  onSaveFitnessGoal: (g: string) => void;
  onLogin: () => void;
  onLogout: () => Promise<boolean>;
  onExport: () => Promise<void>;
  onImport: (file: File) => Promise<number>;
  notify: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export function MePage(p: MePageProps) {
  const today = parseLocalDate(p.todayKey);
  const w30 = useMemo(() => weightSeries(p.weightLogs, lastDays(30, today)), [p.weightLogs, p.todayKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const goal = nextMilestone(p.streak);
  const prevGoal = [0, 7, 14, 21, 30, 50, 100, 150, 200, 365].filter((s) => s < goal).pop() ?? 0;
  const mileRef = useRef<HTMLDivElement>(null), flameRef = useRef<HTMLSpanElement>(null);
  const [shown, setShown] = useState(false);

  // 第一次切到这一页：数字从 0 数上去，里程碑进度条长出来、一道光扫过、火苗跳一下
  useEffect(() => {
    if (!p.active || shown) return;
    const t1 = setTimeout(() => setShown(true), 250);
    const t2 = setTimeout(() => { sweep(mileRef.current, { star: false }); pulse(flameRef.current); }, 1400);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [p.active, shown]);

  return (
    <div className="stack">
      <h1 className="ptitle" style={{ paddingTop: 6 }}>我的</h1>

      <section>
        <Profile user={p.user} canLogin={p.canLogin} onLogin={p.onLogin} />
        <div className="stats">
          <div><b><Roll value={shown ? String(p.streak) : '0'} /></b><em>天</em><small>连续打卡</small></div>
          <div><b><Roll value={shown ? String(p.daysLogged) : '0'} /></b><em>天</em><small>一共记了</small></div>
          <div className={w30.delta <= 0 ? 'down' : ''}><b><Roll value={!shown || w30.pts.length < 2 ? '0.0' : `${w30.delta > 0 ? '+' : w30.delta < 0 ? '−' : ''}${Math.abs(w30.delta).toFixed(1)}`} /></b><em>kg</em><small>体重 · 30 天</small></div>
        </div>
        <div className="mile">
          <span ref={flameRef} className="fl"><FlameIcon size={20} /></span>
          <div><div className="t">{p.streak ? `再坚持 ${goal - p.streak} 天，连续 ${goal} 天` : '今天记一样，开始连续打卡'}<span>{p.streak} / {goal}</span></div>
            <div ref={mileRef} className="tr"><i style={{ width: shown ? `${Math.max(4, (p.streak - prevGoal) / (goal - prevGoal) * 100)}%` : 0 }} /></div></div>
        </div>
        {p.longest > 0 && <p style={{ marginTop: 10, fontSize: 12, fontWeight: 600, color: 'var(--faint)', textAlign: 'right' }}>最长连续 <b className="num" style={{ color: 'var(--ink)' }}>{p.longest}</b> 天</p>}
      </section>

      <Goals goals={p.goals} fitnessGoal={p.fitnessGoal} onSaveGoals={p.onSaveGoals} onSaveFitnessGoal={p.onSaveFitnessGoal} notify={p.notify} />
      <DataCard onExport={p.onExport} onImport={p.onImport} notify={p.notify} />
      {p.user && <Account onLogout={p.onLogout} />}

      <div className="foot">健食 GYMEAT · <b>v{__APP_VERSION__}</b> · by 614</div>
    </div>
  );
}

/* ---------------- 头像 / 登录 ---------------- */
function Profile({ user, canLogin, onLogin }: { user: CloudUser | null; canLogin: boolean; onLogin: () => void }) {
  const [imgOk, setImgOk] = useState(true);
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true), off = () => setOnline(false);
    window.addEventListener('online', on); window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);
  if (!user) {
    return (
      <div className="me">
        <div className="av guest"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="4" /><path d="M4 21c1-4 4.5-6 8-6s7 2 8 6" strokeLinecap="round" /></svg></div>
        <div className="who"><b>{canLogin ? '还没登录' : '本机记录'}</b><small>{canLogin ? '登录后换手机也不丢' : '记录只存在这台手机上'}</small>
          {canLogin && <button type="button" className="login pressable" onClick={onLogin}><i>G</i>用 Google 登录</button>}</div>
      </div>
    );
  }
  const initial = (user.email?.[0] ?? '?').toUpperCase();
  return (
    <div className="me">
      <div className="av">{user.photoURL && imgOk
        ? <img src={user.photoURL} alt="" referrerPolicy="no-referrer" onError={() => setImgOk(false)} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
        : initial}</div>
      <div className="who"><b>{user.email?.split('@')[0] ?? '已登录'}</b><small>Google 账号</small>
        <span className={`sync ${online ? '' : 'off'}`}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 12a8 8 0 0 1-14 5.3M4 12a8 8 0 0 1 14-5.3M18 3v4h-4M6 21v-4h4" /></svg>
          {online ? '云端同步中' : '离线 · 联网后自动同步'}
        </span></div>
    </div>
  );
}

/* ---------------- 目标：改了从底部浮起「保存 / 还原」 ---------------- */
function Goals({ goals, fitnessGoal, onSaveGoals, onSaveFitnessGoal, notify }: Pick<MePageProps, 'goals' | 'fitnessGoal' | 'onSaveGoals' | 'onSaveFitnessGoal' | 'notify'>) {
  const saved = { g: fitnessGoal as FitnessGoal, protein: goals.protein, carbs: goals.carbs, fat: goals.fat };
  const [d, setD] = useState(saved);
  const [resetKey, setResetKey] = useState(0);
  // 云端目标变了（别的设备改的）而这里没在改，就跟着更新
  const dirty = d.g !== saved.g || d.protein !== saved.protein || d.carbs !== saved.carbs || d.fat !== saved.fat;
  useEffect(() => { if (!dirty) setD(saved); }, [fitnessGoal, goals.protein, goals.carbs, goals.fat]); // eslint-disable-line react-hooks/exhaustive-deps
  const kp = d.protein * 4, kc = d.carbs * 4, kf = d.fat * 9, tot = kp + kc + kf;
  const kRef = useRef<HTMLElement>(null);
  const pct = (x: number) => (tot ? Math.round(x / tot * 100) : 0);
  // 保存条浮在整个屏幕底部（导航上面），挂到外壳上
  const [shell, setShell] = useState<Element | null>(null);
  useEffect(() => setShell(document.querySelector('.shell')), []);

  return (
    <section className="card">
      <div className="card-h">我的目标<span>影响 AI 教练的建议</span></div>
      <Segmented dark options={FITNESS_GOAL_OPTIONS} value={d.g} onChange={(g) => setD({ ...d, g })} label="目标" />
      <div className="hint">{HINT[d.g] ?? ''}</div>
      <div className="gkc"><div><small>每天热量 · 自动算</small><b ref={kRef}><Roll value={String(tot)} /></b><em>kcal</em></div>
        <span className="tag">蛋白 {pct(kp)}% · 碳水 {pct(kc)}% · 脂肪 {pct(kf)}%</span></div>
      <div className="share" style={{ marginTop: 14, background: 'none' }}>
        <i style={{ background: '#f0505a', flexGrow: kp }} /><i style={{ background: '#f5a524', flexGrow: kc }} /><i style={{ background: '#16a394', flexGrow: kf }} />
      </div>
      {MAC.map((m) => (
        <div key={m.key} className="gmrow">
          <div className="n"><i style={{ background: m.color }} /><div>{m.name}<small>{m.note}</small></div></div>
          <Stepper value={d[m.key]} onChange={(v) => setD((x) => ({ ...x, [m.key]: v }))} step={5} min={0} max={600} unit="g" color={m.color} label={m.name} />
        </div>
      ))}
      {shell && createPortal(<div className={`savebar ${dirty ? 'on' : ''}`} aria-hidden={!dirty}>
        <span>目标改了<small>每天 {tot} kcal · 还没保存</small></span>
        <button type="button" className="rv pressable" onClick={() => setD(saved)}>还原</button>
        <LoadingButton className="sv" label="保存" doneLabel="好了" resetKey={resetKey}
          onPress={() => {
            if (!tot) { notify('目标不能都是 0', 'error'); return false; }
            if (!onSaveGoals({ protein: d.protein, carbs: d.carbs, fat: d.fat, calories: tot })) { notify('目标数值不合理', 'error'); return false; }
            onSaveFitnessGoal(d.g);
            setTimeout(() => { pop(kRef.current); notify('目标保存好了', 'success'); setTimeout(() => setResetKey((k) => k + 1), 600); }, RM ? 0 : 900);
            return true;
          }} />
      </div>, shell)}
    </section>
  );
}

/* ---------------- 导出 / 导入：行里走进度，完成打勾 ---------------- */
function DataCard({ onExport, onImport, notify }: Pick<MePageProps, 'onExport' | 'onImport' | 'notify'>) {
  const [busy, setBusy] = useState<'export' | 'import' | null>(null);
  const [done, setDone] = useState<Record<string, string>>({});
  const fileRef = useRef<HTMLInputElement>(null);
  const okRefs = useRef<Record<string, HTMLSpanElement | null>>({});

  const run = async (kind: 'export' | 'import', task: () => Promise<string>) => {
    setBusy(kind);
    try {
      const msg = await task();
      setDone((x) => ({ ...x, [kind]: msg }));
      setTimeout(() => pop(okRefs.current[kind]), 30);
    } catch (err) {
      notify(err instanceof Error && err.message ? err.message : kind === 'export' ? '导出失败，请检查网络后重试' : '导入失败，请重试', 'error');
    } finally { setBusy(null); }
  };
  const onFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; e.target.value = '';
    if (!file) return;
    run('import', async () => { const n = await onImport(file); notify(n ? `导入好了 · ${n} 条记录` : '没有新记录需要导入', 'success'); return n ? `导入了 ${n} 条记录，目标已恢复` : '没有新记录，目标已恢复'; });
  };
  const row = (kind: 'export' | 'import', title: string, sub: string, icon: React.ReactNode, onClick: () => void) => (
    <button type="button" className={`mrow2 ${busy === kind ? 'busy' : ''} ${done[kind] ? 'done' : ''}`} disabled={!!busy} onClick={onClick}>
      <span className="ic">{icon}</span>
      <span><b>{title}</b><small>{busy === kind ? (kind === 'export' ? '正在打包…' : '正在读取文件…') : done[kind] ?? sub}</small></span>
      <span className="go">{ARROW}</span>
      <span ref={(el) => { okRefs.current[kind] = el; }} className="ok">{CHECK}</span>
      <span className="pb"><i style={{ width: busy === kind ? '90%' : 0, transition: busy === kind ? 'width 1.6s cubic-bezier(.3,0,.2,1)' : 'none' }} /></span>
    </button>
  );
  return (
    <section className="card">
      <div className="card-h">数据<span>换手机也不丢</span></div>
      <div className="rows">
        {row('export', '导出备份', '记录、食物库、体重、目标存成一个文件',
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 15V4M7 9l5-5 5 5M5 15v4h14v-4" /></svg>,
          () => run('export', async () => { await onExport(); notify('备份导出好了', 'success'); return '已导出备份文件'; }))}
        {row('import', '导入备份', '已有的记录不会被覆盖',
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 4v11M7 10l5 5 5-5M5 15v4h14v-4" /></svg>,
          () => fileRef.current?.click())}
        <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={onFile} />
      </div>
    </section>
  );
}

/* ---------------- 账号：退出在原地展开确认 ---------------- */
function Account({ onLogout }: { onLogout: () => Promise<boolean> }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <section className="card">
      <div className="card-h">账号</div>
      <div className="rows">
        <button type="button" className="mrow2 out" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          <span className="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10" /></svg></span>
          <span><b>退出登录</b><small>换账号或不想同步时用</small></span><span className="go">{ARROW}</span>
        </button>
      </div>
      <div className={`inl ${open ? 'open' : ''}`}><div><div className="confirm">
        <p>退出后，这台手机上的缓存会清掉；云端的记录都还在，重新登录就回来了。</p>
        <div className="bt">
          <button type="button" className="no pressable" onClick={() => setOpen(false)}>先不退</button>
          <button type="button" className="yes pressable" disabled={busy} onClick={async () => { setBusy(true); const ok = await onLogout(); setBusy(false); if (ok) setOpen(false); }}>{busy ? '正在退出…' : '确认退出'}</button>
        </div>
      </div></div></div>
    </section>
  );
}
