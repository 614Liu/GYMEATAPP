import { useRef, useEffect } from 'react';
import { animate } from 'motion/react';

export function AnimatedNumber({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const node = ref.current;

    const controls = animate(Number(node.textContent) || 0, value, {
      duration: 0.8,
      ease: 'easeOut',
      onUpdate: (v) => {
        node.textContent = Math.round(v).toString();
      },
    });

    return controls.stop;
  }, [value]);

  return <span ref={ref}>{Math.round(value)}</span>;
}
