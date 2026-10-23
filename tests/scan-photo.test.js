// 照片上传识别 e2e（N×N）：合成照片 → 界面逐面上传 → 比较新方法（界面结果）与旧方法（同一批采样）
// 用法：node tests/scan-photo.test.js [URL] [每档次数=3] [阶数=2,3,4,5,6,7]
const { chromium } = require('playwright');
const fs = require('fs'), { execSync } = require('child_process');
const URL = process.argv[2] || 'http://localhost:8765/', K = +process.argv[3] || 3, SIZES = (process.argv[4] || '2,3,4,5,6,7').split(',').map(Number);
(async () => {
  const b = await chromium.launch({ args: ['--enable-unsafe-swiftshader'] });
  const ctx = await b.newContext({ locale: 'zh-CN', viewport: { width: 1440, height: 1000 } }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  let worse = 0; const tot = {};
  for (const n of SIZES) {
    await p.goto(URL + '?n=' + n, { waitUntil: 'load' });
    await p.waitForFunction(() => document.body.dataset.solverReady === '1', null, { timeout: 60000 });
    for (const light of ['normal', 'hard', 'warm', 'dim']) {
      const a = tot[n + light] = { old: 0, neu: 0, oldOk: 0, neuOk: 0, valid: 0, N: 0 };
      for (let k = 0; k < K; k++) {
        await p.click('.tab[data-tab="paint"]'); await p.click('#btnScramble');
        const target = await p.evaluate(() => app.getState());
        const plan = await p.evaluate(() => app.P.cameraPlan.map(s => ({ face: s.face, cells: s.cells })));
        const dir = require('path').join(require('os').tmpdir(), 'scan-photo', `${n}-${light}-${k}`); fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(dir + '/state.json', JSON.stringify({ state: target, plan }));
        execSync(`python3 ${__dirname}/make_face_images_nxn.py ${dir}/state.json ${dir} ${n} ${light} ${n * 100 + k}`);
        await p.click('#btnReset'); await p.click('.tab[data-tab="scan"]');
        if (await p.$('.btn-scan-reset')) await p.click('.btn-scan-reset').catch(() => {});
        for (let s = 0; s < plan.length; s++) {
          const face = await p.evaluate(() => app.scan.plan[app.scan.step].face);
          await p.setInputFiles('.scan-file', `${dir}/face_${face}.jpg`);
          await p.waitForFunction(() => !document.querySelector('.btn-shot').disabled);
          await p.click('.btn-shot');
        }
        const r = await p.evaluate(() => {
          const P = app.P, solved = P.solvedState();
          const old = CubeLab.colorUtil.classify(P, app.scan.samples, { balanced: true, centerColor: i => solved[i] });
          return { got: app.getState(), old: solved.map((_, i) => old[i]), valid: (document.getElementById('validation').className || '').includes('ok') };
        });
        const wN = r.got.filter((c, i) => c !== target[i]).length, wO = r.old.filter((c, i) => c !== target[i]).length;
        a.N += target.length; a.neu += target.length - wN; a.old += target.length - wO; a.neuOk += !wN; a.oldOk += !wO; a.valid += r.valid;
      }
      const pc = x => (100 * x / a.N).toFixed(2) + '%';
      console.log(`${n}×${n} ${light.padEnd(6)} | 旧 ${pc(a.old)}，整魔方全对 ${a.oldOk}/${K} | 新 ${pc(a.neu)}，全对 ${a.neuOk}/${K}，通过校验 ${a.valid}/${K}`);
      if (a.neu < a.old) worse++;
    }
  }
  console.log(errs.length ? 'page errors: ' + errs.slice(0, 3).join(' | ') : '无页面错误');
  console.log(worse || errs.length ? 'SCAN PHOTO: FAIL' : 'SCAN PHOTO: PASS');
  await b.close(); process.exit(worse || errs.length ? 1 : 0);
})();
