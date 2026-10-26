/*
 * 展开图涂色编辑器。只依赖 Puzzle 接口：netLayout、stickers[].locked、colors、blankColor。
 * 支持点击 / 拖动连续涂色；固定贴纸（如中心块）不可修改。
 * 三种呈现：
 *   - 网格（按钮）：小阶魔方；
 *   - 多边形（SVG）：金字塔 / 斜转 / 五魔方；
 *   - 画布（canvas）：6 阶及以上（贴纸多达 1350 块，用一个 canvas 代替上千个按钮），带「按面放大」工具条。
 * 键盘：展开图只占一个 Tab 停靠点（roving tabindex），方向键移到该方向最近的贴纸，
 * Enter / 空格涂色，1–9 选颜色，0 选橡皮擦。可选在贴纸上显示颜色字母（W/Y/R/O/G/B…）。
 */
(function (root) {
  'use strict';
  var CL = root.CubeLab;
  var T = function (k, p) { return CL.i18n ? CL.i18n.t(k, p) : k; };
  var CANVAS_MIN_COLS = 24;   // 6×6 起（4n 列）
  var FACE_ORDER = ['U', 'L', 'F', 'R', 'B', 'D'];

  /** 颜色字母：立方体按物理颜色（配色方案可能交换），其它谜题用颜色键 */
  function letterOf(P, k) { return k ? (P.colors[k] && P.colors[k].letter) || k : ''; }
  function inkFor(hex) {
    var m = /^#?([0-9a-f]{6})$/i.exec(hex || ''); if (!m) return '#222';
    var v = parseInt(m[1], 16), r = v >> 16, g = (v >> 8) & 255, b = v & 255;
    return (0.299 * r + 0.587 * g + 0.114 * b) > 150 ? '#1d1d1b' : '#ffffff';
  }
  function lettersOn() { try { return localStorage.getItem('cubelab.letters') === '1'; } catch (e) { return false; } }

  function NetEditor(netEl, paletteEl, P, opts) {
    this.P = P; this.opts = opts || {}; this.state = P.solvedState(); this.brush = Object.keys(P.colors)[0];
    this.letters = lettersOn(); this.flags = {};
    var self = this, L = P.netLayout;
    this.el = netEl;
    netEl.innerHTML = ''; netEl.classList.add('net');
    this.svgMode = !!L.polys;
    this.canvasMode = !this.svgMode && L.cols >= CANVAS_MIN_COLS;
    netEl.classList.remove('poly', 'canvas', 'dense'); netEl.style.maxWidth = ''; netEl.style.aspectRatio = '';
    netEl.style.gridTemplateColumns = ''; netEl.style.gridTemplateRows = '';
    netEl.classList.toggle('letters', this.letters);
    if (this.svgMode) this._buildPoly(netEl, P, L);
    else if (this.canvasMode) this._buildCanvas(netEl, P, L);
    else this._buildGrid(netEl, P, L);
    this.focusI = this._firstFocusable();

    var painting = false;
    var paintAt = function (i) {
      if (i == null || i < 0 || P.stickers[i].locked) return;
      if (self.state[i] === self.brush) return;
      self.state[i] = self.brush; self.render(); self._changed();
      if (self.opts.onPaint) self.opts.onPaint(i, self.brush);
    };
    this._paintAt = paintAt;
    var hit = function (e, fromPoint) {
      if (self.canvasMode) return self._hitCanvas(e);
      var el = fromPoint ? document.elementFromPoint(e.clientX, e.clientY) : e.target;
      el = el && el.closest && el.closest('.cell');
      return el && netEl.contains(el) ? +el.dataset.i : null;
    };
    var surface = this.canvasMode ? this.canvas : netEl;
    surface.addEventListener('pointerdown', function (e) {
      var i = hit(e, false); if (i == null) return;
      painting = true; self._setFocus(i, false); paintAt(i); e.preventDefault();
      if (self.canvasMode) { try { self.canvas.setPointerCapture(e.pointerId); } catch (er) {} self.canvas.focus({ preventScroll: true }); }
    });
    surface.addEventListener('pointermove', function (e) { if (painting) paintAt(hit(e, true)); });
    this._up = function () { painting = false; };
    root.addEventListener('pointerup', this._up);
    surface.addEventListener('keydown', function (e) { self._key(e); });

    // 调色板
    paletteEl.innerHTML = '';
    this.swatches = {};
    Object.keys(P.colors).concat(['']).forEach(function (k) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'swatch' + (k ? '' : ' eraser'); b.dataset.color = k;
      b.innerHTML = '<span class="dot" style="background:' + (k ? P.colors[k].hex : 'transparent') + ';color:' + (k ? inkFor(P.colors[k].hex) : '#222') + '"><i class="lt" dir="ltr"></i></span><span class="lbl"></span><span class="cnt" dir="ltr"></span>';
      b.addEventListener('click', function () { self.setBrush(k); });
      paletteEl.appendChild(b); self.swatches[k] = b;
    });
    this.setBrush(this.brush);
    this.render(); this.relabel();
    if (CL.i18n) this._offI18n = CL.i18n.onChange(function () { self.relabel(); self.render(); });
    // 高阶魔方：格子很多，按阶数收紧间距（CSS 变量 --n）
    netEl.style.setProperty('--n', String(Math.round((L.cols || 12) / 4)));
    if (!this.canvasMode) netEl.classList.toggle('dense', L.cols > 28);
  }

  NetEditor.prototype._buildGrid = function (netEl, P, L) {
    var self = this;
    netEl.style.gridTemplateColumns = 'repeat(' + L.cols + ', 1fr)';
    netEl.style.gridTemplateRows = 'repeat(' + L.rows + ', 1fr)';
    netEl.style.aspectRatio = L.cols + ' / ' + L.rows;
    this.cells = []; this.pos = [];
    netEl.setAttribute('role', 'group');
    L.cells.forEach(function (c) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'cell'; b.dataset.i = c.sticker; b.tabIndex = -1;
      var s = P.stickers[c.sticker];
      b.dataset.sid = s.id; b.dataset.locked = s.locked ? '1' : '';
      if (s.locked) b.classList.add('locked');
      b.style.gridColumn = (c.col + 1); b.style.gridRow = (c.row + 1);
      netEl.appendChild(b); self.cells[c.sticker] = b; self.pos[c.sticker] = [c.col + 0.5, c.row + 0.5];
    });
  };
  /** 多边形展开图（金字塔三角形、斜转菱形 + 三角形）：SVG，每块贴纸一个 polygon */
  NetEditor.prototype._buildPoly = function (netEl, P, L) {
    var NS = 'http://www.w3.org/2000/svg', svg = document.createElementNS(NS, 'svg'), self = this, vb = L.viewBox;
    netEl.classList.add('poly');
    netEl.style.aspectRatio = vb[2] + ' / ' + vb[3];
    netEl.style.maxWidth = (L.maxWidth || 640) + 'px';
    svg.setAttribute('viewBox', vb.join(' ')); svg.setAttribute('class', 'net-svg'); svg.setAttribute('role', 'group');
    var g = L.gap || 0.86;
    this.cells = []; this.pos = []; this.texts = [];
    var minEdge = Infinity;
    L.polys.forEach(function (c) {
      var n = c.pts.length, cx = 0, cy = 0;
      c.pts.forEach(function (p) { cx += p[0] / n; cy += p[1] / n; });
      c.pts.forEach(function (p) { minEdge = Math.min(minEdge, Math.hypot(p[0] - cx, p[1] - cy)); });
      var pts = c.pts.map(function (p) { return (cx + (p[0] - cx) * g).toFixed(4) + ',' + (cy + (p[1] - cy) * g).toFixed(4); }).join(' ');
      var b = document.createElementNS(NS, 'polygon');
      b.setAttribute('points', pts); b.setAttribute('class', 'cell'); b.setAttribute('tabindex', '-1'); b.setAttribute('role', 'button');
      b.dataset.i = c.sticker; b.dataset.sid = P.stickers[c.sticker].id; b.dataset.locked = '';
      svg.appendChild(b); self.cells[c.sticker] = b; self.pos[c.sticker] = [cx, cy];
    });
    // 字母层（不拦截指针）
    this.texts = [];
    var fs = (isFinite(minEdge) ? minEdge : 0.2) * 0.9;
    L.polys.forEach(function (c) {
      var p = self.pos[c.sticker], t = document.createElementNS(NS, 'text');
      t.setAttribute('x', p[0].toFixed(4)); t.setAttribute('y', p[1].toFixed(4)); t.setAttribute('class', 'lt');
      t.setAttribute('font-size', fs.toFixed(4)); t.setAttribute('text-anchor', 'middle'); t.setAttribute('dominant-baseline', 'central');
      t.setAttribute('aria-hidden', 'true');
      svg.appendChild(t); self.texts[c.sticker] = t;
    });
    netEl.appendChild(svg);
  };
  /** 画布展开图（高阶）：一个 canvas + 命中表 + 按面放大 */
  NetEditor.prototype._buildCanvas = function (netEl, P, L) {
    var self = this;
    netEl.classList.add('canvas');
    this.cells = null; this.pos = [];
    this.grid = new Int32Array(L.cols * L.rows).fill(-1);
    this.cellAt = [];
    var faceBox = {};
    L.cells.forEach(function (c) {
      self.grid[c.row * L.cols + c.col] = c.sticker; self.cellAt[c.sticker] = c; self.pos[c.sticker] = [c.col + 0.5, c.row + 0.5];
      var f = P.stickers[c.sticker].face; if (!f) return;
      var b = faceBox[f] || (faceBox[f] = [Infinity, Infinity, -Infinity, -Infinity]);
      b[0] = Math.min(b[0], c.col); b[1] = Math.min(b[1], c.row); b[2] = Math.max(b[2], c.col + 1); b[3] = Math.max(b[3], c.row + 1);
    });
    this.faceBox = faceBox;
    this.view = [0, 0, L.cols, L.rows]; this.zoom = '';
    // 放大工具条
    var bar = document.createElement('div'); bar.className = 'net-zoom'; bar.setAttribute('role', 'toolbar');
    this.zoomBar = bar; this.zoomBtns = {};
    [''].concat(FACE_ORDER.filter(function (f) { return faceBox[f]; })).forEach(function (f) {
      var b = document.createElement('button'); b.type = 'button'; b.className = 'btn ghost small'; b.dataset.face = f;
      b.textContent = f || '⊞'; b.setAttribute('aria-pressed', f === '' ? 'true' : 'false');
      b.addEventListener('click', function () { self.setZoom(f); });
      bar.appendChild(b); self.zoomBtns[f] = b;
    });
    netEl.appendChild(bar);
    var wrap = document.createElement('div'); wrap.className = 'net-canvas-wrap';
    var cv = document.createElement('canvas'); cv.className = 'net-canvas'; cv.tabIndex = 0; cv.setAttribute('role', 'application');
    wrap.appendChild(cv); netEl.appendChild(wrap);
    var live = document.createElement('span'); live.className = 'sr-only'; live.setAttribute('aria-live', 'polite'); netEl.appendChild(live);
    this.canvas = cv; this.canvasWrap = wrap; this.live = live;
    cv.addEventListener('focus', function () { self._draw(); }); cv.addEventListener('blur', function () { self._draw(); });
    this._applyView();
    if (root.ResizeObserver) { this._ro = new ResizeObserver(function () { self._draw(); }); this._ro.observe(wrap); }
    else { this._onResize = function () { self._draw(); }; root.addEventListener('resize', this._onResize); }
  };
  NetEditor.prototype.setZoom = function (f) {
    if (!this.canvasMode) return;
    this.zoom = this.faceBox[f] ? f : '';
    var b = this.faceBox[this.zoom], L = this.P.netLayout;
    this.view = b ? [b[0], b[1], b[2] - b[0], b[3] - b[1]] : [0, 0, L.cols, L.rows];
    for (var k in this.zoomBtns) this.zoomBtns[k].setAttribute('aria-pressed', k === this.zoom ? 'true' : 'false');
    if (b && this.focusI != null && this.P.stickers[this.focusI].face !== this.zoom) this.focusI = this._firstFocusable();
    this._applyView();
  };
  NetEditor.prototype._applyView = function () {
    var v = this.view;
    this.canvasWrap.style.aspectRatio = v[2] + ' / ' + v[3];
    this.canvasWrap.style.maxWidth = this.zoom ? '420px' : '';
    this._draw();
  };
  NetEditor.prototype._visible = function (i) {
    if (!this.canvasMode || !this.zoom) return true;
    return this.P.stickers[i].face === this.zoom;
  };
  NetEditor.prototype._hitCanvas = function (e) {
    var r = this.canvas.getBoundingClientRect(); if (!r.width) return null;
    var v = this.view, col = Math.floor(v[0] + (e.clientX - r.left) / r.width * v[2]), row = Math.floor(v[1] + (e.clientY - r.top) / r.height * v[3]);
    var L = this.P.netLayout;
    if (col < v[0] || row < v[1] || col >= v[0] + v[2] || row >= v[1] + v[3]) return null;
    var i = this.grid[row * L.cols + col];
    return i >= 0 && this._visible(i) ? i : null;
  };
  NetEditor.prototype._draw = function () {
    if (!this.canvasMode) return;
    var cv = this.canvas, wrap = this.canvasWrap, P = this.P, L = P.netLayout, v = this.view;
    var w = wrap.clientWidth || 600, cs = w / v[2], h = cs * v[3];
    var dpr = Math.min(root.devicePixelRatio || 1, 3);
    var W = Math.max(1, Math.round(w * dpr)), H = Math.max(1, Math.round(h * dpr));
    if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
    cv.style.width = w + 'px'; cv.style.height = h + 'px';
    var x = cv.getContext('2d'); if (!x) return;
    x.setTransform(dpr, 0, 0, dpr, 0, 0); x.clearRect(0, 0, w, h);
    var gap = Math.max(0.5, Math.min(2, cs * 0.08)), st = this.state, self = this;
    var lw = cs >= 14 ? 1.5 : 1;
    var font = Math.max(7, cs * 0.5);
    x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = '700 ' + font.toFixed(1) + 'px system-ui,sans-serif';
    L.cells.forEach(function (c) {
      if (c.col < v[0] || c.row < v[1] || c.col >= v[0] + v[2] || c.row >= v[1] + v[3]) return;
      var i = c.sticker; if (!self._visible(i)) return;
      var px = (c.col - v[0]) * cs + gap / 2, py = (c.row - v[1]) * cs + gap / 2, s = cs - gap, k = st[i];
      var hex = k && P.colors[k] ? P.colors[k].hex : null;
      if (hex) { x.fillStyle = hex; x.fillRect(px, py, s, s); }
      else { x.fillStyle = '#ecebe3'; x.fillRect(px, py, s, s); x.strokeStyle = '#cfcec4'; x.lineWidth = 1; x.beginPath(); x.moveTo(px, py + s); x.lineTo(px + s, py); x.stroke(); }
      x.lineWidth = lw; x.strokeStyle = '#1d1d1b'; x.strokeRect(px + lw / 2, py + lw / 2, s - lw, s - lw);
      if (P.stickers[i].locked) { x.fillStyle = 'rgba(0,0,0,.35)'; x.beginPath(); x.arc(px + s / 2, py + s / 2, s * 0.18, 0, 7); x.fill(); }
      if (self.letters && k && cs >= 9) { x.fillStyle = inkFor(hex); x.fillText(letterOf(P, k), px + s / 2, py + s / 2 + 0.5); }
      if (self.flags[i]) { x.lineWidth = Math.max(2, cs * 0.12); x.strokeStyle = '#d0263e'; x.strokeRect(px + 1, py + 1, s - 2, s - 2); }
    });
    if (this.focusI != null && this._visible(this.focusI) && document.activeElement === cv) {
      var c = this.cellAt[this.focusI], px = (c.col - v[0]) * cs, py = (c.row - v[1]) * cs;
      x.lineWidth = 3; x.strokeStyle = '#ff7a1a'; x.strokeRect(px + 1.5, py + 1.5, cs - 3, cs - 3);
    }
  };
  NetEditor.prototype._firstFocusable = function () {
    var P = this.P, best = null;
    for (var i = 0; i < P.stickers.length; i++) { if (!this._visible(i) || this.pos[i] == null) continue; if (!P.stickers[i].locked) return i; if (best == null) best = i; }
    return best;
  };
  NetEditor.prototype._setFocus = function (i, move) {
    if (i == null) return;
    var prev = this.focusI; this.focusI = i;
    if (this.canvasMode) {
      if (move) { this._draw(); if (this.live) this.live.textContent = this._label(i); }
      else this._draw();
      return;
    }
    if (prev != null && this.cells[prev]) this.cells[prev].setAttribute('tabindex', '-1');
    var b = this.cells[i]; if (!b) return;
    b.setAttribute('tabindex', '0');
    if (move) b.focus();
  };
  NetEditor.prototype._label = function (i) {
    var s = this.P.stickers[i], k = this.state[i];
    var base = T(s.locked ? 'paint.centerFixed' : 'paint.cell', { id: s.id });
    return k && this.P.colors[k] ? base + ' — ' + T('color.' + (this.P.colors[k].phys || k)) : base;
  };
  /** 该方向上「最近」的贴纸：前进距离 + 2×横向偏移 最小 */
  NetEditor.prototype._neighbor = function (i, dx, dy) {
    var p = this.pos[i]; if (!p) return null;
    var best = null, bc = Infinity;
    for (var j = 0; j < this.pos.length; j++) {
      var q = this.pos[j]; if (!q || j === i || !this._visible(j)) continue;
      var ax = q[0] - p[0], ay = q[1] - p[1], along = ax * dx + ay * dy; if (along <= 1e-6) continue;
      var perp = Math.abs(ax * dy - ay * dx), cost = along + 2 * perp;
      if (cost < bc - 1e-9) { bc = cost; best = j; }
    }
    return best;
  };
  NetEditor.prototype._key = function (e) {
    var k = e.key, i = this.focusI;
    var dir = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[k];
    if (!this.canvasMode && e.target && e.target.closest) { var c = e.target.closest('.cell'); if (c) i = +c.dataset.i; }
    if (dir) {
      if (i == null) i = this._firstFocusable();
      var rtl = false;
      var j = this._neighbor(i, dir[0] * (rtl ? -1 : 1), dir[1]);
      if (j != null) this._setFocus(j, true);
      e.preventDefault(); return;
    }
    if (k === 'Home' || k === 'End') {
      var list = []; for (var q = 0; q < this.pos.length; q++) if (this.pos[q] && this._visible(q)) list.push(q);
      if (list.length) this._setFocus(k === 'Home' ? list[0] : list[list.length - 1], true);
      e.preventDefault(); return;
    }
    if (k === 'Enter' || k === ' ') { if (i != null) { this._paintAt(i); if (this.canvasMode && this.live) this.live.textContent = this._label(i); } e.preventDefault(); return; }
    if (/^[0-9]$/.test(k) && !e.ctrlKey && !e.metaKey && !e.altKey) {
      var keys = Object.keys(this.P.colors), n = +k;
      if (n === 0) this.setBrush(''); else if (keys[n - 1]) this.setBrush(keys[n - 1]); else return;
      if (this.live) this.live.textContent = n === 0 ? T('paint.eraser') : T('color.' + (this.P.colors[keys[n - 1]].phys || keys[n - 1]));
      e.preventDefault();
    }
  };
  NetEditor.prototype.destroy = function () {
    root.removeEventListener('pointerup', this._up); if (this._offI18n) this._offI18n();
    if (this._ro) this._ro.disconnect(); if (this._onResize) root.removeEventListener('resize', this._onResize);
  };
  /** 颜色名 / 无障碍标签（随语言更新） */
  NetEditor.prototype.relabel = function () {
    var P = this.P, self = this;
    for (var k in this.swatches) {
      this.swatches[k].querySelector('.lbl').textContent = k ? T('color.' + (P.colors[k].phys || k)) : T('paint.eraser');
      this.swatches[k].querySelector('.lt').textContent = letterOf(P, k);
    }
    if (this.canvasMode) {
      this.canvas.setAttribute('aria-label', T('paint.canvasAria'));
      this.zoomBar.setAttribute('aria-label', T('paint.zoom'));
      for (var f in this.zoomBtns) { var lab = f ? T('move.side.' + f) : T('paint.zoomAll'); this.zoomBtns[f].title = lab; this.zoomBtns[f].setAttribute('aria-label', lab); }
      return;
    }
    this.cells.forEach(function (b) { if (b) b.setAttribute('aria-label', T(b.dataset.locked ? 'paint.centerFixed' : 'paint.cell', { id: b.dataset.sid })); });
    if (this.focusI != null) this._setFocus(this.focusI, false);
    void self;
  };
  NetEditor.prototype._changed = function () { if (this.opts.onChange) this.opts.onChange(this.state.slice()); };
  NetEditor.prototype.setBrush = function (k) {
    this.brush = k;
    for (var c in this.swatches) { this.swatches[c].classList.toggle('active', c === k); this.swatches[c].setAttribute('aria-pressed', c === k ? 'true' : 'false'); }
  };
  NetEditor.prototype.setLetters = function (on) {
    this.letters = !!on; this.el.classList.toggle('letters', this.letters);
    if (this.cells) this.cells.forEach(function (b) { if (b) b.dataset.r = ''; });
    this.render();
  };
  /** 配色方案改变后：更新调色板与贴纸颜色 */
  NetEditor.prototype.refreshColors = function () {
    var P = this.P;
    for (var k in this.swatches) if (k) { var d = this.swatches[k].querySelector('.dot'); d.style.background = P.colors[k].hex; d.style.color = inkFor(P.colors[k].hex); }
    if (this.cells) this.cells.forEach(function (b) { if (b) b.dataset.r = ''; });
    this.relabel(); this.render();
  };
  NetEditor.prototype.setState = function (s, silent) { this.state = s.slice(); this.render(); if (!silent) this._changed(); };
  NetEditor.prototype.getState = function () { return this.state.slice(); };
  NetEditor.prototype.clear = function () {
    var P = this.P; this.setState(this.state.map(function (c, i) { return P.stickers[i].locked ? c : ''; }));
  };
  NetEditor.prototype.mark = function (ids) {
    var self = this; this.flags = {};
    (ids || []).forEach(function (i) { self.flags[i] = 1; });
    if (this.canvasMode) { this._draw(); return; }
    this.cells.forEach(function (b, i) { if (b) b.classList.toggle('flag', !!self.flags[i]); });
  };
  NetEditor.prototype.render = function () {
    var P = this.P, st = this.state, counts = {}, svgMode = this.svgMode, self = this;
    if (this.canvasMode) { st.forEach(function (c) { counts[c] = (counts[c] || 0) + 1; }); this._draw(); }
    else this.cells.forEach(function (b, i) {
      var c = st[i]; counts[c] = (counts[c] || 0) + 1;
      if (b.dataset.color === (c || '') && b.dataset.r) return;
      b.dataset.r = '1';
      var hex = c && P.colors[c] ? P.colors[c].hex : '';
      b.style[svgMode ? 'fill' : 'background'] = hex;
      b.classList.toggle('blank', !c); b.dataset.color = c || '';
      var lt = self.letters && c ? letterOf(P, c) : '';
      if (svgMode) { var t = self.texts[i]; if (t) { t.textContent = lt; t.setAttribute('fill', inkFor(hex)); } }
      else { b.textContent = lt; b.style.color = lt ? inkFor(hex) : ''; }
    });
    var per = P.stickers.length / Object.keys(P.colors).length;
    for (var k in this.swatches) {
      if (!k) { this.swatches[k].querySelector('.cnt').textContent = counts[''] ? (CL.i18n ? CL.i18n.nf(counts['']) : counts['']) : ''; continue; }
      var n = counts[k] || 0, el = this.swatches[k].querySelector('.cnt');
      el.textContent = (CL.i18n ? CL.i18n.nf(n) + '/' + CL.i18n.nf(per) : n + '/' + per); el.classList.toggle('bad', n !== per);
    }
  };
  NetEditor.letterOf = letterOf; NetEditor.inkFor = inkFor; NetEditor.lettersOn = lettersOn;
  CL.NetEditor = NetEditor;
})(window);
