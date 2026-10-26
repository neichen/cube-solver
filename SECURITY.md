# Security policy

cube-solver is a static web app: puzzles are solved in your browser, camera images never leave your device, and the only server-side code is a small Cloudflare Worker (`deploy/worker.js`) that serves files and sets headers.

## Supported versions

Only the current `main` branch, which is what runs on https://cube-solver.org, receives fixes.

## Reporting a vulnerability

Please **do not** open a public issue for security problems (for example XSS, a weakness in the Content Security Policy or headers, the service worker serving the wrong content, or anything that leaks data).

- Use GitHub's private reporting if it is available on this repository: **Security → Report a vulnerability**.
- Otherwise open an issue titled "Security contact request" **without any details**, and the maintainer will get in touch to arrange a private channel.

Please include the affected URL, steps to reproduce and the impact you expect. You can expect a first reply within 7 days. Once a fix is deployed you are welcome to publish your findings, and we are happy to credit you.

## Scope

In scope: this repository and https://cube-solver.org.
Out of scope: third-party services the site loads (Cloudflare Web Analytics, Google Analytics), denial-of-service and rate-limit testing, and reports from automated scanners without a demonstrated impact.
