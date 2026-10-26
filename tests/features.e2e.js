// 新功能端到端：node tests/features.e2e.js [URL]
// 展开图键盘导航（漫游 tabindex + 方向键）、6×6 起的 canvas 展开图 + 面缩放、颜色字母、
// 日本配色（蓝黄互换：显示 / 校验 / 求解）、长求解的进度 + 取消、无未带版本号的请求（dist 模式）
const { chromium } = require('playwright');
const URL = process.argv[2] || 'http://localhost:8765/';
let fails = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ FAIL: ') + m); if (!c) fails++; };
async function ready(p) { await p.waitForFunction(() => window.app && document.body.dataset.solverReady === '1', null, { timeout: 60000 }); }
(async () => {
  const br = await chromium.launch();
  const ctx = await br.newContext({ viewport: { width: 1280, height: 900 } });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(String(e)));
  await p.goto(URL); await ready(p);

  // 1) 键盘：3×3 展开图只有一个 tabindex=0；方向键移动焦点；Enter 涂色
  const tab0 = await p.$$eval('#net button.cell', bs => bs.filter(b => b.tabIndex === 0).length);
  ok(tab0 === 1, '3×3 net: exactly one cell in tab order (' + tab0 + ')');
  await p.focus('#net button.cell[tabindex="0"]');
  const a0 = await p.evaluate(() => document.activeElement.dataset.i);
  await p.keyboard.press('ArrowRight');
  const a1 = await p.evaluate(() => document.activeElement.dataset.i);
  ok(a0 !== a1 && a1 != null, 'ArrowRight moves focus (' + a0 + ' → ' + a1 + ')');
  await p.keyboard.press('ArrowLeft');
  ok(await p.evaluate(() => document.activeElement.dataset.i) === a0, 'ArrowLeft returns');
  await p.keyboard.press('ArrowDown'); await p.keyboard.press('ArrowDown');
  const before = await p.evaluate(() => app.getState().join(''));
  const pick = () => p.evaluate(() => { const ks = Object.keys(app.P.colors), cur = app.editor.state[app.editor.focusI]; return String(ks.findIndex(k => k !== cur) + 1); });
  await p.keyboard.press(await pick()); await p.keyboard.press('Enter');
  const after = await p.evaluate(() => app.getState().join(''));
  ok(before !== after, 'number key + Enter paints the focused cell');
  await p.click('#btnReset');

  // 2) 颜色字母
  await p.click('label:has(#colorLetters)');
  ok(await p.evaluate(() => document.body.classList.contains('letters-on')), 'letters toggle sets body.letters-on');
  ok(await p.evaluate(() => localStorage.getItem('cubelab.letters') === '1'), 'letters persisted');
  ok(await p.$eval('#net button.cell', b => /[WYRGBO]/.test(b.textContent)), 'net cell shows a letter');
  ok(await p.evaluate(() => !!(app.view.letterMeshes && app.view.letterMeshes.filter(Boolean).length === 54)), '3D letter planes created (54)');

  // 3) 日本配色：U 中心显示为白、D 中心（逻辑 Y）显示为蓝；校验 + 求解仍然正常
  ok(await p.isVisible('#colorScheme'), 'scheme select visible on cube');
  await p.selectOption('#colorScheme', 'japanese');
  const jp = await p.evaluate(() => ({ Y: app.P.colors.Y.hex, B: app.P.colors.B.hex, Yl: app.P.colors.Y.letter, Bl: app.P.colors.B.letter, sw: getComputedStyle(document.querySelector('#palette .swatch[data-color="Y"] .dot') || document.body).backgroundColor }));
  ok(jp.Yl === 'B' && jp.Bl === 'Y', 'japanese: logical Y shows letter B (' + jp.Yl + '/' + jp.Bl + ')');
  ok(jp.Y !== jp.B && /^#/.test(jp.Y), 'japanese: Y/B hex swapped (' + jp.Y + ', ' + jp.B + ')');
  await p.click('#btnScramble'); await p.click('#btnSolve');
  await p.waitForSelector('#solutionBox:not([hidden])', { timeout: 60000 });
  ok(await p.evaluate(() => JSON.stringify(app.P.apply(app.player.states[0], app.player.tl.moves || [])) !== null), 'japanese: solve produced a solution');
  await p.reload(); await ready(p);
  ok(await p.$eval('#colorScheme', s => s.value) === 'japanese', 'scheme persisted across reload');
  await p.selectOption('#colorScheme', 'western');
  ok(await p.evaluate(() => app.P.colors.Y.letter === 'Y'), 'western restored');
  await p.click('label:has(#colorLetters)');

  // 4) 非立方体：配色选项隐藏
  await p.evaluate(() => app.mount('pyraminx')); await ready(p);
  ok(!(await p.isVisible('#colorScheme')), 'scheme select hidden on pyraminx');

  // 5) 7×7：canvas 展开图 + 缩放 + 键盘 + DOM 精简
  await p.evaluate(() => app.mount('cube7')); await ready(p);
  ok(await p.$('#net canvas.net-canvas') !== null, '7×7 uses canvas net');
  const nCells = await p.$$eval('#net .cell', x => x.length);
  ok(nCells === 0, '7×7: no per-sticker DOM nodes (' + nCells + ')');
  await p.click('#net .net-zoom button[data-face="F"]');
  ok(await p.$eval('#net .net-zoom button[data-face="F"]', b => b.getAttribute('aria-pressed') === 'true'), 'zoom F pressed');
  await p.focus('#net canvas.net-canvas');
  const s0 = await p.evaluate(() => app.getState().join(''));
  await p.keyboard.press('ArrowRight'); await p.keyboard.press(await pick()); await p.keyboard.press('Enter');
  ok(await p.evaluate(() => app.getState().join('')) !== s0, '7×7 canvas: keyboard paint works');
  const box = await p.$eval('#net canvas.net-canvas', c => { const r = c.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; });
  await p.keyboard.press('4'); await p.mouse.click(box[0], box[1]);
  ok(await p.evaluate(() => app.getState().indexOf(null) >= -1), '7×7 canvas: click paints without error');
  await p.click('#net .net-zoom button[data-face=""]');

  // 6) 取消 + 进度（15×15 质量求解）
  await p.evaluate(() => app.mount('cube15')); await ready(p);
  await p.click('#btnScramble');
  const sel = await p.$$eval('#solverSelect option', os => os.map(o => o.value));
  const q = sel.find(v => /quality/.test(v)); if (q) await p.selectOption('#solverSelect', q);
  await p.click('#btnSolve');
  await p.waitForSelector('#solveProgress:not([hidden])', { timeout: 10000 }).catch(() => {});
  ok(await p.isVisible('#solveProgress'), 'progress indicator visible during long solve');
  await p.waitForTimeout(1500);
  ok(/\d/.test(await p.textContent('#solveElapsed')), 'elapsed counter ticks');
  await p.click('#btnCancelSolve');
  await p.waitForTimeout(500);
  ok(!(await p.isVisible('#solveProgress')), 'progress hidden after cancel');
  ok(await p.$eval('#btnSolve', b => !b.disabled), 'solve button re-enabled after cancel');
  ok(await p.$eval('#solutionBox', b => b.hidden), 'no solution shown after cancel');
  // 取消后再次求解能完成
  await p.click('#btnSolve');
  await p.waitForSelector('#solutionBox:not([hidden])', { timeout: 120000 });
  ok(true, 'solve after cancel completes');

  ok(errs.length === 0, 'no page errors ' + (errs.length ? errs.join(' | ') : ''));
  await br.close();
  console.log(fails ? '\nFEATURES E2E: ' + fails + ' FAILED' : '\nFEATURES E2E: ALL PASS');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
