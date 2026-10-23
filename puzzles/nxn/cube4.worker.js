/*
 * 4×4 降阶求解器（OBTM：外层与宽层转动各计 1 步）。本项目自写代码，分阶段思路参考公开的
 * Tsai / TPR 类降阶法，但不含任何第三方代码。
 *
 *   P1  把 R/L 两色中心块放到 R/L 两面                      （36 种转动，精确距离表 C(24,8)=735 471）
 *   P2  把 U/D 两色中心块放到 U/D 两面，同时“定向”全部翼棱    （28 种转动：外层 + Rw/Lw + Uw2/Dw2/Fw2/Bw2）
 *       —— 在 P3 的转动群下，24 个翼棱位置恰好分成两类（每条棱各 1 个），定向 = 每块翼棱都在本类位置上
 *   P3  中心全部复原 + 12 组翼棱配对 + 消除 PLL 奇偶          （20 种转动：U D F B、R2 L2 与 6 个宽层半转）
 *       —— P2 的定向保证不会出现 OLL 奇偶；PLL 奇偶以“低位翼棱排列奇偶 ⊕ 角块排列奇偶”一位记录
 *   P4  得到的等价 3×3 交给 Kociemba 两阶段（cubejs，MIT）
 * 每阶段都用 IDA*，在时间预算内尝试多组前阶段候选解，取总步数最少者。
 */
(function (root) {
  'use strict';
  var isWorker = typeof importScripts === 'function' && typeof module === 'undefined';
  var X = root.NxNModel, Cube = root.Cube;
  if (isWorker) {
    if (!X) { importScripts('nxn-model.js'); X = root.NxNModel; }
    if (!Cube) { importScripts('../../vendor/cube.js', '../../vendor/solve.js'); Cube = root.Cube; }
    if (!root.CubeLabTablePack) importScripts('../../js/core/table-pack.js');
  } else if (typeof require !== 'undefined') {
    X = X || require('./nxn-model.js');
    Cube = Cube || require('../../vendor/solve.js') && require('../../vendor/cube.js');
  }
  var FACES = 'URFDLB', AXIS = { U: 1, D: 1, R: 0, L: 0, F: 2, B: 2 };
  var M4, PC, CEN, cenOf, WS, wingOf, ALLOWED, HOMEC, CLS, C0, C1, slotEdge;
  var MOVES = [], ready = false, cubeReady = false;
  var P1M, P2M, P3M, P4M;
  var H1, H2C, H2W, HC3, C4ID, C4LIST, C4MV, H3aC, H3aE, R12, H4CE, H4Q, Q8, Q8I, EPERM, NC4;
  var LOWR, HIGHR, POP, R16, R8, UNR8;
  var NRL, UD16GOAL, W0GOAL, AX8, RLGOOD;

  function popc(x) { var c = 0; while (x) { x &= x - 1; c++; } return c; }
  function binom(n, k) { if (k < 0 || k > n) return 0; var r = 1; for (var i = 1; i <= k; i++) r = r * (n - k + i) / i; return Math.round(r); }
  function parity(p) { var seen = [], par = 0; for (var i = 0; i < p.length; i++) { if (seen[i]) continue; var j = i, l = 0; while (!seen[j]) { seen[j] = 1; j = p[j]; l++; } par += l - 1; } return par & 1; }
  function rank24(m) { var lo = m & 4095; return LOWR[lo] + HIGHR[POP[lo] * 4096 + (m >>> 12)]; }

  // 任意槽位排列 → 掩码转换表（每 8 位一张 256 表）
  function maskMover(perm, nbits) {
    var nb = Math.ceil(nbits / 8), T = new Int32Array(nb * 256);
    for (var b = 0; b < nb; b++) for (var v = 0; v < 256; v++) {
      var out = 0; for (var i = 0; i < 8; i++) if (v & (1 << i)) { var s = b * 8 + i; if (s < nbits) out |= 1 << perm[s]; }
      T[b * 256 + v] = out;
    }
    return T;
  }
  function mv24(T, x) { return T[x & 255] | T[256 + ((x >>> 8) & 255)] | T[512 + (x >>> 16)]; }

  var PRE = null;   // 预计算表包（见 js/core/table-pack.js）；缺失或校验失败时现场计算
  function pre(name, len) { var a = PRE && PRE[name]; return a && a.length === len ? a : null; }
  function init(pack) {
    if (ready) return;
    PRE = pack || null;
    var t0 = Date.now(); init.marks = []; var mk = function (n) { init.marks.push(n + ':' + (Date.now() - t0)); }; init.mk = mk;
    M4 = X.build(4); PC = X.pieces(4);
    CEN = PC.centers[0]; cenOf = {}; CEN.forEach(function (s, k) { cenOf[s] = k; });
    WS = PC.wings[0].slots; wingOf = {}; WS.forEach(function (s, k) { wingOf[s.st[0]] = k; wingOf[s.st[1]] = k; });
    ALLOWED = X.wingTable(4, 0);
    HOMEC = WS.map(function (s) { return [FACES[(s.st[0] / 16) | 0], FACES[(s.st[1] / 16) | 0]]; });
    // 秩表
    LOWR = new Int32Array(4096); POP = new Uint8Array(4096); HIGHR = new Int32Array(13 * 4096);
    for (var v = 0; v < 4096; v++) {
      POP[v] = popc(v); var r = 0, i = 0;
      for (var b = 0; b < 12; b++) if (v & (1 << b)) { i++; r += binom(b, i); }
      LOWR[v] = r;
      for (var kl = 0; kl <= 12; kl++) { var rr = 0, j = kl; for (var b2 = 0; b2 < 12; b2++) if (v & (1 << b2)) { j++; rr += binom(12 + b2, j); } HIGHR[kl * 4096 + v] = rr; }
    }
    R16 = new Int32Array(65536); for (v = 0; v < 65536; v++) { var r3 = 0, i3 = 0; for (b = 0; b < 16; b++) if (v & (1 << b)) { i3++; r3 += binom(b, i3); } R16[v] = r3; }
    R8 = new Int32Array(256); UNR8 = []; for (v = 0; v < 256; v++) if (popc(v) === 4) { R8[v] = UNR8.length; UNR8.push(v); }

    // 转动：块编号用于同轴转动的规范顺序（同轴转动互相交换）
    var BLK = { '': 0, w: 1 };
    M4.order.forEach(function (t) {
      var m = M4.moves[t]; if (m.kind !== 'outer' && !(m.kind === 'wide' && m.depths.length === 2)) return;
      var f = m.face, pos = 'URF'.indexOf(f) >= 0 ? 0 : 2, wide = m.kind === 'wide' ? 1 : 0;
      var suf = t.slice(-1), q = suf === '2' ? 2 : suf === "'" ? 3 : 1;
      var cp = CEN.map(function (s) { return cenOf[m.perm[s]]; }), wp = WS.map(function (s) { return wingOf[m.perm[s.st[0]]]; });
      MOVES.push({ tok: t, face: f, axis: AXIS[f], block: pos + wide, q: q, wide: !!wide, cp: cp, wp: wp, cflip: q === 2 ? 0 : 1 });
    });
    function sel(fn) { return MOVES.filter(fn); }
    P1M = MOVES.slice();
    P2M = sel(function (m) { return !m.wide || m.axis === 0 || m.q === 2; });
    P3M = sel(function (m) { return m.wide ? m.q === 2 : (m.axis !== 0 || m.q === 2); });

    // 翼棱分类（P3 群下的两条轨道）
    var par = []; for (var k = 0; k < 24; k++) par[k] = k;
    function fnd(x) { while (par[x] !== x) { par[x] = par[par[x]]; x = par[x]; } return x; }
    P3M.forEach(function (m) { for (var k = 0; k < 24; k++) { var a = fnd(k), b = fnd(m.wp[k]); if (a !== b) par[a] = b; } });
    var r0 = fnd(0); CLS = []; for (k = 0; k < 24; k++) CLS[k] = fnd(k) === r0 ? 0 : 1;
    C0 = []; C1 = []; slotEdge = WS.map(function (s) { return s.edge; });
    for (k = 0; k < 24; k++) (CLS[k] ? C1 : C0)[WS[k].edge] = k;
    W0GOAL = 0; for (k = 0; k < 24; k++) if (!CLS[k]) W0GOAL |= 1 << k;

    // 中心：P2 用到的 16 个非 R/L 位置；P3 每轴 8 个位置
    NRL = []; var nrlOf = {}; AX8 = [[], [], []]; var ax8Of = {};
    CEN.forEach(function (s, k) { var f = FACES[(s / 16) | 0]; if (AXIS[f] !== 0) { nrlOf[k] = NRL.length; NRL.push(k); } ax8Of[k] = AX8[AXIS[f]].length; AX8[AXIS[f]].push(k); });
    UD16GOAL = 0; NRL.forEach(function (k, i) { if (AXIS[FACES[(CEN[k] / 16) | 0]] === 1) UD16GOAL |= 1 << i; });
    var RLGOAL = 0; CEN.forEach(function (s, k) { if (AXIS[FACES[(s / 16) | 0]] === 0) RLGOAL |= 1 << k; });

    MOVES.forEach(function (m) {
      m.T24c = maskMover(m.cp, 24); m.T24w = maskMover(m.wp, 24); m.wflip = parity(m.wp);
      if (P2M.indexOf(m) >= 0) { var p16 = NRL.map(function (k) { return nrlOf[m.cp[k]]; }); m.T16 = maskMover(p16, 16); }
      if (P3M.indexOf(m) >= 0) {
        m.C70 = [0, 1, 2].map(function (ax) {
          var p8 = AX8[ax].map(function (k) { var d = m.cp[k]; if (AX8[ax].indexOf(d) < 0) throw new Error('P3 axis'); return ax8Of[d]; });
          var T = maskMover(p8, 8), out = new Uint8Array(70); UNR8.forEach(function (mk, r) { out[r] = R8[T[mk]]; }); return out;
        });
        var e0 = [], e1 = [];
        for (var e = 0; e < 12; e++) { e0[e] = slotEdge[m.wp[C0[e]]]; e1[e] = slotEdge[m.wp[C1[e]]]; if (CLS[m.wp[C0[e]]] !== 0) throw new Error('P3 class'); }
        m.E0 = e0; m.E1 = e1;
        m.T0 = new Uint16Array(1728); m.T1 = new Uint16Array(1728);
        for (var t = 0; t < 1728; t++) { var a = (t / 144) | 0, bb = ((t / 12) | 0) % 12, c = t % 12;
          m.T0[t] = e0[a] * 144 + e0[bb] * 12 + e0[c]; m.T1[t] = e1[a] * 144 + e1[bb] * 12 + e1[c]; }
        m.pflip = parity(e0) ^ m.cflip; m.qflip = parity(e0) ^ parity(e1);
      }
    });

    // 距离表
    mk('setup'); H1 = pre('H1', 735471) || bfs24(RLGOAL, 8, P1M, 'T24c'); mk('H1');
    H2W = pre('H2W', 5408312) || bfs24p(W0GOAL, 12, P2M); mk('H2W');   // 翼棱定向 × 翼棱排列奇偶
    // P3 中心：三轴 70^3
    HC3 = pre('HC3', 343000);
    (function () {
      var g = [0, 1, 2].map(function (ax) { var mk = 0; AX8[ax].forEach(function (k, i) { if ('URF'.indexOf(FACES[(CEN[k] / 16) | 0]) >= 0) mk |= 1 << i; }); return R8[mk]; });
      var s = g[0] * 4900 + g[1] * 70 + g[2];
      if (HC3) { HC3.goal = s; return; }
      HC3 = new Uint8Array(343000).fill(255); var Q = new Int32Array(343000), h = 0, t = 0; HC3[s] = 0; Q[t++] = s;
      while (h < t) { var x = Q[h++], d = HC3[x] + 1, a = (x / 4900) | 0, b = ((x / 70) | 0) % 70, c = x % 70;
        for (var i = 0; i < P3M.length; i++) { var C = P3M[i].C70, y = C[0][a] * 4900 + C[1][b] * 70 + C[2][c]; if (HC3[y] === 255) { HC3[y] = d; Q[t++] = y; } } }
      HC3.goal = s;
    })();
    // P2 中心：U/D 两色在 16 个非 R/L 位置上的分布 × R/L 轴的 70 种分布；R/L 轴只能取 P3 可解的 12 种
    var good = {}; for (var q = 0; q < 343000; q++) if (HC3[q] !== 255) good[(q / 4900) | 0] = 1;
    RLGOOD = Object.keys(good).map(Number);
    P2M.forEach(function (m) { var p8 = AX8[0].map(function (k) { return ax8Of[m.cp[k]]; }), T = maskMover(p8, 8), out = new Uint8Array(70);
      UNR8.forEach(function (mk, r) { out[r] = R8[T[mk]]; }); m.RL70 = out; });
    mk('HC3'); H2C = pre('H2C', 900900);
    if (!H2C) (function () { H2C = new Uint8Array(12870 * 70).fill(255); var Q = [], h; RLGOOD.forEach(function (g) { H2C[R16[UD16GOAL] * 70 + g] = 0; Q.push(UD16GOAL * 128 + g); });
      for (h = 0; h < Q.length; h++) { var x = Q[h] >> 7, rl = Q[h] & 127, d = H2C[R16[x] * 70 + rl] + 1;
        for (var i = 0; i < P2M.length; i++) { var T = P2M[i].T16, y = T[x & 255] | T[256 + (x >>> 8)], r2 = P2M[i].RL70[rl], r = R16[y] * 70 + r2;
          if (H2C[r] === 255) { H2C[r] = d; Q.push(y * 128 + r2); } } } })();
    mk('H2C'); initP3();
    ready = true;
    mk('P3'); init.ms = Date.now() - t0;
  }
  function bfs24p(goal, k, moves) {
    var N = binom(24, k) * 2, D = new Uint8Array(N).fill(255), Q = new Int32Array(N), h = 0, t = 0, nm = moves.length;
    var T = moves.map(function (m) { return m.T24w; }), F = moves.map(function (m) { return m.wflip; });
    D[rank24(goal) * 2] = 0; Q[t++] = goal * 2;
    while (h < t) { var x = Q[h++], m0 = x >>> 1, p = x & 1, d = D[rank24(m0) * 2 + p] + 1;
      for (var i = 0; i < nm; i++) { var Ti = T[i], y = Ti[m0 & 255] | Ti[256 + ((m0 >>> 8) & 255)] | Ti[512 + (m0 >>> 16)], q = p ^ F[i], r = rank24(y) * 2 + q;
        if (D[r] === 255) { D[r] = d; Q[t++] = y * 2 + q; } } }
    return D;
  }
  function bfs24(goal, k, moves, key) {
    var N = binom(24, k), D = new Uint8Array(N).fill(255), Q = new Int32Array(N), h = 0, t = 0;
    D[rank24(goal)] = 0; Q[t++] = goal;
    while (h < t) { var x = Q[h++], d = D[rank24(x)] + 1;
      for (var i = 0; i < moves.length; i++) { var y = mv24(moves[i][key], x), r = rank24(y); if (D[r] === 255) { D[r] = d; Q[t++] = y; } } }
    return D;
  }

  // ---------------------------------------------------------------- 状态读取
  function readState(f) {   // f: 96 个面字母
    var cen = CEN.map(function (s) { return f[s]; });
    var wing = WS.map(function (s, k) {
      var a = f[s.st[0]], b = f[s.st[1]], al = ALLOWED[k];
      for (var j in al) { var h = HOMEC[j], o = al[j]; if ((o === 0 && h[0] === a && h[1] === b) || (o === 1 && h[1] === a && h[0] === b)) return +j; }
      throw new Error('wing ' + k + ' ' + a + b);
    });
    var cp = PC.corners.map(function (ids) { var fl = ids.map(function (x) { return f[x]; }), ori = fl.findIndex(function (c) { return c === 'U' || c === 'D'; });
      return X.CORNER_C.findIndex(function (s) { return s[0] === fl[ori] && s[1] === fl[(ori + 1) % 3] && s[2] === fl[(ori + 2) % 3]; }); });
    return { cen: cen, wing: wing, cpar: parity(cp) };
  }
  function c24(st, test) { var m = 0; for (var k = 0; k < 24; k++) if (test(st.cen[k])) m |= 1 << k; return m; }

  // ---------------------------------------------------------------- IDA*
  function canon(prev, m) { return !prev || prev.axis !== m.axis || m.block > prev.block; }
  function idaGeneric(start, moves, hfun, step, goal, maxDepth, maxSols, deadline, nodeLimit, weight) {
    var sols = [], path = [], nodes = 0, stop = false, W = weight || 1;
    function dfs(s, g, bound, prev) {
      var h = hfun(s); if (g + h * W > bound) return;
      if (h === 0 && goal(s, path)) { sols.push(path.slice()); if (sols.length >= maxSols) stop = true; return; }
      if (g === bound) return;
      if ((++nodes & 4095) === 0 && ((deadline && Date.now() > deadline && sols.length) || (nodeLimit && nodes > nodeLimit))) { stop = true; return; }
      for (var i = 0; i < moves.length && !stop; i++) { var m = moves[i]; if (!canon(prev, m)) continue;
        path.push(m); dfs(step(s, m), g + 1, bound, m); path.pop(); }
    }
    for (var b = hfun(start); b <= maxDepth && !sols.length && !stop; b++) { dfs(start, 0, b, null); if (api.log) console.log('  bound', b, 'nodes', nodes); }
    // 同长度再多取一些（maxSols 控制）
    return sols;
  }

  // ---------------------------------------------------------------- P3a / P3b
  // P3a（20 种转动）：中心进入 P3b 可解的 1/n 子集 + E 层（FR FL BL BR）的 8 块翼棱回到 E 层
  // P3b（16 种转动：U D、F2 B2 R2 L2、6 个宽层半转）：中心复原 + 全部配对 + PLL 奇偶
  function initP3() {
    P4M = P3M.filter(function (m) { return m.wide || m.axis === 1 || m.q === 2; });
    // P3b 中心：从复原态在 P4 群下 BFS，压缩编号
    C4ID = new Int32Array(343000).fill(-1); C4LIST = [HC3.goal]; C4ID[HC3.goal] = 0;
    for (var h = 0; h < C4LIST.length; h++) { var x = C4LIST[h], a = (x / 4900) | 0, b = ((x / 70) | 0) % 70, c = x % 70;
      for (var i = 0; i < P4M.length; i++) { var C = P4M[i].C70, y = C[0][a] * 4900 + C[1][b] * 70 + C[2][c]; if (C4ID[y] < 0) { C4ID[y] = C4LIST.length; C4LIST.push(y); } } }
    NC4 = C4LIST.length;
    C4MV = new Int32Array(NC4 * P4M.length);
    for (h = 0; h < NC4; h++) { x = C4LIST[h]; a = (x / 4900) | 0; b = ((x / 70) | 0) % 70; c = x % 70;
      for (i = 0; i < P4M.length; i++) { C = P4M[i].C70; C4MV[h * P4M.length + i] = C4ID[C[0][a] * 4900 + C[1][b] * 70 + C[2][c]]; } }
    // P3a 中心距离：G3 下到 P3b 可解子集
    init.mk('C4'); var Q, qt = 0, qh = 0; H3aC = pre('H3aC', 343000);
    if (!H3aC) { H3aC = new Uint8Array(343000).fill(255); Q = new Int32Array(343000);
    for (h = 0; h < NC4; h++) { H3aC[C4LIST[h]] = 0; Q[qt++] = C4LIST[h]; } }
    while (qh < qt) { x = Q[qh++]; var d = H3aC[x] + 1; a = (x / 4900) | 0; b = ((x / 70) | 0) % 70; c = x % 70;
      for (i = 0; i < P3M.length; i++) { C = P3M[i].C70; var y2 = C[0][a] * 4900 + C[1][b] * 70 + C[2][c]; if (H3aC[y2] === 255) { H3aC[y2] = d; Q[qt++] = y2; } } }
    // P3a 棱：E 层低位 / 高位翼棱所在位置（12 位掩码各取 4 位）→ 495 × 495
    R12 = new Int32Array(4096).fill(-1); var n495 = 0; for (var v = 0; v < 4096; v++) if (popc(v) === 4) R12[v] = n495++;
    P3M.forEach(function (m) { m.M0 = new Uint16Array(4096); m.M1 = new Uint16Array(4096);
      for (var v = 0; v < 4096; v++) { var o0 = 0, o1 = 0; for (var e = 0; e < 12; e++) if (v & (1 << e)) { o0 |= 1 << m.E0[e]; o1 |= 1 << m.E1[e]; } m.M0[v] = o0; m.M1[v] = o1; } });
    init.mk('H3aC'); var EG = 0xF00, QQ = []; H3aE = pre('H3aE', 245025);
    if (!H3aE) { H3aE = new Uint8Array(495 * 495).fill(255); QQ.push(EG * 4096 + EG); H3aE[R12[EG] * 495 + R12[EG]] = 0; }
    for (h = 0; h < QQ.length; h++) { var ml = (QQ[h] / 4096) | 0, mh = QQ[h] % 4096, dd = H3aE[R12[ml] * 495 + R12[mh]] + 1;
      for (i = 0; i < P3M.length; i++) { var nl = P3M[i].M0[ml], nh = P3M[i].M1[mh], r = R12[nl] * 495 + R12[nh]; if (H3aE[r] === 255) { H3aE[r] = dd; QQ.push(nl * 4096 + nh); } } }
    // P3b：E 层 4 低 + 4 高的排列（24 × 24）与中心合并成精确表；U/D 层 8 条棱用“4 组棱”配对表（1680²）
    P4M.forEach(function (m) { for (var e = 0; e < 12; e++) if ((e >= 8) !== (m.E0[e] >= 8) || (e >= 8) !== (m.E1[e] >= 8)) throw new Error('P4 slice'); });
    EPERM = []; var EPI = {};
    (function rec(pre) { if (pre.length === 4) { EPI[pre.join('')] = EPERM.length; EPERM.push(pre.slice()); return; } for (var k = 0; k < 4; k++) if (pre.indexOf(k) < 0) { pre.push(k); rec(pre); pre.pop(); } })([]);
    P4M.forEach(function (m) { m.EP0 = new Uint8Array(24); m.EP1 = new Uint8Array(24);
      EPERM.forEach(function (pp, k) { m.EP0[k] = EPI[pp.map(function (x) { return m.E0[8 + x] - 8; }).join('')]; m.EP1[k] = EPI[pp.map(function (x) { return m.E1[8 + x] - 8; }).join('')]; }); });
    var NE = 576, nm4 = P4M.length;
    init.mk('H3aE'); qh = 0; qt = 0; var k; H4CE = pre('H4CE', NC4 * NE);
    if (!H4CE) { H4CE = new Uint8Array(NC4 * NE).fill(255); Q = new Int32Array(NC4 * NE); for (k = 0; k < 24; k++) { H4CE[k * 24 + k] = 0; Q[qt++] = k * 24 + k; } }
    while (qh < qt) { x = Q[qh++]; d = H4CE[x] + 1; var cc = (x / NE) | 0, ee = x % NE, el = (ee / 24) | 0, eh = ee % 24;
      for (i = 0; i < nm4; i++) { var m4 = P4M[i], y3 = C4MV[cc * nm4 + i] * NE + m4.EP0[el] * 24 + m4.EP1[eh]; if (H4CE[y3] === 255) { H4CE[y3] = d; Q[qt++] = y3; } } }
    Q8 = []; Q8I = new Int32Array(4096).fill(-1);
    for (var q0 = 0; q0 < 8; q0++) for (var q1 = 0; q1 < 8; q1++) for (var q2 = 0; q2 < 8; q2++) for (var q3 = 0; q3 < 8; q3++) {
      if (q0 === q1 || q0 === q2 || q0 === q3 || q1 === q2 || q1 === q3 || q2 === q3) continue; Q8I[q0 * 512 + q1 * 64 + q2 * 8 + q3] = Q8.length; Q8.push([q0, q1, q2, q3]); }
    var NQ = Q8.length;
    P4M.forEach(function (m) { m.Q0 = new Uint16Array(NQ); m.Q1 = new Uint16Array(NQ);
      Q8.forEach(function (q, k) { m.Q0[k] = Q8I[m.E0[q[0]] * 512 + m.E0[q[1]] * 64 + m.E0[q[2]] * 8 + m.E0[q[3]]]; m.Q1[k] = Q8I[m.E1[q[0]] * 512 + m.E1[q[1]] * 64 + m.E1[q[2]] * 8 + m.E1[q[3]]]; }); });
    init.mk('H4CE'); H4Q = new Uint8Array(NQ * NQ).fill(255); Q = new Int32Array(NQ * NQ); qh = 0; qt = 0;
    for (k = 0; k < NQ; k++) { H4Q[k * NQ + k] = 0; Q[qt++] = k * NQ + k; }
    while (qh < qt) { x = Q[qh++]; d = H4Q[x] + 1; var lq = (x / NQ) | 0, hq = x % NQ;
      for (i = 0; i < nm4; i++) { var y4 = P4M[i].Q0[lq] * NQ + P4M[i].Q1[hq]; if (H4Q[y4] === 255) { H4Q[y4] = d; Q[qt++] = y4; } } }
    H4Q.NQ = NQ;
  }
  function edgeArr(st) { var L = [], Hh = []; for (var e = 0; e < 12; e++) { L[e] = slotEdge[st.wing.indexOf(C0[e])]; Hh[e] = slotEdge[st.wing.indexOf(C1[e])]; } return { L: L, H: Hh }; }
  function cenIdx(st) { var r = []; for (var a = 0; a < 3; a++) { var mk = 0; AX8[a].forEach(function (k, i) { if ('URF'.indexOf(st.cen[k]) >= 0 && AXIS[st.cen[k]] === a) mk |= 1 << i; }); r.push(R8[mk]); } return r[0] * 4900 + r[1] * 70 + r[2]; }
  function p3aSearch(st, maxSols, deadline, f, nodeLimit) {
    var E = edgeArr(st), ml = 0, mh = 0;
    function viable(s, path) { if (!f) return true; var g = applyToks(f, path.map(function (m) { return m.tok; })); var st2 = readState(g), B = p3bStart(st2); if (B.h === 255 || B.S[3] !== 0) return false; var E2 = edgeArr(st2); return parity(E2.L.slice(0, 8)) === parity(E2.H.slice(0, 8)); }
    for (var e = 8; e < 12; e++) { ml |= 1 << E.L[e]; mh |= 1 << E.H[e]; }
    function h(s) { var a = H3aC[s[0]], b = H3aE[R12[s[1]] * 495 + R12[s[2]]]; return a > b ? a : b; }
    function step(s, m) { var C = m.C70, x = s[0], a = (x / 4900) | 0, b = ((x / 70) | 0) % 70, c = x % 70; return [C[0][a] * 4900 + C[1][b] * 70 + C[2][c], m.M0[s[1]], m.M1[s[2]], s[3] ^ m.pflip, s[4] ^ m.qflip]; }
    var pq = parity(E.L) ^ st.cpar, qq = parity(E.L) ^ parity(E.H);
    return idaGeneric([cenIdx(st), ml, mh, pq, qq], P3M, h, step, function (s, path) { return s[3] === 0 && s[4] === 0 && viable(s, path); }, 20, maxSols, deadline, nodeLimit);
  }
  var QG = [[0, 1, 2, 3], [4, 5, 6, 7], [0, 2, 4, 6], [1, 3, 5, 7], [0, 1, 4, 5], [2, 3, 6, 7], [0, 3, 4, 7], [1, 2, 5, 6]];
  function p3bStart(st) {
    var E = edgeArr(st), NG = QG.length, W = 4 + 2 * NG, S = new Int32Array(W * 40), NQ = H4Q.NQ;
    var cid = C4ID[cenIdx(st)]; if (cid < 0) return { h: 255 };
    var el = [], eh = []; for (var k = 0; k < 4; k++) { el.push(E.L[8 + k] - 8); eh.push(E.H[8 + k] - 8); }
    var ie = function (p) { for (var j = 0; j < 24; j++) if (EPERM[j].join('') === p.join('')) return j; return -1; };
    S[0] = cid; S[1] = ie(el); S[2] = ie(eh); S[3] = parity(E.L) ^ st.cpar;
    for (var g = 0; g < NG; g++) { var G = QG[g]; S[4 + g] = Q8I[E.L[G[0]] * 512 + E.L[G[1]] * 64 + E.L[G[2]] * 8 + E.L[G[3]]]; S[4 + NG + g] = Q8I[E.H[G[0]] * 512 + E.H[G[1]] * 64 + E.H[G[2]] * 8 + E.H[G[3]]]; }
    function h(o) { var v = H4CE[S[o] * 576 + S[o + 1] * 24 + S[o + 2]];
      for (var g = 0; g < NG; g++) { var w = H4Q[S[o + 4 + g] * NQ + S[o + 4 + NG + g]]; if (w > v) v = w; } return v; }
    return { S: S, W: W, NG: NG, NQ: NQ, hf: h, h: h(0) };
  }
  function p3bSearch(st, maxSols, deadline, nodeLimit) {
    var B = p3bStart(st), S = B.S, W = B.W, NG = B.NG, NQ = B.NQ, h = B.hf, nm = P4M.length;
    if (B.h === 255) return [];
    if (false) { var cnt=0; for (var z=0;z<H4CE.length;z++) if(H4CE[z]<255)cnt++; console.log('p3b start', NC4, cnt, H4CE[S[0]*576+S[1]*24+S[2]], QG.map(function(G,g){return H4Q[S[4+g]*NQ+S[4+NG+g]];}), S[3]); }
    var sols = [], path = [], nodes = 0, stop = false;
    function dfs(depth, bound, prev) {
      var o = depth * W, hv = h(o);
      if (depth + hv > bound) return;
      if (hv === 0 && S[o + 3] === 0) { sols.push(path.slice()); if (sols.length >= maxSols) stop = true; return; }
      if (depth === bound) return;
      if ((++nodes & 8191) === 0 && ((deadline && Date.now() > deadline) || (nodeLimit && nodes > nodeLimit))) { stop = true; return; }
      var o2 = o + W;
      for (var i = 0; i < nm && !stop; i++) {
        var m = P4M[i]; if (prev && prev.axis === m.axis && m.block <= prev.block) continue;
        S[o2] = C4MV[S[o] * nm + i]; S[o2 + 1] = m.EP0[S[o + 1]]; S[o2 + 2] = m.EP1[S[o + 2]]; S[o2 + 3] = S[o + 3] ^ m.pflip;
        var Q0 = m.Q0, Q1 = m.Q1;
        for (var g = 0; g < NG; g++) { S[o2 + 4 + g] = Q0[S[o + 4 + g]]; S[o2 + 4 + NG + g] = Q1[S[o + 4 + NG + g]]; }
        path.push(m); dfs(depth + 1, bound, m); path.pop();
      }
    }
    for (var b = h(0); b <= 30 && !sols.length && !stop; b++) { dfs(0, b, null); if (api.log) console.log('  p3b bound', b, 'nodes', nodes); }
    p3bSearch.nodes = nodes;
    return sols;
  }
  function p2Search(st, maxSols, deadline, nodeLimit, weight) {
    var m16 = 0; NRL.forEach(function (k, i) { if (AXIS[st.cen[k]] === 1) m16 |= 1 << i; });
    var w = 0; st.wing.forEach(function (piece, slot) { if (CLS[piece] === 0) w |= 1 << slot; });
    var rl = 0; AX8[0].forEach(function (k, i) { if (st.cen[k] === 'R') rl |= 1 << i; });
    // 零分配 IDA*；翼棱整体排列奇偶（= OLL 奇偶）在 P3 群下不变，所以并入翼棱距离表，在 P2 里归零
    var A = new Int32Array(30), Wm = new Int32Array(30), Rl = new Int32Array(30), Pp = new Int32Array(30);
    A[0] = m16; Wm[0] = w; Rl[0] = R8[rl]; Pp[0] = parity(st.wing);
    var nm = P2M.length, Wt = weight || 1, sols = [], path = [], nodes = 0, stop = false;
    function h(d) { var a = H2C[R16[A[d]] * 70 + Rl[d]], b = H2W[rank24(Wm[d]) * 2 + Pp[d]]; return a > b ? a : b; }
    function dfs(d, bound, prev) {
      var hv = h(d); if (d + hv * Wt > bound) return;
      if (hv === 0) { sols.push(path.slice()); if (sols.length >= maxSols) stop = true; return; }
      if (d >= bound || d >= 26) return;
      if ((++nodes & 4095) === 0 && ((deadline && Date.now() > deadline && sols.length) || (nodeLimit && nodes > nodeLimit))) { stop = true; return; }
      var x = A[d], y = Wm[d], d1 = d + 1;
      for (var i = 0; i < nm && !stop; i++) {
        var m = P2M[i]; if (prev && prev.axis === m.axis && m.block <= prev.block) continue;
        var T = m.T16, U = m.T24w;
        A[d1] = T[x & 255] | T[256 + (x >>> 8)];
        Wm[d1] = U[y & 255] | U[256 + ((y >>> 8) & 255)] | U[512 + (y >>> 16)];
        Rl[d1] = m.RL70[Rl[d]]; Pp[d1] = Pp[d] ^ m.wflip;
        path.push(m); dfs(d1, bound, m); path.pop();
      }
    }
    // 加权时界限按 d + w·h 计，上限也要乘 w（否则 w·h0 > 26 时根本不搜索）；实际深度另限 26
    for (var b = Math.ceil(h(0) * Wt), bmax = Math.ceil(26 * Wt); b <= bmax && !sols.length && !stop; b++) dfs(0, b, null);
    return sols;
  }
  function p1Search(st, maxSols, deadline) {
    var m = c24(st, function (c) { return AXIS[c] === 0; });
    return idaGeneric(m, P1M, function (s) { return H1[rank24(s)]; }, function (s, mv) { return mv24(mv.T24c, s); }, function () { return true; }, 20, maxSols, deadline);
  }

  function applyToks(f, toks) { var s = f; toks.forEach(function (t) { s = X.applyPerm(s, M4.moves[t].perm); }); return s; }
  function to3(f) {
    var m = [0, 1, 3], out = '';
    for (var fi = 0; fi < 6; fi++) for (var r = 0; r < 3; r++) for (var c = 0; c < 3; c++) out += f[fi * 16 + m[r] * 4 + m[c]];
    return out;
  }
  // 合并同轴相邻转动（同轴转动可交换）
  function simplify(toks) {
    var out = [], i = 0;
    while (i < toks.length) {
      var ax = AXIS[M4.moves[toks[i]].face], amt = {}, j = i;
      while (j < toks.length && AXIS[M4.moves[toks[j]].face] === ax) {
        var mm = M4.moves[toks[j]], base = toks[j].replace(/['2]$/, ''), suf = toks[j].slice(-1);
        amt[base] = ((amt[base] || 0) + (suf === '2' ? 2 : suf === "'" ? 3 : 1)) % 4; j++;
      }
      Object.keys(amt).sort(function (a, b) { return blockOf(a) - blockOf(b); }).forEach(function (b) { var q = amt[b]; if (q) out.push(b + (q === 2 ? '2' : q === 3 ? "'" : '')); });
      i = j;
    }
    return out;
  }
  function blockOf(base) { var f = base.replace('w', ''); return ('URF'.indexOf(f) >= 0 ? 0 : 2) + (base.indexOf('w') >= 0 ? 1 : 0); }

  function toks(sol) { return sol.map(function (m) { return m.tok; }); }
  function solve3(f, deadline) {
    var cube = Cube.fromString(to3(f)), sol = cube.solve(22).trim().split(/\s+/).filter(Boolean);
    while (sol.length > 12) { try { sol = cube.solve(sol.length - 1, deadline).trim().split(/\s+/).filter(Boolean); } catch (e) { break; } }
    return sol;
  }
  function solve(facelets, opts) {
    opts = opts || {};
    init();
    cubejsInit(null);
    var t0 = Date.now(), budget = opts.timeBudget || 4000, deadline = t0 + budget * 0.6;
    var f0 = facelets.split(''), cands = [], stats = {};
    var tm = stats.tm = [0, 0, 0, 0], tq = Date.now();
    var s1 = p1Search(readState(f0), opts.p1 || 8, deadline); tm[0] += Date.now() - tq;
    // P2 的难度随 P1 结尾差别很大：对各个 P1 候选轮流以递增的节点上限搜索
    var p1c = s1.map(function (sol) { var t = toks(sol); return { t1: t, f1: applyToks(f0, t), s2: null }; });
    tq = Date.now();
    // 先在节点上限内求精确最短；找不到时交替：加权 IDA*（h×w，解可能长 1–2 步）与节点上限翻倍的精确搜索。
    // 精确搜索的上限不断翻倍，保证一定终止（加权搜索在启发值平台区可能始终找不到）。
    var any = false, wgt = 1, lim = opts.p2lim0 || 100000, round = 0;
    while (!any) {
      for (var a0 = 0; a0 < p1c.length && !(any && lim > 200000); a0++) { var r2 = p2Search(readState(p1c[a0].f1), opts.p2 || 2, 0, lim); if (r2.length) { p1c[a0].s2 = r2; any = true; } }
      if (!any && lim >= (opts.p2lim1 || 200000) && round < (opts.wrounds != null ? opts.wrounds : 4)) {
        wgt = (opts.w0 || 1.4) + round * (opts.wstep || 0.3);
        for (a0 = 0; a0 < p1c.length && !any; a0++) { r2 = p2Search(readState(p1c[a0].f1), 1, 0, opts.wlim || 300000, wgt); if (r2.length) { p1c[a0].s2 = r2; any = true; } }
        if (api.log) console.log('   w', wgt.toFixed(1), any, Date.now() - tq);
        round++;
      }
      lim *= 2;
    }
    stats.p2weighted = wgt > 1;
    tm[1] += Date.now() - tq;
    p1c = p1c.filter(function (c) { return c.s2; });
    for (var a = 0; a < p1c.length; a++) {
      var t1 = p1c[a].t1, f1 = p1c[a].f1;
      var s2 = p1c[a].s2;
      for (var b = 0; b < s2.length; b++) {
        var t2 = toks(s2[b]), f2 = applyToks(f1, t2);
        tq = Date.now(); var s3 = p3aSearch(readState(f2), opts.p3 || 3, deadline, f2, cands.length ? 200000 : 0); tm[2] += Date.now() - tq;
        for (var c = 0; c < s3.length; c++) {
          var t3 = toks(s3[c]), f3 = applyToks(f2, t3);
          tq = Date.now(); var s4 = p3bSearch(readState(f3), 1, cands.length ? deadline : 0, cands.length ? 3e6 : 0); tm[3] += Date.now() - tq;
          if (!s4.length) continue;
          var t4 = toks(s4[0]), pre = t1.concat(t2, t3, t4);
          cands.push({ pre: pre, len: simplify(pre).length, f: applyToks(f3, t4), ph: [t1.length, t2.length, t3.length, t4.length] });
        }
        if (cands.length && Date.now() > deadline) break;
      }
      if (cands.length && Date.now() > deadline) break;
    }
    if (!cands.length) throw new Error('4x4 reduction failed');
    cands.sort(function (x, y) { return x.len - y.len; });
    var best = null, end = t0 + budget, K = Math.min(cands.length, 4);
    for (var k = 0; k < K; k++) {
      var cd = cands[k]; if (best && cd.len + 14 >= best.length) break;
      var left = end - Date.now(), dl = Date.now() + Math.max(150, left / (K - k));
      var all = simplify(cd.pre.concat(solve3(cd.f, dl)));
      if (!best || all.length < best.length) { best = all; stats.phases = cd.ph.concat([all.length - cd.len]); }
    }
    if (!X.isSolved(4, applyToks(f0, best))) throw new Error('4x4 verification failed');
    stats.candidates = cands.length; stats.ms = Date.now() - t0;
    return { moves: best, stats: stats };
  }

  // cubejs（3×3 收尾阶段）的剪枝表也走预计算表包；移动表很快，现场算
  var CJ_PRUNE = ['sliceTwist', 'sliceFlip', 'sliceURFtoDLFParity', 'sliceURtoDFParity'];
  function cubejsInit(pk) {
    if (cubeReady) return;
    if (pk) CJ_PRUNE.forEach(function (k) { if (pk[k] && Cube.pruningTables[k] === null) Cube.pruningTables[k] = pk[k]; });
    Cube.initSolver(); cubeReady = true;
  }
  var loading = null, loadInfo = null;
  function ensureAsync() {
    if (ready && cubeReady) return Promise.resolve();
    if (!loading) {
      var TP = root.CubeLabTablePack, t0 = Date.now();
      var p = Promise.all([TP.fetch('cube4-tables.bin.gz'), TP.fetch('../cube3/cubejs-prune.bin.gz')]);
      Cube.computeMoveTables();          // 下载期间先算 cubejs 移动表
      loading = p.then(function (r) { var t1 = Date.now(); init(r[0]); cubejsInit(r[1]);
        loadInfo = { pack4: !!r[0], packCubejs: !!r[1], waitMs: t1 - t0, buildMs: Date.now() - t1 }; });
    }
    return loading;
  }
  function packFilesNode() {   // Node（测试 / 构建）：直接读文件
    var fs = require('fs'), path = require('path'), zlib = require('zlib'), TP = require('../../js/core/table-pack.js');
    function rd(f) { try { return TP.decode(new Uint8Array(zlib.gunzipSync(fs.readFileSync(path.join(__dirname, f))))); } catch (e) { return null; } }
    return [rd('cube4-tables.bin.gz'), rd('../cube3/cubejs-prune.bin.gz')];
  }
  function initFromPacks() { var r = packFilesNode(); init(r[0]); cubejsInit(r[1]); return { pack4: !!r[0], packCubejs: !!r[1] }; }
  function exportTables() { init(); cubejsInit(null); var c = {}; CJ_PRUNE.forEach(function (k) { var a = Cube.pruningTables[k]; c[k] = a instanceof Uint32Array ? a : Uint32Array.from(a, function (x) { return x >>> 0; }); });
    return { cube4: { H1: H1, H2W: H2W, H2C: H2C, HC3: HC3, H3aC: H3aC, H3aE: H3aE, H4CE: H4CE }, cubejs: c }; }

  var api = { init: init, initFromPacks: initFromPacks, exportTables: exportTables, marks: function () { return init.marks; }, solve: solve, simplify: simplify, _p: function(){ return {T:{H1:H1,H2W:H2W,H2C:H2C,HC3:HC3,H3aC:H3aC,H3aE:H3aE,H4CE:H4CE,H4Q:H4Q},P3M:P3M,P4M:P4M,edgeArr:edgeArr,cenIdx:cenIdx,p1Search:p1Search,p2Search:p2Search,p3aSearch:p3aSearch,p3bSearch:p3bSearch,readState:readState,applyToks:applyToks}; } };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (isWorker) {
    self.onmessage = function (e) {
      var d = e.data, t0 = Date.now();
      function fail(err) { self.postMessage({ id: d.id, ok: false, error: String(err && err.message || err) }); }
      ensureAsync().then(function () {
        try {
          if (d.cmd === 'init') return self.postMessage({ id: d.id, ok: true, ms: Date.now() - t0, load: loadInfo });
          if (d.cmd === 'solve') { var r = solve(d.payload.facelets, d.payload); self.postMessage({ id: d.id, ok: true, moves: r.moves, optimal: false, stats: r.stats, ms: Date.now() - t0 }); }
        } catch (err) { fail(err); }
      }, fail);
    };
  }
})(typeof self !== 'undefined' ? self : this);
