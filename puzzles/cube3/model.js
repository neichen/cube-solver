/* 魔方数据模型：贴纸几何、转动、校验、打乱（无依赖，浏览器/Node 通用） */
(function (root) {
  'use strict';
  var FACES = 'URFDLB';
  // 默认配色：白顶绿前
  var COLORS = {
    W: { name: '白', hex: '#fbfbf8' },
    Y: { name: '黄', hex: '#f3b33e' },
    G: { name: '绿', hex: '#306e49' },
    B: { name: '蓝', hex: '#19408e' },
    R: { name: '红', hex: '#dd3429' },
    O: { name: '橙', hex: '#ec8331' }
  };
  var DEFAULT_SCHEME = { U: 'W', R: 'R', F: 'G', D: 'Y', L: 'O', B: 'B' };
  var FACE_NAMES = { U: '上 (U)', R: '右 (R)', F: '前 (F)', D: '下 (D)', L: '左 (L)', B: '后 (B)' };
  var CENTERS = [4, 13, 22, 31, 40, 49];

  // 贴纸 i 的位置 p 与外法线 n（x 右, y 上, z 前）
  function faceletGeom(i) {
    var f = FACES[(i / 9) | 0], k = i % 9, r = (k / 3) | 0, c = k % 3;
    switch (f) {
      case 'U': return { p: [c - 1, 1, r - 1], n: [0, 1, 0] };
      case 'R': return { p: [1, 1 - r, 1 - c], n: [1, 0, 0] };
      case 'F': return { p: [c - 1, 1 - r, 1], n: [0, 0, 1] };
      case 'D': return { p: [c - 1, -1, 1 - r], n: [0, -1, 0] };
      case 'L': return { p: [-1, 1 - r, c - 1], n: [-1, 0, 0] };
      case 'B': return { p: [1 - c, 1 - r, -1], n: [0, 0, -1] };
    }
  }
  var GEOM = [], KEY2IDX = {};
  for (var i = 0; i < 54; i++) { GEOM.push(faceletGeom(i)); KEY2IDX[GEOM[i].p.join(',') + '|' + GEOM[i].n.join(',')] = i; }
  var FACE_NORMAL = { U: [0, 1, 0], R: [1, 0, 0], F: [0, 0, 1], D: [0, -1, 0], L: [-1, 0, 0], B: [0, 0, -1] };

  function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
  // 绕 n 顺时针（从 n 方向看）转 90°：v' = -(n×v) + n(n·v)
  function rotCW(n, v) { var c = cross(n, v), d = dot(n, v); return [-c[0] + n[0] * d, -c[1] + n[1] * d, -c[2] + n[2] * d]; }

  var PERM = {}; // PERM[face][i] = 贴纸 i 转动后去的位置
  FACES.split('').forEach(function (f) {
    var n = FACE_NORMAL[f], perm = [];
    for (var i = 0; i < 54; i++) {
      var g = GEOM[i];
      if (dot(g.p, n) === 1) {
        var p2 = rotCW(n, g.p), n2 = rotCW(n, g.n);
        perm.push(KEY2IDX[p2.join(',') + '|' + n2.join(',')]);
      } else perm.push(i);
    }
    PERM[f] = perm;
  });

  function parseMoves(str) {
    return (str || '').trim().split(/\s+/).filter(Boolean).map(function (m) {
      var f = m[0], suf = m.slice(1);
      if (FACES.indexOf(f) < 0) throw new Error('无法识别的转动: ' + m);
      var times = suf === "'" ? 3 : suf === '2' ? 2 : suf === '' ? 1 : null;
      if (times === null) throw new Error('无法识别的转动: ' + m);
      return { face: f, times: times, text: m };
    });
  }
  // state: 长度 54 的数组（任意符号）
  function applyMove(state, move) {
    var perm = PERM[move.face], s = state.slice();
    for (var t = 0; t < move.times; t++) {
      var ns = s.slice();
      for (var i = 0; i < 54; i++) ns[perm[i]] = s[i];
      s = ns;
    }
    return s;
  }
  function applyMoves(state, moves) {
    if (typeof moves === 'string') moves = parseMoves(moves);
    return moves.reduce(applyMove, state);
  }
  function solvedState(scheme) {
    scheme = scheme || DEFAULT_SCHEME; var s = [];
    FACES.split('').forEach(function (f) { for (var k = 0; k < 9; k++) s.push(scheme[f]); });
    return s;
  }
  function isSolved(state) {
    for (var f = 0; f < 6; f++) for (var k = 0; k < 9; k++) if (state[f * 9 + k] !== state[f * 9 + 4]) return false;
    return true;
  }
  function randomScramble(len, rnd) {
    rnd = rnd || Math.random; len = len || 22;
    var axis = { U: 0, D: 0, R: 1, L: 1, F: 2, B: 2 }, out = [], prev = null, prev2 = null;
    while (out.length < len) {
      var f = FACES[(rnd() * 6) | 0];
      if (f === prev) continue;
      if (prev2 && axis[f] === axis[prev] && axis[f] === axis[prev2]) continue;
      out.push(f + ['', "'", '2'][(rnd() * 3) | 0]);
      prev2 = prev; prev = f;
    }
    return out.join(' ');
  }

  // ---- 校验 ----
  var CORNER_F = [[8, 9, 20], [6, 18, 38], [0, 36, 47], [2, 45, 11], [29, 26, 15], [27, 44, 24], [33, 53, 42], [35, 17, 51]];
  var CORNER_C = ['URF', 'UFL', 'ULB', 'UBR', 'DFR', 'DLF', 'DBL', 'DRB'];
  var EDGE_F = [[5, 10], [7, 19], [3, 37], [1, 46], [32, 16], [28, 25], [30, 43], [34, 52], [23, 12], [21, 41], [50, 39], [48, 14]];
  var EDGE_C = ['UR', 'UF', 'UL', 'UB', 'DR', 'DF', 'DL', 'DB', 'FR', 'FL', 'BL', 'BR'];
  var CORNER_POS_NAME = ['上右前', '上前左', '上左后', '上后右', '下前右', '下左前', '下后左', '下右后'];
  var CORNER_POS = ['URF', 'UFL', 'ULB', 'UBR', 'DFR', 'DLF', 'DBL', 'DRB'], EDGE_POS = EDGE_C;
  var EDGE_POS_NAME = ['上右', '上前', '上左', '上后', '下右', '下前', '下左', '下后', '前右', '前左', '后左', '后右'];

  function permParity(p) {
    var seen = [], par = 0;
    for (var i = 0; i < p.length; i++) {
      if (seen[i]) continue; var len = 0, j = i;
      while (!seen[j]) { seen[j] = 1; j = p[j]; len++; }
      par += len - 1;
    }
    return par % 2;
  }
  function cname(c) { return COLORS[c] ? COLORS[c].name : c; }

  // 返回 { ok, errors:[]（中文文本）, issues:[{k, p}]（可翻译：键 + 参数，颜色用颜色键、位置用面字母）, facelets（成功时） }
  function validate(state) {
    var errors = [], issues = [], i;
    function I(k, p) { issues.push({ k: k, p: p || {} }); }
    function fail() { return { ok: false, errors: errors, issues: issues }; }
    for (i = 0; i < 54; i++) if (!state[i]) { var nb = state.filter(function (x) { return !x; }).length; errors.push('还有贴纸未上色（共 ' + nb + ' 块），请先涂完所有格子。'); I('v.unpainted', { n: nb }); return fail(); }
    var centerColors = CENTERS.map(function (c) { return state[c]; });
    var face = {};
    for (i = 0; i < 6; i++) {
      if (face[centerColors[i]]) { errors.push('有两个面的中心块都是' + cname(centerColors[i]) + '色，六个中心块颜色必须各不相同。'); I('v.dupCenter', { color: centerColors[i] }); return fail(); }
      face[centerColors[i]] = FACES[i];
    }
    var counts = {};
    state.forEach(function (c) { counts[c] = (counts[c] || 0) + 1; });
    Object.keys(counts).forEach(function (c) {
      if (!face[c]) { errors.push('出现了不属于任何中心块的颜色：' + cname(c) + '色。'); I('v.foreign', { color: c }); }
      else if (counts[c] !== 9) { errors.push(cname(c) + '色有 ' + counts[c] + ' 块，应为 9 块（' + (counts[c] > 9 ? '多了 ' + (counts[c] - 9) : '少了 ' + (9 - counts[c])) + ' 块）。'); I(counts[c] > 9 ? 'v.countMore' : 'v.countLess', { color: c, n: counts[c], d: Math.abs(counts[c] - 9) }); }
    });
    centerColors.forEach(function (c) { if (!counts[c]) { errors.push(cname(c) + '色缺失。'); I('v.missing', { color: c }); } });
    if (errors.length) return fail();
    var f = state.map(function (c) { return face[c]; }); // 面字母

    // 角块
    var cp = [], co = [], usedC = {}, twist = 0;
    for (i = 0; i < 8; i++) {
      var fl = CORNER_F[i].map(function (x) { return f[x]; });
      var ori = fl.findIndex(function (x) { return x === 'U' || x === 'D'; });
      var j = -1;
      if (ori >= 0) {
        var c1 = fl[(ori + 1) % 3], c2 = fl[(ori + 2) % 3], c0 = fl[ori];
        j = CORNER_C.findIndex(function (n) { return n[0] === c0 && n[1] === c1 && n[2] === c2; });
      }
      if (j < 0) { errors.push('位置「' + CORNER_POS_NAME[i] + '」的角块颜色组合（' + CORNER_F[i].map(function (x) { return cname(state[x]); }).join('/') + '）在真实魔方上不存在。'); I('v.cornerBad', { pos: CORNER_POS[i], colors: CORNER_F[i].map(function (x) { return state[x]; }) }); continue; }
      if (usedC[j] !== undefined) { errors.push('角块 ' + CORNER_C[j].split('').map(function (x) { return cname(centerColors[FACES.indexOf(x)]); }).join('/') + ' 出现了两次。'); I('v.cornerDup', { colors: CORNER_C[j].split('').map(function (x) { return centerColors[FACES.indexOf(x)]; }) }); }
      usedC[j] = i; cp.push(j); co.push(ori); twist += ori;
    }
    var ep = [], usedE = {}, flip = 0;
    for (i = 0; i < 12; i++) {
      var a = f[EDGE_F[i][0]], b = f[EDGE_F[i][1]], k = -1, o = 0;
      for (var e = 0; e < 12; e++) {
        if (EDGE_C[e][0] === a && EDGE_C[e][1] === b) { k = e; o = 0; break; }
        if (EDGE_C[e][0] === b && EDGE_C[e][1] === a) { k = e; o = 1; break; }
      }
      if (k < 0) { errors.push('位置「' + EDGE_POS_NAME[i] + '」的棱块颜色组合（' + EDGE_F[i].map(function (x) { return cname(state[x]); }).join('/') + '）在真实魔方上不存在。'); I('v.edgeBad', { pos: EDGE_POS[i], colors: EDGE_F[i].map(function (x) { return state[x]; }) }); continue; }
      if (usedE[k] !== undefined) { errors.push('棱块 ' + EDGE_C[k].split('').map(function (x) { return cname(centerColors[FACES.indexOf(x)]); }).join('/') + ' 出现了两次。'); I('v.edgeDup', { colors: EDGE_C[k].split('').map(function (x) { return centerColors[FACES.indexOf(x)]; }) }); }
      usedE[k] = i; ep.push(k); flip += o;
    }
    if (errors.length) { errors.push('提示：请检查颜色是否涂错，或中心块配色与实物是否一致（对面颜色不能相邻）。'); I('v.hint'); return fail(); }
    if (twist % 3 !== 0) { errors.push('角块方向错误（扭转）：有一个角块被“拧”了，物理上无法还原。请检查角块的颜色顺序是否涂反。'); I('v.twist'); }
    if (flip % 2 !== 0) { errors.push('棱块方向错误（翻转）：有一个棱块被翻转了，物理上无法还原。请检查棱块的两种颜色是否涂反。'); I('v.flip'); }
    if (permParity(cp) !== permParity(ep)) { errors.push('奇偶校验错误：有两个块的位置被对调了，物理上无法还原。请检查是否有两块颜色互换。'); I('v.parity'); }
    if (errors.length) return fail();
    return { ok: true, errors: [], issues: [], facelets: f.join('') };
  }

  var api = {
    FACE_NORMAL: FACE_NORMAL,
    FACES: FACES, COLORS: COLORS, DEFAULT_SCHEME: DEFAULT_SCHEME, FACE_NAMES: FACE_NAMES, CENTERS: CENTERS,
    GEOM: GEOM, PERM: PERM, parseMoves: parseMoves, applyMove: applyMove, applyMoves: applyMoves,
    solvedState: solvedState, isSolved: isSolved, randomScramble: randomScramble, validate: validate
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.CubeModel = api;
})(this);
