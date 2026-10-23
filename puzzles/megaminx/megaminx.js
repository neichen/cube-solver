/*
 * 五魔方（Megaminx）插件。实现 CubeLab Puzzle 接口（见 README.md / docs/DEVELOPMENT.md）。
 * 模型（几何、置换、校验、随机状态、Pochmann 打乱）在 megaminx-model.js；
 * 多阶段求解器在 megaminx-solver.js（Web Worker：megaminx.worker.js，Node 测试共用）。
 */
(function (root) {
  'use strict';
  var CL = root.CubeLab, MM = root.MegaminxModel || (typeof require !== 'undefined' ? require('./megaminx-model.js') : null);
  var V = MM.vec;
  function T(k, p) { return CL.t ? CL.t(k, p) : k; }
  function i18nProp(o, prop, key) { Object.defineProperty(o, prop, { get: function () { return T(typeof key === 'function' ? key() : key); }, enumerable: true, configurable: true }); return o; }
  function circumcircle(a, b, c) {
    var d = 2 * (a[0] * (b[1] - c[1]) + b[0] * (c[1] - a[1]) + c[0] * (a[1] - b[1]));
    var a2 = a[0] * a[0] + a[1] * a[1], b2 = b[0] * b[0] + b[1] * b[1], c2 = c[0] * c[0] + c[1] * c[1];
    var ux = (a2 * (b[1] - c[1]) + b2 * (c[1] - a[1]) + c2 * (a[1] - b[1])) / d, uy = (a2 * (c[0] - b[0]) + b2 * (a[0] - c[0]) + c2 * (b[0] - a[0])) / d;
    return [ux, uy, Math.hypot(a[0] - ux, a[1] - uy)];
  }
  function rotAxis(p, o, k, a) {   // 绕过点 o、方向 k（单位）的轴把 p 转 a
    var v = V.sub(p, o), c = Math.cos(a), s = Math.sin(a), kv = V.dot(k, v), kx = V.cross(k, v);
    return V.add(o, [v[0] * c + kx[0] * s + k[0] * kv * (1 - c), v[1] * c + kx[1] * s + k[1] * kv * (1 - c), v[2] * c + kx[2] * s + k[2] * kv * (1 - c)]);
  }

  function make() {
    var M = MM;
    var colors = {}; M.SCHEME.forEach(function (c) { colors[c] = { name: c, hex: M.COLORS[c].hex }; });
    var stickers = M.stickers.map(function (s, i) {
      return { id: s.id, face: s.face, pos: V.sub(s.centroid, V.mul(s.normal, 0.5)), normal: s.normal, poly: s.poly, locked: false, piece: M.pieceOf[i] };
    });
    var faces = M.faces.map(function (f) {
      return i18nProp({ id: f.id, normal: f.normal, stickers: f.stickers.slice(), center: f.center }, 'name', 'face.megaminx.' + f.id);
    });
    var pieces = M.pieces.map(function (pc) { return { pos: pc.pos, stickers: pc.stickers.slice(), key: pc.key }; });
    var posKey = function (p) { return p.map(function (x) { return x.toFixed(4); }).join(','); };
    var idxOfPos = {}; pieces.forEach(function (pc, i) { idxOfPos[posKey(pc.pos)] = i; });   // pieceSet 以块序号为键
    var moves = {};
    M.allMoves.forEach(function (t) {
      var m = M.moves[t], set = m.pieceSet;
      moves[t] = { base: m.kind === 'pochmann' ? null : m.face, bases: [m.face], face: m.face, perm: m.perm, axis: m.axis, angle: m.angle, inverse: m.inverse, kind: m.kind, amount: m.amount,
        layer: function (p) { return !!set[idxOfPos[posKey(p)]]; } };
    });

    // ------------------------------------------------------------ 展开图：U 花（U + 5 个上层面）与 D 花（D + 5 个下层面），都从外面看
    function flower(cf, down) {
      var C = M.faces[M.FI[cf]], n = C.normal, d = V.norm(V.sub(down, V.mul(n, V.dot(down, n)))), r = V.cross(n, d);
      var out = {};
      function put(fi, map) { M.faces[fi].stickers.forEach(function (si) { out[si] = M.stickers[si].poly.map(function (p) { var q = map(p); return [V.dot(q, r), V.dot(q, d)]; }); }); }
      put(C.index, function (p) { return p; });
      C.neighbors.forEach(function (ni) {
        var N = M.faces[ni];
        // 共边的两个顶点
        var sh = N.vertices.filter(function (a) { return C.vertices.some(function (b) { return V.len(V.sub(a, b)) < 1e-6; }); });
        var k = V.norm(V.sub(sh[1], sh[0])), ang = Math.acos(Math.max(-1, Math.min(1, V.dot(N.normal, n))));
        var a = V.len(V.sub(rotAxis(N.normal, [0, 0, 0], k, ang), n)) < 1e-6 ? ang : -ang;
        put(ni, function (p) { return rotAxis(p, sh[0], k, a); });
      });
      return out;
    }
    var fu = flower('U', [0, 0, 1]), fd = flower('D', [0, 0, -1]);
    function bb(o) { var xs = [], ys = []; Object.keys(o).forEach(function (k) { o[k].forEach(function (p) { xs.push(p[0]); ys.push(p[1]); }); }); return [Math.min.apply(null, xs), Math.min.apply(null, ys), Math.max.apply(null, xs), Math.max.apply(null, ys)]; }
    var bu = bb(fu), bd = bb(fd), gapX = 0.12, dx = bu[2] - bd[0] + gapX, dy = (bu[1] + bu[3]) / 2 - (bd[1] + bd[3]) / 2 + 0.55;
    var polys = M.stickers.map(function (s, i) {
      var pts = fu[i] ? fu[i] : fd[i].map(function (p) { return [p[0] + dx, p[1] + dy]; });
      return { sticker: i, pts: pts };
    });
    var all = []; polys.forEach(function (p) { all.push.apply(all, p.pts); });
    var X = all.map(function (p) { return p[0]; }), Y = all.map(function (p) { return p[1]; }), pad = 0.05;
    var x0 = Math.min.apply(null, X) - pad, y0 = Math.min.apply(null, Y) - pad;
    var netLayout = { polys: polys, viewBox: [x0, y0, Math.max.apply(null, X) + pad - x0, Math.max.apply(null, Y) + pad - y0], gap: 0.86, maxWidth: 760 };

    /*
     * 图视图：把每张贴纸放到单位球上——中心贴纸在面法线，棱贴纸在「邻面锥」上、角贴纸在两个邻面锥的交点上
     * （锥 = 与该面法线成 θ 角的圆）。于是每个面转动的 15 张侧面贴纸都在它的锥上，本面 5 棱 / 5 角也各在一个
     * 绕法线的圆上；再从 D 中心做球极投影（保圆），所有轨道都是平面上的圆——U 在正中、5 个上层面的圆环绕、
     * 5 个下层面的大圆在外、D 层是外圈同心圆，与参考视频的「五瓣花」结构一致。D 的中心贴纸投影到无穷远，不画。
     */
    var gl = null, THETA = +(root.MEGA_THETA || 0.79), THETA_LOW = +(root.MEGA_THETA_LOW || 0.66);
    function graphLayout() {
      if (gl) return gl;
      var nU = M.faces[0].normal, pole = V.mul(nU, -1), e1 = [1, 0, 0], e2 = [0, 0, 1];
      // 每个面的锥角：下层 5 面略小，让 D 层外圈不至于离中心太远（球极投影在 D 附近放大很多）
      var TH = M.faces.map(function (f) { var y = f.normal[1]; return y > 0.9 ? THETA : y > 0 ? THETA : y > -0.9 ? THETA_LOW : THETA; });
      function onCones(fb, fc, near) {   // 单位向量 x：x·nb = cos θb，x·nc = cos θc，取靠近 near 的那个
        var nb = M.faces[fb].normal, nc = M.faces[fc].normal, cb = Math.cos(TH[fb]), cc = Math.cos(TH[fc]);
        var g = V.dot(nb, nc), det = 1 - g * g, a = (cb - g * cc) / det, b = (cc - g * cb) / det;
        var base = V.add(V.mul(nb, a), V.mul(nc, b)), w = V.cross(nb, nc);
        var t = Math.sqrt(Math.max(0, (1 - V.dot(base, base)) / V.dot(w, w)));
        var p1 = V.add(base, V.mul(w, t)), p2 = V.sub(base, V.mul(w, t));
        return V.dot(p1, near) > V.dot(p2, near) ? p1 : p2;
      }
      function onCone(fb, na) {   // na、nb 平面内、与 nb 成 θb、在 na 一侧
        var nb = M.faces[fb].normal, u = V.norm(V.sub(na, V.mul(nb, V.dot(na, nb))));
        return V.add(V.mul(nb, Math.cos(TH[fb])), V.mul(u, Math.sin(TH[fb])));
      }
      var sph = M.stickers.map(function (s) {
        var A = M.faces[s.faceIndex], others = s.touch.filter(function (f) { return f !== A.index; });
        if (!others.length) return A.normal;
        if (others.length === 1) return onCone(others[0], A.normal);
        return onCones(others[0], others[1], A.normal);
      });
      var S = 1;
      var nodes = sph.map(function (x) { var k = 1 + V.dot(x, nU); if (k < 1e-6) return [0, 0]; return [S * V.dot(x, e1) / k, S * V.dot(x, e2) / k]; });
      var hidden = [M.faces[M.FI.D].center];
      var circles = [], seen = {};
      def.tracks.forEach(function (tr) {
        if (tr.stickers.some(function (i) { return hidden.indexOf(i) >= 0; })) return;
        var c = circumcircle(nodes[tr.stickers[0]], nodes[tr.stickers[1]], nodes[tr.stickers[2]]);
        var k = c.map(function (x) { return x.toFixed(3); }).join();
        if (seen[k]) return; seen[k] = 1;
        circles.push({ id: 'c' + circles.length, cx: c[0], cy: c[1], r: c[2] });
      });
      var dmin = 1e9;
      for (var i = 0; i < nodes.length; i++) for (var j = i + 1; j < nodes.length; j++) if (hidden.indexOf(i) < 0 && hidden.indexOf(j) < 0) dmin = Math.min(dmin, Math.hypot(nodes[i][0] - nodes[j][0], nodes[i][1] - nodes[j][1]));
      var R = dmin * 0.4;
      gl = { nodes: nodes, hidden: hidden, circles: circles, nodeRadius: R, nodeStroke: R * 0.3, trackWidth: R * 0.3, activeWidth: R * 0.42,
        frame: { width: 0.9, height: 0.92 }, clusters: faces.map(function (f) { return f.stickers; }), trailSegments: 8, zoomable: true };
      return gl;
    }

    // ------------------------------------------------------------ 记号
    function parse(str) {
      var toks = String(str || '').replace(/[’`´′]/g, "'").replace(/\+\+/g, '++').trim().split(/\s+/).filter(Boolean);
      return toks.map(function (t0) {
        var t = t0.replace(/^([A-Za-z]+)'2$/, "$1 2'").replace(' ', '');
        t = t.replace(/^([a-z]+)/, function (x) { return x.toUpperCase(); });
        if (!moves[t]) { var e = new Error('无法识别的转动符号「' + t0 + '」'); e.i18n = { k: 'formula.badMove', p: { tok: t0 } }; throw e; }
        return t;
      });
    }
    function describe(tok) {
      var m = moves[tok]; if (!m) return tok;
      if (m.kind === 'pochmann') return T('move.mega.pochmann', { m: tok, f: T('face.megaminx.' + (tok[0] === 'R' ? 'L' : 'U')) });
      var p = { f: T('face.megaminx.' + m.face) }, cw = m.angle < 0;
      return T(m.amount === 2 ? (cw ? 'move.mega.cw2' : 'move.mega.ccw2') : (cw ? 'move.mega.cw' : 'move.mega.ccw'), p);
    }
    var notationRows = [['U F R L BL BR', 'notation.mega.upper'], ['D FL FR DL DR B', 'notation.mega.lower'], ["X X' X2 X2'", 'notation.mega.dir'], ['R++ R-- D++ D--', 'notation.mega.pochmann']];

    var solverDef = { id: 'multiphase', nameKey: 'solver.megaminx', workerUrl: 'puzzles/megaminx/megaminx.worker.js', available: true, metric: 'HTM',
      encode: function (state) { var v = M.validate(state); if (!v.ok) throw new Error(v.errors.join('\n')); return { state: state }; } };

    var view3d = {
      geometry: 'poly', solid: M.faces.map(function (f) { return { n: f.normal, c: 1 }; }),
      cuts: M.faces.map(function (f) { return { n: f.normal, c: M.CUT }; }),
      core: [0, 0, 0], stickerMargin: 0.035, stickerRadius: 0.035, bodyColor: 0x18181a,
      camera: { fov: 24, dir: [0.55, 0.9, 1] }, fit: [2.9, 2.9], frame: { width: 0.74, height: 0.84 },
      autoRotate: { swayYaw: 0.12, swayPitch: 0.04, period: 9, showcaseMs: 2000, showcaseDelay: 1200, showcaseAxis: [0, 1, 0] }
    };

    var LET = { U: 'U', F: 'F', R: 'R', L: 'L', B: 'B', D: 'D', I: 'BL', O: 'BR', J: 'FL', K: 'FR', N: 'DL', M: 'DR' };
    var def = {
      id: 'megaminx', short: 'Megaminx', order: 102, nameKey: 'puzzle.megaminx', twisty: true, megaminx: true,
      colors: colors, blankColor: '#cfcfc6',
      stickers: stickers, faces: faces, pieces: pieces, moves: moves,
      trackMoves: M.FACES.slice(), trackMode: 'cycles',
      dragMoves: M.faceMoves.filter(function (t) { return moves[t].amount === 1; }),
      playKeys: { letters: Object.keys(LET).join(''), map: LET, double: true },
      playMetric: 'HTM', metricTitle: { HTM: 'metric.HTM.megaminx' },
      hints: { graph: 'stage.graphHint.megaminx', notation: 'notation.hint.megaminx', paint: 'paint.hint.megaminx', formula: 'formula.hint.megaminx', play: 'play.hint.megaminx' },
      holdIssue: 'v.megaCenters',
      parse: parse,
      solvedState: function () { return M.solvedState(); },
      randomScramble: function (rnd) { return M.pochmannScramble(rnd); },
      validate: function (state) { return M.validate(state); },
      describeMove: describe,
      netLayout: netLayout,
      graphLayout: graphLayout,
      cameraPlan: null,
      notationRows: notationRows,
      view3d: view3d,
      solvers: [solverDef],
      model: M
    };
    i18nProp(def, 'name', 'puzzle.megaminx');
    Object.defineProperty(def, 'notation', { get: function () { return notationRows.map(function (r) { return [r[0], T(r[1])]; }); }, enumerable: true });
    def.solvers.forEach(function (sv) { i18nProp(sv, 'name', sv.nameKey); });
    return def;
  }
  CL.registerPuzzleFactory({ id: 'megaminx', short: 'Megaminx', order: 102, nameKey: 'puzzle.megaminx' }, make);
})(typeof window !== 'undefined' ? window : globalThis);
