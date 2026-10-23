[English](README.md) · [简体中文](README.zh-Hans.md) · [繁體中文](README.zh-Hant.md) · [日本語](README.ja.md) · [Español](README.es.md) · [Português](README.pt.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · [Русский](README.ru.md) · [العربية](README.ar.md) · **Bahasa Indonesia** · [Bahasa Melayu](README.ms.md)

# Cube Solver Lab

Pemecah teka-teki yang berjalan sepenuhnya di browser: kubus 2×2 sampai 15×15, Pyraminx, dan Skewb. Di samping kubus 3D, graf permutasi menampilkan setiap stiker sebagai simpul, sehingga Anda bisa melihat setiap putaran menggerakkan stiker di sepanjang lingkaran.

**Situs: https://cube-solver.org**

## Fitur

- **Memecahkan** kubus 2×2 sampai 15×15, Pyraminx, dan Skewb. 2×2, Pyraminx, dan Skewb mendapat solusi optimal. 3×3 memakai algoritme dua fase Kociemba (biasanya 19–21 langkah). 5×5 ke atas memakai gullicube yang dikompilasi ke WebAssembly multithread.
- **Masukkan posisi** dengan mewarnai jaring kubus, mengetik acakan (`R U R' U2 …`, termasuk gerakan lebar dan lapisan tengah), memindai dengan kamera, atau mengunggah foto.
- **Validasi** yang menjelaskan kesalahannya: warna kurang, sudut terpuntir, rusuk terbalik, paritas, dan lainnya.
- **Pemutar langkah demi langkah** dengan linimasa, pengatur kecepatan, dan pintasan keyboard, tersinkron antara tampilan 3D dan graf.
- **Main bebas** 2×2 sampai 15×15: putar lapisan dengan menyeret atau keyboard, dengan pengatur waktu, inspeksi WCA opsional, urungkan/ulangi, dan waktu terbaik.
- **12 bahasa**, termasuk tata letak kanan-ke-kiri penuh untuk bahasa Arab, serta satu halaman statis yang ramah mesin pencari untuk setiap teka-teki dalam setiap bahasa.
- **Suara sintetis**: semua suara dibuat langsung dengan Web Audio API, tanpa file audio apa pun.

## Privasi

- Gambar kamera dan foto yang diunggah hanya diproses di browser Anda. Semuanya tidak pernah diunggah atau disimpan di server.
- Situs ini tidak memakai cookie, analitik, maupun skrip, font, atau pelacak pihak ketiga. Pengaturan seperti bahasa, suara, dan waktu terbaik hanya disimpan di penyimpanan lokal browser Anda.
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
npm run test:e2e       # juga: test:i18n, test:play, test:twisty, test:naming
```

## Build dan deploy

```bash
npm run build          # menyusun situs siap-deploy di dist/
```

Situs ini di-deploy sebagai aset statis Cloudflare Workers (lihat `deploy/`):

```bash
export CLOUDFLARE_ACCOUNT_ID=<ID akun Anda>
export CLOUDFLARE_API_TOKEN=<token API yang dapat mengubah Workers>   # atau jalankan: npx wrangler login
npm run deploy
```

- `deploy/_headers` mengatur `Cross-Origin-Opener-Policy` dan `Cross-Origin-Embedder-Policy`, yang dibutuhkan pemecah WebAssembly multithread.
- `deploy/worker.js` hanya melakukan pengalihan: `www` dan `*.workers.dev` ke domain utama, serta tautan lama `/?puzzle=…` ke jalur baru. File statis (`/js`, `/css`, `/img`, `/puzzles`, `/vendor`, dan seterusnya) dikirim langsung tanpa menjalankan Worker, jadi satu kali membuka halaman memakai satu permintaan Worker.
- Jika Anda men-deploy salinan sendiri, ubah `name` dan `routes` di `deploy/wrangler.toml` serta `baseUrl` di `seo/site.config.json`.

Catatan pengembang (dalam bahasa Mandarin): [docs/DEVELOPMENT.zh-Hans.md](docs/DEVELOPMENT.zh-Hans.md).

## Lisensi dan kredit

- Kode proyek ini dirilis di bawah [Lisensi MIT](LICENSE).
- Komponen pihak ketiga tetap memakai lisensinya masing-masing. Rinciannya ada di [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
  - [gullicube](https://github.com/rokicki/gullicube) karya Tomas Rokicki, pemecah untuk 5×5 ke atas, digunakan tanpa modifikasi di bawah Mozilla Public License 2.0 (salah satu pilihan dari lisensinya "MPL-2.0 OR GPL-3.0-or-later"). Lihat `vendor/gullicube/` dan `tools/build-gullicube.sh`.
  - [cubejs](https://github.com/ldez/cubejs) (MIT), pemecah dua fase untuk 3×3, memiliki tambalan kecil di `vendor/solve.js.cubelab.patch`.
  - [three.js](https://threejs.org/) (MIT) merender tampilan 3D.

## Merek dagang

Rubik's Cube adalah merek dagang terdaftar milik Spin Master Ltd. Proyek ini tidak berafiliasi dengan, tidak disponsori, dan tidak didukung oleh Spin Master. Kata "Rubik's" hanya dipakai untuk menggambarkan teka-teki ini.
