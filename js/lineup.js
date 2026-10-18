/* Yuki website / the family lineup (18 Oct, the teenage-engineering touch).
   Download: Yuki's pieces drawn flat at one scale, as inline SVG. Hover, focus or tap one: it lifts off the
   ground (transform) and gets the lit border (Y.fx.lit). The numbered guide callouts that lived here went on
   19 Oct (too many lines and numbers for parts you can already see).
   Port: components/landing/Lineup.tsx (static SVG). */
(function () {
  'use strict';
  const Y = window.Y; if (!Y) return;
  const { $$ } = Y;
  const FX = Y.fx || { lit() {} };

  /* ---------------- the lineup ---------------- */
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
