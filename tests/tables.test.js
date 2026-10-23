// 预计算表包：与现场计算的表逐字节一致（FNV-1a），并测加载 / 现场计算耗时。node tests/tables.test.js
const fs = require('fs'), path = require('path'), zlib = require('zlib'), { execFileSync } = require('child_process');
const TP = require('../js/core/table-pack.js');
let fail = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ FAIL: ') + m); if (!c) fail++; };
const files = { cube4: 'puzzles/nxn/cube4-tables.bin.gz', cubejs: 'puzzles/cube3/cubejs-prune.bin.gz' };
const packs = {};
for (const k in files) { const gz = fs.readFileSync(path.join(__dirname, '..', files[k])); packs[k] = TP.decode(new Uint8Array(zlib.gunzipSync(gz))); ok(!!packs[k], `${files[k]}: ${gz.length} B gzip，解码与哈希校验通过`); }
const C4 = require('../puzzles/nxn/cube4.worker.js'); let t0 = Date.now(); const T = C4.exportTables(); const buildMs = Date.now() - t0;
for (const k in T) for (const name in T[k]) ok(packs[k] && packs[k][name] && TP.fnv(new Uint8Array(T[k][name].buffer, T[k][name].byteOffset, T[k][name].byteLength)) === TP.fnv(new Uint8Array(packs[k][name].buffer)), `${k}.${name} 与现场计算一致（${T[k][name].length} 项）`);
// 新进程里分别测：用表包初始化 vs 现场计算
const code = m => `const C4=require(${JSON.stringify(path.join(__dirname, '../puzzles/nxn/cube4.worker.js'))}); const t=Date.now(); ${m}; console.log(Date.now()-t);`;
const withPack = +execFileSync('node', ['-e', code('const r=C4.initFromPacks(); if(!r.pack4||!r.packCubejs) throw 1')]).toString().trim();
console.log(`  4×4 初始化（含 cubejs）：表包 ${withPack} ms；现场计算（导出测量）${buildMs} ms`);
ok(withPack < buildMs / 2, '表包初始化至少快 2 倍');
console.log(fail ? `tables: ${fail} FAILED` : 'tables: ALL PASS'); process.exit(fail ? 1 : 0);
