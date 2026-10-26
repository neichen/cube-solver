[English](DEVELOPMENT.md) · [简体中文](DEVELOPMENT.zh-Hans.md) · **繁體中文** · [日本語](DEVELOPMENT.ja.md) · [Español](DEVELOPMENT.es.md) · [Português](DEVELOPMENT.pt.md) · [Français](DEVELOPMENT.fr.md) · [Deutsch](DEVELOPMENT.de.md) · [Русский](DEVELOPMENT.ru.md) · [العربية](DEVELOPMENT.ar.md) · [Bahasa Indonesia](DEVELOPMENT.id.md) · [Bahasa Melayu](DEVELOPMENT.ms.md)

# 魔方求解實驗室（CubeLab）· 開發說明

> 面向開發者的詳細說明。英文版（[DEVELOPMENT.md](DEVELOPMENT.md)）為權威版本，本譯文與其內容一致。專案介紹、執行、測試、部署、許可與隱私見 [README](../README.zh-Hant.md)。
> 文中提到的 `ref/`（參考影片幀）與 `screenshots/`（測試截圖輸出）不在倉庫中；測試執行時會自動生成截圖目錄。

純前端（靜態 HTML/CSS/JS，無後端）的魔方求解器，核心特色是**置換圖檢視**：3D 模型旁邊是一張「置換圖」，每塊貼紙都是一個節點。三階魔方是**三組同心圓**（每組 3 個圓 = 一個軸向的 3 層，圓心構成正三角形，形成三重對稱的花瓣圖），54 個節點位於圓與圓的交點。每轉一層，該層的圓加深，12 塊側面貼紙沿圓弧移動（帶有取自貼紙顏色的漸隱拖尾），該面自身的 9 塊貼紙在簇內繞中心旋轉，與 3D 轉動嚴格同步。打亂時顏色混雜，還原後變成 6 個緊湊的同色簇。

## 功能

| 模組 | 說明 |
| --- | --- |
| 手動塗色 | 展開圖 + 調色盤，點選 / 拖動連續塗色，色塊計數，復原 / 隨機 / 清空 |
| 公式輸入 | 輸入打亂公式（`R U R' U2 …`，支援中層 `M E S`），按 WCA 標準握法（白頂綠前）從復原狀態應用 |
| 攝像頭掃描 | `getUserMedia` 即時畫面 + 網格疊加 + 即時識別預覽；按引導順序掃 6 面（含方向說明） |
| 照片上傳 | 每一面都可以改為上傳照片；「網格大小」滑塊對齊貼紙 |
| 顏色識別 | 每格取內部中位數 RGB → CIE Lab。掃描中：按典型色即時預覽（奇數階用實測中心顏色校準）；**六面掃完後**（`js/core/color-cluster.js`）：全部 6n² 塊做等容量 k-means（每色恰好 n² 塊，亮度降權）→ 窮舉 6! 種分配給各類定顏色名（奇數階由中心決定）→ 按塊軌道用匈牙利演算法做約束解碼（角塊只能是 8 個合法有向顏色三元組、稜塊 / 翼稜為合法顏色對、每個中心軌道每色定額）→ 重新估計顏色中心再解一次。偶數階（無固定中心）同樣適用 |
| 校驗 | 本地化錯誤資訊（12 種語言，Intl 複數規則）：未上色、中心重複、顏色數量、不存在的塊、重複塊、角塊扭轉、稜塊翻轉、奇偶（兩塊互換） |
| 求解 | 在 Web Worker 中執行。三階：① 雙向 BFS（≤ 8 步時給出可證明的最優解）② Kociemba 兩階段（cubejs）+ 時間預算內迭代縮短，通常 19–21 步。其它謎題見下文 |
| 播放器 | 播放 / 暫停 / 上一步 / 下一步 / 首尾 / 速度 / 可拖動時間線 / 點選任意一步跳轉；鍵盤：空格、←、→；節奏與緩動按參考影片實測 |
| 聲音 | Web Audio 即時合成（無音訊檔案）：真實感轉動聲、還原琶音、展示掃光、塗色輕點、拍攝提示音；可選程式生成的背景音樂；播放欄有「音效 / 音樂 / 音量」，設定儲存在本地 |
| 握法 | 「黃頂綠前」（預設，與參考影片一致）/「白頂綠前（WCA）」：同時切換 3D 朝向與記號，U 永遠是螢幕上的頂層 |
| 演示模式 | 「先打亂，再還原」：從復原狀態播放打亂公式，再播放解法 |
| 響應式 | 手機上 3D 與圖上下堆疊，控制元件自動換行 |
| 多語言 | 12 種語言（English、簡體中文、繁體中文、Español、العربية、Português、Bahasa Indonesia、Bahasa Melayu、Français、日本語、Русский、Deutsch），阿拉伯語完整 RTL；右上角地球圖示切換，選擇儲存在本地 |

## N×N（2×2 – 15×15）

頂部「謎題」選單可選 2×2 … 15×15（也可用 `?n=7`）。所有檢視（展開圖塗色、公式、攝像頭 N×N 網格、three.js 3D、三組 n 個同心圓的置換圖 + 縮放 / 平移、播放器）都按階數生成。

| 階數 | 求解器 | 計數 | 實測（隨機打亂，全部校驗為已復原） |
| --- | --- | --- | --- |
| 2×2 | 自研最優解（完整距離表 3,674,160 態，BFS） | HTM | 100 次：平均 8.87 步，最多 10 步；建表 ≈ 0.3 s，求解 < 1 ms |
| 3×3 | BFS ≤ 8 步最優 + Kociemba 兩階段迭代縮短 | HTM | 通常 19–21 步 |
| 4×4 | 自研降階法（見下）；也可選 gullicube | OBTM | 12 次（Node）：平均 56.8 步，最多 64；建表 ≈ 3.2 s；求解平均 6.9 s（最慢 16 s） |
| 5×5 – 15×15 | gullicube（T. Rokicki，MPL-2.0）編譯為多執行緒 WebAssembly；質量模式 / 快速模式 | SSTM | 見下表 |

gullicube（Node，4 執行緒，與瀏覽器同一份構建；SSTM）：

| n | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 質量模式（--time 16，≈ 10–15 s，首次下載 ≈ 30 MB 表） | 119 | 169 | 257 | 329 | 448 | 563 | 678 | 833 | 981 | 1131 | 1408 |
| 快速模式（--fast，≈ 2–4 s，≈ 0.5 MB 表） | 168 | 281 | 402 | 571 | 695 | 972 | 1130 | 1495 | 1635 | 1950 | 2231 |

低記憶體裝置（`navigator.deviceMemory` < 4 GB）和手機 / 平板在 n ≥ 5 時預設快速模式；求解器選單隨時切換質量 / 速度。多執行緒 WASM 需要跨源隔離：`deploy/_headers` 設定 COOP / COEP / CORP。

**統計**（`js/analytics.js`，只在 cube-solver.org 上執行）：Cloudflare Web Analytics 無 Cookie、對所有人載入；GA4 只在訪客點「接受」後才注入 gtag.js（Consent Mode v2，只授予 `analytics_storage`）。提示列只在同意地區顯示：`deploy/worker.js` 對歐盟/歐洲經濟區、英國、瑞士和未知國家（`request.cf.country` 缺失、`XX`、`T1`）設定 `<html data-consent="1">`，其他地區設定 `data-consent="0"`，此時 GA4 不顯示提示列直接載入（廣告訊號仍為拒絕），頁尾連結仍可選擇「拒絕」，會關閉 GA 並刪除其 Cookie。ETag 帶 `-c1`/`-c0` 後綴，兩個變體永遠不會互相重新驗證。兩者都返回 `Cross-Origin-Resource-Policy: cross-origin` + CORS 頭，因此保留 `require-corp` 也不會破壞跨源隔離。SPA 路由切換（`history.replaceState`）由 CF 的 SPA 模式和 GA4 增強型衡量（基於瀏覽器歷史記錄事件的網頁變化）自動計數，不要再手動發 `page_view`（會重複計數）。測試：`npm run test:analytics`（本地，攔截上報）/ `npm run test:analytics:live`。統計 ID 不進倉庫：`tools/build-dist.js` 從環境變數 `CF_BEACON_TOKEN`、`GA_MEASUREMENT_ID`（或被 git 忽略的 `.env`）讀取，只寫進 `dist/js/analytics.js`；不設定就沒有任何統計、同意提示欄或跟蹤。一切都在 Cloudflare Workers 靜態資源的免費額度內（靜態檔案不按 Worker 請求計費，Worker 只對頁面路由執行）。

**4×4 降階求解器**（`puzzles/nxn/cube4.worker.js`，自寫程式碼；分階段思路參考公開的 Tsai / TPR 類方法，沒有複製任何程式碼）：
1. P1（36 種轉動）：R/L 兩色中心塊到 R/L 面，精確距離表 C(24,8)。
2. P2（外層 + Rw/Lw + Uw2/Dw2/Fw2/Bw2）：U/D 中心到 U/D 面、R/L 軸中心進入可解的 12 種分佈、全部翼稜「定向」（P3 群下 24 個翼稜位置分兩類）、翼稜整體排列為偶（消除 OLL 奇偶）。
3. P3a（U D F B、R2 L2、寬層半轉）：中心進入 P3b 可解子集、E 層 8 塊翼稜回到 E 層，並保證 P3b 可解。
4. P3b（U D、F2 B2 R2 L2、寬層半轉）：中心復原、12 組稜配對、消除 PLL 奇偶。
5. 等價 3×3 交給 Kociemba 兩階段（cubejs）。
每階段 IDA*，在時間預算內嘗試多組前階段候選取最短；相鄰同軸轉動合併。

測試：`node tests/nxn.test.js [4×4 樣本數]`（模型 2–15 階 + 2×2 + 4×4），`node tests/gullicube.test.js 5,7,10,15 both`，線上 `node tests/live-nxn.js <URL>`。

### 預計算表（4×4 與 3×3 求解器）

`npm run build:tables` 生成 `puzzles/nxn/cube4-tables.bin.gz`（1.61 MB，7 張距離表）與 `puzzles/cube3/cubejs-prune.bin.gz`（0.89 MB，cubejs 剪枝表）。格式：`CLT1` + 頭長度 + JSON 目錄（名稱 / 型別 / 長度 / FNV-1a 校驗）+ 原始位元組，gzip 壓縮（`js/core/table-pack.js`）。Worker 下載表的同時計算移動表；瀏覽器用 `DecompressionStream` 解壓並逐表校驗，下載失敗 / 校驗不符 / 瀏覽器不支援時自動回退為現場計算。修改任一求解器的表結構後必須重新執行 `npm run build:tables`（`tests/tables.test.js` 會比較表與現場計算的結果）。

## 自己玩（所有謎題）

舞臺頂部的「求解 / 自己玩」切換（也可用 `?mode=play`）。

| 操作 | 說明 |
|---|---|
| 拖動貼紙（滑鼠 / 觸控） | 轉動該貼紙所在的層。魔方：在該面的兩條座標軸中取投影與拖動方向最一致的一條，轉軸 = 面法線 × 拖動方向；大階魔方按住哪一層就轉哪一層（內層記為 2R、3R…，奇數階正中一層為 M / E / S）。其它謎題用 `dragMoves`（見下）。觸控時畫布 `touch-action: none`，頁面不滾動 |
| 拖動空白處 | 旋轉視角（雙擊復位） |
| 鍵盤 | `U D L R F B`（Shift = 逆時針）；數字字首選層（`2` `R` → 2R）；`w` 字首為寬層（`3` `w` `R` → 3Rw）；奇數階 `M E S`；`x y z` 整體轉動（2×2 與 4×4+）；Ctrl+Z / 退格撤銷，Ctrl+Y / Ctrl+Shift+Z 重做；Esc 清除字首。記號按當前握法（螢幕上的頂層永遠是 U） |
| 公式框 | 輸入任意公式（3Rw、2R、M/E/S…），回車執行，逐步動畫 |
| 打亂 | 2×2 / 3×3：均勻隨機狀態（`CubeLab.play.randomState`）；4×4 以上：隨機轉動；金字塔 / 斜轉：均勻隨機狀態；五魔方：WCA（Pochmann）打亂 |
| 計時 | 打亂後第一次（非整體）轉動開始計時，還原時停止；可選 WCA 15 秒觀察（超 15 秒 +2，超 17 秒 DNF） |
| 計步 | 3×3 及以下 STM，4×4 以上 BTM（整體轉動不計）；金字塔 / 斜轉 VTM；五魔方 HTM |
| 撤銷 / 重做 / 復原 / 從當前狀態求解 | 「求解」切回求解模式，用當前狀態求解並照常播放（本次不計成績） |

- 每種謎題的最好成績儲存在 `localStorage`（`cubelab.best.<謎題>`）。還原時有輕微高亮 + 還原音效（遵循音效開關）+ 一圈展示翻轉（遵循自動旋轉開關）。
- 實現：`js/core/play-core.js`（純邏輯，可在 Node 中測試）、`Player.pushMove / popMove`（排隊動畫，積壓時自動加速，不丟步）、`View3D.pick / dragTurn / setPlayMode`、`app.js` 中的模式控制。圖檢視與 3D 同步逐步更新。

## 金字塔（Pyraminx）與斜轉（Skewb）

兩者都是完整外掛（`puzzles/twisty/`）：模型、校驗、3D、展開圖編輯、圖檢視、嚴格最優求解、自己玩，12 種語言。

- **模型**（`twisty-model.js`，頁面 / Worker / Node 共用）：貼紙由幾何生成（金字塔每面 9 個三角形；斜轉每面 1 個方塊 + 4 個角三角形）；每個轉動的置換 = 把層內貼紙的質心與法線繞軸轉 120° 後找回貼紙。WCA 記號：金字塔 `U L R B`（兩層）+ `u l r b`（頂角）；斜轉 `R U L B`（R = 右下后角、U = 左上后角、L = 左下前角、B = 左下后角；右上前角固定）。
- **最優求解**（`twisty.worker.js?p=…`）：顏色狀態 → 塊 + 朝向，按塊類別分成獨立分量；先 BFS 每個分量的可達集合與轉動表，再在乘積空間上做完整 BFS（`Uint8Array` 距離表）；解沿距離表下降，長度恰為最短距離（VTM：每次 120° 轉動計 1 步）。金字塔頂角與所有轉動可交換，最後各用 0 / 1 步補齊（仍為最優）。

| | 狀態數（核心） | 分量 | 實測上帝之數 | 距離表 | 構建（Node / 瀏覽器含 Worker 啟動） | 單次求解 |
|---|---|---|---|---|---|---|
| 金字塔 | 933,120（× 頂角 81 = 75,582,720） | 稜 11,520 × 軸心 81 | 11（含頂角 15） | 0.93 MB | ≈ 60 ms / ≈ 250 ms | ≈ 0.03 ms |
| 斜轉 | 3,149,280 | 中心 360 × 角 8,748 | 11（90 個最遠態） | 3.15 MB | ≈ 180 ms / ≈ 400 ms | ≈ 0.01 ms |

  距離表在瀏覽器裡現場構建（比下載壓縮表還快），不需要額外資原始檔。`tests/twisty.test.js` 驗證：所有轉動 3 次 = 恆等、與逆轉動相消、塊整體移動；分量乘積 = BFS 可達數（分量相互獨立）；每層計數；距離表是一致的 BFS 分層；隨機狀態求解後復原且步數 = 表中距離；校驗器拒絕翻稜 / 扭角 / 兩塊互換 / 不存在的顏色組合 / 握法錯誤。
- **3D**：每塊是實心凸多面體（外形 ∩ 各切割平面的半空間：金字塔每個頂點兩個切面，斜轉 4 個過中心的切面）；轉動時整層繞軸轉，切面在自身平面內滑動，不會互相穿插；貼紙是內縮 + 圓角的三角形 / 方塊。
- **圖檢視**：每個 120° 轉動的貼紙軌道都是 3-輪換，畫成過 3 個節點的圓。金字塔節點 = 展開圖上的貼紙中心（U / L / R 三個頂點各是一組同心圓的圓心，B 層的圓環繞整張展開圖）；斜轉用從 DBL 角方向的等距方位投影（B 層是同心圓，R / U / L 組成三片花瓣）。
- **展開圖編輯**：SVG 多邊形（點選 / 拖動塗色、鍵盤 Enter 塗色、錯誤標紅）。金字塔：前面居中、左右面在兩側、底面在下；斜轉：與魔方相同的十字展開。
- **自己玩**：拖動貼紙 = 在各候選轉動中取該貼紙瞬時速度與拖動方向最一致者（同軸時取塊數少的：拖頂角只轉頂角）；鍵盤 `U L R B` / `R U L B`（Shift = 逆時針），金字塔先按 `T` 再按字母 = 頂角；打亂 = 均勻隨機狀態；計時 / 最好成績同魔方。
- **攝像頭 / 照片識別**：暫不支援（三角形 / 菱形貼紙需要新的取樣網格與塊約束配色）；這兩個謎題會隱藏掃描選項卡並提示手動塗色。

## 五魔方（Megaminx）

完整外掛，位於 `puzzles/megaminx/`（自寫程式碼，MIT）：`megaminx-model.js`（幾何、轉動、校驗；頁面 / Worker / Node 共用）、`megaminx.js`（外掛：3D、展開圖、圖檢視、記號、自己玩）、`megaminx-solver.js`（多階段求解器）、`megaminx.worker.js`，以及 `megaminx-ll.json`（頂層公式表，由 `tools/megaminx-ll-gen.js` 離線生成）。

- **模型**：12 面 × 11 塊貼紙 = 132 塊貼紙，62 個塊（12 中心、30 稜、20 角）。面轉動 `U F R L BL BR D DR DL B FL FR`，字尾 `X X' X2 X2'`（72° / 144°，從該面看順時針）；WCA Pochmann 轉動 `R++ R-- D++ D--`（除 L / U 層外整體轉 144°）。每個轉動的置換由旋轉貼紙質心與法線得到。校驗：顏色數量、不存在或重複的塊、扭角、翻稜、排列奇偶、中心排列（`v.megaCenters`）。
- **求解器**（多階段，不是最優解，WCA 風格 HTM：任一面轉 72° 或 144° 都計 1 步）：
  1. 校驗後整體旋轉 / 重新標色，使中心符合標準配色，再轉換成塊程式碼（角：槽位 × 3 種朝向，稜：槽位 × 2）。
  2. **F2L，逐面完成**：D、D 周圍的五個環面，然後五個上層面中的四個。某面的塊全部歸位後，此後不再轉動該面，轉動集合 S 逐步縮小，未接觸的塊自動保持。每一步的新塊被分成小組（≤ 3 塊：一個角塊及其相鄰稜塊）；每組用 IDA* 求解，啟發值取若干小型塊組距離表（在當前 S 下 BFS，首次使用時構建並快取）的最大值。最後的二面步驟之前加入一張稜朝向表（類似三階 `<R,U>` 的 EO），使該步可以只用兩個面完成。節點預算 + 重試（改用上一組的下一個解）讓少數慢的情況也很快結束。
  3. **頂層兩步查表**：第一步 = 稜排列 + 稜朝向 + 角朝向（60 · 16 · 81 = 77,760 態），第二步 = 角排列 × 稜排列（3,600 態）。生成器在 `<U,X,Y>` 三面子群中做 meet-in-the-middle（每側 ≤ 7 步），找出保持所有非 U 塊不動的序列，每種效果保留最短公式及其 5 個繞 U 旋轉的版本（共 39,059 條），再用 HTM 代價做 Dijkstra。
  4. 合併相鄰同面轉動（以 72° 為單位 mod 5）。
- **實測**（Node，`tests/megaminx.test.js` / 基準）：1,000 個隨機狀態全部復原：平均 120.1 步 HTM（F2L 95.4 + 頂層 26.4），最多 135，最少 97；求解平均 34 ms，最慢 1.6 s。500 個 Pochmann 打亂：平均 119.7，最多 135，平均 29 ms，最慢 0.9 s。瀏覽器裡一次求解通常 2–20 ms 加上 Worker 開銷；Worker 啟動 + 載入表 ≈ 170–200 ms。這些數字寫在 `seo/site.config.json` 中並顯示在 SEO 頁面上。
- **3D**：`view3d.geometry: 'poly'`，正十二面體作為 `solid`，12 個切割平面作為 `cuts`；每塊是凸多面體。
- **圖檢視**：從 D 面中心對貼紙位置做球極投影（該節點隱藏）。每個 72° 面轉動把貼紙分成若干 5-輪換，每個輪換的 5 個點在投影中落在同一個圓上（球極投影把圓對映為圓），所以每條軌道畫成其 5-輪換的外接圓：39 個圓、131 個可見節點。白色 U 面在正中，上層各面環繞四周，下層各面是外側的大花瓣；可放大檢視中間部分。
- **展開圖編輯**：兩朵並排的「花」，每朵 6 個五邊形（U 及其 5 個相鄰面、D 及其 5 個相鄰面），與其它異形一樣使用 SVG 多邊形。
- **自己玩**：拖動（通用 `dragMoves`），鍵盤 `U F R L B D` 以及 `I`=BL、`O`=BR、`J`=FL、`K`=FR、`N`=DL、`M`=DR（Shift = 逆時針）；HTM 計步；打亂 = 77 步 WCA Pochmann 打亂（7 行，每行 `R±± D±±` × 5 + `U`/`U'`）；「從當前狀態求解」與其它謎題相同。
- **攝像頭掃描**：隱藏（`cameraPlan: null`）。
- **名稱**：五魔方（中文）、メガミンクス（日語）、Мегаминкс（俄語）、ميغامينكس（阿拉伯語），其它語言為 Megaminx；選單中排在斜轉之後。

## SEO：每種謎題 × 每種語言一個靜態頁面

- **唯一配置**：`seo/site.config.json`（`baseUrl` = 正式站點地址；canonical / hreflang / sitemap / OG 全部由它生成，換域名只改這一處後重跑生成指令碼）以及實測步數。
- **路由**（`js/seo-routes.js`，瀏覽器與構建指令碼共用）：英語在根路徑，其它語言在 `/<語言>/` 下；每種謎題一個乾淨路徑：`/`（總入口，x-default）、`/2x2-cube-solver/` … `/15x15-cube-solver/`、`/pyraminx-solver/`、`/skewb-solver/`、`/megaminx-solver/`；例如 `/zh-hans/3x3-cube-solver/`、`/ja/megaminx-solver/`。共 12 語言 × 18 = 216 頁。
- **文案**：`seo/lang/<code>.json`（12 種語言，按當地搜尋習慣寫標題），按謎題型別套模板並填入實測步數。
- **生成**：`npm run build:seo`（`tools/build-seo.js`）在 `index.html` 的 `<!--seo:*-->` 標記之間寫入英語根頁面，其餘頁面寫入 `seo/out/`，同時生成 `robots.txt`、`sitemap.xml`（含 xhtml:link 多語言互鏈）、`manifest.webmanifest`；給 HTML 引用的 js/css 加 `?v=<內容雜湊>`。圖示與 OG 圖（1200×630，每種謎題一張，取自真實 3D + 置換圖截圖）：`npm run build:seo-images`（需本地伺服器；`OG_ONLY=root,megaminx` 只生成部分圖片）。
- **每頁內容**：標題 / 描述 / canonical / 13 條 hreflang（含 x-default）/ OG / Twitter 卡片 / 圖示 / manifest / JSON-LD（WebSite、WebApplication（免費，無評分）、WebPage、BreadcrumbList、HowTo、FAQPage，與頁面可見文字逐字一致）、靜態 `<h1>`、可抓取正文（使用步驟、求解器與實測步數、記號、置換圖說明、FAQ、所有謎題的內鏈）、`<noscript>` 提示。
- **執行時**（`js/seo-nav.js`）：頁面通過 `<html data-page-lang data-page-puzzle>` 預選語言和謎題；在應用裡切換謎題或語言時用 `history.replaceState` 換到對應的乾淨 URL，並從預渲染頁取回標題 / meta / JSON-LD / 正文，不重新整理、不丟狀態。根路徑 `/` 仍按瀏覽器語言 / 上次選擇顯示。
- **舊連結**：`/?puzzle=…`、`/?n=…`、`/?lang=…` 由 `deploy/worker.js`（只對頁面路由執行，靜態資源由 `run_worker_first` 排除；沒有 `?lang` 時按 Accept-Language 選語言，`Vary: Accept-Language`）301 到新路徑，其它引數（`mode`、`hold`、`start`）保留；本地無 Worker 時由 `seo-nav.js` 在客戶端改寫地址。
- **測試**：`node tests/seo.test.js`（靜態：216 頁的 title/description 唯一、canonical、hreflang 完整互鏈、JSON-LD 可解析且與可見內容一致、無評分、OG 圖尺寸、內鏈、sitemap/robots/manifest、Worker 重定向）；`npm run test:seo:live` 對線上逐頁檢查。

## 執行

```bash
cd cube-solver
npm install
npm start                        # node tests/serve.js 8765 (sends COOP/COEP headers)
# open http://localhost:8765/
```

> 攝像頭需要**安全上下文**：`https://` 或 `http://localhost`。通過區域網 IP（如 `http://192.168.x.x`）開啟時瀏覽器會停用攝像頭，此時請使用「上傳照片」。
> Web Worker 不能在 `file://` 下執行，請務必通過 HTTP 伺服器開啟。

## 測試

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

E2E 覆蓋：隨機打亂 → 求解 → 播放到結尾（圖檢視 6 簇同色、3D 每面同色）、播放器 seek / prev / next、手動塗色與各類校驗錯誤、公式輸入、合成照片 6 面識別（偏色 / 光照梯度 / 噪點 / 反光）、Chromium 假攝像頭路徑、移動端佈局與截圖。`tests/graph-preview.html` 是除錯圖佈局的獨立頁面（`?scr=公式&mv=R&e=0.5`）。`node tests/compare-ref.js` 把與參考影片幀（`ref/f14`、`f07`、`f01`）的並排對比寫入 `screenshots/compare-*.png`；`tests/graph-pixel.html` 以參考幀的畫素對映渲染圖檢視，用於逐畫素疊加比對。

## 目錄結構

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

## 擴充套件點（架構）

核心模組（輸入、圖檢視、3D、播放器、掃描、求解客戶端）**只**通過 `CubeLab.registerPuzzle(def)` 註冊的 Puzzle 物件工作，不含任何三階專屬邏輯。新謎題放在 `puzzles/<id>/` 並實現下列介面即可。

### Puzzle 介面

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

註冊時核心會自動補齊：預設的 `parse / format / apply / inverse / isSolved`、每個轉動參與旋轉的塊（由 `layer` 判定）、**圖軌道**（`P.tracks`）以及每個轉動的貼紙路徑（`moves[tok].paths`）。

異形謎題用到的可選欄位：`trackMode: 'cycles'`（軌道 = 基礎轉動置換的輪換）、`netLayout.polys`（SVG 多邊形展開圖）、`view3d.geometry: 'poly'` + `solid` / `cuts` / `core`（凸多面體塊體）、`dragMoves`（通用拖動）、`playKeys` / `playMetric` / `metricTitle`、`hints`（各處提示的 i18n 鍵）、`randomState(rnd)`（均勻隨機狀態）、`randomScramble()`、`nameKey`；`cameraPlan: null` 時隱藏掃描選項卡，沒有 `holds` 時隱藏握法選單。

### 圖軌道與運動（`CubeLab.buildTracks` + `GraphView`）

對每個基礎轉動：取被移動的貼紙，按「貼紙法線 · 轉軸」分組（三階上即「本面 8 塊」與「側面 12 塊」），組內按繞軸角度排序得到閉合環；轉動角度為 θ 時，環上的貼紙前進 `θ/2π × n` 格，並與 `perm` 交叉校驗。

外掛的 `graphLayout()` 提供節點二維座標，並可選提供 `circles: [{id, cx, cy, r}]`：
- 若某條側面軌道的全部節點都落在某個圓上，節點就**沿該圓**運動（同軌道同向；方向取基礎轉動下總行程最短者，逆轉動反向），並繪製顏色拖尾；
- 「本面」軌道的節點繞該面中心節點做極座標插值（簇整體旋轉）；
- 沒有圓時退回為穿過節點的閉合樣條，所以其它謎題即使沒有手工佈局也能直接視覺化。

**三階佈局**（`puzzles/cube3/cube3.js` 中的 `GL` 配置）：三組同心圓分別對應 y（U/E/D）、z（F/S/B）、x（R/M/L）三個軸，圓心在正三角形三個頂點（上、左下、右下），半徑 1.3922 / 1.7696 / 2.1469（三角形外接圓半徑為 1）。這些數值是對參考影片高畫質幀中**全部 54 個節點**做最小二乘擬合得到的（殘差均方根 0.2 px）；節點半徑 0.184、描邊 0.048、軌道線寬 0.063、高亮線寬 0.076 也來自同一幀的畫素測量。按參考幀的畫素對映渲染後與原幀 50% 疊加，圓環與節點幾乎完全重合（`tests/graph-pixel.html`）。面 X 的貼紙位於「X 法線以外兩個軸」兩組圓的交點；兩個交點區域正好容納一對相對面。層 → 半徑的方向（`sign`）與每個面取哪個交點區域（`upper`）經過窮舉（64 種組合）驗證：六個面轉動都是 12 個節點在單個圓上的迴圈平移。中層轉動 M/E/S 是真正的轉動（`moves` 中由幾何生成；同一生成器能精確復現 6 個面轉動的置換，由單元測試檢查），各自沿本組的中間圓運動。求解器只輸出面轉動。

**弧線路由（與參考影片逐幀核對）**：每個圓上 12 個節點分屬 4 個面區，間隔約 60°/60°/60°/180°。按「總行程最短」定方向時，90° 轉動中有 9 塊貼紙走 ≈ 60° 的短弧，**一個面區的 3 塊跨越 180° 的空弧**（例如外圈上方弧、左下組圓的左側大弧）。參考影片的做法完全相同（`screenshots/compare-motion.png` 第二行）。面區位置由「已還原佈局 = 參考 f14」唯一確定，因此不存在讓所有弧都變短的其它分配。

**時間與緩動（參考影片 60fps 運動能量實測）**：
- 單步緩動 `easeInOutQuad`（擬合 15 次轉動的平均速度曲線，RMS 0.076；sine 0.155，cubic 0.193）；
- 連續播放時整段「慢起 – 加速 – 慢收」：首步 ≈ 0.85 s、中段 0.48 s、末步 ≈ 1.0 s，兩步之間僅 ≈ 0.07 s 停頓（`CubeLab.tempo(i, n)`，`Player.baseMs = 480`，`gapMs = 67`；單步「下一步」固定 0.55 s）；
- 活動圓高亮在轉動前 8% 淡入、最後 16% 淡出；彩色拖尾從節點向後延伸（尾部相位 `ease(1.6t − 0.6)`），結束時消失；
- 還原後靜止 ≈ 1.2 s，再做 2.0 s 的展示翻轉。

### 握法（記號視角）

內部狀態、求解器、公式輸入始終使用 WCA 標準握法（白 U、綠 F）。外掛可提供 `holds`：每個握法給出 3D 整體朝向和記號重新命名表。三階預設「黃頂綠前」= 標準握法繞前後軸轉 180°（z2）：`U↔D`、`R↔L`、`F/B` 不變，`M→M′`、`E→E′`、`S` 不變（單元測試逐個驗證：內部轉動的「軸 × 角」經朝向旋轉後等於顯示記號的「軸 × 角」）。解法文本、播放器當前步、步驟列表和說明都使用當前握法的記號，所以螢幕上的頂層叫 U。

### 3D 風格與視角

- `view3d.style: 'plastic'`：淺灰塊體 + 白色面板（形成淺灰細縫）+ 圓角純色貼紙（不受光照，顏色與圖檢視一致）+ 塊體柔和明暗；省略則為黑色塊體的經典扁平風格。
- `stickerCorners: [左上, 右上, 右下, 左下]`：貼紙圓角（可設成不對稱的葉形）；`stickerColors` 可單獨覆蓋 3D 貼紙顏色。
- `orientation`（尤拉角，由當前握法覆蓋）+ `camera: { fov, dir }`：三階預設視角與參考影片一致 —— 黃色（D）朝上、綠色（F）在左、橙色（L）在右，正好對應置換圖中間三角形的三個簇。透視 FOV 24°、仰角約 25°，經與參考幀逐畫素對比調整。
- `frame: { width, height, dx, dy }`：取景（模型 / 圖在各自半邊面板中的大小與偏移），與參考影片實測一致，誤差 < 0.5%。
- `autoRotate`：播放時模型輕微擺動；播放到結尾且已還原時，靜止 `showcaseDelay`（1.2 s）後做 `showcaseMs`（2.0 s）的一整圈展示翻轉再回到初始視角（同參考影片結尾）。播放器上的「自動旋轉」開關可關閉；拖動旋轉、雙擊復位始終可用。

### 聲音（`js/core/audio.js`，`CubeLab.SoundEngine`）

全部用 Web Audio API 即時合成，不含任何音訊檔案或第三方素材。
- **自動播放策略**：頁面載入時不建立 `AudioContext`；第一次 `pointerdown / keydown / touchstart` 時才建立並 `resume()`。預設音效開、音樂關；「音效 / 音樂 / 音量」儲存在 `localStorage`（`cubelab.sfx / cubelab.music / cubelab.vol`）。若重新整理前音樂是開的，會等到下一次使用者手勢才開始。不支援 Web Audio 的瀏覽器中所有呼叫都是空操作，控制元件顯示為停用。
- **轉動音效 v3**（`Player.onMove(phase, tok, durMs)` 鉤子）：按三段真實三階錄音的分析重做（見 `user-sounds/ANALYSIS.md`、`screenshots/sound-compare.png`）。真實轉動 = 120–200 ms 的一串成簇塑膠顆粒（≈ 每 5 ms 一顆），激勵塊體的短促模態：主峰 0.86–1.1 kHz（「空心 / 木質」）+ 500 Hz、1.55、2.8、4.1 kHz，振鈴僅 3–6 ms，幾乎沒有 300 Hz 以下的「咚」；能量逐漸增強到落位那一下最響，之後 70–100 ms 漸弱的餘響。合成：JS 生成顆粒事件 → 10 個二階諧振器（每顆隨機激勵不同模態）+ 細密微顆粒層 + 極輕摩擦 + 寬頻直達邊緣；落位主咔對齊動畫結束，慢速播放時聲音集中在末段，180° 在 T/2 有過卡位咔，中層更輕更暗；每次 1.7–3.3 ms 生成。與真實錄音（SpaceJoe / Pixabay 素材，同一套分析）對比：質心 2141 Hz vs 2135 / 2077 Hz，峰值因數 20.7 vs 21.1 / 17.6 dB，平坦度 0.24 vs 0.25 / 0.32，顆粒 18.5 vs 17.8 / 12.0 每 100 ms，三分之一倍頻程形狀差 ≈ 2 dB。不釋出任何音訊檔案（錄音只用於分析，許可見 `vendor/sounds/LICENSE.txt`）。快放保護：兩次轉動聲至少間隔 50 ms；轉動越短越輕、顆粒越少；拖動時間線時未播完的轉動聲立即停止。
- **還原**：上行大調琶音 + 和絃（播放到最後一步且已還原時）；**展示翻轉**開始時（`View3D.onShowcaseStart`）一段柔和的上掃閃光。
- **介面**：塗色輕點（隨顏色變音高，拖動連續塗色時限流）、拍攝 / 上傳識別成功提示音（六面完成時三聲）。
- **背景音樂**：72 BPM，Cmaj9 – Am9 – Fmaj9 – G6sus 四小節迴圈；失諧鋸齒波經低通的鋪底 + 五聲音階琶音（確定性偽隨機），反饋延遲營造空間感；前瞻排程（每 150 ms 預排 0.6 s），無縫迴圈，開關時淡入淡出，音量很低。
- 電平（音量 0.8，離線渲染實測）：1× 單步轉動峰值約 0.31–0.36，真實手速（130 ms）約 0.22，還原琶音約 0.23，背景音樂峰值約 −22 dBFS。試聽（僅本地）：`screenshots/sound-demo-turns.wav`、`sound-demo-turns-v3.wav`、`sound-demo-sfx.wav`、`sound-demo-music.wav`。

### 多語言（`js/i18n/`，`CubeLab.i18n`）

- **語言與順序**：English、簡體中文、繁體中文、Español、العربية、Português、Bahasa Indonesia、Bahasa Melayu、Français、日本語、Русский、Deutsch（選單中全部為同級選項，無分組）。
- **文案**：每種語言一個檔案 `js/i18n/<code>.js`，呼叫 `CubeLab.i18n.register(code, {key: text})`；`en.js` 是主表，缺失的鍵回退到英文並記錄在 `CubeLab.i18n.missing`。HTML 用 `data-i18n` / `data-i18n-title` / `data-i18n-aria` / `data-i18n-placeholder`；動態文本用 `I.bind(el, key, params)`，切換語言時自動重渲染。
- **格式**：ICU 子集 `{name}`、`{n, plural, =0 {…} one {# …} few {…} many {…} other {…}}`（`Intl.PluralRules`）、`{ms, unit, millisecond}`、`{x, number}`（`Intl.NumberFormat`）。法語自動在 `: ; ! ? « »` 處插入不換行空格；西語使用 ¡ ¿。轉動記號在所有語言中都保持標準字母（U D L R F B M E S，′ 2）。
- **檢測順序**：`?lang=xx` → `localStorage['cubelab.lang']` → `navigator.languages`（zh-TW/HK/MO/Hant → 繁體，其它 zh → 簡體）→ English。設定 `<html lang dir>`、標題與 meta description。
- **RTL**：阿拉伯語整頁映象（CSS 邏輯屬性），3D 畫布、置換圖、時間線 / 播放控制元件、步驟條、記號、公式輸入與數字保持 LTR（`dir="ltr"`）。
- **排版**：CJK / 阿拉伯語使用各自字型棧與更大的行高、取消字間距；德語 / 俄語啟用 `hyphens:auto`，按鈕允許換行而不溢位。
- **新增語言**：在 `i18n.js` 的 `LANGS` 中加一項，新建 `js/i18n/<code>.js` 並在 `index.html` 引入，然後執行 `node tests/i18n.unit.test.js`。

### 求解器介面卡

```js
solvers: [
  { id: 'kociemba', name: '…', available: true,
    workerUrl: 'puzzles/cube3/kociemba.worker.js',
    encode: state => payload },          // runs on the main thread; throws a localized error for invalid states
  { id: 'optimal-ida', name: 'IDA* optimal (planned)', available: false }
]
```

Worker 協議：

```
→ { id, cmd: 'init' }                      ← { id, ok: true, ms }
→ { id, cmd: 'solve', payload }            ← { id, ok: true, moves: ['R', "U'", ...], optimal?: bool, label?, note?, ms }
                                           ← { id, ok: false, error }
```

一個謎題可以有多個求解器，選單會自動列出；`available: false` 的顯示為「規劃中」。加入真正的最優求解器（如 Korf IDA* + 角塊 / 稜塊模式資料庫）時，只需新增一個 Worker 並在 `solvers` 中登記。Worker 可以返回 `optimal: false` 以及 `label` / `note` i18n 鍵（五魔方就是這樣），介面會顯示在步數旁邊。

### 其它檢視

播放器（`CubeLab.Player`）驅動任意數量的檢視，檢視只需實現 `setState(state)` 和 `animate(tok, e, fromState, t)`（e 為 0–1 的緩動進度，t 為原始時間相位），可選 `highlight(tok, state)`。新增視覺化（例如 Cayley 圖、輪換圖）只需實現這些方法。

## 第三方庫

- [gullicube](https://github.com/rokicki/gullicube)（Tomas Rokicki，按 MPL-2.0 選項使用，原始碼未修改，見 `vendor/gullicube/NOTICE.md`）
- [cubejs](https://github.com/ldez/cubejs)（MIT）— Kociemba 兩階段演算法。`vendor/solve.js` 有一處小補丁（`vendor/solve.js.cubelab.patch`）：為 `solve(maxDepth, deadline)` 增加可選截止時間，無解時丟擲異常而非返回 null 崩潰，用於在時間預算內迭代縮短解法。
- [three.js](https://threejs.org/) r160（MIT）— 3D 渲染（UMD 版 `three.min.js`，控制台會提示該構建已棄用，不影響使用）。
- 金字塔、斜轉、五魔方求解器以及五魔方頂層公式表都是本專案自寫的程式碼和資料（MIT），沒有使用任何 GPL 程式碼、csTimer 或 TPR 的程式碼。

## 已知限制

- 金字塔 / 斜轉 / 五魔方暫不支援攝像頭 / 照片識別；塗色時需按提示的方向拿（金字塔：不含黃色的軸心塊在上、不含綠色的在後；斜轉：白-綠-紅角在右上前；五魔方：中心必須構成標準配色），否則會提示握法 / 中心錯誤。
- 五魔方的解**不是最優解**（平均 ≈ 120 步 HTM，最多 ≈ 135）；偶爾較難的狀態需要 ≈ 1.6 s；1.8 MB 的頂層公式表（`megaminx-ll.json`，傳輸時壓縮）在五魔方求解器啟動時下載一次。
- 攝像頭需 HTTPS 或 localhost；識別依賴光照，強反光 / 偏黃光源下請在展開圖上手動修正（中心塊顏色用於校準，能抵抗一定偏色）。
- 掃描假定標準配色（白對黃、綠對藍、紅對橙）並按引導方向持握；中心塊在編輯器中固定。
- 三階求解器只輸出面轉動（HTM）；參考影片的解法裡含中層轉動，所以同一狀態下的步驟序列不會與影片逐步相同。
- 兩階段演算法給出的是近最優解（通常 19–21 步），只有 ≤ 8 步的狀態會給出可證明的最優解；真正的「上帝之數」級最優求解器留作擴充套件。
