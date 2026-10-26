[English](DEVELOPMENT.md) · **简体中文** · [繁體中文](DEVELOPMENT.zh-Hant.md) · [日本語](DEVELOPMENT.ja.md) · [Español](DEVELOPMENT.es.md) · [Português](DEVELOPMENT.pt.md) · [Français](DEVELOPMENT.fr.md) · [Deutsch](DEVELOPMENT.de.md) · [Русский](DEVELOPMENT.ru.md) · [العربية](DEVELOPMENT.ar.md) · [Bahasa Indonesia](DEVELOPMENT.id.md) · [Bahasa Melayu](DEVELOPMENT.ms.md)

# 魔方求解实验室（CubeLab）· 开发说明

> 面向开发者的详细说明。英文版（[DEVELOPMENT.md](DEVELOPMENT.md)）为权威版本，本译文与其内容一致。项目介绍、运行、测试、部署、许可与隐私见 [README](../README.zh-Hans.md)。
> 文中提到的 `ref/`（参考视频帧）与 `screenshots/`（测试截图输出）不在仓库中；测试运行时会自动生成截图目录。

纯前端（静态 HTML/CSS/JS，无后端）的魔方求解器，核心特色是**置换图视图**：3D 模型旁边是一张「置换图」，每块贴纸都是一个节点。三阶魔方是**三组同心圆**（每组 3 个圆 = 一个轴向的 3 层，圆心构成正三角形，形成三重对称的花瓣图），54 个节点位于圆与圆的交点。每转一层，该层的圆加深，12 块侧面贴纸沿圆弧移动（带有取自贴纸颜色的渐隐拖尾），该面自身的 9 块贴纸在簇内绕中心旋转，与 3D 转动严格同步。打乱时颜色混杂，还原后变成 6 个紧凑的同色簇。

## 功能

| 模块 | 说明 |
| --- | --- |
| 手动涂色 | 展开图 + 调色板，点击 / 拖动连续涂色，色块计数，复原 / 随机 / 清空 |
| 公式输入 | 输入打乱公式（`R U R' U2 …`，支持中层 `M E S`），按 WCA 标准握法（白顶绿前）从复原状态应用 |
| 摄像头扫描 | `getUserMedia` 实时画面 + 网格叠加 + 实时识别预览；按引导顺序扫 6 面（含方向说明） |
| 照片上传 | 每一面都可以改为上传照片；「网格大小」滑块对齐贴纸 |
| 颜色识别 | 每格取内部中位数 RGB → CIE Lab。扫描中：按典型色实时预览（奇数阶用实测中心颜色校准）；**六面扫完后**（`js/core/color-cluster.js`）：全部 6n² 块做等容量 k-means（每色恰好 n² 块，亮度降权）→ 穷举 6! 种分配给各类定颜色名（奇数阶由中心决定）→ 按块轨道用匈牙利算法做约束解码（角块只能是 8 个合法有向颜色三元组、棱块 / 翼棱为合法颜色对、每个中心轨道每色定额）→ 重新估计颜色中心再解一次。偶数阶（无固定中心）同样适用 |
| 校验 | 本地化错误信息（12 种语言，Intl 复数规则）：未上色、中心重复、颜色数量、不存在的块、重复块、角块扭转、棱块翻转、奇偶（两块互换） |
| 求解 | 在 Web Worker 中运行。三阶：① 双向 BFS（≤ 8 步时给出可证明的最优解）② Kociemba 两阶段（cubejs）+ 时间预算内迭代缩短，通常 19–21 步。其它谜题见下文 |
| 播放器 | 播放 / 暂停 / 上一步 / 下一步 / 首尾 / 速度 / 可拖动时间线 / 点击任意一步跳转；键盘：空格、←、→；节奏与缓动按参考视频实测 |
| 声音 | Web Audio 实时合成（无音频文件）：真实感转动声、还原琶音、展示扫光、涂色轻点、拍摄提示音；可选程序生成的背景音乐；播放栏有「音效 / 音乐 / 音量」，设置保存在本地 |
| 握法 | 「黄顶绿前」（默认，与参考视频一致）/「白顶绿前（WCA）」：同时切换 3D 朝向与记号，U 永远是屏幕上的顶层 |
| 演示模式 | 「先打乱，再还原」：从复原状态播放打乱公式，再播放解法 |
| 响应式 | 手机上 3D 与图上下堆叠，控件自动换行 |
| 多语言 | 12 种语言（English、简体中文、繁體中文、Español、العربية、Português、Bahasa Indonesia、Bahasa Melayu、Français、日本語、Русский、Deutsch），阿拉伯语完整 RTL；右上角地球图标切换，选择保存在本地 |

## N×N（2×2 – 15×15）

顶部「谜题」菜单可选 2×2 … 15×15（也可用 `?n=7`）。所有视图（展开图涂色、公式、摄像头 N×N 网格、three.js 3D、三组 n 个同心圆的置换图 + 缩放 / 平移、播放器）都按阶数生成。

| 阶数 | 求解器 | 计数 | 实测（随机打乱，全部校验为已复原） |
| --- | --- | --- | --- |
| 2×2 | 自研最优解（完整距离表 3,674,160 态，BFS） | HTM | 100 次：平均 8.87 步，最多 10 步；建表 ≈ 0.3 s，求解 < 1 ms |
| 3×3 | BFS ≤ 8 步最优 + Kociemba 两阶段迭代缩短 | HTM | 通常 19–21 步 |
| 4×4 | 自研降阶法（见下）；也可选 gullicube | OBTM | 12 次（Node）：平均 56.8 步，最多 64；建表 ≈ 3.2 s；求解平均 6.9 s（最慢 16 s） |
| 5×5 – 15×15 | gullicube（T. Rokicki，MPL-2.0）编译为多线程 WebAssembly；质量模式 / 快速模式 | SSTM | 见下表 |

gullicube（Node，4 线程，与浏览器同一份构建；SSTM）：

| n | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 质量模式（--time 16，≈ 10–15 s，首次下载 ≈ 30 MB 表） | 119 | 169 | 257 | 329 | 448 | 563 | 678 | 833 | 981 | 1131 | 1408 |
| 快速模式（--fast，≈ 2–4 s，≈ 0.5 MB 表） | 168 | 281 | 402 | 571 | 695 | 972 | 1130 | 1495 | 1635 | 1950 | 2231 |

低内存设备（`navigator.deviceMemory` < 4 GB）和手机 / 平板在 n ≥ 5 时默认快速模式；求解器菜单随时切换质量 / 速度。多线程 WASM 需要跨源隔离：`deploy/_headers` 设置 COOP / COEP / CORP。

**统计**（`js/analytics.js`，只在 cube-solver.org 上运行）：Cloudflare Web Analytics 无 Cookie、对所有人加载；GA4 只在访客点「接受」后才注入 gtag.js（Consent Mode v2，只授予 `analytics_storage`）。提示栏只在同意地区显示：`deploy/worker.js` 对欧盟/欧洲经济区、英国、瑞士和未知国家（`request.cf.country` 缺失、`XX`、`T1`）设置 `<html data-consent="1">`，其他地区设置 `data-consent="0"`，此时 GA4 不显示提示栏直接加载（广告信号仍为拒绝），页脚链接仍可选择「拒绝」，会关闭 GA 并删除其 Cookie。ETag 带 `-c1`/`-c0` 后缀，两个变体永远不会互相重新验证。两者都返回 `Cross-Origin-Resource-Policy: cross-origin` + CORS 头，因此保留 `require-corp` 也不会破坏跨源隔离。SPA 路由切换（`history.replaceState`）由 CF 的 SPA 模式和 GA4 增强型衡量（基于浏览器历史记录事件的网页变化）自动计数，不要再手动发 `page_view`（会重复计数）。测试：`npm run test:analytics`（本地，拦截上报）/ `npm run test:analytics:live`。统计 ID 不进仓库：`tools/build-dist.js` 从环境变量 `CF_BEACON_TOKEN`、`GA_MEASUREMENT_ID`（或被 git 忽略的 `.env`）读取，只写进 `dist/js/analytics.js`；不设置就没有任何统计、同意提示栏或跟踪。一切都在 Cloudflare Workers 静态资源的免费额度内（静态文件不按 Worker 请求计费，Worker 只对页面路由运行）。

**4×4 降阶求解器**（`puzzles/nxn/cube4.worker.js`，自写代码；分阶段思路参考公开的 Tsai / TPR 类方法，没有复制任何代码）：
1. P1（36 种转动）：R/L 两色中心块到 R/L 面，精确距离表 C(24,8)。
2. P2（外层 + Rw/Lw + Uw2/Dw2/Fw2/Bw2）：U/D 中心到 U/D 面、R/L 轴中心进入可解的 12 种分布、全部翼棱「定向」（P3 群下 24 个翼棱位置分两类）、翼棱整体排列为偶（消除 OLL 奇偶）。
3. P3a（U D F B、R2 L2、宽层半转）：中心进入 P3b 可解子集、E 层 8 块翼棱回到 E 层，并保证 P3b 可解。
4. P3b（U D、F2 B2 R2 L2、宽层半转）：中心复原、12 组棱配对、消除 PLL 奇偶。
5. 等价 3×3 交给 Kociemba 两阶段（cubejs）。
每阶段 IDA*，在时间预算内尝试多组前阶段候选取最短；相邻同轴转动合并。

测试：`node tests/nxn.test.js [4×4 样本数]`（模型 2–15 阶 + 2×2 + 4×4），`node tests/gullicube.test.js 5,7,10,15 both`，线上 `node tests/live-nxn.js <URL>`。

### 预计算表（4×4 与 3×3 求解器）

`npm run build:tables` 生成 `puzzles/nxn/cube4-tables.bin.gz`（1.61 MB，7 张距离表）与 `puzzles/cube3/cubejs-prune.bin.gz`（0.89 MB，cubejs 剪枝表）。格式：`CLT1` + 头长度 + JSON 目录（名称 / 类型 / 长度 / FNV-1a 校验）+ 原始字节，gzip 压缩（`js/core/table-pack.js`）。Worker 下载表的同时计算移动表；浏览器用 `DecompressionStream` 解压并逐表校验，下载失败 / 校验不符 / 浏览器不支持时自动回退为现场计算。修改任一求解器的表结构后必须重新运行 `npm run build:tables`（`tests/tables.test.js` 会比较表与现场计算的结果）。

## 自己玩（所有谜题）

舞台顶部的「求解 / 自己玩」切换（也可用 `?mode=play`）。

| 操作 | 说明 |
|---|---|
| 拖动贴纸（鼠标 / 触摸） | 转动该贴纸所在的层。魔方：在该面的两条坐标轴中取投影与拖动方向最一致的一条，转轴 = 面法线 × 拖动方向；大阶魔方按住哪一层就转哪一层（内层记为 2R、3R…，奇数阶正中一层为 M / E / S）。其它谜题用 `dragMoves`（见下）。触摸时画布 `touch-action: none`，页面不滚动 |
| 拖动空白处 | 旋转视角（双击复位） |
| 键盘 | `U D L R F B`（Shift = 逆时针）；数字前缀选层（`2` `R` → 2R）；`w` 前缀为宽层（`3` `w` `R` → 3Rw）；奇数阶 `M E S`；`x y z` 整体转动（2×2 与 4×4+）；Ctrl+Z / 退格撤销，Ctrl+Y / Ctrl+Shift+Z 重做；Esc 清除前缀。记号按当前握法（屏幕上的顶层永远是 U） |
| 公式框 | 输入任意公式（3Rw、2R、M/E/S…），回车执行，逐步动画 |
| 打乱 | 2×2 / 3×3：均匀随机状态（`CubeLab.play.randomState`）；4×4 以上：随机转动；金字塔 / 斜转：均匀随机状态；五魔方：WCA（Pochmann）打乱 |
| 计时 | 打乱后第一次（非整体）转动开始计时，还原时停止；可选 WCA 15 秒观察（超 15 秒 +2，超 17 秒 DNF） |
| 计步 | 3×3 及以下 STM，4×4 以上 BTM（整体转动不计）；金字塔 / 斜转 VTM；五魔方 HTM |
| 撤销 / 重做 / 复原 / 从当前状态求解 | 「求解」切回求解模式，用当前状态求解并照常播放（本次不计成绩） |

- 每种谜题的最好成绩保存在 `localStorage`（`cubelab.best.<谜题>`）。还原时有轻微高亮 + 还原音效（遵循音效开关）+ 一圈展示翻转（遵循自动旋转开关）。
- 实现：`js/core/play-core.js`（纯逻辑，可在 Node 中测试）、`Player.pushMove / popMove`（排队动画，积压时自动加速，不丢步）、`View3D.pick / dragTurn / setPlayMode`、`app.js` 中的模式控制。图视图与 3D 同步逐步更新。

## 金字塔（Pyraminx）与斜转（Skewb）

两者都是完整插件（`puzzles/twisty/`）：模型、校验、3D、展开图编辑、图视图、严格最优求解、自己玩，12 种语言。

- **模型**（`twisty-model.js`，页面 / Worker / Node 共用）：贴纸由几何生成（金字塔每面 9 个三角形；斜转每面 1 个方块 + 4 个角三角形）；每个转动的置换 = 把层内贴纸的质心与法线绕轴转 120° 后找回贴纸。WCA 记号：金字塔 `U L R B`（两层）+ `u l r b`（顶角）；斜转 `R U L B`（R = 右下后角、U = 左上后角、L = 左下前角、B = 左下后角；右上前角固定）。
- **最优求解**（`twisty.worker.js?p=…`）：颜色状态 → 块 + 朝向，按块类别分成独立分量；先 BFS 每个分量的可达集合与转动表，再在乘积空间上做完整 BFS（`Uint8Array` 距离表）；解沿距离表下降，长度恰为最短距离（VTM：每次 120° 转动计 1 步）。金字塔顶角与所有转动可交换，最后各用 0 / 1 步补齐（仍为最优）。

| | 状态数（核心） | 分量 | 实测上帝之数 | 距离表 | 构建（Node / 浏览器含 Worker 启动） | 单次求解 |
|---|---|---|---|---|---|---|
| 金字塔 | 933,120（× 顶角 81 = 75,582,720） | 棱 11,520 × 轴心 81 | 11（含顶角 15） | 0.93 MB | ≈ 60 ms / ≈ 250 ms | ≈ 0.03 ms |
| 斜转 | 3,149,280 | 中心 360 × 角 8,748 | 11（90 个最远态） | 3.15 MB | ≈ 180 ms / ≈ 400 ms | ≈ 0.01 ms |

  距离表在浏览器里现场构建（比下载压缩表还快），不需要额外资源文件。`tests/twisty.test.js` 验证：所有转动 3 次 = 恒等、与逆转动相消、块整体移动；分量乘积 = BFS 可达数（分量相互独立）；每层计数；距离表是一致的 BFS 分层；随机状态求解后复原且步数 = 表中距离；校验器拒绝翻棱 / 扭角 / 两块互换 / 不存在的颜色组合 / 握法错误。
- **3D**：每块是实心凸多面体（外形 ∩ 各切割平面的半空间：金字塔每个顶点两个切面，斜转 4 个过中心的切面）；转动时整层绕轴转，切面在自身平面内滑动，不会互相穿插；贴纸是内缩 + 圆角的三角形 / 方块。
- **图视图**：每个 120° 转动的贴纸轨道都是 3-轮换，画成过 3 个节点的圆。金字塔节点 = 展开图上的贴纸中心（U / L / R 三个顶点各是一组同心圆的圆心，B 层的圆环绕整张展开图）；斜转用从 DBL 角方向的等距方位投影（B 层是同心圆，R / U / L 组成三片花瓣）。
- **展开图编辑**：SVG 多边形（点击 / 拖动涂色、键盘 Enter 涂色、错误标红）。金字塔：前面居中、左右面在两侧、底面在下；斜转：与魔方相同的十字展开。
- **自己玩**：拖动贴纸 = 在各候选转动中取该贴纸瞬时速度与拖动方向最一致者（同轴时取块数少的：拖顶角只转顶角）；键盘 `U L R B` / `R U L B`（Shift = 逆时针），金字塔先按 `T` 再按字母 = 顶角；打乱 = 均匀随机状态；计时 / 最好成绩同魔方。
- **摄像头 / 照片识别**：暂不支持（三角形 / 菱形贴纸需要新的取样网格与块约束配色）；这两个谜题会隐藏扫描选项卡并提示手动涂色。

## 五魔方（Megaminx）

完整插件，位于 `puzzles/megaminx/`（自写代码，MIT）：`megaminx-model.js`（几何、转动、校验；页面 / Worker / Node 共用）、`megaminx.js`（插件：3D、展开图、图视图、记号、自己玩）、`megaminx-solver.js`（多阶段求解器）、`megaminx.worker.js`，以及 `megaminx-ll.json`（顶层公式表，由 `tools/megaminx-ll-gen.js` 离线生成）。

- **模型**：12 面 × 11 块贴纸 = 132 块贴纸，62 个块（12 中心、30 棱、20 角）。面转动 `U F R L BL BR D DR DL B FL FR`，后缀 `X X' X2 X2'`（72° / 144°，从该面看顺时针）；WCA Pochmann 转动 `R++ R-- D++ D--`（除 L / U 层外整体转 144°）。每个转动的置换由旋转贴纸质心与法线得到。校验：颜色数量、不存在或重复的块、扭角、翻棱、排列奇偶、中心排列（`v.megaCenters`）。
- **求解器**（多阶段，不是最优解，WCA 风格 HTM：任一面转 72° 或 144° 都计 1 步）：
  1. 校验后整体旋转 / 重新标色，使中心符合标准配色，再转换成块代码（角：槽位 × 3 种朝向，棱：槽位 × 2）。
  2. **F2L，逐面完成**：D、D 周围的五个环面，然后五个上层面中的四个。某面的块全部归位后，此后不再转动该面，转动集合 S 逐步缩小，未接触的块自动保持。每一步的新块被分成小组（≤ 3 块：一个角块及其相邻棱块）；每组用 IDA* 求解，启发值取若干小型块组距离表（在当前 S 下 BFS，首次使用时构建并缓存）的最大值。最后的二面步骤之前加入一张棱朝向表（类似三阶 `<R,U>` 的 EO），使该步可以只用两个面完成。节点预算 + 重试（改用上一组的下一个解）让少数慢的情况也很快结束。
  3. **顶层两步查表**：第一步 = 棱排列 + 棱朝向 + 角朝向（60 · 16 · 81 = 77,760 态），第二步 = 角排列 × 棱排列（3,600 态）。生成器在 `<U,X,Y>` 三面子群中做 meet-in-the-middle（每侧 ≤ 7 步），找出保持所有非 U 块不动的序列，每种效果保留最短公式及其 5 个绕 U 旋转的版本（共 39,059 条），再用 HTM 代价做 Dijkstra。
  4. 合并相邻同面转动（以 72° 为单位 mod 5）。
- **实测**（Node，`tests/megaminx.test.js` / 基准）：1,000 个随机状态全部复原：平均 120.1 步 HTM（F2L 95.4 + 顶层 26.4），最多 135，最少 97；求解平均 34 ms，最慢 1.6 s。500 个 Pochmann 打乱：平均 119.7，最多 135，平均 29 ms，最慢 0.9 s。浏览器里一次求解通常 2–20 ms 加上 Worker 开销；Worker 启动 + 载入表 ≈ 170–200 ms。这些数字写在 `seo/site.config.json` 中并显示在 SEO 页面上。
- **3D**：`view3d.geometry: 'poly'`，正十二面体作为 `solid`，12 个切割平面作为 `cuts`；每块是凸多面体。
- **图视图**：从 D 面中心对贴纸位置做球极投影（该节点隐藏）。每个 72° 面转动把贴纸分成若干 5-轮换，每个轮换的 5 个点在投影中落在同一个圆上（球极投影把圆映射为圆），所以每条轨道画成其 5-轮换的外接圆：39 个圆、131 个可见节点。白色 U 面在正中，上层各面环绕四周，下层各面是外侧的大花瓣；可放大查看中间部分。
- **展开图编辑**：两朵并排的「花」，每朵 6 个五边形（U 及其 5 个相邻面、D 及其 5 个相邻面），与其它异形一样使用 SVG 多边形。
- **自己玩**：拖动（通用 `dragMoves`），键盘 `U F R L B D` 以及 `I`=BL、`O`=BR、`J`=FL、`K`=FR、`N`=DL、`M`=DR（Shift = 逆时针）；HTM 计步；打乱 = 77 步 WCA Pochmann 打乱（7 行，每行 `R±± D±±` × 5 + `U`/`U'`）；「从当前状态求解」与其它谜题相同。
- **摄像头扫描**：隐藏（`cameraPlan: null`）。
- **名称**：五魔方（中文）、メガミンクス（日语）、Мегаминкс（俄语）、ميغامينكس（阿拉伯语），其它语言为 Megaminx；菜单中排在斜转之后。

## SEO：每种谜题 × 每种语言一个静态页面

- **唯一配置**：`seo/site.config.json`（`baseUrl` = 正式站点地址；canonical / hreflang / sitemap / OG 全部由它生成，换域名只改这一处后重跑生成脚本）以及实测步数。
- **路由**（`js/seo-routes.js`，浏览器与构建脚本共用）：英语在根路径，其它语言在 `/<语言>/` 下；每种谜题一个干净路径：`/`（总入口，x-default）、`/2x2-cube-solver/` … `/15x15-cube-solver/`、`/pyraminx-solver/`、`/skewb-solver/`、`/megaminx-solver/`；例如 `/zh-hans/3x3-cube-solver/`、`/ja/megaminx-solver/`。共 12 语言 × 18 = 216 页。
- **文案**：`seo/lang/<code>.json`（12 种语言，按当地搜索习惯写标题），按谜题类型套模板并填入实测步数。
- **生成**：`npm run build:seo`（`tools/build-seo.js`）在 `index.html` 的 `<!--seo:*-->` 标记之间写入英语根页面，其余页面写入 `seo/out/`，同时生成 `robots.txt`、`sitemap.xml`（含 xhtml:link 多语言互链）、`manifest.webmanifest`；给 HTML 引用的 js/css 加 `?v=<内容哈希>`。图标与 OG 图（1200×630，每种谜题一张，取自真实 3D + 置换图截图）：`npm run build:seo-images`（需本地服务器；`OG_ONLY=root,megaminx` 只生成部分图片）。
- **每页内容**：标题 / 描述 / canonical / 13 条 hreflang（含 x-default）/ OG / Twitter 卡片 / 图标 / manifest / JSON-LD（WebSite、WebApplication（免费，无评分）、WebPage、BreadcrumbList、HowTo、FAQPage，与页面可见文字逐字一致）、静态 `<h1>`、可抓取正文（使用步骤、求解器与实测步数、记号、置换图说明、FAQ、所有谜题的内链）、`<noscript>` 提示。
- **运行时**（`js/seo-nav.js`）：页面通过 `<html data-page-lang data-page-puzzle>` 预选语言和谜题；在应用里切换谜题或语言时用 `history.replaceState` 换到对应的干净 URL，并从预渲染页取回标题 / meta / JSON-LD / 正文，不刷新、不丢状态。根路径 `/` 仍按浏览器语言 / 上次选择显示。
- **旧链接**：`/?puzzle=…`、`/?n=…`、`/?lang=…` 由 `deploy/worker.js`（只对页面路由运行，静态资源由 `run_worker_first` 排除；没有 `?lang` 时按 Accept-Language 选语言，`Vary: Accept-Language`）301 到新路径，其它参数（`mode`、`hold`、`start`）保留；本地无 Worker 时由 `seo-nav.js` 在客户端改写地址。
- **测试**：`node tests/seo.test.js`（静态：216 页的 title/description 唯一、canonical、hreflang 完整互链、JSON-LD 可解析且与可见内容一致、无评分、OG 图尺寸、内链、sitemap/robots/manifest、Worker 重定向）；`npm run test:seo:live` 对线上逐页检查。

## 运行

```bash
cd cube-solver
npm install
npm start                        # node tests/serve.js 8765 (sends COOP/COEP headers)
# open http://localhost:8765/
```

> 摄像头需要**安全上下文**：`https://` 或 `http://localhost`。通过局域网 IP（如 `http://192.168.x.x`）打开时浏览器会禁用摄像头，此时请使用「上传照片」。
> Web Worker 不能在 `file://` 下运行，请务必通过 HTTP 服务器打开。

## 测试

```bash
node tests/model.test.js       # 3×3 model: moves match cubejs, validation error types
node tests/plugin.test.js      # plugin interface: stickers/pieces/moves/tracks, 20 random solves
node tests/worker.test.js      # solver worker (simulated in Node): optimal short solves, two-phase + shortening
node tests/audio.test.js       # sound synthesis (offline rendering)
node tests/i18n.unit.test.js   # i18n: keys complete in all 12 files, placeholders/plural branches, detection, Intl, French spacing
node tests/tables.test.js      # precomputed table packs decode and match live computation
node tests/twisty.test.js 300  # Pyraminx / Skewb: group properties, full BFS, optimal random solves, validator
node tests/megaminx.test.js    # Megaminx: model, validator, 200+ random states + Pochmann scrambles solved, move/time stats
node tests/play.unit.test.js   # free play: every sticker × drag direction → move, random states, keys, timer / best
node tests/scan-synth.test.js 40 2,3,4,5,6,7  # color recognition on synthetic samples (4 lighting conditions)
npm test                       # builds the SEO pages, then runs all of the above (plus analytics and SEO static tests)
node tests/play.e2e.js http://localhost:8765/      # free play E2E (2/3/4/7): drag, view rotation, keys, formula, undo/redo, timer, mobile touch → screenshots/play/
node tests/twisty.e2e.js http://localhost:8765/    # Pyraminx / Skewb E2E → screenshots/oddshape/
node tests/megaminx.e2e.js http://localhost:8765/  # Megaminx E2E: menu, net, graph, 3D, solve, playback, drag/keys/touch, Pochmann scramble, timer → screenshots/megaminx/
node tests/scan-photo.test.js http://localhost:8765/ 3 2,3,4,5,6,7  # synthetic photo upload per face (N×N)
node tests/e2e.test.js http://localhost:8765/      # Playwright end-to-end (zh-CN locale; needs playwright + chromium)
node tests/i18n.test.js http://localhost:8765/     # 12 languages × desktop/mobile: no overflow, RTL, persistence → screenshots/i18n/
node tests/naming.e2e.js http://localhost:8765/    # puzzle menu order and names per language
```

E2E 覆盖：随机打乱 → 求解 → 播放到结尾（图视图 6 簇同色、3D 每面同色）、播放器 seek / prev / next、手动涂色与各类校验错误、公式输入、合成照片 6 面识别（偏色 / 光照梯度 / 噪点 / 反光）、Chromium 假摄像头路径、移动端布局与截图。`tests/graph-preview.html` 是调试图布局的独立页面（`?scr=公式&mv=R&e=0.5`）。`node tests/compare-ref.js` 把与参考视频帧（`ref/f14`、`f07`、`f01`）的并排对比写入 `screenshots/compare-*.png`；`tests/graph-pixel.html` 以参考帧的像素映射渲染图视图，用于逐像素叠加比对。

## 目录结构

```
index.html                 page (English root; generated SEO blocks between <!--seo:*--> markers)
css/style.css              styles (flat / bold-outline look)
js/core/registry.js        puzzle registry + shared helpers (permutations, parsing, inversion, track generation)
js/core/graph-view.js      permutation graph view (SVG)
js/core/view3d.js          3D view (three.js)
js/core/player.js          timeline player; drives all views in sync
js/core/play-core.js       free-play logic (testable in Node)
js/core/solver-client.js   solver client (Web Worker wrapper)
js/core/net-editor.js      net painting editor
js/core/camera-scan.js     camera / photo scanning and color classification
js/core/color-cluster.js   post-scan constrained color decoding
js/core/audio.js           Web Audio sound engine
js/app.js                  app wiring (connects modules only through the Puzzle interface)
js/analytics.js            analytics loader (IDs injected by tools/build-dist.js)
js/seo-routes.js, js/seo-nav.js  clean URLs per puzzle × language
js/i18n/i18n.js, js/i18n/<lang>.js  i18n core and strings (en is the master table)
puzzles/cube3/             3×3 model, plugin, Kociemba worker
puzzles/nxn/               2×2 – 15×15 plugin, 2×2 optimal and 4×4 reduction workers, gullicube adapter
puzzles/twisty/            Pyraminx and Skewb (shared model, plugin, optimal BFS worker)
puzzles/megaminx/          Megaminx model, plugin, multi-phase solver, worker, last-layer table
seo/                       site.config.json, lang/<code>.json, generated out/
tools/                     build-dist, build-seo, build-seo-images, build-tables, megaminx-ll-gen, build-gullicube.sh
deploy/                    wrangler.toml, worker.js (redirects), _headers (COOP/COEP)
vendor/                    third-party code with licenses: three.min.js (r160), cubejs, gullicube
```

## 扩展点（架构）

核心模块（输入、图视图、3D、播放器、扫描、求解客户端）**只**通过 `CubeLab.registerPuzzle(def)` 注册的 Puzzle 对象工作，不含任何三阶专属逻辑。新谜题放在 `puzzles/<id>/` 并实现下列接口即可。

### Puzzle 接口

```js
CubeLab.registerPuzzle({
  id: 'cube3', name: '3×3 Cube',
  colors: { W: { name: 'White', hex: '#f5f5f5' }, ... },  // color set
  blankColor: '#cfcfc6',                                 // display color of unpainted stickers

  // stickers: a state is an array of color keys, one per sticker
  stickers: [{ id: 'U1', face: 'U', pos: [x,y,z], normal: [nx,ny,nz], locked?: true }, ...],
  faces:    [{ id: 'U', name: 'Up', center: 4, normal: [0,1,0], stickers: [0..8] }, ...],
  pieces:   [{ pos: [x,y,z], stickers: [i, j, k] }, ...],  // pieces rendered in 3D

  // a move is a sticker permutation: perm[i] is where sticker i goes
  moves: { "R": { perm, axis: [1,0,0], angle: -Math.PI/2, base: 'R', face: 'R', inverse: "R'", layer: pos => bool }, ... },
  trackMoves: ['U','R','F','D','L','B','M','E','S'],     // base moves used to build graph tracks
  holds: [{ id, name, short, orientation: [ex,ey,ez], toView: {internal: shown}, fromView }],  // optional grips

  solvedState(), randomScramble() -> [tok], validate(state) -> { ok, errors: [...] },
  describeMove(tok) -> 'Right face clockwise 90°…',
  netLayout: { cols, rows, cells: [{ sticker, col, row }] },  // net editor
  graphLayout(opts) -> { nodes: [[x,y]] (one per sticker), clusters: [[stickerIds]], nodeRadius, circles? },
  cameraPlan: [{ face, title, instruction, grid: 3, cells: [...], center }],  // null hides the scan tab
  notation: [[symbol, description], ...],
  view3d: { ... },
  solvers: [ /* see below */ ]
});
```

注册时核心会自动补齐：默认的 `parse / format / apply / inverse / isSolved`、每个转动参与旋转的块（由 `layer` 判定）、**图轨道**（`P.tracks`）以及每个转动的贴纸路径（`moves[tok].paths`）。

异形谜题用到的可选字段：`trackMode: 'cycles'`（轨道 = 基础转动置换的轮换）、`netLayout.polys`（SVG 多边形展开图）、`view3d.geometry: 'poly'` + `solid` / `cuts` / `core`（凸多面体块体）、`dragMoves`（通用拖动）、`playKeys` / `playMetric` / `metricTitle`、`hints`（各处提示的 i18n 键）、`randomState(rnd)`（均匀随机状态）、`randomScramble()`、`nameKey`；`cameraPlan: null` 时隐藏扫描选项卡，没有 `holds` 时隐藏握法菜单。

### 图轨道与运动（`CubeLab.buildTracks` + `GraphView`）

对每个基础转动：取被移动的贴纸，按「贴纸法线 · 转轴」分组（三阶上即「本面 8 块」与「侧面 12 块」），组内按绕轴角度排序得到闭合环；转动角度为 θ 时，环上的贴纸前进 `θ/2π × n` 格，并与 `perm` 交叉校验。

插件的 `graphLayout()` 提供节点二维坐标，并可选提供 `circles: [{id, cx, cy, r}]`：
- 若某条侧面轨道的全部节点都落在某个圆上，节点就**沿该圆**运动（同轨道同向；方向取基础转动下总行程最短者，逆转动反向），并绘制颜色拖尾；
- 「本面」轨道的节点绕该面中心节点做极坐标插值（簇整体旋转）；
- 没有圆时退回为穿过节点的闭合样条，所以其它谜题即使没有手工布局也能直接可视化。

**三阶布局**（`puzzles/cube3/cube3.js` 中的 `GL` 配置）：三组同心圆分别对应 y（U/E/D）、z（F/S/B）、x（R/M/L）三个轴，圆心在正三角形三个顶点（上、左下、右下），半径 1.3922 / 1.7696 / 2.1469（三角形外接圆半径为 1）。这些数值是对参考视频高清帧中**全部 54 个节点**做最小二乘拟合得到的（残差均方根 0.2 px）；节点半径 0.184、描边 0.048、轨道线宽 0.063、高亮线宽 0.076 也来自同一帧的像素测量。按参考帧的像素映射渲染后与原帧 50% 叠加，圆环与节点几乎完全重合（`tests/graph-pixel.html`）。面 X 的贴纸位于「X 法线以外两个轴」两组圆的交点；两个交点区域正好容纳一对相对面。层 → 半径的方向（`sign`）与每个面取哪个交点区域（`upper`）经过穷举（64 种组合）验证：六个面转动都是 12 个节点在单个圆上的循环平移。中层转动 M/E/S 是真正的转动（`moves` 中由几何生成；同一生成器能精确复现 6 个面转动的置换，由单元测试检查），各自沿本组的中间圆运动。求解器只输出面转动。

**弧线路由（与参考视频逐帧核对）**：每个圆上 12 个节点分属 4 个面区，间隔约 60°/60°/60°/180°。按「总行程最短」定方向时，90° 转动中有 9 块贴纸走 ≈ 60° 的短弧，**一个面区的 3 块跨越 180° 的空弧**（例如外圈上方弧、左下组圆的左侧大弧）。参考视频的做法完全相同（`screenshots/compare-motion.png` 第二行）。面区位置由「已还原布局 = 参考 f14」唯一确定，因此不存在让所有弧都变短的其它分配。

**时间与缓动（参考视频 60fps 运动能量实测）**：
- 单步缓动 `easeInOutQuad`（拟合 15 次转动的平均速度曲线，RMS 0.076；sine 0.155，cubic 0.193）；
- 连续播放时整段「慢起 – 加速 – 慢收」：首步 ≈ 0.85 s、中段 0.48 s、末步 ≈ 1.0 s，两步之间仅 ≈ 0.07 s 停顿（`CubeLab.tempo(i, n)`，`Player.baseMs = 480`，`gapMs = 67`；单步「下一步」固定 0.55 s）；
- 活动圆高亮在转动前 8% 淡入、最后 16% 淡出；彩色拖尾从节点向后延伸（尾部相位 `ease(1.6t − 0.6)`），结束时消失；
- 还原后静止 ≈ 1.2 s，再做 2.0 s 的展示翻转。

### 握法（记号视角）

内部状态、求解器、公式输入始终使用 WCA 标准握法（白 U、绿 F）。插件可提供 `holds`：每个握法给出 3D 整体朝向和记号重命名表。三阶默认「黄顶绿前」= 标准握法绕前后轴转 180°（z2）：`U↔D`、`R↔L`、`F/B` 不变，`M→M′`、`E→E′`、`S` 不变（单元测试逐个验证：内部转动的「轴 × 角」经朝向旋转后等于显示记号的「轴 × 角」）。解法文本、播放器当前步、步骤列表和说明都使用当前握法的记号，所以屏幕上的顶层叫 U。

### 3D 风格与视角

- `view3d.style: 'plastic'`：浅灰块体 + 白色面板（形成浅灰细缝）+ 圆角纯色贴纸（不受光照，颜色与图视图一致）+ 块体柔和明暗；省略则为黑色块体的经典扁平风格。
- `stickerCorners: [左上, 右上, 右下, 左下]`：贴纸圆角（可设成不对称的叶形）；`stickerColors` 可单独覆盖 3D 贴纸颜色。
- `orientation`（欧拉角，由当前握法覆盖）+ `camera: { fov, dir }`：三阶默认视角与参考视频一致 —— 黄色（D）朝上、绿色（F）在左、橙色（L）在右，正好对应置换图中间三角形的三个簇。透视 FOV 24°、仰角约 25°，经与参考帧逐像素对比调整。
- `frame: { width, height, dx, dy }`：取景（模型 / 图在各自半边面板中的大小与偏移），与参考视频实测一致，误差 < 0.5%。
- `autoRotate`：播放时模型轻微摆动；播放到结尾且已还原时，静止 `showcaseDelay`（1.2 s）后做 `showcaseMs`（2.0 s）的一整圈展示翻转再回到初始视角（同参考视频结尾）。播放器上的「自动旋转」开关可关闭；拖动旋转、双击复位始终可用。

### 声音（`js/core/audio.js`，`CubeLab.SoundEngine`）

全部用 Web Audio API 实时合成，不含任何音频文件或第三方素材。
- **自动播放策略**：页面加载时不创建 `AudioContext`；第一次 `pointerdown / keydown / touchstart` 时才创建并 `resume()`。默认音效开、音乐关；「音效 / 音乐 / 音量」保存在 `localStorage`（`cubelab.sfx / cubelab.music / cubelab.vol`）。若刷新前音乐是开的，会等到下一次用户手势才开始。不支持 Web Audio 的浏览器中所有调用都是空操作，控件显示为禁用。
- **转动音效 v3**（`Player.onMove(phase, tok, durMs)` 钩子）：按三段真实三阶录音的分析重做（见 `user-sounds/ANALYSIS.md`、`screenshots/sound-compare.png`）。真实转动 = 120–200 ms 的一串成簇塑料颗粒（≈ 每 5 ms 一颗），激励块体的短促模态：主峰 0.86–1.1 kHz（「空心 / 木质」）+ 500 Hz、1.55、2.8、4.1 kHz，振铃仅 3–6 ms，几乎没有 300 Hz 以下的「咚」；能量逐渐增强到落位那一下最响，之后 70–100 ms 渐弱的余响。合成：JS 生成颗粒事件 → 10 个二阶谐振器（每颗随机激励不同模态）+ 细密微颗粒层 + 极轻摩擦 + 宽带直达边缘；落位主咔对齐动画结束，慢速播放时声音集中在末段，180° 在 T/2 有过卡位咔，中层更轻更暗；每次 1.7–3.3 ms 生成。与真实录音（SpaceJoe / Pixabay 素材，同一套分析）对比：质心 2141 Hz vs 2135 / 2077 Hz，峰值因数 20.7 vs 21.1 / 17.6 dB，平坦度 0.24 vs 0.25 / 0.32，颗粒 18.5 vs 17.8 / 12.0 每 100 ms，三分之一倍频程形状差 ≈ 2 dB。不发布任何音频文件（录音只用于分析，许可见 `vendor/sounds/LICENSE.txt`）。快放保护：两次转动声至少间隔 50 ms；转动越短越轻、颗粒越少；拖动时间线时未播完的转动声立即停止。
- **还原**：上行大调琶音 + 和弦（播放到最后一步且已还原时）；**展示翻转**开始时（`View3D.onShowcaseStart`）一段柔和的上扫闪光。
- **界面**：涂色轻点（随颜色变音高，拖动连续涂色时限流）、拍摄 / 上传识别成功提示音（六面完成时三声）。
- **背景音乐**：72 BPM，Cmaj9 – Am9 – Fmaj9 – G6sus 四小节循环；失谐锯齿波经低通的铺底 + 五声音阶琶音（确定性伪随机），反馈延迟营造空间感；前瞻调度（每 150 ms 预排 0.6 s），无缝循环，开关时淡入淡出，音量很低。
- 电平（音量 0.8，离线渲染实测）：1× 单步转动峰值约 0.31–0.36，真实手速（130 ms）约 0.22，还原琶音约 0.23，背景音乐峰值约 −22 dBFS。试听（仅本地）：`screenshots/sound-demo-turns.wav`、`sound-demo-turns-v3.wav`、`sound-demo-sfx.wav`、`sound-demo-music.wav`。

### 多语言（`js/i18n/`，`CubeLab.i18n`）

- **语言与顺序**：English、简体中文、繁體中文、Español、العربية、Português、Bahasa Indonesia、Bahasa Melayu、Français、日本語、Русский、Deutsch（菜单中全部为同级选项，无分组）。
- **文案**：每种语言一个文件 `js/i18n/<code>.js`，调用 `CubeLab.i18n.register(code, {key: text})`；`en.js` 是主表，缺失的键回退到英文并记录在 `CubeLab.i18n.missing`。HTML 用 `data-i18n` / `data-i18n-title` / `data-i18n-aria` / `data-i18n-placeholder`；动态文本用 `I.bind(el, key, params)`，切换语言时自动重渲染。
- **格式**：ICU 子集 `{name}`、`{n, plural, =0 {…} one {# …} few {…} many {…} other {…}}`（`Intl.PluralRules`）、`{ms, unit, millisecond}`、`{x, number}`（`Intl.NumberFormat`）。法语自动在 `: ; ! ? « »` 处插入不换行空格；西语使用 ¡ ¿。转动记号在所有语言中都保持标准字母（U D L R F B M E S，′ 2）。
- **检测顺序**：`?lang=xx` → `localStorage['cubelab.lang']` → `navigator.languages`（zh-TW/HK/MO/Hant → 繁體，其它 zh → 简体）→ English。设置 `<html lang dir>`、标题与 meta description。
- **RTL**：阿拉伯语整页镜像（CSS 逻辑属性），3D 画布、置换图、时间线 / 播放控件、步骤条、记号、公式输入与数字保持 LTR（`dir="ltr"`）。
- **排版**：CJK / 阿拉伯语使用各自字体栈与更大的行高、取消字间距；德语 / 俄语启用 `hyphens:auto`，按钮允许换行而不溢出。
- **新增语言**：在 `i18n.js` 的 `LANGS` 中加一项，新建 `js/i18n/<code>.js` 并在 `index.html` 引入，然后运行 `node tests/i18n.unit.test.js`。

### 求解器适配器

```js
solvers: [
  { id: 'kociemba', name: '…', available: true,
    workerUrl: 'puzzles/cube3/kociemba.worker.js',
    encode: state => payload },          // runs on the main thread; throws a localized error for invalid states
  { id: 'optimal-ida', name: 'IDA* optimal (planned)', available: false }
]
```

Worker 协议：

```
→ { id, cmd: 'init' }                      ← { id, ok: true, ms }
→ { id, cmd: 'solve', payload }            ← { id, ok: true, moves: ['R', "U'", ...], optimal?: bool, label?, note?, ms }
                                           ← { id, ok: false, error }
```

一个谜题可以有多个求解器，菜单会自动列出；`available: false` 的显示为「规划中」。加入真正的最优求解器（如 Korf IDA* + 角块 / 棱块模式数据库）时，只需新增一个 Worker 并在 `solvers` 中登记。Worker 可以返回 `optimal: false` 以及 `label` / `note` i18n 键（五魔方就是这样），界面会显示在步数旁边。

### 其它视图

播放器（`CubeLab.Player`）驱动任意数量的视图，视图只需实现 `setState(state)` 和 `animate(tok, e, fromState, t)`（e 为 0–1 的缓动进度，t 为原始时间相位），可选 `highlight(tok, state)`。新增可视化（例如 Cayley 图、轮换图）只需实现这些方法。

## 第三方库

- [gullicube](https://github.com/rokicki/gullicube)（Tomas Rokicki，按 MPL-2.0 选项使用，源码未修改，见 `vendor/gullicube/NOTICE.md`）
- [cubejs](https://github.com/ldez/cubejs)（MIT）— Kociemba 两阶段算法。`vendor/solve.js` 有一处小补丁（`vendor/solve.js.cubelab.patch`）：为 `solve(maxDepth, deadline)` 增加可选截止时间，无解时抛出异常而非返回 null 崩溃，用于在时间预算内迭代缩短解法。
- [three.js](https://threejs.org/) r160（MIT）— 3D 渲染（UMD 版 `three.min.js`，控制台会提示该构建已弃用，不影响使用）。
- 金字塔、斜转、五魔方求解器以及五魔方顶层公式表都是本项目自写的代码和数据（MIT），没有使用任何 GPL 代码、csTimer 或 TPR 的代码。

## 已知限制

- 金字塔 / 斜转 / 五魔方暂不支持摄像头 / 照片识别；涂色时需按提示的方向拿（金字塔：不含黄色的轴心块在上、不含绿色的在后；斜转：白-绿-红角在右上前；五魔方：中心必须构成标准配色），否则会提示握法 / 中心错误。
- 五魔方的解**不是最优解**（平均 ≈ 120 步 HTM，最多 ≈ 135）；偶尔较难的状态需要 ≈ 1.6 s；1.8 MB 的顶层公式表（`megaminx-ll.json`，传输时压缩）在五魔方求解器启动时下载一次。
- 摄像头需 HTTPS 或 localhost；识别依赖光照，强反光 / 偏黄光源下请在展开图上手动修正（中心块颜色用于校准，能抵抗一定偏色）。
- 扫描假定标准配色（白对黄、绿对蓝、红对橙）并按引导方向持握；中心块在编辑器中固定。
- 三阶求解器只输出面转动（HTM）；参考视频的解法里含中层转动，所以同一状态下的步骤序列不会与视频逐步相同。
- 两阶段算法给出的是近最优解（通常 19–21 步），只有 ≤ 8 步的状态会给出可证明的最优解；真正的「上帝之数」级最优求解器留作扩展。
