[English](README.md) · [简体中文](README.zh-Hans.md) · [繁體中文](README.zh-Hant.md) · **日本語** · [Español](README.es.md) · [Português](README.pt.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · [Русский](README.ru.md) · [العربية](README.ar.md) · [Bahasa Indonesia](README.id.md) · [Bahasa Melayu](README.ms.md)

# Cube Solver Lab

ブラウザだけで動くパズルソルバーです。2×2〜15×15 のキューブ、ピラミンクス、スキューブ、メガミンクスに対応しています。3D モデルの横には置換グラフがあり、ステッカー 1 枚が 1 つのノードになっているので、回すたびにステッカーが円に沿って動く様子が見られます。

**公開サイト: https://cube-solver.org**

## 機能

- **解法の計算**：2×2〜15×15 のキューブ、ピラミンクス、スキューブ、メガミンクス。2×2・ピラミンクス・スキューブは最適解を出します。3×3 は Kociemba の 2 フェーズ法（通常 19〜21 手）、5×5 以上はマルチスレッド WebAssembly にコンパイルした gullicube を使います。メガミンクスは高速な多段階法です（平均約 120 手 HTM、最適解ではありません）。
- **状態の入力**：展開図への色塗り、スクランブルの入力（`R U R' U2 …`、ワイドムーブとスライスムーブにも対応）、カメラでのスキャン、写真のアップロード。
- **チェック機能**：色の不足、ねじれたコーナー、反転したエッジ、パリティなど、何がおかしいのかを説明します。
- **ステップ再生**：タイムライン、速度調整、キーボードショートカット付きで、3D 表示とグラフが同期して動きます。
- **フリープレイ**（全パズル）：ドラッグやキーボードで回せます。タイマー、WCA インスペクション（任意）、元に戻す / やり直し、ベストタイム付き。メガミンクスのスクランブルは WCA（Pochmann）形式です。
- **12 言語**に対応（アラビア語は右から左への完全なレイアウト）。パズルごと・言語ごとに検索向けの静的ページがあります。
- **合成サウンド**：音はすべて Web Audio API でその場で生成しており、音声ファイルは含まれていません。

## プライバシー

- カメラの映像とアップロードした写真はブラウザ内だけで処理されます。サーバーへ送信・保存されることはありません。
- 公開サイトでは Cloudflare Web Analytics でアクセス数を計測しています。Cookie を使わず個人データも収集しないため、すべての訪問者に読み込まれます。Google Analytics 4 は常に Consent Mode v2 で動作し、広告ストレージ、広告用ユーザーデータ、広告のパーソナライズ、Google シグナルはすべてオフです。EU/EEA、英国、スイス（および国を判定できない場合）では、同意バナーで「同意する」を押した後にだけ読み込まれます。それ以外の地域ではバナーは表示されず、ページビュー統計のためだけに読み込まれます。どちらの場合も、ページ下部の「アクセス解析の設定」リンクからいつでもオン・オフを切り替えられ、「拒否する」を選ぶと停止して Cookie も削除されます。言語、サウンド、ベストタイム、アクセス解析の選択などの設定はブラウザのローカルストレージにだけ保存されます。計測するのはページビューだけで、パズルの状態やカメラの画像が送信されることはありません。
- サイトは Cloudflare でホストされた静的ファイルの集まりです。一般的なホスティングと同様に、Cloudflare が通常の Web リクエストを処理します。

## ローカルで動かす

必要なもの：Node.js 18 以上。

```bash
npm install
npx playwright install chromium   # ブラウザテストにのみ必要
npm start                         # http://localhost:8765/
```

カメラにはセキュアコンテキスト（`https://` または `http://localhost`）が必要です。ローカルサーバーは公開サイトと同じクロスオリジン分離ヘッダーを返します（マルチスレッド WebAssembly に必要）。

## テスト

```bash
npm test               # SEO ページを生成してから、ユニット・ソルバー・SEO テストを実行（ブラウザ不要）
npm run test:nxn       # 4×4〜15×15 ソルバーの検証（時間がかかります）
npm start &            # ブラウザテストにはローカルサーバーが必要
npm run test:e2e       # ほかに: test:i18n, test:play, test:twisty, test:naming, test:analytics
```

## ビルドとデプロイ

```bash
npm run build          # デプロイ用のサイトを dist/ に生成
```

サイトは Cloudflare Workers の静的アセットとしてデプロイします（`deploy/` を参照）：

```bash
export CLOUDFLARE_ACCOUNT_ID=<アカウント ID>
export CLOUDFLARE_API_TOKEN=<Workers を編集できる API トークン>   # または: npx wrangler login
export CF_BEACON_TOKEN=<token>               # 任意：Cloudflare Web Analytics のトークン
export GA_MEASUREMENT_ID=G-XXXXXXXXXX        # 任意：GA4 の測定 ID（同意後にのみ読み込み）
npm run deploy
```

- `deploy/_headers` で `Cross-Origin-Opener-Policy` と `Cross-Origin-Embedder-Policy` を設定しています。マルチスレッド WebAssembly のソルバーに必要です。
- `deploy/worker.js` はリダイレクトだけを行います。`www` と `*.workers.dev` はメインドメインへ、古い `/?puzzle=…` のリンクは新しいパスへ転送します。静的ファイル（`/js`、`/css`、`/img`、`/puzzles`、`/vendor` など）は Worker を通さずに直接配信されるので、1 ページの表示で使う Worker リクエストは 1 回です。
- アクセス解析の ID はリポジトリに含まれていません。`npm run build` が環境変数（または git 管理外の `.env` ファイル、`KEY=value` 形式）から `CF_BEACON_TOKEN` と `GA_MEASUREMENT_ID` を読み、`dist/` にだけ書き込みます。未設定ならアクセス解析・同意バナー・トラッキングは一切入りません。また、解析は本番ドメインでのみ動作します。
- 自分のコピーをデプロイする場合は、`deploy/wrangler.toml` の `name` と `routes`、`seo/site.config.json` の `baseUrl` を変更してください。

開発者向けメモ：[docs/DEVELOPMENT.ja.md](docs/DEVELOPMENT.ja.md)

## 謝辞

キューブを円の集まりとして描くグラフ表示は、じゃがりきんさん（[@jagarikin](https://x.com/jagarikin)）のアニメーションに着想を得ています：[オリジナル（2022-05）](https://x.com/jagarikin/status/1524175137633095681)、[3D キューブ付き（2022-11）](https://x.com/jagarikin/status/1593771091738374144)。このアイデアを最初に知ったのは [@UnicornBitcoin さんのこの投稿](https://x.com/UnicornBitcoin/status/2107652690113339684) でした。おふたりに感謝します。

## ライセンスとクレジット

- このプロジェクトのコードは [MIT ライセンス](LICENSE) で公開しています。
- サードパーティのコンポーネントはそれぞれのライセンスに従います。詳しくは [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) をご覧ください。
  - 5×5 以上のソルバー [gullicube](https://github.com/rokicki/gullicube)（Tomas Rokicki）は、改変せずに Mozilla Public License 2.0 で利用しています（「MPL-2.0 OR GPL-3.0-or-later」のうち MPL-2.0 を選択）。`vendor/gullicube/` と `tools/build-gullicube.sh` を参照。
  - 3×3 の 2 フェーズソルバー [cubejs](https://github.com/ldez/cubejs)（MIT）には小さなパッチを当てています（`vendor/solve.js.cubelab.patch`）。
  - [three.js](https://threejs.org/)（MIT）で 3D 表示を描画しています。

## 商標

ルービックキューブ（Rubik's Cube）は Spin Master Ltd. の登録商標です。このプロジェクトは Spin Master とは関係がなく、同社の後援や承認も受けていません。「Rubik's」はパズルを説明するためだけに使っています。
