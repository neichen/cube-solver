// 生成预计算表包：node tools/build-tables.js
//   puzzles/nxn/cube4-tables.bin.gz（4×4 降阶求解器距离表）
//   puzzles/cube3/cubejs-prune.bin.gz（cubejs 两阶段剪枝表，3×3 与 4×4 收尾共用）
const fs = require('fs'), path = require('path'), zlib = require('zlib');
const TP = require('../js/core/table-pack.js'), C4 = require('../puzzles/nxn/cube4.worker.js');
const t0 = Date.now(), T = C4.exportTables();
for (const [file, tabs] of [['puzzles/nxn/cube4-tables.bin.gz', T.cube4], ['puzzles/cube3/cubejs-prune.bin.gz', T.cubejs]]) {
  const raw = TP.encode(tabs), gz = zlib.gzipSync(raw, { level: 9 });
  fs.writeFileSync(path.join(__dirname, '..', file), gz);
  console.log(file, 'raw', raw.length, 'gzip', gz.length);
}
console.log('done in', Date.now() - t0, 'ms');
