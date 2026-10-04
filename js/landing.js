/* Yuki website / landing demos. Each module is a pure function of a progress value (scroll scenes) or of
   time (the voice demo), so scrubbing works both ways and reduced motion gets one honest still frame.
   Port: one React component per module (components/landing/Sees.tsx ...), each taking `p`. */
(function () {
  'use strict';
  const { loop, view, reduced, scene, track, watch, clamp, lerp, remap, easeIO, easeOut, smooth, hash, $, $$ } = Y;

  const tr = (el, x, y, extra) => { el.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0)${extra || ''}`; };
  const rel = (el, base) => { const a = el.getBoundingClientRect(), b = base.getBoundingClientRect(); return { x: a.left - b.left, y: a.top - b.top, w: a.width, h: a.height, cx: a.left - b.left + a.width / 2, cy: a.top - b.top + a.height / 2 }; };
  function setTicks(ol, ranges, p) {
    if (!ol) return;
    [...ol.children].forEach((li, i) => {
      const f = remap(p, ranges[i][0], ranges[i][1]);
      li.style.setProperty('--f', f.toFixed(3));
      li.classList.toggle('on', f > 0);
      li.classList.toggle('cur', f > 0 && f < 1);
    });
  }
  // piecewise path through [p, x, y] keys, eased per segment
  function along(keys, p) {
    if (p <= keys[0][0]) return { x: keys[0][1], y: keys[0][2] };
    for (let i = 1; i < keys.length; i++) {
      if (p <= keys[i][0]) {
        const a = keys[i - 1], b = keys[i], f = easeIO((p - a[0]) / Math.max(1e-6, b[0] - a[0]));
        return { x: lerp(a[1], b[1], f), y: lerp(a[2], b[2], f) };
      }
    }
    const k = keys[keys.length - 1]; return { x: k[1], y: k[2] };
  }
  const bell = (p, a, b) => { const f = remap(p, a, b); return Math.sin(f * Math.PI); };

  /* =========================== nav, side dots =========================== */
  (function nav() {
    const nav = $('#topnav'), dn = $('#dotnav');
    const ids = ['sees', 'remembers', 'acts', 'talks', 'brain', 'ai', 'download'];
    const secs = ids.map((id) => document.getElementById(id));
    const links = $$('.links a'), dots = $$('#dotnav a');
    let tops = [], bone = [0, 0], heroH = 0, lastKey = '';
    const m = () => {
      tops = secs.map((s) => s.getBoundingClientRect().top + scrollY);
      const b = $('#brain'); const r = b.getBoundingClientRect(); bone = [r.top + scrollY, r.bottom + scrollY];
      heroH = $('.hero').offsetHeight; lastKey = '';
    };
    Y.measured.add(m); m();
    loop.add(() => {
      const y = view.y;
      let cur = -1; tops.forEach((t, i) => { if (y + view.h * 0.45 >= t) cur = i; });
      const onBone = y + 30 >= bone[0] && y + 30 < bone[1];
      const dotBone = y + view.h / 2 >= bone[0] && y + view.h / 2 < bone[1];
      const key = `${y > 12}|${cur}|${onBone}|${dotBone}|${y > heroH * 0.7}`;
      if (key === lastKey) return false;
      lastKey = key;
      nav.classList.toggle('scrolled', y > 12);
      nav.classList.toggle('on-bone', onBone);
      dn.classList.toggle('show', y > heroH * 0.7);
      dn.classList.toggle('on-bone', dotBone);
      links.forEach((a, i) => a.classList.toggle('cur', i === cur));
      dots.forEach((a, i) => a.classList.toggle('cur', i === cur));
      return false;
    });
  })();

  /* =========================== 01 sees =========================== */
  (function sees() {
    const sec = $('#sees'), fw = $('#fw'), hl = $('#hl'), lab = $('#fw-read');
    const cs = [...hl.querySelectorAll('i')];
    const rows = $$('#tree .tr'), noted = $('#noted'), ticks = sec.querySelector('.ticks');
    const ROLE = ['window “Messages”', 'list “Chats”', 'item “Maya Chen”', 'item “Leo Park”', 'item “Priya Shah”', 'pane “Maya Chen”', 'text', 'text', 'edit'];
    let rects = [];
    const m = () => {
      const r0 = { x: 0, y: 0, w: fw.offsetWidth, h: fw.offsetHeight };
      rects = [r0];
      for (let n = 1; n <= 8; n++) { const el = fw.querySelector(`[data-n="${n}"]`); rects.push(rel(el, fw)); }
    };
    Y.measured.add(m); m();
    let lastIdx = -2;
    function frame(p) {
      const A = 0.08, B = 0.78, N = 9;
      const q = remap(p, A, B) * N;
      const idx = p < A ? -1 : Math.min(N - 1, Math.floor(q));
      const on = p >= A - 0.01 && p < B + 0.03;
      hl.classList.toggle('on', on);
      if (idx >= 0) {
        // glide to the next node in the last third of each slot
        const f = q - idx, nxt = Math.min(N - 1, idx + 1);
        const k = idx < N - 1 ? smooth(clamp((f - 0.62) / 0.38, 0, 1)) : 0;
        const a = rects[idx], b = rects[nxt], pad = 3;
        const x = lerp(a.x, b.x, k) - pad, y = lerp(a.y, b.y, k) - pad, w = lerp(a.w, b.w, k) + pad * 2, h = lerp(a.h, b.h, k) + pad * 2;
        tr(cs[0], x, y); tr(cs[1], x + w, y); tr(cs[2], x, y + h); tr(cs[3], x + w, y + h);
        const show = k > 0.5 ? nxt : idx;
        if (show !== lastIdx) { lab.textContent = 'reading ' + ROLE[show]; lab.classList.add('reading'); lastIdx = show; }
      }
      if (!on && lastIdx !== -1) { lab.textContent = 'window in front'; lab.classList.remove('reading'); lastIdx = -1; }
      rows.forEach((r, i) => { r.classList.toggle('read', p >= B || i < idx); r.classList.toggle('cur', p < B && i === idx); });
      noted.classList.toggle('on', p > 0.8);
      setTicks(ticks, [[0, A], [A, B], [B, 0.95]], p);
    }
    scene(sec, frame, { still: 0.9 });
  })();

  /* =========================== 02 remembers =========================== */
  (function remembers() {
    const demo = $('#mem-demo'), deck = $('#deck'), cards = $$('.mcard', deck), typed = $('#mem-typed'), ans = $('#mem-ans');
    const Q = 'What do I owe Leo?';
    let slots = [], stack = [];
    const m = () => {
      const W = deck.clientWidth, cols = W < 520 ? 2 : 3, gap = 12;
      const cw = (W - gap * (cols - 1)) / cols, ch = W < 520 ? 160 : 156;
      const rowsN = Math.ceil(cards.length / cols);
      deck.style.height = (rowsN * ch + (rowsN - 1) * gap) + 'px';
      const H = rowsN * ch + (rowsN - 1) * gap;
      slots = []; stack = [];
      cards.forEach((c, i) => {
        c.style.width = cw + 'px'; c.style.height = ch + 'px';
        slots.push({ x: (i % cols) * (cw + gap), y: Math.floor(i / cols) * (ch + gap), r: 0 });
        const k = cards.length - 1 - i;
        stack.push({ x: (W - cw) / 2 + (k - 2.5) * 4, y: (H - ch) / 2 - k * 7, r: (hash(i, 4, 1) - 0.5) * 9 });
        c.style.zIndex = String(10 + (cards.length - i));
      });
    };
    Y.measured.add(m); m();
    let lastN = -1;
    function frame(p) {
      cards.forEach((c, i) => {
        const d = easeOut(remap(p, 0.06 + i * 0.03, 0.24 + i * 0.03));
        const a = stack[i], b = slots[i];
        const lift = Math.sin(d * Math.PI) * -26;
        tr(c, lerp(a.x, b.x, d), lerp(a.y, b.y, d) + lift, ` rotate(${lerp(a.r, b.r, d).toFixed(2)}deg)`);
      });
      const n = Math.round(remap(p, 0.34, 0.44) * Q.length);
      if (n !== lastN) {
        lastN = n; typed.textContent = Q.slice(0, n);
        const done = n === Q.length;
        cards.forEach((c) => { c.classList.toggle('hit', done && c.dataset.k === 'leo'); c.classList.toggle('dim', done && c.dataset.k !== 'leo'); });
        ans.classList.toggle('on', done);
      }
    }
    track(demo, frame, { still: 0.66 });
  })();

  /* =========================== 03 acts =========================== */
  (function acts() {
    const sec = $('#acts'), desk = $('#desk');
    const el = (id) => document.getElementById(id);
    const spot = el('spot'), side = $('#spot .aw-side'), sm = el('sm'), smTyped = el('sm-typed'), smH = el('sm-h'), res = el('t-res'), liked = el('t-liked'), play = el('t-play');
    const card = el('runcard'), steps = $$('#rc-steps li'), fig = el('rc-fig'), figI = $$('#rc-fig i'), sub = el('rc-sub'), resume = el('t-resume');
    const cy = el('cur-y'), cu = el('cur-u'), rip = el('ripple'), keycap = el('keycap'), start = el('t-start'), tbSpot = el('tb-spot');
    const askCap = el('ask-cap');
    const awTitle = el('aw-title'), awSub = el('aw-sub'), awCount = el('aw-count'), bar = el('np-bar');
    const ticks = sec.querySelector('.ticks');
    const T = { y0: 0.03, s1c: 0.12, menu0: 0.135, menu1: 0.17, ok1: 0.18, ty0: 0.2, ty1: 0.29, lit: 0.31, ok2: 0.33, key: 0.355, open0: 0.375, open1: 0.43, ok3: 0.44,
      mv0: 0.46, you0: 0.5, pause: 0.53, toRes: 0.6, clickRes: 0.652, resume: 0.665, youOut: 0.7, s4c: 0.72, ok4: 0.745, mv5: 0.76, s5c: 0.81, ok5: 0.845, done: 0.88 };
    let K = null, W = 0, H = 0, resPos = null, wig = null;
    const m = () => {
      W = desk.clientWidth; H = desk.clientHeight;
      // measure targets in their final, untransformed place
      const keep = [spot.style.transform, sm.style.transform];
      spot.style.transform = 'none'; sm.style.transform = 'none';
      sm.classList.add('typing');
      const S = rel(start, desk), L = rel(liked, desk), Pl = rel(play, desk), R = rel(res, desk), SD = rel(side, desk);
      sm.classList.remove('typing');
      spot.style.transform = keep[0]; sm.style.transform = keep[1];
      // the run card as it looks when paused (its Resume key is where your cursor goes)
      const wasPaused = card.classList.contains('paused'), wasDone = card.classList.contains('done');
      const keepSteps = steps.map((li) => li.className);
      card.classList.add('paused'); card.classList.remove('done');
      steps.forEach((li, i) => { li.className = i < 3 ? 'on ok' : i === 3 ? 'on cur' : ''; });
      const CR = rel(card, desk); resPos = rel(resume, desk);
      steps.forEach((li, i) => { li.className = keepSteps[i]; });
      card.classList.toggle('paused', wasPaused); card.classList.toggle('done', wasDone);
      const SP = rel(spot, desk);
      const rest = { x: W * 0.5, y: H * 0.56 };
      // while Spotify opens, Yuki's cursor waits in the empty foot of Spotify's sidebar (never on a song); you grab
      // the mouse just as it sets off for Liked Songs. On a phone the run card sits in its own band at the top of the
      // desk, so neither cursor crosses it; only your Resume click lands on it.
      const park = { x: SD.x + SD.w * 0.42, y: SD.y + SD.h - 34 };
      const mid = { x: lerp(park.x, L.cx, 0.22), y: lerp(park.y, L.cy, 0.22) };
      // where your hand wiggles the mouse: the empty desktop right of Spotify and under the run card, if there is one
      const zx0 = SP.x + SP.w + 16, zx1 = W - 62, zy0 = CR.y + CR.h + 14, zy1 = H - 44 - 30;
      wig = zx1 - zx0 > 60 && zy1 - zy0 > 24
        ? [[lerp(zx0, zx1, 0.7), lerp(zy0, zy1, 0.9)], [lerp(zx0, zx1, 0.3), lerp(zy0, zy1, 0.15)], [lerp(zx0, zx1, 0.55), lerp(zy0, zy1, 0.55)]]
        : [[W * 0.42, H * 0.52], [W * 0.36, H * 0.4], [W * 0.4, H * 0.46]];
      K = {
        S, L, Pl, R,
        y: [[0, rest.x, rest.y], [T.y0 + 0.02, rest.x, rest.y], [T.s1c, S.cx, S.cy], [T.ok2, S.cx, S.cy], [T.key, R.cx, R.cy], [T.open1, park.x, park.y], [T.mv0, park.x, park.y],
          [T.pause, mid.x, mid.y], [T.resume, mid.x, mid.y], [T.s4c, L.cx, L.cy], [T.mv5, L.cx, L.cy], [(T.mv5 + T.s5c) / 2, lerp(L.cx, Pl.cx, 0.5), Math.min(L.cy, Pl.cy) - 30], [T.s5c, Pl.cx, Pl.cy], [1, Pl.cx, Pl.cy]]
      };
    };
    Y.measured.add(m); m();
    const typedWord = 'Spotify';
    let last = {};
    const set = (k, v, fn) => { if (last[k] !== v) { last[k] = v; fn(v); } };
    function frame(p) {
      if (!K) return;
      // --- what you asked (by voice), until Yuki starts
      const ac = 1 - remap(p, 0.04, 0.08);
      askCap.style.opacity = ac.toFixed(2); askCap.style.transform = `translateX(-50%) translateY(${((1 - ac) * 10).toFixed(1)}px)`;
      // --- Yuki's cursor
      const c = along(K.y, p);
      tr(cy, c.x - 1, c.y - 1);
      set('cyUp', c.y > H - 46, (v) => cy.classList.toggle('up', v));
      // Yuki lets go of the mouse once Play is pressed: the cursor fades before the Done frame
      cy.style.opacity = String(clamp(remap(p, T.y0, T.y0 + 0.02) - remap(p, T.s5c + 0.025, T.s5c + 0.06), 0, 1));
      const paused = p >= T.pause && p < T.resume;
      set('paused', paused, (v) => { card.classList.toggle('paused', v); fig.classList.toggle('paused', v); cy.classList.toggle('dim', v); });
      // --- your cursor (the takeover)
      const rp = resPos || { cx: W * 0.8, cy: H * 0.3 };
      const uk = [[T.you0, W * 0.98, H * 1.02], [T.pause + 0.012, wig[0][0], wig[0][1]], [T.pause + 0.045, wig[1][0], wig[1][1]], [T.toRes, wig[2][0], wig[2][1]], [T.clickRes - 0.006, rp.cx, rp.cy], [T.resume + 0.008, rp.cx, rp.cy], [T.youOut + 0.04, W * 1.06, rp.cy + 8]];   // out to the right, the short way off the card
      const u = along(uk, p);
      tr(cu, u.x - 1, u.y - 1);
      cu.style.opacity = String(clamp(remap(p, T.you0, T.you0 + 0.01) - remap(p, T.youOut, T.youOut + 0.03), 0, 1));
      set('glow', p > T.toRes + 0.035 && p < T.resume + 0.01, (v) => resume.classList.toggle('glow', v));
      // --- clicks: one ripple, placed at whichever click is nearest
      const clicks = [[T.s1c, K.S], [T.clickRes, rp], [T.s4c, K.L], [T.s5c, K.Pl]];
      let rk = 0, rpnt = null;
      for (const [cp, pt] of clicks) { const f = remap(p, cp, cp + 0.03); if (f > 0 && f < 1) { rk = f; rpnt = pt; } }
      if (rpnt) { rip.style.opacity = (1 - rk).toFixed(2); tr(rip, rpnt.cx, rpnt.cy, ` scale(${(0.4 + rk * 1.4).toFixed(2)})`); rip.style.borderColor = rpnt === rp ? '#F2EFE9' : ''; }
      else rip.style.opacity = '0';
      set('press', p >= T.s1c && p < T.s1c + 0.015, (v) => start.classList.toggle('press', v));
      set('pp', p >= T.s5c && p < T.s5c + 0.012, (v) => play.classList.toggle('press', v));
      // --- start menu
      const mo = clamp(remap(p, T.menu0, T.menu1) - remap(p, T.open0 - 0.005, T.open0 + 0.015), 0, 1);
      sm.style.opacity = mo.toFixed(3); tr(sm, 0, (1 - easeOut(mo)) * 14);
      const n = Math.round(remap(p, T.ty0, T.ty1) * typedWord.length);
      set('typed', n, (v) => { smTyped.textContent = typedWord.slice(0, v); sm.classList.toggle('typing', v > 0); smH.textContent = v > 0 ? 'Best match' : 'Pinned'; });
      set('lit', p >= T.lit, (v) => res.classList.toggle('lit', v));
      // --- the Enter key
      const kb = bell(p, T.key - 0.012, T.key + 0.02);
      keycap.style.opacity = kb.toFixed(2); keycap.style.transform = `translate(-50%,-50%) translateY(${((1 - kb) * 6).toFixed(1)}px)`;
      // --- Spotify
      const ao = easeOut(remap(p, T.open0, T.open1));
      spot.style.opacity = ao.toFixed(3); spot.style.transform = `scale(${(0.94 + 0.06 * ao).toFixed(4)})`;
      set('tb', p > T.open0 + 0.02, (v) => tbSpot.classList.toggle('on', v));
      set('liked', p >= T.s4c + 0.004, (v) => {
        spot.classList.toggle('liked', v); liked.classList.toggle('sel', v);
        awTitle.textContent = v ? 'Liked Songs' : 'Home'; awSub.textContent = v ? 'Alex · 142 songs' : 'Jump back in'; awCount.innerHTML = v ? '142 songs · 8 h 40 min' : '&nbsp;';
      });
      set('playing', p >= T.s5c + 0.004, (v) => spot.classList.toggle('playing', v));
      bar.style.transform = `scaleX(${(remap(p, T.s5c, 1) * 0.32).toFixed(3)})`;
      // --- the run card
      const okAt = [T.ok1, T.ok2, T.ok3, T.ok4, T.ok5], curFrom = [T.y0, T.ok1, T.ok2, T.ok3, T.ok4];
      let stepN = 0;
      steps.forEach((li, i) => {
        const on = p >= curFrom[i], ok = p >= okAt[i];
        if (on) stepN = i + 1;
        li.classList.toggle('on', on); li.classList.toggle('ok', ok); li.classList.toggle('cur', on && !ok);
      });
      figI.forEach((f, i) => { f.classList.toggle('on', i < stepN - 1 || p >= T.done); f.classList.toggle('cur', i === stepN - 1 && p < T.done); });
      const done = p >= T.done;
      set('done', done, (v) => card.classList.toggle('done', v));
      const secs = Math.round(remap(p, T.y0, T.done) * 9);
      const st = done ? 'Done · 9 s' : paused ? (W < 520 ? 'Paused at step 4' : 'Paused at step 4 · you have the mouse') : stepN ? `Step ${stepN} of 5 · 0:0${secs}` : 'Reading the screen';
      set('sub', st, (v) => { sub.textContent = v; });
      setTicks(ticks, [[0, T.pause], [T.pause, T.resume], [T.resume, T.done], [T.done, 0.97]], p);
    }
    scene(sec, frame, { still: 0.95 });
  })();

  /* =========================== 04 talks =========================== */
  (function talks() {
    const demo = $('#talk-demo'), cv = $('#wave'), tx = $('#tx'), leds = $$('#leds span'), offer = $('#offer');
    const ctx = cv.getContext('2d');
    const DPR = Math.min(2, window.devicePixelRatio || 1);
    const K = window.DotKit;
    let A = null, W = 0, H = 0, cols = 0, rows = 0, PP = 8, heights = null, stillMode = false;
    const m = () => {
      W = cv.clientWidth; H = cv.clientHeight;
      cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
      PP = W < 500 ? 7 : 8; cols = Math.floor(W / PP); rows = Math.floor(H / PP);
      A = K.atlas([K.COL.base, K.COL.mid, K.COL.bone, K.COL.live], PP * 0.36, 16, DPR);
      heights = new Float32Array(cols);
      if (stillMode) drawWave(1.3, true);
    };
    Y.measured.add(m); m();
    const SCRIPT = [
      { t: 0, mode: 'listening' },
      { t: 0.7, mode: 'hearing', who: 'you', text: 'Yuki, what did Sam want this morning?', dur: 2.0 },
      { t: 2.9, mode: 'thinking' },
      { t: 3.6, mode: 'speaking', who: 'yuki', text: 'Sam asked for the slides by four. Want me to open them?', dur: 2.9 },
      { t: 6.8, mode: 'hearing', who: 'you', text: 'Yes. And mute Slack for an hour.', dur: 1.8 },
      { t: 8.8, mode: 'speaking', narr: 'Opening Slides', live: true },
      { t: 9.5, who: 'yuki', text: 'Opening the slides. Muting Slack for an hour.', dur: 2.2 },
      { t: 11.2, mode: 'hearing', who: 'you', text: 'Actually, make it two hours.', tag: 'Steered mid-task', dur: 1.5 },
      { t: 12.9, mode: 'speaking', narr: 'Slack: muted until 17:40' },
      { t: 13.5, who: 'yuki', text: 'Two hours, then. Slack is quiet until 17:40.', dur: 2.3 },
      { t: 16.2, mode: 'listening', offer: true },
      { t: 21.5, reset: true }
    ];
    let clock = 0, idx = 0, mode = 'listening', active = [];
    const PH = '<div class="ln narr ph"><span></span><span class="t">Waiting for \u201cYuki\u201d</span></div>';
    tx.innerHTML = PH;
    const vis = watch(demo, '0px');
    function setMode(mm) { mode = mm; leds.forEach((l) => l.classList.toggle('on', l.dataset.m === mm)); }
    function addLine(ev) {
      const ph = tx.querySelector('.ph'); if (ph) ph.remove();
      const d = document.createElement('div');
      if (ev.narr) { d.className = 'ln narr' + (ev.live ? ' live' : ''); d.innerHTML = `<span></span><span class="t">${ev.narr}</span>`; }
      else {
        d.className = 'ln ' + ev.who;
        const words = ev.text.split(' ').map((w) => `<span class="w">${w}</span>`).join(' ');
        d.innerHTML = `<span class="who">${ev.who === 'you' ? 'You' : 'Yuki'}</span><span class="t">${words}${ev.tag ? `<span class="tag">${ev.tag}</span>` : ''}</span>`;
        active.push({ el: d, ws: [...d.querySelectorAll('.w')], t0: clock, dur: ev.dur || 2 });
      }
      tx.appendChild(d);
      while (tx.children.length > 7) tx.removeChild(tx.firstChild);
    }
    function run(ev) {
      if (ev.reset) { tx.innerHTML = PH; offer.classList.remove('on'); clock = 0; idx = 0; active = []; return; }
      if (ev.mode) setMode(ev.mode);
      if (ev.who || ev.narr) addLine(ev);
      if (ev.offer) offer.classList.add('on');
    }
    function still() {
      SCRIPT.slice(0, -1).forEach((ev) => { if (ev.who || ev.narr) addLine(ev); });
      tx.querySelectorAll('.w').forEach((w) => w.classList.add('on'));
      setMode('speaking'); offer.classList.add('on'); stillMode = true; drawWave(1.3, true);
    }
    function drawWave(t, isStill) {
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height);
      A.begin(ctx);
      const mid = (rows - 1) / 2;
      for (let i = 0; i < cols; i++) {
        const u = (i - cols / 2) / (cols / 2);
        let target = 0, tone = 2;
        if (mode === 'hearing') {
          const env = Math.max(0, 1 - u * u);
          const n = Math.abs(Math.sin(i * 0.55 + t * 7.3) * Math.sin(i * 0.23 - t * 3.1) + 0.35 * Math.sin(i * 1.7 + t * 11));
          target = 0.4 + (rows / 2 - 1) * env * n; tone = 2;
        } else if (mode === 'speaking') {
          const env = Math.max(0, 1 - Math.pow(Math.abs(u), 1.6)) * (0.55 + 0.45 * Math.abs(Math.sin(t * 4.7)));
          target = 0.5 + (rows / 2 - 1) * env * (0.5 + 0.5 * Math.sin(i * 0.32 - t * 6)); tone = 3;
        } else if (mode === 'thinking') {
          target = 0;
        } else {
          target = 0.25 + 0.9 * Math.exp(-Math.pow(((u + 1) / 2 - ((t * 0.18) % 1)) * 9, 2)); tone = 2;
        }
        heights[i] += (target - heights[i]) * (isStill ? 1 : 0.22);
        const h = heights[i];
        for (let j = 0; j < rows; j++) {
          const x = i * PP + PP / 2, y = j * PP + PP / 2, dv = Math.abs(j - mid);
          let row = 0, r = PP * 0.09, a = 1;
          if (mode === 'thinking') {
            // three comets on a Lissajous path
            let v = 0;
            for (let k = 0; k < 3; k++) {
              const px = cols / 2 + (cols * 0.33) * Math.cos(t * 1.4 + k * 2.094), py = mid + (rows * 0.32) * Math.sin(t * 2.8 + k * 2.094);
              v += Math.exp(-((i - px) * (i - px) + (j - py) * (j - py)) / 2.2);
            }
            if (v > 0.08) { row = 2; r = PP * (0.12 + 0.24 * Math.min(1, v)); a = 0.35 + 0.65 * Math.min(1, v); }
          } else if (dv <= h) {
            const crest = dv > h - 1 && h > 2;
            row = tone === 3 && crest ? 3 : tone === 3 ? 2 : crest ? 2 : 1;
            r = PP * (0.18 + 0.16 * (1 - dv / (h + 1)));
            a = 0.45 + 0.55 * (1 - dv / (h + 1));
          }
          A.dot(ctx, x, y, r, row, a);
        }
      }
    }
    if (reduced) { still(); return; }
    run(SCRIPT[0]); idx = 1;
    loop.add((t, dt) => {
      if (!vis.on) return false;
      clock += dt;
      while (idx < SCRIPT.length && clock >= SCRIPT[idx].t) { const ev = SCRIPT[idx]; idx++; run(ev); if (ev.reset) { run(SCRIPT[0]); idx = 1; break; } }
      active = active.filter((a) => {
        const f = clamp((clock - a.t0) / a.dur, 0, 1), n = Math.ceil(f * a.ws.length);
        for (let i = 0; i < n; i++) a.ws[i].classList.add('on');
        return f < 1;
      });
      drawWave(t);
      return true;
    });
  })();

  /* =========================== 05 your PC is the brain =========================== */
  (function brain() {
    // four stacked SVG layers (lines, PC, relay, browser) share one viewBox; each layer moves as a whole with a CSS
    // transform and the packets are DOM dots, so a frame only writes transform and opacity
    const sec = $('#brain'), gPC = $('#xp-pc'), gRelay = $('#xp-relay'), gWeb = $('#xp-web'), gLines = $('#xp-lines'), pkBox = $('#xp-packets');
    const lLines = $('#xl-lines'), lPC = $('#xl-pc'), lRelay = $('#xl-relay'), lWeb = $('#xl-web');
    const xpl = $('#xplode'), cWeb = $('#c-web'), cRelay = $('#c-relay'), cPC = $('#c-pc');
    const rowsT = $$('.where tbody tr', sec);
    const C = 0.866, S = 0.5, CX = 320;
    const iso = (u, v, z) => [CX + (u - v) * C, (u + v) * S - (z || 0)];
    const pts = (a) => a.map((q) => q[0].toFixed(1) + ',' + q[1].toFixed(1)).join(' ');
    // a slab: top face + two side faces, centred on (CX, 0); details drawn in face space through an iso matrix
    function slab(w, d, th, face, detail) {
      const a = iso(-w / 2, -d / 2), b = iso(w / 2, -d / 2), c = iso(w / 2, d / 2), e = iso(-w / 2, d / 2);
      const dn = (q) => [q[0], q[1] + th];
      return `<polygon points="${pts([e, c, dn(c), dn(e)])}" fill="#D9D4CA" stroke="#0B0B0C" stroke-width="1"/>` +
        `<polygon points="${pts([c, b, dn(b), dn(c)])}" fill="#C9C3B8" stroke="#0B0B0C" stroke-width="1"/>` +
        `<polygon points="${pts([a, b, c, e])}" fill="${face}" stroke="#0B0B0C" stroke-width="1"/>` +
        `<g transform="matrix(${C} ${S} ${-C} ${S} ${CX} 0)">${detail || ''}</g>`;
    }
    const T = (x, y, s, txt, o) => `<text x="${x}" y="${y}" font-family="JetBrains Mono" font-size="${s}" letter-spacing="1" fill="#0B0B0C" ${o || ''}>${txt}</text>`;
    // PC: memory (locked), screen, voice, keys
    const mod = (x, y, w, h, label, lock) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" fill="#F2EFE9" stroke="#0B0B0C"/>` +
      `<rect x="${x + 6}" y="${y + 6}" width="${w - 12}" height="${h - 24}" rx="3" fill="url(#pdots2)"/>` + T(x + 8, y + h - 8, 8, label) +
      (lock ? `<g transform="translate(${x + w - 22} ${y + h - 20})"><rect x="0" y="5" width="12" height="9" rx="1.5" fill="#0B0B0C"/><path d="M2.5 5V3.2a3.5 3.5 0 0 1 7 0V5" fill="none" stroke="#0B0B0C" stroke-width="1.6"/></g>` : '');
    gPC.innerHTML = slab(300, 230, 26, '#FBFAF7',
      `<rect x="-150" y="-115" width="300" height="230" fill="url(#pdots)"/>` +
      mod(-132, -98, 124, 92, 'MEMORY', true) + mod(8, -98, 124, 92, 'SCREEN') + mod(-132, 8, 124, 86, 'VOICE') + mod(8, 8, 124, 86, 'AI KEYS', true) +
      T(-132, 110, 9, 'YOUR PC · THE BRAIN', 'font-weight="600"'));
    gRelay.innerHTML = slab(230, 170, 9, '#EFEBE4',
      `<rect x="-115" y="-85" width="230" height="170" fill="url(#pdots2)" opacity=".55"/>` +
      `<circle cx="0" cy="0" r="30" fill="#FBFAF7" stroke="#0B0B0C"/>` +
      `<g transform="translate(-9 -12)"><rect x="0" y="9" width="18" height="14" rx="2" fill="#0B0B0C"/><path d="M3.5 9V6a5.5 5.5 0 0 1 11 0v3" fill="none" stroke="#0B0B0C" stroke-width="2.2"/></g>` +
      T(-104, 78, 8, 'RELAY · SEALED'));
    gWeb.innerHTML = slab(280, 196, 14, '#FBFAF7',
      `<rect x="-140" y="-98" width="280" height="22" fill="#E7E3DB" stroke="#0B0B0C"/>` +
      `<circle cx="-126" cy="-87" r="3" fill="#0B0B0C"/><circle cx="-116" cy="-87" r="3" fill="#0B0B0C" opacity=".4"/><circle cx="-106" cy="-87" r="3" fill="#0B0B0C" opacity=".2"/>` +
      `<rect x="-86" y="-93" width="140" height="12" rx="6" fill="#FBFAF7" stroke="#0B0B0C" stroke-width=".8"/>` + T(-80, -84, 7, 'yuki · web') +
      `<rect x="-124" y="-62" width="56" height="148" fill="url(#pdots)" stroke="#0B0B0C" stroke-width=".6"/>` +
      `<rect x="-58" y="-62" width="184" height="30" rx="4" fill="#0B0B0C"/>` + T(-50, -43, 9, 'Open Spotify', 'fill="#F2EFE9"') +
      `<circle cx="112" cy="-47" r="4" fill="#6FEBC4"/>` +
      `<rect x="-58" y="-24" width="184" height="10" rx="2" fill="#0B0B0C" opacity=".75"/><rect x="-58" y="-8" width="140" height="10" rx="2" fill="#0B0B0C" opacity=".35"/>` +
      `<rect x="-58" y="8" width="160" height="10" rx="2" fill="#0B0B0C" opacity=".35"/><rect x="-58" y="24" width="110" height="10" rx="2" fill="#0B0B0C" opacity=".35"/>` +
      `<rect x="-58" y="46" width="184" height="40" rx="4" fill="none" stroke="#0B0B0C" stroke-dasharray="2 3"/>` + T(-50, 70, 7.5, 'YOUR BROWSER'));
    // stream lines: up on the left (the live view), down on the right (your commands)
    const LX = [-46, 46], TOP = 150, BOT = 520;
    gLines.innerHTML = LX.map((dx) => `<path d="M${CX + dx} ${BOT} V ${TOP}"/>`).join('');
    // each slab rests at its exploded place inside its own layer; the layer slides it there
    const REST = { relay: 336, web: TOP };
    gPC.setAttribute('transform', `translate(0 ${BOT})`); gRelay.setAttribute('transform', `translate(0 ${REST.relay})`); gWeb.setAttribute('transform', `translate(0 ${REST.web})`);
    // packets: DOM dots over the layers
    const PK = [];
    for (let k = 0; k < 10; k++) {
      const el = document.createElement('i');
      pkBox.appendChild(el); PK.push({ el, up: k < 7, r: k < 7 ? 3 : 3.4, off: k < 7 ? k / 7 : (k - 7) / 3, sealed: false, x: 0 });
    }
    // the viewBox is fitted (meet) into the layer box: s = user units to px, (ox, oy) = where the viewBox starts
    let e = 0, pcOn = true, sc = 1, ox = 0, oy = 0;
    const mm = () => {
      const r = lLines.getBoundingClientRect();
      sc = Math.min(r.width / 640, r.height / 700) || 1; ox = (r.width - 640 * sc) / 2; oy = (r.height - 700 * sc) / 2;
      PK.forEach((p) => { const d = (2 * p.r * sc).toFixed(1) + 'px'; p.el.style.width = d; p.el.style.height = d; p.x = ox + (CX + (p.up ? LX[0] : LX[1]) - p.r) * sc; });
      place();
      if (reduced) packets(0.3);
    };
    const yOf = () => ({ pc: BOT, relay: lerp(BOT - 34, 336, e), web: lerp(BOT - 56, TOP, e) });
    function place() {
      const y = yOf();
      lRelay.style.transform = `translate3d(0,${((y.relay - REST.relay) * sc).toFixed(1)}px,0)`;
      lWeb.style.transform = `translate3d(0,${((y.web - REST.web) * sc).toFixed(1)}px,0)`;
      lLines.style.opacity = remap(e, 0.5, 0.9).toFixed(2);
      const co = (a) => remap(e, a, a + 0.25);
      [[cWeb, y.web - TOP, 0.55], [cRelay, y.relay - 336, 0.62], [cPC, 0, 0.69]].forEach(([c, dy, a]) => {
        c.style.opacity = co(a).toFixed(2); c.style.transform = `translate3d(0,${(dy * sc).toFixed(1)}px,0)`;
      });
    }
    function packets(t) {
      const on = e > 0.85 && pcOn, relayY = yOf().relay;
      PK.forEach((p) => {
        if (!on) { p.el.style.opacity = '0'; return; }
        const f = ((t * (p.up ? 0.32 : 0.22)) + p.off) % 1;
        const y = p.up ? lerp(BOT - 10, TOP + 30, f) : lerp(TOP + 30, BOT - 10, f);
        p.el.style.transform = `translate3d(${p.x.toFixed(1)}px,${(oy + (y - p.r) * sc).toFixed(1)}px,0)`;
        // through the relay the packet is sealed: drawn as a ring (a class flip only when it changes)
        const inRelay = Math.abs(y - relayY) < 26;
        if (inRelay !== p.sealed) { p.sealed = inRelay; p.el.classList.toggle('sealed', inRelay); }
        p.el.style.opacity = (Math.sin(f * Math.PI) * 0.9 + 0.1).toFixed(2);
      });
    }
    Y.measured.add(mm); mm();
    function frame(p) {
      e = easeIO(remap(p, 0.04, 0.46));
      place();
      rowsT.forEach((r, i) => { r.style.opacity = (0.3 + 0.7 * remap(p, 0.3 + i * 0.05, 0.38 + i * 0.05)).toFixed(2); });
    }
    // a sticky scene on wide screens, a normal section that explodes as it scrolls in below 1100 px; both are wired
    // and the media query picks one each frame, so resizing across 1100 px switches cleanly
    const narrow = window.matchMedia('(max-width: 1100px)');
    track(xpl, (p, still) => { if (narrow.matches) frame(still ? 1 : remap(p, 0.2, 0.62)); }, { still: 1 });
    scene(sec, (p) => { if (!narrow.matches) frame(p); }, { still: 1 });
    if (reduced) packets(0.3);
    const vis = watch(sec, '0px');
    if (!reduced) loop.add((t) => { if (!vis.on) return false; packets(t); return e > 0.85; });
    // the PC on/off switch
    const out = $('#sw-out');
    $$('.pcswitch [data-pc]').forEach((b) => b.addEventListener('click', () => {
      pcOn = b.dataset.pc === 'on';
      $$('.pcswitch [data-pc]').forEach((x) => x.setAttribute('aria-checked', String(x === b)));
      out.dataset.pc = pcOn ? 'on' : 'off';
      xpl.classList.toggle('off', !pcOn);
      lPC.style.opacity = pcOn ? '1' : '.45';
      loop.kick(); if (reduced) packets(0.3);
    }));
  })();

  /* =========================== 06 any AI =========================== */
  (function anyAI() {
    const P = [
      { n: 'Claude', s: 'Anthropic or Amazon Bedrock', runs: 'In the cloud, with your key', key: 'Stays on your PC' },
      { n: 'OpenAI', s: 'GPT models', runs: 'In the cloud, with your key', key: 'Stays on your PC' },
      { n: 'Gemini', s: 'Google', runs: 'In the cloud, with your key', key: 'Stays on your PC' },
      { n: 'OpenRouter', s: 'Free models, no card needed', runs: 'In the cloud, free models', key: 'A free key, kept on your PC' },
      { n: 'Ollama', s: 'Fully local, nothing leaves', runs: 'On your PC, even offline', key: 'No key needed' }
    ];
    const ANG = [-120, -60, 0, 60, 120];
    const knob = $('#knob'), cap = $('#knob-cap'), ticksEl = $('#knob-ticks'), labels = $('#knob-labels'), lcd = $('#lcd');
    const nEl = $('#lcd-n'), sEl = $('#lcd-s'), runs = $('#ai-runs'), key = $('#ai-key'), keys = $$('#pkeys .pkey');
    let cur = 0, angle = ANG[0];
    // tick ring
    let html = '';
    for (let a = -135; a <= 135; a += 7.5) {
      const major = ANG.indexOf(Math.round(a)) >= 0;
      const r = 96, rad = (a - 90) * Math.PI / 180;
      html += `<i class="${major ? 'major' : ''}" data-a="${Math.round(a)}" style="transform:translate(${(Math.cos(rad) * r).toFixed(1)}px,${(Math.sin(rad) * r).toFixed(1)}px)"></i>`;
    }
    ticksEl.innerHTML = html;
    const majors = $$('i.major', ticksEl);
    function placeLabels() {
      const box = labels.parentElement.clientWidth / 2;
      labels.innerHTML = P.map((p, i) => {
        const rad = (ANG[i] - 90) * Math.PI / 180, r = box - 6;
        return `<span style="left:calc(50% + ${(Math.cos(rad) * r).toFixed(1)}px);top:calc(50% + ${(Math.sin(rad) * r).toFixed(1)}px)">${p.n}</span>`;
      }).join('');
    }
    Y.measured.add(placeLabels); placeLabels();
    function select(i, fromDrag) {
      i = clamp(i, 0, P.length - 1);
      const changed = i !== cur; cur = i;
      angle = ANG[i];
      cap.style.transition = fromDrag ? 'transform .25s var(--ease)' : '';
      cap.style.transform = `rotate(${angle}deg)`;
      keys.forEach((k, j) => k.setAttribute('aria-checked', String(j === i)));
      majors.forEach((m) => m.classList.toggle('on', Number(m.dataset.a) === ANG[i]));
      $$('span', labels).forEach((s, j) => s.classList.toggle('on', j === i));
      knob.setAttribute('aria-valuenow', String(i)); knob.setAttribute('aria-valuetext', P[i].n);
      nEl.textContent = P[i].n; sEl.textContent = P[i].s; runs.textContent = P[i].runs; key.textContent = P[i].key;
      if (changed && !reduced) { lcd.classList.remove('swap'); void lcd.offsetWidth; lcd.classList.add('swap'); }
    }
    keys.forEach((k) => k.addEventListener('click', () => select(Number(k.dataset.i))));
    knob.addEventListener('keydown', (ev) => {
      if (ev.key === 'ArrowRight' || ev.key === 'ArrowUp') { select(cur + 1); ev.preventDefault(); }
      if (ev.key === 'ArrowLeft' || ev.key === 'ArrowDown') { select(cur - 1); ev.preventDefault(); }
    });
    let drag = false;
    const angAt = (ev) => { const r = knob.getBoundingClientRect(); return Math.atan2(ev.clientY - (r.top + r.height / 2), ev.clientX - (r.left + r.width / 2)) * 180 / Math.PI + 90; };
    knob.addEventListener('pointerdown', (ev) => { drag = true; knob.setPointerCapture(ev.pointerId); cap.style.transition = 'none'; });
    knob.addEventListener('pointermove', (ev) => {
      if (!drag) return;
      let a = angAt(ev); if (a > 180) a -= 360;
      a = clamp(a, -135, 135); angle = a;
      cap.style.transform = `rotate(${a}deg)`;
      let best = 0; ANG.forEach((g, i) => { if (Math.abs(g - a) < Math.abs(ANG[best] - a)) best = i; });
      if (best !== cur) select(best, true), cap.style.transition = 'none', cap.style.transform = `rotate(${a}deg)`;
    });
    knob.addEventListener('pointerup', () => { if (!drag) return; drag = false; select(cur, true); });
    select(0);
  })();

  /* =========================== 07 download =========================== */
  (function download() {
    const btn = $('#dl-btn'), bar = $('#dl-bar');
    if (!btn) return;
    const label = btn.childNodes[1];
    let t0 = 0, running = false;
    btn.addEventListener('click', (ev) => {
      ev.preventDefault();
      if (running) return;
      running = true; t0 = performance.now();
      const step = () => {
        const f = clamp((performance.now() - t0) / 2600, 0, 1);
        bar.style.setProperty('--dl', f.toFixed(3));
        label.textContent = f < 1 ? `Downloading… ${Math.round(f * 100)}%` : 'Saved: Yuki-Setup-0.9.2.exe';
        if (f < 1) return true;
        running = false; return false;
      };
      if (reduced) { bar.style.setProperty('--dl', '1'); label.textContent = 'Saved: Yuki-Setup-0.9.2.exe'; running = false; return; }
      const off = loop.add(() => { const more = step(); if (!more) off(); return more; });
    });
  })();
})();
