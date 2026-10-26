/*
 * N×N 魔方插件（2×2 与 4×4 … 15×15；3×3 用 puzzles/cube3 的专用插件）。实现 CubeLab Puzzle 接口（见 README.md）。
 * 依赖：puzzles/nxn/nxn-model.js（NxNModel）、js/core/registry.js（CubeLab）。各阶在第一次选择时才构建。
 */
(function (root) {
  'use strict';
  var CL = root.CubeLab, X = root.NxNModel || (typeof require !== 'undefined' ? require('./nxn-model.js') : null);
  var FACES = X.FACES.split(''), dot = CL.vec.dot;
  function T(k, p) { return CL.t ? CL.t(k, p) : k; }
  function i18nProp(o, prop, key) { Object.defineProperty(o, prop, { get: function () { return T(typeof key === 'function' ? key() : key); }, enumerable: true, configurable: true }); return o; }
  var MIN = 2, MAX = 15;

  /** 低内存 / 移动设备：gullicube 默认用快速模式（约 0.6 GB 内存，步数多约 60%） */
  function lowMemory() {
    var nav = root.navigator || {};
    if (nav.deviceMemory && nav.deviceMemory < 4) return true;
    var ua = nav.userAgent || '';
    return /iPhone|iPad|iPod|Android/i.test(ua) || (/Macintosh/.test(ua) && nav.maxTouchPoints > 1);
  }
  CL.lowMemoryDevice = lowMemory;

  // 图视图参数（与 3×3 相同的参考视频布局，按阶数缩放层间距和节点大小）
  var GL = {
    rMid: 1.7696, span: 0.3774,
    family: { y: [0, -1], z: [-0.866, 0.5], x: [0.866, 0.5] },
    sign: { x: 1, y: 1, z: -1 },
    upper: { R: true, B: true, D: true, L: false, F: false, U: false },
    frame: { width: 0.83, height: 0.90, dx: -0.053, dy: -0.007 }
  };
  function circleIntersections(c1, r1, c2, r2) {
    var dx = c2[0] - c1[0], dy = c2[1] - c1[1], d = Math.hypot(dx, dy);
    var a = (r1 * r1 - r2 * r2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, r1 * r1 - a * a));
    var mx = c1[0] + a * dx / d, my = c1[1] + a * dy / d;
    return [[mx + h * dy / d, my - h * dx / d], [mx - h * dy / d, my + h * dx / d]];
  }
  var AXES = ['x', 'y', 'z'];

  function makePuzzle(n) {
    var M = X.build(n), nn = n * n, odd = n % 2 === 1, h = (n - 1) / 2;
    var stickers = M.geom.map(function (g, i) {
      var k = i % nn;
      return { id: g.f + (k + 1), face: g.f, pos: g.p.map(function (v) { return v / 2; }), normal: g.n.slice(), locked: odd && k === (nn - 1) / 2 };
    });
    var faces = FACES.map(function (f, fi) {
      var ids = []; for (var k = 0; k < nn; k++) ids.push(fi * nn + k);
      var F = { id: f, normal: X.FACE_NORMAL[f], stickers: ids };
      if (odd) F.center = fi * nn + (nn - 1) / 2;
      return i18nProp(F, 'name', 'move.side.' + f);
    });
    var pieceMap = {}, pieces = [];
    stickers.forEach(function (s, i) {
      var k = s.pos.join(',');
      if (!pieceMap[k]) { pieceMap[k] = { pos: s.pos.slice(), stickers: [] }; pieces.push(pieceMap[k]); }
      pieceMap[k].stickers.push(i);
    });
    var moves = {};
    M.order.forEach(function (t) {
      var m = M.moves[t], ax = m.axis, set = m.layerSet;
      moves[t] = {
        tok: t, face: m.face, kind: m.kind, depths: m.depths, perm: m.perm, axis: ax, angle: m.angle, inverse: m.inverse,
        bases: m.bases, base: m.base, slice: m.slice, wide: m.wide, rotation: m.rotation,
        layer: function (p) { return set[String(dot(p, ax))] === 1; }
      };
    });

    function describe(tok) {
      var t = X.normalize(n, tok) || tok, m = moves[t]; if (!m) return tok;
      var s = t.slice(-1), q = s === '2' ? 'half' : s === "'" ? 'ccw' : 'cw';
      if (m.kind === 'mid') {
        var f = t[0], sl = T('slice.' + f), base = { M: 'L', E: 'D', S: 'F' }[f];
        return q === 'half' ? T('move.sliceHalf', { slice: sl }) : q === 'ccw' ? T('move.sliceCcw', { slice: sl }) : T('move.sliceCw', { slice: sl, base: base, baseLayer: T('move.layer.' + base) });
      }
      var p = { layer: T('move.layer.' + m.face), side: T('move.side.' + m.face), k: m.depths.length === 1 ? m.depths[0] : m.depths.length, axis: t[0] };
      if (m.kind === 'outer') return T('move.' + q, p);
      return T('move.' + m.kind + '.' + q, p);
    }

    var NET_OFF = { U: [n, 0], L: [0, n], F: [n, n], R: [2 * n, n], B: [3 * n, n], D: [n, 2 * n] };
    var netLayout = { cols: 4 * n, rows: 3 * n, cells: stickers.map(function (s, i) {
      var o = NET_OFF[s.face], k = i % nn; return { sticker: i, col: o[0] + k % n, row: o[1] + ((k / n) | 0) };
    }) };

    function graphLayout() {
      var sc = 1 / Math.max(h, 1), rad = function (a, c) { return GL.rMid + GL.sign[a] * (c / h) * GL.span; };
      var nodes = [], circles = [], faceCenters = {};
      AXES.forEach(function (a) {
        for (var c = -h; c <= h + 1e-9; c += 1) { var f = GL.family[a]; circles.push({ id: a + c, axis: a, layer: c, cx: f[0], cy: f[1], r: rad(a, c) }); }
      });
      function pick(face, a1, a2, r1, r2) {
        var F1 = GL.family[a1], F2 = GL.family[a2];
        var mid = circleIntersections(F1, GL.rMid, F2, GL.rMid);
        var ref = (mid[0][1] < mid[1][1]) === GL.upper[face] ? mid[0] : mid[1];
        if (r1 == null) return ref;
        var pts = circleIntersections(F1, r1, F2, r2);
        var d0 = Math.hypot(pts[0][0] - ref[0], pts[0][1] - ref[1]), d1 = Math.hypot(pts[1][0] - ref[0], pts[1][1] - ref[1]);
        return d0 < d1 ? pts[0] : pts[1];
      }
      stickers.forEach(function (s, i) {
        var na = s.normal.findIndex(function (v) { return v !== 0; });
        var ax = AXES.filter(function (_, k) { return k !== na; }), a1 = ax[0], a2 = ax[1];
        nodes[i] = pick(s.face, a1, a2, rad(a1, s.pos['xyz'.indexOf(a1)]), rad(a2, s.pos['xyz'.indexOf(a2)]));
      });
      FACES.forEach(function (f) {
        var na = X.FACE_NORMAL[f].findIndex(function (v) { return v !== 0; }), ax = AXES.filter(function (_, k) { return k !== na; });
        faceCenters[f] = pick(f, ax[0], ax[1]);
      });
      return {
        nodes: nodes, circles: circles, faceCenters: faceCenters,
        nodeRadius: 0.160 * Math.min(1, sc), nodeStroke: 0.048 * Math.min(1, Math.pow(sc, 0.85)),
        trackWidth: 0.063 * Math.min(1, Math.pow(sc, 0.8)), activeWidth: 0.076 * Math.min(1, Math.pow(sc, 0.75)),
        trailSegments: n <= 5 ? 10 : n <= 9 ? 4 : 2, zoomable: n >= 4,
        frame: GL.frame, clusters: faces.map(function (F) { return F.stickers; })
      };
    }

    var cameraPlan = ['F', 'R', 'B', 'L', 'U', 'D'].map(function (f) {
      var fi = FACES.indexOf(f), st = { face: f, grid: n, cells: faces[fi].stickers.slice(), center: odd ? faces[fi].center : fi * nn };
      var jp = function (k) { return function () { return k + (CL.getScheme && CL.getScheme() === 'japanese' && /[BUD]$/.test(k) ? '.jp' : ''); }; };
    i18nProp(st, 'title', jp('scan.face.' + f)); return i18nProp(st, 'instruction', jp('scan.instr.' + f));
    });

    var notationRows = [['R L U D F B', 'notation.nxn.outer']];
    if (n >= 3) notationRows.push([n >= 4 ? 'Rw · 3Rw' : 'Rw', 'notation.nxn.wide'], [n >= 4 ? '2R · 3R' : '2R', 'notation.nxn.inner']);
    if (odd) notationRows.push(['M / E / S', 'notation.nxn.mid']);
    notationRows.push(['x / y / z', 'notation.nxn.rot']);

    function holdMap(mp, flip) {
      var to = {}, from = {};
      Object.keys(moves).forEach(function (t) {
        var mm = /^(\d*)([URFDLBMESxyz])(w?)(.*)$/.exec(t), L = mm[2], suf = mm[4];
        if (flip && flip[L]) suf = suf === '' ? "'" : suf === "'" ? '' : suf;
        var v = mm[1] + (mp[L] || L) + mm[3] + suf; to[t] = v; from[v] = t;
      });
      return { toView: to, fromView: from };
    }
    var holds = [
      Object.assign({ id: 'yellowTop', orientation: [0, 0, Math.PI] }, holdMap({ U: 'D', D: 'U', R: 'L', L: 'R' }, { M: true, E: true, x: true, y: true })),
      Object.assign({ id: 'whiteTop', orientation: [0, 0, 0] }, holdMap({}))
    ];
    holds.forEach(function (hd) { var hk = function (sfx) { return function () { var id = hd.id === 'yellowTop' && CL.getScheme && CL.getScheme() === 'japanese' ? 'blueTop' : hd.id; return 'hold.' + id + sfx; }; }; i18nProp(hd, 'name', hk('')); i18nProp(hd, 'short', hk('.short')); });

    function encodeFacelets(state, prefer) {
      var v = X.validate(n, state, { prefer: prefer });
      if (!v.ok) { var e = new Error(v.errors.join('\n')); e.i18n = { k: v.issues[0].k, p: v.issues[0].p }; throw e; }
      return v.facelets;
    }
    var solvers = [];
    if (n === 2) solvers.push({ id: 'optimal2', nameKey: 'solver.optimal2', workerUrl: 'puzzles/nxn/cube2.worker.js', available: true, metric: 'HTM',
      encode: function (s) { return { facelets: encodeFacelets(s, 'dbl') }; } });
    if (n === 4) solvers.push({ id: 'reduction4', nameKey: 'solver.reduction4', workerUrl: 'puzzles/nxn/cube4.worker.js', available: true, metric: 'OBTM',
      encode: function (s) { return { facelets: encodeFacelets(s, 'centers'), timeBudget: 4000 }; } });
    if (n >= 4) {
      var fastFirst = lowMemory();
      var q = { id: 'gullicube', nameKey: 'solver.gullicube', workerUrl: 'puzzles/nxn/gullicube.worker.js', available: true, metric: 'SSTM', oneShot: true,
        encode: function (s) { return { n: n, facelets: encodeFacelets(s, 'centers'), fast: false, time: 16 }; } };
      var fz = { id: 'gullicubeFast', nameKey: 'solver.gullicubeFast', workerUrl: 'puzzles/nxn/gullicube.worker.js', available: true, metric: 'SSTM', oneShot: true,
        encode: function (s) { return { n: n, facelets: encodeFacelets(s, 'centers'), fast: true }; } };
      if (fastFirst && n >= 5) solvers.push(fz, q); else solvers.push(q, fz);
    }

    var def = {
      id: 'cube' + n, n: n, order: n, short: n + '×' + n,
      colors: X.COLORS, blankColor: '#cfcfc6',
      stickers: stickers, faces: faces, pieces: pieces, moves: moves,
      trackMoves: M.trackMoves,
      parse: function (str) {
        var toks = String(str || '').replace(/[’`´′]/g, "'").replace(/[()\[\],]/g, ' ').trim().split(/\s+/).filter(Boolean);
        return toks.map(function (t) {
          var c = X.normalize(n, t);
          if (!c || !moves[c]) { var e = new Error('无法识别的转动符号「' + t + '」'); e.i18n = { k: 'formula.badMove', p: { tok: t } }; throw e; }
          return c;
        });
      },
      solvedState: function () { return X.solvedState(n); },
      isSolved: function (s) { return X.isSolved(n, s); },
      randomScramble: function (rnd) { return X.randomScramble(n, rnd); },
      validate: function (state) { return X.validate(n, state, { prefer: n === 2 ? 'dbl' : 'centers' }); },
      describeMove: describe,
      netLayout: netLayout, graphLayout: graphLayout, cameraPlan: cameraPlan, notationRows: notationRows, holds: holds,
      scanWarn: n > 7 ? 'scan.warnLarge' : null, scanEven: !odd,
      view3d: {
        style: 'plastic', pieceSize: 0.985, plateSize: 0.958, stickerSize: 0.80, stickerCorners: [0.19, 0.19, 0.19, 0.19],
        plates: n <= 9, scale: 3 / n,
        stickerColors: { W: '#ecebe6' }, orientation: [0, 0, Math.PI],
        camera: { fov: 24, dir: [1, 0.66, 1] }, frame: { width: 0.69, height: 0.80, dx: 0.01, dy: -0.024 },
        autoRotate: { swayYaw: 0.10, swayPitch: 0.035, period: 9, showcaseMs: 2000, showcaseDelay: 1200, showcaseAxis: [0.55, 1, 0.25] }
      },
      solvers: solvers
    };
    i18nProp(def, 'name', function () { return 'puzzle.cubeN'; });
    Object.defineProperty(def, 'name', { get: function () { return T('puzzle.cubeN', { n: n }); }, enumerable: true, configurable: true });
    Object.defineProperty(def, 'notation', { get: function () { return notationRows.map(function (r) { return [r[0], T(r[1])]; }); }, enumerable: true });
    solvers.forEach(function (sv) { i18nProp(sv, 'name', sv.nameKey); });
    return def;
  }
  CL.makeNxN = makePuzzle;
  for (var n = MIN; n <= MAX; n++) {
    if (n === 3) continue;
    (function (n) { CL.registerPuzzleFactory({ id: 'cube' + n, order: n, short: n + '×' + n, n: n }, function () { return makePuzzle(n); }); })(n);
  }
})(typeof window !== 'undefined' ? window : globalThis);
