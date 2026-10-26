#!/usr/bin/env node
/* Prerender the SEO pages: one static HTML page per (language × puzzle) + root pages, robots.txt, sitemap.xml,
   manifest.webmanifest. Single config: seo/site.config.json (baseUrl). Texts: seo/lang/<code>.json.
   - index.html (English root, x-default) is updated in place between the <!--seo:*--> markers;
   - every other page is written to seo/out/<path>/index.html (deployed next to index.html).
   Run: node tools/build-seo.js   (then: node tests/seo.test.js) */
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..'), OUT = path.join(ROOT, 'seo', 'out');
const CFG = JSON.parse(fs.readFileSync(path.join(ROOT, 'seo/site.config.json'), 'utf8'));
const R = require(path.join(ROOT, 'js/seo-routes.js'));
const BASE = CFG.baseUrl.replace(/\/+$/, '');
global.CubeLab = {}; vm.runInThisContext(fs.readFileSync(path.join(ROOT, 'js/i18n/i18n.js'), 'utf8'));
const LINFO = {}; CubeLab.i18n.LANGS.forEach(l => { LINFO[l.code] = l; });
// the app's own string tables (js/i18n/<code>.js) for the prerendered consent banner
R.LANGS.forEach(c => { vm.runInThisContext(fs.readFileSync(path.join(ROOT, 'js/i18n', c + '.js'), 'utf8')); });
const APPT = (lang, key) => { CubeLab.i18n._setLangSilently(lang); return CubeLab.i18n.t(key); };
// Per-page scripts, all deferred (parsing never blocks): only the page's language pack and the page's puzzle plugin;
// other languages / puzzles are loaded on demand (js/i18n/i18n.js loadPack, js/core/registry.js loadPuzzle).
const GROUP_SCRIPTS = {
  cube3: ['puzzles/cube3/model.js', 'puzzles/cube3/cube3.js'], nxn: ['puzzles/nxn/nxn.js'],
  twisty: ['puzzles/twisty/twisty-model.js', 'puzzles/twisty/twisty.js'], megaminx: ['puzzles/megaminx/megaminx-model.js', 'puzzles/megaminx/megaminx.js']
};
const groupOf = pz => !pz || pz === 'cube3' ? 'cube3' : pz.startsWith('cube') ? 'nxn' : pz === 'megaminx' ? 'megaminx' : 'twisty';
function scriptList(lang, pz) {
  return ['js/i18n/i18n.js', 'js/seo-routes.js', 'js/i18n/' + lang + '.js', 'js/core/registry.js', 'puzzles/nxn/nxn-model.js']
    .concat(GROUP_SCRIPTS[groupOf(pz)], ['vendor/three.min.js', 'js/core/graph-view.js', 'js/core/view3d.js', 'js/core/player.js', 'js/core/play-core.js',
      'js/core/solver-client.js', 'js/core/net-editor.js', 'js/core/color-cluster.js', 'js/core/camera-scan.js', 'js/core/audio.js',
      'js/app.js', 'js/seo-nav.js', 'js/analytics.js']);
}
// Consent banner, prerendered in the page language (no layout shift, not the LCP element). It stays hidden unless the
// inline script below shows it: production host, GA configured (data-ga="1", set by tools/build-dist.js), consent region
// (<html data-consent="1">, set per request by deploy/worker.js) and no stored choice. js/analytics.js wires the buttons.
// The inline script is constant: its sha256 is in the Content-Security-Policy (tools/build-dist.js).
const CONSENT_INLINE = "(function(){var b=document.getElementById('consentBanner'),c=null;try{c=localStorage.getItem('cubelab.consent')}catch(e){}" +
  "if(b&&location.hostname==='cube-solver.org'&&location.protocol==='https:'&&b.getAttribute('data-ga')==='1'&&document.documentElement.getAttribute('data-consent')!=='0'&&c!=='granted'&&c!=='denied'){b.hidden=false;document.body.classList.add('has-consent')}})()";
function consentHtml(lang) {
  const T = k => esc(APPT(lang, k));
  return `<div id="consentBanner" class="consent" role="region" data-i18n-aria="consent.title" aria-label="${T('consent.title')}" data-ga="" hidden>` +
    `<p data-i18n="consent.text">${T('consent.text')}</p><div class="consent-btns"><button type="button" id="consentDecline" data-i18n="consent.decline">${T('consent.decline')}</button>` +
    `<button type="button" id="consentAccept" class="primary" data-i18n="consent.accept">${T('consent.accept')}</button></div></div>\n<script>${CONSENT_INLINE}</script>`;
}
const TXT = {}; R.LANGS.forEach(c => { TXT[c] = JSON.parse(fs.readFileSync(path.join(ROOT, 'seo/lang', c + '.json'), 'utf8')); });
const M = CFG.measured;
const CN = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二', '十三', '十四', '十五'];

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const abs = p => BASE + p;
function kind(pz) {
  if (!pz) return 'root';
  if (pz === 'pyraminx' || pz === 'skewb' || pz === 'megaminx') return pz;
  const n = +pz.slice(4); return n <= 4 ? pz : 'big';
}
function params(lang, pz) {
  const nf = (x, d) => new Intl.NumberFormat(lang === 'ar' ? 'ar-u-nu-latn' : LINFO[lang].html, { maximumFractionDigits: d || 0, minimumFractionDigits: d || 0 }).format(x);
  const p = { site: TXT[lang].site || CFG.siteName };
  if (pz && pz.startsWith('cube')) { const n = +pz.slice(4); p.n = String(n); p.cn = CN[n]; if (n >= 5) { p.q = nf(M.big[n][0]); p.f = nf(M.big[n][1]); } }
  Object.assign(p, { range: M.cube3.range, coreMax: String(M.pyraminx.coreMax), tipsMax: String(M.pyraminx.tipsMax) });
  const k = kind(pz);
  if (k === 'cube2') Object.assign(p, { avg: nf(M.cube2.avg, 2), max: String(M.cube2.max), samples: String(M.cube2.samples) });
  if (k === 'cube4') Object.assign(p, { avg: nf(M.cube4.avg, 1), samples: String(M.cube4.samples), sec: String(M.cube4.sec) });
  if (k === 'pyraminx') p.avg = nf(M.pyraminx.avg, 1);
  if (k === 'skewb') Object.assign(p, { avg: nf(M.skewb.avg, 1), max: String(M.skewb.max) });
  if (k === 'megaminx') Object.assign(p, { avg: nf(M.megaminx.avg, 1), max: String(M.megaminx.max), samples: String(M.megaminx.samples), ms: nf(M.megaminx.ms) });
  p.name = pz ? puzzleName(lang, pz) : '';
  return p;
}
// ---------- per-size facts for 5x5–15x15 (exact combinatorics + the measured move counts above) ----------
const fact = n => { let r = 1n; for (let i = 2n; i <= BigInt(n); i++) r *= i; return r; };
function nxnStates(n) { // standard orbit count: corners/midges (odd) or 7 corners fixed (even), 24! per wing orbit, 24!/(4!)^6 per center orbit
  const F24 = fact(24), C = F24 / (24n ** 6n);
  if (n % 2) return fact(8) * 3n ** 7n * fact(12) * 2n ** 10n * F24 ** BigInt((n - 3) / 2) * C ** BigInt((n - 3) * (n - 1) / 4);
  return fact(7) * 3n ** 6n * F24 ** BigInt((n - 2) / 2) * C ** BigInt((n - 2) ** 2 / 4);
}
const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹';
function bigFacts(lang, n) {
  const nf = (x, d) => new Intl.NumberFormat(lang === 'ar' ? 'ar-u-nu-latn' : LINFO[lang].html, { maximumFractionDigits: d || 0, minimumFractionDigits: d || 0 }).format(x);
  const st = nxnStates(n).toString(), mant = nf(+(st[0] + '.' + st.slice(1, 4)), 2);
  const wings = Math.floor((n - 2) / 2), corbits = n % 2 ? (n - 3) * (n - 1) / 4 : (n - 2) ** 2 / 4;
  const p = n - 1, qp = p === 4 ? M.cube4.avg : M.big[p][0], q = M.big[n][0];
  const P = { n: String(n), stickers: nf(6 * n * n), pieces: nf(n ** 3 - (n - 2) ** 3), edges: nf(12 * (n - 2)), centers: nf(6 * (n - 2) ** 2),
    states: mant + ' × 10' + String(st.length - 1).split('').map(d => SUP[d]).join(''), digits: nf(st.length), wings: nf(wings), corbits: nf(corbits),
    layers: nf(3 * n), q: nf(q), p: String(p), qp: nf(qp, p === 4 ? 1 : 0), dq: nf(Math.round(q - qp)) };
  const t = key => tr(lang, key, P);
  return [t('facts.pieces'), t('facts.states'), t('facts.orbits'), t(n % 2 ? 'facts.odd' : 'facts.even'), t('facts.layers'), t('facts.compare')];
}
function puzzleName(lang, pz) {
  const T = TXT[lang];
  if (pz === 'cube3') return T['name.cube3'];
  if (pz.startsWith('cube')) return T['name.cube'].replace(/\{n\}/g, pz.slice(4)).replace(/\{cn\}/g, CN[+pz.slice(4)]);
  return T['name.' + pz];
}
function tr(lang, key, p) {
  const s = TXT[lang][key];
  if (s == null) throw new Error('missing seo text ' + lang + ':' + key);
  return s.replace(/\{(\w+)\}/g, (m, k) => { if (p[k] == null) throw new Error(`no param {${k}} for ${lang}:${key}`); return p[k]; });
}
// page-level key: cube2/3/4 have their own title/desc/h1, cube5–15 use the generic {n} templates
const pageKey = pz => !pz ? 'root' : (/^cube[234]$/.test(pz) || pz === 'pyraminx' || pz === 'skewb' || pz === 'megaminx') ? pz : 'cube';
function ogImage(pz) { return CFG.ogImageDir + (pz ? R.slug(pz) : 'root') + '.png'; }

function page(lang, pz) {
  const p = params(lang, pz), k = kind(pz), pk = pageKey(pz), t = key => tr(lang, key, p);
  const twisty = k === 'pyraminx' || k === 'skewb' || k === 'megaminx', n = pz && pz.startsWith('cube') ? +pz.slice(4) : 0;
  const title = t('title.' + pk), desc = t('desc.' + pk), h1 = t('h1.' + pk), url = abs(R.path(lang, pz));
  // ---------- visible content ----------
  const steps = [pz ? t('howto.s1') : t('howto.s1Root'), twisty ? t('howto.s2twisty') : t('howto.s2cube'), t('howto.s3'), t('howto.s4')];
  let solverP = null, notation = null, graphP;
  if (pz) {
    solverP = t('solver.' + (k === 'big' ? 'big' : k));
    notation = twisty ? t('notation.' + k) : [t('notation.cube'), n % 2 ? t('notation.mid') : null, n >= 4 ? t('notation.big') : null].filter(Boolean).join(' ');
    graphP = k === 'megaminx' ? t('graph.megaminx') : twisty ? t('graph.twisty') : t('graph.cube');
  } else graphP = t('graph.root');
  const faq = [];
  if (!pz) faq.push([t('faq.puzzles.q'), t('faq.puzzles.a')]);
  faq.push([t('faq.free.q'), t('faq.free.a')]);
  faq.push([t('faq.optimal.q'), !pz ? t('faq.optimal.root') : (k === 'cube2' || (twisty && k !== 'megaminx')) ? t('faq.optimal.yes') : t('faq.optimal.' + k)]);
  faq.push([pz ? t('faq.scan.q') : t('faq.scan.qRoot'), !pz ? t('faq.scan.root') : twisty ? t('faq.scan.twisty') : t('faq.scan.cube')]);
  const links = R.PUZZLES.map(q => [R.path(lang, q), tr(lang, 'h1.' + pageKey(q), params(lang, q)), q]);
  const linkList = `<ul class="seo-links">${(pz ? [[R.path(lang, null), t('links.home'), null]] : []).concat(links).map(([h, txt, q]) =>
    `<li><a href="${h}"${q === pz ? ' aria-current="page"' : ''}>${esc(txt)}</a></li>`).join('')}</ul>`;
  const sec = (id, h, inner) => `<section aria-labelledby="seo-${id}"><h2 id="seo-${id}">${esc(h)}</h2>${inner}</section>`;
  let body = `<article id="seo" class="seo card" data-seo-lang="${lang}" data-seo-puzzle="${pz || ''}">\n<p class="seo-intro">${esc(pz ? t('intro.' + (twisty ? k : 'cube')) : t('intro.root'))}</p>\n`;
  if (!pz) body += `<nav aria-labelledby="seo-links">` + `<h2 id="seo-links">${esc(t('links.title'))}</h2>${linkList}</nav>\n`;
  body += sec('howto', pz ? t('howto.title') : t('howto.titleRoot'), `<ol>${steps.map(s => `<li>${esc(s)}</li>`).join('')}</ol>`) + '\n';
  if (solverP) body += sec('solver', t('solver.title'), `<p>${esc(solverP)}</p>`) + '\n';
  if (k === 'big') body += sec('facts', t('facts.title'), `<ul>${bigFacts(lang, n).map(s => `<li>${esc(s)}</li>`).join('')}</ul>`) + '\n';
  if (notation) body += sec('notation', t('notation.title'), `<p dir="auto">${esc(notation)}</p>`) + '\n';
  body += sec('graph', t('graph.title'), `<p>${esc(graphP)}</p>`) + '\n';
  body += sec('faq', t('faq.title'), faq.map(([q, a]) => `<h3>${esc(q)}</h3><p>${esc(a)}</p>`).join('')) + '\n';
  if (pz) body += `<nav aria-labelledby="seo-links"><h2 id="seo-links">${esc(t('links.title'))}</h2>${linkList}</nav>\n`;
  body += `</article>`;
  const noscript = `<noscript><p class="noscript">${esc(t('noscript'))}</p></noscript>`;
  // ---------- head ----------
  const alts = R.LANGS.map(l => `<link rel="alternate" hreflang="${CFG.hreflang[l]}" href="${abs(R.path(l, pz))}">`).join('\n')
    + `\n<link rel="alternate" hreflang="x-default" href="${abs(R.path('en', pz))}">`;
  const SITE = p.site, img = abs(ogImage(pz)), imgAlt = pz ? tr(lang, 'og.alt', p) : SITE;
  const ld = { '@context': 'https://schema.org', '@graph': [] }, G = ld['@graph'], inLang = CFG.hreflang[lang];
  G.push({ '@type': 'WebSite', '@id': BASE + '/#website', url: BASE + '/', name: CFG.siteName, inLanguage: R.LANGS.map(l => CFG.hreflang[l]) });
  G.push({ '@type': 'WebApplication', '@id': url + '#app', name: pz ? h1 : SITE, alternateName: SITE === CFG.siteName ? undefined : CFG.siteName, url, description: desc, inLanguage: inLang,
    applicationCategory: 'UtilitiesApplication', operatingSystem: 'Any (web browser)', browserRequirements: 'Requires JavaScript and WebAssembly',
    isAccessibleForFree: true, offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }, image: img,
    featureList: [twisty ? null : t('howto.s2cube'), twisty ? t('howto.s2twisty') : null, solverP || t('faq.optimal.root'), t('tagline')].filter(Boolean), isPartOf: { '@id': BASE + '/#website' } });
  G.push({ '@type': 'WebPage', '@id': url, url, name: title, description: desc, inLanguage: inLang, isPartOf: { '@id': BASE + '/#website' },
    primaryImageOfPage: { '@type': 'ImageObject', url: img, width: 1200, height: 630 }, mainEntity: { '@id': url + '#app' },
    ...(pz ? { breadcrumb: { '@id': url + '#breadcrumb' } } : {}) });
  if (pz) G.push({ '@type': 'BreadcrumbList', '@id': url + '#breadcrumb', itemListElement: [
    { '@type': 'ListItem', position: 1, name: SITE, item: abs(R.path(lang, null)) },
    { '@type': 'ListItem', position: 2, name: h1, item: url }] });
  G.push({ '@type': 'HowTo', '@id': url + '#howto', name: pz ? t('howto.title') : t('howto.titleRoot'), inLanguage: inLang,
    tool: [{ '@type': 'HowToTool', name: SITE }], step: steps.map((s, i) => ({ '@type': 'HowToStep', position: i + 1, text: s })) });
  G.push({ '@type': 'FAQPage', '@id': url + '#faq', inLanguage: inLang, mainEntity: faq.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) });
  const head = [
    `<title>${esc(title)}</title>`,
    `<meta name="description" content="${esc(desc)}">`,
    `<link rel="canonical" href="${url}">`, alts,
    `<meta property="og:type" content="website">`, `<meta property="og:site_name" content="${esc(CFG.siteName)}">`,
    `<meta property="og:title" content="${esc(title)}">`, `<meta property="og:description" content="${esc(desc)}">`,
    `<meta property="og:url" content="${url}">`, `<meta property="og:image" content="${img}">`,
    `<meta property="og:image:width" content="1200">`, `<meta property="og:image:height" content="630">`, `<meta property="og:image:alt" content="${esc(imgAlt)}">`,
    `<meta property="og:locale" content="${CFG.ogLocale[lang]}">`,
    ...R.LANGS.filter(l => l !== lang).map(l => `<meta property="og:locale:alternate" content="${CFG.ogLocale[l]}">`),
    `<meta name="twitter:card" content="summary_large_image">`, `<meta name="twitter:title" content="${esc(title)}">`,
    `<meta name="twitter:description" content="${esc(desc)}">`, `<meta name="twitter:image" content="${img}">`, `<meta name="twitter:image:alt" content="${esc(imgAlt)}">`,
    `<link rel="icon" href="/img/favicon.svg" type="image/svg+xml">`, `<link rel="icon" href="/favicon.ico" sizes="32x32">`,
    `<link rel="apple-touch-icon" href="/img/apple-touch-icon.png">`, `<link rel="manifest" href="${lang === 'en' ? '/manifest.webmanifest' : '/manifest/' + lang.toLowerCase() + '.webmanifest'}">`,
    `<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>`
  ].join('\n');
  const htmlAttr = `lang="${LINFO[lang].html}" dir="${LINFO[lang].dir || 'ltr'}"` + (pz || lang !== 'en' ? ` data-page-lang="${lang}"` : '') + (pz ? ` data-page-puzzle="${pz}"` : '') + ' data-seo-page=""';
  const h1html = `<h1 id="pageTitle">${esc(h1)}</h1>\n      <p class="sub">${esc(SITE)} · ${esc(t('tagline'))}</p>`;
  // site logo = link to this language's home page (/, /zh-hans/, …)
  const homeLabel = esc(`${SITE} – ${t('nav.home')}`);
  const homeHtml = `<a class="logo" id="homeLink" href="${R.path(lang, null)}" aria-label="${homeLabel}" title="${homeLabel}">${'<i></i>'.repeat(9)}</a>`;
  const scripts = scriptList(lang, pz).map(f => `<script defer src="${f}"></script>`).join('\n');
  return { head, body, noscript, htmlAttr, h1html, homeHtml, url, title, desc, lang, pz, scripts, consent: consentHtml(lang) };
}

const hashes = {};
function hash(f) { return hashes[f] || (hashes[f] = require('crypto').createHash('sha1').update(fs.readFileSync(path.join(ROOT, f))).digest('hex').slice(0, 8)); }
function fill(tpl, pg) {
  const rep = (s, name, v) => {
    const re = new RegExp(`(<!--seo:${name}-->)[\\s\\S]*?(<!--/seo:${name}-->)`);
    if (!re.test(s)) throw new Error('marker seo:' + name + ' missing in index.html');
    return s.replace(re, (m, a, b) => a + '\n' + v + '\n' + b);
  };
  let s = tpl.replace(/<html[^>]*>/, `<html ${pg.htmlAttr}>`);
  // prerender the app shell's plain-text labels (data-i18n) in the page language, so the runtime i18n pass does not
  // change their size after first paint (empty buttons growing once filled caused a 0.33 CLS on /zh-hans/ desktop)
  s = s.replace(/(<([a-z][a-z0-9]*)\b[^>]*\sdata-i18n="([^"]+)"[^>]*>)([^<]*)(<\/\2>)/g, (m, open, tag, key, txt, close) =>
    /^consent\./.test(key) ? m : open + esc(APPT(pg.lang, key)) + close);
  s = rep(s, 'head', pg.head); s = rep(s, 'h1', pg.h1html); s = rep(s, 'body', pg.body); s = rep(s, 'noscript', pg.noscript); s = rep(s, 'home', pg.homeHtml);
  s = rep(s, 'consent', pg.consent); s = rep(s, 'scripts', pg.scripts);
  // cache busting for the HTML-referenced scripts / styles (served with a 1 h max-age, see deploy/_headers)
  s = s.replace(/(src|href)="((?:js|css|vendor|puzzles)\/[^"?]+)(\?v=[0-9a-f]+)?"/g, (m, a, f) => `${a}="${f}?v=${hash(f)}"`);
  if (!/<base href="\/">/.test(s)) s = s.replace('<meta charset="utf-8">', '<meta charset="utf-8">\n<base href="/">');
  return s;
}

function main() {
  const tplPath = path.join(ROOT, 'index.html'), tpl = fs.readFileSync(tplPath, 'utf8');
  fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true });
  const pages = [];
  for (const lang of R.LANGS) for (const pz of [null].concat(R.PUZZLES)) pages.push(page(lang, pz));
  for (const pg of pages) {
    const html = fill(tpl, pg), rel = R.path(pg.lang, pg.pz);
    if (rel === '/') fs.writeFileSync(tplPath, html);
    else { const d = path.join(OUT, rel); fs.mkdirSync(d, { recursive: true }); fs.writeFileSync(path.join(d, 'index.html'), html); }
  }
  // sitemap with hreflang alternates
  const today = new Date().toISOString().slice(0, 10);
  const sm = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">'];
  for (const pg of pages) {
    sm.push(`<url><loc>${pg.url}</loc><lastmod>${today}</lastmod>`);
    for (const l of R.LANGS) sm.push(`  <xhtml:link rel="alternate" hreflang="${CFG.hreflang[l]}" href="${abs(R.path(l, pg.pz))}"/>`);
    sm.push(`  <xhtml:link rel="alternate" hreflang="x-default" href="${abs(R.path('en', pg.pz))}"/>`, '</url>');
  }
  sm.push('</urlset>');
  fs.writeFileSync(path.join(OUT, 'sitemap.xml'), sm.join('\n') + '\n');
  fs.writeFileSync(path.join(OUT, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${BASE}/sitemap.xml\n`);
  // one web app manifest per language (/manifest.webmanifest for English, /manifest/<lang>.webmanifest otherwise)
  fs.mkdirSync(path.join(OUT, 'manifest'), { recursive: true });
  for (const l of R.LANGS) fs.writeFileSync(path.join(OUT, l === 'en' ? 'manifest.webmanifest' : 'manifest/' + l.toLowerCase() + '.webmanifest'), JSON.stringify({
    id: '/', name: TXT[l].site || CFG.siteName, short_name: 'CubeLab', description: TXT[l]['desc.root'].replace('{site}', TXT[l].site || CFG.siteName),
    start_url: R.path(l, null), scope: '/', display: 'standalone',
    background_color: CFG.themeColor, theme_color: CFG.themeColor, lang: LINFO[l].html, dir: LINFO[l].dir || 'ltr',
    icons: [{ src: '/img/icon-192.png', sizes: '192x192', type: 'image/png' }, { src: '/img/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/img/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }, { src: '/img/favicon.svg', sizes: 'any', type: 'image/svg+xml' }]
  }, null, 2) + '\n');
  // the page list (used by tests and the report)
  fs.writeFileSync(path.join(OUT, 'pages.json'), JSON.stringify(pages.map(p => ({ url: p.url, path: R.path(p.lang, p.pz), lang: p.lang, puzzle: p.pz, title: p.title })), null, 1));
  console.log(`build-seo: ${pages.length} pages (${R.LANGS.length} languages × ${R.PUZZLES.length + 1}), base ${BASE}`);
}
if (require.main === module) main();
module.exports = { page, kind, CONSENT_INLINE, scriptList };
