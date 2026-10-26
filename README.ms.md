[English](README.md) · [简体中文](README.zh-Hans.md) · [繁體中文](README.zh-Hant.md) · [日本語](README.ja.md) · [Español](README.es.md) · [Português](README.pt.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · [Русский](README.ru.md) · [العربية](README.ar.md) · [Bahasa Indonesia](README.id.md) · **Bahasa Melayu**

# Cube Solver Lab

Penyelesai teka-teki yang berjalan sepenuhnya dalam pelayar anda: kiub 2×2 hingga 15×15, Pyraminx, Skewb dan Megaminx. Di sebelah model 3D, graf pilih atur memaparkan setiap pelekat sebagai nod, jadi anda dapat melihat setiap pusingan menggerakkan pelekat di sepanjang bulatan.

**Laman web: https://cube-solver.org**

## Ciri-ciri

- **Selesaikan** kiub 2×2 hingga 15×15, Pyraminx, Skewb dan Megaminx. 2×2, Pyraminx dan Skewb mendapat penyelesaian optimum. 3×3 menggunakan algoritma dua fasa Kociemba (biasanya 19–21 gerakan). 5×5 ke atas menggunakan gullicube yang dikompil kepada WebAssembly berbilang bebenang. Megaminx menggunakan kaedah pelbagai fasa yang pantas (purata kira-kira 120 gerakan HTM, bukan optimum).
- **Masukkan kedudukan** dengan mewarnakan bentangan kiub, menaip kocakan (`R U R' U2 …`, termasuk gerakan lebar dan lapisan tengah), mengimbas dengan kamera atau memuat naik foto.
- **Semakan** yang menerangkan kesilapannya: warna tidak cukup, bucu terpulas, sisi terbalik, pariti dan lain-lain.
- **Pemain langkah demi langkah** dengan garis masa, kawalan kelajuan dan pintasan papan kekunci, diselaraskan antara paparan 3D dan graf.
- **Main bebas** pada semua teka-teki: pusingkan lapisan dengan menyeret atau papan kekunci, dengan pemasa, pemeriksaan WCA pilihan, buat asal/buat semula dan masa terbaik. Kacauan Megaminx mengikut gaya WCA (Pochmann).
- **12 bahasa**, termasuk susun atur kanan-ke-kiri sepenuhnya untuk bahasa Arab, serta satu halaman statik mesra enjin carian bagi setiap teka-teki dalam setiap bahasa.
- **Bunyi sintesis**: semua bunyi dijana secara langsung dengan Web Audio API, tanpa sebarang fail audio.

## Privasi

- Imej kamera dan foto yang dimuat naik hanya diproses dalam pelayar anda. Ia tidak sekali-kali dimuat naik atau disimpan pada pelayan.
- Laman langsung mengira lawatan dengan Cloudflare Web Analytics, yang tidak menggunakan kuki dan tidak mengumpul data peribadi; ia dimuatkan untuk semua pelawat. Google Analytics 4 sentiasa berjalan dengan Consent Mode v2, dengan storan iklan, data pengguna iklan, pemperibadian iklan dan Google Signals dimatikan. Di EU/EEA, UK dan Switzerland (dan apabila negara tidak dapat ditentukan) ia hanya dimuatkan selepas anda menekan Terima pada sepanduk persetujuan; di tempat lain tiada sepanduk dan ia dimuatkan hanya untuk statistik paparan halaman. Dalam kedua-dua kes anda boleh menghidupkan atau mematikannya pada bila-bila masa melalui pautan “Tetapan analitik” di pengaki; Tolak menghentikannya dan memadam kukinya. Tetapan seperti bahasa, bunyi, masa terbaik dan pilihan analitik anda hanya disimpan dalam storan setempat pelayar anda. Analitik hanya mengira paparan halaman: keadaan teka-teki dan imej kamera tidak pernah dihantar.
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
npm run test:e2e       # juga: test:i18n, test:play, test:twisty, test:naming, test:analytics
```

## Bina dan lancar

```bash
npm run build          # menghimpunkan laman sedia dilancar dalam dist/
```

Laman ini dilancarkan sebagai aset statik Cloudflare Workers (lihat `deploy/`):

```bash
export CLOUDFLARE_ACCOUNT_ID=<ID akaun anda>
export CLOUDFLARE_API_TOKEN=<token API yang boleh mengubah Workers>   # atau jalankan: npx wrangler login
export CF_BEACON_TOKEN=<token>               # pilihan: token Cloudflare Web Analytics
export GA_MEASUREMENT_ID=G-XXXXXXXXXX        # pilihan: ID pengukuran GA4, hanya dimuatkan selepas persetujuan
npm run deploy
```

- `deploy/_headers` menetapkan `Cross-Origin-Opener-Policy` dan `Cross-Origin-Embedder-Policy`, yang diperlukan oleh penyelesai WebAssembly berbilang bebenang.
- `deploy/worker.js` hanya membuat ubah hala: `www` dan `*.workers.dev` ke domain utama, dan pautan lama `/?puzzle=…` ke laluan baharu. Fail statik (`/js`, `/css`, `/img`, `/puzzles`, `/vendor` dan sebagainya) dihantar terus tanpa menjalankan Worker, jadi setiap paparan halaman menggunakan satu permintaan Worker.
- ID analitik tiada dalam repositori. `npm run build` membaca `CF_BEACON_TOKEN` dan `GA_MEASUREMENT_ID` daripada persekitaran (atau fail `.env` yang diabaikan git, dengan baris `KEY=value`) dan hanya menulisnya ke `dist/`. Jika tidak ditetapkan, binaan tidak mengandungi analitik, sepanduk persetujuan atau penjejakan; analitik juga hanya berjalan pada domain pengeluaran.
- Jika anda melancarkan salinan sendiri, tukar `name` dan `routes` dalam `deploy/wrangler.toml` serta `baseUrl` dalam `seo/site.config.json`.

Nota pembangun: [docs/DEVELOPMENT.ms.md](docs/DEVELOPMENT.ms.md).

Menyumbang: laporan pepijat, pembetulan terjemahan dan pull request dialu-alukan — lihat [CONTRIBUTING.md](CONTRIBUTING.md) (bahasa Inggeris). Isu keselamatan: [SECURITY.md](SECURITY.md).

## Penghargaan

Paparan graf yang melukis kiub sebagai bulatan-bulatan diilhamkan oleh animasi じゃがりきん ([@jagarikin](https://x.com/jagarikin)): [asal (2022-05)](https://x.com/jagarikin/status/1524175137633095681), [dengan kiub 3D (2022-11)](https://x.com/jagarikin/status/1593771091738374144). Kami mula-mula mengetahui idea ini melalui [hantaran @UnicornBitcoin ini](https://x.com/UnicornBitcoin/status/2107652690113339684). Terima kasih kepada kedua-duanya.

## Lesen dan penghargaan

- Kod projek ini dikeluarkan di bawah [Lesen MIT](LICENSE).
- Komponen pihak ketiga mengekalkan lesen masing-masing. Butirannya ada dalam [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
  - [gullicube](https://github.com/rokicki/gullicube) oleh Tomas Rokicki, penyelesai untuk 5×5 ke atas, digunakan tanpa pengubahsuaian di bawah Mozilla Public License 2.0 (salah satu pilihan lesennya "MPL-2.0 OR GPL-3.0-or-later"). Lihat `vendor/gullicube/` dan `tools/build-gullicube.sh`.
  - [cubejs](https://github.com/ldez/cubejs) (MIT), penyelesai dua fasa untuk 3×3, mempunyai tampalan kecil dalam `vendor/solve.js.cubelab.patch`.
  - [three.js](https://threejs.org/) (MIT) memaparkan paparan 3D.

## Tanda dagangan

Rubik's Cube ialah tanda dagangan berdaftar Spin Master Ltd. Projek ini tidak bergabung dengan, ditaja atau disokong oleh Spin Master. Perkataan "Rubik's" hanya digunakan untuk menerangkan teka-teki ini.
