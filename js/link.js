/* Link your PC: the device-code flow. States (hash): #start (the PC app before you press Sign in), #waiting (default),
   #wrong, #expired, #linked, #unlink, #unlink=desktop.
   The right pane is a mock of the PC app's own Settings > Web screen; clicking its code fills the web side.
   Round 2 (18 Oct): code boxes press in as a letter lands (.cb.pop) and show a dot caret (css); Your PCs rows light
   their whole border (fx "lit") and carry less text; the linked banner pulses once (fx "pulse", live).
   Port: app/link/page.tsx. Real flow: the PC app calls POST /api/device/start -> { device_code, user_code: 'K7Q4MX',
   expires_in: 600 } and polls /api/device/poll; this page calls POST /api/device/confirm { user_code } as the signed-in
   user, which writes the devices row (Supabase) and hands the PC its relay keys. */
(function () {
  'use strict';
  const { $, $$, hashTokens } = Y;
  const CODE = 'K7Q4MX';
  const code = $('#code'), boxes = $$('#code input'), cerr = $('#cerr'), btn = $('#linkbtn'), btnL = $('#linkbtn-l'), banner = $('#banner');
  const pcPanes = $$('[data-pc]'), devlist = $('#devlist'), pcexp = $('#pcexp');
  const field = FieldCanvas.mount($('#pcfield'), { mark: false });
  let timer = 0, flow = 0, left = 581, state = 'waiting', removed = new Set();

  const DEV = {
    desktop: { name: 'DESKTOP-4KD7Q2M', line: 'Windows 11 · Yuki 0.9.2 · linked today, 14:06', chip: '<span class="chip live">Online</span>' },
    studio: { name: 'STUDIO-LAPTOP', line: 'Windows 11 · Yuki 0.9.1 · last seen 2 days ago', chip: '<span class="chip">Offline</span>' }
  };
  function renderDevs(linked, confirmFor, fresh) {
    const list = (linked ? ['desktop', 'studio'] : ['studio']).filter((d) => !removed.has(d));
    if (!list.length) { devlist.innerHTML = '<p class="empty-dev">No PCs linked yet. Type a code above to add one.</p>'; return; }
    devlist.innerHTML = list.map((k) => {
      const d = DEV[k];
      return `<div class="dev${fresh && k === 'desktop' ? ' new' : ''}" data-dev="${k}" data-fx="lit">
        <span class="ic">${Y.dic('pc')}</span>
        <div style="min-width:0"><b>${d.name}</b><small>${d.line}</small></div>
        <div class="acts">${d.chip}<button class="key sm" type="button" data-unlink="${k}" aria-label="Unlink ${d.name}">Unlink</button></div>
        ${confirmFor === k ? `<div class="confirm" role="alertdialog" aria-label="Unlink ${d.name}"><span><b>Unlink ${d.name}?</b> The web stops seeing it. Its memory stays on that PC.</span><span class="acts"><button class="key sm pri" type="button" data-do="${k}">Unlink</button><button class="key sm" type="button" data-keep>Keep it</button></span></div>` : ''}
      </div>`;
    }).join('');
    Y.fx.refresh(devlist);
  }
  devlist.addEventListener('click', (e) => {
    const u = e.target.closest('[data-unlink]'), d = e.target.closest('[data-do]'), k = e.target.closest('[data-keep]');
    if (u) renderDevs(state === 'linked' || state === 'unlink', u.dataset.unlink);
    if (k) renderDevs(state === 'linked' || state === 'unlink', null);
    if (d) {
      removed.add(d.dataset.do);
      if (d.dataset.do === 'desktop') { location.hash = 'waiting'; return; }
      renderDevs(state === 'linked' || state === 'unlink', null);
      const note = document.createElement('p'); note.className = 'gone-dev'; note.textContent = DEV[d.dataset.do].name + ' unlinked. Link it again any time.';
      devlist.appendChild(note);
    }
  });

  // a letter lands: its cell presses in (css .cb.pop, transform only)
  function land(b) { const c = b.parentNode; c.classList.remove('pop'); void c.offsetWidth; c.classList.add('pop'); }
  const fill = (s) => boxes.forEach((b, i) => { b.value = s[i] || ''; });
  const read = () => boxes.map((b) => b.value).join('').toUpperCase();
  function setPC(name) { pcPanes.forEach((p) => p.style.display = p.dataset.pc === name ? 'block' : 'none'); }
  function err(msg) { cerr.textContent = msg || ''; cerr.classList.toggle('on', !!msg); }

  function apply() {
    const h = hashTokens();
    state = h.linked ? 'linked' : h.wrong ? 'wrong' : h.expired ? 'expired' : h.unlink ? 'unlink' : h.start ? 'start' : 'waiting';
    clearInterval(timer); clearTimeout(flow);
    code.classList.remove('bad', 'ok', 'dead');
    btn.disabled = false; btnL.textContent = 'Link this PC'; btn.classList.remove('loading', 'done', 'wait');
    $('#openrow').style.display = state === 'linked' || state === 'unlink' ? 'none' : '';
    boxes.forEach((b) => { b.disabled = false; });
    banner.classList.toggle('on', state === 'linked' || state === 'unlink');
    $('#st2').classList.toggle('done', state === 'linked' || state === 'unlink');
    $('#pa-sub').textContent = 'Six letters and numbers, from the Yuki app on your PC.';
    err('');
    if (state === 'start') {
      fill(''); setPC('start'); field.setState('idle');
      $('#pa-sub').textContent = 'No code yet. Press Sign in on your PC, or open Yuki from here.';
      renderDevs(false, null);
    } else if (state === 'waiting') {
      fill(''); setPC('waiting'); field.setState('idle');
      left = 581; const tick = () => { const m = Math.floor(left / 60), s = left % 60; pcexp.textContent = `${m}:${String(s).padStart(2, '0')} left`; left--; if (left < 0) { location.hash = 'expired'; } };
      tick(); timer = setInterval(tick, 1000);
      renderDevs(false, null);
    } else if (state === 'wrong') {
      // keep the code that was typed; a direct visit to #wrong (the mock link) shows a sample near-miss
      const typed = read(); fill(typed.length === 6 && typed !== CODE ? typed : 'K7Q4NX');
      code.classList.remove('bad'); void code.offsetWidth; code.classList.add('bad'); setPC('waiting');
      err('That code doesn’t match. Check the Yuki app on your PC and try again.');
      renderDevs(false, null);
    } else if (state === 'expired') {
      fill(CODE); code.classList.add('dead'); setPC('expired');
      err('That code expired. Get a new one in the Yuki app, then type it here.');
      btn.disabled = true; btn.classList.add('wait'); btnL.innerHTML = '<span class="spin" aria-hidden="true"><i></i><i></i><i></i></span>Waiting for a new code';
      renderDevs(false, null);
    } else {
      fill(CODE); code.classList.add('ok'); setPC('linked'); field.setState('done');
      btn.disabled = true; btn.classList.add('done'); btnL.innerHTML = Y.dic('check') + 'Linked &middot; encrypted';
      boxes.forEach((b) => { b.disabled = true; });
      $('#pa-sub').textContent = 'Done. You can close the Yuki window on your PC.';
      renderDevs(true, state === 'unlink' ? (h.unlink === 'desktop' ? 'desktop' : 'studio') : null, state === 'linked');
      if (state === 'linked') setTimeout(() => Y.fx.pulse(banner), 300);
    }
  }

  // typing: one character per box, auto-advance, paste fills all six
  boxes.forEach((b, i) => {
    b.addEventListener('input', () => {
      b.value = b.value.replace(/[^a-z0-9]/gi, '').toUpperCase().slice(-1);
      if (b.value) land(b);
      if (b.value && i < 5) boxes[i + 1].focus();
      code.classList.remove('bad'); err('');
    });
    b.addEventListener('keydown', (e) => { if (e.key === 'Backspace' && !b.value && i > 0) boxes[i - 1].focus(); });
    b.addEventListener('paste', (e) => {
      const t = (e.clipboardData.getData('text') || '').replace(/[^a-z0-9]/gi, '').toUpperCase();
      if (t.length >= 2) { e.preventDefault(); fill(t.slice(0, 6)); boxes[Math.min(5, t.length - 1)].focus(); }
    });
  });
  $('#codeform').addEventListener('submit', (e) => {
    e.preventDefault();
    const v = read();
    if (v.length < 6) { err('Type all six characters.'); return; }
    btn.classList.add('loading'); btnL.innerHTML = '<span class="spin"><i></i><i></i><i></i></span>Checking with your PC';
    field.setState('busy');
    setTimeout(() => { const target = v === CODE ? '#linked' : '#wrong'; if (location.hash === target) apply(); else location.hash = target; }, 1000);
  });
  // the PC app's own flow: Sign in -> it opens the browser -> a code. "Open Yuki on your PC" (a yuki:// link in the
  // real build) opens the app straight at this screen and asks for a code.
  const opening = $('[data-pc="opening"]');
  function pcFlow(fromWeb) {
    opening.querySelector('h3').textContent = fromWeb === true ? 'Opened from your browser' : 'Opening your browser…';
    opening.querySelector('p:not(.lbl)').textContent = fromWeb === true ? 'Yuki is getting a code for the browser you came from.' : 'Finish signing in there. A short code comes next; you type it on the web.';
    setPC('opening'); field.setState('busy');
    flow = setTimeout(() => { if (location.hash === '#waiting') apply(); else location.hash = 'waiting'; }, Y.reduced ? 0 : 1400);
  }
  $('#pcsignin').addEventListener('click', pcFlow);
  $('#openpc').addEventListener('click', (e) => { e.preventDefault(); if (state === 'waiting' || state === 'wrong' || state === 'start' || state === 'expired') pcFlow(true); });
  $('#pccode').addEventListener('click', () => { if (state === 'waiting' || state === 'wrong') { Y.fx.hideTip(); fill(CODE); boxes.forEach((b, i) => setTimeout(() => land(b), Y.reduced ? 0 : i * 45)); code.classList.remove('bad'); err(''); btn.focus(); } });
  addEventListener('hashchange', apply);
  apply();
})();
