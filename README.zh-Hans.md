[English](README.md) · **简体中文** · [繁體中文](README.zh-Hant.md) · [日本語](README.ja.md) · [Español](README.es.md) · [Português](README.pt.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · [Русский](README.ru.md) · [العربية](README.ar.md) · [Bahasa Indonesia](README.id.md) · [Bahasa Melayu](README.ms.md)

# Cube Solver Lab

一个完全在浏览器里运行的魔方求解器，支持 2×2 到 15×15 魔方、金字塔魔方、斜转魔方和五魔方。3D 模型旁边是一张置换图：每块贴纸都是一个节点，每转一层，都能看到贴纸沿着圆周移动。

**在线使用: https://cube-solver.org**

## 功能

- **求解** 2×2 到 15×15 魔方、金字塔、斜转和五魔方。2×2、金字塔和斜转给出最优解；3×3 使用 Kociemba 两阶段算法（通常 19–21 步）；5×5 及以上使用编译为多线程 WebAssembly 的 gullicube；五魔方使用快速的多阶段方法（平均约 120 步 HTM，不是最优解）。
- **输入状态**：在展开图上涂色、输入打乱公式（`R U R' U2 …`，支持宽层和中层转动）、用摄像头扫描，或上传照片。
- **校验**并说明问题所在：缺少颜色、角块扭转、棱块翻转、奇偶错误等。
- **分步播放**：时间线、调速和键盘快捷键，3D 视图与置换图同步动画。
- **自己玩** 所有谜题：拖动或用键盘转动，带计时、可选 WCA 观察时间、撤销 / 重做和最好成绩。五魔方的打乱采用 WCA（Pochmann）格式。
- **12 种语言**（阿拉伯语为完整的从右到左布局），每种谜题在每种语言下都有一个便于搜索的静态页面。
- **合成音效**：所有声音都由 Web Audio API 实时生成，不包含任何音频文件。

## 隐私

- 摄像头画面和上传的照片只在你的浏览器中处理，不会上传，也不会保存在服务器上。
- 线上站点使用 Cloudflare Web Analytics 统计访问量：它不使用 Cookie，也不收集个人数据，对所有访客加载。Google Analytics 4 始终以 Consent Mode v2 运行，广告存储、广告用户数据、广告个性化和 Google 信号全部关闭。在欧盟/欧洲经济区、英国和瑞士（以及无法判断国家时），只有在你于同意提示栏中点击“接受”后才会加载；其他地区不显示提示栏，仅为页面浏览统计而加载。无论哪种情况，你都可以随时通过页脚的“统计设置”链接开启或关闭它；选择“拒绝”会停止它并删除它的 Cookie。语言、声音、最好成绩以及你的统计选择等设置只保存在浏览器的本地存储中。统计只计算页面浏览量，魔方状态和摄像头图像永远不会被发送。
- 本站是托管在 Cloudflare 上的一组静态文件；和所有网站托管商一样，Cloudflare 会处理普通的网页请求。

## 本地运行

需要 Node.js 18 或更高版本。

```bash
npm install
npx playwright install chromium   # 仅浏览器测试需要
npm start                         # http://localhost:8765/
```

摄像头需要安全上下文（`https://` 或 `http://localhost`）。本地服务器会发送与线上相同的跨源隔离响应头，多线程 WebAssembly 需要它们。

## 测试

```bash
npm test               # 先生成 SEO 页面，再运行单元、求解器和 SEO 测试（不需要浏览器）
npm run test:nxn       # 4×4–15×15 求解器检查（较慢）
npm start &            # 浏览器测试需要本地服务器
npm run test:e2e       # 另有: test:i18n, test:play, test:twisty, test:naming, test:analytics
```

## 构建与部署

```bash
npm run build          # 在 dist/ 中生成可部署的站点
```

本站以 Cloudflare Workers 静态资源的方式部署（见 `deploy/`）：

```bash
export CLOUDFLARE_ACCOUNT_ID=<你的账户 ID>
export CLOUDFLARE_API_TOKEN=<可编辑 Workers 的 API 令牌>   # 或运行: npx wrangler login
export CF_BEACON_TOKEN=<token>               # 可选：Cloudflare Web Analytics 令牌
export GA_MEASUREMENT_ID=G-XXXXXXXXXX        # 可选：GA4 衡量 ID，只在用户同意后加载
npm run deploy
```

- `deploy/_headers` 设置 `Cross-Origin-Opener-Policy` 和 `Cross-Origin-Embedder-Policy`，多线程 WebAssembly 求解器需要它们。
- `deploy/worker.js` 只负责重定向：把 `www` 和 `*.workers.dev` 跳转到主域名，把旧的 `/?puzzle=…` 链接跳转到新路径。静态文件（`/js`、`/css`、`/img`、`/puzzles`、`/vendor` 等）直接返回，不运行 Worker，所以每次页面访问只消耗一次 Worker 请求。
- 统计 ID 不在仓库里。`npm run build` 从环境变量（或被 git 忽略、按 `KEY=value` 逐行书写的 `.env` 文件）读取 `CF_BEACON_TOKEN` 和 `GA_MEASUREMENT_ID`，只写入 `dist/`。不设置时，构建结果不含任何统计、同意提示栏或跟踪；统计也只会在正式域名上运行。
- 如果部署自己的副本，请修改 `deploy/wrangler.toml` 中的 `name` 和 `routes`，以及 `seo/site.config.json` 中的 `baseUrl`。

开发说明：[docs/DEVELOPMENT.zh-Hans.md](docs/DEVELOPMENT.zh-Hans.md)。

参与贡献：欢迎提交错误报告、翻译修正和 Pull Request，详见 [CONTRIBUTING.md](CONTRIBUTING.md)（英文）。安全问题请参阅 [SECURITY.md](SECURITY.md)。

## 致谢

把魔方画成一组圆环的图形视图，灵感来自じゃがりきん（[@jagarikin](https://x.com/jagarikin)）的动画：[原作（2022-05）](https://x.com/jagarikin/status/1524175137633095681)、[带 3D 魔方的版本（2022-11）](https://x.com/jagarikin/status/1593771091738374144)。我们最早是通过 [@UnicornBitcoin 的这条帖子](https://x.com/UnicornBitcoin/status/2107652690113339684) 看到这个创意的，感谢两位。

## 许可与致谢

- 本项目代码以 [MIT 许可证](LICENSE) 发布。
- 第三方组件保留各自的许可证，详见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
  - [gullicube](https://github.com/rokicki/gullicube)（Tomas Rokicki）是 5×5 及以上的求解器，未经修改，按 Mozilla Public License 2.0 使用（它采用“MPL-2.0 OR GPL-3.0-or-later”双许可，本项目选择 MPL-2.0）。见 `vendor/gullicube/` 和 `tools/build-gullicube.sh`。
  - [cubejs](https://github.com/ldez/cubejs)（MIT）是 3×3 两阶段求解器，有一处小补丁，见 `vendor/solve.js.cubelab.patch`。
  - [three.js](https://threejs.org/)（MIT）负责 3D 渲染。

## 商标

Rubik's Cube（鲁比克魔方）是 Spin Master Ltd. 的注册商标。本项目与 Spin Master 没有任何关联，也未获其赞助或认可。“Rubik's”一词仅用于描述这种谜题。
