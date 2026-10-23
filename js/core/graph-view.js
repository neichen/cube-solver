/*
 * 图论视图：节点 = 贴纸，轨道 = 贴纸在各层转动下经过的圆。
 * 只依赖 Puzzle 接口：graphLayout()、tracks、moves[tok].{paths,base,angle,face}、faces、colors。
 *
 * 运动规则（通用）：
 *  - 「侧面」轨道：若布局提供的某个圆（layout.circles）经过该轨道全部节点，则节点沿该圆做真正的圆周运动；
 *    同一轨道上所有节点同向旋转（方向取基础转动下总行程最短者，逆转动反向）。
 *  - 「本面」轨道：节点绕该面中心节点做极坐标插值（簇整体旋转）。
 *  - 若布局未提供圆，退回为穿过节点的闭合样条（向心 Catmull-Rom）。
 */
(function (root) {
  'use strict';
  var CL = root.CubeLab, SVGNS = 'http://www.w3.org/2000/svg', TAU = Math.PI * 2;

  function el(tag, attrs, parent) {
    var e = document.createElementNS(SVGNS, tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function crPoint(P0, P1, P2, P3, t) {
    function d(a, b) { return Math.pow(Math.hypot(b[0] - a[0], b[1] - a[1]), 0.5) || 1e-6; }
    var t0 = 0, t1 = t0 + d(P0, P1), t2 = t1 + d(P1, P2), t3 = t2 + d(P2, P3), tt = t1 + t * (t2 - t1);
    function lerp(A, B, ta, tb) { var w = (tt - ta) / (tb - ta); return [A[0] + (B[0] - A[0]) * w, A[1] + (B[1] - A[1]) * w]; }
    var A1 = lerp(P0, P1, t0, t1), A2 = lerp(P1, P2, t1, t2), A3 = lerp(P2, P3, t2, t3);
    return lerp(lerp(A1, A2, t0, t2), lerp(A2, A3, t1, t3), t1, t2);
  }
  function splineGeom(pts) {
    var n = pts.length;
    function at(u) { var i = Math.floor(u), t = u - i, g = function (k) { return pts[((k % n) + n) % n]; }; return crPoint(g(i - 1), g(i), g(i + 1), g(i + 2), t); }
    var d = '';
    for (var k = 0; k < n * 16; k++) { var p = at(k / 16); d += (k ? 'L' : 'M') + p[0].toFixed(4) + ' ' + p[1].toFixed(4); }
    return { d: d + 'Z', at: at };
  }
  function ang(c, p) { return Math.atan2(p[1] - c[1], p[0] - c[0]); }
  function ccw(a0, a1) { var d = (a1 - a0) % TAU; return d < 0 ? d + TAU : d; }   // 0..2π（SVG 坐标下为顺时针视觉方向）
  function arcPath(cx, cy, r, a0, a1) {   // 从 a0 到 a1（a1 可小于 a0），按参数方向
    var n = Math.max(2, Math.ceil(Math.abs(a1 - a0) / 0.15)), d = '';
    for (var k = 0; k <= n; k++) { var a = a0 + (a1 - a0) * k / n; d += (k ? 'L' : 'M') + (cx + r * Math.cos(a)).toFixed(4) + ' ' + (cy + r * Math.sin(a)).toFixed(4); }
    return d;
  }

  function GraphView(container, P) {
    this.P = P; this.container = container;
    var lay = this.layout = P.graphLayout(), self = this;
    var R = lay.nodeRadius;
    // 图的包围盒（节点 + 圆）
    var xs = lay.nodes.map(function (p) { return p[0]; }), ys = lay.nodes.map(function (p) { return p[1]; });
    (lay.circles || []).forEach(function (c) { xs.push(c.cx - c.r, c.cx + c.r); ys.push(c.cy - c.r, c.cy + c.r); });
    var pad = R + (lay.nodeStroke || 0) + (lay.trackWidth || 0);
    this.bbox = [Math.min.apply(null, xs) - pad, Math.min.apply(null, ys) - pad, Math.max.apply(null, xs) + pad, Math.max.apply(null, ys) + pad];
    var svg = this.svg = el('svg', { class: 'graph-svg', role: 'img', 'aria-label': root.CubeLab && root.CubeLab.i18n ? root.CubeLab.i18n.t('graph.aria') : 'Sticker permutation graph', preserveAspectRatio: 'xMidYMid meet' });
    svg.style.setProperty('--tw', lay.trackWidth || 0.05);
    svg.style.setProperty('--aw', lay.activeWidth || (lay.trackWidth || 0.05) * 1.25);
    svg.style.setProperty('--nw', lay.nodeStroke || R * 0.25);
    container.appendChild(svg);
    var defs = el('defs', {}, svg);
    var flt = el('filter', { id: 'trailBlur', x: '-20%', y: '-20%', width: '140%', height: '140%' }, defs);
    el('feGaussianBlur', { stdDeviation: (lay.trackWidth || 0.05) * 0.42 }, flt);
    var gT = el('g', { class: 'g-tracks' }, svg), gH = el('g', { class: 'g-active' }, svg), gTr = el('g', { class: 'g-trails', filter: 'url(#trailBlur)' }, svg), gN = el('g', { class: 'g-nodes' }, svg);
    this.gTrails = gTr;
    this.zoom = 1; this.pan = [0, 0];
    this.fit();
    if (root.ResizeObserver) { this._ro = new ResizeObserver(function () { self.fit(); }); this._ro.observe(container); }
    if (lay.zoomable) this._bindZoom();

    // 轨道几何
    var circles = lay.circles || [];
    this.trackGeo = {};
    this.circleEls = {};
    circles.forEach(function (c) { self.circleEls[c.id] = el('circle', { cx: c.cx, cy: c.cy, r: c.r, class: 'track' }, gT); });
    P.tracks.forEach(function (tr) {
      var pts = tr.stickers.map(function (i) { return lay.nodes[i]; });
      if (tr.kind === 'face') {
        var face = P.faces.filter(function (f) { return f.id === tr.face; })[0];
        // 偶数阶没有中心贴纸：用布局给出的面中心（两组中圆的交点）
        self.trackGeo[tr.id] = { type: 'polar', c: (lay.faceCenters && lay.faceCenters[tr.face]) || lay.nodes[face.center] };
        return;
      }
      var hit = circles.filter(function (c) { return pts.every(function (p) { return Math.abs(Math.hypot(p[0] - c.cx, p[1] - c.cy) - c.r) < 1e-6 * 1e3; }); })[0];
      if (hit) { self.trackGeo[tr.id] = { type: 'circle', c: [hit.cx, hit.cy], r: hit.r, circle: hit.id }; return; }
      var sp = splineGeom(pts);
      self.trackGeo[tr.id] = { type: 'spline', sp: sp, el: el('path', { d: sp.d, class: 'track' }, gT) };
    });
    // 活动轨道高亮层
    this.activeEls = {};
    Object.keys(this.trackGeo).forEach(function (id) {
      var g = self.trackGeo[id];
      if (g.type === 'circle') self.activeEls[id] = el('circle', { cx: g.c[0], cy: g.c[1], r: g.r, class: 'track-active' }, gH);
      else if (g.type === 'spline') self.activeEls[id] = el('path', { d: g.sp.d, class: 'track-active' }, gH);
    });

    this.nodeEls = lay.nodes.map(function (p, i) {
      return el('circle', { cx: p[0], cy: p[1], r: R, class: 'node', 'data-i': i }, gN);
    });
    this.trackById = {}; P.tracks.forEach(function (tr) { self.trackById[tr.id] = tr; });
    this.fills = []; this.moved = null; this.baseDirs = {};
    this.trailSeg = lay.trailSegments || 10;
    this.motions = {};
    this.curTok = null; this.state = null;
  }

  /** 取景：图宽占面板 frame.width、高度不超过 frame.height，包围盒居中（与参考视频一致） */
  GraphView.prototype.fit = function () {
    var w = this.container.clientWidth || 400, h = this.container.clientHeight || 400;
    var fr = this.layout.frame || { width: 0.92, height: 0.92 }, b = this.bbox;
    var bw = b[2] - b[0], bh = b[3] - b[1];
    var scale = Math.min(w * fr.width / bw, h * fr.height / bh);   // px / 单位
    var vw = w / scale, vh = h / scale, cx = (b[0] + b[2]) / 2 - (fr.dx || 0) * vw, cy = (b[1] + b[3]) / 2 - (fr.dy || 0) * vh;
    this.view0 = { cx: cx, cy: cy, vw: vw, vh: vh, scale: scale };
    var z = this.zoom || 1; vw /= z; vh /= z; cx += this.pan[0]; cy += this.pan[1];
    this.svg.setAttribute('viewBox', [cx - vw / 2, cy - vh / 2, vw, vh].map(function (v) { return v.toFixed(4); }).join(' '));
  };
  /** 计算某转动下每个节点的运动描述（缓存） */
  /** 基础转动下某条轨道上节点的走向（总行程最短的方向，缓存） */
  GraphView.prototype.baseDir = function (tid) {
    if (this.baseDirs[tid] != null) return this.baseDirs[tid];
    var g = this.trackGeo[tid], tr = this.trackById[tid], base = this.P.moves[tr.base], lay = this.layout, tot = 0;
    tr.stickers.forEach(function (s) { tot += ccw(ang(g.c, lay.nodes[s]), ang(g.c, lay.nodes[base.perm[s]])); });
    return (this.baseDirs[tid] = tot <= tr.stickers.length * Math.PI ? 1 : -1);
  };
  GraphView.prototype.motion = function (tok) {
    if (this.motions[tok]) return this.motions[tok];
    var lay = this.layout, self = this, m = this.P.moves[tok];
    var list = m.paths.map(function (p) {
      var g = self.trackGeo[p.track], s = p.sticker, dst = m.perm[s];
      if (g.type === 'spline') return { s: s, type: 'spline', g: g, from: p.from, steps: p.steps };
      var dir = (p.sense == null ? 1 : p.sense) * self.baseDir(p.track);
      var a0 = ang(g.c, lay.nodes[s]), a1 = ang(g.c, lay.nodes[dst]);
      var delta = dir > 0 ? ccw(a0, a1) : -ccw(a1, a0);
      if (s === dst) delta = 0;
      var r0 = Math.hypot(lay.nodes[s][0] - g.c[0], lay.nodes[s][1] - g.c[1]), r1 = Math.hypot(lay.nodes[dst][0] - g.c[0], lay.nodes[dst][1] - g.c[1]);
      return { s: s, type: g.type, c: g.c, r0: r0, r1: r1, a0: a0, delta: delta, track: p.track };
    });
    return (this.motions[tok] = list);
  };
  GraphView.prototype.colorOf = function (c) { return c && this.P.colors[c] ? this.P.colors[c].hex : this.P.blankColor; };
  GraphView.prototype.setState = function (state) {
    var self = this, lay = this.layout, fills = this.fills;
    this.state = state.slice();
    // 只重置上一步移动过的节点位置、只更新颜色变化的节点（高阶魔方有上千个节点）
    var moved = this.moved; this.moved = null;
    (moved || this.nodeEls.map(function (_, i) { return i; })).forEach(function (i) { var n = self.nodeEls[i]; n.setAttribute('cx', lay.nodes[i][0]); n.setAttribute('cy', lay.nodes[i][1]); });
    this.nodeEls.forEach(function (n, i) {
      var c = state[i] || '';
      if (fills[i] === c) return;
      fills[i] = c; n.setAttribute('fill', self.colorOf(state[i])); n.setAttribute('data-color', c);
    });
    if (this.gTrails.firstChild) this.gTrails.innerHTML = '';
    this.curTok = null;
  };
  /** 高亮某转动的轨道；done=true 表示转动已结束（参考视频中会淡化为深灰） */
  GraphView.prototype.highlight = function (tok, state, done) {
    var self = this;
    Object.keys(this.activeEls).forEach(function (id) { self.activeEls[id].classList.remove('on', 'done'); self.activeEls[id].style.opacity = ''; });
    if (!tok) return;
    this.P.moves[tok].tracks.forEach(function (id) { if (self.activeEls[id]) self.activeEls[id].classList.add('on'); if (done && self.activeEls[id]) self.activeEls[id].classList.add('done'); });
  };
  function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
  function smooth(a, b, x) { x = clamp01((x - a) / (b - a)); return x * x * (3 - 2 * x); }
  function ease(t) { return CL.ease ? CL.ease(t) : t; }
  // easeInOutQuad 的反函数（未传入原始时间 t 时由 e 反推）
  function invEase(e) { return e < 0.5 ? Math.sqrt(e / 2) : 1 - Math.sqrt((1 - e) / 2); }
  /**
   * e ∈ [0,1]：转动进度（已缓动）；fromState 为转动前状态；t 为原始时间相位（可选）。
   * 参考视频逐帧观察：活动圆在转动前 ~8% 内淡入、最后 ~16% 淡出，转动结束时已无高亮；
   * 拖尾是「尾巴」滞后于节点的一段弧（尾部相位 = ease(1.6t − 0.6)：前 40% 拖尾从起点一直连到节点），越靠近节点越浓，转动结束时消失。
   */
  GraphView.prototype.animate = function (tok, e, fromState, t) {
    if (this.curTok !== tok) { this.setState(fromState); this.curTok = tok; this.highlight(tok, fromState, false); }
    if (t == null) t = invEase(e);
    var self = this, st = this.state, trails = '';
    var env = smooth(0, 0.08, t) * (1 - smooth(0.84, 1, t));
    this.P.moves[tok].tracks.forEach(function (id) { var a = self.activeEls[id]; if (a) a.style.opacity = env.toFixed(3); });
    var tail = ease(clamp01(1.6 * t - 0.6)), SEG = this.trailSeg, mot = this.motion(tok);
    if (!this.moved) this.moved = mot.map(function (mv) { return mv.s; });
    mot.forEach(function (mv) {
      var n = self.nodeEls[mv.s], x, y;
      if (mv.type === 'spline') { var q = mv.g.sp.at(mv.from + mv.steps * e); x = q[0]; y = q[1]; }
      else {
        var a = mv.a0 + mv.delta * e, r = mv.r0 + (mv.r1 - mv.r0) * e;
        x = mv.c[0] + r * Math.cos(a); y = mv.c[1] + r * Math.sin(a);
        if (mv.type === 'circle' && mv.delta && e - tail > 0.01) {
          // 彩色拖尾：沿圆弧、颜色取自经过的贴纸，从节点向尾部分段渐隐
          var aT = mv.a0 + mv.delta * tail, col = self.colorOf(st[mv.s]);
          for (var k = 0; k < SEG; k++) {
            var s0 = a + (aT - a) * k / SEG, s1 = a + (aT - a) * (k + 1) / SEG;
            trails += '<path d="' + arcPath(mv.c[0], mv.c[1], mv.r0, s0, s1) + '" stroke="' + col + '" stroke-opacity="' + (0.97 * Math.pow(1 - k / SEG, 1.15)).toFixed(3) + '" class="trail"/>';
          }
        }
      }
      n.setAttribute('cx', x); n.setAttribute('cy', y);
    });
    this.gTrails.innerHTML = trails;
  };
  /** 缩放 / 平移（高阶魔方）：右上角按钮、Ctrl+滚轮、双指捏合；放大后可拖动平移，双击复位 */
  GraphView.prototype.setZoom = function (z, about) {
    var old = this.zoom; z = Math.max(1, Math.min(12, z));
    if (about && this.view0) {   // 保持 about（视图坐标）位置不动
      var v = this.view0, cx = v.cx + this.pan[0], cy = v.cy + this.pan[1];
      this.pan[0] += (about[0] - cx) * (1 - old / z); this.pan[1] += (about[1] - cy) * (1 - old / z);
    }
    this.zoom = z; if (z === 1) this.pan = [0, 0];
    this._clampPan(); this.fit();
    this.container.classList.toggle('zoomed', z > 1);
  };
  GraphView.prototype._clampPan = function () {
    if (!this.view0) return;
    var v = this.view0, mx = v.vw / 2 * (1 - 1 / this.zoom), my = v.vh / 2 * (1 - 1 / this.zoom);
    this.pan[0] = Math.max(-mx, Math.min(mx, this.pan[0])); this.pan[1] = Math.max(-my, Math.min(my, this.pan[1]));
  };
  GraphView.prototype._toView = function (cx, cy) {
    var r = this.svg.getBoundingClientRect(), v = this.view0, z = this.zoom;
    return [v.cx + this.pan[0] + ((cx - r.left) / r.width - 0.5) * v.vw / z, v.cy + this.pan[1] + ((cy - r.top) / r.height - 0.5) * v.vh / z];
  };
  GraphView.prototype._bindZoom = function () {
    var self = this, svg = this.svg, T = function (k) { return CL.i18n ? CL.i18n.t(k) : k; };
    var bar = document.createElement('div'); bar.className = 'graph-zoom'; bar.dir = 'ltr';
    [['+', 'graph.zoomIn', function () { self.setZoom(self.zoom * 1.5); }], ['−', 'graph.zoomOut', function () { self.setZoom(self.zoom / 1.5); }], ['⟲', 'graph.zoomReset', function () { self.setZoom(1); }]].forEach(function (b) {
      var e = document.createElement('button'); e.type = 'button'; e.className = 'gz'; e.textContent = b[0]; e.dataset.k = b[1];
      e.title = T(b[1]); e.setAttribute('aria-label', T(b[1])); e.addEventListener('click', b[2]); bar.appendChild(e);
    });
    this.container.appendChild(bar); this.zoomBar = bar;
    if (CL.i18n) this._offI18n = CL.i18n.onChange(function () { Array.prototype.forEach.call(bar.children, function (e) { e.title = T(e.dataset.k); e.setAttribute('aria-label', T(e.dataset.k)); }); });
    svg.addEventListener('wheel', function (e) {
      if (!e.ctrlKey && !e.metaKey && self.zoom === 1) return;   // 未放大时不拦截页面滚动
      e.preventDefault(); self.setZoom(self.zoom * Math.exp(-e.deltaY * 0.0022), self._toView(e.clientX, e.clientY));
    }, { passive: false });
    var pts = {}, last = null, pinch = null;
    svg.addEventListener('pointerdown', function (e) {
      pts[e.pointerId] = [e.clientX, e.clientY];
      var ids = Object.keys(pts);
      if (ids.length === 2) { var a = pts[ids[0]], b = pts[ids[1]]; pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), z: self.zoom }; }
      if (self.zoom > 1 || ids.length === 2) { svg.setPointerCapture(e.pointerId); last = [e.clientX, e.clientY]; }
    });
    svg.addEventListener('pointermove', function (e) {
      if (!pts[e.pointerId]) return;
      pts[e.pointerId] = [e.clientX, e.clientY];
      var ids = Object.keys(pts);
      if (ids.length === 2 && pinch) {
        var a = pts[ids[0]], b = pts[ids[1]], d = Math.hypot(a[0] - b[0], a[1] - b[1]);
        self.setZoom(pinch.z * d / pinch.d, self._toView((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)); return;
      }
      if (self.zoom > 1 && last) {
        var r = svg.getBoundingClientRect(), v = self.view0;
        self.pan[0] -= (e.clientX - last[0]) / r.width * v.vw / self.zoom; self.pan[1] -= (e.clientY - last[1]) / r.height * v.vh / self.zoom;
        last = [e.clientX, e.clientY]; self._clampPan(); self.fit();
      }
    });
    var up = function (e) { delete pts[e.pointerId]; if (Object.keys(pts).length < 2) pinch = null; if (!Object.keys(pts).length) last = null; };
    svg.addEventListener('pointerup', up); svg.addEventListener('pointercancel', up);
    svg.addEventListener('dblclick', function () { self.setZoom(1); });
  };
  GraphView.prototype.destroy = function () {
    if (this._ro) this._ro.disconnect();
    if (this._offI18n) this._offI18n();
    if (this.svg.parentNode) this.svg.parentNode.removeChild(this.svg);
    if (this.zoomBar && this.zoomBar.parentNode) this.zoomBar.parentNode.removeChild(this.zoomBar);
  };
  /** 测试/调试：每个簇（面）的颜色集合 */
  GraphView.prototype.clusterColors = function () {
    var st = this.state;
    return this.layout.clusters.map(function (ids) { return ids.map(function (i) { return st[i]; }); });
  };
  CL.GraphView = GraphView;
})(window);
