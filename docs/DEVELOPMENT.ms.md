[English](DEVELOPMENT.md) · [简体中文](DEVELOPMENT.zh-Hans.md) · [繁體中文](DEVELOPMENT.zh-Hant.md) · [日本語](DEVELOPMENT.ja.md) · [Español](DEVELOPMENT.es.md) · [Português](DEVELOPMENT.pt.md) · [Français](DEVELOPMENT.fr.md) · [Deutsch](DEVELOPMENT.de.md) · [Русский](DEVELOPMENT.ru.md) · [العربية](DEVELOPMENT.ar.md) · [Bahasa Indonesia](DEVELOPMENT.id.md) · **Bahasa Melayu**

# Cube Solver Lab (CubeLab) · Nota Pembangun

> Nota terperinci untuk pembangun. Versi bahasa Inggeris ([DEVELOPMENT.ms](DEVELOPMENT.md)) adalah rujukan utama; terjemahan ini mengikutinya. Untuk gambaran keseluruhan projek, cara menjalankan, ujian, deployment, lesen, dan privasi, lihat [README](../README.ms.md).
> `ref/` (frame video rujukan) dan `screenshots/` (tangkapan skrin hasil ujian) yang disebut di bawah tiada di repositori; ujian membuat folder tangkapan skrin ketika dijalankan.

Penyelesai puzzle yang sepenuhnya berjalan di front-end (HTML/CSS/JS statik, tanpa back-end). Ciri khasnya adalah **paparan graf**: di sisi puzzle 3D terdapat “graf permutasi” dengan setiap stiker sebagai nod. Untuk 3×3 ini berupa **tiga kelompok bulatan konsentris** (tiap kelompok 3 bulatan = 3 lapisan satu sumbu; pusat-pusatnya membentuk segitiga sama sisi sehingga muncul pola kelopak bersimetri lipat tiga), dengan 54 nod di titik-titik potongnya. Pada setiap gerakan, bulatan lapisan itu menjadi gelap, 12 stiker sisi bergerak di sepanjang busur (dengan jejak memudar berwarna stiker), dan 9 stiker muka yang diputar berotasi di dalam klasternya — tersinkron tepat dengan putaran 3D. Kubus terkacau mencampur warna; kubus selesai membentuk 6 klaster rapat berwarna tunggal.

## Ciri

| Modul | Penerangan |
| --- | --- |
| Pewarnaan | Jaring + palet, klik / seret untuk mewarnai, pembilang warna, reset / rawak / kosongkan |
| Input formula | Masukkan kacauan (`R U R' U2 …`, irisan `M E S` disokong), digunakan dari keadaan selesai dengan pegangan WCA (putih di atas, hijau di hadapan) |
| Imbas kamera | Gambar langsung `getUserMedia` + lapisan grid + pratonton pengecaman langsung; urutan 6 muka terpandu (dengan petunjuk orientasi) |
| Muat naik foto | Setiap muka boleh menggunakan foto yang dimuat naik; peluncur “saiz grid” menjajarkan stiker |
| Pengecaman warna | RGB median di dalam setiap sel → CIE Lab. Semasa pengimbasan: pratonton langsung terhadap warna tipikal (saiz ganjil ditentukur dengan pusat yang terukur). **Selepas keenam muka** (`js/core/color-cluster.js`): k-means berkapasitas sama atas semua 6n² sel (tepat n² per warna, kecerahan berbobot lebih rendah) → nama warna dengan mencuba semua 6! penetapan (ditentukan oleh pusat pada saiz ganjil) → penyahkodan berkendala per orbit kepingan dengan algoritme Hungaria (penjuru harus salah satu dari 8 tripel warna berorientasi yang sah, bucu / sayap pasangan yang sah, tiap orbit pusat satu kuota per warna) → estimasi ulang pusat warna dan selesaikan lagi. Juga berlaku untuk saiz genap (tanpa pusat tetap) |
| Pengesahan | Mesej terlokalisasi (12 bahasa, peraturan jamak Intl): stiker belum diwarnai, pusat ganda, bilangan warna, kepingan mustahil, kepingan ganda, penjuru terpulas, bucu terbalik, paritas (dua kepingan tertukar) |
| Penyelesaian | Di dalam Web Worker. 3×3: ① BFS dua arah (terbukti optimal hingga 8 gerakan) ② Kociemba dua fase (cubejs) dengan pemendekan iteratif dalam anggaran masa, biasanya 19–21 gerakan. Puzzle lain: lihat di bawah |
| Pemain | Putar / jeda / undur / maju / awal / akhir / kelajuan / garis masa yang boleh diseret / klik langkah mana pun; kekunci: Space, ←, →; tempo dan easing diukur dari video rujukan |
| Bunyi | Disintesis langsung dengan Web Audio (tanpa fail audio): bunyi putaran realistis, arpeggio ketika selesai, sapuan showcase, klik pewarnaan, isyarat pengambilan; muzik latar janaan pilihan; “efek / muzik / volume” di bilah pemain, disimpan secara lokal |
| Pegangan | “Kuning di atas, hijau di hadapan” (lalai, sama dengan video rujukan) / “Putih di atas, hijau di hadapan (WCA)”: mengubah orientasi 3D sekaligus notasi, sehingga U sentiasa lapisan atas pada skrin |
| Mod demo | “Kacau dahulu, lalu selesaikan”: memutar kacauan dari keadaan selesai, lalu solusinya |
| Responsif | Di telefon, 3D dan graf ditumpuk vertikal; kawalan dibalut ke baris baharu |
| Bahasa | 12 bahasa (English, 简体中文, 繁體中文, Español, العربية, Português, Bahasa Indonesia, Bahasa Melayu, Français, 日本語, Русский, Deutsch), RTL penuh untuk bahasa Arab; ikon glob di kanan atas, pilihan disimpan secara lokal |

## N×N (2×2 – 15×15)

Menu “Puzzle” di atas menawarkan 2×2 … 15×15 (juga `?n=7`). Semua paparan (pewarnaan jaring, formula, grid kamera N×N, 3D three.js, graf tiga kelompok n bulatan konsentris dengan zoom / geser, pemain) dibuat untuk setiap saiz.

| Saiz | Penyelesai | Metrik | Terukur (kacauan rawak, semuanya disahkan selesai) |
| --- | --- | --- | --- |
| 2×2 | Penyelesai optimal buatan sendiri (jadual jarak lengkap, 3.674.160 keadaan, BFS) | HTM | 100 penyelesaian: purata 8,87, maks. 10; jadual ≈ 0,3 s, penyelesaian < 1 ms |
| 3×3 | BFS ≤ 8 optimal + Kociemba dua fase dengan pemendekan | HTM | biasanya 19–21 gerakan |
| 4×4 | Kaedah reduksi buatan sendiri (di bawah); gullicube pilihan | OBTM | 12 penyelesaian (Node): purata 56,8, maks. 64; jadual ≈ 3,2 s; penyelesaian purata 6,9 s (paling perlahan 16 s) |
| 5×5 – 15×15 | gullicube (T. Rokicki, MPL-2.0) yang dikompilasi ke WebAssembly multithread; mod kualiti / pantas | SSTM | lihat jadual di bawah |

gullicube (Node, 4 thread, build yang sama dengan pelayar; SSTM):

| n | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Kualiti (--time 16, ≈ 10–15 s, muat turun pertama ≈ 30 MB jadual) | 119 | 169 | 257 | 329 | 448 | 563 | 678 | 833 | 981 | 1131 | 1408 |
| Pantas (--fast, ≈ 2–4 s, ≈ 0,5 MB jadual) | 168 | 281 | 402 | 571 | 695 | 972 | 1130 | 1495 | 1635 | 1950 | 2231 |

Peranti bermemori rendah (`navigator.deviceMemory` < 4 GB) serta telefon / tablet menggunakan mod pantas secara lalai untuk n ≥ 5; menu penyelesai boleh beralih kualiti / kelajuan kapan saja. WASM multithread memerlukan isolasi lintas asal: `deploy/_headers` menetapkan COOP / COEP / CORP.

**Analitik** (`js/analytics.js`, hanya berjalan di cube-solver.org): Cloudflare Web Analytics tanpa cookie dan dimuat untuk semua orang; GA4 baharu menyisipkan gtag.js selepas pengunjung mengklik “Terima” (Consent Mod v2, hanya `analytics_storage` yang diberikan). Sepanduk itu hanya dipaparkan di rantau persetujuan: `deploy/worker.js` menetapkan `<html data-consent="1">` untuk EU/EEA, UK, Switzerland dan negara yang tidak diketahui (`request.cf.country` tiada, `XX`, `T1`) dan `data-consent="0"` di tempat lain, di mana GA4 dimuatkan tanpa sepanduk (isyarat iklan tetap ditolak) dan pautan pengaki masih menawarkan “Tolak”, yang mematikan GA dan memadam kukinya. ETag diberi akhiran `-c1`/`-c0` supaya kedua-dua varian tidak saling mengesahkan semula. Keduanya merespons dengan `Cross-Origin-Resource-Policy: cross-origin` + header CORS, sehingga `require-corp` tetap ada dan isolasi lintas asal tidak rosak. Perubahan laluan SPA (`history.replaceState`) dikira automatik oleh mod SPA CF dan pengukuran lanjutan GA4 (“perubahan halaman berdasarkan peristiwa riwayat pelayar”); jangan hantar `page_view` secara manual (akan terkira ganda). Ujian: `npm run test:analytics` (lokal, beacon dipintas) / `npm run test:analytics:live`. ID analitik tiada di repositori: `tools/build-dist.js` membaca `CF_BEACON_TOKEN` dan `GA_MEASUREMENT_ID` dari persekitaran (atau `.env` yang diabaikan git) dan hanya menulisnya ke `dist/js/analytics.js`; tanpa keduanya tiada analitik, sepanduk persetujuan, mahupun penjejakan. Semuanya berada dalam kuota percuma aset statik Cloudflare Workers (fail statik tidak dicaj sebagai permintaan Worker; Worker hanya berjalan untuk laluan halaman).

**Penyelesai reduksi 4×4** (`puzzles/nxn/cube4.worker.js`, kod buatan sendiri; gagasan fasenya mengikuti kaedah publik bergaya Tsai / TPR, tanpa menyalin kod):
1. P1 (36 gerakan): pusat berwarna R/L ke R/L, jadual jarak eksak C(24,8).
2. P2 (lapisan luar + Rw/Lw + Uw2/Dw2/Fw2/Bw2): pusat U/D ke U/D, pusat sumbu R/L ke salah satu dari 12 susunan yang boleh diselesaikan, semua sayap “berorientasi” (24 posisi sayap terbahagi dua kelas di bawah grup P3), permutasi sayap genap (menghilangkan paritas OLL).
3. P3a (U D F B, R2 L2, putaran setengah lebar): pusat ke subhimpunan yang boleh diselesaikan di P3b, 8 sayap irisan E kembali ke irisan E, P3b boleh diselesaikan.
4. P3b (U D, F2 B2 R2 L2, putaran setengah lebar): pusat selesai, 12 bucu berpasangan, paritas PLL dihilangkan.
5. 3×3 yang setara diteruskan ke Kociemba dua fase (cubejs).
Setiap fase menggunakan IDA*; dalam anggaran masa, beberapa kandidat dari fase sebelumnya dicuba dan yang terpendek disimpan; gerakan bersebelahan pada sumbu yang sama digabungkan.

Ujian: `node tests/nxn.test.js [sampel 4×4]` (model 2–15 + 2×2 + 4×4), `node tests/gullicube.test.js 5,7,10,15 both`, langsung `node tests/live-nxn.js <URL>`.

### Jadual prahitung (penyelesai 4×4 dan 3×3)

`npm run build:tables` menulis `puzzles/nxn/cube4-tables.bin.gz` (1,61 MB, 7 jadual jarak) dan `puzzles/cube3/cubejs-prune.bin.gz` (0,89 MB, jadual pemangkasan cubejs). Format: `CLT1` + panjang header + direktori JSON (nama / tipe / panjang / checksum FNV-1a) + byte mentah, dimampatkan gzip (`js/core/table-pack.js`). Worker memuat turun jadual sambil membina jadual gerakan; pelayar menyahmampat dengan `DecompressionStream`, mengesahkan setiap jadual, dan kembali mengira di tempat jika muat turun gagal, checksum tidak sepadan, atau pelayar tidak menyokongnya. Selepas mengubah struktur jadual suatu penyelesai, jalankan ulang `npm run build:tables` (`tests/tables.test.js` membandingkan jadual dengan pengiraan langsung).

## Main bebas (semua puzzle)

Suis “Selesaikan / Main bebas” di atas panggung (atau `?mode=play`).

| Tindakan | Penerangan |
|---|---|
| Seret stiker (tetikus / sentuh) | Memutar lapisan stiker itu. Kubus: dari dua sumbu muka, dipilih yang proyeksinya paling sepadan dengan arah seret; sumbu putar = normal muka × arah seret; pada kubus besar lapisan yang dipegang ikut berputar (lapisan dalam 2R, 3R…, lapisan tengah saiz ganjil M / E / S). Puzzle lain menggunakan `dragMoves` (di bawah). Ketika disentuh, kanvas mempunyai `touch-action: none` sehingga halaman tidak menatal |
| Seret di ruang kosong | Memutar paparan (klik dua kali untuk reset) |
| Papan kekunci | `U D L R F B` (Shift = lawan arah jam); awalan nombor memilih lapisan (`2` `R` → 2R); awalan `w` untuk gerakan lebar (`3` `w` `R` → 3Rw); `M E S` pada saiz ganjil; rotasi `x y z` (2×2 dan 4×4+); Ctrl+Z / Backspace untuk batal, Ctrl+Y / Ctrl+Shift+Z untuk ulang; Esc menghapus awalan. Notasi mengikuti pegangan semasa (lapisan atas pada skrin sentiasa U) |
| Medan formula | Formula apa pun (3Rw, 2R, M/E/S…), Enter menjalankannya dengan animasi langkah demi langkah |
| Kacau | 2×2 / 3×3: keadaan rawak seragam (`CubeLab.play.randomState`); 4×4+: gerakan rawak; Pyraminx / Skewb: keadaan rawak seragam; Megaminx: kacauan WCA (Pochmann) |
| Pemasa | Bermula pada gerakan pertama (bukan rotasi) selepas mengacau, berhenti ketika selesai; inspeksi WCA 15 s pilihan (+2 selepas 15 s, DNF selepas 17 s) |
| Bilangan gerakan | STM hingga 3×3, BTM untuk 4×4+ (rotasi tidak dikira); Pyraminx / Skewb VTM; Megaminx HTM |
| Batal / ulang / reset / selesaikan dari keadaan semasa | “Selesaikan” kembali ke mod penyelesaian dan menyelesaikan keadaan semasa, diputar seperti biasa (cubaan ini tidak direkod masanya) |

- Masa terbaik tiap puzzle disimpan di `localStorage` (`cubelab.best.<puzzle>`). Ketika selesai ada serlahan ringan + bunyi selesai (mengikuti suis efek) + putaran showcase (mengikuti suis putar automatik).
- Pelaksanaan: `js/core/play-core.js` (logik tulen, boleh diuji di Node), `Player.pushMove / popMove` (baris gilir animasi, mempercepat ketika ketinggalan dan tidak pernah kehilangan gerakan), `View3D.pick / dragTurn / setPlayMode`, dan kawalan mod di `app.js`. Graf dikemas kini langkah demi langkah bersama 3D.

## Pyraminx dan Skewb

Keduanya plugin lengkap (`puzzles/twisty/`): model, pengesahan, 3D, editor jaring, paparan graf, penyelesai optimal ketat, main bebas, 12 bahasa.

- **Model** (`twisty-model.js`, digunakan bersama halaman / worker / Node): stiker dijana dari geometri (Pyraminx: 9 segitiga per muka; Skewb: 1 persegi + 4 segitiga penjuru per muka); permutasi setiap gerakan = memutar sentroid dan normal stiker lapisan 120° mengelilingi sumbu lalu memadankan stiker. Notasi WCA: Pyraminx `U L R B` (dua lapisan) + `u l r b` (ujung); Skewb `R U L B` (R = penjuru bawah-kanan-belakang, U = atas-kiri-belakang, L = bawah-kiri-depan, B = bawah-kiri-belakang; penjuru atas-kanan-depan tetap).
- **Penyelesai optimal** (`twisty.worker.js?p=…`): keadaan warna → kepingan + orientasi, dipisah per kelas kepingan menjadi komponen independen; BFS terlebih dahulu mencari himpunan terjangkau dan jadual gerakan tiap komponen, lalu BFS penuh atas ruang hasil kali (jadual jarak `Uint8Array`); solusi menuruni jadual sehingga panjangnya tepat jarak minimum (VTM: setiap putaran 120° dikira 1). Ujung Pyraminx komutatif dengan semuanya dan ditetapkan di akhir dengan 0 / 1 gerakan masing-masing (tetap optimal).

| | Keadaan (inti) | Komponen | Nombor Tuhan terukur | Jadual | Pembinaan (Node / pelayar termasuk mula worker) | Penyelesaian |
|---|---|---|---|---|---|---|
| Pyraminx | 933.120 (× 81 ujung = 75.582.720) | bucu 11.520 × pusat aksial 81 | 11 (15 dengan ujung) | 0,93 MB | ≈ 60 ms / ≈ 250 ms | ≈ 0,03 ms |
| Skewb | 3.149.280 | pusat 360 × penjuru 8.748 | 11 (90 antipoda) | 3,15 MB | ≈ 180 ms / ≈ 400 ms | ≈ 0,01 ms |

  Jadual dibina di pelayar (lebih pantas daripada memuat turun jadual dimampatkan), sehingga tidak perlu aset tambahan. `tests/twisty.test.js` memeriksa: setiap gerakan dipangkatkan tiga = identitas, saling meniadakan dengan inversnya, memindahkan kepingan utuh; hasil kali komponen = bilangan terjangkau BFS (komponen independen); bilangan per lapisan; jadual adalah stratifikasi BFS yang konsisten; keadaan rawak selesai dengan panjang = jarak jadual; pengesah menolak bucu terbalik / penjuru terpulas / dua kepingan tertukar / kombinasi warna mustahil / pegangan salah.
- **3D**: setiap kepingan adalah polihedron cembung pejal (bentuk ∩ setengah ruang bidang potong: dua per titik penjuru pada Pyraminx, 4 bidang melalui pusat pada Skewb); putaran memutar seluruh lapisan, permukaan potong bergeser di bidangnya sendiri dan tidak pernah bersilangan; stiker berupa segitiga / persegi membulat yang menjorok ke dalam.
- **Paparan graf**: orbit stiker setiap putaran 120° adalah siklus-3, digambar sebagai bulatan yang melalui 3 nod itu. Nod Pyraminx = pusat stiker pada jaring (titik penjuru U / L / R adalah pusat kelompok bulatan konsentris, bulatan lapisan B melingkupi seluruh jaring); Skewb menggunakan proyeksi azimut berjarak sama dari penjuru DBL (lapisan B berupa bulatan konsentris, R / U / L tiga kelopak).
- **Editor jaring**: poligon SVG (klik / seret untuk mewarnai, Enter mewarnai dengan papan kekunci, ralat diberi garis merah). Pyraminx: muka hadapan di tengah, muka kiri / kanan di sampingnya, alas di bawahnya; Skewb: salib yang sama dengan kubus.
- **Main bebas**: ketika stiker diseret, dari gerakan kandidat dipilih yang kelajuan sesaat stiker itu paling sepadan dengan arah seret (sumbu sama: yang kepingannya lebih sedikit, jadi menyeret ujung hanya memutar ujung); kekunci `U L R B` / `R U L B` (Shift = lawan arah jam), pada Pyraminx `T` lalu huruf = ujung; rawak = keadaan rawak seragam; pemasa / rekod seperti kubus.
- **Pengecaman kamera / foto**: belum disokong (stiker segitiga / rombus memerlukan grid sampel baharu dan pewarnaan berkendala kepingan); puzzle ini menyembunyikan tab imbas dan meminta pewarnaan.

## Megaminx

Plugin lengkap di `puzzles/megaminx/` (kod buatan sendiri, MIT): `megaminx-model.js` (geometri, gerakan, pengesahan; digunakan bersama halaman / worker / Node), `megaminx.js` (plugin: 3D, jaring, graf, notasi, main bebas), `megaminx-solver.js` (penyelesai multifase), `megaminx.worker.js`, dan `megaminx-ll.json` (jadual lapisan terakhir, dijana secara offline oleh `tools/megaminx-ll-gen.js`).

- **Model**: 12 muka × 11 stiker = 132 stiker, 62 kepingan (12 pusat, 30 bucu, 20 penjuru). Gerakan muka `U F R L BL BR D DR DL B FL FR` dengan `X X' X2 X2'` (72° / 144°, ikut arah jam apabila dilihat dari muka itu); gerakan WCA Pochmann `R++ R-- D++ D--` (semua kecuali lapisan L / U diputar 144°). Permutasi setiap gerakan diperoleh dengan memutar sentroid dan normal stiker. Pengesahan: bilangan warna, kepingan mustahil atau ganda, penjuru terpulas, bucu terbalik, paritas permutasi, dan susunan pusat (`v.megaCenters`).
- **Penyelesai** (multifase, tidak optimal, HTM gaya WCA: setiap putaran muka 72° atau 144° dikira 1):
  1. Selepas pengesahan, keadaan diputar / diberi label ulang agar pusat mengikuti skema standar, lalu diubah menjadi kod kepingan (penjuru: slot × 3 orientasi, bucu: slot × 2).
  2. **F2L, muka demi muka**: D, lima muka cincin di sekitar D, lalu empat dari lima muka atas. Selepas semua kepingan suatu muka terpasang, muka itu tidak diputar lagi — himpunan gerakan S menyempit, dan kepingan yang tidak tersentuh tetap selesai. Kepingan baharu di tiap langkah dibahagi menjadi kelompok kecil (≤ 3 kepingan: satu penjuru dan bucu jirannya); setiap kelompok diselesaikan dengan IDA*, yang heuristiknya adalah maksimum dari jadual jarak kecil kelompok kepingan (BFS di bawah S semasa, dibina ketika pertama digunakan dan di-cache). Sebelum langkah terakhir dua muka ditambahkan jadual orientasi bucu (seperti EO `<R,U>` pada 3×3) agar langkah itu selesai dengan dua penjana. Anggaran nod dengan cubaan ulang (menggunakan solusi berikutnya dari kelompok sebelumnya) menjaga kasus perlahan yang jarang tetap singkat.
  3. **Lapisan terakhir dua tahap** melalui jadual: tahap 1 = permutasi bucu + orientasi bucu + orientasi penjuru (60 · 16 · 81 = 77.760 keadaan), tahap 2 = permutasi penjuru × permutasi bucu (3.600 keadaan). Penjana menelusuri subgrup tiga muka `<U,X,Y>` dengan meet-in-the-middle (≤ 7 gerakan per muka) untuk mencari urutan yang mengekalkan semua kepingan di luar U, menyimpan yang terpendek untuk tiap efek beserta 5 putaran U-nya (39.059 makro), lalu menjalankan Dijkstra dengan kos HTM.
  4. Gerakan bersebelahan pada muka yang sama digabungkan (satuan 72° modulo 5).
- **Terukur** (Node, `tests/megaminx.test.js` / benchmark): 1.000 keadaan rawak, semuanya selesai: purata 120,1 HTM (F2L 95,4 + lapisan terakhir 26,4), maks. 135, min. 97; masa penyelesaian purata 34 ms, maks. 1,6 s. 500 kacauan Pochmann: purata 119,7, maks. 135, purata 29 ms, maks. 0,9 s. Di pelayar satu penyelesaian biasanya 2–20 ms ditambah overhead worker; mula worker + memuat jadual ≈ 170–200 ms. Angka ini direkod di `seo/site.config.json` dan dipaparkan di halaman SEO.
- **3D**: `view3d.geometry: 'poly'` dengan dodekahedron sebagai `solid` dan 12 bidang potong sebagai `cuts`; kepingan berupa polihedron cembung.
- **Paparan graf**: proyeksi stereografis posisi stiker dari pusat muka D (satu nod itu disembunyikan). Setiap putaran muka 72° memindahkan stikernya dalam siklus-5, dan 5 titik setiap siklus terletak pada satu bulatan di proyeksi (proyeksi stereografis memetakan bulatan ke bulatan); karena itu setiap orbit digambar sebagai bulatan luar siklus-5-nya: 39 bulatan, 131 nod kelihatan. Muka U putih berada di tengah, muka atas di sekelilingnya, muka bawah sebagai kelopak luar yang besar; zoom memperlihatkan pusat yang pejal.
- **Editor jaring**: dua “bunga” berisi 6 pentagon berdampingan (U dengan 5 jirannya, D dengan 5 jirannya), poligon SVG seperti bentuk lainnya.
- **Main bebas**: seret (`dragMoves` generik), kekunci `U F R L B D` ditambah `I`=BL, `O`=BR, `J`=FL, `K`=FR, `N`=DL, `M`=DR (Shift = lawan arah jam); pengiraan HTM; rawak = kacauan WCA Pochmann 77 gerakan (7 baris `R±± D±±` × 5 + `U`/`U'`); “selesaikan dari keadaan semasa” berfungsi seperti puzzle lainnya.
- **Imbas kamera**: disembunyikan (`cameraPlan: null`).
- **Nama**: 五魔方 (zh), メガミンクス (ja), Мегаминкс (ru), ميغامينكس (ar), Megaminx dalam bahasa lain; di menu tepat selepas Skewb.

## SEO: satu halaman statik per puzzle × bahasa

- **Satu konfigurasi**: `seo/site.config.json` (`baseUrl` = URL produksi; canonical / hreflang / peta laman / OG diturunkan darinya, jadi domain baharu hanya perlu mengubah ini dan membina ulang) beserta bilangan gerakan terukur.
- **Laluan** (`js/seo-routes.js`, digunakan bersama pelayar dan skrip build): bahasa Inggeris di akar, bahasa lain di bawah `/<bahasa>/`; satu laluan bersih per puzzle: `/` (pintu masuk utama, x-default), `/2x2-cube-solver/` … `/15x15-cube-solver/`, `/pyraminx-solver/`, `/skewb-solver/`, `/megaminx-solver/`; contohnya `/zh-hans/3x3-cube-solver/`, `/ja/megaminx-solver/`. Jumlah 12 bahasa × 18 = 216 halaman.
- **Teks**: `seo/lang/<code>.json` (12 bahasa, tajuk ditulis sesuai kebiasaan pencarian lokal), templat per jenis puzzle yang diisi bilangan gerakan terukur.
- **Build**: `npm run build:seo` (`tools/build-seo.js`) menulis halaman akar bahasa Inggeris di antara penanda `<!--seo:*-->` dalam `index.html` dan semua halaman lain ke `seo/out/`, ditambah `robots.txt`, `sitemap.xml` (dengan alternatif xhtml:link), dan `manifest.webmanifest`; ia menambahkan `?v=<hash isi>` pada js/css yang dirujuk HTML. Ikon dan imej OG (1200×630, satu per puzzle, dari tangkapan skrin 3D + graf yang nyata): `npm run build:seo-images` (memerlukan server lokal; `OG_ONLY=root,megaminx` membatasinya pada imej tertentu).
- **Per halaman**: title / description / canonical / 13 pautan hreflang (termasuk x-default) / OG / kad Twitter / ikon / manifest / JSON-LD (WebSite, WebApplication (percuma, tanpa rating), WebPage, BreadcrumbList, HowTo, FAQPage, sama kata per kata dengan teks yang kelihatan), `<h1>` statik, teks yang boleh dirangkak (cara pakai, penyelesai dan bilangan gerakan terukur, notasi, penjelasan graf, FAQ, pautan ke semua puzzle), catatan `<noscript>`.
- **Ketika berjalan** (`js/seo-nav.js`): halaman memilih bahasa dan puzzle terlebih dahulu melalui `<html data-page-lang data-page-puzzle>`; menukar puzzle atau bahasa di aplikasi berpindah ke URL bersih yang sesuai dengan `history.replaceState` dan mengambil tajuk / meta / JSON-LD / kandungan dari halaman yang sudah dirender, tanpa muat semula dan tanpa kehilangan keadaan. Akar `/` tetap mengikuti bahasa pelayar / pilihan terakhir.
- **Pautan lama**: `/?puzzle=…`, `/?n=…`, `/?lang=…` mendapat 301 ke laluan baharu dari `deploy/worker.js` (hanya berjalan untuk laluan halaman; aset statik dikecualikan melalui `run_worker_first`; tanpa `?lang`, bahasa diambil dari Accept-Language, dengan `Vary: Accept-Language`); parameter lain (`mode`, `hold`, `start`) dikekalkan. Secara lokal tanpa worker, `seo-nav.js` menulis ulang alamat di muka klien.
- **Ujian**: `node tests/seo.test.js` (statik: title/description unik di semua 216 halaman, canonical, pautan silang hreflang lengkap, JSON-LD boleh diurai dan sepadan dengan kandungan yang kelihatan, tanpa rating, saiz imej OG, pautan internal, sitemap/robots/manifest, ubah hala worker); `npm run test:seo:live` memeriksa setiap halaman langsung.

## Menjalankan

```bash
cd cube-solver
npm install
npm start                        # node tests/serve.js 8765 (sends COOP/COEP headers)
# open http://localhost:8765/
```

> Kamera memerlukan **konteks aman**: `https://` atau `http://localhost`. Melalui IP LAN (contohnya `http://192.168.x.x`) pelayar mematikan kamera; gunakan “Muat naik foto”.
> Web Worker tidak berjalan di `file://`; sentiasa buka laman melalui server HTTP.

## Ujian

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

Cakupan E2E: kacauan rawak → selesaikan → putar sampai akhir (6 klaster berwarna tunggal di graf, setiap muka 3D satu warna), lompat / undur / maju di pemain, pewarnaan dan setiap jenis ralat pengesahan, input formula, pengecaman 6 foto sintetis (rona warna, gradasi cahaya, derau, pantulan), laluan kamera palsu Chromium, tata letak mudah alih, dan tangkapan skrin. `tests/graph-preview.html` adalah halaman mandiri untuk men-debug tata letak graf (`?scr=rumus&mv=R&e=0.5`). `node tests/compare-ref.js` menulis perbandingan berdampingan dengan frame rujukan (`ref/f14`, `f07`, `f01`) ke `screenshots/compare-*.png`; `tests/graph-pixel.html` menggambar graf dengan pemetaan piksel frame rujukan untuk tumpang-tindih yang akurat hingga piksel.

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

## Titik sambungan (seni bina)

Modul inti (input, paparan graf, 3D, pemain, imbas, klien penyelesai) berfungsi **hanya** melalui objek Puzzle yang didaftarkan oleh `CubeLab.registerPuzzle(def)` dan tidak berisi logik khusus 3×3. Puzzle baharu diletakkan di `puzzles/<id>/` dan melaksanakan antara muka di bawah.

### Antara muka Puzzle

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

Ketika pendaftaran, inti melengkapi `parse / format / apply / inverse / isSolved` lalai, kepingan yang diputar setiap gerakan (ditentukan oleh `layer`), **trek graf** (`P.tracks`), dan laluan stiker setiap gerakan (`moves[tok].paths`).

Bidang pilihan yang digunakan bentuk lain: `trackMode: 'cycles'` (trek = siklus permutasi gerakan dasar), `netLayout.polys` (jaring berupa poligon SVG), `view3d.geometry: 'poly'` + `solid` / `cuts` / `core` (kepingan polihedron cembung), `dragMoves` (seret generik), `playKeys` / `playMetric` / `metricTitle`, `hints` (kunci i18n untuk petunjuk), `randomState(rnd)` (keadaan rawak seragam), `randomScramble()`, `nameKey`; `cameraPlan: null` menyembunyikan tab imbas, dan tanpa `holds` menu pegangan disembunyikan.

### Trek graf dan gerak (`CubeLab.buildTracks` + `GraphView`)

Untuk setiap gerakan dasar: ambil stiker yang berpindah, kelompokkan menurut “normal stiker · sumbu” (pada 3×3: “8 di muka” dan “12 di sisi”), urutkan tiap kelompok menurut penjuru di sekitar sumbu menjadi cincin tertutup; putaran sebesar θ memajukan stiker di cincin sebanyak `θ/2π × n` posisi, yang dipadankan dengan `perm`.

`graphLayout()` milik plugin memberikan posisi 2D nod dan, pilihan, `circles: [{id, cx, cy, r}]`:
- jika semua nod trek sisi terletak pada satu bulatan, nod bergerak **di sepanjang bulatan itu** (arah sama untuk seluruh trek; arah dengan laluan total terpendek pada gerakan dasar, diterbalikkan untuk inversnya) dengan jejak berwarna;
- nod trek “muka” diinterpolasi dalam koordinat polar di sekitar nod pusat muka (klaster berputar sebagai satu kesatuan);
- tanpa bulatan, digunakan spline tertutup melalui titik-titik, sehingga puzzle lain boleh divisualisasikan tanpa tata letak buatan tangan.

**Tata letak 3×3** (konfigurasi `GL` di `puzzles/cube3/cube3.js`): tiga kelompok bulatan konsentris adalah sumbu y (U/E/D), z (F/S/B), dan x (R/M/L), berpusat di titik penjuru segitiga sama sisi (atas, kiri bawah, kanan bawah), jejari 1,3922 / 1,7696 / 2,1469 (jejari bulatan luar segitiga = 1). Nilai ini hasil pemadanan kuadrat terkecil terhadap **semua 54 nod** pada frame rujukan beresolusi tinggi (residu RMS 0,2 px); jejari nod 0,184, garis 0,048, lebar trek 0,063, dan lebar serlahan 0,076 berasal dari pengukuran piksel pada frame yang sama. Apabila digambar dengan pemetaan piksel frame rujukan dan ditumpuk 50 %, bulatan dan nod hampir berimpit sempurna (`tests/graph-pixel.html`). Stiker muka X berada di titik potong kelompok bulatan dua sumbu selain normal X; dua daerah potong menampung sepasang muka yang berlawanan. Arah lapisan→jejari (`sign`) dan daerah potong tiap muka (`upper`) diperiksa secara menyeluruh (64 kombinasi): masing-masing dari enam putaran muka adalah pergeseran siklik 12 nod pada satu bulatan. Gerakan irisan M/E/S adalah gerakan nyata (dijana dari geometri dalam `moves`; penjana yang sama mereproduksi tepat 6 permutasi muka, disahkan oleh ujian unit) dan berjalan pada bulatan tengah kelompoknya. Penyelesai hanya mengeluarkan gerakan muka.

**Laluan busur (dipadankan frame demi frame dengan video rujukan)**: 12 nod pada setiap bulatan termasuk dalam 4 sektor muka dengan jarak kira-kira 60°/60°/60°/180°. Dengan aturan arah “laluan total terpendek”, putaran 90° memindahkan 9 stiker di busur ≈ 60° dan **3 stiker dari satu sektor melintasi busur kosong 180°** (contohnya busur atas bulatan terluar, busur kiri besar kelompok kiri bawah). Video rujukan melakukan hal yang betul-betul sama (`screenshots/compare-motion.png`, baris kedua). Posisi sektor ditetapkan oleh “tata letak selesai = rujukan f14”, sehingga tiada penetapan lain yang membuat semua busur pendek.

**Masa dan easing (diukur dari energi gerak video rujukan pada 60 fps)**:
- easing satu langkah `easeInOutQuad` (dipadankan dengan kurva kelajuan purata 15 putaran, RMS 0,076; sine 0,155, cubic 0,193);
- main balik berkelanjutan mengikuti selubung “mula perlahan – pantas – akhir perlahan”: langkah pertama ≈ 0,85 s, tengah 0,48 s, terakhir ≈ 1,0 s, hanya ≈ 0,07 s di antara langkah (`CubeLab.tempo(i, n)`, `Player.baseMs = 480`, `gapMs = 67`; satu “maju” tunggal tetap 0,55 s);
- serlahan bulatan aktif muncul dalam 8 % pertama putaran dan memudar dalam 16 % terakhir; jejak berwarna memanjang ke belakang dari nod (fase ekor `ease(1.6t − 0.6)`) dan memudar di akhir;
- selepas selesai, ≈ 1,2 s diam, lalu putaran showcase 2,0 s.

### Pegangan (penjuru pandang notasi)

Keadaan internal, penyelesai, dan input formula sentiasa menggunakan pegangan WCA (putih U, hijau F). Plugin boleh menyediakan `holds`: setiap pegangan memberikan orientasi 3D keseluruhan dan jadual penggantian nama notasi. Lalai 3×3 “kuning di atas, hijau di hadapan” = pegangan standar diputar 180° mengelilingi sumbu hadapan–belakang (z2): `U↔D`, `R↔L`, `F/B` tetap, `M→M′`, `E→E′`, `S` tetap (ujian unit memeriksa masing-masing: sumbu × penjuru gerakan internal, diputar oleh orientasi, sama dengan sumbu × penjuru gerakan yang dipaparkan). Teks solusi, langkah pemain semasa, daftar langkah, dan deskripsi menggunakan notasi pegangan semasa, sehingga lapisan atas pada skrin disebut U.

### Gaya 3D dan paparan

- `view3d.style: 'plastic'`: badan kelabu cerah + panel putih (sambungan kelabu cerah tipis) + stiker membulat berwarna rata (tanpa pencahayaan, warna sama dengan graf) + bayangan lembut pada badan; tanpa ini, gaya datar klasik berbadan hitam.
- `stickerCorners: [kiri atas, kanan atas, kanan bawah, kiri bawah]`: jejari penjuru stiker (bentuk daun asimetris dimungkinkan); `stickerColors` menggantikan warna stiker 3D.
- `orientation` (penjuru Euler, digantikan pegangan semasa) + `camera: { fov, dir }`: paparan 3×3 lalai sesuai video rujukan — kuning (D) di atas, hijau (F) di kiri, oren (L) di kanan — iaitu tiga klaster segitiga tengah pada graf. Perspektif FOV 24°, elevasi sekitar 25°, disetel dengan perbandingan piksel terhadap frame rujukan.
- `frame: { width, height, dx, dy }`: pembingkaian (saiz dan pergeseran puzzle / graf dalam separuh panelnya), sesuai video rujukan hingga 0,5 %.
- `autoRotate`: puzzle sedikit bergoyang semasa main balik; ketika main balik mencapai akhir dalam keadaan selesai, ia diam semasa `showcaseDelay` (1,2 s), berputar sekali dalam `showcaseMs` (2,0 s), lalu kembali ke paparan awal (seperti akhir video rujukan). Suis “putar automatik” di pemain menonaktifkannya; memutar dengan seret dan reset dengan klik dua kali sentiasa berfungsi.

### Bunyi (`js/core/audio.js`, `CubeLab.SoundEngine`)

Semuanya disintesis langsung dengan Web Audio API; tiada fail audio mahupun aset pihak ketiga.
- **Dasar putar automatik**: tiada `AudioContext` ketika halaman dimuat; ia dibuat dan di-`resume()` pada `pointerdown / keydown / touchstart` pertama. Efek aktif dan muzik mati secara lalai; “efek / muzik / volume” disimpan di `localStorage` (`cubelab.sfx / cubelab.music / cubelab.vol`). Jika muzik aktif sebelum muat semula, ia menunggu gestur pengguna berikutnya. Tanpa Web Audio, setiap panggilan tidak melakukan apa pun dan kawalannya dilumpuhkan.
- **Bunyi putaran v3** (hook `Player.onMove(phase, tok, durMs)`): dibina ulang berdasarkan analisis tiga rakaman nyata 3×3 (lihat `user-sounds/ANALYSIS.md`, `screenshots/sound-compare.png`). Putaran nyata = rentetan 120–200 ms “butiran” plastik berkelompok (≈ satu tiap 5 ms) yang menjana mod badan pendek: puncak utama 0,86–1,1 kHz (“berongga / kayu”) + 500 Hz, 1,55, 2,8, 4,1 kHz, dengung hanya 3–6 ms, hampir tanpa dentum di bawah 300 Hz; energi naik hingga klik paling keras ketika lapisan terkunci, diikuti gemeretak 70–100 ms yang meluruh. Sintesis: peristiwa butiran yang dijana di JS → 10 resonator orde dua (setiap butiran menjana mod berbeza secara rawak) + lapisan tipis butiran mikro + gesekan sangat ringan + serangan langsung pita lebar; klik penguncian sejajar dengan akhir animasi, main balik perlahan memusatkan bunyi di akhir, putaran 180° mendapat klik detent pada T/2, irisan lebih lembut dan gelap; setiap bunyi dikira dalam 1,7–3,3 ms. Dibandingkan dengan rakaman nyata (bahan SpaceJoe / Pixabay, analisis yang sama): sentroid 2141 Hz vs 2135 / 2077 Hz, faktor puncak 20,7 vs 21,1 / 17,6 dB, kerataan 0,24 vs 0,25 / 0,32, 18,5 vs 17,8 / 12,0 butiran per 100 ms, selisih bentuk pita sepertiga oktaf ≈ 2 dB. Tiada fail audio yang diterbitkan (rakaman hanya digunakan untuk analisis; lesen di `vendor/sounds/LICENSE.txt`). Perlindungan ketika main balik pantas: minimal 50 ms antarsuara putaran; putaran lebih pendek lebih pelan dan butirannya lebih sedikit; menyeret garis masa langsung menghentikan bunyi putaran yang belum selesai.
- **Selesai**: arpeggio mayor naik + akor (ketika main balik mencapai langkah terakhir dalam keadaan selesai); kilau naik yang lembut ketika **putaran showcase** bermula (`View3D.onShowcaseStart`).
- **Antara muka**: klik pewarnaan (nada mengikuti warna, dibatasi ketika mewarnai dengan seret), isyarat berjaya mengambil / memuat naik (tiga nada ketika keenam muka selesai).
- **Muzik latar**: 72 BPM, putaran empat birama Cmaj9 – Am9 – Fmaj9 – G6sus; gelombang gergaji yang sedikit sumbang dengan filter lolos-rendah sebagai pad + arpeggio pentatonik (pseudo-acak deterministik), delay umpan balik untuk ruang; penjadwalan di hadapan (tiap 150 ms membariskan 0,6 s), putaran tanpa jeda, fade masuk / keluar, sangat pelan.
- Aras (volume 0,8, diukur offline): satu putaran pada 1× memuncak sekitar 0,31–0,36, pada kelajuan tangan nyata (130 ms) sekitar 0,22, arpeggio selesai sekitar 0,23, muzik latar memuncak sekitar −22 dBFS. Demo (hanya lokal): `screenshots/sound-demo-turns.wav`, `sound-demo-turns-v3.wav`, `sound-demo-sfx.wav`, `sound-demo-music.wav`.

### Bahasa (`js/i18n/`, `CubeLab.i18n`)

- **Bahasa dan urutan**: English, 简体中文, 繁體中文, Español, العربية, Português, Bahasa Indonesia, Bahasa Melayu, Français, 日本語, Русский, Deutsch (semuanya setara di menu, tanpa kelompok).
- **String**: satu fail per bahasa, `js/i18n/<code>.js`, yang memanggil `CubeLab.i18n.register(code, {key: text})`; `en.js` adalah jadual induk, kunci yang hilang kembali ke bahasa Inggeris dan direkod di `CubeLab.i18n.missing`. HTML menggunakan `data-i18n` / `data-i18n-title` / `data-i18n-aria` / `data-i18n-placeholder`; teks dinamis menggunakan `I.bind(el, key, params)` dan digambar ulang ketika bahasa bertukar.
- **Pemformatan**: subset ICU — `{name}`, `{n, plural, =0 {…} one {# …} few {…} many {…} other {…}}` (`Intl.PluralRules`), `{ms, unit, millisecond}`, `{x, number}` (`Intl.NumberFormat`). Bahasa Perancis automatik mendapat spasi tak terputus sebelum `: ; ! ? « »`; bahasa Sepanyol menggunakan ¡ ¿. Notasi gerakan menggunakan huruf standar di semua bahasa (U D L R F B M E S, ′ 2).
- **Urutan deteksi**: `?lang=xx` → `localStorage['cubelab.lang']` → `navigator.languages` (zh-TW/HK/MO/Hant → tradisional, zh lainnya → ringkas) → English. Menetapkan `<html lang dir>`, tajuk, dan meta description.
- **RTL**: bahasa Arab mencerminkan seluruh halaman (properti logik CSS); kanvas 3D, graf, garis masa / kawalan pemain, strip langkah, notasi, input formula, dan nombor tetap LTR (`dir="ltr"`).
- **Tipografi**: CJK / Arab menggunakan susunan fon sendiri, tinggi baris lebih besar, dan tanpa spasi huruf; Jerman / Rusia mengaktifkan `hyphens:auto`, dan kekunci boleh dibalut ke baris baharu alih-alih meluap.
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

Satu puzzle boleh mempunyai beberapa penyelesai; menu mencantumkannya secara automatik, dan `available: false` dipaparkan sebagai “dirancang”. Menambahkan penyelesai optimal sebenar (contohnya IDA* Korf dengan basis data pola penjuru / bucu) hanya memerlukan worker baharu yang didaftarkan di `solvers`. Worker boleh mengembalikan `optimal: false` dengan kunci i18n `label` / `note` (Megaminx melakukannya), yang dipaparkan antara muka di sisi bilangan gerakan.

### Paparan lain

Pemain (`CubeLab.Player`) mengendalikan berapa pun paparan; sebuah paparan cukup melaksanakan `setState(state)` dan `animate(tok, e, fromState, t)` (e = kemajuan ter-easing 0–1, t = fase masa mentah), serta pilihan `highlight(tok, state)`. Visualisasi baharu (contohnya graf Cayley atau diagram siklus) hanya memerlukan metode-metode ini.

## Pustaka pihak ketiga

- [gullicube](https://github.com/rokicki/gullicube) (Tomas Rokicki, digunakan di bawah opsi MPL-2.0, kod sumber tidak diubah; lihat `vendor/gullicube/NOTICE.md`)
- [cubejs](https://github.com/ldez/cubejs) (MIT) — algoritme dua fase Kociemba. `vendor/solve.js` membawa tambalan kecil (`vendor/solve.js.cubelab.patch`): tenggat pilihan untuk `solve(maxDepth, deadline)` dan pengecualian alih-alih crash null apabila tidak ditemukan, digunakan untuk pemendekan iteratif dalam anggaran masa.
- [three.js](https://threejs.org/) r160 (MIT) — rendering 3D (build UMD `three.min.js`; konsol memperingatkan bahawa build ini usang, tidak berpengaruh di sini).
- Penyelesai Pyraminx, Skewb, dan Megaminx serta jadual lapisan terakhir Megaminx adalah kod dan data milik projek ini sendiri (MIT). Tiada kod GPL, mahupun kod dari csTimer atau TPR, yang digunakan.

## Had yang diketahui

- Pyraminx / Skewb / Megaminx: belum ada pengecaman kamera / foto. Ketika mewarnai, pegang puzzle seperti yang ditunjukkan petunjuk (Pyraminx: kepingan aksial tanpa kuning di atas, yang tanpa hijau di belakang; Skewb: penjuru putih-hijau-merah di atas-kanan-depan; Megaminx: pusat harus membentuk skema warna standar), jika tidak akan muncul ralat pegangan / pusat.
- Solusi Megaminx **tidak optimal** (purata ≈ 120 HTM, hingga ≈ 135); kadangkala keadaan sukar memakan masa hingga ≈ 1,6 s; jadual lapisan terakhir 1,8 MB (`megaminx-ll.json`, dimampatkan ketika transfer) dimuat turun sekali ketika penyelesai Megaminx bermula.
- Kamera memerlukan HTTPS atau localhost; pengecaman bergantung pada pencahayaan — betulkan hasilnya di jaring apabila ada pantulan kuat atau cahaya kekuningan (warna pusat digunakan untuk penentukuran dan menoleransi sedikit rona).
- Pengimbasan mengasumsikan skema warna standar (putih bertentangan dengan kuning, hijau dengan biru, merah dengan oren) dan pegangan terpandu; pusat tetap di editor.
- Penyelesai 3×3 hanya mengeluarkan gerakan muka (HTM); solusi pada video rujukan memuat gerakan irisan, jadi urutan langkah untuk keadaan yang sama berbeza dari video.
- Algoritme dua fase memberikan solusi mendekati optimal (biasanya 19–21 gerakan); hanya keadaan dengan ≤ 8 gerakan yang mendapat solusi terbukti optimal. Penyelesai optimal sebenar setingkat “nombor Tuhan” tetap menjadi kemungkinan sambungan.
