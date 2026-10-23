/*
 * N×N×N 魔方数据模型（N = 2…15+）：贴纸几何、转动置换、记号解析、校验、打乱。
 * 无依赖，浏览器 / Web Worker / Node 通用。贴纸顺序与 Kociemba 展开串一致：
 * 面序 U R F D L B，每面按展开图逐行（U 面上方为 B，D 面上方为 F，其余上方为 U）。
 * 坐标内部用「两倍整数」表示（偶数阶的块中心是半整数），转动完全精确。
 */
(function (root) {
  'use strict';
  var FACES = 'URFDLB';
  var FACE_NORMAL = { U: [0, 1, 0], R: [1, 0, 0], F: [0, 0, 1], D: [0, -1, 0], L: [-1, 0, 0], B: [0, 0, -1] };
  var AXIS_OF = { R: 0, L: 0, U: 1, D: 1, F: 2, B: 2 };
  var POS_FACE = ['R', 'U', 'F'], NEG_FACE = ['L', 'D', 'B'], SLICE_OF = ['M', 'E', 'S'];
  var SLICE_REF = { M: 'L', E: 'D', S: 'F' }, ROT_REF = { x: 'R', y: 'U', z: 'F' };
  var COLORS = {
    W: { name: '白', hex: '#fbfbf8' }, Y: { name: '黄', hex: '#f3b33e' }, G: { name: '绿', hex: '#306e49' },
    B: { name: '蓝', hex: '#19408e' }, R: { name: '红', hex: '#dd3429' }, O: { name: '橙', hex: '#ec8331' }
  };
  var DEFAULT_SCHEME = { U: 'W', R: 'R', F: 'G', D: 'Y', L: 'O', B: 'B' };
  // 3×3 的角块 / 棱块贴纸（与 puzzles/cube3/model.js 相同的约定：角块先 U/D 贴纸再顺时针；棱块方向按 Kociemba）
  var CORNER_F3 = [[8, 9, 20], [6, 18, 38], [0, 36, 47], [2, 45, 11], [29, 26, 15], [27, 44, 24], [33, 53, 42], [35, 17, 51]];
  var CORNER_C = ['URF', 'UFL', 'ULB', 'UBR', 'DFR', 'DLF', 'DBL', 'DRB'];
  var EDGE_F3 = [[5, 10], [7, 19], [3, 37], [1, 46], [32, 16], [28, 25], [30, 43], [34, 52], [23, 12], [21, 41], [50, 39], [48, 14]];
  var EDGE_C = ['UR', 'UF', 'UL', 'UB', 'DR', 'DF', 'DL', 'DB', 'FR', 'FL', 'BL', 'BR'];

  function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
  // 绕 n 顺时针（从 n 方向看）转 90°：v' = -(n×v) + n(n·v)
  function rotCW(n, v) { var c = cross(n, v), d = dot(n, v); return [-c[0] + n[0] * d, -c[1] + n[1] * d, -c[2] + n[2] * d]; }

  /** 贴纸 i 的两倍坐标位置 p2 与外法线 n（x 右, y 上, z 前） */
  function geom2(n, i) {
    var nn = n * n, f = FACES[(i / nn) | 0], k = i % nn, r = (k / n) | 0, c = k % n, H = n - 1, C = 2 * c - H, R = 2 * r - H;
    switch (f) {
      case 'U': return { f: f, p: [C, H, R], n: [0, 1, 0] };
      case 'R': return { f: f, p: [H, -R, -C], n: [1, 0, 0] };
      case 'F': return { f: f, p: [C, -R, H], n: [0, 0, 1] };
      case 'D': return { f: f, p: [C, -H, -R], n: [0, -1, 0] };
      case 'L': return { f: f, p: [-H, -R, C], n: [-1, 0, 0] };
      case 'B': return { f: f, p: [-C, -R, -H], n: [0, 0, -1] };
    }
  }
  function keyOf(p, nrm) { return p.join(',') + '|' + nrm.join(','); }

  var cache = {};
  /** 构建 n 阶模型（缓存） */
  function build(n) {
    if (cache[n]) return cache[n];
    var N = 6 * n * n, H = n - 1, G = [], KEY = {}, i;
    for (i = 0; i < N; i++) { G.push(geom2(n, i)); KEY[keyOf(G[i].p, G[i].n)] = i; }
    var M = { n: n, size: N, geom: G, key: KEY, H: H, moves: {}, order: [], baseOfLayer: {} };

    // 单层顺时针 1/4 转动（面 F、深度 d = 1…n）：只写入转动的贴纸（稀疏），未列出的保持不动
    function layerQuarter(face, d) {
      var nf = FACE_NORMAL[face], L = H - 2 * (d - 1), src = [], dst = [];
      for (var j = 0; j < N; j++) {
        if (dot(G[j].p, nf) !== L) continue;
        var k = KEY[keyOf(rotCW(nf, G[j].p), rotCW(nf, G[j].n))];
        if (k === undefined) throw new Error('nxn perm ' + face + d);
        src.push(j); dst.push(k);
      }
      return { src: src, dst: dst };
    }
    var LQ = {};
    function lq(face, d) { var k = face + d; return LQ[k] || (LQ[k] = layerQuarter(face, d)); }
    function permFor(face, depths, times) {
      var perm = new Array(N); for (var j = 0; j < N; j++) perm[j] = j;
      depths.forEach(function (d) {
        var q = lq(face, d);
        for (var a = 0; a < q.src.length; a++) {
          var s = q.src[a], t = q.dst[a];
          // 走 times 次 1/4 转动
          for (var r = 1; r < times; r++) { var b = q.src.indexOf(t); t = q.dst[b]; }
          perm[s] = t;
        }
      });
      return perm;
    }
    // 基础转动（每一物理层一个）：靠近哪个面就用哪个面命名；奇数阶中层用 M/E/S
    function baseToken(axis, L) {
      if (L > 0) { var d = (H - L) / 2 + 1; return (d === 1 ? '' : d) + POS_FACE[axis]; }
      if (L < 0) { var d2 = (H + L) / 2 + 1; return (d2 === 1 ? '' : d2) + NEG_FACE[axis]; }
      return SLICE_OF[axis];
    }
    var SUF = [['', 1, -1], ["'", 3, 1], ['2', 2, -2]];
    function inv(tok) { var s = tok.slice(-1); return s === "'" ? tok.slice(0, -1) : s === '2' ? tok : tok + "'"; }
    function add(stem, face, depths, kind) {
      var nf = FACE_NORMAL[face], ax = AXIS_OF[face];
      var Ls = depths.map(function (d) { return H - 2 * (d - 1); });   // 沿该面法线的两倍层坐标
      var bases = Ls.map(function (L) { var sg = dot(nf, [1, 1, 1]) > 0 ? 1 : -1; return baseToken(ax, L * sg); });
      SUF.forEach(function (sf) {
        var tok = stem + sf[0], Lset = {};
        Ls.forEach(function (L) { Lset[L / 2] = 1; });
        M.moves[tok] = {
          tok: tok, face: face, depths: depths, kind: kind, perm: permFor(face, depths, sf[1]), axis: nf.slice(), angle: sf[2] * Math.PI / 2,
          inverse: inv(tok), bases: bases, base: bases.length === 1 ? bases[0] : null,
          slice: kind === 'inner' || kind === 'mid', wide: kind === 'wide', rotation: kind === 'rot',
          layerSet: Lset
        };
        M.order.push(tok);
      });
    }
    FACES.split('').forEach(function (f) {
      for (var d = 1; d < n; d++) add((d === 1 ? '' : d) + f, f, [d], d === 1 ? 'outer' : 'inner');
    });
    FACES.split('').forEach(function (f) {
      for (var w = 2; w < n; w++) { var ds = []; for (var d = 1; d <= w; d++) ds.push(d); add((w === 2 ? '' : w) + f + 'w', f, ds, 'wide'); }
    });
    if (n % 2 === 1 && n >= 3) Object.keys(SLICE_REF).forEach(function (s) { add(s, SLICE_REF[s], [(n + 1) / 2], 'mid'); });
    Object.keys(ROT_REF).forEach(function (r) { var ds = []; for (var d = 1; d <= n; d++) ds.push(d); add(r, ROT_REF[r], ds, 'rot'); });
    // 基础转动表：每个轴、每一层 → 基础记号（四分之一顺时针）
    M.trackMoves = [];
    [0, 1, 2].forEach(function (ax) {
      for (var L = H; L >= -H; L -= 2) { var t = baseToken(ax, L); M.baseOfLayer[ax + ':' + L] = t; M.trackMoves.push(t); }
    });
    cache[n] = M;
    return M;
  }

  /** 记号规范化：r → Rw，2Rw → Rw，1R → R，R2' → R2；返回规范记号或 null */
  function normalize(n, t) {
    t = String(t).replace(/[’`´′]/g, "'");
    var m = /^(\d*)([URFDLBurfdlb])(w?)(2'|'2|2|'|)$/.exec(t);
    if (m) {
      var k = m[1] ? +m[1] : 0, f = m[2], w = !!m[3], suf = m[4] === "2'" || m[4] === "'2" ? '2' : m[4];
      if (f === f.toLowerCase()) { f = f.toUpperCase(); w = true; }
      if (w) { if (!k) k = 2; if (k === 1) return f + suf; if (k >= n) return null; return (k === 2 ? '' : k) + f + 'w' + suf; }
      if (!k) k = 1; if (k >= n) return null;
      return (k === 1 ? '' : k) + f + suf;
    }
    m = /^([MESxyz])(2'|'2|2|'|)$/.exec(t);
    if (m) { if ('MES'.indexOf(m[1]) >= 0 && n % 2 === 0) return null; return m[1] + (m[2] === "2'" || m[2] === "'2" ? '2' : m[2]); }
    return null;
  }

  function applyPerm(state, perm) { var ns = state.slice(); for (var i = 0; i < perm.length; i++) ns[perm[i]] = state[i]; return ns; }
  function solvedState(n, scheme) {
    scheme = scheme || DEFAULT_SCHEME; var s = [];
    FACES.split('').forEach(function (f) { for (var k = 0; k < n * n; k++) s.push(scheme[f]); });
    return s;
  }
  function isSolved(n, state) {
    var nn = n * n;
    for (var f = 0; f < 6; f++) for (var k = 1; k < nn; k++) if (state[f * nn + k] !== state[f * nn]) return false;
    return true;
  }
  /** 随机打乱（WCA 风格：外层 + 宽层随机转动） */
  function randomScramble(n, rnd, len) {
    rnd = rnd || Math.random;
    if (n === 2) { len = len || 25; var out2 = [], prev2 = null; while (out2.length < len) { var f2 = 'URF'[(rnd() * 3) | 0]; if (f2 === prev2) continue; out2.push(f2 + ['', "'", '2'][(rnd() * 3) | 0]); prev2 = f2; } return out2; }
    len = len || ({ 3: 22, 4: 40, 5: 60, 6: 80, 7: 100 }[n] || 20 * n);
    var maxW = Math.floor(n / 2), out = [], last = [], lastAxis = -1;
    while (out.length < len) {
      var f = FACES[(rnd() * 6) | 0], w = 1 + ((rnd() * maxW) | 0), ax = AXIS_OF[f], key = f + w;
      if (ax === lastAxis && last.indexOf(key) >= 0) continue;
      if (ax !== lastAxis) { last = []; lastAxis = ax; }
      last.push(key);
      out.push((w === 1 ? f : (w === 2 ? '' : w) + f + 'w') + ['', "'", '2'][(rnd() * 3) | 0]);
    }
    return out;
  }

  // ---------------------------------------------------------------- 块（校验用）
  /** 由 3×3 贴纸序号得到 n 阶对应贴纸（along：沿棱方向的两倍坐标，角块忽略） */
  function from3(n, i3, along) {
    var g = geom2(3, i3), H = n - 1, p = g.p.map(function (v) { return v === 0 ? along : v / 2 * H; });
    return build(n).key[keyOf(p, g.n)];
  }
  var pieceCache = {};
  function pieces(n) {
    if (pieceCache[n]) return pieceCache[n];
    var H = n - 1, PC = { corners: CORNER_F3.map(function (c) { return c.map(function (i) { return from3(n, i, 0); }); }), mid: null, wings: [], centers: [] };
    if (n % 2 === 1 && n >= 3) PC.mid = EDGE_F3.map(function (e) { return e.map(function (i) { return from3(n, i, 0); }); });
    for (var t = 2 - (n % 2 === 1 ? 0 : 1); t <= H - 2; t += 2) {   // 翼棱轨道：沿棱两倍坐标 ±t
      if (t === 0) continue;
      var slots = [];
      EDGE_F3.forEach(function (e, ei) { [t, -t].forEach(function (s) { slots.push({ edge: ei, st: e.map(function (i) { return from3(n, i, s); }) }); }); });
      PC.wings.push({ t: t, slots: slots });
    }
    // 中心块轨道：只含单贴纸块，按所有单层 1/4 转动求连通分量
    var M = build(n), parent = {}, isCenter = {};
    M.geom.forEach(function (g, i) { var nz = g.p.filter(function (v) { return Math.abs(v) === H; }).length; if (nz === 1 && n > 2) { isCenter[i] = 1; parent[i] = i; } });
    function find(x) { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; }
    M.order.forEach(function (t) {
      var m = M.moves[t]; if (m.kind !== 'outer' && m.kind !== 'inner' || t.slice(-1) === "'" || t.slice(-1) === '2') return;
      for (var i in isCenter) { var j = m.perm[i]; var a = find(+i), b = find(j); if (a !== b) parent[a] = b; }
    });
    var groups = {};
    Object.keys(isCenter).forEach(function (i) { var r = find(+i); (groups[r] = groups[r] || []).push(+i); });
    PC.centers = Object.keys(groups).map(function (k) { return groups[k]; });
    pieceCache[n] = PC;
    return PC;
  }
  /** 翼棱：学习每个槽位允许的（块, 方向）——翼棱有手性，不能原地翻转 */
  var wingCache = {};
  function wingTable(n, wi) {
    var key = n + ':' + wi; if (wingCache[key]) return wingCache[key];
    var M = build(n), orbit = pieces(n).wings[wi], S = orbit.slots, ns = S.length;
    var where = new Array(M.size); for (var i = 0; i < M.size; i++) where[i] = i;
    var home = {}; S.forEach(function (s, k) { home[s.st[0]] = [k, 0]; home[s.st[1]] = [k, 1]; });
    var allowed = S.map(function () { return {}; }), filled = 0, gens = M.order.filter(function (t) { var m = M.moves[t]; return (m.kind === 'outer' || m.kind === 'inner') && t.slice(-1) !== "'" && t.slice(-1) !== '2'; });
    var seed = 12345; function rnd() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x80000000; }
    for (var it = 0; it < 200000 && filled < ns * ns; it++) {
      var perm = M.moves[gens[(rnd() * gens.length) | 0]].perm, nw = where.slice();
      for (var j = 0; j < perm.length; j++) nw[perm[j]] = where[j];
      where = nw;
      S.forEach(function (s, k) {
        var h = home[where[s.st[0]]];
        if (allowed[k][h[0]] === undefined) { allowed[k][h[0]] = h[1]; filled++; }
      });
    }
    wingCache[key] = allowed;
    return allowed;
  }

  // ---------------------------------------------------------------- 校验
  function permParity(p) {
    var seen = [], par = 0;
    for (var i = 0; i < p.length; i++) { if (seen[i]) continue; var len = 0, j = i; while (!seen[j]) { seen[j] = 1; j = p[j]; len++; } par += len - 1; }
    return par % 2;
  }
  var PERMS6 = null;
  function perms6() {
    if (PERMS6) return PERMS6;
    PERMS6 = [];
    (function rec(pre, rest) { if (!rest.length) { PERMS6.push(pre); return; } rest.forEach(function (x, k) { rec(pre.concat([x]), rest.slice(0, k).concat(rest.slice(k + 1))); }); })([], FACES.split(''));
    return PERMS6;
  }
  function cornerId(fl) {
    var ori = fl.findIndex(function (x) { return x === 'U' || x === 'D'; });
    if (ori < 0) return null;
    var c0 = fl[ori], c1 = fl[(ori + 1) % 3], c2 = fl[(ori + 2) % 3];
    var j = CORNER_C.findIndex(function (s) { return s[0] === c0 && s[1] === c1 && s[2] === c2; });
    return j < 0 ? null : { j: j, ori: ori };
  }
  /**
   * 校验：返回 { ok, issues:[{k,p}], errors:[], marks:[贴纸], facelets（URFDLB 字母串）, map（颜色→面）}
   * opts.prefer：偶数阶选择朝向的方式——'dbl'（DBL 角块归位，二阶最优解用）或 'centers'（中心块对位最多）
   */
  function validate(n, state, opts) {
    opts = opts || {};
    var nn = n * n, N = 6 * nn, issues = [], errors = [], marks = [], i;
    function I(k, p, ids) { issues.push({ k: k, p: p || {} }); errors.push(k); if (ids) marks.push.apply(marks, ids); }
    function fail() { return { ok: false, issues: issues, errors: errors, marks: marks }; }
    var nb = 0; for (i = 0; i < N; i++) if (!state[i]) nb++;
    if (nb) { I('v.unpainted', { n: nb }); return fail(); }
    var counts = {}; state.forEach(function (c) { counts[c] = (counts[c] || 0) + 1; });
    var colors = Object.keys(counts);
    if (colors.length !== 6 || colors.some(function (c) { return counts[c] !== nn; })) {
      colors.forEach(function (c) { if (counts[c] > nn) I('v.countMoreN', { color: c, n: counts[c], d: counts[c] - nn, per: nn }); else if (counts[c] < nn) I('v.countLessN', { color: c, n: counts[c], d: nn - counts[c], per: nn }); });
      Object.keys(COLORS).forEach(function (c) { if (!counts[c] && colors.length < 6) I('v.missing', { color: c }); });
      if (!issues.length) I('v.hint');
      return fail();
    }
    var PC = pieces(n), odd = n % 2 === 1, map = null;
    if (odd) {
      var mid = (nn - 1) / 2, seen = {};
      map = {};
      for (i = 0; i < 6; i++) {
        var cc = state[i * nn + mid];
        if (seen[cc]) { I('v.dupCenter', { color: cc }, [i * nn + mid]); return fail(); }
        seen[cc] = 1; map[cc] = FACES[i];
      }
    } else {
      // 偶数阶没有固定中心：枚举颜色→面的双射，要求 8 个角块都合法且互不重复
      var best = null, bestScore = -1;
      perms6().forEach(function (pf) {
        var mp = {}; colors.forEach(function (c, k) { mp[c] = pf[k]; });
        var used = {}, tw = 0;
        for (var c = 0; c < 8; c++) {
          var id = cornerId(PC.corners[c].map(function (x) { return mp[state[x]]; }));
          if (!id || used[id.j]) return; used[id.j] = 1; tw += id.ori;
        }
        var score;
        if (opts.prefer === 'dbl') { var d = cornerId(PC.corners[6].map(function (x) { return mp[state[x]]; })); score = d.j === 6 && d.ori === 0 ? 1 : 0; }
        else { score = 0; PC.centers.forEach(function (o) { o.forEach(function (x) { if (mp[state[x]] === FACES[(x / nn) | 0]) score++; }); }); }
        // 平局时偏向默认配色（白上绿前）
        if (Object.keys(DEFAULT_SCHEME).every(function (f) { return mp[DEFAULT_SCHEME[f]] === f; })) score += 0.5;
        if (score > bestScore) { bestScore = score; best = mp; }
      });
      map = best;
      if (!map) {   // 找不到合法的角块组合：用默认配色报告具体哪个角块有问题
        map = {}; Object.keys(DEFAULT_SCHEME).forEach(function (f) { map[DEFAULT_SCHEME[f]] = f; });
      }
    }
    var f = state.map(function (c) { return map[c]; });
    if (f.some(function (x) { return !x; })) { I('v.hint'); return fail(); }
    // 角块
    var cp = [], twist = 0, usedC = {};
    PC.corners.forEach(function (ids, k) {
      var id = cornerId(ids.map(function (x) { return f[x]; }));
      if (!id) { I('v.cornerBad', { pos: CORNER_C[k], colors: ids.map(function (x) { return state[x]; }) }, ids); return; }
      if (usedC[id.j] !== undefined) I('v.cornerDup', { colors: ids.map(function (x) { return state[x]; }) }, ids);
      usedC[id.j] = k; cp.push(id.j); twist += id.ori;
    });
    // 中棱（奇数阶）
    var ep = [], flip = 0, usedE = {};
    if (PC.mid) PC.mid.forEach(function (ids, k) {
      var a = f[ids[0]], b = f[ids[1]], e = -1, o = 0;
      for (var q = 0; q < 12; q++) { if (EDGE_C[q][0] === a && EDGE_C[q][1] === b) { e = q; o = 0; break; } if (EDGE_C[q][0] === b && EDGE_C[q][1] === a) { e = q; o = 1; break; } }
      if (e < 0) { I('v.edgeBad', { pos: EDGE_C[k], colors: ids.map(function (x) { return state[x]; }) }, ids); return; }
      if (usedE[e] !== undefined) I('v.edgeDup', { colors: ids.map(function (x) { return state[x]; }) }, ids);
      usedE[e] = k; ep.push(e); flip += o;
    });
    // 翼棱：每个轨道 24 块各出现一次，且方向（手性）合法
    PC.wings.forEach(function (orb, wi) {
      var allowed = wingTable(n, wi), used = {};
      var homeFaces = orb.slots.map(function (s) { return s.st.map(function (x) { return FACES[(x / nn) | 0]; }); });
      orb.slots.forEach(function (s, k) {
        var a = f[s.st[0]], b = f[s.st[1]], hit = -1;
        for (var P in allowed[k]) {
          var h = homeFaces[P], o = allowed[k][P];
          if ((o === 0 && h[0] === a && h[1] === b) || (o === 1 && h[1] === a && h[0] === b)) { hit = +P; break; }
        }
        var cols = s.st.map(function (x) { return state[x]; });
        if (hit < 0) {
          var exists = EDGE_C.some(function (e) { return (e[0] === a && e[1] === b) || (e[0] === b && e[1] === a); });
          I(exists ? 'v.wingFlip' : 'v.wingBad', { pos: EDGE_C[s.edge], colors: cols }, s.st); return;
        }
        if (used[hit] !== undefined) I('v.wingDup', { colors: cols }, s.st);
        used[hit] = k;
      });
    });
    // 中心块：每个轨道里每种颜色的数量相同
    PC.centers.forEach(function (orb) {
      if (orb.length < 6) return;
      var per = orb.length / 6, cnt = {};
      orb.forEach(function (x) { cnt[f[x]] = (cnt[f[x]] || 0) + 1; });
      FACES.split('').forEach(function (F) {
        var c = Object.keys(map).filter(function (k) { return map[k] === F; })[0];
        if ((cnt[F] || 0) !== per) I('v.centerOrbit', { color: c, n: cnt[F] || 0, per: per }, orb.filter(function (x) { return f[x] === F; }));
      });
    });
    if (issues.length) { I('v.hint'); return fail(); }
    if (twist % 3 !== 0) I('v.twist', {}, []);
    if (PC.mid) {
      if (flip % 2 !== 0) I('v.flip');
      if (permParity(cp) !== permParity(ep)) I('v.parity');
    }
    if (issues.length) return fail();
    return { ok: true, issues: [], errors: [], marks: [], facelets: f.join(''), map: map };
  }

  var api = {
    FACES: FACES, FACE_NORMAL: FACE_NORMAL, AXIS_OF: AXIS_OF, COLORS: COLORS, DEFAULT_SCHEME: DEFAULT_SCHEME,
    CORNER_C: CORNER_C, EDGE_C: EDGE_C,
    build: build, normalize: normalize, applyPerm: applyPerm, solvedState: solvedState, isSolved: isSolved,
    randomScramble: randomScramble, validate: validate, pieces: pieces, wingTable: wingTable, geom2: geom2, permParity: permParity
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.NxNModel = api;
})(typeof self !== 'undefined' ? self : this);
