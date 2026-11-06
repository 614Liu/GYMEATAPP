import { useEffect, useRef, useState } from 'react';
import { RM } from '../../lib/fx';
import { Roll } from './Roll';

interface StepperProps {
  value: number;
  onChange: (v: number) => void;
  step: number;
  min?: number;
  max?: number;
  unit?: string;
  decimals?: number;
  /** 刻度尺：每一步移动 6 px，长刻度每 10 步一根 */
  color?: string;
  /** 按住多少下以后改成一次走 fastMult 步 */
  fastMult?: number;
  label?: string;
  /** 按住时上面浮出「一共改了多少」 */
  showTotal?: boolean;
}

/**
 * − / + 小秤：中间一把刻度尺，绿线不动、刻度滑；按一下飘出 ±步长、按钮一圈绿波；
 * 按住 0.4 s 后进入快速模式（按钮变黑、外圈一直扩），上面浮出这次一共改了多少。
 */
export function Stepper({ value, onChange, step, min = 0, max = 9999, unit = '', decimals = 0, color, fastMult = 2, label, showTotal }: StepperProps) {
  const ref = useRef<HTMLDivElement>(null);
  const rulerRef = useRef<HTMLElement>(null);
  const valueRef = useRef(value);
  valueRef.current = value;
  const [acc, setAcc] = useState<string | null>(null);
  const [anim, setAnim] = useState(false);
  useEffect(() => { const id = requestAnimationFrame(() => setAnim(true)); return () => cancelAnimationFrame(id); }, []);

  const round = (v: number) => Math.round(v / step) * step;
  const clamp = (v: number) => Math.max(min, Math.min(max, Number(round(v).toFixed(4))));
  const x = 30 - (value / step) * 6;

  const fx = (btn: HTMLElement, dir: number, holding: boolean) => {
    if (RM) return;
    const rip = document.createElement('span'); rip.className = 'rip'; btn.appendChild(rip);
    rip.animate([{ transform: 'scale(.7)', opacity: .7 }, { transform: 'scale(1.9)', opacity: 0 }], { duration: 520, easing: 'cubic-bezier(.2,.8,.3,1)' }).onfinish = () => rip.remove();
    if (holding || !ref.current) return;
    const f = document.createElement('span'); f.className = 'fly';
    f.textContent = `${dir > 0 ? '+' : '−'}${step}${unit ? ` ${unit}` : ''}`;
    f.style.left = `${btn.offsetLeft + btn.offsetWidth / 2}px`;
    ref.current.appendChild(f);
    f.animate([{ transform: 'translate(-50%, 0) scale(.6)', opacity: 0 }, { transform: 'translate(-50%, -16px) scale(1.05)', opacity: 1, offset: .3 }, { transform: 'translate(-50%, -32px) scale(1)', opacity: 0 }],
      { duration: 720, easing: 'cubic-bezier(.2,.8,.3,1)' }).onfinish = () => f.remove();
  };

  const press = (e: React.PointerEvent<HTMLButtonElement>, dir: number) => {
    const btn = e.currentTarget;
    try { btn.setPointerCapture(e.pointerId); } catch { /* 模拟事件没有指针 */ }
    const start = valueRef.current;
    btn.classList.add('down');
    const bump = (n: number) => { const v = clamp(valueRef.current + dir * step * n); valueRef.current = v; onChange(v); };
    bump(1); fx(btn, dir, false);
    let n = 0, tm = 0 as unknown as ReturnType<typeof setTimeout>;
    const rep = () => {
      btn.classList.add('hold');
      bump(n > 12 ? fastMult : 1); fx(btn, dir, true);
      if (showTotal) { const t = +(valueRef.current - start).toFixed(decimals); setAcc(`${t > 0 ? '+' : t < 0 ? '−' : ''}${Math.abs(t).toFixed(decimals)}${unit ? ` ${unit}` : ''}`); }
      n++; tm = setTimeout(rep, n > 12 ? 90 : n > 4 ? 110 : 160);
    };
    tm = setTimeout(rep, 400);
    const end = () => {
      clearTimeout(tm); btn.classList.remove('down', 'hold');
      setTimeout(() => setAcc(null), 500);
      btn.removeEventListener('pointerup', end); btn.removeEventListener('pointercancel', end);
    };
    btn.addEventListener('pointerup', end); btn.addEventListener('pointercancel', end);
  };

  return (
    <div ref={ref} className="step" style={color ? ({ '--mc': color } as React.CSSProperties) : undefined}>
      {showTotal && <span className={`acc ${acc ? 'on' : ''}`}>{acc}</span>}
      <button type="button" aria-label={`${label ?? ''}减 ${step}${unit}`} onPointerDown={(e) => press(e, -1)}>−</button>
      <span className="val">
        <span className="v"><Roll value={value.toFixed(decimals)} />{unit && <em>{unit}</em>}</span>
        <i ref={rulerRef} className={`ruler ${anim ? 'anim' : ''}`} style={{ backgroundPosition: `${x}px 0, ${x}px 100%` }} />
      </span>
      <button type="button" aria-label={`${label ?? ''}加 ${step}${unit}`} onPointerDown={(e) => press(e, 1)}>+</button>
    </div>
  );
}
