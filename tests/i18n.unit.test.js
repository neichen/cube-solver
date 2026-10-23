/* i18n unit tests (Node): every locale has every key, placeholders and plural branches are consistent,
   detection rules, Intl formatting, French spacing. Run: node tests/i18n.unit.test.js */
const fs = require('fs'), vm = require('vm'), path = require('path');
const dir = path.join(__dirname, '..', 'js', 'i18n');
global.CubeLab = {};
vm.runInThisContext(fs.readFileSync(path.join(dir, 'i18n.js'), 'utf8'));
for (const f of fs.readdirSync(dir)) if (f !== 'i18n.js') vm.runInThisContext(fs.readFileSync(path.join(dir, f), 'utf8'), { filename: f });
const I = CubeLab.i18n;
let fails = 0, passes = 0;
const ok = (c, m) => { if (c) passes++; else { fails++; console.log('  ✘ FAIL:', m); } };

const ORDER = ['en', 'zh-Hans', 'zh-Hant', 'es', 'ar', 'pt', 'id', 'ms', 'fr', 'ja', 'ru', 'de'];
const NAMES = ['English', '简体中文', '繁體中文', 'Español', 'العربية', 'Português', 'Bahasa Indonesia', 'Bahasa Melayu', 'Français', '日本語', 'Русский', 'Deutsch'];
ok(JSON.stringify(I.LANGS.map(l => l.code)) === JSON.stringify(ORDER), 'language order ' + I.LANGS.map(l => l.code));
ok(JSON.stringify(I.LANGS.map(l => l.name)) === JSON.stringify(NAMES), 'native names');
ok(I.LANGS.every(l => !l.group) && !('GROUPS' in I), 'no language groups (flat list)');
ok(I.info('ar').dir === 'rtl' && I.LANGS.filter(l => l.dir === 'rtl').length === 1, 'only Arabic is RTL');

// key completeness + placeholders
const en = I.dicts.en, keys = Object.keys(en);
const ph = s => [...new Set((s.match(/\{(\w+)\s*[,}]/g) || []).map(x => x.replace(/[\s,}]/g, '').slice(1)))].sort();
const ALSO = { 'move.sliceCw': ['baseLayer'], 'puzzle.cubeN': ['cn'] };   // {cn} = Chinese numeral derived from {n} by t()       // params that are passed but optional for translators
for (const c of ORDER) {
  const d = I.dicts[c]; ok(!!d, 'locale file registered: ' + c); if (!d) continue;
  const miss = keys.filter(k => !(k in d)), extra = Object.keys(d).filter(k => !(k in en));
  ok(!miss.length, `${c}: all ${keys.length} keys present (missing: ${miss.join(', ')})`);
  ok(!extra.length, `${c}: no unknown keys (${extra.join(', ')})`);
  for (const k of keys) {
    if (!(k in d)) continue;
    const v = d[k]; ok(typeof v === 'string' && (v.trim() || k === 'pos.sep'), `${c}.${k} non-empty string`);
    const allowed = new Set(ph(en[k]).concat(ALSO[k] || [])), used = ph(v);
    ok(used.every(p => allowed.has(p)), `${c}.${k} uses only known placeholders: ${used} ⊄ ${[...allowed]}`);
    const needed = ph(en[k]).filter(p => !(ALSO[k] || []).length || p !== 'base');
    ok(needed.every(p => used.includes(p)), `${c}.${k} keeps placeholders ${needed} (has ${used})`);
    for (const m of v.matchAll(/\{\w+, plural,/g)) ok(/other\s*\{/.test(v.slice(m.index)), `${c}.${k} plural has an 'other' branch`);
    // move notation letters must stay standard (no translated letters inside the notation examples)
    if (k === 'formula.placeholder') ok(v.includes("R U R' U' F2 D B' L2"), `${c} placeholder keeps standard notation`);
  }
  if (c !== 'en') {
    const same = keys.filter(k => d[k] === en[k] && /[a-z]{4,}/i.test(en[k]) && !/^[\s\S]*(MIT|three\.js)/.test(en[k]));
    ok(same.length <= 12, `${c}: looks translated (${same.length} identical-to-English strings: ${same.slice(0, 12)})`);
  }
}

// natural cube terminology
const term = { es: /cubo de Rubik/, ja: /ルービックキューブ/, de: /Zauberwürfel/, fr: /Rubik’s Cube/, ru: /кубик/i, pt: /cubo/i, id: /kubus Rubik/i, ms: /kiub Rubik/i, 'zh-Hans': /魔方/, 'zh-Hant': /魔術方塊/, ar: /مكعب روبيك/ };
for (const c in term) ok(term[c].test(I.dicts[c]['meta.description'] + I.dicts[c]['meta.title']), `${c}: natural cube term ${term[c]}`);

// detection
const det = (langs, stored, search) => I.detect({ languages: langs }, { getItem: () => stored || null }, search || '');
ok(det(['zh-TW']) === 'zh-Hant' && det(['zh-HK']) === 'zh-Hant' && det(['zh-MO']) === 'zh-Hant' && det(['zh-Hant-SG']) === 'zh-Hant', 'zh-TW/HK/MO/Hant → zh-Hant');
ok(det(['zh-CN']) === 'zh-Hans' && det(['zh']) === 'zh-Hans' && det(['zh-SG']) === 'zh-Hans', 'other zh → zh-Hans');
ok(det(['fr-CA', 'en']) === 'fr' && det(['pt-BR']) === 'pt' && det(['es-419']) === 'es' && det(['ar-EG']) === 'ar' && det(['de-AT']) === 'de', 'regional variants map to base');
ok(det(['in']) === 'id' && det(['ms-MY']) === 'ms' && det(['ja-JP']) === 'ja' && det(['ru-RU']) === 'ru', 'id / ms / ja / ru');
ok(det(['xx', 'ko', 'de']) === 'de', 'first supported in navigator.languages wins');
ok(det(['ko', 'th']) === 'en', 'default English');
ok(det(['zh-CN'], 'ar') === 'ar', 'localStorage beats navigator.languages');
ok(det(['zh-CN'], 'ar', '?lang=ja') === 'ja', '?lang= beats localStorage');
ok(det(['de'], 'nope') === 'de', 'invalid stored value ignored');

// formatting
const T = (l, k, p) => { I._setLangSilently(l); return I.t(k, p); };
ok(T('en', 'solve.count', { n: 1 }) === 'Solution: 1 move' && T('en', 'solve.count', { n: 21 }) === 'Solution: 21 moves', 'en plural');
ok(/1 ход$/.test(T('ru', 'solve.count', { n: 21 })) && /3 хода$/.test(T('ru', 'solve.count', { n: 3 })) && /11 ходов$/.test(T('ru', 'solve.count', { n: 11 })), 'ru one/few/many');
ok(/حركتان/.test(T('ar', 'solve.count', { n: 2 })) && /11 حركة/.test(T('ar', 'solve.count', { n: 11 })), 'ar dual / many');
ok(T('de', 'solve.done', { ms: 1234 }).includes('1.234') && T('en', 'solve.done', { ms: 1234 }).includes('1,234'), 'Intl number grouping per locale');
const fr = T('fr', 'solve.count', { n: 2 }); ok(fr.includes('Solution\u00a0:'), 'French NBSP before colon: ' + JSON.stringify(fr));
const fr2 = T('fr', 'scan.msg.recognized', { title: 'Avant', done: 1, total: 6 }); ok(fr2.startsWith('«\u202fAvant\u202f»'), 'French guillemets spacing');
ok(!/\u00a0:/.test(T('fr', 'pos.sep')) && T('fr', 'move.sliceHalf', { slice: 'M' }) === 'M\u00a0: 180°', 'French spacing only before punctuation');
ok(/^¡/.test(T('es', 'scan.msg.allDone')) || /¡/.test(I.dicts.es['scan.msg.allDone']), 'Spanish ¡ present');
ok(T('xx-missing', 'solve.copy') === 'Copy', 'unknown language falls back to English');
ok(T('zh-Hans', 'puzzle.cubeN', { n: 3 }) === '三阶魔方（3×3）' && T('zh-Hant', 'puzzle.cubeN', { n: 15 }) === '十五階魔術方塊（15×15）', 'Chinese puzzle names use derived {cn} numerals');
ok(T('en', 'puzzle.cubeN', { n: 3 }) === '3×3 Cube' && T('en', 'puzzle.cubeN', { n: 10 }) === '10×10 Cube', '3×3 named like every other N×N');
I._setLangSilently('de'); const before = I.missing.length; ok(I.t('this.key.does.not.exist') === 'this.key.does.not.exist' && I.missing.length > before, 'missing keys fall back to the key and are recorded');
// per-language title / description
const titles = new Set(ORDER.map(c => I.dicts[c]['meta.title'])), descs = new Set(ORDER.map(c => I.dicts[c]['meta.description']));
ok(titles.size === 12 && descs.size === 12, 'per-language title and meta description');

console.log(`i18n unit: ${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
