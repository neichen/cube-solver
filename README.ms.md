[English](README.md) · [简体中文](README.zh-Hans.md) · [繁體中文](README.zh-Hant.md) · [日本語](README.ja.md) · [Español](README.es.md) · [Português](README.pt.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · [Русский](README.ru.md) · [العربية](README.ar.md) · [Bahasa Indonesia](README.id.md) · **Bahasa Melayu**

# Cube Solver Lab

Penyelesai teka-teki yang berjalan sepenuhnya dalam pelayar anda: kiub 2×2 hingga 15×15, Pyraminx dan Skewb. Di sebelah kiub 3D, graf pilih atur memaparkan setiap pelekat sebagai nod, jadi anda dapat melihat setiap pusingan menggerakkan pelekat di sepanjang bulatan.

**Laman web: https://cube-solver.org**

## Ciri-ciri

- **Selesaikan** kiub 2×2 hingga 15×15, Pyraminx dan Skewb. 2×2, Pyraminx dan Skewb mendapat penyelesaian optimum. 3×3 menggunakan algoritma dua fasa Kociemba (biasanya 19–21 gerakan). 5×5 ke atas menggunakan gullicube yang dikompil kepada WebAssembly berbilang bebenang.
- **Masukkan kedudukan** dengan mewarnakan bentangan kiub, menaip kocakan (`R U R' U2 …`, termasuk gerakan lebar dan lapisan tengah), mengimbas dengan kamera atau memuat naik foto.
- **Semakan** yang menerangkan kesilapannya: warna tidak cukup, bucu terpulas, sisi terbalik, pariti dan lain-lain.
- **Pemain langkah demi langkah** dengan garis masa, kawalan kelajuan dan pintasan papan kekunci, diselaraskan antara paparan 3D dan graf.
- **Main bebas** 2×2 hingga 15×15: pusingkan lapisan dengan menyeret atau papan kekunci, dengan pemasa, pemeriksaan WCA pilihan, buat asal/buat semula dan masa terbaik.
- **12 bahasa**, termasuk susun atur kanan-ke-kiri sepenuhnya untuk bahasa Arab, serta satu halaman statik mesra enjin carian bagi setiap teka-teki dalam setiap bahasa.
- **Bunyi sintesis**: semua bunyi dijana secara langsung dengan Web Audio API, tanpa sebarang fail audio.

## Privasi

- Imej kamera dan foto yang dimuat naik hanya diproses dalam pelayar anda. Ia tidak sekali-kali dimuat naik atau disimpan pada pelayan.
- Laman ini tidak menggunakan kuki, analitik atau sebarang skrip, fon atau penjejak pihak ketiga. Tetapan seperti bahasa, bunyi dan masa terbaik hanya disimpan dalam storan setempat pelayar anda.
- Laman ini ialah satu set fail statik yang dihoskan di Cloudflare, yang mengendalikan permintaan web biasa seperti mana-mana hos web.

## Jalankan secara setempat

Keperluan: Node.js 18 atau lebih baharu.

```bash
npm install
npx playwright install chromium   # hanya diperlukan untuk ujian pelayar
npm start                         # http://localhost:8765/
```

Kamera memerlukan konteks selamat (`https://` atau `http://localhost`). Pelayan setempat menghantar pengepala pengasingan rentas asal yang sama seperti laman langsung, yang diperlukan oleh WebAssembly berbilang bebenang.

## Ujian

```bash
npm test               # membina halaman SEO, kemudian menjalankan ujian unit, penyelesai dan SEO (tanpa pelayar)
npm run test:nxn       # semakan penyelesai 4×4–15×15 (lebih perlahan)
npm start &            # ujian pelayar memerlukan pelayan setempat
npm run test:e2e       # juga: test:i18n, test:play, test:twisty, test:naming
```

## Bina dan lancar

```bash
npm run build          # menghimpunkan laman sedia dilancar dalam dist/
```

Laman ini dilancarkan sebagai aset statik Cloudflare Workers (lihat `deploy/`):

```bash
export CLOUDFLARE_ACCOUNT_ID=<ID akaun anda>
export CLOUDFLARE_API_TOKEN=<token API yang boleh mengubah Workers>   # atau jalankan: npx wrangler login
npm run deploy
```

- `deploy/_headers` menetapkan `Cross-Origin-Opener-Policy` dan `Cross-Origin-Embedder-Policy`, yang diperlukan oleh penyelesai WebAssembly berbilang bebenang.
- `deploy/worker.js` hanya membuat ubah hala: `www` dan `*.workers.dev` ke domain utama, dan pautan lama `/?puzzle=…` ke laluan baharu. Fail statik (`/js`, `/css`, `/img`, `/puzzles`, `/vendor` dan sebagainya) dihantar terus tanpa menjalankan Worker, jadi setiap paparan halaman menggunakan satu permintaan Worker.
- Jika anda melancarkan salinan sendiri, tukar `name` dan `routes` dalam `deploy/wrangler.toml` serta `baseUrl` dalam `seo/site.config.json`.

Nota pembangun (dalam bahasa Cina): [docs/DEVELOPMENT.zh-Hans.md](docs/DEVELOPMENT.zh-Hans.md).

## Lesen dan penghargaan

- Kod projek ini dikeluarkan di bawah [Lesen MIT](LICENSE).
- Komponen pihak ketiga mengekalkan lesen masing-masing. Butirannya ada dalam [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
  - [gullicube](https://github.com/rokicki/gullicube) oleh Tomas Rokicki, penyelesai untuk 5×5 ke atas, digunakan tanpa pengubahsuaian di bawah Mozilla Public License 2.0 (salah satu pilihan lesennya "MPL-2.0 OR GPL-3.0-or-later"). Lihat `vendor/gullicube/` dan `tools/build-gullicube.sh`.
  - [cubejs](https://github.com/ldez/cubejs) (MIT), penyelesai dua fasa untuk 3×3, mempunyai tampalan kecil dalam `vendor/solve.js.cubelab.patch`.
  - [three.js](https://threejs.org/) (MIT) memaparkan paparan 3D.

## Tanda dagangan

Rubik's Cube ialah tanda dagangan berdaftar Spin Master Ltd. Projek ini tidak bergabung dengan, ditaja atau disokong oleh Spin Master. Perkataan "Rubik's" hanya digunakan untuk menerangkan teka-teki ini.
