[English](DEVELOPMENT.md) · [简体中文](DEVELOPMENT.zh-Hans.md) · [繁體中文](DEVELOPMENT.zh-Hant.md) · [日本語](DEVELOPMENT.ja.md) · [Español](DEVELOPMENT.es.md) · [Português](DEVELOPMENT.pt.md) · [Français](DEVELOPMENT.fr.md) · [Deutsch](DEVELOPMENT.de.md) · [Русский](DEVELOPMENT.ru.md) · [العربية](DEVELOPMENT.ar.md) · **Bahasa Indonesia** · [Bahasa Melayu](DEVELOPMENT.ms.md)

# Cube Solver Lab (CubeLab) · Catatan Pengembang

> Catatan rinci untuk pengembang. Versi bahasa Inggris ([DEVELOPMENT.md](DEVELOPMENT.md)) adalah acuan utama; terjemahan ini mengikutinya. Untuk ikhtisar proyek, cara menjalankan, pengujian, deployment, lisensi, dan privasi, lihat [README](../README.id.md).
> `ref/` (frame video referensi) dan `screenshots/` (tangkapan layar hasil pengujian) yang disebut di bawah tidak ada di repositori; pengujian membuat folder tangkapan layar saat dijalankan.

Penyelesai puzzle yang sepenuhnya berjalan di front-end (HTML/CSS/JS statis, tanpa back-end). Ciri khasnya adalah **tampilan graf**: di samping puzzle 3D terdapat “graf permutasi” dengan setiap stiker sebagai simpul. Untuk 3×3 ini berupa **tiga kelompok lingkaran konsentris** (tiap kelompok 3 lingkaran = 3 lapisan satu sumbu; pusat-pusatnya membentuk segitiga sama sisi sehingga muncul pola kelopak bersimetri lipat tiga), dengan 54 simpul di titik-titik potongnya. Pada setiap gerakan, lingkaran lapisan itu menjadi gelap, 12 stiker samping bergerak di sepanjang busur (dengan jejak memudar berwarna stiker), dan 9 stiker sisi yang diputar berotasi di dalam klasternya — tersinkron tepat dengan putaran 3D. Kubus teracak mencampur warna; kubus terselesaikan membentuk 6 klaster rapat berwarna tunggal.

## Fitur

| Modul | Keterangan |
| --- | --- |
| Pewarnaan | Jaring + palet, klik / seret untuk mewarnai, penghitung warna, reset / acak / kosongkan |
| Input rumus | Masukkan acakan (`R U R' U2 …`, irisan `M E S` didukung), diterapkan dari keadaan terselesaikan dengan pegangan WCA (putih di atas, hijau di depan) |
| Pindai kamera | Gambar langsung `getUserMedia` + lapisan kisi + pratinjau pengenalan langsung; urutan 6 sisi terpandu (dengan petunjuk orientasi) |
| Unggah foto | Setiap sisi dapat memakai foto yang diunggah; penggeser “ukuran kisi” menyelaraskan stiker |
| Pengenalan warna | RGB median di dalam setiap sel → CIE Lab. Selama pemindaian: pratinjau langsung terhadap warna tipikal (ukuran ganjil dikalibrasi dengan pusat yang terukur). **Setelah keenam sisi** (`js/core/color-cluster.js`): k-means berkapasitas sama atas semua 6n² sel (tepat n² per warna, kecerahan berbobot lebih rendah) → nama warna dengan mencoba semua 6! penetapan (ditentukan oleh pusat pada ukuran ganjil) → dekode berkendala per orbit kepingan dengan algoritme Hungaria (sudut harus salah satu dari 8 tripel warna berorientasi yang sah, tepi / sayap pasangan yang sah, tiap orbit pusat satu kuota per warna) → estimasi ulang pusat warna dan selesaikan lagi. Juga berlaku untuk ukuran genap (tanpa pusat tetap) |
| Validasi | Pesan terlokalisasi (12 bahasa, aturan jamak Intl): stiker belum diwarnai, pusat ganda, jumlah warna, kepingan mustahil, kepingan ganda, sudut terpelintir, tepi terbalik, paritas (dua kepingan tertukar) |
| Penyelesaian | Di dalam Web Worker. 3×3: ① BFS dua arah (terbukti optimal hingga 8 gerakan) ② Kociemba dua fase (cubejs) dengan pemendekan iteratif dalam anggaran waktu, biasanya 19–21 gerakan. Puzzle lain: lihat di bawah |
| Pemutar | Putar / jeda / mundur / maju / awal / akhir / kecepatan / garis waktu yang dapat diseret / klik langkah mana pun; tombol: Spasi, ←, →; tempo dan easing diukur dari video referensi |
| Suara | Disintesis langsung dengan Web Audio (tanpa berkas audio): suara putaran realistis, arpeggio saat selesai, sapuan showcase, klik pewarnaan, isyarat pengambilan; musik latar hasil generasi opsional; “efek / musik / volume” di bilah pemutar, disimpan secara lokal |
| Pegangan | “Kuning di atas, hijau di depan” (bawaan, sama dengan video referensi) / “Putih di atas, hijau di depan (WCA)”: mengubah orientasi 3D sekaligus notasi, sehingga U selalu lapisan atas di layar |
| Mode demo | “Acak dulu, lalu selesaikan”: memutar acakan dari keadaan terselesaikan, lalu solusinya |
| Responsif | Di ponsel, 3D dan graf ditumpuk vertikal; kontrol berpindah baris |
| Bahasa | 12 bahasa (English, 简体中文, 繁體中文, Español, العربية, Português, Bahasa Indonesia, Bahasa Melayu, Français, 日本語, Русский, Deutsch), RTL penuh untuk bahasa Arab; ikon bola dunia di kanan atas, pilihan disimpan secara lokal |

## N×N (2×2 – 15×15)

Menu “Puzzle” di atas menawarkan 2×2 … 15×15 (juga `?n=7`). Semua tampilan (pewarnaan jaring, rumus, kisi kamera N×N, 3D three.js, graf tiga kelompok n lingkaran konsentris dengan zoom / geser, pemutar) dibuat untuk setiap ukuran.

| Ukuran | Penyelesai | Metrik | Terukur (acakan acak, semuanya diverifikasi terselesaikan) |
| --- | --- | --- | --- |
| 2×2 | Penyelesai optimal buatan sendiri (tabel jarak lengkap, 3.674.160 keadaan, BFS) | HTM | 100 penyelesaian: rata-rata 8,87, maks. 10; tabel ≈ 0,3 dtk, penyelesaian < 1 md |
| 3×3 | BFS ≤ 8 optimal + Kociemba dua fase dengan pemendekan | HTM | biasanya 19–21 gerakan |
| 4×4 | Metode reduksi buatan sendiri (di bawah); gullicube opsional | OBTM | 12 penyelesaian (Node): rata-rata 56,8, maks. 64; tabel ≈ 3,2 dtk; penyelesaian rata-rata 6,9 dtk (terlambat 16 dtk) |
| 5×5 – 15×15 | gullicube (T. Rokicki, MPL-2.0) yang dikompilasi ke WebAssembly multithread; mode kualitas / cepat | SSTM | lihat tabel di bawah |

gullicube (Node, 4 thread, build yang sama dengan peramban; SSTM):

| n | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Kualitas (--time 16, ≈ 10–15 dtk, unduhan pertama ≈ 30 MB tabel) | 119 | 169 | 257 | 329 | 448 | 563 | 678 | 833 | 981 | 1131 | 1408 |
| Cepat (--fast, ≈ 2–4 dtk, ≈ 0,5 MB tabel) | 168 | 281 | 402 | 571 | 695 | 972 | 1130 | 1495 | 1635 | 1950 | 2231 |

Perangkat bermemori rendah (`navigator.deviceMemory` < 4 GB) serta ponsel / tablet memakai mode cepat secara bawaan untuk n ≥ 5; menu penyelesai dapat beralih kualitas / kecepatan kapan saja. WASM multithread memerlukan isolasi lintas asal: `deploy/_headers` mengatur COOP / COEP / CORP.

**Analitik** (`js/analytics.js`, hanya berjalan di cube-solver.org): Cloudflare Web Analytics tanpa cookie dan dimuat untuk semua orang; GA4 baru menyisipkan gtag.js setelah pengunjung mengeklik “Terima” (Consent Mode v2, hanya `analytics_storage` yang diberikan). Keduanya merespons dengan `Cross-Origin-Resource-Policy: cross-origin` + header CORS, sehingga `require-corp` tetap ada dan isolasi lintas asal tidak rusak. Perubahan rute SPA (`history.replaceState`) dihitung otomatis oleh mode SPA CF dan pengukuran lanjutan GA4 (“perubahan halaman berdasarkan peristiwa riwayat peramban”); jangan kirim `page_view` secara manual (akan terhitung ganda). Pengujian: `npm run test:analytics` (lokal, beacon dicegat) / `npm run test:analytics:live`. ID analitik tidak ada di repositori: `tools/build-dist.js` membaca `CF_BEACON_TOKEN` dan `GA_MEASUREMENT_ID` dari lingkungan (atau `.env` yang diabaikan git) dan hanya menuliskannya ke `dist/js/analytics.js`; tanpa keduanya tidak ada analitik, spanduk persetujuan, maupun pelacakan. Semuanya berada dalam kuota gratis aset statis Cloudflare Workers (berkas statis tidak ditagih sebagai permintaan Worker; Worker hanya berjalan untuk rute halaman).

**Penyelesai reduksi 4×4** (`puzzles/nxn/cube4.worker.js`, kode buatan sendiri; gagasan fasenya mengikuti metode publik bergaya Tsai / TPR, tanpa menyalin kode):
1. P1 (36 gerakan): pusat berwarna R/L ke R/L, tabel jarak eksak C(24,8).
2. P2 (lapisan luar + Rw/Lw + Uw2/Dw2/Fw2/Bw2): pusat U/D ke U/D, pusat sumbu R/L ke salah satu dari 12 susunan yang dapat diselesaikan, semua sayap “berorientasi” (24 posisi sayap terbagi dua kelas di bawah grup P3), permutasi sayap genap (menghilangkan paritas OLL).
3. P3a (U D F B, R2 L2, putaran setengah lebar): pusat ke subhimpunan yang dapat diselesaikan di P3b, 8 sayap irisan E kembali ke irisan E, P3b dapat diselesaikan.
4. P3b (U D, F2 B2 R2 L2, putaran setengah lebar): pusat terselesaikan, 12 tepi berpasangan, paritas PLL dihilangkan.
5. 3×3 yang setara diteruskan ke Kociemba dua fase (cubejs).
Setiap fase memakai IDA*; dalam anggaran waktu, beberapa kandidat dari fase sebelumnya dicoba dan yang terpendek disimpan; gerakan bersebelahan pada sumbu yang sama digabungkan.

Pengujian: `node tests/nxn.test.js [sampel 4×4]` (model 2–15 + 2×2 + 4×4), `node tests/gullicube.test.js 5,7,10,15 both`, langsung `node tests/live-nxn.js <URL>`.

### Tabel prahitung (penyelesai 4×4 dan 3×3)

`npm run build:tables` menulis `puzzles/nxn/cube4-tables.bin.gz` (1,61 MB, 7 tabel jarak) dan `puzzles/cube3/cubejs-prune.bin.gz` (0,89 MB, tabel pemangkasan cubejs). Format: `CLT1` + panjang header + direktori JSON (nama / tipe / panjang / checksum FNV-1a) + byte mentah, dikompresi gzip (`js/core/table-pack.js`). Worker mengunduh tabel sambil membangun tabel gerakan; peramban mengekstrak dengan `DecompressionStream`, memverifikasi setiap tabel, dan kembali menghitung di tempat jika unduhan gagal, checksum tidak cocok, atau peramban tidak mendukungnya. Setelah mengubah struktur tabel suatu penyelesai, jalankan ulang `npm run build:tables` (`tests/tables.test.js` membandingkan tabel dengan perhitungan langsung).

## Main bebas (semua puzzle)

Sakelar “Selesaikan / Main bebas” di atas panggung (atau `?mode=play`).

| Aksi | Keterangan |
|---|---|
| Seret stiker (tetikus / sentuh) | Memutar lapisan stiker itu. Kubus: dari dua sumbu sisi, dipilih yang proyeksinya paling cocok dengan arah seret; sumbu putar = normal sisi × arah seret; pada kubus besar lapisan yang dipegang ikut berputar (lapisan dalam 2R, 3R…, lapisan tengah ukuran ganjil M / E / S). Puzzle lain memakai `dragMoves` (di bawah). Saat disentuh, kanvas memiliki `touch-action: none` sehingga halaman tidak bergulir |
| Seret di ruang kosong | Memutar tampilan (klik ganda untuk reset) |
| Papan ketik | `U D L R F B` (Shift = berlawanan arah jarum jam); awalan angka memilih lapisan (`2` `R` → 2R); awalan `w` untuk gerakan lebar (`3` `w` `R` → 3Rw); `M E S` pada ukuran ganjil; rotasi `x y z` (2×2 dan 4×4+); Ctrl+Z / Backspace untuk batal, Ctrl+Y / Ctrl+Shift+Z untuk ulang; Esc menghapus awalan. Notasi mengikuti pegangan saat ini (lapisan atas di layar selalu U) |
| Kolom rumus | Rumus apa pun (3Rw, 2R, M/E/S…), Enter menjalankannya dengan animasi langkah demi langkah |
| Acak | 2×2 / 3×3: keadaan acak seragam (`CubeLab.play.randomState`); 4×4+: gerakan acak; Pyraminx / Skewb: keadaan acak seragam; Megaminx: acakan WCA (Pochmann) |
| Pengatur waktu | Mulai pada gerakan pertama (bukan rotasi) setelah mengacak, berhenti saat selesai; inspeksi WCA 15 dtk opsional (+2 setelah 15 dtk, DNF setelah 17 dtk) |
| Jumlah gerakan | STM hingga 3×3, BTM untuk 4×4+ (rotasi tidak dihitung); Pyraminx / Skewb VTM; Megaminx HTM |
| Batal / ulang / reset / selesaikan dari keadaan saat ini | “Selesaikan” kembali ke mode penyelesaian dan menyelesaikan keadaan saat ini, diputar seperti biasa (percobaan ini tidak dicatat waktunya) |

- Waktu terbaik tiap puzzle disimpan di `localStorage` (`cubelab.best.<puzzle>`). Saat selesai ada sorotan ringan + suara selesai (mengikuti sakelar efek) + putaran showcase (mengikuti sakelar putar otomatis).
- Implementasi: `js/core/play-core.js` (logika murni, dapat diuji di Node), `Player.pushMove / popMove` (antrean animasi, mempercepat saat tertinggal dan tidak pernah kehilangan gerakan), `View3D.pick / dragTurn / setPlayMode`, dan kontrol mode di `app.js`. Graf diperbarui langkah demi langkah bersama 3D.

## Pyraminx dan Skewb

Keduanya plugin lengkap (`puzzles/twisty/`): model, validasi, 3D, editor jaring, tampilan graf, penyelesai optimal ketat, main bebas, 12 bahasa.

- **Model** (`twisty-model.js`, dipakai bersama halaman / worker / Node): stiker dibangkitkan dari geometri (Pyraminx: 9 segitiga per sisi; Skewb: 1 persegi + 4 segitiga sudut per sisi); permutasi setiap gerakan = memutar titik berat dan normal stiker lapisan 120° mengelilingi sumbu lalu mencocokkan stiker. Notasi WCA: Pyraminx `U L R B` (dua lapisan) + `u l r b` (ujung); Skewb `R U L B` (R = sudut bawah-kanan-belakang, U = atas-kiri-belakang, L = bawah-kiri-depan, B = bawah-kiri-belakang; sudut atas-kanan-depan tetap).
- **Penyelesai optimal** (`twisty.worker.js?p=…`): keadaan warna → kepingan + orientasi, dipisah per kelas kepingan menjadi komponen independen; BFS terlebih dulu mencari himpunan terjangkau dan tabel gerakan tiap komponen, lalu BFS penuh atas ruang hasil kali (tabel jarak `Uint8Array`); solusi menuruni tabel sehingga panjangnya tepat jarak minimum (VTM: setiap putaran 120° dihitung 1). Ujung Pyraminx komutatif dengan semuanya dan diatur di akhir dengan 0 / 1 gerakan masing-masing (tetap optimal).

| | Keadaan (inti) | Komponen | Angka Tuhan terukur | Tabel | Pembangunan (Node / peramban termasuk mulai worker) | Penyelesaian |
|---|---|---|---|---|---|---|
| Pyraminx | 933.120 (× 81 ujung = 75.582.720) | tepi 11.520 × pusat aksial 81 | 11 (15 dengan ujung) | 0,93 MB | ≈ 60 md / ≈ 250 md | ≈ 0,03 md |
| Skewb | 3.149.280 | pusat 360 × sudut 8.748 | 11 (90 antipoda) | 3,15 MB | ≈ 180 md / ≈ 400 md | ≈ 0,01 md |

  Tabel dibangun di peramban (lebih cepat daripada mengunduh tabel terkompresi), sehingga tidak perlu aset tambahan. `tests/twisty.test.js` memeriksa: setiap gerakan dipangkatkan tiga = identitas, saling meniadakan dengan inversnya, memindahkan kepingan utuh; hasil kali komponen = jumlah terjangkau BFS (komponen independen); jumlah per lapisan; tabel adalah stratifikasi BFS yang konsisten; keadaan acak terselesaikan dengan panjang = jarak tabel; validator menolak tepi terbalik / sudut terpelintir / dua kepingan tertukar / kombinasi warna mustahil / pegangan salah.
- **3D**: setiap kepingan adalah polihedron cembung padat (bentuk ∩ setengah ruang bidang potong: dua per titik sudut pada Pyraminx, 4 bidang melalui pusat pada Skewb); putaran memutar seluruh lapisan, permukaan potong bergeser di bidangnya sendiri dan tidak pernah bersilangan; stiker berupa segitiga / persegi membulat yang menjorok ke dalam.
- **Tampilan graf**: orbit stiker setiap putaran 120° adalah siklus-3, digambar sebagai lingkaran yang melalui 3 simpul itu. Simpul Pyraminx = pusat stiker pada jaring (titik sudut U / L / R adalah pusat kelompok lingkaran konsentris, lingkaran lapisan B melingkupi seluruh jaring); Skewb memakai proyeksi azimut berjarak sama dari sudut DBL (lapisan B berupa lingkaran konsentris, R / U / L tiga kelopak).
- **Editor jaring**: poligon SVG (klik / seret untuk mewarnai, Enter mewarnai dengan papan ketik, kesalahan diberi garis merah). Pyraminx: sisi depan di tengah, sisi kiri / kanan di sampingnya, alas di bawahnya; Skewb: salib yang sama dengan kubus.
- **Main bebas**: saat stiker diseret, dari gerakan kandidat dipilih yang kecepatan sesaat stiker itu paling cocok dengan arah seret (sumbu sama: yang kepingannya lebih sedikit, jadi menyeret ujung hanya memutar ujung); tombol `U L R B` / `R U L B` (Shift = berlawanan arah jarum jam), pada Pyraminx `T` lalu huruf = ujung; acak = keadaan acak seragam; pengatur waktu / rekor seperti kubus.
- **Pengenalan kamera / foto**: belum didukung (stiker segitiga / belah ketupat memerlukan kisi sampel baru dan pewarnaan berkendala kepingan); puzzle ini menyembunyikan tab pindai dan meminta pewarnaan.

## Megaminx

Plugin lengkap di `puzzles/megaminx/` (kode buatan sendiri, MIT): `megaminx-model.js` (geometri, gerakan, validasi; dipakai bersama halaman / worker / Node), `megaminx.js` (plugin: 3D, jaring, graf, notasi, main bebas), `megaminx-solver.js` (penyelesai multifase), `megaminx.worker.js`, dan `megaminx-ll.json` (tabel lapisan terakhir, dibangkitkan secara offline oleh `tools/megaminx-ll-gen.js`).

- **Model**: 12 sisi × 11 stiker = 132 stiker, 62 kepingan (12 pusat, 30 tepi, 20 sudut). Gerakan sisi `U F R L BL BR D DR DL B FL FR` dengan `X X' X2 X2'` (72° / 144°, searah jarum jam bila dilihat dari sisi itu); gerakan WCA Pochmann `R++ R-- D++ D--` (semua kecuali lapisan L / U diputar 144°). Permutasi setiap gerakan diperoleh dengan memutar titik berat dan normal stiker. Validasi: jumlah warna, kepingan mustahil atau ganda, sudut terpelintir, tepi terbalik, paritas permutasi, dan susunan pusat (`v.megaCenters`).
- **Penyelesai** (multifase, tidak optimal, HTM gaya WCA: setiap putaran sisi 72° atau 144° dihitung 1):
  1. Setelah validasi, keadaan diputar / diberi label ulang agar pusat mengikuti skema standar, lalu diubah menjadi kode kepingan (sudut: slot × 3 orientasi, tepi: slot × 2).
  2. **F2L, sisi demi sisi**: D, lima sisi cincin di sekitar D, lalu empat dari lima sisi atas. Setelah semua kepingan suatu sisi terpasang, sisi itu tidak diputar lagi — himpunan gerakan S menyempit, dan kepingan yang tidak tersentuh tetap terselesaikan. Kepingan baru di tiap langkah dibagi menjadi kelompok kecil (≤ 3 kepingan: satu sudut dan tepi tetangganya); setiap kelompok diselesaikan dengan IDA*, yang heuristiknya adalah maksimum dari tabel jarak kecil kelompok kepingan (BFS di bawah S saat ini, dibangun saat pertama dipakai dan di-cache). Sebelum langkah terakhir dua sisi ditambahkan tabel orientasi tepi (seperti EO `<R,U>` pada 3×3) agar langkah itu selesai dengan dua generator. Anggaran simpul dengan percobaan ulang (memakai solusi berikutnya dari kelompok sebelumnya) menjaga kasus lambat yang jarang tetap singkat.
  3. **Lapisan terakhir dua tahap** lewat tabel: tahap 1 = permutasi tepi + orientasi tepi + orientasi sudut (60 · 16 · 81 = 77.760 keadaan), tahap 2 = permutasi sudut × permutasi tepi (3.600 keadaan). Generator menelusuri subgrup tiga sisi `<U,X,Y>` dengan meet-in-the-middle (≤ 7 gerakan per sisi) untuk mencari urutan yang mempertahankan semua kepingan di luar U, menyimpan yang terpendek untuk tiap efek beserta 5 putaran U-nya (39.059 makro), lalu menjalankan Dijkstra dengan biaya HTM.
  4. Gerakan bersebelahan pada sisi yang sama digabungkan (satuan 72° modulo 5).
- **Terukur** (Node, `tests/megaminx.test.js` / benchmark): 1.000 keadaan acak, semuanya terselesaikan: rata-rata 120,1 HTM (F2L 95,4 + lapisan terakhir 26,4), maks. 135, min. 97; waktu penyelesaian rata-rata 34 md, maks. 1,6 dtk. 500 acakan Pochmann: rata-rata 119,7, maks. 135, rata-rata 29 md, maks. 0,9 dtk. Di peramban satu penyelesaian biasanya 2–20 md ditambah overhead worker; mulai worker + memuat tabel ≈ 170–200 md. Angka ini dicatat di `seo/site.config.json` dan ditampilkan di halaman SEO.
- **3D**: `view3d.geometry: 'poly'` dengan dodekahedron sebagai `solid` dan 12 bidang potong sebagai `cuts`; kepingan berupa polihedron cembung.
- **Tampilan graf**: proyeksi stereografis posisi stiker dari pusat sisi D (satu simpul itu disembunyikan). Setiap putaran sisi 72° memindahkan stikernya dalam siklus-5, dan 5 titik setiap siklus terletak pada satu lingkaran di proyeksi (proyeksi stereografis memetakan lingkaran ke lingkaran); karena itu setiap orbit digambar sebagai lingkaran luar siklus-5-nya: 39 lingkaran, 131 simpul terlihat. Sisi U putih berada di tengah, sisi atas di sekelilingnya, sisi bawah sebagai kelopak luar yang besar; zoom memperlihatkan pusat yang padat.
- **Editor jaring**: dua “bunga” berisi 6 segi lima berdampingan (U dengan 5 tetangganya, D dengan 5 tetangganya), poligon SVG seperti bentuk lainnya.
- **Main bebas**: seret (`dragMoves` generik), tombol `U F R L B D` ditambah `I`=BL, `O`=BR, `J`=FL, `K`=FR, `N`=DL, `M`=DR (Shift = berlawanan arah jarum jam); penghitungan HTM; acak = acakan WCA Pochmann 77 gerakan (7 baris `R±± D±±` × 5 + `U`/`U'`); “selesaikan dari keadaan saat ini” bekerja seperti puzzle lainnya.
- **Pindai kamera**: disembunyikan (`cameraPlan: null`).
- **Nama**: 五魔方 (zh), メガミンクス (ja), Мегаминкс (ru), ميغامينكس (ar), Megaminx di bahasa lain; di menu tepat setelah Skewb.

## SEO: satu halaman statis per puzzle × bahasa

- **Satu konfigurasi**: `seo/site.config.json` (`baseUrl` = URL produksi; canonical / hreflang / peta situs / OG diturunkan darinya, jadi domain baru hanya perlu mengubah ini dan membangun ulang) beserta jumlah gerakan terukur.
- **Rute** (`js/seo-routes.js`, dipakai bersama peramban dan skrip build): bahasa Inggris di akar, bahasa lain di bawah `/<bahasa>/`; satu jalur bersih per puzzle: `/` (pintu masuk utama, x-default), `/2x2-cube-solver/` … `/15x15-cube-solver/`, `/pyraminx-solver/`, `/skewb-solver/`, `/megaminx-solver/`; misalnya `/zh-hans/3x3-cube-solver/`, `/ja/megaminx-solver/`. Total 12 bahasa × 18 = 216 halaman.
- **Teks**: `seo/lang/<code>.json` (12 bahasa, judul ditulis sesuai kebiasaan pencarian lokal), templat per jenis puzzle yang diisi jumlah gerakan terukur.
- **Build**: `npm run build:seo` (`tools/build-seo.js`) menulis halaman akar bahasa Inggris di antara penanda `<!--seo:*-->` dalam `index.html` dan semua halaman lain ke `seo/out/`, ditambah `robots.txt`, `sitemap.xml` (dengan alternatif xhtml:link), dan `manifest.webmanifest`; ia menambahkan `?v=<hash isi>` pada js/css yang dirujuk HTML. Ikon dan gambar OG (1200×630, satu per puzzle, dari tangkapan layar 3D + graf yang nyata): `npm run build:seo-images` (memerlukan server lokal; `OG_ONLY=root,megaminx` membatasinya pada gambar tertentu).
- **Per halaman**: title / description / canonical / 13 tautan hreflang (termasuk x-default) / OG / kartu Twitter / ikon / manifest / JSON-LD (WebSite, WebApplication (gratis, tanpa rating), WebPage, BreadcrumbList, HowTo, FAQPage, sama kata per kata dengan teks yang terlihat), `<h1>` statis, teks yang dapat dirayapi (cara pakai, penyelesai dan jumlah gerakan terukur, notasi, penjelasan graf, FAQ, tautan ke semua puzzle), catatan `<noscript>`.
- **Saat berjalan** (`js/seo-nav.js`): halaman memilih bahasa dan puzzle terlebih dahulu lewat `<html data-page-lang data-page-puzzle>`; mengganti puzzle atau bahasa di aplikasi berpindah ke URL bersih yang sesuai dengan `history.replaceState` dan mengambil judul / meta / JSON-LD / isi dari halaman yang sudah dirender, tanpa muat ulang dan tanpa kehilangan keadaan. Akar `/` tetap mengikuti bahasa peramban / pilihan terakhir.
- **Tautan lama**: `/?puzzle=…`, `/?n=…`, `/?lang=…` mendapat 301 ke jalur baru dari `deploy/worker.js` (hanya berjalan untuk rute halaman; aset statis dikecualikan lewat `run_worker_first`; tanpa `?lang`, bahasa diambil dari Accept-Language, dengan `Vary: Accept-Language`); parameter lain (`mode`, `hold`, `start`) dipertahankan. Secara lokal tanpa worker, `seo-nav.js` menulis ulang alamat di sisi klien.
- **Pengujian**: `node tests/seo.test.js` (statis: title/description unik di semua 216 halaman, canonical, tautan silang hreflang lengkap, JSON-LD dapat diurai dan cocok dengan isi yang terlihat, tanpa rating, ukuran gambar OG, tautan internal, sitemap/robots/manifest, pengalihan worker); `npm run test:seo:live` memeriksa setiap halaman langsung.

## Menjalankan

```bash
cd cube-solver
npm install
npm start                        # node tests/serve.js 8765 (sends COOP/COEP headers)
# open http://localhost:8765/
```

> Kamera memerlukan **konteks aman**: `https://` atau `http://localhost`. Lewat IP LAN (misalnya `http://192.168.x.x`) peramban menonaktifkan kamera; gunakan “Unggah foto”.
> Web Worker tidak berjalan di `file://`; selalu buka situs melalui server HTTP.

## Pengujian

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

Cakupan E2E: acakan acak → selesaikan → putar sampai akhir (6 klaster berwarna tunggal di graf, setiap sisi 3D satu warna), lompat / mundur / maju di pemutar, pewarnaan dan setiap jenis kesalahan validasi, input rumus, pengenalan 6 foto sintetis (rona warna, gradasi cahaya, derau, pantulan), jalur kamera palsu Chromium, tata letak seluler, dan tangkapan layar. `tests/graph-preview.html` adalah halaman mandiri untuk men-debug tata letak graf (`?scr=rumus&mv=R&e=0.5`). `node tests/compare-ref.js` menulis perbandingan berdampingan dengan frame referensi (`ref/f14`, `f07`, `f01`) ke `screenshots/compare-*.png`; `tests/graph-pixel.html` menggambar graf dengan pemetaan piksel frame referensi untuk tumpang-tindih yang akurat hingga piksel.

## Struktur direktori

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

## Titik ekstensi (arsitektur)

Modul inti (input, tampilan graf, 3D, pemutar, pindai, klien penyelesai) bekerja **hanya** melalui objek Puzzle yang didaftarkan oleh `CubeLab.registerPuzzle(def)` dan tidak berisi logika khusus 3×3. Puzzle baru ditempatkan di `puzzles/<id>/` dan mengimplementasikan antarmuka di bawah.

### Antarmuka Puzzle

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

Saat pendaftaran, inti melengkapi `parse / format / apply / inverse / isSolved` bawaan, kepingan yang diputar setiap gerakan (ditentukan oleh `layer`), **lintasan graf** (`P.tracks`), dan jalur stiker setiap gerakan (`moves[tok].paths`).

Bidang opsional yang dipakai bentuk lain: `trackMode: 'cycles'` (lintasan = siklus permutasi gerakan dasar), `netLayout.polys` (jaring berupa poligon SVG), `view3d.geometry: 'poly'` + `solid` / `cuts` / `core` (kepingan polihedron cembung), `dragMoves` (seret generik), `playKeys` / `playMetric` / `metricTitle`, `hints` (kunci i18n untuk petunjuk), `randomState(rnd)` (keadaan acak seragam), `randomScramble()`, `nameKey`; `cameraPlan: null` menyembunyikan tab pindai, dan tanpa `holds` menu pegangan disembunyikan.

### Lintasan graf dan gerak (`CubeLab.buildTracks` + `GraphView`)

Untuk setiap gerakan dasar: ambil stiker yang berpindah, kelompokkan menurut “normal stiker · sumbu” (pada 3×3: “8 di sisi” dan “12 di samping”), urutkan tiap kelompok menurut sudut di sekitar sumbu menjadi cincin tertutup; putaran sebesar θ memajukan stiker di cincin sebanyak `θ/2π × n` posisi, yang dicocokkan dengan `perm`.

`graphLayout()` milik plugin memberikan posisi 2D simpul dan, opsional, `circles: [{id, cx, cy, r}]`:
- jika semua simpul lintasan samping terletak pada satu lingkaran, simpul bergerak **di sepanjang lingkaran itu** (arah sama untuk seluruh lintasan; arah dengan jalur total terpendek pada gerakan dasar, dibalik untuk inversnya) dengan jejak berwarna;
- simpul lintasan “sisi” diinterpolasi dalam koordinat polar di sekitar simpul pusat sisi (klaster berputar sebagai satu kesatuan);
- tanpa lingkaran, dipakai spline tertutup melalui simpul-simpul, sehingga puzzle lain dapat divisualisasikan tanpa tata letak buatan tangan.

**Tata letak 3×3** (konfigurasi `GL` di `puzzles/cube3/cube3.js`): tiga kelompok lingkaran konsentris adalah sumbu y (U/E/D), z (F/S/B), dan x (R/M/L), berpusat di titik sudut segitiga sama sisi (atas, kiri bawah, kanan bawah), jari-jari 1,3922 / 1,7696 / 2,1469 (jari-jari lingkaran luar segitiga = 1). Nilai ini hasil pencocokan kuadrat terkecil terhadap **semua 54 simpul** pada frame referensi beresolusi tinggi (residu RMS 0,2 px); jari-jari simpul 0,184, garis 0,048, lebar lintasan 0,063, dan lebar sorotan 0,076 berasal dari pengukuran piksel pada frame yang sama. Bila digambar dengan pemetaan piksel frame referensi dan ditumpuk 50 %, lingkaran dan simpul hampir berimpit sempurna (`tests/graph-pixel.html`). Stiker sisi X berada di titik potong kelompok lingkaran dua sumbu selain normal X; dua daerah potong menampung sepasang sisi yang berlawanan. Arah lapisan→jari-jari (`sign`) dan daerah potong tiap sisi (`upper`) diperiksa secara menyeluruh (64 kombinasi): masing-masing dari enam putaran sisi adalah pergeseran siklik 12 simpul pada satu lingkaran. Gerakan irisan M/E/S adalah gerakan nyata (dibangkitkan dari geometri dalam `moves`; generator yang sama mereproduksi tepat 6 permutasi sisi, diverifikasi oleh uji unit) dan berjalan pada lingkaran tengah kelompoknya. Penyelesai hanya mengeluarkan gerakan sisi.

**Rute busur (dicocokkan frame demi frame dengan video referensi)**: 12 simpul pada setiap lingkaran termasuk dalam 4 sektor sisi dengan jarak kira-kira 60°/60°/60°/180°. Dengan aturan arah “jalur total terpendek”, putaran 90° memindahkan 9 stiker di busur ≈ 60° dan **3 stiker dari satu sektor melintasi busur kosong 180°** (misalnya busur atas lingkaran terluar, busur kiri besar kelompok kiri bawah). Video referensi melakukan hal yang persis sama (`screenshots/compare-motion.png`, baris kedua). Posisi sektor ditetapkan oleh “tata letak terselesaikan = referensi f14”, sehingga tidak ada penetapan lain yang membuat semua busur pendek.

**Waktu dan easing (diukur dari energi gerak video referensi pada 60 fps)**:
- easing satu langkah `easeInOutQuad` (dicocokkan dengan kurva kecepatan rata-rata 15 putaran, RMS 0,076; sine 0,155, cubic 0,193);
- pemutaran berkelanjutan mengikuti selubung “mulai lambat – cepat – akhir lambat”: langkah pertama ≈ 0,85 dtk, tengah 0,48 dtk, terakhir ≈ 1,0 dtk, hanya ≈ 0,07 dtk di antara langkah (`CubeLab.tempo(i, n)`, `Player.baseMs = 480`, `gapMs = 67`; satu “maju” tunggal tetap 0,55 dtk);
- sorotan lingkaran aktif muncul dalam 8 % pertama putaran dan memudar dalam 16 % terakhir; jejak berwarna memanjang ke belakang dari simpul (fase ekor `ease(1.6t − 0.6)`) dan memudar di akhir;
- setelah selesai, ≈ 1,2 dtk diam, lalu putaran showcase 2,0 dtk.

### Pegangan (sudut pandang notasi)

Keadaan internal, penyelesai, dan input rumus selalu memakai pegangan WCA (putih U, hijau F). Plugin dapat menyediakan `holds`: setiap pegangan memberikan orientasi 3D keseluruhan dan tabel penggantian nama notasi. Bawaan 3×3 “kuning di atas, hijau di depan” = pegangan standar diputar 180° mengelilingi sumbu depan–belakang (z2): `U↔D`, `R↔L`, `F/B` tetap, `M→M′`, `E→E′`, `S` tetap (uji unit memeriksa masing-masing: sumbu × sudut gerakan internal, diputar oleh orientasi, sama dengan sumbu × sudut gerakan yang ditampilkan). Teks solusi, langkah pemutar saat ini, daftar langkah, dan deskripsi memakai notasi pegangan saat ini, sehingga lapisan atas di layar disebut U.

### Gaya 3D dan tampilan

- `view3d.style: 'plastic'`: badan abu-abu muda + panel putih (sambungan abu-abu muda tipis) + stiker membulat berwarna rata (tanpa pencahayaan, warna sama dengan graf) + bayangan lembut pada badan; tanpa ini, gaya datar klasik berbadan hitam.
- `stickerCorners: [kiri atas, kanan atas, kanan bawah, kiri bawah]`: jari-jari sudut stiker (bentuk daun asimetris dimungkinkan); `stickerColors` menimpa warna stiker 3D.
- `orientation` (sudut Euler, ditimpa pegangan saat ini) + `camera: { fov, dir }`: tampilan 3×3 bawaan sesuai video referensi — kuning (D) di atas, hijau (F) di kiri, oranye (L) di kanan — yaitu tiga klaster segitiga tengah pada graf. Perspektif FOV 24°, elevasi sekitar 25°, disetel dengan perbandingan piksel terhadap frame referensi.
- `frame: { width, height, dx, dy }`: pembingkaian (ukuran dan pergeseran puzzle / graf dalam separuh panelnya), sesuai video referensi hingga 0,5 %.
- `autoRotate`: puzzle sedikit bergoyang selama pemutaran; ketika pemutaran mencapai akhir dalam keadaan terselesaikan, ia diam selama `showcaseDelay` (1,2 dtk), berputar sekali dalam `showcaseMs` (2,0 dtk), lalu kembali ke tampilan awal (seperti akhir video referensi). Sakelar “putar otomatis” di pemutar menonaktifkannya; memutar dengan seret dan reset dengan klik ganda selalu berfungsi.

### Suara (`js/core/audio.js`, `CubeLab.SoundEngine`)

Semuanya disintesis langsung dengan Web Audio API; tidak ada berkas audio maupun aset pihak ketiga.
- **Kebijakan putar otomatis**: tidak ada `AudioContext` saat halaman dimuat; ia dibuat dan di-`resume()` pada `pointerdown / keydown / touchstart` pertama. Efek aktif dan musik nonaktif secara bawaan; “efek / musik / volume” disimpan di `localStorage` (`cubelab.sfx / cubelab.music / cubelab.vol`). Jika musik aktif sebelum muat ulang, ia menunggu gestur pengguna berikutnya. Tanpa Web Audio, setiap panggilan tidak melakukan apa pun dan kontrolnya dinonaktifkan.
- **Suara putaran v3** (hook `Player.onMove(phase, tok, durMs)`): dibangun ulang berdasarkan analisis tiga rekaman nyata 3×3 (lihat `user-sounds/ANALYSIS.md`, `screenshots/sound-compare.png`). Putaran nyata = rentetan 120–200 md “butiran” plastik berkelompok (≈ satu tiap 5 md) yang membangkitkan mode badan pendek: puncak utama 0,86–1,1 kHz (“berongga / kayu”) + 500 Hz, 1,55, 2,8, 4,1 kHz, dengung hanya 3–6 md, hampir tanpa dentum di bawah 300 Hz; energi naik hingga klik paling keras saat lapisan terkunci, diikuti gemeretak 70–100 md yang meluruh. Sintesis: peristiwa butiran yang dibangkitkan di JS → 10 resonator orde dua (setiap butiran membangkitkan mode berbeda secara acak) + lapisan tipis butiran mikro + gesekan sangat ringan + serangan langsung pita lebar; klik penguncian sejajar dengan akhir animasi, pemutaran lambat memusatkan suara di akhir, putaran 180° mendapat klik detent pada T/2, irisan lebih lembut dan gelap; setiap suara dihitung dalam 1,7–3,3 md. Dibandingkan dengan rekaman nyata (materi SpaceJoe / Pixabay, analisis yang sama): sentroid 2141 Hz vs 2135 / 2077 Hz, faktor puncak 20,7 vs 21,1 / 17,6 dB, kerataan 0,24 vs 0,25 / 0,32, 18,5 vs 17,8 / 12,0 butiran per 100 md, selisih bentuk pita sepertiga oktaf ≈ 2 dB. Tidak ada berkas audio yang dirilis (rekaman hanya dipakai untuk analisis; lisensi di `vendor/sounds/LICENSE.txt`). Perlindungan saat pemutaran cepat: minimal 50 md antarsuara putaran; putaran lebih pendek lebih pelan dan butirannya lebih sedikit; menyeret garis waktu langsung menghentikan suara putaran yang belum selesai.
- **Selesai**: arpeggio mayor naik + akor (saat pemutaran mencapai langkah terakhir dalam keadaan terselesaikan); kilau naik yang lembut saat **putaran showcase** dimulai (`View3D.onShowcaseStart`).
- **Antarmuka**: klik pewarnaan (nada mengikuti warna, dibatasi saat mewarnai dengan seret), isyarat berhasil mengambil / mengunggah (tiga nada saat keenam sisi selesai).
- **Musik latar**: 72 BPM, putaran empat birama Cmaj9 – Am9 – Fmaj9 – G6sus; gelombang gergaji yang sedikit sumbang dengan filter lolos-rendah sebagai pad + arpeggio pentatonik (pseudo-acak deterministik), delay umpan balik untuk ruang; penjadwalan di depan (tiap 150 md mengantrekan 0,6 dtk), putaran tanpa jeda, fade masuk / keluar, sangat pelan.
- Tingkat (volume 0,8, diukur offline): satu putaran pada 1× memuncak sekitar 0,31–0,36, pada kecepatan tangan nyata (130 md) sekitar 0,22, arpeggio selesai sekitar 0,23, musik latar memuncak sekitar −22 dBFS. Demo (hanya lokal): `screenshots/sound-demo-turns.wav`, `sound-demo-turns-v3.wav`, `sound-demo-sfx.wav`, `sound-demo-music.wav`.

### Bahasa (`js/i18n/`, `CubeLab.i18n`)

- **Bahasa dan urutan**: English, 简体中文, 繁體中文, Español, العربية, Português, Bahasa Indonesia, Bahasa Melayu, Français, 日本語, Русский, Deutsch (semuanya setara di menu, tanpa kelompok).
- **String**: satu berkas per bahasa, `js/i18n/<code>.js`, yang memanggil `CubeLab.i18n.register(code, {key: text})`; `en.js` adalah tabel induk, kunci yang hilang kembali ke bahasa Inggris dan dicatat di `CubeLab.i18n.missing`. HTML memakai `data-i18n` / `data-i18n-title` / `data-i18n-aria` / `data-i18n-placeholder`; teks dinamis memakai `I.bind(el, key, params)` dan digambar ulang saat bahasa berganti.
- **Pemformatan**: subset ICU — `{name}`, `{n, plural, =0 {…} one {# …} few {…} many {…} other {…}}` (`Intl.PluralRules`), `{ms, unit, millisecond}`, `{x, number}` (`Intl.NumberFormat`). Bahasa Prancis otomatis mendapat spasi tak terputus sebelum `: ; ! ? « »`; bahasa Spanyol memakai ¡ ¿. Notasi gerakan memakai huruf standar di semua bahasa (U D L R F B M E S, ′ 2).
- **Urutan deteksi**: `?lang=xx` → `localStorage['cubelab.lang']` → `navigator.languages` (zh-TW/HK/MO/Hant → tradisional, zh lainnya → sederhana) → English. Mengatur `<html lang dir>`, judul, dan meta description.
- **RTL**: bahasa Arab mencerminkan seluruh halaman (properti logis CSS); kanvas 3D, graf, garis waktu / kontrol pemutar, strip langkah, notasi, input rumus, dan angka tetap LTR (`dir="ltr"`).
- **Tipografi**: CJK / Arab memakai susunan fon sendiri, tinggi baris lebih besar, dan tanpa spasi huruf; Jerman / Rusia mengaktifkan `hyphens:auto`, dan tombol boleh berpindah baris alih-alih meluap.
- **Menambah bahasa**: tambahkan entri ke `LANGS` di `i18n.js`, buat `js/i18n/<code>.js` dan sertakan di `index.html`, lalu jalankan `node tests/i18n.unit.test.js`.

### Adapter penyelesai

```js
solvers: [
  { id: 'kociemba', name: '…', available: true,
    workerUrl: 'puzzles/cube3/kociemba.worker.js',
    encode: state => payload },          // runs on the main thread; throws a localized error for invalid states
  { id: 'optimal-ida', name: 'IDA* optimal (planned)', available: false }
]
```

Protokol worker:

```
→ { id, cmd: 'init' }                      ← { id, ok: true, ms }
→ { id, cmd: 'solve', payload }            ← { id, ok: true, moves: ['R', "U'", ...], optimal?: bool, label?, note?, ms }
                                           ← { id, ok: false, error }
```

Satu puzzle dapat memiliki beberapa penyelesai; menu mencantumkannya secara otomatis, dan `available: false` tampil sebagai “direncanakan”. Menambahkan penyelesai optimal sejati (misalnya IDA* Korf dengan basis data pola sudut / tepi) hanya memerlukan worker baru yang didaftarkan di `solvers`. Worker dapat mengembalikan `optimal: false` dengan kunci i18n `label` / `note` (Megaminx melakukannya), yang ditampilkan antarmuka di samping jumlah gerakan.

### Tampilan lain

Pemutar (`CubeLab.Player`) mengendalikan berapa pun tampilan; sebuah tampilan cukup mengimplementasikan `setState(state)` dan `animate(tok, e, fromState, t)` (e = kemajuan ter-easing 0–1, t = fase waktu mentah), serta opsional `highlight(tok, state)`. Visualisasi baru (misalnya graf Cayley atau diagram siklus) hanya membutuhkan metode-metode ini.

## Pustaka pihak ketiga

- [gullicube](https://github.com/rokicki/gullicube) (Tomas Rokicki, dipakai di bawah opsi MPL-2.0, kode sumber tidak diubah; lihat `vendor/gullicube/NOTICE.md`)
- [cubejs](https://github.com/ldez/cubejs) (MIT) — algoritme dua fase Kociemba. `vendor/solve.js` membawa tambalan kecil (`vendor/solve.js.cubelab.patch`): tenggat opsional untuk `solve(maxDepth, deadline)` dan pengecualian alih-alih crash null bila tidak ditemukan, dipakai untuk pemendekan iteratif dalam anggaran waktu.
- [three.js](https://threejs.org/) r160 (MIT) — rendering 3D (build UMD `three.min.js`; konsol memperingatkan bahwa build ini usang, tidak berpengaruh di sini).
- Penyelesai Pyraminx, Skewb, dan Megaminx serta tabel lapisan terakhir Megaminx adalah kode dan data milik proyek ini sendiri (MIT). Tidak ada kode GPL, maupun kode dari csTimer atau TPR, yang dipakai.

## Keterbatasan yang diketahui

- Pyraminx / Skewb / Megaminx: belum ada pengenalan kamera / foto. Saat mewarnai, pegang puzzle seperti yang ditunjukkan petunjuk (Pyraminx: kepingan aksial tanpa kuning di atas, yang tanpa hijau di belakang; Skewb: sudut putih-hijau-merah di atas-kanan-depan; Megaminx: pusat harus membentuk skema warna standar), jika tidak akan muncul kesalahan pegangan / pusat.
- Solusi Megaminx **tidak optimal** (rata-rata ≈ 120 HTM, hingga ≈ 135); sesekali keadaan sulit memakan waktu hingga ≈ 1,6 dtk; tabel lapisan terakhir 1,8 MB (`megaminx-ll.json`, dikompresi saat transfer) diunduh sekali ketika penyelesai Megaminx dimulai.
- Kamera memerlukan HTTPS atau localhost; pengenalan bergantung pada pencahayaan — perbaiki hasilnya di jaring bila ada pantulan kuat atau cahaya kekuningan (warna pusat dipakai untuk kalibrasi dan menoleransi sedikit rona).
- Pemindaian mengasumsikan skema warna standar (putih berseberangan dengan kuning, hijau dengan biru, merah dengan oranye) dan pegangan terpandu; pusat tetap di editor.
- Penyelesai 3×3 hanya mengeluarkan gerakan sisi (HTM); solusi pada video referensi memuat gerakan irisan, jadi urutan langkah untuk keadaan yang sama berbeda dari video.
- Algoritme dua fase memberikan solusi mendekati optimal (biasanya 19–21 gerakan); hanya keadaan dengan ≤ 8 gerakan yang mendapat solusi terbukti optimal. Penyelesai optimal sejati setingkat “angka Tuhan” tetap menjadi kemungkinan ekstensi.
