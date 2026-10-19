/* Yuki website / dotkit: the dot painter every canvas on the site shares.
   - atlas(): pre-rendered dots (one row per colour, N radius steps), blitted with drawImage so a frame of
     ten thousand dots costs a few milliseconds;
   - WORD: the 'yuki' wordmark as a 20 x 9 dot-matrix (rows 0-1 ascender, 2-6 x-height, 7-8 descender);
     'A' marks the i's dot, the one accent;
   - planet(): the planet-splash motif (logo/planet-splash.js) as a pure function of a cell, with a moving
     light and rays that pulse outward, so the hero can animate it every frame.
   - lensK(dx, dy, R): the one field-lens falloff every canvas shares (fx "lens"): 1 at the pointer, 0 at R
     and beyond, smoothstep in between. Callers swell dots by up to 1.8x and brighten one ramp step with it:
       const k = DotKit.lensK(x - px, y - py, 120); r *= 1 + 0.8 * k; if (k > 0.35) row = brighter;
     Radius: 120 px (hero 160). Off with reduced motion (the caller skips it).
   - COL: the dot colours; base, base2 and ink come from the colour tokens (--dot, --edge-2, --ink), read once at
     load, and tok('--x', '#fallback') reads any other token, so a black palette reaches every canvas.
   Port: a plain TS module (lib/dotkit.ts) shared by the hero, the login field and the dashboard field. */
(function () {
  'use strict';
  const ACC = window.YAccent;   // js/accent.js: the chosen accent and its ramp (default mint)
  const RAMP = ACC ? ACC.ramp.slice() : ['#36513E', '#4C7F60', '#64B486', '#7DE8AC', '#C3ECD1', '#F2EFE9'];   // dark tint, accent, bone
  // a colour token from css/base.css :root (or the black palette on top of it), today's hex as the fallback
  const tok = (name, fb) => (ACC && ACC.tok ? ACC.tok(name, fb) : fb);
  const COL = { base: tok('--dot', '#26292C'), base2: tok('--edge-2', '#3A3E43'), mid: '#96938C', bone: '#F2EFE9', live: ACC ? ACC.hex : '#7DE8AC', ink: tok('--ink', '#0B0B0C') };

  function atlas(colors, maxR, levels, dpr) {
    const S = Math.ceil(maxR * 2 * dpr) + 2;
    const cv = document.createElement('canvas');
    cv.width = S * levels; cv.height = S * colors.length;
    const x = cv.getContext('2d');
    colors.forEach((c, row) => {
      x.fillStyle = c;
      for (let l = 0; l < levels; l++) {
        const r = Math.max(0.35, (maxR * (l + 1) / levels) * dpr);
        x.beginPath(); x.arc(l * S + S / 2, row * S + S / 2, r, 0, 6.2832); x.fill();
      }
    });
    let alpha = 1;
    return {
      cv, S, levels, maxR, dpr,
      begin(ctx) { alpha = 1; ctx.globalAlpha = 1; },
      // px, py, r in CSS px; ctx in device px with no transform
      dot(ctx, px, py, r, row, a) {
        let l = Math.round((r / maxR) * levels) - 1;
        if (l < 0) return;
        if (l >= levels) l = levels - 1;
        if (a !== alpha) { alpha = a; ctx.globalAlpha = a; }
        ctx.drawImage(cv, l * S, row * S, S, S, px * dpr - S / 2, py * dpr - S / 2, S, S);
      }
    };
  }

  // the wordmark: lower-case, one-dot strokes, the classic 5 x 7 matrix with a descender
  const WORD = {
    y: ['.....', '.....', 'X...X', 'X...X', 'X...X', 'X..XX', '.XX.X', '....X', '.XXX.'],
    u: ['.....', '.....', 'X...X', 'X...X', 'X...X', 'X..XX', '.XX.X', '.....', '.....'],
    k: ['X...', 'X...', 'X..X', 'X.X.', 'XX..', 'X.X.', 'X..X', '....', '....'],
    i: ['.A.', '...', 'XX.', '.X.', '.X.', '.X.', 'XXX', '...', '...']
  };
  const WORD_COLS = 20, WORD_ROWS = 9;
  function wordDots() {
    const out = []; let x0 = 0;
    for (const ch of 'yuki') {
      const g = WORD[ch];
      g.forEach((row, j) => { for (let i = 0; i < row.length; i++) if (row[i] !== '.') out.push({ gx: x0 + i, gy: j, acc: row[i] === 'A', ch }); });
      x0 += g[0].length + 1;
    }
    return out;
  }

  const hash = (x, y, s) => {
    let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul((s || 0) + 1, 1442695041)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
  const BAY = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  const bayer = (x, y) => (BAY[((y & 3) << 2) | (x & 3)] + 0.5) / 16;
  const clamp = (a, lo, hi) => Math.max(lo, Math.min(hi, a));

  /* the planet: a lit ball, a dark ring, eight long and eight short rays breaking into single dots.
     x, y in cells from the centre. L: unit light vector. t: seconds, for the outward ray pulse. */
  const HS = 1.23, R0 = 6 * HS, GAP = 1.25 * HS;
  const RAYS = Array.from({ length: 16 }, (_, q) => (q % 2 === 0 ? (9.5 + 3 * hash(q, 3, 5)) * HS : (4.6 + 2.8 * hash(q, 4, 5)) * HS));
  const EXTENT = Math.ceil(R0 + GAP + Math.max(...RAYS) + 2);
  function planet(x, y, o, L, t) {
    const d = Math.hypot(x, y), R = R0;
    if (d <= R) {
      const nx = x / R, ny = y / R, nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
      const sh = Math.max(0, nx * L[0] + ny * L[1] + nz * L[2]);
      o.body = 1;
      if (sh < 0.12 && d > R - 1.2 && bayer(x + 2, y + 1) > 0.55 + sh * 3) { o.v = 0.3; o.t = 0; o.r = 0.15; return 1; }
      o.v = 0.55 + 0.45 * Math.pow(sh, 0.6);
      o.t = clamp(0.04 + 1.02 * Math.pow(sh, 0.85), 0, 1);
      o.r = (0.22 + 0.23 * Math.pow(sh, 0.5)) * (0.62 + 0.38 * clamp((R - d + 0.2) / 1.1, 0, 1));
      return 1;
    }
    const g0 = R + GAP;
    if (d < g0) return 0;
    const a = Math.atan2(y, x);
    o.body = 0;
    let best = 0, bt = 0, bq = -1;
    for (let q = 0; q < 16; q++) {
      const da = Math.abs(((a - q * Math.PI / 8) % (2 * Math.PI) + 3 * Math.PI) % (2 * Math.PI) - Math.PI);
      if (da > Math.PI / 2) continue;
      const pd = d * Math.sin(da), f = 1 - (d - g0) / RAYS[q];
      if (f <= 0) continue;
      const wq = q % 2 === 0 ? 0.5 : 0.4, ray = pd < wq ? 1 : Math.exp(-((pd - wq) * (pd - wq)) / 0.16);
      if (f < 0.32 && bayer(x, y) > f * 3) continue;
      const pulse = t == null ? 1 : 0.72 + 0.28 * Math.sin((d - g0) * 0.85 - t * 2.4 + q * 0.4);
      const val = ray * (0.2 + 0.8 * Math.pow(f, 0.75)) * pulse;
      if (val > best) { best = val; bt = 0.1 + 0.9 * f; bq = q; }
    }
    if (best < 0.14 && d < g0 + 11 && hash(x, y, 21) > 0.92) { const f = 1 - (d - g0) / 11; best = 0.16 + 0.3 * f; bt = 0.05 + 0.4 * f; bq = -1; }
    if (best < 0.1) return 0;
    o.v = best; o.t = bt; o.q = bq; o.d = d - g0; o.r = 0.1 + 0.32 * best * 0.75 + 0.02; return 1;
  }
  // when each cell settles in the intro: the ball from the outside in, then the rays burst out (splash timing)
  function planetWhen(x, y) {
    const d = Math.hypot(x, y);
    if (d <= R0 + 0.5) return 0.32 + 0.3 * (1 - d / (R0 + 0.5)) + hash(x, y, 5) * 0.04;
    return 0.66 + Math.min(0.4, (d - R0) / (13 * HS) * 0.4) + hash(x, y, 6) * 0.04;
  }

  // the shared lens falloff: smoothstep from 1 at the centre to 0 at R
  function lensK(dx, dy, R) {
    const d2 = dx * dx + dy * dy, R2 = R * R;
    if (d2 >= R2) return 0;
    const t = 1 - Math.sqrt(d2) / R;
    return t * t * (3 - 2 * t);
  }

  window.DotKit = { RAMP, COL, tok, atlas, WORD, WORD_COLS, WORD_ROWS, wordDots, planet, planetWhen, PLANET: { R: R0, GAP, EXTENT }, hash, bayer, lensK };
})();
