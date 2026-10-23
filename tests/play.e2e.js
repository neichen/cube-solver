// 「自己玩」端到端：node tests/play.e2e.js [URL] [截图目录]
// 拖动手势（2/3/4/7 阶，含内层 / 中层 / 另一面）、空白处拖动=旋转视角、键盘、公式框、撤销 / 重做、计时完成 + 最好成绩、
// 打乱 → 求解按钮 → 解法复原、手机触摸滑动（页面不滚动）、多语言下的面板文字
const { chromium } = require('playwright');
const URL = process.argv[2] || 'http://localhost:8765/', OUT = process.argv[3] || __dirname + '/../screenshots/play';
require('fs').mkdirSync(OUT, { recursive: true });
let fails = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ FAIL: ') + m); if (!c) fails++; };
const F = (n, r, c) => 2 * n * n + r * n + c, U = (n, r, c) => r * n + c;
async function open(p, n, extra) {
  await p.goto(URL + '?n=' + n + '&mode=play&hold=whiteTop' + (extra || ''), { waitUntil: 'load' });
  await p.waitForFunction(() => window.app && app.mode() === 'play' && document.body.dataset.solverReady === '1', null, { timeout: 60000 });
  await p.evaluate(() => { app.view.setAutoRotate(false); app.play.start(app.P.solvedState(), false); document.getElementById('view3d').scrollIntoView({ block: 'center' }); });
  await p.waitForTimeout(150);
}
async function drag(p, a, b, touch, cdp) {
  const [A, B] = await p.evaluate(([a, b]) => [app.view.stickerScreen(a), app.view.stickerScreen(b)], [a, b]);
  if (!touch) {
    await p.mouse.move(A[0], A[1]); await p.mouse.down();
    for (let k = 1; k <= 6; k++) await p.mouse.move(A[0] + (B[0] - A[0]) * k / 6, A[1] + (B[1] - A[1]) * k / 6);
    await p.mouse.up();
  } else {
    const pt = (x, y) => [{ x, y, id: 1, radiusX: 4, radiusY: 4, force: 1 }];
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pt(A[0], A[1]) });
    for (let k = 1; k <= 6; k++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pt(A[0] + (B[0] - A[0]) * k / 6, A[1] + (B[1] - A[1]) * k / 6) });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  }
  await p.evaluate(() => app.play.idle());
  return p.evaluate(() => app.play.history().slice(-1)[0]);
}
const consistent = p => p.evaluate(() => { const h = app.play.history(); return JSON.stringify(app.P.apply(app.player.states[0], h)) === JSON.stringify(app.play.state()); });
(async () => {
  const b = await chromium.launch({ args: ['--enable-unsafe-swiftshader'] });
  console.log('\n[desktop] drag gestures');
  const ctx = await b.newContext({ locale: 'zh-CN', viewport: { width: 1440, height: 1000 } });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  for (const n of [2, 3, 4, 7]) {
    await open(p, n);
    const cases = [[F(n, n - 1, n - 1), F(n, 0, n - 1), 'R'], [F(n, 0, n - 1), F(n, 0, 0), 'U'], [U(n, 0, n - 1), U(n, n - 1, n - 1), "R'"], [F(n, n - 1, 0), F(n, n - 1, n - 1), 'D']];
    if (n >= 4) cases.push([F(n, n - 1, n - 2), F(n, 0, n - 2), '2R'], [F(n, 1, 0), F(n, 1, n - 1), "2U'"]);
    if (n % 2 && n > 2) { const m = (n - 1) / 2; cases.push([F(n, n - 1, m), F(n, 0, m), "M'"], [F(n, m, 0), F(n, m, n - 1), 'E']); }
    for (const [a, z, want] of cases) { const got = await drag(p, a, z); ok(got === want, `${n}×${n}: drag sticker ${a} → ${z} gives ${got} (want ${want})`); }
    ok(await consistent(p), `${n}×${n}: 3D state == model after ${cases.length} drags`);
    // 空白处拖动 = 旋转视角
    const h0 = (await p.evaluate(() => app.play.history().length)), box = await p.locator('#view3d canvas').boundingBox();
    const q0 = await p.evaluate(() => app.view.user.quaternion.toArray().join());
    await p.mouse.move(box.x + 8, box.y + 8); await p.mouse.down(); await p.mouse.move(box.x + 80, box.y + 40, { steps: 5 }); await p.mouse.up();
    ok(await p.evaluate(() => app.play.history().length) === h0 && (await p.evaluate(() => app.view.user.quaternion.toArray().join())) !== q0, `${n}×${n}: dragging empty space orbits the view, no turn`);
    await p.evaluate(() => app.view.resetView());
    if (n === 4 || n === 7) await p.screenshot({ path: `${OUT}/desktop-${n}x${n}-play.png` });
  }

  console.log('\n[desktop] keyboard / formula / undo / redo');
  await open(p, 4);
  await p.keyboard.press('r'); await p.keyboard.press('Shift+U'); await p.keyboard.press('2'); await p.keyboard.press('r');
  await p.keyboard.press('3'); await p.keyboard.press('w'); await p.keyboard.press('r'); await p.keyboard.press('x');
  await p.evaluate(() => app.play.idle());
  let h = await p.evaluate(() => app.play.history());
  ok(JSON.stringify(h) === JSON.stringify(['R', "U'", '2R', '3Rw', 'x']), 'keys r, Shift+U, 2 r, 3 w r, x → ' + h.join(' '));
  ok((await p.textContent('#playMoves')).trim() === '4' && (await p.textContent('#playMetric')) === 'BTM', 'move counter 4 BTM (rotation not counted)');
  await p.fill('#playFormula', "R U R' U' 2L2"); await p.press('#playFormula', 'Enter'); await p.evaluate(() => app.play.idle());
  h = await p.evaluate(() => app.play.history()); ok(h.length === 10 && h.slice(-5).join(' ') === "R U R' U' 2L2", 'formula box appends 5 moves');
  await p.click('#btnUndo'); await p.click('#btnUndo'); await p.evaluate(() => app.play.idle());
  h = await p.evaluate(() => app.play.history()); ok(h.length === 8, 'undo ×2 → 8 moves');
  await p.click('#btnRedo'); await p.evaluate(() => app.play.idle());
  h = await p.evaluate(() => app.play.history()); ok(h.length === 9 && h[8] === "U'", 'redo → 9 moves, last U′');
  await p.keyboard.press('Control+z'); await p.evaluate(() => app.play.idle());
  ok((await p.evaluate(() => app.play.history().length)) === 8 && await consistent(p), 'Ctrl+Z undo; 3D state consistent');
  // 快速连续输入（排队，不丢步）
  for (let k = 0; k < 12; k++) await p.keyboard.press(k % 2 ? 'Shift+R' : 'r');
  await p.evaluate(() => app.play.idle());
  ok((await p.evaluate(() => app.play.history().length)) === 20 && await consistent(p), '12 rapid key turns queued, none lost');
  ok(await p.evaluate(() => app.graph && app.player.index === app.player.length()), 'graph view / player in sync with history');

  console.log('\n[desktop] timer + best time');
  await open(p, 3);
  await p.evaluate(() => { localStorage.removeItem('cubelab.best.cube3'); app.play.start(app.P.apply(app.P.solvedState(), ['R', 'U']), true); });
  ok((await p.evaluate(() => app.play.timer().state)) === 'ready', 'timer ready after scramble');
  await p.keyboard.press('Shift+U'); await p.waitForTimeout(300);
  ok((await p.evaluate(() => app.play.timer().state)) === 'run', 'timer runs after first turn');
  await p.keyboard.press('Shift+R'); await p.evaluate(() => app.play.idle()); await p.waitForTimeout(400);
  const tm = await p.evaluate(() => app.play.timer());
  ok(tm.state === 'done' && tm.ms > 100, 'timer stops when solved: ' + JSON.stringify(tm));
  ok(await p.evaluate(() => !!localStorage.getItem('cubelab.best.cube3')) && /最好成绩/.test(await p.textContent('#playBest')), 'best time saved + shown: ' + await p.textContent('#playBest'));
  ok(/还原成功/.test(await p.textContent('#playStatus')), 'status: ' + await p.textContent('#playStatus'));
  await p.waitForTimeout(500); await p.screenshot({ path: `${OUT}/desktop-3x3-solved.png` });

  console.log('\n[desktop] scramble → solve button → solved');
  for (const n of [2, 3, 4]) {
    await open(p, n);
    await p.click('#btnPlayScramble'); await p.evaluate(() => app.play.idle());
    await drag(p, F(n, n - 1, n - 1), F(n, 0, n - 1));
    ok((await p.evaluate(() => app.play.timer().state)) === 'run', `${n}×${n}: scramble + first drag starts timer`);
    if (n === 3) await p.screenshot({ path: `${OUT}/desktop-3x3-timing.png` });
    const st = await p.evaluate(() => app.play.state().slice());
    await p.click('#btnPlaySolve');
    await p.waitForSelector('#solutionBox:not([hidden])', { timeout: 90000 });
    const r = await p.evaluate(st => ({ mode: app.mode(), same: JSON.stringify(app.getState()) === JSON.stringify(st), solved: app.P.isSolved(app.P.apply(st, app.player.tl.moves)), len: app.player.length() }), st);
    ok(r.mode === 'solve' && r.same && r.solved && r.len > 0, `${n}×${n}: solve button solves the played state (${r.len} moves)`);
  }
  ok(!errs.filter(e => !/GL Driver|deprecated/.test(e)).length, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
  await ctx.close();

  console.log('\n[mobile] touch swipes');
  const mctx = await b.newContext({ locale: 'zh-CN', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const m = await mctx.newPage(); const cdp = await mctx.newCDPSession(m); const merrs = [];
  m.on('pageerror', e => merrs.push(e.message));
  for (const n of [3, 4]) {
    await open(m, n);
    await m.evaluate(() => document.getElementById('view3d').scrollIntoView({ block: 'center' }));
    const y0 = await m.evaluate(() => scrollY);
    const g1 = await drag(m, F(n, n - 1, n - 1), F(n, 0, n - 1), true, cdp);
    const g2 = await drag(m, F(n, 0, n - 1), F(n, 0, 0), true, cdp);
    ok(g1 === 'R' && g2 === 'U', `${n}×${n} touch swipes → ${g1} ${g2}`);
    ok((await m.evaluate(() => scrollY)) === y0, `${n}×${n}: page did not scroll during swipes`);
    const ov = await m.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);
    ok(ov, `${n}×${n}: no horizontal overflow on mobile`);
    await m.evaluate(() => scrollTo(0, 0));
    await m.screenshot({ path: `${OUT}/mobile-${n}x${n}-play.png`, fullPage: true });
  }
  // 其他语言 + RTL
  for (const lang of ['en', 'ar', 'ja']) {
    await m.evaluate(l => app.i18n.setLang(l), lang);
    const txt = await m.textContent('.mode-btn[data-mode="play"]');
    ok(txt && txt !== 'mode.play', `${lang}: mode button "${txt}"`);
    await m.screenshot({ path: `${OUT}/mobile-3x3-play-${lang}.png` });
  }
  ok(!merrs.length, 'mobile: no page errors' + (merrs.length ? ': ' + merrs.slice(0, 3).join(' | ') : ''));
  await b.close();
  console.log(fails ? `\nPLAY E2E: ${fails} FAILED` : '\nPLAY E2E: ALL PASS');
  process.exit(fails ? 1 : 0);
})();
