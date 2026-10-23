/*
 * 展开图涂色编辑器。只依赖 Puzzle 接口：netLayout、stickers[].locked、colors、blankColor。
 * 支持点击 / 拖动连续涂色；固定贴纸（如中心块）不可修改。
 */
(function (root) {
  'use strict';
  var CL = root.CubeLab;
  var T = function (k, p) { return CL.i18n ? CL.i18n.t(k, p) : k; };
  function NetEditor(netEl, paletteEl, P, opts) {
    this.P = P; this.opts = opts || {}; this.state = P.solvedState(); this.brush = Object.keys(P.colors)[0];
    var self = this, L = P.netLayout;
    netEl.innerHTML = ''; netEl.classList.add('net');
    this.svgMode = !!L.polys;
    netEl.classList.remove('poly'); netEl.style.maxWidth = '';
    if (this.svgMode) this._buildPoly(netEl, P, L); else this._buildGrid(netEl, P, L);
    var painting = false;
    var paint = function (b) {
      if (!b || !b.classList.contains('cell')) return;
      var i = +b.dataset.i; if (P.stickers[i].locked) return;
      if (self.state[i] === self.brush) return;
      self.state[i] = self.brush; self.render(); self._changed();
      if (self.opts.onPaint) self.opts.onPaint(i, self.brush);
    };
    netEl.addEventListener('pointerdown', function (e) { painting = true; paint(e.target.closest('.cell')); e.preventDefault(); });
    netEl.addEventListener('pointermove', function (e) {
      if (!painting) return;
      paint(document.elementFromPoint(e.clientX, e.clientY) && document.elementFromPoint(e.clientX, e.clientY).closest('.cell'));
    });
    this._up = function () { painting = false; };
    root.addEventListener('pointerup', this._up);
    netEl.addEventListener('keydown', function (e) { if ((e.key === 'Enter' || e.key === ' ') && e.target.classList.contains('cell')) { paint(e.target); e.preventDefault(); } });

    // 调色板
    paletteEl.innerHTML = '';
    this.swatches = {};
    Object.keys(P.colors).concat(['']).forEach(function (k) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'swatch' + (k ? '' : ' eraser'); b.dataset.color = k;
      b.innerHTML = '<span class="dot" style="background:' + (k ? P.colors[k].hex : 'transparent') + '"></span><span class="lbl"></span><span class="cnt" dir="ltr"></span>';
      b.addEventListener('click', function () { self.setBrush(k); });
      paletteEl.appendChild(b); self.swatches[k] = b;
    });
    this.setBrush(this.brush);
    this.render(); this.relabel();
    if (CL.i18n) this._offI18n = CL.i18n.onChange(function () { self.relabel(); self.render(); });
    // 高阶魔方：格子很多，按阶数收紧间距（CSS 变量 --n）
    netEl.style.setProperty('--n', String(Math.round((L.cols || 12) / 4)));
    netEl.classList.toggle('dense', L.cols > 28);
  }
  NetEditor.prototype._buildGrid = function (netEl, P, L) {
    var self = this;
    netEl.style.gridTemplateColumns = 'repeat(' + L.cols + ', 1fr)';
    netEl.style.gridTemplateRows = 'repeat(' + L.rows + ', 1fr)';
    netEl.style.aspectRatio = L.cols + ' / ' + L.rows;
    this.cells = [];
    L.cells.forEach(function (c) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'cell'; b.dataset.i = c.sticker;
      var s = P.stickers[c.sticker];
      b.dataset.sid = s.id; b.dataset.locked = s.locked ? '1' : '';
      if (s.locked) b.classList.add('locked');
      b.style.gridColumn = (c.col + 1); b.style.gridRow = (c.row + 1);
      netEl.appendChild(b); self.cells[c.sticker] = b;
    });
  };
  /** 多边形展开图（金字塔三角形、斜转菱形 + 三角形）：SVG，每块贴纸一个可聚焦的 polygon */
  NetEditor.prototype._buildPoly = function (netEl, P, L) {
    var NS = 'http://www.w3.org/2000/svg', svg = document.createElementNS(NS, 'svg'), self = this, vb = L.viewBox;
    netEl.classList.add('poly');
    netEl.style.gridTemplateColumns = ''; netEl.style.gridTemplateRows = '';
    netEl.style.aspectRatio = vb[2] + ' / ' + vb[3];
    netEl.style.maxWidth = (L.maxWidth || 640) + 'px';
    svg.setAttribute('viewBox', vb.join(' ')); svg.setAttribute('class', 'net-svg');
    var g = L.gap || 0.86;
    this.cells = [];
    L.polys.forEach(function (c) {
      var n = c.pts.length, cx = 0, cy = 0;
      c.pts.forEach(function (p) { cx += p[0] / n; cy += p[1] / n; });
      var pts = c.pts.map(function (p) { return (cx + (p[0] - cx) * g).toFixed(4) + ',' + (cy + (p[1] - cy) * g).toFixed(4); }).join(' ');
      var b = document.createElementNS(NS, 'polygon');
      b.setAttribute('points', pts); b.setAttribute('class', 'cell'); b.setAttribute('tabindex', '0'); b.setAttribute('role', 'button');
      b.dataset.i = c.sticker; b.dataset.sid = P.stickers[c.sticker].id; b.dataset.locked = '';
      svg.appendChild(b); self.cells[c.sticker] = b;
    });
    netEl.appendChild(svg);
  };
  NetEditor.prototype.destroy = function () { root.removeEventListener('pointerup', this._up); if (this._offI18n) this._offI18n(); };
  /** 颜色名 / 无障碍标签（随语言更新） */
  NetEditor.prototype.relabel = function () {
    for (var k in this.swatches) this.swatches[k].querySelector('.lbl').textContent = k ? T('color.' + k) : T('paint.eraser');
    this.cells.forEach(function (b) { b.setAttribute('aria-label', T(b.dataset.locked ? 'paint.centerFixed' : 'paint.cell', { id: b.dataset.sid })); });
  };
  NetEditor.prototype._changed = function () { if (this.opts.onChange) this.opts.onChange(this.state.slice()); };
  NetEditor.prototype.setBrush = function (k) {
    this.brush = k;
    for (var c in this.swatches) this.swatches[c].classList.toggle('active', c === k);
  };
  NetEditor.prototype.setState = function (s, silent) { this.state = s.slice(); this.render(); if (!silent) this._changed(); };
  NetEditor.prototype.getState = function () { return this.state.slice(); };
  NetEditor.prototype.clear = function () {
    var P = this.P; this.setState(this.state.map(function (c, i) { return P.stickers[i].locked ? c : ''; }));
  };
  NetEditor.prototype.mark = function (ids) {
    this.cells.forEach(function (b) { b.classList.remove('flag'); });
    var self = this; (ids || []).forEach(function (i) { self.cells[i].classList.add('flag'); });
  };
  NetEditor.prototype.render = function () {
    var P = this.P, st = this.state, counts = {}, svgMode = this.svgMode;
    this.cells.forEach(function (b, i) {
      var c = st[i]; counts[c] = (counts[c] || 0) + 1;
      if (b.dataset.color === (c || '') && b.dataset.r) return;
      b.dataset.r = '1';
      b.style[svgMode ? 'fill' : 'background'] = c && P.colors[c] ? P.colors[c].hex : '';
      b.classList.toggle('blank', !c); b.dataset.color = c || '';
    });
    var per = P.stickers.length / Object.keys(P.colors).length;
    for (var k in this.swatches) {
      if (!k) { this.swatches[k].querySelector('.cnt').textContent = counts[''] ? (CL.i18n ? CL.i18n.nf(counts['']) : counts['']) : ''; continue; }
      var n = counts[k] || 0, el = this.swatches[k].querySelector('.cnt');
      el.textContent = (CL.i18n ? CL.i18n.nf(n) + '/' + CL.i18n.nf(per) : n + '/' + per); el.classList.toggle('bad', n !== per);
    }
  };
  CL.NetEditor = NetEditor;
})(window);
