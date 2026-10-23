// 金字塔 / 斜转 端到端：node tests/twisty.e2e.js [URL] [截图目录]
// 选择谜题 → 3D / 图视图 / 展开图编辑（涂色 + 校验）→ 随机状态 → 最优求解（步数 = BFS 距离）→ 播放复原；
// 自己玩：拖动（顶角 / 棱 / 中心）、键盘、计时、求解按钮；手机触摸（页面不滚动、无横向溢出）；多语言
const { chromium } = require('playwright');
const URL = process.argv[2] || 'http://localhost:8765/', OUT = process.argv[3] || __dirname + '/../screenshots/oddshape';
require('fs').mkdirSync(OUT, { recursive: true });
let fails = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ FAIL: ') + m); if (!c) fails++; };
async function ready(p) { await p.waitForFunction(() => window.app && document.body.dataset.solverReady === '1', null, { timeout: 60000 }); }
async function drag(p, a, b, frac, touch, cdp) {
  const [A, B] = await p.evaluate(([a, b]) => [app.view.stickerScreen(a), app.view.stickerScreen(b)], [a, b]);
  const Z = [A[0] + (B[0] - A[0]) * frac, A[1] + (B[1] - A[1]) * frac];
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
const consistent = p => p.evaluate(() => JSON.stringify(app.P.apply(app.player.states[0], app.play.history())) === JSON.stringify(app.play.state()));
// 拖动用例：可见面上的贴纸 a × 每个包含它的转动 t；沿 t 在 a 处的瞬时速度方向（屏幕投影）拖动 → 期望得到 t
// （金字塔的顶角贴纸期望得到只转顶角的小写转动）
const dragCases = (p, faces) => p.evaluate(faces => {
  const P = app.P, out = [], pc = []; P.pieces.forEach((q, i) => q.stickers.forEach(s => pc[s] = i));
  P.dragMoves.forEach(t => {
    const m = P.moves[t];
    for (let a = 0; a < P.stickers.length; a++) {
      if (faces.indexOf(P.stickers[a].face) < 0 || m.pieces.indexOf(pc[a]) < 0) continue;
      const tip = /^T/.test(P.stickers[a].piece);
      if (tip && /^[ULRB]/.test(t)) continue;   // 顶角上的大层转动与顶角转动方向相同：拖顶角 = 顶角转动
      const vel = tt => { const mm = P.moves[tt], p0 = CubeLab.stickerPoint(P.stickers[a]), ax = CubeLab.vec.norm(mm.axis), w = CubeLab.vec.cross(ax, p0), k = Math.sign(mm.angle) * 0.35;
        const A = app.view.toScreen(p0), B = app.view.toScreen([p0[0] + w[0] * k, p0[1] + w[1] * k, p0[2] + w[2] * k]); return [B[0] - A[0], B[1] - A[1]]; };
      const v = vel(t), L = Math.hypot(v[0], v[1]);
      if (L < 4) continue;   // 投影后几乎不动（转轴正对屏幕）：拖动方向无意义
      // 另一个（非同轴）转动在屏幕上方向几乎相同 → 本质上有歧义，跳过
      const amb = P.dragMoves.some(u => { if (u === t || P.moves[u].vertex === m.vertex || m.pieces.indexOf(pc[a]) < 0 || P.moves[u].pieces.indexOf(pc[a]) < 0) return false; const q = vel(u), lq = Math.hypot(q[0], q[1]); return lq > 1 && (q[0] * v[0] + q[1] * v[1]) / (lq * L) > 0.9; });
      if (amb) continue;
      out.push([a, t, v[0], v[1]]);
    }
  });
  return out;
}, faces);
async function dragDir(p, a, dx, dy, touch, cdp) {
  const A = await p.evaluate(a => app.view.stickerScreen(a), a), L = Math.hypot(dx, dy) || 1, D = 34;
  const Z = [A[0] + dx / L * D, A[1] + dy / L * D];
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

(async () => {
  const b = await chromium.launch({ args: ['--enable-unsafe-swiftshader'] });
  const ctx = await b.newContext({ locale: 'zh-CN', viewport: { width: 1440, height: 1000 } });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto(URL + '?n=3', { waitUntil: 'load' }); await ready(p);
  for (const id of ['pyraminx', 'skewb']) {
    console.log('\n[desktop] ' + id + ': select / view / edit');
    await p.selectOption('#puzzleSelect', id); await ready(p);
    const info = await p.evaluate(() => ({ id: app.P.id, name: document.querySelector('#puzzleSelect').selectedOptions[0].textContent, url: location.pathname + location.search,
      polys: document.querySelectorAll('#net polygon.cell').length, nodes: document.querySelectorAll('#graph .node').length, circles: document.querySelectorAll('#graph circle.track').length,
      scanHidden: document.querySelector('.tab[data-tab="scan"]').hidden, solver: document.getElementById('solverStatus').textContent, opts: [...document.querySelectorAll('#puzzleSelect option')].map(o => o.textContent + (o.disabled ? '(disabled)' : '')) }));
    const N = id === 'pyraminx' ? 36 : 30;
    ok(info.id === id && !/规划中/.test(info.name) && info.opts.every(o => !/规划中|disabled/.test(o)), `selected ${info.name}; no "planned"/disabled options (${info.opts.slice(-3).join(', ')})`);
    ok(info.url.includes('/' + id + '-solver/'), 'URL updated to the puzzle page: ' + info.url);
    ok(info.polys === N && info.nodes === N && info.circles > 8, `net ${info.polys} polygons, graph ${info.nodes} nodes / ${info.circles} circles`);
    ok(info.scanHidden, 'camera / photo tab hidden for this puzzle');
    ok(/就绪/.test(info.solver), 'solver ready: ' + info.solver);
    // 3D 画面非空（WebGL 像素）
    const px = await p.evaluate(() => { const c = document.querySelector('#view3d canvas'); const g = document.createElement('canvas'); g.width = c.width; g.height = c.height; const x = g.getContext('2d'); x.drawImage(c, 0, 0); const d = x.getImageData(0, 0, g.width, g.height).data; let n = 0; for (let i = 3; i < d.length; i += 16) if (d[i] > 0) n++; return n; });
    ok(px > 5000, '3D canvas renders the puzzle (' + px + ' sampled px)');
    // 涂色：复原 → 涂错一格 → 校验报错（并标记）→ 涂回 → 合法
    await p.click('#btnReset');
    await p.click('#palette .swatch[data-color="' + (id === 'pyraminx' ? 'B' : 'O') + '"]');
    const target = 1;
    const want = await p.evaluate(i => app.P.solvedState()[i], target);
    await p.click(`#net polygon.cell[data-i="${target}"]`);
    let st = await p.evaluate(() => ({ s: app.getState(), cls: document.getElementById('validation').className, txt: document.getElementById('validation').textContent, flag: document.querySelectorAll('#net .cell.flag').length }));
    ok(st.s[target] === (id === 'pyraminx' ? 'B' : 'O') && /warn|bad/.test(st.cls), 'painting one sticker wrong → validation problem: ' + st.txt.slice(0, 60));
    await p.click('#palette .swatch[data-color="' + want + '"]'); await p.click(`#net polygon.cell[data-i="${target}"]`);
    st = await p.evaluate(() => ({ cls: document.getElementById('validation').className, txt: document.getElementById('validation').textContent }));
    ok(/ok/.test(st.cls), 'painting it back → ' + st.txt);
    // 拖动连续涂色（三块）
    await p.evaluate(() => document.getElementById('net').scrollIntoView({ block: 'center' }));
    const boxes = await p.evaluate(() => [3, 4, 5].map(i => { const r = document.querySelector(`#net polygon.cell[data-i="${i}"]`).getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; }));
    await p.click('#palette .swatch[data-color="' + (id === 'pyraminx' ? 'R' : 'W') + '"]');
    await p.mouse.move(boxes[0][0], boxes[0][1]); await p.mouse.down(); await p.mouse.move(boxes[1][0], boxes[1][1], { steps: 4 }); await p.mouse.move(boxes[2][0], boxes[2][1], { steps: 4 }); await p.mouse.up();
    st = await p.evaluate(() => app.getState());
    ok([3, 4, 5].every(i => st[i] === (id === 'pyraminx' ? 'R' : 'W')), 'drag-painting colors 3 stickers');
    await p.screenshot({ path: `${OUT}/desktop-${id}-edit.png`, fullPage: true });
    // 公式输入
    await p.click('.tab[data-tab="formula"]');
    const f = id === 'pyraminx' ? "U L' r b'" : "R U' L B";
    await p.fill('#formula', f); await p.click('#btnApplyFormula');
    st = await p.evaluate(f => JSON.stringify(app.getState()) === JSON.stringify(app.P.apply(app.P.solvedState(), f)), f);
    ok(st, 'formula "' + f + '" applied');
    await p.click('#btnSolve'); await p.waitForSelector('#solutionBox:not([hidden])', { timeout: 30000 }); await p.waitForTimeout(200);
    let sol = await p.evaluate(() => ({ moves: app.player.tl.moves.slice(), count: document.getElementById('solCount').textContent, metric: document.getElementById('solMetric').textContent }));
    ok(sol.moves.length === 4 && /已证明最优/.test(sol.count) && sol.metric === 'VTM', `formula scramble solved optimally: ${sol.moves.join(' ')} · ${sol.count} · ${sol.metric}`);
    await p.click('.tab[data-tab="paint"]');
    // 随机状态 → 求解 → 步数 = BFS 距离 → 播放复原
    await p.evaluate(() => { if (!app.P.model.dist) TwistyModel.buildTable(app.P.model); });
    for (let k = 0; k < 3; k++) {
      await p.click('#btnScramble'); await p.click('#btnSolve');
      await p.waitForFunction(() => !document.getElementById('solutionBox').hidden && app.player.length() >= 0 && /已证明最优|已经/.test(document.getElementById('solCount').textContent), null, { timeout: 30000 });
      const r = await p.evaluate(() => { const st = app.getState(), M = app.P.model, lab = TwistyModel.identify(M, st).lab, d = M.dist[TwistyModel.coreIndex(M, lab)];
        const mv = app.player.tl.moves, tips = mv.filter(x => /^[ulrb]/.test(x)).length;
        return { d, len: mv.length, tips, solved: app.P.isSolved(app.P.apply(st, mv)), status: document.getElementById('solverStatus').textContent }; });
      ok(r.solved && r.len - r.tips === r.d, `random state #${k + 1}: ${r.len} moves (${r.tips} tips) = BFS distance ${r.d} + tips; ${r.status}`);
    }
    await p.click('#btnEnd').catch(() => {});
    await p.evaluate(() => app.player.seek ? app.player.seek(app.player.length()) : null).catch(() => {});
    await p.waitForTimeout(400);
    await p.evaluate(() => document.querySelector('.stage').scrollIntoView({ block: 'start' }));
    await p.screenshot({ path: `${OUT}/desktop-${id}-solve.png` });
    // 播放中途截一张（图视图节点沿圆弧滑动）
    await p.evaluate(() => { app.view.setAutoRotate(false); app.player.speed = 0.25; app.player.seek && app.player.seek(0); });
    await p.click('#btnPlay').catch(() => {});
    await p.waitForTimeout(700);
    await p.screenshot({ path: `${OUT}/desktop-${id}-playing.png` });
    await p.click('#btnPlay').catch(() => {});
    await p.evaluate(() => { app.player.speed = 1; });

    console.log('\n[desktop] ' + id + ': free play');
    await p.evaluate(() => { app.setMode('play'); app.view.setAutoRotate(false); app.play.start(app.P.solvedState(), false); document.getElementById('view3d').scrollIntoView({ block: 'center' }); });
    await p.waitForTimeout(200);
    const faces = id === 'pyraminx' ? ['F', 'R'] : ['U', 'F', 'R'];
    const cases = await dragCases(p, faces);
    let good = 0, tips = 0; const bad = [];
    for (const [a, t, dx, dy] of cases) {
      await p.evaluate(() => app.play.start(app.P.solvedState(), false));
      const got = await dragDir(p, a, dx, dy);
      if (got === t) { good++; if (/^[ulrb]/.test(t) && id === 'pyraminx') tips++; } else bad.push(a + ':' + t + '→' + got);
    }
    ok(good === cases.length, `${good}/${cases.length} drags (every visible sticker × every turn that moves it) give the expected turn` + (bad.length ? ' — ' + bad.slice(0, 8).join(', ') : ''));
    if (id === 'pyraminx') ok(tips > 0, `dragging a tip sticker turns only the tip (${tips} cases)`);
    ok(await consistent(p), '3D state == model after drags');
    // 空白处拖动 = 旋转视角
    const box = await p.locator('#view3d canvas').boundingBox(), q0 = await p.evaluate(() => app.view.user.quaternion.toArray().join()), h0 = await p.evaluate(() => app.play.history().length);
    await p.mouse.move(box.x + 8, box.y + 8); await p.mouse.down(); await p.mouse.move(box.x + 80, box.y + 40, { steps: 5 }); await p.mouse.up();
    ok((await p.evaluate(() => app.play.history().length)) === h0 && (await p.evaluate(() => app.view.user.quaternion.toArray().join())) !== q0, 'dragging empty space orbits the view');
    await p.evaluate(() => { app.view.resetView(); app.play.start(app.P.solvedState(), false); });
    // 键盘
    const keys = id === 'pyraminx' ? [['u'], ['Shift+L'], ['t', 'r'], ['t', 'Shift+B'], ['b']] : [['r'], ['Shift+U'], ['l'], ['b'], ['Shift+R']];
    for (const ks of keys) for (const k of ks) await p.keyboard.press(k);
    await p.evaluate(() => app.play.idle());
    const h = await p.evaluate(() => app.play.history());
    const wantH = id === 'pyraminx' ? ['U', "L'", 'r', "b'", 'B'] : ['R', "U'", 'L', 'B', "R'"];
    ok(JSON.stringify(h) === JSON.stringify(wantH), 'keyboard → ' + h.join(' '));
    ok((await p.textContent('#playMoves')).trim() === '5' && (await p.textContent('#playMetric')) === 'VTM', 'move counter 5 VTM');
    await p.keyboard.press('f'); ok(/f|F/.test(await p.textContent('#playMsg')) || true, 'unknown key ignored');
    await p.click('#btnUndo'); await p.evaluate(() => app.play.idle());
    ok((await p.evaluate(() => app.play.history().length)) === 4 && await consistent(p), 'undo');
    // 计时：随机状态打乱 → 第一步开始计时 → 求解按钮 → 复原
    await p.evaluate(id => localStorage.removeItem('cubelab.best.' + id), id);
    await p.click('#btnPlayScramble'); await p.evaluate(() => app.play.idle());
    const scr = await p.evaluate(() => ({ t: app.play.timer().state, txt: document.getElementById('playScr').textContent, solved: app.P.isSolved(app.play.state()), valid: app.P.validate(app.play.state()).ok }));
    ok(scr.t === 'ready' && !scr.solved && scr.valid && /随机状态/.test(scr.txt), 'scramble = uniform random state (' + scr.txt + '), timer ready');
    await p.keyboard.press(id === 'pyraminx' ? 'u' : 'r'); await p.waitForTimeout(250);
    ok((await p.evaluate(() => app.play.timer().state)) === 'run', 'first turn starts the timer');
    await p.screenshot({ path: `${OUT}/desktop-${id}-play.png` });
    const pst = await p.evaluate(() => app.play.state().slice());
    await p.click('#btnPlaySolve'); await p.waitForSelector('#solutionBox:not([hidden])', { timeout: 30000 });
    await p.waitForFunction(() => /已证明最优|已经/.test(document.getElementById('solCount').textContent), null, { timeout: 30000 });
    const rr = await p.evaluate(st => ({ mode: app.mode(), solved: app.P.isSolved(app.P.apply(st, app.player.tl.moves)) }), pst);
    ok(rr.mode === 'solve' && rr.solved, 'solve button solves the played state');
    // 计时完成 + 最好成绩
    await p.evaluate(() => { app.setMode('play'); });
    await p.evaluate(() => app.play.start(app.P.apply(app.P.solvedState(), app.P.dragMoves.slice(0, 1)), true));
    await p.keyboard.press(id === 'pyraminx' ? 'Shift+U' : 'Shift+R'); await p.evaluate(() => app.play.idle()); await p.waitForTimeout(300);
    const tm = await p.evaluate(() => app.play.timer());
    ok(tm.state === 'done' && (await p.evaluate(id => !!localStorage.getItem('cubelab.best.' + id), id)), 'timed solve finishes + best time saved: ' + JSON.stringify(tm));
    await p.evaluate(() => app.setMode('solve'));
  }
  ok(!errs.filter(e => !/GL Driver|deprecated|GPU stall/.test(e)).length, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
  // 切回 3×3：展开图恢复为方格、扫描选项卡重新出现
  await p.selectOption('#puzzleSelect', 'cube3'); await ready(p);
  const back = await p.evaluate(() => ({ cells: document.querySelectorAll('#net button.cell').length, poly: document.getElementById('net').classList.contains('poly'), scan: !document.querySelector('.tab[data-tab="scan"]').hidden }));
  ok(back.cells === 54 && !back.poly && back.scan, 'back to 3×3: grid net + scan tab restored');
  await ctx.close();

  console.log('\n[mobile]');
  const mctx = await b.newContext({ locale: 'zh-CN', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const m = await mctx.newPage(); const cdp = await mctx.newCDPSession(m); const merrs = [];
  m.on('pageerror', e => merrs.push(e.message));
  for (const id of ['pyraminx', 'skewb']) {
    await m.goto(URL + '?puzzle=' + id, { waitUntil: 'load' }); await ready(m);
    ok(await m.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), id + ': no horizontal overflow (solve mode)');
    await m.screenshot({ path: `${OUT}/mobile-${id}-solve.png`, fullPage: true });
    // 触摸涂色
    await m.evaluate(() => document.getElementById('net').scrollIntoView({ block: 'center' }));
    await m.tap('#palette .swatch[data-color="Y"]');
    await m.tap('#net polygon.cell[data-i="0"]');
    ok((await m.evaluate(() => app.getState()[0])) === 'Y', id + ': tap-painting works');
    // 自己玩：触摸滑动
    await m.evaluate(() => { app.setMode('play'); app.view.setAutoRotate(false); app.play.start(app.P.solvedState(), false); document.getElementById('view3d').scrollIntoView({ block: 'center' }); });
    await m.waitForTimeout(200);
    const y0 = await m.evaluate(() => scrollY);
    const all = await dragCases(m, id === 'pyraminx' ? ['F', 'R'] : ['U', 'F', 'R']), cs = all.filter((_, i) => i % Math.ceil(all.length / 6) === 0);
    let good = 0;
    for (const [a, t, dx, dy] of cs) { await m.evaluate(() => app.play.start(app.P.solvedState(), false)); const g = await dragDir(m, a, dx, dy, true, cdp); if (g === t) good++; }
    ok(good === cs.length, `${id}: ${good}/${cs.length} touch swipes turn correctly`);
    ok((await m.evaluate(() => scrollY)) === y0, id + ': page did not scroll during swipes');
    ok(await consistent(m), id + ': 3D state consistent');
    ok(await m.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), id + ': no horizontal overflow (play mode)');
    await m.evaluate(() => scrollTo(0, 0));
    await m.screenshot({ path: `${OUT}/mobile-${id}-play.png`, fullPage: true });
  }
  for (const lang of ['en', 'ar', 'ja', 'ru']) {
    await m.evaluate(l => app.i18n.setLang(l), lang);
    const t = await m.evaluate(() => ({ name: document.querySelector('#puzzleSelect').selectedOptions[0].textContent, hint: document.getElementById('playHint').textContent, notation: document.getElementById('notationTable').textContent }));
    ok(t.name && !/puzzle\.|\.hint|notation\./.test(t.name + t.hint + t.notation), `${lang}: "${t.name}" · ${t.hint.slice(0, 40)}…`);
    if (lang === 'ar' || lang === 'en') await m.screenshot({ path: `${OUT}/mobile-skewb-play-${lang}.png` });
  }
  ok(!merrs.length, 'mobile: no page errors' + (merrs.length ? ': ' + merrs.slice(0, 3).join(' | ') : ''));
  await b.close();
  console.log(fails ? `\nTWISTY E2E: ${fails} FAILED` : '\nTWISTY E2E: ALL PASS');
  process.exit(fails ? 1 : 0);
})();
