/* Yuki website / guide callouts + the family lineup (18 Oct, the teenage-engineering touch).
   1. Guide callouts. A product shot is a .pstage[data-guide]: a flat ground with the demo on it. Each
      <button class="gd"> inside is one numbered callout:
        data-for="sel"     the part its leader line points at (inside the stage); data-alt="sel" if that part is hidden
        data-at="ax,ay"    where on the part the line ends (fractions of its box); data-at-s for phones
        data-side="t|b"    the label row it sits in (top or bottom margin of the stage); data-side-s for phones
        data-via="l|r"     run the leader down a clear lane beside the object (the ground's side margin, or beside
                           data-via-el="sel", data-via-gap px wide) and into the part from the side, so it never
                           crosses the product's own text; data-dx="px" nudges the end point (e.g. into a margin)
        data-watch="sel"   also re-place when this element changes size (e.g. the run card growing)
        Every data-* option takes a phone override with -s (data-at-s, data-side-s, data-via-s, data-via-el-s...).
        data-lit-pair="k"  shared with the part: hover / focus / tap either one and both light (js/fx.js pairing,
                           the white full-border ring); css/landing.css styles the lit number and line.
      Labels are spread along their row so they never overlap; the leader runs down from the number, jogs in
      the margin, and drops onto the part with a dot (or comes in from its lane). Numbers are written by position
      (top row left to right, then the bottom row), so they always read in order. If the part isn't shown
      (display: none) the callout dims.
      Placement is measured with offsets (transforms ignored, so moving scenes don't matter) on resize, on font
      load and when a watched element resizes. Nothing here runs per frame.
   2. The lineup (Download): Yuki's pieces drawn flat at one scale, as inline SVG. Hover, focus or tap one: it
      lifts off the ground (transform) and gets the lit border (Y.fx.lit).
   Port: components/landing/Guide.tsx (a hook measuring with ResizeObserver) and Lineup.tsx (static SVG). */
(function () {
  'use strict';
  const Y = window.Y; if (!Y) return;
  const { $$ } = Y;
  const FX = Y.fx || { lit() {} };
  const small = window.matchMedia('(max-width: 760px)');
  const NS = 'http://www.w3.org/2000/svg';
  const GAP = 14;

  /* ---------------- 1. guide callouts ---------------- */
  // el's box relative to the stage's padding box, ignoring transforms (offsets + the borders crossed on the way)
  function box(el, stage) {
    if (!el || !el.offsetParent) return null;
    let x = 0, y = 0, e = el;
    while (e && e !== stage) {
      x += e.offsetLeft; y += e.offsetTop;
      e = e.offsetParent;
      if (e && e !== stage) { x += e.clientLeft; y += e.clientTop; }
    }
    if (e !== stage) return null;
    return { x, y, w: el.offsetWidth, h: el.offsetHeight };
  }
  function build(g) {
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('class', 'gd-ln'); svg.setAttribute('aria-hidden', 'true');
    const p = document.createElementNS(NS, 'path'), c = document.createElementNS(NS, 'circle');
    c.setAttribute('r', '2.6');
    svg.appendChild(p); svg.appendChild(c); g.appendChild(svg);
    g._p = p; g._c = c; g._n = g.querySelector('b');
  }
  // spread one row of labels: each wants its number over its target; keep them inside [0, W] and GAP apart
  function spread(row, W, m) {
    row.sort((a, b) => a.want - b.want);
    row.forEach((it) => { it.left = Math.max(m, Math.min(W - m - it.w, it.want - it.nx)); });
    for (let i = 1; i < row.length; i++) row[i].left = Math.max(row[i].left, row[i - 1].left + row[i - 1].w + GAP);
    for (let i = row.length - 1; i >= 0; i--) {
      const lim = i === row.length - 1 ? W - m - row[i].w : row[i + 1].left - GAP - row[i].w;
      row[i].left = Math.max(0, Math.min(row[i].left, lim));
    }
  }
  function layout(st) {
    const gds = st._gds; if (!gds || !st.offsetParent) return;
    const sm = small.matches, W = st.clientWidth, H = st.clientHeight;
    const cs = getComputedStyle(st), pt = parseFloat(cs.paddingTop) || 0, pb = parseFloat(cs.paddingBottom) || 0;
    const pl = parseFloat(cs.paddingLeft) || 0, pr = parseFloat(cs.paddingRight) || 0;
    const m = sm ? 2 : Math.min(16, pl / 2);   // keep labels off the ground's edge
    const opt = (g, k) => { const s = g.dataset[k + 'S']; return sm && s !== undefined ? s : g.dataset[k]; };
    // read everything first
    const items = gds.map((g) => {
      const side = opt(g, 'side') || 't';
      const t = st.querySelector(opt(g, 'for'));
      let b = box(t, st);
      if (!b && g.dataset.alt) b = box(st.querySelector(g.dataset.alt), st);
      const at = (opt(g, 'at') || '.5,.5').split(',').map(Number);
      // a part that isn't there at all (hidden attribute, e.g. Pause under reduced motion) takes its callout with it
      g.classList.toggle('gd-gone', !b && !!t && !!t.closest('[hidden]'));
      const n = g._n;
      const it = { g, side, b, tx: b ? b.x + b.w * at[0] + (+opt(g, 'dx') || 0) : W / 2, ty: b ? b.y + b.h * at[1] : 0,
        w: g.offsetWidth, h: g.offsetHeight, nx: n.offsetLeft + n.offsetWidth / 2, ny0: n.offsetTop, ny1: n.offsetTop + n.offsetHeight, jf: 0.55 };
      // via: the leader runs down a clear lane beside the object (or beside data-via-el) and comes into the part
      // from the side, so it never crosses the product's own text and controls
      const via = opt(g, 'via');
      if (via === 'l' || via === 'r') {
        const sel = opt(g, 'viaEl'), e = sel ? box(st.querySelector(sel), st) : null;
        it.via = via; it.key = side + via + (e ? sel : '');
        it.xo = e ? (via === 'r' ? e.x + e.w : e.x) : (via === 'r' ? W - pr : pl);
        it.sp = e ? (+opt(g, 'viaGap') || 16) : (via === 'r' ? pr : pl);
      }
      return it;
    });
    // lanes: callouts sharing one lane from one row; the one reaching deeper takes the outer lane and jogs nearer its label
    const groups = {};
    items.forEach((it) => { if (it.via && it.b) (groups[it.key] = groups[it.key] || []).push(it); });
    Object.values(groups).forEach((gr) => {
      gr.sort((a, b) => (a.side === 't' ? a.ty - b.ty : b.ty - a.ty));
      gr.forEach((it, k) => {
        const off = it.sp * (k + 1) / (gr.length + 1);
        it.cx = it.via === 'r' ? it.xo + off : it.xo - off;
        if (gr.length > 1) it.jf = 0.78 - 0.56 * k / (gr.length - 1);
      });
    });
    // a part that's hidden for now (e.g. Stop while paused) keeps its callout where it was, so numbers don't reshuffle
    items.forEach((it) => {
      const k = sm ? '_wantS' : '_want';
      if (it.b) it.g[k] = it.want = it.cx !== undefined ? it.cx : it.tx;
      else it.want = it.g[k] !== undefined ? it.g[k] : it.tx;
    });
    const top = items.filter((i) => i.side === 't'), bot = items.filter((i) => i.side === 'b');
    spread(top, W, m); spread(bot, W, m);
    // number by position, the way a guide reads: the top row left to right, then the bottom row
    let num = 0;
    top.concat(bot).forEach((it) => { if (!it.g.classList.contains('gd-gone')) { const s = String(++num).padStart(2, '0'); if (it.g._n.textContent !== s) it.g._n.textContent = s; } });
    // then write
    st.classList.toggle('gd-has-t', top.length > 0); st.classList.toggle('gd-has-b', bot.length > 0);
    items.forEach((it) => {
      const g = it.g, isTop = it.side === 't';
      const rowH = isTop ? pt : pb;
      const y = isTop ? Math.max(0, (rowH - it.h) / 2) : H - rowH + Math.max(0, (rowH - it.h) / 2);
      g.style.left = it.left.toFixed(1) + 'px'; g.style.top = y.toFixed(1) + 'px';
      g.classList.toggle('gd-flip', it.left + it.nx > W - 160);
      g.classList.toggle('gd-off', !it.b);
      if (!it.b) { g._p.setAttribute('d', ''); return; }
      // local coordinates (the callout's top-left is the origin)
      const f = (v) => v.toFixed(1);
      const sx = it.nx, sy = isTop ? it.ny1 : it.ny0, ex = it.tx - it.left, ey = it.ty - y;
      const edge = isTop ? rowH - y : H - rowH - y;            // the content edge, in local y
      const jog = isTop ? sy + (edge - sy) * it.jf : sy - (sy - edge) * it.jf;
      let d;
      if (it.cx !== undefined) {
        const cx = it.cx - it.left;
        d = `M${f(sx)} ${f(sy)}` + (Math.abs(cx - sx) < 1.5 ? '' : `V${f(jog)}H${f(cx)}`) + `V${f(ey)}H${f(ex)}`;
      } else {
        d = Math.abs(ex - sx) < 1.5 ? `M${f(sx)} ${f(sy)}V${f(ey)}` : `M${f(sx)} ${f(sy)}V${f(jog)}H${f(ex)}V${f(ey)}`;
      }
      g._p.setAttribute('d', d);
      g._c.setAttribute('cx', f(ex)); g._c.setAttribute('cy', f(ey));
    });
  }
  const stages = $$('.pstage[data-guide]');
  const ro = window.ResizeObserver ? new ResizeObserver((es) => {
    const set = new Set(); es.forEach((e) => set.add(e.target._gdStage || e.target)); set.forEach(layout);
  }) : null;
  stages.forEach((st) => {
    st._gds = $$('.gd', st);
    st._gds.forEach(build);
    if (ro) {
      ro.observe(st);
      st._gds.forEach((g) => { const w = g.dataset.watch && st.querySelector(g.dataset.watch); if (w && !w._gdStage) { w._gdStage = st; ro.observe(w); } });
    }
    Y.measured.add(() => layout(st));
    layout(st);
    // a callout itself does nothing on click; on a phone a tap shows its label (fx pairing), a second tap hides it
    st.addEventListener('click', (e) => {
      const g = e.target.closest && e.target.closest('.gd'); if (!g) return;
      if (document.documentElement.classList.contains('fx-touch') && g._was) { st.querySelectorAll('.fx-paired').forEach((x) => x.classList.remove('fx-paired')); g.blur(); }
    });
    st.addEventListener('pointerdown', (e) => { const g = e.target.closest && e.target.closest('.gd'); if (g) g._was = g.classList.contains('fx-paired'); }, { capture: true, passive: true });
  });
  small.addEventListener && small.addEventListener('change', () => stages.forEach(layout));

  /* ---------------- 2. the lineup ---------------- */
  // flat two-tone drawings, one unit = the same size in all four (the lineup sizes each by its viewBox width)
  const B = '#121315', E = '#34373C', D = '#26292C', T = '#4A4E54', T2 = '#8A8780', L = '#F2EFE9';
  const YD = [[13.5, 10.5], [19.5, 16.5], [25.5, 22.5], [49.5, 10.5], [43.5, 16.5], [37.5, 22.5], [31.5, 36.5], [31.5, 44.5], [31.5, 52.5]];
  const ymark = (cx, cy, s) => YD.map(([x, y]) => `<circle cx="${(cx + (x - 31.5) * s).toFixed(2)}" cy="${(cy + (y - 31.5) * s).toFixed(2)}" r="${(3.5 * s).toFixed(2)}" fill="${L}"/>`).join('') +
    `<circle class="lv" cx="${cx.toFixed(2)}" cy="${(cy - 3 * s).toFixed(2)}" r="${(3.5 * s).toFixed(2)}"/>`;
  const bar = (x, y, w, h, f, o) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${Math.min(h / 2, 2)}" fill="${f}"${o ? ` opacity="${o}"` : ''}/>`;
  const PIECES = {
    app: { vb: '0 0 360 240', svg: () => {
      let s = `<rect x=".5" y=".5" width="359" height="239" rx="10" fill="${B}" stroke="${E}"/>` +
        `<path d="M1 26.5H359M56.5 27V239" stroke="${D}"/>` + ymark(16, 13.5, 0.26) + bar(30, 11, 34, 5, T2) +
        `<path d="M316 13.5h9" stroke="${T2}"/><rect x="334.5" y="9.5" width="8" height="8" fill="none" stroke="${T2}"/><path d="M349 10l7 7M356 10l-7 7" stroke="${T2}"/>`;
      for (let i = 0; i < 5; i++) s += `<rect x="20.5" y="${42.5 + i * 28}" width="16" height="16" rx="4" fill="${i ? 'none' : D}" stroke="${i ? D : T}"/>`;
      s += bar(74, 42, 74, 8, L, 0.9) + bar(74, 57, 128, 5, T);
      s += `<rect x="74.5" y="74.5" width="128" height="62" rx="7" fill="#151618" stroke="${D}"/><rect x="212.5" y="74.5" width="130" height="62" rx="7" fill="#151618" stroke="${D}"/>`;
      s += bar(86, 86, 40, 4, T2) + `<circle class="lv" cx="190" cy="88" r="3"/>` + bar(86, 100, 86, 7, L, 0.85) + bar(86, 114, 60, 4, T);
      for (let i = 0; i < 6; i++) for (let j = 0; j < 3; j++) s += `<circle cx="${226 + i * 8}" cy="${92 + j * 8}" r="1.7" fill="${(i + j) % 3 ? T : L}"/>`;
      s += bar(282, 92, 48, 4, T2) + bar(282, 104, 36, 4, T);
      s += `<rect x="74.5" y="150.5" width="268" height="74" rx="9" fill="#0D0E0F" stroke="${E}"/>`;
      for (let i = 0; i < 5; i++) s += `<rect ${i === 3 ? 'class="lv"' : `fill="${i < 3 ? T2 : D}"`} x="${88 + i * 12}" y="163" width="9" height="3" rx="1.5"/>`;
      s += bar(156, 160, 120, 7, L, 0.9) + bar(88, 180, 160, 5, T2) + bar(88, 193, 120, 5, T) + bar(88, 206, 136, 5, T);
      return s;
    } },
    pill: { vb: '0 0 150 36', svg: () => {
      let s = `<rect x=".5" y=".5" width="149" height="35" rx="17.5" fill="${B}" stroke="${E}"/>` + ymark(19, 18.5, 0.3);
      const hs = [1, 2, 3, 2, 4, 3, 5, 4, 3, 5, 3, 2, 3, 1, 2];
      hs.forEach((h, i) => { for (let k = -Math.floor(h / 2); k <= Math.floor(h / 2); k++) s += `<circle ${i > 4 && i < 11 ? 'class="lv"' : `fill="${L}"`} cx="${38 + i * 5.6}" cy="${18 + k * 4.4}" r="${k ? 1.3 : 1.6}"/>`; });
      s += `<circle cx="131" cy="18" r="6.5" fill="none" stroke="${T}"/><rect x="128.5" y="15" width="1.8" height="6" rx=".9" fill="${L}"/><rect x="131.7" y="15" width="1.8" height="6" rx=".9" fill="${L}"/>`;
      return s;
    } },
    tray: { vb: '0 0 130 190', svg: () => {
      let s = `<rect x=".5" y=".5" width="129" height="148" rx="10" fill="${B}" stroke="${E}"/>` + ymark(17, 18, 0.24) + bar(30, 15, 46, 6, L, 0.9) +
        `<circle class="lv" cx="113" cy="18" r="3"/><path d="M1 34.5H129" stroke="${D}"/>`;
      const rows = [[48, 62], [72, 54], [96, 46], [128, 30]];
      rows.forEach(([y, w], i) => {
        s += `<rect x="14.5" y="${y - 4.5}" width="9" height="9" rx="2.5" fill="none" stroke="${T}"/>` + bar(31, y - 2.5, w, 5, T2);
        if (i === 1) s += `<rect x="98.5" y="${y - 5.5}" width="19" height="11" rx="5.5" fill="none" stroke="${T}"/><circle cx="104" cy="${y}" r="3" fill="${T2}"/>`;
      });
      s += `<path d="M1 112.5H129" stroke="${D}"/>`;
      s += `<rect x=".5" y="158.5" width="129" height="31" rx="7" fill="#141517" stroke="${D}"/>` +
        `<path d="M12 177l4-4 4 4" fill="none" stroke="${T2}"/>` + `<rect x="28.5" y="169.5" width="11" height="11" rx="3" fill="none" stroke="${T}"/><rect x="45.5" y="169.5" width="11" height="11" rx="3" fill="none" stroke="${T}"/>` +
        `<rect x="62.5" y="166.5" width="18" height="17" rx="4" fill="${D}" stroke="${T}"/>` + ymark(71.5, 175.5, 0.17) + bar(94, 168, 24, 4, T2) + bar(99, 177, 14, 4, T);
      return s;
    } },
    phone: { vb: '0 0 100 206', svg: () => {
      let s = `<rect x=".5" y=".5" width="99" height="205" rx="17" fill="#0C0D0E" stroke="${E}"/><rect x="5" y="5" width="90" height="196" rx="13" fill="${B}"/>` +
        `<rect x="40" y="10" width="20" height="6" rx="3" fill="#000"/>` + bar(12, 11, 12, 3, T2) + bar(80, 11, 9, 3, T2);
      s += ymark(17, 32, 0.2) + `<rect x="57.5" y="26.5" width="31" height="11" rx="5.5" fill="none" class="lvs"/><circle class="lv" cx="63.5" cy="32" r="2"/>` + bar(68, 31, 15, 2.4, T2);
      s += bar(12, 46, 52, 6, L, 0.9) + bar(12, 57, 66, 3.5, T);
      s += `<rect x="12.5" y="68.5" width="75" height="36" rx="6" fill="#151618" stroke="${D}"/><circle class="lv" cx="80" cy="76" r="2.2"/>` + bar(19, 74, 26, 3, T2) + bar(19, 83, 52, 5, L, 0.85) + bar(19, 94, 36, 3, T);
      s += `<rect x="12.5" y="110.5" width="35" height="30" rx="6" fill="#151618" stroke="${D}"/><rect x="52.5" y="110.5" width="35" height="30" rx="6" fill="#151618" stroke="${D}"/>` +
        bar(18, 117, 18, 3, T2) + bar(18, 126, 22, 5, L, 0.8) + bar(58, 117, 16, 3, T2) + bar(58, 126, 20, 5, L, 0.8);
      for (let i = 0; i < 3; i++) s += `<circle cx="16" cy="${153 + i * 8}" r="1.6" fill="${T2}"/>` + bar(22, 151.5 + i * 8, [54, 42, 48][i], 3, T);
      s += `<rect x="12.5" y="177.5" width="75" height="15" rx="7.5" fill="none" stroke="${E}"/>` + bar(19, 183.5, 30, 3, T) + `<circle cx="80" cy="185" r="3" fill="${L}"/>`;
      s += `<rect x="38" y="197" width="24" height="2" rx="1" fill="${T}"/>`;
      return s;
    } }
  };
  $$('.lu-obj[data-piece]').forEach((el) => {
    const P = PIECES[el.dataset.piece]; if (!P) return;
    el.innerHTML = `<svg viewBox="${P.vb}" aria-hidden="true">${P.svg()}</svg>`;
  });
  const items = $$('.lu-item');
  function liftOn(it, on) {
    if (it._on === on) return; it._on = on;
    it.classList.toggle('on', on); FX.lit(it.querySelector('.lu-obj'), on);
  }
  items.forEach((it) => {
    it.addEventListener('pointerenter', (e) => { if (e.pointerType !== 'touch') liftOn(it, true); });
    it.addEventListener('pointerleave', (e) => { if (e.pointerType !== 'touch' && document.activeElement !== it) liftOn(it, false); });
    it.addEventListener('focus', () => liftOn(it, true));
    it.addEventListener('blur', () => liftOn(it, false));
  });
  // touch: a tap lifts one piece; a tap anywhere else (or on it again) sets it down
  document.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'touch') return;
    const hit = e.target.closest ? e.target.closest('.lu-item') : null;
    items.forEach((it) => liftOn(it, it === hit ? !it._on : false));
  }, { passive: true });
})();
