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
let n = 0, bytes = 0, big = 0;
(function walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else { const s = fs.statSync(p).size; n++; bytes += s; big = Math.max(big, s); } } })(DIST);
if (big > 25 * 1024 * 1024) throw new Error('a file in dist/ exceeds the 25 MiB Workers asset limit');
console.log(`build-dist: ${n} files, ${(bytes / 1048576).toFixed(1)} MB in dist/ (largest ${(big / 1048576).toFixed(1)} MB)`);
