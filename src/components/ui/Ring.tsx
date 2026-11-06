import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react';
import { overshoot, type Overshoot } from '../../lib/fx';

interface RingProps {
  /** 画布边长（px） */
  size: number;
  /** 环的半径、宽度 */
  r: number;
  w: number;
  /** 当前值 / 目标值；超过 1 圈时用 overColors 再走一圈 */
  value: number;
  max: number;
  track: string;
  from: string;
  to: string;
  overColors?: [string, string];
  shadow?: string;
  /** 为 true 时先不播放变化（比如圆环不在屏幕上），变回 false 时再从旧值涨到新值 */
  hold?: boolean;
  /** 每一帧的当前值，用来同步中间的数字 */
  onFrame?: (v: number) => void;
  className?: string;
  children?: ReactNode;
}

/**
 * 进度环：颜色沿着环从浅到深（conic 渐变 + 圆环遮罩），起点一颗浅色圆头、终点一颗带影子的深色圆头。
 * 数值变化按 #010 过冲：冲过头一点再回来。
 */
export function Ring({ size, r, w, value, max, track, from, to, overColors, shadow, hold, onFrame, className, children }: RingProps) {
  const fillRef = useRef<HTMLDivElement>(null);
  const c0Ref = useRef<SVGCircleElement>(null);
  const c1Ref = useRef<SVGCircleElement>(null);
  const osRef = useRef<Overshoot | null>(null);
  const frameRef = useRef(onFrame);
  frameRef.current = onFrame;
  const o = size / 2;
  const colors = useRef({ from, to, overColors, max });
  colors.current = { from, to, overColors, max };

  const draw = (v: number) => {
    const fill = fillRef.current, c0 = c0Ref.current, c1 = c1Ref.current;
    frameRef.current?.(v);
    if (!fill || !c0 || !c1) return;
    const { max: m, overColors: oc } = colors.current;
    const f = Math.max(0, v / (m || 1));
    const over = f > 1 && !!oc;
    const g = over ? Math.min(1, f - 1) || 0.001 : Math.min(1, f);
    const [a, b] = over ? oc! : [colors.current.from, colors.current.to];
    const deg = g * 360;
    fill.style.background = g >= 1 ? `conic-gradient(${a}, ${b})` : `conic-gradient(${a} 0deg, ${b} ${deg}deg, transparent ${deg}deg)`;
    const show = f < 0.005 ? '0' : '1';
    fill.style.opacity = show; c0.style.opacity = show; c1.style.opacity = show;
    c0.setAttribute('fill', a); c1.setAttribute('fill', b);
    const ang = (deg - 90) * Math.PI / 180;
    c1.setAttribute('cx', String(o + r * Math.cos(ang)));
    c1.setAttribute('cy', String(o + r * Math.sin(ang)));
  };

  useLayoutEffect(() => {
    osRef.current = overshoot(hold ? 0 : value, draw);
    return () => osRef.current?.stop();
    // 只建一次；之后的变化走下面的 effect
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!hold) osRef.current?.(value);
    // max 或颜色变了也要重画
    else draw(osRef.current?.value() ?? 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, hold, max, from, to]);

  const maskW = `radial-gradient(farthest-side, transparent calc(100% - ${w}px), #000 calc(100% - ${w - 0.6}px))`;
  return (
    <div className={`gring ${className ?? ''}`} style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} aria-hidden><circle cx={o} cy={o} r={r} fill="none" stroke={track} strokeWidth={w} /></svg>
      <div ref={fillRef} className="arcfill" style={{ inset: o - r - w / 2, WebkitMaskImage: maskW, maskImage: maskW }} />
      <svg viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <circle ref={c0Ref} cx={o} cy={o - r} r={w / 2} />
        <circle ref={c1Ref} r={w / 2} style={shadow ? { filter: `drop-shadow(${shadow})` } : undefined} />
      </svg>
      <div className="ctr">{children}</div>
    </div>
  );
}
