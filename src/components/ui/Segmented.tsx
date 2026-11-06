import { useLayoutEffect, useRef } from 'react';
import { RM } from '../../lib/fx';

interface SegmentedProps<K extends string> {
  options: { key: K; label: string }[];
  value: K;
  onChange: (k: K) => void;
  dark?: boolean;
  className?: string;
  label?: string;
}

/** 滑块切换：选中的那块滑过去时会先拉长一点再缩回（像有弹性） */
export function Segmented<K extends string>({ options, value, onChange, dark, className, label }: SegmentedProps<K>) {
  const pill = useRef<HTMLElement>(null);
  const prev = useRef(value);
  const n = options.length;
  const idx = Math.max(0, options.findIndex((o) => o.key === value));

  useLayoutEffect(() => {
    const el = pill.current; if (!el) return;
    // 用百分比（滑块自己的宽度）定位：页面隐藏时量不到宽度也不会错位
    const from = options.findIndex((o) => o.key === prev.current) * 100, to = idx * 100;
    el.style.transform = `translateX(${to}%)`;
    if (prev.current !== value && !RM) {
      el.animate([{ transform: `translateX(${from}%)` }, { transform: `translateX(${(from + to) / 2}%) scaleX(1.28)`, offset: .45 }, { transform: `translateX(${to}%)` }],
        { duration: 480, easing: 'cubic-bezier(.3,1.15,.5,1)' });
    }
    prev.current = value;
    // options 只在初次给定
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, idx]);

  return (
    <div className={`seg ${dark ? 'dark' : ''} ${className ?? ''}`} style={{ gridTemplateColumns: `repeat(${n}, 1fr)` }} role="tablist" aria-label={label}>
      <i ref={pill} className="seg-pill" style={{ width: `calc((100% - 8px) / ${n})` }} />
      {options.map((o) => (
        <button key={o.key} type="button" role="tab" aria-selected={o.key === value} className={o.key === value ? 'on' : ''} onClick={() => o.key !== value && onChange(o.key)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
