[English](README.md) · [简体中文](README.zh-Hans.md) · [繁體中文](README.zh-Hant.md) · [日本語](README.ja.md) · [Español](README.es.md) · [Português](README.pt.md) · [Français](README.fr.md) · **Deutsch** · [Русский](README.ru.md) · [العربية](README.ar.md) · [Bahasa Indonesia](README.id.md) · [Bahasa Melayu](README.ms.md)

# Cube Solver Lab

Ein Puzzle-Löser, der komplett im Browser läuft: Würfel von 2×2 bis 15×15, Pyraminx, Skewb und Megaminx. Neben dem 3D-Modell zeigt ein Permutationsgraph jeden Sticker als Knoten – so sieht man, wie jede Drehung die Sticker entlang von Kreisen bewegt.

**Website: https://cube-solver.org**

## Funktionen

- **Lösen** von Würfeln von 2×2 bis 15×15, Pyraminx, Skewb und Megaminx. 2×2, Pyraminx und Skewb werden optimal gelöst. Der 3×3 nutzt den Zwei-Phasen-Algorithmus von Kociemba (meist 19–21 Züge). Ab 5×5 kommt gullicube zum Einsatz, kompiliert zu Multithread-WebAssembly. Der Megaminx nutzt ein schnelles Mehrphasenverfahren (im Schnitt etwa 120 Züge HTM, nicht optimal).
- **Stellung eingeben**: Würfelnetz einfärben, Verdrehung eintippen (`R U R' U2 …`, auch Wide- und Slice-Züge), mit der Kamera scannen oder Fotos hochladen.
- **Prüfung** mit Erklärung, was nicht stimmt: fehlende Farben, verdrehte Ecke, gekippte Kante, Parität und mehr.
- **Schritt-für-Schritt-Wiedergabe** mit Zeitleiste, Geschwindigkeitsregler und Tastenkürzeln, synchron zwischen 3D-Ansicht und Graph.
- **Freies Spielen** mit allen Puzzles: Schichten per Ziehen oder Tastatur drehen, mit Timer, optionaler WCA-Inspektion, Rückgängig/Wiederholen und Bestzeiten. Das Megaminx-Scramble folgt dem WCA-Stil (Pochmann).
- **12 Sprachen**, mit vollständigem Rechts-nach-links-Layout für Arabisch, und eine statische, suchmaschinenfreundliche Seite für jedes Puzzle in jeder Sprache.
- **Synthetischer Klang**: Alle Töne werden live mit der Web Audio API erzeugt; es werden keine Audiodateien mitgeliefert.

## Datenschutz

- Kamerabilder und hochgeladene Fotos werden ausschließlich in deinem Browser verarbeitet. Sie werden nie hochgeladen oder auf einem Server gespeichert.
- Die Live-Website zählt Besuche mit Cloudflare Web Analytics, das keine Cookies verwendet und keine personenbezogenen Daten erhebt; es wird für alle Besucher geladen. Google Analytics 4 läuft immer mit Consent Mode v2; Werbespeicher, Werbe-Nutzerdaten, Anzeigenpersonalisierung und Google Signals sind aus. In der EU/im EWR, im Vereinigten Königreich und in der Schweiz (und wenn das Land nicht bestimmt werden kann) wird es erst geladen, nachdem du im Einwilligungshinweis auf „Akzeptieren“ geklickt hast; anderswo gibt es keinen Hinweis und es wird nur für Seitenaufruf-Statistiken geladen. In beiden Fällen kannst du es jederzeit über den Link „Analyse-Einstellungen“ in der Fußzeile ein- oder ausschalten; „Ablehnen“ stoppt es und löscht seine Cookies. Einstellungen wie Sprache, Ton, Bestzeiten und deine Analyse-Wahl werden nur im lokalen Speicher deines Browsers abgelegt. Gezählt werden nur Seitenaufrufe: Puzzle-Zustände und Kamerabilder werden nie gesendet.
- Die Website besteht aus statischen Dateien, die bei Cloudflare gehostet werden; Cloudflare verarbeitet dabei, wie jeder Webhoster, gewöhnliche Web-Anfragen.

## Lokal starten

Voraussetzung: Node.js 18 oder neuer.

```bash
npm install
npx playwright install chromium   # nur für die Browser-Tests nötig
npm start                         # http://localhost:8765/
```

Die Kamera benötigt einen sicheren Kontext (`https://` oder `http://localhost`). Der lokale Server sendet dieselben Cross-Origin-Isolation-Header wie die Live-Seite; Multithread-WebAssembly braucht sie.

## Tests

```bash
npm test               # erzeugt die SEO-Seiten und führt dann Unit-, Löser- und SEO-Tests aus (ohne Browser)
npm run test:nxn       # Prüfung der 4×4–15×15-Löser (langsamer)
npm start &            # die Browser-Tests brauchen den lokalen Server
npm run test:e2e       # außerdem: test:i18n, test:play, test:twisty, test:naming, test:analytics
```

## Build und Deployment

```bash
npm run build          # stellt die auslieferbare Website in dist/ zusammen
```

Die Website wird als statische Assets von Cloudflare Workers ausgeliefert (siehe `deploy/`):

```bash
export CLOUDFLARE_ACCOUNT_ID=<deine Account-ID>
export CLOUDFLARE_API_TOKEN=<ein API-Token, das Workers bearbeiten darf>   # oder: npx wrangler login
export CF_BEACON_TOKEN=<token>               # optional: Token für Cloudflare Web Analytics
export GA_MEASUREMENT_ID=G-XXXXXXXXXX        # optional: GA4-Mess-ID, wird erst nach Einwilligung geladen
npm run deploy
```

- `deploy/_headers` setzt `Cross-Origin-Opener-Policy` und `Cross-Origin-Embedder-Policy`, die der Multithread-WebAssembly-Löser benötigt.
- `deploy/worker.js` leitet nur weiter: `www` und `*.workers.dev` auf die Hauptdomain und alte `/?puzzle=…`-Links auf die neuen Pfade. Statische Dateien (`/js`, `/css`, `/img`, `/puzzles`, `/vendor` usw.) werden direkt ausgeliefert, ohne den Worker auszuführen – ein Seitenaufruf kostet also eine Worker-Anfrage.
- Die Analyse-IDs stehen nicht im Repository. `npm run build` liest `CF_BEACON_TOKEN` und `GA_MEASUREMENT_ID` aus der Umgebung (oder aus einer von git ignorierten `.env`-Datei mit Zeilen `KEY=Wert`) und schreibt sie nur nach `dist/`. Sind sie nicht gesetzt, enthält der Build keine Analyse, keinen Einwilligungshinweis und kein Tracking; die Analyse läuft außerdem nur auf der Produktionsdomain.
- Wer eine eigene Kopie betreibt, ändert `name` und `routes` in `deploy/wrangler.toml` sowie `baseUrl` in `seo/site.config.json`.

Hinweise für Entwickler: [docs/DEVELOPMENT.de.md](docs/DEVELOPMENT.de.md).

Mitmachen: Fehlerberichte, Übersetzungskorrekturen und Pull Requests sind willkommen – siehe [CONTRIBUTING.md](CONTRIBUTING.md) (Englisch). Sicherheitsprobleme: [SECURITY.md](SECURITY.md).

## Danksagung

Die Graphansicht, die den Würfel als Kreise darstellt, ist von den Animationen von じゃがりきん ([@jagarikin](https://x.com/jagarikin)) inspiriert: [Original (2022-05)](https://x.com/jagarikin/status/1524175137633095681), [mit 3D-Würfel (2022-11)](https://x.com/jagarikin/status/1593771091738374144). Auf die Idee gestoßen sind wir durch [diesen Beitrag von @UnicornBitcoin](https://x.com/UnicornBitcoin/status/2107652690113339684). Danke an beide.

## Lizenz und Danksagung

- Der Code dieses Projekts steht unter der [MIT-Lizenz](LICENSE).
- Komponenten von Drittanbietern behalten ihre eigenen Lizenzen. Einzelheiten stehen in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
  - [gullicube](https://github.com/rokicki/gullicube) von Tomas Rokicki, der Löser für 5×5 und größer, wird unverändert unter der Mozilla Public License 2.0 verwendet (eine Wahlmöglichkeit seiner Lizenz „MPL-2.0 OR GPL-3.0-or-later“). Siehe `vendor/gullicube/` und `tools/build-gullicube.sh`.
  - [cubejs](https://github.com/ldez/cubejs) (MIT), der Zwei-Phasen-Löser für den 3×3, enthält einen kleinen Patch, siehe `vendor/solve.js.cubelab.patch`.
  - [three.js](https://threejs.org/) (MIT) zeichnet die 3D-Ansicht.

## Marke

Rubik's Cube ist eine eingetragene Marke der Spin Master Ltd. Dieses Projekt steht in keiner Verbindung zu Spin Master und wird von Spin Master weder gesponsert noch unterstützt. „Rubik's“ wird nur zur Beschreibung des Puzzles verwendet.
