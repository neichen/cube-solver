[English](README.md) · [简体中文](README.zh-Hans.md) · [繁體中文](README.zh-Hant.md) · [日本語](README.ja.md) · **Español** · [Português](README.pt.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · [Русский](README.ru.md) · [العربية](README.ar.md) · [Bahasa Indonesia](README.id.md) · [Bahasa Melayu](README.ms.md)

# Cube Solver Lab

Un resolvedor de rompecabezas que funciona por completo en el navegador: cubos de 2×2 a 15×15, Pyraminx, Skewb y Megaminx. Junto al modelo en 3D, un grafo de permutaciones muestra cada pegatina como un nodo, para que veas cómo cada giro mueve las pegatinas a lo largo de círculos.

**Sitio web: https://cube-solver.org**

## Funciones

- **Resuelve** cubos de 2×2 a 15×15, Pyraminx, Skewb y Megaminx. El 2×2, el Pyraminx y el Skewb obtienen soluciones óptimas. El 3×3 usa el algoritmo de dos fases de Kociemba (normalmente 19–21 movimientos). Del 5×5 en adelante se usa gullicube compilado a WebAssembly multihilo. El Megaminx usa un método rápido por fases (unos 120 movimientos HTM de media; no es óptimo).
- **Introduce una posición** pintando el desarrollo del cubo, escribiendo una mezcla (`R U R' U2 …`, con movimientos anchos y de capa central), escaneando con la cámara o subiendo fotos.
- **Validación** que explica qué falla: colores que faltan, una esquina girada, una arista volteada, paridad y más.
- **Reproductor paso a paso** con línea de tiempo, control de velocidad y atajos de teclado, sincronizado entre la vista 3D y el grafo.
- **Juego libre** en todos los rompecabezas: gira capas arrastrando o con el teclado, con cronómetro, inspección WCA opcional, deshacer/rehacer y mejores tiempos. La mezcla del Megaminx sigue el estilo WCA (Pochmann).
- **12 idiomas**, con diseño completo de derecha a izquierda para el árabe, y una página estática optimizada para buscadores para cada rompecabezas en cada idioma.
- **Sonido sintetizado**: todos los sonidos se generan en directo con la Web Audio API; no se incluye ningún archivo de audio.

## Privacidad

- Las imágenes de la cámara y las fotos subidas se procesan solo en tu navegador. Nunca se suben ni se guardan en un servidor.
- El sitio en línea cuenta las visitas con Cloudflare Web Analytics, que no usa cookies ni recoge datos personales; se carga para todos los visitantes. Google Analytics 4 funciona siempre con Consent Mode v2 y con almacenamiento de anuncios, datos de usuario para anuncios, personalización de anuncios y Google Signals desactivados. En la UE/EEE, el Reino Unido y Suiza (y cuando no se puede determinar el país) solo se carga después de pulsar Aceptar en el aviso de consentimiento; en el resto del mundo no hay aviso y se carga solo para estadísticas de páginas vistas. En ambos casos puedes activarlo o desactivarlo en cualquier momento con el enlace «Ajustes de analítica» del pie de página; Rechazar lo detiene y borra sus cookies. Ajustes como el idioma, el sonido, los mejores tiempos y tu elección de analítica se guardan solo en el almacenamiento local de tu navegador. La analítica solo cuenta páginas vistas: los estados del puzle y las imágenes de la cámara nunca se envían.
- El sitio es un conjunto de archivos estáticos alojados en Cloudflare, que gestiona las solicitudes web normales como cualquier proveedor de alojamiento.

## Ejecutar en local

Requisitos: Node.js 18 o posterior.

```bash
npm install
npx playwright install chromium   # solo para las pruebas en navegador
npm start                         # http://localhost:8765/
```

La cámara necesita un contexto seguro (`https://` o `http://localhost`). El servidor local envía las mismas cabeceras de aislamiento de origen cruzado que el sitio publicado, necesarias para WebAssembly multihilo.

## Pruebas

```bash
npm test               # genera las páginas SEO y ejecuta las pruebas unitarias, de resolvedores y SEO (sin navegador)
npm run test:nxn       # comprobaciones de los resolvedores 4×4–15×15 (más lentas)
npm start &            # las pruebas en navegador necesitan el servidor local
npm run test:e2e       # además: test:i18n, test:play, test:twisty, test:naming, test:analytics
```

## Compilar y desplegar

```bash
npm run build          # reúne el sitio desplegable en dist/
```

El sitio se despliega como recursos estáticos de Cloudflare Workers (ver `deploy/`):

```bash
export CLOUDFLARE_ACCOUNT_ID=<tu ID de cuenta>
export CLOUDFLARE_API_TOKEN=<un token de API que pueda editar Workers>   # o ejecuta: npx wrangler login
export CF_BEACON_TOKEN=<token>               # opcional: token de Cloudflare Web Analytics
export GA_MEASUREMENT_ID=G-XXXXXXXXXX        # opcional: ID de medición de GA4, solo se carga tras el consentimiento
npm run deploy
```

- `deploy/_headers` define `Cross-Origin-Opener-Policy` y `Cross-Origin-Embedder-Policy`, que necesita el resolvedor WebAssembly multihilo.
- `deploy/worker.js` solo redirige: `www` y `*.workers.dev` al dominio principal, y los enlaces antiguos `/?puzzle=…` a las rutas nuevas. Los archivos estáticos (`/js`, `/css`, `/img`, `/puzzles`, `/vendor`, etc.) se sirven directamente sin ejecutar el Worker, así que cada visita a una página cuesta una sola solicitud al Worker.
- Los ID de analítica no están en el repositorio. `npm run build` lee `CF_BEACON_TOKEN` y `GA_MEASUREMENT_ID` del entorno (o de un archivo `.env` ignorado por git, con líneas `CLAVE=valor`) y los escribe solo en `dist/`. Si no están definidos, la compilación no lleva analítica, ni aviso de consentimiento, ni rastreo; además, la analítica solo funciona en el dominio de producción.
- Si despliegas tu propia copia, cambia `name` y `routes` en `deploy/wrangler.toml` y `baseUrl` en `seo/site.config.json`.

Notas para desarrolladores: [docs/DEVELOPMENT.es.md](docs/DEVELOPMENT.es.md).

Contribuir: los informes de errores, las correcciones de traducción y los pull requests son bienvenidos; consulta [CONTRIBUTING.md](CONTRIBUTING.md) (en inglés). Problemas de seguridad: [SECURITY.md](SECURITY.md).

## Agradecimientos

La vista de grafo que dibuja el cubo como círculos está inspirada en las animaciones de じゃがりきん ([@jagarikin](https://x.com/jagarikin)): [original (2022-05)](https://x.com/jagarikin/status/1524175137633095681), [con cubo 3D (2022-11)](https://x.com/jagarikin/status/1593771091738374144). Conocimos la idea gracias a [esta publicación de @UnicornBitcoin](https://x.com/UnicornBitcoin/status/2107652690113339684). Gracias a ambos.

## Licencia y créditos

- El código de este proyecto se publica bajo la [licencia MIT](LICENSE).
- Los componentes de terceros mantienen sus propias licencias. Los detalles están en [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
  - [gullicube](https://github.com/rokicki/gullicube), de Tomas Rokicki, el resolvedor para 5×5 y mayores, se usa sin modificar bajo la Mozilla Public License 2.0 (una de las opciones de su licencia "MPL-2.0 OR GPL-3.0-or-later"). Ver `vendor/gullicube/` y `tools/build-gullicube.sh`.
  - [cubejs](https://github.com/ldez/cubejs) (MIT), el resolvedor de dos fases del 3×3, lleva un pequeño parche en `vendor/solve.js.cubelab.patch`.
  - [three.js](https://threejs.org/) (MIT) dibuja la vista 3D.

## Marca registrada

Rubik's Cube es una marca registrada de Spin Master Ltd. Este proyecto no está afiliado a Spin Master, ni patrocinado ni respaldado por ella. «Rubik's» aparece solo para describir el rompecabezas.
