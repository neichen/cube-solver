# Deploy (Cloudflare Workers static assets)

```bash
export CLOUDFLARE_ACCOUNT_ID=<account id>      # not stored in the repository
export CLOUDFLARE_API_TOKEN=<api token>        # or: npx wrangler login
npm run deploy                                 # = npm run build (→ dist/) + wrangler deploy -c deploy/wrangler.toml
```

* `npm run build` (`tools/build-dist.js`) prerenders the SEO pages and assembles `dist/`: `index.html`, `favicon.ico`, `img/`, `css/`, `js/`, `puzzles/`, `vendor/` (without `*.patch`), the generated pages from `seo/out/` (without `pages.json`) and `_headers`.
* `vendor/gullicube/` (gullicube.js / .wasm / data/*.cls, about 30 MB) must be included; every file is ≤ 25 MiB (the largest, diag_x10.cls, is about 19 MB).
* `_headers` sets COOP / COEP / CORP so the page is cross-origin isolated (multithreaded WebAssembly needs SharedArrayBuffer). The only third-party resources are the analytics scripts (`js/analytics.js`, production host only): Cloudflare Web Analytics (`static.cloudflareinsights.com/beacon.min.js`, cookieless, always on) and, only after the visitor accepts the consent banner, Google Analytics 4 (`www.googletagmanager.com/gtag/js`). Both send `Cross-Origin-Resource-Policy: cross-origin` and CORS headers, so they load under `require-corp` and the page stays `crossOriginIsolated` in Chrome, Firefox and Safari; the collection requests (`cloudflareinsights.com/cdn-cgi/rum`, `*.google-analytics.com/g/collect`) are fire-and-forget and not affected by COEP. There is no CSP; if one is added, allow those hosts in `script-src` / `connect-src`. Check with `npm run test:analytics` (local, collection stubbed) and `npm run test:analytics:live`.
* Analytics IDs are **not committed**. `npm run build` (`tools/build-dist.js`) reads them from the environment or from a gitignored `.env` in the repository root and writes them only into `dist/js/analytics.js` (and bumps its `?v=` in the built pages):

  ```bash
  CF_BEACON_TOKEN=<32-hex-digit Cloudflare Web Analytics token>   # optional
  GA_MEASUREMENT_ID=G-XXXXXXXXXX                                  # optional, GA4 loads only after consent
  ```

  With neither set, the build contains no analytics, no consent banner and no tracking (clean clones, CI and the tests need nothing). With only `CF_BEACON_TOKEN`, there is no GA and no banner. Analytics also runs only on the production host (`HOST` in `js/analytics.js`); change it if you deploy your own copy.
* Domains: `cube-solver.org` (main) and `www.cube-solver.org` are Worker custom domains (`routes` in `wrangler.toml`). `worker.js` sends `www` and `*.workers.dev` to `https://cube-solver.org` with a 301 (same path and query) and maps old `/?puzzle=…`, `/?n=…`, `/?lang=…` links in the same hop.
* Worker requests: `run_worker_first` excludes `/js`, `/css`, `/img`, `/puzzles`, `/vendor`, `favicon.ico`, `sitemap.xml`, `robots.txt` and `manifest.webmanifest`. These are served directly. A page view is one Worker request; switching puzzle or language inside the app fetches the other page's HTML (one more); each redirect is one.
