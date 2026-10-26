# Contributing to cube-solver

Thanks for helping! Bug reports, translation fixes and pull requests are all welcome.

## Reporting

- **Bugs, ideas, translations:** open an [issue](https://github.com/neichen/cube-solver/issues/new/choose) using one of the templates. Include the page URL, the scramble and your browser.
- **Security issues:** do not open a public issue. See [SECURITY.md](SECURITY.md).

## Development setup

Requirements: Node.js 18 or later.

```bash
npm install
npx playwright install chromium   # browser tests only
npm start                         # http://localhost:8765/
```

In development the files in `js/`, `css/` and `puzzles/` are served as they are; `npm run build` writes the deployable `dist/` (content-hashed asset URLs, service worker, headers). Architecture notes are in [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md).

## Before you open a pull request

```bash
npm test                 # unit, solver and SEO tests (no browser)
npm start &              # then, for the area you touched:
npm run test:e2e         # also test:i18n, test:play, test:twisty, test:naming, test:features
npm run test:nxn         # if you touched the 4×4–15×15 solvers
# if you touched the build, headers or service worker:
npm run build && (node tests/serve.js 8766 dist &) && npm run test:dist
```

## Rules of the road

- **Languages.** The site ships in 12 languages. Every user-visible string goes into all of `js/i18n/*.js` (app) and `seo/lang/*.json` (landing pages). If you cannot translate a language, use English and say so in the PR; a native speaker can follow up.
- **Facts on landing pages.** Numbers shown on pages (move counts, times) come from measurements in `seo/site.config.json` or from exact formulas in `tools/build-seo.js`. Please do not add numbers that were not measured or derived.
- **Licenses.** The project is MIT. New third-party code must have a compatible license (MIT, BSD, Apache-2.0, MPL-2.0 file-level); **no GPL code**. Add every new component to [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
- **No secrets.** Analytics IDs and API tokens live only in environment variables or a gitignored `.env`; never commit them.
- **No private or unlicensed media.** Do not commit personal photos, `ref/` material or sound files without a redistributable license.
- **Cross-origin isolation.** The multithreaded WebAssembly solver needs `COOP`/`COEP`. Any new third-party resource must be served with CORS or `Cross-Origin-Resource-Policy: cross-origin`.
- Keep pull requests focused; one topic per PR makes review much faster.

By contributing you agree that your contribution is released under the [MIT License](LICENSE).
