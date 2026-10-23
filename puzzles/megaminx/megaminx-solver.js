/*
 * 五魔方多阶段求解器（自写，MIT）。不是最优解。
 * 思路：逐面「移除」的块构建法 —— 依次把 D、下环五面、上环四面的块归位；一旦某面的所有块都归位，
 * 此后不再转动该面（转动集合 S 逐步缩小，未接触 S 的块自动保持）。每一步用 IDA*，启发值取若干
 * 小型块组距离表（在当前 S 下 BFS，首次使用时构建并缓存）的最大值。最后一层（U 面 5 角 5 棱）
 * 用离线搜索得到的公式表分两步完成（棱 + 角朝向 → 角排列）。
 * 计数：WCA 风格 HTM —— 任一面转 72° 或 144° 都计 1 步。
 */
(function (root) {
  'use strict';
  var MM = root.MegaminxModel;
  if (!MM && typeof require === 'function') MM = require('./megaminx-model.js');
  var F = MM.FI, NF = 12;
  // 统一块代码：角 0..59（槽*3+朝向），棱 60..119（60 + 槽*2+朝向）
  var MOVE_T = MM.faceMoves.map(function (t) {
    var m = MM.moves[t], a = new Int16Array(120);
    for (var x = 0; x < 60; x++) { a[x] = m.cm[x]; a[60 + x] = 60 + m.em[x]; }
    return a;
  });
  var MOVE_FACE = MM.faceMoves.map(function (t) { return MM.moves[t].faceIndex; });
  var OPPOSITE = MM.FACES.map(function (f, i) { var n = MM.NORMALS[i]; for (var j = 0; j < NF; j++) if (MM.vec.dot(n, MM.NORMALS[j]) < -0.99) return j; return -1; });
  // 块 id：角 0..19，棱 20..49；其所接触的面
  function pieceFaces(p) { return p < 20 ? MM.cornerFaces[p] : MM.edgeFaces[p - 20]; }
  function solvedCode(p) { return p < 20 ? p * 3 : 60 + (p - 20) * 2; }
  function codeSlotFaces(code) { return code < 60 ? MM.cornerFaces[(code / 3) | 0] : MM.edgeFaces[(code - 60) >> 1]; }
  function popcount(m) { var c = 0; while (m) { c += m & 1; m >>= 1; } return c; }
  function maskOf(list) { var m = 0; list.forEach(function (f) { m |= 1 << f; }); return m; }

  // ---------------------------------------------------------------- 距离表
  var tableCache = {};
  function regionCodes(type, Smask) {   // 在转动集合 S 下，某类块可能出现的代码
    var out = [];
    for (var x = 0; x < 60; x++) { var code = type === 'c' ? x : 60 + x; if (maskOf(codeSlotFaces(code)) & Smask) out.push(code); }
    return out;
  }
  function buildTable(pcs, Smask) {
    var key = Smask + ':' + pcs.join(',');
    if (tableCache[key]) return tableCache[key];
    var t0 = Date.now(), m = pcs.length, loc = [], inv = [], radix = [], size = 1;
    pcs.forEach(function (p, j) {
      var rc = regionCodes(p < 20 ? 'c' : 'e', Smask), l = new Int16Array(120).fill(-1);
      rc.forEach(function (c, i) { l[c] = i; });
      loc[j] = l; inv[j] = rc; radix[j] = rc.length; size *= rc.length;
    });
    if (size > 6e6) throw new Error('table too large ' + size);
    var mv = []; for (var i = 0; i < 48; i++) if (Smask & (1 << MOVE_FACE[i])) mv.push(MOVE_T[i]);
    var dist = new Uint8Array(size).fill(255), q = new Int32Array(size), qh = 0, qt = 0;
    function enc(codes) { var idx = 0; for (var j = m - 1; j >= 0; j--) idx = idx * radix[j] + loc[j][codes[j]]; return idx; }
    var start = enc(pcs.map(solvedCode)); dist[start] = 0; q[qt++] = start;
    var codes = new Int16Array(m), nc = new Int16Array(m), maxd = 0;
    while (qh < qt) {
      var idx = q[qh++], d = dist[idx], r = idx;
      for (var j = 0; j < m; j++) { codes[j] = inv[j][r % radix[j]]; r = (r / radix[j]) | 0; }
      for (var k = 0; k < mv.length; k++) {
        var T = mv[k];
        for (j = 0; j < m; j++) nc[j] = T[codes[j]];
        var ni = enc(nc);
        if (dist[ni] === 255) { dist[ni] = d + 1; q[qt++] = ni; if (d + 1 > maxd) maxd = d + 1; }
      }
    }
    var tb = { pcs: pcs, loc: loc, radix: radix, dist: dist, size: size, maxd: maxd, ms: Date.now() - t0 };
    tableCache[key] = tb;
    return tb;
  }

  /**
   * 棱朝向表：在 S 中把棱朝向调整为「可仅用二面 T 还原」的状态（类似三阶 <R,U> 的 EO）。
   * 每个块的好朝向 = o ⊕ g[槽] ⊕ c[块] = 0；状态 = S 区域内各槽的标志位（2^n）。
   */
  function buildEO(Smask, Tmask) {
    var key = 'eo' + Smask + ':' + Tmask;
    if (tableCache[key]) return tableCache[key];
    var g = new Int8Array(30), c = {}, tmv = [], smv = [], i;
    for (i = 0; i < 48; i++) { if (Tmask & (1 << MOVE_FACE[i])) tmv.push(MOVE_T[i]); if (Smask & (1 << MOVE_FACE[i])) smv.push(MOVE_T[i]); }
    function orbit(x) { var seen = {}, q = [x]; seen[x] = 1; while (q.length) { var y = q.pop(); tmv.forEach(function (T) { if (!seen[T[y]]) { seen[T[y]] = 1; q.push(T[y]); } }); } return Object.keys(seen).map(Number); }
    var tPieces = []; for (var p = 20; p < 50; p++) if (maskOf(pieceFaces(p)) & Tmask) tPieces.push(p);
    orbit(solvedCode(tPieces[0])).forEach(function (x) { g[(x - 60) >> 1] = (x - 60) & 1; });
    tPieces.forEach(function (p) { var o = orbit(solvedCode(p)), x = o[0] - 60; c[p] = (x & 1) ^ g[x >> 1]; });
    var slots = []; for (i = 0; i < 30; i++) if (maskOf(MM.edgeFaces[i]) & Smask) slots.push(i);
    var bit = new Int32Array(30); slots.forEach(function (sl, j) { bit[sl] = 1 << j; });
    var n = slots.length, size = 1 << n, trans = smv.map(function (T) {
      return slots.map(function (sl) { var x = T[60 + sl * 2] - 60, s2 = x >> 1; return { to: bit[s2], d: (x & 1) ^ g[sl] ^ g[s2] }; });
    });
    var dist = new Uint8Array(size).fill(255), q = new Int32Array(size), qh = 0, qt = 0; dist[0] = 0; q[qt++] = 0;
    while (qh < qt) {
      var st = q[qh++];
      trans.forEach(function (tr) {
        var ns = 0; for (var j = 0; j < n; j++) { if (((st >> j) & 1) ^ tr[j].d) ns |= tr[j].to; }
        if (dist[ns] === 255) { dist[ns] = dist[st] + 1; q[qt++] = ns; }
      });
    }
    var pcs = []; for (p = 20; p < 50; p++) if (maskOf(pieceFaces(p)) & Smask) pcs.push(p);
    return (tableCache[key] = { eo: true, pcs: pcs, g: g, c: c, bit: bit, dist: dist, size: size });
  }

  // ---------------------------------------------------------------- IDA*
  function idaStep(codes, goalPcs, tables, Smask, maxDepth, stats, lim) {
    // lim.skip：跳过前若干个解（取其后的另一个解）；lim.nodes：节点预算，超出返回 null（codes 不变）
    var skip = (lim && lim.skip) || 0, nodeLimit = (lim && lim.nodes) || Infinity;
    // codes: Int16Array(50)（块 → 代码），goalPcs: 需归位的块；tables: 距离表（其块均被跟踪）
    var target = goalPcs.slice();
    tables.forEach(function (tb) { tb.pcs.forEach(function (p) { if (target.indexOf(p) < 0) target.push(p); }); });
    var K = target.length, KG = goalPcs.length, mv = [];
    for (var i = 0; i < 48; i++) if (Smask & (1 << MOVE_FACE[i])) mv.push(i);
    var tidx = tables.map(function (tb) { return tb.pcs.map(function (p) { return target.indexOf(p); }); });
    var goal = target.map(solvedCode);
    tables.forEach(function (tb) { if (tb.eo) tb.cx = tb.pcs.map(function (p) { return tb.c[p] || 0; }); });
    var stack = new Int16Array((maxDepth + 2) * K), path = [];
    for (i = 0; i < K; i++) stack[i] = codes[target[i]];
    function h(off) {
      var best = 0;
      for (var t = 0; t < tables.length; t++) {
        var tb = tables[t], ti = tidx[t], idx = 0;
        if (tb.eo) {
          for (var j = 0; j < ti.length; j++) { var x = stack[off + ti[j]] - 60; if ((x & 1) ^ tb.g[x >> 1] ^ tb.cx[j]) idx |= tb.bit[x >> 1]; }
        } else for (j = ti.length - 1; j >= 0; j--) idx = idx * tb.radix[j] + tb.loc[j][stack[off + ti[j]]];
        var d = tb.dist[idx]; if (d > best) best = d;
      }
      return best;
    }
    function solvedAt(off) { for (var j = 0; j < KG; j++) if (stack[off + j] !== goal[j]) return false; return true; }
    var nodes = 0;
    function dfs(depth, g, bound, lastF) {
      var off = depth * K, hv = h(off);
      if (g + hv > bound) return false;
      if (hv === 0 && solvedAt(off)) { if (skip > 0) { skip--; return false; } return true; }
      if (g === bound || nodes > nodeLimit) return false;
      var noff = off + K;
      for (var a = 0; a < mv.length; a++) {
        var mi = mv[a], f = MOVE_FACE[mi];
        if (f === lastF || (OPPOSITE[f] === lastF && f < lastF)) continue;
        var T = MOVE_T[mi];
        for (var j = 0; j < K; j++) stack[noff + j] = T[stack[off + j]];
        nodes++;
        path[depth] = mi;
        if (dfs(depth + 1, g + 1, bound, f)) return true;
      }
      return false;
    }
    for (var bound = h(0); bound <= maxDepth; bound++) {
      path.length = 0;
      if (nodes > nodeLimit) { if (stats) stats.nodes = (stats.nodes || 0) + nodes; return null; }
      if (dfs(0, 0, bound, -1)) {
        if (stats) stats.nodes = (stats.nodes || 0) + nodes;
        var sol = path.slice(0, bound);
        sol.forEach(function (mi) { var T = MOVE_T[mi]; for (var p = 0; p < 50; p++) codes[p] = T[codes[p]]; });
        return sol;
      }
    }
    throw new Error('megaminx: step search exceeded depth ' + maxDepth);
  }

  // ---------------------------------------------------------------- 阶段规划
  function piecesWithin(allowedMask, mustTouch) {   // 面集合 ⊆ allowed 且接触 mustTouch 的块
    var out = [];
    for (var p = 0; p < 50; p++) { var fm = maskOf(pieceFaces(p)); if ((fm & ~allowedMask) === 0 && (fm & (1 << mustTouch))) out.push(p); }
    return out;
  }
  function plan() {
    var D = F.D, U = F.U, ring = MM.NB[D].slice(), upper = MM.NB[U].slice();
    var order = [D].concat(ring, upper.slice(0, 5));
    var removed = 0, steps = [];
    order.forEach(function (f) {
      var S = ((1 << NF) - 1) & ~removed;
      var add = piecesWithin(removed | (1 << f), f).filter(function (p) { return !(maskOf(pieceFaces(p)) & ~removed & ~(1 << f)) ; });
      steps.push({ face: f, S: S, add: add });
      removed |= 1 << f;
    });
    return steps;
  }
  var PLAN = plan();

  // 按块之间的相邻关系把新块分成小组（每组 ≤ 3 块，角块带上与它相邻的棱）
  function chunk(add) {
    var cs = add.filter(function (p) { return p < 20; }), es = add.filter(function (p) { return p >= 20; }), groups = [];
    cs.forEach(function (c) {
      var cm = maskOf(pieceFaces(c)), g = [c];
      for (var i = 0; i < es.length && g.length < 3; i++) { var em = maskOf(pieceFaces(es[i])); if ((em & cm) === em) { g.push(es[i]); es.splice(i, 1); i--; } }
      groups.push(g);
    });
    while (es.length) groups.push(es.splice(0, 2));
    return groups;
  }


  // ---------------------------------------------------------------- 最后一层（LL）
  var TOK_IDX = {}; MM.faceMoves.forEach(function (t, i) { TOK_IDX[t] = i; });
  var SUFX = { 0: null, 1: '', 2: '2', 3: "2'", 4: "'" };
  function inverseMove(mi) { return TOK_IDX[MM.moves[MM.faceMoves[mi]].inverse]; }
  /** 合并相邻同面转动（72° 为单位 mod 5） */
  function simplify(seq) {
    var out = [];
    seq.forEach(function (mi) {
      var f = MOVE_FACE[mi], a = MM.moves[MM.faceMoves[mi]].amount;
      if (out.length && MOVE_FACE[out[out.length - 1]] === f) {
        var b = MM.moves[MM.faceMoves[out.pop()]].amount, t = (((a + b) % 5) + 5) % 5;
        if (t) out.push(TOK_IDX[MM.FACES[f] + SUFX[t]]);
      } else out.push(mi);
    });
    return out;
  }
  var LL = (function () {
    var U = F.U, cs = [], es = [];
    // U 层槽位按 U 的邻面顺序排列
    MM.NB[U].forEach(function (nb, k) {
      var nb2 = MM.NB[U][(k + 1) % 5];
      for (var p = 0; p < 20; p++) { var fs = MM.cornerFaces[p]; if (fs.indexOf(U) >= 0 && fs.indexOf(nb) >= 0 && fs.indexOf(nb2) >= 0) cs.push(p); }
      for (p = 0; p < 30; p++) { fs = MM.edgeFaces[p]; if (fs.indexOf(U) >= 0 && fs.indexOf(nb) >= 0) es.push(p); }
    });
    function uIdx(list) { for (var j = 0; j < list.length; j++) if (MM.stickers[list[j]].faceIndex === U) return j; return -1; }
    var cu = cs.map(function (p) { return uIdx(MM.CS[p]); }), eu = es.map(function (p) { return uIdx(MM.ES[p]); });
    var cSlot = {}, eSlot = {}; cs.forEach(function (p, i) { cSlot[p] = i; }); es.forEach(function (p, i) { eSlot[p] = i; });
    var nonLL = []; for (var p = 0; p < 50; p++) if (S_pieceFacesHasU(p) === false) nonLL.push(p);
    function S_pieceFacesHasU(p) { return pieceFaces(p).indexOf(U) >= 0; }
    /** 由全局块代码读出 LL 状态 */
    function fromCodes(codes) {
      var st = { cp: [], co: [], ep: [], eo: [] };
      cs.forEach(function (home, i) { var x = codes[home], sl = cSlot[(x / 3) | 0], o = x % 3; st.cp[sl] = i; st.co[sl] = ((o + cu[i] - cu[sl]) % 3 + 3) % 3; });
      es.forEach(function (home, i) { var x = codes[20 + home] - 60, sl = eSlot[x >> 1], o = x & 1; st.ep[sl] = i; st.eo[sl] = (o + eu[i] + eu[sl]) & 1; });
      return st;
    }
    function solvedLL() { return { cp: [0, 1, 2, 3, 4], co: [0, 0, 0, 0, 0], ep: [0, 1, 2, 3, 4], eo: [0, 0, 0, 0, 0] }; }
    function effectOf(alg) {
      var codes = new Int16Array(50); for (var p = 0; p < 50; p++) codes[p] = solvedCode(p);
      alg.forEach(function (mi) { var T = MOVE_T[mi]; for (var q = 0; q < 50; q++) codes[q] = T[codes[q]]; });
      for (var j = 0; j < nonLL.length; j++) if (codes[nonLL[j]] !== solvedCode(nonLL[j])) return null;
      var st = fromCodes(codes), e = { cp: [], cd: [], ep: [], ed: [] };
      // 效果：槽 i 的块 → 槽 cp[i]，朝向加 cd[i]
      st.cp.forEach(function (piece, sl) { e.cp[piece] = sl; e.cd[piece] = st.co[sl]; });
      st.ep.forEach(function (piece, sl) { e.ep[piece] = sl; e.ed[piece] = st.eo[sl]; });
      return e;
    }
    function applyEffect(st, e) {
      var n = { cp: [], co: [], ep: [], eo: [] };
      for (var i = 0; i < 5; i++) {
        n.cp[e.cp[i]] = st.cp[i]; n.co[e.cp[i]] = (st.co[i] + e.cd[i]) % 3;
        n.ep[e.ep[i]] = st.ep[i]; n.eo[e.ep[i]] = (st.eo[i] + e.ed[i]) & 1;
      }
      return n;
    }
    function effectKey(e) { return e.cp.join('') + e.cd.join('') + e.ep.join('') + e.ed.join(''); }
    function isIdentity(e) { return effectKey(e) === '0123400000' + '0123400000'; }
    function preservesOrientation(e) { return e.cd.every(function (x) { return !x; }) && e.ed.every(function (x) { return !x; }); }
    // 偶排列编号
    var EVEN = [], EVEN_IDX = {};
    (function gen(a, used) {
      if (a.length === 5) { if (!MM.parity(a)) { EVEN_IDX[a.join('')] = EVEN.length; EVEN.push(a.slice()); } return; }
      for (var i = 0; i < 5; i++) if (!used[i]) { used[i] = 1; a.push(i); gen(a, used); a.pop(); used[i] = 0; }
    })([], []);
    function oriIdx(o, base) { var x = 0; for (var i = 0; i < 4; i++) x = x * base + o[i]; return x; }
    function oriDec(x, base, mod) { var o = [], s = 0; for (var i = 3; i >= 0; i--) { o[i] = x % base; x = (x / base) | 0; s += o[i]; } o[4] = (mod - s % mod) % mod; return o; }
    function l1Index(st) { return (EVEN_IDX[st.ep.join('')] * 16 + oriIdx(st.eo, 2)) * 81 + oriIdx(st.co, 3); }
    function l1Decode(x) { var co = oriDec(x % 81, 3, 3); x = (x / 81) | 0; var eo = oriDec(x % 16, 2, 2); x = (x / 16) | 0; return { cp: [0, 1, 2, 3, 4], co: co, ep: EVEN[x].slice(), eo: eo }; }
    function l2Index(st) { return EVEN_IDX[st.cp.join('')] * 60 + EVEN_IDX[st.ep.join('')]; }
    function l2Decode(x) { return { cp: EVEN[(x / 60) | 0].slice(), co: [0, 0, 0, 0, 0], ep: EVEN[x % 60].slice(), eo: [0, 0, 0, 0, 0] }; }
    // 绕 U 旋转 r×72° 的面映射
    var ROT = [0, 1, 2, 3, 4].map(function (r) {
      return MM.FACES.map(function (f, i) {
        var v = MM.vec.rot(MM.NORMALS[i], MM.NORMALS[U], -r * Math.PI * 2 / 5);
        for (var j = 0; j < NF; j++) if (MM.vec.dot(v, MM.NORMALS[j]) > 0.999) return j;
      });
    });
    function rotateU(alg, r) { return alg.map(function (mi) { var m = MM.moves[MM.faceMoves[mi]]; return TOK_IDX[MM.FACES[ROT[r][m.faceIndex]] + MM.faceMoves[mi].slice(MM.FACES[m.faceIndex].length)]; }); }
    var data = null, macros = null, look1 = null, look2 = null;
    function load(json) {
      data = json;
      macros = json.macros.map(function (s) { return s.split(' ').map(function (t) { return TOK_IDX[t]; }); });
      function dec(b64) {
        var bin = typeof atob === 'function' ? atob(b64) : Buffer.from(b64, 'base64').toString('binary'), u = new Uint8Array(bin.length);
        for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
        return new Uint16Array(u.buffer);
      }
      look1 = dec(json.look1); look2 = dec(json.look2);
    }
    function run(codes, table, idxFn) {
      var out = [];
      for (var guard = 0; guard < 40; guard++) {
        var m = table[idxFn(fromCodes(codes))];
        if (m === 65535) return out;
        var inv = macros[m].slice().reverse().map(inverseMove);
        inv.forEach(function (mi) { var T = MOVE_T[mi]; for (var q = 0; q < 50; q++) codes[q] = T[codes[q]]; });
        out = out.concat(inv);
      }
      throw new Error('megaminx LL table loop');
    }
    function solve(codes) {
      if (!data) throw new Error('megaminx LL table not loaded');
      var a = run(codes, look1, l1Index), b = run(codes, look2, l2Index);
      return { look1: a, look2: b };
    }
    return { fromCodes: fromCodes, solvedLL: solvedLL, effectOf: effectOf, applyEffect: applyEffect, effectKey: effectKey, isIdentity: isIdentity,
      preservesOrientation: preservesOrientation, l1Index: l1Index, l1Decode: l1Decode, l2Index: l2Index, l2Decode: l2Decode,
      L1_SIZE: 60 * 16 * 81, L2_SIZE: 3600, rotateU: rotateU, load: load, solve: solve, loaded: function () { return !!data; } };
  })();

  function solveCodes(cd, opts) {
    opts = opts || {};
    var codes = new Int16Array(50), t0 = Date.now(), stats = { nodes: 0, phases: [] };
    for (var i = 0; i < 20; i++) codes[i] = cd.c[i];
    for (i = 0; i < 30; i++) codes[20 + i] = 60 + cd.e[i];
    var sol = [];
    PLAN.forEach(function (st, si) {
      var next = PLAN[si + 1], twoGen = next && popcount(next.S) === 2, groups, tablesFor = null;
      if (popcount(st.S) === 2) {
        // 二面阶段：一次性求解，启发值用几张较大的联合表
        var cs = st.add.filter(function (p) { return p < 20; }), es = st.add.filter(function (p) { return p >= 20; });
        groups = [st.add];
        tablesFor = function () { return [buildTable(cs.concat(es.slice(0, 2)), st.S), buildTable(cs.slice(0, 1).concat(es), st.S), buildTable(cs.slice(1).concat(es.slice(2)), st.S)]; };
      } else groups = chunk(st.add);
      var base = codes.slice(), last = groups.length - 1, tp = Date.now();
      // 带棱朝向的最后一组可能很深（13–15 步、启发值弱）：给它节点预算；超出时换上一组的另一个解（不同的起点）再试，预算逐渐放宽
      for (var attempt = 0; ; attempt++) {
        var c = base.slice(), seqs = [], okAll = true, done = [], doneTables = [];
        for (var gi = 0; gi <= last; gi++) {
          var g = groups[gi], target = done.concat(g), tables = tablesFor ? tablesFor() : doneTables.concat([buildTable(g, st.S)]);
          var eoGroup = twoGen && gi === last, search = eoGroup ? tables.concat([buildEO(st.S, next.S)]) : tables;
          var lim = eoGroup && last > 0 && attempt < 24 ? { nodes: 300000 << (attempt >> 3) } : gi === last - 1 && twoGen ? { skip: attempt } : null;
          var s = idaStep(c, target, search, st.S, opts.maxDepth || 40, stats, lim);
          if (!s) { okAll = false; break; }
          seqs.push(s); done = target; doneTables = tables;
        }
        if (okAll) break;
      }
      stats.retries = (stats.retries || 0) + attempt;
      codes.set(c);
      seqs.forEach(function (s) { sol = sol.concat(s); stats.phases.push(s.length); });
      (stats.pms = stats.pms || []).push(Date.now() - tp);
    });
    stats.ms = Date.now() - t0;
    return { moves: sol.map(function (mi) { return MM.faceMoves[mi]; }), stats: stats, codes: codes };
  }

  /**
   * 完整求解：贴纸状态 → 转动记号序列（WCA 记号，HTM）。
   * 校验 → 找到让 12 个中心回到原位的整体旋转 r → 在该参照系里做 F2L（逐面块构建）+ 两步顶层公式 →
   * 把记号按 r 换回原始参照系（中心随面转动不动，所以等价于重命名面）→ 合并相邻同面转动。
   */
  function solve(state, opts) {
    var t0 = Date.now(), v = MM.validate(state);
    if (!v.ok) { var e = new Error(v.errors.join('\n')); e.issues = v.issues; throw e; }
    var f2l = solveCodes(v.codes, opts), codes = f2l.codes;
    var ll = LL.solve(codes);
    var seq = f2l.moves.map(function (t) { return TOK_IDX[t]; }).concat(ll.look1, ll.look2);
    for (var p = 0; p < 50; p++) if (codes[p] !== solvedCode(p)) throw new Error('megaminx solver: not solved');
    seq = simplify(seq);
    var toks = MM.relabel(seq.map(function (mi) { return MM.faceMoves[mi]; }), v.rotation);
    return { moves: toks, f2lLength: f2l.moves.length, llLength: ll.look1.length + ll.look2.length, ms: Date.now() - t0, rotation: v.rotation };
  }

  var api = { solve: solve, LL: LL, simplify: simplify, inverseMove: inverseMove, PLAN: PLAN, chunk: chunk, buildTable: buildTable, solveCodes: solveCodes, MOVE_T: MOVE_T, MOVE_FACE: MOVE_FACE, solvedCode: solvedCode, pieceFaces: pieceFaces, tableCache: tableCache };
  root.MegaminxSolver = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : (typeof self !== 'undefined' ? self : globalThis));
