/* Yuki website / a small living field for the sign-in and link pages: resting dots, a pointer lens, and the
   Y mark as ten big dots (the app icon's layout) with a slow listening ring around its mint joint.
   FieldCanvas.mount(canvas, { mark: true, anchor: el, size: 0.5 }) -> { setState('idle'|'busy'|'done'), lean(on) }.
   'busy' turns the ring into a travelling read head; 'done' fills the joint and sends one ripple out.
   Round 2 (18 Oct):
   - the lens uses the shared falloff DotKit.lensK (fx "lens"): dots swell up to 1.8x and brighten one step;
   - lean(true) speeds the listening ring up 1.5x (the page calls it while its main key is hovered or focused),
     eased so the ring never jumps;
   - a tap or click on the field sends a ripple from that point (at most one per 400 ms, three at once).
   Reduced motion: one still frame per change; no lens, no ripples, no lean.
   Draws from the one core loop (Y.loop); no rAF of its own.
   Port: components/FieldCanvas.tsx (client component), drawing code shared with the hero via lib/dotkit. */
(function () {
  'use strict';
  const K = window.DotKit;
  const Y_GRID = [[13.5, 10.5], [19.5, 16.5], [25.5, 22.5], [49.5, 10.5], [43.5, 16.5], [37.5, 22.5], [31.5, 36.5], [31.5, 44.5], [31.5, 52.5]];
  const JOINT = [31.5, 28.5];

  function mount(cv, opt) {
    opt = opt || {};
    const { loop, pointer, reduced, clamp, hash } = window.Y;
    const ctx = cv.getContext('2d', { alpha: false });
    const DPR = Math.min(2, window.devicePixelRatio || 1);
    const vis = window.Y.watch(cv, '0px');
    let W = 0, H = 0, P = 14, A = null, box = { x: 0, y: 0 }, scale = 1, state = 'idle', st0 = performance.now() / 1000;
    const t0 = performance.now() / 1000;
    // the ring's phase is integrated so a speed change (lean) never makes the head jump
    let ph = 0, speed = 1, speedTo = 1, lastT = 0;
    const ripples = []; let lastRip = 0;
    function layout() {
      const r = cv.getBoundingClientRect();
      W = Math.max(1, Math.round(r.width)); H = Math.max(1, Math.round(r.height));
      cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
      P = W < 500 ? 12 : 14;
      A = K.atlas(['#2B2E32', '#3A3E43', K.COL.mid, K.COL.bone, K.COL.live], P * 0.34, 20, DPR);
      const side = Math.min(W, H) * (opt.size || 0.5);
      scale = side / 64;
      if (opt.anchor) { const a = opt.anchor.getBoundingClientRect(); box = { x: a.left - r.left + a.width / 2 - side / 2, y: a.top - r.top + a.height / 2 - side / 2 }; }
      else box = { x: (W - side) / 2, y: (H - side) / 2 };
      cv._left = r.left; cv._top = r.top;
      draw(performance.now() / 1000);
    }
    function draw(t) {
      const e = reduced ? 99 : t - t0, s = t - st0;
      const dt = lastT ? Math.min(0.05, Math.max(0, t - lastT)) : 0; lastT = t;
      speed += (speedTo - speed) * (1 - Math.pow(0.02, dt));
      ph += dt * speed;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = '#0B0B0C'; ctx.fillRect(0, 0, cv.width, cv.height);
      const px = pointer.sx - (cv._left || 0), py = pointer.sy - (cv._top || 0);
      const LR = 150, baseR = P * 0.09;
      const jx = box.x + JOINT[0] * scale, jy = box.y + JOINT[1] * scale;
      const dotR = 3.5 * scale;
      // drop finished ripples (1.4 s each)
      for (let q = ripples.length - 1; q >= 0; q--) if (t - ripples[q].t > 1.4) ripples.splice(q, 1);
      const lensOn = pointer.seen && !reduced && px > -LR && py > -LR && px < W + LR && py < H + LR;
      A.begin(ctx);
      const C = Math.ceil(W / P), R = Math.ceil(H / P);
      // ring radius (listening) / read head (busy) / ripple (done)
      const ringR = (4.6 + (reduced ? 0 : 0.25 * Math.sin(ph * 2.4))) * dotR;
      const ripR = state === 'done' ? s * 520 : -1;
      for (let j = 0; j < R; j++) for (let i = 0; i < C; i++) {
        let x = i * P + P / 2, y = j * P + P / 2, r = baseR, row = 0, a = 1;
        // clear around the mark's dots
        let near = 1e9;
        for (const g of Y_GRID) { const dx = x - (box.x + g[0] * scale), dy = y - (box.y + g[1] * scale); near = Math.min(near, dx * dx + dy * dy); }
        const dj = Math.hypot(x - jx, y - jy);
        near = Math.min(Math.sqrt(near), dj);
        if (near < dotR + 10) { const k = (near - dotR) / 10; if (k <= 0.05) continue; r *= k; }
        // the ring around the joint
        if (opt.mark !== false) {
          const dr = Math.abs(dj - ringR);
          if (dr < P * 0.8) {
            const ang = Math.atan2(y - jy, x - jx);
            const head = state === 'busy' ? Math.pow(Math.max(0, Math.cos(ang - ph * 3.2)), 10) : Math.pow(Math.max(0, Math.cos(ang - ph * 1.2)), 14) * (0.6 + 0.25 * (speed - 1) * 2);
            const f = 1 - dr / (P * 0.8);
            r = Math.max(r, baseR + f * P * (0.12 + 0.12 * head));
            row = head > 0.35 ? 4 : 2; a = 0.25 + 0.75 * f * (0.45 + 0.55 * head);
          }
        }
        if (ripR > 0 && !reduced) { const dd = Math.abs(dj - ripR); if (dd < 40) { const f = (1 - dd / 40) * Math.max(0, 1 - s / 1.6); r = Math.max(r, baseR * (1 + 1.4 * f)); if (f > 0.2) { row = 4; a = 0.3 + 0.6 * f; } } }
        // tap ripples: a ring of brighter dots from the tap point
        for (let q = 0; q < ripples.length; q++) {
          const rp = ripples[q], age = t - rp.t, rr = age * 360, dd = Math.abs(Math.hypot(x - rp.x, y - rp.y) - rr);
          if (dd < 28) { const f = (1 - dd / 28) * Math.max(0, 1 - age / 1.4); r = Math.max(r, baseR * (1 + 1.3 * f)); if (f > 0.25 && row < 2) { row = 2; a = 0.35 + 0.55 * f; } }
        }
        // the lens (shared falloff): a small push, a swell up to 1.8x, one brighter step
        if (lensOn) {
          const dx = x - px, dy = y - py, k = K.lensK(dx, dy, LR);
          if (k > 0) {
            const d = Math.max(1, Math.hypot(dx, dy)), push = k * 5 / d;
            x += dx * push; y += dy * push;
            r = Math.max(r, baseR * (1 + 0.8 * k) + k * P * 0.06);
            if (row === 0) { row = k > 0.35 ? 2 : 1; a = Math.min(1, 0.3 + k); }
          }
        }
        if (!reduced && row === 0 && hash(i, j, 3) > 0.988) { const tw = 0.5 + 0.5 * Math.sin(t * 0.7 + hash(i, j, 4) * 30); row = 2; a = 0.15 + 0.4 * tw; r = baseR * (1.1 + tw * 0.6); }
        A.dot(ctx, x, y, r, row, a);
      }
      if (opt.mark === false) return;
      // the Y: grows in from the joint outwards
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      const pts = Y_GRID.map((g) => [box.x + g[0] * scale, box.y + g[1] * scale]);
      pts.forEach(([x, y]) => {
        const d = Math.hypot(x - jx, y - jy) / (dotR * 8);
        const k = clamp((e - 0.15 - d * 0.35) / 0.4, 0, 1), kk = 1 - Math.pow(1 - k, 3);
        if (kk <= 0) return;
        ctx.globalAlpha = 1; ctx.fillStyle = K.COL.bone;
        ctx.beginPath(); ctx.arc(x, y, dotR * kk, 0, 6.2832); ctx.fill();
      });
      const kj = clamp(e / 0.35, 0, 1);
      const pulse = reduced ? 1 : state === 'busy' ? 0.7 + 0.3 * Math.sin(t * 6) : 0.85 + 0.15 * Math.sin(ph * 2.2);
      ctx.globalAlpha = kj * pulse; ctx.fillStyle = K.COL.live;
      ctx.beginPath(); ctx.arc(jx, jy, dotR * (state === 'done' ? 1.15 : 1) * kj, 0, 6.2832); ctx.fill();
      ctx.globalAlpha = 1;
    }
    const pos = () => { const r = cv.getBoundingClientRect(); cv._left = r.left; cv._top = r.top; };
    window.Y.measured.add(layout);
    addEventListener('scroll', pos, { passive: true });
    layout(); pos();
    if (!reduced) {
      loop.add((t) => { if (!vis.on) return false; draw(t); return true; });
      cv.addEventListener('pointerdown', (ev) => {
        const now = performance.now() / 1000;
        if (now - lastRip < 0.4) return;
        lastRip = now; pos();
        ripples.push({ x: ev.clientX - cv._left, y: ev.clientY - cv._top, t: now });
        if (ripples.length > 3) ripples.shift();
        loop.kick();
      }, { passive: true });
    }
    return {
      setState(s) { state = s; st0 = performance.now() / 1000; if (reduced) draw(0); loop.kick(); },
      lean(on) { if (reduced) return; speedTo = on ? 1.5 : 1; loop.kick(); },
      relayout: layout
    };
  }
  window.FieldCanvas = { mount };
})();
