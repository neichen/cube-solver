/*
 * 五魔方求解 Worker。
 * init：载入模型 / 求解器脚本与顶层公式表（megaminx-ll.json，离线由 tools/megaminx-ll-gen.js 生成）。
 * solve：多阶段求解（逐面块构建 F2L + 两步顶层），WCA 风格 HTM（72° 与 144° 都计 1 步），不是最优解。
 */
(function (root) {
  'use strict';
  if (typeof importScripts === 'function') { if (!root.MegaminxModel) importScripts('megaminx-model.js'); if (!root.MegaminxSolver) importScripts('megaminx-solver.js'); }
  var S = root.MegaminxSolver, ready = null;
  function init() {
    if (!ready) ready = fetch('megaminx-ll.json').then(function (r) { if (!r.ok) throw new Error('megaminx-ll.json ' + r.status); return r.json(); }).then(function (j) { S.LL.load(j); return j.stats || {}; });
    return ready;
  }
  root.onmessage = function (e) {
    var d = e.data, t0 = Date.now();
    init().then(function (info) {
      if (d.cmd === 'init') return root.postMessage({ id: d.id, ok: true, ms: Date.now() - t0, table: info });
      if (d.cmd === 'solve') {
        var s = S.solve(d.payload.state);
        root.postMessage({ id: d.id, ok: true, moves: s.moves, optimal: false, label: 'solve.notOptimal', ms: Date.now() - t0,
          note: { k: 'solve.note.megaminx', p: { f2l: s.f2lLength, ll: s.llLength } } });
      }
    }).catch(function (err) { root.postMessage({ id: d.id, ok: false, error: String(err && err.message || err) }); });
  };
})(self);
