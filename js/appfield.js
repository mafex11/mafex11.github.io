/* Yuki web dashboard / the field behind the window, as in the PC app (3-lattice/field.js, rewritten small for the web):
   - a fixed grid of resting dots; every [data-clear] panel is a clearing (dots shrink to nothing near it, 20 px feather);
   - [data-figure="num"] draws a big 5x7 numeral in lit dots (the page's count), [data-figure="bars"] a week of dot bars;
   - pulse(x, y): one ring of live dots from a point, when something streams in from the PC.
   - pulse rings are clipped to the gutters: their strength is scaled by the clearing mask, so they fade out in
     the feather and never cut across a panel;
   - the lens (round 2, fx "lens", DotKit.lensK): over the gutters only, the dots under the pointer swell and
     brighten. It is a small canvas laid over the field and moved by transform; it repaints only its ~22 x 22
     cells, with the same paint() as the field, so its edges match the field exactly. Touch: the tap point for
     700 ms. Off with reduced motion. It rides the field's one Y.loop subscriber (no loop of its own).
   It only repaints when the layout moves (scroll, resize, a tab change), while a pulse runs, or while the lens moves.
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
    const { loop, reduced, view, pointer } = window.Y;
    const ctx = cv.getContext('2d', { alpha: false });
    const DPR = Math.min(2, window.devicePixelRatio || 1);
    const P = 12;
    let W = 0, H = 0, C = 0, R = 0, mask = null, lit = null, tone = null, A = null, dirty = true, pulses = [], off = false, t0 = performance.now() / 1000;
    // the lens overlay: N x N cells, snapped to the grid, moved by transform
    const LR = 120, N = Math.ceil((2 * LR) / P) + 2;
    const ov = document.createElement('canvas');
    ov.className = 'field-lens'; ov.setAttribute('aria-hidden', 'true');
    cv.after(ov);
    const octx = ov.getContext('2d', { alpha: false });
    const hoverMQ = window.matchMedia('(hover: hover) and (pointer: fine)');
    let lensOn = false, gutter = false, inside = true, tap = null, tapT = 0, lastLx = -1, lastLy = -1, lastOx = 1e9, lastOy = 1e9;
    let BG = '#0B0B0C';   // the page black (--bg), read when the field is sized
    function size() {
      W = innerWidth; H = innerHeight;
      BG = K.tok('--bg', '#0B0B0C');
      cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
      cv.style.width = W + 'px'; cv.style.height = H + 'px';
      C = Math.ceil(W / P); R = Math.ceil(H / P);
      mask = new Float32Array(C * R); lit = new Float32Array(C * R); tone = new Uint8Array(C * R);
      A = K.atlas([K.COL.base, K.COL.base2, K.COL.mid, K.COL.bone, K.COL.live], P * 0.32, 18, DPR);
      ov.width = Math.round(N * P * DPR); ov.height = Math.round(N * P * DPR);
      ov.style.width = N * P + 'px'; ov.style.height = N * P + 'px';
      lastOx = 1e9;
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
    // one cell's dot, shared by the field and the lens overlay. (ox, oy): the target canvas's offset in CSS px;
    // lens: { x, y } pointer in CSS px, or null
    function cell(c, i, j, t, e, ox, oy, lens) {
      const k = j * C + i, m = mask[k];
      const x = i * P + P / 2, y = j * P + P / 2;
      if (lit[k] > 0) {
        const grow = Math.min(1, Math.max(0, (e - 0.1 - (i % 40) * 0.012) / 0.35));
        A.dot(c, x - ox, y - oy, P * (0.12 + 0.2 * lit[k] * grow), off && tone[k] === 4 ? 2 : tone[k], 0.35 + 0.65 * lit[k] * grow);
        return;
      }
      if (m < 0.06) return;
      let r = (0.55 + 0.6 * m), row = 0, a = 1;
      for (const p of pulses) {
        const dd = Math.abs(Math.hypot(x - p.x, y - p.y) - (t - p.t) * 420);
        if (dd < 22) {
          // clipped to the gutters: the mask fades the ring out in the feather around every panel
          const f = (1 - dd / 22) * Math.max(0, 1 - (t - p.t) / 0.8) * m * m;
          if (f > 0.05) { r = Math.max(r, 1 + 1.6 * f); row = f > 0.55 ? 4 : f > 0.25 ? 2 : 1; a = Math.min(1, 0.25 + f * 0.8); }
        }
      }
      if (lens) {
        const q = K.lensK(x - lens.x, y - lens.y, LR) * m;
        if (q > 0) { r *= 1 + 0.8 * q; if (q > 0.35 && row === 0) row = 1; if (q > 0.8 && row < 2) row = 2; }
      }
      A.dot(c, x - ox, y - oy, r, row, a);
    }
    function draw(t) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = BG; ctx.fillRect(0, 0, cv.width, cv.height);
      A.begin(ctx);
      const e = reduced ? 99 : t - t0;
      for (let j = 0; j < R; j++) for (let i = 0; i < C; i++) cell(ctx, i, j, t, e, 0, 0, null);
    }
    // the lens: where it is (pointer or tap) and whether it should show (gutters only)
    function lensAt(t) {
      if (reduced) return null;
      if (tap) { if (t - tapT < 0.7) return tap; tap = null; }
      if (!hoverMQ.matches || !pointer.seen || !inside || !gutter) return null;
      const i = Math.floor(pointer.sx / P), j = Math.floor(pointer.sy / P);
      if (i < 0 || j < 0 || i >= C || j >= R || mask[j * C + i] < 0.5) return null;
      return { x: pointer.sx, y: pointer.sy };
    }
    function drawLens(t, L) {
      const i0 = Math.floor((L.x - LR) / P), j0 = Math.floor((L.y - LR) / P), ox = i0 * P, oy = j0 * P;
      if (ox !== lastOx || oy !== lastOy) { ov.style.transform = `translate3d(${ox}px,${oy}px,0)`; lastOx = ox; lastOy = oy; }
      octx.setTransform(1, 0, 0, 1, 0, 0);
      octx.fillStyle = BG; octx.fillRect(0, 0, ov.width, ov.height);
      A.begin(octx);
      const e = reduced ? 99 : t - t0;
      for (let j = Math.max(0, j0); j < Math.min(R, j0 + N); j++) for (let i = Math.max(0, i0); i < Math.min(C, i0 + N); i++) cell(octx, i, j, t, e, ox, oy, L);
    }
    // pointer over a gutter, not a panel, a control or the bars (one closest() per pointerover, never per frame)
    const BLOCK = '[data-clear], .topbar, .tabs-m, .offbar, .askdock .thread, .ask, .hints, a, button, input, label';
    document.addEventListener('pointerover', (ev) => { if (ev.pointerType === 'touch') return; gutter = !(ev.target.closest && ev.target.closest(BLOCK)); loop.kick(); }, { passive: true });
    document.documentElement.addEventListener('pointerleave', () => { inside = false; loop.kick(); });
    document.documentElement.addEventListener('pointerenter', () => { inside = true; });
    document.addEventListener('pointerdown', (ev) => {
      if (reduced || ev.pointerType !== 'touch' || (ev.target.closest && ev.target.closest(BLOCK))) return;
      tap = { x: ev.clientX, y: ev.clientY }; tapT = performance.now() / 1000; loop.kick();
    }, { passive: true });
    let lastY = -1;
    loop.add((t) => {
      if (view.y !== lastY) { lastY = view.y; dirty = true; }
      pulses = pulses.filter((p) => t - p.t < 0.85);
      const anim = pulses.length > 0 || (!reduced && t - t0 < 1.2);
      const redraw = dirty || anim;
      if (redraw) { if (dirty) measure(); draw(t); dirty = false; }
      const L = lensAt(t);
      if (L) {
        if (redraw || Math.abs(L.x - lastLx) + Math.abs(L.y - lastLy) > 0.25) { drawLens(t, L); lastLx = L.x; lastLy = L.y; }
        if (!lensOn) { lensOn = true; ov.classList.add('on'); }
      } else if (lensOn) { lensOn = false; ov.classList.remove('on'); lastLx = -1; }
      return anim || !!tap;
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
