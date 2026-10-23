/*
 * gullicube（Tomas Rokicki，MPL-2.0）WASM 求解器适配器：4×4 … 15×15。
 * 原版 C++ 未修改，用 Emscripten 编译成多线程 WASM（需要跨源隔离：COOP + COEP 响应头，见 deploy/_headers）。
 * 每次求解新建一个 Worker：数据文件写入内存文件系统，状态经 stdin 以 Kociemba 展开串传入（-f），
 * 解法从 stdout 读取（-o）。求解完成后主线程会结束这个 Worker，释放约 1 GB 内存。
 */
var BASE = '../../vendor/gullicube/';
// 注意：Emscripten 的 pthread 子 Worker 会以「当前脚本」（即本文件）启动，并以 name = 'em-pthread' 区分；
// 这种情况下只加载 gullicube.js（它会自动进入 pthread 模式），不能再覆盖 onmessage。
importScripts(BASE + 'gullicube.js');
if (self.name !== 'em-pthread') (function () {
var FILES_FAST = ['fast6.cls', 'p8s10.cls', 'diag2.cls', 'mid2.cls', 'wing3.cls', 'pair3.cls', 'diag3.cls', 'mid3.cls'];
var FILES_ALL = FILES_FAST.concat(['c12x.cls', 'p9.cls', 'eg8.cls', 'diag_x10.cls', 'mid_x10.cls', 'wing_d6c.cls']);
var data = {};

function fetchAll(list) {
  return Promise.all(list.filter(function (f) { return !data[f]; }).map(function (f) {
    return fetch(BASE + 'data/' + f).then(function (r) { if (!r.ok) throw new Error(f + ': HTTP ' + r.status); return r.arrayBuffer(); })
      .then(function (b) { data[f] = new Uint8Array(b); });
  }));
}
function fail(id, k, msg) { self.postMessage({ id: id, ok: false, error: msg || k, i18n: { k: k, p: { msg: msg || '' } } }); }

self.onmessage = function (e) {
  var d = e.data, t0 = Date.now();
  if (d.cmd === 'init') return self.postMessage({ id: d.id, ok: true, ms: 0, isolated: !!self.crossOriginIsolated });
  if (d.cmd !== 'solve') return;
  if (typeof SharedArrayBuffer === 'undefined' || self.crossOriginIsolated === false) return fail(d.id, 'solve.noIsolation');
  var p = d.payload, files = p.fast ? FILES_FAST : FILES_ALL;
  self.postMessage({ id: d.id, progress: { stage: 'download' } });
  fetchAll(files).then(function () {
    self.postMessage({ id: d.id, progress: { stage: 'prep' } });
    var threads = Math.max(1, Math.min(8, (self.navigator && navigator.hardwareConcurrency) || 4));
    var args = [String(p.n), '-f', '-o', '-t', String(threads)].concat(p.fast ? ['--fast'] : ['--time', String(p.time || 16)]);
    var out = [], si = 0, input = p.facelets, best = null;
    Gullicube({
      locateFile: function (f) { return BASE + f; },
      print: function (s) {
        out.push(s);
        if (/^# time budget/.test(s)) self.postMessage({ id: d.id, progress: { stage: 'search' } });
        var m = /width\s+\d+: total\s+(\d+)/.exec(s);
        if (m && (best === null || +m[1] < best)) { best = +m[1]; self.postMessage({ id: d.id, progress: { best: best } }); }
      },
      printErr: function (s) { out.push('! ' + s); },
      stdin: function () { return si < input.length ? input.charCodeAt(si++) : null; },
      preRun: [function (m) { m.FS.mkdir('/data'); files.forEach(function (f) { m.FS.writeFile('/data/' + f, data[f]); }); }],
      onExit: function (code) {
        var moves = out.filter(function (l) { return /^ [^ ]/.test(l); }).join(' ').trim().split(/\s+/).filter(Boolean);
        var tot = out.filter(function (l) { return /TOTAL/.test(l); })[0] || '', lm = /load ([\d.]+)s/.exec(tot);
        if (code !== 0) return fail(d.id, 'solve.gcFail', out.filter(function (l) { return /^!|bad|cannot/.test(l); }).slice(-3).join(' ') || ('exit ' + code));
        self.postMessage({ id: d.id, ok: true, moves: moves, optimal: false, ms: Date.now() - t0, loadS: lm ? +lm[1] : null, threads: threads, fast: !!p.fast });
      }
    }).then(function (mod) { mod.callMain(args); }, function (err) { fail(d.id, 'solve.gcFail', String(err && err.message || err)); });
  }).catch(function (err) { fail(d.id, 'solve.gcFail', String(err && err.message || err)); });
};
})();
