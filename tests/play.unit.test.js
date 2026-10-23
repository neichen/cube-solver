// 「自己玩」核心逻辑（Node）：拖动→转动映射（2–15 阶全部单层转动都可拖出、方向与置换一致）、随机状态合法性、键盘记号
global.window = global; global.CubeLab = {};
require('../js/core/registry.js'); require('../puzzles/cube3/model.js'); require('../puzzles/cube3/cube3.js');
global.NxNModel = require('../puzzles/nxn/nxn-model.js'); require('../puzzles/nxn/nxn.js');
const PL = require('../js/core/play-core.js');
let fails = 0, passes = 0; const ok = (c, m) => { if (c) passes++; else { fails++; console.log('  ✘ FAIL:', m); } };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
for (let n = 2; n <= 15; n++) {
  const P = CubeLab.getPuzzle(n === 3 ? 'cube3' : 'cube' + n), map = PL.turnMap(P);
  // 每个轴 × 每层 × 2 方向都有记号
  ok(Object.keys(map).length === 3 * n * 2, `${n}×${n}: ${Object.keys(map).length} single-layer quarter turns mapped (want ${6 * n})`);
  // 物理一致性：拖动贴纸 si 沿 d，转动后原 si 的颜色应到达「贴纸点绕轴转 90°」后的位置（= 法线变为 d 的那块贴纸）
  let bad = 0, cnt = 0;
  P.stickers.forEach((s, si) => {
    PL.inPlaneAxes(P, si).forEach(e => [1, -1].forEach(sg => {
      const d = e.map(x => x * sg), tok = PL.turnFor(P, si, d); cnt++;
      if (!tok) { bad++; return; }
      const dest = P.stickers[P.moves[tok].perm[si]];
      // 目的贴纸法线 = d（贴纸被转到 d 方向的面上）或贴纸在同一面内沿 d 移动（面内贴纸：法线不变且位置沿 d 前进）
      const same = dest.normal.join() === s.normal.join();
      const moved = same ? (dest.pos[0] - s.pos[0]) * d[0] + (dest.pos[1] - s.pos[1]) * d[1] + (dest.pos[2] - s.pos[2]) * d[2] > 0 : dest.normal.join() === d.join();
      if (!moved) bad++;
    }));
  });
  ok(bad === 0, `${n}×${n}: all ${cnt} sticker drags give a turn that moves the sticker in the drag direction (bad ${bad})`);
}
// 具体记号（WCA 内部坐标：F 面 k = 行·n + 列）
const F = (n, r, c) => 2 * n * n + r * n + c, U = (n, r, c) => r * n + c;
const exp = [[3, F(3, 2, 2), [0, 1, 0], 'R'], [3, F(3, 0, 2), [-1, 0, 0], 'U'], [3, F(3, 2, 1), [0, 1, 0], "M'"], [3, U(3, 0, 2), [0, 0, 1], "R'"],
  [4, F(4, 3, 2), [0, 1, 0], '2R'], [7, F(7, 6, 3), [0, 1, 0], "M'"], [7, F(7, 6, 1), [0, 1, 0], "2L'"], [2, F(2, 1, 1), [0, 1, 0], 'R']];
for (const [n, si, d, want] of exp) { const P = CubeLab.getPuzzle(n === 3 ? 'cube3' : 'cube' + n), got = PL.turnFor(P, si, d); ok(got === want, `${n}×${n} drag sticker ${si} along ${d} → ${got} (want ${want})`); }
// 随机状态
for (const id of ['cube2', 'cube3']) {
  const P = CubeLab.getPuzzle(id); let okc = 0; const seen = new Set();
  for (let i = 0; i < 200; i++) { const s = PL.randomState(P); if (P.validate(s).ok) okc++; seen.add(s.join('')); }
  ok(okc === 200 && seen.size > 190, `${id}: 200 random states all valid (${okc}), distinct ${seen.size}`);
}
// 键盘
const k = (key, sh, pre) => PL.keyToken(key, sh, pre);
ok(k('r', false).tok === 'R' && k('R', true).tok === "R'" && k('m', true).tok === "M'" && k('x', false).tok === 'x', 'keys r / Shift+R / Shift+M / x');
let pre = k('3', false).prefix; pre = k('w', false, pre).prefix; ok(k('r', false, pre).tok === '3Rw', '3 w r → 3Rw');
ok(k('2', false).prefix.depth === '2' && k('u', false, k('2', false).prefix).tok === '2U', '2 u → 2U');
ok(PL.formatTime(83456) === '1:23.45' && PL.formatTime(9876) === '9.87', 'formatTime');
const P4 = CubeLab.getPuzzle('cube4'); ok(PL.countMoves(P4, ['R', 'x', 'Rw', "2R'"]) === 3 && PL.metricFor(P4) === 'BTM', 'count excludes rotations');
const mem = { s: {}, getItem(k) { return this.s[k] || null; }, setItem(k, v) { this.s[k] = v; } };
ok(PL.saveBest('cube3', 20000, mem) && !PL.saveBest('cube3', 25000, mem) && PL.saveBest('cube3', 15000, mem) && PL.getBest('cube3', mem) === 15000, 'best time persistence');
console.log(`play unit: ${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
