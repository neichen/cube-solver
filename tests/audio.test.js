// 声音模块单元测试：无 Web Audio 时安全空操作；用通用 Mock AudioContext 跑通所有音效/音乐路径；设置持久化；快放限流。
let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.log('FAIL', m); } else console.log('ok  ', m); };
const store = {};
const listeners = {};
global.window = global;
global.localStorage = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } };
global.addEventListener = (t, f) => { (listeners[t] = listeners[t] || []).push(f); };
global.removeEventListener = (t, f) => { listeners[t] = (listeners[t] || []).filter(x => x !== f); };
let fakeNow = 1000; global.performance = { now: () => fakeNow };
const load = () => { delete require.cache[require.resolve('../js/core/audio.js')]; global.CubeLab = {}; return require('../js/core/audio.js'); };

// 1) 没有 AudioContext
delete global.AudioContext; delete global.webkitAudioContext;
{
  const S = load(), a = new S();
  ok(a.supported === false && a.unlock() === false, 'no Web Audio: supported=false, unlock() returns false');
  let threw = false; try { a.move('end', { dur: 500 }); a.solved(); a.sweep(2000); a.paint(1); a.capture(true); a.setMusic(true); a.setVolume(0.3); a.setMusic(false); } catch (e) { threw = true; }
  ok(!threw && a.stats.errors === 0, 'no Web Audio: every call is a silent no-op');
}

// 2) 通用 Mock：任意节点/参数方法都可调用，记录创建的节点
const created = [];
function param(v) { return { value: v, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime(x) { if (!(x > 0)) throw new Error('exp ramp to <= 0'); }, setTargetAtTime() {}, cancelScheduledValues() {} }; }
function node(kind) {
  created.push(kind);
  return { kind, gain: param(1), frequency: param(440), detune: param(0), Q: param(1), delayTime: param(0), threshold: param(0), ratio: param(1), playbackRate: param(1),
    type: '', buffer: null, loop: false, connect() {}, disconnect() {}, start() {}, stop() {} };
}
let ctxCount = 0;
global.AudioContext = class { constructor() { ctxCount++; this.state = 'suspended'; this.sampleRate = 8000; this.currentTime = 0; this.destination = {}; }
  resume() { this.state = 'running'; return Promise.resolve(); }
  createGain() { return node('gain'); } createDynamicsCompressor() { return node('comp'); } createDelay() { return node('delay'); }
  createBiquadFilter() { return node('filter'); } createOscillator() { return node('osc'); } createBufferSource() { return node('src'); }
  createBuffer(ch, n, sr) { const d = []; for (let i = 0; i < ch; i++) d.push(new Float32Array(n)); return { getChannelData: i => d[i], duration: n / sr, length: n, numberOfChannels: ch }; } };
(async () => {
  for (const k in store) delete store[k];
  const S = load(), a = new S();
  ok(a.supported && a.ctx === null && ctxCount === 0, 'AudioContext NOT created before a user gesture');
  ok(a.sfxOn === true && a.musicOn === false, 'defaults: sound effects ON, music OFF');
  ok(a.move('end', { dur: 500 }) === false && a.stats.click === 0, 'sounds before gesture are silently skipped');
  (listeners.pointerdown || []).forEach(f => f());
  ok(ctxCount === 1 && a.ready() && a.ctx.state === 'running', 'first pointerdown creates + resumes AudioContext');
  ok((listeners.pointerdown || []).length === 0, 'gesture listeners removed after unlock');
  fakeNow += 1000; ok(a.move('start', { dur: 550 }) === true && a.stats.snap === 1, 'turn sound: one synthesized buffer per turn');
  fakeNow += 550; ok(a.move('end', { dur: 550 }) === false, "'end' phase is a no-op (landing clack is sample-aligned in the turn buffer)");
  fakeNow += 100; ok(a.move('start', { dur: 550, slice: true }) && a.move('cancel') === false && a._turns.length === 0, 'slice turn plays; cancel stops pending turn sounds');
  { // 生成的缓冲：最响的一簇在落位处；慢速时前段几乎无声；180° 在 T/2 有过卡位咔；余响 110 ms
    const sr = a.ctx.sampleRate;
    const seg = (d, t0, t1) => { let q = 0; const i0 = Math.max(0, Math.floor(t0 * sr)), i1 = Math.min(d.length, Math.floor(t1 * sr)); for (let i = i0; i < i1; i++) q += d[i] * d[i]; return q / Math.max(1, i1 - i0); };
    let landOK = 0, buildOK = 0, quietOK = 0, halfOK = 0, peakOK = 0;
    for (let trial = 0; trial < 10; trial++) {
      const T = 0.5, q = a._turnBuffers(T, false, false), d = q.buffer.getChannelData(0);
      if (Math.abs(q.land - (T - 0.003)) < 1e-9) landOK++;
      if (seg(d, T - 0.01, T + 0.03) > 2 * seg(d, T - 0.2, T - 0.12)) buildOK++;       // 落位附近明显最响
      let pk = 0; for (const ch of [0, 1]) { const dd = q.buffer.getChannelData(ch); for (let i = 0; i < dd.length; i++) pk = Math.max(pk, Math.abs(dd[i])); }
      if (pk > 0.35 && pk < 0.45) peakOK++;
      const slow = a._turnBuffers(0.9, false, false).buffer.getChannelData(0);
      if (seg(slow, 0, 0.25) < 0.02 * seg(slow, 0.85, 0.93)) quietOK++;             // 慢速：前段只有极轻的摩擦
      const h = a._turnBuffers(T, true, false).buffer.getChannelData(0);
      if (seg(h, T / 2 - 0.002, T / 2 + 0.008) > 2 * seg(h, T / 2 - 0.04, T / 2 - 0.01)) halfOK++;
    }
    ok(landOK === 10, 'landing clack aligned to the end of the animation (T − 3 ms)');
    ok(buildOK >= 8, `loudest cluster at the landing, quieter build-up before it (${buildOK}/10)`);
    ok(peakOK === 10, 'per-turn peak normalized (≈ 0.42 ± random variation)');
    ok(quietOK >= 9, `slow (0.9 s) turn: first 250 ms nearly silent, body concentrated at the end (${quietOK}/10)`);
    ok(halfOK >= 9, `180° turn has a detent clack at T/2 (${halfOK}/10)`);
    const b0 = a._turnBuffers(0.5, false, false);
    ok(Math.abs(b0.buffer.duration - 0.61) < 0.01 && b0.buffer.numberOfChannels !== 1 && b0.grains > 40, `buffer = turn + 110 ms rattle tail, ${b0.grains} grains`);
    let bad = 0; for (const T of [0.03, 0.08, 0.2, 1.2]) for (const hf of [false, true]) { const d = a._turnBuffers(T, hf, true).buffer.getChannelData(0); for (let i = 0; i < d.length; i++) if (!isFinite(d[i]) || Math.abs(d[i]) > 0.6) { bad++; break; } }
    ok(bad === 0, 'all durations / 180° / slice produce finite, bounded buffers');
  }
  // 快放限流：40 ms 一步（极快）→ 起始声全部跳过，落位声至少间隔 70 ms
  const before = a.stats.click; for (let i = 0; i < 50; i++) { fakeNow += 20; a.move('start', { dur: 40 }); fakeNow += 20; a.move('end', { dur: 40 }); }
  const n = a.stats.click - before;
  ok(n > 0 && n <= Math.ceil(50 * 40 / 50) + 1 && n < 50, `fast playback rate-limited: ${n} turn sounds for 50 moves in 2 s (≥ 50 ms apart)`);
  ok(a.solved() && a.sweep(2000) && a.paint(2) && a.capture(false) && a.capture(true), 'chime / sweep / paint / capture all play');
  fakeNow += 10; ok(a.paint(3) === false, 'drag-painting rate-limited (45 ms)');
  a.setMusic(true); ok(a.musicPlaying() && a.stats.musicNotes > 0, 'procedural music starts and schedules notes');
  a.setMusic(false); ok(!a.musicPlaying(), 'music stops');
  a.setSfx(false); fakeNow += 1000; ok(a.move('end', { dur: 500 }) === false && a.solved() === false, 'sound effects can be disabled');
  a.setVolume(0.25);
  ok(store['cubelab.sfx'] === '0' && store['cubelab.music'] === '0' && store['cubelab.vol'] === '0.25', 'settings persisted in localStorage');
  ok(a.stats.errors === 0 && created.includes('osc') && created.includes('src'), 'no audio errors (nodes created: ' + created.length + ')');
  const b = new (load())(); ok(b.sfxOn === false && Math.abs(b.volume - 0.25) < 1e-9, 'settings restored on reload');
  store['cubelab.music'] = '1'; const c = new (load())(); ok(c.musicOn && !c.musicPlaying(), 'music ON restored, but waits for a gesture');
  (listeners.keydown || []).forEach(f => f()); ok(c.musicPlaying(), 'music starts on first gesture (keydown)');
  c.setMusic(false);
  console.log(fails ? fails + ' FAILURES' : 'ALL PASS'); process.exit(fails ? 1 : 0);
})();
