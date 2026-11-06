import { useEffect, useRef, useState } from 'react';
import { RM, popBadge, popIn, popOut, sweep } from '../../lib/fx';

export const FlameIcon = ({ size = 21 }: { size?: number }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden>
    <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
  </svg>
);

/**
 * 启动画面：深色 logo 按 #001 弹进来（一边转正），连续天数角标晚一点弹出，
 * 然后 #022 一道光扫过，最后 logo 微微一鼓收掉，整层淡出。
 * 至少放完一遍（约 2.3 s）；数据还没好就停在 logo 上等。
 */
export function SplashScreen({ ready, streak, onDone }: { ready: boolean; streak: number; onDone: () => void }) {
  const wrap = useRef<HTMLDivElement>(null);
  const logo = useRef<HTMLDivElement>(null);
  const badge = useRef<HTMLSpanElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const [minDone, setMinDone] = useState(false);

  useEffect(() => {
    popIn(wrap.current, 280);
    root.current?.querySelectorAll('h2, small').forEach((el, i) =>
      !RM && el.animate([{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }], { duration: 500, delay: 520 + i * 90, easing: 'cubic-bezier(.33,1,.68,1)', fill: 'backwards' }));
    const t1 = setTimeout(() => sweep(logo.current), 900);
    const t2 = setTimeout(() => setMinDone(true), RM ? 300 : 2100);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);
  useEffect(() => { if (streak > 0) popBadge(badge.current, 0); }, [streak > 0]); // eslint-disable-line react-hooks/exhaustive-deps

  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  const leavingRef = useRef(false);
  useEffect(() => {
    if (!minDone || !ready || leavingRef.current) return;
    leavingRef.current = true;
    popOut(wrap.current);
    root.current?.querySelectorAll('h2, small').forEach((el) => !RM && el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, fill: 'forwards' }));
    // 收尾不放在 effect 的清理里：自己触发的重渲染不能把它取消掉
    setTimeout(() => {
      if (RM || !root.current) { doneRef.current(); return; }
      root.current.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 260, fill: 'forwards' });
      // 用定时器收尾而不是等动画结束：App 在后台时动画不走，也不能卡在启动画面
      setTimeout(() => doneRef.current(), 270);
    }, 240);
  }, [minDone, ready]);

  return (
    <div ref={root} className="splash" role="presentation">
      <div ref={wrap} style={{ position: 'relative' }}>
        <div ref={logo} className="sl"><FlameIcon size={50} /></div>
        {streak > 0 && <span ref={badge} className="bd">{streak}</span>}
      </div>
      <h2>健食</h2>
      <small>BY 614</small>
    </div>
  );
}
