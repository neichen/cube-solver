/*
 * CubeLab 核心：谜题插件注册表 + 通用工具。
 * 核心模块（输入、图视图、3D、播放器）只通过这里定义的 Puzzle 接口访问谜题。
 * 接口说明见 README.md「扩展点」。
 */
(function (root) {
  'use strict';
  var CL = root.CubeLab = root.CubeLab || {};
  var puzzles = {};

  function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
  function norm(a) { var l = Math.hypot(a[0], a[1], a[2]); return [a[0] / l, a[1] / l, a[2] / l]; }
  /** 贴纸中心的 3D 坐标（块中心 + 0.5·法线） */
  CL.stickerPoint = function (s) { return [s.pos[0] + s.normal[0] / 2, s.pos[1] + s.normal[1] / 2, s.pos[2] + s.normal[2] / 2]; };
  CL.vec = { dot: dot, cross: cross, norm: norm };

  /** 状态变换：state 为长度 N 的颜色数组，perm[i] = 贴纸 i 转动后到达的位置 */
  CL.applyPerm = function (state, perm) {
    var ns = state.slice();
    for (var i = 0; i < perm.length; i++) ns[perm[i]] = state[i];
    return ns;
  };

  // 惰性注册：factory() 在第一次 getPuzzle(id) 时才构建（高阶魔方的置换表较大，按需生成）
  var factories = {}, order = [];
  CL.registerPuzzle = function (def) { puzzles[def.id] = prepare(def); if (order.indexOf(def.id) < 0) order.push(def.id); return puzzles[def.id]; };
  CL.registerPuzzleFactory = function (meta, factory) { factories[meta.id] = { meta: meta, factory: factory }; if (order.indexOf(meta.id) < 0) order.push(meta.id); };
  CL.getPuzzle = function (id) { return CL.applyScheme(getPuzzle0(id)); };
  function getPuzzle0(id) {
    if (!puzzles[id] && factories[id]) puzzles[id] = prepare(factories[id].factory());
    return puzzles[id];
  };
  /** 谜题元信息列表（不触发构建）：{ id, order, short, nameKey?, name? } */
  CL.puzzleMeta = function () {
    var ids = order.slice(); Object.keys(declared).forEach(function (id) { if (ids.indexOf(id) < 0) ids.push(id); });
    return ids.map(function (id) { return puzzles[id] ? { id: id, short: puzzles[id].short, order: puzzles[id].order || 0, puzzle: puzzles[id] } : factories[id] ? { id: id, short: factories[id].meta.short, order: factories[id].meta.order || 0, meta: factories[id].meta } : { id: id, short: declared[id].short, order: declared[id].order, meta: declared[id] }; })
      .sort(function (a, b) { return a.order - b.order; });
  };

  // Puzzle index for lazy loading: the menu lists every puzzle (localized name from n / nameKey) before its plugin
  // script is loaded; CL.loadPuzzle(id) adds the plugin's scripts on demand (a page ships only its own puzzle).
  // The URLs are plain literals so tools/build-dist.js can version them (?v=<content hash>).
  var GROUPS = {
    cube3: ['puzzles/cube3/model.js', 'puzzles/cube3/cube3.js'],
    nxn: ['puzzles/nxn/nxn.js'],
    twisty: ['puzzles/twisty/twisty-model.js', 'puzzles/twisty/twisty.js'],
    megaminx: ['puzzles/megaminx/megaminx-model.js', 'puzzles/megaminx/megaminx.js']
  };
  var declared = {};
  [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15].forEach(function (n) { declared['cube' + n] = { id: 'cube' + n, order: n, short: n + '×' + n, n: n, group: n === 3 ? 'cube3' : 'nxn' }; });
  declared.pyraminx = { id: 'pyraminx', order: 100, short: 'Pyraminx', nameKey: 'puzzle.pyraminx', group: 'twisty' };
  declared.skewb = { id: 'skewb', order: 101, short: 'Skewb', nameKey: 'puzzle.skewb', group: 'twisty' };
  declared.megaminx = { id: 'megaminx', order: 102, short: 'Megaminx', nameKey: 'puzzle.megaminx', group: 'megaminx' };
  CL.PUZZLE_GROUPS = GROUPS;
  CL.puzzleGroup = function (id) { return declared[id] ? declared[id].group : null; };
  var loadingScripts = {};
  function loadScript(src) {
    if (loadingScripts[src]) return loadingScripts[src];
    var have = root.document && Array.prototype.some.call(root.document.scripts, function (s) { return (s.getAttribute('src') || '').split('?')[0] === src.split('?')[0]; });
    return (loadingScripts[src] = have ? Promise.resolve() : new Promise(function (res, rej) {
      var s = root.document.createElement('script'); s.src = src; s.async = false;
      s.onload = function () { res(); }; s.onerror = function () { delete loadingScripts[src]; rej(new Error('failed to load ' + src)); };
      root.document.head.appendChild(s);
    }));
  }
  CL.loadScript = loadScript;
  /** Make sure the plugin for puzzle `id` is registered (loads its scripts once); resolves when getPuzzle(id) works. */
  CL.loadPuzzle = function (id) {
    if (puzzles[id] || factories[id]) return Promise.resolve();
    var g = declared[id] && GROUPS[declared[id].group];
    if (!g || !root.document) return Promise.resolve();
    return g.reduce(function (p, src) { return p.then(function () { return loadScript(src); }); }, Promise.resolve());
  };

  // ---------------------------------------------------------------- 配色方案（立方体）：西方（默认）/ 日本（蓝黄互换）
  // 内部状态始终用「逻辑」颜色键（白顶绿前时 U=W、D=Y、B=B），只有显示色、颜色名、字母和摄像头识别
  // 按物理颜色走：日本配色里白对蓝、黄在后面，于是逻辑 Y 显示为蓝色、逻辑 B 显示为黄色。
  var SCHEMES = { western: {}, japanese: { Y: 'B', B: 'Y' } };
  var schemeId = 'western';
  try { var sv = root.localStorage && root.localStorage.getItem('cubelab.scheme'); if (SCHEMES[sv]) schemeId = sv; } catch (e) {}
  var qs = root.location && /[?&]scheme=(western|japanese)\b/.exec(root.location.search); if (qs) schemeId = qs[1];
  function isCube(P) { return !!(P && P.colors && /^cube\d+$/.test(P.id) && ['W', 'Y', 'G', 'B', 'R', 'O'].every(function (k) { return P.colors[k]; })); }
  CL.SCHEMES = SCHEMES;
  CL.getScheme = function () { return schemeId; };
  CL.setScheme = function (id) { if (!SCHEMES[id]) id = 'western'; schemeId = id; try { root.localStorage.setItem('cubelab.scheme', id); } catch (e) {} return id; };
  CL.schemeApplies = isCube;
  /** 逻辑颜色键 → 物理颜色键 */
  CL.phys = function (P, k) { return isCube(P) ? SCHEMES[schemeId][k] || k : k; };
  /** 把当前方案写进 P.colors（hex / phys / letter）；幂等 */
  CL.applyScheme = function (P) {
    if (!P || !P.colors) return P;
    var C = P.colors, cube = isCube(P), m = cube ? SCHEMES[schemeId] : {};
    Object.keys(C).forEach(function (k) { if (C[k]._hex0 == null) C[k]._hex0 = C[k].hex; });
    Object.keys(C).forEach(function (k) { var ph = m[k] || k; C[k].hex = (C[ph] || C[k])._hex0; C[k].phys = ph; C[k].letter = ph; });
    return P;
  };
  CL.listPuzzles = function () { return Object.keys(puzzles).map(function (k) { return puzzles[k]; }); };

  function prepare(P) {
    var N = P.stickers.length;
    P.stickers.forEach(function (s, i) { s.index = i; });
    // 通用默认实现（插件可覆盖）
    P.parse = P.parse || function (str) {
      var toks = String(str || '').replace(/[’`´′]/g, "'").trim().split(/\s+/).filter(Boolean);
      toks.forEach(function (t) { if (!P.moves[t]) { var e = new Error('无法识别的转动符号「' + t + '」'); e.i18n = { k: 'formula.badMove', p: { tok: t } }; throw e; } });
      return toks;
    };
    P.format = P.format || function (toks) { return toks.join(' '); };
    P.apply = P.apply || function (state, toks) {
      if (typeof toks === 'string') toks = P.parse(toks);
      return toks.reduce(function (s, t) { return CL.applyPerm(s, P.moves[t].perm); }, state);
    };
    P.inverse = P.inverse || function (toks) {
      return toks.slice().reverse().map(function (t) { return P.moves[t].inverse; });
    };
    P.isSolved = P.isSolved || function (state) {
      return P.faces.every(function (f) { var c = state[f.center != null ? f.center : f.stickers[0]]; return f.stickers.every(function (i) { return state[i] === c; }); });
    };
    // 3D 层判定：哪些块参与转动
    P.pieces.forEach(function (pc, i) { pc.index = i; });
    Object.keys(P.moves).forEach(function (t) {
      var m = P.moves[t];
      m.pieces = P.pieces.filter(function (pc) { return m.layer(pc.pos); }).map(function (pc) { return pc.index; });
    });
    P.tracks = buildTracks(P);
    return P;
  }

  /**
   * 由谜题几何 + 转动定义自动生成「轨道」：
   * 每个基础转动（trackMoves）所在层内的移动贴纸，按法线与转轴夹角分组，
   * 组内按绕轴角度排序 => 一个闭合环。贴纸在转动下沿环前进 angle/(2π)*n 格。
   */
  function buildTracks(P) {
    var tracks = [], byBase = {};
    (P.trackMoves || []).forEach(function (base) {
      var m = P.moves[base], ax = norm(m.axis);
      var ref = Math.abs(ax[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
      var u = norm(cross(ax, ref)), v = cross(ax, u);
      var groups = {};
      // 异形魔方（P.trackMode === 'cycles'）：轨道 = 该转动置换的轮换（贴纸绕轴的轨道），一律为「侧面」型
      if (P.trackMode === 'cycles') {
        var seen = {}, ci = 0;
        for (var i0 = 0; i0 < P.stickers.length; i0++) {
          if (m.perm[i0] === i0 || seen[i0]) continue;
          var cyc = [], x = i0; while (!seen[x]) { seen[x] = 1; cyc.push(x); x = m.perm[x]; }
          groups['c' + (1000 + ci++)] = cyc;
        }
      } else
      for (var i = 0; i < P.stickers.length; i++) {
        if (m.perm[i] === i) continue;
        var s = P.stickers[i], k = Math.round(dot(s.normal, ax) * 1000), key = String(k);
        // 本面贴纸按「方环」（到转轴的切比雪夫距离）再分组：高阶魔方的一个面有多圈，每圈各自是一个循环
        if (Math.abs(k) > 500) { var pt = CL.stickerPoint(s); key = k + '/' + Math.round(Math.max(Math.abs(dot(pt, u)), Math.abs(dot(pt, v))) * 1000); }
        (groups[key] = groups[key] || []).push(i);
      }
      byBase[base] = [];
      Object.keys(groups).sort().reverse().forEach(function (k, gi) {
        var ids = groups[k].slice().sort(function (a, b) {
          var pa = CL.stickerPoint(P.stickers[a]), pb = CL.stickerPoint(P.stickers[b]);
          return Math.atan2(dot(pa, v), dot(pa, u)) - Math.atan2(dot(pb, v), dot(pb, u));
        });
        var tr = { id: base + ':' + gi, base: base, face: m.face, kind: P.trackMode !== 'cycles' && Math.abs(parseInt(k, 10)) > 500 ? 'face' : 'side', stickers: ids, pos: {} };
        ids.forEach(function (id, j) { tr.pos[id] = j; });
        tracks.push(tr); byBase[base].push(tr);
      });
    });
    // 每个转动的贴纸路径。宽层 / 整体转动由多个物理层组成：m.bases 列出每层的基础转动，
    // 转角换算到该基础转动的轴上（例如 L 侧的层用 R 侧命名时方向相反）。
    Object.keys(P.moves).forEach(function (t) {
      var m = P.moves[t], bases = m.bases || (m.base ? [m.base] : []);
      m.tracks = []; m.paths = [];
      bases.forEach(function (b) {
        var bm = P.moves[b], rel = m.angle * dot(norm(m.axis), norm(bm.axis));
        (byBase[b] || []).forEach(function (tr) {
          m.tracks.push(tr.id);
          var n = tr.stickers.length, steps = Math.round(rel / (2 * Math.PI) * n);
          tr.stickers.forEach(function (id, j) {
            var dest = tr.stickers[((j + steps) % n + n) % n];
            if (dest !== m.perm[id]) throw new Error('轨道与置换不一致: ' + t + ' ' + id + ' ' + dest + ' ' + m.perm[id] + ' ' + JSON.stringify(tr.stickers));
            m.paths.push({ sticker: id, track: tr.id, from: j, steps: steps, base: b, sense: Math.sign(rel) === Math.sign(bm.angle) ? 1 : -1 });
          });
        });
      });
    });
    return tracks;
  }
  CL.buildTracks = buildTracks;

  if (typeof module !== 'undefined' && module.exports) module.exports = CL;
})(typeof window !== 'undefined' ? window : globalThis);
