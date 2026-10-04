/* Link your PC: the device-code flow. States (hash): #start (the PC app before you press Sign in), #waiting (default),
   #wrong, #expired, #linked, #unlink, #unlink=desktop.
   The right pane is a mock of the PC app's own Settings > Web screen; clicking its code fills the web side.
   Port: app/link/page.tsx. Real flow: the PC app calls POST /api/device/start -> { device_code, user_code: 'K7Q4MX',
   expires_in: 600 } and polls /api/device/poll; this page calls POST /api/device/confirm { user_code } as the signed-in
   user, which writes the devices row (Supabase) and hands the PC its relay keys. */
(function () {
  'use strict';
  const { $, $$, hashTokens } = Y;
  const CODE = 'K7Q4MX';
  const code = $('#code'), boxes = $$('#code input'), cerr = $('#cerr'), btn = $('#linkbtn'), banner = $('#banner');
  const pcPanes = $$('[data-pc]'), devlist = $('#devlist'), pcexp = $('#pcexp');
  const field = FieldCanvas.mount($('#pcfield'), { mark: false });
  let timer = 0, flow = 0, left = 581, state = 'waiting', removed = new Set();

  const DEV = {
    desktop: { id: 'desktop', name: 'DESKTOP-4KD7Q2M', sys: 'Windows 11 · Yuki 0.9.2', linked: 'Today, 14:06', seen: 'Now', chip: '<span class="chip live"><span class="ldot blink"></span>Online · streaming</span>' },
    studio: { id: 'studio', name: 'STUDIO-LAPTOP', sys: 'Windows 11 · Yuki 0.9.1', linked: '12 Sep', seen: '2 days ago', chip: '<span class="chip"><span class="ldot off"></span>Offline</span>' }
  };
  function renderDevs(linked, confirmFor, fresh) {
    const list = (linked ? ['desktop', 'studio'] : ['studio']).filter((d) => !removed.has(d));
    if (!list.length) { devlist.innerHTML = '<p class="empty-dev">No PCs linked yet. Type a code above to add one.</p>'; return; }
    devlist.innerHTML = list.map((k) => {
      const d = DEV[k];
      const row = `<div class="dev${fresh && k === 'desktop' ? ' new' : ''}" data-dev="${k}">
        <span class="ic">${Y.dic('pc')}</span>
        <div style="min-width:0"><b>${d.name}</b><small>${d.sys}</small><span class="st${k === 'desktop' ? ' on' : ''}">${k === 'desktop' ? 'Online · streaming' : 'Offline · 2 days ago'}</span></div>
        <div class="c3"><span class="lbl">Linked</span><div class="mono">${d.linked}</div></div>
        <div class="c4"><span class="lbl">Last seen</span><div class="mono">${d.seen}</div></div>
        <div style="display:flex;gap:10px;align-items:center">${d.chip}<button class="key sm" data-unlink="${k}">Unlink</button></div>
        ${confirmFor === k ? `<div class="confirm" role="alertdialog" aria-label="Unlink ${d.name}"><span><b>Unlink ${d.name}?</b> The web stops seeing it. Its memory stays on that PC, untouched.</span><span class="acts"><button class="key sm pri" data-do="${k}">Unlink</button><button class="key sm" data-keep>Keep it</button></span></div>` : ''}
      </div>`;
      return row;
    }).join('');
  }
  devlist.addEventListener('click', (e) => {
    const u = e.target.closest('[data-unlink]'), d = e.target.closest('[data-do]'), k = e.target.closest('[data-keep]');
    if (u) renderDevs(state === 'linked' || state === 'unlink', u.dataset.unlink);
    if (k) renderDevs(state === 'linked' || state === 'unlink', null);
    if (d) {
      removed.add(d.dataset.do);
      if (d.dataset.do === 'desktop') { location.hash = 'waiting'; return; }
      renderDevs(state === 'linked' || state === 'unlink', null);
      const note = document.createElement('p'); note.className = 'lbl'; note.style.marginTop = '10px'; note.textContent = DEV[d.dataset.do].name + ' unlinked. Link it again any time.';
      devlist.appendChild(note);
    }
  });

  const fill = (s) => boxes.forEach((b, i) => { b.value = s[i] || ''; });
  const read = () => boxes.map((b) => b.value).join('').toUpperCase();
  function setPC(name) { pcPanes.forEach((p) => p.style.display = p.dataset.pc === name ? 'block' : 'none'); }
  function err(msg) { cerr.textContent = msg || ''; cerr.classList.toggle('on', !!msg); }

  function apply() {
    const h = hashTokens();
    state = h.linked ? 'linked' : h.wrong ? 'wrong' : h.expired ? 'expired' : h.unlink ? 'unlink' : h.start ? 'start' : 'waiting';
    clearInterval(timer); clearTimeout(flow);
    code.classList.remove('bad', 'ok', 'dead');
    btn.disabled = false; btn.textContent = 'Link this PC'; btn.classList.remove('loading', 'done');
    $('#openrow').style.display = state === 'linked' || state === 'unlink' ? 'none' : '';
    boxes.forEach((b) => { b.disabled = false; });
    banner.classList.toggle('on', state === 'linked' || state === 'unlink');
    $('#st2').classList.toggle('done', state === 'linked' || state === 'unlink');
    $('#pa-sub').textContent = 'Six letters and numbers, shown in the Yuki app on your PC.';
    err('');
    if (state === 'start') {
      fill(''); setPC('start'); field.setState('idle');
      $('#pa-sub').textContent = 'No code yet. On your PC, press Sign in to use Yuki from the web, or open Yuki from here.';
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
      err('That code doesn’t match. Check the Yuki app on your PC and try again. Letters and numbers only, no spaces.');
      renderDevs(false, null);
    } else if (state === 'expired') {
      fill(CODE); code.classList.add('dead'); setPC('expired');
      err('That code expired. Codes last 10 minutes. Get a new one in the Yuki app, then type it here.');
      btn.disabled = true; btn.textContent = 'Waiting for a new code';
      renderDevs(false, null);
    } else {
      fill(CODE); code.classList.add('ok'); setPC('linked'); field.setState('done');
      btn.disabled = true; btn.classList.add('done'); btn.innerHTML = Y.dic('check') + 'Linked &middot; encrypted';
      boxes.forEach((b) => { b.disabled = true; });
      $('#pa-sub').textContent = 'Done. You can close the Yuki window on your PC.';
      renderDevs(true, state === 'unlink' ? (h.unlink === 'desktop' ? 'desktop' : 'studio') : null, state === 'linked');
    }
  }

  // typing: one character per box, auto-advance, paste fills all six
  boxes.forEach((b, i) => {
    b.addEventListener('input', () => {
      b.value = b.value.replace(/[^a-z0-9]/gi, '').toUpperCase().slice(-1);
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
    btn.classList.add('loading'); btn.innerHTML = '<span class="spin"><i></i><i></i><i></i></span>Checking with your PC';
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
  $('#pccode').addEventListener('click', () => { if (state === 'waiting' || state === 'wrong') { fill(CODE); code.classList.remove('bad'); err(''); btn.focus(); } });
  addEventListener('hashchange', apply);
  apply();
})();
