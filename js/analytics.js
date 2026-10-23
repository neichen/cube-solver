/* Analytics, privacy first (see README "Privacy"):
   - Cloudflare Web Analytics: cookieless, no personal data, loaded for every visitor on the production host.
   - Google Analytics 4: gtag.js is NOT loaded until the visitor presses "Accept" in the consent banner. The choice is kept in
     localStorage ("cubelab.consent" = "granted" | "denied") and can be changed from the footer link. Consent Mode v2 defaults
     are all "denied"; Accept grants analytics_storage only (ads storage / user data / personalization stay denied, Google
     signals and ad personalization are off). After a later "Decline" GA is disabled for the page and its cookies are removed.
   - In-app route changes (js/seo-nav.js moves the address with history.replaceState) are counted by both tools themselves:
     the Cloudflare beacon with spa:true, GA4 through its default enhanced measurement "page changes based on browser history
     events" (so no manual page_view here, which would count every route twice). GA4 does not log or store IP addresses.
   - Camera images and puzzle states are never sent anywhere; only page views are counted.
   Both third-party scripts send "Cross-Origin-Resource-Policy: cross-origin" + CORS headers, so they load under our
   COEP require-corp and the page stays crossOriginIsolated (needed for the multithreaded WASM solver).
   Analytics runs only on https://cube-solver.org, so local development and tests never send data. */
(function () {
  var CL = window.CubeLab = window.CubeLab || {};
  // The IDs are not in the repository: tools/build-dist.js fills them into dist/ from the env vars CF_BEACON_TOKEN and
  // GA_MEASUREMENT_ID (or a gitignored .env). Left as placeholders (clean clone, local dev, tests) → no analytics, no banner.
  var CF_TOKEN = '__CF_BEACON_TOKEN__', GA_ID = '__GA_MEASUREMENT_ID__';
  var HOST = 'cube-solver.org', KEY = 'cubelab.consent', unset = function (v) { return !v || /^__.*__$/.test(v); };
  if (unset(CF_TOKEN)) CF_TOKEN = '';
  if (unset(GA_ID)) GA_ID = '';
  var enabled = location.hostname === HOST && location.protocol === 'https:' && !!(CF_TOKEN || GA_ID);
  var I = CL.i18n, banner = null, gaLoaded = false;

  function getChoice() { try { var v = localStorage.getItem(KEY); return v === 'granted' || v === 'denied' ? v : null; } catch (e) { return null; } }
  function setChoice(v) { try { localStorage.setItem(KEY, v); } catch (e) { /* private mode: choice lasts for this page only */ } }

  function addScript(src, attrs) {
    var s = document.createElement('script'); s.src = src; s.async = true; s.crossOrigin = 'anonymous';
    for (var k in attrs) s.setAttribute(k, attrs[k]);
    document.head.appendChild(s); return s;
  }

  function loadCloudflare() {
    if (!CF_TOKEN) return;
    // spa:true → the beacon also counts in-app route changes (history / Navigation API)
    addScript('https://static.cloudflareinsights.com/beacon.min.js', { defer: '', 'data-cf-beacon': JSON.stringify({ token: CF_TOKEN, spa: true }) });
  }

  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }

  function loadGA() {
    if (!GA_ID) return;
    window['ga-disable-' + GA_ID] = false;
    if (gaLoaded) { gtag('consent', 'update', { analytics_storage: 'granted' }); return; }
    gaLoaded = true;
    window.gtag = gtag;
    gtag('consent', 'default', { ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied', analytics_storage: 'denied' });
    gtag('consent', 'update', { analytics_storage: 'granted' });
    gtag('set', 'ads_data_redaction', true);
    gtag('js', new Date());
    gtag('config', GA_ID, { allow_google_signals: false, allow_ad_personalization_signals: false });
    addScript('https://www.googletagmanager.com/gtag/js?id=' + GA_ID, {});
  }

  function stopGA() {
    window['ga-disable-' + GA_ID] = true;
    // remove GA cookies (_ga, _ga_<id>) on this host and the parent domain
    document.cookie.split(';').forEach(function (c) {
      var n = c.split('=')[0].trim();
      if (/^_ga(_|$)/.test(n)) ['', '; domain=' + location.hostname, '; domain=.' + location.hostname].forEach(function (d) {
        document.cookie = n + '=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/' + d;
      });
    });
  }

  function text(el, key) { el.setAttribute('data-i18n', key); el.textContent = I ? I.t(key) : key; }

  function hideBanner() { if (banner) { banner.hidden = true; document.body.classList.remove('has-consent'); } }
  function showBanner() {
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'consentBanner'; banner.className = 'consent'; banner.setAttribute('role', 'region');
      banner.setAttribute('data-i18n-aria', 'consent.title'); banner.setAttribute('aria-label', I ? I.t('consent.title') : 'Analytics');
      var p = document.createElement('p'); text(p, 'consent.text');
      var row = document.createElement('div'); row.className = 'consent-btns';
      var no = document.createElement('button'); no.type = 'button'; no.id = 'consentDecline'; text(no, 'consent.decline');
      var yes = document.createElement('button'); yes.type = 'button'; yes.id = 'consentAccept'; yes.className = 'primary'; text(yes, 'consent.accept');
      no.addEventListener('click', function () { choose('denied'); });
      yes.addEventListener('click', function () { choose('granted'); });
      row.appendChild(no); row.appendChild(yes); banner.appendChild(p); banner.appendChild(row);
      document.body.appendChild(banner);
    }
    banner.hidden = false; document.body.classList.add('has-consent');
  }

  function choose(v) {
    setChoice(v); hideBanner();
    if (v === 'granted') loadGA(); else stopGA();
  }

  CL.analytics = { enabled: enabled, choice: getChoice, choose: choose, showBanner: showBanner };

  if (!enabled) return;
  loadCloudflare();
  if (!GA_ID) return;                       // consent banner and footer link only exist when GA is configured
  var wrap = document.getElementById('consentLinkWrap'), link = document.getElementById('consentSettings');
  if (wrap && link) { wrap.hidden = false; link.addEventListener('click', function () { showBanner(); }); }
  var c = getChoice();
  if (c === 'granted') loadGA(); else { window['ga-disable-' + GA_ID] = true; if (!c) showBanner(); }
})();
