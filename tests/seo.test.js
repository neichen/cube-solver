/* SEO checks.
   Static (default): node tests/seo.test.js            → checks index.html + seo/out (run tools/build-seo.js first)
   Live:             node tests/seo.test.js https://…   → fetches every page, robots, sitemap, images, redirects, headers */
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..'), OUT = path.join(ROOT, 'seo/out');
const CFG = JSON.parse(fs.readFileSync(path.join(ROOT, 'seo/site.config.json'), 'utf8'));
const R = require('../js/seo-routes.js');
const BASE = CFG.baseUrl.replace(/\/+$/, ''), LIVE = process.argv[2];
let passes = 0, fails = 0;
const ok = (c, m) => { if (c) passes++; else { fails++; console.log('  ✘ FAIL:', m); } };
const all = (re, s) => [...s.matchAll(re)].map(m => m[1]);
const one = (re, s) => { const m = re.exec(s); return m ? m[1] : null; };
const unesc = s => s.replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const PAGES = []; for (const l of R.LANGS) for (const p of [null].concat(R.PUZZLES)) PAGES.push({ lang: l, pz: p, path: R.path(l, p) });

function checkPage(pg, html, titles, descs) {
  const where = pg.path;
  const title = one(/<title>([^<]*)<\/title>/, html), desc = one(/<meta name="description" content="([^"]*)"/, html);
  ok(title && title.length >= 20 && title.length <= 110, `${where}: title length ${title && title.length}`);
  ok(desc && desc.length >= (/^(zh|ja)/.test(pg.lang) ? 30 : 60) && desc.length <= 330, `${where}: description length ${desc && desc.length}`);
  if (titles) { ok(!titles.has(title), `${where}: unique title`); titles.add(title); ok(!descs.has(desc), `${where}: unique description`); descs.add(desc); }
  ok(one(/<link rel="canonical" href="([^"]*)"/, html) === BASE + pg.path, `${where}: canonical`);
  const alts = [...html.matchAll(/<link rel="alternate" hreflang="([^"]+)" href="([^"]+)">/g)].map(m => [m[1], m[2]]);
  ok(alts.length === R.LANGS.length + 1, `${where}: ${alts.length} hreflang alternates`);
  ok(alts.some(([h, u]) => h === 'x-default' && u === BASE + R.path('en', pg.pz)), `${where}: x-default`);
  ok(alts.some(([h, u]) => h === CFG.hreflang[pg.lang] && u === BASE + pg.path), `${where}: self hreflang`);
  ok(R.LANGS.every(l => alts.some(([h, u]) => h === CFG.hreflang[l] && u === BASE + R.path(l, pg.pz))), `${where}: hreflang set complete`);
  const htmlTag = one(/(<html[^>]*>)/, html);
  ok(new RegExp(`lang="${pg.lang === 'en' ? 'en' : CubeLab.i18n.info(pg.lang).html}"`).test(htmlTag), `${where}: html lang ${htmlTag}`);
  ok(/dir="(ltr|rtl)"/.test(htmlTag) && (pg.lang === 'ar') === /dir="rtl"/.test(htmlTag), `${where}: dir`);
  ok(pg.path === '/' ? !/data-page-lang/.test(htmlTag) : new RegExp(`data-page-lang="${pg.lang}"`).test(htmlTag), `${where}: data-page-lang`);
  ok(pg.pz ? new RegExp(`data-page-puzzle="${pg.pz}"`).test(htmlTag) : !/data-page-puzzle/.test(htmlTag), `${where}: data-page-puzzle`);
  ok((html.match(/<h1[\s>]/g) || []).length === 1 && /<h1 id="pageTitle">[^<]{3,}<\/h1>/.test(html), `${where}: exactly one non-empty h1`);
  ok((html.match(/<h2 /g) || []).length >= 3, `${where}: h2 sections`);
  ok(new RegExp(`<a class="logo" id="homeLink" href="${R.path(pg.lang, null)}" aria-label="[^"]{3,}"`).test(html), `${where}: logo links to the language home`);
  ok(/<noscript><p class="noscript">[^<]+<\/p><\/noscript>/.test(html), `${where}: noscript`);
  ok(/<base href="\/">/.test(html), `${where}: base href`);
  for (const p of ['og:title', 'og:description', 'og:url', 'og:image', 'og:type', 'og:locale', 'og:image:alt']) ok(new RegExp(`<meta property="${p}" content="[^"]+"`).test(html), `${where}: ${p}`);
  for (const p of ['twitter:card', 'twitter:title', 'twitter:image']) ok(new RegExp(`<meta name="${p}" content="[^"]+"`).test(html), `${where}: ${p}`);
  ok(one(/<meta property="og:url" content="([^"]*)"/, html) === BASE + pg.path, `${where}: og:url`);
  ok(/<link rel="manifest" href="\/manifest.webmanifest">/.test(html) && /<link rel="apple-touch-icon"/.test(html) && /<link rel="icon" href="\/img\/favicon.svg"/.test(html), `${where}: icons + manifest`);
  // visible text: no unresolved placeholders, no empty i18n-only heading
  const article = one(/(<article id="seo"[\s\S]*?<\/article>)/, html) || '';
  ok(article.length > 800, `${where}: static content present (${article.length} chars)`);
  ok(!/\{[a-z]+\}/i.test(article + title + desc), `${where}: placeholders resolved`);
  ok(new RegExp(`data-seo-lang="${pg.lang}" data-seo-puzzle="${pg.pz || ''}"`).test(article), `${where}: article tagged`);
  // internal links point at real pages in the same language
  const links = all(/<a href="([^"]+)"/g, article);
  ok(links.length >= R.PUZZLES.length, `${where}: internal links (${links.length})`);
  ok(links.every(h => { const r = R.parse(h); return r && r.lang === pg.lang; }), `${where}: links resolve to same-language pages`);
  // JSON-LD
  const lds = all(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g, html);
  ok(lds.length === 1, `${where}: one JSON-LD block`);
  let ld = null; try { ld = JSON.parse(lds[0]); } catch (e) { ok(false, `${where}: JSON-LD parses (${e.message})`); }
  if (ld) {
    const G = ld['@graph'] || [], T = t => G.find(x => x['@type'] === t);
    ok(ld['@context'] === 'https://schema.org', `${where}: @context`);
    const app = T('WebApplication'); ok(app && app.url === BASE + pg.path && app.offers && app.offers.price === '0' && app.applicationCategory && app.operatingSystem, `${where}: WebApplication`);
    ok(!/aggregateRating|"review"|ratingValue/i.test(lds[0]), `${where}: no ratings / reviews in structured data`);
    const faq = T('FAQPage'), qs = all(/<h3>([^<]*)<\/h3>/g, article).map(unesc);
    ok(faq && faq.mainEntity.length === qs.length && faq.mainEntity.every((q, i) => q.name === qs[i] && q.acceptedAnswer && q.acceptedAnswer.text.length > 20), `${where}: FAQPage matches visible FAQ`);
    const visibleAnswers = all(/<\/h3><p>([^<]*)<\/p>/g, article).map(unesc);
    ok(faq && faq.mainEntity.every((q, i) => q.acceptedAnswer.text === visibleAnswers[i]), `${where}: FAQ answers match visible text`);
    const how = T('HowTo'), steps = all(/<li>([^<]*)<\/li>/g, one(/(<ol>[\s\S]*?<\/ol>)/, article) || '').map(unesc);
    ok(how && how.step.length === steps.length && how.step.every((s, i) => s.text === steps[i]), `${where}: HowTo matches visible steps`);
    ok(pg.pz ? !!T('BreadcrumbList') : true, `${where}: breadcrumb`);
    ok(T('WebPage') && T('WebPage').inLanguage === CFG.hreflang[pg.lang], `${where}: WebPage inLanguage`);
  }
  return { img: one(/<meta property="og:image" content="([^"]*)"/, html) };
}

function pngSize(buf) { return buf.slice(1, 4).toString() === 'PNG' ? [buf.readUInt32BE(16), buf.readUInt32BE(20)] : null; }

global.CubeLab = {}; vm.runInThisContext(fs.readFileSync(path.join(ROOT, 'js/i18n/i18n.js'), 'utf8'));

async function staticMode() {
  // texts complete
  const en = JSON.parse(fs.readFileSync(path.join(ROOT, 'seo/lang/en.json'), 'utf8'));
  for (const l of R.LANGS) {
    const d = JSON.parse(fs.readFileSync(path.join(ROOT, 'seo/lang', l + '.json'), 'utf8'));
    ok(Object.keys(en).every(k => typeof d[k] === 'string' && d[k].trim()), `seo/lang/${l}.json has every key`);
  }
  // routes
  ok(R.path('en', null) === '/' && R.path('zh-Hans', 'cube3') === '/zh-hans/3x3-cube-solver/' && R.path('en', 'pyraminx') === '/pyraminx-solver/' && R.path('de', 'cube15') === '/de/15x15-cube-solver/', 'route paths');
  ok(PAGES.every(p => { const r = R.parse(p.path); return r && r.lang === p.lang && r.puzzle === p.pz; }) && R.parse('/xx-cube/') === null && R.parse('/fr/nope/') === null, 'route parse round-trip');
  const titles = new Set(), descs = new Set(), imgs = new Set();
  for (const pg of PAGES) {
    const f = pg.path === '/' ? path.join(ROOT, 'index.html') : path.join(OUT, pg.path, 'index.html');
    ok(fs.existsSync(f), 'page exists ' + pg.path); if (!fs.existsSync(f)) continue;
    const r = checkPage(pg, fs.readFileSync(f, 'utf8'), titles, descs); imgs.add(r.img);
  }
  for (const u of imgs) {
    const f = path.join(ROOT, u.replace(BASE, '')); ok(fs.existsSync(f), 'og image exists ' + u);
    if (fs.existsSync(f)) { const s = pngSize(fs.readFileSync(f)); ok(s && s[0] === 1200 && s[1] === 630, `og image 1200×630 ${u} (${s})`); }
  }
  ok(imgs.size === R.PUZZLES.length + 1, 'one og image per puzzle + root');
  const robots = fs.readFileSync(path.join(OUT, 'robots.txt'), 'utf8');
  ok(/^User-agent: \*$/m.test(robots) && robots.includes(`Sitemap: ${BASE}/sitemap.xml`) && !/Disallow: \/\s*$/m.test(robots), 'robots.txt');
  const sm = fs.readFileSync(path.join(OUT, 'sitemap.xml'), 'utf8'), locs = all(/<loc>([^<]+)<\/loc>/g, sm);
  ok(sm.startsWith('<?xml') && /<urlset [^>]*xmlns:xhtml=/.test(sm) && sm.trim().endsWith('</urlset>'), 'sitemap well-formed');
  ok(locs.length === PAGES.length && PAGES.every(p => locs.includes(BASE + p.path)), `sitemap lists all ${PAGES.length} pages`);
  ok((sm.match(/<xhtml:link /g) || []).length === PAGES.length * (R.LANGS.length + 1), 'sitemap hreflang alternates');
  const man = JSON.parse(fs.readFileSync(path.join(OUT, 'manifest.webmanifest'), 'utf8'));
  ok(man.name && man.start_url === '/' && man.icons.length >= 3 && man.icons.every(i => fs.existsSync(path.join(ROOT, i.src))), 'manifest + icons exist');
  for (const [f, w] of [['img/icon-192.png', 192], ['img/icon-512.png', 512], ['img/apple-touch-icon.png', 180]]) { const s = pngSize(fs.readFileSync(path.join(ROOT, f))); ok(s && s[0] === w && s[1] === w, f + ' size'); }
  ok(fs.readFileSync(path.join(ROOT, 'favicon.ico')).readUInt16LE(2) === 1, 'favicon.ico');
  // Worker redirect logic
  const src = fs.readFileSync(path.join(ROOT, 'deploy/worker.js'), 'utf8').replace('export default', 'module.exports =');
  const m = { exports: {} }; function Resp(b, o) { this.status = o.status; this.redirect = o.headers.Location; this.vary = o.headers.Vary; }
  Resp.redirect = (u, s) => ({ redirect: u, status: s });
  new Function('module', 'Response', src)(m, Resp);
  const W = m.exports, env = { ASSETS: { fetch: r => ({ asset: r.url }) } };
  const red = async (u, al) => W.fetch({ url: BASE + u, headers: { get: k => k === 'accept-language' ? al || null : null } }, env);
  const cases = [['/?puzzle=pyraminx', '/pyraminx-solver/'], ['/?n=7', '/7x7-cube-solver/'], ['/?n=4&lang=zh-Hans', '/zh-hans/4x4-cube-solver/'], ['/?lang=fr', '/fr/'],
    ['/?puzzle=cube3&mode=play', '/3x3-cube-solver/?mode=play'], ['/?lang=zh-TW&puzzle=skewb', '/zh-hant/skewb-solver/'], ['/?n=99', '/']];
  for (const [u, want] of cases) { const r = await red(u); ok(r.status === 301 && r.redirect === BASE + want, `worker redirect ${u} → ${r.redirect}`); }
  { const r = await red('/?n=5', 'zh-CN,zh;q=0.9,en;q=0.8'); ok(r.status === 301 && r.redirect === BASE + '/zh-hans/5x5-cube-solver/', 'worker: old link follows Accept-Language ' + r.redirect); }
  { const r = await red('/?n=5&lang=de', 'zh-CN'); ok(r.redirect === BASE + '/de/5x5-cube-solver/', 'worker: ?lang wins over Accept-Language'); }
  ok((await red('/')).asset && (await red('/?mode=play')).asset, 'worker passes plain requests to assets');
  // canonical host: workers.dev and www → https://cube-solver.org, same path and query, one hop with old query URLs
  const at = (u, al) => W.fetch({ url: u, headers: { get: k => k === 'accept-language' ? al || null : null } }, env);
  for (const [u, want] of [['https://cube-graph-solver.cn2.workers.dev/', 'https://cube-solver.org/'], ['https://cube-graph-solver.cn2.workers.dev/de/7x7-cube-solver/?mode=play', 'https://cube-solver.org/de/7x7-cube-solver/?mode=play'],
    ['https://www.cube-solver.org/ja/', 'https://cube-solver.org/ja/'], ['http://www.cube-solver.org/?n=4&lang=fr', 'https://cube-solver.org/fr/4x4-cube-solver/'], ['https://cube-graph-solver.cn2.workers.dev/?puzzle=skewb&lang=es', 'https://cube-solver.org/es/skewb-solver/']]) {
    const r = await at(u); ok(r.status === 301 && r.redirect === want, `worker host redirect ${u} → ${r.redirect}`);
  }
  ok((await at('https://cube-solver.org/fr/')).asset, 'worker serves the canonical host from assets');
  { // geo consent flag (mocked request.cf.country) + region-specific ETag
    const X = W._internals;
    for (const c of ['DE', 'FR', 'IE', 'NO', 'IS', 'LI', 'GB', 'CH', 'XX', 'T1', '', undefined, 'zz9']) ok(X.consentRequired(c), `consent region: ${JSON.stringify(c)}`);
    for (const c of ['SG', 'US', 'CN', 'JP', 'BR', 'IN', 'TR', 'RS']) ok(!X.consentRequired(c), `no-banner region: ${c}`);
    ok(X.tagEtag('"abc"', true) === '"abc-c1"' && X.tagEtag('W/"abc"', false) === 'W/"abc-c0"', 'ETag region suffix');
    ok(X.untagIfNoneMatch('"abc-c1"', true) === '"abc"' && X.untagIfNoneMatch('"abc-c0"', true) === null && X.untagIfNoneMatch('"abc"', false) === null, 'If-None-Match: own variant translated, other region dropped');
    // servePage end to end with minimal Request / Response / Headers / HTMLRewriter stand-ins
    class H extends Map { constructor(i) { super(i instanceof Map ? i : Object.entries(i || {}).map(([k, v]) => [k.toLowerCase(), v])); } get(k) { return super.has(k.toLowerCase()) ? super.get(k.toLowerCase()) : null; } set(k, v) { return super.set(k.toLowerCase(), v); } delete(k) { return super.delete(k.toLowerCase()); } }
    class Rs { constructor(body, o) { o = o || {}; this.body = body; this.status = o.status || 200; this.statusText = o.statusText || ''; this.headers = new H(o.headers); } }
    class Rq { constructor(r, o) { this.url = r.url; this.cf = r.cf; this.headers = o && o.headers || r.headers; } }
    class HR { on(sel, h) { this.h = h; return this; } transform(r) { const el = { attrs: {}, setAttribute(k, v) { this.attrs[k] = v; } }; this.h.element(el); return new Rs(r.body.replace('<html', '<html ' + Object.entries(el.attrs).map(([k, v]) => `${k}="${v}"`).join(' ')), { status: r.status, headers: r.headers }); } }
    const src2 = fs.readFileSync(path.join(ROOT, 'deploy/worker.js'), 'utf8').replace('export default', 'module.exports =');
    const m2 = { exports: {} }; new Function('module', 'Response', 'Request', 'Headers', 'HTMLRewriter', src2)(m2, Rs, Rq, H, HR);
    let seen = null;
    const env2 = { ASSETS: { fetch: r => { seen = r.headers.get('if-none-match'); return seen === '"e1"' ? new Rs(null, { status: 304, headers: { etag: '"e1"' } }) : new Rs('<!doctype html><html lang="en"><body>x</body></html>', { headers: { 'content-type': 'text/html; charset=utf-8', etag: '"e1"' } }); } } };
    const pg = async (country, inm) => m2.exports.fetch({ url: BASE + '/fr/', cf: country === null ? undefined : { country }, headers: new H(inm ? { 'if-none-match': inm } : {}) }, env2);
    let r = await pg('DE'); ok(/<html data-consent="1"/.test(r.body) && r.headers.get('etag') === '"e1-c1"', 'mock DE: data-consent="1", ETag -c1');
    r = await pg('SG'); ok(/<html data-consent="0"/.test(r.body) && r.headers.get('etag') === '"e1-c0"', 'mock SG: data-consent="0", ETag -c0');
    r = await pg(null); ok(/data-consent="1"/.test(r.body), 'mock no country: consent required');
    r = await pg('US', '"e1-c0"'); ok(r.status === 304 && seen === '"e1"' && r.headers.get('etag') === '"e1-c0"', 'US revalidates its own variant → 304');
    r = await pg('FR', '"e1-c0"'); ok(r.status === 200 && seen === null && /data-consent="1"/.test(r.body), 'variant from another region is not revalidated (full page, consent flag)');
  }
  const toml = fs.readFileSync(path.join(ROOT, 'deploy/wrangler.toml'), 'utf8');
  ok(/main = "worker.js"/.test(toml) && !/account_id/.test(toml), 'wrangler: worker.js, no account_id in the file');
  ok(/pattern = "cube-solver.org", custom_domain = true/.test(toml) && /pattern = "www.cube-solver.org", custom_domain = true/.test(toml), 'wrangler: apex + www custom domains');
  { // run_worker_first: every static asset path is excluded, so only page routes invoke the Worker
    const rwf = JSON.parse(/run_worker_first = (\[[\s\S]*?\])/.exec(toml)[1].replace(/,\s*\]/, ']'));
    const top = fs.readdirSync(ROOT).filter(f => ['js', 'css', 'img', 'puzzles', 'vendor', 'favicon.ico'].includes(f)).concat(['sitemap.xml', 'robots.txt', 'manifest.webmanifest']);
    ok(rwf[0] === '/*' && top.every(f => rwf.includes('!/' + f + (fs.existsSync(path.join(ROOT, f)) && fs.statSync(path.join(ROOT, f)).isDirectory() ? '/*' : ''))), 'wrangler: run_worker_first excludes all asset paths ' + rwf.join(' '));
    const outTop = fs.readdirSync(OUT).filter(f => f !== 'pages.json' && !fs.statSync(path.join(OUT, f)).isDirectory());
    ok(outTop.every(f => rwf.includes('!/' + f)), 'wrangler: generated root files excluded too: ' + outTop.join(', '));
  }
}

async function liveMode() {
  const get = (u, o) => fetch(u, Object.assign({ redirect: 'manual' }, o || {}));
  const titles = new Set(), descs = new Set();
  for (const pg of PAGES) {
    const r = await get(LIVE.replace(/\/$/, '') + pg.path); ok(r.status === 200, `live ${pg.path} 200 (${r.status})`);
    if (r.status !== 200) continue;
    ok(r.headers.get('cross-origin-embedder-policy') === 'require-corp' && r.headers.get('cross-origin-opener-policy') === 'same-origin', `live ${pg.path} COOP/COEP`);
    checkPage(pg, await r.text(), titles, descs);
  }
  const rb = await get(LIVE + '/robots.txt'), rbt = await rb.text(); ok(rb.status === 200 && rbt.includes(`Sitemap: ${BASE}/sitemap.xml`), 'live robots.txt with Sitemap');
  const sm = await get(LIVE + '/sitemap.xml'), smt = await sm.text(); ok(sm.status === 200 && /xml/.test(sm.headers.get('content-type')) && all(/<loc>([^<]+)<\/loc>/g, smt).length === PAGES.length, 'live sitemap.xml');
  const mf = await get(LIVE + '/manifest.webmanifest'); ok(mf.status === 200 && JSON.parse(await mf.text()).name, 'live manifest');
  for (const u of ['/img/og/root.png', '/img/og/3x3-cube-solver.png', '/img/og/skewb-solver.png', '/img/favicon.svg', '/favicon.ico', '/img/apple-touch-icon.png']) {
    const r = await get(LIVE + u); ok(r.status === 200 && /image/.test(r.headers.get('content-type')), `live ${u} (${r.status} ${r.headers.get('content-type')})`);
  }
  for (const [u, want] of [['/?puzzle=pyraminx', '/pyraminx-solver/'], ['/?n=7&lang=de', '/de/7x7-cube-solver/'], ['/?lang=ja', '/ja/']]) {
    const r = await get(LIVE + u); ok(r.status === 301 && r.headers.get('location') === LIVE.replace(/\/$/, '') + want, `live redirect ${u} → ${r.headers.get('location')} (${r.status})`);
  }
  const ns = await get(LIVE + '/3x3-cube-solver'); ok([301, 307, 308].includes(ns.status), `live slash redirect (${ns.status})`);
}

(LIVE ? liveMode() : staticMode()).then(() => {
  console.log(`seo ${LIVE ? 'live' : 'static'}: ${passes} passed, ${fails} failed`);
  process.exit(fails ? 1 : 0);
});
