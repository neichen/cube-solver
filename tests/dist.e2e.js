// 构建产物端到端（npm run build 之后，node tests/serve.js 8766 dist）：node tests/dist.e2e.js [URL]
// - 所有 js/css/puzzles/vendor 请求都带 ?v=<hash>（可以安全地 immutable 缓存）
// - CSP（来自 dist/_headers）下无违规、无页面错误；仍然跨源隔离
// - 3×3 / 4×4 / 金字塔 求解；切换语言；Service Worker 接管后离线重新加载仍可使用并求解
const { chromium } = require('playwright');
const URL = (process.argv[2] || 'http://localhost:8766/').replace(/\/?$/, '/');
let fails = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ FAIL: ') + m); if (!c) fails++; };
const ready = p => p.waitForFunction(() => window.app && document.body.dataset.solverReady === '1', null, { timeout: 60000 });
async function solve(p) {
  await p.click('#btnScramble'); await p.click('#btnSolve');
  await p.waitForSelector('#solutionBox:not([hidden])', { timeout: 120000 });
  return p.evaluate(() => app.player.tl.moves.length);
}
(async () => {
  const br = await chromium.launch();
  const ctx = await br.newContext({ viewport: { width: 1280, height: 900 } });
  const p = await ctx.newPage(); const errs = [], unver = [], csp = [];
  p.on('pageerror', e => errs.push(String(e)));
  p.on('console', m => { if (/Content Security Policy|Refused to/i.test(m.text())) csp.push(m.text()); });
  ctx.on('request', r => { const u = new globalThis.URL(r.url()); if (u.origin + '/' === URL && /^\/(js|css|puzzles|vendor)\//.test(u.pathname) && !/[?&]v=[0-9a-f]{8}/.test(u.search)) unver.push(u.pathname + u.search); });
  await p.goto(URL); await ready(p);
  ok(await p.evaluate(() => crossOriginIsolated), 'crossOriginIsolated');
  ok(await solve(p) > 0, '3×3 solve');
  await p.evaluate(() => app.mount('cube4')); await ready(p);
  ok(await solve(p) > 0, '4×4 solve');
  await p.evaluate(() => app.mount('pyraminx')); await ready(p);
  ok(await solve(p) >= 0, 'pyraminx solve');
  await p.evaluate(() => app.mount('cube7')); await ready(p);
  ok(await solve(p) > 0, '7×7 solve (gullicube WASM threads + data files)');
  await p.evaluate(() => app.mount('megaminx')); await ready(p);
  ok(await solve(p) > 0, 'megaminx solve');
  await p.goto(URL + 'ja/'); await ready(p);
  ok(await p.evaluate(() => document.documentElement.lang === 'ja' && /[ぁ-んァ-ン一-龯]/.test(document.body.innerText)), 'ja page localized');
  // Service Worker
  const swOk = await p.evaluate(() => navigator.serviceWorker ? navigator.serviceWorker.ready.then(r => !!r.active) : false);
  ok(swOk, 'service worker active');
  await p.reload(); await ready(p);
  ok(await p.evaluate(() => !!navigator.serviceWorker.controller), 'page controlled by SW');
  await p.evaluate(() => app.mount('cube3')); await ready(p);
  await solve(p);   // tables now cached at runtime
  await ctx.setOffline(true);
  await p.reload(); await ready(p);
  ok(await p.evaluate(() => crossOriginIsolated), 'offline: still crossOriginIsolated');
  ok(await solve(p) > 0, 'offline: 3×3 solve works');
  await p.goto(URL + 'ja/').catch(() => {}); await ready(p).catch(() => {});
  ok(await p.evaluate(() => !!window.app).catch(() => false), 'offline: other cached page loads');
  await ctx.setOffline(false);
  ok(unver.length === 0, 'all asset requests versioned ' + [...new Set(unver)].slice(0, 8).join(' '));
  ok(csp.length === 0, 'no CSP violations ' + csp.slice(0, 3).join(' | '));
  ok(errs.length === 0, 'no page errors ' + errs.slice(0, 3).join(' | '));
  await br.close();
  console.log(fails ? '\nDIST E2E: ' + fails + ' FAILED' : '\nDIST E2E: ALL PASS');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
