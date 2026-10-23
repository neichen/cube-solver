/*
 * 五魔方（Megaminx）模型：几何、贴纸、块、转动置换、校验、随机状态、块级编码。
 * 浏览器（window.MegaminxModel）、Worker（importScripts）与 Node（require）共用。纯自写代码，MIT。
 *
 * 坐标：正十二面体内切球半径 1，U 面法线 +y，F 面朝 +z（相机方向），R 在 F 右侧（+x）。
 * 面名与配色沿用 WCA / TNoodle 常用约定：上半 U L F R BR BL，下半 DR B DL FL FR D（DR = DBR，DL = DBL）。
 * 每面 11 张贴纸：f*11 + 0 = 中心，+1+2k = 与第 k 个邻面相接的棱，+2+2k = 第 k 与第 k+1 个邻面之间的角
 * （邻面按自外向内看逆时针排列）。
 * 转动记号：X / X' / X2 / X2'（72° / −72° / 144° / −144°，顺时针为正），以及 WCA 打乱用的 Pochmann 记号
 * R++ R-- D++ D--（除 L 层 / U 层外整体转 144°）与 U U'。
 */
(function (root) {
  'use strict';
  var FACES = ['U', 'L', 'F', 'R', 'BR', 'BL', 'DR', 'B', 'DL', 'FL', 'FR', 'D'];
  var COLORS = {
    W: { hex: '#f4f4f0', key: 'color.white' }, P: { hex: '#7b3fa8', key: 'color.purple' }, G: { hex: '#1f8a47', key: 'color.green' },
    R: { hex: '#d42a2a', key: 'color.red' }, B: { hex: '#1e4fbf', key: 'color.blue' }, Y: { hex: '#f2d21b', key: 'color.yellow' },
    K: { hex: '#f07fb0', key: 'color.pink' }, A: { hex: '#9bd34a', key: 'color.lightGreen' }, O: { hex: '#f08a1c', key: 'color.orange' },
    C: { hex: '#5cb8e8', key: 'color.lightBlue' }, E: { hex: '#f1e3b0', key: 'color.cream' }, S: { hex: '#8d8d8d', key: 'color.gray' }
  };
  var SCHEME = ['W', 'P', 'G', 'R', 'B', 'Y', 'K', 'A', 'O', 'C', 'E', 'S'];

  // ---------------------------------------------------------------- 向量
  function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
  function add(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
  function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
  function mul(a, k) { return [a[0] * k, a[1] * k, a[2] * k]; }
  function len(a) { return Math.sqrt(dot(a, a)); }
  function norm(a) { var l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }
  function rot(v, ax, th) {   // Rodrigues，右手定则
    var k = norm(ax), c = Math.cos(th), s = Math.sin(th), kv = cross(k, v), kd = dot(k, v);
    return [v[0] * c + kv[0] * s + k[0] * kd * (1 - c), v[1] * c + kv[1] * s + k[1] * kd * (1 - c), v[2] * c + kv[2] * s + k[2] * kd * (1 - c)];
  }
  function det3(A) { return A[0][0] * (A[1][1] * A[2][2] - A[1][2] * A[2][1]) - A[0][1] * (A[1][0] * A[2][2] - A[1][2] * A[2][0]) + A[0][2] * (A[1][0] * A[2][1] - A[1][1] * A[2][0]); }
  function solve3(ns, cs) {   // 三平面 n·x = c 的交点
    var D = det3(ns), out = [];
    for (var q = 0; q < 3; q++) { var M = ns.map(function (r, i) { var rr = r.slice(); rr[q] = cs[i]; return rr; }); out.push(det3(M) / D); }
    return out;
  }
  var vec = { dot: dot, cross: cross, add: add, sub: sub, mul: mul, len: len, norm: norm, rot: rot };

  // ---------------------------------------------------------------- 几何
  var ALPHA = Math.atan(2), TAU = Math.PI * 2, D72 = TAU / 5;
  function dirOf(polar, az) { return [Math.sin(polar) * Math.sin(az), Math.cos(polar), Math.sin(polar) * Math.cos(az)]; }
  var UPPER_AZ = { F: 0, R: 72, BR: 144, BL: -144, L: -72 };
  var OPP = { U: 'D', L: 'DR', F: 'B', R: 'DL', BR: 'FL', BL: 'FR' };
  var N = {};
  N.U = [0, 1, 0]; N.D = [0, -1, 0];
  Object.keys(UPPER_AZ).forEach(function (f) { N[f] = dirOf(ALPHA, UPPER_AZ[f] * Math.PI / 180); N[OPP[f]] = mul(N[f], -1); });
  var NORMALS = FACES.map(function (f) { return N[f]; });
  var FI = {}; FACES.forEach(function (f, i) { FI[f] = i; });
  // 邻面（自外看逆时针 = 绕法线正向），起点取编号最小的邻面
  var NB = FACES.map(function (f, i) {
    var n = NORMALS[i], nbs = [];
    FACES.forEach(function (g, j) { if (j !== i && Math.abs(dot(n, NORMALS[j]) - 1 / Math.sqrt(5)) < 1e-6) nbs.push(j); });
    var ref = NORMALS[nbs[0]], u = norm(sub(ref, mul(n, dot(ref, n)))), w = cross(n, u);
    nbs.sort(function (a, b) {
      var A = Math.atan2(dot(NORMALS[a], w), dot(NORMALS[a], u)), B = Math.atan2(dot(NORMALS[b], w), dot(NORMALS[b], u));
      return (A < -1e-9 ? A + TAU : A) - (B < -1e-9 ? B + TAU : B);
    });
    return nbs;
  });
  function vertex(a, b, c) { return solve3([NORMALS[a], NORMALS[b], NORMALS[c]], [1, 1, 1]); }
  // 切割深度：切面到棱的距离 = 面边心距 × CUT_FRAC
  var CUT_FRAC = 0.42;
  var V0 = vertex(0, NB[0][0], NB[0][1]), V1 = vertex(0, NB[0][1], NB[0][2]);
  var APOTHEM = len(sub(mul(add(V0, V1), 0.5), NORMALS[0]));
  var CUT = 1 - APOTHEM * CUT_FRAC * Math.sin(ALPHA);

  function sortCCW(pts, n) {
    var c = [0, 0, 0]; pts.forEach(function (p) { c = add(c, p); }); c = mul(c, 1 / pts.length);
    var u = norm(sub(pts[0], c)), w = cross(n, u);
    return pts.slice().sort(function (a, b) { var A = sub(a, c), B = sub(b, c); return Math.atan2(dot(A, w), dot(A, u)) - Math.atan2(dot(B, w), dot(B, u)); });
  }
  function centroid(pts) { var c = [0, 0, 0]; pts.forEach(function (p) { c = add(c, p); }); return mul(c, 1 / pts.length); }

  var stickers = [], faces = [];
  FACES.forEach(function (f, fi) {
    var n = NORMALS[fi], nb = NB[fi], P = [], A = [], B = [], V = [];
    for (var k = 0; k < 5; k++) {
      var a = nb[k], b = nb[(k + 1) % 5], z = nb[(k + 4) % 5];
      V[k] = vertex(fi, a, b);
      P[k] = solve3([n, NORMALS[a], NORMALS[b]], [1, CUT, CUT]);
      A[k] = solve3([n, NORMALS[a], NORMALS[b]], [1, 1, CUT]);   // 棱 k 上靠近 V_k 的点
      B[k] = solve3([n, NORMALS[a], NORMALS[z]], [1, 1, CUT]);   // 棱 k 上靠近 V_{k-1} 的点
    }
    var ids = [], base = fi * 11;
    function push(kind, k, poly, touch) {
      poly = sortCCW(poly, n);
      stickers.push({ id: f + (kind === 'c' ? '' : kind === 'e' ? '-' + FACES[nb[k]] : '/' + FACES[nb[k]] + '/' + FACES[nb[(k + 1) % 5]]),
        face: f, faceIndex: fi, kind: kind, k: k, normal: n.slice(), poly: poly, centroid: centroid(poly), touch: touch });
      ids.push(stickers.length - 1);
    }
    push('c', -1, P.slice(), [fi]);
    for (k = 0; k < 5; k++) {
      push('e', k, [B[k], A[k], P[k], P[(k + 4) % 5]], [fi, nb[k]].sort(function (x, y) { return x - y; }));
      push('k', k, [V[k], B[(k + 1) % 5], P[k], A[k]], [fi, nb[k], nb[(k + 1) % 5]].sort(function (x, y) { return x - y; }));
    }
    faces.push({ id: f, index: fi, normal: n, stickers: ids, center: base, neighbors: nb.slice(), color: SCHEME[fi], vertices: V });
  });
  // 块：按所接触的面集合归组
  var pieces = [], pieceOf = [], byKey = {};
  stickers.forEach(function (s, i) {
    var key = s.touch.join(',');
    if (byKey[key] == null) { byKey[key] = pieces.length; pieces.push({ key: key, faces: s.touch.slice(), stickers: [] }); }
    pieces[byKey[key]].stickers.push(i); pieceOf[i] = byKey[key];
  });
  pieces.forEach(function (pc) {
    var c = [0, 0, 0]; pc.stickers.forEach(function (i) { c = add(c, stickers[i].centroid); }); c = mul(c, 1 / pc.stickers.length);
    var dir = norm(c);
    // 贴纸按绕块方向逆时针排序（角块 3 张、棱块 2 张）
    var u = norm(sub(stickers[pc.stickers[0]].centroid, mul(dir, dot(stickers[pc.stickers[0]].centroid, dir)))), w = cross(dir, u);
    pc.stickers.sort(function (a, b) {
      var A = sub(stickers[a].centroid, c), B = sub(stickers[b].centroid, c);
      var x = Math.atan2(dot(A, w), dot(A, u)), y = Math.atan2(dot(B, w), dot(B, u));
      return (x < -1e-9 ? x + TAU : x) - (y < -1e-9 ? y + TAU : y);
    });
    pc.type = pc.faces.length === 1 ? 'center' : pc.faces.length === 2 ? 'edge' : 'corner';
    // 3D 区域判定点：在该块所属面的切面外侧、其余切面内侧
    pc.pos = pc.type === 'center' ? mul(dir, (1 + CUT) / 2 / dot(dir, NORMALS[pc.faces[0]])) : mul(c, 0.985);
  });
  // 自检：判定点的「在切面外侧」集合 = 块的面集合
  pieces.forEach(function (pc) {
    var out = []; NORMALS.forEach(function (n, j) { if (dot(n, pc.pos) > CUT + 1e-9) out.push(j); });
    if (out.join(',') !== pc.key) throw new Error('megaminx piece region mismatch ' + pc.key + ' vs ' + out.join(','));
  });

  // ---------------------------------------------------------------- 转动
  function matchSticker(c, n) {
    for (var i = 0; i < stickers.length; i++) {
      var s = stickers[i];
      if (Math.abs(s.normal[0] - n[0]) + Math.abs(s.normal[1] - n[1]) + Math.abs(s.normal[2] - n[2]) < 1e-6 &&
        Math.abs(s.centroid[0] - c[0]) + Math.abs(s.centroid[1] - c[1]) + Math.abs(s.centroid[2] - c[2]) < 1e-6) return i;
    }
    throw new Error('megaminx: no sticker at rotated position');
  }
  function rotationPerm(axis, angle, pieceSet) {
    var perm = [];
    stickers.forEach(function (s, i) {
      if (pieceSet && !pieceSet[pieceOf[i]]) { perm[i] = i; return; }
      perm[i] = matchSticker(rot(s.centroid, axis, angle), rot(s.normal, axis, angle));
    });
    return perm;
  }
  var SUF = { 1: '', 2: '2', '-1': "'", '-2': "2'" };
  var moves = {}, faceMoves = [];
  FACES.forEach(function (f, fi) {
    var set = {}; pieces.forEach(function (pc, i) { if (pc.faces.indexOf(fi) >= 0) set[i] = true; });
    [1, 2, -1, -2].forEach(function (k) {
      var tok = f + SUF[k];
      moves[tok] = { tok: tok, face: f, faceIndex: fi, amount: k, axis: NORMALS[fi].slice(), angle: -k * D72, perm: rotationPerm(NORMALS[fi], -k * D72, set), pieceSet: set,
        inverse: f + SUF[-k], base: f, kind: 'face' };
      faceMoves.push(tok);
    });
  });
  // Pochmann：R±± = 除 L 层外绕 DR 轴（从 DR 一侧看顺时针为 ++）；D±± = 除 U 层外绕 D 轴
  [['R', 'L', 'DR'], ['D', 'U', 'D']].forEach(function (d) {
    var keep = FI[d[1]], ax = NORMALS[FI[d[2]]], set = {};
    pieces.forEach(function (pc, i) { if (pc.faces.indexOf(keep) < 0) set[i] = true; });
    [['++', -2], ['--', 2]].forEach(function (s) {
      var tok = d[0] + s[0];
      moves[tok] = { tok: tok, face: d[2], faceIndex: FI[d[2]], amount: -s[1], axis: ax.slice(), angle: s[1] * D72, perm: rotationPerm(ax, s[1] * D72, set), pieceSet: set,
        inverse: d[0] + (s[0] === '++' ? '--' : '++'), base: d[2], kind: 'pochmann' };
    });
  });
  var allMoves = Object.keys(moves);

  // 60 个整体旋转（贴纸置换），由绕 U、绕 F 的 72° 旋转生成
  var rotations = (function () {
    var gens = [rotationPerm(N.U, D72, null), rotationPerm(N.F, D72, null)], id = stickers.map(function (_, i) { return i; });
    var list = [id], seen = {}; seen[id.join()] = 1;
    for (var q = 0; q < list.length; q++) gens.forEach(function (g) {
      var p = list[q].map(function (x) { return g[x]; }), k = p.join();
      if (!seen[k]) { seen[k] = 1; list.push(p); }
    });
    if (list.length !== 60) throw new Error('megaminx rotations: ' + list.length);
    return list;
  })();

  function applyPerm(st, perm) { var ns = st.slice(); for (var i = 0; i < perm.length; i++) ns[perm[i]] = st[i]; return ns; }
  function solvedState() { var st = []; stickers.forEach(function (s, i) { st[i] = SCHEME[s.faceIndex]; }); return st; }
  function apply(st, toks) { return toks.reduce(function (s, t) { if (!moves[t]) throw new Error('bad move ' + t); return applyPerm(s, moves[t].perm); }, st); }
  function isSolved(st) { return faces.every(function (f) { var c = st[f.center]; return f.stickers.every(function (i) { return st[i] === c; }); }); }

  // ---------------------------------------------------------------- 块级编码
  var corners = [], edges = [];
  pieces.forEach(function (pc, i) { if (pc.type === 'corner') corners.push(i); else if (pc.type === 'edge') edges.push(i); });
  var CS = corners.map(function (pi) { return pieces[pi].stickers; }), ES = edges.map(function (pi) { return pieces[pi].stickers; });
  var stickerCode = [];   // 贴纸 → { t: 'c'|'e', code }
  CS.forEach(function (st, p) { st.forEach(function (s, o) { stickerCode[s] = { t: 'c', code: p * 3 + o }; }); });
  ES.forEach(function (st, p) { st.forEach(function (s, o) { stickerCode[s] = { t: 'e', code: p * 2 + o }; }); });
  function codeTables(perm) {
    var c = new Int16Array(60), e = new Int16Array(60);
    for (var x = 0; x < 60; x++) { c[x] = stickerCode[perm[CS[(x / 3) | 0][x % 3]]].code; e[x] = stickerCode[perm[ES[x >> 1][x & 1]]].code; }
    return { c: c, e: e };
  }
  faceMoves.forEach(function (t) { var ct = codeTables(moves[t].perm); moves[t].cm = ct.c; moves[t].em = ct.e; });
  // 块所接触的面（按槽位）
  var cornerFaces = corners.map(function (pi) { return pieces[pi].faces; }), edgeFaces = edges.map(function (pi) { return pieces[pi].faces; });

  /** 规范朝向：找使中心回到原位的整体旋转 r（applyPerm(state, r) 的中心与标准配色一致）；找不到返回 -1 */
  function findRotation(st) {
    var S = solvedState();
    for (var r = 0; r < 60; r++) {
      var p = rotations[r], ok = true;
      for (var f = 0; f < 12 && ok; f++) ok = S[p[f * 11]] === st[f * 11];   // 中心 f 经 r 移到 p[f*11]，那里应是该颜色
      if (ok) return r;
    }
    return -1;
  }
  /** 旋转 r 下，规范系中的面 X 对应原状态里的哪个面 */
  function faceMapFor(r) {
    var p = rotations[r], map = {};
    FACES.forEach(function (g, gi) { var dst = p[gi * 11]; map[FACES[dst / 11]] = g; });
    return map;
  }
  function relabel(toks, r) {
    var map = faceMapFor(r);
    return toks.map(function (t) { var m = /^([A-Z]+)(.*)$/.exec(t); return map[m[1]] + m[2]; });
  }
  /** 贴纸颜色（中心已在原位）→ 块级状态 { cp, co, ep, eo }（cp[i] = 块 i 的代码 p*3+o）；无法识别返回 null */
  function toCodes(st) {
    var S = solvedState(), cc = new Int16Array(20).fill(-1), ec = new Int16Array(30).fill(-1);
    var ckey = {}, ekey = {};
    CS.forEach(function (sl, i) { ckey[sl.map(function (s) { return S[s]; }).join('')] = i; });
    ES.forEach(function (sl, i) { ekey[sl.map(function (s) { return S[s]; }).join('')] = i; });
    for (var p = 0; p < 20; p++) {
      var col = CS[p].map(function (s) { return st[s]; }), hit = false;
      for (var r = 0; r < 3; r++) {   // 槽位第 r 张贴纸 = 块的参照贴纸
        var k = [col[r], col[(r + 1) % 3], col[(r + 2) % 3]].join(''), i = ckey[k];
        if (i != null) { if (cc[i] >= 0) return null; cc[i] = p * 3 + r; hit = true; break; }
      }
      if (!hit) return null;
    }
    for (p = 0; p < 30; p++) {
      col = ES[p].map(function (s) { return st[s]; }); hit = false;
      for (r = 0; r < 2; r++) { k = col[r] + col[1 - r]; i = ekey[k]; if (i != null) { if (ec[i] >= 0) return null; ec[i] = p * 2 + r; hit = true; break; } }
      if (!hit) return null;
    }
    return { c: cc, e: ec };
  }
  function fromCodes(cd) {
    var S = solvedState(), st = S.slice();
    for (var i = 0; i < 20; i++) { var p = (cd.c[i] / 3) | 0, o = cd.c[i] % 3; for (var j = 0; j < 3; j++) st[CS[p][(o + j) % 3]] = S[CS[i][j]]; }
    for (i = 0; i < 30; i++) { p = cd.e[i] >> 1; o = cd.e[i] & 1; for (j = 0; j < 2; j++) st[ES[p][(o + j) % 2]] = S[ES[i][j]]; }
    return st;
  }
  function parity(perm) { var seen = [], par = 0; for (var i = 0; i < perm.length; i++) { if (seen[i]) continue; var j = i, l = 0; while (!seen[j]) { seen[j] = 1; j = perm[j]; l++; } par += l - 1; } return par & 1; }
  function invariants(cd) {
    var cp = [], ep = [], tw = 0, fl = 0;
    for (var i = 0; i < 20; i++) { cp[i] = (cd.c[i] / 3) | 0; tw += cd.c[i] % 3; }
    for (i = 0; i < 30; i++) { ep[i] = cd.e[i] >> 1; fl += cd.e[i] & 1; }
    return { cpar: parity(cp), epar: parity(ep), twist: tw % 3, flip: fl % 2 };
  }

  /**
   * 校验：{ ok, issues[{k,p}], errors[], marks[] }，键与金字塔 / 斜转共用（v.*），另有 v.megaCenters。
   * 中心块可以处在任一整体旋转的位置（Pochmann 打乱会整体移动中心），只要 12 个中心构成真实的朝向。
   */
  function validate(st) {
    var issues = [], marks = [];
    function I(k, p, ids) { issues.push({ k: k, p: p || {} }); if (ids) marks.push.apply(marks, ids); }
    function fail() { return { ok: false, issues: issues, errors: issues.map(function (x) { return x.k; }), marks: marks }; }
    if (!st || st.length !== stickers.length) { I('v.unpainted', { n: stickers.length }); return fail(); }
    var nb = 0; st.forEach(function (c) { if (!c) nb++; });
    if (nb) { I('v.unpainted', { n: nb }); return fail(); }
    var cnt = {}; st.forEach(function (c) { cnt[c] = (cnt[c] || 0) + 1; });
    Object.keys(cnt).forEach(function (c) {
      if (SCHEME.indexOf(c) < 0) I('v.foreign', { color: c });
      else if (cnt[c] > 11) I('v.countMoreN', { color: c, n: cnt[c], d: cnt[c] - 11, per: 11 });
    });
    SCHEME.forEach(function (c) { if ((cnt[c] || 0) < 11) I('v.countLessN', { color: c, n: cnt[c] || 0, d: 11 - (cnt[c] || 0), per: 11 }); });
    if (issues.length) return fail();
    var r = findRotation(st);
    if (r < 0) { I('v.megaCenters', {}, faces.map(function (f) { return f.center; })); return fail(); }
    var p = rotations[r], pinv = []; p.forEach(function (d, i) { pinv[d] = i; });
    var cs = applyPerm(st, p), S = solvedState();
    // 逐槽识别
    function scan(SL, n, cls) {
      var key = {}, seen = {};
      SL.forEach(function (sl, i) { for (var q = 0; q < n; q++) key[sl.map(function (_, j) { return S[sl[(j + q) % n]]; }).join('')] = i; });
      SL.forEach(function (sl) {
        var col = sl.map(function (x) { return cs[x]; }), i = key[col.join('')], ids = sl.map(function (x) { return pinv[x]; });
        if (i == null) { I('v.pieceBad', { piece: 'piece.' + cls, colors: col }, ids); return; }
        if (seen[i]) I('v.pieceDup', { piece: 'piece.' + cls, colors: col }, ids.concat(seen[i]));
        seen[i] = ids;
      });
    }
    scan(CS, 3, 'corner'); scan(ES, 2, 'edge');
    if (issues.length) return fail();
    var cd = toCodes(cs);
    if (!cd) { I('v.pieceBad', { piece: 'piece.corner', colors: [] }); return fail(); }
    var iv = invariants(cd);
    if (iv.cpar || iv.epar) I('v.parity', {});
    else { if (iv.twist) I('v.twist', {}); if (iv.flip) I('v.flip', {}); }
    if (issues.length) return fail();
    return { ok: true, issues: [], errors: [], marks: [], rotation: r, codes: cd };
  }

  /** 均匀随机合法状态（中心在原位）：角 / 棱各自偶排列，扭转和 ≡ 0 (mod 3)，翻转和 ≡ 0 (mod 2) */
  function randomCodes(rnd) {
    rnd = rnd || Math.random;
    function perm(n) { var a = []; for (var i = 0; i < n; i++) a[i] = i; for (i = n - 1; i > 0; i--) { var j = Math.floor(rnd() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } if (parity(a)) { t = a[0]; a[0] = a[1]; a[1] = t; } return a; }
    var cp = perm(20), ep = perm(30), c = new Int16Array(20), e = new Int16Array(30), s = 0;
    for (var i = 0; i < 20; i++) { var o = i < 19 ? Math.floor(rnd() * 3) : (3 - s % 3) % 3; s += o; c[i] = cp[i] * 3 + o; }
    s = 0; for (i = 0; i < 30; i++) { o = i < 29 ? Math.floor(rnd() * 2) : s & 1; s += o; e[i] = ep[i] * 2 + o; }
    return { c: c, e: e };
  }
  function randomState(rnd) { return fromCodes(randomCodes(rnd)); }
  /** WCA（Pochmann）打乱：7 行 × (10 个 R±± / D±± 交替 + U 或 U')，共 77 步 */
  function pochmannScramble(rnd, lines) {
    rnd = rnd || Math.random; lines = lines || 7; var out = [];
    for (var l = 0; l < lines; l++) {
      for (var k = 0; k < 10; k++) out.push((k % 2 ? 'D' : 'R') + (rnd() < 0.5 ? '++' : '--'));
      out.push(out[out.length - 1] === 'D++' ? 'U' : "U'");   // 与 TNoodle 相同：行末 U 的方向随该行最后一个 D 转动
    }
    return out;
  }

  var api = {
    FACES: FACES, FI: FI, COLORS: COLORS, SCHEME: SCHEME, NORMALS: NORMALS, NB: NB, CUT: CUT, ALPHA: ALPHA,
    stickers: stickers, faces: faces, pieces: pieces, pieceOf: pieceOf, moves: moves, faceMoves: faceMoves, allMoves: allMoves, rotations: rotations,
    corners: corners, edges: edges, CS: CS, ES: ES, cornerFaces: cornerFaces, edgeFaces: edgeFaces,
    vec: vec, applyPerm: applyPerm, solvedState: solvedState, apply: apply, isSolved: isSolved,
    findRotation: findRotation, faceMapFor: faceMapFor, relabel: relabel, toCodes: toCodes, fromCodes: fromCodes, invariants: invariants,
    validate: validate, randomCodes: randomCodes, randomState: randomState, pochmannScramble: pochmannScramble, parity: parity
  };
  root.MegaminxModel = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : (typeof self !== 'undefined' ? self : globalThis));
