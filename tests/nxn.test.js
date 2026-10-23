// N×N 测试：模型（2–15 阶）、2×2 最优求解器、自研 4×4 降阶求解器（随机打乱 → 求解 → 校验）
// 用法：node tests/nxn.test.js [4×4 样本数=6]
const X = require('../puzzles/nxn/nxn-model.js');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; } else { fail++; console.log('  ✘ FAIL:', m); } };
let seed = 20261022; const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x80000000; };
const apply = (n, st, toks) => { const M = X.build(n); for (const t of toks) { const k = X.normalize(n, t); if (!k) throw new Error('bad token ' + t); st = X.applyPerm(st, M.moves[k].perm); } return st; };
const inv = t => t.endsWith("'") ? t.slice(0, -1) : t.endsWith('2') ? t : t + "'";

// 模型
for (let n = 2; n <= 15; n++) {
  const M = X.build(n), S = X.solvedState(n);
  ok(S.length === 6 * n * n && X.isSolved(n, S), n + ': solved state');
  let allInv = true; for (const t of M.order) { if (!X.isSolved(n, X.applyPerm(X.applyPerm(S, M.moves[t].perm), M.moves[M.moves[t].inverse].perm))) { allInv = false; break; } }
  ok(allInv, n + ': every move undone by its inverse (' + M.order.length + ' moves)');
  ok(X.isSolved(n, apply(n, S, Array(6).fill("R U R' U'".split(' ')).flat())), n + ': (R U R\' U\')×6 = identity');
  const sc = X.randomScramble(n, rnd), st = apply(n, S, sc);
  ok(!X.isSolved(n, st) && X.isSolved(n, apply(n, st, sc.slice().reverse().map(inv))), n + ': scramble + inverse');
  const v = X.validate(n, st, { prefer: 'centers' });
  ok(v.ok, n + ': scrambled state validates' + (v.ok ? '' : ' ' + v.errors.join('; ')));
  if (n >= 3) { const bad = st.slice(); const c0 = bad[0]; bad[0] = bad[bad.length - 1]; bad[bad.length - 1] = c0; if (bad[0] !== bad[bad.length - 1]) ok(!X.validate(n, bad).ok, n + ': swapped two corner stickers is rejected'); }
}
console.log('model: ' + pass + ' passed');

// 2×2
const C2 = require('../puzzles/nxn/cube2.worker.js');
let t0 = Date.now(); C2.init(); const init2 = Date.now() - t0; let tot2 = 0, ms2 = 0, max2 = 0; const N2 = 100;
for (let i = 0; i < N2; i++) {
  const st = apply(2, X.solvedState(2), X.randomScramble(2, rnd)), v = X.validate(2, st, { prefer: 'dbl' });
  t0 = Date.now(); const sol = C2.solve(v.facelets); ms2 += Date.now() - t0;
  ok(X.isSolved(2, apply(2, v.facelets.split(''), sol)), '2×2 solve #' + i); ok(sol.length <= 11, '2×2 ≤ 11 HTM'); tot2 += sol.length; max2 = Math.max(max2, sol.length);
}
console.log(`2×2 optimal: init ${init2} ms, ${N2} scrambles, avg ${(tot2 / N2).toFixed(2)} HTM (max ${max2}), avg ${(ms2 / N2).toFixed(1)} ms`);

// 4×4
const C4 = require('../puzzles/nxn/cube4.worker.js');
t0 = Date.now(); C4.init(); const init4 = Date.now() - t0; const N4 = +process.argv[2] || 6; let tot4 = 0, ms4 = 0, max4 = 0;
for (let i = 0; i < N4; i++) {
  const st = apply(4, X.solvedState(4), X.randomScramble(4, rnd)), v = X.validate(4, st, { prefer: 'centers' });
  t0 = Date.now(); const r = C4.solve(v.facelets, { timeBudget: 4000 }); const ms = Date.now() - t0; ms4 += ms;
  ok(X.isSolved(4, apply(4, v.facelets.split(''), r.moves)), '4×4 solve #' + i);
  ok(r.moves.every(t => /^[URFDLB]w?['2]?$/.test(t)), '4×4 only outer / wide moves (OBTM)');
  tot4 += r.moves.length; max4 = Math.max(max4, r.moves.length);
  console.log(`  4×4 #${i}: ${r.moves.length} OBTM, phases ${JSON.stringify(r.stats.phases)} tm ${JSON.stringify(r.stats.tm)}, ${ms} ms`);
}
console.log(`4×4 reduction: init ${init4} ms, ${N4} scrambles, avg ${(tot4 / N4).toFixed(1)} OBTM (max ${max4}), avg ${(ms4 / N4 / 1000).toFixed(1)} s`);
console.log(fail ? `NxN: ${pass} passed, ${fail} FAILED` : `NxN: ALL PASS (${pass})`);
process.exit(fail ? 1 : 0);
