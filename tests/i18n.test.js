/* i18n end-to-end: all 12 languages × desktop (1440×1000) and mobile (390×844).
   Checks: language detected from the browser locale, <html lang/dir>, title/description, no missing keys,
   no leftover strings from other languages, no horizontal overflow, no text overflowing buttons/tabs/toggles/swatches
   (paint / scan / notation tabs, solution and error states), Arabic RTL with LTR islands, persistence across reload.
   Also writes screenshots/i18n/{lang}-{desktop|mobile}.png for en, zh-Hant, ar, de, ja.
   Run: node tests/i18n.test.js [baseUrl] [--no-shots] */
const path = require('path'), fs = require('fs');
const { chromium } = require('playwright');
const BASE = process.argv.find(a => /^https?:/.test(a)) || 'http://localhost:8765/';
const SHOTS = !process.argv.includes('--no-shots');
const SHOT_DIR = path.join(__dirname, '..', 'screenshots', 'i18n');
let fails = 0, passes = 0;
const ok = (c, m) => { if (c) { passes++; } else { fails++; console.log('  ✘ FAIL:', m); } };

const LOCALES = { en: 'en-US', 'zh-Hans': 'zh-CN', 'zh-Hant': 'zh-TW', es: 'es-ES', ar: 'ar-EG', pt: 'pt-BR', id: 'id-ID', ms: 'ms-MY', fr: 'fr-FR', ja: 'ja-JP', ru: 'ru-RU', de: 'de-DE' };
const ORDER = Object.keys(LOCALES);
const SHOT_LANGS = ['en', 'zh-Hant', 'ar', 'de', 'ja'];
const VIEWPORTS = {
  desktop: { viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 },
  mobile: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }
};

async function ready(p) { await p.waitForFunction(() => document.body.dataset.solverReady === '1', null, { timeout: 30000 }); }

// layout audit run inside the page
function audit() {
  const vw = document.documentElement.clientWidth, res = { hOverflow: document.documentElement.scrollWidth - vw, bad: [], offscreen: [] };
  const vis = el => { const r = el.getBoundingClientRect(), cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'; };
  const name = el => (el.id ? '#' + el.id : el.className ? el.tagName.toLowerCase() + '.' + String(el.className).split(' ').join('.') : el.tagName) + ' "' + (el.textContent || '').trim().slice(0, 40) + '"';
  const sel = '.btn, .tab, .swatch, .scan-step, .toggle, .vol, .speed, .badge, .puzzle-pick, .field, .mv, .now-move, .counter, select, h1, h2, .sol-head b';
  for (const el of document.querySelectorAll(sel)) {
    if (!vis(el) || el.closest('[hidden]')) continue;
    const r = el.getBoundingClientRect();
    let scroller = false; for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) if (/auto|scroll/.test(getComputedStyle(a).overflowX)) { scroller = true; break; }
    if (!scroller && (r.left < -1 || r.right > vw + 1)) res.offscreen.push(name(el) + ` [${Math.round(r.left)},${Math.round(r.right)}]`);
    if (el.tagName === 'SELECT' || el.classList.contains('mv')) continue;
    if (el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflowX === 'visible') res.bad.push(name(el) + ` scrollW ${el.scrollWidth}>${el.clientWidth}`);
    // every text run must sit inside the element's box
    const rg = document.createRange(); rg.selectNodeContents(el);
    for (const tr of rg.getClientRects()) {
      if (!tr.width) continue;
      if (tr.left < r.left - 1.5 || tr.right > r.right + 1.5 || tr.top < r.top - 3 || tr.bottom > r.bottom + 3) { res.bad.push(name(el) + ` text [${Math.round(tr.left)}..${Math.round(tr.right)}]×[${Math.round(tr.top)}..${Math.round(tr.bottom)}] outside [${Math.round(r.left)}..${Math.round(r.right)}]×[${Math.round(r.top)}..${Math.round(r.bottom)}]`); break; }
    }
  }
  return res;
}
// collect user-visible strings (text nodes outside the language picker, plus title/aria-label/placeholder)
function visibleStrings() {
  const out = [], w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let n; while ((n = w.nextNode())) { const p = n.parentElement; if (!p || p.closest('#langSelect, script, style, [hidden]')) continue; const s = n.textContent.trim(); if (s) out.push(s); }
  for (const el of document.querySelectorAll('[title],[aria-label],[placeholder]')) { if (el.closest('#langSelect')) continue; for (const a of ['title', 'aria-label', 'placeholder']) { const v = el.getAttribute(a); if (v) out.push(v); } }
  return out;
}

(async () => {
  const browser = await chromium.launch();
  if (SHOTS) fs.mkdirSync(SHOT_DIR, { recursive: true });

  for (const [vpName, vp] of Object.entries(VIEWPORTS)) {
    for (const lang of ORDER) {
      const tag = `[${lang} ${vpName}]`;
      const ctx = await browser.newContext({ ...vp, locale: LOCALES[lang] });
      const p = await ctx.newPage(); const errs = [];
      p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
      await p.goto(BASE); await ready(p);
      const dict = await p.evaluate(l => ({ title: app.i18n.t('meta.title'), desc: app.i18n.t('meta.description'), rawTitle: app.i18n.dicts[l]['meta.title'], html: app.i18n.info(l).html }), lang);
      const head = await p.evaluate(async () => { await CubeLab.seoNav.ready; return { lang: document.documentElement.lang, dir: document.documentElement.dir, cur: app.i18n.lang(), title: document.title, desc: document.querySelector('meta[name=description]').content, sel: langSelect.value }; });
      // the title / description now come from the prerendered page of that language (tools/build-seo.js)
      const pre = await p.evaluate(async l => { const d = new DOMParser().parseFromString(await (await fetch(CubeLab.seoRoutes.path(l, null))).text(), 'text/html'); return { title: d.title, desc: d.querySelector('meta[name=description]').content }; }, lang);
      ok(head.cur === lang && head.sel === lang, `${tag} detected from navigator locale ${LOCALES[lang]} (got ${head.cur}, select ${head.sel})`);
      ok(head.lang === dict.html, `${tag} <html lang="${dict.html}"> (got ${head.lang})`);
      ok(head.dir === (lang === 'ar' ? 'rtl' : 'ltr'), `${tag} <html dir> = ${head.dir}`);
      ok(head.title === pre.title && head.desc === pre.desc && pre.title.length > 20, `${tag} per-language title + meta description (prerendered page): ${head.title}`);

      // build up a realistic UI: scramble → solve → step once (move explanation shown)
      await p.evaluate(() => { btnScramble.click(); btnSolve.click(); }); await p.waitForSelector('#solutionBox:not([hidden])');
      await p.evaluate(() => app.player.next()); await p.waitForTimeout(700);
      const states = {};
      states.solution = await p.evaluate(audit);
      const notation = await p.evaluate(() => ({ chips: [...document.querySelectorAll('#moves .mv')].map(b => b.textContent), sol: solText.textContent, ths: [...document.querySelectorAll('.notation th')].map(t => t.textContent).join(' ') }));
      for (const tab of ['scan', 'formula', 'paint']) {
        await p.evaluate(t => document.querySelector(`.tab[data-tab=${t}]`).click(), tab); await p.waitForTimeout(250);
        if (tab === 'formula') { await p.fill('#formula', "R U R' Q2"); await p.evaluate(() => btnApplyFormula.click()); await p.waitForTimeout(100); }
        states[tab] = await p.evaluate(audit);
      }
      await p.evaluate(() => btnClear.click()); await p.waitForTimeout(200);           // validation error state
      states.error = await p.evaluate(audit);
            for (const [k, a] of Object.entries(states)) {
        ok(a.hOverflow <= 1, `${tag} ${k}: no horizontal page overflow (scrollWidth excess ${a.hOverflow}px)`);
        ok(a.offscreen.length === 0, `${tag} ${k}: controls inside viewport: ${a.offscreen.slice(0, 4).join(' | ')}`);
        ok(a.bad.length === 0, `${tag} ${k}: no text overflowing its box: ${a.bad.slice(0, 4).join(' | ')}`);
      }
      // translated content checks
      const info = await p.evaluate(l => ({ missing: app.i18n.missing.filter(x => x.startsWith(l + ':')), formulaMsg: formulaMsg.textContent, val: validation.textContent, strings: null }), lang);
      ok(info.missing.length === 0, `${tag} no missing keys: ${info.missing.slice(0, 6)}`);
      const expectBad = await p.evaluate(() => app.i18n.t('formula.badMove', { tok: 'Q2' }));
      ok(info.formulaMsg.includes(expectBad), `${tag} parse error localized: "${info.formulaMsg}"`);
      const expectUnp = await p.evaluate(() => app.i18n.t('v.unpainted', { n: 48 }));
      ok(info.val.includes(expectUnp), `${tag} validation error localized + pluralized: "${info.val.slice(0, 80)}"`);
      // leftover strings from another language: no Han/Kana in non-CJK locales, no Cyrillic/Arabic outside their locales
      const strs = await p.evaluate(visibleStrings);
      const foreign = strs.filter(s => (!/^(zh|ja)/.test(lang) && /[\u3040-\u30ff\u4e00-\u9fff]/.test(s)) || (lang !== 'ru' && /[\u0400-\u04ff]/.test(s)) || (lang !== 'ar' && /[\u0600-\u06ff]/.test(s)));
      ok(foreign.length === 0, `${tag} no strings left in another script: ${foreign.slice(0, 3).join(' | ')}`);
      if (lang !== 'en') {
        const enSame = await p.evaluate(() => { const en = app.i18n.dicts.en; return ['tab.paint', 'btn.scramble', 'solve.button', 'player.speed'].filter(k => new RegExp('(^|[^\\p{L}])' + en[k].replace(/^\S+ /, '') + '($|[^\\p{L}])', 'u').test(document.body.innerText) && en[k] !== app.i18n.t(k)); });
        ok(enSame.length === 0, `${tag} no English fallbacks visible: ${enSame}`);
      }
      // move notation stays standard letters
      ok(notation.chips.length > 0 && notation.chips.every(c => /^[UDLRFBMES]['′2]?$/.test(c)), `${tag} move chips use standard letters: ${notation.chips.join(' ')}`);
      ok(/^[UDLRFB'′2 ]*$/.test(notation.sol), `${tag} solution text uses standard letters: ${notation.sol}`);

      if (lang === 'ar') {
        const rtl = await p.evaluate(() => {
          const d = s => getComputedStyle(document.querySelector(s)).direction;
          const brand = document.querySelector('.brand').getBoundingClientRect(), picks = document.querySelector('.top-picks').getBoundingClientRect();
          const tg = document.querySelector('#autoRotate + span').getBoundingClientRect(), tgl = document.querySelector('.toggle b').getBoundingClientRect();
          return { body: d('body'), views: d('.views'), transport: d('.transport'), timeline: d('#timeline'), moves: d('#moves'), now: d('#nowMove'), sol: d('#solText'), formula: d('#formula'), net: d('#net'), canvas: d('.scan-canvas'), counter: d('.counter'),
            mirrored: brand.left > picks.left || brand.top !== picks.top, toggleMirrored: tg.left > tgl.left, hint: d('.hint') };
        });
        ok(rtl.body === 'rtl' && rtl.hint === 'rtl', '[ar] body text is RTL');
        for (const k of ['views', 'transport', 'timeline', 'moves', 'now', 'sol', 'formula', 'net', 'canvas', 'counter']) ok(rtl[k] === 'ltr', `[ar ${vpName}] ${k} stays LTR (got ${rtl[k]})`);
        ok(rtl.mirrored, `[ar ${vpName}] header mirrored (brand on the right)`);
        ok(rtl.toggleMirrored, `[ar ${vpName}] toggle switch sits on the start (right) side of its label`);
      }
      if (lang === 'fr') ok(await p.evaluate(() => /\u00a0:/.test(document.body.innerText) || /\u00a0:/.test(solCount.textContent + nowMeta.textContent + validation.textContent)), '[fr] non-breaking spaces before colons');
      if (lang === 'es') ok(await p.evaluate(() => /[¡¿]/.test(Object.values(app.i18n.dicts.es).join(''))), '[es] inverted ¡/¿ punctuation');

      if (SHOTS && SHOT_LANGS.includes(lang)) {
        await p.evaluate(() => { document.querySelector('.tab[data-tab=paint]').click(); btnScramble.click(); btnSolve.click(); }); await p.waitForSelector('#solutionBox:not([hidden])');
        await p.evaluate(() => { app.player.speed = 1; app.player.next(); app.player.next(); app.player.next(); }); await p.waitForTimeout(1500);
        await p.evaluate(() => window.scrollTo(0, 0));
        await p.screenshot({ path: path.join(SHOT_DIR, `${lang}-${vpName}.png`), fullPage: true });
      }
      ok(errs.length === 0, `${tag} no console errors: ${errs.slice(0, 3)}`);
      await ctx.close();
      console.log(`  ✓ ${tag} done (${passes} passed, ${fails} failed so far)`);
    }
  }

  // persistence: choose each language in the dropdown, reload, it sticks (overrides the browser locale)
  {
    const ctx = await browser.newContext({ locale: 'en-US', viewport: { width: 1280, height: 900 } });
    const p = await ctx.newPage(); await p.goto(BASE); await ready(p);
    const opts = await p.evaluate(() => [...langSelect.querySelectorAll('option,optgroup')].map(o => o.tagName === 'OPTGROUP' ? '[' + o.label + ']' : o.value + '=' + o.text));
    ok(opts.join('|') === 'en=English|zh-Hans=简体中文|zh-Hant=繁體中文|es=Español|ar=العربية|pt=Português|id=Bahasa Indonesia|ms=Bahasa Melayu|fr=Français|ja=日本語|ru=Русский|de=Deutsch', 'dropdown order, flat (no optgroup): ' + opts.join('|'));
    ok(await p.evaluate(() => langSelect.querySelectorAll('optgroup').length === 0 && [...langSelect.options].every(o => o.parentElement === langSelect)), 'all language options are top-level');
    for (const lang of [...ORDER.slice(1), 'en']) {
      await p.selectOption('#langSelect', lang); await p.waitForTimeout(80);
      const live = await p.evaluate(() => [document.documentElement.lang, document.querySelector('[data-tab=paint]').textContent, localStorage.getItem('cubelab.lang')]);
      await p.reload(); await ready(p);
      const after = await p.evaluate(() => [app.i18n.lang(), langSelect.value, document.documentElement.dir, document.querySelector('[data-tab=paint]').textContent]);
      const want = await p.evaluate(l => app.i18n.dicts[l]['tab.paint'], lang);
      ok(live[2] === lang && after[0] === lang && after[1] === lang && after[3] === want && live[1] === want && after[2] === (lang === 'ar' ? 'rtl' : 'ltr'), `persist ${lang} across reload: ${JSON.stringify({ live, after })}`);
    }
    // switching language live re-renders dynamic text (solution header, move explanation, validation)
    await p.evaluate(() => { btnScramble.click(); btnSolve.click(); }); await p.waitForSelector('#solutionBox:not([hidden])'); await p.evaluate(() => app.player.next()); await p.waitForTimeout(700);
    await p.selectOption('#langSelect', 'ru'); await p.waitForTimeout(100);
    const ru = await p.evaluate(() => ({ count: solCount.textContent, desc: nowDesc.textContent, val: validation.textContent, sv: solverStatus.textContent }));
    ok(/^Решение: \d+ ход/.test(ru.count) && /Поверните|слой/.test(ru.desc) && /✔/.test(ru.val) && /Решатель|Решено/.test(ru.sv), 'live switch re-renders dynamic text: ' + JSON.stringify(ru));
    await ctx.close();
  }
  await browser.close();
  console.log(`\ni18n e2e: ${passes} passed, ${fails} failed`);
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
