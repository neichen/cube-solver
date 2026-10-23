[English](README.md) · [简体中文](README.zh-Hans.md) · [繁體中文](README.zh-Hant.md) · [日本語](README.ja.md) · [Español](README.es.md) · [Português](README.pt.md) · **Français** · [Deutsch](README.de.md) · [Русский](README.ru.md) · [العربية](README.ar.md) · [Bahasa Indonesia](README.id.md) · [Bahasa Melayu](README.ms.md)

# Cube Solver Lab

Un solveur de casse-tête qui fonctionne entièrement dans votre navigateur : cubes du 2×2 au 15×15, Pyraminx, Skewb et Megaminx. À côté du modèle en 3D, un graphe de permutations représente chaque facette par un nœud : vous voyez chaque mouvement déplacer les facettes le long de cercles.

**Site en ligne: https://cube-solver.org**

## Fonctionnalités

- **Résolution** des cubes du 2×2 au 15×15, du Pyraminx, du Skewb et du Megaminx. Le 2×2, le Pyraminx et le Skewb obtiennent des solutions optimales. Le 3×3 utilise l'algorithme en deux phases de Kociemba (généralement 19 à 21 mouvements). À partir du 5×5, c'est gullicube, compilé en WebAssembly multithread. Le Megaminx utilise une méthode rapide en plusieurs phases (environ 120 mouvements HTM en moyenne ; non optimale).
- **Saisie d'une position** en coloriant le patron du cube, en tapant un mélange (`R U R' U2 …`, mouvements larges et de tranche compris), en scannant avec la caméra ou en envoyant des photos.
- **Vérification** qui explique ce qui ne va pas : couleurs manquantes, coin tourné, arête retournée, parité, etc.
- **Lecteur pas à pas** avec frise chronologique, réglage de la vitesse et raccourcis clavier, synchronisé entre la vue 3D et le graphe.
- **Jeu libre** sur tous les casse-tête : tournez les couches à la souris, au doigt ou au clavier, avec chronomètre, inspection WCA facultative, annuler/rétablir et meilleurs temps. Le mélange du Megaminx suit le style WCA (Pochmann).
- **12 langues**, dont une mise en page entièrement de droite à gauche pour l'arabe, et une page statique adaptée aux moteurs de recherche pour chaque casse-tête dans chaque langue.
- **Son synthétisé** : tous les sons sont générés en direct avec la Web Audio API, aucun fichier audio n'est fourni.

## Confidentialité

- Les images de la caméra et les photos envoyées sont traitées uniquement dans votre navigateur. Elles ne sont jamais envoyées ni stockées sur un serveur.
- Le site en ligne compte les visites avec Cloudflare Web Analytics, qui n'utilise aucun cookie et ne collecte aucune donnée personnelle ; il est chargé pour tous les visiteurs. Google Analytics 4 n'est chargé qu'après un clic sur Accepter dans le bandeau de consentement (Consent Mode v2, avec stockage publicitaire, données utilisateur publicitaires, personnalisation des annonces et Google Signals désactivés) ; si vous refusez, il n'est jamais chargé, et vous pouvez changer votre choix à tout moment avec le lien « Paramètres de mesure d’audience » en bas de page. Les réglages (langue, son, meilleurs temps, choix de mesure d'audience…) sont enregistrés uniquement dans le stockage local de votre navigateur. La mesure d'audience ne compte que les pages vues : l'état des puzzles et les images de la caméra ne sont jamais envoyés.
- Le site est un ensemble de fichiers statiques hébergés chez Cloudflare, qui traite les requêtes web ordinaires comme tout hébergeur.

## Lancer en local

Prérequis : Node.js 18 ou plus récent.

```bash
npm install
npx playwright install chromium   # uniquement pour les tests dans le navigateur
npm start                         # http://localhost:8765/
```

La caméra exige un contexte sécurisé (`https://` ou `http://localhost`). Le serveur local envoie les mêmes en-têtes d'isolation cross-origin que le site en ligne, indispensables au WebAssembly multithread.

## Tests

```bash
npm test               # génère les pages SEO puis lance les tests unitaires, des solveurs et SEO (sans navigateur)
npm run test:nxn       # vérifications des solveurs 4×4 à 15×15 (plus lentes)
npm start &            # les tests navigateur ont besoin du serveur local
npm run test:e2e       # aussi: test:i18n, test:play, test:twisty, test:naming, test:analytics
```

## Build et déploiement

```bash
npm run build          # assemble le site à déployer dans dist/
```

Le site est déployé en tant que ressources statiques Cloudflare Workers (voir `deploy/`) :

```bash
export CLOUDFLARE_ACCOUNT_ID=<l'ID de votre compte>
export CLOUDFLARE_API_TOKEN=<un jeton d'API autorisé à modifier les Workers>   # ou lancez: npx wrangler login
export CF_BEACON_TOKEN=<token>               # facultatif : jeton Cloudflare Web Analytics
export GA_MEASUREMENT_ID=G-XXXXXXXXXX        # facultatif : ID de mesure GA4, chargé seulement après consentement
npm run deploy
```

- `deploy/_headers` définit `Cross-Origin-Opener-Policy` et `Cross-Origin-Embedder-Policy`, nécessaires au solveur WebAssembly multithread.
- `deploy/worker.js` ne fait que rediriger : `www` et `*.workers.dev` vers le domaine principal, et les anciens liens `/?puzzle=…` vers les nouveaux chemins. Les fichiers statiques (`/js`, `/css`, `/img`, `/puzzles`, `/vendor`, etc.) sont servis directement sans exécuter le Worker : une page vue coûte donc une seule requête Worker.
- Les identifiants de mesure d'audience ne sont pas dans le dépôt. `npm run build` lit `CF_BEACON_TOKEN` et `GA_MEASUREMENT_ID` dans l'environnement (ou dans un fichier `.env` ignoré par git, lignes `CLÉ=valeur`) et ne les écrit que dans `dist/`. S'ils ne sont pas définis, le build ne contient ni mesure d'audience, ni bandeau de consentement, ni pistage ; la mesure ne fonctionne de toute façon que sur le domaine de production.
- Pour déployer votre propre copie, modifiez `name` et `routes` dans `deploy/wrangler.toml` ainsi que `baseUrl` dans `seo/site.config.json`.

Notes pour les développeurs : [docs/DEVELOPMENT.fr.md](docs/DEVELOPMENT.fr.md).

## Remerciements

La vue en graphe qui représente le cube sous forme de cercles s’inspire des animations de じゃがりきん ([@jagarikin](https://x.com/jagarikin)) : [original (2022-05)](https://x.com/jagarikin/status/1524175137633095681), [avec cube 3D (2022-11)](https://x.com/jagarikin/status/1593771091738374144). Nous avons découvert l’idée grâce à [cette publication de @UnicornBitcoin](https://x.com/UnicornBitcoin/status/2107652690113339684). Merci à tous les deux.

## Licence et crédits

- Le code de ce projet est publié sous [licence MIT](LICENSE).
- Les composants tiers conservent leurs propres licences. Les détails figurent dans [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
  - [gullicube](https://github.com/rokicki/gullicube), de Tomas Rokicki, le solveur du 5×5 et au-delà, est utilisé sans modification sous la Mozilla Public License 2.0 (l'une des options de sa licence « MPL-2.0 OR GPL-3.0-or-later »). Voir `vendor/gullicube/` et `tools/build-gullicube.sh`.
  - [cubejs](https://github.com/ldez/cubejs) (MIT), le solveur en deux phases du 3×3, comporte un petit correctif décrit dans `vendor/solve.js.cubelab.patch`.
  - [three.js](https://threejs.org/) (MIT) affiche la vue 3D.

## Marque déposée

Rubik's Cube est une marque déposée de Spin Master Ltd. Ce projet n'est ni affilié à Spin Master, ni parrainé, ni approuvé par cette société. Le nom « Rubik's » n'apparaît que pour décrire le casse-tête.
