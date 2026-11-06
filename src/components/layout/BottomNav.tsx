import { useEffect, useRef, useState } from 'react';
import { followThrough, like, squashDown, squashUp } from '../../lib/fx';

export type Tab = 'today' | 'trends' | 'library' | 'me';
export type FanAction = 'camera' | 'library' | 'manual';

const Icon = {
  today: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="4.5" /></svg>,
  trends: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M4 19V11M10 19V5M16 19v-6M21 19H3" /></svg>,
  library: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M5 4h14v16H5zM5 9h14" /></svg>,
  me: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><circle cx="12" cy="8" r="4" /><path d="M4 21c1-4 4.5-6 8-6s7 2 8 6" strokeLinecap="round" /></svg>,
};
const ITEMS: { key: Tab; label: string }[] = [
  { key: 'today', label: '今天' }, { key: 'trends', label: '趋势' }, { key: 'library', label: '食物库' }, { key: 'me', label: '我的' },
];

interface BottomNavProps {
  tab: Tab;
  onTab: (t: Tab) => void;
  /** 已经在这一页时又点了它（回到顶部） */
  onReselect: (t: Tab) => void;
  onFan: (a: FanAction) => void;
  /** 记进了东西：「今天」图标上亮一个绿点并点赞一下 */
  todayPing: number;
}

/**
 * 底部导航：今天 / 趋势 / 中间的 + / 食物库 / 我的。
 * 中间的 +：按下压扁、松手拉长弹回（#011）；扇出三个圆按钮，停下时各自晃一下（#122）。不弹窗。
 */
export function BottomNav({ tab, onTab, onReselect, onFan, todayPing }: BottomNavProps) {
  const [open, setOpen] = useState(false);
  const plus = useRef<HTMLButtonElement>(null);
  const fan = useRef<HTMLDivElement>(null);
  const todayIcon = useRef<HTMLSpanElement>(null);
  const [dot, setDot] = useState(false);

  useEffect(() => {
    if (!open || !fan.current) return;
    fan.current.querySelectorAll('.fb').forEach((b, i) => followThrough(b, { kick: [-12, 6, 12][i], delay: 300 + [30, 0, 60][i] }));
  }, [open]);
  useEffect(() => {
    if (!todayPing) return;
    if (tab !== 'today') setDot(true);
    like(todayIcon.current);
  }, [todayPing]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (tab === 'today') setDot(false); }, [tab]);
  // 返回键 / Esc 收起扇形
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [open]);

  const pick = (a: FanAction) => { setOpen(false); setTimeout(() => onFan(a), 160); };

  const item = (it: (typeof ITEMS)[number]) => (
    <button key={it.key} type="button" className={`nav-i ${tab === it.key ? 'on' : ''}`} aria-current={tab === it.key ? 'page' : undefined}
      onClick={() => (tab === it.key ? onReselect(it.key) : onTab(it.key))}>
      <span ref={it.key === 'today' ? todayIcon : undefined} style={{ display: 'grid' }}>{Icon[it.key]}</span>
      {it.key === 'today' && dot && <i className="nav-dot" />}
      {it.label}
    </button>
  );

  return (
    <>
      <div className={`veil ${open ? 'on' : ''}`} onClick={() => setOpen(false)} />
      <div ref={fan} className={`fan ${open ? 'open' : ''}`} aria-hidden={!open}>
        <button type="button" className="fb l" tabIndex={open ? 0 : -1} onClick={() => pick('library')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 4h12v17l-6-4-6 4z" /></svg><span>收藏库</span>
        </button>
        <button type="button" className="fb main" tabIndex={open ? 0 : -1} onClick={() => pick('camera')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></svg><span>拍照识别</span>
        </button>
        <button type="button" className="fb r" tabIndex={open ? 0 : -1} onClick={() => pick('manual')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 20h4L19 9l-4-4L4 16z" /></svg><span>手动</span>
        </button>
      </div>
      <nav className="nav" aria-label="主导航">
        {item(ITEMS[0])}{item(ITEMS[1])}
        <button ref={plus} type="button" className={`plus ${open ? 'open' : ''}`} aria-label="记一笔" aria-expanded={open}
          onPointerDown={() => squashDown(plus.current)} onPointerUp={() => squashUp(plus.current)} onPointerCancel={() => squashUp(plus.current)}
          onClick={() => setOpen((o) => !o)}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
        </button>
        {item(ITEMS[2])}{item(ITEMS[3])}
      </nav>
    </>
  );
}
