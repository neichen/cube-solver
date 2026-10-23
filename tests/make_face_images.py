"""生成合成的魔方单面照片（用于测试「上传照片」识别路径）。
用法: python3 make_face_images.py state.json outdir
state.json: {"state": [54 个颜色键], "plan": [{"face":"F","cells":[...]}...]}
"""
import json, sys, random
from PIL import Image, ImageDraw, ImageFilter
# 故意与界面调色板不同的「真实」颜色（模拟光照/相机偏色）
REAL = {'W': (214, 220, 226), 'Y': (232, 205, 30), 'G': (40, 150, 70), 'B': (35, 75, 160), 'R': (175, 30, 45), 'O': (235, 105, 35)}
data = json.load(open(sys.argv[1])); out = sys.argv[2]; random.seed(7)
for step in data['plan']:
    S = 900; img = Image.new('RGB', (1200, S), (70, 62, 55))  # 非正方形：测试居中裁切
    d = ImageDraw.Draw(img)
    face = S * 0.72; x0 = (1200 - face) / 2; y0 = (S - face) / 2; cell = face / 3
    d.rounded_rectangle([x0 - 8, y0 - 8, x0 + face + 8, y0 + face + 8], 24, fill=(18, 18, 18))
    for k, si in enumerate(step['cells']):
        r, c = divmod(k, 3); col = REAL[data['state'][si]]
        shade = 0.88 + 0.2 * (c / 2) - 0.06 * r  # 光照梯度
        col = tuple(max(0, min(255, int(v * shade + random.randint(-10, 10)))) for v in col)
        m = cell * 0.08
        d.rounded_rectangle([x0 + c * cell + m, y0 + r * cell + m, x0 + (c + 1) * cell - m, y0 + (r + 1) * cell - m], 18, fill=col)
        # 反光
        d.ellipse([x0 + c * cell + cell * .18, y0 + r * cell + cell * .14, x0 + c * cell + cell * .34, y0 + r * cell + cell * .24], fill=(250, 250, 250))
    img = img.filter(ImageFilter.GaussianBlur(1.2))
    px = img.load()
    for _ in range(40000):
        x, y = random.randrange(1200), random.randrange(S); p = px[x, y]; n = random.randint(-18, 18)
        px[x, y] = tuple(max(0, min(255, v + n)) for v in p)
    img.save(f"{out}/face_{step['face']}.jpg", quality=88)
print('ok')
