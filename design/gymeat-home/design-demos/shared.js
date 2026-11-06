/*
  三个完整版共用：演示数据、弹簧、安卓手机框、底部弹层（可拖拽关闭）、按压反馈。
  每个方向文件只负责自己的样子：定义 render(state) 和标记结构。
*/
(function () {
  const IMG = '../assets/img/';

  // ---------- 演示数据（和 spec.md 一致） ----------
  function initialState() {
    return {
      goal: 2000,
      meals: [
        { key: 'breakfast', name: '早餐', items: [{ n: '燕麦牛奶', k: 320, img: IMG + 'oatmeal.jpg' }, { n: '水煮蛋 ×2', k: 140, img: IMG + 'eggs.jpg' }] },
        { key: 'lunch', name: '午餐', items: [{ n: '鸡胸肉饭', k: 620, img: IMG + 'chicken-rice.jpg' }] },
        { key: 'snack', name: '加餐', items: [{ n: '苹果', k: 95, img: IMG + 'apple.jpg' }] },
        { key: 'dinner', name: '晚餐', items: [] },
      ],
      protein: 74.5, carbs: 144, fat: 32.3,
      cups: 5, weighed: true, streak: 12,
    };
  }
  // 添加面板里的快捷选项（「常吃」）
  const QUICK = [
    { n: '香煎三文鱼', k: 420, p: 38, img: IMG + 'salmon.jpg' },
    { n: '鸡胸肉饭', k: 620, p: 48, img: IMG + 'chicken-rice.jpg' },
    { n: '水煮蛋 ×2', k: 140, p: 12, img: IMG + 'eggs.jpg' },
    { n: '苹果', k: 95, p: 0.5, img: IMG + 'apple.jpg' },
  ];

  const eaten = (s) => s.meals.reduce((a, m) => a + m.items.reduce((b, i) => b + i.k, 0), 0);
  const mealKcal = (m) => m.items.reduce((b, i) => b + i.k, 0);
  const tasks = (s) => [
    { key: 'protein', name: '蛋白质吃够', short: '蛋白质', v: s.protein, max: 150, unit: 'g', fmt: (v) => (Math.round(v * 10) / 10) + '' },
    { key: 'water', name: '喝够 8 杯水', short: '喝水', v: s.cups, max: 8, unit: '杯', fmt: (v) => Math.round(v) + '' },
    { key: 'meals', name: '三餐都记上', short: '三餐', v: ['breakfast', 'lunch', 'dinner'].filter((k) => s.meals.find((m) => m.key === k).items.length).length, max: 3, unit: '', fmt: (v) => Math.round(v) + '' },
    { key: 'weight', name: '称一次体重', short: '体重', v: s.weighed ? 1 : 0, max: 1, unit: '', fmt: () => '66.4 kg' },
  ];

  // ---------- 弹簧：从当前值出发、可随时改目标（可打断） ----------
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  function spring(initial, onUpdate, { stiffness = 170, damping = 18 } = {}) {
    let x = initial, v = 0, target = initial, raf = 0, last = 0;
    function step(t) {
      const dt = Math.min(0.032, (t - last) / 1000 || 0.016); last = t;
      v += (-stiffness * (x - target) - damping * v) * dt; x += v * dt;
      if (Math.abs(v) < 0.02 && Math.abs(x - target) < 0.02) { x = target; v = 0; onUpdate(x); raf = 0; return; }
      onUpdate(x); raf = requestAnimationFrame(step);
    }
    onUpdate(x);
    const set = (to, vel) => {
      target = to; if (vel !== undefined) v = vel;
      if (reduced) { x = to; v = 0; onUpdate(x); return; }
      if (!raf) { last = performance.now(); raf = requestAnimationFrame(step); }
    };
    set.jump = (to) => { x = target = to; v = 0; onUpdate(x); };
    set.value = () => x;
    return set;
  }

  // ---------- 按压反馈：按下立刻缩、松手弹回；手机上轻震 ----------
  function pressable(root) {
    root.addEventListener('pointerdown', (e) => {
      const el = e.target.closest('[data-press]');
      if (!el) return;
      el.style.transition = 'transform 70ms ease-out';
      el.style.transform = el.dataset.press === 'sink' ? 'translateY(4px)' : 'scale(.95)';
      el.classList.add('is-pressed');
      if (navigator.vibrate) navigator.vibrate(8);
      const up = () => {
        el.style.transition = 'transform 380ms cubic-bezier(.3,1.6,.5,1)';
        el.style.transform = '';
        el.classList.remove('is-pressed');
        window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up);
      };
      window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
    });
  }

  // 「完成」的一下：放大回弹
  function pop(el) {
    if (!el || reduced) return;
    el.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.12)' }, { transform: 'scale(.97)' }, { transform: 'scale(1)' }], { duration: 520, easing: 'cubic-bezier(.3,1.4,.5,1)' });
  }

  // ---------- 安卓手机框（尺寸同 huashu-design 的 android_frame.jsx） ----------
  function phone({ dark = false, label = '' } = {}) {
    const wrap = document.createElement('div');
    wrap.className = 'pf';
    wrap.innerHTML = `
      ${label ? `<div class="pf-label">${label}</div>` : ''}
      <div class="pf-body"><div class="pf-screen">
        <div class="pf-status" style="color:${dark ? '#fff' : '#1a1a1a'}"><span>9:41</span><span class="pf-icons">
          <svg width="14" height="10" viewBox="0 0 14 10" fill="currentColor"><rect x="0" y="6" width="2" height="4" rx=".5"/><rect x="4" y="4" width="2" height="6" rx=".5"/><rect x="8" y="2" width="2" height="8" rx=".5"/><rect x="12" y="0" width="2" height="10" rx=".5"/></svg>
          <span class="pf-batt"><i></i></span><b>100%</b></span></div>
        <div class="pf-hole"></div>
        <div class="pf-content"></div>
        <div class="pf-gesture" style="background:${dark ? 'rgba(255,255,255,.55)' : 'rgba(0,0,0,.4)'}"></div>
      </div></div>`;
    return { wrap, content: wrap.querySelector('.pf-content'), screen: wrap.querySelector('.pf-screen') };
  }

  // ---------- 底部弹层：弹簧打开、拖拽跟手、甩一下就关 ----------
  function sheet(screen, sheetEl, backdrop, { onClose } = {}) {
    let h = 0, open = false;
    const pos = spring(1, (p) => {
      sheetEl.style.transform = `translateY(${p * 100}%)`;
      backdrop.style.opacity = String(1 - p);
      backdrop.style.pointerEvents = p < 0.98 ? 'auto' : 'none';
      sheetEl.style.visibility = p > 0.999 ? 'hidden' : 'visible';
    }, { stiffness: 260, damping: 26 });
    function show() { open = true; h = sheetEl.offsetHeight || 500; pos(0); }
    function hide(vel) { open = false; pos(1, vel); onClose && onClose(); }
    backdrop.addEventListener('click', () => hide());
    // 拖拽：跟手 1:1，越往上拉阻力越大（橡皮筋），松手看速度和位置决定关不关
    const grip = sheetEl.querySelector('[data-grip]') || sheetEl;
    let startY = 0, startP = 0, hist = [], dragging = false;
    grip.addEventListener('pointerdown', (e) => {
      if (e.target.closest('[data-press]') && !e.target.closest('[data-grip]')) return;
      dragging = true; startY = e.clientY; startP = pos.value(); hist = [[e.timeStamp, e.clientY]];
      h = sheetEl.offsetHeight; grip.setPointerCapture(e.pointerId);
    });
    grip.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const scale = screen.getBoundingClientRect().height / screen.offsetHeight || 1;
      let dy = (e.clientY - startY) / scale;
      if (dy < 0) dy = -(Math.abs(dy) * 60) / (60 + Math.abs(dy)); // 橡皮筋
      pos.jump(Math.max(-0.08, startP + dy / h));
      hist.push([e.timeStamp, e.clientY]); if (hist.length > 5) hist.shift();
    });
    const end = () => {
      if (!dragging) return; dragging = false;
      const [t0, y0] = hist[0], [t1, y1] = hist[hist.length - 1];
      const vel = (y1 - y0) / Math.max(1, t1 - t0) * 1000; // px/s
      const projected = pos.value() + (vel / 1000) * 0.998 / (1 - 0.998) / h; // 苹果的动量投影
      if (projected > 0.45) hide(vel / h); else pos(0, vel / h);
    };
    grip.addEventListener('pointerup', end); grip.addEventListener('pointercancel', end);
    return { show, hide, isOpen: () => open };
  }

  window.GYM = { IMG, QUICK, initialState, eaten, mealKcal, tasks, spring, pressable, pop, phone, sheet };
})();
