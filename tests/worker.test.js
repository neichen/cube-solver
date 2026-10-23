/* 在 Node 中模拟 Worker 环境，测试 kociemba.worker.js：最优短解 + 两阶段 + 缩短 */
const fs = require('fs'), path = require('path'), vm = require('vm');
const dir = path.join(__dirname, '../puzzles/cube3');
globalThis.self = globalThis;
globalThis.importScripts = (...fs_) => fs_.forEach(f => vm.runInThisContext(fs.readFileSync(path.resolve(dir, f), 'utf8'), { filename: f }));
let resolveMsg; globalThis.postMessage = m => resolveMsg(m);
vm.runInThisContext(fs.readFileSync(path.join(dir, 'kociemba.worker.js'), 'utf8'));
const M = globalThis.CubeModel;
const call = msg => new Promise(r => { resolveMsg = r; self.onmessage({ data: msg }); });
let fails = 0; const ok = (c, m) => { console.log(c ? '  ✔' : '  ✘ FAIL', m); if (!c) fails++; };
const facelets = st => M.validate(st).facelets;
(async () => {
  let r = await call({ id: 1, cmd: 'init' }); ok(r.ok, `init ${r.ms} ms`);
  for (const [scr, n] of [["R U R' U'", 4], ['R2 U2', 2], ["F R U' L2 B D2", 6], ['', 0], ["R L'", 2], ["U R2 F B R B2 R U2 L B2", null]]) {
    const st = M.applyMoves(M.solvedState(), scr);
    r = await call({ id: 2, cmd: 'solve', payload: { facelets: facelets(st), maxDepth: 22, timeBudget: 800 } });
    const solved = M.isSolved(M.applyMoves(st, r.moves.join(' ')));
    ok(solved && (n === null || (r.moves.length === n && r.optimal)), `"${scr || '(复原)'}" → ${r.moves.length} 步${r.optimal ? '（最优）' : `（两阶段 ${r.firstLength} → 缩短 ${r.moves.length}）`} ${r.moves.join(' ')}  ${r.ms}ms`);
  }
  for (let k = 0; k < 5; k++) {
    const st = M.applyMoves(M.solvedState(), M.randomScramble(25));
    r = await call({ id: 3, cmd: 'solve', payload: { facelets: facelets(st), timeBudget: 600 } });
    ok(M.isSolved(M.applyMoves(st, r.moves.join(' '))) && r.moves.length <= 22, `随机 #${k + 1}: ${r.firstLength} → ${r.moves.length} 步, ${r.ms}ms`);
  }
  console.log(fails ? fails + ' FAILURES' : 'ALL PASS'); process.exit(fails ? 1 : 0);
})();
