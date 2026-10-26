// Analytics + consent check: node tests/analytics.e2e.js [https://cube-solver.org/] [--proxy http://localhost:8765] [--stub] [--out DIR]
//   --proxy  serve the cube-solver.org pages from a local server (analytics only runs on the production host); the ID
//            placeholders in js/analytics.js are filled from CF_BEACON_TOKEN / GA_MEASUREMENT_ID or with dummy values
//   --stub   answer the collection endpoints locally (nothing is sent to Cloudflare / Google)
// Checks: crossOriginIsolated stays true with the analytics scripts; the Cloudflare beacon loads and reports; the consent
// banner (en + zh-hans, mobile) does not cover the main controls; GA (gtag.js, /g/collect) is not requested before consent
// or after Decline, and sends page_view after Accept, including in-app route changes.
const { pickPuzzle, pickLang } = require('./_topbar.js');
const { chromium } = require('playwright');
const args = process.argv.slice(2), opt = n => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const BASE = (args[0] && !args[0].startsWith('--') ? args[0] : 'https://cube-solver.org/'), PROXY = opt('--proxy'), STUB = args.includes('--stub');
// IDs for --proxy mode: environment, else the gitignored .env (as tools/build-dist.js), else dummies
const ENV = {}; try { for (const l of require('fs').readFileSync(__dirname + '/../.env', 'utf8').split(/\r?\n/)) { const m = l.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*["']?([^"'#\s]*)["']?/); if (m) ENV[m[1]] = m[2]; } } catch (e) { /* no .env */ }
const idFor = k => process.env[k] || ENV[k] || '';
const CF_ID = idFor('CF_BEACON_TOKEN') || '0123456789abcdef0123456789abcdef', GA_ID = idFor('GA_MEASUREMENT_ID') || 'G-TEST000000';
// a dummy GA ID gets a generic gtag.js without the stream's enhanced-measurement settings, so history page_views can't be checked
const REAL_GA = !PROXY || GA_ID !== 'G-TEST000000';
const OUT = opt('--out') || __dirname + '/../screenshots/analytics';
require('fs').mkdirSync(OUT, { recursive: true });
let fails = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ FAIL: ') + m); if (!c) fails++; };
const isGtag = u => /googletagmanager\.com\/gtag\/js/.test(u), isCollect = u => /google-analytics\.com\/g\/collect/.test(u);
const isBeacon = u => /static\.cloudflareinsights\.com\/beacon\.min\.js/.test(u), isRum = u => /cloudflareinsights\.com\/cdn-cgi\/rum/.test(u);
const MOBILE = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 };

async function context(b, extra) {
  const ctx = await b.newContext(Object.assign({ locale: 'en-US' }, extra));
  if (PROXY) await ctx.route(/^https:\/\/cube-solver\.org\//, async r => {
    const u = new URL(r.request().url()), resp = await r.fetch({ url: PROXY + u.pathname + u.search });
    // source files keep placeholders for the analytics IDs (tools/build-dist.js injects the real ones into dist/ only):
    // fill them with CF_BEACON_TOKEN / GA_MEASUREMENT_ID from the environment, or with dummies (collection is stubbed anyway)
    if (/\/js\/analytics\.js$/.test(u.pathname)) return r.fulfill({ response: resp, body: (await resp.text())
      .replace(/__CF_BEACON_TOKEN__/g, CF_ID)
      .replace(/__GA_MEASUREMENT_ID__/g, GA_ID) });
    await r.fulfill({ response: resp });
  });
  if (STUB) await ctx.route(u => isCollect(u.href) || isRum(u.href), r => r.fulfill({ status: 204, headers: { 'access-control-allow-origin': 'https://cube-solver.org', 'access-control-allow-credentials': 'true', 'cross-origin-resource-policy': 'cross-origin' } }));
  const log = []; ctx.on('request', q => log.push({ url: q.url(), method: q.method(), post: q.postData() || '' }));
  const resp = []; ctx.on('response', r => resp.push({ url: r.url(), status: r.status() }));
  ctx.on('requestfailed', q => resp.push({ url: q.url(), status: 'failed ' + (q.failure() || {}).errorText }));
  return { ctx, log, resp };
}
const pageviews = log => log.filter(q => isCollect(q.url)).flatMap(q => [q.url, ...q.post.split('\n').map(l => q.url.split('?')[0] + '?' + l)])
  .filter(u => /[?&]en=page_view/.test(u)).map(u => decodeURIComponent((u.match(/[?&]dl=([^&]*)/) || [])[1] || ''));
const overlap = (a, b) => a && b && a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

async function bannerCheck(b, lang, path) {
  const { ctx } = await context(b, Object.assign({ locale: lang === 'zh-hans' ? 'zh-CN' : 'en-US' }, MOBILE));
  const p = await ctx.newPage();
  await p.goto(BASE.replace(/\/$/, '') + path, { waitUntil: 'load' });
  await p.waitForSelector('#consentBanner:not([hidden])', { timeout: 15000 }).catch(() => {});
  const r = await p.evaluate(() => {
    const box = e => { if (!e) return null; const b = e.getBoundingClientRect(); return { left: b.left, right: b.right, top: b.top, bottom: b.bottom, h: b.height }; };
    const ban = document.getElementById('consentBanner');
    const ctrls = ['#puzzleBtn', '#langBtn', '#shareBtn', '#ghLink', '#homeLink', '.mode-switch button, [data-mode]', '#btnSolve', '#btnScramble'].flatMap(s => [...document.querySelectorAll(s)])
      .filter(e => e.offsetParent && e.getBoundingClientRect().bottom <= innerHeight && e.getBoundingClientRect().top >= 0);
    return { shown: !!ban && !ban.hidden, text: ban && ban.querySelector('p').textContent, accept: ban && ban.querySelector('#consentAccept').textContent,
      ban: box(ban), vh: innerHeight, vw: innerWidth, ctrls: ctrls.map(e => ({ id: e.id || e.textContent.trim().slice(0, 12), b: box(e) })), overflowX: document.documentElement.scrollWidth > innerWidth };
  });
  ok(r.shown, `${lang} mobile: banner shown (“${(r.text || '').slice(0, 40)}…” / ${r.accept})`);
  ok(lang !== 'zh-hans' || /[\u4e00-\u9fff]/.test(r.text || ''), `${lang}: banner text is localized`);
  const hit = r.ctrls.filter(c => overlap(c.b, r.ban));
  ok(r.ban && r.ban.h <= 140 && r.ban.bottom <= r.vh && !hit.length, `${lang}: banner ${r.ban && Math.round(r.ban.h)} px high at the bottom, covers none of ${r.ctrls.length} visible main controls (${r.ctrls.map(c => c.id).join(', ')})` + (hit.length ? ' — covers ' + hit.map(c => c.id).join(', ') : ''));
  ok(!r.overflowX, `${lang}: no horizontal overflow`);
  await p.screenshot({ path: `${OUT}/banner-${lang}-mobile.png` });
  // player controls scrolled into view are not hidden behind the banner (page gets bottom padding)
  const pl = await p.evaluate(() => { const e = document.getElementById('btnPlay'); e.scrollIntoView({ block: 'end' }); window.scrollBy(0, 200);
    const a = e.getBoundingClientRect(), bb = document.getElementById('consentBanner').getBoundingClientRect(); return a.bottom <= bb.top || a.top >= bb.bottom || a.bottom < 0; });
  ok(pl, `${lang}: player controls can be scrolled clear of the banner`);
  await ctx.close();
}

(async () => {
  const b = await chromium.launch({ args: ['--enable-unsafe-swiftshader'] });
  console.log(`[analytics] ${BASE}${PROXY ? ' via ' + PROXY : ''}${STUB ? ' (collection stubbed)' : ''}`);

  // 1. no choice yet: banner, CF beacon on, no GA at all; isolation intact
  {
    const { ctx, log, resp } = await context(b, MOBILE); const p = await ctx.newPage(); const errs = [];
    p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
    await p.goto(BASE, { waitUntil: 'load' });
    await p.waitForTimeout(4000);
    const env = await p.evaluate(() => ({ iso: self.crossOriginIsolated, sab: typeof SharedArrayBuffer, cf: !!window.__cfBeacon, banner: !!document.querySelector('#consentBanner:not([hidden])'),
      link: !document.getElementById('consentLinkWrap').hidden, ga: typeof window.gtag }));
    ok(env.iso && env.sab === 'function', `crossOriginIsolated=${env.iso}, SharedArrayBuffer=${env.sab}`);
    const bs = resp.find(r => isBeacon(r.url));
    ok(bs && bs.status === 200 && env.cf, `Cloudflare beacon.min.js loaded (${bs && bs.status}) under COEP require-corp`);
    // the beacon reports on load and on page hide; leave the page to flush it
    await p.goto('about:blank'); await new Promise(r => setTimeout(r, 1500));
    const rum = log.filter(q => isRum(q.url));
    ok(rum.length > 0, `Cloudflare RUM request(s) sent: ${rum.length} (${rum.map(q => q.method).join(', ')})`);
    ok(env.banner && env.link, 'consent banner shown, footer “Analytics settings” link visible');
    ok(!log.some(q => isGtag(q.url) || isCollect(q.url)) && env.ga === 'undefined', 'before a choice: gtag.js not requested, no /g/collect');
    ok(!errs.filter(e => !/GL Driver|deprecated/.test(e)).length, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
    await ctx.close();
  }

  // 2. Decline: nothing from Google, also after reload and in-app navigation
  {
    const { ctx, log } = await context(b, {}); const p = await ctx.newPage();
    await p.goto(BASE, { waitUntil: 'load' }); await p.click('#consentDecline');
    await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(1500);
    const banner = await p.evaluate(() => !!document.querySelector('#consentBanner:not([hidden])'));
    await pickPuzzle(p, { index: 3 }); await p.waitForTimeout(3000);
    ok(!banner && (await p.evaluate(() => localStorage.getItem('cubelab.consent'))) === 'denied', 'Decline is remembered (no banner after reload)');
    ok(!log.some(q => isGtag(q.url) || isCollect(q.url)), 'after Decline: gtag.js never requested, no /g/collect (incl. reload + route change)');
    await ctx.close();
  }

  // 3. Accept: gtag.js loads under COEP, page_view on load and on route change; later Decline stops it
  {
    const { ctx, log, resp } = await context(b, {}); const p = await ctx.newPage();
    await p.goto(BASE, { waitUntil: 'load' });
    ok(!log.some(q => isGtag(q.url)), 'before Accept: gtag.js not requested');
    await p.click('#consentAccept');
    await p.waitForTimeout(5000);
    const g = resp.find(r => isGtag(r.url));
    ok(g && g.status === 200, `after Accept: gtag.js loaded (${g && g.status})`);
    let pv = pageviews(log);
    ok(pv.length === 1, `after Accept: 1 page_view to /g/collect (${pv.join(', ')})`);
    const consent = log.filter(q => isCollect(q.url)).map(q => (q.url.match(/[?&]gcs=([^&]*)/) || [])[1]);
    ok(consent.every(c => c === 'G101'), `consent state sent to GA: gcs=${[...new Set(consent)].join(',')} (analytics granted, ads denied)`);
    ok(await p.evaluate(() => self.crossOriginIsolated), 'still crossOriginIsolated with gtag.js loaded');
    const before = pv.length;
    await pickPuzzle(p, { index: 3 });
    await p.waitForFunction(() => /cube-solver\/$/.test(location.pathname), null, { timeout: 10000 }).catch(() => {});
    const path = await p.evaluate(() => location.pathname);
    // GA4 counts the history change itself (enhanced measurement) and may batch the hit for a few seconds
    for (let i = 0; i < (REAL_GA ? 40 : 10) && pageviews(log).length === before; i++) await p.waitForTimeout(500);
    await p.waitForTimeout(3000);
    pv = pageviews(log);
    if (REAL_GA) ok(pv.length === before + 1 && pv[pv.length - 1].includes(path), `route change → exactly one more page_view (${pv.slice(before).join(', ')})`);
    else { ok(pv.length <= before + 1, `route change → no double page_view (${pv.slice(before).join(', ')})`);
      console.log('  - skipped: route-change page_view needs a real GA_MEASUREMENT_ID (env or .env); run test:analytics:live'); }
    for (let i = 0; i < 20 && !log.some(q => isRum(q.url) && q.post.includes(path)); i++) await p.waitForTimeout(500);
    ok(log.some(q => isRum(q.url) && q.post.includes(path)), `route change → Cloudflare RUM request for ${path}`);
    // change the choice from the footer link
    await p.click('#consentSettings'); await p.click('#consentDecline');
    const n = log.filter(q => isCollect(q.url)).length;
    await pickPuzzle(p, { index: 4 }); await p.waitForTimeout(8000);
    const path2 = await p.evaluate(() => location.pathname);
    // a hit already queued before the Decline (e.g. the scroll to the footer) may still be flushed; nothing after it is sent
    const after = log.filter(q => isCollect(q.url)).slice(n).filter(q => (q.url + '&' + q.post).includes(encodeURIComponent('https://cube-solver.org' + path2)));
    ok(path2 !== path && !after.length, `after switching to Decline in the footer: no GA hit for later events (route to ${path2})` + (after.length ? ': ' + after.map(q => q.url.slice(-120)).join(' | ') : ''));
    ok(!(await p.evaluate(() => /(^|; )_ga/.test(document.cookie))), 'GA cookies removed after Decline');
    await ctx.close();
  }

  await bannerCheck(b, 'en', '/');
  await bannerCheck(b, 'zh-hans', '/zh-hans/');
  await b.close();
  console.log(fails ? `\nanalytics: ${fails} FAILED` : '\nanalytics: all passed');
  process.exit(fails ? 1 : 0);
})();
