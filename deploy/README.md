# Deploy (Cloudflare Workers static assets)

```bash
export CLOUDFLARE_ACCOUNT_ID=<account id>      # not stored in the repository
export CLOUDFLARE_API_TOKEN=<api token>        # or: npx wrangler login
npm run deploy                                 # = npm run build (→ dist/) + wrangler deploy -c deploy/wrangler.toml
```

* `npm run build` (`tools/build-dist.js`) prerenders the SEO pages and assembles `dist/`: `index.html`, `favicon.ico`, `img/`, `css/`, `js/`, `puzzles/`, `vendor/` (without `*.patch`), the generated pages from `seo/out/` (without `pages.json`) and `_headers`.
* `vendor/gullicube/` (gullicube.js / .wasm / data/*.cls, about 30 MB) must be included; every file is ≤ 25 MiB (the largest, diag_x10.cls, is about 19 MB).
* `_headers` sets COOP / COEP / CORP so the page is cross-origin isolated (multithreaded WebAssembly needs SharedArrayBuffer). The page loads no third-party resources, so `require-corp` does not break anything.
* Domains: `cube-solver.org` (main) and `www.cube-solver.org` are Worker custom domains (`routes` in `wrangler.toml`). `worker.js` sends `www` and `*.workers.dev` to `https://cube-solver.org` with a 301 (same path and query) and maps old `/?puzzle=…`, `/?n=…`, `/?lang=…` links in the same hop.
* Worker requests: `run_worker_first` excludes `/js`, `/css`, `/img`, `/puzzles`, `/vendor`, `favicon.ico`, `sitemap.xml`, `robots.txt` and `manifest.webmanifest`. These are served directly. A page view is one Worker request; switching puzzle or language inside the app fetches the other page's HTML (one more); each redirect is one.
