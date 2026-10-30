/* Keeps the address bar and the prerendered SEO content in step with the app:
   - choosing a puzzle or a language moves to that page's clean URL (/zh-hans/3x3-cube-solver/) with history.replaceState,
     and swaps title / meta / canonical / hreflang / JSON-LD / heading / static content from the prerendered page (no reload,
     app state is kept);
   - old query URLs (?puzzle=, ?n=, ?lang=) are normalized to the clean path (the Worker also 301-redirects them on "/").
   The root "/" (x-default) keeps its address on load and only swaps the text if the detected language is not English. */
(function () {
  var CL = window.CubeLab, R = CL && CL.seoRoutes, I = CL && CL.i18n, html = document.documentElement;
  if (!R || !I || !html.hasAttribute('data-seo-page') || !window.fetch || !window.DOMParser) return;
  var ps = { get value() { var b = document.getElementById('puzzleBtn'); return b ? b.dataset.pid : null; } };   // current puzzle (js/topbar.js)
  var pinned = !!html.getAttribute('data-page-puzzle'), seq = 0, cache = {};
  var KEEP = ['puzzle', 'n', 'lang'];

  function current() { var a = document.getElementById('seo'); return a ? { lang: a.getAttribute('data-seo-lang'), puzzle: a.getAttribute('data-seo-puzzle') || null } : {}; }
  function load(p) { if (!cache[p]) cache[p] = fetch(p, { credentials: 'same-origin' }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.text(); }); return cache[p]; }

  function swap(doc) {
    document.title = doc.title;
    var head = document.head;
    ['meta[name="description"]', 'link[rel="canonical"]', 'script[type="application/ld+json"]'].forEach(function (sel) {
      var a = head.querySelector(sel), b = doc.head.querySelector(sel); if (a && b) a.replaceWith(document.importNode(b, true));
    });
    head.querySelectorAll('meta[property^="og:"], meta[name^="twitter:"], link[rel="alternate"][hreflang]').forEach(function (e) { e.remove(); });
    var anchor = head.querySelector('link[rel="canonical"]');
    doc.head.querySelectorAll('link[rel="alternate"][hreflang], meta[property^="og:"], meta[name^="twitter:"]').forEach(function (e) {
      var c = document.importNode(e, true); anchor.after(c); anchor = c;
    });
    var h1 = document.getElementById('pageTitle'), h1b = doc.getElementById('pageTitle');
    if (h1 && h1b) { h1.textContent = h1b.textContent; var s = h1.nextElementSibling, sb = h1b.nextElementSibling; if (s && sb) s.textContent = sb.textContent; }
    var hl = document.getElementById('homeLink'), hlb = doc.getElementById('homeLink');   // logo → this language's home
    if (hl && hlb) ['href', 'aria-label', 'title'].forEach(function (k) { hl.setAttribute(k, hlb.getAttribute(k)); });
    var pl = document.getElementById('privacyLink'), plb = doc.getElementById('privacyLink');   // footer → this language's privacy page
    if (pl && plb) pl.setAttribute('href', plb.getAttribute('href'));
    var a = document.getElementById('seo'), b = doc.getElementById('seo'); if (a && b) a.replaceWith(document.importNode(b, true));
    ['data-page-lang', 'data-page-puzzle'].forEach(function (k) { if (doc.documentElement.hasAttribute(k)) html.setAttribute(k, doc.documentElement.getAttribute(k)); else html.removeAttribute(k); });
  }

  /** Bring URL + static content to (lang, puzzle). moveUrl=false keeps the address (root on first load). */
  function sync(lang, puzzle, moveUrl) {
    var target = R.path(lang, puzzle);
    if (moveUrl !== false) {
      var u = new URL(location.href); KEEP.forEach(function (k) { u.searchParams.delete(k); }); u.pathname = target;
      if (u.href !== location.href) history.replaceState(history.state, '', u);
    }
    var c = current(); if (c.lang === lang && c.puzzle === puzzle) return Promise.resolve(false);
    var my = ++seq;
    return load(target).then(function (txt) {
      if (my !== seq) return false;
      swap(new DOMParser().parseFromString(txt, 'text/html')); return true;
    }).catch(function () { return false; });
  }

  var started, readyRes;
  var nav = CL.seoNav = {
    /** called by app.js after the user picks a puzzle */
    go: function (puzzle) { pinned = true; return sync(I.lang(), puzzle); },
    sync: sync, ready: new Promise(function (r) { readyRes = r; }),
    /** called by app.js once the language pack and the first puzzle are mounted */
    start: function () {
      if (started) return nav.ready; started = true;
      I.onChange(function (lang) { sync(lang, pinned ? ps.value : null); });
      var q = location.search, hadQuery = /[?&](puzzle|n|lang)=/.test(q);
      if (/[?&](puzzle|n)=/.test(q)) pinned = true;
      readyRes(sync(I.lang(), pinned ? ps.value : null, hadQuery || location.pathname !== '/'));
      return nav.ready;
    }
  };
})();
