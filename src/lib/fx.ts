// Motion Prompt #001 #010 #011 #022 #069 #072 #074 #093 #122 #125 #146 #160 #166 · MIT License · https://showheyohtaki.github.io/motion-prompt/
/*
  共用动效。时长、缓动、弹簧公式照 motion-prompt 里各条的规格（设计稿 design/gymeat-home/design-demos/fx.js 同一套）。
  都直接操作 DOM（Web Animations API），在组件里通过 ref 调用；开了「减少动态效果」就直接到终点。
*/

export const RM = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
export const eOut = (t: number) => 1 - Math.pow(1 - t, 3);
export const eInOut = (t: number) => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const qInOut = (t: number) => (t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const sample = <T,>(fn: (t: number, q: number) => T, dur: number, n = 40): T[] =>
  Array.from({ length: n + 1 }, (_, i) => fn(i / n * dur, i / n));

/** 元素在它定位父级里的中心（父级可能被缩放，按比例换算） */
function centerIn(el: Element, host: HTMLElement) {
  const r = el.getBoundingClientRect(), hr = host.getBoundingClientRect();
  const sc = hr.width / host.offsetWidth || 1;
  return { x: (r.left - hr.left + r.width / 2) / sc, y: (r.top - hr.top + r.height / 2) / sc, w: r.width / sc, h: r.height / sc };
}

/** #166 点赞：先压到 0.78，0.12 s 冲到 1.45，再按 1 + 0.45·e^(−7t)·cos(15t) 落回；一圈小粒子散开 */
export function like(el: Element | null, color = '#10b981') {
  if (!el || RM) return;
  const kf: Keyframe[] = [{ transform: 'scale(1)', offset: 0 }, { transform: 'scale(.78)', offset: .1 / 1.1 }, { transform: 'scale(1.45)', offset: .22 / 1.1 }];
  sample((t) => 1 + .45 * Math.exp(-7 * t) * Math.cos(15 * t), .88, 22).slice(1)
    .forEach((s, i) => kf.push({ transform: `scale(${s})`, offset: (.22 + (i + 1) / 22 * .88) / 1.1 }));
  kf[kf.length - 1].offset = 1;
  el.animate(kf, { duration: 1100 });
  const host = ((el as HTMLElement).offsetParent || el.parentElement) as HTMLElement | null;
  if (!host) return;
  const c = centerIn(el, host);
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * Math.PI * 2 + .2, d = document.createElement('i');
    d.style.cssText = `position:absolute;left:${c.x}px;top:${c.y}px;width:5px;height:5px;margin:-2.5px;border-radius:50%;background:${i % 2 ? color : '#f5a524'};pointer-events:none;z-index:5`;
    host.appendChild(d);
    d.animate([{ transform: 'translate(0,0) scale(1)', opacity: 1 }, { transform: `translate(${Math.cos(a) * (c.w / 2 + 16)}px,${Math.sin(a) * (c.w / 2 + 16)}px) scale(.3)`, opacity: 0 }],
      { duration: 560, delay: 100, easing: 'cubic-bezier(.2,.8,.3,1)', fill: 'backwards' }).onfinish = () => d.remove();
  }
}

/** #001 弹出：缩放 1 − e^(−6.5t)·cos(15t)（最高约 1.26），同时从 −20° 按 1 − e^(−6t)·cos(11t) 转正 */
export function popIn(el: Element | null, delay = 0) {
  if (!el || RM) return;
  el.animate(sample((t) => ({
    transform: `scale(${Math.max(0, 1 - Math.exp(-6.5 * t) * Math.cos(15 * t))}) rotate(${Math.exp(-6 * t) * Math.cos(11 * t) * -20}deg)`,
  }), 1, 40), { duration: 1000, delay, fill: 'backwards' });
}
/** #001 的角标：1 − e^(−7t)·cos(17t) */
export function popBadge(el: Element | null, delay = 0) {
  if (!el || RM) return;
  el.animate(sample((t) => ({ transform: `scale(${Math.max(0, 1 - Math.exp(-7 * t) * Math.cos(17 * t))})` }), .8, 30), { duration: 800, delay, fill: 'backwards' });
}
/** #001 退场：先微微鼓一下再缩到 0（backIn，s = 2.2），0.26 s */
export function popOut(el: Element | null) {
  if (!el || RM) return;
  const s = 2.2;
  el.animate(sample((_t, q) => ({ transform: `scale(${1 - q * q * ((s + 1) * q - s)})` }), .26, 16), { duration: 260, fill: 'forwards' });
}

/** #022 光扫过：116 px 白光带 + 78 px 外一条 12 px 细带，斜 24°，1.05 s 二次缓动扫过；末尾右上角闪一颗四角星 */
export function sweep(el: HTMLElement | null, { delay = 0, star = true } = {}) {
  if (!el || RM) return;
  if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
  el.style.overflow = 'hidden';
  const w = el.offsetWidth, h = el.offsetHeight, band = document.createElement('i');
  band.style.cssText = `position:absolute;top:${-h}px;bottom:${-h}px;left:0;width:210px;pointer-events:none;z-index:3;
    background:linear-gradient(90deg,transparent 0,rgba(255,255,255,.72) 58px,transparent 116px,transparent 188px,rgba(255,255,255,.5) 194px,transparent 200px)`;
  el.appendChild(band);
  const from = -340, to = w + 130;
  band.animate(sample((_t, q) => ({ transform: `translateX(${from + (to - from) * qInOut(q)}px) rotate(24deg)` }), 1.05, 24),
    { duration: 1050, delay, fill: 'both' }).onfinish = () => band.remove();
  if (!star) return;
  const st = document.createElement('i');
  st.innerHTML = '<svg viewBox="-10 -10 20 20" width="20" height="20"><path d="M0-10Q1-1 10 0Q1 1 0 10Q-1 1-10 0Q-1-1 0-10Z" fill="#fff"/></svg>';
  st.style.cssText = 'position:absolute;right:6px;top:4px;pointer-events:none;z-index:4;line-height:0';
  el.appendChild(st);
  st.animate(sample((_t, q) => ({ transform: `scale(${Math.sin(Math.PI * q) * (1 + .2 * (1 - q))}) rotate(${q * 52}deg)` }), .6, 16),
    { duration: 600, delay: delay + 930, fill: 'both' }).onfinish = () => st.remove();
}

/**
 * #010 过冲：从当前值到目标 v = a + (b−a)·(1 − e^(−4.6t)·cos(10.5t))，约 0.3 s 时冲过头 25% 再回来。
 * 可以随时改目标（从当前值重新起步）。返回 set(to)，另有 jump(to) 直接跳过去。
 */
export interface Overshoot { (to: number): void; jump: (to: number) => void; value: () => number; stop: () => void }
export function overshoot(initial: number, onUpdate: (v: number) => void): Overshoot {
  let cur = initial, from = initial, to = initial, t0 = 0, raf = 0;
  onUpdate(cur);
  const step = (now: number) => {
    const t = (now - t0) / 1000, k = 1 - Math.exp(-4.6 * t) * Math.cos(10.5 * t);
    cur = from + (to - from) * k; onUpdate(cur);
    if (t < 1.4) raf = requestAnimationFrame(step); else { cur = to; onUpdate(cur); raf = 0; }
  };
  const set = ((v: number) => {
    from = cur; to = v;
    if (RM) { cur = v; onUpdate(v); return; }
    t0 = performance.now(); if (!raf) raf = requestAnimationFrame(step);
  }) as Overshoot;
  set.jump = (v) => { cancelAnimationFrame(raf); raf = 0; cur = from = to = v; onUpdate(v); };
  set.value = () => cur;
  set.stop = () => { cancelAnimationFrame(raf); raf = 0; };
  return set;
}

/** #011 挤压拉伸：按下压扁（纵 0.82、横 1/0.82，体积不变，脚底为支点）；松手先拉长再弹回 */
export function squashDown(el: HTMLElement | null) {
  if (!el || RM) return;
  el.getAnimations().forEach((a) => a.cancel());
  el.animate([{ transform: 'scale(1,1)' }, { transform: `scale(${1 / .82},.82)` }], { duration: 110, easing: 'cubic-bezier(.2,.8,.3,1)', fill: 'forwards' });
}
export function squashUp(el: HTMLElement | null) {
  if (!el || RM) return;
  el.getAnimations().forEach((a) => a.cancel());
  const kf = sample((t) => { const sy = 1 - .18 * Math.exp(-7 * t) * Math.cos(14 * t); return { transform: `scale(${1 / sy},${sy})` }; }, .7, 28);
  el.animate(kf, { duration: 700 });
}

/** #122 跟随：停下的那一刻，被惯性带着晃：角度按 a″ = −121a − 5.5a′ 衰减（固有频率 11 rad/s） */
export function followThrough(el: Element | null, { kick = 14, delay = 0 } = {}) {
  if (!el || RM) return;
  el.animate(sample((t) => ({ rotate: `${kick * Math.exp(-2.75 * t) * Math.sin(10.65 * t)}deg` }), 1.1, 36), { duration: 1100, delay, composite: 'add' });
}

/** #125 脉动：1 + 0.26·G(0.2 s) + 0.15·G(0.44 s)，两圈轮廓在 0.16 / 0.40 s 从 1.2 扩到 2.4 倍 */
export function pulse(el: HTMLElement | null, color = 'rgba(242,113,28,.55)') {
  if (!el || RM) return;
  const G = (t: number, c: number, w: number) => Math.exp(-Math.pow((t - c) / w, 2));
  el.animate(sample((t) => ({ transform: `scale(${1 + .26 * G(t, .2, .065) + .15 * G(t, .44, .07)})` }), .7, 42), { duration: 700 });
  const host = el.parentElement; if (!host) return;
  if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
  const c = centerIn(el, host), size = Math.max(c.w, c.h);
  [160, 400].forEach((d) => {
    const ring = document.createElement('i');
    ring.style.cssText = `position:absolute;left:${c.x - size / 2}px;top:${c.y - size / 2}px;width:${size}px;height:${size}px;border-radius:50%;border:2px solid ${color};pointer-events:none`;
    host.appendChild(ring);
    ring.animate(sample((_t, q) => ({ transform: `scale(${1.2 + 1.2 * eOut(q)})`, opacity: 1 - q }), .8, 20), { duration: 800, delay: d, fill: 'both' }).onfinish = () => ring.remove();
  });
}

/** #093 平滑滚动：三次缓入缓出，296 px 用 1.05 s；距离短就按比例缩短（最少 0.45 s） */
export function smoothScroll(scroller: HTMLElement, to = 0) {
  const from = scroller.scrollTop, d = to - from; if (!d) return;
  if (RM) { scroller.scrollTop = to; return; }
  const dur = Math.max(450, Math.min(1050, Math.abs(d) / 296 * 1050)), t0 = performance.now();
  const step = (now: number) => { const q = Math.min(1, (now - t0) / dur); scroller.scrollTop = from + d * eInOut(q); if (q < 1) requestAnimationFrame(step); };
  requestAnimationFrame(step);
}

/** #074 进入视野淡入：越过视口 85% 那条线时，0.7 s 透明度 0→1、从下方 28 px 升到原位 */
export function reveal(items: Element[], scroller: HTMLElement, { stagger = 70 } = {}) {
  if (RM || !items.length) return () => {};
  let n = 0;
  items.forEach((el) => { (el as HTMLElement).style.opacity = '0'; });
  const io = new IntersectionObserver((es) => es.forEach((e) => {
    if (!e.isIntersecting) return;
    io.unobserve(e.target);
    const el = e.target as HTMLElement;
    el.style.opacity = '';
    el.animate([{ opacity: 0, transform: 'translateY(28px)' }, { opacity: 1, transform: 'none' }], { duration: 700, delay: (n++) * stagger, easing: 'cubic-bezier(.33,1,.68,1)', fill: 'backwards' });
    setTimeout(() => (n = Math.max(0, n - 1)), 120);
  }), { root: scroller, rootMargin: '0px 0px -15% 0px' });
  items.forEach((el) => io.observe(el));
  return () => io.disconnect();
}

/** #072 空状态的线条图：描边一笔一笔画出来 */
export function drawArt(root: Element | null) {
  if (!root || RM) return;
  root.querySelectorAll<SVGGeometryElement>('.ea path, .ea circle').forEach((p, i) => {
    const L = p.getTotalLength ? p.getTotalLength() : 120;
    p.style.strokeDasharray = String(L);
    p.animate([{ strokeDashoffset: L }, { strokeDashoffset: 0 }], { duration: 700, delay: 120 + i * 120, easing: 'cubic-bezier(.33,1,.68,1)', fill: 'backwards' });
  });
}

/** 弹性出现（GSAP elastic.out(1, 0.3) 的近似）：#159 的绿勾 */
export function elasticIn(el: Element | null) {
  if (!el) return;
  el.getAnimations().forEach((a) => a.cancel());
  if (RM) { (el as HTMLElement).style.transform = 'scale(1)'; return; }
  el.animate(sample((_t, q) => ({ transform: `scale(${q === 0 ? 0 : 1 - Math.pow(2, -10 * q) * Math.cos(q * 2 * Math.PI / .3)})` }), .6, 24), { duration: 600, fill: 'forwards' });
}
export function shrinkOut(el: Element | null) {
  if (!el) return;
  el.getAnimations().forEach((a) => a.cancel());
  el.animate([{ transform: 'scale(1)' }, { transform: 'scale(0)' }], { duration: 150, fill: 'forwards' });
}

/** 抖一下（填错时） */
export function shake(el: Element | null) {
  if (!el || RM) return;
  el.animate([{ transform: 'none' }, { transform: 'translateX(-6px)' }, { transform: 'translateX(6px)' }, { transform: 'translateX(-6px)' }, { transform: 'translateX(6px)' }, { transform: 'none' }],
    { duration: 420, easing: 'cubic-bezier(.36,.07,.19,.97)' });
}

/** 放大回弹一下 */
export function pop(el: Element | null) {
  if (!el || RM) return;
  el.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.12)' }, { transform: 'scale(.97)' }, { transform: 'scale(1)' }], { duration: 520, easing: 'cubic-bezier(.3,1.4,.5,1)' });
}
