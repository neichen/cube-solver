// 线上验证：node tests/live-check.js https://cube-solver.org/
const { chromium } = require('playwright');
require('fs').mkdirSync(require('path').join(__dirname, '..', 'screenshots'), { recursive: true });
const URL = process.argv[2];
let fails = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ FAIL: ') + m); if (!c) fails++; };
(async () => {
  const b = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] });
  for (const vp of [{ name: 'desktop', viewport: { width: 1440, height: 1000 } }, { name: 'mobile', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }]) {
    console.log('\n[' + vp.name + ']');
    const ctx = await b.newContext({ locale: 'zh-CN', viewport: vp.viewport, isMobile: vp.isMobile, hasTouch: vp.hasTouch, deviceScaleFactor: vp.deviceScaleFactor || 1, permissions: ['camera'] });
    const p = await ctx.newPage(); const errs = [], bad = [];
    p.on('pageerror', e => errs.push('pageerror: ' + e.message));
    p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
    p.on('response', r => { if (r.status() >= 400) bad.push(r.status() + ' ' + r.url()); });
    p.on('requestfailed', r => bad.push('failed ' + r.url()));
    const t0 = Date.now();
    await p.goto(URL, { waitUntil: 'load' });
    ok(p.url().startsWith('https://'), 'HTTPS: ' + p.url());
    await p.waitForFunction(() => document.body.dataset.solverReady === '1', null, { timeout: 30000 });
    ok(true, `Web Worker 求解器就绪（${Date.now() - t0} ms）：` + await p.textContent('#solverStatus'));
    const env = await p.evaluate(() => ({ three: !!window.THREE && THREE.REVISION, canvas: !!document.querySelector('#view3d canvas'), nodes: document.querySelectorAll('#graph circle.node').length, secure: window.isSecureContext }));
    ok(env.three && env.canvas, 'three.js 加载（r' + env.three + '）并渲染 3D 画布');
    ok(env.nodes === 54, '图视图 54 个节点');
    ok(env.secure, 'isSecureContext = true（摄像头可用前提）');
    for (let k = 0; k < 2; k++) {
      await p.click('#btnScramble');
      await p.click('#btnSolve'); await p.waitForSelector('#solutionBox:not([hidden])', { timeout: 30000 });
      const info = await p.evaluate(() => ({ count: document.getElementById('solCount').textContent, txt: document.getElementById('solText').textContent }));
      await p.evaluate(() => { app.player.speed = 4; app.player.seek(0); app.player.play(); });
      await p.waitForFunction(() => app.player.index === app.player.length() && !app.player.busy, null, { timeout: 90000 });
      const r = await p.evaluate(() => ({ solved: app.P.isSolved(app.player.state()), clusters: app.graph.clusterColors().every(c => new Set(c).size === 1),
        m3d: app.P.faces.every(f => new Set(f.stickers.map(i => app.view.stickerMats[i].color.getHexString())).size === 1), badge: !document.getElementById('solvedBadge').hidden }));
      ok(r.solved && r.clusters && r.m3d && r.badge, `打乱 #${k + 1} → ${info.count}（${info.txt}）→ 播放到结尾：已还原，图 6 簇同色，3D 各面同色，显示「已还原」`);
    }
    // 摄像头：通过界面按钮
    await p.click('.tab[data-tab="scan"]');
    await p.click('.btn-cam');
    await p.waitForFunction(() => !!app.scan.stream, null, { timeout: 15000 });
    const vid = await p.evaluate(async () => { const v = app.scan.video; await new Promise(r => setTimeout(r, 800)); return v ? [v.videoWidth, v.videoHeight] : null; });
    ok(vid && vid[0] > 0, '点击「开启摄像头」→ getUserMedia 成功，视频 ' + (vid && vid.join('×')));
    await p.click('.btn-shot'); await p.waitForTimeout(300);
    const shot = await p.evaluate(() => ({ step: document.querySelector('.scan-title') && document.querySelector('.scan-title').textContent, msg: document.querySelector('.scan-msg') && document.querySelector('.scan-msg').textContent }));
    ok(true, '点击「拍摄」：' + JSON.stringify(shot));
    await p.click('.btn-cam'); await p.waitForTimeout(200);
    ok(await p.evaluate(() => !app.scan.stream), '再次点击关闭摄像头');
    // 声音：手势后已创建 AudioContext；音效 / 音乐开关可用；播放时有转动音效
    const au = await p.evaluate(async () => {
      const a = app.audio; document.getElementById('musicToggle').click(); await new Promise(r => setTimeout(r, 500));
      const r = { ctx: !!a.ctx && a.ctx.state, music: a.musicPlaying(), clicks: a.stats.click, chime: a.stats.chime, errors: a.stats.errors };
      document.getElementById('musicToggle').click(); return r;
    });
    ok(au.ctx === 'running' && au.music && au.clicks > 0 && au.chime > 0 && au.errors === 0, `声音：AudioContext ${au.ctx}，转动音效 ${au.clicks} 次，还原琶音 ${au.chime} 次，背景音乐可开关`);
    const tv = await p.evaluate(() => app.audio._turnBuffers(0.13, false, false).grains);
    ok(tv > 30, `转动声 v3：颗粒模态合成（${tv} 颗粒）`);
    if (vp.name === 'desktop') await p.screenshot({ path: require('path').join(__dirname, '..', 'screenshots', 'live-desktop.png') });
    else { ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), '移动端无横向溢出'); await p.screenshot({ path: require('path').join(__dirname, '..', 'screenshots', 'live-mobile.png') }); }
    ok(errs.length === 0, '无控制台错误 / 页面异常' + (errs.length ? '：' + errs.join(' | ') : ''));
    ok(bad.length === 0, '无失败请求' + (bad.length ? '：' + bad.join(' | ') : ''));
    await ctx.close();
  }
  await b.close();
  console.log(fails ? `\n${fails} 项失败` : '\n全部通过'); process.exit(fails ? 1 : 0);
})();
