import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { RM } from '../../lib/fx';

type Phase = 'idle' | 'busy' | 'check' | 'done';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface LoadingButtonProps {
  label: ReactNode;
  doneLabel: string;
  /** 点了以后做的事；返回 false 表示没做成（按钮回到原样，不打勾） */
  onPress: () => boolean | void | Promise<boolean | void>;
  /** 这个值一变，按钮就（淡入淡出地）回到原样 */
  resetKey?: unknown;
  /** 做成以后过多久自动回到原样；不填就一直停在「✓ 完成」 */
  autoReset?: number;
  minWork?: number;
  className?: string;
  style?: CSSProperties;
  disabled?: boolean;
  color?: string;
}

/**
 * #160 加载按钮：0.3 s 缩成圆、转圈 → 0.2 s 变绿、画出对勾 → 0.35 s 展开成「✓ 完成」。
 * 缩小时左右补上同样宽的外边距，按钮占的地方不变，旁边的东西不会被挤动。
 * 做成后停在「✓ 完成」，不会自己跳回去；要恢复时改 resetKey，文字淡入。
 */
export function LoadingButton({ label, doneLabel, onPress, resetKey, autoReset, minWork = 450, className, style, disabled, color = 'var(--emerald)' }: LoadingButtonProps) {
  const ref = useRef<HTMLButtonElement>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [fade, setFade] = useState(0);
  const w = useRef(0), h = useRef(0);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) { first.current = false; return; }
    setPhase((p) => (p === 'done' || p === 'check' ? 'idle' : p));
    setFade((n) => n + 1);
  }, [resetKey]);

  const run = async () => {
    if (phase !== 'idle' || disabled || !ref.current) return;
    w.current = ref.current.offsetWidth; h.current = ref.current.offsetHeight;
    const t0 = performance.now();
    setPhase('busy');
    let ok = true;
    try { ok = (await onPress()) !== false; } catch { ok = false; }
    await sleep(Math.max(0, (RM ? 0 : 300 + minWork) - (performance.now() - t0)));
    if (!ok) { setPhase('idle'); setFade((n) => n + 1); return; }
    setPhase('check');
    await sleep(RM ? 0 : 200);
    setPhase('done');
    if (autoReset) { await sleep(autoReset); setPhase('idle'); setFade((n) => n + 1); }
  };

  const small = phase === 'busy' || phase === 'check';
  const size = Math.max(36, h.current);
  const d = small ? (w.current - size) / 2 : 0;
  const s: CSSProperties = phase === 'idle' ? { ...style } : {
    ...style,
    width: small ? size : w.current, marginLeft: d, marginRight: d, padding: 0,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
    background: phase === 'busy' ? undefined : color, color: phase === 'busy' ? undefined : '#fff',
    transition: RM ? 'none' : `width ${small ? .3 : .35}s cubic-bezier(.65,0,.35,1), margin ${small ? .3 : .35}s cubic-bezier(.65,0,.35,1), background .2s`,
  };

  return (
    <button ref={ref} type="button" className={className} style={s} onClick={run} disabled={disabled && phase === 'idle'} aria-busy={phase === 'busy'}>
      {phase === 'idle' && <span key={fade} className="lb-in" style={{ display: 'contents' }}>{label}</span>}
      {phase === 'busy' && (
        <svg viewBox="0 0 24 24" width="20" height="20" style={{ display: 'block', animation: 'lbSpin .8s linear infinite' }} aria-hidden>
          <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeOpacity=".25" strokeWidth="3" />
          <path d="M12 3a9 9 0 0 1 9 9" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        </svg>
      )}
      {(phase === 'check' || phase === 'done') && (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
            <path d="M5 12l5 5L19 7" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
              strokeDasharray="22" style={{ strokeDashoffset: RM ? 0 : 22, animation: RM ? undefined : 'lbChk .25s ease-out forwards' }} />
          </svg>
          {phase === 'done' && <span className="lb-in">{doneLabel}</span>}
        </span>
      )}
    </button>
  );
}
