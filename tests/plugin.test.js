global.CubeModel = require('../puzzles/cube3/model.js');
const CL = require('../js/core/registry.js');
require('../puzzles/cube3/cube3.js');
const Cube = require('../vendor/cube.js'); require('../vendor/solve.js');
const P = CL.getPuzzle('cube3');
let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.log('FAIL', m); } else console.log('ok  ', m); };
ok(P.stickers.length === 54 && P.pieces.length === 26 && Object.keys(P.moves).length === 27, '54 stickers / 26 pieces / 27 moves (18 face + 9 slice)');
ok(P.tracks.length === 15 && P.tracks.every(t => t.stickers.length === (t.kind === 'face' ? 8 : 12)), '15 tracks (6×8 face rings + 9×12 layer rings incl. M/E/S)');
ok(Object.values(P.moves).every(m => m.slice ? m.pieces.length === 8 && m.paths.length === 12 : m.pieces.length === 9 && m.paths.length === 20), 'face move: 9 pieces / 20 paths; slice move: 8 pieces / 12 paths');
{ // 中层转动：几何生成的置换与模型的面转动置换算法一致；方向符合 WCA（M 同 L、E 同 D、S 同 F）
  const geomOk = 'URFDLB'.split('').every(f => { const n = P.moves[f].axis; return CL.cube3GeomPerm(n, P.moves[f].angle, p => p[0] * n[0] + p[1] * n[1] + p[2] * n[2] > 0.5).join() === P.moves[f].perm.join(); });
  ok(geomOk, 'geometric permutation generator reproduces all 6 face turns');
  const s0 = P.solvedState(), ctr = (st, f) => st[P.faces.find(x => x.id === f).center];
  ok(ctr(P.apply(s0, 'M'), 'F') === 'W' && ctr(P.apply(s0, 'E'), 'F') === 'O' && ctr(P.apply(s0, 'S'), 'R') === 'W', 'M: U→F, E: L→F, S: U→R (WCA directions)');
  ok(P.apply(s0, "M E S M' E' S'").join() !== s0.join() && P.isSolved(P.apply(s0, "M M M M E2 E2 S' S")), 'slice moves compose correctly');
}
const solved = P.solvedState();
for (const t of Object.keys(P.moves)) ok(P.apply(P.apply(solved, [t]), [P.moves[t].inverse]).join() === solved.join(), 'inverse ' + t);
const sexy = Array(6).fill("R U R' U'").join(' ');
ok(P.apply(solved, sexy).join() === solved.join(), "(R U R' U')×6 = identity");
const lay = P.graphLayout(); ok(lay.nodes.length === 54 && lay.nodes.every(p => p && isFinite(p[0])), 'graph layout 54 nodes');
ok(lay.circles.length === 9 && new Set(lay.circles.map(c => c.cx + ',' + c.cy)).size === 3, '9 circles in 3 concentric families');
{ // 每条侧面轨道的 12 个节点都在同一个圆上，且转动 = 圆上循环次序的整体平移
  let good = 0;
  for (const tr of P.tracks.filter(t => t.kind === 'side')) {
    const c = lay.circles.find(c => tr.stickers.every(i => Math.abs(Math.hypot(lay.nodes[i][0] - c.cx, lay.nodes[i][1] - c.cy) - c.r) < 1e-9));
    if (!c) continue;
    const ids = tr.stickers.slice().sort((a, b) => Math.atan2(lay.nodes[a][1] - c.cy, lay.nodes[a][0] - c.cx) - Math.atan2(lay.nodes[b][1] - c.cy, lay.nodes[b][0] - c.cx));
    const idx = {}; ids.forEach((id, k) => idx[id] = k);
    const m = P.moves[tr.base], shifts = new Set(ids.map((id, k) => ((idx[m.perm[id]] - k) % 12 + 12) % 12));
    if (shifts.size === 1) good++;
  }
  ok(good === 9, 'all 9 layer turns (6 faces + M/E/S) = rigid circular shift of 12 nodes on a single circle (' + good + '/9)');
}
{ // 已还原时每个面的 9 个节点紧凑成簇：簇内最大半径 < 簇中心间最小距离的一半
  const cent = P.faces.map(f => lay.nodes[f.center]);
  const spread = Math.max(...P.faces.map((f, k) => Math.max(...f.stickers.map(i => Math.hypot(lay.nodes[i][0] - cent[k][0], lay.nodes[i][1] - cent[k][1])))));
  let minD = 1e9; cent.forEach((a, i) => cent.forEach((b, j) => { if (i < j) minD = Math.min(minD, Math.hypot(a[0] - b[0], a[1] - b[1])); }));
  ok(spread < minD / 2, `face clusters compact (max radius ${spread.toFixed(2)} < ${(minD / 2).toFixed(2)})`);
  const mind = Math.min(...lay.nodes.flatMap((a, i) => lay.nodes.map((b, j) => i < j ? Math.hypot(a[0] - b[0], a[1] - b[1]) : 1e9)));
  ok(mind > lay.nodeRadius * 1.6, `no overlapping nodes (min distance ${mind.toFixed(3)} vs radius ${lay.nodeRadius})`);
}
{ // 握法：重命名后的记号与旋转后的几何一致（面法线按 orientation 旋转后 = 新记号面的法线；转角不变）
  const rot = (v, o) => { // 欧拉 XYZ（three.js 默认顺序），这里只需支持单轴
    let [x, y, z] = v; const [a, b, c] = o;
    [y, z] = [y * Math.cos(a) - z * Math.sin(a), y * Math.sin(a) + z * Math.cos(a)];
    [x, z] = [x * Math.cos(b) + z * Math.sin(b), -x * Math.sin(b) + z * Math.cos(b)];
    [x, y] = [x * Math.cos(c) - y * Math.sin(c), x * Math.sin(c) + y * Math.cos(c)];
    return [x, y, z].map(Math.round);
  };
  for (const h of P.holds) {
    const good = Object.keys(P.moves).every(t => { const v = h.toView[t], m = P.moves[t], mv = P.moves[v];
      // 比较「轴 × 角」（中层转动的轴取参考面法线，z2 下方向会反转）
      const w1 = rot(m.axis, h.orientation).map(x => x * m.angle), w2 = mv.axis.map(x => x * mv.angle);
      const same = (a, b) => a.every((x, k) => Math.abs(x - b[k]) < 1e-9), half = Math.abs(Math.abs(m.angle) - Math.PI) < 1e-9;
      return mv && (same(w1, w2) || (half && same(w1, w2.map(x => -x)))) && h.fromView[v] === t; });   // 180° 正反等价
    ok(good, 'hold ' + h.id + ': relabelled notation matches on-screen geometry for all 27 moves');
  }
  ok(P.holds[0].toView['R'] === 'L' && P.holds[0].toView["U'"] === "D'" && P.holds[0].toView.F2 === 'F2' && P.holds[0].toView.M === "M'" && P.holds[0].toView.E === "E'" && P.holds[0].toView.S === 'S', "yellow-top hold: R→L, U′→D′, F2→F2, M→M′, E→E′, S→S");
}
{ // 弧线路由（与参考视频逐帧观察一致）：每个圆上 4 个面区间隔约 60°/60°/60°/180°，
  // 按「总路程最短」定方向时，90° 转动中 9 块贴纸走 ≈60° 的短弧，只有 3 块（一个面区）跨越 180° 的空弧。
  let okc = 0;
  for (const tr of P.tracks.filter(t => t.kind === 'side')) {
    const c = lay.circles.find(c => tr.stickers.every(i => Math.abs(Math.hypot(lay.nodes[i][0] - c.cx, lay.nodes[i][1] - c.cy) - c.r) < 1e-9));
    const m = P.moves[tr.base], an = i => Math.atan2(lay.nodes[i][1] - c.cy, lay.nodes[i][0] - c.cx);
    const ccw = (a, b) => ((b - a) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
    const d1 = tr.stickers.map(i => ccw(an(i), an(m.perm[i]))), d2 = d1.map(d => 2 * Math.PI - d);
    const tot1 = d1.reduce((a, b) => a + b), tot2 = d2.reduce((a, b) => a + b), d = tot1 <= tot2 ? d1 : d2;
    const deg = d.map(x => x * 180 / Math.PI).sort((a, b) => a - b);
    if (deg.slice(0, 9).every(x => x < 80) && deg.slice(9).every(x => x > 150 && x < 200)) okc++;
    else console.log('   arcs', tr.id, deg.map(x => x.toFixed(0)).join(' '));
  }
  ok(okc === 9, 'shortest-total routing: 9 short (~60°) arcs + 3 crossing the 180° gap on every face ring (' + okc + '/9)');
}
try { P.parse('R X'); ok(false, 'parse error'); } catch (e) { ok(/X/.test(e.message), 'parse error message: ' + e.message); }
Cube.initSolver();
for (let k = 0; k < 20; k++) {
  const scr = P.randomScramble(); const st = P.apply(solved, scr);
  const enc = P.solvers[0].encode(st); const sol = Cube.fromString(enc.facelets).solve(22).trim().split(/\s+/).filter(Boolean);
  if (!P.isSolved(P.apply(st, sol)) || sol.length > 22) { ok(false, 'solve ' + scr); }
}
ok(true, '20 random scrambles solved with ≤22 moves via plugin encode + cubejs');
console.log(fails ? fails + ' FAILURES' : 'ALL PASS'); process.exit(fails ? 1 : 0);
