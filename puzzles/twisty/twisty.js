/*
 * 金字塔（Pyraminx）与斜转（Skewb）插件。实现 CubeLab Puzzle 接口（见 README.md）。
 * 模型、几何置换、校验、最优求解都在 puzzles/twisty/twisty-model.js（Worker 与 Node 测试共用）。
 */
(function (root) {
  'use strict';
  var CL = root.CubeLab, TM = root.TwistyModel || (typeof require !== 'undefined' ? require('./twisty-model.js') : null);
  var V = TM.vec;
  function T(k, p) { return CL.t ? CL.t(k, p) : k; }
  function i18nProp(o, prop, key) { Object.defineProperty(o, prop, { get: function () { return T(typeof key === 'function' ? key() : key); }, enumerable: true, configurable: true }); return o; }

  function circumcircle(a, b, c) {
    var d = 2 * (a[0] * (b[1] - c[1]) + b[0] * (c[1] - a[1]) + c[0] * (a[1] - b[1]));
    var a2 = a[0] * a[0] + a[1] * a[1], b2 = b[0] * b[0] + b[1] * b[1], c2 = c[0] * c[0] + c[1] * c[1];
    var ux = (a2 * (b[1] - c[1]) + b2 * (c[1] - a[1]) + c2 * (a[1] - b[1])) / d, uy = (a2 * (c[0] - b[0]) + b2 * (a[0] - c[0]) + c2 * (b[0] - a[0])) / d;
    return [ux, uy, Math.hypot(a[0] - ux, a[1] - uy)];
  }

  function make(id) {
    var M = TM.get(id), pyr = id === 'pyraminx';
    var colors = {}; M.faces.forEach(function (f) { colors[f.color] = TM.COLORS[f.color]; });
    // 贴纸：pos 取「质心 − 法线/2」，于是 CL.stickerPoint(s) = 贴纸质心（轨道 / 拖动 / 投影都用它）
    var stickers = M.stickers.map(function (s) {
      return { id: s.id, face: s.face, pos: V.sub(s.centroid, V.mul(s.normal, 0.5)), normal: s.normal, poly: s.poly, locked: false, piece: s.piece };
    });
    var faces = M.faces.map(function (f) {
      return i18nProp({ id: f.id, normal: f.normal, stickers: f.stickers.slice(), center: f.center }, 'name', 'face.' + id + '.' + f.id);
    });
    var pieces = M.pieces.map(function (pc) { return { pos: pc.pos, stickers: pc.stickers.slice(), key: pc.key }; });
    var posKey = function (p) { return p.map(function (x) { return x.toFixed(4); }).join(','); };
    var keyOfPos = {}; pieces.forEach(function (pc) { keyOfPos[posKey(pc.pos)] = pc.key; });
    var moves = {};
    M.allMoves.forEach(function (t) {
      var m = M.moves[t], set = {}; m.pieceKeys.forEach(function (k) { set[k] = true; });
      moves[t] = { base: m.base, face: null, perm: m.perm, axis: m.axis, angle: m.angle, inverse: m.inverse, kind: m.kind, vertex: m.vertex,
        layer: function (p) { return !!set[keyOfPos[posKey(p)]]; } };
    });

    // 展开图（SVG 多边形）
    var polys = M.stickers.map(function (s, i) { return { sticker: i, pts: s.net ? s.net : null }; });
    var netPts = [];
    // twisty-model 把 2D 展开图坐标保存在 spec 里；这里从 stickers 取回
    var src = M.netSrc;
    polys.forEach(function (p, i) { p.pts = src[i]; p.pts.forEach(function (q) { netPts.push(q); }); });
    var xs = netPts.map(function (p) { return p[0]; }), ys = netPts.map(function (p) { return p[1]; });
    var pad = 0.04, x0 = Math.min.apply(null, xs) - pad, y0 = Math.min.apply(null, ys) - pad;
    var netLayout = { polys: polys, viewBox: [x0, y0, Math.max.apply(null, xs) + pad - x0, Math.max.apply(null, ys) + pad - y0], gap: pyr ? 0.84 : 0.86, maxWidth: pyr ? 520 : 600 };

    /*
     * 图视图：节点 = 展开图上的贴纸中心；每个 120° 转动把贴纸分成若干个 3-轮换，每个轮换画成过这 3 个节点的圆
     * （3 点总在一个圆上，节点沿圆弧滑动）。金字塔的展开图里 U/L/R 三个顶点各是一组同心圆的圆心，
     * B 顶点被展开成大三角形的三个角，B 层的轨道是以大三角形中心为圆心的同心圆——与 3×3 的「三组同心圆」同构。
     */
    var gl = null;
    function graphLayout() {
      if (gl) return gl;
      var nodes = polys.map(function (p) { var c = [0, 0]; p.pts.forEach(function (q) { c[0] += q[0] / p.pts.length; c[1] += q[1] / p.pts.length; }); return c; });
      var S = 3, circles = [], seen = {};
      nodes = nodes.map(function (n) { return [n[0] * S, n[1] * S]; });
      if (!pyr) {
        // 斜转：从 DBL 角（B 转轴）方向做等距方位投影（半径 θ^0.85）。B 层的轨道是同心圆，R / U / L 三组轨道
        // 呈三重对称的「三瓣花」，与 3×3 图视图的三组同心圆同一风格；固定角 UFR 的贴纸在最外圈。
        var pole = V.norm([-1, -1, -1]), e1 = V.norm(V.cross(pole, [1, 0, 0])), e2 = V.cross(pole, e1);
        nodes = M.stickers.map(function (st) {
          var d = V.norm(st.centroid), th = Math.acos(Math.max(-1, Math.min(1, V.dot(d, pole)))), az = Math.atan2(V.dot(d, e2), V.dot(d, e1));
          var r = Math.pow(th, 0.85) * 1.6;
          return [r * Math.cos(az), -r * Math.sin(az)];
        });
      }
      def.tracks.forEach(function (tr) {
        var c = circumcircle(nodes[tr.stickers[0]], nodes[tr.stickers[1]], nodes[tr.stickers[2]]);
        var k = c.map(function (x) { return x.toFixed(4); }).join();
        if (seen[k]) return; seen[k] = 1;
        circles.push({ id: 'c' + circles.length, cx: c[0], cy: c[1], r: c[2] });
      });
      var dmin = 1e9;
      for (var i = 0; i < nodes.length; i++) for (var j = i + 1; j < nodes.length; j++) dmin = Math.min(dmin, Math.hypot(nodes[i][0] - nodes[j][0], nodes[i][1] - nodes[j][1]));
      var R = dmin * (pyr ? 0.34 : 0.36);
      gl = { nodes: nodes, circles: circles, nodeRadius: R, nodeStroke: R * 0.3, trackWidth: R * 0.36, activeWidth: R * 0.46,
        frame: { width: 0.86, height: 0.9 }, clusters: faces.map(function (f) { return f.stickers; }), trailSegments: 8 };
      return gl;
    }

    // 记号 / 描述
    function describe(tok) {
      var m = moves[tok]; if (!m) return tok;
      var p = { v: T((pyr ? 'vertex.' : 'corner.') + m.vertex) };
      var cw = m.angle < 0;
      if (pyr && m.kind === 'tip') return T(cw ? 'move.pyr.tipCw' : 'move.pyr.tipCcw', p);
      return T(pyr ? (cw ? 'move.pyr.cw' : 'move.pyr.ccw') : (cw ? 'move.skewb.cw' : 'move.skewb.ccw'), p);
    }
    var notationRows = pyr ? [['U L R B', 'notation.pyr.layers'], ['u l r b', 'notation.pyr.tips'], ["X / X'", 'notation.pyr.dir']]
      : [['R U L B', 'notation.skewb.layers'], ["X / X'", 'notation.skewb.dir'], ['UFR', 'notation.skewb.fixed']];

    var solverDef = { id: 'optimal', nameKey: 'solver.optimalTwisty', workerUrl: 'puzzles/twisty/twisty.worker.js?p=' + id, available: true, metric: 'VTM',
      encode: function (state) { var v = TM.validate(M, state); if (!v.ok) { var e = new Error(v.errors.join('\n')); throw e; } return { puzzle: id, state: state }; } };

    var view3d = pyr ? {
      geometry: 'poly', solid: M.faces.map(function (f) { return { n: f.normal, c: V.dot(f.normal, M.vertices[f.vertices[0]]) }; }),
      cuts: [].concat.apply([], ['U', 'L', 'R', 'B'].map(function (v) { var a = V.norm(M.vertices[v]); return [{ n: a, c: M.R / 9 }, { n: a, c: 5 * M.R / 9 }]; })),
      core: [0, 0, 0], stickerMargin: 0.05, stickerRadius: 0.07, bodyColor: 0x18181a,
      camera: { fov: 24, dir: [1.05, 0.45, 1] }, fit: [4.3, 4.1], frame: { width: 0.78, height: 0.84 },
      autoRotate: { swayYaw: 0.12, swayPitch: 0.04, period: 9, showcaseMs: 2000, showcaseDelay: 1200, showcaseAxis: [0, 1, 0] }
    } : {
      geometry: 'poly', solid: [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]].map(function (n) { return { n: n, c: 1.5 }; }),
      cuts: [[1, -1, -1], [-1, 1, -1], [-1, -1, 1], [-1, -1, -1]].map(function (a) { return { n: V.norm(a), c: 0 }; }),
      core: null, stickerMargin: 0.055, stickerRadius: 0.09, bodyColor: 0x18181a,
      camera: { fov: 24, dir: [1, 0.66, 1] }, frame: { width: 0.69, height: 0.80, dx: 0.01, dy: -0.024 },
      autoRotate: { swayYaw: 0.10, swayPitch: 0.035, period: 9, showcaseMs: 2000, showcaseDelay: 1200, showcaseAxis: [0.55, 1, 0.25] }
    };

    var def = {
      id: id, short: pyr ? 'Pyraminx' : 'Skewb', order: pyr ? 100 : 101, nameKey: 'puzzle.' + id, twisty: true,
      colors: colors, blankColor: '#cfcfc6',
      stickers: stickers, faces: faces, pieces: pieces, moves: moves,
      trackMoves: pyr ? ['U', 'L', 'R', 'B', 'u', 'l', 'r', 'b'] : ['R', 'U', 'L', 'B'], trackMode: 'cycles',
      dragMoves: M.allMoves.slice(),
      playKeys: pyr ? { letters: 'ULRB', tip: true } : { letters: 'RULB' },
      playMetric: 'VTM',
      hints: { graph: 'stage.graphHint.' + id, notation: 'notation.hint.' + id, paint: 'paint.hint.' + id, formula: 'formula.hint.' + id, play: 'play.hint.' + id },
      holdIssue: M.holdIssue,
      solvedState: function () { return M.solvedState(); },
      randomState: function (rnd) { return TM.randomState(M, rnd); },
      randomScramble: function (rnd) {
        // 公式框用的随机打乱：随机转动（不连续转同一轴），金字塔另加随机顶角
        rnd = rnd || Math.random; var out = [], prev = null, letters = pyr ? 'ULRB' : 'RULB', n = 11;
        while (out.length < n) { var L = letters[(rnd() * 4) | 0]; if (L === prev) continue; prev = L; out.push(L + (rnd() < 0.5 ? '' : "'")); }
        if (pyr) 'ulrb'.split('').forEach(function (t) { var k = (rnd() * 3) | 0; if (k) out.push(t + (k === 1 ? '' : "'")); });
        return out;
      },
      validate: function (state) { return TM.validate(M, state); },
      describeMove: describe,
      netLayout: netLayout,
      graphLayout: graphLayout,
      cameraPlan: null,
      notationRows: notationRows,
      view3d: view3d,
      solvers: [solverDef],
      model: M
    };
    i18nProp(def, 'name', 'puzzle.' + id);
    Object.defineProperty(def, 'notation', { get: function () { return notationRows.map(function (r) { return [r[0], T(r[1])]; }); }, enumerable: true });
    def.solvers.forEach(function (sv) { i18nProp(sv, 'name', sv.nameKey); });
    return def;
  }
  ['pyraminx', 'skewb'].forEach(function (id, k) {
    CL.registerPuzzleFactory({ id: id, short: id === 'pyraminx' ? 'Pyraminx' : 'Skewb', order: 100 + k, nameKey: 'puzzle.' + id }, function () { return make(id); });
  });
})(typeof window !== 'undefined' ? window : globalThis);
