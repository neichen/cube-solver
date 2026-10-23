/*
 * 3×3 魔方插件。实现 CubeLab Puzzle 接口（见 README.md）。
 * 依赖：puzzles/cube3/model.js（CubeModel）、js/core/registry.js（CubeLab）。
 */
(function (root) {
  'use strict';
  var CL = root.CubeLab, M = root.CubeModel || (typeof require !== 'undefined' ? require('./model.js') : null);
  var FACES = M.FACES.split('');
  var dot = CL.vec.dot;
  // 界面文字一律走 i18n 键（js/i18n/*.js）；没有 i18n 时（Node 测试）返回键名
  function T(k, p) { return CL.t ? CL.t(k, p) : k; }
  function i18nProp(o, prop, key) { Object.defineProperty(o, prop, { get: function () { return T(typeof key === 'function' ? key() : key); }, enumerable: true, configurable: true }); return o; }

  // ---- 贴纸 ----
  var stickers = M.GEOM.map(function (g, i) {
    var f = FACES[(i / 9) | 0];
    return { id: f + (i % 9 + 1), face: f, pos: g.p, normal: g.n, locked: i % 9 === 4 };
  });
  var faces = FACES.map(function (f, fi) {
    var ids = []; for (var k = 0; k < 9; k++) ids.push(fi * 9 + k);
    return i18nProp({ id: f, center: fi * 9 + 4, normal: M.FACE_NORMAL[f], stickers: ids }, 'name', 'move.side.' + f);
  });

  // ---- 块（3D 渲染用）----
  var pieceMap = {}, pieces = [];
  stickers.forEach(function (s, i) {
    var k = s.pos.join(',');
    if (!pieceMap[k]) { pieceMap[k] = { pos: s.pos.slice(), stickers: [] }; pieces.push(pieceMap[k]); }
    pieceMap[k].stickers.push(i);
  });

  // ---- 转动 ----
  var moves = {};
  FACES.forEach(function (f) {
    var n = M.FACE_NORMAL[f];
    [['', 1, -1], ["'", 3, 1], ['2', 2, -2]].forEach(function (d) {
      var ident = []; for (var i = 0; i < 54; i++) ident.push(i);
      var after = M.applyMove(ident, { face: f, times: d[1] }), perm = [];
      after.forEach(function (src, dst) { perm[src] = dst; });
      moves[f + d[0]] = {
        base: f, face: f, perm: perm, axis: n, angle: d[2] * Math.PI / 2,
        inverse: f + (d[0] === '' ? "'" : d[0] === "'" ? '' : '2'),
        layer: function (p) { return dot(p, n) > 0.5; }
      };
    });
  });

  // ---- 中层转动 M / E / S（几何生成：把层内贴纸的位置+法线绕轴旋转，再按位置+法线找回贴纸）----
  // 约定（WCA）：M 与 L 同向，E 与 D 同向，S 与 F 同向。求解器只用面转动；中层用于公式输入、演示和图视图的中间圆。
  var SLICES = { M: 'L', E: 'D', S: 'F' };
  function rotVec(v, n, ang) {   // Rodrigues，n 为单位轴向量
    var c = Math.cos(ang), s = Math.sin(ang), d = dot(v, n), cr = CL.vec.cross(n, v);
    return [0, 1, 2].map(function (k) { return Math.round(v[k] * c + cr[k] * s + n[k] * d * (1 - c)); });
  }
  var stickerKey = {};
  stickers.forEach(function (st, i) { stickerKey[st.pos.join() + '|' + st.normal.join()] = i; });
  function geomPerm(n, ang, inLayer) {
    return stickers.map(function (st, i) {
      if (!inLayer(st.pos)) return i;
      var k = rotVec(st.pos, n, ang).join() + '|' + rotVec(st.normal, n, ang).join();
      if (stickerKey[k] === undefined) throw new Error('slice perm: ' + k);
      return stickerKey[k];
    });
  }
  Object.keys(SLICES).forEach(function (sl) {
    var n = M.FACE_NORMAL[SLICES[sl]];
    [['', -1], ["'", 1], ['2', -2]].forEach(function (d) {
      // 面转动「顺时针（正对该面）」= 绕外法线转 −90°（右手系），与 moves[F].angle 的约定一致
      moves[sl + d[0]] = {
        base: sl, face: SLICES[sl], slice: true, perm: geomPerm(n, d[1] * Math.PI / 2, function (p) { return Math.abs(dot(p, n)) < 0.5; }),
        axis: n, angle: d[1] * Math.PI / 2,
        inverse: sl + (d[0] === '' ? "'" : d[0] === "'" ? '' : '2'),
        layer: function (p) { return Math.abs(dot(p, n)) < 0.5; }
      };
    });
  });
  CL.cube3GeomPerm = geomPerm;   // 测试用：验证几何置换与模型置换一致

  function describe(tok) {
    var f = tok[0], s = tok.slice(1);
    if (SLICES[f]) {
      var sl = T('slice.' + f);
      return s === '2' ? T('move.sliceHalf', { slice: sl }) : s === "'" ? T('move.sliceCcw', { slice: sl })
        : T('move.sliceCw', { slice: sl, base: SLICES[f], baseLayer: T('move.layer.' + SLICES[f]) });
    }
    var p = { layer: T('move.layer.' + f), side: T('move.side.' + f) };
    return T(s === '2' ? 'move.half' : s === "'" ? 'move.ccw' : 'move.cw', p);
  }

  // ---- 展开图（颜色输入）: 12×9 网格 ----
  var NET_OFF = { U: [3, 0], L: [0, 3], F: [3, 3], R: [6, 3], B: [9, 3], D: [3, 6] };
  var netLayout = { cols: 12, rows: 9, cells: stickers.map(function (s, i) {
    var o = NET_OFF[s.face], k = i % 9; return { sticker: i, col: o[0] + k % 3, row: o[1] + ((k / 3) | 0) };
  }) };

  /*
   * 图视图布局（参考视频风格）：三组同心圆，每组 3 个圆 = 某个轴向的 3 层；
   * 每个圆是该层 12 块侧面贴纸的轨道。三组圆心构成正三角形，形成三重对称的花瓣/韦恩图。
   * 每个面的 9 块贴纸位于两组圆的交点处（该面法线以外两个轴），组成紧凑的 3×3 簇。
   * 层 → 半径 的映射（SIGN）以及每个面落在哪个交点区域（UPPER）经过穷举验证：
   * 每个 U/D/R/L/F/B 转动下，12 块侧面贴纸在圆上保持循环次序整体平移（纯圆周运动）。
   */
  var GL = {
    radii: [1.3922, 1.7696, 2.1469],             // 内/中/外圆半径（以圆心三角形外接圆半径为 1；由参考帧 54 个节点最小二乘拟合，残差 0.2px）
    family: { y: [0, -1], z: [-0.866, 0.5], x: [0.866, 0.5] },   // 屏幕坐标（y 向下）：上 / 左下 / 右下
    sign: { x: 1, y: 1, z: -1 },                 // 半径序号 = 1 + sign·层坐标
    upper: { R: true, B: true, D: true, L: false, F: false, U: false },  // 该面取两交点中靠上的那个
    nodeRadius: 0.160, nodeStroke: 0.048,        // 节点外径 0.184 = 0.160 + 描边 0.048/2（参考帧实测）
    trackWidth: 0.063, activeWidth: 0.076,
    frame: { width: 0.83, height: 0.90, dx: -0.053, dy: -0.007 }   // 图宽占面板比例 / 最大高度比例 / 中心偏移（参考视频取景实测）
  };
  function circleIntersections(c1, r1, c2, r2) {
    var dx = c2[0] - c1[0], dy = c2[1] - c1[1], d = Math.hypot(dx, dy);
    var a = (r1 * r1 - r2 * r2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, r1 * r1 - a * a));
    var mx = c1[0] + a * dx / d, my = c1[1] + a * dy / d;
    return [[mx + h * dy / d, my - h * dx / d], [mx - h * dy / d, my + h * dx / d]];
  }
  var AXES = ['x', 'y', 'z'];
  function graphLayout() {
    var R = GL.radii, nodes = [], circles = [];
    AXES.forEach(function (a) {
      [-1, 0, 1].forEach(function (c) {
        var f = GL.family[a];
        circles.push({ id: a + c, axis: a, layer: c, cx: f[0], cy: f[1], r: R[1 + GL.sign[a] * c] });
      });
    });
    stickers.forEach(function (s, i) {
      var na = s.normal.findIndex(function (v) { return v !== 0; });
      var ax = AXES.filter(function (_, k) { return k !== na; }), a1 = ax[0], a2 = ax[1];
      var F1 = GL.family[a1], F2 = GL.family[a2];
      var mid = circleIntersections(F1, R[1], F2, R[1]);
      var ref = (mid[0][1] < mid[1][1]) === GL.upper[s.face] ? mid[0] : mid[1];
      var pts = circleIntersections(F1, R[1 + GL.sign[a1] * s.pos['xyz'.indexOf(a1)]], F2, R[1 + GL.sign[a2] * s.pos['xyz'.indexOf(a2)]]);
      var d0 = Math.hypot(pts[0][0] - ref[0], pts[0][1] - ref[1]), d1 = Math.hypot(pts[1][0] - ref[0], pts[1][1] - ref[1]);
      nodes[i] = d0 < d1 ? pts[0] : pts[1];
    });
    return {
      nodes: nodes, circles: circles, nodeRadius: GL.nodeRadius, nodeStroke: GL.nodeStroke,
      trackWidth: GL.trackWidth, activeWidth: GL.activeWidth, frame: GL.frame,
      clusters: faces.map(function (F) { return F.stickers; })
    };
  }

  // ---- 扫描计划：每一步拍一个面，cells 为图像中从左上到右下的贴纸序号 ----
  var cameraPlan = ['F', 'R', 'B', 'L', 'U', 'D'].map(function (f) {
    var fi = FACES.indexOf(f), st = { face: f, grid: 3, cells: faces[fi].stickers.slice(), center: fi * 9 + 4 };
    i18nProp(st, 'title', 'scan.face.' + f); return i18nProp(st, 'instruction', 'scan.instr.' + f);
  });

  var notationRows = [['U / D', 'notation.UD'], ['R / L', 'notation.RL'], ['F / B', 'notation.FB'], ['M / E / S', 'notation.MES']];

  /*
   * 握法（记号视角）。内部状态/求解器始终用 WCA 标准（白 U、绿 F）。
   * 3D 视图按握法整体旋转；解法与播放器里的记号按握法重新命名，使「U」永远是屏幕上的顶层。
   * 黄顶绿前 = 标准握法绕前后轴转 180°（z2）：U↔D、R↔L，F/B 不变；顺/逆时针方向保持（相对各自面）。
   */
  // m：字母映射；flip：方向反转的字母（z2 下 M 变成「与 R 同向」= M′，E 变成「与 U 同向」= E′）
  function holdMap(m, flip) {
    var to = {}, from = {};
    Object.keys(moves).forEach(function (t) {
      var L = t[0], suf = t.slice(1);
      if (flip && flip[L]) suf = suf === '' ? "'" : suf === "'" ? '' : suf;
      var v = (m[L] || L) + suf; to[t] = v; from[v] = t;
    });
    return { toView: to, fromView: from };
  }
  var holds = [
    Object.assign({ id: 'yellowTop', orientation: [0, 0, Math.PI] }, holdMap({ U: 'D', D: 'U', R: 'L', L: 'R' }, { M: true, E: true })),
    Object.assign({ id: 'whiteTop', orientation: [0, 0, 0] }, holdMap({}))
  ];
  holds.forEach(function (h) { i18nProp(h, 'name', 'hold.' + h.id); i18nProp(h, 'short', 'hold.' + h.id + '.short'); });

  var def = {
    id: 'cube3', n: 3, order: 3, short: '3×3',
    colors: M.COLORS, blankColor: '#cfcfc6',
    stickers: stickers, faces: faces, pieces: pieces, moves: moves,
    trackMoves: FACES.concat(['M', 'E', 'S']),
    solvedState: function () { return M.solvedState(); },
    randomScramble: function (rnd) { return M.randomScramble(22, rnd).split(' '); },
    validate: function (state) { return M.validate(state); },
    describeMove: describe,
    netLayout: netLayout,
    graphLayout: graphLayout,
    cameraPlan: cameraPlan,
    notationRows: notationRows,
    holds: holds,
    view3d: {
      style: 'plastic', pieceSize: 0.985, plateSize: 0.958, stickerSize: 0.80,
      // 圆角（左上、右上、右下、左下，相对贴纸边长）；可设为不对称的「叶形」
      stickerCorners: [0.19, 0.19, 0.19, 0.19],
      stickerColors: { W: '#ecebe6' },
      // 默认朝向 = holds[0]（黄顶绿前，与参考视频一致）
      orientation: [0, 0, Math.PI],
      camera: { fov: 24, dir: [1, 0.66, 1] },
      frame: { width: 0.69, height: 0.80, dx: 0.01, dy: -0.024 },   // 魔方宽度占比 / 最大高度比例 / 中心偏移（实测）
      autoRotate: { swayYaw: 0.10, swayPitch: 0.035, period: 9, showcaseMs: 2000, showcaseDelay: 1200, showcaseAxis: [0.55, 1, 0.25] }
    },
    solvers: [
      { id: 'kociemba', nameKey: 'solver.kociemba', workerUrl: 'puzzles/cube3/kociemba.worker.js', available: true, metric: 'HTM',
        encode: function (state) { var v = M.validate(state); if (!v.ok) throw new Error(v.errors.join('\n')); return { facelets: v.facelets, maxDepth: 22, timeBudget: 1200 }; } },
      { id: 'optimal-ida', nameKey: 'solver.ida', available: false }
    ]
  };
  Object.defineProperty(def, 'name', { get: function () { return T('puzzle.cubeN', { n: 3 }); }, enumerable: true, configurable: true });
  Object.defineProperty(def, 'notation', { get: function () { return notationRows.map(function (r) { return [r[0], T(r[1])]; }); }, enumerable: true });
  def.solvers.forEach(function (sv) { i18nProp(sv, 'name', sv.nameKey); });
  CL.registerPuzzle(def);
})(typeof window !== 'undefined' ? window : globalThis);
