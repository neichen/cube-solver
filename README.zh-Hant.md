[English](README.md) · [简体中文](README.zh-Hans.md) · **繁體中文** · [日本語](README.ja.md) · [Español](README.es.md) · [Português](README.pt.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · [Русский](README.ru.md) · [العربية](README.ar.md) · [Bahasa Indonesia](README.id.md) · [Bahasa Melayu](README.ms.md)

# Cube Solver Lab

一個完全在瀏覽器裡執行的魔術方塊解題器，支援 2×2 到 15×15 方塊、金字塔方塊、斜轉方塊和五魔方。3D 模型旁邊是一張置換圖：每塊貼紙都是一個節點，每轉一層，都能看到貼紙沿著圓周移動。

**線上使用: https://cube-solver.org**

## 功能

- **解題**：2×2 到 15×15 方塊、金字塔、斜轉和五魔方。2×2、金字塔和斜轉給出最佳解；3×3 使用 Kociemba 兩階段演算法（通常 19–21 步）；5×5 以上使用編譯成多執行緒 WebAssembly 的 gullicube；五魔方使用快速的多階段方法（平均約 120 步 HTM，並非最佳解）。
- **輸入狀態**：在展開圖上塗色、輸入打亂公式（`R U R' U2 …`，支援寬層與中層轉動）、用攝影機掃描，或上傳照片。
- **檢查**並說明問題所在：缺少顏色、角塊扭轉、邊塊翻轉、奇偶錯誤等。
- **逐步播放**：時間軸、調速與鍵盤快速鍵，3D 視圖與置換圖同步動畫。
- **自由玩** 所有謎題：拖曳或用鍵盤轉動，附計時、可選 WCA 觀察時間、復原 / 重做與最佳成績。五魔方的打亂採用 WCA（Pochmann）格式。
- **12 種語言**（阿拉伯語為完整的由右至左版面），每種方塊在每種語言下都有一個方便搜尋的靜態頁面。
- **合成音效**：所有聲音都由 Web Audio API 即時產生，不包含任何音訊檔。

## 隱私

- 攝影機畫面與上傳的照片只在你的瀏覽器中處理，不會上傳，也不會儲存在伺服器上。
- 線上網站使用 Cloudflare Web Analytics 統計造訪量：它不使用 Cookie，也不收集個人資料，對所有訪客載入。Google Analytics 4 一律以 Consent Mode v2 執行，廣告儲存、廣告使用者資料、廣告個人化和 Google 信號全部關閉。在歐盟/歐洲經濟區、英國和瑞士（以及無法判斷國家時），只有在你於同意提示列中點選「接受」後才會載入；其他地區不顯示提示列，僅為頁面瀏覽統計而載入。無論哪種情況，你都可以隨時透過頁尾的「統計設定」連結開啟或關閉它；選擇「拒絕」會停止它並刪除它的 Cookie。語言、聲音、最佳成績以及你的統計選擇等設定只儲存在瀏覽器的本機儲存空間。統計只計算頁面瀏覽量，魔術方塊狀態和相機影像永遠不會被傳送。
- 本站是託管在 Cloudflare 上的一組靜態檔案；和所有網站託管商一樣，Cloudflare 會處理一般的網頁請求。

## 本機執行

需要 Node.js 18 或更新版本。

```bash
npm install
npx playwright install chromium   # 僅瀏覽器測試需要
npm start                         # http://localhost:8765/
```

攝影機需要安全環境（`https://` 或 `http://localhost`）。本機伺服器會送出與線上相同的跨來源隔離標頭，多執行緒 WebAssembly 需要它們。

## 測試

```bash
npm test               # 先產生 SEO 頁面，再執行單元、解題器與 SEO 測試（不需要瀏覽器）
npm run test:nxn       # 4×4–15×15 解題器檢查（較慢）
npm start &            # 瀏覽器測試需要本機伺服器
npm run test:e2e       # 另有: test:i18n, test:play, test:twisty, test:naming, test:analytics
```

## 建置與部署

```bash
npm run build          # 在 dist/ 中產生可部署的網站
```

本站以 Cloudflare Workers 靜態資源的方式部署（見 `deploy/`）：

```bash
export CLOUDFLARE_ACCOUNT_ID=<你的帳戶 ID>
export CLOUDFLARE_API_TOKEN=<可編輯 Workers 的 API 權杖>   # 或執行: npx wrangler login
export CF_BEACON_TOKEN=<token>               # 選用：Cloudflare Web Analytics 權杖
export GA_MEASUREMENT_ID=G-XXXXXXXXXX        # 選用：GA4 評估 ID，只在使用者同意後載入
npm run deploy
```

- `deploy/_headers` 設定 `Cross-Origin-Opener-Policy` 與 `Cross-Origin-Embedder-Policy`，多執行緒 WebAssembly 解題器需要它們。
- `deploy/worker.js` 只負責重新導向：把 `www` 和 `*.workers.dev` 導向主網域，把舊的 `/?puzzle=…` 連結導向新路徑。靜態檔案（`/js`、`/css`、`/img`、`/puzzles`、`/vendor` 等）直接回應，不執行 Worker，所以每次瀏覽頁面只用掉一次 Worker 請求。
- 統計 ID 不在儲存庫裡。`npm run build` 從環境變數（或被 git 忽略、以 `KEY=value` 逐行書寫的 `.env` 檔）讀取 `CF_BEACON_TOKEN` 和 `GA_MEASUREMENT_ID`，只寫入 `dist/`。未設定時，建置結果不含任何統計、同意提示列或追蹤；統計也只會在正式網域上執行。
- 如果要部署自己的副本，請修改 `deploy/wrangler.toml` 的 `name` 與 `routes`，以及 `seo/site.config.json` 的 `baseUrl`。

開發說明：[docs/DEVELOPMENT.zh-Hant.md](docs/DEVELOPMENT.zh-Hant.md)。

參與貢獻：歡迎提交錯誤回報、翻譯修正和 Pull Request，詳見 [CONTRIBUTING.md](CONTRIBUTING.md)（英文）。安全問題請參閱 [SECURITY.md](SECURITY.md)。

## 致謝

把魔術方塊畫成一組圓環的圖形視圖，靈感來自じゃがりきん（[@jagarikin](https://x.com/jagarikin)）的動畫：[原作（2022-05）](https://x.com/jagarikin/status/1524175137633095681)、[附 3D 方塊的版本（2022-11）](https://x.com/jagarikin/status/1593771091738374144)。我們最早是透過 [@UnicornBitcoin 的這則貼文](https://x.com/UnicornBitcoin/status/2107652690113339684) 看到這個創意的，感謝兩位。

## 授權與致謝

- 本專案程式碼以 [MIT 授權條款](LICENSE) 釋出。
- 第三方元件保留各自的授權條款，詳見 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
  - [gullicube](https://github.com/rokicki/gullicube)（Tomas Rokicki）是 5×5 以上的解題器，未經修改，依 Mozilla Public License 2.0 使用（它採「MPL-2.0 OR GPL-3.0-or-later」雙授權，本專案選擇 MPL-2.0）。見 `vendor/gullicube/` 與 `tools/build-gullicube.sh`。
  - [cubejs](https://github.com/ldez/cubejs)（MIT）是 3×3 兩階段解題器，有一處小修補，見 `vendor/solve.js.cubelab.patch`。
  - [three.js](https://threejs.org/)（MIT）負責 3D 繪製。

## 商標

Rubik's Cube（魯比克方塊）是 Spin Master Ltd. 的註冊商標。本專案與 Spin Master 沒有任何關係，也未獲其贊助或認可。「Rubik's」一詞僅用於描述這種益智玩具。
