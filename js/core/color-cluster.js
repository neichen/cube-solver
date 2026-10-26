/*
 * N×N 扫描颜色识别（不依赖固定中心块，偶数阶同样适用）：
 *  1. 全部 6n² 块贴纸在 CIE Lab 中做「等容量」k-means（每类恰好 n² 块；拉格朗日价格法分配），聚成 6 类；
 *  2. 6 个类中心与典型颜色做 6! 穷举匹配，得到颜色名（W Y G B R O）；
 *  3. 结构化解码：按块的轨道分组，每组用匈牙利算法做带约束的分配——
 *     角块：8 个位置 × 8 块 × 3 个朝向（颜色三元组的顺时针顺序只由配色决定，与整体朝向无关）；
 *     棱块 / 翼棱：位置 × 有效颜色对（非对面、非同色；中棱每对 1 次，每个翼棱轨道每对 2 次）；
 *     中心块：每个轨道每色恰好 轨道大小/6 块（奇数阶固定中心每色 1 块）。
 *  4. 用解码结果重新估计 6 个颜色中心，再解码一次（EM）。
 * 输出与 classify 相同：{stickerIndex: colorKey}。
 */
(function (root) {
  'use strict';
  var X = root.NxNModel || (typeof require !== 'undefined' ? require('../../puzzles/nxn/nxn-model.js') : null);
  var KEYS = ['W', 'Y', 'G', 'B', 'R', 'O'];
  var TYPICAL = { W: [225, 228, 230], Y: [225, 215, 40], G: [20, 160, 80], B: [20, 70, 175], R: [190, 25, 40], O: [245, 110, 25] };
  var OPP = { W: 'Y', Y: 'W', G: 'B', B: 'G', R: 'O', O: 'R' };
  function srgb2lin(c) { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
  function rgb2lab(rgb) {
    var r = srgb2lin(rgb[0]), g = srgb2lin(rgb[1]), b = srgb2lin(rgb[2]);
    var x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047, y = r * 0.2126 + g * 0.7152 + b * 0.0722, z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;
    var f = function (t) { return t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116; };
    return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
  }
  var LW = 0.5;   // 亮度权重：同一颜色在不同面上的亮度差别远大于色度差别
  function feat(rgb) { var l = rgb2lab(rgb); return [l[0] * LW, l[1], l[2]]; }
  function d2(a, b) { var x = a[0] - b[0], y = a[1] - b[1], z = a[2] - b[2]; return x * x + y * y + z * z; }

  /** 匈牙利算法（最小费用，n×n 方阵）→ assignment[row] = col */
  function hungarian(C) {
    var n = C.length, INF = 1e18, u = new Float64Array(n + 1), v = new Float64Array(n + 1), p = new Int32Array(n + 1), way = new Int32Array(n + 1);
    for (var i = 1; i <= n; i++) {
      p[0] = i; var j0 = 0, minv = new Float64Array(n + 1).fill(INF), used = new Uint8Array(n + 1);
      do {
        used[j0] = 1; var i0 = p[j0], delta = INF, j1 = 0;
        for (var j = 1; j <= n; j++) if (!used[j]) {
          var cur = C[i0 - 1][j - 1] - u[i0] - v[j];
          if (cur < minv[j]) { minv[j] = cur; way[j] = j0; }
          if (minv[j] < delta) { delta = minv[j]; j1 = j; }
        }
        for (j = 0; j <= n; j++) if (used[j]) { u[p[j]] += delta; v[j] -= delta; } else minv[j] -= delta;
        j0 = j1;
      } while (p[j0] !== 0);
      do { var jj = way[j0]; p[j0] = p[jj]; j0 = jj; } while (j0);
    }
    var a = new Array(n); for (j = 1; j <= n; j++) a[p[j] - 1] = j - 1; return a;
  }
  /** 等容量分配：每类最多 cap 个（拉格朗日价格 + 最后贪心补齐） */
  function balancedAssign(F, cents, cap) {
    var N = F.length, K = cents.length, price = new Float64Array(K), lab = new Int32Array(N), D = F.map(function (f) { return cents.map(function (c) { return d2(f, c); }); });
    var scale = 0; D.forEach(function (r) { r.forEach(function (x) { scale += x; }); }); scale /= N * K;
    for (var it = 0; it < 300; it++) {
      var cnt = new Int32Array(K);
      for (var i = 0; i < N; i++) { var best = 0, bv = Infinity; for (var k = 0; k < K; k++) { var c = D[i][k] + price[k]; if (c < bv) { bv = c; best = k; } } lab[i] = best; cnt[best]++; }
      var over = false; for (k = 0; k < K; k++) if (cnt[k] > cap) { price[k] += scale * 0.02 * (cnt[k] - cap) / cap + scale * 0.002; over = true; }
      if (!over) break;
    }
    // 仍超出时：按代价差贪心把多出来的挪走
    var cnt2 = new Int32Array(K); for (i = 0; i < N; i++) cnt2[lab[i]]++;
    for (k = 0; k < K; k++) while (cnt2[k] > cap) {
      var bi = -1, bk = -1, bd = Infinity;
      for (i = 0; i < N; i++) if (lab[i] === k) for (var k2 = 0; k2 < K; k2++) if (cnt2[k2] < cap) { var dd = D[i][k2] - D[i][k]; if (dd < bd) { bd = dd; bi = i; bk = k2; } }
      lab[bi] = bk; cnt2[k]--; cnt2[bk]++;
    }
    return lab;
  }
  function perms(a) { if (a.length <= 1) return [a]; var out = []; a.forEach(function (x, i) { perms(a.slice(0, i).concat(a.slice(i + 1))).forEach(function (p) { out.push([x].concat(p)); }); }); return out; }
  var P6 = null;

  /** 各轨道的结构 */
  var structCache = {};
  function structure(n) {
    if (structCache[n]) return structCache[n];
    var PC = X.pieces(n), S = X.solvedState(n, X.DEFAULT_SCHEME), groups = [];
    // 角块：有效有向三元组
    var cornerTriples = PC.corners.map(function (ids) { return ids.map(function (i) { return S[i]; }); });
    groups.push({ kind: 'corner', slots: PC.corners, pieces: cornerTriples });
    var pairs = [];
    X.pieces(3).mid.forEach(function (e) { var S3 = X.solvedState(3, X.DEFAULT_SCHEME); pairs.push([S3[e[0]], S3[e[1]]]); });
    if (PC.mid) groups.push({ kind: 'edge', slots: PC.mid, pieces: pairs, mult: 1 });
    PC.wings.forEach(function (w) { groups.push({ kind: 'edge', slots: w.slots.map(function (s) { return s.st; }), pieces: pairs, mult: 2 }); });
    PC.centers.forEach(function (orb) { groups.push({ kind: 'center', slots: orb.map(function (i) { return [i]; }), per: orb.length / 6 }); });
    return (structCache[n] = groups);
  }
  /** 结构化解码：cost(i, key) = 贴纸 i 归为颜色 key 的代价 */
  function decode(n, cost) {
    var out = {};
    structure(n).forEach(function (g) {
      var m = g.slots.length, C = [], opts = [], pp, row, orow, a, cols, o, s, t, p, r;
      if (g.kind === 'corner') {
        for (var s = 0; s < m; s++) { var row = [], orow = []; for (var p = 0; p < 8; p++) { var best = Infinity, br = 0; for (var r = 0; r < 3; r++) { var c = 0; for (var t = 0; t < 3; t++) c += cost(g.slots[s][t], g.pieces[p][(t + r) % 3]); if (c < best) { best = c; br = r; } } row.push(best); orow.push(br); } C.push(row); opts.push(orow); }
        var a = hungarian(C);
        for (s = 0; s < m; s++) { var pc = g.pieces[a[s]], rr = opts[s][a[s]]; for (t = 0; t < 3; t++) out[g.slots[s][t]] = pc[(t + rr) % 3]; }
      } else if (g.kind === 'edge') {
        var cols = []; g.pieces.forEach(function (pp, k) { for (var q = 0; q < g.mult; q++) cols.push(k); });
        for (s = 0; s < m; s++) { row = []; orow = []; cols.forEach(function (k) { var pp = g.pieces[k], c0 = cost(g.slots[s][0], pp[0]) + cost(g.slots[s][1], pp[1]), c1 = cost(g.slots[s][0], pp[1]) + cost(g.slots[s][1], pp[0]); row.push(Math.min(c0, c1)); orow.push(c0 <= c1 ? 0 : 1); }); C.push(row); opts.push(orow); }
        a = hungarian(C);
        for (s = 0; s < m; s++) { pp = g.pieces[cols[a[s]]]; var o = opts[s][a[s]]; out[g.slots[s][0]] = pp[o]; out[g.slots[s][1]] = pp[1 - o]; }
      } else {
        cols = []; KEYS.forEach(function (k) { for (var q = 0; q < g.per; q++) cols.push(k); });
        for (s = 0; s < m; s++) C.push(cols.map(function (k) { return cost(g.slots[s][0], k); }));
        a = hungarian(C);
        for (s = 0; s < m; s++) out[g.slots[s][0]] = cols[a[s]];
      }
    });
    return out;
  }
  /**
   * samples: {stickerIndex: [r,g,b]}（需要全部 6n² 块）；返回 {stickerIndex: colorKey}
   * opts.structured=false 只做等容量聚类（不做块约束）；opts.fixed = {stickerIndex: colorKey} 已知颜色（奇数阶固定中心）
   */
  function classifyCube(n, samples, opts) {
    opts = opts || {};
    var N = 6 * n * n, ids = [], F = [];
    for (var i = 0; i < N; i++) { if (!samples[i]) return null; ids.push(i); F.push(feat(samples[i])); }
    var TY = opts.typical || TYPICAL;   // 配色方案：逻辑键 → 典型物理色
    var cents = KEYS.map(function (k) { return feat(TY[k]); }), cap = n * n, lab;
    for (var it = 0; it < 12; it++) {
      lab = balancedAssign(F, cents, cap);
      var sum = cents.map(function () { return [0, 0, 0, 0]; });
      for (i = 0; i < N; i++) { var s = sum[lab[i]]; s[0] += F[i][0]; s[1] += F[i][1]; s[2] += F[i][2]; s[3]++; }
      var moved = 0; cents = cents.map(function (c, k) { var s2 = sum[k]; if (!s2[3]) return c; var nc = [s2[0] / s2[3], s2[1] / s2[3], s2[2] / s2[3]]; moved += d2(c, nc); return nc; });
      if (moved < 1e-3) break;
    }
    // 类 → 颜色名：6! 穷举
    P6 = P6 || perms([0, 1, 2, 3, 4, 5]);
    var ty = KEYS.map(function (k) { return feat(TY[k]); }), bestP = null, bestC = Infinity;
    var fixed = opts.fixed || null, fx = fixed ? Object.keys(fixed) : [];
    P6.forEach(function (p) {
      var c = 0; for (var k = 0; k < 6; k++) c += d2(cents[k], ty[p[k]]);
      // 奇数阶：固定中心块的已知颜色决定「类 → 颜色名」（比典型色更可靠，尤其是红 / 橙、白 / 黄）
      for (var q = 0; q < fx.length; q++) if (KEYS[p[lab[+fx[q]]]] !== fixed[fx[q]]) c += 1e7;
      if (c < bestC) { bestC = c; bestP = p; }
    });
    var keyOf = bestP.map(function (j) { return KEYS[j]; }), centOf = {};
    keyOf.forEach(function (key, k) { centOf[key] = cents[k]; });
    var res = {};
    if (opts.structured === false) { for (i = 0; i < N; i++) res[i] = keyOf[lab[i]]; return res; }
    // 结构化解码 + 一轮 EM
    for (var em = 0; em < 2; em++) {
      var cost = function (i, key) { if (fixed && fixed[i]) return fixed[i] === key ? 0 : 1e6; return Math.sqrt(d2(F[i], centOf[key])); };
      res = decode(n, cost);
      var acc = {}; KEYS.forEach(function (k) { acc[k] = [0, 0, 0, 0]; });
      for (i = 0; i < N; i++) { var a = acc[res[i]]; a[0] += F[i][0]; a[1] += F[i][1]; a[2] += F[i][2]; a[3]++; }
      KEYS.forEach(function (k) { var a2 = acc[k]; if (a2[3]) centOf[k] = [a2[0] / a2[3], a2[1] / a2[3], a2[2] / a2[3]]; });
    }
    return res;
  }
  var api = { TYPICAL: TYPICAL, classifyCube: classifyCube, hungarian: hungarian, rgb2lab: rgb2lab };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root.CubeLab) root.CubeLab.colorCluster = api; else root.CubeLabColorCluster = api;
})(typeof self !== 'undefined' ? self : this);
