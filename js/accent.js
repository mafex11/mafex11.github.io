/* Yuki website / accent: the one accent colour ("live"), chosen once, used everywhere.
   Loaded first in every page's <head> (no defer), so the colour is set before anything paints.
   Where the colour comes from, first match wins:
     1. ?accent=FF6A1A in the address (any 3 or 6 digit hex, with or without #); ?accent=reset clears a saved one;
     2. the colour saved by accent.html (localStorage 'yuki-accent');
     3. the default, mint #6FEBC4.
   It sets on <html>: --live, --live-rgb ("r, g, b", for rgba(var(--live-rgb), a)), --live-dim and --live-ink (dark or
   light text on an accent fill, whichever reads better), and window.YAccent = { hex, rgb, ramp } for the canvases
   (DotKit's COL.live and its 6-step RAMP: dark tint -> accent -> light tint -> bone). */
(function () {
  'use strict';
  var DEF = '#6FEBC4', BONE = [242, 239, 233], DARK = [26, 29, 32], KEY = 'yuki-accent';
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
  var st = document.documentElement.style;
  st.setProperty('--live', hex);
  st.setProperty('--live-rgb', rgb.join(', '));
  st.setProperty('--live-dim', 'rgba(' + rgb.join(', ') + ', .12)');
  st.setProperty('--live-ink', ink);
  window.YAccent = { hex: hex, rgb: rgb, ramp: ramp, ink: ink, isDefault: hex === DEF, key: KEY, norm: norm };
})();
