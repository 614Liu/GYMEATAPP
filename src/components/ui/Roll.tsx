import { memo, useLayoutEffect, useRef } from 'react';

/**
 * 数字像里程表一样滚：每一位一条 0–9 的竖条，换数时竖条滑过去。
 * 每一位按自己的字宽显示（"1" 不留空），宽度变化也有过渡。
 */
export function rollTo(el: HTMLElement, text: string) {
  const chars = [...text];
  const sig = chars.map((c) => (/\d/.test(c) ? 'd' : c)).join('');
  const node = el as HTMLElement & { _sig?: string };
  if (node._sig !== sig) {
    node._sig = sig;
    el.innerHTML = chars.map((c) => (/\d/.test(c)
      ? `<span class="dg"><span class="strip">${'0123456789'.split('').map((d) => `<i>${d}</i>`).join('')}</span></span>`
      : `<span>${c}</span>`)).join('');
  }
  const strips = el.querySelectorAll<HTMLElement>('.strip');
  let k = 0;
  chars.forEach((c) => {
    if (!/\d/.test(c)) return;
    const st = strips[k++];
    const w = (st.children[+c] as HTMLElement).offsetWidth;
    st.style.transform = `translateY(${-c}em)`;
    (st.parentElement as HTMLElement).style.width = w ? `${w}px` : '';
  });
}

export const Roll = memo(function Roll({ value, className }: { value: string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => { if (ref.current) rollTo(ref.current, value); }, [value]);
  // 字体加载完以后宽度会变，再量一次
  useLayoutEffect(() => {
    if (!document.fonts) return;
    let alive = true;
    document.fonts.ready.then(() => { if (alive && ref.current) rollTo(ref.current, value); });
    return () => { alive = false; };
    // 只在挂载时等一次字体
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <span ref={ref} className={`roll ${className ?? ''}`} aria-label={value} role="text" />;
});
