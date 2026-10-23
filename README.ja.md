[English](README.md) · [简体中文](README.zh-Hans.md) · [繁體中文](README.zh-Hant.md) · **日本語** · [Español](README.es.md) · [Português](README.pt.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · [Русский](README.ru.md) · [العربية](README.ar.md) · [Bahasa Indonesia](README.id.md) · [Bahasa Melayu](README.ms.md)

# Cube Solver Lab

ブラウザだけで動くパズルソルバーです。2×2〜15×15 のキューブ、ピラミンクス、スキューブに対応しています。3D キューブの横には置換グラフがあり、ステッカー 1 枚が 1 つのノードになっているので、回すたびにステッカーが円に沿って動く様子が見られます。

**公開サイト: https://cube-solver.org**

## 機能

- **解法の計算**：2×2〜15×15 のキューブ、ピラミンクス、スキューブ。2×2・ピラミンクス・スキューブは最適解を出します。3×3 は Kociemba の 2 フェーズ法（通常 19〜21 手）、5×5 以上はマルチスレッド WebAssembly にコンパイルした gullicube を使います。
- **状態の入力**：展開図への色塗り、スクランブルの入力（`R U R' U2 …`、ワイドムーブとスライスムーブにも対応）、カメラでのスキャン、写真のアップロード。
- **チェック機能**：色の不足、ねじれたコーナー、反転したエッジ、パリティなど、何がおかしいのかを説明します。
- **ステップ再生**：タイムライン、速度調整、キーボードショートカット付きで、3D 表示とグラフが同期して動きます。
- **フリープレイ**（2×2〜15×15）：ドラッグやキーボードで回せます。タイマー、WCA インスペクション（任意）、元に戻す / やり直し、ベストタイム付き。
- **12 言語**に対応（アラビア語は右から左への完全なレイアウト）。パズルごと・言語ごとに検索向けの静的ページがあります。
- **合成サウンド**：音はすべて Web Audio API でその場で生成しており、音声ファイルは含まれていません。

## プライバシー

- カメラの映像とアップロードした写真はブラウザ内だけで処理されます。サーバーへ送信・保存されることはありません。
- Cookie、アクセス解析、サードパーティのスクリプト・フォント・トラッカーは一切使っていません。言語、サウンド、ベストタイムなどの設定はブラウザのローカルストレージにだけ保存されます。
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
npm run test:e2e       # ほかに: test:i18n, test:play, test:twisty, test:naming
```

## ビルドとデプロイ

```bash
npm run build          # デプロイ用のサイトを dist/ に生成
```

サイトは Cloudflare Workers の静的アセットとしてデプロイします（`deploy/` を参照）：

```bash
export CLOUDFLARE_ACCOUNT_ID=<アカウント ID>
export CLOUDFLARE_API_TOKEN=<Workers を編集できる API トークン>   # または: npx wrangler login
npm run deploy
```

- `deploy/_headers` で `Cross-Origin-Opener-Policy` と `Cross-Origin-Embedder-Policy` を設定しています。マルチスレッド WebAssembly のソルバーに必要です。
- `deploy/worker.js` はリダイレクトだけを行います。`www` と `*.workers.dev` はメインドメインへ、古い `/?puzzle=…` のリンクは新しいパスへ転送します。静的ファイル（`/js`、`/css`、`/img`、`/puzzles`、`/vendor` など）は Worker を通さずに直接配信されるので、1 ページの表示で使う Worker リクエストは 1 回です。
- 自分のコピーをデプロイする場合は、`deploy/wrangler.toml` の `name` と `routes`、`seo/site.config.json` の `baseUrl` を変更してください。

開発者向けメモ（中国語）：[docs/DEVELOPMENT.zh-Hans.md](docs/DEVELOPMENT.zh-Hans.md)

## ライセンスとクレジット

- このプロジェクトのコードは [MIT ライセンス](LICENSE) で公開しています。
- サードパーティのコンポーネントはそれぞれのライセンスに従います。詳しくは [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) をご覧ください。
  - 5×5 以上のソルバー [gullicube](https://github.com/rokicki/gullicube)（Tomas Rokicki）は、改変せずに Mozilla Public License 2.0 で利用しています（「MPL-2.0 OR GPL-3.0-or-later」のうち MPL-2.0 を選択）。`vendor/gullicube/` と `tools/build-gullicube.sh` を参照。
  - 3×3 の 2 フェーズソルバー [cubejs](https://github.com/ldez/cubejs)（MIT）には小さなパッチを当てています（`vendor/solve.js.cubelab.patch`）。
  - [three.js](https://threejs.org/)（MIT）で 3D 表示を描画しています。

## 商標

ルービックキューブ（Rubik's Cube）は Spin Master Ltd. の登録商標です。このプロジェクトは Spin Master とは関係がなく、同社の後援や承認も受けていません。「Rubik's」はパズルを説明するためだけに使っています。
