#!/usr/bin/env node
/* Icons + Open Graph images (1200×630, one per puzzle page) rendered with Playwright from the real app.
   Needs the local server (node tests/serve.js 8765). Run: node tools/build-seo-images.js [http://localhost:8765]
   Writes img/favicon.svg, img/icon-*.png, img/apple-touch-icon.png, favicon.ico, img/og/<slug>.png */
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const R = require('../js/seo-routes.js');
const ROOT = path.join(__dirname, '..'), IMG = path.join(ROOT, 'img'), B = process.argv[2] || 'http://localhost:8765';
const EN = JSON.parse(fs.readFileSync(path.join(ROOT, 'seo/lang/en.json'), 'utf8'));
fs.mkdirSync(path.join(IMG, 'og'), { recursive: true });

// 3×3 logo: same colors as the header logo
const C = ['#ffd500', '#009b48', '#b71234', '#0046ad', '#f5f5f5', '#ff5800', '#b71234', '#ffd500', '#009b48'];
const logo = (pad) => {
  const s = 32, inner = s - 2 * pad, g = inner / 3, r = g * 0.22;
  let o = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${s} ${s}"><rect x="${pad}" y="${pad}" width="${inner}" height="${inner}" rx="${inner * 0.2}" fill="#111"/>`;
  C.forEach((c, i) => { const x = pad + (i % 3) * g + g * 0.12, y = pad + Math.floor(i / 3) * g + g * 0.12; o += `<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${(g * 0.76).toFixed(2)}" height="${(g * 0.76).toFixed(2)}" rx="${r.toFixed(2)}" fill="${c}"/>`; });
  return o + '</svg>';
};
fs.writeFileSync(path.join(IMG, 'favicon.svg'), logo(2));

function ico(png32) {   // single-image ICO wrapping a PNG (supported by all current browsers)
  const h = Buffer.alloc(22); h.writeUInt16LE(0, 0); h.writeUInt16LE(1, 2); h.writeUInt16LE(1, 4);
  h[6] = 32; h[7] = 32; h[8] = 0; h[9] = 0; h.writeUInt16LE(1, 10); h.writeUInt16LE(32, 12); h.writeUInt32LE(png32.length, 14); h.writeUInt32LE(22, 18);
  return Buffer.concat([h, png32]);
}

(async () => {
  const b = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
  const p = await b.newPage();
  for (const [name, size, pad, bg] of [['icon-192.png', 192, 2, null], ['icon-512.png', 512, 2, null], ['icon-maskable-512.png', 512, 7, '#FBF9F5'], ['apple-touch-icon.png', 180, 4, '#FBF9F5'], ['_32.png', 32, 1, null]]) {
    await p.setViewportSize({ width: size, height: size });
    await p.setContent(`<html><body style="margin:0;background:${bg || 'transparent'}">${logo(pad).replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`);
    const buf = await p.screenshot({ omitBackground: !bg, clip: { x: 0, y: 0, width: size, height: size } });
    if (name === '_32.png') fs.writeFileSync(path.join(ROOT, 'favicon.ico'), ico(buf)); else fs.writeFileSync(path.join(IMG, name), buf);
  }
  // app screenshots of the stage (3D + permutation graph) for every puzzle
  const app = await b.newPage({ viewport: { width: 1360, height: 900 }, deviceScaleFactor: 1 });
  const shots = {};
  for (const pz of [null].concat(R.PUZZLES)) {
    await app.goto(B + R.path('en', pz) + '?start=scrambled');
    await app.waitForFunction(() => window.app && document.querySelector('#graph svg'), null, { timeout: 30000 });
    await app.waitForTimeout(pz && /cube1[0-5]/.test(pz) ? 2500 : 1500);
    shots[pz || 'root'] = { v: (await (await app.$('#view3d')).screenshot()).toString('base64'), g: (await (await app.$('#graph')).screenshot()).toString('base64') };
  }
  const og = await b.newPage({ viewport: { width: 1200, height: 630 } });
  for (const pz of [null].concat(R.PUZZLES)) {
    const n = pz && pz.startsWith('cube') ? +pz.slice(4) : 0;
    const big = !pz ? 'Rubik’s Cube Solver' : n ? `${n}×${n} Cube Solver` : pz === 'pyraminx' ? 'Pyraminx Solver' : 'Skewb Solver';
    const sub = !pz ? '2×2 – 15×15 · Pyraminx · Skewb' : n === 2 || !n ? 'Proven optimal solutions' : n === 3 ? 'Near-optimal, ~20 moves' : 'Step-by-step solution';
    await og.setContent(`<html><body style="margin:0;width:1200px;height:630px;background:#FBF9F5;font-family:system-ui,'Segoe UI',Roboto,sans-serif;color:#151515;overflow:hidden;position:relative">
      <div style="position:absolute;left:56px;top:56px;width:500px">
        <div style="display:flex;align-items:center;gap:16px;font-size:26px;font-weight:700">${logo(1).replace('<svg ', '<svg width="56" height="56" ')} Cube Solver Lab</div>
        <div style="margin-top:52px;font-size:${big.length > 16 ? 60 : 68}px;line-height:1.05;font-weight:850;letter-spacing:-1px">${big}</div>
        <div style="margin-top:22px;font-size:30px;color:#ff5800;font-weight:700">${sub}</div>
        <div style="margin-top:26px;font-size:24px;line-height:1.4;color:#45453f">${pz === 'pyraminx' || pz === 'skewb' ? 'Paint or type the scramble' : 'Paint or scan with the camera'} · 3D<br>Permutation graph · Free, in your browser</div>
      </div>
      <div style="position:absolute;right:-30px;top:40px;width:640px;height:550px;border:3px solid #151515;border-radius:22px;box-shadow:8px 8px 0 #151515;overflow:hidden;background:#fffffc">
        <img src="data:image/png;base64,${shots[pz || 'root'].v}" style="position:absolute;left:0;top:30px;width:340px;height:490px;object-fit:contain">
        <img src="data:image/png;base64,${shots[pz || 'root'].g}" style="position:absolute;left:300px;top:30px;width:330px;height:490px;object-fit:contain">
      </div></body></html>`);
    await og.waitForTimeout(100);
    fs.writeFileSync(path.join(IMG, 'og', (pz ? R.slug(pz) : 'root') + '.png'), await og.screenshot({ type: 'png' }));
    process.stdout.write('.');
  }
  await b.close(); console.log('\nimages written');
})().catch(e => { console.error(e); process.exit(1); });
