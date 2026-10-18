/* Yuki website / fx: the shared interaction vocabulary (round 2, 18 Oct). Markup + CSS contract: css/fx.css header.
   Load order on every page: core.js -> dotkit.js (only canvas pages) -> fx.js -> page js. fx needs core, not dotkit.
     <link rel="stylesheet" href="css/fx.css">          (right after base.css)
     <script src="js/fx.js"></script>                   (after core.js / dotkit.js, before the page's own js)
   How it works:
   - Gating classes on <html>: fx-hover (hover + fine pointer) or fx-touch; fx-kb after Tab, removed on pointerdown.
   - One passive delegated listener per event type on document (pointerover/out/move/down/up/cancel, focusin/out,
     keydown/up), using closest('[data-fx~=name]'): works for re-rendered DOM with no re-binding.
   - Helper DOM (ring, corners, lens, sheen, tip) is injected on first use and is aria-hidden.
   - One subscriber: Y.loop.add(fxTick); it returns true only while an eased value (matrix lens, magnet, tilt, lens)
     still moves. Rects are read on enter and after scroll/resize (dirty flag), in the read phase, before writes.
   - Reduced motion (Y.reduced: prefers-reduced-motion or ?motion=reduced): fxTick is never registered; effects
     use their still variants (state classes only).
   API  Y.fx.refresh(root)        inject rings for [data-fx~=lit], build data-odo, wire data-spec (sr text,
                                  aria-describedby, tabindex=0), find magnets. Call after rendering new DOM.
        Y.fx.lit(el, on = true)   light / unlight an item's whole border (ensures the ring, toggles .is-lit).
        Y.fx.ring(el)             ensure and return the <i class="fx-ring">; scenes may write ring.style.opacity.
        Y.fx.lockOn(el, on|ms)    crop lock-on on a .clear: true = hold, false = release, number = hold for ms.
        Y.fx.tip(el, text?)       show the spec readout for el (text defaults to data-spec). Y.fx.hideTip().
        Y.fx.pulse(el)            one mint ring from el's .ldot (live things only); el fires 'fx:pulse'
                                  {detail: {x, y}} at most once per 2.5 s (the dashboard field listens).
   Port: a client-side hook (useFx) plus the same CSS in the Next.js build. */
(function () {
  'use strict';
  const Y = window.Y; if (!Y) return;
  const { loop, reduced, pointer, clamp } = Y;
  const doc = document, root = doc.documentElement;
  const mqHover = window.matchMedia('(hover: hover) and (pointer: fine)');
  const gate = () => { root.classList.toggle('fx-hover', mqHover.matches); root.classList.toggle('fx-touch', !mqHover.matches); };
  gate(); if (mqHover.addEventListener) mqHover.addEventListener('change', gate); else if (mqHover.addListener) mqHover.addListener(gate);

  const SELECTABLE = 'a[href],button,input,select,textarea,summary,[tabindex],[role="button"],[aria-pressed],[aria-selected],[aria-checked]';
  const DOTLINE = '.doc a, .foot nav a, .fine a, .mod-p a, [data-fx~="dotline"]';
  const up = (t, n) => (t && t.closest ? t.closest('[data-fx~="' + n + '"]') : null);
  const near = (t, sel) => (t && t.closest ? t.closest(sel) : null);
  const off = (el) => !!el.closest('[data-fx-off]');
  const entering = (el, e) => el && !(e.relatedTarget && el.contains(e.relatedTarget));
  const fv = (el) => { try { return el.matches(':focus-visible'); } catch (_) { return root.classList.contains('fx-kb'); } };
  const now = () => performance.now() / 1000;
  function mk(tag, cls, parent, html) {
    const e = doc.createElement(tag); e.className = cls; e.setAttribute('aria-hidden', 'true');
    if (html) e.innerHTML = html; if (parent) parent.appendChild(e); return e;
  }
  const kid = (el, cls) => el.querySelector(':scope > .' + cls);

  /* ---------------- L: lit border ---------------- */
  // rad: the element's radius when already read (refresh reads all first, then writes, to avoid style thrash)
  const radOf = (el) => { const cs = getComputedStyle(el); return cs.getPropertyValue('--lit-r').trim() ? null : (cs.borderTopLeftRadius || '0px'); };
  function ring(el, rad) {
    let r = kid(el, 'fx-ring');
    if (!r) { if (rad === undefined) rad = radOf(el); if (rad) el.style.setProperty('--lit-r', rad); r = mk('i', 'fx-ring', el); el.classList.add('fx-r'); }
    return r;
  }
  function lit(el, on) { if (!el) return; ring(el); el.classList.toggle('is-lit', on !== false); }
  let paired = [];
  function pairOff() { paired.forEach((p) => p.classList.remove('fx-paired')); paired = []; }
  function pairOn(el) {
    const k = el.getAttribute('data-lit-pair'); if (!k || off(el)) return;
    pairOff();
    const scope = el.closest('[data-lit-scope]') || doc;
    paired = [...scope.querySelectorAll('[data-lit-pair="' + (window.CSS && CSS.escape ? CSS.escape(k) : k) + '"]')];
    paired.forEach((p) => { ring(p); p.classList.add('fx-paired'); });
  }

  /* ---------------- 4: crop lock-on ---------------- */
  function corners(el) {
    if (el.classList.contains('fx-cm-on')) return;
    ['tl', 'tr', 'br', 'bl'].forEach((c) => mk('i', 'fx-c ' + c, el)); el.classList.add('fx-cm-on');
  }
  function lockOn(el, on) {
    if (!el) return; corners(el); clearTimeout(el._fxLock); el.classList.toggle('fx-lock', on !== false);
    if (typeof on === 'number') el._fxLock = setTimeout(() => el.classList.remove('fx-lock'), on);
  }
  function tapFor(el, ms) { clearTimeout(el._fxTap); el.classList.add('is-tap'); el._fxTap = setTimeout(() => el.classList.remove('is-tap'), ms); }

  /* ---------------- movers: matrix lens, tilt, DOM lens (eased in fxTick) ---------------- */
  const movers = new Map();
  let dirty = false;
  function mxParts(el) {
    let w = kid(el, 'fx-mx'); if (!w) w = mk('span', 'fx-mx', el, '<span class="fx-mx-l"><span class="fx-mx-g"></span></span>');
    return { w, l: w.firstChild, g: w.firstChild.firstChild };
  }
  function mxEnter(el, sweep) {
    const p = mxParts(el);
    p.w.classList.remove('pop'); p.w.classList.add('on'); if (reduced) return;
    let m = movers.get(el);
    const r = el.getBoundingClientRect();
    if (!m) { m = Object.assign({ kind: 'mx', el, x: pointer.x - r.left, y: pointer.y - r.top }, p); movers.set(el, m); }
    m.r = r; m.sweep = sweep ? now() : 0;
    if (sweep) { m.x = r.width * 0.1; m.y = r.height / 2; }
    p.g.style.width = r.width + 'px'; p.g.style.height = r.height + 'px'; loop.kick();
  }
  function mxLeave(el) { const w = kid(el, 'fx-mx'); if (w) w.classList.remove('on'); movers.delete(el); }
  function mxPop(el, e) {
    const p = mxParts(el), r = el.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    p.g.style.width = r.width + 'px'; p.g.style.height = r.height + 'px';
    p.l.style.transform = 'translate3d(' + (x - 48) + 'px,' + (y - 48) + 'px,0)';
    p.g.style.transform = 'translate3d(' + (48 - x) + 'px,' + (48 - y) + 'px,0)';
    p.w.classList.remove('pop'); void p.w.offsetWidth; p.w.classList.add('on', 'pop');
    clearTimeout(el._fxPop); el._fxPop = setTimeout(() => p.w.classList.remove('on', 'pop'), 340);
  }
  function tiltEnter(el) {
    if (reduced || !mqHover.matches) return;
    let sh = kid(el, 'fx-sheen'); if (!sh) sh = mk('i', 'fx-sheen', el, '<i></i>');
    const r = el.getBoundingClientRect();
    let n = Number(el.getAttribute('data-tilt')) || 4;
    if (r.width > 480) n = Math.min(n, 2.5);
    clearTimeout(el._fxTilt);
    el.classList.remove('fx-tilt-out'); el.classList.add('fx-tilting');
    movers.set(el, { kind: 'tilt', el, r, n, rx: 0, ry: 0, s: sh.firstChild }); loop.kick();
  }
  function tiltLeave(el) {
    if (!movers.has(el)) return; movers.delete(el); el.classList.add('fx-tilt-out'); el.style.transform = '';
    el._fxTilt = setTimeout(() => el.classList.remove('fx-tilting', 'fx-tilt-out'), 620);
  }
  function lnParts(el) {
    let w = kid(el, 'fx-ln'); if (!w) w = mk('span', 'fx-ln', el, '<span class="fx-ln-w"><span class="fx-ln-t"></span></span>');
    const t = w.firstChild.firstChild, cs = getComputedStyle(el), R = Number(el.getAttribute('data-lens')) || 120;
    t.textContent = [...el.childNodes].filter((n) => n !== w && !(n.classList && n.getAttribute('aria-hidden') === 'true')).map((n) => n.textContent).join('');
    t.style.width = el.clientWidth + 'px'; t.style.padding = cs.padding; t.style.whiteSpace = cs.whiteSpace; t.style.textAlign = cs.textAlign;
    w.style.setProperty('--lr2', R * 2 + 'px');
    return { w, win: w.firstChild, t, R };
  }
  function lnPlace(m) {
    m.win.style.transform = 'translate3d(' + (m.x - m.R) + 'px,' + (m.y - m.R) + 'px,0)';
    m.t.style.transform = 'translate3d(' + (m.R - m.x) + 'px,' + (m.R - m.y) + 'px,0)';
  }
  function lnEnter(el) {
    if (reduced || !mqHover.matches) return;
    const p = lnParts(el), r = el.getBoundingClientRect();
    const m = Object.assign({ kind: 'ln', el, r, x: pointer.x - r.left, y: pointer.y - r.top }, p);
    movers.set(el, m); lnPlace(m); p.w.classList.add('on'); loop.kick();
  }
  function lnLeave(el) { const w = kid(el, 'fx-ln'); if (w) w.classList.remove('on'); movers.delete(el); }
  function lnTap(el, e) {
    const p = lnParts(el), r = el.getBoundingClientRect();
    lnPlace(Object.assign({ x: e.clientX - r.left, y: e.clientY - r.top }, p));
    p.w.classList.add('on'); clearTimeout(el._fxLn); el._fxLn = setTimeout(() => p.w.classList.remove('on'), 700);
  }

  /* ---------------- 3: magnets (few per page, always considered while on screen) ---------------- */
  let mags = [], outside = false;
  root.addEventListener('pointerleave', () => { outside = true; loop.kick(); });
  root.addEventListener('pointerenter', () => { outside = false; });
  function findMags(scope) {
    if (reduced) return;
    (scope || doc).querySelectorAll('[data-fx~="magnet"]').forEach((el) => {
      if (el._fxMag) return;
      let inn = kid(el, 'fx-mg-in');
      if (!inn) {
        inn = doc.createElement('span'); inn.className = 'fx-mg-in';
        [...el.childNodes].forEach((n) => { if (!(n.classList && /fx-(mx|ring|c)\b/.test(n.className))) inn.appendChild(n); });
        el.insertBefore(inn, el.firstChild);
      }
      const m = { el, inn, n: Number(el.getAttribute('data-magnet')) || 6, x: 0, y: 0, vx: 0, vy: 0, r: null, vis: Y.watch(el, '0px') };
      el._fxMag = m; mags.push(m);
    });
  }
  function magRect(m) { const r = m.el.getBoundingClientRect(); m.r = { l: r.left - m.x, t: r.top - m.y, w: r.width, h: r.height }; }
  function stepMag(m, dt) {
    let tx = 0, ty = 0;
    if (m.vis.on && pointer.seen && !outside && mqHover.matches && m.r) {
      const hw = m.r.w / 2 + 28, hh = m.r.h / 2 + 28, dx = pointer.x - (m.r.l + m.r.w / 2), dy = pointer.y - (m.r.t + m.r.h / 2);
      if (Math.abs(dx) < hw && Math.abs(dy) < hh) { tx = clamp(dx / hw, -1, 1) * m.n; ty = clamp(dy / hh, -1, 1) * m.n; }
    }
    if (!tx && !ty && !m.x && !m.y) return false;
    m.vx += ((tx - m.x) * 170 - m.vx * 18) * dt; m.vy += ((ty - m.y) * 170 - m.vy * 18) * dt;
    m.x += m.vx * dt; m.y += m.vy * dt;
    const settled = Math.abs(tx - m.x) < 0.05 && Math.abs(ty - m.y) < 0.05 && Math.abs(m.vx) + Math.abs(m.vy) < 0.1;
    if (settled) { m.x = tx; m.y = ty; m.vx = m.vy = 0; }
    m.el.style.transform = m.x || m.y ? 'translate3d(' + m.x.toFixed(2) + 'px,' + m.y.toFixed(2) + 'px,0)' : '';
    m.inn.style.transform = m.x || m.y ? 'translate3d(' + (m.x * 0.4).toFixed(2) + 'px,' + (m.y * 0.4).toFixed(2) + 'px,0)' : '';
    return !settled;
  }

  /* ---------------- the one loop subscriber ---------------- */
  function fxTick(t, dt) {
    const k = 1 - Math.pow(0.0005, dt);
    let more = false;
    // read
    if (dirty) {
      movers.forEach((m) => { m.r = m.el.getBoundingClientRect(); });
      mags.forEach((m) => { if (m.vis.on) magRect(m); });
      dirty = false;
    } else mags.forEach((m) => { if (m.vis.on && !m.r) magRect(m); });
    // write
    movers.forEach((m) => {
      const r = m.r;
      let tx = pointer.x - r.left, ty = pointer.y - r.top;
      if (m.kind === 'mx') {
        if (m.sweep) { const p = (t - m.sweep) / 0.6; if (p < 1) { tx = r.width * (0.1 + 0.8 * Y.easeOut(p)); ty = r.height / 2; m.x = tx; } else { tx = r.width / 2; ty = r.height / 2; } more = true; }
        m.x += (tx - m.x) * k; m.y += (ty - m.y) * k;
        m.l.style.transform = 'translate3d(' + (m.x - 48).toFixed(1) + 'px,' + (m.y - 48).toFixed(1) + 'px,0)';
        m.g.style.transform = 'translate3d(' + (48 - m.x).toFixed(1) + 'px,' + (48 - m.y).toFixed(1) + 'px,0)';
        if (Math.abs(tx - m.x) + Math.abs(ty - m.y) > 0.3) more = true;
      } else if (m.kind === 'tilt') {
        const ry = clamp((tx / r.width) * 2 - 1, -1, 1) * m.n, rx = -clamp((ty / r.height) * 2 - 1, -1, 1) * m.n;
        m.rx += (rx - m.rx) * k; m.ry += (ry - m.ry) * k;
        m.el.style.transform = 'perspective(900px) rotateX(' + m.rx.toFixed(2) + 'deg) rotateY(' + m.ry.toFixed(2) + 'deg)';
        m.s.style.transform = 'translate3d(' + tx.toFixed(0) + 'px,' + ty.toFixed(0) + 'px,0)';
        if (Math.abs(rx - m.rx) + Math.abs(ry - m.ry) > 0.02) more = true;
      } else {
        m.x += (tx - m.x) * k; m.y += (ty - m.y) * k; lnPlace(m);
        if (Math.abs(tx - m.x) + Math.abs(ty - m.y) > 0.3) more = true;
      }
    });
    mags.forEach((m) => { if (stepMag(m, dt)) more = true; });
    return more;
  }
  if (!reduced) {
    loop.add(fxTick);
    addEventListener('scroll', () => { dirty = true; }, { passive: true });
    Y.measured.add(() => { dirty = true; mags.forEach((m) => { m.r = null; }); });
  }

  /* ---------------- 9: live pulse ---------------- */
  function pulse(el) {
    if (!el) return; const dot = el.classList.contains('ldot') ? el : el.querySelector('.ldot');
    const t = performance.now();
    if (!(el._fxPt > t - 2500)) {
      el._fxPt = t;
      const r = (dot || el).getBoundingClientRect();
      el.dispatchEvent(new CustomEvent('fx:pulse', { bubbles: true, detail: { x: r.left + r.width / 2, y: r.top + r.height / 2 } }));
    }
    if (reduced || !dot || el.classList.contains('fx-pulse')) return;
    const done = () => { el.classList.remove('fx-pulse'); clearTimeout(el._fxPu); };
    el.classList.add('fx-pulse'); dot.addEventListener('animationend', done, { once: true }); el._fxPu = setTimeout(done, 2000);
  }

  /* ---------------- 8: spec readout ---------------- */
  let tip = null, tipText = null, tipFor = null, tipTimer = 0, lastHide = 0, lp = null;
  function showTip(el, text) {
    text = text || (el && el.getAttribute('data-spec')); if (!el || !text) return;
    if (!tip) {
      tip = mk('div', '', doc.body, '<span class="fx-tip-t"></span><i class="fx-tip-cv"></i>');
      tip.id = 'fx-tip'; tip.setAttribute('role', 'tooltip'); tipText = tip.firstChild;
    }
    clearTimeout(tipTimer); tipFor = el; tip.classList.remove('on', 'typing'); tipText.textContent = text;
    const r = el.getBoundingClientRect(), tw = tip.offsetWidth, th = tip.offsetHeight;
    const x = clamp(r.left + r.width / 2 - tw / 2, 8, Math.max(8, innerWidth - tw - 8));
    // below the term by default; above only when there is no room below. Never over a heading.
    const yB = r.bottom + 10, yA = r.top - th - 10;
    const heads = [];
    const mh = el.closest('.mod-head') || (el.closest('section, .mod') || doc.body).querySelector('.mod-head');
    (mh ? mh.querySelectorAll('h1, h2, h3') : []).forEach((h) => heads.push(h.getBoundingClientRect()));
    const hits = (y) => heads.some((h) => y < h.bottom && y + th > h.top && x < h.right && x + tw > h.left);
    const fitsB = yB + th <= innerHeight - 8, fitsA = yA >= 8;
    let below = true, y = yB;
    if ((!fitsB || hits(yB)) && fitsA && !hits(yA)) { below = false; y = yA; }
    else if (!fitsB && !fitsA) y = Math.max(8, innerHeight - th - 8);
    tip.classList.toggle('below', below);
    tip.style.setProperty('--tx', Math.round(x) + 'px'); tip.style.setProperty('--ty', Math.round(y) + 'px');
    // reveal whole lines top to bottom (no clipped half-lines), at most ~240 ms in total
    if (!reduced) {
      const lines = Math.max(1, tipText.getClientRects().length);
      tip.style.setProperty('--tn', lines); tip.style.setProperty('--td', Math.min(lines * 60, 240) + 'ms');
    }
    void tip.offsetWidth; tip.classList.add('on'); if (!reduced) tip.classList.add('typing');
  }
  function hideTip() { clearTimeout(tipTimer); if (tip && tipFor) { tip.classList.remove('on', 'typing'); lastHide = performance.now(); } tipFor = null; }
  function intent(el) { clearTimeout(tipTimer); tipTimer = setTimeout(() => showTip(el), performance.now() - lastHide < 600 ? 0 : 300); }
  let srBox = null, sid = 0;
  function wireSpec(el) {
    const text = el.getAttribute('data-spec');
    if (!srBox) { srBox = doc.createElement('div'); srBox.id = 'fx-sr'; srBox.hidden = true; doc.body.appendChild(srBox); }
    let s = el._fxSr;
    if (!s) {
      s = el._fxSr = doc.createElement('span'); s.id = 'fx-s' + (++sid); srBox.appendChild(s);
      el.setAttribute('aria-describedby', ((el.getAttribute('aria-describedby') || '') + ' ' + s.id).trim());
      if (!el.closest(SELECTABLE) && !el.isContentEditable && !el.hasAttribute('data-spec-notab')) el.tabIndex = 0;
    }
    if (s.textContent !== text) s.textContent = text;
  }

  /* ---------------- 10: odometer ---------------- */
  const odoIO = !reduced && window.IntersectionObserver
    ? new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('go'); odoIO.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px' })
    : null;
  const esc = (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c] || c);
  function buildOdo(el) {
    const v = el.getAttribute('data-odo'); if (el._fxOdo === v) return;
    el._fxOdo = v; el.classList.add('fx-odo'); el.classList.remove('go');
    const chars = [...v]; let n = chars.filter((c) => /\d/.test(c)).length;
    const col = '0123456789'.split('').map((d) => '<span>' + d + '</span>').join('');
    el.innerHTML = '<span class="sr">' + chars.map(esc).join('') + '</span>' + chars.map((c) => (/\d/.test(c)
      ? '<span class="fx-odo-c" aria-hidden="true"><span class="fx-odo-s" style="--d:' + c + ';--i:' + (--n) + '">' + col + '</span></span>'
      : '<span aria-hidden="true">' + esc(c) + '</span>')).join('');
    if (odoIO) odoIO.observe(el); else el.classList.add('go');
  }

  /* ---------------- refresh ---------------- */
  function refresh(scope) {
    scope = scope || doc;
    const ls = [...scope.querySelectorAll('[data-fx~="lit"]')].filter((el) => !kid(el, 'fx-ring')), rads = ls.map(radOf);
    ls.forEach((el, i) => ring(el, rads[i]));
    scope.querySelectorAll('[data-odo]').forEach(buildOdo);
    scope.querySelectorAll('[data-spec]').forEach(wireSpec);
    findMags(scope);
  }

  /* ---------------- delegation ---------------- */
  let held = null, downEl = null;
  doc.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') root.classList.add('fx-kb');
    if (e.key === 'Escape') hideTip();
    if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) {
      const k = near(e.target, '.key, [data-fx~="press"]');
      if (k) { k.classList.add('is-down'); if (e.key === 'Enter') setTimeout(() => k.classList.remove('is-down'), 120); }
    }
  }, true);
  doc.addEventListener('keyup', (e) => { if (e.key === ' ') { const k = near(e.target, '.key, [data-fx~="press"]'); if (k) k.classList.remove('is-down'); } }, true);

  doc.addEventListener('pointerdown', (e) => {
    root.classList.remove('fx-kb');
    const t = e.target, touch = e.pointerType === 'touch';
    const k = near(t, '.key, [data-fx~="press"]'); if (k) { k.classList.add('is-down'); downEl = k; }
    if (tipFor && !(tipFor.contains(t))) hideTip();
    else if (tipFor && touch) { hideTip(); return; }
    if (!touch) return;
    if (held && !held.contains(t)) { held.classList.remove('is-tap'); held = null; }
    const l = up(t, 'lit');
    if (l && !off(l)) { ring(l); if (l.matches(SELECTABLE)) { l.classList.add('is-tap'); held = l; } else tapFor(l, 900); }
    const c = up(t, 'crop'); if (c) { corners(c); tapFor(c, 900); }
    const ti = up(t, 'tilt'); if (ti && !reduced) tapFor(ti, 120);
    const mx = up(t, 'matrix'); if (mx && !reduced) mxPop(mx, e);
    const ln = up(t, 'lens'); if (ln && !reduced) lnTap(ln, e);
    const pu = up(t, 'pulse'); if (pu) pulse(pu);
    const lp2 = near(t, '[data-lit-pair]'); if (lp2) pairOn(lp2); else pairOff();
    const sp = near(t, '[data-spec]');
    if (sp) {
      clearTimeout(tipTimer);
      lp = { el: sp, x: e.clientX, y: e.clientY, tap: sp.hasAttribute('data-spec-tap') };
      if (!lp.tap) tipTimer = setTimeout(() => { showTip(sp); lp = null; }, 450);
    }
  }, { passive: true });
  const release = (e) => {
    if (downEl) { downEl.classList.remove('is-down'); downEl = null; }
    if (lp && e.type === 'pointerup' && lp.tap && near(e.target, '[data-spec]') === lp.el) showTip(lp.el);
    if (lp && !lp.tap) clearTimeout(tipTimer); lp = null;
  };
  doc.addEventListener('pointerup', release, { passive: true });
  doc.addEventListener('pointercancel', release, { passive: true });
  doc.addEventListener('pointermove', (e) => { if (lp && Math.hypot(e.clientX - lp.x, e.clientY - lp.y) > 8) { clearTimeout(tipTimer); lp = null; } }, { passive: true });

  doc.addEventListener('pointerover', (e) => {
    if (e.pointerType === 'touch') return;
    const t = e.target;
    const l = up(t, 'lit'); if (l) ring(l);
    const p = near(t, '[data-lit-pair]'); if (p && entering(p, e)) pairOn(p);
    const c = up(t, 'crop'); if (c) corners(c);
    if (off(t)) return;
    const mx = up(t, 'matrix'); if (mx && entering(mx, e) && mqHover.matches) mxEnter(mx, false);
    const ti = up(t, 'tilt'); if (ti && entering(ti, e)) tiltEnter(ti);
    const ln = up(t, 'lens'); if (ln && entering(ln, e)) lnEnter(ln);
    const pu = up(t, 'pulse'); if (pu && entering(pu, e)) pulse(pu);
    const dl = near(t, DOTLINE); if (dl && !dl._fxDl) { dl._fxDl = 1; dl.style.setProperty('--dl-steps', Math.max(4, Math.round(dl.offsetWidth / 4))); }
    const sp = near(t, '[data-spec]'); if (sp && entering(sp, e)) { wireSpec(sp); intent(sp); }
  }, { passive: true });
  doc.addEventListener('pointerout', (e) => {
    if (e.pointerType === 'touch') return;
    const t = e.target, leaving = (el) => el && !(e.relatedTarget && el.contains(e.relatedTarget));
    const p = near(t, '[data-lit-pair]'); if (leaving(p)) pairOff();
    const kept = (el) => doc.activeElement === el && fv(el);
    const mx = up(t, 'matrix'); if (leaving(mx) && !kept(mx)) mxLeave(mx);
    const ti = up(t, 'tilt'); if (leaving(ti)) tiltLeave(ti);
    const ln = up(t, 'lens'); if (leaving(ln)) lnLeave(ln);
    const sp = near(t, '[data-spec]'); if (leaving(sp)) { clearTimeout(tipTimer); if (tipFor === sp && !kept(sp)) tipTimer = setTimeout(hideTip, 100); }
  }, { passive: true });

  doc.addEventListener('focusin', (e) => {
    const t = e.target;
    const l = up(t, 'lit'); if (l) ring(l);
    const c = up(t, 'crop'); if (c) corners(c);
    if (!fv(t)) return;
    const p = near(t, '[data-lit-pair]'); if (p) pairOn(p);
    if (t.matches('[data-fx~="matrix"]')) mxEnter(t, true);
    if (t.matches('[data-fx~="pulse"]')) pulse(t);
    if (t.matches('[data-spec]')) { wireSpec(t); showTip(t); }
  });
  doc.addEventListener('focusout', (e) => {
    const t = e.target;
    if (near(t, '[data-lit-pair]')) pairOff();
    if (t.matches && t.matches('[data-fx~="matrix"]')) mxLeave(t);
    if (tipFor === t) hideTip();
  });
  addEventListener('scroll', () => { if (tipFor) hideTip(); }, { passive: true });

  Y.fx = { refresh, lit, ring, lockOn, tip: showTip, hideTip, pulse };
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', () => refresh()); else refresh();
  addEventListener('load', () => refresh());
})();
