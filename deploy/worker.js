// Cloudflare Worker in front of the static assets. It runs only for page routes: wrangler.toml run_worker_first
// excludes every static asset path (/js, /css, /img, /puzzles, /vendor, favicon, sitemap, robots, manifest),
// so loading a page costs exactly one Worker invocation and assets never invoke it.
//  1. Canonical host: *.workers.dev and www.cube-solver.org → 301 to https://cube-solver.org (same path and query).
//  2. Old query URLs from before the SEO pages – /?puzzle=pyraminx, /?n=7, /?lang=fr – get a 301 to the clean path
//     (/fr/7x7-cube-solver/); every other parameter (mode, hold, start …) is kept. Both are done in a single hop.
//  3. Pages (text/html) get <html data-consent="1"> in the consent region – EU/EEA, UK, Switzerland, and whenever the
//     country is unknown (missing, XX, Tor T1) – and data-consent="0" elsewhere. js/analytics.js shows the opt-in banner
//     only in the consent region; elsewhere GA4 runs with analytics_storage granted and every ads signal denied.
//     The ETag gets a region suffix ("…-c1" / "…-c0"), so a browser that changes region never revalidates the other
//     variant's cached copy; If-None-Match is translated back before it reaches the asset store. HTML keeps the asset
//     store's must-revalidate caching, and no shared cache stores Worker page responses.
// Everything else is served from the static assets as is.
const CANONICAL_HOST = 'cube-solver.org';
const LANGS = ['en', 'zh-Hans', 'zh-Hant', 'es', 'ar', 'pt', 'id', 'ms', 'fr', 'ja', 'ru', 'de'];
const PUZZLES = new Set(['pyraminx', 'skewb', 'megaminx'].concat(Array.from({ length: 14 }, (_, i) => 'cube' + (i + 2))));
function matchLang(q) {
  if (!q) return null;
  const l = q.toLowerCase(), exact = LANGS.find(x => x.toLowerCase() === l);
  if (exact) return exact;
  if (/^zh-(tw|hk|mo|hant)/.test(l)) return 'zh-Hant';
  if (/^zh/.test(l)) return 'zh-Hans';
  const base = l.split('-')[0];
  return LANGS.find(x => x === base) || null;
}
function slug(p) { const m = /^cube(\d+)$/.exec(p); return m ? `${m[1]}x${m[1]}-cube-solver` : p + '-solver'; }
// EU 27 + EEA (IS, LI, NO) + United Kingdom + Switzerland
const CONSENT_COUNTRIES = new Set(['AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL',
  'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE', 'IS', 'LI', 'NO', 'GB', 'CH']);
function consentRequired(country) {
  const c = String(country || '').toUpperCase();
  return !/^[A-Z]{2}$/.test(c) || c === 'XX' || c === 'T1' || CONSENT_COUNTRIES.has(c);
}
const etagSuffix = req => req ? '-c1' : '-c0';
function tagEtag(etag, req) { return etag ? etag.replace(/"$/, etagSuffix(req) + '"') : etag; }
/** If-None-Match for the asset store: keep the tags of this region's variant (suffix removed), drop the other region's. */
function untagIfNoneMatch(v, req) {
  if (!v) return null;
  const mine = etagSuffix(req) + '"', keep = v.split(',').map(x => x.trim()).filter(x => x.endsWith(mine)).map(x => x.slice(0, -mine.length) + '"');
  return keep.length ? keep.join(', ') : null;
}
async function servePage(request, env) {
  const req = consentRequired(request.cf && request.cf.country);
  let fwd = request;
  const inm = request.headers && request.headers.get && request.headers.get('if-none-match');
  if (inm) {
    const h = new Headers(request.headers), t = untagIfNoneMatch(inm, req);
    if (t) h.set('if-none-match', t); else h.delete('if-none-match');
    fwd = new Request(request, { headers: h });
  }
  const res = await env.ASSETS.fetch(fwd);
  const ct = (res && res.headers && res.headers.get && res.headers.get('content-type')) || '';
  if (!/text\/html/i.test(ct) && res.status !== 304) return res;
  const out = res.status === 304 ? new Response(null, res) : new HTMLRewriter().on('html', { element(e) { e.setAttribute('data-consent', req ? '1' : '0'); } }).transform(res);
  const h = new Headers(out.headers), et = h.get('etag');
  if (et) h.set('etag', tagEtag(et, req));
  return new Response(out.body, { status: out.status, statusText: out.statusText, headers: h });
}
function redirectHost(host) { return host.endsWith('.workers.dev') || host === 'www.' + CANONICAL_HOST; }
export default {
  _internals: { consentRequired, tagEtag, untagIfNoneMatch, servePage },
  async fetch(request, env) {
    const url = new URL(request.url);
    const moveHost = redirectHost(url.hostname);
    let vary = false;
    if (url.pathname === '/' && /[?&](puzzle|n|lang)=/.test(url.search)) {
      const sp = url.searchParams, n = sp.get('n'), qp = sp.get('puzzle'), hasLang = sp.has('lang');
      const puzzle = qp && PUZZLES.has(qp) ? qp : n && PUZZLES.has('cube' + n) ? 'cube' + n : null;
      // no ?lang: old links keep following the browser language (first supported Accept-Language entry)
      const al = (request.headers && request.headers.get && request.headers.get('accept-language')) || '';
      const lang = matchLang(sp.get('lang')) || al.split(',').map(x => matchLang(x.split(';')[0].trim())).find(Boolean) || 'en';
      ['puzzle', 'n', 'lang'].forEach(k => sp.delete(k));
      url.pathname = '/' + (lang === 'en' ? '' : lang.toLowerCase() + '/') + (puzzle ? slug(puzzle) + '/' : '');
      vary = !hasLang && !!al;
    } else if (!moveHost) {
      return servePage(request, env);
    }
    if (moveHost) { url.protocol = 'https:'; url.hostname = CANONICAL_HOST; url.port = ''; }
    return vary ? new Response(null, { status: 301, headers: { Location: url.toString(), Vary: 'Accept-Language' } })
      : Response.redirect(url.toString(), 301);
  }
};
