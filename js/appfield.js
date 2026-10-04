/* Yuki web dashboard / the field behind the window, as in the PC app (3-lattice/field.js, rewritten small for the web):
   - a fixed grid of resting dots; every [data-clear] panel is a clearing (dots shrink to nothing near it, 20 px feather);
   - [data-figure="num"] draws a big 5x7 numeral in lit dots (the page's count), [data-figure="bars"] a week of dot bars;
   - pulse(x, y): one ring of live dots from a point, when something streams in from the PC.
   It only repaints when the layout moves (scroll, resize, a tab change) or while a pulse runs.
   Port: components/AppField.tsx (client), reading clearings through a small registry instead of querySelectorAll. */
(function () {
  'use strict';
  const K = window.DotKit;
  const DIG = {
    0: ['01110', '10001', '10011', '10101', '11001', '10001', '01110'], 1: ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
    2: ['01110', '10001', '00001', '00010', '00100', '01000', '11111'], 3: ['11110', '00001', '00001', '01110', '00001', '00001', '11110'],
    4: ['00010', '00110', '01010', '10010', '11111', '00010', '00010'], 5: ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
    6: ['00110', '01000', '10000', '11110', '10001', '10001', '01110'], 7: ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
    8: ['01110', '10001', '10001', '01110', '10001', '10001', '01110'], 9: ['01110', '10001', '10001', '01111', '00001', '00010', '01100']
  };
  function mount(cv) {
    const { loop, reduced, view } = window.Y;
    const ctx = cv.getContext('2d', { alpha: false });
    const DPR = Math.min(2, window.devicePixelRatio || 1);
    const P = 12;
    let W = 0, H = 0, C = 0, R = 0, mask = null, lit = null, tone = null, A = null, dirty = true, pulses = [], off = false, t0 = performance.now() / 1000;
    function size() {
      W = innerWidth; H = innerHeight;
      cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
      cv.style.width = W + 'px'; cv.style.height = H + 'px';
      C = Math.ceil(W / P); R = Math.ceil(H / P);
      mask = new Float32Array(C * R); lit = new Float32Array(C * R); tone = new Uint8Array(C * R);
      A = K.atlas(['#26292C', '#3A3E43', K.COL.mid, K.COL.bone, K.COL.live], P * 0.32, 18, DPR);
      dirty = true; loop.kick();
    }
    function measure() {
      mask.fill(1); lit.fill(0); tone.fill(0);
      const F = 20, M = 4;
      document.querySelectorAll('[data-clear]').forEach((el) => {
        const r = el.getBoundingClientRect();
        if (!r.width || r.bottom < -40 || r.top > H + 40) return;
        const x0 = Math.max(0, Math.floor((r.left - F - M) / P)), x1 = Math.min(C - 1, Math.ceil((r.right + F + M) / P));
        const y0 = Math.max(0, Math.floor((r.top - F - M) / P)), y1 = Math.min(R - 1, Math.ceil((r.bottom + F + M) / P));
        for (let j = y0; j <= y1; j++) {
          const cy = j * P + P / 2, dy = Math.max(r.top - M - cy, 0, cy - r.bottom - M);
          for (let i = x0; i <= x1; i++) {
            const cx = i * P + P / 2, dx = Math.max(r.left - M - cx, 0, cx - r.right - M);
            const d = Math.hypot(dx, dy), m = d <= 0 ? 0 : Math.min(1, d / F), k = j * C + i;
            if (m < mask[k]) mask[k] = m;
          }
        }
      });
      document.querySelectorAll('[data-figure]').forEach((el) => {
        const r = el.getBoundingClientRect();
        if (!r.width || r.bottom < 0 || r.top > H) return;
        const i0 = Math.round(r.left / P), j0 = Math.round(r.top / P), ci = Math.floor(r.width / P), cj = Math.floor(r.height / P);
        const put = (i, j, v, t) => { if (i < 0 || j < 0 || i >= C || j >= R) return; const k = j * C + i; lit[k] = Math.max(lit[k], v); tone[k] = t || 0; mask[k] = 1; };
        if (el.dataset.figure === 'num') {
          const s = String(el.dataset.value || '0'), sc = Number(el.dataset.scale || 2);
          const glyphs = [...s].map((ch) => DIG[ch]).filter(Boolean);
          const total = glyphs.length * 6 * sc - sc;
          let ox = i0 + ci - total;
          glyphs.forEach((g) => {
            for (let y = 0; y < 7; y++) for (let x = 0; x < 5; x++) if (g[y][x] === '1') for (let a = 0; a < sc; a++) for (let b = 0; b < sc; b++) put(ox + x * sc + a, j0 + y * sc + b, 1, el.dataset.live && y * sc + b >= 7 * sc - sc ? 4 : 3);
            ox += 6 * sc;
          });
        } else if (el.dataset.figure === 'bars') {
          const vals = (el.dataset.values || '').split(',').map(Number);
          const max = Math.max(...vals, 1);
          vals.forEach((v, n) => {
            const h = Math.max(1, Math.round((v / max) * cj)), last = n === vals.length - 1;
            for (let y = 0; y < h; y++) for (let a = 0; a < 2; a++) put(i0 + n * 3 + a, j0 + cj - 1 - y, last ? 1 : 0.75, last && y === h - 1 ? 4 : last ? 3 : 2);
          });
        }
      });
    }
    function draw(t) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = '#0B0B0C'; ctx.fillRect(0, 0, cv.width, cv.height);
      A.begin(ctx);
      const e = reduced ? 99 : t - t0;
      for (let j = 0; j < R; j++) for (let i = 0; i < C; i++) {
        const k = j * C + i, m = mask[k];
        const x = i * P + P / 2, y = j * P + P / 2;
        if (lit[k] > 0) {
          const grow = Math.min(1, Math.max(0, (e - 0.1 - (i % 40) * 0.012) / 0.35));
          A.dot(ctx, x, y, P * (0.12 + 0.2 * lit[k] * grow), off && tone[k] === 4 ? 2 : tone[k], 0.35 + 0.65 * lit[k] * grow);
          continue;
        }
        if (m < 0.06) continue;
        let r = (0.55 + 0.6 * m), row = 0, a = 1;
        for (const p of pulses) {
          const dd = Math.abs(Math.hypot(x - p.x, y - p.y) - (t - p.t) * 420);
          if (dd < 22) { const f = (1 - dd / 22) * Math.max(0, 1 - (t - p.t) / 0.8); if (f > 0.05) { r = Math.max(r, 1 + 1.6 * f); row = f > 0.55 ? 4 : f > 0.25 ? 2 : 1; a = Math.min(1, 0.25 + f * 0.8); } }
        }
        A.dot(ctx, x, y, r, row, a);
      }
    }
    let lastY = -1;
    loop.add((t) => {
      if (view.y !== lastY) { lastY = view.y; dirty = true; }
      pulses = pulses.filter((p) => t - p.t < 0.85);
      const anim = pulses.length > 0 || (!reduced && t - t0 < 1.2);
      if (dirty || anim) { if (dirty) measure(); draw(t); dirty = false; }
      return anim;
    });
    addEventListener('resize', size);
    size();
    return {
      remeasure() { dirty = true; t0 = performance.now() / 1000; loop.kick(); },
      refresh() { dirty = true; loop.kick(); },
      pulse(x, y) { if (reduced) return; pulses.push({ x, y, t: performance.now() / 1000 }); loop.kick(); },
      setOffline(v) { off = v; dirty = true; loop.kick(); }
    };
  }
  window.AppField = { mount };
})();
