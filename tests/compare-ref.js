// 生成与参考视频帧的并排对比图。用法：node tests/compare-ref.js（需本地服务 8765 + playwright + ffmpeg + python3/PIL/numpy）
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs'), { execSync } = require('child_process');
const ROOT = path.join(__dirname, '..'), OUT = path.join(ROOT, 'screenshots'), REF = path.join(ROOT, 'ref'), TMP = require('path').join(require('os').tmpdir(), 'cmp');
fs.mkdirSync(TMP, { recursive: true });
// 参考视频中两次典型转动（60fps 运动能量分段实测）：
//   A: 6.12–6.60 s 红色节点沿上方中圆的「上方弧」从左到右（f07 所在转动；参考 3D 视图里转的是中间横层 E）
//   B: 1.85–2.48 s 红色节点沿左侧大圆跨越 180° 空弧到下方（参考视频里同样会绕到花瓣外缘）
const PH = [0, 0.2, 0.4, 0.6, 0.8, 1];
const MOVES = [
  { key: 'A', t0: 6.12, t1: 6.60, tok: 'E', label: '中层 E（参考 3D 中转的是中间横层）：红沿中圆上方弧 → 蓝（f07 所在转动）' },
  { key: 'B', t0: 1.85, t1: 2.48, tok: 'B', label: '左侧大圆：红 → 白（跨 180° 空弧，参考同样绕到外缘）' }
];
const CROP = 'crop=860:900:1150:250';   // 参考视频 2160×1484 中图视图所在区域
for (const m of MOVES) PH.forEach((ph, k) => execSync(`ffmpeg -v error -y -ss ${(m.t0 + ph * (m.t1 - m.t0)).toFixed(3)} -i ${REF}/reference.mp4 -frames:v 1 -vf "${CROP},scale=430:450" ${TMP}/ref_${m.key}${k}.png`));
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 1400 } });
  p.on('pageerror', e => console.log('ERR', e.message));
  await p.goto('http://localhost:8765/?start=solved&hold=yellowTop'); await p.waitForFunction(() => document.body.dataset.solverReady === '1', null, { timeout: 30000 });
  await p.evaluate(() => { document.getElementById('autoRotate').click(); });   // 截图时关闭自动旋转，保证确定性
  await p.waitForTimeout(300);
  await p.locator('.views').screenshot({ path: TMP + '/ours_solved.png' });
  // 冻结在某转动的时间相位 t（按播放器的 easeInOutQuad 缓动）
  const freeze = (startExpr, tok, t) => p.evaluate(([se, tok, t]) => {
    const P = app.P, start = P.apply(P.solvedState(), se);
    app.player.load({ start, moves: [tok] });
    const e = CubeLab.ease(t); [app.view, app.graph].forEach(v => v.animate(tok, e, start, t));
  }, [startExpr, tok, t]);
  // 转动中：与 f07 同一转动 E（中间横层；红色沿中圆上方弧移到蓝色区）；f07 ≈ 该转动 80–85% 处（逐帧匹配 6.57 s）
  await freeze("R' F", 'E', 0.8); await p.waitForTimeout(250);
  await p.locator('.views').screenshot({ path: TMP + '/ours_mid.png' });
  await freeze("R U F' L2 D B' R2 U' F2 L D2 B", 'R', 0.35); await p.waitForTimeout(250);
  await p.locator('.views').screenshot({ path: TMP + '/ours_scr.png' });
  // 运动条带：从复原状态开始，红色节点的走向与参考一目了然
  for (const m of MOVES) for (let k = 0; k < PH.length; k++) {
    await freeze('', m.tok, PH[k]); await p.waitForTimeout(120);
    await p.locator('#graph').screenshot({ path: `${TMP}/ours_${m.key}${k}.png` });
  }
  await b.close();
  execSync(`python3 - <<'PY'
from PIL import Image, ImageDraw, ImageFont
import numpy as np
try: F = ImageFont.truetype('/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc', 22); S = ImageFont.truetype('/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc', 17)
except Exception: F = S = ImageFont.load_default()
def pair(ref, ours, out, title):
    a = Image.open(ref).convert('RGB'); b = Image.open(ours).convert('RGB')
    H = 600
    a = a.resize((int(a.width * H / a.height), H)); b = b.resize((int(b.width * H / b.height), H))
    W = Image.new('RGB', (a.width + b.width + 24, H + 44), (255, 255, 255))
    W.paste(a, (0, 44)); W.paste(b, (a.width + 24, 44))
    d = ImageDraw.Draw(W)
    d.text((10, 8), '参考视频 ' + title, fill=(0, 0, 0), font=F); d.text((a.width + 34, 8), '本项目', fill=(0, 0, 0), font=F)
    W.save(out)
pair('${REF}/f14.png', '${TMP}/ours_solved.png', '${OUT}/compare-solved.png', 'f14（已还原）')
pair('${REF}/f07.png', '${TMP}/ours_mid.png', '${OUT}/compare-mid.png', 'f07（转动中）｜本项目：同一转动 E（中间横层）的 80% 处')
pair('${REF}/f01.png', '${TMP}/ours_scr.png', '${OUT}/compare-scrambled.png', 'f01（打乱）')
BOX = {}
def autocrop(im, pre):
    # 两侧都裁到「图」的包围盒（同一行统一用第 0 帧的框，避免逐帧缩放跳动）
    if pre not in BOX:
        a = np.asarray(im).astype(int); bg = a[2, 2]
        m = np.abs(a - bg).max(2) > 38; ys, xs = np.where(m)
        x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max(); pw, ph = (x1 - x0) * 0.22, (y1 - y0) * 0.08
        BOX[pre] = (max(0, int(x0 - pw)), max(0, int(y0 - ph)), min(im.width, int(x1 + pw)), min(im.height, int(y1 + ph)))
    return im.crop(BOX[pre])
PH = ${JSON.stringify(PH)}; MOVES = ${JSON.stringify(MOVES.map(m => [m.key, m.label, m.tok]))}
cw, ch, lw = 300, 314, 150
W = Image.new('RGB', (lw + cw * len(PH), 40 + len(MOVES) * (2 * ch + 40)), (255, 255, 255)); d = ImageDraw.Draw(W)
for k, ph in enumerate(PH): d.text((lw + k * cw + cw // 2 - 30, 8), 't = %d%%' % round(ph * 100), fill=(0, 0, 0), font=F)
y = 40
for key, label, tok in MOVES:
    BOX.clear()
    d.text((10, y + 6), label, fill=(80, 80, 80), font=S); y += 34
    for pre, name in [('ref', '参考视频'), ('ours', '本项目 ' + tok)]:
        d.text((10, y + ch // 2 - 12), name, fill=(0, 0, 0), font=F)
        for k in range(len(PH)):
            im = autocrop(Image.open('${TMP}/%s_%s%d.png' % (pre, key, k)).convert('RGB'), pre)
            s = min(cw / im.width, ch / im.height); im = im.resize((int(im.width * s), int(im.height * s)))
            W.paste(im, (lw + k * cw + (cw - im.width) // 2, y + (ch - im.height) // 2))
        y += ch
    y += 6
W.save('${OUT}/compare-motion.png')
PY`);
  console.log('compare images written');
})();
