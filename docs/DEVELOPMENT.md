**English** · [简体中文](DEVELOPMENT.zh-Hans.md) · [繁體中文](DEVELOPMENT.zh-Hant.md) · [日本語](DEVELOPMENT.ja.md) · [Español](DEVELOPMENT.es.md) · [Português](DEVELOPMENT.pt.md) · [Français](DEVELOPMENT.fr.md) · [Deutsch](DEVELOPMENT.de.md) · [Русский](DEVELOPMENT.ru.md) · [العربية](DEVELOPMENT.ar.md) · [Bahasa Indonesia](DEVELOPMENT.id.md) · [Bahasa Melayu](DEVELOPMENT.ms.md)

# Cube Solver Lab (CubeLab) · Developer notes

> Detailed notes for developers. This English file is the canonical version; the translations follow it. For the project overview, running, testing, deployment, license and privacy, see the [README](../README.md).
> `ref/` (reference video frames) and `screenshots/` (test screenshot output) mentioned below are not in the repository; the tests create the screenshot folders when they run.

A pure front-end puzzle solver (static HTML/CSS/JS, no back end). Its signature feature is a **graph view**: next to the 3D puzzle is a "permutation graph" in which every sticker is a node. For the 3×3 it is **three groups of concentric circles** (each group of 3 circles = the 3 layers of one axis; the centers form an equilateral triangle, giving a three-fold petal pattern), with the 54 nodes at circle intersections. On each turn the circles of that layer darken, the 12 side stickers travel along the arcs (with fading trails in the sticker colors), and the 9 stickers of the turned face rotate inside their cluster, in exact sync with the 3D turn. A scrambled cube mixes the colors; a solved cube forms 6 compact single-color clusters.

## Features

| Module | Description |
| --- | --- |
| Painting | Net + palette, click / drag to paint, color counts, reset / random / clear |
| Formula input | Type a scramble (`R U R' U2 …`, slices `M E S` supported), applied from solved in the WCA grip (white top, green front) |
| Camera scan | `getUserMedia` live view + grid overlay + live recognition preview; guided order for the 6 faces (with orientation hints) |
| Photo upload | Any face can use an uploaded photo instead; a "grid size" slider aligns the stickers |
| Color recognition | Median RGB inside each cell → CIE Lab. During the scan: live preview against typical colors (odd sizes calibrate with the measured centers). **After all six faces** (`js/core/color-cluster.js`): equal-capacity k-means over all 6n² cells (exactly n² per color, lightness down-weighted) → color names by trying all 6! assignments (fixed by the centers on odd sizes) → constrained decoding per piece orbit with the Hungarian algorithm (corners must be one of the 8 legal oriented triples, edges / wings legal pairs, center orbits get a quota per color) → re-estimate the color centers and solve again. Works for even sizes (no fixed centers) too |
| Validation | Localized messages (12 languages, Intl plural rules): unpainted stickers, duplicate centers, color counts, impossible pieces, duplicate pieces, twisted corner, flipped edge, parity (two pieces swapped) |
| Solving | In a Web Worker. 3×3: ① bidirectional BFS (provably optimal for ≤ 8 moves) ② Kociemba two-phase (cubejs) with iterative shortening within a time budget, usually 19–21 moves. Other puzzles: see below |
| Player | Play / pause / previous / next / first / last / speed / draggable timeline / click any step; keys: Space, ←, →; tempo and easing measured from the reference video |
| Sound | Synthesized live with Web Audio (no audio files): realistic turn sound, solved arpeggio, showcase sweep, paint ticks, capture cues; optional generated background music; "SFX / music / volume" in the player bar, saved locally |
| Grip | "Yellow top, green front" (default, matches the reference video) / "White top, green front (WCA)": switches both the 3D orientation and the notation, so U is always the top layer on screen |
| Demo mode | "Scramble first, then solve": plays the scramble from solved, then the solution |
| Responsive | On phones the 3D view and the graph stack vertically; controls wrap |
| Languages | 12 languages (English, 简体中文, 繁體中文, Español, العربية, Português, Bahasa Indonesia, Bahasa Melayu, Français, 日本語, Русский, Deutsch), full RTL for Arabic; globe icon at the top right, choice saved locally |

## N×N (2×2 – 15×15)

The "Puzzle" menu at the top offers 2×2 … 15×15 (also `?n=7`). All views (net painting, formula, camera N×N grid, three.js 3D, the graph with three groups of n concentric circles plus zoom / pan, the player) are generated per size.

| Size | Solver | Metric | Measured (random scrambles, all verified solved) |
| --- | --- | --- | --- |
| 2×2 | Own optimal solver (full distance table, 3,674,160 states, BFS) | HTM | 100 solves: avg 8.87, max 10; table ≈ 0.3 s, solve < 1 ms |
| 3×3 | BFS ≤ 8 optimal + Kociemba two-phase with shortening | HTM | usually 19–21 moves |
| 4×4 | Own reduction method (below); gullicube optional | OBTM | 12 solves (Node): avg 56.8, max 64; tables ≈ 3.2 s; solve avg 6.9 s (slowest 16 s) |
| 5×5 – 15×15 | gullicube (T. Rokicki, MPL-2.0) compiled to multithreaded WebAssembly; quality / fast mode | SSTM | see table below |

gullicube (Node, 4 threads, same build as the browser; SSTM):

| n | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Quality (--time 16, ≈ 10–15 s, first download ≈ 30 MB of tables) | 119 | 169 | 257 | 329 | 448 | 563 | 678 | 833 | 981 | 1131 | 1408 |
| Fast (--fast, ≈ 2–4 s, ≈ 0.5 MB of tables) | 168 | 281 | 402 | 571 | 695 | 972 | 1130 | 1495 | 1635 | 1950 | 2231 |

Low-memory devices (`navigator.deviceMemory` < 4 GB) and phones / tablets default to fast mode for n ≥ 5; the solver menu switches quality / speed at any time. Multithreaded WASM needs cross-origin isolation: `deploy/_headers` sets COOP / COEP / CORP.

**Analytics** (`js/analytics.js`, runs only on cube-solver.org): Cloudflare Web Analytics is cookieless and loads for everyone; GA4 injects gtag.js only after the visitor clicks "Accept" (Consent Mode v2, only `analytics_storage` granted). Both answer with `Cross-Origin-Resource-Policy: cross-origin` + CORS headers, so `require-corp` stays and cross-origin isolation is not broken. SPA route changes (`history.replaceState`) are counted automatically by CF's SPA mode and GA4 enhanced measurement ("page changes based on browser history events"); do not send `page_view` by hand (it would double-count). Tests: `npm run test:analytics` (local, beacons intercepted) / `npm run test:analytics:live`. The analytics IDs are not in the repository: `tools/build-dist.js` reads `CF_BEACON_TOKEN` and `GA_MEASUREMENT_ID` from the environment (or the gitignored `.env`) and writes them only into `dist/js/analytics.js`; without them there is no analytics, no consent banner and no tracking. Everything stays within the free Cloudflare Workers static-assets quota (static files are not billed as Worker requests; the Worker runs only for page routes).

**4×4 reduction solver** (`puzzles/nxn/cube4.worker.js`, own code; the phase idea follows public Tsai / TPR-style methods, no code copied):
1. P1 (36 moves): the R/L-colored centers to R/L, exact distance table C(24,8).
2. P2 (outer + Rw/Lw + Uw2/Dw2/Fw2/Bw2): U/D centers to U/D, the R/L-axis centers into one of 12 solvable arrangements, all wings "oriented" (the 24 wing positions fall into two classes under the P3 group), even wing permutation (removes OLL parity).
3. P3a (U D F B, R2 L2, wide half turns): centers into the P3b-solvable subset, the 8 E-slice wings back in the E slice, P3b solvable.
4. P3b (U D, F2 B2 R2 L2, wide half turns): centers solved, 12 edges paired, PLL parity removed.
5. The equivalent 3×3 goes to Kociemba two-phase (cubejs).
Each phase uses IDA*; within the time budget several earlier-phase candidates are tried and the shortest kept; adjacent same-axis moves are merged.

Tests: `node tests/nxn.test.js [4×4 samples]` (models 2–15 + 2×2 + 4×4), `node tests/gullicube.test.js 5,7,10,15 both`, live `node tests/live-nxn.js <URL>`.

### Precomputed tables (4×4 and 3×3 solvers)

`npm run build:tables` writes `puzzles/nxn/cube4-tables.bin.gz` (1.61 MB, 7 distance tables) and `puzzles/cube3/cubejs-prune.bin.gz` (0.89 MB, cubejs pruning tables). Format: `CLT1` + header length + JSON directory (name / type / length / FNV-1a checksum) + raw bytes, gzip-compressed (`js/core/table-pack.js`). The worker downloads the tables while it computes the move tables; the browser decompresses with `DecompressionStream` and checks every table, and falls back to computing them on the spot if the download fails, a checksum differs or the browser lacks support. After changing any solver's table layout, run `npm run build:tables` again (`tests/tables.test.js` compares the tables with live computation).

## Free play (all puzzles)

The "Solve / Play" switch at the top of the stage (or `?mode=play`).

| Action | Description |
|---|---|
| Drag a sticker (mouse / touch) | Turns the layer of that sticker. Cubes: of the face's two axes, the one whose projection best matches the drag; axis = face normal × drag direction; on big cubes the layer you grab turns (inner layers 2R, 3R…, the middle layer of odd sizes M / E / S). Other puzzles use `dragMoves` (below). On touch the canvas has `touch-action: none`, so the page does not scroll |
| Drag empty space | Rotates the view (double-click resets) |
| Keyboard | `U D L R F B` (Shift = counterclockwise); number prefix picks the layer (`2` `R` → 2R); `w` prefix for wide (`3` `w` `R` → 3Rw); `M E S` on odd sizes; `x y z` rotations (2×2 and 4×4+); Ctrl+Z / Backspace undo, Ctrl+Y / Ctrl+Shift+Z redo; Esc clears the prefix. Notation follows the current grip (the top layer on screen is always U) |
| Formula box | Any formula (3Rw, 2R, M/E/S…), Enter runs it, animated step by step |
| Scramble | 2×2 / 3×3: uniform random state (`CubeLab.play.randomState`); 4×4+: random moves; Pyraminx / Skewb: uniform random state; Megaminx: WCA (Pochmann) scramble |
| Timer | Starts with the first (non-rotation) move after a scramble, stops when solved; optional WCA 15 s inspection (+2 after 15 s, DNF after 17 s) |
| Move count | STM up to 3×3, BTM for 4×4+ (rotations not counted); Pyraminx / Skewb VTM; Megaminx HTM |
| Undo / redo / reset / solve from current state | "Solve" switches back to solve mode and solves the current state, played as usual (this attempt is not timed) |

- The best time per puzzle is stored in `localStorage` (`cubelab.best.<puzzle>`). Solving triggers a light highlight + solved sound (follows the SFX switch) + a showcase spin (follows the auto-rotate switch).
- Implementation: `js/core/play-core.js` (pure logic, testable in Node), `Player.pushMove / popMove` (queued animation, speeds up when backlogged, never drops moves), `View3D.pick / dragTurn / setPlayMode`, and the mode control in `app.js`. The graph updates step by step with the 3D view.

## Pyraminx and Skewb

Both are full plugins (`puzzles/twisty/`): model, validation, 3D, net editor, graph view, strictly optimal solver, free play, 12 languages.

- **Model** (`twisty-model.js`, shared by page / worker / Node): stickers are generated from geometry (Pyraminx: 9 triangles per face; Skewb: 1 square + 4 corner triangles per face); each move's permutation = rotate the centroids and normals of the stickers in the layer by 120° about the axis and find the stickers again. WCA notation: Pyraminx `U L R B` (two layers) + `u l r b` (tips); Skewb `R U L B` (R = down-right-back corner, U = up-left-back, L = down-left-front, B = down-left-back; the up-right-front corner is fixed).
- **Optimal solver** (`twisty.worker.js?p=…`): color state → pieces + orientations, split by piece class into independent components; BFS first finds each component's reachable set and move tables, then a full BFS over the product space (`Uint8Array` distance table); the solution descends the table, so its length is exactly the shortest distance (VTM: each 120° turn counts 1). Pyraminx tips commute with everything and are fixed at the end with 0 / 1 move each (still optimal).

| | States (core) | Components | Measured God's number | Table | Build (Node / browser incl. worker start) | Solve |
|---|---|---|---|---|---|---|
| Pyraminx | 933,120 (× 81 tips = 75,582,720) | edges 11,520 × axial centers 81 | 11 (15 with tips) | 0.93 MB | ≈ 60 ms / ≈ 250 ms | ≈ 0.03 ms |
| Skewb | 3,149,280 | centers 360 × corners 8,748 | 11 (90 antipodes) | 3.15 MB | ≈ 180 ms / ≈ 400 ms | ≈ 0.01 ms |

  The tables are built in the browser (faster than downloading a compressed table), so no extra asset is needed. `tests/twisty.test.js` checks: every move cubed = identity, cancels with its inverse, moves whole pieces; product of components = BFS reachable count (components independent); counts per layer; the table is a consistent BFS layering; random states solve with length = table distance; the validator rejects flipped edges / twisted corners / two swapped pieces / impossible color combinations / wrong grip.
- **3D**: each piece is a solid convex polyhedron (shape ∩ half-spaces of the cutting planes: two per vertex on the Pyraminx, 4 planes through the center on the Skewb); a turn rotates the whole layer, cut faces slide in their own plane and never intersect; stickers are inset, rounded triangles / squares.
- **Graph view**: each 120° turn's sticker orbits are 3-cycles, drawn as the circle through the 3 nodes. Pyraminx nodes = sticker centers on the net (U / L / R vertices are centers of concentric circle groups, B-layer circles surround the whole net); Skewb uses an azimuthal equidistant projection from the DBL corner (the B layer is concentric circles, R / U / L form three petals).
- **Net editor**: SVG polygons (click / drag to paint, Enter paints from the keyboard, errors outlined in red). Pyraminx: front face centered, left / right faces at the sides, bottom below; Skewb: the same cross as the cube.
- **Free play**: dragging a sticker picks, among the candidate moves, the one whose instantaneous velocity of that sticker best matches the drag (same axis: the one with fewer pieces, so dragging a tip turns only the tip); keys `U L R B` / `R U L B` (Shift = counterclockwise), on the Pyraminx `T` then a letter = tip; scramble = uniform random state; timer / best times as for cubes.
- **Camera / photo recognition**: not supported yet (triangular / rhombic stickers need new sampling grids and piece-constrained coloring); these puzzles hide the scan tab and ask you to paint.

## Megaminx

A full plugin in `puzzles/megaminx/` (own code, MIT): `megaminx-model.js` (geometry, moves, validation; shared by page / worker / Node), `megaminx.js` (plugin: 3D, net, graph, notation, free play), `megaminx-solver.js` (multi-phase solver), `megaminx.worker.js` and `megaminx-ll.json` (last-layer table, generated offline by `tools/megaminx-ll-gen.js`).

- **Model**: 12 faces × 11 stickers = 132 stickers, 62 pieces (12 centers, 30 edges, 20 corners). Face moves `U F R L BL BR D DR DL B FL FR` with `X X' X2 X2'` (72° / 144°, clockwise seen from that face); WCA Pochmann moves `R++ R-- D++ D--` (everything except the L / U layer turned by 144°). Each move's permutation is found by rotating sticker centroids and normals. Validation: color counts, impossible or duplicate pieces, twisted corners, flipped edges, permutation parity, and center arrangement (`v.megaCenters`).
- **Solver** (multi-phase, not optimal, WCA-style HTM: any face turn of 72° or 144° counts 1):
  1. After validation the state is rotated / relabeled so the centers are in the standard scheme, then converted to piece codes (corner slot × 3 orientations, edge slot × 2).
  2. **F2L, face by face**: D, the five ring faces around D, then four of the five upper faces. Once all pieces of a face are placed, that face is no longer turned, so the move set S shrinks and untouched pieces stay solved. The new pieces of each step are split into small groups (≤ 3 pieces: a corner and its adjacent edges); each group is solved with IDA* whose heuristic is the maximum of small piece-group distance tables (BFS under the current S, built on first use and cached). Before the final two-face step an edge-orientation table (like 3×3 `<R,U>` EO) is added, so that step can be finished with two generators. A node budget with retries (taking the next solution of the previous group) keeps the rare slow cases short.
  3. **Last layer in two looks** from a table: look 1 = edge permutation + edge orientation + corner orientation (60 · 16 · 81 = 77,760 states), look 2 = corner permutation × edge permutation (3,600 states). The generator searches `<U,X,Y>` three-face subgroups with meet-in-the-middle (≤ 7 moves per side) for sequences that keep all non-U pieces, keeps the shortest per effect plus its 5 U-rotations (39,059 macros), and runs Dijkstra with HTM cost.
  4. Adjacent same-face moves are merged (72° units mod 5).
- **Measured** (Node, `tests/megaminx.test.js` / benchmark): 1,000 random states, all solved: avg 120.1 HTM (F2L 95.4 + LL 26.4), max 135, min 97; solve time avg 34 ms, max 1.6 s. 500 Pochmann scrambles: avg 119.7, max 135, avg 29 ms, max 0.9 s. In the browser a solve usually takes 2–20 ms plus worker overhead; worker start + table load ≈ 170–200 ms. The figures are written into `seo/site.config.json` and shown on the SEO pages.
- **3D**: `view3d.geometry: 'poly'` with the dodecahedron as `solid` and the 12 cutting planes as `cuts`; pieces are convex polyhedra.
- **Graph view**: stereographic projection of the sticker positions from the D center (that one node is hidden). Every 72° face turn moves its stickers in 5-cycles, and the 5 points of each cycle lie on one circle in the projection (stereographic projection maps circles to circles), so every orbit is drawn as the circumcircle of its 5-cycle: 39 circles, 131 visible nodes. The white U face is in the middle, the upper faces around it, the lower faces as large outer petals; zoom shows the dense center.
- **Net editor**: two "flowers" of 6 pentagons side by side (U with its 5 neighbors, D with its 5 neighbors), SVG polygons as for the other shapes.
- **Free play**: drag (generic `dragMoves`), keys `U F R L B D` plus `I`=BL, `O`=BR, `J`=FL, `K`=FR, `N`=DL, `M`=DR (Shift = counterclockwise); HTM count; scramble = 77-move WCA Pochmann scramble (7 lines of `R±± D±±` × 5 + `U`/`U'`); "solve from current state" works as for the other puzzles.
- **Camera scan**: hidden (`cameraPlan: null`).
- **Names**: 五魔方 (zh), メガミンクス (ja), Мегаминкс (ru), ميغامينكس (ar), Megaminx elsewhere; the menu entry comes right after Skewb.

## SEO: one static page per puzzle × language

- **Single config**: `seo/site.config.json` (`baseUrl` = the production URL; canonical / hreflang / sitemap / OG are all derived from it, so a new domain only needs this change and a rebuild) plus the measured move counts.
- **Routes** (`js/seo-routes.js`, shared by the browser and the build scripts): English at the root, other languages under `/<lang>/`; one clean path per puzzle: `/` (main entry, x-default), `/2x2-cube-solver/` … `/15x15-cube-solver/`, `/pyraminx-solver/`, `/skewb-solver/`, `/megaminx-solver/`; e.g. `/zh-hans/3x3-cube-solver/`, `/ja/megaminx-solver/`. In total 12 languages × 18 = 216 pages.
- **Copy**: `seo/lang/<code>.json` (12 languages, titles written for local search habits), templated per puzzle type and filled with the measured move counts.
- **Build**: `npm run build:seo` (`tools/build-seo.js`) writes the English root page between the `<!--seo:*-->` markers in `index.html` and all other pages into `seo/out/`, plus `robots.txt`, `sitemap.xml` (with xhtml:link alternates), `manifest.webmanifest`; it adds `?v=<content hash>` to the js/css referenced by the HTML. Icons and OG images (1200×630, one per puzzle, taken from real 3D + graph screenshots): `npm run build:seo-images` (needs the local server; `OG_ONLY=root,megaminx` limits it to some images).
- **Per page**: title / description / canonical / 13 hreflang links (incl. x-default) / OG / Twitter card / icons / manifest / JSON-LD (WebSite, WebApplication (free, no ratings), WebPage, BreadcrumbList, HowTo, FAQPage, matching the visible text word for word), a static `<h1>`, crawlable body text (how to use, solver and measured move counts, notation, graph explanation, FAQ, links to all puzzles), a `<noscript>` note.
- **Runtime** (`js/seo-nav.js`): pages preselect language and puzzle through `<html data-page-lang data-page-puzzle>`; switching puzzle or language in the app swaps to the matching clean URL with `history.replaceState` and takes title / meta / JSON-LD / body from the prerendered page, without reloading or losing state. The root `/` still follows the browser language / last choice.
- **Old links**: `/?puzzle=…`, `/?n=…`, `/?lang=…` get a 301 to the new paths from `deploy/worker.js` (runs only for page routes; static assets are excluded by `run_worker_first`; without `?lang` the language comes from Accept-Language, with `Vary: Accept-Language`); other parameters (`mode`, `hold`, `start`) are kept. Locally, without the worker, `seo-nav.js` rewrites the address on the client.
- **Tests**: `node tests/seo.test.js` (static: unique title/description on all 216 pages, canonical, complete hreflang cross-links, JSON-LD parses and matches the visible content, no ratings, OG image sizes, internal links, sitemap/robots/manifest, worker redirects); `npm run test:seo:live` checks every live page.

## Run

```bash
cd cube-solver
npm install
npm start                        # node tests/serve.js 8765 (sends COOP/COEP headers)
# open http://localhost:8765/
```

> The camera needs a **secure context**: `https://` or `http://localhost`. Over a LAN IP (e.g. `http://192.168.x.x`) the browser disables the camera; use "Upload photo" instead.
> Web Workers do not run under `file://`; always open the site through an HTTP server.

## Test

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

E2E coverage: random scramble → solve → play to the end (6 single-color clusters in the graph, every 3D face one color), player seek / prev / next, painting and every kind of validation error, formula input, recognition of 6 synthetic photos (color casts, lighting gradients, noise, glare), the Chromium fake-camera path, mobile layout and screenshots. `tests/graph-preview.html` is a standalone page for debugging graph layouts (`?scr=formula&mv=R&e=0.5`). `node tests/compare-ref.js` writes side-by-side comparisons with the reference video frames (`ref/f14`, `f07`, `f01`) to `screenshots/compare-*.png`; `tests/graph-pixel.html` renders the graph with the reference frame's pixel mapping for pixel-level overlays.

## Directory layout

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

## Extension points (architecture)

The core modules (input, graph view, 3D, player, scanning, solver client) work **only** through the Puzzle object registered with `CubeLab.registerPuzzle(def)` and contain no 3×3-specific logic. A new puzzle goes into `puzzles/<id>/` and implements the interface below.

### Puzzle interface

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

At registration the core fills in default `parse / format / apply / inverse / isSolved`, the pieces each move turns (decided by `layer`), the **graph tracks** (`P.tracks`) and each move's sticker paths (`moves[tok].paths`).

Optional fields used by the other shapes: `trackMode: 'cycles'` (tracks = cycles of the base move permutations), `netLayout.polys` (SVG polygon net), `view3d.geometry: 'poly'` + `solid` / `cuts` / `core` (convex polyhedral pieces), `dragMoves` (generic dragging), `playKeys` / `playMetric` / `metricTitle`, `hints` (i18n keys of the hints), `randomState(rnd)` (uniform random state), `randomScramble()`, `nameKey`; `cameraPlan: null` hides the scan tab, and without `holds` the grip menu is hidden.

### Graph tracks and motion (`CubeLab.buildTracks` + `GraphView`)

For each base move: take the moved stickers, group them by "sticker normal · axis" (on the 3×3: "the face's 8" and "the 12 on the sides"), sort each group by angle about the axis into a closed ring; a turn by θ advances the stickers on the ring by `θ/2π × n` slots, cross-checked against `perm`.

The plugin's `graphLayout()` provides the 2D node positions and optionally `circles: [{id, cx, cy, r}]`:
- if all nodes of a side track lie on one circle, they move **along that circle** (same direction for the whole track; the direction with the shortest total travel under the base move, reversed for the inverse) with color trails;
- nodes of a "face" track interpolate in polar coordinates around the face's center node (the cluster rotates as a whole);
- without circles a closed spline through the nodes is used, so other puzzles can be visualized without a hand-made layout.

**3×3 layout** (the `GL` config in `puzzles/cube3/cube3.js`): the three groups of concentric circles are the y (U/E/D), z (F/S/B) and x (R/M/L) axes, centered on the vertices of an equilateral triangle (top, bottom left, bottom right), radii 1.3922 / 1.7696 / 2.1469 (triangle circumradius = 1). These values are a least-squares fit to **all 54 nodes** in a high-resolution reference frame (RMS residual 0.2 px); node radius 0.184, stroke 0.048, track width 0.063 and highlight width 0.076 come from pixel measurements of the same frame. Rendered with the reference frame's pixel mapping and overlaid at 50%, circles and nodes match almost exactly (`tests/graph-pixel.html`). The stickers of face X sit at the intersections of the circle groups of the two axes other than X's normal; the two intersection regions hold a pair of opposite faces. The layer→radius direction (`sign`) and the intersection region of each face (`upper`) were verified exhaustively (64 combinations): each of the six face turns is a cyclic shift of 12 nodes on a single circle. Slice moves M/E/S are real moves (generated from geometry in `moves`; the same generator reproduces the 6 face permutations exactly, checked in a unit test) and travel on the middle circle of their group. The solver outputs face moves only.

**Arc routing (checked frame by frame against the reference video)**: the 12 nodes on each circle belong to 4 face sectors spaced about 60°/60°/60°/180°. With "shortest total travel" as the direction rule, a 90° turn moves 9 stickers along ≈ 60° arcs and **the 3 stickers of one sector across the empty 180° arc** (e.g. the upper arc of the outer circle, the big left arc of the bottom-left group). The reference video does exactly the same (`screenshots/compare-motion.png`, second row). The sector positions are fixed by "solved layout = reference f14", so no other slot assignment makes every arc short.

**Timing and easing (measured from the reference video's 60 fps motion energy)**:
- single-step easing `easeInOutQuad` (fit to the mean speed curve of 15 turns, RMS 0.076; sine 0.155, cubic 0.193);
- continuous playback has a "slow start – speed up – slow end" envelope: first step ≈ 0.85 s, middle 0.48 s, last ≈ 1.0 s, only ≈ 0.07 s gap between steps (`CubeLab.tempo(i, n)`, `Player.baseMs = 480`, `gapMs = 67`; single "next" is fixed at 0.55 s);
- the active circle highlight fades in during the first 8% of a turn and out during the last 16%; color trails extend backwards from the node (tail phase `ease(1.6t − 0.6)`) and vanish at the end;
- after solving, ≈ 1.2 s still, then a 2.0 s showcase spin.

### Grips (notation viewpoint)

Internal state, solvers and formula input always use the WCA grip (white U, green F). A plugin can provide `holds`: each grip gives an overall 3D orientation and a notation renaming table. The 3×3 default "yellow top, green front" = the standard grip rotated 180° about the front–back axis (z2): `U↔D`, `R↔L`, `F/B` unchanged, `M→M′`, `E→E′`, `S` unchanged (unit tests check each one: the internal move's axis × angle, rotated by the orientation, equals the displayed move's axis × angle). Solution text, the player's current step, the step list and the descriptions use the current grip's notation, so the top layer on screen is called U.

### 3D style and view

- `view3d.style: 'plastic'`: light-gray body + white panels (thin light-gray seams) + rounded flat-colored stickers (unlit, same colors as the graph) + soft shading on the body; without it, the classic flat style with a black body.
- `stickerCorners: [top-left, top-right, bottom-right, bottom-left]`: sticker corner radii (asymmetric leaf shapes possible); `stickerColors` overrides the 3D sticker colors.
- `orientation` (Euler angles, overridden by the current grip) + `camera: { fov, dir }`: the 3×3 default view matches the reference video — yellow (D) up, green (F) left, orange (L) right — which are the three clusters of the graph's middle triangle. Perspective FOV 24°, about 25° elevation, tuned by pixel comparison with the reference frames.
- `frame: { width, height, dx, dy }`: framing (size and offset of the puzzle / graph in their half panels), matching the reference video within 0.5%.
- `autoRotate`: the puzzle sways slightly during playback; when playback reaches the end in a solved state it rests for `showcaseDelay` (1.2 s), then spins once for `showcaseMs` (2.0 s) and returns to the start view (as at the end of the reference video). The "auto-rotate" switch in the player turns it off; drag-to-rotate and double-click reset always work.

### Sound (`js/core/audio.js`, `CubeLab.SoundEngine`)

Everything is synthesized live with the Web Audio API; there are no audio files or third-party assets.
- **Autoplay policy**: no `AudioContext` at page load; it is created and `resume()`d on the first `pointerdown / keydown / touchstart`. SFX on and music off by default; "SFX / music / volume" are stored in `localStorage` (`cubelab.sfx / cubelab.music / cubelab.vol`). If music was on before a reload, it waits for the next user gesture. Without Web Audio every call is a no-op and the controls are disabled.
- **Turn sound v3** (`Player.onMove(phase, tok, durMs)` hook): rebuilt from an analysis of three real 3×3 recordings (see `user-sounds/ANALYSIS.md`, `screenshots/sound-compare.png`). A real turn = a 120–200 ms train of clustered plastic grains (≈ one per 5 ms) exciting short body modes: main peak 0.86–1.1 kHz ("hollow / woody") + 500 Hz, 1.55, 2.8, 4.1 kHz, ringing only 3–6 ms, almost no thump below 300 Hz; energy builds up to the loudest click when the layer lands, followed by a 70–100 ms fading rattle. Synthesis: grain events generated in JS → 10 second-order resonators (each grain excites different modes at random) + a fine micro-grain layer + very light friction + a broadband direct edge; the landing click is aligned with the end of the animation, slow playback concentrates the sound at the end, 180° turns add a detent click at T/2, slices are softer and darker; each sound renders in 1.7–3.3 ms. Compared with real recordings (SpaceJoe / Pixabay material, same analysis): centroid 2141 Hz vs 2135 / 2077 Hz, crest factor 20.7 vs 21.1 / 17.6 dB, flatness 0.24 vs 0.25 / 0.32, 18.5 vs 17.8 / 12.0 grains per 100 ms, third-octave shape difference ≈ 2 dB. No audio files are published (recordings were used only for analysis; licenses in `vendor/sounds/LICENSE.txt`). Fast-playback guard: at least 50 ms between turn sounds; shorter turns are quieter with fewer grains; dragging the timeline stops unfinished turn sounds at once.
- **Solved**: a rising major arpeggio + chord (when playback reaches the last step in a solved state); a soft rising shimmer when the **showcase spin** starts (`View3D.onShowcaseStart`).
- **UI**: paint ticks (pitch follows the color, throttled while drag-painting), capture / upload success cues (three tones when all six faces are done).
- **Background music**: 72 BPM, a four-bar Cmaj9 – Am9 – Fmaj9 – G6sus loop; detuned low-passed saws as a pad + pentatonic arpeggios (deterministic pseudo-random), feedback delay for space; look-ahead scheduling (0.6 s queued every 150 ms), seamless loop, fades in and out, very low level.
- Levels (volume 0.8, measured offline): a 1× single turn peaks at about 0.31–0.36, real hand speed (130 ms) about 0.22, the solved arpeggio about 0.23, background music peaks around −22 dBFS. Demos (local only): `screenshots/sound-demo-turns.wav`, `sound-demo-turns-v3.wav`, `sound-demo-sfx.wav`, `sound-demo-music.wav`.

### Languages (`js/i18n/`, `CubeLab.i18n`)

- **Languages and order**: English, 简体中文, 繁體中文, Español, العربية, Português, Bahasa Indonesia, Bahasa Melayu, Français, 日本語, Русский, Deutsch (all equal entries in the menu, no groups).
- **Strings**: one file per language, `js/i18n/<code>.js`, calling `CubeLab.i18n.register(code, {key: text})`; `en.js` is the master table, missing keys fall back to English and are recorded in `CubeLab.i18n.missing`. HTML uses `data-i18n` / `data-i18n-title` / `data-i18n-aria` / `data-i18n-placeholder`; dynamic text uses `I.bind(el, key, params)` and re-renders on language change.
- **Formatting**: an ICU subset — `{name}`, `{n, plural, =0 {…} one {# …} few {…} many {…} other {…}}` (`Intl.PluralRules`), `{ms, unit, millisecond}`, `{x, number}` (`Intl.NumberFormat`). French gets non-breaking spaces before `: ; ! ? « »` automatically; Spanish uses ¡ ¿. Move notation keeps the standard letters in every language (U D L R F B M E S, ′ 2).
- **Detection order**: `?lang=xx` → `localStorage['cubelab.lang']` → `navigator.languages` (zh-TW/HK/MO/Hant → Traditional, other zh → Simplified) → English. Sets `<html lang dir>`, the title and the meta description.
- **RTL**: Arabic mirrors the whole page (CSS logical properties); the 3D canvas, graph, timeline / player controls, step strip, notation, formula input and numbers stay LTR (`dir="ltr"`).
- **Typography**: CJK / Arabic use their own font stacks, larger line height and no letter spacing; German / Russian enable `hyphens:auto`, and buttons may wrap instead of overflowing.
- **Adding a language**: add an entry to `LANGS` in `i18n.js`, create `js/i18n/<code>.js` and include it in `index.html`, then run `node tests/i18n.unit.test.js`.

### Solver adapters

```js
solvers: [
  { id: 'kociemba', name: '…', available: true,
    workerUrl: 'puzzles/cube3/kociemba.worker.js',
    encode: state => payload },          // runs on the main thread; throws a localized error for invalid states
  { id: 'optimal-ida', name: 'IDA* optimal (planned)', available: false }
]
```

Worker protocol:

```
→ { id, cmd: 'init' }                      ← { id, ok: true, ms }
→ { id, cmd: 'solve', payload }            ← { id, ok: true, moves: ['R', "U'", ...], optimal?: bool, label?, note?, ms }
                                           ← { id, ok: false, error }
```

A puzzle can have several solvers; the menu lists them automatically, and `available: false` shows as "planned". Adding a true optimal solver (e.g. Korf IDA* with corner / edge pattern databases) only needs a new worker registered in `solvers`. A worker may return `optimal: false` with a `label` / `note` i18n key (the Megaminx does), which the UI shows next to the move count.

### Other views

The player (`CubeLab.Player`) drives any number of views; a view only implements `setState(state)` and `animate(tok, e, fromState, t)` (e = eased progress 0–1, t = raw time phase), optionally `highlight(tok, state)`. A new visualization (e.g. a Cayley graph or a cycle diagram) only needs these methods.

## Third-party libraries

- [gullicube](https://github.com/rokicki/gullicube) (Tomas Rokicki, used under the MPL-2.0 option, source unmodified; see `vendor/gullicube/NOTICE.md`)
- [cubejs](https://github.com/ldez/cubejs) (MIT) — Kociemba two-phase algorithm. `vendor/solve.js` carries a small patch (`vendor/solve.js.cubelab.patch`): an optional deadline for `solve(maxDepth, deadline)` and an exception instead of a null crash when nothing is found, used for iterative shortening within the time budget.
- [three.js](https://threejs.org/) r160 (MIT) — 3D rendering (UMD build `three.min.js`; the console warns that this build is deprecated, which does not matter here).
- The Pyraminx, Skewb and Megaminx solvers and the Megaminx last-layer table are this project's own code and data (MIT). No GPL code, csTimer or TPR code is used.

## Known limitations

- Pyraminx / Skewb / Megaminx: no camera / photo recognition yet. When painting, hold the puzzle as the hints say (Pyraminx: the axial piece without yellow on top, the one without green at the back; Skewb: the white-green-red corner at up-right-front; Megaminx: the centers must form the standard color scheme), otherwise you get a grip / center error.
- Megaminx solutions are **not optimal** (≈ 120 HTM on average, up to ≈ 135); the occasional hard state takes up to ≈ 1.6 s; the 1.8 MB last-layer table (`megaminx-ll.json`, compressed in transit) is downloaded once when the Megaminx solver starts.
- The camera needs HTTPS or localhost; recognition depends on lighting — fix the result on the net under strong glare or yellow light (the center colors are used for calibration and tolerate some color cast).
- Scanning assumes the standard color scheme (white opposite yellow, green opposite blue, red opposite orange) and the guided grip; centers are fixed in the editor.
- The 3×3 solver outputs face moves only (HTM); the reference video's solutions include slice moves, so the step sequence for the same state will differ from the video.
- The two-phase algorithm gives near-optimal solutions (usually 19–21 moves); only states ≤ 8 moves get a provably optimal solution. A true God's-number-level optimal solver is left as an extension.
