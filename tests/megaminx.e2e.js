// 五魔方 端到端：node tests/megaminx.e2e.js [URL] [截图目录]
// 选择 → 3D / 图视图 / 展开图（涂色 + 校验）→ 公式 → 求解（复原、非最优标注、HTM）→ 播放；
// 自己玩：拖动、键盘、撤销、打乱（WCA Pochmann）→ 计时 → 从当前状态求解；手机触摸
const { chromium } = require('playwright');
const URL = process.argv[2] || 'http://localhost:8765/', OUT = process.argv[3] || __dirname + '/../screenshots/megaminx';
require('fs').mkdirSync(OUT, { recursive: true });
let fails = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ FAIL: ') + m); if (!c) fails++; };
async function ready(p) { await p.waitForFunction(() => window.app && document.body.dataset.solverReady === '1', null, { timeout: 60000 }); }
const consistent = p => p.evaluate(() => JSON.stringify(app.P.apply(app.player.states[0], app.play.history())) === JSON.stringify(app.play.state()));
async function dragSticker(p, a, t, touch, cdp) {
  const v = await p.evaluate(([a, t]) => {
    const P = app.P, mm = P.moves[t], p0 = CubeLab.stickerPoint(P.stickers[a]), ax = CubeLab.vec.norm(mm.axis), w = CubeLab.vec.cross(ax, p0), k = Math.sign(mm.angle) * 0.35;
    const A = app.view.toScreen(p0), B = app.view.toScreen([p0[0] + w[0] * k, p0[1] + w[1] * k, p0[2] + w[2] * k]); return [A[0], A[1], B[0] - A[0], B[1] - A[1]];
  }, [a, t]);
  const A = await p.evaluate(a => app.view.stickerScreen(a), a), L = Math.hypot(v[2], v[3]) || 1, D = 34, Z = [A[0] + v[2] / L * D, A[1] + v[3] / L * D];
  if (!touch) {
    await p.mouse.move(A[0], A[1]); await p.mouse.down();
    for (let k = 1; k <= 6; k++) await p.mouse.move(A[0] + (Z[0] - A[0]) * k / 6, A[1] + (Z[1] - A[1]) * k / 6);
    await p.mouse.up();
  } else {
    const pt = (x, y) => [{ x, y, id: 1, radiusX: 4, radiusY: 4, force: 1 }];
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pt(A[0], A[1]) });
    for (let k = 1; k <= 6; k++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pt(A[0] + (Z[0] - A[0]) * k / 6, A[1] + (Z[1] - A[1]) * k / 6) });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  }
  await p.evaluate(() => app.play.idle());
  return p.evaluate(() => app.play.history().slice(-1)[0] || null);
}
// 可见、投影后速度足够大、且无其它转动方向相近（歧义）的「贴纸 × 转动」用例
const dragCases = p => p.evaluate(() => {
  const P = app.P, out = [], pc = []; P.pieces.forEach((q, i) => q.stickers.forEach(s => pc[s] = i));
  const cam = app.view.camera.position.clone().normalize(), o = app.view.root.localToWorld(new THREE.Vector3(0, 0, 0));
  P.dragMoves.forEach(t => {
    const m = P.moves[t];
    for (let a = 0; a < P.stickers.length; a++) {
      const n = P.stickers[a].normal, wn = app.view.root.localToWorld(new THREE.Vector3(n[0], n[1], n[2])).sub(o).normalize(); if (wn.dot(cam) < 0.45) continue;
      if (m.pieces.indexOf(pc[a]) < 0) continue;
      const vel = tt => { const mm = P.moves[tt], p0 = CubeLab.stickerPoint(P.stickers[a]), ax = CubeLab.vec.norm(mm.axis), w = CubeLab.vec.cross(ax, p0), k = Math.sign(mm.angle) * 0.35;
        const A = app.view.toScreen(p0), B = app.view.toScreen([p0[0] + w[0] * k, p0[1] + w[1] * k, p0[2] + w[2] * k]); return [B[0] - A[0], B[1] - A[1]]; };
      const v = vel(t), L = Math.hypot(v[0], v[1]); if (L < 6) continue;
      const amb = P.dragMoves.some(u => { if (u === t || P.moves[u].pieces.indexOf(pc[a]) < 0) return false; const q = vel(u), lq = Math.hypot(q[0], q[1]); return lq > 1 && (q[0] * v[0] + q[1] * v[1]) / (lq * L) > 0.8; });
      if (!amb) out.push([a, t]);
    }
  });
  return out;
});

(async () => {
  const b = await chromium.launch({ args: ['--enable-unsafe-swiftshader'] });
  const ctx = await b.newContext({ locale: 'zh-CN', viewport: { width: 1440, height: 1000 } });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto(URL + '?n=3', { waitUntil: 'load' }); await ready(p);
  console.log('[desktop] select / view / edit');
  const order = await p.evaluate(() => [...document.querySelectorAll('#puzzleSelect option')].map(o => o.value));
  ok(order.indexOf('megaminx') === order.indexOf('skewb') + 1, 'menu: Megaminx right after Skewb (' + order.slice(-3).join(', ') + ')');
  await p.selectOption('#puzzleSelect', 'megaminx'); await ready(p);
  const info = await p.evaluate(() => ({ id: app.P.id, name: document.querySelector('#puzzleSelect').selectedOptions[0].textContent, url: location.pathname,
    polys: document.querySelectorAll('#net polygon.cell').length, nodes: document.querySelectorAll('#graph .node').length, circles: document.querySelectorAll('#graph circle.track').length,
    scanHidden: document.querySelector('.tab[data-tab="scan"]').hidden, solver: document.getElementById('solverStatus').textContent, h1: (document.querySelector('h1') || {}).textContent }));
  ok(info.id === 'megaminx' && info.name === '五魔方', 'selected ' + info.name);
  ok(info.url.includes('/megaminx-solver/'), 'URL updated: ' + info.url);
  ok(info.polys === 132, 'net: 132 polygons');
  ok(info.nodes >= 131 && info.circles >= 12, `graph: ${info.nodes} nodes, ${info.circles} circles`);
  ok(info.scanHidden, 'camera / photo tab hidden');
  ok(/就绪/.test(info.solver), 'solver ready: ' + info.solver);
  const px = await p.evaluate(() => { const c = document.querySelector('#view3d canvas'); const g = document.createElement('canvas'); g.width = c.width; g.height = c.height; const x = g.getContext('2d'); x.drawImage(c, 0, 0); const d = x.getImageData(0, 0, g.width, g.height).data; let n = 0; for (let i = 3; i < d.length; i += 16) if (d[i] > 0) n++; return n; });
  ok(px > 5000, '3D canvas renders (' + px + ' sampled px)');
  // 涂色 + 校验
  await p.click('#btnReset');
  const target = 1, want = await p.evaluate(i => app.P.solvedState()[i], target), wrong = want === 'R' ? 'G' : 'R';
  await p.click('#palette .swatch[data-color="' + wrong + '"]'); await p.click(`#net polygon.cell[data-i="${target}"]`);
  let st = await p.evaluate(() => ({ cls: document.getElementById('validation').className, txt: document.getElementById('validation').textContent }));
  ok(/warn|bad/.test(st.cls), 'one wrong sticker → validation problem: ' + st.txt.slice(0, 60));
  await p.click('#palette .swatch[data-color="' + want + '"]'); await p.click(`#net polygon.cell[data-i="${target}"]`);
  st = await p.evaluate(() => ({ cls: document.getElementById('validation').className, txt: document.getElementById('validation').textContent }));
  ok(/ok/.test(st.cls), 'painted back → ' + st.txt);
  await p.screenshot({ path: `${OUT}/desktop-edit.png`, fullPage: true });
  // 公式 → 求解
  await p.click('.tab[data-tab="formula"]');
  const f = "R U2 F' BL D++ R-- U'";
  await p.fill('#formula', f); await p.click('#btnApplyFormula');
  ok(await p.evaluate(f => JSON.stringify(app.getState()) === JSON.stringify(app.P.apply(app.P.solvedState(), app.P.parse(f))), f), 'formula "' + f + '" applied');
  await p.click('#btnSolve'); await p.waitForSelector('#solutionBox:not([hidden])', { timeout: 30000 }); await p.waitForTimeout(200);
  let sol = await p.evaluate(() => ({ moves: app.player.tl.moves.slice(), solved: app.P.isSolved(app.P.apply(app.getState(), app.player.tl.moves)), count: document.getElementById('solCount').textContent, metric: document.getElementById('solMetric').textContent, note: document.getElementById('solutionBox').textContent }));
  ok(sol.solved && sol.metric === 'HTM' && /不是最优|非最优/.test(sol.count + sol.note), `formula scramble solved: ${sol.moves.length} moves · ${sol.count} · ${sol.metric}`);
  await p.click('.tab[data-tab="paint"]');
  for (let k = 0; k < 3; k++) {
    await p.click('#btnScramble'); const t0 = Date.now(); await p.click('#btnSolve');
    await p.waitForFunction(() => !document.getElementById('solutionBox').hidden && app.player.length() > 0, null, { timeout: 30000 });
    const r = await p.evaluate(() => ({ len: app.player.tl.moves.length, solved: app.P.isSolved(app.P.apply(app.getState(), app.player.tl.moves)), status: document.getElementById('solverStatus').textContent }));
    ok(r.solved && r.len > 40, `random state #${k + 1}: ${r.len} HTM in ${Date.now() - t0} ms, solved; ${r.status}`);
  }
  await p.evaluate(() => document.querySelector('.stage').scrollIntoView({ block: 'start' }));
  await p.screenshot({ path: `${OUT}/desktop-solve.png` });
  await p.evaluate(() => { app.view.setAutoRotate(false); app.player.speed = 0.25; app.player.seek && app.player.seek(0); });
  await p.click('#btnPlay').catch(() => {}); await p.waitForTimeout(700);
  await p.screenshot({ path: `${OUT}/desktop-playing.png` });
  await p.click('#btnPlay').catch(() => {});
  await p.evaluate(() => { app.player.speed = 8; app.player.seek(app.player.length()); });
  await p.waitForTimeout(300);
  const fin = await p.evaluate(() => app.P.isSolved(app.player.states[app.player.states.length - 1]));
  ok(fin, 'player end state solved');
  await p.screenshot({ path: `${OUT}/desktop-solved-graph.png` });

  console.log('\n[desktop] free play');
  await p.evaluate(() => { app.setMode('play'); app.view.setAutoRotate(false); app.player.speed = 1; app.play.start(app.P.solvedState(), false); document.getElementById('view3d').scrollIntoView({ block: 'center' }); });
  await p.waitForTimeout(200);
  const cases = await dragCases(p), sample = cases.filter((_, i) => i % Math.max(1, Math.floor(cases.length / 40)) === 0);
  let good = 0; const bad = [];
  for (const [a, t] of sample) {
    await p.evaluate(() => app.play.start(app.P.solvedState(), false));
    const got = await dragSticker(p, a, t);
    if (got === t) good++; else bad.push(a + ':' + t + '→' + got);
  }
  ok(sample.length >= 20 && good >= sample.length * 0.9, `${good}/${sample.length} drags give the expected turn` + (bad.length ? ' — ' + bad.slice(0, 6).join(', ') : ''));
  ok(await consistent(p), '3D state == model after drags');
  await p.evaluate(() => { app.view.resetView(); app.play.start(app.P.solvedState(), false); });
  for (const k of ['r', 'Shift+U', 'i', 'o', 'f']) await p.keyboard.press(k);
  await p.evaluate(() => app.play.idle());
  const h = await p.evaluate(() => app.play.history());
  ok(JSON.stringify(h) === JSON.stringify(['R', "U'", 'BL', 'BR', 'F']), 'keyboard → ' + h.join(' '));
  ok((await p.textContent('#playMoves')).trim() === '5' && (await p.textContent('#playMetric')) === 'HTM', 'move counter 5 HTM');
  await p.click('#btnUndo'); await p.evaluate(() => app.play.idle());
  ok((await p.evaluate(() => app.play.history().length)) === 4 && await consistent(p), 'undo');
  await p.evaluate(() => localStorage.removeItem('cubelab.best.megaminx'));
  await p.click('#btnPlayScramble'); await p.evaluate(() => app.play.idle());
  const scr = await p.evaluate(() => ({ t: app.play.timer().state, txt: document.getElementById('playScr').textContent, solved: app.P.isSolved(app.play.state()), valid: app.P.validate(app.play.state()).ok }));
  ok(scr.t === 'ready' && !scr.solved && scr.valid && /R\+\+|R--/.test(scr.txt), 'WCA Pochmann scramble (' + scr.txt.slice(0, 40) + '…), timer ready');
  await p.keyboard.press('r'); await p.waitForTimeout(250);
  ok((await p.evaluate(() => app.play.timer().state)) === 'run', 'first turn starts the timer');
  await p.screenshot({ path: `${OUT}/desktop-play.png` });
  const pst = await p.evaluate(() => app.play.state().slice());
  await p.click('#btnPlaySolve'); await p.waitForSelector('#solutionBox:not([hidden])', { timeout: 30000 });
  await p.waitForFunction(() => app.player.length() > 0, null, { timeout: 30000 });
  const rr = await p.evaluate(st => ({ mode: app.mode(), solved: app.P.isSolved(app.P.apply(st, app.player.tl.moves)) }), pst);
  ok(rr.mode === 'solve' && rr.solved, 'solve-from-current-state solves the played state');
  await p.evaluate(() => app.setMode('play'));
  await p.evaluate(() => app.play.start(app.P.apply(app.P.solvedState(), ['R']), true));
  await p.keyboard.press('Shift+R'); await p.evaluate(() => app.play.idle()); await p.waitForTimeout(300);
  const tm = await p.evaluate(() => app.play.timer());
  ok(tm.state === 'done' && (await p.evaluate(() => !!localStorage.getItem('cubelab.best.megaminx'))), 'timed solve finishes + best saved');
  await p.evaluate(() => app.setMode('solve'));
  // 语言：日语名称
  await p.goto(URL + 'ja/megaminx-solver/', { waitUntil: 'load' }); await ready(p);
  const ja = await p.evaluate(() => ({ id: app.P.id, name: document.querySelector('#puzzleSelect').selectedOptions[0].textContent, h1: document.querySelector('h1').textContent }));
  ok(ja.id === 'megaminx' && ja.name === 'メガミンクス' && /メガミンクス/.test(ja.h1), 'ja page: ' + ja.name + ' / ' + ja.h1);
  ok(!errs.filter(e => !/GL Driver|deprecated|GPU stall/.test(e)).length, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
  await ctx.close();

  console.log('\n[mobile]');
  const mctx = await b.newContext({ locale: 'en-US', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const m = await mctx.newPage(); const cdp = await mctx.newCDPSession(m); const merrs = [];
  m.on('pageerror', e => merrs.push(e.message));
  await m.goto(URL + 'megaminx-solver/?mode=play', { waitUntil: 'load' }); await ready(m);
  await m.evaluate(() => { app.view.setAutoRotate(false); app.play.start(app.P.solvedState(), false); document.getElementById('view3d').scrollIntoView({ block: 'center' }); });
  await m.waitForTimeout(200);
  const mc = (await dragCases(m)).filter((_, i) => i % 7 === 0).slice(0, 6);
  let mg = 0; const y0 = await m.evaluate(() => scrollY);
  for (const [a, t] of mc) { await m.evaluate(() => app.play.start(app.P.solvedState(), false)); if ((await dragSticker(m, a, t, true, cdp)) === t) mg++; }
  ok(mc.length > 0 && mg >= mc.length - 1, `touch drags: ${mg}/${mc.length}`);
  ok((await m.evaluate(() => scrollY)) === y0, 'page does not scroll while turning');
  ok(await m.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'no horizontal overflow');
  await m.screenshot({ path: `${OUT}/mobile-play.png` });
  await m.evaluate(() => app.setMode('solve'));
  await m.click('#btnScramble'); await m.click('#btnSolve'); await m.waitForFunction(() => app.player.length() > 0, null, { timeout: 30000 });
  await m.screenshot({ path: `${OUT}/mobile-solve.png`, fullPage: true });
  ok(!merrs.length, 'no mobile page errors' + (merrs.length ? ': ' + merrs[0] : ''));
  await b.close();
  console.log(fails ? `\n${fails} FAILED` : '\nall passed');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
