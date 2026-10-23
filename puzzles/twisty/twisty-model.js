/*
 * 异形魔方（金字塔 Pyraminx / 斜转 Skewb）的通用模型：几何 → 贴纸 → 转动置换 → 块 → 坐标 → BFS 距离表 → 最优解。
 * 纯 JS，无 DOM，可在页面、Web Worker 与 Node 中使用。所有置换都由几何旋转生成（贴纸质心+法线绕轴转 120° 后找回贴纸）。
 *
 * 状态 = 长度 N 的颜色数组（与其它插件一致）。求解时把颜色状态识别成「块 + 朝向」，按块类别分成相互独立的分量
 * （金字塔：棱块 × 轴心块，顶角另算；斜转：中心块 × 角块），每个分量先 BFS 出可达集合与转动表，
 * 再在分量乘积空间上做一次完整 BFS（Uint8Array 距离表）。解 = 沿距离表逐步下降，长度恰为最短距离（可证明最优）。
 */
(function (root) {
  'use strict';

  // ---------------------------------------------------------------- 向量
  function add(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
  function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
  function mul(a, k) { return [a[0] * k, a[1] * k, a[2] * k]; }
  function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
  function norm(a) { var l = Math.hypot(a[0], a[1], a[2]); return [a[0] / l, a[1] / l, a[2] / l]; }
  function avg(ps) { var s = [0, 0, 0]; ps.forEach(function (p) { s = add(s, p); }); return mul(s, 1 / ps.length); }
  function rot(v, n, ang) {   // Rodrigues，n 单位向量
    var c = Math.cos(ang), s = Math.sin(ang), d = dot(v, n), cr = cross(n, v);
    return [0, 1, 2].map(function (k) { return v[k] * c + cr[k] * s + n[k] * d * (1 - c); });
  }
  function lerp3(A, B, C, i, j, k, n) { return [0, 1, 2].map(function (q) { return (A[q] * i + B[q] * j + C[q] * k) / n; }); }

  var COLORS = {
    W: { name: '白', hex: '#fbfbf8' }, Y: { name: '黄', hex: '#f3b33e' }, G: { name: '绿', hex: '#306e49' },
    B: { name: '蓝', hex: '#19408e' }, R: { name: '红', hex: '#dd3429' }, O: { name: '橙', hex: '#ec8331' }
  };

  // ---------------------------------------------------------------- 通用构建
  /**
   * spec: { id, stickers:[{face, poly, piece}], faceColor:{face:color}, faces:[{id,normal}], moves:{tok:{axis, angle, pieces:[pieceKey]}},
   *         classes:[{name, keys:[pieceKey...]}], components:[[className...]] }
   */
  function build(spec) {
    var S = spec.stickers.map(function (s, i) {
      var c = avg(s.poly), nn = norm(cross(sub(s.poly[1], s.poly[0]), sub(s.poly[2], s.poly[0])));
      if (dot(nn, c) < 0) { nn = mul(nn, -1); s.poly = s.poly.slice().reverse(); }
      return { id: s.id, face: s.face, poly: s.poly, centroid: c, normal: nn, piece: s.piece, color: spec.faceColor[s.face], index: i };
    });
    var N = S.length;
    // 块
    var pieceKeys = [], pieceIdx = {};
    S.forEach(function (s) { if (pieceIdx[s.piece] === undefined) { pieceIdx[s.piece] = pieceKeys.length; pieceKeys.push(s.piece); } });
    var pieces = pieceKeys.map(function (k) {
      var ids = S.filter(function (s) { return s.piece === k; }).map(function (s) { return s.index; });
      var pos = avg(ids.map(function (i) { return S[i].centroid; })), d = norm(pos);
      // 块内贴纸按绕块方向的角度排序：几何旋转保持循环次序，于是「块 + 朝向」可以用首贴纸标签唯一表示
      var ref = Math.abs(d[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0], u = norm(cross(d, ref)), v = cross(d, u);
      ids.sort(function (a, b) { var pa = S[a].centroid, pb = S[b].centroid; return Math.atan2(dot(pa, v), dot(pa, u)) - Math.atan2(dot(pb, v), dot(pb, u)); });
      return { key: k, pos: pos, stickers: ids };
    });
    S.forEach(function (s) { s.pieceIndex = pieceIdx[s.piece]; });
    // 转动：几何置换
    function findSticker(c, n) {
      var best = -1, bd = 1e9;
      for (var j = 0; j < N; j++) { if (dot(S[j].normal, n) < 0.99) continue; var dd = Math.hypot(S[j].centroid[0] - c[0], S[j].centroid[1] - c[1], S[j].centroid[2] - c[2]); if (dd < bd) { bd = dd; best = j; } }
      if (bd > 1e-6) throw new Error('geom perm: no sticker (' + bd + ')');
      return best;
    }
    var moves = {}, order = Object.keys(spec.moves);
    order.forEach(function (t) {
      var md = spec.moves[t], ax = norm(md.axis), inL = {};
      md.pieces.forEach(function (k) { inL[k] = true; });
      var perm = S.map(function (s, i) { return inL[s.piece] ? findSticker(rot(s.centroid, ax, md.angle), rot(s.normal, ax, md.angle)) : i; });
      moves[t] = { tok: t, axis: ax, angle: md.angle, perm: perm, pieceKeys: md.pieces.slice(), inverse: md.inverse, base: md.base, kind: md.kind, vertex: md.vertex };
    });
    var M = { id: spec.id, stickers: S, N: N, pieces: pieces, pieceIdx: pieceIdx, moves: moves, order: order, allMoves: order.slice(), faces: spec.faces, faceColor: spec.faceColor, classes: spec.classes, components: spec.components, fixed: spec.fixed || [], netSrc: spec.stickers.map(function (s) { return s.net; }) };
    M.solvedState = function () { return S.map(function (s) { return s.color; }); };
    M.applyPerm = function (st, perm) { var ns = st.slice(); for (var i = 0; i < perm.length; i++) ns[perm[i]] = st[i]; return ns; };
    M.apply = function (st, toks) { return toks.reduce(function (s, t) { return M.applyPerm(s, moves[t].perm); }, st); };
    setupComponents(M);
    return M;
  }

  // ---------------------------------------------------------------- 块类别 / 分量坐标
  function setupComponents(M) {
    var S = M.stickers;
    M.classMap = {};
    M.classes.forEach(function (c) {
      c.slots = c.keys.map(function (k) { return M.pieces[M.pieceIdx[k]].stickers; });
      c.L = c.slots[0].length;
      // 标签 ℓ（某贴纸的初始序号）→ [块号 p, 块内位置 k]
      c.labelOf = {};
      c.slots.forEach(function (sl, p) { sl.forEach(function (sid, k) { c.labelOf[sid] = [p, k]; }); });
      M.classMap[c.name] = c;
    });
    M.comps = M.components.map(function (names) {
      return { names: names, classes: names.map(function (n) { return M.classMap[n]; }), size: 0, keys: null, index: null, table: null };
    });
  }
  // 分量状态 = 每个槽位首贴纸上的标签数组
  function compKeyFromLabels(comp, lab) {
    var out = [];
    comp.classes.forEach(function (c) { c.slots.forEach(function (sl) { out.push(lab[sl[0]]); }); });
    return out.join(',');
  }
  function labelsFromCompKey(comp, key, lab) {
    var a = key.split(','), q = 0;
    comp.classes.forEach(function (c) {
      c.slots.forEach(function (sl) {
        var l = +a[q++], pk = c.labelOf[l], P = c.slots[pk[0]];
        for (var t = 0; t < c.L; t++) lab[sl[t]] = P[(pk[1] + t) % c.L];
      });
    });
    return lab;
  }
  /** 分量 BFS：可达集合 + 转动表（Int32Array size × nMoves） */
  function enumerate(M, comp) {
    if (comp.keys) return comp;
    var nm = M.order.length, ident = M.stickers.map(function (_, i) { return i; });
    var start = compKeyFromLabels(comp, ident), keys = [start], index = new Map([[start, 0]]);
    var rows = [];
    for (var h = 0; h < keys.length; h++) {
      var lab = labelsFromCompKey(comp, keys[h], ident.slice()), row = new Array(nm);
      for (var m = 0; m < nm; m++) {
        var k2 = compKeyFromLabels(comp, M.applyPerm(lab, M.moves[M.order[m]].perm)), j = index.get(k2);
        if (j === undefined) { j = keys.length; keys.push(k2); index.set(k2, j); }
        row[m] = j;
      }
      rows.push(row);
    }
    comp.size = keys.length; comp.keys = keys; comp.index = index;
    comp.table = new Int32Array(comp.size * nm);
    rows.forEach(function (r, i) { for (var m = 0; m < nm; m++) comp.table[i * nm + m] = r[m]; });
    return comp;
  }

  /** 颜色状态 → 标签状态（每个位置上贴纸的初始序号）；识别失败返回 { bad:[...]} */
  function identify(M, state) {
    var lab = new Array(M.N), bad = [], seen = {}, dup = [];
    M.classes.forEach(function (c) {
      c.slots.forEach(function (sl, si) {
        var cols = sl.map(function (i) { return state[i]; }), hit = null;
        for (var p = 0; p < c.slots.length && !hit; p++) {
          var P = c.slots[p];
          for (var k = 0; k < c.L; k++) {
            var ok = true;
            for (var t = 0; t < c.L; t++) if (M.stickers[P[(k + t) % c.L]].color !== cols[t]) { ok = false; break; }
            if (ok) { hit = [p, k]; break; }
          }
        }
        if (!hit) { bad.push({ cls: c.name, slot: si, colors: cols, ids: sl }); return; }
        var P2 = c.slots[hit[0]], pk = c.name + hit[0];
        if (seen[pk]) dup.push({ cls: c.name, colors: P2.map(function (i) { return M.stickers[i].color; }), ids: sl.concat(seen[pk]) }); else seen[pk] = sl;
        for (var t2 = 0; t2 < c.L; t2++) lab[sl[t2]] = P2[(hit[1] + t2) % c.L];
      });
    });
    return { lab: lab, bad: bad, dup: dup };
  }

  // ---------------------------------------------------------------- 完整 BFS 距离表
  function buildTable(M, onProgress) {
    var t0 = Date.now();
    M.comps.forEach(function (c) { enumerate(M, c); });
    var core = M.coreComps.map(function (i) { return M.comps[i]; });
    var nm = M.order.length, sizes = core.map(function (c) { return c.size; });
    var Ntot = sizes.reduce(function (a, b) { return a * b; }, 1);
    var dist = new Uint8Array(Ntot).fill(255);
    var tA = core[0].table, tB = core[1].table, nB = sizes[1];
    dist[0] = 0;
    var filled = 1, depth = 0, counts = [1];
    while (filled < Ntot) {
      var nd = depth + 1, cnt = 0;
      for (var i = 0; i < Ntot; i++) {
        if (dist[i] !== depth) continue;
        var a = (i / nB) | 0, b = i - a * nB, ra = a * nm, rb = b * nm;
        for (var m = 0; m < nm; m++) {
          var j = tA[ra + m] * nB + tB[rb + m];
          if (dist[j] === 255) { dist[j] = nd; cnt++; }
        }
      }
      if (!cnt) break;
      filled += cnt; depth = nd; counts.push(cnt);
      if (onProgress) onProgress(depth, filled, Ntot);
    }
    M.dist = dist; M.distCounts = counts; M.maxDepth = depth; M.coreSize = Ntot; M.reached = filled; M.buildMs = Date.now() - t0;
    return { size: Ntot, reached: filled, maxDepth: depth, counts: counts, ms: M.buildMs, bytes: dist.byteLength };
  }

  function coreIndex(M, lab) {
    var c0 = M.comps[M.coreComps[0]], c1 = M.comps[M.coreComps[1]];
    var a = c0.index.get(compKeyFromLabels(c0, lab)), b = c1.index.get(compKeyFromLabels(c1, lab));
    if (a === undefined || b === undefined) return -1;
    return a * c1.size + b;
  }

  /** 最优解：沿距离表下降（核心部分），再补齐尾部（金字塔顶角，每个最多 1 步） */
  function solve(M, state) {
    var id = identify(M, state);
    if (id.bad.length || id.dup.length) throw new Error('invalid state');
    var lab = id.lab, i = coreIndex(M, lab);
    if (i < 0 || M.dist[i] === 255) throw new Error('unreachable state');
    var c0 = M.comps[M.coreComps[0]], c1 = M.comps[M.coreComps[1]], nm = M.order.length, nB = c1.size;
    var out = [], a = (i / nB) | 0, b = i - a * nB;
    while (M.dist[a * nB + b] > 0) {
      var d = M.dist[a * nB + b], found = false;
      for (var m = 0; m < nm; m++) {
        var a2 = c0.table[a * nm + m], b2 = c1.table[b * nm + m];
        if (M.dist[a2 * nB + b2] === d - 1) { out.push(M.order[m]); a = a2; b = b2; found = true; break; }
      }
      if (!found) throw new Error('descent failed');
    }
    var st = M.apply(state, out);
    if (M.finish) out = out.concat(M.finish(st));
    return { moves: out, coreLength: M.dist[i], length: out.length };
  }

  /** 均匀随机合法状态（各分量相互独立，见测试：乘积 = BFS 可达数） */
  function randomState(M, rnd) {
    rnd = rnd || Math.random;
    var lab = M.stickers.map(function (_, i) { return i; });
    M.comps.forEach(function (c) { enumerate(M, c); labelsFromCompKey(c, c.keys[(rnd() * c.size) | 0], lab); });
    return lab.map(function (l) { return M.stickers[l].color; });
  }

  // ---------------------------------------------------------------- 校验
  function validate(M, state) {
    var issues = [], marks = [];
    function I(k, p, ids) { issues.push({ k: k, p: p || {} }); if (ids) marks.push.apply(marks, ids); }
    function fail() { return { ok: false, issues: issues, errors: issues.map(function (x) { return x.k; }), marks: marks }; }
    var nb = 0, i; for (i = 0; i < M.N; i++) if (!state[i]) nb++;
    if (nb) { I('v.unpainted', { n: nb }); return fail(); }
    var counts = {}, per = {}, want = M.solvedState();
    want.forEach(function (c) { per[c] = (per[c] || 0) + 1; });
    state.forEach(function (c) { counts[c] = (counts[c] || 0) + 1; });
    Object.keys(counts).forEach(function (c) {
      if (!per[c]) I('v.foreign', { color: c });
      else if (counts[c] > per[c]) I('v.countMoreN', { color: c, n: counts[c], d: counts[c] - per[c], per: per[c] });
    });
    Object.keys(per).forEach(function (c) { if ((counts[c] || 0) < per[c]) I('v.countLessN', { color: c, n: counts[c] || 0, d: per[c] - (counts[c] || 0), per: per[c] }); });
    if (issues.length) return fail();
    var id = identify(M, state);
    id.bad.forEach(function (b) { I('v.pieceBad', { piece: 'piece.' + b.cls, colors: b.colors }, b.ids); });
    id.dup.forEach(function (d) { I('v.pieceDup', { piece: 'piece.' + d.cls, colors: d.colors }, d.ids); });
    if (issues.length) return fail();
    // 固定块（金字塔轴心块的位置、斜转 UFR 角）不在原位 → 拿的方向不对
    var lab = id.lab;
    if (M.fixedCheck && !M.fixedCheck(lab)) { I(M.holdIssue, {}); return fail(); }
    M.comps.forEach(function (c) {
      enumerate(M, c);
      if (c.index.has(compKeyFromLabels(c, lab))) return;
      // 诊断：只看位置（忽略朝向）是否可达
      if (!c.permSet) {
        c.permSet = new Set();
        c.keys.forEach(function (k) { c.permSet.add(permSig(c, k.split(',').map(Number))); });
      }
      var ls = compKeyFromLabels(c, lab).split(',').map(Number), ids = [];
      c.classes.forEach(function (cl) { cl.slots.forEach(function (sl) { ids.push.apply(ids, sl); }); });
      if (c.permSet.has(permSig(c, ls))) I(c.classes[0].L === 2 ? 'v.flip' : 'v.twist', {});
      else I('v.parity', {});
    });
    if (issues.length) return fail();
    return { ok: true, issues: [], errors: [], marks: [] };
  }
  function permSig(c, labels) {
    var q = 0, out = [];
    c.classes.forEach(function (cl) { cl.slots.forEach(function () { out.push(cl.labelOf[labels[q++]][0]); }); });
    return out.join(',');
  }

  // ================================================================ 金字塔 Pyraminx
  function pyraminx() {
    var R = 2.35, r = 2 * Math.SQRT2 / 3 * R, h = -R / 3;
    var Vx = { U: [0, R, 0], B: [0, h, -r], L: [-r * Math.sqrt(3) / 2, h, r / 2], R: [r * Math.sqrt(3) / 2, h, r / 2] };
    // 面：前 F（U L R）绿、左 L（U B L）红、右 R（U R B）蓝、底 D（L B R）黄 —— WCA 打乱图配色
    var FACES = [['F', ['U', 'L', 'R'], 'G'], ['L', ['U', 'B', 'L'], 'R'], ['R', ['U', 'R', 'B'], 'B'], ['D', ['L', 'B', 'R'], 'Y']];
    // 展开图（单位边长，y 向下）：F 正立居中，L / R 在两侧倒立，D 在下方倒立
    var hh = Math.sqrt(3) / 2;
    var NET = { F: { U: [1, 0], L: [0.5, hh], R: [1.5, hh] }, L: { U: [1, 0], B: [0, 0], L: [0.5, hh] }, R: { U: [1, 0], R: [1.5, hh], B: [2, 0] }, D: { L: [0.5, hh], B: [1, 2 * hh], R: [1.5, hh] } };
    var stickers = [], faces = [];
    FACES.forEach(function (F) {
      var f = F[0], vn = F[1], A = Vx[vn[0]], B = Vx[vn[1]], C = Vx[vn[2]], ids = [];
      var A2 = NET[f][vn[0]], B2 = NET[f][vn[1]], C2 = NET[f][vn[2]];
      function P(i, j, k) { return lerp3(A, B, C, i, j, k, 3); }
      function P2(i, j, k) { return [(A2[0] * i + B2[0] * j + C2[0] * k) / 3, (A2[1] * i + B2[1] * j + C2[1] * k) / 3]; }
      var list = [];
      // 上三角（i+j+k=2）：角上的 = 顶角块，其余 = 棱块；下三角（i+j+k=1）= 轴心块
      for (var i = 2; i >= 0; i--) for (var j = 2 - i; j >= 0; j--) {
        var k = 2 - i - j, tri = [[i + 1, j, k], [i, j + 1, k], [i, j, k + 1]], piece;
        if (i === 2) piece = 'T' + vn[0]; else if (j === 2) piece = 'T' + vn[1]; else if (k === 2) piece = 'T' + vn[2];
        else { var e = []; if (i) e.push(vn[0]); if (j) e.push(vn[1]); if (k) e.push(vn[2]); piece = 'E' + e.sort().join(''); }
        list.push({ tri: tri, piece: piece });
      }
      for (i = 1; i >= 0; i--) for (j = 1 - i; j >= 0; j--) {
        k = 1 - i - j;
        var tri2 = [[i, j + 1, k + 1], [i + 1, j, k + 1], [i + 1, j + 1, k]];
        list.push({ tri: tri2, piece: 'A' + (i ? vn[0] : j ? vn[1] : vn[2]) });
      }
      // 面内顺序：按展开图从上到下、从左到右（编辑器 / 测试可读）
      list.forEach(function (it) { it.c2 = avg(it.tri.map(function (b) { var p = P2(b[0], b[1], b[2]); return [p[0], p[1], 0]; })); });
      list.sort(function (a, b) { return Math.abs(a.c2[1] - b.c2[1]) > 1e-6 ? a.c2[1] - b.c2[1] : a.c2[0] - b.c2[0]; });
      list.forEach(function (it, q) {
        ids.push(stickers.length);
        stickers.push({ id: f + (q + 1), face: f, piece: it.piece, poly: it.tri.map(function (b) { return P(b[0], b[1], b[2]); }), net: it.tri.map(function (b) { return P2(b[0], b[1], b[2]); }) });
      });
      faces.push({ id: f, color: F[2], stickers: ids, vertices: vn, normal: norm(cross(sub(B, A), sub(C, A))) });
    });
    faces.forEach(function (f) { if (dot(f.normal, Vx[f.vertices[0]]) < -1e-9 || dot(f.normal, avg(f.vertices.map(function (v) { return Vx[v]; }))) < 0) f.normal = mul(f.normal, -1); });
    var faceColor = {}; FACES.forEach(function (F) { faceColor[F[0]] = F[2]; });
    var moves = {};
    ['U', 'L', 'R', 'B'].forEach(function (v) {
      var big = ['T' + v, 'A' + v], others = ['U', 'L', 'R', 'B'].filter(function (w) { return w !== v; });
      others.forEach(function (w) { big.push('E' + [v, w].sort().join('')); });
      var lo = v.toLowerCase();
      // 顺时针（从顶点外侧看）= 绕外向轴转 −120°
      moves[v] = { axis: Vx[v], angle: -2 * Math.PI / 3, pieces: big, inverse: v + "'", base: v, kind: 'layer', vertex: v };
      moves[v + "'"] = { axis: Vx[v], angle: 2 * Math.PI / 3, pieces: big, inverse: v, base: v, kind: 'layer', vertex: v };
      moves[lo] = { axis: Vx[v], angle: -2 * Math.PI / 3, pieces: ['T' + v], inverse: lo + "'", base: lo, kind: 'tip', vertex: v };
      moves[lo + "'"] = { axis: Vx[v], angle: 2 * Math.PI / 3, pieces: ['T' + v], inverse: lo, base: lo, kind: 'tip', vertex: v };
    });
    var EDGES = ['BL', 'BR', 'BU', 'LR', 'LU', 'RU'];
    var M = build({
      id: 'pyraminx', stickers: stickers, faceColor: faceColor, faces: faces, moves: moves,
      classes: [{ name: 'edge', keys: EDGES.map(function (e) { return 'E' + e; }) }, { name: 'axial', keys: ['AU', 'AL', 'AR', 'AB'] }, { name: 'tip', keys: ['TU', 'TL', 'TR', 'TB'] }],
      components: [['edge'], ['axial'], ['tip']]
    });
    M.vertices = Vx; M.R = R;
    M.coreComps = [0, 1];
    // 求解器的转动集合只用大层（8 个）；顶角在最后用 u/l/r/b 补齐
    M.order = ['U', "U'", 'L', "L'", 'R', "R'", 'B', "B'"];
    // 轴心块只能原地扭转：任一轴心块不在原位置 = 握法（哪面朝前）不对
    M.holdIssue = 'v.holdPyr';
    var axial = M.classMap.axial;
    M.fixedCheck = function (lab) { return axial.slots.every(function (sl, p) { return axial.labelOf[lab[sl[0]]][0] === p; }); };
    M.finish = function (st) {
      var out = [];
      ['u', 'l', 'r', 'b'].forEach(function (t) {
        if (isTipSolved(st, t)) return;
        var a = M.apply(st, [t]);
        if (isTipSolved(a, t)) { out.push(t); st = a; } else { out.push(t + "'"); st = M.apply(st, [t + "'"]); }
      });
      return out;
    };
    function isTipSolved(st, t) {
      var sl = M.pieces[M.pieceIdx['T' + t.toUpperCase()]].stickers;
      return sl.every(function (i) { return st[i] === M.stickers[i].color; });
    }
    return M;
  }

  // ================================================================ 斜转 Skewb
  function skewb() {
    var H = 1.5;
    var FN = { U: [0, 1, 0], D: [0, -1, 0], R: [1, 0, 0], L: [-1, 0, 0], F: [0, 0, 1], B: [0, 0, -1] };
    // 展开图：每个面的左上角 + 向右 / 向下的 3D 单位向量（与 3×3 展开图一致：U 在 F 上方）
    var NETF = {
      U: { tl: [-H, H, -H], r: [1, 0, 0], d: [0, 0, 1], off: [1, 0] }, L: { tl: [-H, H, -H], r: [0, 0, 1], d: [0, -1, 0], off: [0, 1] },
      F: { tl: [-H, H, H], r: [1, 0, 0], d: [0, -1, 0], off: [1, 1] }, R: { tl: [H, H, H], r: [0, 0, -1], d: [0, -1, 0], off: [2, 1] },
      B: { tl: [H, H, -H], r: [-1, 0, 0], d: [0, -1, 0], off: [3, 1] }, D: { tl: [-H, -H, H], r: [1, 0, 0], d: [0, 0, -1], off: [1, 2] }
    };
    var SCHEME = { U: 'W', R: 'R', F: 'G', D: 'Y', L: 'O', B: 'B' }, ORDER = ['U', 'R', 'F', 'D', 'L', 'B'];
    function cornerName(p) { return (p[1] > 0 ? 'U' : 'D') + (p[2] > 0 ? 'F' : 'B') + (p[0] > 0 ? 'R' : 'L'); }
    var stickers = [], faces = [];
    ORDER.forEach(function (f) {
      var o = NETF[f], ids = [], W = 2 * H;
      function P(x, y) { return add(o.tl, add(mul(o.r, x * W), mul(o.d, y * W))); }   // x,y ∈ [0,1]
      function N2(x, y) { return [o.off[0] + x, o.off[1] + y]; }
      var parts = [
        { name: 'C', uv: [[0.5, 0], [1, 0.5], [0.5, 1], [0, 0.5]] },
        { name: 'TL', uv: [[0, 0], [0.5, 0], [0, 0.5]], corner: [0, 0] }, { name: 'TR', uv: [[1, 0], [1, 0.5], [0.5, 0]], corner: [1, 0] },
        { name: 'BR', uv: [[1, 1], [0.5, 1], [1, 0.5]], corner: [1, 1] }, { name: 'BL', uv: [[0, 1], [0, 0.5], [0.5, 1]], corner: [0, 1] }
      ];
      parts.forEach(function (pt, q) {
        var piece = pt.corner ? 'K' + cornerName(P(pt.corner[0], pt.corner[1])) : 'C' + f;
        ids.push(stickers.length);
        stickers.push({ id: f + (q + 1), face: f, piece: piece, poly: pt.uv.map(function (u) { return P(u[0], u[1]); }), net: pt.uv.map(function (u) { return N2(u[0], u[1]); }) });
      });
      faces.push({ id: f, color: SCHEME[f], stickers: ids, normal: FN[f], center: ids[0] });
    });
    var moves = {};
    // WCA：R = DRB 角，U = ULB 角，L = DFL 角，B = DBL 角；顺时针 = 从该角外侧看
    var AX = { R: [1, -1, -1], U: [-1, 1, -1], L: [-1, -1, 1], B: [-1, -1, -1] };
    Object.keys(AX).forEach(function (t) {
      var a = AX[t], pcs = [];
      ['U', 'D', 'R', 'L', 'F', 'B'].forEach(function (f) { if (dot(FN[f], a) > 0) pcs.push('C' + f); });
      [-1, 1].forEach(function (x) { [-1, 1].forEach(function (y) { [-1, 1].forEach(function (z) { var p = [x, y, z]; if (dot(p, a) > 0) pcs.push('K' + cornerName(p)); }); }); });
      moves[t] = { axis: a, angle: -2 * Math.PI / 3, pieces: pcs, inverse: t + "'", base: t, kind: 'layer', vertex: t };
      moves[t + "'"] = { axis: a, angle: 2 * Math.PI / 3, pieces: pcs, inverse: t, base: t, kind: 'layer', vertex: t };
    });
    var cornerKeys = [];
    [-1, 1].forEach(function (x) { [-1, 1].forEach(function (y) { [-1, 1].forEach(function (z) { cornerKeys.push('K' + cornerName([x, y, z])); }); }); });
    var M = build({
      id: 'skewb', stickers: stickers, faceColor: SCHEME, faces: faces, moves: moves,
      classes: [{ name: 'center', keys: ORDER.map(function (f) { return 'C' + f; }) }, { name: 'corner', keys: cornerKeys }],
      components: [['center'], ['corner']]
    });
    M.coreComps = [0, 1];
    M.holdIssue = 'v.holdSkewb';
    var corner = M.classMap.corner, ufr = corner.keys.indexOf('KUFR');
    // UFR 角在 WCA 记号下永不移动：它不在原位或被扭转 = 握法不对
    M.fixedCheck = function (lab) { return lab[corner.slots[ufr][0]] === corner.slots[ufr][0]; };
    return M;
  }

  var cache = {};
  function get(id) {
    if (!cache[id]) cache[id] = id === 'pyraminx' ? pyraminx() : skewb();
    return cache[id];
  }
  var API = {
    get: get, buildTable: buildTable, solve: solve, validate: validate, identify: identify, randomState: randomState,
    enumerate: function (M, c) { return enumerate(M, c); }, coreIndex: coreIndex, COLORS: COLORS,
    vec: { add: add, sub: sub, mul: mul, dot: dot, cross: cross, norm: norm, rot: rot, avg: avg }
  };
  root.TwistyModel = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof self !== 'undefined' ? self : typeof window !== 'undefined' ? window : globalThis);
