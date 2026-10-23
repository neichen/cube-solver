/*
 * 2×2 严格最优求解器（HTM，面转动计 1 步）。固定 DBL 角块，只用 U / R / F 转动：
 * 7 个角块的排列（7! = 5040）× 6 个角块的朝向（3^6 = 729）= 3 674 160 个状态，
 * 广度优先搜索一次算出每个状态到复原的精确距离（约 3.7 MB），之后沿距离递减走即为最优解。
 * 任何用到 L/D/B 的解都能改写为等长的 U/R/F 解（整体转动吸收），所以结果对全部 6 个面也是最优的。
 */
(function (root) {
  'use strict';
  var X = root.NxNModel || (typeof require !== 'undefined' ? require('./nxn-model.js') : null);
  if (!X && typeof importScripts === 'function') { importScripts('nxn-model.js'); X = root.NxNModel; }
  var SLOTS = [0, 1, 2, 3, 4, 5, 7];   // 除 DBL（6）以外的角块位置
  var MOVES = [], NP = 5040, NO = 729, PM = null, OM = null, DIST = null;
  var FACT = [1, 1, 2, 6, 24, 120, 720, 5040];

  function cornersOf(facelets) {
    var n = 2, nn = 4, PC = X.pieces(n), cp = [], co = [];
    PC.corners.forEach(function (ids) {
      var fl = ids.map(function (x) { return facelets[x]; });
      var ori = fl.findIndex(function (c) { return c === 'U' || c === 'D'; });
      var c0 = fl[ori], c1 = fl[(ori + 1) % 3], c2 = fl[(ori + 2) % 3];
      cp.push(X.CORNER_C.findIndex(function (s) { return s[0] === c0 && s[1] === c1 && s[2] === c2; })); co.push(ori);
    });
    return { cp: cp, co: co };
  }
  function permIndex(cp) {   // 7 个位置上的块（0..7 去掉 6）的排列序号（Lehmer 码）
    var a = SLOTS.map(function (s) { var v = cp[s]; return v > 6 ? 6 : v; }), idx = 0;
    for (var i = 0; i < 7; i++) { var c = 0; for (var j = i + 1; j < 7; j++) if (a[j] < a[i]) c++; idx += c * FACT[6 - i]; }
    return idx;
  }
  function permFromIndex(idx) {
    var a = [], pool = [0, 1, 2, 3, 4, 5, 6];
    for (var i = 0; i < 7; i++) { var f = FACT[6 - i], q = (idx / f) | 0; idx -= q * f; a.push(pool.splice(q, 1)[0]); }
    var cp = [0, 0, 0, 0, 0, 0, 6, 0];
    SLOTS.forEach(function (s, k) { cp[s] = a[k] === 6 ? 7 : a[k]; });
    return cp;
  }
  function oriIndex(co) { var idx = 0; for (var k = 0; k < 6; k++) idx = idx * 3 + co[SLOTS[k]]; return idx; }
  function oriFromIndex(idx) {
    var co = [0, 0, 0, 0, 0, 0, 0, 0], s = 0;
    for (var k = 5; k >= 0; k--) { co[SLOTS[k]] = idx % 3; s += idx % 3; idx = (idx / 3) | 0; }
    co[7] = (3 - s % 3) % 3; return co;
  }
  function init() {
    if (DIST) return;
    var M = X.build(2), solved = 'UUUURRRRFFFFDDDDLLLLBBBB'.split('');
    ['U', 'R', 'F'].forEach(function (f) {
      ['', '2', "'"].forEach(function (s) {
        var tok = f + s, st = X.applyPerm(solved, M.moves[tok].perm);
        MOVES.push({ tok: tok, face: f, c: cornersOf(st) });
      });
    });
    PM = new Uint16Array(NP * 9); OM = new Uint16Array(NO * 9);
    for (var p = 0; p < NP; p++) {
      var cp = permFromIndex(p);
      MOVES.forEach(function (m, k) { var r = []; for (var i = 0; i < 8; i++) r[i] = cp[m.c.cp[i]]; PM[p * 9 + k] = permIndex(r); });
    }
    for (var o = 0; o < NO; o++) {
      var co = oriFromIndex(o);
      MOVES.forEach(function (m, k) { var r = []; for (var i = 0; i < 8; i++) r[i] = (co[m.c.cp[i]] + m.c.co[i]) % 3; OM[o * 9 + k] = oriIndex(r); });
    }
    DIST = new Uint8Array(NP * NO).fill(255);
    var Q = new Uint32Array(NP * NO), head = 0, tail = 0, s0 = permIndex([0, 1, 2, 3, 4, 5, 6, 7]) * NO;
    DIST[s0] = 0; Q[tail++] = s0;
    while (head < tail) {
      var x = Q[head++], d = DIST[x] + 1, pp = (x / NO) | 0, oo = x - pp * NO;
      for (var k = 0; k < 9; k++) {
        var y = PM[pp * 9 + k] * NO + OM[oo * 9 + k];
        if (DIST[y] === 255) { DIST[y] = d; Q[tail++] = y; }
      }
    }
  }
  function solve(facelets) {
    init();
    var c = cornersOf(facelets.split(''));
    if (c.cp[6] !== 6 || c.co[6] !== 0) throw new Error('DBL corner must be solved (validator picks that orientation)');
    var p = permIndex(c.cp), o = oriIndex(c.co), out = [];
    while (DIST[p * NO + o] > 0) {
      var d = DIST[p * NO + o], found = false;
      for (var k = 0; k < 9 && !found; k++) {
        var p2 = PM[p * 9 + k], o2 = OM[o * 9 + k];
        if (DIST[p2 * NO + o2] === d - 1) { out.push(MOVES[k].tok); p = p2; o = o2; found = true; }
      }
      if (!found) throw new Error('distance table inconsistent');
    }
    return out;
  }
  var api = { init: init, solve: solve };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof self !== 'undefined' && typeof importScripts === 'function') {
    self.onmessage = function (e) {
      var d = e.data, t0 = Date.now();
      try {
        if (d.cmd === 'init') { init(); return self.postMessage({ id: d.id, ok: true, ms: Date.now() - t0 }); }
        if (d.cmd === 'solve') { var mv = solve(d.payload.facelets); self.postMessage({ id: d.id, ok: true, moves: mv, optimal: true, ms: Date.now() - t0 }); }
      } catch (err) { self.postMessage({ id: d.id, ok: false, error: String(err && err.message || err) }); }
    };
  }
})(typeof self !== 'undefined' ? self : this);
