// 本地静态服务器，带与线上一致的跨源隔离响应头（gullicube 多线程 WASM 需要）：node tests/serve.js [port]
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..'), PORT = +process.argv[2] || 8765;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.wasm': 'application/wasm', '.png': 'image/png', '.json': 'application/json', '.cls': 'application/octet-stream', '.md': 'text/plain; charset=utf-8', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json' };
http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html';
  const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  // generated SEO pages / robots / sitemap live in seo/out (deployed next to index.html)
  const g = path.join(ROOT, 'seo', 'out', p);
  fs.readFile(fs.existsSync(f) ? f : g, (err, buf) => {
    if (err) {
      if (!path.extname(p) && fs.existsSync(path.join(ROOT, 'seo', 'out', p, 'index.html'))) { res.writeHead(307, { Location: p + '/' }); return res.end(); }
      res.writeHead(404); return res.end('not found');
    }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(fs.existsSync(f) ? f : g)] || 'application/octet-stream', 'Cross-Origin-Opener-Policy': 'same-origin', 'Cross-Origin-Embedder-Policy': 'require-corp', 'Cross-Origin-Resource-Policy': 'same-origin', 'Cache-Control': 'no-cache' });
    res.end(buf);
  });
}).listen(PORT, () => console.log('serving ' + ROOT + ' on http://localhost:' + PORT));
