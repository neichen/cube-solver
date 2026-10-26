/* Top bar: puzzle menu, language menu, share popover, GitHub link (icon buttons, no <select>).
   - html(lang, puzzle, t, R) builds the markup; tools/build-seo.js prerenders it into every page (no layout shift,
     crawlable <a href> links to every puzzle page and to the same page in every language). The browser keeps it in
     step (labels, current item, hrefs) without replacing the buttons, so focus is never lost.
   - Menus follow the WAI-ARIA menu-button pattern: Enter / Space / ↓ / ↑ open, arrows / Home / End move, Esc closes and
     returns focus, Tab and outside clicks close. Item clicks are handled in place (no reload); modified clicks
     (Ctrl/⌘/Shift/middle) keep the normal link behaviour.
   - Share: native share sheet (navigator.share) when available, copy link, plain intent URLs (no third-party scripts),
     PNG of the 3D view. The link carries the current position in the fragment (js/core/share-code.js).
   Icons: GitHub mark, share, link, download, check from GitHub Octicons (MIT, see THIRD_PARTY_NOTICES.md); the puzzle
   icons and the globe are drawn here. */
(function (root) {
  'use strict';
  var GH_URL = 'https://github.com/neichen/cube-solver';
  var OCT = {   // Octicons 16px paths (MIT)
    github: 'M6.766 11.328c-2.063-.25-3.516-1.734-3.516-3.656 0-.781.281-1.625.75-2.188-.203-.515-.172-1.609.063-2.062.625-.078 1.468.25 1.968.703.594-.187 1.219-.281 1.985-.281.765 0 1.39.094 1.953.265.484-.437 1.344-.765 1.969-.687.218.422.25 1.515.046 2.047.5.593.766 1.39.766 2.203 0 1.922-1.453 3.375-3.547 3.64.531.344.89 1.094.89 1.954v1.625c0 .468.391.734.86.547C13.781 14.359 16 11.53 16 8.03 16 3.61 12.406 0 7.984 0 3.563 0 0 3.61 0 8.031a7.88 7.88 0 0 0 5.172 7.422c.422.156.828-.125.828-.547v-1.25c-.219.094-.5.156-.75.156-1.031 0-1.64-.562-2.078-1.609-.172-.422-.36-.672-.719-.719-.187-.015-.25-.093-.25-.187 0-.188.313-.328.625-.328.453 0 .844.281 1.25.86.313.452.64.655 1.031.655s.641-.14 1-.5c.266-.265.47-.5.657-.656',
    share: 'M3.75 6.5a.25.25 0 0 0-.25.25v6.5c0 .138.112.25.25.25h8.5a.25.25 0 0 0 .25-.25v-6.5a.25.25 0 0 0-.25-.25h-1a.75.75 0 0 1 0-1.5h1c.966 0 1.75.784 1.75 1.75v6.5A1.75 1.75 0 0 1 12.25 15h-8.5A1.75 1.75 0 0 1 2 13.25v-6.5C2 5.784 2.784 5 3.75 5h1a.75.75 0 0 1 0 1.5ZM7.823.177a.25.25 0 0 1 .354 0l2.896 2.896a.25.25 0 0 1-.177.427H8.75v5.75a.75.75 0 0 1-1.5 0V3.5H5.104a.25.25 0 0 1-.177-.427Z',
    link: 'm7.775 3.275 1.25-1.25a3.5 3.5 0 1 1 4.95 4.95l-2.5 2.5a3.5 3.5 0 0 1-4.95 0 .751.751 0 0 1 .018-1.042.751.751 0 0 1 1.042-.018 1.998 1.998 0 0 0 2.83 0l2.5-2.5a2.002 2.002 0 0 0-2.83-2.83l-1.25 1.25a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042Zm-4.69 9.64a1.998 1.998 0 0 0 2.83 0l1.25-1.25a.751.751 0 0 1 1.042.018.751.751 0 0 1 .018 1.042l-1.25 1.25a3.5 3.5 0 1 1-4.95-4.95l2.5-2.5a3.5 3.5 0 0 1 4.95 0 .751.751 0 0 1-.018 1.042.751.751 0 0 1-1.042.018 1.998 1.998 0 0 0-2.83 0l-2.5 2.5a1.998 1.998 0 0 0 0 2.83Z',
    download: 'M2.75 14A1.75 1.75 0 0 1 1 12.25v-2.5a.75.75 0 0 1 1.5 0v2.5c0 .138.112.25.25.25h10.5a.25.25 0 0 0 .25-.25v-2.5a.75.75 0 0 1 1.5 0v2.5A1.75 1.75 0 0 1 13.25 14ZM7.25 7.689V2a.75.75 0 0 1 1.5 0v5.689l1.97-1.969a.749.749 0 1 1 1.06 1.06l-3.25 3.25a.749.749 0 0 1-1.06 0L4.22 6.78a.749.749 0 1 1 1.06-1.06l1.97 1.969Z',
    device: 'M3.75 0h8.5C13.216 0 14 .784 14 1.75v12.5A1.75 1.75 0 0 1 12.25 16h-8.5A1.75 1.75 0 0 1 2 14.25V1.75C2 .784 2.784 0 3.75 0ZM3.5 1.75v12.5c0 .138.112.25.25.25h8.5a.25.25 0 0 0 .25-.25V1.75a.25.25 0 0 0-.25-.25h-8.5a.25.25 0 0 0-.25.25ZM8 13a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z'
  };
  var GLOBE = 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm6.9 6h-2.95a15.7 15.7 0 0 0-1.38-3.56A8.03 8.03 0 0 1 18.9 8zM12 4.04c.83 1.2 1.48 2.53 1.91 3.96h-3.82c.43-1.43 1.08-2.76 1.91-3.96zM4.26 14a8.2 8.2 0 0 1 0-4h3.38a16.5 16.5 0 0 0 0 4H4.26zm.82 2h2.95c.32 1.25.78 2.45 1.38 3.56A7.99 7.99 0 0 1 5.08 16zm2.95-8H5.08a7.99 7.99 0 0 1 4.33-3.56A15.7 15.7 0 0 0 8.03 8zM12 19.96c-.83-1.2-1.48-2.53-1.91-3.96h3.82c-.43 1.43-1.08 2.76-1.91 3.96zM14.34 14H9.66a14.7 14.7 0 0 1 0-4h4.68a14.7 14.7 0 0 1 0 4zm.25 5.56c.6-1.11 1.06-2.31 1.38-3.56h2.95a8.03 8.03 0 0 1-4.33 3.56zM16.36 14a16.5 16.5 0 0 0 0-4h3.38a8.2 8.2 0 0 1 0 4h-3.38z';
  function oct(name, cls) { return '<svg class="ico' + (cls ? ' ' + cls : '') + '" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="' + OCT[name] + '"/></svg>'; }
  var CARET = '<svg class="caret" viewBox="0 0 12 12" aria-hidden="true" focusable="false"><path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  // ---------------------------------------------------------------- puzzle icons (own drawings, 32×32)
  var f1 = function (x) { return Math.round(x * 100) / 100; };
  function pt(p) { return f1(p[0]) + ' ' + f1(p[1]); }
  function poly(ps, fill) { return '<path d="M' + ps.map(pt).join('L') + 'Z" fill="' + fill + '"/>'; }
  function add(a, b, k) { return [a[0] + b[0] * k, a[1] + b[1] * k]; }
  function gridLines(o, a, b, g) {
    var d = '';
    for (var i = 1; i < g; i++) {
      var p = add(o, a, i / g), q = add(p, b, 1); d += 'M' + pt(p) + 'L' + pt(q);
      p = add(o, b, i / g); q = add(p, a, 1); d += 'M' + pt(p) + 'L' + pt(q);
    }
    return d;
  }
  function cubeIcon(n, skewb) {
    var T = [16, 2.5], UR = [27.7, 9.25], C = [16, 16], UL = [4.3, 9.25], LL = [4.3, 22.75], B = [16, 29.5], LR = [27.7, 22.75];
    var faces = [[UL, T, UR, C, '#fbfbf8'], [UL, C, B, LL, '#2f8f52'], [C, UR, LR, B, '#dd3429']];
    var s = faces.map(function (f) { return poly(f.slice(0, 4), f[4]); }).join(''), d = '';
    if (skewb) faces.forEach(function (f) {
      var m = f.slice(0, 4).map(function (p, i, a) { var q = a[(i + 1) % 4]; return [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2]; });
      d += 'M' + m.map(pt).join('L') + 'Z';
    });
    else { var g = Math.min(n, 7); d = gridLines(UL, [T[0] - UL[0], T[1] - UL[1]], [C[0] - UL[0], C[1] - UL[1]], g) +
      gridLines(UL, [C[0] - UL[0], C[1] - UL[1]], [0, LL[1] - UL[1]], g) + gridLines(C, [UR[0] - C[0], UR[1] - C[1]], [0, B[1] - C[1]], g); }
    var w = skewb ? 1 : n <= 3 ? 1 : n <= 5 ? .8 : .55;
    return s + '<path d="' + d + 'M' + pt(UL) + 'L' + pt(C) + 'L' + pt(UR) + 'M' + pt(C) + 'L' + pt(B) + '" fill="none" stroke="#151515" stroke-width="' + w + '" stroke-linejoin="round"/>' +
      '<path d="M' + [T, UR, LR, B, LL, UL].map(pt).join('L') + 'Z" fill="none" stroke="#151515" stroke-width="1.5" stroke-linejoin="round"/>';
  }
  function pyraIcon() {
    var A = [16, 3], Bp = [29.5, 27], Cp = [2.5, 27], d = '';
    for (var i = 1; i < 3; i++) {
      var k = i / 3;
      d += 'M' + pt(add(A, [Cp[0] - A[0], Cp[1] - A[1]], k)) + 'L' + pt(add(A, [Bp[0] - A[0], Bp[1] - A[1]], k));
      d += 'M' + pt(add(Cp, [A[0] - Cp[0], A[1] - Cp[1]], k)) + 'L' + pt(add(Cp, [Bp[0] - Cp[0], Bp[1] - Cp[1]], k));
      d += 'M' + pt(add(Bp, [A[0] - Bp[0], A[1] - Bp[1]], k)) + 'L' + pt(add(Bp, [Cp[0] - Bp[0], Cp[1] - Bp[1]], k));
    }
    return poly([A, Bp, Cp], '#2f8f52') + '<path d="' + d + '" fill="none" stroke="#151515" stroke-width="1"/>' +
      '<path d="M' + [A, Bp, Cp].map(pt).join('L') + 'Z" fill="none" stroke="#151515" stroke-width="1.5" stroke-linejoin="round"/>';
  }
  function megaIcon() {
    var V = [], v = [], d = '';
    for (var i = 0; i < 5; i++) { var a = -Math.PI / 2 + i * 2 * Math.PI / 5; V.push([16 + 14 * Math.cos(a), 17 + 14 * Math.sin(a)]); v.push([16 + 6.2 * Math.cos(a), 17 + 6.2 * Math.sin(a)]); }
    for (i = 0; i < 5; i++) {
      var n = V[(i + 1) % 5], p = V[(i + 4) % 5];
      d += 'M' + pt(add(V[i], [n[0] - V[i][0], n[1] - V[i][1]], 1 / 3)) + 'L' + pt(v[i]) + 'L' + pt(add(V[i], [p[0] - V[i][0], p[1] - V[i][1]], 1 / 3));
    }
    d += 'M' + v.map(pt).join('L') + 'Z';
    return poly(V, '#2f8f52') + '<path d="' + d + '" fill="none" stroke="#151515" stroke-width="1" stroke-linejoin="round"/>' +
      '<path d="M' + V.map(pt).join('L') + 'Z" fill="none" stroke="#151515" stroke-width="1.5" stroke-linejoin="round"/>';
  }
  var iconCache = {};
  function puzzleIcon(id) {
    if (!iconCache[id]) {
      var m = /^cube(\d+)$/.exec(id);
      iconCache[id] = '<svg class="pz-ico" viewBox="0 0 32 32" aria-hidden="true" focusable="false">' +
        (m ? cubeIcon(+m[1]) : id === 'pyraminx' ? pyraIcon() : id === 'skewb' ? cubeIcon(2, true) : megaIcon()) + '</svg>';
    }
    return iconCache[id];
  }
  function puzzleName(id, t) { var m = /^cube(\d+)$/.exec(id); return m ? t('puzzle.cubeN', { n: m[1] }) : t('puzzle.' + id); }
  var SHORT = { en: 'EN', 'zh-Hans': '简', 'zh-Hant': '繁', es: 'ES', ar: 'AR', pt: 'PT', id: 'ID', ms: 'MS', fr: 'FR', ja: 'JA', ru: 'RU', de: 'DE' };
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

  // ---------------------------------------------------------------- markup (shared by the build and the browser)
  function puzzleBtnInner(cur, t) {
    return puzzleIcon(cur) + '<span class="tb-label" id="puzzleName">' + esc(puzzleName(cur, t)) + '</span>' + CARET;
  }
  function puzzleItems(lang, cur, t, R) {
    return R.PUZZLES.map(function (id) {
      return '<a role="menuitem" tabindex="-1" data-pid="' + id + '" href="' + R.path(lang, id) + '"' + (id === cur ? ' aria-current="true"' : '') + '>' +
        puzzleIcon(id) + '<span>' + esc(puzzleName(id, t)) + '</span></a>';
    }).join('');
  }
  function langItems(lang, pagePz, langs, R) {
    return langs.map(function (L) {
      return '<a role="menuitem" tabindex="-1" data-lang="' + L.code + '" href="' + R.path(L.code, pagePz) + '" hreflang="' + L.html + '" lang="' + L.html + '"' +
        (L.dir ? ' dir="' + L.dir + '"' : '') + (L.code === lang ? ' aria-current="true"' : '') + '>' +
        '<span class="lang-code" aria-hidden="true">' + SHORT[L.code] + '</span><span>' + esc(L.name) + '</span></a>';
    }).join('');
  }
  function langBtnInner(lang) {
    return '<svg class="globe" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="' + GLOBE + '"/></svg><span class="tb-code" aria-hidden="true">' + SHORT[lang] + '</span>' + CARET;
  }
  /** Full top-bar controls for a page (lang, puzzle|null). pagePz = the page's own puzzle (null on language roots). */
  function html(lang, pagePz, t, R, langs) {
    var cur = pagePz || 'cube3', cur_ = esc(puzzleName(cur, t)), L = langs.filter(function (x) { return x.code === lang; })[0];
    return '<div class="top-picks" id="topPicks">' +
      '<div class="mb pz-mb"><button type="button" class="tb-btn pz-btn" id="puzzleBtn" aria-haspopup="true" aria-expanded="false" aria-controls="puzzleMenu" data-pid="' + cur + '"' +
        ' aria-label="' + esc(t('puzzle.btnAria', { name: puzzleName(cur, t) })) + '" title="' + esc(t('puzzle.aria')) + '">' + puzzleBtnInner(cur, t) + '</button>' +
        '<div class="menu pz-menu" id="puzzleMenu" role="menu" aria-label="' + esc(t('puzzle.label')) + '" hidden>' + puzzleItems(lang, cur, t, R) + '</div></div>' +
      '<div class="mb lang-mb"><button type="button" class="tb-btn lang-btn" id="langBtn" aria-haspopup="true" aria-expanded="false" aria-controls="langMenu" data-lang="' + lang + '"' +
        ' aria-label="' + esc(t('lang.btnAria', { name: L.name })) + '" title="' + esc(t('lang.label')) + '">' + langBtnInner(lang) + '</button>' +
        '<div class="menu lang-menu" id="langMenu" role="menu" aria-label="' + esc(t('lang.label')) + '" hidden>' + langItems(lang, pagePz, langs, R) + '</div></div>' +
      '<div class="mb share-mb"><button type="button" class="tb-btn icon-btn" id="shareBtn" aria-haspopup="dialog" aria-expanded="false" aria-controls="sharePanel"' +
        ' aria-label="' + esc(t('share.button')) + '" title="' + esc(t('share.button')) + '">' + oct('share') + '</button>' +
        '<div class="menu share-panel" id="sharePanel" role="dialog" aria-label="' + esc(t('share.title')) + '" hidden></div></div>' +
      '<a class="tb-btn icon-btn" id="ghLink" href="' + GH_URL + '" target="_blank" rel="noopener" aria-label="' + esc(t('github.label')) + '" title="' + esc(t('github.label')) + '">' + oct('github') + '</a>' +
      '</div>';
  }

  var TB = { html: html, puzzleIcon: puzzleIcon, puzzleName: puzzleName, GH_URL: GH_URL, SHORT: SHORT };
  if (typeof module !== 'undefined' && module.exports) module.exports = TB;
  var CL = root.CubeLab; if (CL) CL.topbar = TB;
  var doc = root.document;
  if (!CL || !doc || !doc.getElementById) return;

  // ---------------------------------------------------------------- browser behaviour
  var I, R, opts = {}, curPz = null, openEl = null, toastTimer = 0;
  var $ = function (id) { return doc.getElementById(id); };
  function t(k, p) { return I.t(k, p); }
  function items(menu) { return Array.prototype.slice.call(menu.querySelectorAll('[role=menuitem]')); }
  function pagePuzzle() { var r = R.parse(location.pathname); return r ? r.puzzle : null; }

  /** Re-label everything for the current language / puzzle (buttons stay the same elements). */
  function render() {
    if (!$('topPicks') || !I) return;
    var lang = I.lang(), cur = curPz || 'cube3', pb = $('puzzleBtn'), lb = $('langBtn'), L = I.info(lang) || I.LANGS[0];
    pb.innerHTML = puzzleBtnInner(cur, t); pb.dataset.pid = cur;
    pb.setAttribute('aria-label', t('puzzle.btnAria', { name: puzzleName(cur, t) })); pb.title = t('puzzle.aria');
    $('puzzleMenu').innerHTML = puzzleItems(lang, cur, t, R); $('puzzleMenu').setAttribute('aria-label', t('puzzle.label'));
    lb.innerHTML = langBtnInner(lang); lb.dataset.lang = lang;
    lb.setAttribute('aria-label', t('lang.btnAria', { name: L.name })); lb.title = t('lang.label');
    $('langMenu').innerHTML = langItems(lang, pagePuzzle(), I.LANGS, R); $('langMenu').setAttribute('aria-label', t('lang.label'));
    ['shareBtn', 'ghLink'].forEach(function (id) { var k = id === 'ghLink' ? 'github.label' : 'share.button'; $(id).setAttribute('aria-label', t(k)); $(id).title = t(k); });
    $('sharePanel').setAttribute('aria-label', t('share.title'));
    if (openEl && openEl.id === 'sharePanel') fillShare();
  }

  function open(btn, menu, focus) {
    if (openEl && openEl !== menu) close(false);
    if (menu.id === 'langMenu') $('langMenu').innerHTML = langItems(I.lang(), pagePuzzle(), I.LANGS, R);   // hrefs follow the address
    if (menu.id === 'sharePanel') fillShare();
    menu.hidden = false; btn.setAttribute('aria-expanded', 'true'); openEl = menu;
    place(btn, menu);
    if (menu.id === 'sharePanel') { var f = menu.querySelector('button, a, input'); if (f) f.focus(); return; }
    var it = items(menu), k = focus === 'last' ? it.length - 1 : Math.max(0, it.findIndex(function (a) { return a.getAttribute('aria-current') === 'true'; }));
    if (focus === 'first') k = 0;
    if (it[k]) it[k].focus();
  }
  function close(refocus) {
    if (!openEl) return;
    var m = openEl, btn = doc.querySelector('[aria-controls="' + m.id + '"]');
    m.hidden = true; openEl = null; if (btn) { btn.setAttribute('aria-expanded', 'false'); if (refocus) btn.focus(); }
  }
  /** keep a popover inside the viewport (it is anchored to the button's inline-end edge by CSS) */
  function place(btn, menu) {
    menu.style.insetInlineEnd = ''; menu.style.insetInlineStart = ''; menu.style.maxWidth = '';
    var r = menu.getBoundingClientRect(), vw = doc.documentElement.clientWidth;
    if (r.left < 8 || r.right > vw - 8) {
      var b = btn.getBoundingClientRect(), rtl = getComputedStyle(menu).direction === 'rtl';
      menu.style.maxWidth = (vw - 16) + 'px';
      var w = Math.min(r.width, vw - 16), left = Math.min(Math.max(8, b.right - w), vw - 8 - w), off = left - b.left;
      if (rtl) { menu.style.insetInlineStart = (b.right - (left + w)) + 'px'; menu.style.insetInlineEnd = 'auto'; }
      else { menu.style.insetInlineStart = off + 'px'; menu.style.insetInlineEnd = 'auto'; }
    }
  }
  function cols(it) { if (it.length < 2) return 1; var y = it[0].offsetTop, c = 0; while (c < it.length && it[c].offsetTop === y) c++; return c || 1; }
  function menuKey(e, menu) {
    var it = items(menu), k = it.indexOf(doc.activeElement), c = cols(it), rtl = getComputedStyle(menu).direction === 'rtl', n = it.length, to = null;
    switch (e.key) {
      case 'ArrowDown': to = k < 0 ? 0 : c > 1 ? (k + c < n ? k + c : k % c) : (k + 1) % n; break;
      case 'ArrowUp': to = k < 0 ? n - 1 : c > 1 ? (k - c >= 0 ? k - c : Math.min(n - 1, k + c * Math.floor((n - 1 - k) / c))) : (k - 1 + n) % n; break;
      case 'ArrowRight': to = (k + (rtl ? -1 : 1) + n) % n; break;
      case 'ArrowLeft': to = (k + (rtl ? 1 : -1) + n) % n; break;
      case 'Home': to = 0; break;
      case 'End': to = n - 1; break;
      case 'Escape': e.preventDefault(); close(true); return;
      case 'Tab': close(false); return;
      case ' ': if (k >= 0) { e.preventDefault(); it[k].click(); } return;
      default:
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {   // type-ahead on the visible text
          var ch = e.key.toLowerCase();
          for (var j = 1; j <= n; j++) { var a = it[(k + j) % n]; if (a.textContent.trim().toLowerCase().indexOf(ch) === 0 || (a.dataset.lang || '').toLowerCase().indexOf(ch) === 0) { to = (k + j) % n; break; } }
        }
    }
    if (to != null) { e.preventDefault(); it[to].focus(); }
  }
  function wireMenu(btnId, menuId) {
    var btn = $(btnId), menu = $(menuId);
    btn.addEventListener('click', function () { if (openEl === menu) close(false); else open(btn, menu); });
    btn.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); open(btn, menu, e.key === 'ArrowUp' ? 'last' : null); }
    });
    menu.addEventListener('keydown', function (e) { if (menuId === 'sharePanel') { if (e.key === 'Escape') { e.preventDefault(); close(true); } } else menuKey(e, menu); });
  }
  function plainClick(e) { return !(e.button || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey); }

  // ---------------------------------------------------------------- share
  function toast(msg) {
    var el = $('toast');
    if (!el) { el = doc.createElement('div'); el.id = 'toast'; el.className = 'toast'; el.setAttribute('role', 'status'); el.setAttribute('aria-live', 'polite'); doc.body.appendChild(el); }
    el.textContent = msg; el.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { el.classList.remove('show'); }, 3200);
  }
  var withState = true;
  function shareData() {
    var s = opts.shareState ? opts.shareState() : null, lang = I.lang(), pz = (s && s.p) || curPz || 'cube3';
    var url = location.origin + R.path(lang, pz), name = puzzleName(pz, t), text;
    if (withState && s && s.s) {
      url += CL.shareCode.makeHash(s);
      text = s.m === 'play' ? (s.t != null ? t('share.textPlay', { puzzle: name, t: s.tText }) : t('share.textChallenge', { puzzle: name })) : t('share.textSolve', { puzzle: name });
    } else text = t('share.textPage', { puzzle: name });
    return { url: url, text: text, title: t('app.name') + ' · ' + name, hasState: !!(s && s.s) };
  }
  function networks(lang) {
    var L = ['x', 'facebook', 'reddit', 'whatsapp', 'telegram'];
    if (lang === 'zh-Hans') L.unshift('weibo');
    if (lang === 'ja' || lang === 'zh-Hant') L.unshift('line');
    if (lang === 'ru') L.push('vk');
    L.push('email');
    return L;
  }
  var NET = {
    x: ['X', function (d) { return 'https://x.com/intent/post?text=' + E(d.text) + '&url=' + E(d.url); }],
    facebook: ['Facebook', function (d) { return 'https://www.facebook.com/sharer/sharer.php?u=' + E(d.url); }],
    reddit: ['Reddit', function (d) { return 'https://www.reddit.com/submit?url=' + E(d.url) + '&title=' + E(d.text); }],
    whatsapp: ['WhatsApp', function (d) { return 'https://wa.me/?text=' + E(d.text + ' ' + d.url); }],
    telegram: ['Telegram', function (d) { return 'https://t.me/share/url?url=' + E(d.url) + '&text=' + E(d.text); }],
    weibo: ['微博', function (d) { return 'https://service.weibo.com/share/share.php?url=' + E(d.url) + '&title=' + E(d.text); }],
    line: ['LINE', function (d) { return 'https://social-plugins.line.me/lineit/share?url=' + E(d.url) + '&text=' + E(d.text); }],
    vk: ['VK', function (d) { return 'https://vk.com/share.php?url=' + E(d.url) + '&title=' + E(d.text); }],
    email: [null, function (d) { return 'mailto:?subject=' + E(d.title) + '&body=' + E(d.text + '\n' + d.url); }]
  };
  function E(s) { return encodeURIComponent(s); }
  function fillShare() {
    var p = $('sharePanel'), d = shareData(), lang = I.lang();
    var h = '<p class="share-h">' + esc(t('share.title')) + '</p>';
    if (d.hasState) h += '<label class="toggle share-state"><input type="checkbox" id="shareWithState"' + (withState ? ' checked' : '') + '><span aria-hidden="true"></span><b>' + esc(t('share.withState')) + '</b></label>';
    h += '<div class="share-actions">';
    if (navigator.share) h += '<button type="button" class="share-item" id="shareNative">' + oct('device') + '<span>' + esc(t('share.native')) + '</span></button>';
    h += '<button type="button" class="share-item" id="shareCopy">' + oct('link') + '<span>' + esc(t('share.copy')) + '</span></button>';
    if (opts.snapshot) h += '<button type="button" class="share-item" id="shareImage">' + oct('download') + '<span>' + esc(t('share.image')) + '</span></button>';
    h += '</div><div class="share-nets">' + networks(lang).map(function (k) {
      return '<a class="share-net" data-net="' + k + '" href="' + esc(NET[k][1](d)) + '"' + (k === 'email' ? '' : ' target="_blank" rel="noopener noreferrer"') + '>' + esc(NET[k][0] || t('share.email')) + '</a>';
    }).join('') + '</div>';
    h += '<input class="share-url" id="shareUrl" type="url" readonly dir="ltr" aria-label="' + esc(t('share.urlAria')) + '" value="' + esc(d.url) + '">';
    var focusId = doc.activeElement && p.contains(doc.activeElement) ? doc.activeElement.id : null;
    p.innerHTML = h;
    if (focusId && $(focusId)) $(focusId).focus();
  }
  function copyText(s) {
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(s);
    return new Promise(function (res, rej) { var u = $('shareUrl'); if (!u) return rej(); u.select(); try { doc.execCommand('copy') ? res() : rej(); } catch (e) { rej(e); } });
  }
  function onShareClick(e) {
    var tg = e.target.closest ? e.target.closest('button, a, input') : null; if (!tg) return;
    if (tg.id === 'shareWithState') { withState = tg.checked; fillShare(); return; }
    var d = shareData();
    if (tg.id === 'shareNative') {
      navigator.share({ title: d.title, text: d.text, url: d.url }).then(function () { close(false); }, function () {});
    } else if (tg.id === 'shareCopy') {
      copyText(d.url).then(function () { toast(t('share.copied')); close(true); }, function () { toast(t('share.copyFail')); var u = $('shareUrl'); if (u) { u.focus(); u.select(); } });
    } else if (tg.id === 'shareImage') {
      opts.snapshot().then(function (blob) {
        var a = doc.createElement('a'), u = URL.createObjectURL(blob);
        a.href = u; a.download = 'cube-solver-' + (curPz || 'cube3') + '.png'; doc.body.appendChild(a); a.click(); a.remove();
        setTimeout(function () { URL.revokeObjectURL(u); }, 4000); toast(t('share.imageSaved'));
      }, function () { toast(t('share.imageFail')); });
    } else if (tg.classList.contains('share-net')) {
      tg.href = NET[tg.dataset.net][1](d);       // latest state at click time
      setTimeout(function () { close(false); }, 0);
    } else if (tg.id === 'shareUrl') tg.select();
  }

  /** opts: { onPuzzle(id), onLang(code), shareState() → {p,s,m,t,tText}|null, snapshot() → Promise<Blob> } */
  TB.init = function (o) {
    opts = o || {}; I = CL.i18n; R = CL.seoRoutes;
    if (!$('topPicks')) return;
    curPz = $('puzzleBtn').dataset.pid || 'cube3';
    wireMenu('puzzleBtn', 'puzzleMenu'); wireMenu('langBtn', 'langMenu'); wireMenu('shareBtn', 'sharePanel');
    $('puzzleMenu').addEventListener('click', function (e) {
      var a = e.target.closest('a[data-pid]'); if (!a || !plainClick(e)) return;
      e.preventDefault(); close(true);
      if (a.dataset.pid !== curPz && opts.onPuzzle) opts.onPuzzle(a.dataset.pid);
    });
    $('langMenu').addEventListener('click', function (e) {
      var a = e.target.closest('a[data-lang]'); if (!a || !plainClick(e)) return;
      e.preventDefault(); close(true);
      if (a.dataset.lang !== I.lang() && opts.onLang) opts.onLang(a.dataset.lang);
    });
    $('sharePanel').addEventListener('click', onShareClick);
    $('sharePanel').addEventListener('change', function (e) { if (e.target.id === 'shareWithState') { withState = e.target.checked; fillShare(); } });
    doc.addEventListener('pointerdown', function (e) { if (openEl && !e.target.closest('.mb')) close(false); }, true);
    doc.addEventListener('focusin', function (e) { if (openEl && !openEl.parentNode.contains(e.target)) close(false); });
    root.addEventListener('resize', function () { if (openEl) close(false); });
    I.onChange(render);
    render();
  };
  TB.setPuzzle = function (id) { curPz = id; render(); };
  TB.toast = toast;
  TB.close = function () { close(false); };
})(typeof self !== 'undefined' ? self : globalThis);
