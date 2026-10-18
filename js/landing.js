/* Yuki website / landing demos (round 2, 18 Oct). Each scroll scene is a pure function of a progress value, so
   scrubbing works both ways and reduced motion gets one honest still frame; the voice demo runs on time.
   Hover, press, focus and touch come from js/fx.js (Y.fx); scenes only toggle .is-lit / Y.fx.lit or write a
   ring's opacity, they never draw their own outline. Everything that moves registers with Y.loop.
   Modules: 01 Sees, 02 Remembers, 03 Acts, 04 Talks, 05 Your PC (the diagram + the Any AI console), 06 Download.
   The product-shot grounds, guide callouts and the Download lineup live in js/guide.js (18 Oct, the TE touch).
   Port: one React component per module (components/landing/Sees.tsx ...), each taking `p`. */
(function () {
  'use strict';
  const { loop, view, reduced, scene, track, watch, clamp, lerp, remap, easeIO, easeOut, smooth, hash, $, $$ } = Y;
  const FX = Y.fx || { ring: () => document.createElement('i'), lit: () => {}, pulse: () => {}, lockOn: () => {} };

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
  // type-on: the text is already set; a cover slides off it in steps (transform only). Reduced: nothing moves.
  function typeOn(w, n) {
    if (reduced || !w) return;
    w.style.setProperty('--ty-n', String(Math.max(4, Math.min(n, 40))));
    w.style.setProperty('--ty-d', Math.min(Math.max(n * 22, 260), 720) + 'ms');
    w.classList.remove('ty'); void w.offsetWidth; w.classList.add('ty');
  }
  // 5 x 5 dot glyphs (same geometry as core's Y.dic), for the 05 console and the PC slab's tiles
  const GL = {
    lock: ['01110', '01010', '11111', '11011', '11111'],
    key: ['00000', '11000', '11111', '11010', '00000'],
    chip: ['10101', '01110', '11111', '01110', '10101'],
    win: ['11111', '11111', '10001', '10001', '11111'],
    wave: ['00100', '10101', '10101', '10101', '00100']
  };
  function glyphSVG(name) {
    let c = ''; GL[name].forEach((row, y) => { for (let x = 0; x < 5; x++) if (row[x] === '1') c += `<circle cx="${x * 3 + 1.5}" cy="${y * 3 + 1.5}" r="1.15"/>`; });
    return `<svg viewBox="0 0 15 15" aria-hidden="true">${c}</svg>`;
  }
  $$('[data-gl]').forEach((el) => { el.innerHTML = glyphSVG(el.dataset.gl); });

  /* =========================== nav, side dots =========================== */
  (function nav() {
    const nav = $('#topnav'), dn = $('#dotnav');
    const ids = ['sees', 'remembers', 'acts', 'talks', 'brain', 'download'];
    const secs = ids.map((id) => document.getElementById(id));
    const links = $$('.links a'), dots = $$('#dotnav a');
    let tops = [], bone = [0, 0], heroH = 0, lastKey = '';
    const m = () => {
      tops = secs.map((s) => s.getBoundingClientRect().top + scrollY);
      const r = $('#brain').getBoundingClientRect(); bone = [r.top + scrollY, r.bottom + scrollY];
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
  // Four nodes are read in turn. The node being read gets the white lit border (an fx ring whose opacity this
  // frame writes), and its tree row appears and lights with it. After the scene (p >= B, and always in reduced
  // motion) the window and the tree are live: hover, focus or tap a part and it lights with its row.
  (function sees() {
    const sec = $('#sees'), demo = $('#sees-demo'), fw = $('#fw'), lab = $('#fw-read'), dot = $('#fw-dot');
    const parts = [fw, ...[1, 2, 3].map((n) => fw.querySelector(`[data-n="${n}"]`))];
    const rows = $$('#tree .tr'), noted = $('#noted');
    // the guide callouts (js/guide.js): the number of the node being read lights with it, in the scene and live
    const gds = $$('#sees .gd');
    const gdOn = (n) => gds.forEach((g) => g.classList.toggle('on', Number(g.dataset.gn) === n));
    const ROLE = ['window “Messages”', 'item “Maya Chen”', 'text “Are we still on…”', 'text “Bring the Lisbon…”'];
    const rings = [...parts, ...rows].map((el) => FX.ring(el));
    const A = 0.08, B = 0.78, N = 4;
    let mode = '', cur = -1, lastShow = -2;
    const lastO = new Array(8).fill(-1);
    function setRing(i, o) {
      if (lastO[i] === o) return; lastO[i] = o;
      const r = rings[i]; r.style.opacity = o.toFixed(3);
      r.style.transform = o > 0 && o < 1 ? `scale(${(1 + 0.012 * (1 - o)).toFixed(4)})` : 'none';
    }
    function label(n) {
      if (n >= 0) { lab.textContent = 'reading ' + ROLE[n]; dot.classList.remove('off'); }
      else { lab.textContent = mode === 'live' ? 'read · point at any part' : 'window in front'; dot.classList.add('off'); }
    }
    function show(n) {
      if (n === cur) return;
      if (cur >= 0) { FX.lit(parts[cur], false); FX.lit(rows[cur], false); }
      cur = n;
      if (n >= 0) { FX.lit(parts[n], true); FX.lit(rows[n], true); }
      gdOn(n);
      if (mode === 'live') label(n);
    }
    function toScene() {
      mode = 'scene'; show(-1); demo.setAttribute('data-fx-off', '');
      rings.forEach((r) => { r.style.transition = 'none'; }); lastO.fill(-1); lastShow = -2;
    }
    function toLive() {
      mode = 'live'; demo.removeAttribute('data-fx-off');
      rings.forEach((r) => { r.style.transition = ''; r.style.opacity = ''; r.style.transform = ''; });
      rows.forEach((r) => { r.classList.add('read'); r.classList.remove('cur'); });
      gdOn(cur); label(-1);
    }
    function frame(p, still) {
      const live = still || p >= B;
      if (live && mode !== 'live') toLive(); else if (!live && mode !== 'scene') toScene();
      if (!live) {
        const q = remap(p, A, B) * N, idx = p < A ? -1 : Math.min(N - 1, Math.floor(q));
        const o = [0, 0, 0, 0];
        let sh = idx;
        if (idx >= 0) {
          // the old border fades out as the next fades in, over the last third of each slot
          const f = q - idx, k = idx < N - 1 ? smooth(clamp((f - 0.667) / 0.333, 0, 1)) : 0;
          o[idx] = 1 - k; if (k > 0) o[idx + 1] = k;
          sh = k > 0.5 ? idx + 1 : idx;
        }
        for (let i = 0; i < N; i++) { setRing(i, o[i]); setRing(N + i, o[i]); }
        if (sh !== lastShow) {
          lastShow = sh;
          rows.forEach((r, i) => { r.classList.toggle('read', sh >= 0 && i <= sh); r.classList.toggle('cur', i === sh); });
          label(sh); gdOn(sh); if (sh >= 0) FX.pulse(dot);
        }
      }
      noted.classList.toggle('on', live);
    }
    // a part, its tree row or its callout number
    const nodeAt = (t) => { const el = t && t.closest ? t.closest('[data-n], [data-gn]') : null; return el && demo.contains(el) ? Number(el.dataset.n || el.dataset.gn) : -1; };
    demo.addEventListener('pointerover', (e) => { if (e.pointerType !== 'touch' && mode === 'live') show(nodeAt(e.target)); });
    demo.addEventListener('pointerleave', (e) => { if (e.pointerType !== 'touch' && mode === 'live' && !demo.contains(document.activeElement)) show(-1); });
    demo.addEventListener('focusin', (e) => { if (mode === 'live') { const n = nodeAt(e.target); if (n >= 0) show(n); } });
    demo.addEventListener('focusout', (e) => { if (mode === 'live' && !demo.contains(e.relatedTarget)) show(-1); });
    // touch: a tap lights the pair until the next tap
    document.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'touch' || mode !== 'live') return;
      const n = demo.contains(e.target) ? nodeAt(e.target) : -1; show(n === cur ? -1 : n);
    }, { passive: true });
    // under 800 px tall (phones, small tablets) the stage is not pinned (CSS): the reading plays as the demo
    // scrolls through the screen instead, so the kept note and the counter always fit
    const short = window.matchMedia('(max-width: 1100px) and (max-height: 800px)');
    scene(sec, (p, st) => { if (st || !short.matches) frame(p, st); }, { still: 1 });
    if (!reduced) track(demo, (p) => { if (short.matches) frame(remap(p, 0.12, 0.5), false); });
  })();

  /* =========================== 02 remembers =========================== */
  // Four memory objects (badge, ticket, call strip, slip) deal out of a stack as the demo scrolls in; the search
  // types "What do I owe Leo?" and the matching objects light. The two query keys swap the question; Forget
  // dissolves an object and leaves a dashed slot with Undo for 5 s. The grid never reflows.
  (function remembers() {
    const demo = $('#mem-demo'), box = $('#objs'), slots = $$('.mslot', box), objs = slots.map((s) => s.querySelector('.mobj'));
    const typed = $('#mem-typed'), tyQ = typed.parentElement, ans = $('#mem-ans'), ansT = $('#mem-ans-t'), tyA = ansT.parentElement;
    const keys = $$('.qkeys .key', demo);
    const Q = {
      leo: { q: 'What do I owe Leo?', a: 'You said you’d send Leo the Q4 deck by Friday. He prefers email, so I can draft it there.' },
      late: { q: 'What’s late?', a: 'Priya’s budget sheet. It was due Friday and hasn’t come in.' }
    };
    // the call strip: both sides as two lanes of dots; the dots at Leo's quote are the bright ones
    $$('.wv', demo).forEach((w) => {
      const leo = w.dataset.who === 'leo'; let s = '';
      for (let i = 0; i < 36; i++) {
        const talk = leo ? i >= 11 && i <= 27 : i <= 8 || i >= 30, quote = leo && i >= 13 && i <= 25;
        const a = talk ? 0.3 + 0.7 * Math.abs(Math.sin(i * 1.7 + (leo ? 0.4 : 2.1))) * (0.55 + 0.45 * hash(i, leo ? 3 : 7, 2)) : 0;
        const n = a > 0.68 ? 2 : a > 0.38 ? 1 : 0, fill = quote ? '#F2EFE9' : talk ? '#8A8780' : '#2B2E32', x = i * 7 + 3.5;
        for (let k = -n; k <= n; k++) s += `<circle cx="${x}" cy="${11 + k * 4.5}" r="${k === 0 ? 1.9 : 1.5}" fill="${fill}"/>`;
      }
      w.innerHTML = `<svg viewBox="0 0 252 22" preserveAspectRatio="xMinYMid meet" aria-hidden="true">${s}</svg>`;
    });
    let curQ = null, userQ = false, lastN = -1, nat = [], curP = 0;
    function applyQ(k, anim) {
      curQ = k;
      keys.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.q === k)));
      slots.forEach((s, i) => {
        const hit = !!k && objs[i].dataset.k === k && !s.classList.contains('forgot');
        FX.lit(objs[i], hit); s.classList.toggle('dim', !!k && !hit && !s.classList.contains('forgot'));
      });
      ans.classList.toggle('on', !!k);
      if (k && ansT.textContent !== Q[k].a) { ansT.textContent = Q[k].a; if (anim) typeOn(tyA, Q[k].a.length); }
    }
    // a forgotten object is dealt back in (demo only) on the next question, or 20 s after it was forgotten
    function restore(s) {
      if (!s.classList.contains('forgot')) return;
      const o = s.querySelector('.mobj'), fg = o.querySelector('.fgt');
      clearTimeout(s._t); clearTimeout(s._r);
      s.classList.remove('forgot', 'settled');
      o.removeAttribute('aria-hidden'); o.tabIndex = 0; fg.tabIndex = 0;
      let tag = s.querySelector('.rest-tag');
      if (!tag) { tag = document.createElement('span'); tag.className = 'rest-tag'; tag.setAttribute('role', 'status'); s.appendChild(tag); }
      tag.textContent = 'Restored for the demo';
      s.classList.add('back'); clearTimeout(s._b);
      s._b = setTimeout(() => { s.classList.remove('back'); }, 2600);
    }
    keys.forEach((b) => b.addEventListener('click', () => {
      slots.forEach(restore);
      userQ = true; const k = b.dataset.q;
      typed.textContent = Q[k].q; typeOn(tyQ, Q[k].q.length); applyQ(k, true);
    }));
    // Forget / Undo
    slots.forEach((s) => {
      const o = s.querySelector('.mobj'), fg = o.querySelector('.fgt'), un = s.querySelector('.undo');
      fg.addEventListener('click', (e) => {
        e.stopPropagation();
        s.classList.remove('settled', 'dim'); s.classList.add('forgot'); FX.lit(o, false);
        o.setAttribute('aria-hidden', 'true'); o.tabIndex = -1; fg.tabIndex = -1;
        un.focus({ preventScroll: true });
        clearTimeout(s._t);
        s._t = setTimeout(() => { s.classList.add('settled'); if (document.activeElement === un) keys[0].focus({ preventScroll: true }); }, 5000);
        clearTimeout(s._r); s._r = setTimeout(() => { restore(s); applyQ(curQ, false); }, 20000);
        o.classList.remove('armed');
      });
      un.addEventListener('click', () => {
        clearTimeout(s._t); clearTimeout(s._r); s.classList.remove('forgot', 'settled');
        o.removeAttribute('aria-hidden'); o.tabIndex = 0; fg.tabIndex = 0;
        applyQ(curQ, false); o.focus({ preventScroll: true });
      });
    });
    // touch: the first tap on an object shows its Forget key; a tap anywhere else hides it
    document.addEventListener('pointerdown', (e) => {
      if (!document.documentElement.classList.contains('fx-touch')) return;
      const hit = e.target.closest ? e.target.closest('.mobj') : null;
      if (hit && hit.closest('.mslot.forgot')) return;
      objs.forEach((o) => { if (o !== hit) o.classList.remove('armed'); });
      if (hit) hit.classList.add('armed');
    }, { passive: true });
    // the deal-out: each slot flies from a stack in the middle to its own place (its CSS grid place)
    const m = () => {
      slots.forEach((s) => { s.style.transform = ''; s._d = -1; });
      const W = box.clientWidth, H = box.clientHeight;
      nat = slots.map((s, i) => {
        const k = slots.length - 1 - i;
        return { dx: W / 2 - (s.offsetLeft + s.offsetWidth / 2) + (k - 1.5) * 5, dy: H / 2 - (s.offsetTop + s.offsetHeight / 2) - k * 7, r: (hash(i, 4, 1) - 0.5) * 9 };
      });
      slots.forEach((s, i) => { s.style.zIndex = String(10 + slots.length - i); });
      frame(curP);
    };
    function frame(p) {
      curP = p;
      slots.forEach((s, i) => {
        const d = easeOut(remap(p, 0.06 + i * 0.035, 0.26 + i * 0.035)), a = nat[i];
        if (!a) return;
        if (d >= 1) { if (s._d !== 1) { s._d = 1; s.style.transform = ''; } return; }
        s._d = d;
        const lift = Math.sin(d * Math.PI) * -26;
        s.style.transform = `translate3d(${(a.dx * (1 - d)).toFixed(1)}px,${(a.dy * (1 - d) + lift).toFixed(1)}px,0) rotate(${(a.r * (1 - d)).toFixed(2)}deg)`;
      });
      if (userQ) return;
      const n = Math.round(remap(p, 0.34, 0.44) * Q.leo.q.length);
      if (n !== lastN) {
        lastN = n; typed.textContent = Q.leo.q.slice(0, n);
        const done = n === Q.leo.q.length;
        if (done !== (curQ === 'leo')) applyQ(done ? 'leo' : null, false);
      }
    }
    Y.measured.add(m); m();
    track(demo, frame, { still: 0.66 });
  })();

  /* =========================== 03 acts =========================== */
  // "Yuki, play my focus one": Start, type Spotify, Enter, click Morning focus, Play. You grab the mouse at step 4
  // and it pauses; Resume and it finishes, checked after each step.
  (function acts() {
    const sec = $('#acts'), desk = $('#desk');
    const el = (id) => document.getElementById(id);
    const spot = el('spot'), side = $('#spot .aw-side'), sm = el('sm'), smTyped = el('sm-typed'), smH = el('sm-h'), res = el('t-res'), tgt = el('t-pl'), play = el('t-play');
    const card = el('runcard'), steps = $$('#rc-steps li'), fig = el('rc-fig'), figI = $$('#rc-fig i'), sub = el('rc-sub'), resume = el('t-resume'), learn = el('rc-learn');
    const cy = el('cur-y'), cu = el('cur-u'), rip = el('ripple'), keycap = el('keycap'), start = el('t-start'), tbSpot = el('tb-spot');
    const askCap = el('ask-cap');
    const awTitle = el('aw-title'), awSub = el('aw-sub'), awCount = el('aw-count'), bar = el('np-bar');
    const ticks = sec.querySelector('.ticks');
    const T = { y0: 0.03, u1: 0.065, u2: 0.1, s1c: 0.12, menu0: 0.135, menu1: 0.17, ok1: 0.18, ty0: 0.2, ty1: 0.29, lit: 0.31, ok2: 0.33, key: 0.355, open0: 0.375, open1: 0.43, ok3: 0.44,
      mv0: 0.46, you0: 0.5, pause: 0.53, toRes: 0.6, clickRes: 0.652, resume: 0.665, youOut: 0.7, s4c: 0.72, ok4: 0.745, mv5: 0.76, s5c: 0.81, ok5: 0.845, done: 0.88, learn: 0.92 };
    let K = null, W = 0, H = 0, resPos = null, wig = null;
    const m = () => {
      W = desk.clientWidth; H = desk.clientHeight;
      // measure targets in their final, untransformed place
      const keep = [spot.style.transform, sm.style.transform];
      spot.style.transform = 'none'; sm.style.transform = 'none';
      sm.classList.add('typing');
      const S = rel(start, desk), L = rel(tgt, desk), Pl = rel(play, desk), R = rel(res, desk), SD = rel(side, desk);
      sm.classList.remove('typing');
      spot.style.transform = keep[0]; sm.style.transform = keep[1];
      // the run card as it looks when paused (its Resume key is where your cursor goes)
      const wasPaused = card.classList.contains('paused'), wasDone = card.classList.contains('done');
      const keepSteps = steps.map((li) => li.className);
      card.classList.add('paused'); card.classList.remove('done');
      steps.forEach((li, i) => { li.classList.remove('on', 'ok', 'cur', 'last'); if (i < 3) li.classList.add('on', 'ok'); if (i === 2) li.classList.add('last'); if (i === 3) li.classList.add('on', 'cur'); });
      const CR = rel(card, desk); resPos = rel(resume, desk);
      steps.forEach((li, i) => { li.className = keepSteps[i]; });
      card.classList.toggle('paused', wasPaused); card.classList.toggle('done', wasDone);
      const SP = rel(spot, desk);
      const rest = { x: W * 0.5, y: H * 0.56 };
      // while Spotify opens, Yuki's cursor waits in the empty foot of Spotify's sidebar (never on a song); you grab
      // the mouse just as it sets off for the playlist. On a phone the run card sits in its own band at the top of
      // the desk, so neither cursor crosses it; only your Resume click lands on it.
      const park = { x: SD.x + SD.w * 0.42, y: SD.y + SD.h - 30 };
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
      last = {};
    };
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
      // Resume glows (and gets the lit border) while your cursor heads for it
      set('glow', p > T.toRes + 0.035 && p < T.resume + 0.01, (v) => { resume.classList.toggle('glow', v); FX.lit(resume, v); });
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
      set('chosen', p >= T.s4c + 0.004, (v) => {
        spot.classList.toggle('chosen', v); tgt.classList.toggle('sel', v);
        awTitle.textContent = v ? 'Morning focus' : 'Home'; awSub.textContent = v ? 'Alex · 38 songs' : 'Jump back in'; awCount.innerHTML = v ? '38 songs · 2 h 10 min' : '&nbsp;';
      });
      set('playing', p >= T.s5c + 0.004, (v) => spot.classList.toggle('playing', v));
      bar.style.transform = `scaleX(${(remap(p, T.s5c, 1) * 0.32).toFixed(3)})`;
      // --- the run card
      const okAt = [T.u1, T.u2, T.ok3, T.ok4, T.ok5], curFrom = [T.y0, T.u1, T.u2, T.ok3, T.ok4];
      let stepN = 0, okN = 0;
      steps.forEach((li, i) => {
        const on = p >= curFrom[i], ok = p >= okAt[i];
        if (on) stepN = i + 1; if (ok) okN = i + 1;
        li.classList.toggle('on', on); li.classList.toggle('ok', ok); li.classList.toggle('cur', on && !ok);
      });
      steps.forEach((li, i) => li.classList.toggle('last', i === okN - 1));
      figI.forEach((f, i) => { f.classList.toggle('on', i < stepN - 1 || p >= T.done); f.classList.toggle('cur', i === stepN - 1 && p < T.done); });
      const done = p >= T.done;
      set('done', done, (v) => card.classList.toggle('done', v));
      set('learn', p >= T.learn, (v) => learn.classList.toggle('on', v));
      const st = done ? 'Done · checked' : paused ? (W < 520 ? 'Paused at step 4' : 'Paused at step 4 · you have the mouse') : stepN ? `Step ${stepN} of 5` : 'Reading the screen';
      set('sub', st, (v) => { sub.textContent = v; });
      setTicks(ticks, [[0, T.pause], [T.pause, T.resume], [T.resume, T.done], [T.done, 0.97]], p);
    }
    Y.measured.add(m); m();
    scene(sec, frame, { still: 0.95 });
  })();

  /* =========================== 04 talks =========================== */
  // A short conversation on a clock: a question, a message sent after a countdown you can stop, steered mid-task,
  // then listening and a quiet card. Pause stops the clock and draws a still wave.
  (function talks() {
    const demo = $('#talk-demo'), cv = $('#wave'), tx = $('#tx'), leds = $$('#leds span'), offer = $('#offer'), res = $('#o-res');
    const pauseBtn = $('#v-pause'), pauseL = pauseBtn.querySelector('.vp-l');
    const ctx = cv.getContext('2d');
    const DPR = Math.min(2, window.devicePixelRatio || 1);
    const K = window.DotKit;
    let A = null, W = 0, H = 0, cols = 0, rows = 0, PP = 8, heights = null, stillMode = false, lastT = 0;
    const m = () => {
      W = cv.clientWidth; H = cv.clientHeight;
      cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
      PP = W < 500 ? 7 : 8; cols = Math.floor(W / PP); rows = Math.floor(H / PP);
      A = K.atlas([K.COL.base, K.COL.mid, K.COL.bone, K.COL.live], PP * 0.36, 16, DPR);
      heights = new Float32Array(cols);
      if (stillMode || paused) drawWave(lastT || 1.3, true);
    };
    const SCRIPT = [
      { t: 0, mode: 'listening' },
      { t: 0.7, mode: 'hearing', who: 'you', text: 'Yuki, what did Sam want this morning?', dur: 2.0 },
      { t: 2.9, mode: 'thinking' },
      { t: 3.5, mode: 'speaking', who: 'yuki', text: 'Sam asked you to look at his draft before four.', dur: 2.4 },
      { t: 6.3, mode: 'hearing', who: 'you', text: 'Tell him I’ll send notes by five.', dur: 1.8 },
      { t: 8.3, mode: 'speaking', narr: 'Message Sam on Slack · sending in 3', live: true },
      { t: 8.95, upd: 'Message Sam on Slack · sending in 2' },
      { t: 9.4, mode: 'hearing', who: 'you', text: 'Actually, make it half five.', tag: 'Steered mid-task', dur: 1.6, stop: true },
      { t: 11.2, mode: 'speaking', narr: 'Changed: “I’ll send notes by half five.”' },
      { t: 11.8, who: 'yuki', text: 'Sent to Sam: you’ll send notes by half five.', dur: 2.4 },
      { t: 14.6, mode: 'listening', offer: true },
      { t: 21.5, reset: true }
    ];
    let clock = 0, idx = 0, mode = 'listening', active = [], lastNarr = null, paused = false, offerT = 0, litT = 0;
    const PH = '<div class="ln narr ph"><span></span><span class="t">Waiting for “Yuki”</span></div>';
    tx.innerHTML = PH;
    const vis = watch(demo, '0px');
    function setMode(mm) { mode = mm; leds.forEach((l) => l.classList.toggle('on', l.dataset.m === mm)); }
    function addLine(ev) {
      const ph = tx.querySelector('.ph'); if (ph) ph.remove();
      const d = document.createElement('div');
      if (ev.narr) { d.className = 'ln narr' + (ev.live ? ' live' : ''); d.innerHTML = '<span></span><span class="t"></span>'; d.lastChild.textContent = ev.narr; lastNarr = d; }
      else {
        d.className = 'ln ' + ev.who;
        const words = ev.text.split(' ').map((w) => `<span class="w">${w}</span>`).join(' ');
        d.innerHTML = `<span class="who">${ev.who === 'you' ? 'You' : 'Yuki'}</span><span class="t">${words}${ev.tag ? `<span class="tag">${ev.tag}</span>` : ''}</span>`;
        active.push({ el: d, ws: [...d.querySelectorAll('.w')], t0: clock, dur: ev.dur || 2 });
      }
      tx.appendChild(d);
      while (tx.children.length > 7) tx.removeChild(tx.firstChild);
    }
    function showOffer(on) {
      offer.classList.toggle('on', on); offer.inert = !on;
      if (!on) { offer.classList.remove('res'); return; }
      FX.lit(offer, true); clearTimeout(litT); litT = setTimeout(() => FX.lit(offer, false), 900);
    }
    function run(ev) {
      if (ev.reset) { tx.innerHTML = PH; showOffer(false); clearTimeout(offerT); clock = 0; idx = 0; active = []; lastNarr = null; return; }
      if (ev.mode) setMode(ev.mode);
      if (ev.upd && lastNarr) lastNarr.lastChild.textContent = ev.upd;
      if (ev.stop && lastNarr) lastNarr.classList.remove('live');
      if (ev.who || ev.narr) addLine(ev);
      if (ev.offer) showOffer(true);
    }
    // the card's keys: either answer is a quiet confirmation for 2 s, then the card goes
    offer.addEventListener('click', (e) => {
      const b = e.target.closest('[data-a]'); if (!b) return;
      res.textContent = b.dataset.a === 'no' ? 'Resting until tomorrow.' : 'Playing Slow Roads.';
      offer.classList.add('res'); clearTimeout(offerT);
      const back = offer.contains(document.activeElement);
      offerT = setTimeout(() => { if (back) pauseBtn.focus({ preventScroll: true }); showOffer(false); }, 2000);
    });
    function still() {
      SCRIPT.slice(0, -1).forEach((ev) => { if (ev.upd && lastNarr) lastNarr.lastChild.textContent = ev.upd; if (ev.stop && lastNarr) lastNarr.classList.remove('live'); if (ev.who || ev.narr) addLine(ev); });
      tx.querySelectorAll('.w').forEach((w) => w.classList.add('on'));
      setMode('speaking'); offer.classList.add('on'); offer.inert = false; stillMode = true; drawWave(1.3, true);
    }
    function drawWave(t, isStill) {
      if (!A) return;
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
    Y.measured.add(m); m();
    if (reduced) { pauseBtn.hidden = true; still(); return; }
    offer.inert = true;
    // Pause / Play conversation (WCAG 2.2.2): stops the clock, draws a still wave
    pauseBtn.addEventListener('click', () => {
      paused = !paused; pauseBtn.setAttribute('aria-pressed', String(paused)); pauseL.textContent = paused ? 'Play' : 'Pause';
      if (paused) drawWave(lastT, true); else loop.kick();
    });
    run(SCRIPT[0]); idx = 1;
    loop.add((t, dt) => {
      if (!vis.on || paused) return false;
      clock += dt; lastT = t;
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

  /* =========================== 05 your PC: the diagram =========================== */
  // Four stacked SVG layers (lines, PC, relay, browser) share one viewBox; each layer moves as a whole with a CSS
  // transform and the packets are DOM dots, so a frame only writes transform and opacity. Faces carry icons only;
  // the words are upright labels and the A/B/C callouts. Hover / focus / tap a slab or a callout: that slab lifts
  // and gets the ink lit border, the others dim.
  const brainApi = (function brain() {
    const sec = $('#brain'), gPC = $('#xp-pc'), gRelay = $('#xp-relay'), gWeb = $('#xp-web'), gLines = $('#xp-lines'), pkBox = $('#xp-packets');
    const lLines = $('#xl-lines'), lPC = $('#xl-pc'), lRelay = $('#xl-relay'), lWeb = $('#xl-web'), stack = $('#xp');
    const xpl = $('#xplode'), callouts = $$('.callout', xpl), cWeb = $('.c-web', xpl), cRelay = $('.c-relay', xpl), cPC = $('.c-pc', xpl);
    const C = 0.866, S = 0.5, CX = 320;
    const iso = (u, v, z) => [CX + (u - v) * C, (u + v) * S - (z || 0)];
    const pts = (a) => a.map((q) => q[0].toFixed(1) + ',' + q[1].toFixed(1)).join(' ');
    // a slab: its lit outline (under), top face + two side faces, details in face space through an iso matrix,
    // and its letter badge (A/B/C, upright, outside the matrix; shown below 1100 px, where the A/B/C list replaces the callouts)
    function slab(w, d, th, face, detail, lbl) {
      const a = iso(-w / 2, -d / 2), b = iso(w / 2, -d / 2), c = iso(w / 2, d / 2), e = iso(-w / 2, d / 2);
      const dn = (q, k) => [q[0], q[1] + th + (k || 0)];
      const g = 8, A2 = iso(-w / 2 - g, -d / 2 - g, 4), B2 = iso(w / 2 + g, -d / 2 - g, 4), C2 = iso(w / 2 + g, d / 2 + g, 4), E2 = iso(-w / 2 - g, d / 2 + g, 4);
      const sil = pts([A2, B2, dn(B2, 8), dn(C2, 8), dn(E2, 8), E2]);
      const L = lbl.side === 'r' ? { x: b[0] + 34, y: b[1] + th / 2 } : { x: e[0] - 34, y: e[1] + th / 2 };
      return `<polygon class="lit-h" points="${sil}"/><polygon class="lit-o" points="${sil}"/>` +
        `<polygon class="hit" points="${pts([e, c, dn(c), dn(e)])}" fill="#D9D4CA" stroke="#0B0B0C" stroke-width="1"/>` +
        `<polygon class="hit" points="${pts([c, b, dn(b), dn(c)])}" fill="#C9C3B8" stroke="#0B0B0C" stroke-width="1"/>` +
        `<polygon class="hit" points="${pts([a, b, c, e])}" fill="${face}" stroke="#0B0B0C" stroke-width="1"/>` +
        `<g transform="matrix(${C} ${S} ${-C} ${S} ${CX} 0)" pointer-events="none">${detail || ''}</g>` +
        `<g class="slab-lbl" transform="translate(${L.x.toFixed(1)} ${L.y.toFixed(1)})"><circle r="25" fill="#0B0B0C"/><text y="9" text-anchor="middle">${lbl.t}</text></g>`;
    }
    // a 5 x 5 dot glyph in face space
    const glyph = (name, cx, cy, s) => { let o = ''; GL[name].forEach((row, y) => { for (let x = 0; x < 5; x++) if (row[x] === '1') o += `<circle cx="${(cx + (x - 2) * s).toFixed(1)}" cy="${(cy + (y - 2) * s).toFixed(1)}" r="${(s * 0.36).toFixed(2)}" fill="#0B0B0C"/>`; }); return o; };
    const tile = (x, y, w, h, g, cls) => `<g class="${cls || ''}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" fill="#F2EFE9" stroke="#0B0B0C"/>` +
      `<rect x="${x + 6}" y="${y + 6}" width="${w - 12}" height="${h - 12}" rx="3" fill="url(#pdots2)" opacity=".55"/>` +
      `<rect x="${x + w / 2 - 34}" y="${y + h / 2 - 34}" width="68" height="68" rx="8" fill="#FBFAF7" stroke="#0B0B0C" stroke-width=".8"/>` + glyph(g, x + w / 2, y + h / 2, 11) + '</g>';
    // PC: memory (lock), screen (window), voice (wave), AI keys (key; it dims when the AI needs no key)
    gPC.innerHTML = slab(300, 230, 26, '#FBFAF7',
      `<rect x="-150" y="-115" width="300" height="230" fill="url(#pdots)"/>` +
      tile(-134, -100, 126, 94, 'lock') + tile(8, -100, 126, 94, 'win') + tile(-134, 8, 126, 92, 'wave') + tile(8, 8, 126, 92, 'key', 'tile-key'),
      { t: 'C', side: 'l' });
    gRelay.innerHTML = slab(230, 170, 9, '#EFEBE4',
      `<rect x="-115" y="-85" width="230" height="170" fill="url(#pdots2)" opacity=".55"/>` +
      `<circle cx="0" cy="0" r="32" fill="#FBFAF7" stroke="#0B0B0C"/>` + glyph('lock', 0, 0, 9),
      { t: 'B', side: 'r' });
    gWeb.innerHTML = slab(280, 196, 14, '#FBFAF7',
      `<rect x="-140" y="-98" width="280" height="24" fill="#E7E3DB" stroke="#0B0B0C"/>` +
      `<circle cx="-124" cy="-86" r="3.4" fill="#0B0B0C"/><circle cx="-112" cy="-86" r="3.4" fill="#0B0B0C" opacity=".4"/><circle cx="-100" cy="-86" r="3.4" fill="#0B0B0C" opacity=".2"/>` +
      `<rect x="-80" y="-92" width="150" height="12" rx="6" fill="#FBFAF7" stroke="#0B0B0C" stroke-width=".8"/>` +
      `<rect x="-124" y="-60" width="58" height="146" fill="url(#pdots)" stroke="#0B0B0C" stroke-width=".6"/>` +
      `<rect x="-54" y="-60" width="180" height="30" rx="4" fill="#0B0B0C"/><circle cx="110" cy="-45" r="4.5" fill="${(window.YAccent && YAccent.hex) || '#6FEBC4'}"/>` +
      `<rect x="-54" y="-18" width="180" height="12" rx="2" fill="#0B0B0C" opacity=".7"/><rect x="-54" y="2" width="140" height="12" rx="2" fill="#0B0B0C" opacity=".35"/>` +
      `<rect x="-54" y="22" width="160" height="12" rx="2" fill="#0B0B0C" opacity=".35"/>` +
      `<rect x="-54" y="46" width="180" height="40" rx="4" fill="none" stroke="#0B0B0C" stroke-dasharray="2 3"/>`,
      { t: 'A', side: 'l' });
    // stream lines: up on the left (the live view), down on the right (your commands)
    const LX = [-46, 46], TOP = 150, BOT = 520;
    gLines.innerHTML = LX.map((dx) => `<path d="M${CX + dx} ${BOT} V ${TOP}"/>`).join('');
    const REST = { relay: 336, web: TOP };
    gPC.setAttribute('transform', `translate(0 ${BOT})`); gRelay.setAttribute('transform', `translate(0 ${REST.relay})`); gWeb.setAttribute('transform', `translate(0 ${REST.web})`);
    // packets: DOM dots over the layers
    const PK = [];
    for (let k = 0; k < 10; k++) {
      const el = document.createElement('i');
      pkBox.appendChild(el); PK.push({ el, up: k < 7, r: k < 7 ? 3 : 3.4, off: k < 7 ? k / 7 : (k - 7) / 3, sealed: false, x: 0 });
    }
    // the viewBox is fitted (meet) into the layer box: sc = user units to px, (ox, oy) = where the viewBox starts
    let e = 0, sc = 1, ox = 0, oy = 0;
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
      const on = e > 0.85, relayY = yOf().relay;
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
    function frame(p) { e = easeIO(remap(p, 0.04, 0.42)); place(); }
    // a sticky scene on wide screens, a normal section that explodes as it scrolls in below 1100 px; both are wired
    // and the media query picks one each frame, so resizing across 1100 px switches cleanly
    const narrow = window.matchMedia('(max-width: 1100px)');
    track(xpl, (p, still) => { if (narrow.matches) frame(still ? 1 : remap(p, 0.2, 0.62)); }, { still: 1 });
    scene(sec, (p) => { if (!narrow.matches) frame(p); }, { still: 1 });
    if (reduced) packets(0.3);
    const vis = watch(sec, '0px');
    if (!reduced) loop.add((t) => { if (!vis.on) return false; packets(t); return e > 0.85; });

    // hover / focus / tap: one slab lifts with its ink lit border; the other two dim (art only, never the words)
    const layer = { pc: lPC, relay: lRelay, web: lWeb };
    let hv = null, tapT = 0;
    function hov(s) {
      if (s === hv) return; hv = s;
      stack.classList.toggle('hovering', !!s);
      Object.keys(layer).forEach((k) => layer[k].classList.toggle('hov', k === s));
      callouts.forEach((c) => c.classList.toggle('hov', c.dataset.s === s));
    }
    const slabAt = (t) => { if (!t || !t.closest) return null; const c = t.closest('.callout'); if (c) return c.dataset.s; const h = t.closest('.hit'); return h ? h.closest('.slab').dataset.s : null; };
    xpl.addEventListener('pointerover', (ev) => { if (ev.pointerType !== 'touch') hov(slabAt(ev.target)); });
    xpl.addEventListener('pointerleave', (ev) => { if (ev.pointerType !== 'touch' && !xpl.contains(document.activeElement)) hov(null); });
    xpl.addEventListener('pointerdown', (ev) => {
      if (ev.pointerType !== 'touch') return;
      const s = slabAt(ev.target); hov(s); clearTimeout(tapT); if (s) tapT = setTimeout(() => hov(null), 900);
    }, { passive: true });
    callouts.forEach((c) => {
      c.addEventListener('focus', () => hov(c.dataset.s));
      c.addEventListener('blur', () => hov(null));
    });
    // the one coupling with the console: no key needed (Ollama) dims the PC slab's key tile
    return { noKey(on) { gPC.classList.toggle('nokey', on); } };
  })();

  /* =========================== 05 your PC: the Any AI console =========================== */
  // The knob is the control (role=slider: arrows, Home, End, drag); the ring labels are a mirror you can click.
  // The readout says, per model, where the AI thinks: the AI chip slides between THIS PC and CLOUD.
  (function anyAI() {
    const SENT = 'only what a question needs is sent.';
    const P = [
      { n: 'Claude', s: 'Anthropic, or Amazon Bedrock', cloud: true, key: true, say: `Claude thinks in the cloud (Anthropic or Amazon Bedrock), with your key or AWS sign-in. Your key and your memory stay on this PC; ${SENT}` },
      { n: 'OpenAI', s: 'GPT models', cloud: true, key: true, say: `OpenAI thinks in its cloud, with your key. Your key and your memory stay on this PC; ${SENT}` },
      { n: 'Gemini', s: 'Google', cloud: true, key: true, say: `Gemini thinks in Google’s cloud, with your key. Your key and your memory stay on this PC; ${SENT}` },
      { n: 'OpenRouter', s: 'Free models', cloud: true, key: true, say: `OpenRouter’s free models think in the cloud, with your key. Your key and your memory stay on this PC; ${SENT}` },
      { n: 'Ollama', s: 'Fully local', cloud: false, key: false, say: 'Ollama thinks on this PC, even offline. No key. Nothing leaves your PC.' },
      { n: 'Other', s: 'DeepSeek, or any OpenAI-compatible service', cloud: true, key: true, say: `Any OpenAI-compatible service, with its key kept on this PC. Your memory stays here; ${SENT}` }
    ];
    const ANG = [-125, -75, -25, 25, 75, 125];
    const con = $('#ai'), wrap = $('#knob-wrap'), knob = $('#knob'), cap = $('#knob-cap'), ticksEl = $('#knob-ticks'), labels = $('#knob-labels'), lcd = $('#lcd');
    const nEl = $('#lcd-n'), sEl = $('#lcd-s'), say = $('#ai-say'), picto = $('#picto'), chip = $('#ai-chip'), plCap = $('#pl-cap');
    const boxPC = $('.p-pc', picto), boxCloud = $('.p-cloud', picto);
    let cur = -1, chipX = [0, 0];
    // the tick ring and the ring labels (buttons: aria-hidden mirrors of the slider)
    labels.innerHTML = P.map((p, i) => `<button type="button" class="kl" data-i="${i}" data-fx="press" tabindex="-1">${p.n}</button>`).join('');
    const kls = $$('.kl', labels);
    let tk = '';
    for (let a = -125; a <= 125; a += 5) tk += `<i class="${ANG.indexOf(a) >= 0 ? 'major' : ''}" data-a="${a}"></i>`;
    ticksEl.innerHTML = tk;
    const tks = $$('i', ticksEl), majors = ANG.map((a) => ticksEl.querySelector(`i[data-a="${a}"]`));
    function placeRing() {
      const kw = wrap.clientWidth, rT = kw * 0.37, rL = kw * 0.5 + 2;
      tks.forEach((t) => { const rad = (Number(t.dataset.a) - 90) * Math.PI / 180; t.style.transform = `translate(${(Math.cos(rad) * rT).toFixed(1)}px,${(Math.sin(rad) * rT).toFixed(1)}px)`; });
      kls.forEach((b, i) => { const rad = (ANG[i] - 90) * Math.PI / 180; b.style.left = `calc(50% + ${(Math.cos(rad) * rL).toFixed(1)}px)`; b.style.top = `calc(50% + ${(Math.sin(rad) * rL).toFixed(1)}px)`; });
      // the AI chip's two seats: right of the glyphs in THIS PC, under the label in CLOUD
      const pr = picto.getBoundingClientRect(), a = boxPC.getBoundingClientRect(), b = boxCloud.getBoundingClientRect();
      chipX = [a.right - pr.left - 26 - 10, b.left - pr.left + 10];
      chip.style.top = (a.top - pr.top + 30) + 'px';
      if (cur >= 0) chip.style.transform = `translateX(${chipX[P[cur].cloud ? 1 : 0]}px)`;
    }
    function select(i, fromDrag) {
      i = clamp(i, 0, P.length - 1);
      const changed = i !== cur; cur = i;
      const p = P[i];
      cap.style.transition = fromDrag ? 'transform .25s var(--ease)' : '';
      cap.style.transform = `rotate(${ANG[i]}deg)`;
      majors.forEach((mj, j) => mj.classList.toggle('on', j === i));
      kls.forEach((b, j) => b.classList.toggle('on', j === i));
      knob.setAttribute('aria-valuenow', String(i)); knob.setAttribute('aria-valuetext', `${p.n}: ${p.say}`);
      nEl.textContent = p.n; sEl.textContent = p.s; say.textContent = p.say;
      picto.classList.toggle('local', !p.cloud); picto.classList.toggle('nokey', !p.key);
      plCap.textContent = p.cloud ? 'only what a question needs' : 'nothing leaves';
      chip.style.transform = `translateX(${chipX[p.cloud ? 1 : 0]}px)`;
      brainApi.noKey(!p.key);
      if (changed && !reduced) { [lcd, con].forEach((x) => { x.classList.remove('swap'); void x.offsetWidth; x.classList.add('swap'); }); }
    }
    kls.forEach((b, i) => {
      b.addEventListener('click', () => { select(i); knob.focus({ preventScroll: true }); });
      b.addEventListener('pointerenter', () => { majors[i].classList.add('pv'); b.classList.add('pv'); });
      b.addEventListener('pointerleave', () => { majors[i].classList.remove('pv'); b.classList.remove('pv'); });
    });
    knob.addEventListener('keydown', (ev) => {
      const k = ev.key;
      if (k === 'ArrowRight' || k === 'ArrowUp') select(cur + 1);
      else if (k === 'ArrowLeft' || k === 'ArrowDown') select(cur - 1);
      else if (k === 'Home') select(0);
      else if (k === 'End') select(P.length - 1);
      else return;
      ev.preventDefault();
    });
    let drag = false;
    const angAt = (ev) => { const r = knob.getBoundingClientRect(); return Math.atan2(ev.clientY - (r.top + r.height / 2), ev.clientX - (r.left + r.width / 2)) * 180 / Math.PI + 90; };
    knob.addEventListener('pointerdown', (ev) => { drag = true; knob.setPointerCapture(ev.pointerId); cap.style.transition = 'none'; });
    knob.addEventListener('pointermove', (ev) => {
      if (!drag) return;
      let a = angAt(ev); if (a > 180) a -= 360;
      a = clamp(a, -135, 135);
      cap.style.transform = `rotate(${a}deg)`;
      let best = 0; ANG.forEach((g, i) => { if (Math.abs(g - a) < Math.abs(ANG[best] - a)) best = i; });
      if (best !== cur) { select(best, true); cap.style.transition = 'none'; cap.style.transform = `rotate(${a}deg)`; }
    });
    const endDrag = () => { if (!drag) return; drag = false; select(cur, true); };
    knob.addEventListener('pointerup', endDrag); knob.addEventListener('pointercancel', endDrag);
    Y.measured.add(placeRing); placeRing();
    select(0);

    // #ai lands where the console is in view (in the sticky scene: once the diagram has exploded)
    function goAI(smoothly) {
      const sec = $('#brain');
      if (reduced || window.matchMedia('(max-width: 1100px)').matches) { con.scrollIntoView({ behavior: smoothly ? 'smooth' : 'auto', block: 'center' }); return; }
      const top = sec.getBoundingClientRect().top + scrollY, len = sec.offsetHeight - innerHeight;
      window.scrollTo({ top: top + len * 0.6, behavior: smoothly ? 'smooth' : 'auto' });
    }
    if (location.hash === '#ai') addEventListener('load', () => setTimeout(() => goAI(false), 0));
    addEventListener('hashchange', () => { if (location.hash === '#ai') goAI(true); });
    document.addEventListener('click', (ev) => {
      const a = ev.target.closest && ev.target.closest('a[href$="#ai"]');
      if (!a || a.pathname !== location.pathname) return;
      ev.preventDefault(); history.replaceState(null, '', '#ai'); goAI(true);
    });
  })();

  /* =========================== 06 download =========================== */
  (function download() {
    const btn = $('#dl-btn'), bar = $('#dl-bar'), label = $('#dl-l');
    if (!btn) return;
    let t0 = 0, running = false;
    btn.addEventListener('click', (ev) => {
      ev.preventDefault();
      if (running) return;
      running = true; t0 = performance.now();
      if (reduced) { bar.style.setProperty('--dl', '1'); label.textContent = 'Saved: Yuki-Setup-0.9.2.exe'; running = false; return; }
      const off = loop.add(() => {
        const f = clamp((performance.now() - t0) / 2600, 0, 1);
        bar.style.setProperty('--dl', f.toFixed(3));
        label.textContent = f < 1 ? `Downloading… ${Math.round(f * 100)}%` : 'Saved: Yuki-Setup-0.9.2.exe';
        if (f < 1) return true;
        running = false; off(); return false;
      });
    });
  })();
})();
