// Motion Prompt #001 #010 #011 #022 #056 #069 #072 #074 #093 #122 #125 #146 #158 #159 #160 #161 #166 · MIT License · https://showheyohtaki.github.io/motion-prompt/
/*
  四个页面共用的动效。时长、缓动、弹簧公式照 motion-prompt 里各条的规格；颜色、内容换成健食自己的。
  每个函数都尊重「减少动态效果」：开了就直接到终点。
*/
(function () {
  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const eOut = (t) => 1 - Math.pow(1 - t, 3);
  const eInOut = (t) => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const qInOut = (t) => (t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
  const sample = (fn, dur, n = 40) => Array.from({ length: n + 1 }, (_, i) => fn(i / n * dur, i / n));

  /* #166 点赞：按前一瞬压到 0.78，点下去 0.12 s 冲到 1.45，再按 1+0.45·e^(−7t)·cos(15t) 落回 1；周围散一圈小粒子 */
  function like(el, color = '#10b981') {
    if (!el || RM) return;
    const kf = [{ transform: 'scale(1)', offset: 0 }, { transform: 'scale(.78)', offset: .1 / 1.1 }];
    const tail = sample((t) => 1 + .45 * Math.exp(-7 * (t)) * Math.cos(15 * t), .88, 22);
    kf.push({ transform: 'scale(1.45)', offset: .22 / 1.1 });
    tail.slice(1).forEach((s, i) => kf.push({ transform: `scale(${s})`, offset: (.22 + (i + 1) / 22 * .88) / 1.1 }));
    kf[kf.length - 1].offset = 1;
    el.animate(kf, { duration: 1100 });
    const host = el.offsetParent || el.parentElement, r = el.getBoundingClientRect(), hr = host.getBoundingClientRect();
    const sc = hr.width / host.offsetWidth || 1;
    const cx = (r.left - hr.left + r.width / 2) / sc, cy = (r.top - hr.top + r.height / 2) / sc, rad = r.width / sc / 2;
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * Math.PI * 2 + .2, d = document.createElement('i');
      d.style.cssText = `position:absolute;left:${cx}px;top:${cy}px;width:5px;height:5px;margin:-2.5px;border-radius:50%;background:${i % 2 ? color : '#f5a524'};pointer-events:none;z-index:5`;
      host.appendChild(d);
      d.animate([{ transform: 'translate(0,0) scale(1)', opacity: 1 }, { transform: `translate(${Math.cos(a) * (rad + 16)}px,${Math.sin(a) * (rad + 16)}px) scale(.3)`, opacity: 0 }], { duration: 560, delay: 100, easing: 'cubic-bezier(.2,.8,.3,1)', fill: 'backwards' }).onfinish = () => d.remove();
    }
  }

  /* #001 弹出：缩放按 1 − e^(−6.5t)·cos(15t)（最高约 1.26），同时从 −20° 按 1 − e^(−6t)·cos(11t) 转正 */
  function popIn(el, delay = 0) {
    if (!el || RM) return null;
    const kf = sample((t) => {
      const s = 1 - Math.exp(-6.5 * t) * Math.cos(15 * t), r = (1 - (1 - Math.exp(-6 * t) * Math.cos(11 * t))) * -20;
      return { transform: `scale(${Math.max(0, s)}) rotate(${r}deg)` };
    }, 1.0, 40);
    return el.animate(kf, { duration: 1000, delay, fill: 'backwards' });
  }
  /* #001 退场：先微微鼓一下再缩到 0（backIn，s = 2.2），0.26 s */
  function popOut(el) {
    if (!el || RM) return null;
    const s = 2.2, kf = sample((t, q) => ({ transform: `scale(${1 - (q * q * ((s + 1) * q - s))})` }), .26, 16);
    return el.animate(kf, { duration: 260, fill: 'forwards' });
  }

  /* #022 光扫过：116 px 白色光带（中间 0.72）+ 78 px 外一条 12 px 细带，斜 24°，1.05 s 二次缓动从左扫到右；末尾右上角闪一颗四角星 */
  function sweep(el, { delay = 0, star = true } = {}) {
    if (!el || RM) return;
    const cs = getComputedStyle(el);
    if (cs.position === 'static') el.style.position = 'relative';
    el.style.overflow = 'hidden';
    const w = el.offsetWidth, h = el.offsetHeight, band = document.createElement('i');
    band.style.cssText = `position:absolute;top:${-h}px;bottom:${-h}px;left:0;width:210px;pointer-events:none;z-index:3;
      background:linear-gradient(90deg,transparent 0,rgba(255,255,255,.72) 58px,transparent 116px,transparent 188px,rgba(255,255,255,.5) 194px,transparent 200px);transform-origin:center`;
    el.appendChild(band);
    const from = -130 - 210, to = w + 130, kf = sample((t, q) => ({ transform: `translateX(${from + (to - from) * qInOut(q)}px) rotate(24deg)` }), 1.05, 24);
    band.animate(kf, { duration: 1050, delay, fill: 'both' }).onfinish = () => band.remove();
    if (!star) return;
    const st = document.createElement('i');
    st.innerHTML = '<svg viewBox="-10 -10 20 20" width="20" height="20"><path d="M0-10Q1-1 10 0Q1 1 0 10Q-1 1-10 0Q-1-1 0-10Z" fill="#fff"/></svg>';
    st.style.cssText = 'position:absolute;right:6px;top:4px;pointer-events:none;z-index:4;line-height:0';
    el.appendChild(st);
    st.animate(sample((t, q) => ({ transform: `scale(${Math.sin(Math.PI * q) * (1 + .2 * (1 - q))}) rotate(${q * 52}deg)` }), .6, 16), { duration: 600, delay: delay + 930, fill: 'both' }).onfinish = () => st.remove();
  }

  /* #010 过冲：从当前值到目标 v = a + (b−a)·(1 − e^(−4.6t)·cos(10.5t))，约 0.3 s 时冲过头 25% 再回来。随时可以改目标（从当前值重新起步） */
  function overshoot(initial, onUpdate) {
    let cur = initial, from = initial, to = initial, t0 = 0, raf = 0;
    onUpdate(cur);
    const step = (now) => {
      const t = (now - t0) / 1000, k = 1 - Math.exp(-4.6 * t) * Math.cos(10.5 * t);
      cur = from + (to - from) * k; onUpdate(cur);
      if (t < 1.4) raf = requestAnimationFrame(step); else { cur = to; onUpdate(cur); raf = 0; }
    };
    const set = (v) => { from = cur; to = v; if (RM) { cur = v; onUpdate(v); return; } t0 = performance.now(); if (!raf) raf = requestAnimationFrame(step); };
    set.jump = (v) => { cancelAnimationFrame(raf); raf = 0; cur = from = to = v; onUpdate(v); };
    set.value = () => cur;
    return set;
  }

  /* #011 挤压拉伸：按下时压扁（纵向 0.82，横向 1/0.82，体积不变，脚底为支点）；松手先拉长 1.18 再弹回 */
  function squash(el) {
    if (!el) return;
    el.style.transformOrigin = '50% 100%';
    el.addEventListener('pointerdown', () => {
      if (RM) return;
      el.getAnimations().forEach((a) => a.cancel());
      el.animate([{ transform: 'scale(1,1)' }, { transform: `scale(${1 / .82},.82)` }], { duration: 110, easing: 'cubic-bezier(.2,.8,.3,1)', fill: 'forwards' });
    });
    const up = () => {
      if (RM) return;
      el.getAnimations().forEach((a) => a.cancel());
      const kf = sample((t) => { const sy = 1 + (.82 - 1) * Math.exp(-7 * t) * Math.cos(14 * t + Math.PI) * -1; return { transform: `scale(${1 / sy},${sy})` }; }, .7, 28);
      kf[0] = { transform: `scale(${1 / .82},.82)` };
      el.animate(kf, { duration: 700 });
    };
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
  }

  /* #122 跟随：停下的那一刻，身上的东西被惯性带着晃：角度按 a″ = −121a − 5.5a′ 衰减（固有频率 11 rad/s） */
  function followThrough(el, { kick = 14, delay = 0 } = {}) {
    if (!el || RM) return;
    const kf = sample((t) => ({ rotate: `${kick * Math.exp(-2.75 * t) * Math.sin(10.65 * t)}deg` }), 1.1, 36);
    el.animate(kf, { duration: 1100, delay, composite: 'add' });
  }

  /* #125 脉动：1 + 0.26·G(0.2 s) + 0.15·G(0.44 s)，两圈轮廓在 0.16 s / 0.40 s 从 1.2 扩到 2.4 倍（0.8 s，三次缓出） */
  function pulse(el, color = 'rgba(242,113,28,.55)') {
    if (!el || RM) return;
    const G = (t, c, w) => Math.exp(-Math.pow((t - c) / w, 2));
    el.animate(sample((t) => ({ transform: `scale(${1 + .26 * G(t, .2, .065) + .15 * G(t, .44, .07)})` }), .7, 42), { duration: 700 });
    const host = el.parentElement; if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
    [160, 400].forEach((d) => {
      const ring = document.createElement('i'), r = el.getBoundingClientRect(), hr = host.getBoundingClientRect(), sc = hr.width / host.offsetWidth || 1;
      const size = Math.max(r.width, r.height) / sc;
      ring.style.cssText = `position:absolute;left:${(r.left - hr.left) / sc + r.width / sc / 2 - size / 2}px;top:${(r.top - hr.top) / sc + r.height / sc / 2 - size / 2}px;width:${size}px;height:${size}px;border-radius:50%;border:2px solid ${color};pointer-events:none`;
      host.appendChild(ring);
      ring.animate(sample((t, q) => ({ transform: `scale(${1.2 + 1.2 * eOut(q)})`, opacity: 1 - q }), .8, 20), { duration: 800, delay: d, fill: 'both' }).onfinish = () => ring.remove();
    });
  }

  /* #074 进入视野淡入：越过视口 85% 那条线时，0.7 s 内透明度 0→1、从下方 28 px 升到原位（三次缓出） */
  function reveal(items, scroller, { stagger = 70 } = {}) {
    items = [...items];
    if (RM) return;
    items.forEach((el) => { el.style.opacity = 0; el.style.transform = 'translateY(28px)'; });
    let n = 0;
    const fire = (el) => {
      el.animate([{ opacity: 0, transform: 'translateY(28px)' }, { opacity: 1, transform: 'none' }], { duration: 700, delay: (n++) * stagger, easing: 'cubic-bezier(.33,1,.68,1)', fill: 'backwards' });
      el.style.opacity = ''; el.style.transform = '';
      setTimeout(() => n = Math.max(0, n - 1), 120);
    };
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { io.unobserve(e.target); fire(e.target); e.target.dispatchEvent(new Event('revealed')); } }), { root: scroller, rootMargin: '0px 0px -15% 0px' });
    items.forEach((el) => io.observe(el));
  }

  /* #093 平滑滚动：三次缓入缓出，296 px 用 1.05 s；距离短就按比例缩短（最少 0.45 s） */
  function scrollTop(scroller, to = 0) {
    const from = scroller.scrollTop, d = to - from; if (!d) return;
    if (RM) { scroller.scrollTop = to; return; }
    const dur = Math.max(450, Math.min(1050, Math.abs(d) / 296 * 1050)), t0 = performance.now();
    const step = (now) => { const q = Math.min(1, (now - t0) / dur); scroller.scrollTop = from + d * eInOut(q); if (q < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }

  /* #069 骨架屏：同形状的灰块（线性 0.15 s 切过去），一道 160 px 白光每 0.9 s 扫一遍；好了以后 0.3 s 换回内容 */
  const SK_CSS = `.sk{position:relative;overflow:hidden;background:#e7ecea;border-radius:14px}
    .sk::after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,transparent,rgba(255,255,255,.75) 50%,transparent);width:160px;animation:skShine .9s linear infinite}
    @keyframes skShine{from{transform:translateX(-200px)}to{transform:translateX(520px)}}
    @media (prefers-reduced-motion: reduce){.sk::after{animation:none}}`;
  function skeleton(el, html, ms = 900) {
    if (!document.getElementById('sk-css')) { const s = document.createElement('style'); s.id = 'sk-css'; s.textContent = SK_CSS; document.head.appendChild(s); }
    const real = el.innerHTML;
    el.innerHTML = html;
    return new Promise((res) => setTimeout(() => {
      el.innerHTML = real;
      if (!RM) el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300, easing: 'linear' });
      res();
    }, RM ? 0 : ms));
  }

  /* #160 加载按钮：0.3 s 缩成圆、转圈；完成时 0.2 s 变绿、0.25 s 画出对勾；0.35 s 展开成「对勾 + 完成」。
     完成后就停在这个样子（不会自己跳回去）；要恢复时调 resetButton，文字淡出淡入。 */
  function loadingButton(btn, { work = 900, done = '完成', color = '#10b981' } = {}) {
    if (btn._busy) return Promise.resolve();
    btn._busy = true;
    const w = btn.offsetWidth, h = btn.offsetHeight;
    if (!btn._lb) btn._lb = { label: btn.innerHTML, width: btn.style.width, bg: btn.style.background, color: btn.style.color, pad: btn.style.padding, ov: btn.style.overflow, ml: btn.style.marginLeft, mr: btn.style.marginRight };
    // 缩成圆的时候左右补上同样宽的外边距：按钮占的地方不变，旁边的东西不会被挤动
    const shrinkTo = (px) => { const d = (w - px) / 2; btn.style.width = px + 'px'; btn.style.marginLeft = d + 'px'; btn.style.marginRight = d + 'px'; };
    const doneHTML = `<span style="display:inline-flex;align-items:center;gap:6px;white-space:nowrap"><svg viewBox="0 0 24 24" width="18" height="18"><path d="M5 12l5 5L19 7" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="22" stroke-dashoffset="${RM ? 0 : 22}" style="animation:lbChk .25s ease-out forwards"/></svg><span style="opacity:${RM ? 1 : 0};transition:opacity .2s .2s" data-lbt>${done}</span></span>`;
    if (!document.getElementById('lb-css')) { const s = document.createElement('style'); s.id = 'lb-css'; s.textContent = '@keyframes lbSpin{to{transform:rotate(360deg)}}@keyframes lbChk{to{stroke-dashoffset:0}}'; document.head.appendChild(s); }
    btn.style.width = w + 'px'; btn.style.padding = '0'; btn.style.overflow = 'hidden';
    if (RM) { btn.style.background = color; btn.style.color = '#fff'; btn.innerHTML = doneHTML; btn._busy = false; return new Promise((r) => setTimeout(r, work)); }
    btn.style.transition = 'width .3s cubic-bezier(.65,0,.35,1), margin .3s cubic-bezier(.65,0,.35,1), background .2s';
    btn.style.display = 'inline-flex'; btn.style.alignItems = 'center'; btn.style.justifyContent = 'center';
    btn.innerHTML = `<svg viewBox="0 0 24 24" width="20" height="20" style="display:block;margin:auto;animation:lbSpin .8s linear infinite"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-opacity=".25" stroke-width="3"/><path d="M12 3a9 9 0 0 1 9 9" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>`;
    requestAnimationFrame(() => shrinkTo(Math.max(36, h)));
    return new Promise((res) => setTimeout(() => {
      btn.style.background = color; btn.style.color = '#fff';
      btn.innerHTML = doneHTML;
      setTimeout(() => { btn.style.transition = 'width .35s cubic-bezier(.65,0,.35,1), margin .35s cubic-bezier(.65,0,.35,1), background .2s'; shrinkTo(w); const t = btn.querySelector('[data-lbt]'); t && (t.style.opacity = 1); }, 200);
      setTimeout(() => { btn._busy = false; res(); }, 200 + 350);
    }, 300 + work));
  }
  // 把按钮还原：里面的字 0.15 s 淡出 → 换回原来的字和颜色 → 0.15 s 淡入
  function resetButton(btn, label) {
    const k = btn._lb; if (!k) { if (label != null) btn.innerHTML = label; return; }
    btn._lb = null;
    const swap = () => {
      btn.innerHTML = label != null ? label : k.label;
      Object.assign(btn.style, { width: k.width, background: k.bg, color: k.color, padding: k.pad, overflow: k.ov, marginLeft: k.ml, marginRight: k.mr, display: '', alignItems: '', justifyContent: '', transition: 'background .2s, color .2s' });
      if (!RM) btn.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 150 });
    };
    if (RM || !btn.offsetParent) { swap(); return; }
    const inner = btn.firstElementChild;
    if (inner) inner.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 150, fill: 'forwards' }).onfinish = swap; else swap();
  }

  /* #072 空状态：一张线条小图（描边画出来）+ 一句话 + 按钮，0.2 s 淡入 */
  function emptyArt(kind = 'bowl') {
    const paths = kind === 'search'
      ? '<circle cx="34" cy="34" r="18"/><path d="M47 47l14 14"/><path d="M26 34h16"/>'
      : '<path d="M10 34h52c0 15-11.6 26-26 26S10 49 10 34z"/><path d="M22 60h28"/><path d="M28 24c0-5 4-5 4-10M38 26c0-5 4-5 4-10"/>';
    return `<svg class="ea" viewBox="0 0 72 72" width="64" height="64" fill="none" stroke="#9aa39f" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" style="display:block;margin:0 auto">${paths}</svg>`;
  }
  function drawArt(root) {
    if (RM) return;
    root.querySelectorAll('.ea path, .ea circle').forEach((p, i) => {
      const L = p.getTotalLength ? p.getTotalLength() : 120;
      p.style.strokeDasharray = L; p.animate([{ strokeDashoffset: L }, { strokeDashoffset: 0 }], { duration: 700, delay: 120 + i * 120, easing: 'cubic-bezier(.33,1,.68,1)', fill: 'backwards' });
    });
  }

  /* #146 文字随滚动变深：第 n 个字的深度 = clamp(p × N − n)，p 是这段在视口里走过的比例 */
  function scrollText(el, scroller, { light = 'rgb(201,209,206)' } = {}) {
    const text = el.textContent, ink = getComputedStyle(el).color;
    el.innerHTML = [...text].map((c) => `<span>${c}</span>`).join('');
    const spans = [...el.children], N = spans.length;
    const parse = (c) => c.match(/\d+/g).map(Number);
    const [a, b] = [parse(light), parse(ink)];
    const paint = () => {
      const r = el.getBoundingClientRect(), sr = scroller.getBoundingClientRect();
      const p = RM ? 1 : Math.max(0, Math.min(1, (sr.bottom - r.top) / (r.height + 100)));   // 文字底边离屏幕下沿约 100 px 时全部变深
      spans.forEach((s, n) => { const k = Math.max(0, Math.min(1, p * (N + 2) - n)); s.style.color = `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * k)).join(',')})`; });
    };
    scroller.addEventListener('scroll', paint, { passive: true }); paint();
    return paint;
  }

  /* #056 提示条下沿一条细线，在显示时长内缩完 */
  function toastLine(toast, ms) {
    let line = toast.querySelector('.tl');
    if (!line) { line = document.createElement('i'); line.className = 'tl'; line.style.cssText = 'position:absolute;left:16px;right:16px;bottom:3px;height:2px;border-radius:2px;background:rgba(110,231,183,.85);transform-origin:left'; toast.appendChild(line); }
    line.getAnimations().forEach((a) => a.cancel());
    if (!RM) line.animate([{ transform: 'scaleX(1)' }, { transform: 'scaleX(0)' }], { duration: ms, easing: 'linear', fill: 'forwards' });
  }

  /* 底部导航：点当前页 → #093 平滑回顶；点别的页 → 内容 0.18 s 淡出，跳过去，新页卡片按 #074 依次浮出 */
  const PAGES = ['home-v5.html', 'trends.html', null, 'library.html', 'me.html'];
  function nav(root, scroller) {
    root.querySelectorAll('.nav > *').forEach((el, i) => {
      if (!PAGES[i]) return;
      el.style.cursor = 'pointer';
      el.addEventListener('click', () => {
        if (el.classList.contains('on')) { scrollTop(scroller); return; }
        if (RM) { location.href = PAGES[i]; return; }
        scroller.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(-8px)' }], { duration: 180, easing: 'ease-in', fill: 'forwards' }).onfinish = () => (location.href = PAGES[i]);
      });
    });
  }

  window.FX = { nav, RM, like, popIn, popOut, sweep, overshoot, squash, followThrough, pulse, reveal, scrollTop, skeleton, loadingButton, resetButton, emptyArt, drawArt, scrollText, toastLine, eOut, eInOut };
})();
