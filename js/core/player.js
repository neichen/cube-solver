/*
 * 播放器：管理时间线（初始状态 + 转动序列），驱动所有视图同步动画。
 * 视图需实现 setState(state) 和 animate(tok, e, fromState)；可选 highlight(tok, state)。
 */
(function (root) {
  'use strict';
  var CL = root.CubeLab;
  // 缓动：easeInOutQuad —— 对参考视频逐帧测得的速度曲线拟合最好（RMS 0.076，优于 sine 0.155 / cubic 0.193）
  function ease(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }
  CL.ease = ease;
  /**
   * 连续播放的节奏（实测参考视频 60fps）：15 步中首步 0.85 s、中段 0.48 s、末步 1.0 s，
   * 两步之间几乎无停顿（≈0.07 s）——整段像一次「慢起-加速-慢收」。
   * k(i) = 1 + A·(1 − sin(π·(i+0.5)/n))，中段时长 baseMs。
   */
  CL.tempo = function (i, n, A) { if (n < 3) return 1.15; A = A == null ? 0.9 : A; return 1 + A * (1 - Math.sin(Math.PI * (i + 0.5) / n)); };

  function Player(P, views) {
    this.P = P; this.views = views; this.listeners = [];
    this.speed = 1; this.baseMs = 480; this.gapMs = 67; this.stepFactor = 1.15; this.tempoCurve = true; this.playing = false; this.busy = false;
    this.load({ start: P.solvedState(), moves: [] });
  }
  Player.prototype.on = function (fn) { this.listeners.push(fn); };
  /** 转动事件钩子（声音等）：fn(phase 'start'|'end', tok, durMs) */
  Player.prototype.onMove = function (fn) { (this.moveHooks = this.moveHooks || []).push(fn); };
  Player.prototype._hook = function (phase, tok, dur) { (this.moveHooks || []).forEach(function (f) { try { f(phase, tok, dur); } catch (e) {} }); };
  Player.prototype._emit = function () { var self = this; this.listeners.forEach(function (f) { f(self); }); };
  /** timeline: { start, moves:[tok], phases?:['scramble'|'solve'...], label? } */
  Player.prototype.load = function (tl) {
    this.cancel();
    var P = this.P;
    this.tl = tl; this.states = [tl.start.slice()];
    tl.moves.forEach(function (t, i) { this.states.push(CL.applyPerm(this.states[i], P.moves[t].perm)); }, this);
    this.index = 0;
    this._show(0);
    this._emit();
  };
  Player.prototype.length = function () { return this.tl.moves.length; };
  Player.prototype._show = function (k, hlTok) {
    var s = this.states[k];
    this.views.forEach(function (v) { v.setState(s); if (v.highlight) v.highlight(hlTok || null, s, true); });
  };
  Player.prototype.cancel = function () { if (this.busy) this._hook('cancel', null, 0); this.playing = false; this._token = (this._token || 0) + 1; this.busy = false; };
  /** 第 k 步时长：连续播放用参考节奏曲线，单步用固定时长 */
  Player.prototype.duration = function (k, continuous) {
    var f = continuous && this.tempoCurve ? CL.tempo(k, this.length()) : this.stepFactor;
    return this.baseMs * f / this.speed;
  };
  Player.prototype._animate = function (tok, from, to, dur) {
    var self = this, my = this._token;
    dur = dur || this.duration(0, false);
    this.busy = true;
    this._hook('start', tok, dur);
    return new Promise(function (resolve) {
      var t0 = performance.now();
      function frame(now) {
        if (my !== self._token) return resolve(false);
        var t = Math.min(1, (now - t0) / dur), e = ease(t);
        self.views.forEach(function (v) { v.animate(tok, e, from, t); });
        if (t < 1) requestAnimationFrame(frame);
        else { self.views.forEach(function (v) { v.setState(to); if (v.highlight) v.highlight(tok, to, true); }); self.busy = false; self._hook('end', tok, dur); resolve(true); }
      }
      requestAnimationFrame(frame);
    });
  };
  Player.prototype.next = function () {
    if (this.busy || this.index >= this.length()) return Promise.resolve(false);
    var k = this.index, tok = this.tl.moves[k], self = this;
    this.index = k + 1; this._emit();
    return this._animate(tok, this.states[k], this.states[k + 1], this.duration(k, this.playing));
  };
  Player.prototype.prev = function () {
    if (this.busy || this.index <= 0) return Promise.resolve(false);
    var k = this.index, tok = this.P.moves[this.tl.moves[k - 1]].inverse;
    this.index = k - 1; this._emit();
    return this._animate(tok, this.states[k], this.states[k - 1]);
  };
  Player.prototype.seek = function (k) {
    this.cancel();
    this.index = Math.max(0, Math.min(this.length(), k));
    this._show(this.index, this.index > 0 ? this.tl.moves[this.index - 1] : null);
    this._emit();
  };
  /** 单步时长低于这个值（毫秒）时进入「快进」：每帧直接跳过若干步，不做补间动画（1000+ 步的高阶解法） */
  Player.prototype.turboMs = 34;
  Player.prototype.play = function () {
    var self = this;
    if (this.playing) return;
    if (this.index >= this.length()) this.seek(0);
    this.playing = true; this._emit();
    var my = this._token;
    (function step() {
      if (!self.playing || my !== self._token) return;
      if (self.index >= self.length()) { self.playing = false; self._emit(); return; }
      if (self.busy) { setTimeout(step, 40); return; }   // 等待进行中的单步动画结束
      if (self.duration(self.index, true) < self.turboMs) return self._turbo(my);
      self.next().then(function (ok) {
        if (!ok) return;
        setTimeout(step, self.gapMs / self.speed);
      });
    })();
  };
  Player.prototype._turbo = function (my) {
    var self = this, last = performance.now(), acc = 0, lastSound = 0;
    function frame(now) {
      if (!self.playing || my !== self._token) return;
      var dt = Math.min(100, now - last); last = now;
      acc += dt;
      var per = self.duration(self.index, true) + self.gapMs / self.speed, k = 0;
      while (acc >= per && self.index + k < self.length()) { acc -= per; k++; }
      if (k) {
        self.index = Math.min(self.length(), self.index + k);
        var tok = self.tl.moves[self.index - 1];
        self._show(self.index, tok);
        if (now - lastSound > 90) { lastSound = now; self._hook('start', tok, 40); }
        self._emit();
      }
      if (self.index >= self.length()) { self.playing = false; self._hook('end', tok, 0); self._emit(); return; }
      if (self.duration(self.index, true) >= self.turboMs) { self.playing = false; return self.play(); }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  };
  Player.prototype.pause = function () { this.playing = false; this._emit(); };
  Player.prototype.toggle = function () { this.playing ? this.pause() : this.play(); };
  Player.prototype.state = function () { return this.states[this.index]; };
  // ---------------------------------------------------------------- 「自己玩」：实时追加转动（排队动画，可快速连续输入）
  /** 在时间线末尾追加一步并排队播放；积压越多动画越快（不丢步） */
  Player.prototype.pushMove = function (tok, dur) {
    var P = this.P; this.playing = false;
    if (!this.tl.phases) this.tl.phases = this.tl.moves.map(function () { return 'play'; });
    this.tl.moves.push(tok); this.tl.phases.push('play');
    this.states.push(CL.applyPerm(this.states[this.states.length - 1], P.moves[tok].perm));
    this.liveMs = dur || this.liveMs || 170;
    this._emit(); this._pump();
  };
  Player.prototype._pump = function () {
    var self = this;
    if (this.busy || this.index >= this.length()) return;
    var k = this.index, tok = this.tl.moves[k], back = this.length() - k - 1;
    var dur = this.liveMs * (back >= 3 ? 0.35 : back >= 1 ? 0.6 : 1);
    this.index = k + 1; this._emit();
    this._animate(tok, this.states[k], this.states[k + 1], dur).then(function (ok) { if (ok) self._pump(); });
  };
  /** 撤销最后一步：已播放的反向动画，尚在队列中的直接丢弃。返回被撤销的记号 */
  Player.prototype.popMove = function (dur) {
    var n = this.length(); if (!n) return null;
    var tok = this.tl.moves.pop(); if (this.tl.phases) this.tl.phases.pop();
    if (this.index < n) { this.states.pop(); this._emit(); return tok; }   // 还没开始播放
    if (this.busy) { this.cancel(); this.states.pop(); this.index = this.length(); this._show(this.index); this._emit(); return tok; }
    var from = this.states.pop(); this.index = this.length(); this._emit();
    var self = this;
    this._animate(this.P.moves[tok].inverse, from, this.states[this.index], dur || this.liveMs || 170).then(function (ok) { if (ok) self._pump(); });
    return tok;
  };
  /** 等待队列播放完毕 */
  Player.prototype.idle = function () { var self = this; return new Promise(function (r) { (function w() { if (!self.busy && self.index >= self.length()) r(); else setTimeout(w, 20); })(); }); };
  CL.Player = Player;
})(window);
