[English](DEVELOPMENT.md) · [简体中文](DEVELOPMENT.zh-Hans.md) · [繁體中文](DEVELOPMENT.zh-Hant.md) · [日本語](DEVELOPMENT.ja.md) · **Español** · [Português](DEVELOPMENT.pt.md) · [Français](DEVELOPMENT.fr.md) · [Deutsch](DEVELOPMENT.de.md) · [Русский](DEVELOPMENT.ru.md) · [العربية](DEVELOPMENT.ar.md) · [Bahasa Indonesia](DEVELOPMENT.id.md) · [Bahasa Melayu](DEVELOPMENT.ms.md)

# Cube Solver Lab (CubeLab) · Notas para desarrolladores

> Notas detalladas para desarrolladores. La versión en inglés ([DEVELOPMENT.md](DEVELOPMENT.md)) es la canónica; esta traducción la sigue. Para la descripción del proyecto, la ejecución, las pruebas, el despliegue, la licencia y la privacidad, consulta el [README](../README.es.md).
> `ref/` (fotogramas del vídeo de referencia) y `screenshots/` (capturas generadas por las pruebas), mencionados más abajo, no están en el repositorio; las pruebas crean las carpetas de capturas al ejecutarse.

Un resolvedor de rompecabezas puramente front-end (HTML/CSS/JS estáticos, sin back end). Su rasgo distintivo es la **vista de grafo**: junto al rompecabezas 3D hay un «grafo de permutación» en el que cada pegatina es un nodo. Para el 3×3 son **tres grupos de circunferencias concéntricas** (cada grupo de 3 = las 3 capas de un eje; los centros forman un triángulo equilátero y dan un patrón de pétalos de simetría triple), con los 54 nodos en las intersecciones. En cada giro se oscurecen las circunferencias de esa capa, las 12 pegatinas laterales recorren los arcos (con estelas que se desvanecen en el color de la pegatina) y las 9 pegatinas de la cara girada rotan dentro de su grupo, en sincronía exacta con el giro 3D. Un cubo mezclado combina colores; uno resuelto forma 6 grupos compactos de un solo color.

## Funciones

| Módulo | Descripción |
| --- | --- |
| Pintar | Plantilla + paleta, clic / arrastrar para pintar, conteo de colores, restablecer / aleatorio / borrar |
| Entrada de fórmula | Escribe una mezcla (`R U R' U2 …`, con capas medias `M E S`), aplicada desde resuelto en el agarre WCA (blanco arriba, verde delante) |
| Escaneo con cámara | Vista en vivo con `getUserMedia` + cuadrícula + vista previa del reconocimiento; orden guiado de las 6 caras (con indicaciones de orientación) |
| Subir foto | Cualquier cara puede usar una foto subida; un control «tamaño de cuadrícula» alinea las pegatinas |
| Reconocimiento de color | Mediana RGB dentro de cada celda → CIE Lab. Durante el escaneo: vista previa frente a colores típicos (en tamaños impares se calibra con los centros medidos). **Tras las seis caras** (`js/core/color-cluster.js`): k-means de capacidad igual sobre las 6n² celdas (exactamente n² por color, luminosidad con menos peso) → nombres de color probando las 6! asignaciones (fijados por los centros en tamaños impares) → decodificación con restricciones por órbita de piezas con el algoritmo húngaro (las esquinas deben ser uno de los 8 tríos orientados válidos, aristas / alas pares válidos, cada órbita de centros una cuota por color) → reestimar los centros de color y resolver otra vez. Funciona también en tamaños pares (sin centros fijos) |
| Validación | Mensajes localizados (12 idiomas, reglas de plural de Intl): pegatinas sin pintar, centros duplicados, conteo de colores, piezas imposibles, piezas duplicadas, esquina girada, arista volteada, paridad (dos piezas intercambiadas) |
| Resolver | En un Web Worker. 3×3: ① BFS bidireccional (óptimo demostrable hasta 8 movimientos) ② Kociemba en dos fases (cubejs) con acortamiento iterativo dentro de un tiempo límite, normalmente 19–21 movimientos. Otros rompecabezas: ver abajo |
| Reproductor | Reproducir / pausa / anterior / siguiente / primero / último / velocidad / línea de tiempo arrastrable / clic en cualquier paso; teclas: Espacio, ←, →; ritmo y suavizado medidos en el vídeo de referencia |
| Sonido | Sintetizado en vivo con Web Audio (sin archivos de audio): sonido de giro realista, arpegio al resolver, barrido de exhibición, toques al pintar, avisos de captura; música de fondo generada opcional; «efectos / música / volumen» en la barra del reproductor, guardado localmente |
| Agarre | «Amarillo arriba, verde delante» (por defecto, como el vídeo de referencia) / «Blanco arriba, verde delante (WCA)»: cambia a la vez la orientación 3D y la notación, de modo que U siempre es la capa superior en pantalla |
| Modo demo | «Primero mezclar, luego resolver»: reproduce la mezcla desde resuelto y después la solución |
| Adaptable | En móviles la vista 3D y el grafo se apilan; los controles se ajustan |
| Idiomas | 12 idiomas (English, 简体中文, 繁體中文, Español, العربية, Português, Bahasa Indonesia, Bahasa Melayu, Français, 日本語, Русский, Deutsch), RTL completo para árabe; icono de globo arriba a la derecha, elección guardada localmente |

## N×N (2×2 – 15×15)

El menú «Rompecabezas» de arriba ofrece 2×2 … 15×15 (también `?n=7`). Todas las vistas (pintar la plantilla, fórmula, cuadrícula N×N de la cámara, 3D con three.js, el grafo con tres grupos de n circunferencias concéntricas más zoom / desplazamiento, el reproductor) se generan para cada tamaño.

| Tamaño | Resolvedor | Métrica | Medido (mezclas aleatorias, todas verificadas como resueltas) |
| --- | --- | --- | --- |
| 2×2 | Resolvedor óptimo propio (tabla de distancias completa, 3.674.160 estados, BFS) | HTM | 100 resoluciones: media 8,87, máx. 10; tabla ≈ 0,3 s, resolución < 1 ms |
| 3×3 | BFS ≤ 8 óptimo + Kociemba en dos fases con acortamiento | HTM | normalmente 19–21 movimientos |
| 4×4 | Método de reducción propio (abajo); gullicube opcional | OBTM | 12 resoluciones (Node): media 56,8, máx. 64; tablas ≈ 3,2 s; resolución media 6,9 s (la más lenta 16 s) |
| 5×5 – 15×15 | gullicube (T. Rokicki, MPL-2.0) compilado a WebAssembly multihilo; modo calidad / rápido | SSTM | ver la tabla siguiente |

gullicube (Node, 4 hilos, la misma compilación que en el navegador; SSTM):

| n | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Calidad (--time 16, ≈ 10–15 s, primera descarga ≈ 30 MB de tablas) | 119 | 169 | 257 | 329 | 448 | 563 | 678 | 833 | 981 | 1131 | 1408 |
| Rápido (--fast, ≈ 2–4 s, ≈ 0,5 MB de tablas) | 168 | 281 | 402 | 571 | 695 | 972 | 1130 | 1495 | 1635 | 1950 | 2231 |

Los dispositivos con poca memoria (`navigator.deviceMemory` < 4 GB) y los móviles / tabletas usan por defecto el modo rápido para n ≥ 5; el menú del resolvedor cambia entre calidad y velocidad en cualquier momento. El WASM multihilo necesita aislamiento de origen cruzado: `deploy/_headers` define COOP / COEP / CORP.

**Analítica** (`js/analytics.js`, solo se ejecuta en cube-solver.org): Cloudflare Web Analytics no usa cookies y se carga para todos; GA4 inyecta gtag.js solo después de que el visitante pulse «Aceptar» (Consent Mode v2, solo se concede `analytics_storage`). El aviso solo aparece en la región de consentimiento: `deploy/worker.js` pone `<html data-consent="1">` para UE/EEE, Reino Unido, Suiza y países desconocidos (`request.cf.country` ausente, `XX`, `T1`) y `data-consent="0"` en el resto, donde GA4 se carga sin aviso (las señales de anuncios siguen denegadas) y el enlace del pie sigue ofreciendo «Rechazar», que desactiva GA y borra sus cookies. El ETag lleva el sufijo `-c1`/`-c0` para que las dos variantes nunca se revaliden entre sí. Ambos responden con `Cross-Origin-Resource-Policy: cross-origin` + cabeceras CORS, así que `require-corp` se mantiene y el aislamiento de origen cruzado no se rompe. Los cambios de ruta de la SPA (`history.replaceState`) se cuentan automáticamente con el modo SPA de CF y la medición mejorada de GA4 («cambios de página basados en eventos del historial del navegador»); no envíes `page_view` a mano (se contaría dos veces). Pruebas: `npm run test:analytics` (local, balizas interceptadas) / `npm run test:analytics:live`. Los ID de analítica no están en el repositorio: `tools/build-dist.js` lee `CF_BEACON_TOKEN` y `GA_MEASUREMENT_ID` del entorno (o del `.env` ignorado por git) y los escribe solo en `dist/js/analytics.js`; sin ellos no hay analítica, ni banner de consentimiento, ni seguimiento. Todo queda dentro de la cuota gratuita de recursos estáticos de Cloudflare Workers (los archivos estáticos no se facturan como peticiones al Worker; el Worker solo se ejecuta en las rutas de página).

**Resolvedor de reducción 4×4** (`puzzles/nxn/cube4.worker.js`, código propio; la idea de las fases sigue métodos públicos tipo Tsai / TPR, sin copiar código):
1. P1 (36 movimientos): los centros de color R/L a R/L, tabla de distancias exacta C(24,8).
2. P2 (exteriores + Rw/Lw + Uw2/Dw2/Fw2/Bw2): centros U/D a U/D, los centros del eje R/L en una de 12 disposiciones resolubles, todas las alas «orientadas» (las 24 posiciones de alas forman dos clases bajo el grupo P3), permutación par de alas (elimina la paridad OLL).
3. P3a (U D F B, R2 L2, medios giros anchos): centros en el subconjunto resoluble en P3b, las 8 alas de la capa E de vuelta en la capa E, P3b resoluble.
4. P3b (U D, F2 B2 R2 L2, medios giros anchos): centros resueltos, 12 aristas emparejadas, paridad PLL eliminada.
5. El 3×3 equivalente pasa a Kociemba en dos fases (cubejs).
Cada fase usa IDA*; dentro del tiempo límite se prueban varios candidatos de fases anteriores y se conserva el más corto; se fusionan los movimientos adyacentes del mismo eje.

Pruebas: `node tests/nxn.test.js [muestras 4×4]` (modelos 2–15 + 2×2 + 4×4), `node tests/gullicube.test.js 5,7,10,15 both`, en vivo `node tests/live-nxn.js <URL>`.

### Tablas precalculadas (resolvedores 4×4 y 3×3)

`npm run build:tables` escribe `puzzles/nxn/cube4-tables.bin.gz` (1,61 MB, 7 tablas de distancias) y `puzzles/cube3/cubejs-prune.bin.gz` (0,89 MB, tablas de poda de cubejs). Formato: `CLT1` + longitud de cabecera + directorio JSON (nombre / tipo / longitud / suma FNV-1a) + bytes en bruto, comprimido con gzip (`js/core/table-pack.js`). El worker descarga las tablas mientras calcula las tablas de movimientos; el navegador descomprime con `DecompressionStream`, comprueba cada tabla y vuelve a calcularlas en el momento si la descarga falla, una suma no coincide o el navegador no lo admite. Tras cambiar la estructura de las tablas de cualquier resolvedor, vuelve a ejecutar `npm run build:tables` (`tests/tables.test.js` compara las tablas con el cálculo en vivo).

## Juego libre (todos los rompecabezas)

El interruptor «Resolver / Juego libre» en la parte superior del escenario (o `?mode=play`).

| Acción | Descripción |
|---|---|
| Arrastrar una pegatina (ratón / táctil) | Gira la capa de esa pegatina. Cubos: de los dos ejes de la cara, el que mejor coincide con el arrastre en proyección; eje = normal de la cara × dirección del arrastre; en cubos grandes gira la capa que agarras (capas internas 2R, 3R…, la capa central de tamaños impares M / E / S). Los demás rompecabezas usan `dragMoves` (abajo). En táctil el lienzo tiene `touch-action: none`, así que la página no se desplaza |
| Arrastrar en vacío | Gira la vista (doble clic la restablece) |
| Teclado | `U D L R F B` (Mayús = antihorario); un prefijo numérico elige la capa (`2` `R` → 2R); prefijo `w` para giros anchos (`3` `w` `R` → 3Rw); `M E S` en tamaños impares; rotaciones `x y z` (2×2 y 4×4+); Ctrl+Z / Retroceso deshace, Ctrl+Y / Ctrl+Mayús+Z rehace; Esc borra el prefijo. La notación sigue el agarre actual (la capa superior en pantalla siempre es U) |
| Campo de fórmula | Cualquier fórmula (3Rw, 2R, M/E/S…), Intro la ejecuta, animada paso a paso |
| Mezclar | 2×2 / 3×3: estado aleatorio uniforme (`CubeLab.play.randomState`); 4×4+: movimientos aleatorios; Pyraminx / Skewb: estado aleatorio uniforme; Megaminx: mezcla WCA (Pochmann) |
| Cronómetro | Arranca con el primer movimiento (que no sea rotación) tras una mezcla y se detiene al resolver; inspección WCA de 15 s opcional (+2 pasados 15 s, DNF pasados 17 s) |
| Movimientos | STM hasta 3×3, BTM para 4×4+ (las rotaciones no cuentan); Pyraminx / Skewb VTM; Megaminx HTM |
| Deshacer / rehacer / restablecer / resolver desde el estado actual | «Resolver» vuelve al modo resolver y resuelve el estado actual, reproducido como siempre (este intento no se cronometra) |

- El mejor tiempo de cada rompecabezas se guarda en `localStorage` (`cubelab.best.<rompecabezas>`). Al resolver hay un resaltado suave + sonido de resuelto (según el interruptor de efectos) + un giro de exhibición (según el interruptor de rotación automática).
- Implementación: `js/core/play-core.js` (lógica pura, comprobable en Node), `Player.pushMove / popMove` (animación en cola que se acelera si hay retraso y nunca pierde movimientos), `View3D.pick / dragTurn / setPlayMode` y el control de modo en `app.js`. El grafo se actualiza paso a paso con la vista 3D.

## Pyraminx y Skewb

Ambos son plugins completos (`puzzles/twisty/`): modelo, validación, 3D, editor de plantilla, vista de grafo, resolvedor estrictamente óptimo, juego libre, 12 idiomas.

- **Modelo** (`twisty-model.js`, compartido por página / worker / Node): las pegatinas se generan a partir de la geometría (Pyraminx: 9 triángulos por cara; Skewb: 1 cuadrado + 4 triángulos de esquina por cara); la permutación de cada movimiento = girar 120° alrededor del eje los centroides y normales de las pegatinas de la capa y volver a encontrar las pegatinas. Notación WCA: Pyraminx `U L R B` (dos capas) + `u l r b` (puntas); Skewb `R U L B` (R = esquina abajo-derecha-detrás, U = arriba-izquierda-detrás, L = abajo-izquierda-delante, B = abajo-izquierda-detrás; la esquina arriba-derecha-delante es fija).
- **Resolvedor óptimo** (`twisty.worker.js?p=…`): estado de colores → piezas + orientaciones, separadas por clase de pieza en componentes independientes; primero un BFS halla el conjunto alcanzable y las tablas de movimientos de cada componente, luego un BFS completo sobre el espacio producto (tabla de distancias `Uint8Array`); la solución desciende por la tabla, así que su longitud es exactamente la distancia mínima (VTM: cada giro de 120° cuenta 1). Las puntas del Pyraminx conmutan con todo y se arreglan al final con 0 / 1 movimiento cada una (sigue siendo óptimo).

| | Estados (núcleo) | Componentes | Número de Dios medido | Tabla | Construcción (Node / navegador con arranque del worker) | Resolución |
|---|---|---|---|---|---|---|
| Pyraminx | 933.120 (× 81 puntas = 75.582.720) | aristas 11.520 × centros axiales 81 | 11 (15 con puntas) | 0,93 MB | ≈ 60 ms / ≈ 250 ms | ≈ 0,03 ms |
| Skewb | 3.149.280 | centros 360 × esquinas 8.748 | 11 (90 antípodas) | 3,15 MB | ≈ 180 ms / ≈ 400 ms | ≈ 0,01 ms |

  Las tablas se construyen en el navegador (más rápido que descargar una tabla comprimida), así que no hace falta ningún recurso extra. `tests/twisty.test.js` comprueba: cada movimiento al cubo = identidad, se anula con su inverso, mueve piezas enteras; producto de componentes = cantidad alcanzable por BFS (componentes independientes); conteos por capa; la tabla es una estratificación BFS coherente; los estados aleatorios se resuelven con longitud = distancia en la tabla; el validador rechaza aristas volteadas / esquinas giradas / dos piezas intercambiadas / combinaciones de colores imposibles / agarre incorrecto.
- **3D**: cada pieza es un poliedro convexo sólido (forma ∩ semiespacios de los planos de corte: dos por vértice en el Pyraminx, 4 planos por el centro en el Skewb); un giro rota la capa entera, las caras de corte se deslizan en su propio plano y nunca se cruzan; las pegatinas son triángulos / cuadrados redondeados y reducidos.
- **Vista de grafo**: las órbitas de pegatinas de cada giro de 120° son 3-ciclos, dibujados como la circunferencia que pasa por los 3 nodos. Nodos del Pyraminx = centros de pegatina en la plantilla (los vértices U / L / R son centros de grupos de circunferencias concéntricas, las circunferencias de la capa B rodean toda la plantilla); el Skewb usa una proyección azimutal equidistante desde la esquina DBL (la capa B son circunferencias concéntricas, R / U / L forman tres pétalos).
- **Editor de plantilla**: polígonos SVG (clic / arrastrar para pintar, Intro pinta desde el teclado, errores con contorno rojo). Pyraminx: cara frontal en el centro, caras izquierda / derecha a los lados, la base debajo; Skewb: la misma cruz que el cubo.
- **Juego libre**: al arrastrar una pegatina se elige, entre los movimientos candidatos, aquel cuya velocidad instantánea de esa pegatina mejor coincide con el arrastre (mismo eje: el de menos piezas, así que arrastrar una punta gira solo la punta); teclas `U L R B` / `R U L B` (Mayús = antihorario), en el Pyraminx `T` y luego una letra = punta; mezcla = estado aleatorio uniforme; cronómetro / mejores tiempos como en los cubos.
- **Reconocimiento con cámara / foto**: aún no disponible (las pegatinas triangulares / rómbicas necesitan nuevas cuadrículas de muestreo y coloreado con restricciones de piezas); estos rompecabezas ocultan la pestaña de escaneo y piden pintar.

## Megaminx

Un plugin completo en `puzzles/megaminx/` (código propio, MIT): `megaminx-model.js` (geometría, movimientos, validación; compartido por página / worker / Node), `megaminx.js` (plugin: 3D, plantilla, grafo, notación, juego libre), `megaminx-solver.js` (resolvedor multifase), `megaminx.worker.js` y `megaminx-ll.json` (tabla de la última capa, generada sin conexión con `tools/megaminx-ll-gen.js`).

- **Modelo**: 12 caras × 11 pegatinas = 132 pegatinas, 62 piezas (12 centros, 30 aristas, 20 esquinas). Movimientos de cara `U F R L BL BR D DR DL B FL FR` con `X X' X2 X2'` (72° / 144°, horario visto desde esa cara); movimientos WCA Pochmann `R++ R-- D++ D--` (todo salvo la capa L / U girado 144°). La permutación de cada movimiento se obtiene girando centroides y normales de las pegatinas. Validación: conteo de colores, piezas imposibles o duplicadas, esquinas giradas, aristas volteadas, paridad de la permutación y disposición de los centros (`v.megaCenters`).
- **Resolvedor** (multifase, no óptimo, HTM al estilo WCA: cualquier giro de cara de 72° o 144° cuenta 1):
  1. Tras la validación, el estado se rota / reetiqueta para que los centros sigan el esquema estándar y se convierte en códigos de pieza (esquina: hueco × 3 orientaciones, arista: hueco × 2).
  2. **F2L, cara por cara**: D, las cinco caras del anillo alrededor de D y luego cuatro de las cinco caras superiores. Cuando todas las piezas de una cara están colocadas, esa cara ya no se gira, de modo que el conjunto de movimientos S se reduce y las piezas no tocadas siguen resueltas. Las piezas nuevas de cada paso se dividen en grupos pequeños (≤ 3 piezas: una esquina y sus aristas adyacentes); cada grupo se resuelve con IDA* cuya heurística es el máximo de pequeñas tablas de distancias de grupos de piezas (BFS bajo el S actual, construidas en el primer uso y guardadas en caché). Antes del último paso de dos caras se añade una tabla de orientación de aristas (como la EO `<R,U>` del 3×3), para que ese paso se termine con dos generadores. Un límite de nodos con reintentos (tomando la siguiente solución del grupo anterior) mantiene cortos los raros casos lentos.
  3. **Última capa en dos pasos** con una tabla: paso 1 = permutación de aristas + orientación de aristas + orientación de esquinas (60 · 16 · 81 = 77.760 estados), paso 2 = permutación de esquinas × permutación de aristas (3.600 estados). El generador busca en subgrupos de tres caras `<U,X,Y>` con encuentro a mitad de camino (≤ 7 movimientos por lado) secuencias que conservan todas las piezas fuera de U, guarda la más corta por efecto más sus 5 rotaciones en U (39.059 macros) y ejecuta Dijkstra con coste HTM.
  4. Se fusionan los movimientos adyacentes de la misma cara (unidades de 72° mod 5).
- **Medido** (Node, `tests/megaminx.test.js` / benchmark): 1.000 estados aleatorios, todos resueltos: media 120,1 HTM (F2L 95,4 + última capa 26,4), máx. 135, mín. 97; tiempo medio 34 ms, máx. 1,6 s. 500 mezclas Pochmann: media 119,7, máx. 135, media 29 ms, máx. 0,9 s. En el navegador una resolución suele tardar 2–20 ms más la sobrecarga del worker; arranque del worker + carga de la tabla ≈ 170–200 ms. Las cifras están en `seo/site.config.json` y se muestran en las páginas SEO.
- **3D**: `view3d.geometry: 'poly'` con el dodecaedro como `solid` y los 12 planos de corte como `cuts`; las piezas son poliedros convexos.
- **Vista de grafo**: proyección estereográfica de las posiciones de las pegatinas desde el centro de D (ese nodo se oculta). Cada giro de cara de 72° mueve sus pegatinas en 5-ciclos, y los 5 puntos de cada ciclo quedan sobre una circunferencia en la proyección (la proyección estereográfica lleva circunferencias a circunferencias), así que cada órbita se dibuja como la circunferencia circunscrita de su 5-ciclo: 39 circunferencias, 131 nodos visibles. La cara U blanca está en el centro, las caras superiores alrededor y las inferiores como grandes pétalos exteriores; el zoom muestra el centro denso.
- **Editor de plantilla**: dos «flores» de 6 pentágonos lado a lado (U con sus 5 vecinas, D con sus 5 vecinas), polígonos SVG como en las otras formas.
- **Juego libre**: arrastrar (`dragMoves` genérico), teclas `U F R L B D` más `I`=BL, `O`=BR, `J`=FL, `K`=FR, `N`=DL, `M`=DR (Mayús = antihorario); conteo HTM; mezcla = mezcla WCA Pochmann de 77 movimientos (7 líneas de `R±± D±±` × 5 + `U`/`U'`); «resolver desde el estado actual» funciona como en los demás rompecabezas.
- **Escaneo con cámara**: oculto (`cameraPlan: null`).
- **Nombres**: 五魔方 (zh), メガミンクス (ja), Мегаминкс (ru), ميغامينكس (ar), Megaminx en los demás; en el menú va justo después de Skewb.

## SEO: una página estática por rompecabezas × idioma

- **Configuración única**: `seo/site.config.json` (`baseUrl` = la URL de producción; canonical / hreflang / sitemap / OG se derivan de ella, así que un dominio nuevo solo requiere este cambio y volver a generar) más los conteos de movimientos medidos.
- **Rutas** (`js/seo-routes.js`, compartido por el navegador y los scripts de generación): inglés en la raíz, los demás idiomas bajo `/<idioma>/`; una ruta limpia por rompecabezas: `/` (entrada principal, x-default), `/2x2-cube-solver/` … `/15x15-cube-solver/`, `/pyraminx-solver/`, `/skewb-solver/`, `/megaminx-solver/`; p. ej. `/zh-hans/3x3-cube-solver/`, `/ja/megaminx-solver/`. En total 12 idiomas × 18 = 216 páginas.
- **Textos**: `seo/lang/<code>.json` (12 idiomas, títulos escritos según los hábitos de búsqueda locales), con plantillas por tipo de rompecabezas y los conteos medidos.
- **Generación**: `npm run build:seo` (`tools/build-seo.js`) escribe la página raíz en inglés entre los marcadores `<!--seo:*-->` de `index.html` y las demás páginas en `seo/out/`, además de `robots.txt`, `sitemap.xml` (con alternativas xhtml:link) y `manifest.webmanifest`; añade `?v=<hash del contenido>` a los js/css referenciados por el HTML. Iconos e imágenes OG (1200×630, una por rompecabezas, a partir de capturas reales del 3D + grafo): `npm run build:seo-images` (requiere el servidor local; `OG_ONLY=root,megaminx` lo limita a algunas imágenes).
- **Por página**: title / description / canonical / 13 enlaces hreflang (incl. x-default) / OG / tarjeta de Twitter / iconos / manifest / JSON-LD (WebSite, WebApplication (gratis, sin valoraciones), WebPage, BreadcrumbList, HowTo, FAQPage, idéntico palabra por palabra al texto visible), un `<h1>` estático, texto rastreable (cómo se usa, resolvedor y conteos medidos, notación, explicación del grafo, FAQ, enlaces a todos los rompecabezas), una nota `<noscript>`.
- **En ejecución** (`js/seo-nav.js`): las páginas preseleccionan idioma y rompecabezas mediante `<html data-page-lang data-page-puzzle>`; cambiar de rompecabezas o idioma en la app pasa a la URL limpia correspondiente con `history.replaceState` y toma título / meta / JSON-LD / cuerpo de la página prerenderizada, sin recargar ni perder el estado. La raíz `/` sigue el idioma del navegador / la última elección.
- **Enlaces antiguos**: `/?puzzle=…`, `/?n=…`, `/?lang=…` reciben un 301 a las rutas nuevas desde `deploy/worker.js` (solo se ejecuta en rutas de página; los recursos estáticos quedan excluidos con `run_worker_first`; sin `?lang` el idioma sale de Accept-Language, con `Vary: Accept-Language`); los demás parámetros (`mode`, `hold`, `start`) se conservan. En local, sin el worker, `seo-nav.js` reescribe la dirección en el cliente.
- **Pruebas**: `node tests/seo.test.js` (estático: title/description únicos en las 216 páginas, canonical, enlaces hreflang cruzados completos, JSON-LD analizable y coherente con el contenido visible, sin valoraciones, tamaños de imágenes OG, enlaces internos, sitemap/robots/manifest, redirecciones del worker); `npm run test:seo:live` comprueba cada página en producción.

## Ejecutar

```bash
cd cube-solver
npm install
npm start                        # node tests/serve.js 8765 (sends COOP/COEP headers)
# open http://localhost:8765/
```

> La cámara necesita un **contexto seguro**: `https://` o `http://localhost`. Con una IP de la red local (p. ej. `http://192.168.x.x`) el navegador desactiva la cámara; usa «Subir foto» en su lugar.
> Los Web Workers no funcionan con `file://`; abre siempre el sitio a través de un servidor HTTP.

## Pruebas

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

Cobertura E2E: mezcla aleatoria → resolver → reproducir hasta el final (6 grupos de un solo color en el grafo, cada cara 3D de un color), búsqueda / anterior / siguiente del reproductor, pintar y todos los tipos de error de validación, entrada de fórmula, reconocimiento de 6 fotos sintéticas (dominantes de color, gradientes de luz, ruido, reflejos), la ruta de cámara falsa de Chromium, diseño móvil y capturas. `tests/graph-preview.html` es una página independiente para depurar la disposición del grafo (`?scr=fórmula&mv=R&e=0.5`). `node tests/compare-ref.js` escribe comparaciones lado a lado con los fotogramas de referencia (`ref/f14`, `f07`, `f01`) en `screenshots/compare-*.png`; `tests/graph-pixel.html` dibuja el grafo con la correspondencia de píxeles del fotograma de referencia para superposiciones a nivel de píxel.

## Estructura de directorios

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

## Puntos de extensión (arquitectura)

Los módulos centrales (entrada, vista de grafo, 3D, reproductor, escaneo, cliente del resolvedor) trabajan **solo** a través del objeto Puzzle registrado con `CubeLab.registerPuzzle(def)` y no contienen lógica específica del 3×3. Un rompecabezas nuevo va en `puzzles/<id>/` e implementa la interfaz siguiente.

### Interfaz Puzzle

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

Al registrarlo, el núcleo completa `parse / format / apply / inverse / isSolved` por defecto, las piezas que gira cada movimiento (decididas por `layer`), las **pistas del grafo** (`P.tracks`) y las trayectorias de pegatinas de cada movimiento (`moves[tok].paths`).

Campos opcionales usados por las otras formas: `trackMode: 'cycles'` (pistas = ciclos de las permutaciones de los movimientos base), `netLayout.polys` (plantilla de polígonos SVG), `view3d.geometry: 'poly'` + `solid` / `cuts` / `core` (piezas poliédricas convexas), `dragMoves` (arrastre genérico), `playKeys` / `playMetric` / `metricTitle`, `hints` (claves i18n de las indicaciones), `randomState(rnd)` (estado aleatorio uniforme), `randomScramble()`, `nameKey`; `cameraPlan: null` oculta la pestaña de escaneo y, sin `holds`, se oculta el menú de agarre.

### Pistas del grafo y movimiento (`CubeLab.buildTracks` + `GraphView`)

Para cada movimiento base: se toman las pegatinas movidas, se agrupan por «normal de la pegatina · eje» (en el 3×3: «las 8 de la cara» y «las 12 de los lados»), cada grupo se ordena por ángulo alrededor del eje en un anillo cerrado; un giro de θ avanza las pegatinas del anillo `θ/2π × n` posiciones, contrastado con `perm`.

El `graphLayout()` del plugin da las posiciones 2D de los nodos y, opcionalmente, `circles: [{id, cx, cy, r}]`:
- si todos los nodos de una pista lateral están sobre una circunferencia, se mueven **a lo largo de ella** (mismo sentido en toda la pista; el sentido con menor recorrido total bajo el movimiento base, invertido para el inverso) con estelas de color;
- los nodos de una pista de «cara» se interpolan en coordenadas polares alrededor del nodo central de la cara (el grupo rota en bloque);
- sin circunferencias se usa una spline cerrada por los nodos, así que otros rompecabezas pueden visualizarse sin una disposición hecha a mano.

**Disposición del 3×3** (la configuración `GL` en `puzzles/cube3/cube3.js`): los tres grupos de circunferencias concéntricas son los ejes y (U/E/D), z (F/S/B) y x (R/M/L), centrados en los vértices de un triángulo equilátero (arriba, abajo a la izquierda, abajo a la derecha), radios 1,3922 / 1,7696 / 2,1469 (radio circunscrito del triángulo = 1). Estos valores son un ajuste por mínimos cuadrados a **los 54 nodos** de un fotograma de referencia de alta resolución (residuo RMS 0,2 px); el radio de nodo 0,184, el trazo 0,048, el ancho de pista 0,063 y el ancho de resaltado 0,076 proceden de mediciones de píxeles del mismo fotograma. Dibujado con la correspondencia de píxeles del fotograma de referencia y superpuesto al 50 %, circunferencias y nodos coinciden casi exactamente (`tests/graph-pixel.html`). Las pegatinas de la cara X están en las intersecciones de los grupos de circunferencias de los dos ejes distintos de la normal de X; las dos regiones de intersección alojan un par de caras opuestas. El sentido capa→radio (`sign`) y la región de intersección de cada cara (`upper`) se verificaron exhaustivamente (64 combinaciones): cada uno de los seis giros de cara es un desplazamiento cíclico de 12 nodos sobre una sola circunferencia. Los movimientos de capa media M/E/S son movimientos reales (generados a partir de la geometría en `moves`; el mismo generador reproduce exactamente las 6 permutaciones de cara, comprobado en una prueba unitaria) y recorren la circunferencia central de su grupo. El resolvedor solo produce movimientos de cara.

**Trazado de arcos (comprobado fotograma a fotograma con el vídeo de referencia)**: los 12 nodos de cada circunferencia pertenecen a 4 sectores de cara separados unos 60°/60°/60°/180°. Con «menor recorrido total» como regla de sentido, un giro de 90° mueve 9 pegatinas por arcos de ≈ 60° y **las 3 pegatinas de un sector cruzan el arco vacío de 180°** (p. ej. el arco superior de la circunferencia exterior, el gran arco izquierdo del grupo de abajo a la izquierda). El vídeo de referencia hace exactamente lo mismo (`screenshots/compare-motion.png`, segunda fila). Las posiciones de los sectores quedan fijadas por «disposición resuelta = referencia f14», así que ninguna otra asignación hace cortos todos los arcos.

**Tiempos y suavizado (medidos en la energía de movimiento a 60 fps del vídeo de referencia)**:
- suavizado por paso `easeInOutQuad` (ajustado a la curva media de velocidad de 15 giros, RMS 0,076; sine 0,155, cubic 0,193);
- la reproducción continua tiene una envolvente «inicio lento – aceleración – final lento»: primer paso ≈ 0,85 s, centro 0,48 s, último ≈ 1,0 s, solo ≈ 0,07 s entre pasos (`CubeLab.tempo(i, n)`, `Player.baseMs = 480`, `gapMs = 67`; un «siguiente» suelto dura siempre 0,55 s);
- el resaltado de la circunferencia activa aparece durante el primer 8 % del giro y se desvanece en el último 16 %; las estelas de color se extienden hacia atrás desde el nodo (fase de la cola `ease(1.6t − 0.6)`) y desaparecen al final;
- tras resolver, ≈ 1,2 s quieto y después un giro de exhibición de 2,0 s.

### Agarres (punto de vista de la notación)

El estado interno, los resolvedores y la entrada de fórmulas siempre usan el agarre WCA (blanco U, verde F). Un plugin puede ofrecer `holds`: cada agarre da una orientación 3D global y una tabla de renombrado de la notación. El agarre por defecto del 3×3, «amarillo arriba, verde delante» = el agarre estándar girado 180° alrededor del eje delante–detrás (z2): `U↔D`, `R↔L`, `F/B` sin cambio, `M→M′`, `E→E′`, `S` sin cambio (las pruebas unitarias comprueban cada uno: el eje × ángulo del movimiento interno, girado por la orientación, es igual al eje × ángulo del movimiento mostrado). El texto de la solución, el paso actual del reproductor, la lista de pasos y las descripciones usan la notación del agarre actual, así que la capa superior en pantalla se llama U.

### Estilo 3D y vista

- `view3d.style: 'plastic'`: cuerpo gris claro + paneles blancos (juntas finas gris claro) + pegatinas redondeadas de color plano (sin iluminación, mismos colores que el grafo) + sombreado suave en el cuerpo; sin él, el estilo plano clásico con cuerpo negro.
- `stickerCorners: [arriba-izq., arriba-der., abajo-der., abajo-izq.]`: radios de las esquinas de las pegatinas (se admiten formas de hoja asimétricas); `stickerColors` sustituye los colores 3D de las pegatinas.
- `orientation` (ángulos de Euler, sustituidos por el agarre actual) + `camera: { fov, dir }`: la vista por defecto del 3×3 coincide con el vídeo de referencia —amarillo (D) arriba, verde (F) a la izquierda, naranja (L) a la derecha—, que son los tres grupos del triángulo central del grafo. Perspectiva FOV 24°, unos 25° de elevación, ajustada por comparación de píxeles con los fotogramas de referencia.
- `frame: { width, height, dx, dy }`: encuadre (tamaño y desplazamiento del rompecabezas / grafo en sus medios paneles), igual al vídeo de referencia con menos de 0,5 % de diferencia.
- `autoRotate`: el rompecabezas oscila un poco durante la reproducción; cuando la reproducción llega al final en estado resuelto, reposa `showcaseDelay` (1,2 s), da una vuelta durante `showcaseMs` (2,0 s) y vuelve a la vista inicial (como al final del vídeo de referencia). El interruptor «rotación automática» del reproductor lo desactiva; girar arrastrando y restablecer con doble clic siempre funcionan.

### Sonido (`js/core/audio.js`, `CubeLab.SoundEngine`)

Todo se sintetiza en vivo con la Web Audio API; no hay archivos de audio ni recursos de terceros.
- **Política de reproducción automática**: no hay `AudioContext` al cargar la página; se crea y se hace `resume()` con el primer `pointerdown / keydown / touchstart`. Por defecto efectos activados y música desactivada; «efectos / música / volumen» se guardan en `localStorage` (`cubelab.sfx / cubelab.music / cubelab.vol`). Si la música estaba activada antes de recargar, espera al siguiente gesto del usuario. Sin Web Audio cada llamada no hace nada y los controles aparecen desactivados.
- **Sonido de giro v3** (gancho `Player.onMove(phase, tok, durMs)`): rehecho a partir del análisis de tres grabaciones reales de 3×3 (ver `user-sounds/ANALYSIS.md`, `screenshots/sound-compare.png`). Un giro real = un tren de 120–200 ms de granos de plástico agrupados (≈ uno cada 5 ms) que excitan modos cortos del cuerpo: pico principal 0,86–1,1 kHz («hueco / amaderado») + 500 Hz, 1,55, 2,8, 4,1 kHz, resonancia de solo 3–6 ms, casi sin golpe por debajo de 300 Hz; la energía crece hasta el clic más fuerte cuando la capa encaja, seguido de un traqueteo de 70–100 ms que se apaga. Síntesis: eventos de grano generados en JS → 10 resonadores de segundo orden (cada grano excita modos distintos al azar) + una capa fina de microgranos + fricción muy ligera + un borde directo de banda ancha; el clic de encaje se alinea con el final de la animación, la reproducción lenta concentra el sonido al final, los giros de 180° añaden un clic de retén en T/2, las capas medias suenan más suaves y oscuras; cada sonido se genera en 1,7–3,3 ms. Comparado con grabaciones reales (material de SpaceJoe / Pixabay, mismo análisis): centroide 2141 Hz frente a 2135 / 2077 Hz, factor de cresta 20,7 frente a 21,1 / 17,6 dB, planitud 0,24 frente a 0,25 / 0,32, 18,5 frente a 17,8 / 12,0 granos por 100 ms, diferencia de forma por tercios de octava ≈ 2 dB. No se publican archivos de audio (las grabaciones solo se usaron para el análisis; licencias en `vendor/sounds/LICENSE.txt`). Protección para reproducción rápida: al menos 50 ms entre sonidos de giro; los giros más cortos suenan más bajo y con menos granos; arrastrar la línea de tiempo detiene al instante los sonidos de giro sin terminar.
- **Resuelto**: un arpegio mayor ascendente + acorde (cuando la reproducción llega al último paso en estado resuelto); un brillo ascendente suave al empezar el **giro de exhibición** (`View3D.onShowcaseStart`).
- **Interfaz**: toques al pintar (el tono sigue al color, limitados al pintar arrastrando), avisos de captura / subida correcta (tres tonos al completar las seis caras).
- **Música de fondo**: 72 BPM, bucle de cuatro compases Cmaj9 – Am9 – Fmaj9 – G6sus; sierras desafinadas con paso bajo como colchón + arpegios pentatónicos (pseudoaleatorios deterministas), retardo con realimentación para dar espacio; programación anticipada (0,6 s en cola cada 150 ms), bucle sin cortes, fundidos de entrada y salida, nivel muy bajo.
- Niveles (volumen 0,8, medidos sin conexión): un giro suelto a 1× tiene picos de unos 0,31–0,36, a velocidad real de mano (130 ms) unos 0,22, el arpegio de resuelto unos 0,23, la música de fondo picos de unos −22 dBFS. Demos (solo en local): `screenshots/sound-demo-turns.wav`, `sound-demo-turns-v3.wav`, `sound-demo-sfx.wav`, `sound-demo-music.wav`.

### Idiomas (`js/i18n/`, `CubeLab.i18n`)

- **Idiomas y orden**: English, 简体中文, 繁體中文, Español, العربية, Português, Bahasa Indonesia, Bahasa Melayu, Français, 日本語, Русский, Deutsch (todas entradas iguales en el menú, sin grupos).
- **Textos**: un archivo por idioma, `js/i18n/<code>.js`, que llama a `CubeLab.i18n.register(code, {key: text})`; `en.js` es la tabla maestra, las claves que faltan recurren al inglés y se registran en `CubeLab.i18n.missing`. El HTML usa `data-i18n` / `data-i18n-title` / `data-i18n-aria` / `data-i18n-placeholder`; el texto dinámico usa `I.bind(el, key, params)` y se vuelve a dibujar al cambiar de idioma.
- **Formato**: un subconjunto de ICU — `{name}`, `{n, plural, =0 {…} one {# …} few {…} many {…} other {…}}` (`Intl.PluralRules`), `{ms, unit, millisecond}`, `{x, number}` (`Intl.NumberFormat`). El francés recibe espacios de no separación antes de `: ; ! ? « »` automáticamente; el español usa ¡ ¿. La notación de movimientos mantiene las letras estándar en todos los idiomas (U D L R F B M E S, ′ 2).
- **Orden de detección**: `?lang=xx` → `localStorage['cubelab.lang']` → `navigator.languages` (zh-TW/HK/MO/Hant → tradicional, otros zh → simplificado) → English. Ajusta `<html lang dir>`, el título y la meta description.
- **RTL**: el árabe refleja toda la página (propiedades lógicas de CSS); el lienzo 3D, el grafo, la línea de tiempo / controles del reproductor, la tira de pasos, la notación, la entrada de fórmulas y los números se mantienen LTR (`dir="ltr"`).
- **Tipografía**: CJK / árabe usan sus propias pilas de fuentes, mayor interlineado y sin espaciado entre letras; alemán / ruso activan `hyphens:auto` y los botones pueden partirse en líneas en lugar de desbordarse.
- **Añadir un idioma**: añade una entrada a `LANGS` en `i18n.js`, crea `js/i18n/<code>.js` e inclúyelo en `index.html`, y ejecuta `node tests/i18n.unit.test.js`.

### Adaptadores de resolvedor

```js
solvers: [
  { id: 'kociemba', name: '…', available: true,
    workerUrl: 'puzzles/cube3/kociemba.worker.js',
    encode: state => payload },          // runs on the main thread; throws a localized error for invalid states
  { id: 'optimal-ida', name: 'IDA* optimal (planned)', available: false }
]
```

Protocolo del worker:

```
→ { id, cmd: 'init' }                      ← { id, ok: true, ms }
→ { id, cmd: 'solve', payload }            ← { id, ok: true, moves: ['R', "U'", ...], optimal?: bool, label?, note?, ms }
                                           ← { id, ok: false, error }
```

Un rompecabezas puede tener varios resolvedores; el menú los enumera automáticamente y `available: false` aparece como «previsto». Añadir un resolvedor verdaderamente óptimo (p. ej. IDA* de Korf con bases de datos de patrones de esquinas / aristas) solo requiere un worker nuevo registrado en `solvers`. Un worker puede devolver `optimal: false` con una clave i18n `label` / `note` (el Megaminx lo hace), que la interfaz muestra junto al número de movimientos.

### Otras vistas

El reproductor (`CubeLab.Player`) controla cualquier número de vistas; una vista solo implementa `setState(state)` y `animate(tok, e, fromState, t)` (e = progreso suavizado 0–1, t = fase temporal sin suavizar), y opcionalmente `highlight(tok, state)`. Una visualización nueva (p. ej. un grafo de Cayley o un diagrama de ciclos) solo necesita estos métodos.

## Bibliotecas de terceros

- [gullicube](https://github.com/rokicki/gullicube) (Tomas Rokicki, usado bajo la opción MPL-2.0, código sin modificar; ver `vendor/gullicube/NOTICE.md`)
- [cubejs](https://github.com/ldez/cubejs) (MIT) — algoritmo de Kociemba en dos fases. `vendor/solve.js` lleva un pequeño parche (`vendor/solve.js.cubelab.patch`): un plazo opcional para `solve(maxDepth, deadline)` y una excepción en lugar de un fallo con null cuando no se encuentra nada, usado para el acortamiento iterativo dentro del tiempo límite.
- [three.js](https://threejs.org/) r160 (MIT) — renderizado 3D (compilación UMD `three.min.js`; la consola avisa de que esta compilación está obsoleta, lo cual aquí no importa).
- Los resolvedores de Pyraminx, Skewb y Megaminx y la tabla de última capa del Megaminx son código y datos propios del proyecto (MIT). No se usa código GPL, ni de csTimer ni de TPR.

## Limitaciones conocidas

- Pyraminx / Skewb / Megaminx: todavía sin reconocimiento por cámara / foto. Al pintar, sujeta el rompecabezas como indican las sugerencias (Pyraminx: la pieza axial sin amarillo arriba, la que no tiene verde detrás; Skewb: la esquina blanca-verde-roja arriba-derecha-delante; Megaminx: los centros deben formar el esquema de colores estándar); si no, aparece un error de agarre / centros.
- Las soluciones del Megaminx **no son óptimas** (≈ 120 HTM de media, hasta ≈ 135); algún estado difícil tarda hasta ≈ 1,6 s; la tabla de última capa de 1,8 MB (`megaminx-ll.json`, comprimida en la transferencia) se descarga una vez al arrancar el resolvedor del Megaminx.
- La cámara necesita HTTPS o localhost; el reconocimiento depende de la iluminación: corrige el resultado en la plantilla con reflejos fuertes o luz amarillenta (los colores de los centros se usan para calibrar y toleran cierta dominante de color).
- El escaneo supone el esquema de colores estándar (blanco frente a amarillo, verde frente a azul, rojo frente a naranja) y el agarre guiado; los centros están fijos en el editor.
- El resolvedor 3×3 solo produce movimientos de cara (HTM); las soluciones del vídeo de referencia incluyen capas medias, así que la secuencia de pasos para el mismo estado diferirá del vídeo.
- El algoritmo en dos fases da soluciones casi óptimas (normalmente 19–21 movimientos); solo los estados de ≤ 8 movimientos obtienen una solución con optimalidad demostrada. Un resolvedor óptimo de nivel «número de Dios» queda como extensión.
