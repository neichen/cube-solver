/* Share links: the current puzzle position packed into the URL fragment (#p=cube3&s=…), never sent to the server,
   so shared links are the clean (canonical) page + a fragment: no indexable duplicates, no server/SW/cache variants.
   State = one color letter per sticker (null = unpainted). Digits: 0 = blank, 1… = the puzzle's color letters sorted;
   base b = colors + 1; as many stickers per base64url character as fit (b^m ≤ 64): 3×3 → 27 chars, 15×15 → 675,
   Pyraminx → 18, Skewb → 15, Megaminx → 132. decode() returns null for anything that is not exactly such a code. */
(function (root) {
  'use strict';
  var ABC = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  function alphabet(P) { return Object.keys(P.colors).sort(); }
  function geom(P) {
    var cols = alphabet(P), b = cols.length + 1, m = 1;
    while (Math.pow(b, m + 1) <= 64) m++;
    return { cols: cols, b: b, m: m, n: P.solvedState().length };
  }
  function encode(P, state) {
    var g = geom(P), out = '';
    if (!state || state.length !== g.n) throw new Error('share: state length');
    for (var i = 0; i < g.n; i += g.m) {
      var v = 0;
      for (var j = g.m - 1; j >= 0; j--) {
        var c = i + j < g.n ? state[i + j] : null, d = c == null ? 0 : g.cols.indexOf(c) + 1;
        if (d < 0) throw new Error('share: unknown color ' + c);
        v = v * g.b + d;
      }
      out += ABC[v];
    }
    return out;
  }
  function decode(P, code) {
    if (typeof code !== 'string') return null;
    var g = geom(P), len = Math.ceil(g.n / g.m), max = Math.pow(g.b, g.m);
    if (code.length !== len || !/^[A-Za-z0-9_-]+$/.test(code)) return null;
    var st = new Array(g.n);
    for (var k = 0; k < len; k++) {
      var v = ABC.indexOf(code[k]);
      if (v < 0 || v >= max) return null;
      for (var j = 0; j < g.m; j++) {
        var d = v % g.b; v = (v - d) / g.b;
        var i = k * g.m + j;
        if (i < g.n) st[i] = d ? g.cols[d - 1] : null;
        else if (d) return null;                 // padding digits must be 0
      }
    }
    return st;
  }
  /** '#p=cube3&s=…&m=play&t=2341' ↔ { p, s, m, t } (t: solve time in ms, rounded to 10 ms) */
  function parseHash(h) {
    var o = {};
    String(h || '').replace(/^#/, '').split('&').forEach(function (kv) {
      var i = kv.indexOf('='); if (i > 0) o[kv.slice(0, i)] = kv.slice(i + 1);
    });
    if (!o.p || !/^[a-z0-9]{2,16}$/.test(o.p) || !o.s) return null;
    var r = { p: o.p, s: o.s, m: o.m === 'play' ? 'play' : 'solve', t: null };
    if (o.t && /^\d{1,7}$/.test(o.t)) r.t = +o.t * 10;
    return r;
  }
  function makeHash(o) {
    return '#p=' + o.p + '&s=' + o.s + (o.m === 'play' ? '&m=play' : '') + (o.t != null ? '&t=' + Math.round(o.t / 10) : '');
  }
  var API = { encode: encode, decode: decode, parseHash: parseHash, makeHash: makeHash };
  if (root.CubeLab) root.CubeLab.shareCode = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof self !== 'undefined' ? self : globalThis);
