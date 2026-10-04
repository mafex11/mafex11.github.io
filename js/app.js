/* Yuki web dashboard. Tabs render from the streamed data (window.YD); the ask bar sends work to the PC.
   Hash state (for the screens index): #home | #work | #day | #calls | #memory | #settings, plus
   &offline (PC off), &run=spotify (types "Open Spotify" and sends it), &at=done | stopped | queued, &ask=list.
   Port: app/(dash)/[tab]/page.tsx for the tabs, components/AskBar.tsx + components/RunCard.tsx for the ask flow,
   lib/relay.ts for the channel (Supabase Realtime, payloads sealed with the PC's key; the server never sees them). */
(function () {
  'use strict';
  const { $, $$, hashTokens, reduced, dic } = Y;
  const D = window.YD;
  const TABS = [['home', 'Home', 'dot'], ['work', 'Work', 'check'], ['day', 'Day', 'globe'], ['calls', 'Calls', 'mic'], ['memory', 'Memory', 'lock'], ['settings', 'Settings', 'plus']];
  const field = AppField.mount($('#field'));
  const view = $('#view'), thread = $('#thread'), input = $('#ask-in');
  const S = { tab: 'home', online: true, queued: [], run: null, memCat: 'all', memQ: '' };
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const counts = { home: 3, work: D.replies.length + D.said.length, day: '', calls: D.calls.length, memory: '', settings: '' };

  /* ---------------- chrome: nav, tabs, PC status ---------------- */
  function renderNav() {
    const off = S.online ? '' : '&offline';
    const item = ([k, n, ic]) => `<a href="#${k}${off}" ${S.tab === k ? 'aria-current="page"' : ''}>${dic(ic)}${n}${counts[k] !== '' ? `<span class="n${k === 'home' ? '' : ' dim'}">${counts[k]}</span>` : ''}</a>`;
    $('#nav').innerHTML = TABS.slice(0, 5).map(item).join('') + '<div class="sep"></div>' + item(TABS[5]);
    $('#tabs-m').innerHTML = TABS.map(([k, n]) => `<a href="#${k}${off}" ${S.tab === k ? 'aria-current="page"' : ''}>${n}${counts[k] !== '' ? `<span class="n">${counts[k]}</span>` : ''}</a>`).join('');
    $('#crumb').textContent = TABS.find((t) => t[0] === S.tab)[1];
  }
  function renderPC() {
    document.body.dataset.pc = S.online ? 'online' : 'offline';
    $('#pcchip').innerHTML = S.online
      ? `<span class="ldot blink"></span><span class="k">Online</span><span class="full">· ${D.pc.name}</span><span class="s">· streaming, encrypted</span><span class="enc">· encrypted</span>`
      : `<span class="ldot off"></span><span class="k">Offline</span><span class="full">· ${D.pc.name}</span><span class="s">· last seen ${D.pc.lastSeen}</span><span class="enc">· last seen ${D.pc.lastSeen}</span>`;
    $('#pcbox').innerHTML = `<p class="lbl"><span>Your PC</span><span>${S.online ? '<span class="live">live</span>' : 'off'}</span></p><b>${D.pc.name}</b><span class="t3">${S.online ? 'Streaming, end-to-end encrypted' : 'Last seen ' + D.pc.lastSeen + '. Tasks wait in a queue.'}</span>`;
    $('#rail-st').innerHTML = S.online ? '<span class="ldot blink"></span>on the web · live' : '<span class="ldot off"></span>PC is off';
    $('#mocktog').setAttribute('aria-pressed', String(!S.online));
    $('#ask-where').innerHTML = S.online ? `${dic('lock')}runs on ${D.pc.name}` : `${dic('dot')}${D.pc.name} is off`;
    const q = S.queued.length; $('#queued').classList.toggle('on', q > 0); $('#queued-n').textContent = `${q} queued`;
    $('#offq').textContent = q ? ` ${q === 1 ? 'One task is' : q + ' tasks are'} queued.` : '';
    field.setOffline(!S.online);
  }

  /* ---------------- pages ---------------- */
  const sec = (label, n, aside, body, cls) => `<section class="sec clear ${cls || ''}" data-clear><div class="sec-h"><span class="label">${label}${n != null ? ` <span class="doto">${n}</span>` : ''}</span>${aside ? `<span class="aside">${aside}</span>` : ''}</div>${body}</section>`;
  const head = (title, meta, fig, cap) => `<div class="ph"><h1>${title}</h1><div class="meta">${meta}</div>${fig || ''}${cap ? `<div class="fig-cap">${cap}</div>` : ''}</div>`;
  const liveMeta = () => S.online ? `<span class="live-only"><span class="live">●</span> live from <b>${D.pc.name}</b></span>` : `<span>as of <b>${D.pc.lastSeen}</b>, when your PC went off</span>`;
  const todoRows = (list) => list.map((t, i) => `<div class="todo" data-i="${i}"><button class="ck" aria-label="Done: ${esc(t.t)}"></button><div><div class="tt">${esc(t.t)}</div><div class="src"><b class="${t.hot ? 'hot' : ''}">due ${t.due}</b> · ${esc(t.src)}</div></div></div>`).join('');
  const yourList = () => sec('Your list', D.list.length, 'due soonest first',
    `<label class="addrow">${dic('plus')}<input placeholder="${phoneMQ.matches ? 'Add to your list…' : 'Add to your list… “call the plumber on Friday”'}" aria-label="Add to your list"></label>${todoRows(D.list)}<div class="foot-row"><span>Recently done ${D.done.length}</span><span>synced to your PC</span></div>`);
  const dayMini = () => D.day.map((b) => `<div class="pr tmr"><span class="tmc">${b.a}</span><div><div class="tt"><b>${esc(b.t)}</b></div><div class="src">${b.apps ? esc(b.apps) + ' · ' : ''}until ${b.b === 'now' ? (S.online ? 'now' : '14:06') : b.b}</div></div>${b.live ? '<span class="when live-only"><span class="live">● now</span></span>' : ''}</div>`).join('');
  const replies = () => sec('Needs your reply', D.replies.length, 'newest first', D.replies.map((r) => `<div class="pr"><span class="av">${r.who[0]}</span><div><div class="tt"><b>${esc(r.who)}</b> “${esc(r.t)}”</div><div class="src">${r.app}</div><div class="acts"><button class="key xs" data-q="Reply to ${esc(r.who.split(' ')[0])}">Reply on my PC</button></div></div><span class="when">${r.ago}</span></div>`).join(''));
  const said = () => sec('You said you’d', D.said.length, 'from your chats and calls', D.said.map((s) => `<div class="pr"><span class="av">${s.to[0]}</span><div><div class="tt"><b>${esc(s.t)}</b></div><div class="src">to ${esc(s.to)} · ${esc(s.src)}</div></div><span class="when">${s.when}</span></div>`).join(''));
  const waiting = () => sec('Waiting on', D.waiting.length, 'what others owe you', D.waiting.map((w) => `<div class="pr"><span class="av">${w.who[0]}</span><div><div class="tt"><b>${esc(w.who)}</b>: ${esc(w.t)}</div><div class="src">${esc(w.src)}</div></div><span class="when ${w.late ? 'late' : ''}">${w.since}</span></div>`).join(''));
  const toMin = (s) => { if (s === 'now') return 14 * 60 + 12; const [h, m] = s.split(':').map(Number); return h * 60 + m; };
  const strip = () => {
    const a0 = 8 * 60, a1 = 20 * 60, pct = (m) => ((m - a0) / (a1 - a0) * 100).toFixed(2);
    const blocks = D.day.map((b) => `<span class="blk k-${b.k} ${b.live && S.online ? 'k-live' : ''}" style="left:${pct(toMin(b.a))}%;width:calc(${pct(toMin(b.b))}% - ${pct(toMin(b.a))}% - 3px)" title="${esc(b.t)}"></span>`).join('');
    const axis = [8, 10, 12, 14, 16, 18, 20].map((h) => `<span style="left:${pct(h * 60)}%">${String(h).padStart(2, '0')}:00</span>`).join('');
    return `<section class="strip clear" data-clear><div class="sec-h"><span class="label">Today, 08:00 to 20:00</span><span class="legend2"><span><i></i>at the PC</span><span><i class="c"></i>call</span><span><i class="a"></i>away</span></span></div>
      <div class="strip-track">${blocks}${S.online ? `<span class="strip-now" style="left:${pct(toMin('now'))}%"><span>now 14:12</span></span>` : ''}</div><div class="strip-axis">${axis}</div></section>`;
  };
  const PAGES = {
    home() {
      const n = D.now;
      return head('Home', `<span>${D.today} · <b>${D.clock}</b></span><span><b>3</b> need you</span>${liveMeta()}`, '<div class="fig" data-figure="num" data-value="3" data-scale="2"></div>', 'need you') +
        `<div class="now">
          <div class="clear" data-clear><div class="lbl2">${S.online ? '<span class="ldot blink"></span>' : '<span class="ldot off"></span>'}${S.online ? n.front.label : 'Last in front · at 14:06'}</div><div class="big">${n.front.title}</div><div class="sm">${n.front.note}</div></div>
          <div class="clear" data-clear><div class="lbl2">${dic('play')}${n.playing.label}</div><div class="big">${n.playing.title}</div><div class="sm">${n.playing.note}</div></div>
          <div class="clear" data-clear><div class="lbl2">${dic('dot')}${n.next.label}</div><div class="big">${n.next.title}</div><div class="sm">${n.next.note}</div></div>
        </div>
        <div class="cols"><div class="col">${yourList()}</div><div class="col">${sec('Today', D.day.length, '4 h 17 m at the PC', dayMini())}${sec('Waiting on', D.waiting.length, '', D.waiting.slice(0, 2).map((w) => `<div class="pr"><span class="av">${w.who[0]}</span><div><div class="tt"><b>${esc(w.who)}</b>: ${esc(w.t)}</div><div class="src">${esc(w.src)}</div></div><span class="when ${w.late ? 'late' : ''}">${w.since}</span></div>`).join(''))}</div></div>`;
    },
    work() {
      return head('Work', `<span><b>${D.said.length}</b> you said you’d</span><span><b>${D.waiting.length}</b> waiting on others</span><span><b>${D.replies.length}</b> to answer</span>`, '<div class="fig" data-figure="bars" data-values="6,7,5,8,6,2,5"></div>', 'hours at the PC, last 7 days') +
        strip() + `<div class="cols"><div class="col">${yourList()}${said()}</div><div class="col">${replies()}${waiting()}</div></div>`;
    },
    day() {
      const rows = D.day.map((b) => `<div class="tl-row k-${b.k} ${b.live && S.online ? 'k-live' : ''}"><div class="tm"><b>${b.a}</b>${b.b === 'now' ? (S.online ? 'now' : '14:06') : b.b}</div><div class="rail2"><i></i></div><div><div class="tt">${esc(b.t)}${b.k === 'call' ? '<span class="kind">call · both sides</span>' : ''}${b.k === 'away' ? '<span class="kind">away</span>' : ''}</div>${b.apps ? `<div class="apps">${esc(b.apps)}</div>` : ''}<div class="did">${esc(b.did)}</div></div></div>`).join('');
      return head('Day', `<span>${D.today}</span><span><b>4 h 17 m</b> at the PC</span><span><b>1</b> call</span>${liveMeta()}`, '<div class="fig" data-figure="num" data-value="4" data-scale="2"></div>', 'hours so far') +
        `<div class="totals"><div class="clear" data-clear><span class="lbl">At the PC</span><span class="doto">4h17</span><div class="sub">About your usual by now.</div></div><div class="clear" data-clear><span class="lbl">Longest stretch</span><span class="doto">1h42</span><div class="sub">Figma, 10:15 to 11:57</div></div><div class="clear" data-clear><span class="lbl">Calls</span><span class="doto">32m</span><div class="sub">Weekly sync on Teams</div></div><div class="clear" data-clear><span class="lbl">Away</span><span class="doto">50m</span><div class="sub">Lunch, 12:30</div></div></div>` +
        strip() + sec('Timeline', null, 'what you did, as Yuki saw it', `<div class="tl">${rows}</div>`);
    },
    calls() {
      const bars = () => `<span class="wave2">${Array.from({ length: 16 }, (_, i) => `<i style="height:${3 + Math.round(Math.abs(Math.sin(i * 1.7)) * 11)}px"></i>`).join('')}</span>`;
      const cards = D.calls.map((c) => `<section class="callc clear" data-clear>
        <div class="call-h"><div><p class="lbl">${c.app} · ${c.when}</p><h3>${esc(c.title)}</h3><div class="meta2">${c.len} · ${esc(c.who)}</div></div><span class="chip">${bars()}both sides · on your PC</span></div>
        <div class="call-body"><div>${c.lines.map((l) => `<div class="cl ${l.s === 'You' ? 'you' : ''}"><span class="s">${l.s}</span><span class="t">${esc(l.t)}</span></div>`).join('')}</div>
        <div class="outc"><p class="lbl">What came out of it</p>${c.out.said ? `<div class="row"><p class="lbl">You said you’d</p>${esc(c.out.said)}</div>` : ''}${c.out.owed ? `<div class="row"><p class="lbl">Waiting on</p>${esc(c.out.owed)}</div>` : ''}</div></div></section>`).join('');
      return head('Calls', `<span><b>${D.calls.length}</b> in the last 7 days</span><span>both sides recorded</span><span>audio stays on your PC</span>`, '<div class="fig" data-figure="num" data-value="3" data-scale="2"></div>', 'calls, last 7 days') + cards;
    },
    memory() {
      const people = [['Maya Chen', 'Friend · likes mornings'], ['Leo Park', 'Northwind · prefers email'], ['Priya Shah', 'Runs the offsite budget'], ['Sam Okafor', 'Your team · reviews on Fridays'], ['Noor Haddad', 'Planning the offsite']];
      return head('Memory', `<span>What Yuki knows</span><span><b>1,284</b> things, kept on your PC</span><span>searchable here while it’s on</span>`, '', '') +
        `<div class="cols"><div class="col">${sec('Search', null, S.online ? 'asks your PC' : 'last copy, read only',
          `<label class="msearch">${dic('dot')}<input id="msearch" placeholder="Search: “Leo”, “dentist”, “venue”" value="${esc(S.memQ)}" aria-label="Search memory"></label>
           <div class="cats" id="cats">${D.memCats.map(([k, n]) => `<button type="button" data-cat="${k}" aria-pressed="${S.memCat === k}">${n}</button>`).join('')}</div>
           <div id="facts"></div>`)}</div>
         <div class="col">${sec('People', people.length, '', `<div class="people">${people.map(([n, r]) => `<div class="person"><span class="av">${n[0]}</span><div><b>${n}</b><span>${r}</span></div></div>`).join('')}</div>`)}
         <div class="memnote">${dic('lock')}<span>Memory lives on your PC, encrypted. This page asks your PC and shows the answer. Nothing here is saved in the cloud. Forget removes it on your PC too.</span></div></div></div>`;
    },
    settings() {
      return head('Settings', `<span>Your account and your PC link</span><span>everything else lives in the app on your PC</span>`, '', '') +
        `<div class="cols"><div class="col">
          ${sec('This PC', null, S.online ? '<span class="live">● online</span>' : 'offline', `
            <div class="srow"><span>Name<small>Set in Windows</small></span><span class="v">${D.pc.name}</span></div>
            <div class="srow"><span>System</span><span class="v">${D.pc.os} · ${D.pc.app}</span></div>
            <div class="srow"><span>Linked</span><span class="v">${D.pc.linked}</span></div>
            <div class="srow"><span>Stream<small>End-to-end encrypted. We pass it on, we can’t read it.</small></span><span class="v">${S.online ? 'live' : 'paused'}</span></div>
            <div class="srow"><span>Link another PC</span><a class="key sm" href="link.html">Link a PC</a></div>
            <div class="srow"><span>Unlink<small>The web stops seeing this PC. Its memory stays on it.</small></span><a class="key sm" href="link.html#unlink=desktop">Unlink</a></div>`)}
          ${sec('When your PC is off', null, '', `
            <div class="srow"><span>Tasks you type here<small>Yuki can hold them until your PC is back.</small></span><span class="seg2" id="qpref"><button type="button" aria-pressed="true">Ask me</button><button type="button" aria-pressed="false">Queue</button><button type="button" aria-pressed="false">Don’t run</button></span></div>
            <div class="srow"><span>Queued tasks expire<small>So nothing old runs by surprise.</small></span><span class="v">after 24 hours</span></div>`)}
        </div><div class="col">
          ${sec('AI', null, 'chosen on your PC', `<div class="aibig"><span class="doto">${D.pc.ai}</span><span>${D.pc.aiVia}.<br>Change it in the Yuki app on your PC. Keys never leave it.</span></div>
            <div class="srow"><span>Voice</span><span class="v">${D.pc.voice}</span></div>`)}
          ${sec('Account', null, '', `
            <div class="srow"><span>${D.user.name}<small>${D.user.email}</small></span><span class="v">Google</span></div>
            <div class="srow"><span>What we store<small>Your email, the link to your PC and when it was last online. Tasks you queue, sealed, until they run or 24 hours pass.</small></span><span class="v">that’s all</span></div>
            <div class="srow"><span>Your data</span><button class="key sm" type="button">Download</button></div>
            <div class="srow"><span>Sign out<small>On this browser only.</small></span><a class="key sm" href="login.html#email">Sign out</a></div>
            <div class="srow"><span class="danger">Delete account<small>Removes your email and PC links. Your PC keeps its memory.</small></span><button class="key ghost sm" type="button">Delete</button></div>`)}
        </div></div>`;
    }
  };
  function renderFacts() {
    const box = $('#facts'); if (!box) return;
    const q = S.memQ.trim().toLowerCase();
    const list = D.memory.filter((f) => (S.memCat === 'all' || f.k === S.memCat) && (!q || f.t.toLowerCase().includes(q)));
    const hi = (t) => q ? esc(t).replace(new RegExp('(' + q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'ig'), '<mark>$1</mark>') : esc(t);
    box.innerHTML = list.length ? list.map((f) => `<div class="fact"><div class="tx">${hi(f.t)}</div><div class="m2"><span>${esc(f.src)}</span><span>${f.d}</span></div><button class="key xs fg" type="button" data-forget>Forget</button></div>`).join('')
      : `<p class="mem-empty">Nothing on your PC matches “${esc(S.memQ)}”.</p>`;
    field.refresh();
  }
  function render(enter) {
    renderNav();
    view.innerHTML = PAGES[S.tab]();
    if (enter && !reduced) { view.classList.remove('enter'); void view.offsetWidth; view.classList.add('enter'); }
    Y.fillMarks(); Y.fillIcons(view);
    if (S.tab === 'memory') renderFacts();
    field.remeasure();
    // the field re-reads the clearings once the entry animation has settled
    setTimeout(() => field.refresh(), 560);
  }

  /* ---------------- page events ---------------- */
  view.addEventListener('click', (e) => {
    const ck = e.target.closest('.ck');
    if (ck) { ck.closest('.todo').classList.toggle('done'); return; }
    const cat = e.target.closest('[data-cat]');
    if (cat) { S.memCat = cat.dataset.cat; $$('#cats button').forEach((b) => b.setAttribute('aria-pressed', String(b === cat))); renderFacts(); return; }
    const fg = e.target.closest('[data-forget]');
    if (fg) { const f = fg.closest('.fact'); f.classList.add('gone'); fg.textContent = 'Undo'; fg.removeAttribute('data-forget'); fg.dataset.undo = '1'; return; }
    const un = e.target.closest('[data-undo]');
    if (un) { un.closest('.fact').classList.remove('gone'); un.textContent = 'Forget'; un.removeAttribute('data-undo'); un.dataset.forget = '1'; return; }
    const q = e.target.closest('[data-q]');
    if (q) { ask(q.dataset.q); return; }
    const seg = e.target.closest('.seg2 button');
    if (seg) { $$('button', seg.parentElement).forEach((b) => b.setAttribute('aria-pressed', String(b === seg))); }
  });
  view.addEventListener('input', (e) => { if (e.target.id === 'msearch') { S.memQ = e.target.value; renderFacts(); } });
  view.addEventListener('keydown', (e) => {
    if (e.target.matches('.addrow input') && e.key === 'Enter' && e.target.value.trim()) {
      D.list.unshift({ t: e.target.value.trim(), due: 'no date', src: 'you typed it here, just now' });
      counts.home = 3; render(false); const inp = $('.addrow input'); if (inp) inp.focus();
    }
  });

  /* ---------------- the ask bar ---------------- */
  const chipPulse = () => { const r = $('#pcchip').getBoundingClientRect(); field.pulse(r.left + 14, r.top + r.height / 2); };
  const timers = [];
  const later = (ms, fn) => { const id = setTimeout(fn, reduced ? 0 : ms); timers.push(id); return id; };
  function openThread() { thread.classList.add('on'); }
  function scrollThread() { thread.scrollTop = thread.scrollHeight; }
  function threadHead() {
    if (thread.querySelector('.th-h')) return;
    thread.insertAdjacentHTML('afterbegin', `<div class="th-h"><span class="lbl"><span class="full">With ${D.pc.name} · </span>sealed end to end</span><span class="th-k"><button class="key ghost xs" type="button" id="th-clear">Clear</button><button class="key ghost xs" type="button" id="th-min">Hide</button></span></div>`);
  }
  thread.addEventListener('click', (e) => {
    if (e.target.id === 'th-clear') { thread.innerHTML = ''; thread.classList.remove('on'); S.run = null; }
    if (e.target.id === 'th-min') thread.classList.remove('on');
  });
  function classify(text) {
    const t = text.trim().toLowerCase();
    if (/\?$/.test(t) || /^(what|who|when|where|why|how|is|are|do|did|does|can|should|which|any)\b/.test(t)) return 'ask';
    return 'run';
  }
  function plan(text) {
    const t = text.trim().toLowerCase();
    if (/spotify|liked songs|play (some )?music/.test(t)) return {
      title: 'Open Spotify', steps: [['Opening Spotify', 'Spotify is in front'], ['Opening Liked Songs', 'Liked Songs is showing'], ['Pressing Play', 'music is playing']],
      done: 'Spotify is open and playing Liked Songs.', meta: '3 steps · 5 s · checked after each', after: 'Pause it'
    };
    const mOpen = t.match(/^open (.+)$/);
    if (mOpen) { const app = mOpen[1].replace(/\b\w/g, (c) => c.toUpperCase()); return { title: 'Open ' + app, steps: [['Opening ' + app, app + ' is in front']], done: app + ' is open.', meta: '1 step · 2 s', after: '' }; }
    if (/mute|silence|quiet/.test(t) && /slack/.test(t)) return { title: 'Mute Slack', steps: [['Opening Slack', 'Slack is in front'], ['Pausing notifications for 1 hour', 'notifications are paused until 15:12']], done: 'Slack is quiet until 15:12.', meta: '2 steps · 4 s', after: 'Unmute' };
    if (/^reply to (\w+)/.test(t)) { const who = t.match(/^reply to (\w+)/)[1].replace(/^\w/, (c) => c.toUpperCase()); return { title: 'Reply to ' + who, steps: [['Opening the chat with ' + who, 'the chat is open'], ['Writing a draft in your style', 'a draft is in the box, not sent']], done: 'A draft to ' + who + ' is waiting on your PC. Yuki didn’t send it: sends need your words.', meta: '2 steps · 6 s', after: 'Show draft' }; }
    return { title: text.trim().replace(/^\w/, (c) => c.toUpperCase()), steps: [['Reading the screen', 'found where to start'], ['Working on it', 'the change is on screen']], done: 'Done: ' + text.trim().replace(/[.!]$/, '') + '.', meta: '2 steps · checked after each', after: '' };
  }
  function runCard(p, opts) {
    opts = opts || {};
    const id = 'r' + Date.now();
    const el = document.createElement('div');
    el.className = 'runc'; el.id = id;
    el.innerHTML = `<div class="rh"><span class="lbl">${dic('pc')}Task · ${esc(p.title)}</span><span class="rt" data-rt>just now</span></div>
      <div class="sent">${dic('lock')}<span data-sent>Sending to your PC…</span></div><ol class="steps2" data-steps></ol><div data-end></div>
      <div class="keys" data-keys><button class="key stop sm" type="button" data-stop>${dic('stop')}Stop</button><span class="lbl">runs on ${D.pc.name}</span></div>`;
    thread.appendChild(el); openThread(); scrollThread();
    const run = { el, p, i: 0, stopped: false, done: false, ts: [] };
    S.run = run;
    el.querySelector('[data-stop]').addEventListener('click', () => stopRun(run));
    const stepsEl = el.querySelector('[data-steps]');
    run.ts.push(later(500, () => { if (run.stopped || run.done) return; el.querySelector('[data-sent]').innerHTML = `Sent to your PC · <span class="live">it’s working</span>`; chipPulse(); }));
    let t = 900;
    p.steps.forEach(([doing, changed], i) => {
      run.ts.push(later(t, () => {
        if (run.stopped) return;
        run.i = i;
        stepsEl.insertAdjacentHTML('beforeend', `<li data-s="${i}"><span>${esc(doing)}</span><span class="ms">step ${i + 1}</span></li>`);
        chipPulse(); scrollThread();
      }));
      t += 1300;
      run.ts.push(later(t, () => {
        if (run.stopped) return;
        const li = stepsEl.querySelector(`[data-s="${i}"]`); if (!li) return;
        li.classList.add('ok'); li.insertAdjacentHTML('beforeend', `<span class="chg">What changed: ${esc(changed)}</span>`);
        chipPulse(); scrollThread();
      }));
      t += 250;
    });
    run.ts.push(later(t + 200, () => finishRun(run)));
    if (opts.stopAfter != null) later(opts.stopAfter, () => stopRun(run));
    return run;
  }
  function finishRun(run) {
    if (run.stopped || run.done) return;
    run.done = true;
    run.el.querySelector('[data-keys]').remove();
    run.el.querySelector('[data-sent]').textContent = 'Done on your PC';
    run.el.querySelector('[data-end]').innerHTML = `<div class="done2">${dic('check')}<div><b>${esc(run.p.done)}</b><span class="m">${run.p.meta} · on ${D.pc.name}</span></div>${run.p.after ? `<button class="key sm" type="button" style="margin-left:auto">${run.p.after}</button>` : ''}</div>`;
    chipPulse(); scrollThread();
  }
  function stopRun(run) {
    if (run.done || run.stopped) return;
    run.stopped = true; run.ts.forEach(clearTimeout);
    const k = run.el.querySelector('[data-keys]'); if (k) k.remove();
    const lis = run.el.querySelectorAll('[data-steps] li');
    const last = lis[lis.length - 1]; if (last && !last.classList.contains('ok')) last.classList.add('stop');
    run.el.querySelector('[data-sent]').textContent = 'Stopped on your PC';
    run.el.querySelector('[data-end]').innerHTML = `<div class="done2">${dic('stop')}<div><b>Stopped at step ${run.i + 1}. Nothing else was done.</b><span class="m">What already happened stays as it is. Ask again any time.</span></div></div>`;
    scrollThread();
  }
  function offlineCard(p, at) {
    const el = document.createElement('div');
    el.className = 'runc offline';
    thread.appendChild(el); openThread();
    const ask = () => {
      el.innerHTML = `<div class="rh"><span class="lbl">${dic('pc')}Task · ${esc(p.title)}</span><span class="rt">not sent</span></div>
        <div class="q"><b>Your PC is off. Run it when it’s back?</b><p>${D.pc.name} was last online at ${D.pc.lastSeen}. A queued task waits with us, sealed so only your PC can open it, for up to 24 hours. Then it’s deleted.</p>
        <span style="display:flex;gap:8px"><button class="key pri sm" type="button" data-queue>Queue</button><button class="key sm" type="button" data-cancel>Cancel</button></span></div>`;
      el.querySelector('[data-queue]').addEventListener('click', queue);
      el.querySelector('[data-cancel]').addEventListener('click', () => { el.innerHTML = `<div class="rh"><span class="lbl">${dic('pc')}Task · ${esc(p.title)}</span><span class="rt">cancelled</span></div><div class="sent">Cancelled. Nothing was sent to your PC.</div>`; });
    };
    const queue = () => {
      S.queued.push({ p, el }); renderPC();
      el.innerHTML = `<div class="rh"><span class="lbl">${dic('pc')}Task · ${esc(p.title)}</span><span class="rt">queued</span></div>
        <div class="q"><b>Queued. It runs when ${D.pc.name} is back.</b><p>You’ll see it run here, step by step. Until then it waits with us, sealed so only your PC can read it. It’s deleted once it runs, or after 24 hours.</p>
        <button class="key sm" type="button" data-unq>Cancel it</button></div>`;
      el.querySelector('[data-unq]').addEventListener('click', () => { S.queued = S.queued.filter((q) => q.el !== el); renderPC(); el.innerHTML = `<div class="rh"><span class="lbl">${dic('pc')}Task · ${esc(p.title)}</span><span class="rt">cancelled</span></div><div class="sent">Removed from the queue.</div>`; });
    };
    ask(); if (at === 'queued') queue();
    scrollThread();
  }
  function answer(text) {
    const t = text.toLowerCase();
    const el = document.createElement('div');
    el.className = 'ans';
    el.innerHTML = `<p class="lbl">${dic('pc')}Asking your PC <span class="spin" style="color:var(--live)"><i></i><i></i><i></i></span></p>`;
    thread.appendChild(el); openThread(); scrollThread();
    let body;
    const from = S.online ? `from ${D.pc.name}, just now` : `from what ${D.pc.name} shared before ${D.pc.lastSeen}`;
    if (/list|to.?do|todo/.test(t)) body = `<p style="margin:0">You have <b>${D.list.length} things</b> on your list. One is due today.</p><ul>${D.list.map((i) => `<li><span>${esc(i.t)}</span><em>${i.due}</em></li>`).join('')}</ul>`;
    else if (/leo/.test(t)) body = `<p style="margin:0"><b>Leo Park</b> works at Northwind and prefers email to chat. On a call on 2 Oct you said you’d send him the Q4 deck by Friday. He owes you feedback on the pricing page.</p>`;
    else if (/priya|budget/.test(t)) body = `<p style="margin:0"><b>Priya</b> said on Slack on 1 Oct that she’d send the budget sheet by Friday. It’s late. In this morning’s weekly sync she said you’d have it before your review at 15:30. It hasn’t arrived yet.</p>`;
    else if (/maya|lunch/.test(t)) body = `<p style="margin:0">Lunch with <b>Maya</b> is Thursday at 1 pm at Nori. You said you’d bring the Lisbon photos.</p>`;
    else if (/owe|waiting/.test(t)) body = `<p style="margin:0">Three people owe you something.</p><ul>${D.waiting.map((w) => `<li><span>${esc(w.who)}: ${esc(w.t)}</span><em>${w.since}</em></li>`).join('')}</ul>`;
    else body = `<p style="margin:0">I didn’t find that in what your PC has shared with this page. Ask on your PC by voice and Yuki can look deeper.</p>`;
    later(700, () => { el.innerHTML = `<p class="lbl">${dic('pc')}Answer · ${S.online ? 'live' : 'last copy'}</p>${body}<p class="from">${from}</p>`; chipPulse(); scrollThread(); });
  }
  function ask(text, opts) {
    opts = opts || {};
    if (!text.trim()) return;
    threadHead();
    thread.insertAdjacentHTML('beforeend', `<div class="you-l">${esc(text)}</div>`);
    openThread(); input.value = '';
    if (classify(text) === 'ask') { answer(text); return; }
    const p = plan(text);
    if (!S.online) { offlineCard(p, opts.at); return; }
    const run = runCard(p, { stopAfter: opts.at === 'stopped' ? 2600 : null });
    if (opts.at === 'done') { run.ts.forEach(clearTimeout); fastForward(run); }
  }
  function fastForward(run) {
    const stepsEl = run.el.querySelector('[data-steps]');
    run.el.querySelector('[data-sent]').innerHTML = 'Sent to your PC';
    stepsEl.innerHTML = run.p.steps.map(([d, c], i) => `<li class="ok"><span>${esc(d)}</span><span class="ms">step ${i + 1}</span><span class="chg">What changed: ${esc(c)}</span></li>`).join('');
    run.i = run.p.steps.length - 1; finishRun(run);
  }
  // the ask bar's words: the full sentence where it fits, a shorter one on a phone (the label keeps the full sentence)
  const PH_FULL = 'Ask Yuki or tell it to do something on your PC', PH_SHORT = 'Ask Yuki, or give your PC a task';
  const phoneMQ = window.matchMedia('(max-width: 460px)');
  const setPH = () => { input.placeholder = phoneMQ.matches ? PH_SHORT : PH_FULL; const a = $('.addrow input'); if (a) a.placeholder = phoneMQ.matches ? 'Add to your list…' : 'Add to your list… “call the plumber on Friday”'; };
  setPH(); phoneMQ.addEventListener('change', setPH);
  const dock = $('.askdock');
  input.addEventListener('focus', () => dock.classList.add('focus'));
  input.addEventListener('blur', () => setTimeout(() => { if (!dock.contains(document.activeElement)) dock.classList.remove('focus'); }, 150));
  input.addEventListener('input', () => dock.classList.toggle('focus', !input.value));
  $('#ask').addEventListener('submit', (e) => { e.preventDefault(); ask(input.value); });
  $('#hints').addEventListener('click', (e) => { const b = e.target.closest('[data-q]'); if (b) ask(b.dataset.q); });
  $('#mocktog').addEventListener('click', () => {
    S.online = !S.online; renderPC(); render(false);
    const h = location.hash.replace(/&?offline/, '');
    history.replaceState(null, '', (h || '#' + S.tab) + (S.online ? '' : '&offline'));
    if (S.online && S.queued.length) {
      // the PC is back: queued tasks run now, in order
      const q = S.queued.splice(0); renderPC();
      q.forEach(({ p, el }) => { el.innerHTML = `<div class="sent">${dic('pc')}<span>${D.pc.name} is back. Running your queued task.</span></div>`; later(400, () => runCard(p)); });
    }
  });

  /* ---------------- hash state ---------------- */
  let lastKey = '';
  function apply(first) {
    const h = hashTokens();
    const tab = TABS.map((x) => x[0]).find((k) => h[k]) || 'home';
    const online = !h.offline;
    const key = tab + '|' + online + '|' + (h.run || '') + (h.at || '') + (h.ask || '');
    if (key === lastKey) return;
    const tabChanged = tab !== S.tab || first;
    S.tab = tab; S.online = online;
    renderPC(); render(tabChanged);
    const hadScripted = /\|.+$/.test(lastKey) && lastKey.split('|')[2] !== '';
    if (h.run || h.ask || hadScripted) {
      timers.forEach(clearTimeout); thread.innerHTML = ''; thread.classList.remove('on'); S.queued = []; S.run = null; renderPC();
      if (h.run) ask(h.run === 'spotify' ? 'Open Spotify' : h.run.replace(/-/g, ' '), { at: h.at });
      if (h.ask) ask(h.ask === 'list' ? 'What’s on my list?' : h.ask.replace(/-/g, ' ') + '?');
    }
    lastKey = key;
    if (!first) scrollTo({ top: 0, behavior: 'instant' });
  }
  addEventListener('hashchange', () => apply(false));
  apply(true);
})();
