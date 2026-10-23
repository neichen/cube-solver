[English](DEVELOPMENT.md) · [简体中文](DEVELOPMENT.zh-Hans.md) · [繁體中文](DEVELOPMENT.zh-Hant.md) · [日本語](DEVELOPMENT.ja.md) · [Español](DEVELOPMENT.es.md) · [Português](DEVELOPMENT.pt.md) · **Français** · [Deutsch](DEVELOPMENT.de.md) · [Русский](DEVELOPMENT.ru.md) · [العربية](DEVELOPMENT.ar.md) · [Bahasa Indonesia](DEVELOPMENT.id.md) · [Bahasa Melayu](DEVELOPMENT.ms.md)

# Cube Solver Lab (CubeLab) · Notes pour les développeurs

> Notes détaillées pour les développeurs. La version anglaise ([DEVELOPMENT.md](DEVELOPMENT.md)) fait foi ; cette traduction la suit. Pour la présentation du projet, l’exécution, les tests, le déploiement, la licence et la confidentialité, voir le [README](../README.fr.md).
> `ref/` (images de la vidéo de référence) et `screenshots/` (captures produites par les tests), cités plus bas, ne sont pas dans le dépôt ; les tests créent les dossiers de captures quand ils s’exécutent.

Un solveur de casse-tête entièrement front-end (HTML/CSS/JS statiques, sans back-end). Sa particularité est la **vue graphe** : à côté du casse-tête 3D se trouve un « graphe de permutation » où chaque autocollant est un nœud. Pour le 3×3, ce sont **trois groupes de cercles concentriques** (chaque groupe de 3 cercles = les 3 couches d’un axe ; les centres forment un triangle équilatéral, d’où un motif de pétales à symétrie d’ordre 3), avec les 54 nœuds aux intersections. À chaque mouvement, les cercles de la couche concernée s’assombrissent, les 12 autocollants latéraux parcourent les arcs (avec des traînées qui s’estompent dans la couleur de l’autocollant) et les 9 autocollants de la face tournée pivotent dans leur groupe, en synchronisation exacte avec la rotation 3D. Un cube mélangé mêle les couleurs ; un cube résolu forme 6 groupes compacts d’une seule couleur.

## Fonctionnalités

| Module | Description |
| --- | --- |
| Peinture | Patron + palette, clic / glisser pour peindre, compteur de couleurs, réinitialiser / aléatoire / effacer |
| Saisie de formule | Saisissez un mélange (`R U R' U2 …`, tranches `M E S` acceptées), appliqué depuis l’état résolu dans la prise WCA (blanc dessus, vert devant) |
| Scan par caméra | Image en direct `getUserMedia` + grille + aperçu de la reconnaissance en direct ; ordre guidé des 6 faces (avec indications d’orientation) |
| Envoi de photo | Chaque face peut utiliser une photo envoyée ; un curseur « taille de la grille » aligne les autocollants |
| Reconnaissance des couleurs | RVB médian à l’intérieur de chaque case → CIE Lab. Pendant le scan : aperçu en direct face aux couleurs typiques (les tailles impaires se calibrent avec les centres mesurés). **Après les six faces** (`js/core/color-cluster.js`) : k-means à capacités égales sur les 6n² cases (exactement n² par couleur, luminance sous-pondérée) → noms de couleurs en essayant les 6! affectations (fixés par les centres sur les tailles impaires) → décodage sous contraintes par orbite de pièces avec l’algorithme hongrois (les coins doivent être l’un des 8 triplets orientés valides, arêtes / ailes des paires valides, chaque orbite de centres un quota par couleur) → nouvelle estimation des centres de couleur et nouvelle résolution. Fonctionne aussi pour les tailles paires (sans centres fixes) |
| Validation | Messages localisés (12 langues, règles de pluriel Intl) : autocollants non peints, centres en double, nombre de couleurs, pièces impossibles, pièces en double, coin vrillé, arête retournée, parité (deux pièces échangées) |
| Résolution | Dans un Web Worker. 3×3 : ① BFS bidirectionnel (optimal prouvé jusqu’à 8 mouvements) ② Kociemba en deux phases (cubejs) avec raccourcissement itératif dans un budget de temps, en général 19–21 mouvements. Autres casse-tête : voir plus bas |
| Lecteur | Lecture / pause / précédent / suivant / début / fin / vitesse / frise déplaçable / clic sur n’importe quelle étape ; touches : Espace, ←, → ; tempo et accélération mesurés sur la vidéo de référence |
| Son | Synthétisé en direct avec Web Audio (aucun fichier audio) : son de rotation réaliste, arpège de résolution, balayage de présentation, clics de peinture, signaux de capture ; musique de fond générée en option ; « effets / musique / volume » dans la barre du lecteur, enregistrés localement |
| Prise | « Jaune dessus, vert devant » (par défaut, comme la vidéo de référence) / « Blanc dessus, vert devant (WCA) » : change à la fois l’orientation 3D et la notation, si bien que U est toujours la couche du haut à l’écran |
| Mode démo | « D’abord mélanger, puis résoudre » : joue le mélange depuis l’état résolu, puis la solution |
| Adaptatif | Sur téléphone, la 3D et le graphe s’empilent ; les commandes passent à la ligne |
| Langues | 12 langues (English, 简体中文, 繁體中文, Español, العربية, Português, Bahasa Indonesia, Bahasa Melayu, Français, 日本語, Русский, Deutsch), RTL complet pour l’arabe ; icône globe en haut à droite, choix enregistré localement |

## N×N (2×2 – 15×15)

Le menu « Casse-tête » en haut propose 2×2 … 15×15 (aussi `?n=7`). Toutes les vues (peinture du patron, formule, grille N×N de la caméra, 3D three.js, le graphe à trois groupes de n cercles concentriques avec zoom / déplacement, le lecteur) sont générées pour chaque taille.

| Taille | Solveur | Métrique | Mesuré (mélanges aléatoires, tous vérifiés résolus) |
| --- | --- | --- | --- |
| 2×2 | Solveur optimal maison (table de distances complète, 3 674 160 états, BFS) | HTM | 100 résolutions : moyenne 8,87, max. 10 ; table ≈ 0,3 s, résolution < 1 ms |
| 3×3 | BFS ≤ 8 optimal + Kociemba en deux phases avec raccourcissement | HTM | en général 19–21 mouvements |
| 4×4 | Méthode de réduction maison (ci-dessous) ; gullicube en option | OBTM | 12 résolutions (Node) : moyenne 56,8, max. 64 ; tables ≈ 3,2 s ; résolution moyenne 6,9 s (la plus lente 16 s) |
| 5×5 – 15×15 | gullicube (T. Rokicki, MPL-2.0) compilé en WebAssembly multithread ; mode qualité / rapide | SSTM | voir le tableau ci-dessous |

gullicube (Node, 4 threads, même build que le navigateur ; SSTM) :

| n | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Qualité (--time 16, ≈ 10–15 s, premier téléchargement ≈ 30 Mo de tables) | 119 | 169 | 257 | 329 | 448 | 563 | 678 | 833 | 981 | 1131 | 1408 |
| Rapide (--fast, ≈ 2–4 s, ≈ 0,5 Mo de tables) | 168 | 281 | 402 | 571 | 695 | 972 | 1130 | 1495 | 1635 | 1950 | 2231 |

Les appareils à faible mémoire (`navigator.deviceMemory` < 4 Go) et les téléphones / tablettes passent par défaut en mode rapide pour n ≥ 5 ; le menu du solveur bascule qualité / vitesse à tout moment. Le WASM multithread exige l’isolation cross-origin : `deploy/_headers` définit COOP / COEP / CORP.

**Mesure d’audience** (`js/analytics.js`, uniquement sur cube-solver.org) : Cloudflare Web Analytics n’utilise pas de cookies et se charge pour tout le monde ; GA4 n’injecte gtag.js qu’après un clic du visiteur sur « Accepter » (Consent Mode v2, seul `analytics_storage` est accordé). Les deux répondent avec `Cross-Origin-Resource-Policy: cross-origin` + en-têtes CORS, donc `require-corp` reste et l’isolation cross-origin n’est pas cassée. Les changements de route de la SPA (`history.replaceState`) sont comptés automatiquement par le mode SPA de CF et la mesure améliorée de GA4 (« changements de page basés sur les événements d’historique du navigateur ») ; n’envoyez pas `page_view` à la main (double comptage). Tests : `npm run test:analytics` (local, balises interceptées) / `npm run test:analytics:live`. Les identifiants de mesure ne sont pas dans le dépôt : `tools/build-dist.js` lit `CF_BEACON_TOKEN` et `GA_MEASUREMENT_ID` dans l’environnement (ou le `.env` ignoré par git) et ne les écrit que dans `dist/js/analytics.js` ; sans eux, aucune mesure, aucun bandeau de consentement, aucun suivi. Tout reste dans le quota gratuit des ressources statiques de Cloudflare Workers (les fichiers statiques ne sont pas facturés comme requêtes Worker ; le Worker ne s’exécute que pour les routes de page).

**Solveur 4×4 par réduction** (`puzzles/nxn/cube4.worker.js`, code maison ; l’idée des phases suit les méthodes publiques de type Tsai / TPR, aucun code copié) :
1. P1 (36 mouvements) : les centres de couleur R/L vers R/L, table de distances exacte C(24,8).
2. P2 (couches externes + Rw/Lw + Uw2/Dw2/Fw2/Bw2) : centres U/D vers U/D, les centres de l’axe R/L dans l’une des 12 dispositions résolubles, toutes les ailes « orientées » (les 24 positions d’ailes forment deux classes sous le groupe P3), permutation paire des ailes (supprime la parité OLL).
3. P3a (U D F B, R2 L2, demi-tours larges) : centres dans le sous-ensemble résoluble en P3b, les 8 ailes de la tranche E de retour dans la tranche E, P3b résoluble.
4. P3b (U D, F2 B2 R2 L2, demi-tours larges) : centres résolus, 12 arêtes appariées, parité PLL supprimée.
5. Le 3×3 équivalent passe à Kociemba en deux phases (cubejs).
Chaque phase utilise IDA* ; dans le budget de temps, plusieurs candidats des phases précédentes sont essayés et le plus court est gardé ; les mouvements adjacents du même axe sont fusionnés.

Tests : `node tests/nxn.test.js [échantillons 4×4]` (modèles 2–15 + 2×2 + 4×4), `node tests/gullicube.test.js 5,7,10,15 both`, en ligne `node tests/live-nxn.js <URL>`.

### Tables précalculées (solveurs 4×4 et 3×3)

`npm run build:tables` écrit `puzzles/nxn/cube4-tables.bin.gz` (1,61 Mo, 7 tables de distances) et `puzzles/cube3/cubejs-prune.bin.gz` (0,89 Mo, tables d’élagage de cubejs). Format : `CLT1` + longueur de l’en-tête + répertoire JSON (nom / type / longueur / somme FNV-1a) + octets bruts, compressé en gzip (`js/core/table-pack.js`). Le worker télécharge les tables pendant qu’il calcule les tables de mouvements ; le navigateur décompresse avec `DecompressionStream`, vérifie chaque table et revient au calcul sur place si le téléchargement échoue, si une somme diffère ou si le navigateur ne le permet pas. Après avoir modifié la structure des tables d’un solveur, relancez `npm run build:tables` (`tests/tables.test.js` compare les tables au calcul en direct).

## Jeu libre (tous les casse-tête)

L’interrupteur « Résoudre / Jeu libre » en haut de la scène (ou `?mode=play`).

| Action | Description |
|---|---|
| Glisser un autocollant (souris / tactile) | Tourne la couche de cet autocollant. Cubes : parmi les deux axes de la face, celui dont la projection correspond le mieux au glissement ; axe = normale de la face × direction du glissement ; sur les grands cubes, la couche saisie tourne (couches internes 2R, 3R…, la couche centrale des tailles impaires M / E / S). Les autres casse-tête utilisent `dragMoves` (ci-dessous). En tactile, le canevas a `touch-action: none`, la page ne défile donc pas |
| Glisser dans le vide | Fait tourner la vue (double-clic pour réinitialiser) |
| Clavier | `U D L R F B` (Maj = sens antihoraire) ; un préfixe numérique choisit la couche (`2` `R` → 2R) ; préfixe `w` pour les mouvements larges (`3` `w` `R` → 3Rw) ; `M E S` sur les tailles impaires ; rotations `x y z` (2×2 et 4×4+) ; Ctrl+Z / Retour arrière pour annuler, Ctrl+Y / Ctrl+Maj+Z pour rétablir ; Échap efface le préfixe. La notation suit la prise actuelle (la couche du haut à l’écran est toujours U) |
| Champ de formule | N’importe quelle formule (3Rw, 2R, M/E/S…), Entrée l’exécute, animée pas à pas |
| Mélanger | 2×2 / 3×3 : état aléatoire uniforme (`CubeLab.play.randomState`) ; 4×4+ : mouvements aléatoires ; Pyraminx / Skewb : état aléatoire uniforme ; Megaminx : mélange WCA (Pochmann) |
| Chronomètre | Démarre au premier mouvement (hors rotation) après un mélange, s’arrête à la résolution ; inspection WCA de 15 s en option (+2 après 15 s, DNF après 17 s) |
| Nombre de mouvements | STM jusqu’au 3×3, BTM pour 4×4+ (rotations non comptées) ; Pyraminx / Skewb VTM ; Megaminx HTM |
| Annuler / rétablir / réinitialiser / résoudre depuis l’état actuel | « Résoudre » revient au mode résolution et résout l’état actuel, joué comme d’habitude (cette tentative n’est pas chronométrée) |

- Le meilleur temps de chaque casse-tête est stocké dans `localStorage` (`cubelab.best.<casse-tête>`). La résolution déclenche une légère mise en valeur + un son de résolution (selon l’interrupteur des effets) + un tour de présentation (selon l’interrupteur de rotation automatique).
- Implémentation : `js/core/play-core.js` (logique pure, testable sous Node), `Player.pushMove / popMove` (animation en file d’attente, qui accélère en cas de retard et ne perd jamais de mouvement), `View3D.pick / dragTurn / setPlayMode`, et le contrôle de mode dans `app.js`. Le graphe se met à jour pas à pas avec la vue 3D.

## Pyraminx et Skewb

Tous deux sont des plugins complets (`puzzles/twisty/`) : modèle, validation, 3D, éditeur de patron, vue graphe, solveur strictement optimal, jeu libre, 12 langues.

- **Modèle** (`twisty-model.js`, partagé par la page / le worker / Node) : les autocollants sont générés à partir de la géométrie (Pyraminx : 9 triangles par face ; Skewb : 1 carré + 4 triangles de coin par face) ; la permutation de chaque mouvement = tourner de 120° autour de l’axe les centroïdes et normales des autocollants de la couche et retrouver les autocollants. Notation WCA : Pyraminx `U L R B` (deux couches) + `u l r b` (pointes) ; Skewb `R U L B` (R = coin bas-droite-arrière, U = haut-gauche-arrière, L = bas-gauche-avant, B = bas-gauche-arrière ; le coin haut-droite-avant est fixe).
- **Solveur optimal** (`twisty.worker.js?p=…`) : état des couleurs → pièces + orientations, séparées par classe de pièce en composantes indépendantes ; un BFS trouve d’abord l’ensemble atteignable et les tables de mouvements de chaque composante, puis un BFS complet sur l’espace produit (table de distances `Uint8Array`) ; la solution descend la table, sa longueur est donc exactement la distance minimale (VTM : chaque rotation de 120° compte 1). Les pointes du Pyraminx commutent avec tout et sont réglées à la fin avec 0 / 1 mouvement chacune (toujours optimal).

| | États (noyau) | Composantes | Nombre de Dieu mesuré | Table | Construction (Node / navigateur avec démarrage du worker) | Résolution |
|---|---|---|---|---|---|---|
| Pyraminx | 933 120 (× 81 pointes = 75 582 720) | arêtes 11 520 × centres axiaux 81 | 11 (15 avec les pointes) | 0,93 Mo | ≈ 60 ms / ≈ 250 ms | ≈ 0,03 ms |
| Skewb | 3 149 280 | centres 360 × coins 8 748 | 11 (90 antipodes) | 3,15 Mo | ≈ 180 ms / ≈ 400 ms | ≈ 0,01 ms |

  Les tables sont construites dans le navigateur (plus rapide que de télécharger une table compressée), aucune ressource supplémentaire n’est donc nécessaire. `tests/twisty.test.js` vérifie : chaque mouvement au cube = identité, s’annule avec son inverse, déplace des pièces entières ; produit des composantes = nombre atteignable par BFS (composantes indépendantes) ; comptes par couche ; la table est une stratification BFS cohérente ; les états aléatoires se résolvent avec une longueur = distance de la table ; le validateur rejette arêtes retournées / coins vrillés / deux pièces échangées / combinaisons de couleurs impossibles / mauvaise prise.
- **3D** : chaque pièce est un polyèdre convexe plein (forme ∩ demi-espaces des plans de coupe : deux par sommet sur le Pyraminx, 4 plans passant par le centre sur le Skewb) ; une rotation fait tourner toute la couche, les faces de coupe glissent dans leur propre plan et ne se croisent jamais ; les autocollants sont des triangles / carrés arrondis et rentrés.
- **Vue graphe** : les orbites d’autocollants de chaque rotation de 120° sont des 3-cycles, dessinés comme le cercle passant par les 3 nœuds. Nœuds du Pyraminx = centres des autocollants sur le patron (les sommets U / L / R sont les centres de groupes de cercles concentriques, les cercles de la couche B entourent tout le patron) ; le Skewb utilise une projection azimutale équidistante depuis le coin DBL (la couche B forme des cercles concentriques, R / U / L trois pétales).
- **Éditeur de patron** : polygones SVG (clic / glisser pour peindre, Entrée peint au clavier, erreurs entourées de rouge). Pyraminx : face avant au centre, faces gauche / droite sur les côtés, base en dessous ; Skewb : la même croix que le cube.
- **Jeu libre** : glisser un autocollant choisit, parmi les mouvements candidats, celui où la vitesse instantanée de cet autocollant correspond le mieux au glissement (même axe : celui qui a le moins de pièces, donc glisser une pointe ne tourne que la pointe) ; touches `U L R B` / `R U L B` (Maj = sens antihoraire), sur le Pyraminx `T` puis une lettre = pointe ; mélange = état aléatoire uniforme ; chronomètre / meilleurs temps comme pour les cubes.
- **Reconnaissance caméra / photo** : pas encore prise en charge (les autocollants triangulaires / losanges demandent de nouvelles grilles d’échantillonnage et une coloration contrainte par les pièces) ; ces casse-tête masquent l’onglet de scan et invitent à peindre.

## Megaminx

Un plugin complet dans `puzzles/megaminx/` (code maison, MIT) : `megaminx-model.js` (géométrie, mouvements, validation ; partagé par la page / le worker / Node), `megaminx.js` (plugin : 3D, patron, graphe, notation, jeu libre), `megaminx-solver.js` (solveur multiphase), `megaminx.worker.js` et `megaminx-ll.json` (table de la dernière couche, générée hors ligne par `tools/megaminx-ll-gen.js`).

- **Modèle** : 12 faces × 11 autocollants = 132 autocollants, 62 pièces (12 centres, 30 arêtes, 20 coins). Mouvements de face `U F R L BL BR D DR DL B FL FR` avec `X X' X2 X2'` (72° / 144°, sens horaire vu depuis cette face) ; mouvements WCA Pochmann `R++ R-- D++ D--` (tout sauf la couche L / U tourné de 144°). La permutation de chaque mouvement est obtenue en tournant les centroïdes et normales des autocollants. Validation : nombre de couleurs, pièces impossibles ou en double, coins vrillés, arêtes retournées, parité de la permutation et disposition des centres (`v.megaCenters`).
- **Solveur** (multiphase, non optimal, HTM façon WCA : toute rotation de face de 72° ou 144° compte 1) :
  1. Après validation, l’état est tourné / réétiqueté pour que les centres suivent le schéma standard, puis converti en codes de pièces (coin : emplacement × 3 orientations, arête : emplacement × 2).
  2. **F2L, face par face** : D, les cinq faces de l’anneau autour de D, puis quatre des cinq faces supérieures. Quand toutes les pièces d’une face sont placées, cette face n’est plus tournée : l’ensemble de mouvements S se réduit et les pièces non touchées restent résolues. Les nouvelles pièces de chaque étape sont réparties en petits groupes (≤ 3 pièces : un coin et ses arêtes voisines) ; chaque groupe est résolu par IDA*, dont l’heuristique est le maximum de petites tables de distances de groupes de pièces (BFS sous le S courant, construites à la première utilisation et mises en cache). Avant la dernière étape à deux faces s’ajoute une table d’orientation des arêtes (comme l’EO `<R,U>` du 3×3), pour que cette étape se termine avec deux générateurs. Un budget de nœuds avec nouvelles tentatives (en prenant la solution suivante du groupe précédent) garde courts les rares cas lents.
  3. **Dernière couche en deux temps** par table : temps 1 = permutation des arêtes + orientation des arêtes + orientation des coins (60 · 16 · 81 = 77 760 états), temps 2 = permutation des coins × permutation des arêtes (3 600 états). Le générateur explore les sous-groupes à trois faces `<U,X,Y>` par rencontre au milieu (≤ 7 mouvements de chaque côté) à la recherche de séquences qui conservent toutes les pièces hors de U, garde la plus courte pour chaque effet ainsi que ses 5 rotations en U (39 059 macros), puis lance Dijkstra avec un coût HTM.
  4. Les mouvements adjacents d’une même face sont fusionnés (unités de 72° modulo 5).
- **Mesuré** (Node, `tests/megaminx.test.js` / benchmark) : 1 000 états aléatoires, tous résolus : moyenne 120,1 HTM (F2L 95,4 + dernière couche 26,4), max. 135, min. 97 ; temps moyen 34 ms, max. 1,6 s. 500 mélanges Pochmann : moyenne 119,7, max. 135, moyenne 29 ms, max. 0,9 s. Dans le navigateur, une résolution prend en général 2–20 ms plus le surcoût du worker ; démarrage du worker + chargement de la table ≈ 170–200 ms. Ces chiffres sont inscrits dans `seo/site.config.json` et affichés sur les pages SEO.
- **3D** : `view3d.geometry: 'poly'` avec le dodécaèdre comme `solid` et les 12 plans de coupe comme `cuts` ; les pièces sont des polyèdres convexes.
- **Vue graphe** : projection stéréographique des positions des autocollants depuis le centre de D (ce nœud est masqué). Chaque rotation de face de 72° déplace ses autocollants en 5-cycles, et les 5 points de chaque cycle sont sur un même cercle dans la projection (la projection stéréographique envoie les cercles sur des cercles) ; chaque orbite est donc dessinée comme le cercle circonscrit de son 5-cycle : 39 cercles, 131 nœuds visibles. La face U blanche est au milieu, les faces supérieures autour, les faces inférieures forment de grands pétales extérieurs ; le zoom montre le centre dense.
- **Éditeur de patron** : deux « fleurs » de 6 pentagones côte à côte (U et ses 5 voisines, D et ses 5 voisines), polygones SVG comme pour les autres formes.
- **Jeu libre** : glisser (`dragMoves` générique), touches `U F R L B D` plus `I`=BL, `O`=BR, `J`=FL, `K`=FR, `N`=DL, `M`=DR (Maj = sens antihoraire) ; comptage HTM ; mélange = mélange WCA Pochmann de 77 mouvements (7 lignes de `R±± D±±` × 5 + `U`/`U'`) ; « résoudre depuis l’état actuel » fonctionne comme pour les autres casse-tête.
- **Scan par caméra** : masqué (`cameraPlan: null`).
- **Noms** : 五魔方 (zh), メガミンクス (ja), Мегаминкс (ru), ميغامينكس (ar), Megaminx ailleurs ; dans le menu, juste après le Skewb.

## SEO : une page statique par casse-tête × langue

- **Configuration unique** : `seo/site.config.json` (`baseUrl` = l’URL de production ; canonical / hreflang / sitemap / OG en découlent, un nouveau domaine ne demande donc que ce changement et une régénération) ainsi que les nombres de mouvements mesurés.
- **Routes** (`js/seo-routes.js`, partagé par le navigateur et les scripts de génération) : l’anglais à la racine, les autres langues sous `/<langue>/` ; un chemin propre par casse-tête : `/` (entrée principale, x-default), `/2x2-cube-solver/` … `/15x15-cube-solver/`, `/pyraminx-solver/`, `/skewb-solver/`, `/megaminx-solver/` ; par ex. `/zh-hans/3x3-cube-solver/`, `/ja/megaminx-solver/`. Au total 12 langues × 18 = 216 pages.
- **Textes** : `seo/lang/<code>.json` (12 langues, titres rédigés selon les habitudes de recherche locales), avec des modèles par type de casse-tête remplis avec les nombres mesurés.
- **Génération** : `npm run build:seo` (`tools/build-seo.js`) écrit la page racine anglaise entre les marqueurs `<!--seo:*-->` de `index.html` et toutes les autres pages dans `seo/out/`, plus `robots.txt`, `sitemap.xml` (avec alternatives xhtml:link) et `manifest.webmanifest` ; il ajoute `?v=<hachage du contenu>` aux js/css référencés par le HTML. Icônes et images OG (1200×630, une par casse-tête, à partir de vraies captures 3D + graphe) : `npm run build:seo-images` (nécessite le serveur local ; `OG_ONLY=root,megaminx` le limite à certaines images).
- **Par page** : title / description / canonical / 13 liens hreflang (x-default compris) / OG / carte Twitter / icônes / manifest / JSON-LD (WebSite, WebApplication (gratuite, sans notes), WebPage, BreadcrumbList, HowTo, FAQPage, identique mot pour mot au texte visible), un `<h1>` statique, un texte indexable (mode d’emploi, solveur et nombres mesurés, notation, explication du graphe, FAQ, liens vers tous les casse-tête), une note `<noscript>`.
- **À l’exécution** (`js/seo-nav.js`) : les pages présélectionnent la langue et le casse-tête via `<html data-page-lang data-page-puzzle>` ; changer de casse-tête ou de langue dans l’application passe à l’URL propre correspondante avec `history.replaceState` et reprend titre / meta / JSON-LD / corps depuis la page pré-rendue, sans rechargement ni perte d’état. La racine `/` suit toujours la langue du navigateur / le dernier choix.
- **Anciens liens** : `/?puzzle=…`, `/?n=…`, `/?lang=…` reçoivent une 301 vers les nouveaux chemins depuis `deploy/worker.js` (exécuté seulement pour les routes de page ; les ressources statiques sont exclues par `run_worker_first` ; sans `?lang`, la langue vient d’Accept-Language, avec `Vary: Accept-Language`) ; les autres paramètres (`mode`, `hold`, `start`) sont conservés. En local, sans le worker, `seo-nav.js` réécrit l’adresse côté client.
- **Tests** : `node tests/seo.test.js` (statique : title/description uniques sur les 216 pages, canonical, liens hreflang croisés complets, JSON-LD analysable et conforme au contenu visible, pas de notes, tailles des images OG, liens internes, sitemap/robots/manifest, redirections du worker) ; `npm run test:seo:live` vérifie chaque page en ligne.

## Exécution

```bash
cd cube-solver
npm install
npm start                        # node tests/serve.js 8765 (sends COOP/COEP headers)
# open http://localhost:8765/
```

> La caméra exige un **contexte sécurisé** : `https://` ou `http://localhost`. Via une IP du réseau local (par ex. `http://192.168.x.x`), le navigateur désactive la caméra ; utilisez « Envoyer une photo ».
> Les Web Workers ne fonctionnent pas en `file://` ; ouvrez toujours le site via un serveur HTTP.

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

Couverture E2E : mélange aléatoire → résolution → lecture jusqu’à la fin (6 groupes unicolores dans le graphe, chaque face 3D d’une seule couleur), déplacement / précédent / suivant du lecteur, peinture et tous les types d’erreurs de validation, saisie de formule, reconnaissance de 6 photos synthétiques (dominantes de couleur, dégradés de lumière, bruit, reflets), le chemin de fausse caméra de Chromium, mise en page mobile et captures. `tests/graph-preview.html` est une page autonome pour déboguer la disposition du graphe (`?scr=formule&mv=R&e=0.5`). `node tests/compare-ref.js` écrit des comparaisons côte à côte avec les images de référence (`ref/f14`, `f07`, `f01`) dans `screenshots/compare-*.png` ; `tests/graph-pixel.html` dessine le graphe avec la correspondance de pixels de l’image de référence pour des superpositions au pixel près.

## Arborescence

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

## Points d’extension (architecture)

Les modules centraux (saisie, vue graphe, 3D, lecteur, scan, client du solveur) fonctionnent **uniquement** via l’objet Puzzle enregistré par `CubeLab.registerPuzzle(def)` et ne contiennent aucune logique propre au 3×3. Un nouveau casse-tête va dans `puzzles/<id>/` et implémente l’interface ci-dessous.

### Interface Puzzle

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

À l’enregistrement, le cœur complète les `parse / format / apply / inverse / isSolved` par défaut, les pièces tournées par chaque mouvement (déterminées par `layer`), les **pistes du graphe** (`P.tracks`) et les trajets d’autocollants de chaque mouvement (`moves[tok].paths`).

Champs facultatifs utilisés par les autres formes : `trackMode: 'cycles'` (pistes = cycles des permutations des mouvements de base), `netLayout.polys` (patron en polygones SVG), `view3d.geometry: 'poly'` + `solid` / `cuts` / `core` (pièces polyédriques convexes), `dragMoves` (glisser générique), `playKeys` / `playMetric` / `metricTitle`, `hints` (clés i18n des indications), `randomState(rnd)` (état aléatoire uniforme), `randomScramble()`, `nameKey` ; `cameraPlan: null` masque l’onglet de scan, et sans `holds` le menu de prise est masqué.

### Pistes du graphe et mouvement (`CubeLab.buildTracks` + `GraphView`)

Pour chaque mouvement de base : on prend les autocollants déplacés, on les groupe par « normale de l’autocollant · axe » (sur le 3×3 : « les 8 de la face » et « les 12 des côtés »), on trie chaque groupe par angle autour de l’axe en un anneau fermé ; une rotation de θ fait avancer les autocollants de l’anneau de `θ/2π × n` cases, vérifié contre `perm`.

Le `graphLayout()` du plugin fournit les positions 2D des nœuds et, en option, `circles: [{id, cx, cy, r}]` :
- si tous les nœuds d’une piste latérale sont sur un cercle, ils se déplacent **le long de ce cercle** (même sens pour toute la piste ; le sens au plus court trajet total sous le mouvement de base, inversé pour l’inverse) avec des traînées colorées ;
- les nœuds d’une piste de « face » sont interpolés en coordonnées polaires autour du nœud central de la face (le groupe tourne d’un bloc) ;
- sans cercles, une spline fermée passant par les nœuds est utilisée, si bien que d’autres casse-tête peuvent être visualisés sans disposition faite à la main.

**Disposition du 3×3** (la configuration `GL` dans `puzzles/cube3/cube3.js`) : les trois groupes de cercles concentriques sont les axes y (U/E/D), z (F/S/B) et x (R/M/L), centrés sur les sommets d’un triangle équilatéral (haut, bas gauche, bas droite), rayons 1,3922 / 1,7696 / 2,1469 (rayon circonscrit du triangle = 1). Ces valeurs sont un ajustement aux moindres carrés sur **les 54 nœuds** d’une image de référence haute résolution (résidu RMS 0,2 px) ; le rayon des nœuds 0,184, le trait 0,048, la largeur de piste 0,063 et la largeur de surbrillance 0,076 proviennent de mesures de pixels sur la même image. Rendus avec la correspondance de pixels de l’image de référence et superposés à 50 %, cercles et nœuds coïncident presque parfaitement (`tests/graph-pixel.html`). Les autocollants de la face X se trouvent aux intersections des groupes de cercles des deux axes autres que la normale de X ; les deux zones d’intersection accueillent une paire de faces opposées. Le sens couche→rayon (`sign`) et la zone d’intersection de chaque face (`upper`) ont été vérifiés exhaustivement (64 combinaisons) : chacune des six rotations de face est un décalage cyclique de 12 nœuds sur un seul cercle. Les tranches M/E/S sont de vrais mouvements (générés à partir de la géométrie dans `moves` ; le même générateur reproduit exactement les 6 permutations de face, vérifié par un test unitaire) et parcourent le cercle du milieu de leur groupe. Le solveur ne produit que des mouvements de face.

**Tracé des arcs (vérifié image par image sur la vidéo de référence)** : les 12 nœuds de chaque cercle appartiennent à 4 secteurs de face espacés d’environ 60°/60°/60°/180°. Avec le « plus court trajet total » comme règle de sens, une rotation de 90° déplace 9 autocollants sur des arcs de ≈ 60° et **les 3 autocollants d’un secteur traversent l’arc vide de 180°** (par ex. l’arc supérieur du cercle extérieur, le grand arc gauche du groupe en bas à gauche). La vidéo de référence fait exactement la même chose (`screenshots/compare-motion.png`, deuxième ligne). Les positions des secteurs sont fixées par « disposition résolue = référence f14 », donc aucune autre affectation ne rend tous les arcs courts.

**Temps et accélération (mesurés sur l’énergie de mouvement à 60 i/s de la vidéo de référence)** :
- accélération par pas `easeInOutQuad` (ajustée sur la courbe de vitesse moyenne de 15 rotations, RMS 0,076 ; sine 0,155, cubic 0,193) ;
- la lecture continue suit une enveloppe « départ lent – accélération – fin lente » : premier pas ≈ 0,85 s, milieu 0,48 s, dernier ≈ 1,0 s, seulement ≈ 0,07 s entre deux pas (`CubeLab.tempo(i, n)`, `Player.baseMs = 480`, `gapMs = 67` ; un « suivant » isolé dure toujours 0,55 s) ;
- la surbrillance du cercle actif apparaît pendant les premiers 8 % d’une rotation et disparaît pendant les derniers 16 % ; les traînées colorées s’étendent vers l’arrière depuis le nœud (phase de queue `ease(1.6t − 0.6)`) et s’effacent à la fin ;
- après la résolution, ≈ 1,2 s d’immobilité, puis un tour de présentation de 2,0 s.

### Prises (point de vue de la notation)

L’état interne, les solveurs et la saisie de formules utilisent toujours la prise WCA (blanc U, vert F). Un plugin peut fournir `holds` : chaque prise donne une orientation 3D globale et une table de renommage de la notation. La prise par défaut du 3×3, « jaune dessus, vert devant » = la prise standard tournée de 180° autour de l’axe avant–arrière (z2) : `U↔D`, `R↔L`, `F/B` inchangés, `M→M′`, `E→E′`, `S` inchangé (des tests unitaires vérifient chacun : l’axe × angle du mouvement interne, tourné par l’orientation, est égal à l’axe × angle du mouvement affiché). Le texte de la solution, le pas courant du lecteur, la liste des pas et les descriptions utilisent la notation de la prise actuelle, si bien que la couche du haut à l’écran s’appelle U.

### Style 3D et vue

- `view3d.style: 'plastic'` : corps gris clair + panneaux blancs (fins joints gris clair) + autocollants arrondis de couleur unie (non éclairés, mêmes couleurs que le graphe) + ombrage doux sur le corps ; sans lui, le style plat classique à corps noir.
- `stickerCorners: [haut-gauche, haut-droite, bas-droite, bas-gauche]` : rayons des coins des autocollants (formes de feuille asymétriques possibles) ; `stickerColors` remplace les couleurs 3D des autocollants.
- `orientation` (angles d’Euler, remplacés par la prise actuelle) + `camera: { fov, dir }` : la vue par défaut du 3×3 correspond à la vidéo de référence — jaune (D) en haut, vert (F) à gauche, orange (L) à droite —, soit les trois groupes du triangle central du graphe. Perspective FOV 24°, environ 25° d’élévation, réglée par comparaison de pixels avec les images de référence.
- `frame: { width, height, dx, dy }` : cadrage (taille et décalage du casse-tête / du graphe dans leurs demi-panneaux), conforme à la vidéo de référence à 0,5 % près.
- `autoRotate` : le casse-tête oscille légèrement pendant la lecture ; quand la lecture atteint la fin dans un état résolu, il reste immobile `showcaseDelay` (1,2 s), fait un tour en `showcaseMs` (2,0 s) et revient à la vue de départ (comme à la fin de la vidéo de référence). L’interrupteur « rotation automatique » du lecteur la désactive ; la rotation par glisser et la réinitialisation par double-clic fonctionnent toujours.

### Son (`js/core/audio.js`, `CubeLab.SoundEngine`)

Tout est synthétisé en direct avec la Web Audio API ; il n’y a ni fichier audio ni ressource tierce.
- **Politique de lecture automatique** : pas d’`AudioContext` au chargement de la page ; il est créé et `resume()` au premier `pointerdown / keydown / touchstart`. Effets activés et musique désactivée par défaut ; « effets / musique / volume » sont stockés dans `localStorage` (`cubelab.sfx / cubelab.music / cubelab.vol`). Si la musique était active avant un rechargement, elle attend le prochain geste de l’utilisateur. Sans Web Audio, chaque appel ne fait rien et les commandes sont désactivées.
- **Son de rotation v3** (crochet `Player.onMove(phase, tok, durMs)`) : refait à partir de l’analyse de trois enregistrements réels de 3×3 (voir `user-sounds/ANALYSIS.md`, `screenshots/sound-compare.png`). Une vraie rotation = un train de 120–200 ms de grains de plastique groupés (≈ un toutes les 5 ms) excitant de courts modes du corps : pic principal 0,86–1,1 kHz (« creux / boisé ») + 500 Hz, 1,55, 2,8, 4,1 kHz, résonance de 3–6 ms seulement, presque aucun « boum » sous 300 Hz ; l’énergie monte jusqu’au clic le plus fort quand la couche se cale, suivi d’un cliquetis de 70–100 ms qui s’éteint. Synthèse : événements de grains générés en JS → 10 résonateurs du second ordre (chaque grain excite des modes différents au hasard) + une fine couche de micro-grains + un très léger frottement + une attaque directe large bande ; le clic de calage est aligné sur la fin de l’animation, la lecture lente concentre le son à la fin, les rotations de 180° ajoutent un clic de cran à T/2, les tranches sont plus douces et plus sombres ; chaque son est calculé en 1,7–3,3 ms. Comparé à des enregistrements réels (sons de SpaceJoe / Pixabay, même analyse) : centroïde 2141 Hz contre 2135 / 2077 Hz, facteur de crête 20,7 contre 21,1 / 17,6 dB, planéité 0,24 contre 0,25 / 0,32, 18,5 contre 17,8 / 12,0 grains par 100 ms, écart de forme en tiers d’octave ≈ 2 dB. Aucun fichier audio n’est publié (les enregistrements n’ont servi qu’à l’analyse ; licences dans `vendor/sounds/LICENSE.txt`). Protection en lecture rapide : au moins 50 ms entre deux sons de rotation ; les rotations plus courtes sont plus discrètes et comptent moins de grains ; déplacer la frise arrête aussitôt les sons de rotation inachevés.
- **Résolu** : un arpège majeur ascendant + accord (quand la lecture atteint le dernier pas dans un état résolu) ; un doux scintillement ascendant au début du **tour de présentation** (`View3D.onShowcaseStart`).
- **Interface** : clics de peinture (la hauteur suit la couleur, limités pendant la peinture au glisser), signaux de capture / d’envoi réussi (trois notes quand les six faces sont faites).
- **Musique de fond** : 72 BPM, boucle de quatre mesures Cmaj9 – Am9 – Fmaj9 – G6sus ; dents de scie désaccordées filtrées en passe-bas comme nappe + arpèges pentatoniques (pseudo-aléatoires déterministes), délai à réinjection pour l’espace ; planification anticipée (0,6 s en file toutes les 150 ms), boucle sans coupure, fondus d’entrée et de sortie, niveau très bas.
- Niveaux (volume 0,8, mesurés hors ligne) : une rotation isolée à 1× culmine vers 0,31–0,36, à vitesse réelle de main (130 ms) vers 0,22, l’arpège de résolution vers 0,23, la musique de fond culmine vers −22 dBFS. Démos (en local uniquement) : `screenshots/sound-demo-turns.wav`, `sound-demo-turns-v3.wav`, `sound-demo-sfx.wav`, `sound-demo-music.wav`.

### Langues (`js/i18n/`, `CubeLab.i18n`)

- **Langues et ordre** : English, 简体中文, 繁體中文, Español, العربية, Português, Bahasa Indonesia, Bahasa Melayu, Français, 日本語, Русский, Deutsch (toutes au même niveau dans le menu, sans groupes).
- **Chaînes** : un fichier par langue, `js/i18n/<code>.js`, qui appelle `CubeLab.i18n.register(code, {key: text})` ; `en.js` est la table maîtresse, les clés manquantes retombent sur l’anglais et sont consignées dans `CubeLab.i18n.missing`. Le HTML utilise `data-i18n` / `data-i18n-title` / `data-i18n-aria` / `data-i18n-placeholder` ; le texte dynamique utilise `I.bind(el, key, params)` et se redessine au changement de langue.
- **Formatage** : un sous-ensemble d’ICU — `{name}`, `{n, plural, =0 {…} one {# …} few {…} many {…} other {…}}` (`Intl.PluralRules`), `{ms, unit, millisecond}`, `{x, number}` (`Intl.NumberFormat`). Le français reçoit automatiquement des espaces insécables avant `: ; ! ? « »` ; l’espagnol utilise ¡ ¿. La notation des mouvements garde les lettres standard dans toutes les langues (U D L R F B M E S, ′ 2).
- **Ordre de détection** : `?lang=xx` → `localStorage['cubelab.lang']` → `navigator.languages` (zh-TW/HK/MO/Hant → traditionnel, autres zh → simplifié) → English. Définit `<html lang dir>`, le titre et la meta description.
- **RTL** : l’arabe met toute la page en miroir (propriétés logiques CSS) ; le canevas 3D, le graphe, la frise / les commandes du lecteur, la bande des pas, la notation, la saisie de formule et les nombres restent LTR (`dir="ltr"`).
- **Typographie** : CJK / arabe utilisent leurs propres piles de polices, un interligne plus grand et pas d’espacement des lettres ; allemand / russe activent `hyphens:auto`, et les boutons peuvent passer à la ligne au lieu de déborder.
- **Ajouter une langue** : ajoutez une entrée à `LANGS` dans `i18n.js`, créez `js/i18n/<code>.js` et incluez-le dans `index.html`, puis lancez `node tests/i18n.unit.test.js`.

### Adaptateurs de solveur

```js
solvers: [
  { id: 'kociemba', name: '…', available: true,
    workerUrl: 'puzzles/cube3/kociemba.worker.js',
    encode: state => payload },          // runs on the main thread; throws a localized error for invalid states
  { id: 'optimal-ida', name: 'IDA* optimal (planned)', available: false }
]
```

Protocole du worker :

```
→ { id, cmd: 'init' }                      ← { id, ok: true, ms }
→ { id, cmd: 'solve', payload }            ← { id, ok: true, moves: ['R', "U'", ...], optimal?: bool, label?, note?, ms }
                                           ← { id, ok: false, error }
```

Un casse-tête peut avoir plusieurs solveurs ; le menu les liste automatiquement, et `available: false` s’affiche « prévu ». Ajouter un vrai solveur optimal (par ex. IDA* de Korf avec des bases de motifs de coins / d’arêtes) ne demande qu’un nouveau worker enregistré dans `solvers`. Un worker peut renvoyer `optimal: false` avec une clé i18n `label` / `note` (c’est le cas du Megaminx), que l’interface affiche à côté du nombre de mouvements.

### Autres vues

Le lecteur (`CubeLab.Player`) pilote un nombre quelconque de vues ; une vue n’implémente que `setState(state)` et `animate(tok, e, fromState, t)` (e = progression lissée 0–1, t = phase temporelle brute), et éventuellement `highlight(tok, state)`. Une nouvelle visualisation (par ex. un graphe de Cayley ou un diagramme de cycles) n’a besoin que de ces méthodes.

## Bibliothèques tierces

- [gullicube](https://github.com/rokicki/gullicube) (Tomas Rokicki, utilisé sous l’option MPL-2.0, source non modifiée ; voir `vendor/gullicube/NOTICE.md`)
- [cubejs](https://github.com/ldez/cubejs) (MIT) — algorithme de Kociemba en deux phases. `vendor/solve.js` porte un petit correctif (`vendor/solve.js.cubelab.patch`) : une échéance facultative pour `solve(maxDepth, deadline)` et une exception au lieu d’un plantage sur null quand rien n’est trouvé, utilisés pour le raccourcissement itératif dans le budget de temps.
- [three.js](https://threejs.org/) r160 (MIT) — rendu 3D (build UMD `three.min.js` ; la console signale que ce build est obsolète, ce qui n’a pas d’importance ici).
- Les solveurs du Pyraminx, du Skewb et du Megaminx ainsi que la table de dernière couche du Megaminx sont du code et des données propres au projet (MIT). Aucun code GPL, ni de csTimer ni de TPR, n’est utilisé.

## Limites connues

- Pyraminx / Skewb / Megaminx : pas encore de reconnaissance par caméra / photo. Pour peindre, tenez le casse-tête comme l’indiquent les indications (Pyraminx : la pièce axiale sans jaune en haut, celle sans vert à l’arrière ; Skewb : le coin blanc-vert-rouge en haut-droite-avant ; Megaminx : les centres doivent former le schéma de couleurs standard), sinon une erreur de prise / de centres apparaît.
- Les solutions du Megaminx ne sont **pas optimales** (≈ 120 HTM en moyenne, jusqu’à ≈ 135) ; un état difficile occasionnel prend jusqu’à ≈ 1,6 s ; la table de dernière couche de 1,8 Mo (`megaminx-ll.json`, compressée au transfert) est téléchargée une fois au démarrage du solveur du Megaminx.
- La caméra exige HTTPS ou localhost ; la reconnaissance dépend de l’éclairage — corrigez le résultat sur le patron en cas de reflets forts ou de lumière jaune (les couleurs des centres servent à la calibration et tolèrent une certaine dominante).
- Le scan suppose le schéma de couleurs standard (blanc opposé au jaune, vert au bleu, rouge à l’orange) et la prise guidée ; les centres sont fixes dans l’éditeur.
- Le solveur 3×3 ne produit que des mouvements de face (HTM) ; les solutions de la vidéo de référence comportent des tranches, la séquence de pas pour un même état diffère donc de la vidéo.
- L’algorithme en deux phases donne des solutions quasi optimales (en général 19–21 mouvements) ; seuls les états à ≤ 8 mouvements reçoivent une solution prouvée optimale. Un vrai solveur optimal au niveau du « nombre de Dieu » reste une extension possible.
