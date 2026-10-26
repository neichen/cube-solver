# Third-party notices

The code written for this project is MIT-licensed (see [LICENSE](LICENSE)). The components below are
included in `vendor/` and keep their own licenses.

| Component | Files | License | Source |
| --- | --- | --- | --- |
| gullicube (Tomas Rokicki) | `vendor/gullicube/gullicube.js`, `gullicube.wasm`, `data/*.cls` | MPL-2.0 (used under the MPL-2.0 option of "MPL-2.0 OR GPL-3.0-or-later") | https://github.com/rokicki/gullicube, commit `48bd54b36a95888639f63df63a24d8639b84cd23` |
| cubejs (Petri Lehtinen, Ludovic Fernandez) | `vendor/cube.js`, `vendor/solve.js` | MIT | https://github.com/ldez/cubejs |
| three.js (three.js authors) | `vendor/three.min.js` (r160, tree-shaken bundle built from the `three` npm package by `tools/build-three.js`) | MIT | https://github.com/mrdoob/three.js |
| Octicons (GitHub Inc.) | five icon paths (`mark-github`, `share`, `link`, `download`, `device-mobile`, 16 px, v19) inlined as SVG in `js/topbar.js` | MIT | https://github.com/primer/octicons |

## gullicube — Mozilla Public License 2.0

- Full license text: [`vendor/gullicube/LICENSE-MPL.md`](vendor/gullicube/LICENSE-MPL.md).
- Build details and notice: [`vendor/gullicube/NOTICE.md`](vendor/gullicube/NOTICE.md).
- **Modifications: none.** The upstream C++ sources were compiled unchanged with Emscripten; the `.cls`
  table files are unmodified copies of the upstream `data/` files. `tools/build-gullicube.sh` rebuilds them.
- **Source code** for these MPL-covered files is available at the upstream repository and commit above.
- The adapter `puzzles/nxn/gullicube.worker.js`, which talks to the WebAssembly module, is this project's own
  code (MIT) and a separate file, as the MPL allows ("Larger Work").

## cubejs — MIT

License text: [`vendor/cubejs-LICENSE`](vendor/cubejs-LICENSE). `vendor/solve.js` contains a small change
described in [`vendor/solve.js.cubelab.patch`](vendor/solve.js.cubelab.patch) (an optional deadline for
`solve()`, and an error instead of a crash when no solution is found). `puzzles/cube3/cubejs-prune.bin.gz`
holds pruning tables computed with cubejs.

## three.js — MIT

License text: [`vendor/three-LICENSE`](vendor/three-LICENSE).

## Sounds

No audio files are included. All sounds are synthesized at runtime by `js/core/audio.js` (this project's code).
See [`vendor/sounds/LICENSE.txt`](vendor/sounds/LICENSE.txt).

## Design inspiration

The cube-as-circles graph view (`js/core/graph-view.js`) is inspired by the animations of じゃがりきん
([@jagarikin](https://x.com/jagarikin)): [original (2022-05)](https://x.com/jagarikin/status/1524175137633095681),
[with 3D cube (2022-11)](https://x.com/jagarikin/status/1593771091738374144). We first came across the idea through
[this post by @UnicornBitcoin](https://x.com/UnicornBitcoin/status/2107652690113339684). No videos, frames or other
material from these posts are included in this repository; the graph view is this project's own code (MIT).

## Analytics (live site only)

`js/analytics.js` loads Cloudflare Web Analytics (`static.cloudflareinsights.com/beacon.min.js`, cookieless) and, only after
the visitor accepts, Google Analytics 4 (`www.googletagmanager.com/gtag/js`). These scripts are loaded from their providers at
run time on https://cube-solver.org; they are not part of this repository and are governed by the providers' terms.

## Octicons — MIT

The GitHub mark and the share, link, download and device icons in the top bar are path data from
[Octicons](https://github.com/primer/octicons), unmodified.

```
MIT License

Copyright (c) 2026 GitHub Inc.

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated
documentation files (the "Software"), to deal in the Software without restriction, including without limitation
the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and
to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of
the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO
THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF
CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS
IN THE SOFTWARE.
```

The GitHub logo is a trademark of GitHub, Inc. and is used here only to link to this project's repository.

## Trademark

Rubik's Cube is a registered trademark of Spin Master Ltd. This project is not affiliated with, sponsored by
or endorsed by Spin Master.
