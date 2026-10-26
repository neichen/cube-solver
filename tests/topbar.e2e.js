/* Top bar: icon puzzle / language menus (mouse + keyboard + RTL), GitHub link, share popover and share-link round trips.
   Screenshots → screenshots/header/ (gitignored).   Run: node tests/topbar.e2e.js [baseUrl] */
const path = require('path'), fs = require('fs');
const { chromium } = require('playwright');
const R = require('../js/seo-routes.js');
const BASE = (process.argv[2] || 'http://localhost:8765').replace(/\/+$/, '');
const OUT = path.join(__dirname, '..', 'screenshots', 'header'); fs.mkdirSync(OUT, { recursive: true });
let fails = 0, passes = 0; const ok = (c, m) => { if (c) passes++; else { fails++; console.log('  ✘ FAIL:', m); } };
const ready = p => p.waitForFunction(() => window.app && app.P && document.body.dataset.puzzle === app.P.id, null, { timeout: 30000 });
const focused = p => p.evaluate(() => { const a = document.activeElement; return a && (a.id || a.dataset.pid || a.dataset.lang); });
const shot = (p, name, clip) => p.screenshot({ path: path.join(OUT, name + '.png'), clip });
async function headerShot(p, name, extra) {
  const r = await p.evaluate(sel => { const els = [document.querySelector('.topbar')].concat(sel ? [document.querySelector(sel)] : []); let b = null;
    els.forEach(e => { if (!e) return; const q = e.getBoundingClientRect(); b = b ? { l: Math.min(b.l, q.left), t: Math.min(b.t, q.top), r: Math.max(b.r, q.right), b: Math.max(b.b, q.bottom) } : { l: q.left, t: q.top, r: q.right, b: q.bottom }; });
    return { x: Math.max(0, b.l - 4), y: Math.max(0, b.t - 4), width: Math.min(innerWidth, b.r + 4) - Math.max(0, b.l - 4), height: b.b - b.t + 12 }; }, extra || null);
  await shot(p, name, r);
}

(async () => {
  const b = await chromium.launch();
  const errs = [];
  const ctxOpts = { viewport: { width: 1440, height: 900 }, locale: 'en-US', permissions: ['clipboard-read', 'clipboard-write'] };
  let ctx = await b.newContext(ctxOpts), p = await ctx.newPage();
  p.on('pageerror', e => errs.push(String(e)));
  await p.goto(BASE + '/'); await ready(p); await p.waitForTimeout(300);

  // ---------------------------------------------------------------- structure
  const st = await p.evaluate(() => {
    const q = s => document.querySelector(s), gh = q('#ghLink');
    return { selects: document.querySelectorAll('#puzzleSelect, #langSelect').length, pb: !!q('#puzzleBtn'), hp: q('#puzzleBtn').getAttribute('aria-haspopup'),
      exp: q('#puzzleBtn').getAttribute('aria-expanded'), pmHidden: q('#puzzleMenu').hidden, lmHidden: q('#langMenu').hidden,
      items: [...document.querySelectorAll('#puzzleMenu [role=menuitem]')].map(a => [a.dataset.pid, a.getAttribute('href')]),
      langs: [...document.querySelectorAll('#langMenu [role=menuitem]')].map(a => [a.dataset.lang, a.getAttribute('href'), a.getAttribute('hreflang'), a.textContent]),
      gh: gh && { href: gh.href, target: gh.target, rel: gh.rel, label: gh.getAttribute('aria-label'), svg: !!gh.querySelector('svg path') },
      sizes: [...document.querySelectorAll('.tb-btn')].map(e => { const r = e.getBoundingClientRect(); return [e.id, Math.round(r.width), Math.round(r.height)]; }),
      label: q('#puzzleName').textContent, code: q('.tb-code').textContent };
  });
  ok(st.selects === 0 && st.pb && st.hp === 'true' && st.exp === 'false' && st.pmHidden && st.lmHidden, 'menu buttons replace the selects ' + JSON.stringify(st).slice(0, 200));
  ok(JSON.stringify(st.items.map(i => i[0])) === JSON.stringify(R.PUZZLES), 'puzzle menu order');
  ok(st.items.every(([id, h]) => h === R.path('en', id)), 'puzzle items link to their pages');
  ok(st.langs.length === 12 && st.langs.every(([c, h]) => h === R.path(c, null)), 'language items link to each root ' + JSON.stringify(st.langs.slice(0, 2)));
  ok(st.langs.find(l => l[0] === 'ja')[3].includes('日本語'), 'native language names');
  ok(st.gh && st.gh.href === 'https://github.com/neichen/cube-solver' && st.gh.target === '_blank' && /noopener/.test(st.gh.rel) && st.gh.label === 'Source code on GitHub' && st.gh.svg, 'GitHub link ' + JSON.stringify(st.gh));
  ok(st.sizes.length === 4 && st.sizes.every(s => s[1] >= 44 && s[2] >= 44), 'targets ≥44px ' + JSON.stringify(st.sizes));
  ok(st.label === '3×3 Cube' && st.code === 'EN', 'button labels ' + st.label + ' ' + st.code);
  await headerShot(p, 'desktop-header');

  // ---------------------------------------------------------------- puzzle menu: mouse + keyboard
  await p.click('#puzzleBtn');
  ok(await p.evaluate(() => !document.getElementById('puzzleMenu').hidden && document.getElementById('puzzleBtn').getAttribute('aria-expanded') === 'true'), 'click opens the puzzle menu');
  ok(await focused(p) === 'cube3', 'focus on the current puzzle');
  const itemSize = await p.evaluate(() => [...document.querySelectorAll('#puzzleMenu a')].every(a => a.getBoundingClientRect().height >= 44 && a.getBoundingClientRect().width >= 44));
  ok(itemSize, 'menu items ≥44px');
  await headerShot(p, 'desktop-puzzle-menu', '#puzzleMenu');
  await p.keyboard.press('ArrowRight'); ok(await focused(p) === 'cube4', 'ArrowRight → next');
  await p.keyboard.press('ArrowDown'); ok(await focused(p) === 'cube7', 'ArrowDown → next row (3 columns)');
  await p.keyboard.press('ArrowLeft'); ok(await focused(p) === 'cube6', 'ArrowLeft → previous');
  await p.keyboard.press('Home'); ok(await focused(p) === 'cube2', 'Home');
  await p.keyboard.press('ArrowUp'); ok(await focused(p) === 'megaminx' || await focused(p) === 'skewb', 'ArrowUp from the first row wraps to the last row');
  await p.keyboard.press('Escape');
  ok(await p.evaluate(() => document.getElementById('puzzleMenu').hidden) && await focused(p) === 'puzzleBtn', 'Esc closes, focus back on the button');
  await p.keyboard.press('Enter'); ok(await p.evaluate(() => !document.getElementById('puzzleMenu').hidden), 'Enter opens');
  await p.keyboard.press('End'); ok(await focused(p) === 'megaminx', 'End');
  await p.keyboard.press('Enter');
  await p.waitForFunction(() => app.P.id === 'megaminx' && location.pathname === '/megaminx-solver/', null, { timeout: 30000 });
  ok(await focused(p) === 'puzzleBtn' && await p.evaluate(() => document.getElementById('puzzleName').textContent === 'Megaminx' && document.getElementById('puzzleBtn').getAttribute('aria-label').includes('Megaminx')), 'Enter picks megaminx, address + label follow, focus kept');
  await p.keyboard.press('ArrowDown'); ok(await focused(p) === 'megaminx', 'ArrowDown on the button opens on the current item');
  await p.keyboard.press('Tab'); ok(await p.evaluate(() => document.getElementById('puzzleMenu').hidden), 'Tab closes');
  await p.click('#puzzleBtn'); await p.mouse.click(700, 600);
  ok(await p.evaluate(() => document.getElementById('puzzleMenu').hidden), 'outside click closes');
  await p.click('#puzzleBtn'); await p.click('#puzzleMenu a[data-pid="cube5"]');
  await p.waitForFunction(() => app.P.id === 'cube5' && location.pathname === '/5x5-cube-solver/');
  ok(true, 'mouse pick');
  await p.keyboard.press('Space').catch(() => {});

  // ---------------------------------------------------------------- language menu
  await p.click('#langBtn');
  const lh = await p.evaluate(() => [...document.querySelectorAll('#langMenu a')].map(a => a.getAttribute('href')));
  ok(lh.includes('/ja/5x5-cube-solver/') && lh.includes('/5x5-cube-solver/'), 'language links follow the current page ' + lh.slice(0, 3));
  ok(await focused(p) === 'en', 'focus on the current language');
  await headerShot(p, 'desktop-lang-menu', '#langMenu');
  await p.keyboard.press('ArrowDown'); await p.keyboard.press('ArrowDown');   // 2 columns: en → es → pt? (row-wise)
  await p.keyboard.press('Escape');
  await p.click('#langBtn'); await p.click('#langMenu a[data-lang="ja"]');
  await p.waitForFunction(() => document.documentElement.lang === 'ja' && location.pathname === '/ja/5x5-cube-solver/', null, { timeout: 30000 });
  ok(await p.evaluate(() => document.querySelector('.tb-code').textContent === 'JA' && document.getElementById('puzzleName').textContent === '5×5キューブ' && document.getElementById('ghLink').getAttribute('aria-label') === 'GitHub のソースコード'), 'language switch relabels the top bar');
  await p.click('#langBtn'); await p.click('#langMenu a[data-lang="en"]');
  await p.waitForFunction(() => document.documentElement.lang === 'en');

  // ---------------------------------------------------------------- share popover
  await p.evaluate(() => app.mount('cube3')); await ready(p);
  await p.click('#shareBtn');
  const sp = await p.evaluate(() => {
    const q = s => document.querySelector(s);
    return { open: !q('#sharePanel').hidden, url: q('#shareUrl').value, nets: [...document.querySelectorAll('.share-net')].map(a => [a.dataset.net, a.href, a.target, a.rel]),
      cb: q('#shareWithState') && q('#shareWithState').checked, focus: document.activeElement.closest('#sharePanel') != null };
  });
  ok(sp.open && sp.focus, 'share panel opens and takes focus');
  ok(/\/3x3-cube-solver\/#p=cube3&s=[A-Za-z0-9_-]{27}$/.test(sp.url), 'share URL carries the position ' + sp.url);
  const x = sp.nets.find(n => n[0] === 'x');
  ok(x && x[1].startsWith('https://x.com/intent/post?text=') && x[1].includes(encodeURIComponent(sp.url)) && x[2] === '_blank' && /noopener/.test(x[3]), 'X intent link');
  ok(['facebook', 'reddit', 'whatsapp', 'telegram', 'email'].every(k => sp.nets.some(n => n[0] === k)) && !sp.nets.some(n => n[0] === 'weibo'), 'network list (en) ' + sp.nets.map(n => n[0]));
  await headerShot(p, 'desktop-share', '#sharePanel');
  await p.click('#shareCopy');
  await p.waitForFunction(() => document.getElementById('toast') && document.getElementById('toast').classList.contains('show'));
  const clip = await p.evaluate(() => navigator.clipboard.readText());
  ok(clip === sp.url, 'copy link → clipboard');
  ok(await p.evaluate(() => document.getElementById('sharePanel').hidden), 'panel closes after copy');
  await p.click('#shareBtn'); await p.click('.share-state');
  ok(/\/3x3-cube-solver\/$/.test(await p.inputValue('#shareUrl')), 'unchecking the position gives the clean page URL');
  await p.click('.share-state'); ok(await p.isChecked('#shareWithState'), 're-check'); await p.keyboard.press('Escape');
  ok(await focused(p) === 'shareBtn', 'Esc closes the share panel, focus back');
  // PNG
  await p.click('#shareBtn');
  const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 10000 }).catch(() => null), p.click('#shareImage')]);
  ok(dl && dl.suggestedFilename() === 'cube-solver-cube3.png', 'PNG download ' + (dl && dl.suggestedFilename()));
  if (dl) { const fp = await dl.path(); const buf = fs.readFileSync(fp); ok(buf.slice(1, 4).toString() === 'PNG' && buf.length > 5000, 'PNG data ' + buf.length); }
  // zh-Hans shows Weibo, ja shows LINE
  for (const [lang, net] of [['zh-Hans', 'weibo'], ['ja', 'line'], ['ru', 'vk']]) {
    await p.evaluate(l => app.i18n.setLang(l), lang); await p.waitForFunction(l => document.documentElement.lang === l, lang);
    await p.click('#shareBtn');
    const nets = await p.evaluate(() => [...document.querySelectorAll('.share-net')].map(a => a.dataset.net));
    ok(nets[0] === net || nets.includes(net), lang + ': ' + net + ' offered ' + nets);
    if (lang === 'zh-Hans') { ok(/魔方/.test(await p.evaluate(() => decodeURIComponent(document.querySelector('[data-net=weibo]').href))), 'zh share text'); }
    await p.keyboard.press('Escape');
  }
  await p.evaluate(() => app.i18n.setLang('en')); await p.waitForFunction(() => document.documentElement.lang === 'en');

  // ---------------------------------------------------------------- share-link round trips (solve mode)
  for (const id of ['cube3', 'cube4', 'cube15', 'pyraminx', 'skewb', 'megaminx']) {
    await p.evaluate(i => app.mount(i), id); await ready(p);
    if (id === 'cube4') await p.evaluate(() => { const s = app.getState(); s[0] = null; s[5] = null; app.setEditor(s); });   // partly painted
    const want = await p.evaluate(() => app.getState());
    await p.click('#shareBtn'); const url = await p.inputValue('#shareUrl'); await p.keyboard.press('Escape');
    const q = await ctx.newPage(); q.on('pageerror', e => errs.push(String(e)));
    await q.goto(url); await ready(q);
    await q.waitForFunction(() => !location.hash);
    const got = await q.evaluate(() => ({ id: app.P.id, st: app.getState(), path: location.pathname, canon: document.querySelector('link[rel=canonical]').href, toast: document.getElementById('toast') && document.getElementById('toast').textContent }));
    ok(got.id === id && JSON.stringify(got.st) === JSON.stringify(want), id + ': shared position restored (' + url.length + ' chars)');
    ok(got.path === R.path('en', id) && !/#/.test(got.canon), id + ': clean address / canonical');
    ok(got.toast === 'Shared position loaded', id + ': notice ' + got.toast);
    await q.close();
  }
  // shared position opened on another page/language (fragment wins over the page puzzle)
  { await p.evaluate(() => app.mount('skewb')); await ready(p); const want = await p.evaluate(() => app.getState());
    const h = await p.evaluate(() => app.shareState()); const code = h.s;
    const q = await ctx.newPage(); await q.goto(BASE + '/fr/#p=skewb&s=' + code); await ready(q); await q.waitForFunction(() => !location.hash);
    ok(await q.evaluate(w => app.P.id === 'skewb' && JSON.stringify(app.getState()) === w, JSON.stringify(want)), 'fragment puzzle wins on another page');
    // hashchange on an open page
    await q.evaluate(c => { location.hash = '#p=cube4&s=' + c; }, await p.evaluate(() => { return null; }) || 'x');
    await q.waitForTimeout(800);
    ok(await q.evaluate(() => app.P.id === 'skewb'), 'damaged fragment via hashchange is ignored');
    await q.close(); }

  // ---------------------------------------------------------------- play mode: scramble + time
  for (const id of ['cube3', 'megaminx']) {
    await p.evaluate(i => app.mount(i), id); await ready(p);
    await p.evaluate(() => app.setMode('play'));
    const t0 = await p.evaluate(() => {
      const P = app.P, tok = Object.keys(P.moves).find(k => !/^[xyz]/.test(k) && P.moves[k] && !P.moves[k].rotation);
      const st = P.apply(P.solvedState(), [tok]);
      const inv = P.parse(P.format ? P.format(P.invert ? P.invert([tok]) : [tok]) : tok);
      app.play.start(st, true);
      return { st, tok };
    });
    // solve it: undo the single move by applying its inverse via the parser (3 quarter turns for a quarter move)
    await p.evaluate(tok => { let s = 0; while (!app.P.isSolved(app.play.state()) && s++ < 6) app.play.turn(tok); }, t0.tok);
    await p.waitForFunction(() => app.play.timer().state === 'done');
    const ss = await p.evaluate(() => app.shareState());
    ok(ss.m === 'play' && ss.t != null && JSON.stringify(ss.s) !== 'null', id + ': play share carries scramble + time ' + JSON.stringify(ss).slice(0, 120));
    await p.click('#shareBtn');
    const url = await p.inputValue('#shareUrl');
    const txt = await p.evaluate(() => decodeURIComponent(new URL(document.querySelector('[data-net=x]').href).searchParams.get('text')));
    ok(/&m=play&t=\d+$/.test(url) && /^I solved this .* scramble in [\d.:]+s?\. Can you beat it\?$/.test(txt), id + ': play share text "' + txt + '"');
    if (id === 'cube3') await headerShot(p, 'desktop-share-play', '#sharePanel');
    await p.keyboard.press('Escape');
    const q = await ctx.newPage(); await q.goto(url); await ready(q); await q.waitForFunction(() => !location.hash && app.mode() === 'play');
    const got = await q.evaluate(() => ({ start: app.player.states[0], timer: app.play.timer().state, msg: document.getElementById('playMsg').textContent }));
    ok(JSON.stringify(got.start) === JSON.stringify(t0.st) && /^(ready|inspect)$/.test(got.timer), id + ': recipient gets the scramble with the timer armed ' + got.timer);
    ok(/sender solved it in [\d.:]+s?/.test(got.msg), id + ': time shown "' + got.msg + '"');
    await q.close();
    await p.evaluate(() => app.setMode('solve'));
  }

  // ---------------------------------------------------------------- invalid links
  for (const h of ['#p=cube3&s=!!!', '#p=cube4&s=AAAA', '#p=nope&s=AAAA', '#p=cube3&s=' + 'A'.repeat(26) + 'B&m=play']) {
    const q = await ctx.newPage(); const qe = []; q.on('pageerror', e => qe.push(String(e)));
    await q.goto(BASE + '/3x3-cube-solver/' + h); await ready(q);
    await q.waitForFunction(() => document.getElementById('toast') && document.getElementById('toast').classList.contains('show'), null, { timeout: 8000 }).catch(() => {});
    const r = await q.evaluate(() => ({ toast: document.getElementById('toast') && document.getElementById('toast').textContent, hash: location.hash, mode: app.mode() }));
    ok(r.toast === 'This share link is invalid or damaged, so it was ignored.' && !r.hash && r.mode === 'solve' && !qe.length, 'invalid ' + h.slice(0, 30) + ' → ' + JSON.stringify(r) + qe);
    await q.close();
  }
  await ctx.close();

  // ---------------------------------------------------------------- mobile + Arabic (RTL)
  for (const [lang, dir, tag] of [['en', '', 'mobile'], ['ar', '/ar', 'ar-mobile'], ['ar', '/ar', 'ar-desktop']]) {
    const vp = tag === 'ar-desktop' ? { width: 1280, height: 860 } : { width: 390, height: 844 };
    ctx = await b.newContext({ viewport: vp, locale: lang === 'ar' ? 'ar' : 'en-US', hasTouch: tag !== 'ar-desktop', isMobile: tag !== 'ar-desktop', deviceScaleFactor: 2 });
    p = await ctx.newPage(); p.on('pageerror', e => errs.push(String(e)));
    await p.goto(BASE + dir + '/3x3-cube-solver/'); await ready(p); await p.waitForTimeout(300);
    const m = await p.evaluate(() => ({ dir: document.documentElement.dir, ov: document.documentElement.scrollWidth > innerWidth + 1,
      label: getComputedStyle(document.getElementById('puzzleName')).display,
      sizes: [...document.querySelectorAll('.tb-btn')].map(e => { const r = e.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height), Math.round(r.left), Math.round(r.right)]; }) }));
    ok(m.dir === (lang === 'ar' ? 'rtl' : 'ltr') && !m.ov, tag + ': dir + no overflow ' + JSON.stringify(m));
    ok(m.sizes.every(s => s[0] >= 44 && s[1] >= 44 && s[2] >= 0 && s[3] <= vp.width), tag + ': buttons ≥44px and on screen');
    if (tag !== 'ar-desktop') ok(m.label === 'none', tag + ': puzzle button is icon-only on phones');
    await headerShot(p, tag + '-header');
    for (const [btn, menu] of [['#puzzleBtn', '#puzzleMenu'], ['#langBtn', '#langMenu'], ['#shareBtn', '#sharePanel']]) {
      await p.click(btn);
      const r = await p.evaluate(s => { const e = document.querySelector(s).getBoundingClientRect(); return { l: e.left, r: e.right, vw: innerWidth }; }, menu);
      ok(r.l >= 0 && r.r <= r.vw + 0.5, tag + ' ' + menu + ' inside the viewport ' + JSON.stringify(r));
      await headerShot(p, tag + '-' + menu.slice(1).replace(/[A-Z].*/, '') + '-menu', menu);
      if (menu === '#puzzleMenu' && lang === 'ar') {
        ok(await focused(p) === 'cube3', 'ar: focus on current');
        await p.keyboard.press('ArrowLeft'); ok(await focused(p) === 'cube4', 'RTL: ArrowLeft moves forward');
        await p.keyboard.press('ArrowRight'); ok(await focused(p) === 'cube3', 'RTL: ArrowRight moves back');
        const pos = await p.evaluate(() => { const a = document.querySelector('#puzzleMenu [data-pid=cube2]').getBoundingClientRect(), c = document.querySelector('#puzzleMenu [data-pid=cube3]').getBoundingClientRect(); return [a.left, c.left]; });
        ok(pos[0] > pos[1], 'RTL: grid flows right to left');
      }
      await p.keyboard.press('Escape');
    }
    await ctx.close();
  }
  ok(!errs.length, 'no page errors ' + errs.join(' | '));
  await b.close();
  console.log(`topbar e2e: ${passes} passed, ${fails} failed · screenshots in ${path.relative(process.cwd(), OUT)}`);
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
