**English** · [简体中文](README.zh-Hans.md) · [繁體中文](README.zh-Hant.md) · [日本語](README.ja.md) · [Español](README.es.md) · [Português](README.pt.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · [Русский](README.ru.md) · [العربية](README.ar.md) · [Bahasa Indonesia](README.id.md) · [Bahasa Melayu](README.ms.md)

# Cube Solver Lab

A puzzle solver that runs entirely in your browser: 2×2 to 15×15 cubes, Pyraminx and Skewb. Next to the 3D cube, a permutation graph shows every sticker as a node, so you can watch each turn move the stickers along circles.

**Live site: https://cube-solver.org**

## Features

- **Solve** 2×2 to 15×15 cubes, Pyraminx and Skewb. The 2×2, Pyraminx and Skewb get optimal solutions. The 3×3 uses the Kociemba two-phase algorithm (usually 19–21 moves). 5×5 and larger use gullicube compiled to multithreaded WebAssembly.
- **Enter a position** by painting a cube net, typing a scramble (`R U R' U2 …`, wide and slice moves included), scanning with your camera or uploading photos.
- **Validation** that explains what is wrong: missing colors, a twisted corner, a flipped edge, parity and more.
- **Step-by-step player** with a timeline, speed control and keyboard shortcuts, synchronized between the 3D view and the graph.
- **Free play** on 2×2 to 15×15: turn layers by dragging or with the keyboard, with a timer, optional WCA inspection, undo/redo and best times.
- **12 languages**, including full right-to-left layout for Arabic, plus one static, search-friendly page for each puzzle in each language.
- **Synthesized sound**: every sound is generated live with the Web Audio API, and no audio files are shipped.

## Privacy

- Camera images and uploaded photos are processed only in your browser. They are never uploaded or stored on a server.
- The site uses no cookies, no analytics and no third-party scripts, fonts or trackers. Settings such as language, sound and best times are saved only in your browser's local storage.
- The site is a set of static files hosted on Cloudflare, which handles ordinary web requests as any web host does.

## Run locally

Requirements: Node.js 18 or later.

```bash
npm install
npx playwright install chromium   # only needed for the browser tests
npm start                         # http://localhost:8765/
```

The camera needs a secure context (`https://` or `http://localhost`). The local server sends the same cross-origin isolation headers as the live site, which multithreaded WebAssembly requires.

## Test

```bash
npm test               # builds the SEO pages, then runs the unit, solver and SEO tests (no browser needed)
npm run test:nxn       # 4×4–15×15 solver checks (slower)
npm start &            # the browser tests need the local server
npm run test:e2e       # also: test:i18n, test:play, test:twisty, test:naming
```

## Build and deploy

```bash
npm run build          # assembles the deployable site in dist/
```

The site is deployed as Cloudflare Workers static assets (see `deploy/`):

```bash
export CLOUDFLARE_ACCOUNT_ID=<your account id>
export CLOUDFLARE_API_TOKEN=<an API token that can edit Workers>   # or run: npx wrangler login
npm run deploy
```

- `deploy/_headers` sets `Cross-Origin-Opener-Policy` and `Cross-Origin-Embedder-Policy`, which the multithreaded WebAssembly solver needs.
- `deploy/worker.js` only redirects: `www` and `*.workers.dev` to the main domain, and old `/?puzzle=…` links to the new paths. Static files (`/js`, `/css`, `/img`, `/puzzles`, `/vendor` and so on) are served directly without running the Worker, so a page view costs one Worker request.
- If you deploy your own copy, change `name` and `routes` in `deploy/wrangler.toml` and `baseUrl` in `seo/site.config.json`.

Developer notes (in Chinese): [docs/DEVELOPMENT.zh-Hans.md](docs/DEVELOPMENT.zh-Hans.md).

## License and credits

- The code of this project is released under the [MIT License](LICENSE).
- Third-party components keep their own licenses. Details are in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
  - [gullicube](https://github.com/rokicki/gullicube) by Tomas Rokicki, the solver for 5×5 and larger, is used unmodified under the Mozilla Public License 2.0 (one option of its "MPL-2.0 OR GPL-3.0-or-later" license). See `vendor/gullicube/` and `tools/build-gullicube.sh`.
  - [cubejs](https://github.com/ldez/cubejs) (MIT), the 3×3 two-phase solver, carries a small patch in `vendor/solve.js.cubelab.patch`.
  - [three.js](https://threejs.org/) (MIT) renders the 3D view.

## Trademark

Rubik's Cube is a registered trademark of Spin Master Ltd. This project is not affiliated with, sponsored by or endorsed by Spin Master. "Rubik's" appears only to describe the puzzle.
