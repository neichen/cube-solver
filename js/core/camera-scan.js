/*
 * 摄像头 / 照片扫描。只依赖 Puzzle 接口：cameraPlan[{face,title,instruction,grid,cells,center}]、colors、stickers。
 * 颜色分类：CIE Lab 距离；以已扫描面的中心块实测颜色做校准；全部扫描完后做「每色容量」均衡分配。
 */
(function (root) {
  'use strict';
  var CL = root.CubeLab;
  var I = CL.i18n, T = function (k, p) { return I ? I.t(k, p) : k; };
  function bindText(el, k, p) { if (I) I.bind(el, k, p); else el.textContent = T(k, p); }

  // ---- 颜色工具 ----
  function srgb2lin(c) { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
  function rgb2lab(rgb) {
    var r = srgb2lin(rgb[0]), g = srgb2lin(rgb[1]), b = srgb2lin(rgb[2]);
    var x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047, y = r * 0.2126 + g * 0.7152 + b * 0.0722, z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;
    var f = function (t) { return t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116; };
    var fx = f(x), fy = f(y), fz = f(z);
    return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
  }
  function dist(a, b) { return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]); }
  function hex2rgb(h) { var n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
  // 典型的摄像头下颜色（未校准时使用）
  function typicalFor(P) { var o = {}; Object.keys(TYPICAL).forEach(function (k) { o[k] = TYPICAL[CL.phys ? CL.phys(P, k) : k]; }); return o; }
  var TYPICAL = { W: [225, 228, 230], Y: [225, 215, 40], G: [20, 160, 80], B: [20, 70, 175], R: [190, 25, 40], O: [245, 110, 25] };

  /** 画布文字：过长时缩小字号以适应宽度（德语/俄语等较长的翻译） */
  function fillFit(ctx, text, x, y, maxW) {
    var m = /(\d+)px/.exec(ctx.font), size = m ? +m[1] : 15;
    while (size > 9 && ctx.measureText(text).width > maxW) { size--; ctx.font = ctx.font.replace(/\d+px/, size + 'px'); }
    ctx.fillText(text, x, y);
  }
  /** 对一个 canvas 区域按 grid×grid 采样，返回每格中位数 RGB */
  function sampleGrid(ctx, x0, y0, size, grid) {
    var out = [], cell = size / grid, img = ctx.getImageData(Math.round(x0), Math.round(y0), Math.round(size), Math.round(size)).data, W = Math.round(size);
    for (var r = 0; r < grid; r++) for (var c = 0; c < grid; c++) {
      var rs = [], gs = [], bs = [], m = cell * 0.28;
      for (var y = Math.round(r * cell + m); y < (r + 1) * cell - m; y += 2) for (var x = Math.round(c * cell + m); x < (c + 1) * cell - m; x += 2) {
        var o = (y * W + x) * 4; rs.push(img[o]); gs.push(img[o + 1]); bs.push(img[o + 2]);
      }
      var med = function (a) { a.sort(function (p, q) { return p - q; }); return a[a.length >> 1] || 0; };
      out.push([med(rs), med(gs), med(bs)]);
    }
    return out;
  }

  /**
   * 分类：samples = {stickerIndex: [r,g,b]}；centers = {stickerIndex: colorKey}（已知中心色，用于校准）
   * balanced=true 时每种颜色最多 cap 个（贪心按距离）。
   */
  function classify(P, samples, opts) {
    opts = opts || {};
    var keys = Object.keys(P.colors), refs = {};
    keys.forEach(function (k) { var ph = CL.phys ? CL.phys(P, k) : k; refs[k] = rgb2lab(TYPICAL[ph] || hex2rgb(P.colors[k].hex)); });
    var known = {};
    P.stickers.forEach(function (s, i) { if (s.locked && samples[i] && opts.centerColor) { known[i] = opts.centerColor(i); refs[known[i]] = rgb2lab(samples[i]); } });
    var ids = Object.keys(samples).map(Number), labs = {}, res = {};
    ids.forEach(function (i) { labs[i] = rgb2lab(samples[i]); });
    Object.keys(known).forEach(function (i) { res[i] = known[i]; });
    var free = ids.filter(function (i) { return known[i] === undefined; });
    if (opts.balanced) {
      var cap = {}, per = P.stickers.length / keys.length;
      keys.forEach(function (k) { cap[k] = per; });
      Object.keys(known).forEach(function (i) { cap[known[i]]--; });
      var pairs = [];
      free.forEach(function (i) { keys.forEach(function (k) { pairs.push([dist(labs[i], refs[k]), i, k]); }); });
      pairs.sort(function (a, b) { return a[0] - b[0]; });
      pairs.forEach(function (p) { if (res[p[1]] === undefined && cap[p[2]] > 0) { res[p[1]] = p[2]; cap[p[2]]--; } });
    }
    free.forEach(function (i) {
      if (res[i] !== undefined) return;
      var best = null; keys.forEach(function (k) { var d = dist(labs[i], refs[k]); if (!best || d < best[0]) best = [d, k]; });
      res[i] = best[1];
    });
    return res;
  }

  function CameraScan(rootEl, P, opts) {
    this.P = P; this.opts = opts || {}; this.el = rootEl;
    this.plan = P.cameraPlan; this.step = 0; this.samples = {}; this.done = {};
    this.gridFrac = 0.72; this.source = null; this.stream = null;
    var q = function (s) { return rootEl.querySelector(s); };
    this.canvas = q('.scan-canvas'); this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    this.video = document.createElement('video'); this.video.playsInline = true; this.video.muted = true; this.video.setAttribute('playsinline', '');
    this.ui = { steps: q('.scan-steps'), title: q('.scan-title'), instr: q('.scan-instr'), msg: q('.scan-msg'), cam: q('.btn-cam'), shot: q('.btn-shot'), file: q('.scan-file'), grid: q('.scan-gridsize'), prev: q('.btn-scan-prev'), next: q('.btn-scan-next'), reset: q('.btn-scan-reset') };
    var self = this;
    this.ui.cam.addEventListener('click', function () { self.stream ? self.stopCamera() : self.startCamera(); });
    this.ui.shot.addEventListener('click', function () { self.capture(); });
    this.ui.file.addEventListener('change', function () { var f = self.ui.file.files[0]; if (f) self.loadPhoto(f); self.ui.file.value = ''; });
    this.ui.grid.addEventListener('input', function () { self.gridFrac = self.ui.grid.value / 100; self.draw(); });
    this.ui.prev.addEventListener('click', function () { self.goto(self.step - 1); });
    this.ui.next.addEventListener('click', function () { self.goto(self.step + 1); });
    this.ui.reset.addEventListener('click', function () { self.samples = {}; self.done = {}; self.goto(0); self.msg('scan.msg.cleared'); });
    this.renderSteps(); this.goto(0); this.draw();
    if (I) this._offI18n = I.onChange(function () { self.renderSteps(); self.draw(); });
  }
  /** 状态消息：传 i18n 键 + 参数（切换语言时自动重译）；传空则清空 */
  CameraScan.prototype.msg = function (key, bad, params) {
    this.lastMsg = key ? { k: key, p: params } : null;
    if (key) bindText(this.ui.msg, function () { return T(key, typeof params === 'function' ? params() : params); }); else this.ui.msg.textContent = '';
    this.ui.msg.classList.toggle('bad', !!bad);
  };
  CameraScan.prototype.renderSteps = function () {
    var self = this, P = this.P;
    this.ui.steps.innerHTML = '';
    this.plan.forEach(function (s, i) {
      var b = document.createElement('button'); b.type = 'button'; b.className = 'scan-step';
      var cc = P.colors[P.solvedState()[s.center]];
      b.innerHTML = '<span class="dot" style="background:' + cc.hex + '"></span>' + (i + 1);
      b.title = s.title; b.dir = 'ltr';
      b.classList.toggle('done', !!self.done[i]); b.classList.toggle('cur', i === self.step);
      b.addEventListener('click', function () { self.goto(i); });
      self.ui.steps.appendChild(b);
    });
  };
  /** 配色方案改变：刷新步骤圆点、标题与说明 */
  CameraScan.prototype.relabel = function () { if (!this.destroyed) this.goto(this.step || 0); };
  CameraScan.prototype.goto = function (i) {
    this.step = Math.max(0, Math.min(this.plan.length - 1, i));
    var s = this.plan[this.step];
    var step = this.step, n = this.plan.length;
    bindText(this.ui.title, function () { return T('scan.stepTitle', { i: step + 1, n: n, title: s.title }); });
    bindText(this.ui.instr, function () { return s.instruction; });
    this.renderSteps(); this.draw();
  };
  CameraScan.prototype.startCamera = function () {
    var self = this;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      this.msg('scan.msg.noCamera', true); return Promise.resolve(false);
    }
    this.msg('scan.msg.requesting');
    return navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false })
      .then(function (stream) {
        self.stream = stream; self.video.srcObject = stream; self.source = self.video;
        bindText(self.ui.cam, 'scan.camOff'); self.ui.shot.disabled = false;
        self.msg('scan.msg.aim');
        return self.video.play().then(function () { self._loop(); return true; });
      })
      .catch(function (err) {
        self.msg('scan.msg.camError', true, function () { return { reason: err && err.name === 'NotAllowedError' ? T('scan.msg.denied') : String(err && err.message || err) }; });
        return false;
      });
  };
  CameraScan.prototype.stopCamera = function () {
    if (this.stream) this.stream.getTracks().forEach(function (t) { t.stop(); });
    this.stream = null; if (this.source === this.video) this.source = null;
    bindText(this.ui.cam, 'scan.camOn'); this.draw();
  };
  CameraScan.prototype._loop = function () {
    var self = this;
    if (!this.stream || this.destroyed) return;
    this.draw(true);
    requestAnimationFrame(function () { self._loop(); });
  };
  CameraScan.prototype.loadPhoto = function (file) {
    var self = this, url = URL.createObjectURL(file), img = new Image();
    return new Promise(function (resolve) {
      img.onload = function () {
        self.stopCamera(); self.source = img; self.ui.shot.disabled = false; self.draw();
        self.msg('scan.msg.photoLoaded');
        bindText(self.ui.shot, 'scan.recognize');
        resolve(true);
      };
      img.onerror = function () { self.msg('scan.msg.badImage', true); resolve(false); };
      img.src = url;
    });
  };
  /** 把来源（视频/照片）居中裁成正方形画到 canvas，并叠加九宫格 */
  CameraScan.prototype.draw = function (live) {
    var c = this.canvas, ctx = this.ctx, S = c.width = c.height = 480, src = this.source;
    ctx.fillStyle = '#1b1b1b'; ctx.fillRect(0, 0, S, S);
    if (src) {
      var w = src.videoWidth || src.naturalWidth, h = src.videoHeight || src.naturalHeight, m = Math.min(w, h);
      if (m) ctx.drawImage(src, (w - m) / 2, (h - m) / 2, m, m, 0, 0, S, S);
    } else {
      ctx.fillStyle = '#8a8a80'; ctx.font = '18px system-ui, sans-serif'; ctx.textAlign = 'center';
      ctx.direction = I ? I.dir() : 'ltr';
      fillFit(ctx, T('scan.canvas.empty'), S / 2, S / 2 - 8, S - 40);
      ctx.font = '14px system-ui, sans-serif'; fillFit(ctx, T('scan.canvas.https'), S / 2, S / 2 + 18, S - 40);
    }
    var g = this.plan[this.step].grid, size = S * this.gridFrac, x0 = (S - size) / 2, cell = size / g;
    var preview = null;
    if (src) {
      var rgb = sampleGrid(ctx, x0, x0, size, g), smp = {}, self = this;
      this.plan[this.step].cells.forEach(function (si, k) { smp[si] = rgb[k]; });
      preview = classify(this.P, smp, {});
    }
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,255,255,.95)';
    ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 4;
    for (var r = 0; r < g; r++) for (var cc = 0; cc < g; cc++) {
      ctx.strokeRect(x0 + cc * cell + 4, x0 + r * cell + 4, cell - 8, cell - 8);
    }
    ctx.shadowBlur = 0;
    if (preview) {
      var P = this.P, cells = this.plan[this.step].cells;
      cells.forEach(function (si, k) {
        var rr = (k / g) | 0, c2 = k % g, col = P.colors[preview[si]].hex;
        ctx.beginPath(); ctx.arc(x0 + c2 * cell + cell / 2, x0 + rr * cell + cell / 2, cell * 0.13, 0, Math.PI * 2);
        ctx.fillStyle = col; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#111'; ctx.stroke();
      });
    }
    // 方向提示：上方中心应为哪个面
    var s = this.plan[this.step];
    ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(0, 0, S, 30);
    ctx.fillStyle = '#fff'; ctx.font = '15px system-ui, sans-serif'; ctx.textAlign = 'center';
    ctx.direction = I ? I.dir() : 'ltr'; fillFit(ctx, s.title, S / 2, 20, S - 20); ctx.direction = 'ltr';
  };
  /** 采样当前面并更新结果 */
  CameraScan.prototype.capture = function () {
    if (!this.source) { this.msg('scan.msg.needSource', true); return null; }
    this.draw();
    var S = this.canvas.width, s = this.plan[this.step], size = S * this.gridFrac, x0 = (S - size) / 2;
    // 重新画一次干净的源图（不含叠加层）再采样
    var src = this.source, ctx = this.ctx, w = src.videoWidth || src.naturalWidth, h = src.videoHeight || src.naturalHeight, m = Math.min(w, h);
    ctx.drawImage(src, (w - m) / 2, (h - m) / 2, m, m, 0, 0, S, S);
    var rgb = sampleGrid(ctx, x0, x0, size, s.grid), self = this;
    s.cells.forEach(function (si, k) { self.samples[si] = rgb[k]; });
    this.done[this.step] = true;
    var result = this.result();
    if (this.opts.onResult) this.opts.onResult(result, this.allDone());
    var nDone = Object.keys(this.done).length;
    var total = this.plan.length;
    if (this.allDone()) this.msg('scan.msg.allDone'); else this.msg('scan.msg.recognized', false, function () { return { title: s.title, done: nDone, total: total }; });
    if (this.source !== this.video) { this.source = null; this.ui.shot.disabled = true; bindText(this.ui.shot, 'scan.capture'); }
    var nxt = this.plan.findIndex(function (_, i) { return !self.done[i]; });
    this.goto(nxt >= 0 ? nxt : this.step);
    return result;
  };
  CameraScan.prototype.destroy = function () { this.stopCamera(); this.destroyed = true; if (this._offI18n) this._offI18n(); };
  CameraScan.prototype.allDone = function () { return Object.keys(this.done).length === this.plan.length; };
  CameraScan.prototype.result = function () {
    var solved = this.P.solvedState(), P = this.P;
    // 全部面扫完后：等容量聚类 + 块约束解码（偶数阶没有固定中心也适用；奇数阶用固定中心定颜色名）
    var CC = CL.colorCluster, N = P.stickers.length, n = Math.round(Math.sqrt(N / 6));
    if (this.allDone() && CC && n >= 2 && 6 * n * n === N && 'WYGBRO'.split('').every(function (k) { return P.colors[k]; })) {
      try {
        var fixed = {}; P.stickers.forEach(function (s, i) { if (s.locked) fixed[i] = solved[i]; });
        var r = CC.classifyCube(n, this.samples, { fixed: fixed, typical: typicalFor(this.P) });
        if (r) return r;
      } catch (e) { if (root.console) console.warn('colorCluster', e); }
    }
    return classify(P, this.samples, { balanced: this.allDone(), centerColor: function (i) { return solved[i]; } });
  };
  CL.CameraScan = CameraScan;
  CL.colorUtil = { rgb2lab: rgb2lab, classify: classify, sampleGrid: sampleGrid };
})(window);
