// 扫描颜色识别：合成数据（打乱的 N×N，模拟光照 / 色温 / 噪声 / 反光）对比现有方法与新方法。
// 用法：node tests/scan-synth.test.js [每档次数=40] [阶数=2,3,4,5,6,7]
global.self = global; global.window = global; global.CubeLab = {};
const X = require('../puzzles/nxn/nxn-model.js'); global.NxNModel = X;
require('../js/core/camera-scan.js');
const CC = require('../js/core/color-cluster.js');
const classifyOld = CubeLab.colorUtil.classify;
const TRIALS = +process.argv[2] || 40, SIZES = (process.argv[3] || '2,3,4,5,6,7').split(',').map(Number);
let seed = 4242; const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x80000000; };
const gauss = () => { let u = 0, v = 0; while (!u) u = rnd(); while (!v) v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
const TRUE = { W: [205, 210, 215], Y: [215, 205, 45], G: [10, 150, 95], B: [15, 85, 185], R: [185, 30, 45], O: [235, 105, 30] };
const COND = {
  normal: { tint: 0.08, gain: [0.8, 1.15], noise: 6, grad: 0.1, glare: 0 },
  hard: { tint: 0.15, gain: [0.55, 1.25], noise: 10, grad: 0.2, glare: 0.04 },
  warm: { tint: 0.04, warm: [1.12, 1.0, 0.72], gain: [0.6, 1.2], noise: 8, grad: 0.15, glare: 0.02 },
  dim: { tint: 0.08, gain: [0.35, 0.6], noise: 7, grad: 0.15, glare: 0 },
};
function render(n, state, c) {
  const nn = n * n, tint = [0, 1, 2].map(() => 1 + (rnd() * 2 - 1) * c.tint).map((t, k) => t * (c.warm ? c.warm[k] : 1)), out = {};
  for (let f = 0; f < 6; f++) {
    const g = c.gain[0] + rnd() * (c.gain[1] - c.gain[0]), gx = (rnd() * 2 - 1) * c.grad, gy = (rnd() * 2 - 1) * c.grad;
    for (let k = 0; k < nn; k++) {
      const r = Math.floor(k / n), col = k % n, sh = g * (1 + gx * (col / (n - 1 || 1) - 0.5) * 2 + gy * (r / (n - 1 || 1) - 0.5) * 2);
      let rgb = TRUE[state[f * nn + k]].map((v, ch) => v * tint[ch] * sh + gauss() * c.noise);
      if (rnd() < c.glare) { const a = 0.4 + rnd() * 0.3; rgb = rgb.map(v => v * (1 - a) + 255 * a); }
      out[f * nn + k] = rgb.map(v => Math.max(0, Math.min(255, Math.round(v))));
    }
  }
  return out;
}
function oldMethod(n, samples) {
  const nn = n * n, odd = n % 2 === 1, solved = X.solvedState(n);
  const P = { colors: X.COLORS, stickers: Array.from({ length: 6 * nn }, (_, i) => ({ locked: odd && n > 1 && i % nn === (nn - 1) / 2 })) };
  return classifyOld(P, samples, { balanced: true, centerColor: i => solved[i] });
}
const apply = (n, st, toks) => { const M = X.build(n); for (const t of toks) st = X.applyPerm(st, M.moves[X.normalize(n, t)].perm); return st; };
const rows = []; let bad = 0;
for (const n of SIZES) for (const cname in COND) {
  const acc = { old: [0, 0, 0], clus: [0, 0, 0], full: [0, 0, 0] }; let ms = 0;
  for (let t = 0; t < TRIALS; t++) {
    const st = apply(n, X.solvedState(n), X.randomScramble(n, rnd)), smp = render(n, st, COND[cname]);
    const t0 = Date.now();
    const fixed = {}; if (n % 2) { const nn = n * n, sv = X.solvedState(n); for (let f = 0; f < 6; f++) fixed[f * nn + (nn - 1) / 2] = sv[f * nn + (nn - 1) / 2]; }
    const res = { old: oldMethod(n, smp), clus: CC.classifyCube(n, smp, { structured: false, fixed }), full: CC.classifyCube(n, smp, { fixed }) };
    ms += Date.now() - t0;
    for (const m in res) { let wrong = 0; for (let i = 0; i < st.length; i++) if (res[m][i] !== st[i]) wrong++; acc[m][0] += st.length - wrong; acc[m][1] += st.length; if (!wrong) acc[m][2]++; }
  }
  const f = a => (100 * a[0] / a[1]).toFixed(2) + '% / ' + (100 * a[2] / TRIALS).toFixed(0) + '%';
  if (acc.full[0] < acc.old[0]) bad++;
  rows.push(`${n}×${n} ${cname.padEnd(6)} | 现有 ${f(acc.old)} | 等容量聚类 ${f(acc.clus)} | 聚类+块约束 ${f(acc.full)} | ${(ms / TRIALS).toFixed(0)} ms`);
  console.log(rows[rows.length - 1]);
}
console.log('（每格：贴纸准确率 / 整个魔方全对的比例）');
if (bad) { console.log('FAIL: 新方法在 ' + bad + ' 档上不如现有方法'); process.exit(1); } else console.log('scan-synth PASS');
