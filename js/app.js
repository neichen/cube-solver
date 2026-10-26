/* 应用装配：只通过 Puzzle 接口把核心模块连起来。切换谜题（2×2 … 15×15）时重建所有视图。 */
(function () {
  'use strict';
  var CL = window.CubeLab;
  // 初始谜题：?n=4 / ?puzzle=cube4 → 谜题页自身的谜题 → 3×3。
  // 首页（各语言根目录）总是 3×3：不再记住/恢复上次选择的谜题（旧版本留下的 cubelab.puzzle 一并清除）
  var q0 = /[?&]n=(\d+)/.exec(location.search), qp0 = /[?&]puzzle=(\w+)/.exec(location.search);
  try { localStorage.removeItem('cubelab.puzzle'); } catch (e) {}
  var pagePz = document.documentElement.getAttribute('data-page-puzzle');   // prerendered puzzle page
  // shared position (#p=cube4&s=…, js/core/share-code.js): the fragment's puzzle wins, the position is applied after boot
  var share0 = CL.shareCode ? CL.shareCode.parseHash(location.hash) : null;
  var first = share0 ? share0.p : qp0 ? qp0[1] : q0 ? 'cube' + q0[1] : pagePz;
  if (!first || !CL.puzzleMeta().some(function (m) { return m.id === first; })) first = 'cube3';
  // 语言包与谜题插件按需加载（每页只带自己的语言和谜题）：两者就绪后再装配
  var booted = false;
  function go() { if (!booted) { booted = true; boot(first); } }
  Promise.all([CL.i18n.init(), CL.loadPuzzle(first)]).then(go, function (e) { if (window.console) console.error(e); go(); });

  function boot(first) {
  var $ = function (id) { return document.getElementById(id); };
  // i18n：所有界面文字走 t()（js/i18n/*.js）；bind() 记住键 + 参数，切换语言时自动重译
  var I = CL.i18n, t = I.t, bind = I.bind, nf = I.nf;
  var mv = function (tok) { return tok.replace("'", '′'); };
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function errText(e) { return e && e.i18n ? t(e.i18n.k, e.i18n.p) : (e && e.message) || String(e); }

  // 顶栏：谜题菜单 / 语言菜单 / 分享 / GitHub（js/topbar.js，标记由 tools/build-seo.js 预渲染）
  var TB = CL.topbar;
  function puzzleName(id) {
    var m = CL.puzzleMeta().filter(function (x) { return x.id === id; })[0];
    var nk = m.meta ? m.meta.nameKey : m.puzzle.nameKey;
    if (nk) return t(nk);
    return t('puzzle.cubeN', { n: String(m.meta ? m.meta.n : m.puzzle.n) });
  }

  // 声音（全局，与谜题无关）
  var audio = new CL.SoundEngine();
  // 当前谜题上下文
  var P, graph, view, player, editor, scan, holds, hold, editorState, lastScramble = null, solution = null, solMeta = null;
  var solverCache = {}, speedTouched = false, mode = 'solve';
  var scanTemplate = $('scan').cloneNode(true);

  function vt(tk) { return (hold.toView && hold.toView[tk]) || tk; }
  var hs = $('holdSelect'), ss = $('solverSelect');

  function relabelSelects() {
    Array.prototype.forEach.call(hs.options, function (o, i) { o.text = holds[i].name; });
    Array.prototype.forEach.call(ss.options, function (o, i) { o.text = P.solvers[i].name; });
  }

  // ---------------------------------------------------------------- 挂载 / 卸载一个谜题
  function unmount() {
    if (!P) return;
    player.cancel(); player.listeners = []; player.moveHooks = [];
    graph.destroy(); view.destroy(); editor.destroy(); scan.destroy();
    // 一次性 Worker（gullicube）在求解后即释放；其它求解器保留，切回来不用重新初始化
  }
  function mount(id) {
    if (active) cancelSolve();   // 换谜题：终止进行中的求解
    unmount();
    P = CL.getPuzzle(id);
    document.body.dataset.puzzle = id; document.body.dataset.solverReady = '';
    TB.setPuzzle(id);
    // 新的 DOM 容器（丢弃旧监听）
    ['net', 'palette'].forEach(function (k) { var o = $(k), c = o.cloneNode(false); o.parentNode.replaceChild(c, o); });
    var sc = $('scan'), fresh = scanTemplate.cloneNode(true); fresh.className = sc.className; sc.parentNode.replaceChild(fresh, sc);
    $('playFormula').setAttribute('data-i18n-placeholder', P.twisty ? 'play.formulaPh.' + P.id : 'play.formulaPh');
    $('formula').setAttribute('data-i18n-placeholder', P.twisty ? 'formula.placeholder.' + P.id : 'formula.placeholder');
    I.apply();
    graph = new CL.GraphView($('graph'), P);
    view = new CL.View3D($('view3d'), P);
    player = new CL.Player(P, [view, graph]);
    player.speed = +$('speed').value;
    player.onMove(function (phase, tok, dur) {
      var m = tok && P.moves[tok];
      audio.move(phase, { slice: !!(m && m.slice), half: !!(m && Math.abs(Math.abs(m.angle) - Math.PI) < 1e-6), dur: dur });
      if (mode !== 'play' && phase === 'end' && player.length() && player.index === player.length() && P.isSolved(player.state())) audio.solved();
    });
    view.onShowcaseStart = function (ms) { audio.sweep(ms); };
    view.setAutoRotate($('autoRotate').checked);
    editor = new CL.NetEditor($('net'), $('palette'), P, { onChange: onEdit, onPaint: function (i, c) { audio.paint(Math.max(0, Object.keys(P.colors).indexOf(c))); } });
    // 没有扫描计划的谜题（金字塔 / 斜转）：隐藏「摄像头 / 照片」选项卡
    syncSchemeUI(); if (lettersCb && lettersCb.checked) { document.body.classList.add('letters-on'); if (view.setLetters) view.setLetters(true); }
    var scanTab = document.querySelector('.tab[data-tab="scan"]');
    scanTab.hidden = !P.cameraPlan;
    if (!P.cameraPlan && scanTab.classList.contains('active')) document.querySelector('.tab[data-tab="paint"]').click();
    if (!P.cameraPlan) scan = { destroy: function () {}, stopCamera: function () {}, stream: null };
    else scan = new CL.CameraScan($('scan'), P, {
      onResult: function (res, allDone) {
        audio.capture(allDone);
        var s = editor.getState();
        Object.keys(res).forEach(function (i) { s[i] = res[i]; });
        setEditor(s);
      }
    });
    var warn = $('scan').querySelector('.scan-warn');
    if (warn) { var keys = [P.scanWarn, P.scanEven ? 'scan.evenNote' : null].filter(Boolean); warn.hidden = !keys.length; bind(warn, function () { return keys.map(function (k) { return t(k, { n: String(P.n || 3) }); }).join(' '); }); }
    // 握法
    holds = P.holds || [{ id: 'default', name: '', short: '', toView: {}, fromView: {} }];
    hs.innerHTML = ''; holds.forEach(function (h) { hs.add(new Option(h.name, h.id)); });
    var savedHold = null; try { savedHold = localStorage.getItem('cubelab.hold'); } catch (e) {}
    var qh = /[?&]hold=(\w+)/.exec(location.search);
    // 求解器
    ss.innerHTML = ''; P.solvers.forEach(function (s) { var o = new Option(s.name, s.id); o.disabled = !s.available; ss.add(o); });
    speedTouched = false;
    solution = null; lastScramble = null; editorState = P.solvedState();
    setHold(qh ? qh[1] : savedHold || holds[0].id);
    renderNotation(); renderHints(); relabelSelects();
    $('formula').value = ''; $('formulaMsg').textContent = '';
    prepareSolver();
    if (/[?&]start=solved/.test(location.search)) showInput(); else scramble();
  }

  // ---------------------------------------------------------------- 握法：3D 朝向 + 解法记号（内部始终是 WCA 白顶绿前）
  var lastTl = null, wasPlaying = false, lastK = -1, lastLen = -1;
  function setHold(id) {
    hold = holds.filter(function (h) { return h.id === id; })[0] || holds[0];
    hs.value = hold.id;
    if (hold.orientation) view.setOrientation(hold.orientation);
    var noHold = !P.holds; $('holdHint').style.display = hs.parentNode.style.display = noHold ? 'none' : '';
    if (noHold) $('holdHint').textContent = ''; else bind($('holdHint'), function () { return t('stage.holdHint', { grip: hold.short }); });
    try { localStorage.setItem('cubelab.hold', hold.id); } catch (e) {}
    renderSolution(); lastTl = null; if (player.listeners.length) player._emit();
  }
  hs.addEventListener('change', function () { setHold(hs.value); });
  // 计数说明：谜题可覆盖（五魔方的 HTM = 72° / 144° 面转都计 1）
  function metricKey(m) { return (P.metricTitle && P.metricTitle[m]) || 'metric.' + m; }
  function metricLabel() { return solMeta && solMeta.metric ? solMeta.metric : null; }
  function renderSolution() {
    if (!solution) return;
    if (solution.length) $('solText').textContent = P.format(solution.map(vt)); else bind($('solText'), 'solve.empty');
    bind($('solHold'), function () { return t('solve.holdNote', { grip: hold.name }); });
    var m = metricLabel(), me = $('solMetric');
    me.hidden = !m || !solution.length;
    if (m) { me.textContent = m; bind(me, metricKey(m), null, 'title'); }
  }

  // ---------------------------------------------------------------- 编辑器
  function onEdit(s) { editorState = s; lastScramble = null; showInput(); }
  function showInput() {
    solution = null; solMeta = null; $('solutionBox').hidden = true;
    player.load({ start: editorState, moves: [] });
    validateNow(false);
  }
  function setEditor(s, scr) { editor.setState(s, true); editorState = s.slice(); lastScramble = scr || null; showInput(); }

  // 校验（错误来自 P.validate().issues：键 + 参数，颜色/位置在这里本地化）
  var lastLoud = false, lastErr = null;
  function issueText(it) {
    var p = {}, k;
    for (k in it.p) p[k] = it.p[k];
    if (p.color) p.color = t('color.' + CL.phys(P, p.color));
    if (p.piece) p.piece = t(p.piece);
    if (p.colors) p.colors = p.colors.map(function (c) { return t('color.' + CL.phys(P, c)); }).join('/');
    if (p.pos) p.pos = p.pos.split('').map(function (f) { return t('pos.' + f); }).join(t('pos.sep'));
    return t(it.k, p);
  }
  function validateNow(loud) {
    var v = P.validate(editorState), box = $('validation');
    lastLoud = loud; lastErr = null;
    editor.mark(v.marks || []);
    if (v.ok) {
      box.className = 'status ok';
      box.textContent = t(P.isSolved(editorState) ? 'valid.ok' : 'valid.okSolve');
    } else {
      box.className = 'status ' + (loud ? 'bad' : 'warn');
      var items = v.issues && v.issues.length ? v.issues.map(issueText) : v.errors;
      var uniq = []; items.forEach(function (x) { if (uniq.indexOf(x) < 0) uniq.push(x); });
      var more = uniq.length > 8 ? uniq.length - 8 : 0;
      box.innerHTML = '<b>' + esc(t(loud ? 'valid.cantSolve' : 'valid.problems')) + '</b><ul>' + uniq.slice(0, 8).map(function (e) { return '<li>' + esc(e) + '</li>'; }).join('') + (more ? '<li>' + esc(t('valid.more', { n: more })) + '</li>' : '') + '</ul>';
    }
    return v;
  }
  function showSolveError(e) { lastErr = e; var box = $('validation'); box.className = 'status bad'; box.textContent = errText(e); }

  // ---------------------------------------------------------------- 求解器
  function curSolverDef() { return P.solvers.filter(function (s) { return s.id === ss.value; })[0] || P.solvers[0]; }
  function solverKey(def) { return P.id + ':' + def.id; }
  function prepareSolver() {
    var def = curSolverDef(); if (!def) return;
    if (def.oneShot) {   // gullicube：每次求解一个新 Worker（求解后释放约 1 GB 内存）；这里只提示
      bind($('solverStatus'), def.id === 'gullicubeFast' ? 'solve.gcFastIdle' : 'solve.gcIdle');
      document.body.dataset.solverReady = '1';
      return;
    }
    // 查表（cubejs-prune.bin.gz 等）不在首屏下载：第一次交互（点 / 按键）、空闲时或按「求解」时才初始化求解器
    if (!solverCache[solverKey(def)] && !warm) {
      bind($('solverStatus'), 'solve.lazy');
      document.body.dataset.solverReady = '1';
      return;
    }
    getSolver(def);
  }
  var warm = /[?&]warm=1/.test(location.search);
  function warmUp() {
    if (warm) return; warm = true;
    ['pointerdown', 'keydown', 'touchstart'].forEach(function (ev) { document.removeEventListener(ev, warmUp, true); });
    if (P) { var d = curSolverDef(); if (d && !d.oneShot && !solverCache[solverKey(d)]) getSolver(d); }
  }
  ['pointerdown', 'keydown', 'touchstart'].forEach(function (ev) { document.addEventListener(ev, warmUp, { capture: true, passive: true }); });
  // 空闲预热：页面加载完 8 秒后（Lighthouse / 首屏指标不受影响，真实用户点「求解」时多半已就绪）
  window.addEventListener('load', function () { setTimeout(function () { (window.requestIdleCallback || function (f) { f(); })(warmUp, { timeout: 4000 }); }, 8000); });
  function getSolver(def) {
    var key = solverKey(def);
    if (!solverCache[key]) {
      var t0 = performance.now(), c = solverCache[key] = new CL.SolverClient(P, def);
      if (!def.oneShot) {
        bind($('solverStatus'), def.initKey || 'solve.init');
        c.ready.then(function () {
          if (P.id + ':' + curSolverDef().id !== key || solverCache[key] !== c) return;
          var ms = c.initMs = Math.round(performance.now() - t0);
          if (!active) bind($('solverStatus'), 'solve.ready', { ms: ms });   // 求解进行中（首次点「求解」时才初始化）不覆盖进度文字
          document.body.dataset.solverReady = '1';
        }, function (e) { if (solverCache[key] === c && !c.cancelled) bind($('solverStatus'), function () { return t('solve.loadFail', { msg: errText(e) }); }); });
      }
    } else if (!def.oneShot && !document.body.dataset.solverReady) {
      // 切回已加载过的求解器（例如 金字塔 → 3×3）：直接显示「就绪」
      var c2 = solverCache[key];
      c2.ready.then(function () {
        if (P.id + ':' + curSolverDef().id !== key) return;
        bind($('solverStatus'), 'solve.ready', { ms: c2.initMs || 0 });
        document.body.dataset.solverReady = '1';
      }, function () {});
    }
    return solverCache[key];
  }
  ss.addEventListener('change', function () { document.body.dataset.solverReady = ''; prepareSolver(); });
  bind($('solverStatus'), 'solve.loading');

  // 进行中的求解：进度条 + 已用时间 + 「取消」（终止 Worker；迟到的结果被 solveSeq 丢弃）
  var active = null, solveSeq = 0;
  function progressUI(on, t0) {
    var box = $('solveProgress'), el = $('solveElapsed');
    clearInterval(progressUI.timer); box.hidden = !on;
    if (!on) return;
    var tick = function () { bind(el, 'solve.elapsed', { s: Math.floor((performance.now() - t0) / 1000) }); };
    tick(); progressUI.timer = setInterval(tick, 1000);
  }
  function cancelSolve() {
    var a = active; if (!a) return;
    active = null; solveSeq++;
    a.client.cancelled = true;
    try { a.client.dispose(); } catch (e) {}
    if (solverCache[a.key] === a.client) delete solverCache[a.key];
    progressUI(false); var btn = $('btnSolve'); btn.disabled = false; btn.classList.remove('loading');
    bind($('solverStatus'), 'solve.cancelled');
    document.body.dataset.solverReady = '1';
  }
  $('btnCancelSolve').addEventListener('click', cancelSolve);
  function solve() {
    var v = validateNow(true);
    if (!v.ok) { return Promise.resolve(null); }
    var btn = $('btnSolve'); btn.disabled = true; btn.classList.add('loading');
    var def = curSolverDef(), pid = P.id, seq = ++solveSeq;
    var start = editorState.slice(), client = getSolver(def);
    var t0 = performance.now();
    active = { client: client, key: solverKey(def), def: def };
    bind($('solverStatus'), def.oneShot ? 'solve.gcLoading' : 'solve.solving');
    progressUI(true, t0);
    client.onProgress = function (pr) {
      if (P.id !== pid || seq !== solveSeq) return;
      if (pr.stage === 'download') bind($('solverStatus'), 'solve.gcLoading');
      else if (pr.stage === 'prep') bind($('solverStatus'), 'solve.gcPrep');
      else if (pr.stage === 'search') bind($('solverStatus'), 'solve.gcSearch');
      else if (pr.best) bind($('solverStatus'), 'solve.gcProgress', { n: pr.best, s: Math.round((performance.now() - t0) / 1000) });
    };
    return client.solve(start).then(function (r) {
      if (P.id !== pid || seq !== solveSeq) return null;
      solution = r.moves; solMeta = { metric: def.metric, optimal: r.optimal };
      if (!P.isSolved(P.apply(start, solution))) { var ie = new Error('internal'); ie.i18n = { k: 'solve.internal', p: {} }; throw ie; }
      $('solutionBox').hidden = false;
      var n = solution.length;
      bind($('solCount'), function () { return n ? t('solve.count', { n: n }) + t(r.label || (r.optimal ? 'solve.optimal' : 'solve.nearOptimal')) : t('solve.alreadySolved'); });
      renderSolution();
      bind($('solverStatus'), function () {
        return t('solve.done', { ms: r.ms }) + (r.firstLength && r.firstLength > n ? t('solve.doneShortened', { first: r.firstLength, n: n }) : '') + (r.optimal && P.id === 'cube3' ? t('solve.doneOptimal') : '') + (r.note ? t(r.note.k, r.note.p) : '');
      });
      autoSpeed(n);
      player.load({ start: start, moves: solution, phases: solution.map(function () { return 'solve'; }) });
      document.querySelector('.stage').scrollIntoView({ behavior: 'smooth', block: 'start' });
      return solution;
    }).catch(function (e) {
      if (P.id !== pid || seq !== solveSeq) return;
      showSolveError(e);
      bind($('solverStatus'), 'solve.failed');
    }).finally(function () {
      if (def.oneShot) { client.dispose(); if (solverCache[pid + ':' + def.id] === client) delete solverCache[pid + ':' + def.id]; }
      if (seq !== solveSeq) return;   // 已取消 / 已被新的求解取代
      active = null; progressUI(false);
      btn.disabled = false; btn.classList.remove('loading');
    });
  }
  $('btnSolve').addEventListener('click', solve);
  /** 长解法自动提速（用户手动改过速度就不再干预） */
  function autoSpeed(n) {
    if (speedTouched) return;
    var sp = n > 700 ? 32 : n > 300 ? 16 : n > 120 ? 8 : n > 60 ? 2.5 : 1;
    $('speed').value = String(sp); player.speed = sp;
  }

  $('btnDemo').addEventListener('click', function () {
    if (!solution) return;
    var scr = lastScramble || P.inverse(solution);
    var start = P.apply(editorState, P.inverse(scr));
    player.load({ start: start, moves: scr.concat(solution), phases: scr.map(function () { return 'scramble'; }).concat(solution.map(function () { return 'solve'; })) });
    player.play();
  });
  $('btnCopy').addEventListener('click', function () {
    var txt = $('solText').textContent;
    (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(function () { bind($('btnCopy'), 'solve.copied'); }, function () { bind($('btnCopy'), 'solve.copyFail'); });
    setTimeout(function () { bind($('btnCopy'), 'solve.copy'); }, 1400);
  });

  // 输入按钮
  function scramble() {
    if (P.randomState) { setEditor(P.randomState()); $('formula').value = ''; return; }   // 异形：均匀随机状态
    var scr = P.randomScramble(); setEditor(P.apply(P.solvedState(), scr), scr);
    $('formula').value = P.format(scr);
  }
  $('btnScramble').addEventListener('click', scramble);
  $('btnReset').addEventListener('click', function () { setEditor(P.solvedState()); });
  $('btnClear').addEventListener('click', function () { editor.clear(); });
  $('btnFormulaRandom').addEventListener('click', function () { $('formula').value = P.format(P.randomScramble()); });
  $('btnApplyFormula').addEventListener('click', function () {
    var m = $('formulaMsg');
    try {
      var toks = P.parse($('formula').value);
      setEditor(P.apply(P.solvedState(), toks), toks);
      m.className = 'formula-msg ok'; bind(m, 'formula.applied', { n: toks.length });
    } catch (e) { m.className = 'formula-msg bad'; bind(m, function () { return errText(e); }); }
  });

  // 选项卡
  document.querySelectorAll('.tab').forEach(function (tb) {
    tb.addEventListener('click', function () {
      document.querySelectorAll('.tab').forEach(function (x) { x.classList.toggle('active', x === tb); });
      document.querySelectorAll('.tabpane').forEach(function (p) { p.classList.toggle('active', p.dataset.pane === tb.dataset.tab); });
      if (tb.dataset.tab !== 'scan' && scan.stream) scan.stopCamera();
    });
  });

  // 符号说明 / 提示（随阶数变化）
  function renderNotation() { $('notationTable').innerHTML = P.notation.map(function (r) { return '<tr><th dir="ltr">' + esc(r[0]) + '</th><td>' + esc(r[1]) + '</td></tr>'; }).join(''); }
  function renderHints() {
    var n = P.n || 3;
    if (P.hints) {
      bind($('graphHint'), P.hints.graph); bind($('notationHint'), P.hints.notation);
      var H = P.hints, noScan = !P.cameraPlan;
      bind($('paintHint'), function () { return t(H.paint) + (noScan ? ' ' + t('scan.unsupported') : ''); }); bind($('formulaHint'), H.formula);
      return;
    }
    if (n === 3) { bind($('graphHint'), 'stage.graphHint'); bind($('notationHint'), 'notation.hint'); }
    else { bind($('graphHint'), function () { return t('stage.graphHintN', { k: 3 * n }) + (n >= 4 ? ' · ' + t('stage.zoomHint') : ''); }); bind($('notationHint'), function () { return t('notation.hintN', { side: 4 * n }); }); }
    bind($('paintHint'), n % 2 === 1 ? 'paint.hint' : 'paint.hintEven');
    bind($('formulaHint'), n === 3 ? 'formula.hint' : 'formula.hintN');
  }

  // ---------------------------------------------------------------- 播放器 UI
  var movesEl = $('moves'), tl = $('timeline');
  function onPlayer(pl) {
    var n = pl.length(), k = pl.index;
    if (pl.tl !== lastTl || n !== lastLen) {
      lastTl = pl.tl; lastK = -1; lastLen = n;
      movesEl.innerHTML = '';
      var frag = document.createDocumentFragment();
      pl.tl.moves.forEach(function (tk, i) {
        var b = document.createElement('button');
        b.type = 'button'; b.className = 'mv ' + ((pl.tl.phases && pl.tl.phases[i]) || 'solve'); b.textContent = mv(vt(tk));
        b.dataset.i = i;
        frag.appendChild(b);
      });
      movesEl.appendChild(frag);
      if (!n) { var em = document.createElement('span'); em.className = 'empty'; em.dir = I.dir(); em.textContent = t('player.movesEmpty'); movesEl.appendChild(em); }
      tl.max = n;
    }
    tl.value = k;
    tl.style.setProperty('--p', n ? (k / n * 100) + '%' : '0%');
    $('counter').textContent = nf(k) + ' / ' + nf(n);
    // 只更新变化的按钮（1000+ 步时逐个刷新太慢）
    var kids = movesEl.children;
    if (lastK < 0) { for (var i = 0; i < kids.length; i++) { kids[i].classList.toggle('cur', i === k - 1); kids[i].classList.toggle('past', i < k - 1); } }
    else {
      var lo = Math.max(0, Math.min(lastK, k) - 2), hi = Math.min(kids.length - 1, Math.max(lastK, k) + 1);
      for (var j = lo; j <= hi; j++) { kids[j].classList.toggle('cur', j === k - 1); kids[j].classList.toggle('past', j < k - 1); }
    }
    lastK = k;
    var cur = kids[k - 1];
    if (cur && cur.classList.contains('mv') && (pl.playing || mode === 'play')) { var r = cur.offsetLeft - movesEl.clientWidth / 2; movesEl.scrollTo({ left: r, behavior: n > 200 ? 'auto' : 'smooth' }); }
    var tok = k > 0 ? pl.tl.moves[k - 1] : null;
    $('nowMove').textContent = tok ? mv(vt(tok)) : '—';
    $('nowDesc').textContent = tok ? P.describeMove(vt(tok)) : t(n ? 'player.ready' : 'player.empty');
    var phase = pl.tl.phases && tok ? pl.tl.phases[k - 1] : null;
    $('nowMeta').textContent = n ? (phase === 'scramble' ? t('player.phaseScramble') : phase === 'solve' ? t('player.phaseSolve') : '') + (tok ? ' · ' + t('player.stepMeta', { k: k }) : '') : '';
    $('solvedBadge').hidden = !(P.isSolved(pl.state()) && editorState.every(Boolean));
    document.body.classList.toggle('is-playing', pl.playing);
    view.setPlaying(pl.playing);
    if (wasPlaying && !pl.playing && n && k === n && P.isSolved(pl.state())) view.showcase();
    wasPlaying = pl.playing;
    $('btnPlay').setAttribute('aria-label', t(pl.playing ? 'player.pause' : 'player.play'));
  }
  movesEl.addEventListener('click', function (e) { if (mode === 'play') return; var b = e.target.closest('.mv'); if (b) player.seek(+b.dataset.i + 1); });
  movesEl.addEventListener('mouseover', function (e) {
    var b = e.target.closest('.mv'); if (!b || b.title) return;
    var i = +b.dataset.i, tk = player.tl.moves[i]; if (tk) b.title = t('player.moveTip', { k: i + 1, desc: P.describeMove(vt(tk)) });
  });
  $('btnPlay').addEventListener('click', function () { player.toggle(); });
  $('btnNext').addEventListener('click', function () { player.pause(); player.next(); });
  $('btnPrev').addEventListener('click', function () { player.pause(); player.prev(); });
  $('btnStart').addEventListener('click', function () { player.seek(0); });
  $('btnEnd').addEventListener('click', function () { player.seek(player.length()); });
  tl.addEventListener('input', function () { player.seek(+tl.value); });
  // 声音控件：状态保存在 localStorage
  var sfxT = $('sfxToggle'), musT = $('musicToggle'), volR = $('volume');
  function syncAudioUI() {
    sfxT.checked = audio.sfxOn; musT.checked = audio.musicOn; volR.value = Math.round(audio.volume * 100);
    [sfxT, musT, volR].forEach(function (el) { el.disabled = !audio.supported; });
    if (!audio.supported) bind($('volume').closest('.audio-ctl'), 'audio.unsupported', null, 'title');
  }
  audio.on(syncAudioUI); syncAudioUI();
  sfxT.addEventListener('change', function () { audio.setSfx(sfxT.checked); });
  musT.addEventListener('change', function () { audio.setMusic(musT.checked); });
  volR.addEventListener('input', function () { audio.setVolume(volR.value / 100); });
  $('autoRotate').addEventListener('change', function () { view.setAutoRotate($('autoRotate').checked); });
  // 配色方案（西方 / 日本：蓝黄互换）+ 贴纸上的颜色字母
  var schemeSel = $('colorScheme'), lettersCb = $('colorLetters');
  function syncSchemeUI() { if (schemeSel) schemeSel.closest('label').hidden = !CL.schemeApplies(P); }
  function applyLetters(on) {
    document.body.classList.toggle('letters-on', on);
    if (editor && editor.setLetters) editor.setLetters(on);
    if (view && view.setLetters) view.setLetters(on);
  }
  if (schemeSel) {
    schemeSel.value = CL.getScheme();
    schemeSel.addEventListener('change', function () {
      CL.setScheme(schemeSel.value); CL.applyScheme(P);
      editor.refreshColors(); player._emit(); setHold(hold.id); relabelSelects(); validateNow(false);
      if (scan && scan.relabel) scan.relabel();
    });
  }
  if (lettersCb) {
    lettersCb.checked = CL.NetEditor.lettersOn();
    lettersCb.addEventListener('change', function () { try { localStorage.setItem('cubelab.letters', lettersCb.checked ? '1' : '0'); } catch (e) {} applyLetters(lettersCb.checked); });
  }
  $('speed').addEventListener('change', function () { speedTouched = true; player.speed = +$('speed').value; });
  document.addEventListener('keydown', function (e) {
    if (/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
    if (mode === 'play') return playKey(e);
    if (e.key === ' ') { e.preventDefault(); player.toggle(); }
    else if (e.key === 'ArrowRight') { player.pause(); player.next(); }
    else if (e.key === 'ArrowLeft') { player.pause(); player.prev(); }
  });

  // ---------------------------------------------------------------- 「自己玩」模式
  var PL = CL.play, play = null, prefix = { depth: '', wide: false }, rafId = 0;
  var INSPECT_MS = 15000;
  function syncModeUI() {
    document.body.classList.toggle('mode-play', mode === 'play');
    document.querySelectorAll('.mode-btn').forEach(function (b) { var on = b.dataset.mode === mode; b.classList.toggle('active', on); b.setAttribute('aria-selected', on ? 'true' : 'false'); });
    $('playPanel').hidden = mode !== 'play'; $('playExtra').hidden = mode !== 'play';
  }
  function setMode(m) {
    if (m === mode) return;
    if (mode === 'play') leavePlay();
    mode = m; syncModeUI();
    if (m === 'play') enterPlay();
  }
  document.querySelectorAll('.mode-btn').forEach(function (b) { b.addEventListener('click', function () { setMode(b.dataset.mode); }); });
  function playState() { return player.states[player.states.length - 1]; }
  function enterPlay() {
    player.cancel();
    var cur = player.state(), st = cur && cur.every(Boolean) && P.validate(cur).ok ? cur.slice() : P.solvedState();
    startPlay(st, false);
    view.setPlayMode(true, function (tok) { doTurn(tok); });
    renderPlayHint();
  }
  function leavePlay() {
    stopLoop(); view.setPlayMode(false);
    var st = playState().slice(); player.cancel();
    if (play && play.tstate === 'run') play.tstate = 'idle';
    setEditor(st);
  }
  function startPlay(st, scrambled, scrText) {
    play = { redo: [], scrambled: scrambled, tstate: scrambled ? ($('inspectToggle').checked ? 'inspect' : 'ready') : 'idle', t0: 0, ins0: performance.now(), penalty: 0, result: null, assisted: false };
    player.load({ start: st.slice(), moves: [], phases: [] });
    $('playScr').textContent = scrText || '';
    $('playMsg').textContent = '';
    loop(); updatePlayUI();
  }
  function playScramble() {
    var st, txt;
    var rs = PL.randomState(P);
    if (rs) { st = rs; txt = t('play.scrambleState'); }
    else { var scr = P.randomScramble(); st = P.apply(P.solvedState(), scr); txt = t('play.scrambleMoves', { n: scr.length }) + ' · ' + P.format(scr.map(vt)); }
    startPlay(st, true, txt);
    if (!P.isSolved(st)) audio.capture(false);
  }
  function doTurn(tok, fromRedo) {
    if (mode !== 'play' || !P.moves[tok]) return;
    if (!fromRedo) play.redo = [];
    var now = performance.now();
    if (!PL.isRotation(P, tok) && (play.tstate === 'ready' || play.tstate === 'inspect')) {
      var ins = now - play.ins0;
      play.penalty = play.tstate === 'inspect' ? (ins > INSPECT_MS + 2000 ? 'DNF' : ins > INSPECT_MS ? 2000 : 0) : 0;
      play.tstate = 'run'; play.t0 = now; loop();
    }
    player.pushMove(tok, 170);
    if (play.tstate === 'run' && P.isSolved(playState())) finish(now);
    else if (play.tstate === 'idle' && P.isSolved(playState()) && player.length() && !P.isSolved(player.states[0])) player.idle().then(function () { celebrate(false); });
    updatePlayUI();
  }
  function finish(now) {
    play.tstate = 'done'; stopLoop();
    var raw = now - play.t0;
    play.result = play.penalty === 'DNF' ? null : raw + play.penalty;
    play.newBest = play.result != null && !play.assisted && PL.saveBest(P.id, play.result);
    updatePlayUI();
    player.idle().then(function () { celebrate(true); });
  }
  function celebrate(timed) {
    if (mode !== 'play') return;
    audio.solved();
    var st = document.querySelector('.stage'); st.classList.remove('celebrate'); void st.offsetWidth; st.classList.add('celebrate');
    if (timed) { var tm = $('playTimer'); tm.classList.remove('celebrate'); void tm.offsetWidth; tm.classList.add('celebrate'); }
    view.showcase(300);
    setTimeout(function () { st.classList.remove('celebrate'); }, 1700);
  }
  function undo() {
    if (mode !== 'play') return;
    var tok = player.popMove(120); if (tok) { play.redo.push(tok); updatePlayUI(); }
  }
  function redo() { if (mode !== 'play' || !play.redo.length) return; doTurn(play.redo.pop(), true); }
  function loop() {
    if (rafId) return;
    var tick = function () {
      rafId = 0;
      if (!play || mode !== 'play') return;
      renderTimer();
      if (play.tstate === 'run' || play.tstate === 'inspect') rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
  }
  function stopLoop() { if (rafId) cancelAnimationFrame(rafId); rafId = 0; }
  function renderTimer() {
    var el = $('playTimer'), now = performance.now(), cls = play.tstate, txt;
    if (play.tstate === 'inspect') {
      var left = INSPECT_MS - (now - play.ins0);
      txt = left > 0 ? String(Math.ceil(left / 1000)) : left > -2000 ? '+2' : 'DNF';
      if (left <= -2000) cls = 'inspect dnf';
    } else if (play.tstate === 'run') txt = PL.formatTime(now - play.t0);
    else if (play.tstate === 'done') { txt = play.penalty === 'DNF' ? 'DNF' : PL.formatTime(play.result) + (play.penalty ? '+' : ''); if (play.penalty === 'DNF') cls = 'done dnf'; }
    else txt = PL.formatTime(0);
    el.textContent = txt; el.className = 'timer ' + cls;
  }
  function updatePlayUI() {
    if (!play) return;
    renderTimer();
    var n = PL.countMoves(P, player.tl.moves), met = PL.metricFor(P), me = $('playMetric');
    $('playMoves').textContent = nf(n);
    bind($('playMoves'), function () { return nf(n); });
    me.textContent = met; bind(me, metricKey(met), null, 'title');
    var best = PL.getBest(P.id);
    bind($('playBest'), function () { return best != null ? t('play.best', { t: PL.formatTime(best) }) : t('play.bestNone'); });
    bind($('playStatus'), function () {
      switch (play.tstate) {
        case 'idle': return t(P.isSolved(playState()) && player.length() ? 'play.status.solvedFree' : 'play.status.idle');
        case 'ready': return t('play.status.ready');
        case 'inspect': return t('play.status.inspect');
        case 'run': return t('play.status.run');
        case 'done': return play.assisted ? t('play.status.assisted') : play.penalty === 'DNF' ? t('play.status.dnf') :
          t('play.status.done', { t: PL.formatTime(play.result), n: n }) + (play.penalty ? ' ' + t('play.status.plus2') : '') + (play.newBest ? ' ' + t('play.status.newBest') : '');
      }
      return '';
    });
    $('btnUndo').disabled = !player.length(); $('btnRedo').disabled = !play.redo.length;
  }
  function renderPlayHint() {
    var n = P.n || 3;
    if (P.hints) { bind($('playHint'), P.hints.play); return; }
    bind($('playHint'), function () { return t(n >= 4 ? 'play.hintN' : n === 3 ? 'play.hint3' : 'play.hint2'); });
  }
  function applyViewTokens(str) {
    var m = $('playMsg'); m.className = 'play-msg';
    try {
      var toks = P.parse(str).map(function (tk) { return (hold.fromView && hold.fromView[tk]) || tk; });
      toks.forEach(function (tk) { doTurn(tk); });
      return toks;
    } catch (e) { m.className = 'play-msg bad'; bind(m, function () { return errText(e); }); return null; }
  }
  function playKey(e) {
    if ((e.ctrlKey || e.metaKey) && !e.altKey) {
      var k = e.key.toLowerCase();
      if (k === 'z' && !e.shiftKey) { e.preventDefault(); undo(); } else if (k === 'y' || (k === 'z' && e.shiftKey)) { e.preventDefault(); redo(); }
      return;
    }
    if (e.altKey) return;
    if (e.key === 'Backspace') { e.preventDefault(); undo(); return; }
    if (e.key === 'Escape') { prefix = { depth: '', wide: false }; showPrefix(); return; }
    var r = PL.keyToken(e.key, e.shiftKey, prefix, P);
    if (!r) return;
    e.preventDefault();
    if (r.prefix) { prefix = r.prefix; showPrefix(); return; }
    prefix = { depth: '', wide: false }; showPrefix();
    var m = $('playMsg'); m.className = 'play-msg';
    try {
      var tk = P.parse(r.tok)[0]; tk = (hold.fromView && hold.fromView[tk]) || tk;
      doTurn(tk);
    } catch (er) { m.className = 'play-msg bad'; bind(m, 'play.badKey', { tok: r.tok }); }
  }
  function showPrefix() {
    var p = (prefix.depth || '') + (prefix.wide ? '·w' : '') + (prefix.tip ? 'tip' : '') + (prefix.dbl ? '2' : ''), m = $('playMsg');
    m.className = 'play-msg'; if (p) bind(m, 'play.keyBuf', { p: p }); else m.textContent = '';
  }
  $('btnPlayScramble').addEventListener('click', playScramble);
  $('btnUndo').addEventListener('click', undo);
  $('btnRedo').addEventListener('click', redo);
  $('btnPlayReset').addEventListener('click', function () { startPlay(P.solvedState(), false); });
  $('btnPlayApply').addEventListener('click', function () { if (applyViewTokens($('playFormula').value)) $('playFormula').value = ''; });
  $('playFormula').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); $('btnPlayApply').click(); } });
  $('btnPlaySolve').addEventListener('click', function () {
    if (play && play.tstate !== 'done' && play.tstate !== 'idle') { play.assisted = true; play.tstate = 'done'; play.result = null; }
    setMode('solve'); solve();
  });
  $('inspectToggle').addEventListener('change', function () { try { localStorage.setItem('cubelab.inspect', $('inspectToggle').checked ? '1' : '0'); } catch (e) {} });
  try { $('inspectToggle').checked = localStorage.getItem('cubelab.inspect') === '1'; } catch (e) {}
  I.onChange(function () { if (play && mode === 'play') updatePlayUI(); });

  // 切换谜题
  var switchSeq = 0;
  function switchPuzzle(id, noNav) {
    var my = ++switchSeq;
    document.body.dataset.solverReady = ''; TB.setPuzzle(id);
    return CL.loadPuzzle(id).then(function () {
      if (my !== switchSeq) return;
      mount(id);
      if (noNav) return;
      // SEO pages: the address becomes the puzzle's own page (/fr/5x5-cube-solver/), see js/seo-nav.js
      if (CL.seoNav) { CL.seoNav.go(P.id); return; }
      var u = new URL(location.href);
      if (P.n) { u.searchParams.set('n', String(P.n)); u.searchParams.delete('puzzle'); } else { u.searchParams.set('puzzle', P.id); u.searchParams.delete('n'); }
      history.replaceState(null, '', u);
    }, function (e) { bind($('solverStatus'), function () { return t('solve.loadFail', { msg: errText(e) }); }); if (P) TB.setPuzzle(P.id); });
  }

  // ---------------------------------------------------------------- 分享（位置写在 URL 片段里，不发给服务器）
  var SC = CL.shareCode;
  function secs(ms) { var f = PL.formatTime(ms); return /:/.test(f) ? f : f + 's'; }   // 23.41s · 1:02.33
  /** what the share link carries: solve mode → the entered position; free play → the scramble (+ time once solved) */
  function shareState() {
    if (!P) return null;
    var st, m = mode, tm = null, tt = null;
    if (mode === 'play' && play) {
      if (play.scrambled) {
        st = player.states[0];
        if (play.tstate === 'done' && play.result != null && !play.assisted) { tm = play.result; tt = secs(play.result); }
      } else { st = playState(); m = P.isSolved(st) ? 'solve' : 'play'; }
    } else st = editorState;
    if (!st || P.isSolved(st) && !st.some(function (c) { return c == null; })) return { p: P.id, s: null };
    try { return { p: P.id, s: SC.encode(P, st), m: m, t: tm, tText: tt }; } catch (e) { return { p: P.id, s: null }; }
  }
  function snapshot() {
    return new Promise(function (res, rej) {
      var url = view && view.snapshot && view.snapshot(); if (!url) return rej(new Error('no view'));
      var img = new Image();
      img.onload = function () {
        var c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
        var g = c.getContext('2d'); g.fillStyle = '#FBF9F5'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0);
        g.font = Math.max(12, Math.round(c.width / 48)) + 'px system-ui, sans-serif'; g.fillStyle = '#6b6b6b'; g.textAlign = 'right';
        g.fillText('cube-solver.org', c.width - 12, c.height - 12);
        c.toBlob(function (b) { b ? res(b) : rej(new Error('toBlob')); }, 'image/png');
      };
      img.onerror = rej; img.src = url;
    });
  }
  function clearHash() { if (location.hash) history.replaceState(history.state, '', location.pathname + location.search); }
  /** apply a parsed share fragment; invalid codes are ignored with a notice */
  function applyShare(h) {
    if (!h) return;
    var bad = function () { clearHash(); TB.toast(t('share.bad')); };
    if (!CL.puzzleMeta().some(function (m) { return m.id === h.p; })) return bad();
    // decode against the target puzzle first: a damaged link never switches the puzzle
    CL.loadPuzzle(h.p).then(function () {
      var Q = CL.getPuzzle(h.p), st = SC.decode(Q, h.s);
      if (!st) return bad();
      if (h.m === 'play' && (st.some(function (c) { return c == null; }) || !Q.validate(st).ok)) return bad();
      var go = function () {
        if (!P || P.id !== h.p) return;
        if (h.m === 'play') {
          if (mode !== 'play') setMode('play');
          startPlay(st, true, t('share.playScr'));
          var m = $('playMsg'); m.className = 'play-msg';
          if (h.t != null) bind(m, 'share.loadedTime', { t: secs(h.t) }); else bind(m, 'share.loadedPlay');
        } else {
          if (mode === 'play') setMode('solve');
          setEditor(st); $('formula').value = '';
          TB.toast(t('share.loaded'));
        }
        clearHash();
      };
      if (P && P.id === h.p) go(); else switchPuzzle(h.p).then(go);
    }, bad);
  }
  window.addEventListener('hashchange', function () { var h = SC.parseHash(location.hash); if (h) applyShare(h); });
  TB.init({ onPuzzle: function (id) { switchPuzzle(id); }, onLang: function (code) { I.setLang(code); }, shareState: shareState, snapshot: snapshot });

  // 切换语言：静态文字由 I.apply() 处理；这里重画动态部分（选项、校验、播放器、记号表、解法）
  I.onChange(function () {
    relabelSelects(); renderNotation();
    if (lastErr) showSolveError(lastErr); else validateNow(lastLoud);
    renderSolution(); lastTl = null; player._emit();
    if (graph.svg) graph.svg.setAttribute('aria-label', t('graph.aria'));
  });

  var playerHook = function (pl) { onPlayer(pl); };
  var mount0 = mount;
  mount = function (id) { mount0(id); player.on(playerHook); lastTl = null; player._emit(); if (mode === 'play') enterPlay(); };
  if (/[?&]mode=play/.test(location.search)) { mode = 'play'; syncModeUI(); }
  mount(first);
  if (share0) applyShare(share0);
  else if (location.hash && /(^#|&)s=/.test(location.hash)) { clearHash(); TB.toast(t('share.bad')); }
  // 离线支持：dist 构建给 <html> 加 data-sw，本地源码服务器不注册 Service Worker
  if ('serviceWorker' in navigator && document.documentElement.hasAttribute('data-sw')) {
    var regSW = function () { navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(function () {}); };
    if (document.readyState === 'complete') setTimeout(regSW, 0); else window.addEventListener('load', regSW);
  }
  if (CL.seoNav && CL.seoNav.start) CL.seoNav.start();
  else document.addEventListener('DOMContentLoaded', function () { if (CL.seoNav && CL.seoNav.start) CL.seoNav.start(); });

  // 供测试 / 控制台调试（getter：切换谜题后仍指向当前对象）
  window.app = {
    i18n: I, audio: audio, setHold: function (id) { setHold(id); }, hold: function () { return hold; }, vt: vt, solve: solve, setEditor: setEditor,
    mount: function (id) { return switchPuzzle(id, true); }, getState: function () { return editorState.slice(); },
    setMode: function (m) { setMode(m); }, mode: function () { return mode; }, shareState: function () { return shareState(); },
    play: { turn: function (tok) { doTurn(tok); }, history: function () { return player.tl.moves.slice(); }, state: function () { return playState(); },
      undo: function () { undo(); }, redo: function () { redo(); }, scramble: function () { playScramble(); }, timer: function () { return play && { state: play.tstate, ms: play.result, penalty: play.penalty }; },
      idle: function () { return player.idle(); }, start: function (st, scrambled) { startPlay(st, !!scrambled); } }
  };
  ['P', 'editor', 'player', 'graph', 'view', 'scan'].forEach(function (k) {
    Object.defineProperty(window.app, k, { get: function () { return { P: P, editor: editor, player: player, graph: graph, view: view, scan: scan }[k]; } });
  });
  }
})();
