import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { reveal } from '../../lib/fx';

interface PageFrameProps {
  active: boolean;
  /** 往下滚以后顶栏上显示的小标题 */
  title: string;
  scrollRef: RefObject<HTMLDivElement | null>;
  children: ReactNode;
}

/**
 * 一页：自己滚动；大标题（.ptitle）往下滚时淡出缩小，顶部换成磨砂小标题栏。
 * 每次切到这一页，卡片按 #074 从下往上依次浮出。页面一直挂着（切走只是隐藏），滚动位置会保留。
 */
export function PageFrame({ active, title, scrollRef, children }: PageFrameProps) {
  const [bar, setBar] = useState(false);
  const seen = useRef(false);

  useEffect(() => {
    const sc = scrollRef.current; if (!sc) return;
    const onScroll = () => {
      const y = sc.scrollTop, k = Math.min(1, Math.max(0, y / 48));
      setBar(y > 44);
      const h = sc.querySelector<HTMLElement>('.ptitle');
      if (h) { h.style.opacity = String(1 - k); h.style.transform = `scale(${1 - k * .12}) translateY(${-k * 6}px)`; }
    };
    sc.addEventListener('scroll', onScroll, { passive: true });
    return () => sc.removeEventListener('scroll', onScroll);
  }, [scrollRef]);

  useEffect(() => {
    if (!active) return;
    const sc = scrollRef.current; if (!sc) return;
    // 第一次显示时整页都浮出；之后切回来只浮出屏幕里的那几张
    const items = [...sc.querySelectorAll(':scope > .stack > *')];
    const stop = reveal(items, sc, { stagger: seen.current ? 50 : 70 });
    seen.current = true;
    return stop;
  }, [active, scrollRef]);

  return (
    <div style={{ position: 'absolute', inset: 0 }} hidden={!active}>
      <div ref={scrollRef} className="page">{children}</div>
      <div className={`topbar ${bar ? 'on' : ''}`} aria-hidden>{title}</div>
    </div>
  );
}
