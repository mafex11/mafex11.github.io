/* Yuki website / hero: one canvas, three depth layers of dots.
   1. the field: an endless grid of resting dots; a lens follows the pointer (dots swell, brighten and part),
      a slow sonar ping leaves the planet every few seconds, a few dots twinkle;
   2. the planet (logo/planet-splash motif) on its own finer grid: it assembles like the splash, its light
      follows the pointer, its rays pulse outward;
   3. the 'yuki' wordmark: big dots that grow out of the field left to right; the i's dot is the one accent.
   Parallax: pointer moves the layers by 6 / 26 / 14 px; scroll moves them at 0.3 / 0.45 / 0.15 of the page
   and scatters the wordmark back into the field as the hero leaves. Positions come from two empty DOM boxes
   (.hero-mark, .hero-orb) so the layout stays in CSS. Reduced motion: one assembled still frame.
   Cost: only the rows still on screen are drawn (the canvas scrolls away with the page), the wordmark's
   clearing refills as one blit, not dot by dot, the ping rests while you scroll, and if frames still run long
   the canvas drops its resolution a step (2x -> 1.5x -> 1x). */
(function () {
  'use strict';
  const { loop, view, pointer, reduced, clamp, smooth, hash } = Y;
  const K = window.DotKit;
  const hero = document.querySelector('.hero');
  if (!hero) return;
  const cv = hero.querySelector('.hero-cv'), markBox = hero.querySelector('.hero-mark'), orbBox = hero.querySelector('.hero-orb');
  const ctx = cv.getContext('2d', { alpha: false });
  let DPR = Math.min(1.5, window.devicePixelRatio || 1);          // a full-screen canvas that redraws every frame: 1.5x is sharp enough for soft dots
  const vis = Y.watch(hero, '0px');
  const t0 = performance.now() / 1000;

  let W = 0, H = 0, P = 14, base = null, small, orbA, word = [], off = [], G = 40, mark = { x: 0, y: 0 }, orb = { x: 0, y: 0, P: 10 }, orbCells = [];
  let nCols = 0, twRows = new Map();
  // twinkling cells, found once per row (grid space, so parallax never changes them): [i, h] pairs
  const twRow = (j) => {
    let a = twRows.get(j);
    if (!a) { a = []; for (let i = -3; i <= nCols + 3; i++) { const h = hash(i, j, 11); if (h > 0.986) a.push(i, h); } twRows.set(j, a); }
    return a;
  };
  const ROW = { base: 0, base2: 1, mid: 2, bone: 3 };
  const BASE_R = () => P * 0.1;          // small atlas rows
  const o = { v: 0, t: 0, r: 0 };

  function layout() {
    const r = hero.getBoundingClientRect();
    W = Math.round(r.width); H = Math.round(r.height);
    cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
    cv.style.width = W + 'px'; cv.style.height = H + 'px';
    P = W < 600 ? 11 : W < 1100 ? 13 : W > 1760 ? 15 : 14;
    small = K.atlas(['#303337', K.COL.base2, K.COL.mid, K.COL.bone], P * 0.32, 20, DPR);
    // the resting grid, drawn once: one canvas a cell larger than the hero on every side
    base = document.createElement('canvas');
    base.width = Math.round((W + 2 * P) * DPR); base.height = Math.round((H + 2 * P) * DPR);
    const bx = base.getContext('2d');
    bx.fillStyle = '#0B0B0C'; bx.fillRect(0, 0, base.width, base.height);    // opaque, so a frame starts with one copy
    small.begin(bx);
    nCols = Math.ceil(W / P) + 2; twRows = new Map();
    for (let j = 0; j < Math.ceil(H / P) + 2; j++) for (let i = 0; i < Math.ceil(W / P) + 2; i++) small.dot(bx, i * P + P / 2, j * P + P / 2, BASE_R(), ROW.base, 1);
    // wordmark grid from its box
    const m = markBox.getBoundingClientRect();
    G = m.width / K.WORD_COLS; mark = { x: m.left - r.left, y: m.top - r.top };
    const lit = new Set();
    word = K.wordDots().map((d, n) => {
      lit.add(d.gx + ',' + d.gy);
      const ang = -Math.PI / 2 + (hash(n, 7, 3) - 0.5) * 2.2;
      return {
        x: mark.x + (d.gx + 0.5) * G, y: mark.y + (d.gy + 0.5) * G, acc: d.acc,
        when: 0.55 + (d.gx / K.WORD_COLS) * 0.75 + hash(n, 1, 9) * 0.12,
        vx: Math.cos(ang) * (0.6 + hash(n, 2, 9)), vy: Math.sin(ang) * (0.6 + hash(n, 2, 9)),
        seed: hash(n, 3, 9)
      };
    });
    // the matrix's unlit pixels: a dot-matrix display shows its off dots, faintly
    off = [];
    for (let gy = 0; gy < K.WORD_ROWS; gy++) for (let gx = 0; gx < K.WORD_COLS; gx++) {
      if (lit.has(gx + ',' + gy)) continue;
      off.push({ x: mark.x + (gx + 0.5) * G, y: mark.y + (gy + 0.5) * G, when: 0.3 + (gx / K.WORD_COLS) * 0.5 + hash(gx, gy, 2) * 0.1 });
    }
    mark.w = m.width; mark.h = m.height;
    // the planet: its own grid, sized so the longest ray reaches the box edge
    const ob = orbBox.getBoundingClientRect();
    orb = { x: ob.left - r.left + ob.width / 2, y: ob.top - r.top + ob.height / 2, P: (ob.width / 2) / K.PLANET.EXTENT };
    orbA = K.atlas(K.RAMP, orb.P * 0.9, 36, DPR);
    orbCells = [];
    const N = K.PLANET.EXTENT;
    for (let j = -N; j <= N; j++) for (let i = -N; i <= N; i++) {
      if (Math.hypot(i, j) > N + 0.5) continue;
      // the rays never change shape: keep each cell's ray value, pulse it per frame. The ball is lit per frame.
      const q = { v: 0, t: 0, r: 0, body: 0, q: -1, d: 0 };
      const hit = K.planet(i, j, q, [-0.45, -0.52, 0.72], null);
      if (!hit && Math.hypot(i, j) > K.PLANET.R + 0.5) continue;
      orbCells.push({ i, j, when: K.planetWhen(i, j), body: q.body || !hit, v0: q.v, t0: q.t, q: q.q, d: q.d });
    }
    draw(performance.now() / 1000, true);
  }

  const perf = window.__heroPerf = { n: 0, field: 0, orb: 0, word: 0 };
  function draw(now, still) {
    const T0 = performance.now();
    const e = reduced || still === 'final' ? 99 : now - t0;
    const t = now;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const sy = reduced ? 0 : Math.min(view.y, H * 1.2);               // hero scroll, px
    const vy0 = Math.max(0, Math.min(H, sy - 2));                    // the canvas scrolls with the page: rows above vy0 are off screen
    const dy0 = Math.floor(vy0 * DPR);
    const leave = smooth(clamp((sy - H * 0.04) / (H * 0.85), 0, 1));
    const pnx = pointer.seen ? pointer.sx / view.w - 0.5 : 0, pny = pointer.seen ? pointer.sy / view.h - 0.5 : 0;
    // pointer in canvas space (the canvas scrolls with the page)
    const px = pointer.sx, py = pointer.sy + sy;
    const LR = Math.max(140, Math.min(220, W * 0.14));

    /* ---- the planet's place this frame (needed by the field for its hole and the ping) ---- */
    const ocx = orb.x - pnx * 26, ocy = orb.y - pny * 26 + sy * 0.45;
    const holeR = (K.PLANET.R + K.PLANET.GAP * 0.6) * orb.P;

    /* ---- layer 1: the field ----
       Fast path: the resting grid is one pre-drawn canvas, blitted at the parallax offset. Only the dots that
       differ from rest are drawn one by one: the clearing's feathered edge, the lens, twinkles and the ping. */
    const fox = -pnx * 6, foy = -pny * 6 + sy * 0.3;
    const wox = -pnx * 14, woy = -pny * 14 + sy * 0.15, F = 22;
    const mx0 = mark.x + wox - 4, mx1 = mark.x + mark.w + wox + 4, my0 = mark.y + woy - 4, my1 = mark.y + mark.h + woy + 4;
    const clearK = 1 - leave, clearing = clearK > 0.02;
    const pingT = e < 3 ? e : ((e - 3) % 7);                         // first ping at load, then every 7 s
    const pingR = pingT * 620, pingOn = !reduced && sy < 1 && (e < 3 ? e < 2.2 : pingT < 2.2);   // it rests while you scroll
    const baseR = BASE_R();
    const nX = Math.floor(fox / P), nY = Math.floor(foy / P);
    // the resting grid: one opaque copy of the rows still on screen; everything after is clipped to them
    const box = Math.round((fox - nX * P - P) * DPR), boy = Math.round((foy - nY * P - P) * DPR);
    const bh = cv.height - dy0;
    if (bh <= 0) return;
    ctx.drawImage(base, 0, dy0 - boy, base.width, bh, box, dy0, base.width, bh);
    ctx.save();
    ctx.beginPath(); ctx.rect(0, dy0, cv.width, bh); ctx.clip();
    ctx.fillStyle = '#0B0B0C';
    const erase = (x, y, r) => { ctx.beginPath(); ctx.arc(x * DPR, y * DPR, r * DPR, 0, 6.2832); ctx.fill(); };
    const clearAt = (x, y) => {                                    // 1 = untouched, 0 = gone
      if (!clearing) return 1;
      const ex = Math.max(mx0 - x, 0, x - mx1), ey = Math.max(my0 - y, 0, y - my1);
      if (ex >= F || ey >= F) return 1;
      const d = Math.sqrt(ex * ex + ey * ey);
      return d >= F ? 1 : 1 - clearK * (1 - d / F);
    };
    const twinkle = (i, j) => {
      const h = hash(i, j, 11);
      if (h <= 0.986 || reduced) return null;
      const tw = 0.5 + 0.5 * Math.sin(t * (0.6 + h) + h * 40);
      return { r: baseR * (1.2 + tw * 0.9), a: 0.18 + 0.45 * tw };
    };
    small.begin(ctx);
    // the planet's hole
    erase(ocx, ocy, holeR);
    // the clearing around the wordmark's matrix (as in the app), feathered over F px
    const ex0 = mx0 - F, ex1 = mx1 + F, ey0 = my0 - F, ey1 = my1 + F;
    if (clearing && ey1 > vy0) {
      ctx.fillRect(Math.floor(ex0 * DPR), Math.floor(ey0 * DPR), Math.ceil((ex1 - ex0) * DPR), Math.ceil((ey1 - ey0) * DPR));
      // inside the matrix box the field comes back as one faded copy of the resting grid (as the hero leaves)
      if (clearK < 0.98) {
        const ix0 = Math.floor(mx0 * DPR), iy0 = Math.floor(my0 * DPR), iw = Math.ceil((mx1 - mx0) * DPR), ih = Math.ceil((my1 - my0) * DPR);
        ctx.globalAlpha = 1 - clearK;
        ctx.drawImage(base, ix0 - box, iy0 - boy, iw, ih, ix0, iy0, iw, ih);
        ctx.globalAlpha = 1;
        erase(ocx, ocy, holeR);
      }
      // the feathered edge, dot by dot: only the band between the box and the clearing's outer edge
      small.begin(ctx);
      for (let j = Math.floor((ey0 - foy) / P); j <= Math.ceil((ey1 - foy) / P); j++) {
        const y = j * P + P / 2 + foy; if (y < ey0 || y > ey1 || y < vy0 - P) continue;
        const inRow = y > my0 && y < my1;
        for (let i = Math.floor((ex0 - fox) / P); i <= Math.ceil((ex1 - fox) / P); i++) {
          const x = i * P + P / 2 + fox; if (x < ex0 || x > ex1) continue;
          if (inRow && x > mx0 && x < mx1) continue;
          const k = clearAt(x, y); if (k < 0.08) continue;
          if (Math.hypot(x - ocx, y - ocy) < holeR) continue;
          small.dot(ctx, x, y, baseR * k, ROW.base, 1);
        }
      }
    }
    // the lens: erase its disc, redraw its dots swollen and pushed apart
    const lensOn = pointer.seen && !reduced, LE = LR + baseR + 1.5;
    if (lensOn) {
      erase(px, py, LE);
      for (let j = Math.max(Math.floor((py - LE - foy) / P), Math.floor((vy0 - P - foy) / P)); j <= Math.ceil((py + LE - foy) / P); j++) {
        for (let i = Math.floor((px - LE - fox) / P); i <= Math.ceil((px + LE - fox) / P); i++) {
          let x = i * P + P / 2 + fox, y = j * P + P / 2 + foy;
          const dx = x - px, dy = y - py, d = Math.sqrt(dx * dx + dy * dy);
          if (d > LE) continue;
          if (Math.hypot(x - ocx, y - ocy) < holeR) continue;
          const k = clearAt(x, y); if (k < 0.08) continue;
          let r = baseR * k, row = ROW.base, a = 1;
          const tw = twinkle(i, j); if (tw) { r = tw.r; row = ROW.mid; a = tw.a; }
          if (d < LR) {
            const f = 1 - d / LR, ff = f * f, push = ff * 7 / Math.max(1, d);
            x += dx * push; y += dy * push;
            r = Math.max(r, baseR + ff * P * 0.2);
            if (ff > 0.18) { row = ROW.mid; a = Math.min(1, 0.25 + ff * 0.9); } else if (row === ROW.base) row = ROW.base2;
          }
          small.dot(ctx, x, y, r, row, a);
        }
      }
    }
    // twinkles and the sonar ping, drawn over the resting dots
    if (!reduced) {
      const jA = Math.max(Math.floor((vy0 - foy) / P) - 1, Math.floor(-foy / P) - 1), jB = Math.floor(-foy / P) + Math.ceil(H / P) + 1;
      const LE2 = LE * LE, PW = 46, pOut = pingR + PW, pIn = Math.max(0, pingR - PW);
      const skip = (x, y) => (clearing && y >= ey0 && y <= ey1 && x >= ex0 && x <= ex1) || (lensOn && (x - px) * (x - px) + (y - py) * (y - py) < LE2);
      const pingAt = (dO) => { const dd = Math.abs(dO - pingR); return dd < PW ? (1 - dd / PW) * (1 - pingT / 2.2) : 0; };
      for (let j = jA; j <= jB; j++) {
        const y = j * P + P / 2 + foy;
        // twinkles on this row (found once per row, not searched for every frame)
        const tws = twRow(j);
        for (let n = 0; n < tws.length; n += 2) {
          const i = tws[n], h = tws[n + 1], x = i * P + P / 2 + fox;
          if (skip(x, y)) continue;
          const dO = Math.hypot(x - ocx, y - ocy);
          if (dO < holeR) continue;
          const tw = 0.5 + 0.5 * Math.sin(t * (0.6 + h) + h * 40);
          let r = baseR * (1.2 + tw * 0.9);
          if (pingOn) { const f = pingAt(dO); if (f > 0.05) r = Math.max(r, baseR * (1 + 1.1 * f)); }
          small.dot(ctx, x, y, r, ROW.mid, 0.18 + 0.45 * tw);
        }
        // the ping: only the cells whose centres fall inside its ring on this row
        if (pingOn) {
          const dy = y - ocy; if (Math.abs(dy) >= pOut) continue;
          const xo = Math.sqrt(pOut * pOut - dy * dy), xi = Math.abs(dy) < pIn ? Math.sqrt(pIn * pIn - dy * dy) : 0;
          for (let side = 0; side < 2; side++) {
            const a0 = side ? ocx + xi : ocx - xo, a1 = side ? ocx + xo : ocx - xi;
            for (let i = Math.ceil((Math.max(a0, -P) - fox - P / 2) / P); ; i++) {
              const x = i * P + P / 2 + fox;
              if (x > a1 || x > W + P) break;
              if (skip(x, y) || hash(i, j, 11) > 0.986) continue;           // twinkles are drawn above
              const dO = Math.hypot(x - ocx, dy);
              if (dO < holeR) continue;
              const f = pingAt(dO);
              if (f > 0.05) small.dot(ctx, x, y, baseR * (1 + 1.1 * f), ROW.base2, Math.min(1, 0.4 + f));
            }
          }
        }
      }
    }

    const T1 = performance.now();
    /* ---- layer 2: the planet ---- */
    let L = [-0.45, -0.52, 0.72];
    if (pointer.seen) {
      const lx = clamp((px - ocx) / 420, -1, 1) * 0.85, ly = clamp((py - ocy) / 420, -1, 1) * 0.85, lz = 0.62;
      const n = Math.hypot(lx, ly, lz); L = [lx / n, ly / n, lz / n];
    }
    orbA.begin(ctx);
    const OP = orb.P;
    const pfade = 1 - leave * 0.35;
    for (const c of orbCells) {
      const x = ocx + c.i * OP, y = ocy + c.j * OP;
      if (y < vy0 - OP || y > H + OP) continue;                     // off screen: costs nothing
      let hit;
      if (c.body) { o.v = 0; o.t = 0; o.r = 0; hit = K.planet(c.i, c.j, o, L, null); }
      else {
        const pulse = reduced || c.q < 0 ? 1 : 0.72 + 0.28 * Math.sin(c.d * 0.85 - t * 2.4 + c.q * 0.4);
        o.v = c.v0 * pulse; o.t = c.t0; o.r = 0.1 + 0.32 * o.v * 0.75 + 0.02; hit = o.v >= 0.1;
      }
      let v = hit ? o.v : 0, tt = o.t, rr = o.r;
      if (e < c.when) {
        // before its moment: noise, like the splash
        const near = e > c.when - 0.3 && hash(c.i, (e * 30) | 0, c.j) < 0.3 + 0.6 * (1 - (c.when - e) / 0.3);
        if (!near) continue;
        v = 0.25 + 0.35 * hash(c.i, c.j, (e * 30) | 0); tt = 0.2 + 0.5 * hash(c.j, c.i, 3); rr = 0.12 + 0.12 * v;
      } else if (e < c.when + 0.25 && hit) { const k = (e - c.when) / 0.25; v *= 0.5 + 0.5 * k; }
      if (v < 0.05) continue;
      const q = Math.max(0, Math.min(5, Math.round(tt * 5)));
      const R = rr * OP;
      if (q >= 5 && v > 0.8) orbA.dot(ctx, x, y, R * 1.9, q, 0.08 * pfade);
      orbA.dot(ctx, x, y, R, q, (0.35 + 0.65 * Math.min(1, v)) * pfade);
    }

    const T2 = performance.now();
    /* ---- layer 3: the wordmark ---- */
    ctx.globalAlpha = 1;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    const scatter = leave;
    // unlit pixels first
    ctx.fillStyle = '#1D1F22';
    const offA = 1 - leave;
    if (offA > 0.02) {
      ctx.beginPath();
      for (const d of off) {
        const k = clamp((e - d.when) / 0.4, 0, 1);
        if (k <= 0) continue;
        const r = G * 0.13 * k;
        ctx.moveTo(d.x + wox + r, d.y + woy); ctx.arc(d.x + wox, d.y + woy, r, 0, 6.2832);
      }
      ctx.globalAlpha = offA; ctx.fill(); ctx.globalAlpha = 1;
    }
    for (const d of word) {
      let k = clamp((e - d.when) / 0.45, 0, 1);
      let flick = 1;
      if (k <= 0) {
        if (e > d.when - 0.35 && hash(d.seed * 1e4, (e * 24) | 0, 5) < 0.45) flick = 0.25; else continue;
      }
      k = flick < 1 ? 0.3 : 1 - Math.pow(1 - k, 3);
      let x = d.x + wox, y = d.y + woy;
      x += d.vx * scatter * 190 * (0.5 + d.seed); y += d.vy * scatter * 230 * (0.5 + d.seed);
      let r = G * 0.34 * k * (1 - scatter * 0.55);
      if (pointer.seen) {
        const dx = x - px, dy = y - py, d2 = dx * dx + dy * dy, LW = LR * 1.25;
        if (d2 < LW * LW) { const f = 1 - Math.sqrt(d2) / LW; r *= 1 + f * f * 0.22; }
      }
      if (r < 0.4) continue;
      let alpha = (1 - scatter * 0.7) * (flick < 1 ? 0.5 : 1);
      if (d.acc) { alpha *= reduced ? 1 : 0.82 + 0.18 * Math.sin(t * 2.2); }
      ctx.globalAlpha = alpha;
      ctx.fillStyle = d.acc ? K.COL.live : K.COL.bone;
      ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832); ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
    const T3 = performance.now();
    perf.n++; perf.field += T1 - T0; perf.orb += T2 - T1; perf.word += T3 - T2;
  }

  Y.measured.add(layout);
  layout();
  if (reduced) { draw(0, 'final'); return; }
  // if frames keep running long (a slow machine, a big screen at 2x), step the canvas resolution down, at most every 2 s
  let slowN = 0, ema = 16.7, lastStep = 0;
  loop.add((t, dt) => {
    if (!vis.on) return false;
    draw(t);
    ema += (dt * 1000 - ema) * 0.08;
    if (DPR > 1 && ema > 19) { if (++slowN > 45 && t - lastStep > 2) { DPR = Math.max(1, DPR - 0.5); slowN = 0; lastStep = t; ema = 16.7; layout(); } }
    else slowN = 0;
    return true;
  });
})();
