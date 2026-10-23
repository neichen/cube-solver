// N×N 线上 / 本地验证：node tests/live-nxn.js <URL> [截图目录]
// 桌面 + 手机：多个阶数 → 打乱 → 求解 → 校验解法确实复原 → 截图
const { chromium } = require('playwright');
const URL = process.argv[2] || 'http://localhost:8765/', OUT = process.argv[3] || __dirname + '/../screenshots/nxn';
require('fs').mkdirSync(OUT, { recursive: true });
let fails = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ FAIL: ') + m); if (!c) fails++; };
const PLAN = {
  desktop: [[2], [3], [4], [4, 'gullicubeFast'], [5], [5, 'gullicubeFast'], [7, 'gullicubeFast'], [10, 'gullicubeFast'], [15], [15, 'gullicubeFast']],
  mobile: [[2], [4], [6, 'gullicubeFast'], [15, 'gullicubeFast']],
};
(async () => {
  const b = await chromium.launch({ args: ['--enable-unsafe-swiftshader'] });
  for (const vp of [{ name: 'desktop', viewport: { width: 1440, height: 1000 } }, { name: 'mobile', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }]) {
    console.log('\n[' + vp.name + ']');
    const ctx = await b.newContext({ locale: 'zh-CN', viewport: vp.viewport, isMobile: vp.isMobile, hasTouch: vp.hasTouch, deviceScaleFactor: vp.deviceScaleFactor || 1 });
    const p = await ctx.newPage(); const errs = [], bad = [];
    p.on('pageerror', e => errs.push('pageerror: ' + e.message));
    p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
    p.on('response', r => { if (r.status() >= 400) bad.push(r.status() + ' ' + r.url()); });
    for (const [n, solver] of PLAN[vp.name]) {
      await p.goto(URL + '?n=' + n, { waitUntil: 'load' });
      if (solver) await p.selectOption('#solverSelect', solver);
      await p.waitForFunction(() => document.body.dataset.solverReady === '1', null, { timeout: 60000 });
      const env = await p.evaluate(() => ({ id: app.P.id, iso: self.crossOriginIsolated, nodes: app.graph.nodeEls.length, solver: document.getElementById('solverSelect').value }));
      await p.click('#btnScramble');
      const t0 = Date.now();
      await p.click('#btnSolve');
      await p.waitForSelector('#solutionBox:not([hidden])', { timeout: 240000 }).catch(() => {});
      const ms = Date.now() - t0;
      const r = await p.evaluate(() => ({ count: document.getElementById('solCount').textContent, metric: document.getElementById('solMetric').textContent, len: app.player.length(),
        solved: app.player.length() > 0 && app.P.isSolved(app.P.apply(app.getState(), app.player.tl.moves)) }));
      ok(env.id === 'cube' + n && env.nodes === 6 * n * n && r.solved, `${n}×${n} ${env.solver}: ${r.len} ${r.metric}，${(ms / 1000).toFixed(1)} s，解法复原 ✓（crossOriginIsolated=${env.iso}）`);
      await p.evaluate(() => { app.player.seek(Math.floor(app.player.length() / 2)); });
      await p.waitForTimeout(600);
      const f = `${OUT}/${vp.name}-${n}x${n}${solver ? '-' + solver : ''}.png`;
      await p.screenshot({ path: f, fullPage: vp.name === 'mobile' });
      console.log('    📷 ' + f);
    }
    ok(!errs.filter(e => !/GL Driver|deprecated/.test(e)).length, '无页面错误' + (errs.length ? '：' + errs.slice(0, 3).join(' | ') : ''));
    ok(!bad.length, '无 4xx/5xx 资源' + (bad.length ? '：' + bad.slice(0, 3).join(' | ') : ''));
    await ctx.close();
  }
  await b.close();
  console.log(fails ? `\nLIVE NxN: ${fails} FAILED` : '\nLIVE NxN: ALL PASS');
  process.exit(fails ? 1 : 0);
})();
