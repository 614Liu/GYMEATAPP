import { useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { format } from 'date-fns';
import type { DailyLog, MacroGoals, WeightLog } from '../types';
import { RM, pop } from '../lib/fx';
import { averages, dateKey, lastDays, longestStreak, totalsByDate, weightSeries } from '../lib/stats';
import { parseLocalDate } from '../lib/utils';
import { Segmented } from '../components/ui/Segmented';
import { Roll, rollTo } from '../components/ui/Roll';
import { Ring } from '../components/ui/Ring';
import { Stepper } from '../components/ui/Stepper';
import { LoadingButton } from '../components/ui/LoadingButton';
import { EmptyArt } from '../components/ui/EmptyArt';
import '../styles/trends.css';

const WEEK = ['日', '一', '二', '三', '四', '五', '六'];
const CW = 368;
const MAC = [
  { key: 'protein', name: '蛋白质', a: '#ff8a7a', b: '#f0505a', ink: '#c9323d', track: 'rgba(240,80,90,.16)', glow: 'rgba(240,80,90,.45)' },
  { key: 'carbs', name: '碳水', a: '#ffd36a', b: '#f5a524', ink: '#b26f05', track: 'rgba(245,165,36,.18)', glow: 'rgba(245,165,36,.45)' },
  { key: 'fat', name: '脂肪', a: '#6ee0c8', b: '#16a394', ink: '#0d7f73', track: 'rgba(22,163,148,.16)', glow: 'rgba(22,163,148,.45)' },
] as const;

const md = (k: string) => format(parseLocalDate(k), 'M/d');
const wd = (k: string) => WEEK[parseLocalDate(k).getDay()];

function smooth(P: [number, number][], t = .18) {
  if (P.length < 2) return '';
  let d = `M${P[0][0]},${P[0][1]}`;
  for (let i = 0; i < P.length - 1; i++) {
    const p0 = P[i - 1] || P[i], p1 = P[i], p2 = P[i + 1], p3 = P[i + 2] || p2;
    d += ` C${p1[0] + (p2[0] - p0[0]) * t},${p1[1] + (p2[1] - p0[1]) * t} ${p2[0] - (p3[0] - p1[0]) * t},${p2[1] - (p3[1] - p1[1]) * t} ${p2[0]},${p2[1]}`;
  }
  return d;
}

/** 第一次进入视野时变 true（之后一直 true） */
function useSeen(ref: RefObject<Element | null>, root: RefObject<HTMLElement | null>, active: boolean) {
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    if (seen || !active || !ref.current || !root.current) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setSeen(true); io.disconnect(); } }, { root: root.current, rootMargin: '0px 0px -15% 0px' });
    io.observe(ref.current);
    return () => io.disconnect();
  }, [seen, active, ref, root]);
  return seen;
}

export interface TrendsPageProps {
  active: boolean;
  scrollRef: RefObject<HTMLDivElement | null>;
  todayKey: string;
  logs: DailyLog[];
  weightLogs: WeightLog[];
  goals: MacroGoals;
  onSaveWeight: (w: number) => boolean;
  /** 从首页「称一次体重」点过来时，把记体重那一行亮一下 */
  focusWeight: number;
  notify: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export function TrendsPage(p: TrendsPageProps) {
  const [range, setRange] = useState<'7' | '30'>('7');
  const n = Number(range);
  const today = parseLocalDate(p.todayKey);
  const days = useMemo(() => lastDays(n, today), [n, p.todayKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const days30 = useMemo(() => lastDays(30, today), [p.todayKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const byDate = useMemo(() => totalsByDate(p.logs), [p.logs]);
  const logged = useMemo(() => new Set(byDate.keys()), [byDate]);
  const avg = useMemo(() => averages(byDate, days, p.todayKey), [byDate, days, p.todayKey]);

  return (
    <div className="stack">
      <div className="ph"><h1 className="ptitle">趋势</h1>
        <Segmented options={[{ key: '7', label: '7 天' }, { key: '30', label: '30 天' }]} value={range} onChange={setRange} label="范围" /></div>
      <Weight {...p} days={days} range={n} />
      <Calories {...p} days={days} byDate={byDate} avgCal={avg.calories} />
      <MacroAvg {...p} avg={avg} range={n} />
      <Checkin {...p} days30={days30} byDate={byDate} logged={logged} />
      <Summary {...p} byDate={byDate} />
    </div>
  );
}

/* ---------------- 体重：曲线（按住看某一天）+ 原地记体重 ---------------- */
function Weight({ weightLogs, days, range, todayKey, onSaveWeight, focusWeight, notify }: TrendsPageProps & { days: string[]; range: number }) {
  const WH = 168, WT = 14, WB = 28;
  const { pts, delta } = useMemo(() => weightSeries(weightLogs, days), [weightLogs, days]);
  const todayW = weightLogs.find((w) => w.date === todayKey)?.weight ?? null;
  const latest = pts.length ? pts[pts.length - 1].weight : todayW;
  const lastAny = useMemo(() => [...weightLogs].sort((a, b) => b.date.localeCompare(a.date))[0]?.weight ?? 60, [weightLogs]);
  const [draft, setDraft] = useState<number>(todayW ?? lastAny);
  const [cur, setCur] = useState<number | null>(null);
  const bigRef = useRef<HTMLElement>(null);
  const lineRef = useRef<SVGPathElement>(null);
  const areaRef = useRef<SVGPathElement>(null);
  const clipRef = useRef<SVGRectElement>(null);
  const ghostRef = useRef<SVGPathElement>(null);
  const dotRef = useRef<SVGCircleElement>(null);
  const chartRef = useRef<HTMLDivElement>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  const uid = useRef(Math.random().toString(36).slice(2, 7)).current;

  const geo = useMemo(() => {
    if (pts.length < 2) return null;
    const vs = pts.map((q) => q.weight), lo = Math.min(...vs) - .3, hi = Math.max(...vs) + .3;
    const X = (k: string) => 10 + days.indexOf(k) / (days.length - 1) * (CW - 20);
    const Y = (v: number) => WT + (hi - v) / (hi - lo) * (WH - WT - WB);
    const P = pts.map((q) => [X(q.date), Y(q.weight)] as [number, number]);
    const line = smooth(P), last = P[P.length - 1];
    return { X, Y, P, line, last, lo, hi, area: `${line} L${last[0]},${WH - WB} L${P[0][0]},${WH - WB} Z` };
  }, [pts, days]);

  // 大数字：按住时是那一天，平时是最新一次
  const shownW = cur != null ? pts[cur]?.weight : latest;
  useLayoutEffect(() => { if (bigRef.current) rollTo(bigRef.current, shownW != null ? shownW.toFixed(1) : '--'); }, [shownW]);

  // 换范围时：线画出来，面积淡入，终点弹出
  useEffect(() => {
    const ln = lineRef.current; if (!ln || RM) return;
    const L = ln.getTotalLength();
    ln.animate([{ strokeDasharray: `${L} ${L}`, strokeDashoffset: L }, { strokeDasharray: `${L} ${L}`, strokeDashoffset: 0 }], { duration: 900, easing: 'cubic-bezier(.6,0,.2,1)' });
    areaRef.current?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 700, delay: 500, fill: 'backwards' });
    dotRef.current?.animate([{ transform: 'scale(0)' }, { transform: 'scale(1.3)' }, { transform: 'scale(1)' }], { duration: 500, delay: 850, fill: 'backwards', easing: 'cubic-bezier(.3,1.5,.5,1)' });
  }, [range, pts.length >= 2]); // eslint-disable-line react-hooks/exhaustive-deps

  // 记了新体重：最后一个点从上面落下来弹一下
  const prevLatest = useRef(latest);
  useEffect(() => {
    if (prevLatest.current !== latest && dotRef.current && !RM) {
      dotRef.current.animate([{ transform: 'translateY(-40px) scale(.6)', opacity: 0 }, { transform: 'translateY(0) scale(1.3)', opacity: 1, offset: .6 }, { transform: 'none' }], { duration: 650, easing: 'cubic-bezier(.3,1.2,.5,1)' });
    }
    prevLatest.current = latest;
  }, [latest]);

  useEffect(() => { if (focusWeight && rowRef.current) setTimeout(() => pop(rowRef.current), 350); }, [focusWeight]);

  // 按住曲线左右滑
  const scrubAt = (clientX: number) => {
    if (!geo || !chartRef.current) return;
    const box = chartRef.current.getBoundingClientRect(), x = (clientX - box.left) / box.width * CW;
    let best = 0; geo.P.forEach((q, i) => { if (Math.abs(q[0] - x) < Math.abs(geo.P[best][0] - x)) best = i; });
    setCur(best);
    clipRef.current?.setAttribute('width', String(geo.P[best][0] + 10));
    if (ghostRef.current) ghostRef.current.style.opacity = '1';
  };
  const endScrub = () => {
    if (cur == null) return;
    setCur(null);
    const clip = clipRef.current; if (!clip) return;
    const from = Number(clip.getAttribute('width')), t0 = performance.now();
    const back = (t: number) => {
      const k = Math.min(1, (t - t0) / 420), e = 1 - Math.pow(1 - k, 3);
      clip.setAttribute('width', String(from + (CW + 20 - from) * e));
      if (k < 1) requestAnimationFrame(back); else if (ghostRef.current) ghostRef.current.style.opacity = '0';
    };
    requestAnimationFrame(back);
  };

  const labels = geo ? (range === 7 ? days.map((k, i) => ({ k, i })) : [0, 7, 14, 21, 29].map((i) => ({ k: days[i], i }))) : [];
  const cp = cur != null && geo ? geo.P[cur] : null;

  return (
    <section>
      <div className="wt-h">
        <span className={`lab ${cur != null ? 'scrub' : ''}`}>体重 · {cur != null ? (pts[cur].date === todayKey ? '今天' : md(pts[cur].date)) : pts.length ? '最新' : '还没记'}</span>
        {pts.length > 1 && <span className={`chip ${delta > 0 ? 'up' : ''}`}>{delta > 0 ? '↑' : delta < 0 ? '↓' : ''} {Math.abs(delta).toFixed(1)} kg <small>{range} 天</small></span>}
      </div>
      <div className="wt-big"><b ref={bigRef} className="roll" /><em>kg</em></div>
      {geo ? (
        <div ref={chartRef} className="chart"
          onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); scrubAt(e.clientX); }}
          onPointerMove={(e) => { if (e.currentTarget.hasPointerCapture(e.pointerId)) scrubAt(e.clientX); }}
          onPointerUp={endScrub} onPointerCancel={endScrub}>
          <svg viewBox={`0 0 ${CW} ${WH}`} height={WH} role="img" aria-label={`最近 ${range} 天体重曲线`}>
            <defs>
              <linearGradient id={`wa-${uid}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#10b981" stopOpacity=".16" /><stop offset="1" stopColor="#10b981" stopOpacity="0" /></linearGradient>
              <linearGradient id={`wl-${uid}`} gradientUnits="userSpaceOnUse" x1="0" x2={CW} y1="0" y2="0"><stop offset="0" stopColor="#121615" stopOpacity=".25" /><stop offset=".2" stopColor="#121615" /></linearGradient>
              <clipPath id={`wc-${uid}`}><rect ref={clipRef} x="-10" y="-30" height={WH + 60} width={CW + 20} /></clipPath>
            </defs>
            {[0, .5, 1].map((f) => <line key={f} x1="0" x2={CW} y1={WT + f * (WH - WT - WB)} y2={WT + f * (WH - WT - WB)} stroke="#e3e8e6" strokeDasharray="2 5" />)}
            <text x={CW} y={WT - 5} textAnchor="end" fontSize="10" fontWeight="600" fill="#9aa39f">{geo.hi.toFixed(1)}</text>
            <text x={CW} y={WH - WB - 5} textAnchor="end" fontSize="10" fontWeight="600" fill="#9aa39f">{geo.lo.toFixed(1)}</text>
            <path ref={ghostRef} d={geo.line} fill="none" stroke="#cfd6d3" strokeWidth="2.6" strokeLinecap="round" style={{ opacity: 0, transition: 'opacity .2s' }} />
            <path ref={areaRef} d={geo.area} fill={`url(#wa-${uid})`} clipPath={`url(#wc-${uid})`} />
            <path ref={lineRef} d={geo.line} fill="none" stroke={`url(#wl-${uid})`} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" clipPath={`url(#wc-${uid})`} />
            {range === 7 && geo.P.slice(0, -1).map((q, i) => <circle key={i} cx={q[0]} cy={q[1]} r="3.5" fill="#f3f5f4" stroke="#121615" strokeWidth="2" />)}
            <circle className="halo" cx={geo.last[0]} cy={geo.last[1]} r="5" fill="#10b981" />
            <circle ref={dotRef} cx={geo.last[0]} cy={geo.last[1]} r="6" fill="#10b981" stroke="#fff" strokeWidth="2.5" style={{ transformBox: 'fill-box', transformOrigin: 'center' }} />
            {labels.map(({ k, i }) => (
              <text key={k} x={geo.X(k)} y={WH - 6} textAnchor={range === 30 ? (i === 0 ? 'start' : i === 29 ? 'end' : 'middle') : 'middle'} fontSize="11"
                fontWeight={k === todayKey ? 700 : 600} fill={k === todayKey ? '#121615' : '#8a938f'}>{k === todayKey ? '今天' : range === 7 ? wd(k) : md(k)}</text>
            ))}
            <g style={{ opacity: cp ? 1 : 0, transition: 'opacity .15s' }}>
              {cp && <><line x1={cp[0]} x2={cp[0]} y1={WT - 6} y2={WH - WB} stroke="#121615" strokeWidth="1.5" strokeDasharray="3 3" /><circle cx={cp[0]} cy={cp[1]} r="7" fill="#121615" stroke="#fff" strokeWidth="3" /></>}
            </g>
          </svg>
          <div className={`bubble ${cp ? 'on' : ''}`} style={cp ? { left: `${Math.max(40, Math.min(CW - 40, cp[0])) / CW * 100}%`, top: -22 } : undefined}>
            {cur != null && `${md(pts[cur].date)} 周${wd(pts[cur].date)}`}
          </div>
        </div>
      ) : (
        <div className="chart-empty"><EmptyArt kind="chart" size={56} />称两次以上，这里就会画出体重曲线</div>
      )}
      <div ref={rowRef} className="wlog">
        <div className="t">今天的体重<small>{todayW != null ? '已记，可再改' : '早上空腹称最准'}</small></div>
        <Stepper value={draft} onChange={setDraft} step={.1} min={20} max={300} decimals={1} label="体重" showTotal />
        {todayW != null && Math.abs(todayW - draft) < .05
          ? <button type="button" className="go" style={{ background: 'var(--emerald)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden><path d="M5 12l5 5L19 7" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg>已记</button>
          : <LoadingButton className="go" label="记下" doneLabel="已记" resetKey={draft}
            onPress={() => { const ok = onSaveWeight(Math.round(draft * 10) / 10); if (ok) notify(`体重记下了 · ${draft.toFixed(1)} kg`, 'success'); return ok; }} />}
      </div>
    </section>
  );
}

/* ---------------- 热量柱 ---------------- */
function Calories({ active, scrollRef, days, byDate, todayKey, goals, avgCal }: TrendsPageProps & { days: string[]; byDate: Map<string, { calories: number }>; avgCal: number }) {
  const CH = 186, CT = 30, CB = 26, GOAL = goals.calories || 2000;
  const ref = useRef<HTMLElement>(null);
  const seen = useSeen(ref, scrollRef, active);
  const [t, setT] = useState(0);
  const [sel, setSel] = useState<string | null>(null);
  const avgRef = useRef<HTMLElement>(null);
  const n = days.length, gap = n === 7 ? 14 : 3.4, bw = (CW - gap * (n - 1)) / n, rx = Math.min(8, bw / 2);
  const vals = days.map((k) => byDate.get(k)?.calories ?? 0);
  const max = Math.max(GOAL * 1.3, ...vals);
  const Y = (v: number) => CT + (1 - v / max) * (CH - CT - CB);
  const done = days.filter((k) => k !== todayKey && byDate.has(k));
  const ok = done.filter((k) => byDate.get(k)!.calories <= GOAL).length;

  // 柱子按顺序长出来（带一点过冲），进入视野才开始；换范围重来
  useEffect(() => {
    setSel(null);
    if (!seen) return;
    if (RM) { setT(1); return; }
    let raf = 0; const t0 = performance.now() + 120;
    const step = (now: number) => {
      const s = Math.max(0, (now - t0) / 1000);
      setT(1 - Math.exp(-5 * s) * Math.cos(9 * s));
      if (s < 1.6) raf = requestAnimationFrame(step); else setT(1);
    };
    setT(0); raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [seen, n]);
  // 平均值从 0 数上去
  useEffect(() => {
    const el = avgRef.current; if (!el || !seen) return;
    if (RM) { el.textContent = Math.round(avgCal).toLocaleString(); return; }
    const t0 = performance.now(); let raf = 0;
    const tick = (now: number) => { const k = Math.min(1, (now - t0) / 900), e = 1 - Math.pow(1 - k, 4); el.textContent = Math.round(avgCal * e).toLocaleString(); if (k < 1) raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [seen, avgCal]);

  const si = sel ? days.indexOf(sel) : -1;
  const labelIdx = n === 7 ? days.map((_, i) => i) : [0, 7, 14, 21, 29];
  return (
    <section ref={ref} className="card">
      <div className="card-h">热量<span>平均 <b ref={avgRef}>0</b> kcal / 天</span></div>
      <div className="chart" style={{ touchAction: 'pan-y' }}>
        <svg viewBox={`0 0 ${CW} ${CH}`} height={CH} role="img" aria-label="每天热量">
          <defs>
            <linearGradient id="cg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#10b981" /><stop offset="1" stopColor="#6ee7b7" /></linearGradient>
            <linearGradient id="co" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#f0505a" /><stop offset="1" stopColor="#ffa598" /></linearGradient>
            <linearGradient id="ct" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#10b981" stopOpacity=".28" /><stop offset="1" stopColor="#10b981" stopOpacity=".08" /></linearGradient>
          </defs>
          <line x1="0" x2={CW * Math.min(1, t * 1.6)} y1={Y(GOAL)} y2={Y(GOAL)} stroke="#121615" strokeOpacity=".35" strokeWidth="1.2" strokeDasharray="4 4" />
          {days.map((k, i) => {
            const v = vals[i], isT = k === todayKey;
            const tk = Math.max(0, Math.min(1.25, (t - i / n * .45) / .55)), full = CH - CB - Y(v), h = Math.max(0, full * tk);
            const on = sel === k;
            return (
              <rect key={k} x={i * (bw + gap)} y={CH - CB - h} width={bw} height={h} rx={rx}
                fill={isT ? 'url(#ct)' : v > GOAL ? 'url(#co)' : 'url(#cg)'} stroke={isT ? '#10b981' : undefined} strokeWidth={isT ? 1.6 : undefined} strokeDasharray={isT ? '4 3' : undefined}
                style={{ opacity: sel && !on ? .3 : 1, transform: on ? 'translateY(-4px)' : undefined, filter: on ? 'drop-shadow(0 6px 6px rgba(16,20,19,.18))' : undefined, transition: 'opacity .25s, transform .4s cubic-bezier(.3,1.5,.5,1)', cursor: 'pointer' }}
                onClick={() => setSel(on ? null : k)} />
            );
          })}
          {labelIdx.map((i) => (
            <text key={i} x={i * (bw + gap) + bw / 2} y={CH - 6} textAnchor={n === 30 ? (i === 0 ? 'start' : i === 29 ? 'end' : 'middle') : 'middle'} fontSize="11"
              fontWeight={days[i] === todayKey ? 700 : 600} fill={days[i] === todayKey ? '#121615' : '#8a938f'}>{days[i] === todayKey ? '今天' : n === 7 ? wd(days[i]) : md(days[i])}</text>
          ))}
        </svg>
        <div className={`bubble ${sel ? 'on' : ''}`} style={si >= 0 ? { left: `${Math.max(60, Math.min(CW - 60, si * (bw + gap) + bw / 2)) / CW * 100}%`, top: Math.max(-8, Y(vals[si]) - 34) } : undefined}>
          {sel && `${sel === todayKey ? '今天' : md(sel)} · ${Math.round(vals[si]).toLocaleString()} kcal`}
        </div>
      </div>
      <div className="cal-foot">
        <span><i style={{ background: '#10b981' }} />达标 <b>{ok}</b> 天</span>
        <span><i style={{ background: '#f0505a' }} />超了 <b>{done.length - ok}</b> 天</span>
        <span style={{ marginLeft: 'auto' }}><i style={{ width: 14, height: 0, borderTop: '1.5px dashed #8a938f', borderRadius: 0, verticalAlign: 3 }} />目标 <b>{GOAL}</b></span>
      </div>
    </section>
  );
}

/* ---------------- 三大营养素平均 ---------------- */
function MacroAvg({ active, scrollRef, goals, avg, range }: TrendsPageProps & { avg: { protein: number; carbs: number; fat: number; days: number }; range: number }) {
  const ref = useRef<HTMLElement>(null);
  const seen = useSeen(ref, scrollRef, active);
  return (
    <section ref={ref} className="card">
      <div className="card-h">三大营养素<span>近 {range} 天 · 平均每天</span></div>
      <div className="tmacros">
        {MAC.map((m) => (
          <div key={m.key} className="mc">
            <Ring size={84} r={34} w={10} value={avg[m.key]} max={goals[m.key] || 1} hold={!seen} track={m.track} from={m.a} to={m.b} shadow={`0 1px 2px ${m.glow}`}>
              <b><Roll value={seen ? String(Math.round(avg[m.key])) : '0'} /></b>
            </Ring>
            <div className="n" style={{ color: m.ink }}>{m.name}</div>
            <div className="g">目标 {goals[m.key]} g</div>
          </div>
        ))}
      </div>
      {avg.days === 0 && <p style={{ marginTop: 14, fontSize: 12.5, color: 'var(--faint)', textAlign: 'center' }}>这段时间还没有完整的一天记录</p>}
    </section>
  );
}

/* ---------------- 打卡格 ---------------- */
function Checkin({ active, scrollRef, days30, byDate, logged, todayKey, goals, notify }: TrendsPageProps & { days30: string[]; byDate: Map<string, { calories: number }>; logged: Set<string> }) {
  const ref = useRef<HTMLElement>(null);
  const seen = useSeen(ref, scrollRef, active);
  const today = parseLocalDate(todayKey);
  const cur = useMemo(() => {
    let d = today; if (!logged.has(dateKey(d))) d = new Date(d.getTime() - 864e5);
    let k = 0; while (logged.has(dateKey(d))) { k++; d = new Date(d.getTime() - 864e5); }
    return k;
  }, [logged, todayKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const best = useMemo(() => longestStreak(logged), [logged]);
  const GOAL = goals.calories || 2000;
  return (
    <section ref={ref} className="card">
      <div className="card-h">打卡<span>近 30 天</span></div>
      <div className="streak-top"><b><Roll value={seen ? String(cur) : '0'} /></b><span>天连续</span><em>最长 <b>{best}</b> 天</em></div>
      <div className="grid30">
        {days30.map((k, i) => {
          const t = byDate.get(k), cls = k === todayKey ? 'today' : !t ? '' : t.calories > GOAL ? 'over' : 'ok';
          return (
            <button key={k} type="button" className={`cell ${cls}`} aria-label={md(k)}
              style={{ animationDelay: `${(Math.floor(i / 10) + i % 10) * 34}ms`, animationPlayState: seen ? 'running' : 'paused' }}
              onClick={() => notify(k === todayKey ? `今天 · 已吃 ${Math.round(t?.calories ?? 0)} kcal` : !t ? `${md(k)} · 没记` : `${md(k)} · ${Math.round(t.calories).toLocaleString()} kcal${t.calories > GOAL ? ' · 超了' : ''}`)} />
          );
        })}
      </div>
      <div className="legend"><span><i style={{ background: '#10b981' }} />达标</span><span><i style={{ background: '#fbcfca' }} />超了</span><span><i style={{ background: '#edf1ef' }} />没记</span></div>
    </section>
  );
}

/* ---------------- 本周小结：滚到它时一个字一个字变深（#146） ---------------- */
function Summary({ scrollRef, byDate, weightLogs, goals, todayKey }: TrendsPageProps & { byDate: Map<string, { calories: number; protein: number; carbs: number; fat: number }> }) {
  const today = parseLocalDate(todayKey);
  const days = lastDays(7, today);
  const a = averages(byDate as never, days, todayKey);
  const w = weightSeries(weightLogs, days);
  const GOAL = goals.calories || 2000;
  const head = !a.days ? '这周还没有完整的记录' : a.calories <= GOAL ? '节奏刚好，继续保持' : '这周吃得偏多，下周收一收';
  const why = !a.days ? '每天记一记，这里会帮你总结一周吃得怎么样。'
    : `这 7 天平均 ${Math.round(a.calories).toLocaleString()} kcal，比目标${a.calories <= GOAL ? '少' : '多'} ${Math.abs(Math.round(GOAL - a.calories))}；`
      + (w.pts.length > 1 ? `体重${w.delta <= 0 ? '降了' : '涨了'} ${Math.abs(w.delta)} kg，每周 0.3–0.5 kg 正合适。` : '这周称两次体重，就能看出变化。')
      + `蛋白质平均 ${Math.round(a.protein)} g${a.protein < goals.protein ? `，再多一点就到 ${goals.protein} g 了。` : '，够了。'}`;
  const hRef = useRef<HTMLDivElement>(null), wRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sc = scrollRef.current; if (!sc) return;
    const els = [hRef.current, wRef.current].filter(Boolean) as HTMLElement[];
    const paint = () => els.forEach((el) => {
      const r = el.getBoundingClientRect(), sr = sc.getBoundingClientRect();
      const p = RM ? 1 : Math.max(0, Math.min(1, (sr.bottom - r.top) / (r.height + 100)));
      const spans = el.children, N = spans.length;
      for (let i = 0; i < N; i++) {
        const k = Math.max(0, Math.min(1, p * (N + 2) - i));
        (spans[i] as HTMLElement).style.opacity = String(.32 + .68 * k);
      }
    });
    sc.addEventListener('scroll', paint, { passive: true }); paint();
    return () => sc.removeEventListener('scroll', paint);
  }, [scrollRef, head, why]);

  return (
    <section className="coach sum">
      <div className="label"><span className="dot" /><b>AI 教练</b>· 本周小结</div>
      <div ref={hRef} className="head">{[...head].map((c, i) => <span key={i}>{c}</span>)}</div>
      <div ref={wRef} className="why" style={{ color: 'var(--ink)' }}>{[...why].map((c, i) => <span key={i}>{c}</span>)}</div>
    </section>
  );
}
