// 求解器就绪耗时：node tests/perf-init.js <URL>
// 首次访问（全新上下文）与再次访问（同一上下文刷新，HTTP 缓存生效）；桌面 / 手机模拟（CPU 4× 降速 + 移动视口）
const { chromium } = require('playwright');
const URL = process.argv[2] || 'http://localhost:8765/';
(async () => {
  const b = await chromium.launch();
  for (const vp of [{ name: 'desktop', viewport: { width: 1440, height: 1000 }, cpu: 1 }, { name: 'mobile(CPU×4)', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, cpu: 4 }]) {
    for (const n of [3, 4]) {
      const ctx = await b.newContext({ viewport: vp.viewport, isMobile: vp.isMobile, hasTouch: vp.hasTouch });
      const p = await ctx.newPage(); const cdp = await ctx.newCDPSession(p);
      if (vp.cpu > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: vp.cpu });
      const res = [], packs = [];
      ctx.on('response', r => { if (/\.bin\.gz$/.test(r.url())) packs.push(r.url().split('/').pop() + ':' + r.status() + ':' + (r.headers()['content-encoding'] || '-')); });
      for (const visit of ['first', 'repeat']) {
        const t0 = Date.now();
        await p.goto(URL + '?n=' + n, { waitUntil: 'load' });
        await p.waitForFunction(() => document.body.dataset.solverReady === '1', null, { timeout: 120000 });
        res.push(visit + ' ' + ((Date.now() - t0) / 1000).toFixed(2) + ' s');
      }
      let solve = '';
      if (n === 4) { await p.click('#btnScramble'); const t1 = Date.now(); await p.click('#btnSolve'); await p.waitForSelector('#solutionBox:not([hidden])', { timeout: 120000 });
        solve = ' | solve ' + ((Date.now() - t1) / 1000).toFixed(1) + ' s, ' + await p.evaluate(() => app.player.length()) + ' moves'; }
      console.log(`${vp.name} ${n}×${n}: page load → solver ready: ${res.join(', ')}${solve}`);
      await ctx.close();
    }
  }
  await b.close();
})();
