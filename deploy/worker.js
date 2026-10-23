// Cloudflare Worker in front of the static assets. It runs only for page routes: wrangler.toml run_worker_first
// excludes every static asset path (/js, /css, /img, /puzzles, /vendor, favicon, sitemap, robots, manifest),
// so loading a page costs exactly one Worker invocation and assets never invoke it.
//  1. Canonical host: *.workers.dev and www.cube-solver.org → 301 to https://cube-solver.org (same path and query).
//  2. Old query URLs from before the SEO pages – /?puzzle=pyraminx, /?n=7, /?lang=fr – get a 301 to the clean path
//     (/fr/7x7-cube-solver/); every other parameter (mode, hold, start …) is kept. Both are done in a single hop.
// Everything else is served from the static assets as is.
const CANONICAL_HOST = 'cube-solver.org';
const LANGS = ['en', 'zh-Hans', 'zh-Hant', 'es', 'ar', 'pt', 'id', 'ms', 'fr', 'ja', 'ru', 'de'];
const PUZZLES = new Set(['pyraminx', 'skewb'].concat(Array.from({ length: 14 }, (_, i) => 'cube' + (i + 2))));
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
function redirectHost(host) { return host.endsWith('.workers.dev') || host === 'www.' + CANONICAL_HOST; }
export default {
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
      return env.ASSETS.fetch(request);
    }
    if (moveHost) { url.protocol = 'https:'; url.hostname = CANONICAL_HOST; url.port = ''; }
    return vary ? new Response(null, { status: 301, headers: { Location: url.toString(), Vary: 'Accept-Language' } })
      : Response.redirect(url.toString(), 301);
  }
};
