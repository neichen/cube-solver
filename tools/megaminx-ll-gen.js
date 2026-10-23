#!/usr/bin/env node
/*
 * 离线生成五魔方最后一层（LL）公式与查表（自写搜索，结果以 MIT 随仓库发布）：
 *   1. 在 <U,X,Y> 三面子群里做 meet-in-the-middle（每侧 ≤ 7 步），找出保持非 U 块不动的序列 = LL 公式；
 *   2. 每种 LL 效果保留最短公式，并加入其 5 个绕 U 旋转的版本；
 *   3. Dijkstra（代价 = HTM 步数）：
 *        第一步 状态 = 棱排列 + 棱朝向 + 角朝向（60·16·81 = 77,760）
 *        第二步 状态 = 角排列 × 棱排列（3,600），只用不改变朝向的公式。
 * 输出 puzzles/megaminx/megaminx-ll.json。用法：node tools/megaminx-ll-gen.js
 */
'use strict';
const path = require('path'), fs = require('fs');
const MM = require('../puzzles/megaminx/megaminx-model.js');
const S = require('../puzzles/megaminx/megaminx-solver.js');
const LL = S.LL;
const F = MM.FI, t0 = Date.now();
const DEPTH = +process.env.LL_DEPTH || 7;

function faceMoves(f) { return [0, 1, 2, 3].map(k => MM.faceMoves.indexOf(MM.FACES[f] + ['', '2', "'", "2'"][k])); }
function nonUPieces(gens) {
  const m = gens.reduce((a, f) => a | (1 << f), 0), out = [];
  for (let p = 0; p < 50; p++) { const fs = S.pieceFaces(p); if (fs.indexOf(F.U) < 0 && fs.some(f => m & (1 << f))) out.push(p); }
  return out;
}
function mitm(gens) {
  const mv = [].concat(...gens.map(faceMoves)), mf = mv.map(i => S.MOVE_FACE[i]);
  const track = nonUPieces(gens), K = track.length, solved = track.map(S.solvedCode);
  const keys = new Map(), next = [], seqs = [];
  const codes = new Int16Array(K * (DEPTH + 1)), path = [];
  function key(off) { let h1 = 0x811c9dc5 | 0, h2 = 0x1234567; for (let j = 0; j < K; j++) { const c = codes[off + j]; h1 = Math.imul(h1 ^ c, 16777619); h2 = Math.imul(h2 + c * 2654435761, 2246822519) ^ (h2 >>> 13); } return (h1 >>> 0) * 2097152 + ((h2 >>> 0) & 2097151); }
  function rec(d, last) {
    const off = d * K, k = key(off), id = seqs.length;
    seqs.push(path.slice(0, d)); next.push(keys.has(k) ? keys.get(k) : -1); keys.set(k, id);
    if (d === DEPTH) return;
    for (let a = 0; a < mv.length; a++) {
      if (mf[a] === last) continue;
      const T = S.MOVE_T[mv[a]]; for (let j = 0; j < K; j++) codes[off + K + j] = T[codes[off + j]];
      path[d] = mv[a]; rec(d + 1, mf[a]);
    }
  }
  for (let j = 0; j < K; j++) codes[j] = solved[j];
  rec(0, -1);
  const algs = [];
  for (const [, head] of keys) {
    const ids = []; for (let i = head; i >= 0 && ids.length < 6; i = next[i]) ids.push(i);
    for (let x = 0; x < ids.length; x++) for (let y = 0; y < ids.length; y++) if (x !== y) {
      const a = seqs[ids[x]], c = seqs[ids[y]];
      const alg = S.simplify(a.concat(c.slice().reverse().map(S.inverseMove)));
      if (alg.length) algs.push(alg);
    }
  }
  console.log('gens', gens.map(f => MM.FACES[f]).join(''), 'sequences', seqs.length, 'candidate algs', algs.length, ((Date.now() - t0) / 1000).toFixed(1) + 's');
  return algs;
}
const gensets = [[F.U, F.R, F.F], [F.U, F.F, F.L], [F.U, F.R, F.L]];
const best = new Map();   // LL 效果 → 最短公式
let tried = 0;
gensets.forEach(g => mitm(g).forEach(alg => {
  tried++;
  const eff = LL.effectOf(alg); if (!eff) return;   // 未保持 F2L（哈希碰撞）
  for (let r = 0; r < 5; r++) {
    const ra = LL.rotateU(alg, r), e = LL.effectOf(ra), k = LL.effectKey(e);
    if (!e || LL.isIdentity(e)) continue;
    if (!best.has(k) || best.get(k).length > ra.length) best.set(k, ra);
  }
}));
// AUF 自身
for (const t of ['U', 'U2', "U'", "U2'"]) { const a = [MM.faceMoves.indexOf(t)], k = LL.effectKey(LL.effectOf(a)); best.set(k, a); }
console.log('checked', tried, 'distinct LL effects', best.size);
const macros = [...best.values()].sort((a, b) => a.length - b.length || a.join().localeCompare(b.join()));
const eff = macros.map(a => LL.effectOf(a));

// 从已解状态出发的 Dijkstra：种子 = 每个公式单独作用（全部公式），之后只用最短的 K 个（按投影后的效果去重）继续扩展。
// 状态坐标与 CP 无关（第一步）或与朝向无关（第二步，只用保持朝向的公式），所以公式作用在投影坐标上是群作用。
const NONE = 0xFFFFFFFF;   // 公式数可能超过 65535，via 用 32 位
function dijkstra(size, start, idxFn, decode, usable, K) {
  const dist = new Uint16Array(size).fill(65535), via = new Uint32Array(size).fill(NONE), byCost = [];
  function push(y, c, m) { if (c < dist[y]) { dist[y] = c; via[y] = m; (byCost[c] = byCost[c] || []).push(y); } }
  dist[start] = 0; byCost[0] = [start];
  const s0 = decode(start), seen = new Set(), ext = [];
  for (let m = 0; m < eff.length; m++) {
    if (!usable[m]) continue;
    const y = idxFn(LL.applyEffect(s0, eff[m]));
    push(y, macros[m].length, m);
    if (!seen.has(y) && ext.length < K) { seen.add(y); ext.push(m); }   // macros 已按长度排序
  }
  for (let c = 1; c < byCost.length; c++) {
    const list = byCost[c]; if (!list) continue;
    for (const x of list) {
      if (dist[x] !== c) continue;
      const st = decode(x);
      for (const m of ext) push(idxFn(LL.applyEffect(st, eff[m])), c + macros[m].length, m);
    }
  }
  return { dist, via };
}
// 第一步：查表存「到达该状态的最后一个公式」，求解时应用其逆
const all = eff.map(() => true);
const K1 = +(process.env.LL_K || 1500);
const L1 = dijkstra(LL.L1_SIZE, LL.l1Index(LL.solvedLL()), LL.l1Index, LL.l1Decode, all, K1);
console.log('look1 done', ((Date.now() - t0) / 1000).toFixed(1) + 's');
const pureOri = eff.map(e => LL.preservesOrientation(e));
const L2 = dijkstra(LL.L2_SIZE, LL.l2Index(LL.solvedLL()), LL.l2Index, LL.l2Decode, pureOri, 100000);
function stats(d) { let n = 0, s = 0, mx = 0; for (const x of d) if (x !== 65535) { n++; s += x; mx = Math.max(mx, x); } return { reached: n, avg: +(s / n).toFixed(2), max: mx }; }
console.log('look1', stats(L1.dist), 'look2', stats(L2.dist), 'macros used', new Set([...L1.via, ...L2.via].filter(v => v !== NONE)).size);
// 仅保留被用到的公式
const used = [...new Set([...L1.via, ...L2.via].filter(v => v !== NONE))].sort((a, b) => a - b), remap = new Map(used.map((m, i) => [m, i]));
if (used.length >= 65535) throw new Error('too many macros for 16-bit tables: ' + used.length);
const out = {
  note: 'Generated by tools/megaminx-ll-gen.js (own search, MIT). Tables store, per LL state, the macro whose INVERSE moves it one step toward solved.',
  macros: used.map(m => macros[m].map(i => MM.faceMoves[i]).join(' ')),
  look1: Buffer.from(Uint16Array.from(L1.via, v => v === NONE ? 65535 : remap.get(v)).buffer).toString('base64'),
  look2: Buffer.from(Uint16Array.from(L2.via, v => v === NONE ? 65535 : remap.get(v)).buffer).toString('base64'),
  stats: { look1: stats(L1.dist), look2: stats(L2.dist) }
};
fs.writeFileSync(path.join(__dirname, '../puzzles/megaminx/megaminx-ll.json'), JSON.stringify(out));
console.log('wrote megaminx-ll.json', out.macros.length, 'macros', ((Date.now() - t0) / 1000).toFixed(1) + 's');
