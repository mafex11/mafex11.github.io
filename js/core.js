/* Yuki website / core: one requestAnimationFrame loop for the whole page, cached scroll and pointer state,
   scroll scenes (progress 0..1 of a tall section with a sticky stage), reveals, parallax, and the mock-only
   screens pill. Everything that moves subscribes to Y.loop; nothing else calls requestAnimationFrame.
   Motion rules: transform and opacity only in the DOM; dots go to canvas. Reduced motion: every subscriber
   is asked for one static frame and the loop stops. Port: becomes a small React context + hooks
   (useLoop, useScene, useReveal) in the Next.js build. */
(function () {
  'use strict';
  const qs = new URLSearchParams(location.search);
  const mq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  const reduced = qs.get('motion') === 'reduced' || mq.matches;
  document.documentElement.dataset.motion = reduced ? 'reduced' : 'full';

  /* ---------------- maths ---------------- */
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const remap = (p, a, b) => clamp((p - a) / (b - a), 0, 1);
  const smooth = (t) => t * t * (3 - 2 * t);
  const easeIO = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);
  const hash = (x, y, s) => {
    let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul((s || 0) + 1, 1442695041)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };

  /* ---------------- view + pointer, read once per event, used by every frame ---------------- */
  const view = { w: innerWidth, h: innerHeight, y: scrollY };
  const pointer = { x: innerWidth / 2, y: innerHeight * 0.4, sx: innerWidth / 2, sy: innerHeight * 0.4, seen: false, down: false };

  /* ---------------- the loop ---------------- */
  const subs = new Set();
  let raf = 0, last = 0;
  const loop = {
    add(fn) { subs.add(fn); loop.kick(); return () => subs.delete(fn); },
    remove(fn) { subs.delete(fn); },
    kick() { if (!raf) raf = requestAnimationFrame(tick); }
  };
  function tick(now) {
    raf = 0;
    const t = now / 1000, dt = last ? Math.min(0.05, t - last) : 1 / 60; last = t;
    // pointer easing lives here so every layer reads the same smoothed value
    const k = reduced ? 1 : 1 - Math.pow(0.0009, dt);
    pointer.sx += (pointer.x - pointer.sx) * k; pointer.sy += (pointer.y - pointer.sy) * k;
    let more = Math.abs(pointer.x - pointer.sx) + Math.abs(pointer.y - pointer.sy) > 0.3;
    subs.forEach((fn) => { if (fn(t, dt) === true) more = true; });
    if (more && !reduced) loop.kick(); else last = 0;
  }
  let scrolledFlag = null;
  const markScrolled = () => { const f = scrollY > 8; if (f !== scrolledFlag) { scrolledFlag = f; document.documentElement.classList.toggle('scrolled', f); } };
  addEventListener('scroll', () => { view.y = scrollY; markScrolled(); loop.kick(); }, { passive: true });
  markScrolled();
  addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch') return;
    pointer.x = e.clientX; pointer.y = e.clientY; pointer.seen = true; loop.kick();
  }, { passive: true });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) loop.kick(); });

  /* ---------------- layout cache (measured on resize, never per frame) ---------------- */
  const measured = new Set();
  function measureAll() {
    view.w = innerWidth; view.h = innerHeight; view.y = scrollY;
    measured.forEach((m) => m());
    loop.kick();
  }
  let rq = 0;
  addEventListener('resize', () => { clearTimeout(rq); rq = setTimeout(measureAll, 80); });
  if (window.ResizeObserver) new ResizeObserver(() => { clearTimeout(rq); rq = setTimeout(measureAll, 80); }).observe(document.documentElement);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(measureAll);
  const docTop = (el) => { const r = el.getBoundingClientRect(); return r.top + scrollY; };

  /* is an element near the viewport: an IntersectionObserver flag, so frames skip what nobody sees */
  function watch(el, margin, cb) {
    const st = { on: false };
    if (!window.IntersectionObserver) { st.on = true; return st; }
    new IntersectionObserver((es) => { es.forEach((e) => { st.on = e.isIntersecting; if (cb) cb(st.on); if (st.on) loop.kick(); }); }, { rootMargin: margin || '10% 0px' }).observe(el);
    return st;
  }

  /* ---------------- scenes: a tall section, a sticky stage, progress 0..1 ----------------
     fn(p) runs only when p changes and the section is near the viewport. With reduced motion the
     section collapses (CSS) and fn gets one still frame at opt.still (default 1). */
  function scene(el, fn, opt) {
    opt = opt || {};
    if (reduced) { fn(opt.still == null ? 1 : opt.still, true); return; }
    let top = 0, len = 1, lastP = -1;
    const vis = watch(el, '30% 0px');
    measured.add(() => { top = docTop(el); len = Math.max(1, el.offsetHeight - view.h); lastP = -1; });
    top = docTop(el); len = Math.max(1, el.offsetHeight - view.h);
    loop.add(() => {
      if (!vis.on && lastP >= 0) return false;
      const p = clamp((view.y - top) / len, 0, 1);
      if (Math.abs(p - lastP) > 0.0002) { lastP = p; fn(p, false); }
      return false;
    });
  }
  /* track: progress of an element passing through the viewport (0 entering at the bottom, 1 leaving at the top) */
  function track(el, fn, opt) {
    opt = opt || {};
    if (reduced) { fn(opt.still == null ? 0.5 : opt.still, true); return; }
    let top = 0, hgt = 1, lastP = -1;
    const vis = watch(el, '10% 0px');
    measured.add(() => { top = docTop(el); hgt = el.offsetHeight; lastP = -1; });
    top = docTop(el); hgt = el.offsetHeight;
    loop.add(() => {
      if (!vis.on && lastP >= 0) return false;
      const p = clamp((view.y + view.h - top) / (view.h + hgt), 0, 1);
      if (Math.abs(p - lastP) > 0.0002) { lastP = p; fn(p, false); }
      return false;
    });
  }

  /* ---------------- reveals and parallax (declarative, from data attributes) ---------------- */
  function initReveals(root) {
    const els = (root || document).querySelectorAll('[data-reveal]');
    if (reduced || !window.IntersectionObserver) { els.forEach((e) => e.classList.add('in')); return; }
    const io = new IntersectionObserver((es) => es.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
    }), { rootMargin: '0px 0px -8% 0px' });
    els.forEach((e) => io.observe(e));
  }
  function initParallax() {
    if (reduced) return;
    const items = [...document.querySelectorAll('[data-px]')].map((el) => ({ el, k: Number(el.dataset.px), c: 0, last: 1e9 }));
    if (!items.length) return;
    const m = () => items.forEach((it) => { it.el.style.transform = ''; const r = it.el.getBoundingClientRect(); it.c = r.top + scrollY + r.height / 2; it.last = 1e9; });
    measured.add(m); m();
    loop.add(() => {
      const mid = view.y + view.h / 2;
      for (const it of items) {
        const d = it.c - mid;
        if (Math.abs(d) > view.h * 1.4) continue;
        const v = Math.round(-d * it.k * 10) / 10;
        if (v !== it.last) { it.last = v; it.el.style.transform = `translate3d(0,${v}px,0)`; }
      }
      return false;
    });
  }

  /* ---------------- the screens list (mock only) ---------------- */
  const SCREENS = [
    { g: 'Landing', items: [
      ['Top: hero', 'index.html'], ['01 Sees', 'index.html#sees'], ['02 Remembers', 'index.html#remembers'], ['03 Acts', 'index.html#acts'],
      ['04 Talks', 'index.html#talks'], ['05 Your PC is the brain', 'index.html#brain'], ['06 Any AI', 'index.html#ai'], ['07 Download', 'index.html#download'],
      ['Reduced motion', 'index.html?motion=reduced']] },
    { g: 'Sign in', items: [
      ['Enter email', 'login.html#email'], ['Create account', 'login.html#create'], ['Invalid email', 'login.html#invalid'],
      ['Check your inbox', 'login.html#sent'], ['Link expired', 'login.html#expired'], ['Signed in', 'login.html#signed-in']] },
    { g: 'Link your PC', items: [
      ['On the PC: sign in', 'link.html#start'], ['Waiting for the code', 'link.html#waiting'], ['Wrong code', 'link.html#wrong'], ['Code expired', 'link.html#expired'],
      ['Linked', 'link.html#linked'], ['Unlink a device', 'link.html#unlink']] },
    { g: 'Web dashboard', items: [
      ['Home', 'app.html#home'], ['Work', 'app.html#work'], ['Day', 'app.html#day'], ['Calls', 'app.html#calls'],
      ['Memory', 'app.html#memory'], ['Settings', 'app.html#settings'],
      ['Open Spotify: running', 'app.html#home&run=spotify'], ['Open Spotify: done', 'app.html#home&run=spotify&at=done'],
      ['Open Spotify: stopped', 'app.html#home&run=spotify&at=stopped'], ['Ask: what’s on my list', 'app.html#home&ask=list'],
      ['PC offline', 'app.html#home&offline'], ['Offline: queue it?', 'app.html#home&offline&run=spotify'], ['Offline: queued', 'app.html#home&offline&run=spotify&at=queued']] },
    { g: 'Other', items: [['Privacy', 'privacy.html'], ['Terms', 'terms.html'], ['Status', 'status.html']] }
  ];
  function mockPill() {
    const here = location.pathname.split('/').pop() || 'index.html';
    const wrap = document.createElement('div');
    wrap.className = 'mockpill';
    let html = '<button type="button" aria-expanded="false"><i></i>Screens</button><div class="panel" role="menu">';
    SCREENS.forEach((s) => {
      html += `<h6>${s.g}</h6>`;
      s.items.forEach(([n, href]) => {
        const [file, hsh] = href.split('#');
        const isHere = file.split('?')[0] === here && ((location.hash.slice(1) || '') === (hsh || '') || (!location.hash && !hsh));
        html += `<a href="${href}" class="${isHere ? 'here' : ''}">${n}<span>${hsh ? '#' + hsh.split('&')[0] : file.replace('.html', '')}</span></a>`;
      });
    });
    html += '<div class="all"><a href="screens.html">All screens, one page<span>screens</span></a></div></div>';
    wrap.innerHTML = html;
    document.body.appendChild(wrap);
    const b = wrap.querySelector('button');
    b.addEventListener('click', (e) => { e.stopPropagation(); const o = wrap.classList.toggle('open'); b.setAttribute('aria-expanded', o); });
    document.addEventListener('click', (e) => { if (!wrap.contains(e.target)) { wrap.classList.remove('open'); b.setAttribute('aria-expanded', 'false'); } });
    wrap.querySelectorAll('.panel a').forEach((a) => a.addEventListener('click', () => {
      // same page, new state: hashchange does the work, then close
      setTimeout(() => wrap.classList.remove('open'), 0);
    }));
  }

  /* ---------------- the Y mark as SVG (from packaging/icon/y, 64 px layout) ---------------- */
  const Y_DOTS = [[13.5, 10.5], [19.5, 16.5], [25.5, 22.5], [49.5, 10.5], [43.5, 16.5], [37.5, 22.5], [31.5, 36.5], [31.5, 44.5], [31.5, 52.5]];
  function ymarkSVG(opt) {
    opt = opt || {};
    const tile = opt.tile === false ? '' : `<rect x=".5" y=".5" width="63" height="63" rx="13" fill="#0B0B0C" stroke="#2A2D31"/>`;
    const ink = opt.ink || '#F2EFE9';
    return `<svg class="${opt.cls || 'ymark'}" viewBox="0 0 64 64" aria-hidden="true">${tile}${Y_DOTS.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3.5" fill="${ink}"/>`).join('')}<circle cx="31.5" cy="28.5" r="3.5" fill="#6FEBC4"/></svg>`;
  }
  function fillMarks() { document.querySelectorAll('[data-ymark]').forEach((el) => { el.innerHTML = ymarkSVG({ tile: el.dataset.ymark !== 'bare', cls: el.dataset.cls || 'ymark' }); }); }

  /* tiny dot icons: 5x5 grids */
  const DIC = {
    check: ['00000', '00001', '00010', '10100', '01000'],
    arrow: ['00100', '00010', '11111', '00010', '00100'],
    lock: ['01110', '01010', '11111', '11011', '11111'],
    stop: ['11111', '11111', '11111', '11111', '11111'],
    play: ['10000', '11100', '11111', '11100', '10000'],
    dot: ['00000', '01110', '01110', '01110', '00000'],
    plus: ['00100', '00100', '11111', '00100', '00100'],
    x: ['10001', '01010', '00100', '01010', '10001'],
    pc: ['11111', '10001', '11111', '00100', '01110'],
    globe: ['01110', '10101', '11111', '10101', '01110'],
    mic: ['01110', '01110', '01110', '10101', '01110']
  };
  function dic(name, cls) {
    const g = DIC[name] || DIC.dot; let c = '';
    g.forEach((row, y) => { for (let x = 0; x < 5; x++) if (row[x] === '1') c += `<circle cx="${x * 3 + 1.5}" cy="${y * 3 + 1.5}" r="1.15"/>`; });
    return `<svg class="${cls || 'dic'}" viewBox="0 0 15 15" aria-hidden="true">${c}</svg>`;
  }
  function fillIcons(root) { (root || document).querySelectorAll('[data-dic]').forEach((el) => { if (!el.firstChild) el.innerHTML = dic(el.dataset.dic); }); }

  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => [...(r || document).querySelectorAll(s)];
  const hashTokens = () => {
    const out = {}; (location.hash.slice(1) || '').split('&').filter(Boolean).forEach((p) => { const [k, v] = p.split('='); out[decodeURIComponent(k)] = v == null ? true : decodeURIComponent(v); });
    return out;
  };

  window.Y = { reduced, view, pointer, loop, scene, track, watch, measured, measureAll, initReveals, initParallax, mockPill, SCREENS,
    ymarkSVG, fillMarks, dic, fillIcons, clamp, lerp, remap, smooth, easeIO, easeOut, hash, $, $$, hashTokens };

  document.addEventListener('DOMContentLoaded', () => {
    fillMarks(); fillIcons(); initReveals(); initParallax();
    if (!document.body.hasAttribute('data-no-pill')) mockPill();
  });
})();
