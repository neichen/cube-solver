/* SEO routes shared by the browser (js/seo-nav.js) and the build script (tools/build-seo.js).
   One page per (language × puzzle): English lives at the root, other languages under /<code>/.
   The site's base URL is NOT here — it is configured once in seo/site.config.json. */
(function (root) {
  var LANGS = ['en', 'zh-Hans', 'zh-Hant', 'es', 'ar', 'pt', 'id', 'ms', 'fr', 'ja', 'ru', 'de'];
  var PUZZLES = [];
  for (var n = 2; n <= 15; n++) PUZZLES.push('cube' + n);
  PUZZLES.push('pyraminx', 'skewb');
  function slug(puzzle) {
    if (!puzzle) return '';
    var m = /^cube(\d+)$/.exec(puzzle);
    if (m) return m[1] + 'x' + m[1] + '-cube-solver';
    if (puzzle === 'pyraminx' || puzzle === 'skewb') return puzzle + '-solver';
    return null;
  }
  function langDir(lang) { return lang === 'en' ? '' : lang.toLowerCase(); }
  /** path('fr','cube3') → '/fr/3x3-cube-solver/'; path('en', null) → '/' */
  function path(lang, puzzle) {
    var d = langDir(lang), s = slug(puzzle);
    return '/' + (d ? d + '/' : '') + (s ? s + '/' : '');
  }
  /** parse('/zh-hans/pyraminx-solver/') → {lang:'zh-Hans', puzzle:'pyraminx'}; null if not a page path */
  function parse(p) {
    var parts = String(p || '/').split('/').filter(Boolean), lang = 'en', puzzle = null;
    if (parts.length && LANGS.some(function (l) { return l.toLowerCase() === parts[0].toLowerCase() && l !== 'en'; })) {
      lang = LANGS.filter(function (l) { return l.toLowerCase() === parts[0].toLowerCase(); })[0]; parts.shift();
    }
    if (parts[0] === 'index.html') parts.shift();
    if (parts.length) {
      puzzle = PUZZLES.filter(function (q) { return slug(q) === parts[0]; })[0] || null;
      if (!puzzle) return null;
      parts.shift();
      if (parts[0] === 'index.html') parts.shift();
    }
    return parts.length ? null : { lang: lang, puzzle: puzzle };
  }
  var API = { LANGS: LANGS, PUZZLES: PUZZLES, slug: slug, langDir: langDir, path: path, parse: parse };
  if (root.CubeLab) root.CubeLab.seoRoutes = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof self !== 'undefined' ? self : globalThis);
