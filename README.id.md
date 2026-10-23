[English](README.md) · [简体中文](README.zh-Hans.md) · [繁體中文](README.zh-Hant.md) · [日本語](README.ja.md) · [Español](README.es.md) · [Português](README.pt.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · [Русский](README.ru.md) · [العربية](README.ar.md) · **Bahasa Indonesia** · [Bahasa Melayu](README.ms.md)

# Cube Solver Lab

Pemecah teka-teki yang berjalan sepenuhnya di browser: kubus 2×2 sampai 15×15, Pyraminx, Skewb, dan Megaminx. Di samping model 3D, graf permutasi menampilkan setiap stiker sebagai simpul, sehingga Anda bisa melihat setiap putaran menggerakkan stiker di sepanjang lingkaran.

**Situs: https://cube-solver.org**

## Fitur

- **Memecahkan** kubus 2×2 sampai 15×15, Pyraminx, Skewb, dan Megaminx. 2×2, Pyraminx, dan Skewb mendapat solusi optimal. 3×3 memakai algoritme dua fase Kociemba (biasanya 19–21 langkah). 5×5 ke atas memakai gullicube yang dikompilasi ke WebAssembly multithread. Megaminx memakai metode multi-fase yang cepat (rata-rata sekitar 120 langkah HTM, tidak optimal).
- **Masukkan posisi** dengan mewarnai jaring kubus, mengetik acakan (`R U R' U2 …`, termasuk gerakan lebar dan lapisan tengah), memindai dengan kamera, atau mengunggah foto.
- **Validasi** yang menjelaskan kesalahannya: warna kurang, sudut terpuntir, rusuk terbalik, paritas, dan lainnya.
- **Pemutar langkah demi langkah** dengan linimasa, pengatur kecepatan, dan pintasan keyboard, tersinkron antara tampilan 3D dan graf.
- **Main bebas** di semua teka-teki: putar lapisan dengan menyeret atau keyboard, dengan pengatur waktu, inspeksi WCA opsional, urungkan/ulangi, dan waktu terbaik. Acakan Megaminx mengikuti gaya WCA (Pochmann).
- **12 bahasa**, termasuk tata letak kanan-ke-kiri penuh untuk bahasa Arab, serta satu halaman statis yang ramah mesin pencari untuk setiap teka-teki dalam setiap bahasa.
- **Suara sintetis**: semua suara dibuat langsung dengan Web Audio API, tanpa file audio apa pun.

## Privasi

- Gambar kamera dan foto yang diunggah hanya diproses di browser Anda. Semuanya tidak pernah diunggah atau disimpan di server.
- Situs langsung menghitung kunjungan dengan Cloudflare Web Analytics, yang tidak memakai cookie dan tidak mengumpulkan data pribadi; skrip ini dimuat untuk semua pengunjung. Google Analytics 4 hanya dimuat setelah Anda menekan Terima di spanduk persetujuan (Consent Mode v2, dengan penyimpanan iklan, data pengguna iklan, personalisasi iklan, dan Google Signals dimatikan); jika Anda menolak, skrip itu tidak pernah dimuat, dan pilihan dapat diubah kapan saja lewat tautan “Pengaturan analitik” di footer. Pengaturan seperti bahasa, suara, waktu terbaik, dan pilihan analitik Anda hanya disimpan di penyimpanan lokal browser Anda. Analitik hanya menghitung tampilan halaman: status puzzle dan gambar kamera tidak pernah dikirim.
- Situs ini berupa kumpulan file statis yang di-hosting di Cloudflare, yang menangani permintaan web biasa seperti layanan hosting pada umumnya.

## Menjalankan secara lokal

Kebutuhan: Node.js 18 atau lebih baru.

```bash
npm install
npx playwright install chromium   # hanya untuk pengujian di browser
npm start                         # http://localhost:8765/
```

Kamera memerlukan konteks aman (`https://` atau `http://localhost`). Server lokal mengirim header isolasi lintas-origin yang sama dengan situs publik, yang dibutuhkan WebAssembly multithread.

## Pengujian

```bash
npm test               # membangun halaman SEO, lalu menjalankan uji unit, pemecah, dan SEO (tanpa browser)
npm run test:nxn       # pemeriksaan pemecah 4×4–15×15 (lebih lama)
npm start &            # pengujian browser memerlukan server lokal
npm run test:e2e       # juga: test:i18n, test:play, test:twisty, test:naming, test:analytics
```

## Build dan deploy

```bash
npm run build          # menyusun situs siap-deploy di dist/
```

Situs ini di-deploy sebagai aset statis Cloudflare Workers (lihat `deploy/`):

```bash
export CLOUDFLARE_ACCOUNT_ID=<ID akun Anda>
export CLOUDFLARE_API_TOKEN=<token API yang dapat mengubah Workers>   # atau jalankan: npx wrangler login
export CF_BEACON_TOKEN=<token>               # opsional: token Cloudflare Web Analytics
export GA_MEASUREMENT_ID=G-XXXXXXXXXX        # opsional: ID pengukuran GA4, hanya dimuat setelah persetujuan
npm run deploy
```

- `deploy/_headers` mengatur `Cross-Origin-Opener-Policy` dan `Cross-Origin-Embedder-Policy`, yang dibutuhkan pemecah WebAssembly multithread.
- `deploy/worker.js` hanya melakukan pengalihan: `www` dan `*.workers.dev` ke domain utama, serta tautan lama `/?puzzle=…` ke jalur baru. File statis (`/js`, `/css`, `/img`, `/puzzles`, `/vendor`, dan seterusnya) dikirim langsung tanpa menjalankan Worker, jadi satu kali membuka halaman memakai satu permintaan Worker.
- ID analitik tidak ada di repositori. `npm run build` membaca `CF_BEACON_TOKEN` dan `GA_MEASUREMENT_ID` dari environment (atau dari file `.env` yang diabaikan git, berisi baris `KEY=value`) dan hanya menuliskannya ke `dist/`. Jika tidak diatur, hasil build tidak memuat analitik, spanduk persetujuan, maupun pelacakan; analitik juga hanya berjalan di domain produksi.
- Jika Anda men-deploy salinan sendiri, ubah `name` dan `routes` di `deploy/wrangler.toml` serta `baseUrl` di `seo/site.config.json`.

Catatan pengembang: [docs/DEVELOPMENT.id.md](docs/DEVELOPMENT.id.md).

## Ucapan terima kasih

Tampilan graf yang menggambar kubus sebagai lingkaran-lingkaran terinspirasi dari animasi じゃがりきん ([@jagarikin](https://x.com/jagarikin)): [versi asli (2022-05)](https://x.com/jagarikin/status/1524175137633095681), [dengan kubus 3D (2022-11)](https://x.com/jagarikin/status/1593771091738374144). Kami pertama kali mengenal ide ini lewat [unggahan @UnicornBitcoin ini](https://x.com/UnicornBitcoin/status/2107652690113339684). Terima kasih untuk keduanya.

## Lisensi dan kredit

- Kode proyek ini dirilis di bawah [Lisensi MIT](LICENSE).
- Komponen pihak ketiga tetap memakai lisensinya masing-masing. Rinciannya ada di [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
  - [gullicube](https://github.com/rokicki/gullicube) karya Tomas Rokicki, pemecah untuk 5×5 ke atas, digunakan tanpa modifikasi di bawah Mozilla Public License 2.0 (salah satu pilihan dari lisensinya "MPL-2.0 OR GPL-3.0-or-later"). Lihat `vendor/gullicube/` dan `tools/build-gullicube.sh`.
  - [cubejs](https://github.com/ldez/cubejs) (MIT), pemecah dua fase untuk 3×3, memiliki tambalan kecil di `vendor/solve.js.cubelab.patch`.
  - [three.js](https://threejs.org/) (MIT) merender tampilan 3D.

## Merek dagang

Rubik's Cube adalah merek dagang terdaftar milik Spin Master Ltd. Proyek ini tidak berafiliasi dengan, tidak disponsori, dan tidak didukung oleh Spin Master. Kata "Rubik's" hanya dipakai untuk menggambarkan teka-teki ini.
