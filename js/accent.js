/* Yuki website / accent: the site's colour choice, made once, used everywhere: the one accent colour ("live")
   and the black palette.
   Loaded first in every page's <head> (no defer), so the colours are set before anything paints.
   The accent, first match wins:
     1. ?accent=FF6A1A in the address (any 3 or 6 digit hex, with or without #); ?accent=reset clears a saved one;
     2. the colour saved by accent.html (localStorage 'yuki-accent');
     3. the default, mint #6FEBC4.
   It sets on <html>: --live, --live-rgb ("r, g, b", for rgba(var(--live-rgb), a)), --live-dim and --live-ink (dark or
   light text on an accent fill, whichever reads better), and window.YAccent = { hex, rgb, ramp } for the canvases
   (DotKit's COL.live and its 6-step RAMP: dark tint -> accent -> light tint -> bone).
   The black palette (19 Oct), first match wins:
     1. ?black=NAME in the address, NAME one of BLACKS below (anything else is ignored), which is saved;
        ?black=reset clears the saved one;
     2. the name saved in localStorage 'yuki-black';
     3. the default, umber (its tokens are css/base.css :root).
   The name is set as <html data-black="NAME">, which css/blacks.css matches (token overrides and depth rules).
   window.YAccent.black is the name.
   YAccent.tok('--x', '#fallback') reads a colour token at run time for canvases and JS-built colours (after the
   stylesheets have loaded, so from the scripts at the end of <body>): a plain hex comes back as written, anything
   else (rgb(), color-mix(), oklch()) is resolved to a colour a canvas takes; no value or a bad one -> the fallback. */
(function () {
  'use strict';
  var DEF = '#6FEBC4', BONE = [242, 239, 233], DARK = [26, 29, 32], KEY = 'yuki-accent', BKEY = 'yuki-black';
  function norm(v) {
    if (!v) return null;
    v = String(v).trim().replace(/^#/, '');
    if (/^[0-9a-f]{3}$/i.test(v)) v = v.replace(/(.)/g, '$1$1');
    return /^[0-9a-f]{6}$/i.test(v) ? '#' + v.toUpperCase() : null;
  }
  var hex = null, q = null;
  try { q = new URLSearchParams(location.search).get('accent'); } catch (e) { q = null; }
  try {
    if (q === 'reset') localStorage.removeItem(KEY);
    else if (norm(q)) { hex = norm(q); localStorage.setItem(KEY, hex); }
    if (!hex) hex = norm(localStorage.getItem(KEY));
  } catch (e) { if (!hex && q && q !== 'reset') hex = norm(q); }
  hex = hex || DEF;
  var n = parseInt(hex.slice(1), 16), rgb = [n >> 16 & 255, n >> 8 & 255, n & 255];
  function mix(a, b, t) { return [0, 1, 2].map(function (i) { return Math.round(a[i] + (b[i] - a[i]) * t); }); }
  function toHex(c) { return '#' + c.map(function (x) { return ('0' + x.toString(16)).slice(-2); }).join('').toUpperCase(); }
  function lum(c) {
    var s = c.map(function (x) { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); });
    return 0.2126 * s[0] + 0.7152 * s[1] + 0.0722 * s[2];
  }
  // text on an accent fill: a deep shade of the accent itself when the accent is light, bone when it is dark
  var L = lum(rgb), ink = L > 0.36 ? toHex(mix(rgb, [0, 0, 0], 0.88)) : '#F2EFE9';
  var ramp = [toHex(mix(rgb, DARK, 0.72)), toHex(mix(rgb, DARK, 0.5)), toHex(mix(rgb, DARK, 0.25)), hex, toHex(mix(rgb, BONE, 0.6)), toHex(BONE)];
  var root = document.documentElement, st = root.style;
  st.setProperty('--live', hex);
  st.setProperty('--live-rgb', rgb.join(', '));
  st.setProperty('--live-dim', 'rgba(' + rgb.join(', ') + ', .12)');
  st.setProperty('--live-ink', ink);

  // the black palette: a name only (the colours live in css/blacks.css). umber is the default; flat is the old black
  var BLACKS = ['umber', 'obsidian', 'jet', 'ink', 'flat'], BDEF = 'umber';
  function bname(v) { return v && BLACKS.indexOf(v) >= 0 ? v : null; }
  var black = null, bq = null;
  try { bq = new URLSearchParams(location.search).get('black'); } catch (e) { bq = null; }
  try {
    if (bq === 'reset') localStorage.removeItem(BKEY);
    else if (bname(bq)) { black = bq; localStorage.setItem(BKEY, black); }
    if (!black && bq !== 'reset') black = bname(localStorage.getItem(BKEY));
  } catch (e) { if (!black) black = bname(bq); }
  black = black || BDEF;
  root.setAttribute('data-black', black);

  function tok(name, fb) {
    try {
      var v = getComputedStyle(root).getPropertyValue(name).trim();
      if (!v) return fb;
      if (/^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(v)) return v;   // anything else is checked below
      var el = document.createElement('i');
      el.style.cssText = 'position:absolute;width:0;height:0;visibility:hidden;pointer-events:none';
      el.style.color = fb; el.style.color = v;          // an invalid value leaves the fallback
      root.appendChild(el);
      var c = getComputedStyle(el).color;
      root.removeChild(el);
      return c || fb;
    } catch (e) { return fb; }
  }
  // the phone browser's bar follows the page black when another palette is on
  if (black !== BDEF) document.addEventListener('DOMContentLoaded', function () {
    var m = document.querySelector('meta[name="theme-color"]');
    if (m) m.setAttribute('content', tok('--bg', m.getAttribute('content')));
  });
  window.YAccent = { hex: hex, rgb: rgb, ramp: ramp, ink: ink, isDefault: hex === DEF, key: KEY, norm: norm, black: black, blackKey: BKEY, tok: tok };
})();
