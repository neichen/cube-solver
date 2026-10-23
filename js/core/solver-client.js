/*
 * 求解器客户端：每个求解器适配器在独立 Web Worker 中运行，UI 不卡顿。
 * 协议：→ {id, cmd:'init'} / {id, cmd:'solve', payload}；← {id, ok, moves?, ms?, error?}
 */
(function (root) {
  'use strict';
  var CL = root.CubeLab;
  function SolverClient(P, solverDef) {
    this.P = P; this.def = solverDef; this.seq = 0; this.pending = {};
    var self = this;
    this.worker = new Worker(solverDef.workerUrl);
    this.worker.onmessage = function (e) {
      var d = e.data, p = self.pending[d.id]; if (!p) return;
      if (d.progress) { if (self.onProgress) try { self.onProgress(d.progress); } catch (er) {} return; }
      delete self.pending[d.id];
      if (d.ok) p.resolve(d);
      else { var er = new Error(d.error || '求解失败'); if (d.i18n) er.i18n = d.i18n; p.reject(er); }
    };
    this.worker.onerror = function (e) {
      Object.keys(self.pending).forEach(function (k) { self.pending[k].reject(new Error('求解器出错：' + (e.message || '未知错误'))); });
      self.pending = {};
    };
    this.ready = this._call({ cmd: 'init' });
  }
  SolverClient.prototype._call = function (msg) {
    var self = this;
    return new Promise(function (resolve, reject) {
      msg.id = ++self.seq; self.pending[msg.id] = { resolve: resolve, reject: reject };
      self.worker.postMessage(msg);
    });
  };
  /** 返回 Promise<{moves: string[], ms}> */
  SolverClient.prototype.solve = function (state) {
    var payload = this.def.encode(state), self = this;
    return this.ready.then(function () { return self._call({ cmd: 'solve', payload: payload }); });
  };
  SolverClient.prototype.dispose = function () { this.worker.terminate(); var self = this; Object.keys(this.pending).forEach(function (k) { self.pending[k].reject(new Error('disposed')); }); this.pending = {}; };
  CL.SolverClient = SolverClient;
})(window);
