// 金字塔 / 斜转：模型与群性质、完整 BFS 距离表（态数 / 上帝之数 / 表一致性）、校验器、随机状态 → 最优解 → 复原
// 用法：node tests/twisty.test.js [每种谜题的随机样本数=300]
global.TwistyModel = require('../puzzles/twisty/twisty-model.js');
const TM = global.TwistyModel;
const CL = require('../js/core/registry.js');
require('../puzzles/twisty/twisty.js');
const SAMPLES = +(process.argv[2] || 300);
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  ✘ FAIL:', m); } };
let seed = 20261022; const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x80000000; };
const EXPECT = { pyraminx: { core: 933120, comps: [11520, 81, 81], god: 11 }, skewb: { core: 3149280, comps: [360, 8748], god: 11 } };
const report = {};
for (const id of ['pyraminx', 'skewb']) {
  console.log('\n[' + id + ']');
  const M = TM.get(id), P = CL.getPuzzle(id), E = EXPECT[id], S = M.solvedState();
  const same = (a, b) => a.every((x, i) => x === b[i]);
  const ident = M.stickers.map((_, i) => i);
  // 转动：120°，3 次 = 恒等；与逆转动相消；置换是双射
  for (const t of M.allMoves) {
    const p = M.moves[t].perm;
    ok(new Set(p).size === p.length, t + ': permutation is a bijection');
    ok(same(M.apply(ident, [t, t, t]), ident), t + ': order 3');
    ok(same(M.apply(ident, [t, M.moves[t].inverse]), ident), t + ': undone by ' + M.moves[t].inverse);
    // 每块贴纸转动后仍在同一块内（块整体移动）
    const pcOf = []; M.pieces.forEach((pc, i) => pc.stickers.forEach(s => pcOf[s] = i));
    ok(M.pieces.every(pc => new Set(pc.stickers.map(s => pcOf[p[s]])).size === 1), t + ': pieces move rigidly');
  }
  ok(P.stickers.length === (id === 'pyraminx' ? 36 : 30) && P.pieces.length === 14, 'sticker / piece counts');
  ok(P.tracks.every(tr => tr.stickers.length === 3), 'all graph tracks are 3-cycles (' + P.tracks.length + ')');
  if (id === 'pyraminx') {
    // 顶角与所有转动可交换
    for (const t of ['u', 'l', 'r', 'b']) ok(M.allMoves.every(x => same(M.apply(ident, [t, x]), M.apply(ident, [x, t]))), t + ' commutes with every move');
  }
  // 分量 + 完整 BFS
  M.comps.forEach((c, i) => { TM.enumerate(M, c); ok(c.size === E.comps[i], 'component ' + c.names + ' = ' + c.size + ' states (expected ' + E.comps[i] + ')'); });
  const r = TM.buildTable(M);
  ok(r.size === E.core && r.reached === E.core, 'full BFS reaches all ' + r.reached + ' states (= product of components → components are independent)');
  ok(r.maxDepth === E.god, "God's number (measured) = " + r.maxDepth);
  console.log('  depth distribution: ' + r.counts.join(', ') + ' · build ' + r.ms + ' ms · table ' + (r.bytes / 1e6).toFixed(2) + ' MB');
  // 表一致性：每个非复原态都有距离 −1 的邻居，且相邻状态距离差 ≤ 1 ⇒ dist 就是真正的最短距离
  { const c0 = M.comps[M.coreComps[0]], c1 = M.comps[M.coreComps[1]], nm = M.order.length, nB = c1.size; let bad = 0;
    const t0 = Date.now();
    for (let i = 0; i < r.size; i++) {
      const a = (i / nB) | 0, b = i - a * nB, d = M.dist[i]; let down = d === 0;
      for (let m = 0; m < nm; m++) { const dj = M.dist[c0.table[a * nm + m] * nB + c1.table[b * nm + m]]; if (Math.abs(dj - d) > 1) bad++; if (dj === d - 1) down = true; }
      if (!down) bad++;
    }
    ok(bad === 0, 'distance table is a consistent BFS layering (' + (Date.now() - t0) + ' ms)'); }
  // 随机状态 → 最优解 → 复原；步数 = 距离（+ 顶角）
  let tot = 0, ms = 0, maxLen = 0, allOk = true, lenOk = true;
  const hist = {};
  for (let k = 0; k < SAMPLES; k++) {
    const st = TM.randomState(M, rnd);
    const v = TM.validate(M, st); if (!v.ok) { allOk = false; console.log(v.errors); continue; }
    const t0 = Date.now(), s = TM.solve(M, st); ms += Date.now() - t0;
    const after = M.apply(st, s.moves);
    if (!P.isSolved(after) || !same(after, S)) allOk = false;
    const lab = TM.identify(M, st).lab, d = M.dist[TM.coreIndex(M, lab)];
    const tips = id === 'pyraminx' ? s.moves.filter(x => /^[ulrb]/.test(x)).length : 0;
    if (s.moves.length - tips !== d) lenOk = false;
    tot += s.moves.length; maxLen = Math.max(maxLen, s.moves.length); hist[s.moves.length] = (hist[s.moves.length] || 0) + 1;
  }
  ok(allOk, SAMPLES + ' uniform random states validate and the solutions solve them');
  ok(lenOk, 'solution length (without tips) equals the BFS distance for every sample');
  console.log('  ' + SAMPLES + ' random states: avg ' + (tot / SAMPLES).toFixed(2) + ' moves, max ' + maxLen + ', avg solve ' + (ms / SAMPLES).toFixed(3) + ' ms');
  // 打乱公式 → 解法不长于打乱
  { const scr = P.randomScramble(rnd), st = P.apply(S, scr), s = TM.solve(M, st);
    ok(P.isSolved(P.apply(st, s.moves)) && s.moves.length <= scr.length, 'scramble (' + scr.length + ') → optimal solution (' + s.moves.length + ')'); }
  // 校验器
  ok(TM.validate(M, S).ok, 'solved state validates');
  { const st = S.slice(); st[0] = ''; const v = TM.validate(M, st); ok(!v.ok && v.issues[0].k === 'v.unpainted', 'unpainted sticker rejected'); }
  { const st = S.slice(); const j = st.findIndex(c => c !== st[0]); st[0] = st[j]; const v = TM.validate(M, st); ok(!v.ok && /^v.count/.test(v.issues[0].k), 'wrong color count rejected'); }
  { const st = TM.randomState(M, rnd), pcs = M.classMap[id === 'pyraminx' ? 'edge' : 'corner'].slots;
    // 原地翻转 / 扭转一个块
    const sl = pcs[2], tw = st.slice(); for (let t = 0; t < sl.length; t++) tw[sl[t]] = st[sl[(t + 1) % sl.length]];
    const v = TM.validate(M, tw); ok(!v.ok && v.issues[0].k === (id === 'pyraminx' ? 'v.flip' : 'v.twist'), 'single ' + (id === 'pyraminx' ? 'edge flip' : 'corner twist') + ' rejected (' + v.errors + ')'); }
  { const st = TM.randomState(M, rnd), cls = M.classMap[id === 'pyraminx' ? 'edge' : 'center'].slots;
    const a = cls[0], b = cls[1], sw = st.slice(); for (let t = 0; t < a.length; t++) { sw[a[t]] = st[b[t]]; sw[b[t]] = st[a[t]]; }
    const v = TM.validate(M, sw); ok(!v.ok && v.issues[0].k === 'v.parity', 'swap of two ' + (id === 'pyraminx' ? 'edges' : 'centers') + ' rejected (' + v.errors + ')'); }
  { const st = S.slice(), sl = M.classMap[id === 'pyraminx' ? 'edge' : 'corner'].slots[0]; st[sl[0]] = st[sl[1]];
    const v = TM.validate(M, st); ok(!v.ok, 'impossible color combination rejected (' + v.errors + ')'); }
  { // 握法错误：整体转一下（金字塔绕 U 轴 120° ≈ 交换轴心块位置；斜转把 UFR 角挪走）
    const st = M.apply(S, id === 'pyraminx' ? ['U', 'u', 'L', 'l', 'L', 'l'] : ['R']);
    const rotated = id === 'pyraminx' ? (() => { const ax = M.vertices.U; const rot = M.stickers.map(s => { const c = TM.vec.rot(s.centroid, TM.vec.norm(ax), 2 * Math.PI / 3), n = TM.vec.rot(s.normal, TM.vec.norm(ax), 2 * Math.PI / 3); return M.stickers.findIndex(q => Math.hypot(q.centroid[0] - c[0], q.centroid[1] - c[1], q.centroid[2] - c[2]) < 1e-6 && TM.vec.dot(q.normal, n) > 0.99); }); const o = S.slice(); rot.forEach((j, i) => o[j] = S[i]); return o; })()
      : (() => { const ax = TM.vec.norm([1, 1, 1]); const rot = M.stickers.map(s => { const c = TM.vec.rot(s.centroid, ax, Math.PI * 2 / 3), n = TM.vec.rot(s.normal, ax, Math.PI * 2 / 3); return M.stickers.findIndex(q => Math.hypot(q.centroid[0] - c[0], q.centroid[1] - c[1], q.centroid[2] - c[2]) < 1e-6 && TM.vec.dot(q.normal, n) > 0.99); }); const o = S.slice(); rot.forEach((j, i) => o[j] = S[i]); return o; })();
    const v = TM.validate(M, rotated);
    ok(!v.ok && v.issues[0].k === M.holdIssue, 'whole-puzzle rotation (wrong grip) is reported as ' + M.holdIssue + ' (' + v.errors + ')');
    void st; }
  report[id] = { states: r.size, god: r.maxDepth, buildMs: r.ms, bytes: r.bytes, avg: tot / SAMPLES, solveMs: ms / SAMPLES, counts: r.counts };
}
console.log('\n' + JSON.stringify(report));
console.log('twisty: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
