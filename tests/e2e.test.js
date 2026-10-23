/* 端到端测试（以 zh-CN 语言环境运行，断言为简体中文；多语言见 tests/i18n.test.js）：node tests/e2e.test.js [baseUrl]（需要 playwright：npm install && npx playwright install chromium） */
const path = require('path');
const { chromium } = require('playwright');
const { execSync } = require('child_process');
const fs = require('fs');
const BASE = process.argv[2] || 'http://localhost:8765/';
const SHOTS = path.join(__dirname, '..', 'screenshots');
let fails = 0, passes = 0;
const ok = (c, m) => { if (c) { passes++; console.log('  ✔', m); } else { fails++; console.log('  ✘ FAIL:', m); } };

async function ready(p) { await p.waitForFunction(() => document.body.dataset.solverReady === '1', null, { timeout: 30000 }); }
async function playToEnd(p) {
  await p.evaluate(() => { app.player.speed = 12; app.player.play(); });
  await p.waitForFunction(() => app.player.index === app.player.length() && !app.player.busy, null, { timeout: 60000 });
}

(async () => {
  const browser = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] });
  const ctx = await browser.newContext({ locale: 'zh-CN', viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1, permissions: ['camera'] });
  const p = await ctx.newPage();
  const errors = []; p.on('pageerror', e => errors.push(e.message));
  await p.goto(BASE); await ready(p);

  console.log('\n[1] 随机打乱 → 求解 → 应用解法 = 复原；图节点回到 6 个同色簇');
  for (let t = 0; t < 4; t++) {
    await p.click('#btnScramble');
    const before = await p.evaluate(() => app.getState());
    await p.click('#btnSolve'); await p.waitForSelector('#solutionBox:not([hidden])');
    const r = await p.evaluate(() => {
      const st = app.getState(), moves = app.player.tl.moves;
      const h = app.hold(), shown = document.getElementById('solText').textContent.trim().split(/\s+/).map(t => h.fromView[t]);
      return { n: moves.length, solved: app.P.isSolved(app.P.apply(st, moves)), viewOk: app.P.isSolved(app.P.apply(st, shown)), text: document.getElementById('solText').textContent, count: document.getElementById('solCount').textContent };
    });
    ok(r.solved && r.n > 0 && r.n <= 22, `打乱 #${t + 1}: ${r.count}（${r.text}）→ 应用后复原`);
    ok(r.viewOk, '显示的解法（黄顶绿前记号）换回标准记号后同样复原');
    ok(JSON.stringify(before) === JSON.stringify(await p.evaluate(() => app.getState())), '求解不改变输入状态');
    if (t === 0) {
      // 中途截图 + 播放到结尾
      await p.evaluate(() => { app.player.speed = 0.6; app.player.seek(0); app.player.next(); });
      await p.waitForTimeout(430);
      await p.screenshot({ path: path.join(SHOTS, 'desktop-mid-animation.png') });
      await p.waitForFunction(() => !app.player.busy);
    }
    await playToEnd(p);
    const g = await p.evaluate(() => ({ clusters: app.graph.clusterColors(), badge: !document.getElementById('solvedBadge').hidden,
      m3d: app.P.faces.map(f => new Set(f.stickers.map(i => app.view.stickerMats[i].color.getHexString())).size) }));
    ok(g.clusters.every(c => new Set(c).size === 1) && new Set(g.clusters.map(c => c[0])).size === 6, '图视图：6 个簇各自同色且互不相同');
    ok(g.m3d.every(n => n === 1), '3D 视图：每个面颜色一致');
    ok(g.badge, '显示「已还原 ✔」');
    if (t === 0) {
      // 还原后自动展示一圈（参考视频结尾），结束后回到初始视角
      const sc = await p.evaluate(() => app.view.mode);
      ok(sc === 'showcase', '播放到结尾并还原后触发 3D 展示旋转（mode=' + sc + '）');
      await p.waitForTimeout(600);
      ok(await p.evaluate(() => Math.abs(app.view.spin.quaternion.w) > 0.9999), '参考节奏：还原后先静止约 1.2 s 再展示');
      await p.waitForTimeout(1500);
      await p.screenshot({ path: path.join(SHOTS, 'desktop-showcase.png') });
      await p.waitForFunction(() => app.view.mode === 'idle', null, { timeout: 8000 });
      ok(await p.evaluate(() => { const q = app.view.spin.quaternion; return Math.abs(q.w) > 0.9999; }), '展示结束后回到初始视角');
      await p.screenshot({ path: path.join(SHOTS, 'desktop-solved.png') });
    } else await p.waitForFunction(() => app.view.mode !== 'showcase', null, { timeout: 8000 });
  }

  console.log('\n[2] 播放器：seek / prev / next 与状态一致');
  {
    const r = await p.evaluate(async () => {
      const pl = app.player, P = app.P, res = [];
      pl.seek(5); res.push(JSON.stringify(pl.state()) === JSON.stringify(P.apply(pl.tl.start, pl.tl.moves.slice(0, 5))));
      await pl.next(); res.push(pl.index === 6 && JSON.stringify(app.graph.state) === JSON.stringify(pl.states[6]));
      await pl.prev(); await pl.prev(); res.push(pl.index === 4 && JSON.stringify(app.graph.state) === JSON.stringify(pl.states[4]));
      document.getElementById('timeline').value = 2; document.getElementById('timeline').dispatchEvent(new Event('input'));
      res.push(pl.index === 2 && document.querySelector('.mv.cur') === document.querySelectorAll('.mv')[1]);
      return res;
    });
    ok(r.every(Boolean), 'seek/next/prev/时间线拖动 状态正确 ' + JSON.stringify(r));
    // 真正的圆周运动：转动进行到任意时刻，侧面贴纸节点都恰好在其圆上；面内贴纸到簇中心距离在首末之间
    const arc = await p.evaluate(() => {
      const g = app.graph, P = app.P, lay = g.layout, out = [];
      for (const tok of ['U', "R'", 'F2', 'D', 'L', "B'"]) {
        const st = P.solvedState();
        for (const e of [0.17, 0.5, 0.83]) {
          g.animate(tok, e, st);
          for (const mv of g.motion(tok)) {
            if (mv.type !== 'circle') continue;
            const n = g.nodeEls[mv.s], d = Math.hypot(+n.getAttribute('cx') - mv.c[0], +n.getAttribute('cy') - mv.c[1]);
            out.push(Math.abs(d - mv.r0));
          }
        }
        g.setState(st);
      }
      return { n: out.length, max: Math.max(...out), trails: (g.animate('U', 0.5, P.solvedState()), g.gTrails.childElementCount) };
    });
    ok(arc.n > 0 && arc.max < 1e-9, `转动中节点严格沿圆弧运动（${arc.n} 个采样，最大偏差 ${arc.max.toExponential(1)}）`);
    ok(arc.trails > 0, `转动中显示彩色拖尾（${arc.trails} 段）`);
    // 参考视频的转动细节：高亮在转动末尾淡出、拖尾在结束时消失；节奏曲线（首尾慢、中段快）
    const fx = await p.evaluate(() => {
      const g = app.graph, P = app.P, st = P.solvedState(), op = t => { g.animate('U', CubeLab.ease(t), st, t); return [+g.activeEls[P.moves.U.tracks.find(id => g.activeEls[id])].style.opacity, g.gTrails.childElementCount]; };
      const r = { t0: op(0), t3: op(0.3), t6: op(0.6), t1: op(1) }; g.setState(st);
      const pl = app.player, n = 15; pl.load({ start: st, moves: Array(n).fill('U') });
      const d = k => CubeLab.tempo(k, n) * pl.baseMs;
      r.tempo = [d(0), d(7), d(14)].map(Math.round); r.easeMid = CubeLab.ease(0.5); r.easeQ = CubeLab.ease(0.25);
      return r;
    });
    ok(fx.t0[0] === 0 && fx.t3[0] === 1 && fx.t6[0] === 1 && fx.t1[0] === 0, `活动圆高亮：开始/结束为 0，中段为 1（${[fx.t0[0], fx.t3[0], fx.t6[0], fx.t1[0]]}）`);
    ok(fx.t3[1] > 0 && fx.t6[1] > 0 && fx.t1[1] === 0, `拖尾在转动中出现、结束时消失（${[fx.t3[1], fx.t6[1], fx.t1[1]]} 段）`);
    ok(fx.tempo[0] > 800 && fx.tempo[0] < 950 && fx.tempo[1] === 480 && fx.tempo[2] === fx.tempo[0], `连续播放节奏 首/中/末 = ${fx.tempo.join(' / ')} ms（参考 850 / 480 / 1000）`);
    ok(fx.easeMid === 0.5 && Math.abs(fx.easeQ - 0.125) < 1e-12, 'easeInOutQuad 缓动');
    // 握法：黄顶绿前（默认）下解法记号按 z2 重命名；切到白顶后 3D 朝向与记号随之改变
    const hold = await p.evaluate(() => {
      const P = app.P, pl = app.player, st = P.apply(P.solvedState(), "R U'"), saved = pl.tl;
      pl.load({ start: st, moves: ['U', "R'"] }); pl.seek(1);
      const a = { hold: app.hold().id, now: document.getElementById('nowMove').textContent, chips: [...document.querySelectorAll('.mv')].map(b => b.textContent), rz: app.view.root.rotation.z };
      app.setHold('whiteTop');
      const b = { hold: app.hold().id, now: document.getElementById('nowMove').textContent, chips: [...document.querySelectorAll('.mv')].map(b => b.textContent), rz: app.view.root.rotation.z, hint: document.getElementById('holdHint').textContent };
      app.setHold('yellowTop'); pl.load(saved);
      return { a, b };
    });
    ok(hold.a.hold === 'yellowTop' && hold.a.now === 'D' && hold.a.chips.join() === "D,L′" && Math.abs(hold.a.rz - Math.PI) < 1e-9, `默认黄顶绿前：内部 U, R′ 显示为 ${hold.a.chips.join(' ')}`);
    ok(hold.b.now === 'U' && hold.b.chips.join() === "U,R′" && hold.b.rz === 0 && /白色朝上/.test(hold.b.hint), `切到白顶绿前：显示 ${hold.b.chips.join(' ')}，3D 朝向复位`);
    await p.evaluate(() => app.player.seek(app.player.index));
    // 自动旋转：播放时轻微摆动；关闭开关后不摆动、不展示
    await p.evaluate(() => { app.player.seek(0); app.player.speed = 0.5; app.player.play(); });
    await p.waitForTimeout(1500);
    const sway = await p.evaluate(() => ({ amt: app.view.swayAmt, w: app.view.spin.quaternion.w }));
    ok(sway.amt > 0.5 && sway.w < 0.99999, `播放时自动轻微旋转（强度 ${sway.amt.toFixed(2)}）`);
    await p.click('label.toggle:has(#autoRotate)'); await p.waitForTimeout(1500);
    const off = await p.evaluate(() => ({ on: app.view.autoRotate, amt: app.view.swayAmt, sc: app.view.showcase() }));
    ok(!off.on && off.amt === 0 && off.sc === false, '关闭「自动旋转」后停止摆动且不做展示');
    await p.click('label.toggle:has(#autoRotate)'); await p.evaluate(() => app.player.pause());
    ok(await p.evaluate(() => app.view.autoRotate === true), '重新打开自动旋转');
    await p.click('#btnDemo'); await p.waitForTimeout(200);
    const d = await p.evaluate(() => ({ ph: app.player.tl.phases, start: app.P.isSolved(app.player.tl.start), n: app.player.length() }));
    ok(d.start && d.ph.includes('scramble') && d.ph.includes('solve'), `演示模式：从复原开始，打乱+还原共 ${d.n} 步`);
    await p.evaluate(() => app.player.pause());
  }

  console.log('\n[3] 手动涂色 + 校验');
  {
    await p.click('#btnReset');
    const cell = i => p.locator(`#net .cell[data-i="${i}"]`);
    const brush = c => p.click(`.swatch[data-color="${c}"]`);
    // 颜色数量错误
    await brush('R'); await cell(0).click();
    let v = await p.textContent('#validation');
    ok(/白色有 8 块/.test(v) && /红色有 10 块/.test(v), '颜色数量错误：' + v.replace(/\s+/g, ' ').slice(0, 80));
    ok((await cell(0).getAttribute('data-color')) === 'R', '点击贴纸即上色');
    // 中心块不可改
    await cell(4).click(); ok((await cell(4).getAttribute('data-color')) === 'W', '中心块固定不可涂');
    // 求解时报错
    await p.click('#btnSolve'); ok((await p.getAttribute('#validation', 'class')).includes('bad'), '非法状态点「求解」显示红色错误');
    // 拧角：URF 角 (8,9,20) W,R,G -> R,G,W
    await p.click('#btnReset');
    await brush('R'); await cell(8).click(); await brush('G'); await cell(9).click(); await brush('W'); await cell(20).click();
    v = await p.textContent('#validation'); ok(/扭转/.test(v), '角块扭转：' + v.replace(/\s+/g, ' ').slice(0, 60));
    // 翻棱：UR 棱 (5,10)
    await p.click('#btnReset'); await brush('R'); await cell(5).click(); await brush('W'); await cell(10).click();
    v = await p.textContent('#validation'); ok(/翻转/.test(v), '棱块翻转：' + v.replace(/\s+/g, ' ').slice(0, 60));
    // 奇偶：交换 UR(5,10) 与 UF(7,19) 两个棱块
    await p.click('#btnReset'); await brush('G'); await cell(10).click(); await brush('R'); await cell(19).click();
    v = await p.textContent('#validation'); ok(/奇偶/.test(v), '奇偶错误：' + v.replace(/\s+/g, ' ').slice(0, 60));
    // 不存在的组合：UR 棱涂成 白/黄
    await p.click('#btnReset'); await brush('Y'); await cell(10).click(); await brush('R'); await cell(28).click();
    v = await p.textContent('#validation'); ok(/不存在/.test(v), '不可能的颜色组合：' + v.replace(/\s+/g, ' ').slice(0, 60));
    // 拖动连续涂色
    await p.click('#btnReset'); await brush('B');
    const b1 = await cell(36).boundingBox(), b2 = await cell(38).boundingBox();
    await p.mouse.move(b1.x + 5, b1.y + 5); await p.mouse.down(); await p.mouse.move(b2.x + 5, b2.y + 5, { steps: 6 }); await p.mouse.up();
    ok((await cell(36).getAttribute('data-color')) === 'B' && (await cell(37).getAttribute('data-color')) === 'B' && (await cell(38).getAttribute('data-color')) === 'B', '拖动可连续涂色');
    // 清空
    await p.click('#btnClear'); v = await p.textContent('#validation'); ok(/未上色/.test(v), '清空后提示未上色');
    // 公式输入
    await p.click('.tab[data-tab="formula"]'); await p.fill('#formula', "R U X'"); await p.click('#btnApplyFormula');
    ok(/无法识别/.test(await p.textContent('#formulaMsg')), '公式错误提示：' + await p.textContent('#formulaMsg'));
    await p.fill('#formula', "R U R' U'"); await p.click('#btnApplyFormula');
    const fr = await p.evaluate(() => JSON.stringify(app.getState()) === JSON.stringify(app.P.apply(app.P.solvedState(), "R U R' U'")));
    ok(fr, '公式输入正确应用');
    // 中层转动（M/E/S）：可输入、可求解（中心块被移动，求解相对当前中心进行）
    await p.fill('#formula', "M E' S2 R U"); await p.click('#btnApplyFormula');
    await p.click('#btnSolve'); await p.waitForSelector('#solutionBox:not([hidden])');
    const sl = await p.evaluate(() => ({ ok: app.P.isSolved(app.P.apply(app.getState(), app.player.tl.moves)), n: app.player.length(), txt: document.getElementById('solText').textContent }));
    ok(sl.ok && sl.n > 0, `含中层转动的公式 M E′ S2 R U → 求解 ${sl.n} 步后复原（${sl.txt}）`);
    await p.fill('#formula', "R U R' U'"); await p.click('#btnApplyFormula');
    await p.click('#btnSolve'); await p.waitForSelector('#solutionBox:not([hidden])');
    ok(/4 步（已证明最优）/.test(await p.textContent('#solCount')), "R U R' U' 的解为 4 步（最优）：" + await p.textContent('#solText'));
  }

  console.log('\n[4] 照片上传识别（合成图片，含偏色/光照梯度/噪声/反光）');
  {
    await p.click('.tab[data-tab="paint"]'); await p.click('#btnScramble');
    const target = await p.evaluate(() => app.getState());
    const plan = await p.evaluate(() => app.P.cameraPlan.map(s => ({ face: s.face, cells: s.cells })));
    const dir = require('path').join(require('os').tmpdir(), 'cube-faces'); fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(dir + '/state.json', JSON.stringify({ state: target, plan }));
    execSync(`python3 ${__dirname}/make_face_images.py ${dir}/state.json ${dir}`);
    await p.click('#btnReset'); await p.click('.tab[data-tab="scan"]');
    for (let k = 0; k < plan.length; k++) {
      const step = await p.evaluate(() => app.scan.plan[app.scan.step].face);
      await p.setInputFiles('.scan-file', `${dir}/face_${step}.jpg`);
      await p.waitForFunction(() => !document.querySelector('.btn-shot').disabled);
      if (k === 0) await p.screenshot({ path: path.join(SHOTS, 'desktop-photo-scan.png') });
      await p.click('.btn-shot');
    }
    const got = await p.evaluate(() => app.getState());
    const diff = got.map((c, i) => c === target[i] ? null : i).filter(i => i !== null);
    ok(diff.length === 0, `6 面照片识别：54 块中 ${54 - diff.length} 块正确` + (diff.length ? ' 错误位置 ' + diff : ''));
    ok(/六个面都已扫描/.test(await p.textContent('.scan-msg')), '扫描完成提示');
    ok((await p.getAttribute('#validation', 'class')).includes('ok'), '识别结果通过校验，可直接求解');
  }

  console.log('\n[5] 摄像头路径（Chromium 假摄像头）不崩溃');
  {
    await p.click('.btn-scan-reset');
    const started = await p.evaluate(() => app.scan.startCamera());
    ok(started === true, 'getUserMedia 成功并开始预览');
    await p.waitForTimeout(600);
    const res = await p.evaluate(() => { const r = app.scan.capture(); return r && Object.keys(r).length; });
    ok(res === 9, '拍摄一面：得到 9 个分类结果');
    ok(await p.evaluate(() => app.audio.stats.capture >= 1), '识别成功时播放拍摄提示音');
    await p.evaluate(() => app.scan.stopCamera());
    ok(await p.evaluate(() => !app.scan.stream), '关闭摄像头');
  }
  ok(errors.length === 0, '桌面端无页面异常 ' + errors.join('; '));

  // 桌面截图：打乱状态
  await p.goto(BASE); await ready(p);
  await p.screenshot({ path: path.join(SHOTS, 'desktop-scrambled.png') });
  await p.screenshot({ path: path.join(SHOTS, 'desktop-full.png'), fullPage: true });

  console.log('\n[6] 移动端布局');
  {
    const m = await browser.newContext({ locale: 'zh-CN', viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const q = await m.newPage(); const merr = []; q.on('pageerror', e => merr.push(e.message));
    await q.goto(BASE); await ready(q);
    const lay = await q.evaluate(() => {
      const a = document.getElementById('view3d').getBoundingClientRect(), b = document.getElementById('graph').getBoundingClientRect();
      return { overflow: document.documentElement.scrollWidth - window.innerWidth, stacked: b.top >= a.bottom - 1 };
    });
    ok(lay.overflow <= 0, '无横向溢出');
    ok(lay.stacked, '3D 与图视图上下堆叠');
    await q.screenshot({ path: path.join(SHOTS, 'mobile-scrambled.png'), fullPage: false });
    await q.tap('#btnSolve'); await q.waitForSelector('#solutionBox:not([hidden])');
    await q.evaluate(() => { window.scrollTo(0, 0); app.player.speed = 0.6; app.player.seek(3); app.player.next(); });
    await q.waitForTimeout(430);
    await q.screenshot({ path: path.join(SHOTS, 'mobile-mid-animation.png') });
    await playToEnd(q);
    await q.waitForFunction(() => app.view.mode === 'idle', null, { timeout: 8000 });
    await q.evaluate(() => window.scrollTo(0, 0));
    await q.screenshot({ path: path.join(SHOTS, 'mobile-solved.png'), fullPage: true });
    ok(await q.evaluate(() => app.P.isSolved(app.player.state())), '移动端求解播放后复原');
    ok(merr.length === 0, '移动端无页面异常 ' + merr.join('; '));
    await m.close();
  }

  console.log('\n[7] 声音（Web Audio 合成）');
  {
    const sctx = await browser.newContext({ locale: 'zh-CN', viewport: { width: 1440, height: 1000 } });
    const a = await sctx.newPage(); const aerr = [];
    a.on('pageerror', e => aerr.push('pageerror: ' + e.message)); a.on('console', m => { if (m.type() === 'error') aerr.push('console: ' + m.text()); });
    await a.goto(BASE + '?start=solved'); await ready(a);
    const s0 = await a.evaluate(() => ({ ctx: !!app.audio.ctx, sfx: document.getElementById('sfxToggle').checked, mus: document.getElementById('musicToggle').checked, vol: +document.getElementById('volume').value }));
    ok(!s0.ctx, '页面加载后、用户手势前不创建 AudioContext（自动播放策略）');
    ok(s0.sfx && !s0.mus && s0.vol === 70, `默认：音效开、音乐关、音量 ${s0.vol}`);
    await a.click('#nowDesc');   // 第一次用户手势
    const s1 = await a.waitForFunction(() => app.audio.ctx && app.audio.ctx.state === 'running', null, { timeout: 5000 }).then(() => true, () => false);
    ok(s1, '第一次点击后创建 AudioContext 且 state = running');
    // 转动音效：一次单步 = 起始「咔」+ 落位「嗒」；播放到还原 → 琶音；展示翻转 → 扫光
    await a.evaluate(() => { app.setEditor(app.P.apply(app.P.solvedState(), "R U"), null); });
    await a.click('#btnSolve'); await a.waitForSelector('#solutionBox:not([hidden])');
    await a.evaluate(() => app.player.next());
    await a.waitForFunction(() => !app.player.busy);
    const c1 = await a.evaluate(() => app.audio.stats.click);
    ok(c1 === 1, `单步转动：一段转动声（颗粒模态合成，落位咔对齐动画结束）（${c1}）`);
    await a.evaluate(() => app.player.play());
    await a.waitForFunction(() => app.player.index === app.player.length() && !app.player.busy, null, { timeout: 20000 });
    ok(await a.evaluate(() => app.audio.stats.chime) === 1, '还原时播放琶音');
    await a.waitForFunction(() => app.audio.stats.sweep === 1, null, { timeout: 5000 }).then(() => ok(true, '展示翻转开始时播放扫光音效'), () => ok(false, '展示翻转音效'));
    // 快放：20 步、12 倍速 → 限流
    const fast = await a.evaluate(async () => {
      const P = app.P, st = P.solvedState(), mv = Array(20).fill(0).map((_, i) => ['R', 'U', "R'", "U'"][i % 4]);
      app.player.load({ start: P.apply(st, P.inverse(mv)), moves: mv }); const c0 = app.audio.stats.click, k0 = app.audio.stats.clickSkipped;
      app.player.speed = 12; app.player.play();
      await new Promise(r => { const t = setInterval(() => { if (app.player.index === app.player.length() && !app.player.busy) { clearInterval(t); r(); } }, 50); });
      app.player.speed = 1; return { played: app.audio.stats.click - c0, skipped: app.audio.stats.clickSkipped - k0 };
    });
    ok(fast.played + fast.skipped === 20 && fast.played >= 5 && fast.played <= 20, `12× 快放 20 步：发声 ${fast.played} 次，限流跳过 ${fast.skipped} 次（两次至少间隔 50 ms）`);
    // 拖动时间线（取消进行中的转动）→ 未播完的转动声立即停止
    const cancel = await a.evaluate(async () => { const P = app.P; app.player.load({ start: P.solvedState(), moves: ['R2', 'U'] }); app.player.speed = 0.5; app.player.next(); await new Promise(r => setTimeout(r, 150)); const before = (app.audio._turns || []).length; app.player.seek(0); app.player.speed = 1; return { before, after: (app.audio._turns || []).length }; });
    ok(cancel.before >= 1 && cancel.after === 0, `转动中拖动时间线：未播完的转动声停止（${cancel.before} → ${cancel.after}）`);
    // 中层转动更轻：同样能发声
    await a.evaluate(() => { const P = app.P; app.player.load({ start: P.solvedState(), moves: ['E'] }); });
    await a.evaluate(() => app.player.next()); await a.waitForFunction(() => !app.player.busy);
    // 涂色
    await a.click('.tab[data-tab="paint"]'); await a.click('#btnReset');
    await a.click('.swatch[data-color="R"]'); await a.click('#net .cell[data-i="0"]');
    ok(await a.evaluate(() => app.audio.stats.paint) >= 1, '涂色时播放轻点音效');
    // 音乐 + 音量 + 关闭音效 → 刷新后保持
    await a.click('label:has(#musicToggle)');
    await a.waitForTimeout(400);
    ok(await a.evaluate(() => app.audio.musicPlaying() && app.audio.stats.musicNotes > 0), '打开「音乐」：程序生成的背景音乐开始调度');
    await a.evaluate(() => { const v = document.getElementById('volume'); v.value = 30; v.dispatchEvent(new Event('input')); });
    await a.click('label:has(#sfxToggle)');
    const st = await a.evaluate(() => ({ ls: ['sfx', 'music', 'vol'].map(k => localStorage.getItem('cubelab.' + k)), gain: app.audio.master.gain.value }));
    ok(st.ls.join() === '0,1,0.30', '设置写入 localStorage：' + st.ls.join(' / '));
    await a.reload(); await ready(a);
    const s2 = await a.evaluate(() => ({ ctx: !!app.audio.ctx, sfx: document.getElementById('sfxToggle').checked, mus: document.getElementById('musicToggle').checked, vol: +document.getElementById('volume').value, playing: app.audio.musicPlaying() }));
    ok(!s2.sfx && s2.mus && s2.vol === 30, `刷新后设置保持：音效关、音乐开、音量 ${s2.vol}`);
    ok(!s2.ctx && !s2.playing, '刷新后音乐等待用户手势才开始');
    await a.click('#nowDesc');
    await a.waitForFunction(() => app.audio.musicPlaying(), null, { timeout: 5000 }).then(() => ok(true, '手势后背景音乐自动开始'), () => ok(false, '手势后背景音乐开始'));
    await a.evaluate(() => app.player.next()); await a.waitForTimeout(800);
    ok(await a.evaluate(() => app.audio.stats.click === 0), '音效关闭时转动不发声');
    await a.click('label:has(#musicToggle)'); ok(await a.evaluate(() => !app.audio.musicPlaying()), '关闭音乐');
    await a.screenshot({ path: path.join(SHOTS, 'desktop-sound-controls.png'), clip: await a.locator('.controls').boundingBox() });
    ok(await a.evaluate(() => app.audio.stats.errors === 0), '声音模块无内部错误');
    ok(aerr.length === 0, '声音测试无控制台错误 / 页面异常 ' + aerr.join('; '));
    await sctx.close();
    // 不支持 Web Audio 的浏览器
    const nctx = await browser.newContext({ locale: 'zh-CN' }); await nctx.addInitScript(() => { delete window.AudioContext; delete window.webkitAudioContext; });
    const n = await nctx.newPage(); const nerr = [];
    n.on('pageerror', e => nerr.push(e.message)); n.on('console', m => { if (m.type() === 'error') nerr.push(m.text()); });
    await n.goto(BASE); await ready(n); await n.click('#nowDesc');
    await n.click('#btnSolve'); await n.waitForSelector('#solutionBox:not([hidden])');
    await n.evaluate(() => { app.player.speed = 12; app.player.play(); });
    await n.waitForFunction(() => app.player.index === app.player.length() && !app.player.busy, null, { timeout: 60000 });
    const nd = await n.evaluate(() => ({ sup: app.audio.supported, dis: document.getElementById('sfxToggle').disabled, solved: app.P.isSolved(app.player.state()) }));
    ok(!nd.sup && nd.dis && nd.solved && nerr.length === 0, '无 AudioContext 的环境：声音控件禁用，求解播放正常，无错误 ' + nerr.join('; '));
    await nctx.close();
  }

  await browser.close();
  console.log(`\n结果：${passes} 通过，${fails} 失败`);
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
