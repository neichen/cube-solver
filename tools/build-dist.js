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
  if (out !== src) {
    fs.writeFileSync(f, out);
    const v = require('crypto').createHash('sha1').update(out).digest('hex').slice(0, 8);   // new cache-busting version
    (function walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p); else if (e.name.endsWith('.html')) fs.writeFileSync(p, fs.readFileSync(p, 'utf8').replace(/js\/analytics\.js\?v=[0-9a-f]+/g, 'js/analytics.js?v=' + v)); } })(DIST);
  }
  console.log(`build-dist: analytics ${CF ? 'Cloudflare Web Analytics on' : 'Cloudflare off'}, ${GA ? 'GA4 on (after consent)' : 'GA4 off'}` + (CF || GA ? '' : ' (set CF_BEACON_TOKEN / GA_MEASUREMENT_ID to enable)'));
}
let n = 0, bytes = 0, big = 0;
(function walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else { const s = fs.statSync(p).size; n++; bytes += s; big = Math.max(big, s); } } })(DIST);
if (big > 25 * 1024 * 1024) throw new Error('a file in dist/ exceeds the 25 MiB Workers asset limit');
console.log(`build-dist: ${n} files, ${(bytes / 1048576).toFixed(1)} MB in dist/ (largest ${(big / 1048576).toFixed(1)} MB)`);
