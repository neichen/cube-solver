/*
 * 3D 视图（three.js）。只依赖 Puzzle 接口：pieces、stickers、moves[tok].{axis,angle,pieces}、colors、view3d。
 * style 'plastic'（参考视频）：浅灰块体 + 白色面板 + 叶形圆角贴纸，透视相机，柔和分面明暗；
 * 否则为黑色块体的经典扁平风格。
 * 自动旋转：播放时轻微摆动；调用 showcase() 做一圈展示翻转后回到初始视角。拖动旋转始终可用。
 */
(function (root) {
  'use strict';
  var CL = root.CubeLab, T = root.THREE;

  /** 圆角方形，corners = [左上, 右上, 右下, 左下] 半径（绝对值） */
  function roundedSquare(size, corners) {
    var s = size / 2, c = corners, sh = new T.Shape();
    sh.moveTo(-s + c[3], -s);
    sh.lineTo(s - c[2], -s); sh.quadraticCurveTo(s, -s, s, -s + c[2]);
    sh.lineTo(s, s - c[1]); sh.quadraticCurveTo(s, s, s - c[1], s);
    sh.lineTo(-s + c[0], s); sh.quadraticCurveTo(-s, s, -s, s - c[0]);
    sh.lineTo(-s, -s + c[3]); sh.quadraticCurveTo(-s, -s, -s + c[3], -s);
    return new T.ShapeGeometry(sh, 10);
  }
  // ---------------------------------------------------------------- 异形（多边形）几何
  function v3(a) { return new T.Vector3(a[0], a[1], a[2]); }
  /** 凸多面体 = ∩ { x : n·x ≤ c }：三平面求交 → 可行顶点 → 每个平面上的顶点按角度排序成面 */
  function polytope(H) {
    var eps = 1e-7, verts = [], i, j, k;
    function solve3(a, b, c) {
      var A = [a.n, b.n, c.n], d = [a.c, b.c, c.c];
      var det = A[0][0] * (A[1][1] * A[2][2] - A[1][2] * A[2][1]) - A[0][1] * (A[1][0] * A[2][2] - A[1][2] * A[2][0]) + A[0][2] * (A[1][0] * A[2][1] - A[1][1] * A[2][0]);
      if (Math.abs(det) < 1e-9) return null;
      function col(q) { var M = A.map(function (r, ri) { var rr = r.slice(); rr[q] = d[ri]; return rr; }); return M[0][0] * (M[1][1] * M[2][2] - M[1][2] * M[2][1]) - M[0][1] * (M[1][0] * M[2][2] - M[1][2] * M[2][0]) + M[0][2] * (M[1][0] * M[2][1] - M[1][1] * M[2][0]); }
      return [col(0) / det, col(1) / det, col(2) / det];
    }
    for (i = 0; i < H.length; i++) for (j = i + 1; j < H.length; j++) for (k = j + 1; k < H.length; k++) {
      var p = solve3(H[i], H[j], H[k]); if (!p) continue;
      if (H.some(function (h) { return h.n[0] * p[0] + h.n[1] * p[1] + h.n[2] * p[2] > h.c + 1e-6; })) continue;
      if (verts.some(function (q) { return Math.hypot(q[0] - p[0], q[1] - p[1], q[2] - p[2]) < 1e-6; })) continue;
      verts.push(p);
    }
    var pos = [];
    H.forEach(function (h) {
      var on = verts.filter(function (p) { return Math.abs(h.n[0] * p[0] + h.n[1] * p[1] + h.n[2] * p[2] - h.c) < 1e-5; });
      if (on.length < 3) return;
      var c = [0, 0, 0]; on.forEach(function (p) { c[0] += p[0] / on.length; c[1] += p[1] / on.length; c[2] += p[2] / on.length; });
      var n = v3(h.n).normalize(), u = v3(on[0]).sub(v3(c)).normalize(), w = new T.Vector3().crossVectors(n, u);
      on.sort(function (a, b) { var A = v3(a).sub(v3(c)), B = v3(b).sub(v3(c)); return Math.atan2(A.dot(w), A.dot(u)) - Math.atan2(B.dot(w), B.dot(u)); });
      for (var q = 1; q + 1 < on.length; q++) pos.push.apply(pos, on[0].concat(on[q], on[q + 1]));
    });
    var g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.computeVertexNormals();
    return g;
  }
  /** 贴纸：多边形向内缩 margin，再倒圆角 radius；返回放在贴纸平面上的网格几何（世界坐标） */
  function stickerGeom(poly, normal, margin, radius) {
    var n = v3(normal).normalize(), c = new T.Vector3(); poly.forEach(function (p) { c.add(v3(p)); }); c.multiplyScalar(1 / poly.length);
    var u = v3(poly[0]).sub(c).normalize(), w = new T.Vector3().crossVectors(n, u);
    var pts = poly.map(function (p) { var d = v3(p).sub(c); return [d.dot(u), d.dot(w)]; });
    var L = pts.length, ins = [];
    for (var i = 0; i < L; i++) {   // 第 i 个顶点 = 内移后的边 (i-1,i) 与 (i,i+1) 的交点
      var a = pts[(i + L - 1) % L], b = pts[i], d = pts[(i + 1) % L];
      var e1 = norm2([b[0] - a[0], b[1] - a[1]]), e2 = norm2([d[0] - b[0], d[1] - b[1]]);
      var n1 = [-e1[1], e1[0]], n2 = [-e2[1], e2[0]];   // CCW 多边形的内法线
      var p1 = [a[0] + n1[0] * margin, a[1] + n1[1] * margin], p2 = [b[0] + n2[0] * margin, b[1] + n2[1] * margin];
      var den = e1[0] * e2[1] - e1[1] * e2[0], t = ((p2[0] - p1[0]) * e2[1] - (p2[1] - p1[1]) * e2[0]) / den;
      ins.push([p1[0] + e1[0] * t, p1[1] + e1[1] * t]);
    }
    var sh = new T.Shape();
    for (i = 0; i < L; i++) {
      var P0 = ins[(i + L - 1) % L], P1 = ins[i], P2 = ins[(i + 1) % L];
      var l1 = Math.hypot(P1[0] - P0[0], P1[1] - P0[1]), l2 = Math.hypot(P2[0] - P1[0], P2[1] - P1[1]), rr = Math.min(radius, l1 * 0.45, l2 * 0.45);
      var A = [P1[0] + (P0[0] - P1[0]) / l1 * rr, P1[1] + (P0[1] - P1[1]) / l1 * rr], B = [P1[0] + (P2[0] - P1[0]) / l2 * rr, P1[1] + (P2[1] - P1[1]) / l2 * rr];
      if (i === 0) sh.moveTo(A[0], A[1]); else sh.lineTo(A[0], A[1]);
      sh.quadraticCurveTo(P1[0], P1[1], B[0], B[1]);
    }
    sh.closePath();
    var g = new T.ShapeGeometry(sh, 6), m = new T.Matrix4().makeBasis(u, w, n); m.setPosition(c);
    g.applyMatrix4(m);
    return g;
  }
  function norm2(a) { var l = Math.hypot(a[0], a[1]) || 1; return [a[0] / l, a[1] / l]; }
  CL._polytope = polytope;

  function easeInOut(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }

  function View3D(container, P) {
    this.P = P; this.container = container;
    var cfg = this.cfg = P.view3d || {};
    var r = this.renderer = new T.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    r.setPixelRatio(Math.min(root.devicePixelRatio || 1, 2));
    container.appendChild(r.domElement);
    r.domElement.className = 'view3d-canvas';
    this.scene = new T.Scene();
    var cam = cfg.camera || {};
    this.persp = !!cam.fov;
    this.camera = this.persp ? new T.PerspectiveCamera(cam.fov, 1, 0.1, 200) : new T.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
    this.viewDir = new T.Vector3().fromArray(cam.dir || cfg.viewDir || [1, 1, 1.4]).normalize();
    this.camera.position.copy(this.viewDir.clone().multiplyScalar(20)); this.camera.lookAt(0, 0, 0);
    this.zoom = cfg.zoom || 2.8;

    // 层级：spin（自动旋转）→ user（拖动）→ base（插件给定的初始朝向）→ 块
    this.spin = new T.Group(); this.scene.add(this.spin);
    this.user = new T.Group(); this.spin.add(this.user);
    this.root = new T.Group(); this.user.add(this.root);
    if (cfg.orientation) this.root.rotation.set(cfg.orientation[0], cfg.orientation[1], cfg.orientation[2]);
    if (cfg.scale) this.root.scale.setScalar(cfg.scale);   // N 阶：按 3/N 缩放，画面大小与 3×3 一致
    this.pivot = new T.Group(); this.root.add(this.pivot);

    var self = this;
    this.home = P.pieces.map(function (pc) { return cfg.geometry === 'poly' ? [0, 0, 0] : pc.pos; });
    if (cfg.geometry === 'poly') { this._buildPoly(P, cfg); this._finishInit(cfg); return; }
    var plastic = cfg.style === 'plastic';
    var Mat = plastic ? T.MeshLambertMaterial : T.MeshBasicMaterial;
    if (plastic) {
      this.scene.add(new T.AmbientLight(0xffffff, 2.15));
      var dl = new T.DirectionalLight(0xffffff, 0.95); dl.position.set(3, 8, 4); this.scene.add(dl);
      var dl2 = new T.DirectionalLight(0xffffff, 0.3); dl2.position.set(-5, 2, -1); this.scene.add(dl2);
    }
    var ps = cfg.pieceSize || 0.97, half = ps / 2;
    var bodyMat = new Mat({ color: plastic ? 0xb9b7b1 : 0x151515 });
    var plateMat = plastic ? new Mat({ color: 0xf8f8f5, side: T.DoubleSide }) : null;
    if (cfg.coreSize && !plastic) this.root.add(new T.Mesh(new T.BoxGeometry(cfg.coreSize, cfg.coreSize, cfg.coreSize), bodyMat));
    var ss = cfg.stickerSize || 0.84, sc = (cfg.stickerCorners || [0.12, 0.12, 0.12, 0.12]).map(function (k) { return k * ss; });
    if (cfg.stickerRadius && !cfg.stickerCorners) sc = [0, 0, 0, 0].map(function () { return cfg.stickerRadius; });
    var sg = roundedSquare(ss, sc);
    var pg = plastic && cfg.plates !== false ? roundedSquare(cfg.plateSize || 0.95, [0.04, 0.04, 0.04, 0.04]) : null;
    var bg = new T.BoxGeometry(ps, ps, ps);
    this.stickerMats = []; this.pickables = [];
    this.pieceObjs = P.pieces.map(function (pc, pIdx) {
      var g = new T.Group(); g.position.fromArray(pc.pos);
      var body = new T.Mesh(bg, bodyMat); body.userData.pi = pIdx; g.add(body); self.pickables.push(body);
      pc.stickers.forEach(function (si) {
        var s = P.stickers[si], n = new T.Vector3().fromArray(s.normal);
        // 让贴纸的局部「上」方向在侧面朝世界 +y、在上下面朝 -z，保证叶形方向一致
        var up = Math.abs(n.y) > 0.5 ? new T.Vector3(0, 0, -n.y) : new T.Vector3(0, 1, 0);
        var place = function (mesh, off) {
          mesh.position.copy(n.clone().multiplyScalar(half + off));
          mesh.up.copy(up); mesh.lookAt(mesh.position.clone().add(n));
          g.add(mesh);
        };
        if (pg) { var pm = new T.Mesh(pg, plateMat); pm.userData.si = si; place(pm, 0.002); self.pickables.push(pm); }
        // 贴纸为纯色（不受光照），块体与面板有柔和明暗——与参考视频一致
        var mat = new (cfg.flatStickers === false ? Mat : T.MeshBasicMaterial)({ color: 0xcccccc, side: T.DoubleSide });
        var sm = new T.Mesh(sg, mat); sm.userData.si = si; place(sm, 0.004); self.pickables.push(sm);
        self.stickerMats[si] = mat;
      });
      self.root.add(g);
      return g;
    });
    this._finishInit(cfg);
  }
  View3D.prototype._finishInit = function (cfg) {
    var self = this;
    // 自动旋转
    var ar = cfg.autoRotate || {};
    this.ar = { yaw: ar.swayYaw || 0.1, pitch: ar.swayPitch || 0.03, period: ar.period || 9, showMs: ar.showcaseMs || 2400, showDelay: ar.showcaseDelay || 0, axis: new T.Vector3().fromArray(ar.showcaseAxis || [0.5, 1, 0.2]).normalize() };
    this.autoRotate = true; this.mode = 'idle'; this.swayAmt = 0; this.showT0 = 0; this.onShowcaseEnd = null;

    this.curTok = null;
    this._bindDrag();
    this._resize();
    if (root.ResizeObserver) { this._ro = new ResizeObserver(function () { self._resize(); }); this._ro.observe(self.container); }
    else root.addEventListener('resize', function () { self._resize(); });
    this.dirty = true;
    var t0 = performance.now(), last = t0;
    var loop = function (now) {
      if (self.destroyed) return;
      now = now || performance.now();
      var dt = Math.min(0.1, (now - last) / 1000); last = now;
      if (self._tickAuto(now, dt)) self.dirty = true;
      if (self.dirty) { self.renderer.render(self.scene, self.camera); self.dirty = false; }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  };

  /**
   * 异形魔方（cfg.geometry === 'poly'）：每块的块体 = 实心凸多面体（谜题外形 ∩ 各切割平面的对应半空间），
   * 转动时整层绕轴旋转，切割面在自身平面内滑动，块体之间不会互相穿插；贴纸为内缩 + 圆角的多边形。
   * cfg.solid: [{n, c}] 外形半空间；cfg.cuts: [{n, c}] 切割平面；cfg.core: 是否补一个不动的中心块。
   */
  View3D.prototype._buildPoly = function (P, cfg) {
    var self = this;
    this.scene.add(new T.AmbientLight(0xffffff, 1.6));
    var dl = new T.DirectionalLight(0xffffff, 1.1); dl.position.set(3, 8, 5); this.scene.add(dl);
    var dl2 = new T.DirectionalLight(0xffffff, 0.45); dl2.position.set(-5, -2, 2); this.scene.add(dl2);
    var bodyMat = new T.MeshLambertMaterial({ color: cfg.bodyColor || 0x1b1b1d });
    function regionFor(pos) {
      var H = cfg.solid.slice();
      cfg.cuts.forEach(function (h) {
        var d = h.n[0] * pos[0] + h.n[1] * pos[1] + h.n[2] * pos[2] - h.c;
        H.push(d > 0 ? { n: h.n.map(function (x) { return -x; }), c: -h.c } : h);
      });
      return H;
    }
    if (cfg.core) this.root.add(new T.Mesh(polytope(regionFor(cfg.core)), bodyMat));
    this.stickerMats = []; this.pickables = [];
    var margin = cfg.stickerMargin || 0.06, radius = cfg.stickerRadius || 0.08;
    this.pieceObjs = P.pieces.map(function (pc, pIdx) {
      var g = new T.Group();
      var body = new T.Mesh(polytope(regionFor(pc.pos)), bodyMat); body.userData.pi = pIdx; g.add(body); self.pickables.push(body);
      pc.stickers.forEach(function (si) {
        var s = P.stickers[si], mat = new T.MeshBasicMaterial({ color: 0xcccccc, side: T.DoubleSide });
        var off = s.normal.map(function (x) { return x * 0.004; });
        var sm = new T.Mesh(stickerGeom(s.poly.map(function (p) { return [p[0] + off[0], p[1] + off[1], p[2] + off[2]]; }), s.normal, margin, radius), mat);
        sm.userData.si = si; g.add(sm); self.pickables.push(sm); self.stickerMats[si] = mat;
      });
      self.root.add(g);
      return g;
    });
  };

  /** 自动旋转：播放时轻微摆动（平滑淡入淡出）；展示模式为一整圈翻转 */
  View3D.prototype._tickAuto = function (now, dt) {
    var a = this.ar, q = new T.Quaternion();
    if (this.mode === 'showcase') {
      if (now < this.showT0) { this.spin.quaternion.identity(); return true; }   // 参考视频：还原后先静止约 1.2 s
      if (!this._showStarted) { this._showStarted = true; if (this.onShowcaseStart) this.onShowcaseStart(a.showMs); }
      var t = Math.min(1, (now - this.showT0) / a.showMs);
      q.setFromAxisAngle(a.axis, Math.PI * 2 * easeInOut(t));
      this.spin.quaternion.copy(q);
      if (t >= 1) { this.mode = 'idle'; this.swayAmt = 0; this.spin.quaternion.identity(); if (this.onShowcaseEnd) this.onShowcaseEnd(); }
      return true;
    }
    var target = this.autoRotate && this.mode === 'play' ? 1 : 0;
    if (target === 0 && this.swayAmt === 0) return false;
    this.swayAmt += Math.sign(target - this.swayAmt) * Math.min(Math.abs(target - this.swayAmt), dt / 1.2);
    var ph = (now / 1000) * Math.PI * 2 / a.period, amt = easeInOut(this.swayAmt);
    var e = new T.Euler(a.pitch * Math.sin(ph * 0.7) * amt, a.yaw * Math.sin(ph) * amt, 0, 'YXZ');
    this.spin.quaternion.setFromEuler(e);
    return true;
  };
  View3D.prototype.setPlaying = function (on) { if (this.mode !== 'showcase') this.mode = on ? 'play' : 'idle'; };
  View3D.prototype.setAutoRotate = function (on) { this.autoRotate = !!on; if (!on && this.mode === 'showcase') { this.mode = 'idle'; this.spin.quaternion.identity(); this.dirty = true; } };
  View3D.prototype.showcase = function (delay) {
    if (!this.autoRotate) return false;
    this.mode = 'showcase'; this._showStarted = false; this.showT0 = performance.now() + (delay == null ? this.ar.showDelay : delay); return true;
  };
  /** 切换握法（整体朝向，欧拉角） */
  View3D.prototype.setOrientation = function (o) { this.root.rotation.set(o[0], o[1], o[2]); this.dirty = true; };

  View3D.prototype._resize = function () {
    var w = this.container.clientWidth || 300, h = this.container.clientHeight || w;
    this.renderer.setSize(w, h, false);
    var a = w / h, fr = this.cfg.frame || { width: 0.8, height: 0.8 };
    // 魔方投影尺寸（近似）：宽 ≈ 3√2，高 ≈ 3·(1+sinφ)
    var cubeW = 4.3, cubeH = 3 * (1 + Math.abs(this.viewDir.y)) + 0.4;
    if (this.cfg.fit) { cubeW = this.cfg.fit[0]; cubeH = this.cfg.fit[1]; }
    var needW = cubeW / fr.width, needH = cubeH / fr.height;   // 视口在原点处需要覆盖的宽 / 高
    if (this.persp) {
      var th = Math.tan(this.camera.fov * Math.PI / 360);
      var dist = Math.max(needW / (2 * th * a), needH / (2 * th));
      this.camera.aspect = a;
      this.camera.position.copy(this.viewDir.clone().multiplyScalar(dist));
      this.camera.lookAt(0, 0, 0);
    } else {
      var hh = Math.max(needH, needW / a) / 2;
      this.camera.left = -hh * a; this.camera.right = hh * a; this.camera.top = hh; this.camera.bottom = -hh;
    }
    // 画面偏移（取景微调）：正 dx 右移、正 dy 下移，单位为面板宽 / 高的比例
    if (fr.dx || fr.dy) this.camera.setViewOffset(w, h, -(fr.dx || 0) * w, -(fr.dy || 0) * h, w, h);
    this.camera.updateProjectionMatrix(); this.dirty = true;
  };
  /**
   * 拖动：「自己玩」模式下按在贴纸上 = 转动该层（由拖动方向推断面 / 层 / 方向），按在空白处 = 旋转视角；
   * 其它模式始终旋转视角。触摸同样适用（play 模式下 touch-action: none，不会滚动页面）。
   */
  View3D.prototype._bindDrag = function () {
    var self = this, el = this.renderer.domElement, last = null, gest = null;
    el.style.touchAction = 'pan-y';
    el.addEventListener('pointerdown', function (e) {
      if (e.button != null && e.button > 0) return;
      last = [e.clientX, e.clientY]; gest = null;
      if (self.playOn) { var si = self.pick(e.clientX, e.clientY); if (si != null) gest = { si: si, x0: e.clientX, y0: e.clientY, done: false }; }
      try { el.setPointerCapture(e.pointerId); } catch (er) {}
      el.classList.add(gest ? 'turning' : 'dragging');
      if (self.playOn) e.preventDefault();
    });
    el.addEventListener('pointermove', function (e) {
      if (!last) return;
      if (gest) {
        if (gest.done) return;
        var gx = e.clientX - gest.x0, gy = e.clientY - gest.y0, th = e.pointerType === 'touch' ? 14 : 9;
        if (Math.hypot(gx, gy) < th) return;
        gest.done = true;
        var tok = self.dragTurn(gest.si, gx, gy);
        if (tok && self.onTurn) self.onTurn(tok, { si: gest.si, pointer: e.pointerType });
        return;
      }
      var dx = e.clientX - last[0], dy = e.clientY - last[1]; last = [e.clientX, e.clientY];
      var q = new T.Quaternion();
      q.setFromAxisAngle(new T.Vector3(0, 1, 0), dx * 0.01); self.user.quaternion.premultiply(q);
      var right = new T.Vector3().crossVectors(self.camera.up, self.viewDir).normalize();
      q.setFromAxisAngle(right, -dy * 0.01); self.user.quaternion.premultiply(q);
      self.dirty = true;
    });
    var end = function () { last = null; gest = null; el.classList.remove('dragging'); el.classList.remove('turning'); };
    el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
    el.addEventListener('dblclick', function () { self.resetView(); });
  };
  /** 「自己玩」模式开关：onTurn(tok) 在拖动贴纸时被调用 */
  View3D.prototype.setPlayMode = function (on, onTurn) {
    this.playOn = !!on; this.onTurn = onTurn || null;
    this.renderer.domElement.style.touchAction = on ? 'none' : 'pan-y';
    this.renderer.domElement.classList.toggle('play', !!on);
  };
  /** 屏幕坐标 → 贴纸序号（先命中块体时用命中面的法线找该块在这一侧的贴纸） */
  View3D.prototype.pick = function (cx, cy) {
    var el = this.renderer.domElement, r = el.getBoundingClientRect();
    var ndc = new T.Vector2((cx - r.left) / r.width * 2 - 1, -(cy - r.top) / r.height * 2 + 1);
    this.scene.updateMatrixWorld(true);
    var rc = this._rc || (this._rc = new T.Raycaster());
    rc.setFromCamera(ndc, this.camera);
    var hits = rc.intersectObjects(this.pickables, false);
    for (var i = 0; i < hits.length; i++) {
      var h = hits[i], u = h.object.userData;
      if (u.si != null) return u.si;
      if (u.pi != null && h.face) {
        var nW = h.face.normal.clone().transformDirection(h.object.matrixWorld);
        var qi = new T.Quaternion(); this.root.getWorldQuaternion(qi); qi.invert();
        var nL = nW.applyQuaternion(qi), arr = [nL.x, nL.y, nL.z];
        var P = this.P, pc = P.pieces[u.pi], bestSi = null, bd = 0.7;
        pc.stickers.forEach(function (si) { var n = P.stickers[si].normal, d = n[0] * arr[0] + n[1] * arr[1] + n[2] * arr[2]; if (d > bd) { bd = d; bestSi = si; } });
        return bestSi;
      }
    }
    return null;
  };
  /** 谜题坐标中的点 → 屏幕（client）坐标 */
  View3D.prototype.toScreen = function (p) {
    var el = this.renderer.domElement, r = el.getBoundingClientRect();
    this.scene.updateMatrixWorld(true);
    var v = this.root.localToWorld(new T.Vector3(p[0], p[1], p[2])).project(this.camera);
    return [r.left + (v.x + 1) / 2 * r.width, r.top + (1 - v.y) / 2 * r.height];
  };
  View3D.prototype.stickerScreen = function (si) { return this.toScreen(CL.stickerPoint(this.P.stickers[si])); };
  /** 从贴纸 si 出发的屏幕拖动 (dx, dy) → 转动记号：取投影后与拖动方向最一致的面内坐标轴 */
  View3D.prototype.dragTurn = function (si, dx, dy) {
    var PL = CL.play, P = this.P, s = P.stickers[si], p0 = CL.stickerPoint(s), a = this.toScreen(p0), L = Math.hypot(dx, dy) || 1;
    var best = null, bs = 0;
    if (P.dragMoves) return this._dragTurnGeneric(si, p0, a, dx / L, dy / L);
    PL.inPlaneAxes(P, si).forEach(function (e) {
      var b = this.toScreen([p0[0] + e[0] * 0.5, p0[1] + e[1] * 0.5, p0[2] + e[2] * 0.5]), vx = b[0] - a[0], vy = b[1] - a[1], vl = Math.hypot(vx, vy) || 1;
      var sc = (vx * dx + vy * dy) / (vl * L);
      if (Math.abs(sc) > Math.abs(bs)) { bs = sc; best = e; }
    }, this);
    if (!best || Math.abs(bs) < 0.35) return null;
    var d = best.map(function (x) { return x * Math.sign(bs); });
    return PL.turnFor(P, si, d);
  };
  /**
   * 通用拖动（异形魔方）：对每个包含该贴纸的转动，计算贴纸点的瞬时速度 ω×p 在屏幕上的方向，
   * 取与拖动方向最一致者；方向接近时取块数少的转动（金字塔：拖顶角 = 只转顶角 u）。
   */
  View3D.prototype._dragTurnGeneric = function (si, p0, a, ux, uy) {
    var P = this.P, pi = this._stickerPiece || (this._stickerPiece = (function () { var m = []; P.pieces.forEach(function (pc, i) { pc.stickers.forEach(function (x) { m[x] = i; }); }); return m; })());
    var cands = [], self = this;
    P.dragMoves.forEach(function (tok) {
      var m = P.moves[tok]; if (m.pieces.indexOf(pi[si]) < 0) return;
      var ax = CL.vec.norm(m.axis), w = CL.vec.cross(ax, p0), k = Math.sign(m.angle) * 0.4;
      var b = self.toScreen([p0[0] + w[0] * k, p0[1] + w[1] * k, p0[2] + w[2] * k]), vx = b[0] - a[0], vy = b[1] - a[1], vl = Math.hypot(vx, vy);
      if (vl < 1e-3) return;
      cands.push({ tok: tok, sc: (vx * ux + vy * uy) / vl, n: m.pieces.length });
    });
    if (!cands.length) return null;
    var top = Math.max.apply(null, cands.map(function (c) { return c.sc; }));
    if (top < 0.35) return null;
    // 最一致的转动；若有块数更少、方向几乎相同的转动（同轴：顶角 vs 两层），取块数少的
    cands.sort(function (x, y) { return y.sc - x.sc; });
    var best = cands[0];
    cands.forEach(function (c) { if (c.n < best.n && c.sc > top - 0.12) best = c; });
    return best.tok;
  };
  View3D.prototype.resetView = function () { this.user.quaternion.identity(); this.dirty = true; };
  View3D.prototype._restore = function () {
    var self = this;
    this.pivot.children.slice().forEach(function (c) { self.root.attach(c); });
    this.pivot.quaternion.identity();
    this.pieceObjs.forEach(function (g, i) { g.position.fromArray(self.home[i]); g.quaternion.identity(); });
  };
  View3D.prototype.setState = function (state) {
    var P = this.P;
    this._restore(); this.curTok = null;
    var over = (P.view3d && P.view3d.stickerColors) || {};
    this.stickerMats.forEach(function (m, i) { var c = state[i]; m.color.set(c && over[c] ? over[c] : c && P.colors[c] ? P.colors[c].hex : P.blankColor); });
    this.dirty = true;
  };
  View3D.prototype.animate = function (tok, e, fromState) {
    var m = this.P.moves[tok], self = this;
    if (this.curTok !== tok) {
      this.setState(fromState); this.curTok = tok;
      m.pieces.forEach(function (pi) { self.pivot.attach(self.pieceObjs[pi]); });
    }
    this.pivot.quaternion.setFromAxisAngle(new T.Vector3().fromArray(m.axis).normalize(), m.angle * e);
    this.dirty = true;
  };
  /** 切换谜题时释放 WebGL 资源 */
  View3D.prototype.destroy = function () {
    this.destroyed = true;
    if (this._ro) this._ro.disconnect();
    this.scene.traverse(function (o) { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
    this.renderer.dispose(); if (this.renderer.forceContextLoss) this.renderer.forceContextLoss();
    var c = this.renderer.domElement; if (c.parentNode) c.parentNode.removeChild(c);
  };
  View3D.prototype.snapshot = function () { this.renderer.render(this.scene, this.camera); return this.renderer.domElement.toDataURL('image/png'); };
  CL.View3D = View3D;
})(window);
