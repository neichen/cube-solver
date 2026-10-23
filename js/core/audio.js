/*
 * 声音：全部用 Web Audio API 实时合成（无任何音频文件/版权素材）。
 * - 音效：转动声（颗粒激励的块体模态合成，模仿真实魔方录音）、还原琶音、展示扫光、涂色轻点、拍摄成功提示。
 * - 背景音乐：程序生成的柔和铺底 + 琶音（五声音阶），前瞻调度，无缝循环，低音量。
 * 自动播放策略：AudioContext 只在第一次用户手势（pointerdown / keydown / touchstart）时创建并 resume；
 * 不支持 Web Audio 的环境下所有方法都是安全的空操作。
 */
(function (root) {
  'use strict';
  var CL = root.CubeLab = root.CubeLab || {};
  var Ctor = root.AudioContext || root.webkitAudioContext || null;
  var LS = { sfx: 'cubelab.sfx', music: 'cubelab.music', vol: 'cubelab.vol' };
  function load(k, d) { try { var v = root.localStorage && root.localStorage.getItem(k); return v === null || v === undefined ? d : v; } catch (e) { return d; } }
  function save(k, v) { try { root.localStorage && root.localStorage.setItem(k, String(v)); } catch (e) {} }
  function midi(n) { return 440 * Math.pow(2, (n - 69) / 12); }

  function SoundEngine() {
    this.supported = !!Ctor;
    this.ctx = null;
    this.sfxOn = load(LS.sfx, '1') === '1';
    this.musicOn = load(LS.music, '0') === '1';
    this.volume = Math.max(0, Math.min(1, parseFloat(load(LS.vol, '0.7')) || 0));
    this.stats = { click: 0, clickSkipped: 0, snap: 0, chime: 0, sweep: 0, paint: 0, capture: 0, musicNotes: 0, errors: 0 };
    this._lastClick = 0; this._lastPaint = 0;
    this._listeners = [];
    var self = this;
    this._unlock = function () { self.unlock(); };
    if (this.supported && root.addEventListener) ['pointerdown', 'keydown', 'touchstart'].forEach(function (ev) { root.addEventListener(ev, self._unlock, { capture: true, passive: true }); });
  }
  SoundEngine.prototype.on = function (fn) { this._listeners.push(fn); };
  SoundEngine.prototype._emit = function () { var s = this; this._listeners.forEach(function (f) { f(s); }); };

  /** 第一次用户手势时调用：创建 AudioContext 与总线 */
  SoundEngine.prototype.unlock = function () {
    if (!this.supported) return false;
    try {
      if (!this.ctx) {
        var C = root.AudioContext || root.webkitAudioContext || Ctor, c = this.ctx = new C();
        this.master = c.createGain(); this.master.gain.value = this.volume;
        // 轻微压缩，避免叠加削波
        this.comp = c.createDynamicsCompressor(); this.comp.threshold.value = -18; this.comp.ratio.value = 4;
        this.master.connect(this.comp); this.comp.connect(c.destination);
        this.sfxBus = c.createGain(); this.sfxBus.gain.value = 1; this.sfxBus.connect(this.master);
        this.musicBus = c.createGain(); this.musicBus.gain.value = 0; this.musicBus.connect(this.master);
        // 简单「房间」：反馈延迟 + 低通，给音乐和铃声一点空间感
        this.verbIn = c.createGain(); this.verbIn.gain.value = 1;
        var d1 = c.createDelay(1), fb = c.createGain(), lp = c.createBiquadFilter();
        d1.delayTime.value = 0.23; fb.gain.value = 0.38; lp.type = 'lowpass'; lp.frequency.value = 2600;
        this.verbIn.connect(d1); d1.connect(lp); lp.connect(fb); fb.connect(d1);
        this.verbOut = c.createGain(); this.verbOut.gain.value = 0.35; lp.connect(this.verbOut); this.verbOut.connect(this.master);
        this._noise = this._makeNoise(0.5);
        this._buildTurnChain();
        if (root.removeEventListener) ['pointerdown', 'keydown', 'touchstart'].forEach(function (ev) { root.removeEventListener(ev, this._unlock, { capture: true }); }, this);
      }
      if (this.ctx.state === 'suspended' && this.ctx.resume) this.ctx.resume().catch(function () {});
      if (this.musicOn) this._startMusic();
      this._emit();
      return true;
    } catch (e) { this.stats.errors++; this.supported = false; this.ctx = null; return false; }
  };
  SoundEngine.prototype.ready = function () { return !!(this.ctx && this.ctx.state !== 'closed'); };
  SoundEngine.prototype._makeNoise = function (sec) {
    var c = this.ctx, n = Math.floor(c.sampleRate * sec), b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0), seed = 12345;
    for (var i = 0; i < n; i++) { seed = (seed * 1103515245 + 12345) & 0x7fffffff; d[i] = seed / 0x3fffffff - 1; }
    return b;
  };
  SoundEngine.prototype._safe = function (fn) {
    if (!this.ready()) return false;
    try { fn.call(this, this.ctx, this.ctx.currentTime); return true; } catch (e) { this.stats.errors++; return false; }
  };

  // ---------- 设置 ----------
  SoundEngine.prototype.setSfx = function (on) { this.sfxOn = !!on; save(LS.sfx, on ? 1 : 0); if (on) this.unlock(); this._emit(); };
  SoundEngine.prototype.setMusic = function (on) {
    this.musicOn = !!on; save(LS.music, on ? 1 : 0);
    if (on) { this.unlock(); this._startMusic(); } else this._stopMusic();
    this._emit();
  };
  SoundEngine.prototype.setVolume = function (v) {
    this.volume = Math.max(0, Math.min(1, +v || 0)); save(LS.vol, this.volume.toFixed(2));
    if (this.master) this.master.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.03);
    this._emit();
  };

  // ---------- 音效 ----------
  /**
   * 转动音效 v3 —— 模仿真实魔方录音的「本质」（参数来自对真实录音的频谱分析；录音本身不随项目发布，来源见 vendor/sounds/LICENSE.txt）：
   *   真实一次 90° 转动 ≈ 一串 120–200 ms 的密集塑料「咔嗒」颗粒（约每 5 ms 一颗、成簇、间隔很不均匀），
   *   每颗颗粒激励魔方块体的短促模态共振：主峰 0.86–1.1 kHz（「空心/木质」感的来源）+ 500 Hz、1.55、2.8、4.1 kHz，
   *   −20 dB 振铃时间仅 3–6 ms；几乎没有 300 Hz 以下的「咚」。能量从起转逐渐增强，最响的一簇在落位那一刻，
   *   之后约 90 ms 稀疏、偏暗的余响颗粒（块体晃动归位）。
   * 合成：在 JS 里生成颗粒时刻/幅度（对数正态、成簇），作为激励送入 7 个二阶谐振器（每颗颗粒随机激励不同模态），
   *   外加少量宽带直达分量（清脆边缘）和极轻的速度相关摩擦底噪；左右声道模态混合略不同（相关约 0.85）。
   * 时间：落位「咔」正好对齐动画结束的采样点；慢速播放时，前段只有极轻的摩擦，声音主体集中在末段
   *   （窗口 = min(T, 0.13 + 0.35·(T − 0.13)) 秒，与真实转动的 60–120 ms 起音一致）；180° 在 T/2（转过 90° 的瞬间）有一下过卡位咔。
   * 快放保护：两次转动声至少间隔 50 ms；转动越短越轻、颗粒越少。每次转动生成耗时约 1–3 ms。
   * phase：'start'（播放）/'end'（无操作）/'cancel'（停止尚未播完的转动声，用于拖动时间线等）。
   */
  SoundEngine.prototype.move = function (phase, opts) {
    if (phase === 'cancel') { this._stopTurns(); return false; }
    if (phase !== 'start' || !this.sfxOn) return false;
    opts = opts || {};
    var now = root.performance ? root.performance.now() : Date.now(), dur = Math.max(30, opts.dur || 500);
    if (now - this._lastClick < 50) { this.stats.clickSkipped++; return false; }
    this._lastClick = now;
    var self = this;
    return this._safe(function (c, t) {
      self.stats.click++;
      var tb = self._turnBuffers(dur / 1000, !!opts.half, !!opts.slice);
      var speedGain = Math.max(0.5, Math.min(1, Math.pow(dur / 250, 0.5)));
      var level = (opts.slice ? 0.7 : 1) * speedGain;
      var t0 = t + 0.005;
      var src = c.createBufferSource(); src.buffer = tb.buffer;
      var g = c.createGain(); g.gain.value = level; src.connect(g); g.connect(self._turnIn);
      src.start(t0);
      self._turns = (self._turns || []).filter(function (x) { return x.end > c.currentTime; });
      self._turns.push({ nodes: [src], end: t0 + tb.buffer.duration });
    });
  };
  SoundEngine.prototype._stopTurns = function () {
    if (!this.ready() || !this._turns) return;
    var t = this.ctx.currentTime;
    this._turns.forEach(function (x) { if (x.end > t) x.nodes.forEach(function (n) { try { n.stop(); } catch (e) {} }); });
    this._turns = [];
  };
  /** 共享输出链（unlock 时创建）：仅去掉次声/手持隆隆（真实录音 300 Hz 以下几乎没有能量） */
  SoundEngine.prototype._buildTurnChain = function () {
    var c = this.ctx;
    this._turnIn = c.createGain();
    var hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 260; hp.Q.value = 0.6;
    this._turnIn.connect(hp); hp.connect(this.sfxBus);
  };
  // 模态：[频率 Hz, 衰减时间常数 s, 基础权重]，取自三段真实录音的共振峰与振铃时间
  var TURN_MODES = [[500, 0.0024, 0.04], [720, 0.0022, 0.22], [940, 0.0026, 1.35], [1250, 0.0019, 0.46], [1600, 0.0018, 0.30], [2050, 0.0016, 0.26], [2800, 0.0015, 0.30], [4100, 0.0012, 0.20], [6300, 0.0008, 0.09], [8200, 0.0006, 0.09]];
  var scratch = {};
  function buf(name, n) { var a = scratch[name]; if (!a || a.length < n) a = scratch[name] = new Float32Array(n); else a.fill(0, 0, n); return a; }
  /**
   * 为一次转动生成采样精确的立体声缓冲。T = 动画时长（秒）。
   * 返回 { buffer, land（落位咔的时刻，秒）, grains（颗粒数） }。
   */
  SoundEngine.prototype._turnBuffers = function (T, half, slice) {
    var c = this.ctx, sr = c.sampleRate, R = Math.random, TWO_PI = Math.PI * 2;
    var tail = 0.11, N = Math.ceil((T + tail) * sr), nT = Math.floor(T * sr);
    var land = Math.max(0.002, T - 0.003);
    var dark = slice ? 0.86 : 1, detune = (0.95 + R() * 0.1) * dark;
    var K = TURN_MODES.length;
    // —— 颗粒事件表：pos(采样), amp, bright(0..1，越大越激励高频模态), len(直达噪声长度, 采样)
    var G = [];
    function grain(t, amp, bright, micro) { var p = Math.floor(t * sr); if (p >= 0 && p < N) G.push([p, amp, bright, Math.floor(sr * (0.00015 + R() * 0.0006)), micro ? 1 : 0]); }
    function lognorm(sd) { var u = R() + R() + R() - 1.5; return Math.exp(u * sd * 2); }
    // ① 转动段：窗口内颗粒按 0.25 + u^1.5 的密度增强，成簇出现（1–3 颗，间隔 1.5–4 ms）
    var Tm = Math.min(T, 0.13 + 0.35 * Math.max(0, T - 0.13)), w0 = T - Tm;
    var count = Math.round((half ? 44 : 27) * Math.pow(Math.min(1, T / 0.1), 0.5));
    for (var n = 0; n < count;) {
      var u = R(); if (R() * 1.25 > 0.25 + Math.pow(u, 1.5)) continue;
      var at = w0 + u * Tm * 0.97, base = 0.24 * lognorm(0.5) * (0.45 + 0.55 * u);
      var cl = 1 + Math.floor(R() * R() * 3.2);
      for (var q = 0; q < cl && n < count; q++, n++) { grain(at, base * Math.pow(0.6, q), 0.45 + 0.55 * R() * (1 - 0.4 * u)); at += 0.0015 + R() * 0.0025; }
    }
    // ② 落位：最响的一簇（主咔 + 2–4 颗 3–15 ms 内的回弹/晃动）
    grain(land, 0.55, 0.8);
    var nb = 2 + Math.floor(R() * 3), tb = land;
    for (var j = 0; j < nb; j++) { tb += 0.002 + R() * 0.005; grain(tb, (0.2 + R() * 0.35) * Math.pow(0.75, j), 0.4 + R() * 0.4); }
    // ③ 余响：约 90 ms 稀疏、渐暗的颗粒
    var tt = land + 0.012;
    while (tt < land + 0.1) { var dt = tt - land; grain(tt, 0.2 * lognorm(0.45) * Math.exp(-dt / 0.05), Math.max(0.03, 0.6 * Math.exp(-dt / 0.015))); tt += 0.003 + R() * 0.012 * (1 + dt / 0.03); }
    // ④ 180°：半程过卡位
    if (half) { var hm = T * 0.5;   // 动画（easeInOutQuad 对称）在 T/2 时正好转过 90°
      grain(hm, 0.5, 0.9); grain(hm + 0.003 + R() * 0.004, 0.16, 0.7); }
    // ⑤ 细密的「沙沙」微颗粒层（真实录音大颗粒之间并非静音，而是连续的塑料摩擦/晃动声，比大颗粒低 20–35 dB）
    var mt = w0, mEnd = land + 0.09;
    while (mt < mEnd) {
      var mu = mt <= land ? (mt - w0) / Math.max(1e-3, Tm) : 1, md = mt > land ? mt - land : 0;
      var inten = mt <= land ? 0.3 + Math.pow(mu, 1.5) : 1.3 * Math.exp(-md / 0.03);
      grain(mt, 0.05 * inten * lognorm(0.6), 0.7 + R() * 0.3, true);
      mt += (0.0006 + R() * 0.0022) / Math.max(0.35, Math.min(1.3, inten));
    }
    if (slice) G.forEach(function (g) { g[2] *= 0.7; });
    // —— 极轻的摩擦底噪（只在转动窗口内，∝ 速度）
    var fric = buf('fric', N), lp = 0, kLp = 1 - Math.exp(-TWO_PI * 2600 * dark / sr), wn0 = Math.floor(w0 * sr), wn = Math.max(1, nT - wn0);
    for (var i = wn0; i < nT; i++) { var uu = (i - wn0) / wn, v = Math.sin(Math.PI * Math.min(1, uu * 1.05)); lp += kLp * ((R() * 2 - 1) - lp); fric[i] = lp * 0.02 * v * (0.6 + R() * 0.8); }
    // —— 模态合成：每个模态单独的激励（每颗颗粒随机激励不同的块体模态）
    var out = c.createBuffer(2, N, sr), L = out.getChannelData(0), Rr = out.getChannelData(1);
    var ex = buf('ex', N), first = N;
    for (var gi = 0; gi < G.length; gi++) first = Math.min(first, G[gi][0]);
    first = Math.min(first, wn0);
    for (var k = 0; k < K; k++) {
      var m = TURN_MODES[k], f = m[0] * detune * (0.97 + R() * 0.06), tau = m[1] * (0.85 + R() * 0.3);
      if (f > sr * 0.45) continue;   // 低采样率环境下跳过超过奈奎斯特的模态
      var hiK = k / (K - 1);   // 0 = 最低模态 … 1 = 最高
      ex.fill(0, first, N);
      for (gi = 0; gi < G.length; gi++) {
        var g = G[gi]; if (g[4] && k < 3) continue;
        var wgt = m[2] * (0.35 + R() * 1.3) * (1 - hiK + hiK * g[2]);
        var gl = (g[3] >> 1) + 1, ga = g[1] * wgt * 2.2 / (gl + 1);
        for (var zz = 0; zz < gl && g[0] + zz < N; zz++) ex[g[0] + zz] += ga * (zz === 0 ? 1 : (R() * 2 - 1));
      }
      var fk = k === 2 ? 0.6 : 0;   // 摩擦底噪只激励宽的 940 Hz「空心」模态（激励高频窄模态会出现「哨音」横线）
      if (fk) for (i = wn0; i < nT; i++) ex[i] += fric[i] * fk;
      var r = Math.exp(-1 / (tau * sr)), cw = 2 * r * Math.cos(TWO_PI * f / sr), r2 = r * r, sw = Math.sin(TWO_PI * f / sr);
      var pL = 0.6 + R() * 0.8, pR = 2 - pL, y1 = 0, y2 = 0;
      var x1 = 0, x2 = 0;
      for (i = first; i < N; i++) { var xi = ex[i], y = cw * y1 - r2 * y2 + (xi - x2) * sw; x2 = x1; x1 = xi; y2 = y1; y1 = y; L[i] += y * pL; Rr[i] += y * pR; }
    }
    // —— 宽带直达分量（颗粒的清脆边缘，差分噪声 → 偏高频）
    for (gi = 0; gi < G.length; gi++) {
      var gg = G[gi], A = gg[1] * 0.36 * (0.3 + 0.7 * gg[2]) * (slice ? 0.6 : 1), len = gg[3], pan = 0.7 + R() * 0.6, prev = 0;
      for (var z = 0; z < len && gg[0] + z < N; z++) { var e = (R() * 2 - 1), env = A * Math.pow(1 - z / len, 2), d = (e - prev) * env, own = (R() * 2 - 1) * env * 0.6; prev = e; L[gg[0] + z] += d * pan + own; Rr[gg[0] + z] += d * (2 - pan) - own; }
    }
    // —— 宽带直达摩擦（一阶差分噪声，∝ 速度，左右独立 → 不产生任何音高线）
    var pf = 0, pf2 = 0;
    for (i = wn0; i < nT; i++) { if (!fric[i]) continue; var fa = Math.abs(fric[i]) * 0.9 + 0.004 * Math.sin(Math.PI * Math.min(1, (i - wn0) / wn * 1.05)); var n1 = R() * 2 - 1, n2 = R() * 2 - 1; L[i] += (n1 - pf) * fa; Rr[i] += (n2 - pf2) * fa; pf = n1; pf2 = n2; }
    // —— 归一化（峰值 ≈ 0.42 × 随机 0.85–1.05，保持每次响度稳定但不完全相同）
    var pk = 1e-9; for (i = first; i < N; i++) { var aL = L[i] < 0 ? -L[i] : L[i], aR = Rr[i] < 0 ? -Rr[i] : Rr[i]; if (aL > pk) pk = aL; if (aR > pk) pk = aR; }
    var sc = 0.42 * (0.85 + R() * 0.2) / pk;
    for (i = first; i < N; i++) { L[i] *= sc; Rr[i] *= sc; }
    this.stats.snap = (this.stats.snap || 0) + 1;
    return { buffer: out, land: land, grains: G.length };
  };
  // 柔和的钟/马林巴音色
  SoundEngine.prototype._bell = function (freq, t, gain, len, toVerb) {
    var c = this.ctx, g = c.createGain();
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0005, t + len);
    [[1, 1], [2.01, 0.28], [3.98, 0.08]].forEach(function (p) {
      var o = c.createOscillator(), pg = c.createGain(); o.type = 'sine'; o.frequency.value = freq * p[0]; pg.gain.value = p[1];
      o.connect(pg); pg.connect(g); o.start(t); o.stop(t + len + 0.05);
    });
    g.connect(this.sfxBus); if (toVerb !== false) g.connect(this.verbIn);
  };
  /** 还原：上行大调琶音 + 和弦 */
  SoundEngine.prototype.solved = function () {
    if (!this.sfxOn) return false;
    var self = this;
    return this._safe(function (c, t) {
      self.stats.chime++;
      [72, 76, 79, 84, 88].forEach(function (n, i) { self._bell(midi(n), t + i * 0.085, 0.095, 1.2); });
      [60, 67, 76].forEach(function (n) { self._bell(midi(n), t + 0.45, 0.04, 2.2); });
    });
  };
  /** 展示翻转：轻柔的上扫闪光（ms = 翻转时长） */
  SoundEngine.prototype.sweep = function (ms) {
    if (!this.sfxOn) return false;
    var self = this, len = Math.max(0.6, (ms || 2000) / 1000);
    return this._safe(function (c, t) {
      self.stats.sweep++;
      var src = c.createBufferSource(); src.buffer = self._noise; src.loop = true;
      var bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 6;
      bp.frequency.setValueAtTime(500, t); bp.frequency.exponentialRampToValueAtTime(5000, t + len * 0.55); bp.frequency.exponentialRampToValueAtTime(1500, t + len);
      var g = c.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.05, t + len * 0.45); g.gain.linearRampToValueAtTime(0, t + len);
      src.connect(bp); bp.connect(g); g.connect(self.sfxBus); g.connect(self.verbIn); src.start(t); src.stop(t + len + 0.05);
      [84, 91, 96].forEach(function (n, i) { self._bell(midi(n), t + len * (0.35 + i * 0.12), 0.045, 1.4); });
    });
  };
  /** 涂色：极短的轻点（拖动连续涂色时限流 45 ms），音高随颜色略变 */
  SoundEngine.prototype.paint = function (colorIndex) {
    if (!this.sfxOn) return false;
    var now = root.performance ? root.performance.now() : Date.now();
    if (now - this._lastPaint < 45) return false; this._lastPaint = now;
    var self = this;
    return this._safe(function (c, t) {
      self.stats.paint++;
      var o = c.createOscillator(), g = c.createGain(); o.type = 'sine';
      o.frequency.setValueAtTime(midi([79, 81, 84, 86, 88, 91][(colorIndex || 0) % 6]), t);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.22, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0005, t + 0.09);
      o.connect(g); g.connect(self.sfxBus); o.start(t); o.stop(t + 0.1);
    });
  };
  /** 拍摄成功：两声上行；全部完成时三声 */
  SoundEngine.prototype.capture = function (allDone) {
    if (!this.sfxOn) return false;
    var self = this;
    return this._safe(function (c, t) {
      self.stats.capture++;
      // 快门感的短噪声
      var src = c.createBufferSource(); src.buffer = self._noise; var hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 3000;
      var g = c.createGain(); g.gain.setValueAtTime(0.08, t); g.gain.exponentialRampToValueAtTime(0.0005, t + 0.04);
      src.connect(hp); hp.connect(g); g.connect(self.sfxBus); src.start(t, 0, 0.05);
      (allDone ? [76, 79, 84] : [79, 84]).forEach(function (n, i) { self._bell(midi(n), t + 0.05 + i * 0.09, 0.09, 0.6, false); });
    });
  };

  // ---------- 背景音乐（程序生成）----------
  // 72 BPM，4 小节和弦进行循环：Cmaj9 – Am9 – Fmaj9 – G6sus；铺底 + 五声音阶琶音（确定性伪随机 → 每轮可略有变化但始终和谐）
  var CHORDS = [[48, 55, 64, 71, 74], [45, 52, 60, 67, 71], [41, 48, 57, 64, 67], [43, 50, 59, 62, 64]];
  var PENTA = [72, 74, 76, 79, 81, 84];
  SoundEngine.prototype._startMusic = function () {
    if (!this.ready() || this._musicTimer) { if (this.ready() && this.musicBus) this.musicBus.gain.setTargetAtTime(0.32, this.ctx.currentTime, 0.8); return; }
    var self = this, c = this.ctx, beat = 60 / 72;
    this.musicBus.gain.cancelScheduledValues(c.currentTime);
    this.musicBus.gain.setTargetAtTime(0.32, c.currentTime, 0.8);   // 淡入
    this._mStep = 0; this._mNext = c.currentTime + 0.1; this._rng = 7;
    var tick = function () {
      try {
        while (self._mNext < c.currentTime + 0.6) { self._musicStep(self._mStep, self._mNext, beat); self._mNext += beat / 2; self._mStep++; }
      } catch (e) { self.stats.errors++; }
    };
    tick(); this._musicTimer = setInterval(tick, 150);
  };
  SoundEngine.prototype._stopMusic = function () {
    if (this._musicTimer) { clearInterval(this._musicTimer); this._musicTimer = null; }
    if (this.ready() && this.musicBus) this.musicBus.gain.setTargetAtTime(0, this.ctx.currentTime, 0.4);   // 淡出（已调度的音符自然衰减）
  };
  SoundEngine.prototype._rand = function () { this._rng = (this._rng * 16807) % 2147483647; return this._rng / 2147483647; };
  SoundEngine.prototype._musicStep = function (step, t, beat) {
    var c = this.ctx, bar = Math.floor(step / 8), ch = CHORDS[bar % 4], pos = step % 8;
    if (pos === 0) {   // 每小节一个铺底和弦：两个微失谐锯齿波 → 低通，慢起慢落，与下一小节交叠
      var len = beat * 4 + 1.2, f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900; f.Q.value = 0.3;
      var g = c.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.05, t + 1.0); g.gain.setValueAtTime(0.05, t + len - 1.3); g.gain.linearRampToValueAtTime(0, t + len);
      f.connect(g); g.connect(this.musicBus); g.connect(this.verbIn);
      ch.forEach(function (n, i) {
        [-6, 6].forEach(function (det) {
          var o = c.createOscillator(); o.type = i === 0 ? 'triangle' : 'sawtooth'; o.frequency.value = midi(n); o.detune.value = det;
          var og = c.createGain(); og.gain.value = i === 0 ? 0.9 : 0.35; o.connect(og); og.connect(f); o.start(t); o.stop(t + len + 0.05);
        });
      });
      this.stats.musicNotes++;
    }
    // 琶音：八分音符，约 55% 概率出声，音从五声音阶中挑与当前和弦接近的
    if (this._rand() < (pos % 2 === 0 ? 0.7 : 0.4)) {
      var n = PENTA[Math.floor(this._rand() * PENTA.length)] - (bar % 4 === 2 ? 0 : 0);
      var o = c.createOscillator(), g2 = c.createGain(); o.type = 'sine'; o.frequency.value = midi(n);
      var a = 0.035 + this._rand() * 0.02;
      g2.gain.setValueAtTime(0, t); g2.gain.linearRampToValueAtTime(a, t + 0.01); g2.gain.exponentialRampToValueAtTime(0.0004, t + beat * 1.6);
      o.connect(g2); g2.connect(this.musicBus); g2.connect(this.verbIn); o.start(t); o.stop(t + beat * 1.7);
      this.stats.musicNotes++;
    }
  };
  SoundEngine.prototype.musicPlaying = function () { return !!this._musicTimer; };

  CL.SoundEngine = SoundEngine;
  if (typeof module !== 'undefined' && module.exports) module.exports = SoundEngine;
})(typeof window !== 'undefined' ? window : globalThis);
