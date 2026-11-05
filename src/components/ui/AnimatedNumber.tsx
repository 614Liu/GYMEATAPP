import { useRef, useEffect } from 'react';
import { animate } from 'motion/react';

/**
 * 数字变化时滚动过渡。decimals 是保留的小数位，体重这类数值要传 1，
 * 否则 65.5kg 会显示成 66。
 */
export function AnimatedNumber({ value, decimals = 0 }: { value: number; decimals?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const fmt = (v: number) => v.toFixed(decimals);

  useEffect(() => {
    if (!ref.current) return;
    const node = ref.current;

    const controls = animate(Number(node.textContent) || 0, value, {
      duration: 0.8,
      ease: 'easeOut',
      onUpdate: (v) => {
        node.textContent = v.toFixed(decimals);
      },
    });

    return controls.stop;
  }, [value, decimals]);

  return <span ref={ref}>{fmt(value)}</span>;
}
