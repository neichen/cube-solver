#!/usr/bin/env node
/* Assemble the deployable site in dist/ (what Cloudflare serves as static assets):
   prerender the SEO pages, then copy the app, the generated pages and deploy/_headers.
   Run: npm run build   (deploy with: npm run deploy) */
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const ROOT = path.join(__dirname, '..'), DIST = path.join(ROOT, 'dist');
execFileSync(process.execPath, [path.join(__dirname, 'build-seo.js')], { stdio: 'inherit' });
fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(DIST, { recursive: true });
const skip = f => f.endsWith('.patch');
for (const item of ['index.html', 'favicon.ico', 'img', 'css', 'js', 'puzzles', 'vendor'])
  fs.cpSync(path.join(ROOT, item), path.join(DIST, item), { recursive: true, filter: src => !skip(src) });
fs.cpSync(path.join(ROOT, 'seo', 'out'), DIST, { recursive: true, filter: src => path.basename(src) !== 'pages.json' });
fs.copyFileSync(path.join(ROOT, 'deploy', '_headers'), path.join(DIST, '_headers'));

// Analytics IDs are injected only into dist/ (never committed): env vars CF_BEACON_TOKEN and GA_MEASUREMENT_ID, or the
// gitignored .env file in the repository root (KEY=value lines). Unset → js/analytics.js keeps its placeholders → no analytics.
const env = {};
try { for (const l of fs.readFileSync(path.join(ROOT, '.env'), 'utf8').split(/\r?\n/)) { const m = l.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*["']?([^"'#\s]*)["']?/); if (m) env[m[1]] = m[2]; } } catch (e) { /* no .env */ }
const cfg = k => (process.env[k] !== undefined ? process.env[k] : env[k] || '').trim();
const CF = cfg('CF_BEACON_TOKEN'), GA = cfg('GA_MEASUREMENT_ID');
if (CF && !/^[0-9a-f]{32}$/i.test(CF)) throw new Error('CF_BEACON_TOKEN must be the 32-hex-digit Cloudflare Web Analytics token');
if (GA && !/^G-[A-Z0-9]{4,}$/.test(GA)) throw new Error('GA_MEASUREMENT_ID must look like G-XXXXXXXXXX');
{
  const f = path.join(DIST, 'js', 'analytics.js');
  const src = fs.readFileSync(f, 'utf8'), out = src.replace(/__CF_BEACON_TOKEN__/g, CF || '__CF_BEACON_TOKEN__').replace(/__GA_MEASUREMENT_ID__/g, GA || '__GA_MEASUREMENT_ID__');
  if (out !== src) fs.writeFileSync(f, out);
  console.log(`build-dist: analytics ${CF ? 'Cloudflare Web Analytics on' : 'Cloudflare off'}, ${GA ? 'GA4 on (after consent)' : 'GA4 off'}` + (CF || GA ? '' : ' (set CF_BEACON_TOKEN / GA_MEASUREMENT_ID to enable)'));
}

// ---------------------------------------------------------------- content-hash versioning (item 4)
// Every reference to a file under js/ css/ puzzles/ vendor/ – <script src>/<link href> in the pages, Worker URLs,
// importScripts(), fetch() of tables, the WASM binary – gets ?v=<sha1-8 of the referenced file's final content>,
// computed bottom-up, so a change anywhere changes the URL of every file that (transitively) loads it.
// Those paths are then served with Cache-Control: immutable (deploy/_headers); the pages themselves revalidate.
const crypto = require('crypto');
const H8 = b => crypto.createHash('sha1').update(b).digest('hex').slice(0, 8);
const VDIR = /^(js|css|puzzles|vendor)\//;
const P = path.posix, rd = r => path.join(DIST, ...r.split('/'));
const isText = r => /\.(js|css)$/.test(r) && !/^vendor\/three/.test(r);
const dirRelative = r => /\.worker\.js$/.test(r) || /^vendor\/gullicube\//.test(r);   // workers resolve against their own URL
const REF = /(require\(\s*)?(['"])((?:\.\.?\/)*[\w-][\w.-]*(?:\/[\w.-]+)*\.(?:js|json|gz|wasm|cls|css))(\?[^'"]*)?\2/g;
const memo = new Map(), busy = new Set();
function resolveRef(from, ref) {
  const r = P.normalize(dirRelative(from) ? P.join(P.dirname(from), ref) : ref.replace(/^\.\//, ''));
  return VDIR.test(r) && fs.existsSync(rd(r)) && fs.statSync(rd(r)).isFile() ? r : null;
}
function version(r) { return H8(finalContent(r)); }
function finalContent(r) {
  if (memo.has(r)) return memo.get(r);
  if (busy.has(r)) throw new Error('build-dist: circular asset reference at ' + r);
  busy.add(r);
  let out = fs.readFileSync(rd(r));
  if (isText(r)) {
    let txt = out.toString('utf8');
    txt = txt.replace(REF, (m, req, q, ref, qs) => {
      if (req) return m;                                   // Node require() – leave alone
      const t = resolveRef(r, ref);
      if (!t) return m;
      const extra = qs ? qs.replace(/^\?v=[0-9a-f]+&?/, '').replace(/^\?/, '') : '';
      return q + ref + '?v=' + version(t) + (extra ? '&' + extra : '') + q;
    });
    if (r === 'puzzles/nxn/gullicube.worker.js') {        // BASE + 'name' references: explicit map
      const G = 'vendor/gullicube/', data = fs.readdirSync(rd(G + 'data')), V = {};
      data.forEach(f => { V[f] = version(G + 'data/' + f); });
      txt = txt.replace("importScripts(BASE + 'gullicube.js')", "importScripts(BASE + 'gullicube.js?v=" + version(G + 'gullicube.js') + "')")
        .replace("fetch(BASE + 'data/' + f)", "fetch(BASE + 'data/' + f + '?v=' + (" + JSON.stringify(V) + ")[f])");
      if (!/gullicube\.js\?v=/.test(txt) || !/'\?v=' \+ \(/.test(txt)) throw new Error('build-dist: gullicube.worker.js patterns changed');
    }
    out = Buffer.from(txt, 'utf8');
    fs.writeFileSync(rd(r), out);
  }
  busy.delete(r); memo.set(r, out);
  return out;
}
const htmlFiles = [];
(function walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name);
  if (e.isDirectory()) walk(p); else if (e.name.endsWith('.html')) htmlFiles.push(p); } })(DIST);
const inlineHashes = new Set();
for (const f of htmlFiles) {
  let h = fs.readFileSync(f, 'utf8');
  h = h.replace(/(\s(?:src|href)=")((?:js|css|puzzles|vendor)\/[^"?#]+)(?:\?v=[0-9a-f]+)?"/g, (m, a, r) => fs.existsSync(rd(r)) ? a + r + '?v=' + version(r) + '"' : m);
  if (GA) h = h.replace('data-ga=""', 'data-ga="1"');   // the consent banner may appear only when GA4 is actually configured
  h = h.replace(/<html\b/, '<html data-sw=""');
  for (const m of h.matchAll(/<script(?![^>]*\bsrc=)(?![^>]*application\/ld\+json)[^>]*>([\s\S]*?)<\/script>/g))
    if (m[1].trim()) inlineHashes.add("'sha256-" + crypto.createHash('sha256').update(m[1], 'utf8').digest('base64') + "'");
  fs.writeFileSync(f, h);
}
// make sure every remaining versionable text file is processed (lazy-loaded files not reachable from the pages)
(function walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name);
  if (e.isDirectory()) walk(p); else { const r = path.relative(DIST, p).split(path.sep).join('/'); if (VDIR.test(r) && isText(r)) finalContent(r); } } })(DIST);
const BUILD = H8(Buffer.concat(htmlFiles.map(f => fs.readFileSync(f))).toString('binary') + [...memo.keys()].sort().map(k => k + version(k)).join());
console.log(`build-dist: versioned ${memo.size} assets, ${htmlFiles.length} pages, ${inlineHashes.size} inline script hash(es), build ${BUILD}`);

// ---------------------------------------------------------------- security headers (item 6): CSP with the inline-script hashes
{
  const CSP = ["default-src 'self'",
    "script-src 'self' " + [...inlineHashes].join(' ') + " 'wasm-unsafe-eval' https://www.googletagmanager.com https://static.cloudflareinsights.com",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://*.google-analytics.com https://*.googletagmanager.com",
    "connect-src 'self' https://*.google-analytics.com https://*.analytics.google.com https://*.googletagmanager.com https://cloudflareinsights.com https://static.cloudflareinsights.com",
    "worker-src 'self' blob:", "font-src 'self'", "object-src 'none'", "base-uri 'self'", "form-action 'self'",
    "frame-ancestors 'none'", "manifest-src 'self'", "media-src 'self' blob:", 'upgrade-insecure-requests'].join('; ');
  const hf = path.join(DIST, '_headers'), src = fs.readFileSync(hf, 'utf8');
  if (!src.includes('__CSP__')) throw new Error('deploy/_headers: missing __CSP__ placeholder');
  fs.writeFileSync(hf, src.replace('__CSP__', CSP));
}

// ---------------------------------------------------------------- service worker (item 15)
{
  const shell = [];
  for (const r of memo.keys()) if (/\.(js|css)$/.test(r) && !/^vendor\/gullicube\//.test(r) && !/\.worker\.js$/.test(r) || /^puzzles\/.*\.worker\.js$/.test(r)) shell.push('/' + r + '?v=' + version(r));
  shell.push('/vendor/three.min.js?v=' + version('vendor/three.min.js'));
  const pre = ['/'].concat([...new Set(shell)].sort());
  const sw = fs.readFileSync(path.join(ROOT, 'tools', 'sw.template.js'), 'utf8')
    .replace('__BUILD__', BUILD).replace('__PRECACHE__', JSON.stringify(pre));
  fs.writeFileSync(path.join(DIST, 'sw.js'), sw);
  console.log(`build-dist: sw.js (cache cs-${BUILD}, ${pre.length} precached URLs)`);
}

let n = 0, bytes = 0, big = 0;
(function walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else { const s = fs.statSync(p).size; n++; bytes += s; big = Math.max(big, s); } } })(DIST);
if (big > 25 * 1024 * 1024) throw new Error('a file in dist/ exceeds the 25 MiB Workers asset limit');
console.log(`build-dist: ${n} files, ${(bytes / 1048576).toFixed(1)} MB in dist/ (largest ${(big / 1048576).toFixed(1)} MB)`);
