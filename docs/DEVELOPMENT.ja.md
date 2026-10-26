[English](DEVELOPMENT.md) · [简体中文](DEVELOPMENT.zh-Hans.md) · [繁體中文](DEVELOPMENT.zh-Hant.md) · **日本語** · [Español](DEVELOPMENT.es.md) · [Português](DEVELOPMENT.pt.md) · [Français](DEVELOPMENT.fr.md) · [Deutsch](DEVELOPMENT.de.md) · [Русский](DEVELOPMENT.ru.md) · [العربية](DEVELOPMENT.ar.md) · [Bahasa Indonesia](DEVELOPMENT.id.md) · [Bahasa Melayu](DEVELOPMENT.ms.md)

# Cube Solver Lab（CubeLab）· 開発者向けノート

> 開発者向けの詳細な説明です。英語版（[DEVELOPMENT.md](DEVELOPMENT.md)）が正本で、この翻訳はその内容に従います。プロジェクトの概要、実行、テスト、デプロイ、ライセンス、プライバシーは [README](../README.ja.md) を参照してください。
> 以下に出てくる `ref/`（参考動画のフレーム）と `screenshots/`（テストのスクリーンショット出力）はリポジトリに含まれません。スクリーンショット用フォルダーはテスト実行時に作成されます。

純粋なフロントエンド（静的 HTML/CSS/JS、バックエンドなし）のパズルソルバーです。最大の特徴は**グラフビュー**で、3D パズルの隣に、すべてのステッカーをノードとする「置換グラフ」を表示します。3×3 では**3 組の同心円**（1 組 3 円 = 1 軸の 3 層。中心は正三角形をなし、三回対称の花びら模様になる）で、54 個のノードは円同士の交点にあります。回すたびにその層の円が濃くなり、側面の 12 枚のステッカーが円弧に沿って移動し（ステッカー色のフェードする軌跡付き）、回した面の 9 枚はクラスター内で回転します。3D の回転と完全に同期します。崩れた状態では色が混ざり、揃うと 6 つのまとまった単色クラスターになります。

## 機能

| モジュール | 説明 |
| --- | --- |
| 色塗り | 展開図 + パレット、クリック / ドラッグで塗る、色の数、リセット / ランダム / クリア |
| 手順入力 | スクランブル（`R U R' U2 …`、スライス `M E S` 対応）を入力し、WCA の持ち方（白上・緑前）で完成状態から適用 |
| カメラスキャン | `getUserMedia` のライブ映像 + グリッド表示 + ライブ認識プレビュー。6 面を案内された順序で（向きのヒント付き） |
| 写真アップロード | どの面も写真のアップロードで代用可能。「グリッドサイズ」スライダーでステッカーに合わせる |
| 色認識 | 各セル内部の RGB 中央値 → CIE Lab。スキャン中：典型色に対するライブプレビュー（奇数サイズは実測したセンターで補正）。**6 面すべての後**（`js/core/color-cluster.js`）：全 6n² セルに容量均等 k-means（各色ちょうど n²、明度の重みを下げる）→ 6! 通りの割り当てを試して色名を決定（奇数サイズはセンターで固定）→ パーツ軌道ごとにハンガリアン法で制約付き復号（コーナーは 8 通りの正しい向き付き 3 色、エッジ / ウイングは正しい 2 色、センター軌道は色ごとに定数）→ 色の中心を再推定してもう一度解く。偶数サイズ（固定センターなし）にも対応 |
| 検証 | ローカライズされたメッセージ（12 言語、Intl の複数形規則）：未塗装、センター重複、色の数、存在しないパーツ、重複パーツ、ねじれたコーナー、反転したエッジ、パリティ（2 パーツの入れ替え） |
| 解法 | Web Worker 内で実行。3×3：① 双方向 BFS（8 手以下なら最適を証明）② Kociemba 二段階法（cubejs）を時間内で反復短縮、通常 19–21 手。他のパズルは後述 |
| プレーヤー | 再生 / 一時停止 / 前 / 次 / 最初 / 最後 / 速度 / ドラッグできるタイムライン / 任意の手順をクリック。キー：Space、←、→。テンポとイージングは参考動画から測定 |
| サウンド | Web Audio でリアルタイム合成（音声ファイルなし）：リアルな回転音、完成時のアルペジオ、ショーケースのスイープ、塗りのクリック、撮影の合図。生成された BGM（任意）。プレーヤーバーに「効果音 / 音楽 / 音量」、ローカルに保存 |
| 持ち方 | 「黄上・緑前」（既定、参考動画と同じ）/「白上・緑前（WCA）」：3D の向きと記号の両方を切り替えるので、画面上の上の層は常に U |
| デモモード | 「先にスクランブル、次に解く」：完成状態からスクランブルを再生し、続けて解法を再生 |
| レスポンシブ | スマートフォンでは 3D とグラフが縦に並び、操作部は折り返す |
| 言語 | 12 言語（English、简体中文、繁體中文、Español、العربية、Português、Bahasa Indonesia、Bahasa Melayu、Français、日本語、Русский、Deutsch）、アラビア語は完全 RTL。右上の地球アイコンで切り替え、選択はローカルに保存 |

## N×N（2×2 – 15×15）

上部の「パズル」メニューで 2×2 … 15×15 を選べます（`?n=7` も可）。すべてのビュー（展開図の色塗り、手順、カメラの N×N グリッド、three.js の 3D、n 個の同心円 3 組のグラフ + ズーム / パン、プレーヤー）はサイズごとに生成されます。

| サイズ | ソルバー | 手数の数え方 | 実測（ランダムスクランブル、すべて完成を確認） |
| --- | --- | --- | --- |
| 2×2 | 自作の最適ソルバー（完全な距離表、3,674,160 状態、BFS） | HTM | 100 回：平均 8.87、最大 10。表 ≈ 0.3 s、解法 < 1 ms |
| 3×3 | BFS（8 手以下で最適）+ Kociemba 二段階法と短縮 | HTM | 通常 19–21 手 |
| 4×4 | 自作のリダクション法（後述）。gullicube も選択可 | OBTM | 12 回（Node）：平均 56.8、最大 64。表 ≈ 3.2 s、解法平均 6.9 s（最遅 16 s） |
| 5×5 – 15×15 | gullicube（T. Rokicki、MPL-2.0）をマルチスレッド WebAssembly にコンパイル。品質 / 高速モード | SSTM | 下表参照 |

gullicube（Node、4 スレッド、ブラウザーと同じビルド。SSTM）：

| n | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 品質（--time 16、≈ 10–15 s、初回は表を ≈ 30 MB ダウンロード） | 119 | 169 | 257 | 329 | 448 | 563 | 678 | 833 | 981 | 1131 | 1408 |
| 高速（--fast、≈ 2–4 s、表 ≈ 0.5 MB） | 168 | 281 | 402 | 571 | 695 | 972 | 1130 | 1495 | 1635 | 1950 | 2231 |

メモリの少ない端末（`navigator.deviceMemory` < 4 GB）とスマートフォン / タブレットでは、n ≥ 5 で既定が高速モードになります。ソルバーメニューでいつでも品質 / 速度を切り替えられます。マルチスレッド WASM にはクロスオリジン分離が必要で、`deploy/_headers` が COOP / COEP / CORP を設定します。

**アクセス解析**（`js/analytics.js`、cube-solver.org 上でのみ動作）：Cloudflare Web Analytics は Cookie を使わず、全員に読み込まれます。GA4 は訪問者が「同意する」を押した後にだけ gtag.js を挿入します（Consent Mode v2、許可するのは `analytics_storage` のみ）。バナーは同意地域でのみ表示されます。`deploy/worker.js` は EU/EEA、英国、スイス、国が不明な場合（`request.cf.country` なし、`XX`、`T1`）に `<html data-consent="1">`、それ以外では `data-consent="0"` を設定し、後者では GA4 がバナーなしで読み込まれ（広告シグナルは引き続き拒否）、フッターのリンクからは引き続き「拒否する」を選べ、GA を停止して Cookie を削除します。ETag には `-c1`/`-c0` の接尾辞が付き、2 つのバリアントが互いに再検証されることはありません。どちらも `Cross-Origin-Resource-Policy: cross-origin` + CORS ヘッダーを返すので、`require-corp` を維持してもクロスオリジン分離は壊れません。SPA のルート変更（`history.replaceState`）は CF の SPA モードと GA4 の拡張計測（「ブラウザの履歴イベントに基づくページの変更」）で自動的に計測されます。`page_view` を手動で送らないでください（二重計測になります）。テスト：`npm run test:analytics`（ローカル、ビーコンを横取り）/ `npm run test:analytics:live`。解析 ID はリポジトリに含めません：`tools/build-dist.js` が `CF_BEACON_TOKEN` と `GA_MEASUREMENT_ID` を環境変数（または gitignore された `.env`）から読み、`dist/js/analytics.js` にだけ書き込みます。設定しなければ解析も同意バナーもトラッキングもありません。すべて Cloudflare Workers 静的アセットの無料枠に収まります（静的ファイルは Worker リクエストとして課金されず、Worker はページのルートでのみ動作します）。

**4×4 リダクションソルバー**（`puzzles/nxn/cube4.worker.js`、自作コード。段階の考え方は公開されている Tsai / TPR 系の方法に倣い、コードは一切コピーしていません）：
1. P1（36 種類の回転）：R/L 色のセンターを R/L へ。正確な距離表 C(24,8)。
2. P2（外層 + Rw/Lw + Uw2/Dw2/Fw2/Bw2）：U/D センターを U/D へ、R/L 軸のセンターを解ける 12 通りの配置のいずれかへ、すべてのウイングを「向き揃え」（P3 群の下で 24 のウイング位置は 2 クラスに分かれる）、ウイングの置換を偶に（OLL パリティを除去）。
3. P3a（U D F B、R2 L2、ワイドの半回転）：センターを P3b で解ける部分集合へ、E スライスの 8 ウイングを E スライスへ戻し、P3b で解ける状態に。
4. P3b（U D、F2 B2 R2 L2、ワイドの半回転）：センター完成、12 エッジのペア完成、PLL パリティ除去。
5. 等価な 3×3 を Kociemba 二段階法（cubejs）へ。
各段階は IDA*。時間内で前段階の候補をいくつか試して最短を採用し、隣接する同軸の回転はまとめます。

テスト：`node tests/nxn.test.js [4×4 のサンプル数]`（モデル 2–15 + 2×2 + 4×4）、`node tests/gullicube.test.js 5,7,10,15 both`、本番 `node tests/live-nxn.js <URL>`。

### 事前計算テーブル（4×4 と 3×3 ソルバー）

`npm run build:tables` が `puzzles/nxn/cube4-tables.bin.gz`（1.61 MB、距離表 7 個）と `puzzles/cube3/cubejs-prune.bin.gz`（0.89 MB、cubejs の枝刈り表）を書き出します。形式：`CLT1` + ヘッダー長 + JSON の目次（名前 / 型 / 長さ / FNV-1a チェックサム）+ 生バイト、gzip 圧縮（`js/core/table-pack.js`）。Worker は回転表を計算しながら表をダウンロードします。ブラウザーは `DecompressionStream` で展開して表ごとに検証し、ダウンロード失敗、チェックサム不一致、ブラウザー非対応の場合はその場で計算する方式に戻ります。どのソルバーでも表の構造を変えたら `npm run build:tables` を再実行してください（`tests/tables.test.js` が表とその場の計算結果を比較します）。

## 自由に遊ぶ（すべてのパズル）

ステージ上部の「解く / 自由に遊ぶ」切り替え（`?mode=play` も可）。

| 操作 | 説明 |
|---|---|
| ステッカーをドラッグ（マウス / タッチ） | そのステッカーの層を回します。キューブ：その面の 2 本の軸のうち、投影がドラッグ方向に最も近いものを選び、回転軸 = 面の法線 × ドラッグ方向。大きいキューブではつかんだ層が回ります（内側の層は 2R、3R…、奇数サイズの中央層は M / E / S）。他のパズルは `dragMoves`（後述）を使います。タッチ時はキャンバスが `touch-action: none` なのでページはスクロールしません |
| 何もない所をドラッグ | 視点を回転（ダブルクリックでリセット） |
| キーボード | `U D L R F B`（Shift = 反時計回り）。数字の接頭辞で層を選ぶ（`2` `R` → 2R）。`w` の接頭辞でワイド（`3` `w` `R` → 3Rw）。奇数サイズは `M E S`。持ち替え `x y z`（2×2 と 4×4 以上）。Ctrl+Z / Backspace で元に戻す、Ctrl+Y / Ctrl+Shift+Z でやり直し。Esc で接頭辞を消去。記号は現在の持ち方に従います（画面上の上の層は常に U） |
| 手順欄 | 任意の手順（3Rw、2R、M/E/S…）。Enter で実行し、1 手ずつアニメーション |
| スクランブル | 2×2 / 3×3：一様ランダムな状態（`CubeLab.play.randomState`）。4×4 以上：ランダムな回転。ピラミンクス / スキューブ：一様ランダムな状態。メガミンクス：WCA（Pochmann）スクランブル |
| タイマー | スクランブル後の最初の（持ち替えでない）回転で開始し、完成で停止。WCA の 15 秒インスペクション（任意。15 秒超で +2、17 秒超で DNF） |
| 手数 | 3×3 以下は STM、4×4 以上は BTM（持ち替えは数えない）。ピラミンクス / スキューブは VTM、メガミンクスは HTM |
| 元に戻す / やり直し / リセット / 現在の状態から解く | 「解く」で解法モードに戻り、現在の状態を解いて通常どおり再生（この回は記録されません） |

- パズルごとのベストタイムは `localStorage`（`cubelab.best.<パズル>`）に保存されます。完成すると軽いハイライト + 完成音（効果音スイッチに従う）+ ショーケースの一回転（自動回転スイッチに従う）。
- 実装：`js/core/play-core.js`（純粋なロジック、Node でテスト可能）、`Player.pushMove / popMove`（アニメーションをキューに入れ、溜まると加速し、手を落とさない）、`View3D.pick / dragTurn / setPlayMode`、`app.js` のモード制御。グラフは 3D と同期して 1 手ずつ更新されます。

## ピラミンクスとスキューブ

どちらも完全なプラグイン（`puzzles/twisty/`）です：モデル、検証、3D、展開図エディター、グラフビュー、厳密な最適ソルバー、自由に遊ぶ、12 言語。

- **モデル**（`twisty-model.js`、ページ / Worker / Node で共通）：ステッカーは幾何から生成（ピラミンクス：1 面に三角形 9 個。スキューブ：1 面に正方形 1 個 + 角の三角形 4 個）。各回転の置換 = 層内のステッカーの重心と法線を軸まわりに 120° 回し、対応するステッカーを探す。WCA 記号：ピラミンクス `U L R B`（2 層）+ `u l r b`（先端）。スキューブ `R U L B`（R = 右下後ろの角、U = 左上後ろ、L = 左下前、B = 左下後ろ。右上前の角は固定）。
- **最適ソルバー**（`twisty.worker.js?p=…`）：色の状態 → パーツ + 向き。パーツの種類ごとに独立した成分に分ける。まず BFS で各成分の到達可能集合と回転表を求め、次に直積空間全体で BFS（`Uint8Array` の距離表）。解は表を下っていくので、長さはちょうど最短距離です（VTM：120° の回転 1 回を 1 手）。ピラミンクスの先端はすべての回転と可換なので、最後にそれぞれ 0 / 1 手で揃えます（それでも最適）。

| | 状態数（コア） | 成分 | 実測の神の数字 | 表 | 構築（Node / ブラウザー、Worker 起動込み） | 解法 |
|---|---|---|---|---|---|---|
| ピラミンクス | 933,120（× 先端 81 = 75,582,720） | エッジ 11,520 × 軸センター 81 | 11（先端込みで 15） | 0.93 MB | ≈ 60 ms / ≈ 250 ms | ≈ 0.03 ms |
| スキューブ | 3,149,280 | センター 360 × コーナー 8,748 | 11（最遠状態 90 個） | 3.15 MB | ≈ 180 ms / ≈ 400 ms | ≈ 0.01 ms |

  表はブラウザー内で構築します（圧縮した表をダウンロードするより速い）ので、追加のファイルは不要です。`tests/twisty.test.js` の確認内容：どの回転も 3 回で恒等、逆回転と打ち消し合う、パーツ単位で動く。成分の積 = BFS の到達数（成分は独立）。層ごとの数。表が一貫した BFS の層になっている。ランダムな状態が解け、長さ = 表の距離。検証器が反転エッジ / ねじれたコーナー / 2 パーツの入れ替え / 存在しない色の組み合わせ / 誤った持ち方を拒否する。
- **3D**：各パーツは中身の詰まった凸多面体（外形 ∩ 切断面の半空間。ピラミンクスは頂点ごとに 2 枚、スキューブは中心を通る 4 枚）。回転では層全体が回り、切断面は自身の平面内を滑るので交差しません。ステッカーは内側に縮めた角丸の三角形 / 正方形です。
- **グラフビュー**：120° 回転のステッカー軌道はそれぞれ 3-巡回で、3 つのノードを通る円として描きます。ピラミンクスのノード = 展開図上のステッカー中心（U / L / R の頂点が同心円群の中心、B 層の円は展開図全体を囲む）。スキューブは DBL の角からの正距方位図法（B 層が同心円、R / U / L が 3 枚の花びら）。
- **展開図エディター**：SVG 多角形（クリック / ドラッグで塗る、キーボードの Enter で塗る、エラーは赤枠）。ピラミンクス：前面が中央、左右の面が両側、底面が下。スキューブ：キューブと同じ十字。
- **自由に遊ぶ**：ステッカーのドラッグでは、候補の回転のうち、そのステッカーの瞬間速度がドラッグ方向に最も近いものを選びます（同じ軸ならパーツの少ない方なので、先端をドラッグすると先端だけが回る）。キーは `U L R B` / `R U L B`（Shift = 反時計回り）、ピラミンクスは `T` の後に文字 = 先端。スクランブル = 一様ランダムな状態。タイマー / ベストタイムはキューブと同じ。
- **カメラ / 写真認識**：まだ未対応です（三角形 / ひし形のステッカーには新しいサンプリンググリッドとパーツ制約付きの色付けが必要）。これらのパズルではスキャンタブを隠し、色を塗るよう案内します。

## メガミンクス

`puzzles/megaminx/` にある完全なプラグイン（自作コード、MIT）：`megaminx-model.js`（幾何、回転、検証。ページ / Worker / Node で共通）、`megaminx.js`（プラグイン：3D、展開図、グラフ、記号、自由に遊ぶ）、`megaminx-solver.js`（多段階ソルバー）、`megaminx.worker.js`、`megaminx-ll.json`（最終層テーブル、`tools/megaminx-ll-gen.js` でオフライン生成）。

- **モデル**：12 面 × 11 ステッカー = 132 ステッカー、62 パーツ（センター 12、エッジ 30、コーナー 20）。面の回転 `U F R L BL BR D DR DL B FL FR` と `X X' X2 X2'`（72° / 144°、その面から見て時計回り）。WCA の Pochmann 回転 `R++ R-- D++ D--`（L / U 層以外の全体を 144° 回す）。各回転の置換はステッカーの重心と法線を回して求めます。検証：色の数、存在しない / 重複したパーツ、ねじれたコーナー、反転したエッジ、置換のパリティ、センターの配置（`v.megaCenters`）。
- **ソルバー**（多段階、最適ではない。WCA 式の HTM：72° でも 144° でも面の回転 1 回を 1 手）：
  1. 検証の後、センターが標準配色になるよう状態を回転 / 色の付け替えを行い、パーツコード（コーナー：スロット × 向き 3、エッジ：スロット × 2）に変換します。
  2. **F2L、面ごと**：D、D を囲む 5 つの環状の面、次に上側 5 面のうち 4 面。ある面のパーツがすべて揃ったらその面はもう回さないので、回転の集合 S が小さくなり、触れていないパーツは揃ったままです。各ステップの新しいパーツは小さなグループ（≤ 3 パーツ：コーナー 1 個とその隣のエッジ）に分け、各グループを IDA* で解きます。ヒューリスティックは小さなパーツグループ距離表（現在の S での BFS、初回使用時に構築してキャッシュ）の最大値です。最後の 2 面ステップの前にエッジの向きの表（3×3 の `<R,U>` EO に相当）を加え、そのステップを 2 つの面だけで終えられるようにします。ノード数の上限とリトライ（直前のグループの次の解を使う）で、まれに遅いケースも短く済みます。
  3. **最終層は表による 2 ルック**：ルック 1 = エッジの置換 + エッジの向き + コーナーの向き（60 · 16 · 81 = 77,760 状態）、ルック 2 = コーナーの置換 × エッジの置換（3,600 状態）。生成器は 3 面の部分群 `<U,X,Y>` を meet-in-the-middle（片側 ≤ 7 手）で探索して U 以外のパーツをすべて保つ手順を見つけ、効果ごとに最短の手順とその U 回転 5 通り（39,059 手順）を残し、HTM のコストで Dijkstra を実行します。
  4. 隣接する同じ面の回転をまとめます（72° 単位で mod 5）。
- **実測**（Node、`tests/megaminx.test.js` / ベンチマーク）：ランダムな 1,000 状態がすべて解け、平均 120.1 手 HTM（F2L 95.4 + 最終層 26.4）、最大 135、最小 97。解法時間は平均 34 ms、最大 1.6 s。Pochmann スクランブル 500 個：平均 119.7、最大 135、平均 29 ms、最大 0.9 s。ブラウザーでは 1 回の解法は通常 2–20 ms + Worker のオーバーヘッド。Worker 起動 + 表の読み込み ≈ 170–200 ms。これらの数値は `seo/site.config.json` に書かれ、SEO ページに表示されます。
- **3D**：`view3d.geometry: 'poly'`、正十二面体を `solid`、12 枚の切断面を `cuts` とし、パーツは凸多面体です。
- **グラフビュー**：D のセンターからステッカー位置を立体射影します（そのノード 1 つは非表示）。72° の面の回転はステッカーを 5-巡回で動かし、各巡回の 5 点は射影後に 1 つの円の上にあります（立体射影は円を円に写す）。そのため各軌道を 5-巡回の外接円として描きます：39 個の円、131 個の表示ノード。白い U 面が中央、上側の面がその周り、下側の面が外側の大きな花びらになり、ズームすると密な中心部が見えます。
- **展開図エディター**：6 枚の五角形からなる 2 つの「花」を横に並べたもの（U とその隣接 5 面、D とその隣接 5 面）。他の形状と同じく SVG 多角形です。
- **自由に遊ぶ**：ドラッグ（汎用の `dragMoves`）、キーは `U F R L B D` と `I`=BL、`O`=BR、`J`=FL、`K`=FR、`N`=DL、`M`=DR（Shift = 反時計回り）。HTM で数える。スクランブル = 77 手の WCA Pochmann スクランブル（7 行、各行 `R±± D±±` × 5 + `U`/`U'`）。「現在の状態から解く」は他のパズルと同じです。
- **カメラスキャン**：非表示（`cameraPlan: null`）。
- **名称**：五魔方（中国語）、メガミンクス（日本語）、Мегаминкс（ロシア語）、ميغامينكس（アラビア語）、他は Megaminx。メニューではスキューブの直後です。

## SEO：パズル × 言語ごとに静的ページ 1 つ

- **唯一の設定**：`seo/site.config.json`（`baseUrl` = 本番 URL。canonical / hreflang / sitemap / OG はすべてここから作られるので、ドメインを変えるときはここだけ変えて再ビルド）と実測の手数。
- **ルート**（`js/seo-routes.js`、ブラウザーとビルドスクリプトで共通）：英語はルート、他の言語は `/<言語>/` の下。パズルごとにクリーンなパス 1 つ：`/`（メインの入口、x-default）、`/2x2-cube-solver/` … `/15x15-cube-solver/`、`/pyraminx-solver/`、`/skewb-solver/`、`/megaminx-solver/`。例：`/zh-hans/3x3-cube-solver/`、`/ja/megaminx-solver/`。合計 12 言語 × 18 = 216 ページ。
- **文言**：`seo/lang/<code>.json`（12 言語、タイトルは各地の検索習慣に合わせて作成）。パズルの種類ごとのテンプレートに実測の手数を入れます。
- **ビルド**：`npm run build:seo`（`tools/build-seo.js`）が英語のルートページを `index.html` の `<!--seo:*-->` マーカーの間に、他のページを `seo/out/` に書き出し、さらに `robots.txt`、`sitemap.xml`（xhtml:link の代替リンク付き）、`manifest.webmanifest` を作ります。HTML が参照する js/css には `?v=<内容ハッシュ>` を付けます。アイコンと OG 画像（1200×630、パズルごとに 1 枚、実際の 3D + グラフのスクリーンショットから）：`npm run build:seo-images`（ローカルサーバーが必要。`OG_ONLY=root,megaminx` で一部の画像だけ）。
- **各ページ**：title / description / canonical / hreflang 13 個（x-default を含む）/ OG / Twitter カード / アイコン / manifest / JSON-LD（WebSite、WebApplication（無料、評価なし）、WebPage、BreadcrumbList、HowTo、FAQPage。表示テキストと一字一句一致）、静的な `<h1>`、クロール可能な本文（使い方、ソルバーと実測手数、記号、グラフの説明、FAQ、全パズルへのリンク）、`<noscript>` の注記。
- **実行時**（`js/seo-nav.js`）：ページは `<html data-page-lang data-page-puzzle>` で言語とパズルを事前選択します。アプリ内でパズルや言語を切り替えると `history.replaceState` で対応するクリーンな URL に替え、タイトル / meta / JSON-LD / 本文を事前レンダリングされたページから取り込みます。再読み込みも状態の消失もありません。ルート `/` は従来どおりブラウザーの言語 / 前回の選択に従います。
- **古いリンク**：`/?puzzle=…`、`/?n=…`、`/?lang=…` は `deploy/worker.js` が新しいパスへ 301 します（ページのルートでのみ動作。静的アセットは `run_worker_first` で除外。`?lang` がなければ Accept-Language から言語を選び、`Vary: Accept-Language`）。他のパラメーター（`mode`、`hold`、`start`）は保持します。ローカルで Worker がないときは `seo-nav.js` がクライアント側でアドレスを書き換えます。
- **テスト**：`node tests/seo.test.js`（静的：216 ページすべてで title/description が一意、canonical、hreflang の相互リンクが完全、JSON-LD が解析でき表示内容と一致、評価なし、OG 画像のサイズ、内部リンク、sitemap/robots/manifest、Worker のリダイレクト）。`npm run test:seo:live` は本番の全ページを確認します。

## 実行

```bash
cd cube-solver
npm install
npm start                        # node tests/serve.js 8765 (sends COOP/COEP headers)
# open http://localhost:8765/
```

> カメラには**セキュアコンテキスト**が必要です：`https://` または `http://localhost`。LAN の IP（例：`http://192.168.x.x`）で開くとブラウザーがカメラを無効にするので、「写真をアップロード」を使ってください。
> Web Worker は `file://` では動かないので、必ず HTTP サーバー経由で開いてください。

## テスト

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

E2E の範囲：ランダムスクランブル → 解く → 最後まで再生（グラフに 6 つの単色クラスター、3D の各面が単色）、プレーヤーのシーク / 前 / 次、色塗りとあらゆる種類の検証エラー、手順入力、合成写真 6 面の認識（色かぶり、照明の勾配、ノイズ、反射）、Chromium の疑似カメラ経路、モバイルレイアウトとスクリーンショット。`tests/graph-preview.html` はグラフのレイアウトをデバッグする単独ページです（`?scr=手順&mv=R&e=0.5`）。`node tests/compare-ref.js` は参考動画のフレーム（`ref/f14`、`f07`、`f01`）との並列比較を `screenshots/compare-*.png` に書き出します。`tests/graph-pixel.html` は参考フレームのピクセル対応でグラフを描画し、ピクセル単位で重ねて比較します。

## ディレクトリ構成

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

## 拡張ポイント（アーキテクチャ）

コアのモジュール（入力、グラフビュー、3D、プレーヤー、スキャン、ソルバークライアント）は `CubeLab.registerPuzzle(def)` で登録された Puzzle オブジェクト**だけ**を通して動作し、3×3 固有のロジックを含みません。新しいパズルは `puzzles/<id>/` に置き、以下のインターフェースを実装します。

### Puzzle インターフェース

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

登録時にコアが、既定の `parse / format / apply / inverse / isSolved`、各回転で回るパーツ（`layer` で判定）、**グラフ軌道**（`P.tracks`）、各回転のステッカー経路（`moves[tok].paths`）を補います。

他の形状が使う任意のフィールド：`trackMode: 'cycles'`（軌道 = 基本回転の置換の巡回）、`netLayout.polys`（SVG 多角形の展開図）、`view3d.geometry: 'poly'` + `solid` / `cuts` / `core`（凸多面体のパーツ）、`dragMoves`（汎用ドラッグ）、`playKeys` / `playMetric` / `metricTitle`、`hints`（ヒントの i18n キー）、`randomState(rnd)`（一様ランダムな状態）、`randomScramble()`、`nameKey`。`cameraPlan: null` でスキャンタブを隠し、`holds` がなければ持ち方メニューを隠します。

### グラフ軌道と動き（`CubeLab.buildTracks` + `GraphView`）

基本回転ごとに：動くステッカーを取り、「ステッカーの法線 · 軸」でグループ分けし（3×3 では「その面の 8 枚」と「側面の 12 枚」）、各グループを軸まわりの角度で並べて閉じた環にします。θ の回転で環上のステッカーは `θ/2π × n` マス進み、`perm` と照合します。

プラグインの `graphLayout()` はノードの 2D 座標と、任意で `circles: [{id, cx, cy, r}]` を返します：
- 側面の軌道のノードがすべて 1 つの円上にあれば、ノードは**その円に沿って**動きます（軌道全体で同じ向き。基本回転で総移動量が最短になる向きを選び、逆回転では逆向き）。色の軌跡も描きます。
- 「面」の軌道のノードは、その面の中心ノードのまわりを極座標で補間します（クラスター全体が回転）。
- 円がなければノードを通る閉じたスプラインを使うので、手作りのレイアウトがなくても他のパズルを可視化できます。

**3×3 のレイアウト**（`puzzles/cube3/cube3.js` の `GL` 設定）：3 組の同心円は y（U/E/D）、z（F/S/B）、x（R/M/L）の各軸で、正三角形の頂点（上、左下、右下）を中心とし、半径は 1.3922 / 1.7696 / 2.1469（三角形の外接円半径 = 1）。これらの値は高解像度の参考フレームにある**54 ノードすべて**への最小二乗フィットです（残差 RMS 0.2 px）。ノード半径 0.184、線幅 0.048、軌道の幅 0.063、ハイライトの幅 0.076 も同じフレームのピクセル測定によります。参考フレームのピクセル対応で描画して 50% で重ねると、円とノードはほぼ完全に一致します（`tests/graph-pixel.html`）。面 X のステッカーは、X の法線以外の 2 軸の円群の交点にあり、2 つの交点領域に向かい合う 1 組の面が入ります。層 → 半径の向き（`sign`）と各面の交点領域（`upper`）は全通り（64 組み合わせ）で検証済みです：6 つの面の回転はいずれも、1 つの円上の 12 ノードの巡回シフトです。スライス回転 M/E/S は本物の回転で（`moves` で幾何から生成。同じ生成器が 6 つの面の置換を正確に再現することを単体テストで確認）、それぞれのグループの中央の円上を動きます。ソルバーが出力するのは面の回転だけです。

**円弧の経路（参考動画とフレームごとに照合）**：各円上の 12 ノードは 4 つの面の区画に属し、間隔はおよそ 60°/60°/60°/180° です。「総移動量最短」で向きを決めると、90° の回転では 9 枚のステッカーが ≈ 60° の弧を進み、**1 つの区画の 3 枚が空いている 180° の弧を横切ります**（例：外側の円の上の弧、左下グループの左側の大きな弧）。参考動画もまったく同じです（`screenshots/compare-motion.png` の 2 行目）。区画の位置は「完成状態のレイアウト = 参考 f14」で一意に決まるので、すべての弧を短くできる別の割り当てはありません。

**時間とイージング（参考動画の 60 fps の動きのエネルギーから測定）**：
- 1 手のイージングは `easeInOutQuad`（15 回の回転の平均速度曲線にフィット、RMS 0.076。sine 0.155、cubic 0.193）。
- 連続再生では全体に「ゆっくり始まり – 加速 – ゆっくり終わる」包絡線：最初の手 ≈ 0.85 s、中盤 0.48 s、最後 ≈ 1.0 s、手と手の間は ≈ 0.07 s だけ（`CubeLab.tempo(i, n)`、`Player.baseMs = 480`、`gapMs = 67`。単発の「次へ」は 0.55 s 固定）。
- アクティブな円のハイライトは回転の最初の 8% でフェードインし、最後の 16% でフェードアウト。色の軌跡はノードから後ろに伸び（尾の位相 `ease(1.6t − 0.6)`）、終わりに消えます。
- 完成後 ≈ 1.2 s 静止し、その後 2.0 s のショーケース回転。

### 持ち方（記号の視点）

内部状態、ソルバー、手順入力は常に WCA の持ち方（白 U、緑 F）を使います。プラグインは `holds` を提供でき、各持ち方は 3D 全体の向きと記号の読み替え表を持ちます。3×3 の既定「黄上・緑前」= 標準の持ち方を前後軸まわりに 180° 回したもの（z2）：`U↔D`、`R↔L`、`F/B` はそのまま、`M→M′`、`E→E′`、`S` はそのまま（単体テストで 1 つずつ確認：内部の回転の「軸 × 角度」を向きで回したものが、表示される回転の「軸 × 角度」に等しい）。解法テキスト、プレーヤーの現在の手、手順リスト、説明は現在の持ち方の記号を使うので、画面上の上の層は U と呼ばれます。

### 3D のスタイルと視点

- `view3d.style: 'plastic'`：明るい灰色の本体 + 白いパネル（細い明るい灰色の継ぎ目）+ 角丸の単色ステッカー（照明なし、グラフと同じ色）+ 本体の柔らかい陰影。指定しなければ黒い本体の古典的なフラットスタイル。
- `stickerCorners: [左上, 右上, 右下, 左下]`：ステッカーの角の半径（非対称な葉の形も可）。`stickerColors` で 3D のステッカー色を上書き。
- `orientation`（オイラー角、現在の持ち方で上書き）+ `camera: { fov, dir }`：3×3 の既定の視点は参考動画と同じ——黄（D）が上、緑（F）が左、オレンジ（L）が右——で、グラフの中央の三角形の 3 つのクラスターに対応します。透視 FOV 24°、仰角約 25°、参考フレームとのピクセル比較で調整。
- `frame: { width, height, dx, dy }`：フレーミング（それぞれの半分のパネル内でのパズル / グラフの大きさとずれ）。参考動画との誤差 0.5% 以内。
- `autoRotate`：再生中はパズルが軽く揺れます。完成状態で再生が終わると `showcaseDelay`（1.2 s）静止し、`showcaseMs`（2.0 s）で 1 回転して最初の視点に戻ります（参考動画の最後と同じ）。プレーヤーの「自動回転」スイッチで無効にでき、ドラッグでの回転とダブルクリックでのリセットは常に使えます。

### サウンド（`js/core/audio.js`、`CubeLab.SoundEngine`）

すべて Web Audio API でリアルタイムに合成しており、音声ファイルやサードパーティの素材はありません。
- **自動再生ポリシー**：ページ読み込み時には `AudioContext` を作りません。最初の `pointerdown / keydown / touchstart` で作成して `resume()` します。既定は効果音オン、音楽オフ。「効果音 / 音楽 / 音量」は `localStorage`（`cubelab.sfx / cubelab.music / cubelab.vol`）に保存。再読み込み前に音楽がオンだった場合は、次のユーザー操作まで待ちます。Web Audio がない環境ではすべての呼び出しが何もせず、操作部は無効表示になります。
- **回転音 v3**（`Player.onMove(phase, tok, durMs)` フック）：本物の 3×3 の録音 3 つの分析から作り直しました（`user-sounds/ANALYSIS.md`、`screenshots/sound-compare.png` 参照）。本物の回転 = 120–200 ms のまとまったプラスチックの粒の連なり（≈ 5 ms に 1 粒）が本体の短いモードを励起：主ピーク 0.86–1.1 kHz（「中空 / 木のよう」）+ 500 Hz、1.55、2.8、4.1 kHz、残響は 3–6 ms のみ、300 Hz 以下の「ドン」はほぼなし。エネルギーは層が収まる最大のクリックに向けて高まり、その後 70–100 ms のフェードする余韻。合成：JS で粒のイベントを生成 → 2 次共振器 10 個（粒ごとにランダムに別のモードを励起）+ 細かいマイクロ粒の層 + ごく軽い摩擦 + 広帯域の直接エッジ。収まるクリックはアニメーションの終わりに合わせ、遅い再生では音を終盤に集め、180° では T/2 で引っかかりのクリックを加え、スライスはより柔らかく暗い音。1 回の生成は 1.7–3.3 ms。本物の録音（SpaceJoe / Pixabay の素材、同じ分析）との比較：重心 2141 Hz 対 2135 / 2077 Hz、クレストファクター 20.7 対 21.1 / 17.6 dB、平坦度 0.24 対 0.25 / 0.32、粒 18.5 対 17.8 / 12.0（100 ms あたり）、1/3 オクターブの形の差 ≈ 2 dB。音声ファイルは公開しません（録音は分析にのみ使用。ライセンスは `vendor/sounds/LICENSE.txt`）。高速再生の保護：回転音の間隔は最低 50 ms、短い回転ほど静かで粒が少ない、タイムラインをドラッグすると終わっていない回転音はすぐ止まります。
- **完成**：上昇する長調のアルペジオ + 和音（完成状態で最後の手まで再生したとき）。**ショーケース回転**の開始時（`View3D.onShowcaseStart`）に柔らかく上昇するきらめき。
- **UI**：塗りのクリック（色によって音程が変わり、ドラッグで塗るときは間引き）、撮影 / アップロード成功の合図（6 面完了で 3 音）。
- **BGM**：72 BPM、Cmaj9 – Am9 – Fmaj9 – G6sus の 4 小節ループ。デチューンしてローパスしたノコギリ波のパッド + ペンタトニックのアルペジオ（決定的な疑似乱数）、空間感のためのフィードバックディレイ。先読みスケジューリング（150 ms ごとに 0.6 s 分を予約）、継ぎ目のないループ、フェードイン / アウト、ごく小さい音量。
- レベル（音量 0.8、オフラインで測定）：1× の 1 手の回転のピークは約 0.31–0.36、実際の手の速さ（130 ms）で約 0.22、完成のアルペジオ約 0.23、BGM のピークは約 −22 dBFS。試聴（ローカルのみ）：`screenshots/sound-demo-turns.wav`、`sound-demo-turns-v3.wav`、`sound-demo-sfx.wav`、`sound-demo-music.wav`。

### 言語（`js/i18n/`、`CubeLab.i18n`）

- **言語と順序**：English、简体中文、繁體中文、Español、العربية、Português、Bahasa Indonesia、Bahasa Melayu、Français、日本語、Русский、Deutsch（メニューではすべて同列、グループなし）。
- **文字列**：言語ごとに 1 ファイル `js/i18n/<code>.js` で `CubeLab.i18n.register(code, {key: text})` を呼びます。`en.js` が親テーブルで、欠けたキーは英語にフォールバックし `CubeLab.i18n.missing` に記録されます。HTML は `data-i18n` / `data-i18n-title` / `data-i18n-aria` / `data-i18n-placeholder`、動的テキストは `I.bind(el, key, params)` を使い、言語切り替え時に再描画されます。
- **書式**：ICU のサブセット——`{name}`、`{n, plural, =0 {…} one {# …} few {…} many {…} other {…}}`（`Intl.PluralRules`）、`{ms, unit, millisecond}`、`{x, number}`（`Intl.NumberFormat`）。フランス語は `: ; ! ? « »` の前に自動でノーブレークスペースを入れ、スペイン語は ¡ ¿ を使います。回転記号はすべての言語で標準の文字のままです（U D L R F B M E S、′ 2）。
- **検出順**：`?lang=xx` → `localStorage['cubelab.lang']` → `navigator.languages`（zh-TW/HK/MO/Hant → 繁体字、その他の zh → 簡体字）→ English。`<html lang dir>`、タイトル、meta description を設定します。
- **RTL**：アラビア語はページ全体を反転します（CSS の論理プロパティ）。3D キャンバス、グラフ、タイムライン / プレーヤーの操作部、手順の帯、記号、手順入力、数字は LTR のまま（`dir="ltr"`）。
- **組版**：CJK / アラビア語は専用のフォントスタック、大きめの行の高さ、字間なし。ドイツ語 / ロシア語は `hyphens:auto` を有効にし、ボタンははみ出さずに折り返せます。
- **言語の追加**：`i18n.js` の `LANGS` に 1 項目足し、`js/i18n/<code>.js` を作って `index.html` で読み込み、`node tests/i18n.unit.test.js` を実行します。

### ソルバーアダプター

```js
solvers: [
  { id: 'kociemba', name: '…', available: true,
    workerUrl: 'puzzles/cube3/kociemba.worker.js',
    encode: state => payload },          // runs on the main thread; throws a localized error for invalid states
  { id: 'optimal-ida', name: 'IDA* optimal (planned)', available: false }
]
```

Worker のプロトコル：

```
→ { id, cmd: 'init' }                      ← { id, ok: true, ms }
→ { id, cmd: 'solve', payload }            ← { id, ok: true, moves: ['R', "U'", ...], optimal?: bool, label?, note?, ms }
                                           ← { id, ok: false, error }
```

1 つのパズルが複数のソルバーを持てます。メニューは自動で一覧を作り、`available: false` は「予定」と表示されます。本当の最適ソルバー（例：コーナー / エッジのパターンデータベースを使う Korf の IDA*）を加えるには、新しい Worker を `solvers` に登録するだけです。Worker は `optimal: false` と `label` / `note` の i18n キーを返せ（メガミンクスがそうしています）、UI は手数の横に表示します。

### その他のビュー

プレーヤー（`CubeLab.Player`）は任意の数のビューを動かします。ビューは `setState(state)` と `animate(tok, e, fromState, t)`（e = 0–1 のイージング後の進み、t = 生の時間位相）、任意で `highlight(tok, state)` を実装するだけです。新しい可視化（例：ケイリーグラフや巡回図）もこれらのメソッドだけで作れます。

## サードパーティのライブラリ

- [gullicube](https://github.com/rokicki/gullicube)（Tomas Rokicki、MPL-2.0 の選択肢で使用、ソースは無修正。`vendor/gullicube/NOTICE.md` 参照）
- [cubejs](https://github.com/ldez/cubejs)（MIT）— Kociemba 二段階法。`vendor/solve.js` には小さなパッチ（`vendor/solve.js.cubelab.patch`）があります：`solve(maxDepth, deadline)` に任意の期限を追加し、見つからないときは null でクラッシュする代わりに例外を投げます。時間内での反復短縮に使います。
- [three.js](https://threejs.org/) r160（MIT）— 3D 描画（UMD 版 `three.min.js`。このビルドは非推奨だとコンソールに警告が出ますが、ここでは問題ありません）。
- ピラミンクス、スキューブ、メガミンクスのソルバーとメガミンクスの最終層テーブルは、このプロジェクト自作のコードとデータです（MIT）。GPL のコード、csTimer や TPR のコードは使っていません。

## 既知の制限

- ピラミンクス / スキューブ / メガミンクス：カメラ / 写真認識はまだありません。色を塗るときはヒントどおりに持ってください（ピラミンクス：黄を含まない軸パーツを上、緑を含まないものを後ろ。スキューブ：白・緑・赤の角を右上前。メガミンクス：センターが標準配色になっていること）。そうでないと持ち方 / センターのエラーになります。
- メガミンクスの解は**最適ではありません**（平均 ≈ 120 手 HTM、最大 ≈ 135）。まれに難しい状態では ≈ 1.6 s かかります。1.8 MB の最終層テーブル（`megaminx-ll.json`、転送時は圧縮）はメガミンクスのソルバー起動時に 1 回ダウンロードされます。
- カメラには HTTPS か localhost が必要です。認識は照明に左右されるので、強い反射や黄色い光の下では展開図で結果を直してください（センターの色を補正に使うので、ある程度の色かぶりには耐えます）。
- スキャンは標準配色（白の反対が黄、緑の反対が青、赤の反対がオレンジ）と案内どおりの持ち方を前提とし、エディターではセンターが固定です。
- 3×3 ソルバーは面の回転だけ（HTM）を出力します。参考動画の解法にはスライス回転が含まれるので、同じ状態でも手順は動画と一致しません。
- 二段階法は最適に近い解（通常 19–21 手）を出し、8 手以下の状態だけが最適を証明された解になります。本当の「神の数字」レベルの最適ソルバーは拡張として残しています。
