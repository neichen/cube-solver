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
const TXT = {}; R.LANGS.forEach(c => { TXT[c] = JSON.parse(fs.readFileSync(path.join(ROOT, 'seo/lang', c + '.json'), 'utf8')); });
const M = CFG.measured;
const CN = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二', '十三', '十四', '十五'];

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const abs = p => BASE + p;
function kind(pz) {
  if (!pz) return 'root';
  if (pz === 'pyraminx' || pz === 'skewb') return pz;
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
  p.name = pz ? puzzleName(lang, pz) : '';
  return p;
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
const pageKey = pz => !pz ? 'root' : (/^cube[234]$/.test(pz) || pz === 'pyraminx' || pz === 'skewb') ? pz : 'cube';
function ogImage(pz) { return CFG.ogImageDir + (pz ? R.slug(pz) : 'root') + '.png'; }

function page(lang, pz) {
  const p = params(lang, pz), k = kind(pz), pk = pageKey(pz), t = key => tr(lang, key, p);
  const twisty = k === 'pyraminx' || k === 'skewb', n = pz && pz.startsWith('cube') ? +pz.slice(4) : 0;
  const title = t('title.' + pk), desc = t('desc.' + pk), h1 = t('h1.' + pk), url = abs(R.path(lang, pz));
  // ---------- visible content ----------
  const steps = [pz ? t('howto.s1') : t('howto.s1Root'), twisty ? t('howto.s2twisty') : t('howto.s2cube'), t('howto.s3'), t('howto.s4')];
  let solverP = null, notation = null, graphP;
  if (pz) {
    solverP = t('solver.' + (k === 'big' ? 'big' : k));
    notation = twisty ? t('notation.' + k) : [t('notation.cube'), n % 2 ? t('notation.mid') : null, n >= 4 ? t('notation.big') : null].filter(Boolean).join(' ');
    graphP = twisty ? t('graph.twisty') : t('graph.cube');
  } else graphP = t('graph.root');
  const faq = [];
  if (!pz) faq.push([t('faq.puzzles.q'), t('faq.puzzles.a')]);
  faq.push([t('faq.free.q'), t('faq.free.a')]);
  faq.push([t('faq.optimal.q'), !pz ? t('faq.optimal.root') : (k === 'cube2' || twisty) ? t('faq.optimal.yes') : t('faq.optimal.' + k)]);
  faq.push([pz ? t('faq.scan.q') : t('faq.scan.qRoot'), !pz ? t('faq.scan.root') : twisty ? t('faq.scan.twisty') : t('faq.scan.cube')]);
  const links = R.PUZZLES.map(q => [R.path(lang, q), tr(lang, 'h1.' + pageKey(q), params(lang, q)), q]);
  const linkList = `<ul class="seo-links">${(pz ? [[R.path(lang, null), t('links.home'), null]] : []).concat(links).map(([h, txt, q]) =>
    `<li><a href="${h}"${q === pz ? ' aria-current="page"' : ''}>${esc(txt)}</a></li>`).join('')}</ul>`;
  const sec = (id, h, inner) => `<section aria-labelledby="seo-${id}"><h2 id="seo-${id}">${esc(h)}</h2>${inner}</section>`;
  let body = `<article id="seo" class="seo card" data-seo-lang="${lang}" data-seo-puzzle="${pz || ''}">\n<p class="seo-intro">${esc(pz ? t('intro.' + (twisty ? k : 'cube')) : t('intro.root'))}</p>\n`;
  if (!pz) body += `<nav aria-labelledby="seo-links">` + `<h2 id="seo-links">${esc(t('links.title'))}</h2>${linkList}</nav>\n`;
  body += sec('howto', pz ? t('howto.title') : t('howto.titleRoot'), `<ol>${steps.map(s => `<li>${esc(s)}</li>`).join('')}</ol>`) + '\n';
  if (solverP) body += sec('solver', t('solver.title'), `<p>${esc(solverP)}</p>`) + '\n';
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
    `<link rel="apple-touch-icon" href="/img/apple-touch-icon.png">`, `<link rel="manifest" href="/manifest.webmanifest">`,
    `<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>`
  ].join('\n');
  const htmlAttr = `lang="${LINFO[lang].html}" dir="${LINFO[lang].dir || 'ltr'}"` + (pz || lang !== 'en' ? ` data-page-lang="${lang}"` : '') + (pz ? ` data-page-puzzle="${pz}"` : '') + ' data-seo-page=""';
  const h1html = `<h1 id="pageTitle">${esc(h1)}</h1>\n      <p class="sub">${esc(SITE)} · ${esc(t('tagline'))}</p>`;
  // site logo = link to this language's home page (/, /zh-hans/, …)
  const homeLabel = esc(`${SITE} – ${t('nav.home')}`);
  const homeHtml = `<a class="logo" id="homeLink" href="${R.path(lang, null)}" aria-label="${homeLabel}" title="${homeLabel}">${'<i></i>'.repeat(9)}</a>`;
  return { head, body, noscript, htmlAttr, h1html, homeHtml, url, title, desc, lang, pz };
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
  s = rep(s, 'head', pg.head); s = rep(s, 'h1', pg.h1html); s = rep(s, 'body', pg.body); s = rep(s, 'noscript', pg.noscript); s = rep(s, 'home', pg.homeHtml);
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
  fs.writeFileSync(path.join(OUT, 'manifest.webmanifest'), JSON.stringify({
    name: CFG.siteName, short_name: 'CubeLab', description: TXT.en['desc.root'].replace('{site}', CFG.siteName), start_url: '/', scope: '/', display: 'standalone',
    background_color: CFG.themeColor, theme_color: CFG.themeColor, lang: 'en', dir: 'ltr',
    icons: [{ src: '/img/icon-192.png', sizes: '192x192', type: 'image/png' }, { src: '/img/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/img/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }, { src: '/img/favicon.svg', sizes: 'any', type: 'image/svg+xml' }]
  }, null, 2) + '\n');
  // the page list (used by tests and the report)
  fs.writeFileSync(path.join(OUT, 'pages.json'), JSON.stringify(pages.map(p => ({ url: p.url, path: R.path(p.lang, p.pz), lang: p.lang, puzzle: p.pz, title: p.title })), null, 1));
  console.log(`build-seo: ${pages.length} pages (${R.LANGS.length} languages × ${R.PUZZLES.length + 1}), base ${BASE}`);
}
if (require.main === module) main();
module.exports = { page, kind };
