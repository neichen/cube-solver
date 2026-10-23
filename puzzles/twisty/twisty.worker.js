/*
 * 金字塔 / 斜转 最优求解 Worker（?p=pyraminx | ?p=skewb）。
 * init：枚举各分量 → 分量转动表 → 完整 BFS 距离表（金字塔 933,120 态，斜转 3,149,280 态；浏览器内构建，约 0.1–0.4 s）。
 * solve：沿距离表下降，步数 = 最短距离（可证明最优，VTM：每次 120° 转动计 1 步）。
 */
(function (root) {
  'use strict';
  var TM = root.TwistyModel;
  if (!TM && typeof importScripts === 'function') { importScripts('twisty-model.js'); TM = root.TwistyModel; }
  var id = /[?&]p=(\w+)/.exec(root.location ? root.location.search : '');
  id = id ? id[1] : 'pyraminx';
  var M = null, info = null;
  function init() { if (!M) { M = TM.get(id); info = TM.buildTable(M); } return info; }
  root.onmessage = function (e) {
    var d = e.data, t0 = Date.now();
    try {
      if (d.cmd === 'init') { var r = init(); return root.postMessage({ id: d.id, ok: true, ms: Date.now() - t0, table: { size: r.size, maxDepth: r.maxDepth, counts: r.counts, ms: r.ms, bytes: r.bytes } }); }
      if (d.cmd === 'solve') {
        init();
        var s = TM.solve(M, d.payload.state);
        root.postMessage({ id: d.id, ok: true, moves: s.moves, optimal: true, ms: Date.now() - t0, coreLength: s.coreLength,
          note: { k: 'solve.note.' + id, p: { max: M.maxDepth } } });
      }
    } catch (err) { root.postMessage({ id: d.id, ok: false, error: String(err && err.message || err) }); }
  };
})(self);
