/*
 * 「自己玩」模式的纯逻辑部分（不依赖 DOM，可在 Node 中测试）：
 *  - turnMap(P)：把「贴纸 + 拖动方向」换算成转动记号（任意 N 阶，自动选对内层）
 *  - randomState(P)：2×2 / 3×3 随机状态打乱（均匀随机的合法状态）
 *  - keyToken(...)：键盘输入（字母 + Shift 为逆时针；数字前缀 = 第 k 层；w 前缀 = 宽层）
 *  - countMoves：按计数规则统计步数（整体转动 x/y/z 不计）
 *  - formatTime / bestTimes：计时显示与每个阶数的最好成绩（localStorage）
 */
(function (root) {
  'use strict';
  var CL = root.CubeLab = root.CubeLab || {};
  function getX() { return root.NxNModel || (typeof require !== 'undefined' ? require('../../puzzles/nxn/nxn-model.js') : null); }
  function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
  var E = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  function axisOf(v) { var k = 0; for (var i = 1; i < 3; i++) if (Math.abs(v[i]) > Math.abs(v[k])) k = i; return { k: k, s: v[k] > 0 ? 1 : -1 }; }
  function r3(x) { return Math.round(x * 1000) / 1000; }

  /** 记号优先级：外层 < 中层 M/E/S < 单个内层（离该面越近越优先）；宽层 / 整体转动不用于拖动 */
  function rank(tok, m) {
    if (/^[URFDLB]'?$/.test(tok)) return 0;
    if (/^[MES]'?$/.test(tok)) return 1;
    var mm = /^(\d+)[URFDLB]'?$/.exec(tok);
    if (mm) return 1 + (+mm[1]);
    return -1;
  }
  /**
   * 单层 90° 转动表：key = 轴 k : 层坐标 : 绕 +e_k 的方向（+1 = 右手定则正向） → 记号
   */
  function turnMap(P) {
    if (P._turnMap) return P._turnMap;
    var map = {}, best = {};
    Object.keys(P.moves).forEach(function (tok) {
      var m = P.moves[tok];
      if (m.rotation || Math.abs(Math.abs(m.angle) - Math.PI / 2) > 1e-6) return;
      var rk = rank(tok, m); if (rk < 0) return;
      var a = axisOf(m.axis), coords = {};
      m.pieces.forEach(function (pi) { coords[r3(P.pieces[pi].pos[a.k])] = 1; });
      var cs = Object.keys(coords); if (cs.length !== 1) return;
      var key = a.k + ':' + cs[0] + ':' + (a.s * Math.sign(m.angle));
      if (best[key] == null || rk < best[key]) { best[key] = rk; map[key] = tok; }
    });
    return (P._turnMap = map);
  }
  /**
   * 贴纸 si 沿（谜题坐标系中的）单位方向 d 被拖动 → 转动记号（找不到时 null）。
   * 转轴 a = n × d：绕 a 正转 90° 正好把该贴纸的法线方向转到 d。
   */
  function turnFor(P, si, d) {
    var s = P.stickers[si], n = s.normal, a = cross(n, d), ax = axisOf(a);
    if (Math.abs(a[ax.k]) < 0.5) return null;
    var c = r3(s.pos[ax.k]);
    return turnMap(P)[ax.k + ':' + c + ':' + ax.s] || null;
  }
  /** 贴纸所在面内的两个候选拖动方向（单位坐标轴） */
  function inPlaneAxes(P, si) {
    var n = P.stickers[si].normal, out = [];
    E.forEach(function (e) { if (Math.abs(dot(e, n)) < 0.5) out.push(e); });
    return out;
  }

  // ------------------------------------------------------------ 随机状态（2×2 / 3×3）
  function rndInt(rnd, k) { return Math.floor(rnd() * k); }
  function shuffle(a, rnd) { for (var i = a.length - 1; i > 0; i--) { var j = rndInt(rnd, i + 1), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function parity(p) { var seen = [], par = 0; for (var i = 0; i < p.length; i++) { if (seen[i]) continue; var j = i, l = 0; while (!seen[j]) { seen[j] = 1; j = p[j]; l++; } par += l - 1; } return par & 1; }
  /** 均匀随机的合法状态（角块排列 / 朝向；3×3 加棱块，满足排列奇偶一致、朝向和为 0） */
  function randomState(P, rnd) {
    rnd = rnd || Math.random;
    if (P.randomState) return P.randomState(rnd);
    var n = P.n || 3; if (n !== 2 && n !== 3) return null;
    var X = getX(), PC = X.pieces(n), S = P.solvedState(), st = S.slice();
    var C = PC.corners, cp = shuffle(C.map(function (_, i) { return i; }), rnd), co = [], sum = 0;
    for (var i = 0; i < C.length - 1; i++) { co[i] = rndInt(rnd, 3); sum += co[i]; }
    co[C.length - 1] = (3 - sum % 3) % 3;
    C.forEach(function (slot, i) { var cols = C[cp[i]].map(function (f) { return S[f]; }); for (var t = 0; t < 3; t++) st[slot[t]] = cols[(t + co[i]) % 3]; });
    if (n === 3) {
      var Ed = PC.mid, ep = shuffle(Ed.map(function (_, i) { return i; }), rnd);
      if (parity(ep) !== parity(cp)) { var tmp = ep[0]; ep[0] = ep[1]; ep[1] = tmp; }
      var eo = [], es = 0; for (i = 0; i < Ed.length - 1; i++) { eo[i] = rndInt(rnd, 2); es += eo[i]; } eo[Ed.length - 1] = es & 1;
      Ed.forEach(function (slot, i) { var cols = Ed[ep[i]].map(function (f) { return S[f]; }); st[slot[0]] = cols[eo[i]]; st[slot[1]] = cols[1 - eo[i]]; });
    }
    return st;
  }

  // ------------------------------------------------------------ 键盘
  /**
   * 由按键构造记号（视角记号，未经握法换算）。prefix = { depth: '3' | '', wide: bool }。
   * 返回 { tok } 或 { prefix }（只更新前缀）或 null。
   */
  function keyToken(key, shift, prefix, P) {
    prefix = prefix || { depth: '', wide: false };
    // 异形魔方：P.playKeys.letters 为可用字母；金字塔用前缀 t 表示只转顶角（u l r b）
    if (P && P.playKeys) {
      var K = P.playKeys, LL = key.toUpperCase();
      if (K.tip && (key === 't' || key === 'T')) return { prefix: { depth: '', wide: false, tip: !prefix.tip } };
      if (key.length === 1 && K.letters.indexOf(LL) >= 0) return { tok: (prefix.tip ? LL.toLowerCase() : LL) + (shift ? "'" : '') };
      return null;
    }
    if (/^[0-9]$/.test(key)) { var d = (prefix.depth + key).replace(/^0+/, ''); return { prefix: { depth: d.slice(-2), wide: prefix.wide } }; }
    if (key === 'w' || key === 'W') return { prefix: { depth: prefix.depth, wide: !prefix.wide } };
    var L = key.toUpperCase();
    if (/^[URFDLBMES]$/.test(L) || /^[xyz]$/i.test(key)) {
      var base = /^[xyz]$/i.test(key) ? key.toLowerCase() : L;
      var tok = (/^[xyzMES]$/.test(base) ? '' : prefix.depth) + base + (prefix.wide && /^[URFDLB]$/.test(base) ? 'w' : '') + (shift ? "'" : '');
      return { tok: tok };
    }
    return null;
  }
  /** 计数：整体转动不计，其它每次转动计 1（STM / 块转动计数） */
  function countMoves(P, toks) { var c = 0; toks.forEach(function (t) { var m = P.moves[t]; if (m && !m.rotation && !/^[xyz]/.test(t)) c++; }); return c; }
  function metricFor(P) { if (P.playMetric) return P.playMetric; return (P.n || 3) >= 4 ? 'BTM' : 'STM'; }
  function isRotation(P, t) { var m = P.moves[t]; return !!(m && (m.rotation || /^[xyz]/.test(t))); }

  // ------------------------------------------------------------ 计时 / 最好成绩
  function formatTime(ms) {
    if (ms == null || !isFinite(ms)) return '—';
    var cs = Math.floor(ms / 10), s = Math.floor(cs / 100), m = Math.floor(s / 60);
    var c2 = ('0' + (cs % 100)).slice(-2);
    return m ? m + ':' + ('0' + (s % 60)).slice(-2) + '.' + c2 : s + '.' + c2;
  }
  function bestKey(id) { return 'cubelab.best.' + id; }
  function getBest(id, ls) { try { var v = (ls || root.localStorage).getItem(bestKey(id)); return v ? +v : null; } catch (e) { return null; } }
  function saveBest(id, ms, ls) { var b = getBest(id, ls); if (b == null || ms < b) { try { (ls || root.localStorage).setItem(bestKey(id), String(Math.round(ms))); } catch (e) {} return true; } return false; }

  var api = { turnMap: turnMap, turnFor: turnFor, inPlaneAxes: inPlaneAxes, randomState: randomState, keyToken: keyToken, countMoves: countMoves,
    metricFor: metricFor, isRotation: isRotation, formatTime: formatTime, getBest: getBest, saveBest: saveBest, parity: parity };
  CL.play = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
