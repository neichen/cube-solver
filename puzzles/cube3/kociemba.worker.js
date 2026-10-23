/*
 * 3×3 求解器 Worker。协议见 README.md「求解器适配器」。
 * 流程：① 双向 BFS 精确搜索（≤ 8 步时给出可证明的最优解）
 *       ② 否则 Kociemba 两阶段（cubejs）求出 ≤22 步解，再在时间预算内逐步收紧上限缩短解法。
 */
importScripts('../../vendor/cube.js', '../../vendor/solve.js', 'model.js', '../../js/core/table-pack.js');
var ready = false, solvedSide = null, MOVES = null;
var HALF = 4;

function buildMoves() {
  var M = self.CubeModel, out = [];
  M.FACES.split('').forEach(function (f, fi) {
    [['', 1], ['2', 2], ["'", 3]].forEach(function (d) {
      var ident = []; for (var i = 0; i < 54; i++) ident.push(i);
      out.push({ tok: f + d[0], face: fi, src: M.applyMove(ident, { face: f, times: d[1] }), inv: f + (d[0] === '' ? "'" : d[0] === "'" ? '' : '2') });
    });
  });
  return out;
}
function step(s, mv) { var n = new Array(54); for (var i = 0; i < 54; i++) n[i] = s[mv.src[i]]; return n; }
// 从 start 出发 BFS 到 depth 层；返回 Map(key -> {d, path})
function bfs(start, depth, onNode) {
  var seen = new Map(), layer = [{ s: start, path: [], last: -1 }];
  seen.set(start.join(''), { d: 0, path: [] });
  if (onNode && onNode(start, [], 0)) return seen;
  for (var d = 1; d <= depth; d++) {
    var next = [];
    for (var a = 0; a < layer.length; a++) {
      var node = layer[a];
      for (var m = 0; m < MOVES.length; m++) {
        var mv = MOVES[m];
        if (mv.face === node.last) continue;
        var s2 = step(node.s, mv), k = s2.join('');
        if (seen.has(k)) continue;
        var path = node.path.concat(m);
        seen.set(k, { d: d, path: path });
        next.push({ s: s2, path: path, last: mv.face });
      }
    }
    if (onNode) for (var b = 0; b < next.length; b++) if (onNode(next[b].s, next[b].path, d)) return seen;
    layer = next;
  }
  return seen;
}
function shortSearch(facelets) {
  if (!solvedSide) solvedSide = bfs('UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB'.split(''), HALF);
  var best = null;
  bfs(facelets.split(''), HALF, function (s, path, d) {
    if (best && d >= best.length) return true;
    var hit = solvedSide.get(s.join(''));
    if (hit) {
      var sol = path.map(function (m) { return MOVES[m].tok; })
        .concat(hit.path.slice().reverse().map(function (m) { return MOVES[m].inv; }));
      if (!best || sol.length < best.length) best = sol;
    }
    return false;
  });
  return best;
}

// cubejs 剪枝表从预计算表包加载（puzzles/cube3/cubejs-prune.bin.gz，失败时现场计算）；下载期间先算移动表
var CJ_PRUNE = ['sliceTwist', 'sliceFlip', 'sliceURFtoDLFParity', 'sliceURtoDFParity'], loading = null;
function ensureAsync() {
  if (ready) return Promise.resolve();
  if (!loading) {
    var p = self.CubeLabTablePack.fetch('cubejs-prune.bin.gz');
    Cube.computeMoveTables();
    loading = p.then(function (pk) {
      if (pk) CJ_PRUNE.forEach(function (k) { if (pk[k] && Cube.pruningTables[k] === null) Cube.pruningTables[k] = pk[k]; });
      Cube.initSolver(); MOVES = buildMoves(); ready = true;
    });
  }
  return loading;
}
function ensure() { if (!ready) { Cube.initSolver(); MOVES = buildMoves(); ready = true; } }
function toks(s) { return s && s.trim() ? s.trim().split(/\s+/) : []; }

self.onmessage = function (e) {
  var d = e.data;
  ensureAsync().then(function () { handle(d); }, function (err) { self.postMessage({ id: d.id, ok: false, error: String(err && err.message || err) }); });
};
function handle(d) {
  try {
    var t0 = Date.now();
    ensure();
    if (d.cmd === 'init') { shortSearch('UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB'); return self.postMessage({ id: d.id, ok: true, ms: Date.now() - t0 }); }
    if (d.cmd === 'solve') {
      var f = d.payload.facelets, exact = shortSearch(f);
      if (exact) return self.postMessage({ id: d.id, ok: true, moves: exact, optimal: true, ms: Date.now() - t0 });
      var cube = Cube.fromString(f), sol = toks(cube.solve(d.payload.maxDepth || 22)), first = sol.length;
      var deadline = Date.now() + (d.payload.timeBudget || 1200);
      while (sol.length > 2 * HALF + 1) {
        try { sol = toks(cube.solve(sol.length - 1, deadline)); } catch (err) { break; }
      }
      self.postMessage({ id: d.id, ok: true, moves: sol, optimal: false, firstLength: first, ms: Date.now() - t0 });
    }
  } catch (err) { self.postMessage({ id: d.id, ok: false, error: String(err && err.message || err) }); }
};
