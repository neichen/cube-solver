const M = require('../puzzles/cube3/model.js');
const Cube = require('../vendor/cube.js'); require('../vendor/solve.js');
let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.log('FAIL', m); } };
const solvedF = 'URFDLB'.split('').map(f => f.repeat(9)).join('').split('');
for (const mv of ['R','U','F','D','L','B',"R'",'U2']) ok(M.applyMoves(solvedF, mv).join('') === new Cube().move(mv).asString(), 'move ' + mv);
for (let t = 0; t < 50; t++) { const s = M.randomScramble(25); ok(M.applyMoves(solvedF, s).join('') === new Cube().move(s).asString(), 'scr ' + s); }
const st = M.applyMoves(M.solvedState(), M.randomScramble());
ok(M.validate(st).ok, 'valid scramble');
// twist corner
let tw = st.slice(); [tw[8], tw[9], tw[20]] = [st[9], st[20], st[8]]; ok(/扭转/.test(M.validate(tw).errors.join()), 'twist');
let fl = st.slice(); [fl[5], fl[10]] = [st[10], st[5]]; ok(/翻转/.test(M.validate(fl).errors.join()), 'flip');
// swap two edges (both facelets) -> parity
let pa = M.solvedState(); [pa[5], pa[7]] = [pa[7], pa[5]]; [pa[10], pa[19]] = [pa[19], pa[10]]; ok(/奇偶/.test(M.validate(pa).errors.join()), 'parity ' + M.validate(pa).errors);
let cnt = M.solvedState(); cnt[0] = 'R'; ok(/9 块/.test(M.validate(cnt).errors.join()), 'count');
console.time('init'); Cube.initSolver(); console.timeEnd('init');
for (let t = 0; t < 5; t++) { const s = M.applyMoves(M.solvedState(), M.randomScramble()); const v = M.validate(s); const sol = Cube.fromString(v.facelets).solve(); ok(M.isSolved(M.applyMoves(s, sol)), 'solve'); console.log(sol.split(' ').length, sol); }
console.log(fails ? fails + ' failures' : 'ALL PASS');
