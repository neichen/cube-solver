/*
 * i18n core: per-locale string tables (js/i18n/<code>.js call CubeLab.i18n.register), t() with English fallback,
 * a tiny ICU-style formatter ({name}, {n, plural, one {# move} other {# moves}}, {x, unit, millisecond}),
 * Intl.NumberFormat / Intl.PluralRules per language, language detection, <html lang/dir>, and DOM binding helpers.
 */
(function (root) {
  'use strict';
  var CL = root.CubeLab = root.CubeLab || {};
  var LS_KEY = 'cubelab.lang';
  // Dropdown order is fixed (as requested); all languages are flat top-level options.
  var LANGS = [
    { code: 'en', name: 'English', html: 'en' },
    { code: 'zh-Hans', name: '简体中文', html: 'zh-Hans' },
    { code: 'zh-Hant', name: '繁體中文', html: 'zh-Hant' },
    { code: 'es', name: 'Español', html: 'es' },
    { code: 'ar', name: 'العربية', html: 'ar', dir: 'rtl' },
    { code: 'pt', name: 'Português', html: 'pt' },
    { code: 'id', name: 'Bahasa Indonesia', html: 'id' },
    { code: 'ms', name: 'Bahasa Melayu', html: 'ms' },
    { code: 'fr', name: 'Français', html: 'fr' },
    { code: 'ja', name: '日本語', html: 'ja' },
    { code: 'ru', name: 'Русский', html: 'ru' },
    { code: 'de', name: 'Deutsch', html: 'de' }
  ];
  var dicts = {}, lang = 'en', listeners = [], nfCache = {}, prCache = {}, bound = [];
  var missing = [];

  function info(code) { for (var i = 0; i < LANGS.length; i++) if (LANGS[i].code === code) return LANGS[i]; return null; }
  /** Map a BCP-47 tag (navigator.languages entry) to one of our codes, or null. */
  function match(tag) {
    if (!tag) return null;
    var t = String(tag).replace('_', '-'), low = t.toLowerCase(), base = low.split('-')[0];
    if (base === 'zh') {
      if (/-hant\b/.test(low) || /-(tw|hk|mo)\b/.test(low)) return 'zh-Hant';
      return 'zh-Hans';
    }
    if (base === 'in') base = 'id';   // legacy Indonesian tag
    if (base === 'zsm') base = 'ms';
    for (var i = 0; i < LANGS.length; i++) if (LANGS[i].code === base) return base;
    return null;
  }
  function detect(nav, storage, search) {
    var q = /[?&]lang=([\w-]+)/.exec(search || (root.location && root.location.search) || '');
    if (q && info(q[1])) return q[1];
    if (q && match(q[1])) return match(q[1]);
    // prerendered SEO pages (/fr/, /3x3-cube-solver/ …) carry their language; it wins over the stored preference
    var pl = root.document && root.document.documentElement && root.document.documentElement.getAttribute('data-page-lang');
    if (pl && info(pl) && !nav) return pl;
    try { var s = (storage || root.localStorage).getItem(LS_KEY); if (s && info(s)) return s; } catch (e) {}
    nav = nav || root.navigator || {};
    var list = (nav.languages && nav.languages.length ? nav.languages : [nav.language || nav.userLanguage]).filter(Boolean);
    for (var i = 0; i < list.length; i++) { var m = match(list[i]); if (m) return m; }
    return 'en';
  }

  function nf(n, opts) {
    var k = lang + JSON.stringify(opts || {});
    if (!nfCache[k]) { try { nfCache[k] = new Intl.NumberFormat(info(lang).html, opts); } catch (e) { nfCache[k] = { format: function (x) { return String(x); } }; } }
    return nfCache[k].format(n);
  }
  function plural(n) {
    if (!prCache[lang]) { try { prCache[lang] = new Intl.PluralRules(info(lang).html); } catch (e) { prCache[lang] = { select: function (x) { return x === 1 ? 'one' : 'other'; } }; } }
    return prCache[lang].select(n);
  }
  // French typography: no-break space before « : » and narrow no-break space before ; ! ? (applied to templates, not to parameters).
  function frenchSpaces(s) {
    return s.replace(/ ([:])/g, '\u00A0$1').replace(/ ([;!?»])/g, '\u202F$1').replace(/« /g, '«\u202F');
  }
  /** Find the matching closing brace for the "{" at index i. */
  function closeAt(s, i) { var d = 0; for (var j = i; j < s.length; j++) { if (s[j] === '{') d++; else if (s[j] === '}') { d--; if (!d) return j; } } return -1; }
  function fmtValue(v) { return typeof v === 'number' ? nf(v) : (v === undefined || v === null ? '' : String(v)); }
  function format(tpl, p) {
    var out = '', i = 0;
    while (i < tpl.length) {
      var c = tpl[i];
      if (c !== '{') { out += c; i++; continue; }
      var j = closeAt(tpl, i); if (j < 0) { out += tpl.slice(i); break; }
      var body = tpl.slice(i + 1, j), comma = body.indexOf(','), name = (comma < 0 ? body : body.slice(0, comma)).trim();
      if (comma < 0) out += fmtValue(p[name]);
      else {
        var rest = body.slice(comma + 1), c2 = rest.indexOf(','), type = (c2 < 0 ? rest : rest.slice(0, c2)).trim(), arg = c2 < 0 ? '' : rest.slice(c2 + 1).trim();
        if (type === 'plural') {
          var n = +p[name], cases = {}, k = 0, m;
          while (k < arg.length) {
            m = /^\s*(=\d+|zero|one|two|few|many|other)\s*\{/.exec(arg.slice(k)); if (!m) break;
            var st = k + m[0].length - 1, en = closeAt(arg, st); cases[m[1]] = arg.slice(st + 1, en); k = en + 1;
          }
          var sel = cases['=' + n] !== undefined ? cases['=' + n] : cases[plural(n)] !== undefined ? cases[plural(n)] : cases.other || '';
          out += format(sel.replace(/#/g, '\u0000'), p).replace(/\u0000/g, nf(n));
        } else if (type === 'unit') {
          try { out += nf(+p[name], { style: 'unit', unit: arg, unitDisplay: 'short' }); } catch (e) { out += nf(+p[name]) + ' ' + arg; }
        } else if (type === 'number') out += nf(+p[name]);
        else out += fmtValue(p[name]);
      }
      i = j + 1;
    }
    return out;
  }
  function raw(key) {
    var d = dicts[lang];
    if (d && d[key] !== undefined) return d[key];
    if (missing.indexOf(lang + ':' + key) < 0) missing.push(lang + ':' + key);
    if (dicts.en && dicts.en[key] !== undefined) return dicts.en[key];
    return key;
  }
  // Chinese ordinal for N×N cubes ({cn}: 二 … 十五), so zh labels can read 三阶魔方 / 三階魔術方塊
  var CN = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二', '十三', '十四', '十五'];
  function t(key, params) {
    var s = raw(key);
    if (params && params.n != null && params.cn == null && /\{cn\}/.test(s)) { var o = {}; for (var k in params) o[k] = params[k]; o.cn = CN[+params.n] || String(params.n); params = o; }
    if (lang === 'fr') s = frenchSpaces(s);
    return params || /\{/.test(s) ? format(s, params || {}) : s;
  }

  function applyDocument(doc) {
    doc = doc || root.document; if (!doc) return;
    var I = info(lang), html = doc.documentElement;
    html.lang = I.html; html.dir = I.dir || 'ltr';
    // prerendered SEO pages keep their own title / description (js/seo-nav.js swaps them on language change)
    if (!html.hasAttribute('data-seo-page')) {
      doc.title = t('meta.title');
      var md = doc.querySelector('meta[name="description"]'); if (md) md.setAttribute('content', t('meta.description'));
    }
    [['data-i18n', null], ['data-i18n-title', 'title'], ['data-i18n-aria', 'aria-label'], ['data-i18n-placeholder', 'placeholder']].forEach(function (a) {
      doc.querySelectorAll('[' + a[0] + ']').forEach(function (el) {
        var v = t(el.getAttribute(a[0]));
        if (a[1]) el.setAttribute(a[1], v); else el.textContent = v;
      });
    });
    bound = bound.filter(function (b) { return b.el.isConnected !== false; });
    bound.forEach(function (b) { render(b); });
  }
  function render(b) { var v = b.fn ? b.fn() : t(b.key, b.params); if (b.attr) b.el.setAttribute(b.attr, v); else b.el.textContent = v; }
  /** Set an element's text (or attribute) from a key and remember it, so it is re-rendered on language change. */
  function bind(el, key, params, attr) {
    if (!el) return '';
    bound = bound.filter(function (b) { return !(b.el === el && b.attr === (attr || null)); });
    var b = { el: el, key: typeof key === 'function' ? null : key, fn: typeof key === 'function' ? key : null, params: params, attr: attr || null };
    bound.push(b); render(b); return el;
  }

  // Language packs are loaded on demand: a page ships only its own language (js/i18n/<code>.js, deferred script);
  // another language is fetched when detected or chosen. Literal URLs so tools/build-dist.js can version them.
  var PACKS = { en: 'js/i18n/en.js', 'zh-Hans': 'js/i18n/zh-Hans.js', 'zh-Hant': 'js/i18n/zh-Hant.js', es: 'js/i18n/es.js', ar: 'js/i18n/ar.js',
    pt: 'js/i18n/pt.js', id: 'js/i18n/id.js', ms: 'js/i18n/ms.js', fr: 'js/i18n/fr.js', ja: 'js/i18n/ja.js', ru: 'js/i18n/ru.js', de: 'js/i18n/de.js' };
  var loadingPacks = {};
  function loadPack(code) {
    if (dicts[code] || !root.document || !PACKS[code]) return Promise.resolve();
    if (loadingPacks[code]) return loadingPacks[code];
    return (loadingPacks[code] = new Promise(function (res, rej) {
      var s = root.document.createElement('script'); s.src = PACKS[code];
      s.onload = function () { res(); }; s.onerror = function () { delete loadingPacks[code]; rej(new Error('language pack ' + code)); };
      root.document.head.appendChild(s);
    }));
  }
  function setLangNow(code, persist) {
    lang = code; nfCache = {};
    if (persist !== false) { try { root.localStorage.setItem(LS_KEY, code); } catch (e) {} }
    applyDocument();
    listeners.forEach(function (f) { try { f(code); } catch (e) { if (root.console) console.error(e); } });
  }
  /** Switch language (loads its pack first if needed). Returns a promise that resolves once the page is translated. */
  function setLang(code, persist) {
    if (!info(code)) code = 'en';
    if (dicts[code]) { setLangNow(code, persist); return Promise.resolve(code); }
    return loadPack(code).then(function () { setLangNow(code, persist); return code; }, function (e) {
      if (root.console) console.error(e);
      if (!dicts[lang]) return loadPack('en').then(function () { setLangNow('en', false); return 'en'; });
      return lang;
    });
  }
  var readyP = null;
  /** Detect the language, load its pack, translate the page. Called once by js/app.js before the app mounts. */
  function init() {
    if (readyP) return readyP;
    var code = detect();
    readyP = dicts[code] ? Promise.resolve(code) : loadPack(code).then(function () { return code; }, function () { return loadPack('en').then(function () { return 'en'; }); });
    return (readyP = readyP.then(function (c) { lang = info(c) ? c : 'en'; nfCache = {}; applyDocument(); return lang; }));
  }

  var I18N = CL.i18n = {
    LANGS: LANGS, LS_KEY: LS_KEY, dicts: dicts, missing: missing,
    register: function (code, dict) { dicts[code] = dict; },
    t: t, format: format, nf: nf, plural: plural, match: match, detect: detect, info: info, bind: bind,
    lang: function () { return lang; }, dir: function () { return (info(lang) || {}).dir || 'ltr'; },
    setLang: setLang, apply: applyDocument, init: init, loadPack: loadPack, PACKS: PACKS,
    /** 订阅语言切换；返回取消订阅的函数（切换谜题时释放旧视图的监听） */
    onChange: function (f) { listeners.push(f); return function () { var k = listeners.indexOf(f); if (k >= 0) listeners.splice(k, 1); }; },
    /** Populate a <select> with the language list: flat top-level options in the fixed order (no optgroups). */
    fillSelect: function (sel) {
      sel.innerHTML = '';
      LANGS.forEach(function (L) {
        var o = new Option(L.name, L.code); o.lang = L.html; if (L.dir) o.dir = L.dir;
        sel.appendChild(o);
      });
      sel.value = lang;
    },
    _setLangSilently: function (code) { lang = info(code) ? code : 'en'; }
  };
  CL.t = t;
  if (typeof module !== 'undefined' && module.exports) module.exports = I18N;
})(typeof window !== 'undefined' ? window : globalThis);
