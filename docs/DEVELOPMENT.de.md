[English](DEVELOPMENT.md) · [简体中文](DEVELOPMENT.zh-Hans.md) · [繁體中文](DEVELOPMENT.zh-Hant.md) · [日本語](DEVELOPMENT.ja.md) · [Español](DEVELOPMENT.es.md) · [Português](DEVELOPMENT.pt.md) · [Français](DEVELOPMENT.fr.md) · **Deutsch** · [Русский](DEVELOPMENT.ru.md) · [العربية](DEVELOPMENT.ar.md) · [Bahasa Indonesia](DEVELOPMENT.id.md) · [Bahasa Melayu](DEVELOPMENT.ms.md)

# Cube Solver Lab (CubeLab) · Hinweise für Entwickler

> Ausführliche Hinweise für Entwickler. Die englische Fassung ([DEVELOPMENT.md](DEVELOPMENT.md)) ist maßgeblich; diese Übersetzung folgt ihr. Projektüberblick, Ausführen, Tests, Deployment, Lizenz und Datenschutz: siehe [README](../README.de.md).
> Die unten erwähnten Ordner `ref/` (Bilder aus dem Referenzvideo) und `screenshots/` (Screenshot-Ausgabe der Tests) sind nicht im Repository; die Tests legen die Screenshot-Ordner beim Lauf an.

Ein reiner Frontend-Puzzle-Löser (statisches HTML/CSS/JS, kein Backend). Sein Markenzeichen ist die **Graph-Ansicht**: Neben dem 3D-Puzzle steht ein „Permutationsgraph“, in dem jeder Sticker ein Knoten ist. Beim 3×3 sind es **drei Gruppen konzentrischer Kreise** (jede Gruppe aus 3 Kreisen = die 3 Schichten einer Achse; die Mittelpunkte bilden ein gleichseitiges Dreieck, daraus entsteht ein dreizähliges Blütenmuster), die 54 Knoten liegen auf den Schnittpunkten. Bei jeder Drehung werden die Kreise dieser Schicht dunkler, die 12 seitlichen Sticker wandern die Bögen entlang (mit verblassenden Spuren in der Stickerfarbe) und die 9 Sticker der gedrehten Seite rotieren innerhalb ihres Clusters – exakt synchron mit der 3D-Drehung. Ein verdrehter Würfel mischt die Farben; ein gelöster bildet 6 kompakte einfarbige Cluster.

## Funktionen

| Modul | Beschreibung |
| --- | --- |
| Malen | Netz + Palette, Klicken / Ziehen zum Malen, Farbzähler, Zurücksetzen / Zufall / Leeren |
| Formeleingabe | Scramble eingeben (`R U R' U2 …`, Mittelschichten `M E S` möglich), angewendet ab gelöst im WCA-Griff (Weiß oben, Grün vorne) |
| Kamera-Scan | Livebild über `getUserMedia` + Rasterüberlagerung + Live-Erkennungsvorschau; geführte Reihenfolge der 6 Seiten (mit Ausrichtungshinweisen) |
| Foto-Upload | Jede Seite kann stattdessen ein hochgeladenes Foto verwenden; ein Regler „Rastergröße“ richtet die Sticker aus |
| Farberkennung | Median-RGB innerhalb jeder Zelle → CIE Lab. Während des Scans: Live-Vorschau gegen typische Farben (ungerade Größen kalibrieren mit den gemessenen Mitten). **Nach allen sechs Seiten** (`js/core/color-cluster.js`): k-Means mit gleicher Kapazität über alle 6n² Zellen (genau n² pro Farbe, Helligkeit schwächer gewichtet) → Farbnamen durch Ausprobieren aller 6! Zuordnungen (bei ungeraden Größen durch die Mitten festgelegt) → beschränkte Dekodierung je Teile-Orbit mit der Ungarischen Methode (Ecken müssen eines der 8 gültigen orientierten Farbtripel sein, Kanten / Flügel gültige Paare, Mittelstück-Orbits ein Kontingent pro Farbe) → Farbzentren neu schätzen und erneut lösen. Funktioniert auch für gerade Größen (ohne feste Mitten) |
| Prüfung | Lokalisierte Meldungen (12 Sprachen, Intl-Pluralregeln): unbemalte Sticker, doppelte Mitten, Farbanzahl, unmögliche Teile, doppelte Teile, verdrehte Ecke, gekippte Kante, Parität (zwei Teile vertauscht) |
| Lösen | In einem Web Worker. 3×3: ① bidirektionale BFS (beweisbar optimal bis 8 Züge) ② Kociemba-Zweiphasen (cubejs) mit iterativer Verkürzung innerhalb eines Zeitbudgets, meist 19–21 Züge. Andere Puzzles: siehe unten |
| Player | Abspielen / Pause / zurück / vor / Anfang / Ende / Tempo / ziehbare Zeitleiste / Klick auf einen beliebigen Schritt; Tasten: Leertaste, ←, →; Tempo und Easing aus dem Referenzvideo gemessen |
| Sound | Live mit Web Audio synthetisiert (keine Audiodateien): realistischer Drehklang, Arpeggio beim Lösen, Showcase-Sweep, Mal-Klicks, Aufnahme-Signale; optional generierte Hintergrundmusik; „Effekte / Musik / Lautstärke“ in der Player-Leiste, lokal gespeichert |
| Griff | „Gelb oben, Grün vorne“ (Standard, wie im Referenzvideo) / „Weiß oben, Grün vorne (WCA)“: schaltet 3D-Ausrichtung und Notation gemeinsam um, sodass U immer die obere Schicht auf dem Bildschirm ist |
| Demo-Modus | „Erst verdrehen, dann lösen“: spielt das Scramble ab gelöst und danach die Lösung |
| Responsiv | Auf Smartphones stehen 3D-Ansicht und Graph untereinander; Bedienelemente brechen um |
| Sprachen | 12 Sprachen (English, 简体中文, 繁體中文, Español, العربية, Português, Bahasa Indonesia, Bahasa Melayu, Français, 日本語, Русский, Deutsch), vollständiges RTL für Arabisch; Globus-Symbol oben rechts, Auswahl lokal gespeichert |

## N×N (2×2 – 15×15)

Das Menü „Puzzle“ oben bietet 2×2 … 15×15 (auch `?n=7`). Alle Ansichten (Netz malen, Formel, N×N-Kameraraster, three.js-3D, der Graph mit drei Gruppen von n konzentrischen Kreisen samt Zoom / Verschieben, der Player) werden je Größe erzeugt.

| Größe | Löser | Metrik | Gemessen (zufällige Scrambles, alle als gelöst geprüft) |
| --- | --- | --- | --- |
| 2×2 | Eigener optimaler Löser (vollständige Distanztabelle, 3.674.160 Zustände, BFS) | HTM | 100 Lösungen: Ø 8,87, max. 10; Tabelle ≈ 0,3 s, Lösen < 1 ms |
| 3×3 | BFS ≤ 8 optimal + Kociemba-Zweiphasen mit Verkürzung | HTM | meist 19–21 Züge |
| 4×4 | Eigene Reduktionsmethode (unten); gullicube wählbar | OBTM | 12 Lösungen (Node): Ø 56,8, max. 64; Tabellen ≈ 3,2 s; Lösen Ø 6,9 s (langsamste 16 s) |
| 5×5 – 15×15 | gullicube (T. Rokicki, MPL-2.0), kompiliert zu mehrfädigem WebAssembly; Qualitäts- / Schnellmodus | SSTM | siehe Tabelle unten |

gullicube (Node, 4 Threads, derselbe Build wie im Browser; SSTM):

| n | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Qualität (--time 16, ≈ 10–15 s, erster Download ≈ 30 MB Tabellen) | 119 | 169 | 257 | 329 | 448 | 563 | 678 | 833 | 981 | 1131 | 1408 |
| Schnell (--fast, ≈ 2–4 s, ≈ 0,5 MB Tabellen) | 168 | 281 | 402 | 571 | 695 | 972 | 1130 | 1495 | 1635 | 1950 | 2231 |

Geräte mit wenig Speicher (`navigator.deviceMemory` < 4 GB) sowie Smartphones / Tablets nutzen für n ≥ 5 standardmäßig den Schnellmodus; das Löser-Menü wechselt jederzeit zwischen Qualität und Tempo. Mehrfädiges WASM braucht Cross-Origin-Isolation: `deploy/_headers` setzt COOP / COEP / CORP.

**Statistik** (`js/analytics.js`, läuft nur auf cube-solver.org): Cloudflare Web Analytics ist cookielos und wird für alle geladen; GA4 bindet gtag.js erst ein, nachdem Besucher auf „Akzeptieren“ geklickt haben (Consent Mode v2, nur `analytics_storage` gewährt). Beide antworten mit `Cross-Origin-Resource-Policy: cross-origin` + CORS-Headern, daher bleibt `require-corp` bestehen und die Cross-Origin-Isolation bricht nicht. SPA-Routenwechsel (`history.replaceState`) werden automatisch vom SPA-Modus von CF und von der erweiterten Analyse von GA4 („Seitenänderungen auf Basis von Browserverlaufsereignissen“) gezählt; `page_view` nicht von Hand senden (sonst doppelte Zählung). Tests: `npm run test:analytics` (lokal, Beacons abgefangen) / `npm run test:analytics:live`. Die Statistik-IDs sind nicht im Repository: `tools/build-dist.js` liest `CF_BEACON_TOKEN` und `GA_MEASUREMENT_ID` aus der Umgebung (oder der von git ignorierten `.env`) und schreibt sie nur in `dist/js/analytics.js`; ohne sie gibt es keine Statistik, kein Einwilligungsbanner und kein Tracking. Alles bleibt im kostenlosen Kontingent für statische Assets von Cloudflare Workers (statische Dateien werden nicht als Worker-Anfragen berechnet; der Worker läuft nur für Seitenrouten).

**4×4-Reduktionslöser** (`puzzles/nxn/cube4.worker.js`, eigener Code; die Phasenidee folgt öffentlichen Methoden nach Art von Tsai / TPR, kein Code kopiert):
1. P1 (36 Züge): die R/L-farbigen Mitten nach R/L, exakte Distanztabelle C(24,8).
2. P2 (äußere Schichten + Rw/Lw + Uw2/Dw2/Fw2/Bw2): U/D-Mitten nach U/D, die Mitten der R/L-Achse in eine von 12 lösbaren Anordnungen, alle Flügel „orientiert“ (die 24 Flügelpositionen zerfallen unter der P3-Gruppe in zwei Klassen), gerade Flügelpermutation (beseitigt die OLL-Parität).
3. P3a (U D F B, R2 L2, breite Halbdrehungen): Mitten in die in P3b lösbare Teilmenge, die 8 Flügel der E-Schicht zurück in die E-Schicht, P3b lösbar.
4. P3b (U D, F2 B2 R2 L2, breite Halbdrehungen): Mitten gelöst, 12 Kanten gepaart, PLL-Parität beseitigt.
5. Der äquivalente 3×3 geht an Kociemba-Zweiphasen (cubejs).
Jede Phase nutzt IDA*; innerhalb des Zeitbudgets werden mehrere Kandidaten früherer Phasen probiert und der kürzeste behalten; benachbarte Züge derselben Achse werden zusammengefasst.

Tests: `node tests/nxn.test.js [4×4-Stichproben]` (Modelle 2–15 + 2×2 + 4×4), `node tests/gullicube.test.js 5,7,10,15 both`, live `node tests/live-nxn.js <URL>`.

### Vorberechnete Tabellen (4×4- und 3×3-Löser)

`npm run build:tables` schreibt `puzzles/nxn/cube4-tables.bin.gz` (1,61 MB, 7 Distanztabellen) und `puzzles/cube3/cubejs-prune.bin.gz` (0,89 MB, cubejs-Pruning-Tabellen). Format: `CLT1` + Headerlänge + JSON-Verzeichnis (Name / Typ / Länge / FNV-1a-Prüfsumme) + Rohbytes, gzip-komprimiert (`js/core/table-pack.js`). Der Worker lädt die Tabellen herunter, während er die Zugtabellen berechnet; der Browser entpackt mit `DecompressionStream`, prüft jede Tabelle und rechnet sie bei fehlgeschlagenem Download, abweichender Prüfsumme oder fehlender Browser-Unterstützung vor Ort. Nach einer Änderung am Tabellenaufbau eines Lösers `npm run build:tables` erneut ausführen (`tests/tables.test.js` vergleicht die Tabellen mit der Live-Berechnung).

## Freies Spiel (alle Puzzles)

Der Schalter „Lösen / Freies Spiel“ oben auf der Bühne (oder `?mode=play`).

| Aktion | Beschreibung |
|---|---|
| Sticker ziehen (Maus / Touch) | Dreht die Schicht dieses Stickers. Würfel: von den zwei Achsen der Seite diejenige, deren Projektion am besten zur Zugrichtung passt; Drehachse = Seitennormale × Zugrichtung; bei großen Würfeln dreht sich die gegriffene Schicht (innere Schichten 2R, 3R…, die Mittelschicht ungerader Größen M / E / S). Andere Puzzles nutzen `dragMoves` (unten). Bei Touch hat die Zeichenfläche `touch-action: none`, die Seite scrollt also nicht |
| Ins Leere ziehen | Dreht die Ansicht (Doppelklick setzt zurück) |
| Tastatur | `U D L R F B` (Umschalt = gegen den Uhrzeigersinn); Zahlenpräfix wählt die Schicht (`2` `R` → 2R); `w`-Präfix für breite Züge (`3` `w` `R` → 3Rw); `M E S` bei ungeraden Größen; Rotationen `x y z` (2×2 und 4×4+); Strg+Z / Rücktaste macht rückgängig, Strg+Y / Strg+Umschalt+Z wiederholt; Esc löscht das Präfix. Die Notation folgt dem aktuellen Griff (die obere Schicht auf dem Bildschirm ist immer U) |
| Formelfeld | Beliebige Formel (3Rw, 2R, M/E/S…), Enter führt sie aus, Schritt für Schritt animiert |
| Verdrehen | 2×2 / 3×3: gleichverteilter Zufallszustand (`CubeLab.play.randomState`); 4×4+: zufällige Züge; Pyraminx / Skewb: gleichverteilter Zufallszustand; Megaminx: WCA-Scramble (Pochmann) |
| Timer | Startet mit dem ersten Zug (keine Rotation) nach dem Verdrehen, stoppt beim Lösen; optionale WCA-Inspektion von 15 s (+2 nach 15 s, DNF nach 17 s) |
| Zugzahl | STM bis 3×3, BTM für 4×4+ (Rotationen zählen nicht); Pyraminx / Skewb VTM; Megaminx HTM |
| Rückgängig / wiederholen / zurücksetzen / aus dem aktuellen Zustand lösen | „Lösen“ wechselt zurück in den Lösungsmodus und löst den aktuellen Zustand, abgespielt wie gewohnt (dieser Versuch wird nicht gewertet) |

- Die Bestzeit je Puzzle wird in `localStorage` (`cubelab.best.<puzzle>`) gespeichert. Beim Lösen gibt es eine leichte Hervorhebung + Lösungsklang (folgt dem Effekte-Schalter) + eine Showcase-Drehung (folgt dem Schalter für automatische Drehung).
- Umsetzung: `js/core/play-core.js` (reine Logik, unter Node testbar), `Player.pushMove / popMove` (Animationswarteschlange, beschleunigt bei Rückstau, verliert nie Züge), `View3D.pick / dragTurn / setPlayMode` und die Modussteuerung in `app.js`. Der Graph wird Schritt für Schritt mit der 3D-Ansicht aktualisiert.

## Pyraminx und Skewb

Beide sind vollständige Plugins (`puzzles/twisty/`): Modell, Prüfung, 3D, Netz-Editor, Graph-Ansicht, streng optimaler Löser, freies Spiel, 12 Sprachen.

- **Modell** (`twisty-model.js`, gemeinsam für Seite / Worker / Node): Sticker werden aus der Geometrie erzeugt (Pyraminx: 9 Dreiecke je Seite; Skewb: 1 Quadrat + 4 Eckdreiecke je Seite); die Permutation jedes Zuges = Schwerpunkte und Normalen der Sticker der Schicht um 120° um die Achse drehen und die Sticker wiederfinden. WCA-Notation: Pyraminx `U L R B` (zwei Schichten) + `u l r b` (Spitzen); Skewb `R U L B` (R = Ecke unten-rechts-hinten, U = oben-links-hinten, L = unten-links-vorne, B = unten-links-hinten; die Ecke oben-rechts-vorne ist fest).
- **Optimaler Löser** (`twisty.worker.js?p=…`): Farbzustand → Teile + Orientierungen, nach Teileklasse in unabhängige Komponenten aufgeteilt; zuerst ermittelt eine BFS die erreichbare Menge und die Zugtabellen jeder Komponente, dann folgt eine vollständige BFS über den Produktraum (Distanztabelle `Uint8Array`); die Lösung steigt die Tabelle hinab, ihre Länge ist also genau der kürzeste Abstand (VTM: jede 120°-Drehung zählt 1). Die Spitzen des Pyraminx kommutieren mit allem und werden am Ende mit je 0 / 1 Zug gerichtet (weiterhin optimal).

| | Zustände (Kern) | Komponenten | Gemessene Gottes-Zahl | Tabelle | Aufbau (Node / Browser inkl. Worker-Start) | Lösen |
|---|---|---|---|---|---|---|
| Pyraminx | 933.120 (× 81 Spitzen = 75.582.720) | Kanten 11.520 × Achsmitten 81 | 11 (15 mit Spitzen) | 0,93 MB | ≈ 60 ms / ≈ 250 ms | ≈ 0,03 ms |
| Skewb | 3.149.280 | Mitten 360 × Ecken 8.748 | 11 (90 Antipoden) | 3,15 MB | ≈ 180 ms / ≈ 400 ms | ≈ 0,01 ms |

  Die Tabellen werden im Browser aufgebaut (schneller als der Download einer komprimierten Tabelle), es ist also kein zusätzliches Asset nötig. `tests/twisty.test.js` prüft: jeder Zug dreimal = Identität, hebt sich mit seiner Inversen auf, bewegt ganze Teile; Produkt der Komponenten = per BFS erreichbare Anzahl (Komponenten unabhängig); Anzahlen je Schicht; die Tabelle ist eine konsistente BFS-Schichtung; Zufallszustände werden gelöst, Länge = Tabellendistanz; der Prüfer weist gekippte Kanten / verdrehte Ecken / zwei vertauschte Teile / unmögliche Farbkombinationen / falschen Griff zurück.
- **3D**: Jedes Teil ist ein massives konvexes Polyeder (Form ∩ Halbräume der Schnittebenen: zwei je Ecke beim Pyraminx, 4 Ebenen durch die Mitte beim Skewb); eine Drehung dreht die ganze Schicht, Schnittflächen gleiten in ihrer eigenen Ebene und durchdringen sich nie; Sticker sind eingerückte, abgerundete Dreiecke / Quadrate.
- **Graph-Ansicht**: Die Sticker-Orbits jeder 120°-Drehung sind 3-Zyklen, gezeichnet als Kreis durch die 3 Knoten. Pyraminx-Knoten = Stickermitten im Netz (die Ecken U / L / R sind Mittelpunkte konzentrischer Kreisgruppen, die Kreise der B-Schicht umschließen das ganze Netz); der Skewb nutzt eine mittabstandstreue Azimutalprojektion von der Ecke DBL aus (die B-Schicht sind konzentrische Kreise, R / U / L bilden drei Blütenblätter).
- **Netz-Editor**: SVG-Polygone (Klicken / Ziehen zum Malen, Enter malt per Tastatur, Fehler rot umrandet). Pyraminx: Vorderseite mittig, linke / rechte Seite daneben, Unterseite darunter; Skewb: dasselbe Kreuz wie beim Würfel.
- **Freies Spiel**: Beim Ziehen eines Stickers wird unter den Kandidatenzügen derjenige gewählt, bei dem die Momentangeschwindigkeit dieses Stickers am besten zur Zugrichtung passt (gleiche Achse: der mit weniger Teilen, Ziehen an einer Spitze dreht also nur die Spitze); Tasten `U L R B` / `R U L B` (Umschalt = gegen den Uhrzeigersinn), beim Pyraminx `T` und dann ein Buchstabe = Spitze; Verdrehen = gleichverteilter Zufallszustand; Timer / Bestzeiten wie bei den Würfeln.
- **Kamera- / Fotoerkennung**: noch nicht unterstützt (dreieckige / rautenförmige Sticker brauchen neue Abtastraster und eine teilebeschränkte Farbzuordnung); diese Puzzles blenden den Scan-Reiter aus und bitten ums Malen.

## Megaminx

Ein vollständiges Plugin in `puzzles/megaminx/` (eigener Code, MIT): `megaminx-model.js` (Geometrie, Züge, Prüfung; gemeinsam für Seite / Worker / Node), `megaminx.js` (Plugin: 3D, Netz, Graph, Notation, freies Spiel), `megaminx-solver.js` (mehrphasiger Löser), `megaminx.worker.js` und `megaminx-ll.json` (Last-Layer-Tabelle, offline erzeugt von `tools/megaminx-ll-gen.js`).

- **Modell**: 12 Seiten × 11 Sticker = 132 Sticker, 62 Teile (12 Mitten, 30 Kanten, 20 Ecken). Seitenzüge `U F R L BL BR D DR DL B FL FR` mit `X X' X2 X2'` (72° / 144°, im Uhrzeigersinn von dieser Seite aus gesehen); WCA-Pochmann-Züge `R++ R-- D++ D--` (alles außer der L- / U-Schicht um 144° gedreht). Die Permutation jedes Zuges ergibt sich durch Drehen von Schwerpunkten und Normalen der Sticker. Prüfung: Farbanzahl, unmögliche oder doppelte Teile, verdrehte Ecken, gekippte Kanten, Permutationsparität und Anordnung der Mitten (`v.megaCenters`).
- **Löser** (mehrphasig, nicht optimal, HTM nach WCA-Art: jede Seitendrehung um 72° oder 144° zählt 1):
  1. Nach der Prüfung wird der Zustand gedreht / umbenannt, sodass die Mitten dem Standardschema folgen, und in Teilecodes umgewandelt (Ecke: Platz × 3 Orientierungen, Kante: Platz × 2).
  2. **F2L, Seite für Seite**: D, die fünf Ringseiten um D, dann vier der fünf oberen Seiten. Sind alle Teile einer Seite platziert, wird diese Seite nicht mehr gedreht – die Zugmenge S schrumpft, und unberührte Teile bleiben gelöst. Die neuen Teile jedes Schritts werden in kleine Gruppen aufgeteilt (≤ 3 Teile: eine Ecke und ihre benachbarten Kanten); jede Gruppe wird mit IDA* gelöst, dessen Heuristik das Maximum kleiner Distanztabellen für Teilegruppen ist (BFS unter dem aktuellen S, bei der ersten Nutzung aufgebaut und zwischengespeichert). Vor dem letzten Zwei-Seiten-Schritt kommt eine Kantenorientierungstabelle hinzu (wie die `<R,U>`-EO beim 3×3), damit sich dieser Schritt mit zwei Erzeugern beenden lässt. Ein Knotenbudget mit Wiederholungen (mit der nächsten Lösung der vorherigen Gruppe) hält die seltenen langsamen Fälle kurz.
  3. **Last Layer in zwei Looks** per Tabelle: Look 1 = Kantenpermutation + Kantenorientierung + Eckenorientierung (60 · 16 · 81 = 77.760 Zustände), Look 2 = Eckenpermutation × Kantenpermutation (3.600 Zustände). Der Generator durchsucht Drei-Seiten-Untergruppen `<U,X,Y>` per Meet-in-the-Middle (≤ 7 Züge je Seite) nach Folgen, die alle Teile außerhalb von U erhalten, behält je Wirkung die kürzeste samt ihren 5 U-Drehungen (39.059 Makros) und führt Dijkstra mit HTM-Kosten aus.
  4. Benachbarte Züge derselben Seite werden zusammengefasst (72°-Einheiten mod 5).
- **Gemessen** (Node, `tests/megaminx.test.js` / Benchmark): 1.000 Zufallszustände, alle gelöst: Ø 120,1 HTM (F2L 95,4 + LL 26,4), max. 135, min. 97; Lösezeit Ø 34 ms, max. 1,6 s. 500 Pochmann-Scrambles: Ø 119,7, max. 135, Ø 29 ms, max. 0,9 s. Im Browser dauert eine Lösung meist 2–20 ms plus Worker-Overhead; Worker-Start + Laden der Tabelle ≈ 170–200 ms. Die Zahlen stehen in `seo/site.config.json` und erscheinen auf den SEO-Seiten.
- **3D**: `view3d.geometry: 'poly'` mit dem Dodekaeder als `solid` und den 12 Schnittebenen als `cuts`; die Teile sind konvexe Polyeder.
- **Graph-Ansicht**: stereografische Projektion der Stickerpositionen vom Mittelpunkt von D aus (dieser eine Knoten ist ausgeblendet). Jede 72°-Seitendrehung bewegt ihre Sticker in 5-Zyklen, und die 5 Punkte jedes Zyklus liegen in der Projektion auf einem Kreis (die stereografische Projektion bildet Kreise auf Kreise ab); deshalb wird jeder Orbit als Umkreis seines 5-Zyklus gezeichnet: 39 Kreise, 131 sichtbare Knoten. Die weiße U-Seite liegt in der Mitte, die oberen Seiten darum herum, die unteren als große äußere Blütenblätter; Zoomen zeigt die dichte Mitte.
- **Netz-Editor**: zwei „Blüten“ aus je 6 Fünfecken nebeneinander (U mit ihren 5 Nachbarn, D mit ihren 5 Nachbarn), SVG-Polygone wie bei den anderen Formen.
- **Freies Spiel**: Ziehen (generisches `dragMoves`), Tasten `U F R L B D` sowie `I`=BL, `O`=BR, `J`=FL, `K`=FR, `N`=DL, `M`=DR (Umschalt = gegen den Uhrzeigersinn); HTM-Zählung; Verdrehen = WCA-Pochmann-Scramble mit 77 Zügen (7 Zeilen aus `R±± D±±` × 5 + `U`/`U'`); „aus dem aktuellen Zustand lösen“ funktioniert wie bei den anderen Puzzles.
- **Kamera-Scan**: ausgeblendet (`cameraPlan: null`).
- **Namen**: 五魔方 (zh), メガミンクス (ja), Мегаминкс (ru), ميغامينكس (ar), sonst Megaminx; im Menü direkt nach dem Skewb.

## SEO: eine statische Seite je Puzzle × Sprache

- **Eine einzige Konfiguration**: `seo/site.config.json` (`baseUrl` = die Produktions-URL; canonical / hreflang / Sitemap / OG werden daraus abgeleitet, eine neue Domain braucht also nur diese Änderung und einen Neubau) sowie die gemessenen Zugzahlen.
- **Routen** (`js/seo-routes.js`, gemeinsam für Browser und Build-Skripte): Englisch im Wurzelverzeichnis, andere Sprachen unter `/<sprache>/`; ein sauberer Pfad je Puzzle: `/` (Haupteinstieg, x-default), `/2x2-cube-solver/` … `/15x15-cube-solver/`, `/pyraminx-solver/`, `/skewb-solver/`, `/megaminx-solver/`; z. B. `/zh-hans/3x3-cube-solver/`, `/ja/megaminx-solver/`. Insgesamt 12 Sprachen × 18 = 216 Seiten.
- **Texte**: `seo/lang/<code>.json` (12 Sprachen, Titel nach lokalen Suchgewohnheiten verfasst), je Puzzletyp als Vorlage und mit den gemessenen Zugzahlen gefüllt.
- **Build**: `npm run build:seo` (`tools/build-seo.js`) schreibt die englische Startseite zwischen die `<!--seo:*-->`-Marker in `index.html` und alle anderen Seiten nach `seo/out/`, dazu `robots.txt`, `sitemap.xml` (mit xhtml:link-Alternativen) und `manifest.webmanifest`; den vom HTML referenzierten js/css-Dateien wird `?v=<Inhalts-Hash>` angehängt. Icons und OG-Bilder (1200×630, eines je Puzzle, aus echten 3D- + Graph-Screenshots): `npm run build:seo-images` (braucht den lokalen Server; `OG_ONLY=root,megaminx` beschränkt auf einzelne Bilder).
- **Je Seite**: title / description / canonical / 13 hreflang-Links (inkl. x-default) / OG / Twitter-Card / Icons / Manifest / JSON-LD (WebSite, WebApplication (kostenlos, ohne Bewertungen), WebPage, BreadcrumbList, HowTo, FAQPage, wortgleich mit dem sichtbaren Text), ein statisches `<h1>`, crawlbarer Fließtext (Bedienung, Löser und gemessene Zugzahlen, Notation, Erklärung des Graphen, FAQ, Links zu allen Puzzles), ein `<noscript>`-Hinweis.
- **Laufzeit** (`js/seo-nav.js`): Seiten wählen Sprache und Puzzle über `<html data-page-lang data-page-puzzle>` vor; ein Wechsel von Puzzle oder Sprache in der App wechselt per `history.replaceState` zur passenden sauberen URL und übernimmt Titel / Meta / JSON-LD / Fließtext von der vorgerenderten Seite – ohne Neuladen und ohne Zustandsverlust. Die Wurzel `/` folgt weiterhin der Browsersprache / der letzten Wahl.
- **Alte Links**: `/?puzzle=…`, `/?n=…`, `/?lang=…` erhalten von `deploy/worker.js` eine 301 auf die neuen Pfade (läuft nur für Seitenrouten; statische Assets sind über `run_worker_first` ausgenommen; ohne `?lang` kommt die Sprache aus Accept-Language, mit `Vary: Accept-Language`); andere Parameter (`mode`, `hold`, `start`) bleiben erhalten. Lokal ohne Worker schreibt `seo-nav.js` die Adresse im Client um.
- **Tests**: `node tests/seo.test.js` (statisch: eindeutige title/description auf allen 216 Seiten, canonical, vollständige hreflang-Querverweise, JSON-LD parsebar und deckungsgleich mit dem sichtbaren Inhalt, keine Bewertungen, Größen der OG-Bilder, interne Links, Sitemap/robots/Manifest, Worker-Weiterleitungen); `npm run test:seo:live` prüft jede Live-Seite.

## Ausführen

```bash
cd cube-solver
npm install
npm start                        # node tests/serve.js 8765 (sends COOP/COEP headers)
# open http://localhost:8765/
```

> Die Kamera braucht einen **sicheren Kontext**: `https://` oder `http://localhost`. Über eine LAN-IP (z. B. `http://192.168.x.x`) deaktiviert der Browser die Kamera; dann „Foto hochladen“ verwenden.
> Web Worker laufen nicht unter `file://`; die Seite immer über einen HTTP-Server öffnen.

## Tests

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

E2E-Abdeckung: Zufalls-Scramble → Lösen → bis zum Ende abspielen (6 einfarbige Cluster im Graphen, jede 3D-Seite einfarbig), Player-Sprung / zurück / vor, Malen und jede Art von Prüffehler, Formeleingabe, Erkennung von 6 synthetischen Fotos (Farbstiche, Lichtverläufe, Rauschen, Spiegelungen), der Fake-Kamera-Pfad von Chromium, mobiles Layout und Screenshots. `tests/graph-preview.html` ist eine eigenständige Seite zum Debuggen von Graph-Layouts (`?scr=Formel&mv=R&e=0.5`). `node tests/compare-ref.js` schreibt Vergleiche nebeneinander mit den Referenzbildern (`ref/f14`, `f07`, `f01`) nach `screenshots/compare-*.png`; `tests/graph-pixel.html` zeichnet den Graphen mit der Pixelabbildung des Referenzbildes für pixelgenaue Überlagerungen.

## Verzeichnisstruktur

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

## Erweiterungspunkte (Architektur)

Die Kernmodule (Eingabe, Graph-Ansicht, 3D, Player, Scan, Löser-Client) arbeiten **nur** über das mit `CubeLab.registerPuzzle(def)` registrierte Puzzle-Objekt und enthalten keine 3×3-spezifische Logik. Ein neues Puzzle kommt nach `puzzles/<id>/` und implementiert die folgende Schnittstelle.

### Puzzle-Schnittstelle

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

Bei der Registrierung ergänzt der Kern die Standardfunktionen `parse / format / apply / inverse / isSolved`, die von jedem Zug gedrehten Teile (bestimmt durch `layer`), die **Graph-Spuren** (`P.tracks`) und die Stickerpfade jedes Zuges (`moves[tok].paths`).

Optionale Felder, die die anderen Formen nutzen: `trackMode: 'cycles'` (Spuren = Zyklen der Permutationen der Basiszüge), `netLayout.polys` (Netz aus SVG-Polygonen), `view3d.geometry: 'poly'` + `solid` / `cuts` / `core` (konvexe Polyederteile), `dragMoves` (generisches Ziehen), `playKeys` / `playMetric` / `metricTitle`, `hints` (i18n-Schlüssel der Hinweise), `randomState(rnd)` (gleichverteilter Zufallszustand), `randomScramble()`, `nameKey`; `cameraPlan: null` blendet den Scan-Reiter aus, ohne `holds` wird das Griff-Menü ausgeblendet.

### Graph-Spuren und Bewegung (`CubeLab.buildTracks` + `GraphView`)

Für jeden Basiszug: die bewegten Sticker nehmen, nach „Stickernormale · Achse“ gruppieren (beim 3×3: „die 8 der Seite“ und „die 12 an den Seiten“), jede Gruppe nach dem Winkel um die Achse zu einem geschlossenen Ring sortieren; eine Drehung um θ rückt die Sticker auf dem Ring um `θ/2π × n` Plätze vor, gegengeprüft mit `perm`.

`graphLayout()` des Plugins liefert die 2D-Knotenpositionen und optional `circles: [{id, cx, cy, r}]`:
- liegen alle Knoten einer Seitenspur auf einem Kreis, bewegen sie sich **entlang dieses Kreises** (gleiche Richtung für die ganze Spur; die Richtung mit dem kürzesten Gesamtweg beim Basiszug, umgekehrt für die Inverse) mit Farbspuren;
- Knoten einer „Seiten“-Spur werden in Polarkoordinaten um den Mittelknoten der Seite interpoliert (der Cluster dreht sich als Ganzes);
- ohne Kreise wird ein geschlossener Spline durch die Knoten verwendet, sodass sich andere Puzzles auch ohne handgemachtes Layout darstellen lassen.

**3×3-Layout** (die `GL`-Konfiguration in `puzzles/cube3/cube3.js`): Die drei Gruppen konzentrischer Kreise sind die Achsen y (U/E/D), z (F/S/B) und x (R/M/L), zentriert auf den Ecken eines gleichseitigen Dreiecks (oben, unten links, unten rechts), Radien 1,3922 / 1,7696 / 2,1469 (Umkreisradius des Dreiecks = 1). Diese Werte sind eine Kleinste-Quadrate-Anpassung an **alle 54 Knoten** in einem hochaufgelösten Referenzbild (RMS-Residuum 0,2 px); Knotenradius 0,184, Strich 0,048, Spurbreite 0,063 und Hervorhebungsbreite 0,076 stammen aus Pixelmessungen am selben Bild. Mit der Pixelabbildung des Referenzbildes gezeichnet und zu 50 % überlagert, decken sich Kreise und Knoten nahezu exakt (`tests/graph-pixel.html`). Die Sticker der Seite X liegen auf den Schnittpunkten der Kreisgruppen der beiden Achsen außer der Normalen von X; die zwei Schnittbereiche nehmen ein Paar gegenüberliegender Seiten auf. Die Richtung Schicht→Radius (`sign`) und der Schnittbereich jeder Seite (`upper`) wurden erschöpfend geprüft (64 Kombinationen): Jede der sechs Seitendrehungen ist eine zyklische Verschiebung von 12 Knoten auf einem einzigen Kreis. Mittelschichtzüge M/E/S sind echte Züge (in `moves` aus der Geometrie erzeugt; derselbe Generator reproduziert die 6 Seitenpermutationen exakt, geprüft in einem Unit-Test) und laufen auf dem mittleren Kreis ihrer Gruppe. Der Löser gibt nur Seitenzüge aus.

**Bogenführung (Bild für Bild mit dem Referenzvideo abgeglichen)**: Die 12 Knoten jedes Kreises gehören zu 4 Seitensektoren mit Abständen von etwa 60°/60°/60°/180°. Mit „kürzester Gesamtweg“ als Richtungsregel bewegt eine 90°-Drehung 9 Sticker über Bögen von ≈ 60° und **die 3 Sticker eines Sektors über den leeren 180°-Bogen** (z. B. der obere Bogen des äußeren Kreises, der große linke Bogen der Gruppe unten links). Das Referenzvideo macht genau dasselbe (`screenshots/compare-motion.png`, zweite Zeile). Die Lage der Sektoren ist durch „gelöstes Layout = Referenz f14“ festgelegt, daher macht keine andere Zuordnung alle Bögen kurz.

**Timing und Easing (aus der Bewegungsenergie des Referenzvideos bei 60 fps gemessen)**:
- Einzelschritt-Easing `easeInOutQuad` (angepasst an die mittlere Geschwindigkeitskurve von 15 Drehungen, RMS 0,076; sine 0,155, cubic 0,193);
- fortlaufende Wiedergabe hat eine Hüllkurve „langsamer Start – Beschleunigung – langsames Ende“: erster Schritt ≈ 0,85 s, Mitte 0,48 s, letzter ≈ 1,0 s, nur ≈ 0,07 s Pause zwischen den Schritten (`CubeLab.tempo(i, n)`, `Player.baseMs = 480`, `gapMs = 67`; ein einzelnes „Vor“ dauert fest 0,55 s);
- die Hervorhebung des aktiven Kreises blendet in den ersten 8 % einer Drehung ein und in den letzten 16 % aus; Farbspuren ziehen sich vom Knoten nach hinten (Phase des Schweifs `ease(1.6t − 0.6)`) und verschwinden am Ende;
- nach dem Lösen ≈ 1,2 s Stillstand, dann eine Showcase-Drehung von 2,0 s.

### Griffe (Blickwinkel der Notation)

Interner Zustand, Löser und Formeleingabe verwenden immer den WCA-Griff (Weiß U, Grün F). Ein Plugin kann `holds` bereitstellen: Jeder Griff liefert eine Gesamtausrichtung in 3D und eine Umbenennungstabelle für die Notation. Der 3×3-Standard „Gelb oben, Grün vorne“ = der Standardgriff um 180° um die Vorne–hinten-Achse gedreht (z2): `U↔D`, `R↔L`, `F/B` unverändert, `M→M′`, `E→E′`, `S` unverändert (Unit-Tests prüfen jeden einzeln: Achse × Winkel des internen Zuges, gedreht um die Ausrichtung, ist gleich Achse × Winkel des angezeigten Zuges). Lösungstext, aktueller Schritt im Player, Schrittliste und Beschreibungen verwenden die Notation des aktuellen Griffs, die obere Schicht auf dem Bildschirm heißt also U.

### 3D-Stil und Ansicht

- `view3d.style: 'plastic'`: hellgrauer Körper + weiße Paneele (feine hellgraue Fugen) + abgerundete, flach eingefärbte Sticker (unbeleuchtet, dieselben Farben wie im Graphen) + weiche Schattierung des Körpers; ohne diese Einstellung der klassische flache Stil mit schwarzem Körper.
- `stickerCorners: [oben links, oben rechts, unten rechts, unten links]`: Eckradien der Sticker (asymmetrische Blattformen möglich); `stickerColors` überschreibt die 3D-Stickerfarben.
- `orientation` (Euler-Winkel, vom aktuellen Griff überschrieben) + `camera: { fov, dir }`: Die 3×3-Standardansicht entspricht dem Referenzvideo – Gelb (D) oben, Grün (F) links, Orange (L) rechts –, also den drei Clustern des mittleren Dreiecks im Graphen. Perspektive FOV 24°, etwa 25° Erhebung, per Pixelvergleich mit den Referenzbildern eingestellt.
- `frame: { width, height, dx, dy }`: Bildausschnitt (Größe und Versatz von Puzzle / Graph in ihren Hälften), deckungsgleich mit dem Referenzvideo auf 0,5 % genau.
- `autoRotate`: Das Puzzle schwingt beim Abspielen leicht; erreicht die Wiedergabe das Ende in gelöstem Zustand, ruht es `showcaseDelay` (1,2 s), dreht sich in `showcaseMs` (2,0 s) einmal und kehrt zur Startansicht zurück (wie am Ende des Referenzvideos). Der Schalter „Automatisch drehen“ im Player schaltet das ab; Drehen per Ziehen und Zurücksetzen per Doppelklick funktionieren immer.

### Sound (`js/core/audio.js`, `CubeLab.SoundEngine`)

Alles wird live mit der Web Audio API synthetisiert; es gibt keine Audiodateien und keine Fremd-Assets.
- **Autoplay-Richtlinie**: Beim Laden der Seite kein `AudioContext`; er wird beim ersten `pointerdown / keydown / touchstart` erzeugt und per `resume()` gestartet. Standardmäßig Effekte an, Musik aus; „Effekte / Musik / Lautstärke“ werden in `localStorage` gespeichert (`cubelab.sfx / cubelab.music / cubelab.vol`). War die Musik vor dem Neuladen an, wartet sie auf die nächste Nutzergeste. Ohne Web Audio ist jeder Aufruf wirkungslos und die Bedienelemente sind deaktiviert.
- **Drehklang v3** (Hook `Player.onMove(phase, tok, durMs)`): neu gebaut auf Basis einer Analyse dreier echter 3×3-Aufnahmen (siehe `user-sounds/ANALYSIS.md`, `screenshots/sound-compare.png`). Eine echte Drehung = eine 120–200 ms lange Folge gebündelter Kunststoffkörner (≈ eines je 5 ms), die kurze Körpermoden anregen: Hauptspitze 0,86–1,1 kHz („hohl / holzig“) + 500 Hz, 1,55, 2,8, 4,1 kHz, Nachklingen nur 3–6 ms, kaum Wummern unter 300 Hz; die Energie steigt bis zum lautesten Klick beim Einrasten der Schicht, gefolgt von einem 70–100 ms abklingenden Rasseln. Synthese: in JS erzeugte Korn-Ereignisse → 10 Resonatoren zweiter Ordnung (jedes Korn regt zufällig andere Moden an) + eine feine Mikrokorn-Schicht + sehr leichte Reibung + eine breitbandige direkte Flanke; der Einrast-Klick liegt auf dem Ende der Animation, langsame Wiedergabe konzentriert den Klang am Ende, 180°-Drehungen bekommen bei T/2 einen Rastklick, Mittelschichten klingen weicher und dunkler; jeder Klang wird in 1,7–3,3 ms berechnet. Verglichen mit echten Aufnahmen (Material von SpaceJoe / Pixabay, gleiche Analyse): Schwerpunkt 2141 Hz gegenüber 2135 / 2077 Hz, Crestfaktor 20,7 gegenüber 21,1 / 17,6 dB, Flachheit 0,24 gegenüber 0,25 / 0,32, 18,5 gegenüber 17,8 / 12,0 Körner je 100 ms, Abweichung der Terzbandform ≈ 2 dB. Es werden keine Audiodateien veröffentlicht (die Aufnahmen dienten nur der Analyse; Lizenzen in `vendor/sounds/LICENSE.txt`). Schutz bei schneller Wiedergabe: mindestens 50 ms zwischen Drehklängen; kürzere Drehungen sind leiser und haben weniger Körner; Ziehen an der Zeitleiste stoppt nicht beendete Drehklänge sofort.
- **Gelöst**: ein aufsteigendes Dur-Arpeggio + Akkord (wenn die Wiedergabe den letzten Schritt in gelöstem Zustand erreicht); ein weicher aufsteigender Schimmer zu Beginn der **Showcase-Drehung** (`View3D.onShowcaseStart`).
- **Oberfläche**: Mal-Klicks (Tonhöhe folgt der Farbe, beim Malen per Ziehen gedrosselt), Signale für erfolgreiche Aufnahme / erfolgreichen Upload (drei Töne, wenn alle sechs Seiten fertig sind).
- **Hintergrundmusik**: 72 BPM, eine viertaktige Schleife Cmaj9 – Am9 – Fmaj9 – G6sus; verstimmte, tiefpassgefilterte Sägezähne als Fläche + pentatonische Arpeggien (deterministisch pseudozufällig), Feedback-Delay für Raum; vorausschauende Planung (alle 150 ms 0,6 s eingeplant), nahtlose Schleife, Ein- und Ausblenden, sehr leise.
- Pegel (Lautstärke 0,8, offline gemessen): eine einzelne Drehung bei 1× erreicht Spitzen um 0,31–0,36, bei echter Handgeschwindigkeit (130 ms) etwa 0,22, das Lösungs-Arpeggio etwa 0,23, die Hintergrundmusik Spitzen um −22 dBFS. Hörproben (nur lokal): `screenshots/sound-demo-turns.wav`, `sound-demo-turns-v3.wav`, `sound-demo-sfx.wav`, `sound-demo-music.wav`.

### Sprachen (`js/i18n/`, `CubeLab.i18n`)

- **Sprachen und Reihenfolge**: English, 简体中文, 繁體中文, Español, العربية, Português, Bahasa Indonesia, Bahasa Melayu, Français, 日本語, Русский, Deutsch (im Menü alle gleichrangig, ohne Gruppen).
- **Texte**: eine Datei je Sprache, `js/i18n/<code>.js`, die `CubeLab.i18n.register(code, {key: text})` aufruft; `en.js` ist die Haupttabelle, fehlende Schlüssel fallen auf Englisch zurück und werden in `CubeLab.i18n.missing` erfasst. HTML nutzt `data-i18n` / `data-i18n-title` / `data-i18n-aria` / `data-i18n-placeholder`; dynamischer Text nutzt `I.bind(el, key, params)` und wird beim Sprachwechsel neu gezeichnet.
- **Formatierung**: eine ICU-Teilmenge – `{name}`, `{n, plural, =0 {…} one {# …} few {…} many {…} other {…}}` (`Intl.PluralRules`), `{ms, unit, millisecond}`, `{x, number}` (`Intl.NumberFormat`). Französisch erhält automatisch geschützte Leerzeichen vor `: ; ! ? « »`; Spanisch verwendet ¡ ¿. Die Zugnotation behält in allen Sprachen die Standardbuchstaben (U D L R F B M E S, ′ 2).
- **Erkennungsreihenfolge**: `?lang=xx` → `localStorage['cubelab.lang']` → `navigator.languages` (zh-TW/HK/MO/Hant → traditionell, andere zh → vereinfacht) → English. Setzt `<html lang dir>`, den Titel und die Meta-Description.
- **RTL**: Arabisch spiegelt die ganze Seite (logische CSS-Eigenschaften); 3D-Zeichenfläche, Graph, Zeitleiste / Player-Bedienung, Schrittleiste, Notation, Formeleingabe und Zahlen bleiben LTR (`dir="ltr"`).
- **Typografie**: CJK / Arabisch nutzen eigene Schrift-Stacks, größere Zeilenhöhe und keine Laufweite; Deutsch / Russisch aktivieren `hyphens:auto`, und Schaltflächen dürfen umbrechen statt überzulaufen.
- **Sprache hinzufügen**: einen Eintrag in `LANGS` in `i18n.js` ergänzen, `js/i18n/<code>.js` anlegen und in `index.html` einbinden, dann `node tests/i18n.unit.test.js` ausführen.

### Löser-Adapter

```js
solvers: [
  { id: 'kociemba', name: '…', available: true,
    workerUrl: 'puzzles/cube3/kociemba.worker.js',
    encode: state => payload },          // runs on the main thread; throws a localized error for invalid states
  { id: 'optimal-ida', name: 'IDA* optimal (planned)', available: false }
]
```

Worker-Protokoll:

```
→ { id, cmd: 'init' }                      ← { id, ok: true, ms }
→ { id, cmd: 'solve', payload }            ← { id, ok: true, moves: ['R', "U'", ...], optimal?: bool, label?, note?, ms }
                                           ← { id, ok: false, error }
```

Ein Puzzle kann mehrere Löser haben; das Menü listet sie automatisch auf, `available: false` erscheint als „geplant“. Ein echter optimaler Löser (z. B. Korfs IDA* mit Muster-Datenbanken für Ecken / Kanten) braucht nur einen neuen, in `solvers` registrierten Worker. Ein Worker kann `optimal: false` mit einem i18n-Schlüssel `label` / `note` zurückgeben (der Megaminx tut das), den die Oberfläche neben der Zugzahl anzeigt.

### Weitere Ansichten

Der Player (`CubeLab.Player`) steuert beliebig viele Ansichten; eine Ansicht implementiert nur `setState(state)` und `animate(tok, e, fromState, t)` (e = geglätteter Fortschritt 0–1, t = rohe Zeitphase), optional `highlight(tok, state)`. Eine neue Visualisierung (z. B. ein Cayley-Graph oder ein Zyklendiagramm) braucht nur diese Methoden.

## Bibliotheken von Drittanbietern

- [gullicube](https://github.com/rokicki/gullicube) (Tomas Rokicki, unter der Option MPL-2.0 verwendet, Quellcode unverändert; siehe `vendor/gullicube/NOTICE.md`)
- [cubejs](https://github.com/ldez/cubejs) (MIT) – Kociembas Zweiphasen-Algorithmus. `vendor/solve.js` trägt einen kleinen Patch (`vendor/solve.js.cubelab.patch`): eine optionale Frist für `solve(maxDepth, deadline)` und eine Ausnahme statt eines null-Absturzes, wenn nichts gefunden wird – genutzt für die iterative Verkürzung im Zeitbudget.
- [three.js](https://threejs.org/) r160 (MIT) – 3D-Darstellung (UMD-Build `three.min.js`; die Konsole warnt, dass dieser Build veraltet ist, was hier keine Rolle spielt).
- Die Löser für Pyraminx, Skewb und Megaminx sowie die Last-Layer-Tabelle des Megaminx sind eigener Code und eigene Daten des Projekts (MIT). Es wird kein GPL-Code und kein Code von csTimer oder TPR verwendet.

## Bekannte Einschränkungen

- Pyraminx / Skewb / Megaminx: noch keine Kamera- / Fotoerkennung. Beim Malen das Puzzle so halten, wie die Hinweise es sagen (Pyraminx: das Achsenteil ohne Gelb oben, das ohne Grün hinten; Skewb: die weiß-grün-rote Ecke oben-rechts-vorne; Megaminx: die Mitten müssen das Standardfarbschema bilden), sonst erscheint ein Griff- / Mittenfehler.
- Megaminx-Lösungen sind **nicht optimal** (Ø ≈ 120 HTM, bis ≈ 135); ein gelegentlich schwerer Zustand braucht bis zu ≈ 1,6 s; die 1,8 MB große Last-Layer-Tabelle (`megaminx-ll.json`, bei der Übertragung komprimiert) wird beim Start des Megaminx-Lösers einmal heruntergeladen.
- Die Kamera braucht HTTPS oder localhost; die Erkennung hängt vom Licht ab – bei starken Spiegelungen oder gelblichem Licht das Ergebnis im Netz korrigieren (die Mittenfarben dienen der Kalibrierung und vertragen einen gewissen Farbstich).
- Der Scan setzt das Standardfarbschema (Weiß gegenüber Gelb, Grün gegenüber Blau, Rot gegenüber Orange) und den geführten Griff voraus; die Mitten sind im Editor fest.
- Der 3×3-Löser gibt nur Seitenzüge aus (HTM); die Lösungen im Referenzvideo enthalten Mittelschichtzüge, daher weicht die Schrittfolge für denselben Zustand vom Video ab.
- Der Zweiphasen-Algorithmus liefert nahezu optimale Lösungen (meist 19–21 Züge); nur Zustände mit ≤ 8 Zügen erhalten eine beweisbar optimale Lösung. Ein echter optimaler Löser auf dem Niveau der „Gottes-Zahl“ bleibt als Erweiterung offen.
