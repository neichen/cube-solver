// js/analytics.js without configured IDs (clean clone / source tree): nothing is loaded, no banner, no IDs in the repo files
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..');
let fails = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ FAIL: ') + m); if (!c) fails++; };
const src = fs.readFileSync(path.join(ROOT, 'js/analytics.js'), 'utf8');
ok(src.includes("'__CF_BEACON_TOKEN__'") && src.includes("'__GA_MEASUREMENT_ID__'"), 'source keeps the ID placeholders');
const idLike = /\bG-[A-Z0-9]{8,}\b|data-cf-beacon='\{"token":"[0-9a-f]{32}/;
const files = ['index.html', 'js/analytics.js'];
ok(files.every(f => !idLike.test(fs.readFileSync(path.join(ROOT, f), 'utf8'))), 'no measurement ID / beacon token in index.html or js/analytics.js');

function run(code, host) {
  const added = [], els = {};
  const el = id => (els[id] = els[id] || { id, hidden: true, addEventListener() {}, setAttribute() {}, appendChild() {} });
  const document = { head: { appendChild: s => added.push(s.src) }, body: { appendChild: e => added.push('#' + e.id), classList: { add() {}, remove() {} } },
    createElement: () => ({ setAttribute() {}, appendChild() {}, addEventListener() {}, querySelector() {} }), getElementById: el, cookie: '' };
  const w = { location: { hostname: host, protocol: 'https:' }, document, localStorage: { getItem: () => null, setItem() {} } };
  w.window = w; vm.runInNewContext(code, w);
  return { added, link: !!els.consentLinkWrap && els.consentLinkWrap.hidden === false, enabled: w.CubeLab.analytics.enabled };
}
let r = run(src, 'cube-solver.org');
ok(!r.enabled && !r.added.length && !r.link, 'placeholders on cube-solver.org: no scripts, no banner, footer link stays hidden');
const filled = src.replace('__CF_BEACON_TOKEN__', '0123456789abcdef0123456789abcdef').replace('__GA_MEASUREMENT_ID__', 'G-TEST000000');
r = run(filled, 'cube-solver.org');
ok(r.enabled && r.added.some(s => /cloudflareinsights/.test(s)) && r.added.includes('#consentBanner') && !r.added.some(s => /googletagmanager/.test(s)), 'IDs filled: CF beacon + consent banner, gtag.js not before consent');
r = run(filled, 'localhost');
ok(!r.enabled && !r.added.length, 'IDs filled but not the production host: nothing loaded');
r = run(src.replace('__CF_BEACON_TOKEN__', '0123456789abcdef0123456789abcdef'), 'cube-solver.org');
ok(r.added.length === 1 && /cloudflareinsights/.test(r.added[0]), 'only CF token set: beacon only, no banner');
console.log(fails ? `analytics unit: ${fails} FAILED` : 'analytics unit: all passed');
process.exit(fails ? 1 : 0);
