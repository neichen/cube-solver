/* Puzzle menu order / default / names in each language; screenshots → screenshots/naming/.
   Run: node tests/naming.e2e.js [baseUrl] */
const path = require('path');
const { chromium } = require('playwright');
const BASE = (process.argv[2] || 'http://localhost:8765').replace(/\/+$/, '');
const OUT = path.join(__dirname, '..', 'screenshots', 'naming');
const ORDER = []; for (let n = 2; n <= 15; n++) ORDER.push('cube' + n); ORDER.push('pyraminx', 'skewb');
const EXP = {
  en: { dir: '', loc: 'en-US', cube2: '2×2 Cube', cube3: '3×3 Cube', cube10: '10×10 Cube', pyraminx: 'Pyraminx', skewb: 'Skewb' },
  'zh-Hans': { dir: '/zh-hans', loc: 'zh-CN', cube2: '二阶魔方（2×2）', cube3: '三阶魔方（3×3）', cube10: '十阶魔方（10×10）', pyraminx: '金字塔魔方', skewb: '斜转魔方' },
  'zh-Hant': { dir: '/zh-hant', loc: 'zh-TW', cube2: '二階魔術方塊（2×2）', cube3: '三階魔術方塊（3×3）', cube10: '十階魔術方塊（10×10）', pyraminx: '金字塔魔術方塊', skewb: '斜轉魔術方塊' },
  ja: { dir: '/ja', loc: 'ja-JP', cube2: '2×2キューブ', cube3: '3×3キューブ', cube10: '10×10キューブ', pyraminx: 'ピラミンクス', skewb: 'スキューブ' },
};
let fails = 0, passes = 0; const ok = (c, m) => { if (c) passes++; else { fails++; console.log('  ✘ FAIL:', m); } };
const menu = p => p.evaluate(() => { const s = document.getElementById('puzzleSelect'); return { value: s.value, sel: s.selectedOptions[0] && s.selectedOptions[0].value, opts: [...s.options].map(o => [o.value, o.textContent]), path: location.pathname, h1: document.getElementById('pageTitle').textContent, title: document.title, lang: document.documentElement.lang }; });
(async () => {
  const b = await chromium.launch();
  for (const [lang, E] of Object.entries(EXP)) {
    for (const vp of [{ width: 1440, height: 1000, tag: 'desktop' }, { width: 390, height: 844, tag: 'mobile' }]) {
      const ctx = await b.newContext({ locale: E.loc, viewport: { width: vp.width, height: vp.height } }); const p = await ctx.newPage();
      // fresh visit to the language root → 3×3 selected, order 2…15, Pyraminx, Skewb
      await p.goto(BASE + (E.dir || '') + '/'); await p.waitForFunction(() => window.app && app.P); await p.waitForTimeout(400);
      let m = await menu(p);
      ok(JSON.stringify(m.opts.map(o => o[0])) === JSON.stringify(ORDER), `${lang} ${vp.tag}: order ${m.opts.map(o => o[0]).join(',')}`);
      ok(m.value === 'cube3' && m.sel === 'cube3', `${lang} ${vp.tag}: default selection ${m.value}`);
      for (const k of ['cube2', 'cube3', 'cube10', 'pyraminx', 'skewb']) { const o = m.opts.find(x => x[0] === k); ok(o && o[1] === E[k], `${lang}: ${k} label "${o && o[1]}" (want "${E[k]}")`); }
      if (vp.tag === 'desktop') console.log(lang, m.opts.filter(o => ['cube2', 'cube3', 'cube4', 'cube10', 'pyraminx', 'skewb'].includes(o[0])).map(o => o[1]).join(' | '));
      // select not overflowing its box, no horizontal page overflow
      const ov = await p.evaluate(() => { const s = document.getElementById('puzzleSelect'), r = s.getBoundingClientRect(); return { pageOv: document.documentElement.scrollWidth > innerWidth + 1, right: r.right, vw: innerWidth }; });
      ok(!ov.pageOv && ov.right <= ov.vw, `${lang} ${vp.tag}: no overflow (${JSON.stringify(ov)})`);
      // expanded list screenshot (native dropdowns are not captured, so show it as a listbox)
      await p.evaluate(() => { const s = document.getElementById('puzzleSelect'); s.size = s.options.length; s.style.position = 'relative'; s.style.zIndex = 50; s.style.background = '#fff'; s.scrollIntoView({ block: 'start' }); });
      await p.waitForTimeout(200);
      await p.screenshot({ path: `${OUT}/${lang}-${vp.tag}-menu.png` });
      await p.evaluate(() => { const s = document.getElementById('puzzleSelect'); s.size = 0; s.style.cssText = ''; });
      // puzzle page preselects its puzzle
      for (const pz of ['cube2', 'cube10', 'skewb']) {
        const slug = pz.startsWith('cube') ? pz.slice(4) + 'x' + pz.slice(4) + '-cube-solver' : pz + '-solver';
        await p.goto(BASE + (E.dir || '') + '/' + slug + '/'); await p.waitForFunction(() => window.app && app.P); await p.waitForTimeout(300);
        m = await menu(p);
        ok(m.value === pz && m.sel === pz, `${lang} ${vp.tag}: /${slug}/ preselects ${m.value}`);
      }
      if (vp.tag === 'desktop') { await p.evaluate(() => scrollTo(0, 0)); await p.screenshot({ path: `${OUT}/${lang}-desktop-skewb-page.png` }); }
      // picking 4×4 from the menu moves to its page and its heading
      await p.selectOption('#puzzleSelect', 'cube4'); await p.waitForTimeout(800);
      m = await menu(p);
      ok(m.path === (E.dir || '') + '/4x4-cube-solver/' && m.value === 'cube4', `${lang} ${vp.tag}: pick cube4 → ${m.path} "${m.h1}"`);
      await ctx.close();
    }
  }
  // logo = link to the current language's home page; home always opens on 3×3 (no restoring the last puzzle)
  for (const lang of ['zh-Hans', 'en']) {
    const E = EXP[lang], root = (E.dir || '') + '/';
    for (const vp of [{ width: 1440, height: 1000, tag: 'desktop' }, { width: 390, height: 844, tag: 'mobile' }]) {
      const ctx = await b.newContext({ locale: E.loc, viewport: { width: vp.width, height: vp.height } }); const p = await ctx.newPage();
      for (const slug of ['4x4-cube-solver', 'skewb-solver']) {
        await p.goto(BASE + root + slug + '/'); await p.waitForFunction(() => window.app && app.P); await p.waitForTimeout(300);
        const a = await p.evaluate(() => { const l = document.getElementById('homeLink'); return l && { tag: l.tagName, href: l.getAttribute('href'), label: l.getAttribute('aria-label') }; });
        ok(a && a.tag === 'A' && a.href === root && a.label, `${lang} ${vp.tag} /${slug}/: logo is <a href="${root}"> with a label (${JSON.stringify(a)})`);
        await Promise.all([p.waitForNavigation(), p.click('#homeLink')]);
        await p.waitForFunction(() => window.app && app.P); await p.waitForTimeout(300);
        const m = await menu(p);
        ok(m.path === root && m.value === 'cube3' && m.sel === 'cube3', `${lang} ${vp.tag}: logo from /${slug}/ → ${m.path}, selected ${m.value}`);
      }
      // pick 5×5, then come back to the home page (typed URL and logo) → still 3×3
      await p.selectOption('#puzzleSelect', 'cube5'); await p.waitForTimeout(800);
      let m = await menu(p);
      ok(m.value === 'cube5' && m.path === root + '5x5-cube-solver/', `${lang} ${vp.tag}: picking 5×5 → ${m.path}`);
      await p.goto(BASE + root); await p.waitForFunction(() => window.app && app.P); await p.waitForTimeout(300);
      m = await menu(p);
      ok(m.path === root && m.value === 'cube3' && m.sel === 'cube3', `${lang} ${vp.tag}: revisit ${root} after 5×5 → ${m.value}`);
      await p.goto(BASE + root + '5x5-cube-solver/'); await p.waitForFunction(() => window.app && app.P);
      await Promise.all([p.waitForNavigation(), p.click('#homeLink')]); await p.waitForFunction(() => window.app && app.P); await p.waitForTimeout(300);
      m = await menu(p);
      ok(m.path === root && m.value === 'cube3', `${lang} ${vp.tag}: logo from 5×5 page → ${m.path} ${m.value}`);
      const ls = await p.evaluate(() => localStorage.getItem('cubelab.puzzle'));
      ok(ls === null, `${lang} ${vp.tag}: last puzzle not stored (${ls})`);
      if (vp.tag === 'desktop') await p.screenshot({ path: `${OUT}/${lang}-home-after-logo.png` });
      await ctx.close();
    }
  }
  // other preferences are still remembered: language choice on the root, sound toggle
  {
    const ctx = await b.newContext({ locale: 'en-US', viewport: { width: 1440, height: 1000 } }); const p = await ctx.newPage();
    await p.goto(BASE + '/'); await p.waitForFunction(() => window.app && app.P);
    await p.selectOption('#langSelect', 'ja'); await p.waitForTimeout(800);
    await p.goto(BASE + '/'); await p.waitForFunction(() => window.app && app.P); await p.waitForTimeout(800);
    const r = await p.evaluate(() => ({ lang: app.i18n.lang(), href: document.getElementById('homeLink').getAttribute('href'), v: document.getElementById('puzzleSelect').value }));
    ok(r.lang === 'ja' && r.href === '/ja/' && r.v === 'cube3', `saved language kept on / (${JSON.stringify(r)}), logo → /ja/`);
    // old ?puzzle= links still open that puzzle
    await p.goto(BASE + '/?puzzle=cube7'); await p.waitForFunction(() => window.app && app.P); await p.waitForTimeout(500);
    const q = await menu(p);
    ok(q.value === 'cube7' && /7x7-cube-solver\/$/.test(q.path), `?puzzle=cube7 → ${q.path} ${q.value}`);
    await ctx.close();
  }
  await b.close();
  console.log(fails ? `NAMING E2E: ${fails} FAILED, ${passes} passed` : `NAMING E2E: ALL PASS (${passes})`);
  process.exit(fails ? 1 : 0);
})();
