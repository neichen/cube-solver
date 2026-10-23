"""N×N 合成单面照片（上传照片识别路径）。用法: python3 make_face_images_nxn.py state.json outdir n light seed
light: normal | hard | warm | dim —— 整体偏色、每面亮度不同、光照梯度、噪声、反光、模糊、轻微旋转"""
import json, sys, random
from PIL import Image, ImageDraw, ImageFilter
REAL = {'W': (214, 220, 226), 'Y': (232, 205, 30), 'G': (40, 150, 70), 'B': (35, 75, 160), 'R': (175, 30, 45), 'O': (235, 105, 35)}
L = {'normal': dict(tint=.06, gain=(.85, 1.1), grad=.12, noise=10, rot=1.5),
     'hard': dict(tint=.14, gain=(.55, 1.2), grad=.3, noise=16, rot=3),
     'warm': dict(tint=.03, warm=(1.12, 1.0, .72), gain=(.65, 1.15), grad=.2, noise=12, rot=2),
     'dim': dict(tint=.06, gain=(.38, .6), grad=.2, noise=10, rot=2)}
data = json.load(open(sys.argv[1])); out = sys.argv[2]; n = int(sys.argv[3]); c = L[sys.argv[4]]; random.seed(int(sys.argv[5]))
tint = [1 + random.uniform(-c['tint'], c['tint']) * 1 for _ in range(3)]
if 'warm' in c: tint = [t * w for t, w in zip(tint, c['warm'])]
for step in data['plan']:
    S = 900; img = Image.new('RGB', (1200, S), (70, 62, 55)); d = ImageDraw.Draw(img)
    face = S * 0.72; x0 = (1200 - face) / 2; y0 = (S - face) / 2; cell = face / n
    g = random.uniform(*c['gain']); gx = random.uniform(-c['grad'], c['grad']); gy = random.uniform(-c['grad'], c['grad'])
    d.rounded_rectangle([x0 - 8, y0 - 8, x0 + face + 8, y0 + face + 8], 24, fill=(18, 18, 18))
    for k, si in enumerate(step['cells']):
        r, cc = divmod(k, n); col = REAL[data['state'][si]]
        sh = g * (1 + gx * (cc / max(1, n - 1) - .5) * 2 + gy * (r / max(1, n - 1) - .5) * 2)
        col = tuple(max(0, min(255, int(v * t * sh + random.gauss(0, 4)))) for v, t in zip(col, tint))
        m = cell * 0.08
        d.rounded_rectangle([x0 + cc * cell + m, y0 + r * cell + m, x0 + (cc + 1) * cell - m, y0 + (r + 1) * cell - m], max(2, int(cell * .1)), fill=col)
        if random.random() < .5:
            d.ellipse([x0 + cc * cell + cell * .18, y0 + r * cell + cell * .14, x0 + cc * cell + cell * .34, y0 + r * cell + cell * .24], fill=(250, 250, 250))
    img = img.rotate(random.uniform(-c['rot'], c['rot']), fillcolor=(70, 62, 55)).filter(ImageFilter.GaussianBlur(1.2))
    px = img.load()
    for _ in range(40000):
        x, y = random.randrange(1200), random.randrange(S); p = px[x, y]; e = random.randint(-c['noise'], c['noise'])
        px[x, y] = tuple(max(0, min(255, v + e)) for v in p)
    img.save(f"{out}/face_{step['face']}.jpg", quality=88)
print('ok')
