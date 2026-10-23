// 五魔方：模型（转动 / 逆 / 块刚性 / 旋转）、校验器、多阶段求解器（随机状态、整体旋转、Pochmann 打乱 → 复原）
// 用法：node tests/megaminx.test.js [随机样本数=200]
global.MegaminxModel = require('../puzzles/megaminx/megaminx-model.js');
const M = global.MegaminxModel;
const S = require('../puzzles/megaminx/megaminx-solver.js');
const CL = require('../js/core/registry.js');
require('../puzzles/megaminx/megaminx.js');
S.LL.load(require('../puzzles/megaminx/megaminx-ll.json'));
const SAMPLES = +(process.argv[2] || 200);
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  ✘ FAIL:', m); } };
let seed = 20261023; const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x80000000; };
const same = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
const ident = M.stickers.map((_, i) => i), SOLVED = M.solvedState();

console.log('[model]');
ok(M.stickers.length === 132 && M.faces.length === 12, '132 stickers, 12 faces');
ok(M.corners.length === 20 && M.edges.length === 30, '20 corners, 30 edges');
ok(M.allMoves.length === 52 && M.faceMoves.length === 48, '52 moves (48 face turns + R++ R-- D++ D--)');
const pcOf = []; M.pieces.forEach((pc, i) => pc.stickers.forEach(s => pcOf[s] = i));
for (const t of M.allMoves) {
  const mv = M.moves[t], p = mv.perm;
  ok(new Set(p).size === p.length, t + ': bijection');
  ok(same(M.apply(ident, [t, mv.inverse]), ident), t + ': undone by ' + mv.inverse);
  ok(M.pieces.every(pc => new Set(pc.stickers.map(s => pcOf[p[s]])).size === 1), t + ': pieces move rigidly');
  if (mv.kind === 'face') ok(same(M.apply(ident, Array(5).fill(t)), ident) && !same(M.apply(ident, [t]), ident), t + ': order 5');
}
for (const f of M.FACES) ok(same(M.apply(ident, [f, f]), M.apply(ident, [f + '2'])), f + ' twice = ' + f + '2');
ok(M.rotations.length === 60 && new Set(M.rotations.map(r => r.join())).size === 60, '60 distinct whole-puzzle rotations');
ok(M.isSolved(SOLVED) && M.validate(SOLVED).ok, 'solved state validates');

console.log('[validator]');
const P = CL.getPuzzle('megaminx');
ok(P && P.stickers.length === 132 && P.solvers.length === 1 && P.cameraPlan == null, 'plugin registered (no camera scan)');
const st0 = M.apply(SOLVED, ['R', 'U2', "F'"]);
ok(M.validate(st0).ok, 'scrambled state is valid');
{ const cd = M.randomCodes(rnd); cd.c[0] = (cd.c[0] - cd.c[0] % 3) + (cd.c[0] % 3 + 1) % 3; const v = M.validate(M.fromCodes(cd)); ok(!v.ok, 'twisted corner rejected'); }
{ const cd = M.randomCodes(rnd); cd.e[0] ^= 1; ok(!M.validate(M.fromCodes(cd)).ok, 'flipped edge rejected'); }
{ const cd = M.randomCodes(rnd), t = cd.e[0]; cd.e[0] = cd.e[1]; cd.e[1] = t; ok(!M.validate(M.fromCodes(cd)).ok, 'swapped edges (odd permutation) rejected'); }
{ const s = SOLVED.slice(); s[M.faces[0].center] = SOLVED[M.faces[1].center]; s[M.faces[1].center] = SOLVED[M.faces[0].center]; ok(!M.validate(s).ok, 'swapped centers rejected'); }
{ const s = SOLVED.slice(); s[1] = null; ok(!M.validate(s).ok, 'unpainted sticker rejected'); }

console.log('[solver] ' + SAMPLES + ' random states + rotations + Pochmann scrambles');
const lens = [], times = [];
function check(st, label) {
  const t0 = Date.now(); let r;
  try { r = S.solve(st); } catch (e) { ok(false, label + ': ' + e.message); return; }
  times.push(Date.now() - t0); lens.push(r.moves.length);
  ok(M.isSolved(M.apply(st, r.moves)), label + ': solution solves');
}
for (let i = 0; i < SAMPLES; i++) check(M.randomState(rnd), 'random #' + i);
for (let i = 0; i < 20; i++) check(M.applyPerm(M.randomState(rnd), M.rotations[(rnd() * 60) | 0]), 'rotated #' + i);
for (let i = 0; i < 20; i++) check(M.apply(SOLVED, M.pochmannScramble(rnd)), 'pochmann #' + i);
check(SOLVED, 'solved');
const avg = a => a.reduce((x, y) => x + y, 0) / a.length;
console.log(`  HTM avg ${avg(lens).toFixed(1)} max ${Math.max(...lens)} · time avg ${avg(times).toFixed(0)} ms max ${Math.max(...times)} ms`);
ok(Math.max(...times) < 3000, 'every solve under 3 s');
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
