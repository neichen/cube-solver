// gullicube WASM（Node，同一份 vendor 构建）：随机打乱 → 求解 → 用本项目模型校验
// 用法：node tests/gullicube.test.js [阶数列表=5,7,10,15] [fast|quality|both]
const X = require('../puzzles/nxn/nxn-model.js'), G = require('./gullicube-node.js');
const sizes = (process.argv[2] || '5,7,10,15').split(',').map(Number), mode = process.argv[3] || 'fast';
let seed = 7; const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x80000000; };
const apply = (n, st, toks) => { const M = X.build(n); for (const t of toks) { const k = X.normalize(n, t); if (!k) throw new Error('bad token ' + t); st = X.applyPerm(st, M.moves[k].perm); } return st; };
(async () => {
  let fail = 0;
  for (const n of sizes) for (const fast of (mode === 'both' ? [true, false] : [mode === 'fast'])) {
    const st = apply(n, X.solvedState(n), X.randomScramble(n, rnd)), v = X.validate(n, st, { prefer: 'centers' });
    const r = await G.run(n, v.facelets, { fast, threads: 4 });
    const solved = X.isSolved(n, apply(n, v.facelets.split(''), r.moves));
    if (!solved) fail++;
    console.log(`${n}×${n} ${fast ? 'fast' : 'quality'}: ${r.moves.length} SSTM-tokens, ${(r.ms / 1000).toFixed(1)} s, ${solved ? 'SOLVED' : 'NOT SOLVED'}`);
  }
  console.log(fail ? 'gullicube: FAILED ' + fail : 'gullicube: ALL PASS');
  process.exit(fail ? 1 : 0);
})();
