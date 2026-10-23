[English](DEVELOPMENT.md) · [简体中文](DEVELOPMENT.zh-Hans.md) · [繁體中文](DEVELOPMENT.zh-Hant.md) · [日本語](DEVELOPMENT.ja.md) · [Español](DEVELOPMENT.es.md) · **Português** · [Français](DEVELOPMENT.fr.md) · [Deutsch](DEVELOPMENT.de.md) · [Русский](DEVELOPMENT.ru.md) · [العربية](DEVELOPMENT.ar.md) · [Bahasa Indonesia](DEVELOPMENT.id.md) · [Bahasa Melayu](DEVELOPMENT.ms.md)

# Cube Solver Lab (CubeLab) · Notas para desenvolvedores

> Notas detalhadas para desenvolvedores. A versão em inglês ([DEVELOPMENT.md](DEVELOPMENT.md)) é a canônica; esta tradução a acompanha. Para a visão geral do projeto, execução, testes, implantação, licença e privacidade, veja o [README](../README.pt.md).
> `ref/` (quadros do vídeo de referência) e `screenshots/` (capturas geradas pelos testes), citados abaixo, não estão no repositório; os testes criam as pastas de capturas ao rodar.

Um resolvedor de quebra-cabeças puramente front-end (HTML/CSS/JS estáticos, sem back end). O recurso marcante é a **visão de grafo**: ao lado do quebra-cabeça 3D há um «grafo de permutação» em que cada adesivo é um nó. No 3×3 são **três grupos de círculos concêntricos** (cada grupo de 3 círculos = as 3 camadas de um eixo; os centros formam um triângulo equilátero, criando um padrão de pétalas com simetria tripla), com os 54 nós nas interseções. A cada giro os círculos daquela camada escurecem, os 12 adesivos laterais percorrem os arcos (com rastros que esmaecem na cor do adesivo) e os 9 adesivos da face girada rotacionam dentro do seu grupo, em sincronia exata com o giro 3D. Um cubo embaralhado mistura as cores; um cubo resolvido forma 6 grupos compactos de uma só cor.

## Recursos

| Módulo | Descrição |
| --- | --- |
| Pintura | Planificação + paleta, clique / arraste para pintar, contagem de cores, redefinir / aleatório / limpar |
| Entrada de fórmula | Digite um embaralhamento (`R U R' U2 …`, camadas do meio `M E S` aceitas), aplicado a partir do resolvido na pegada WCA (branco em cima, verde na frente) |
| Escaneamento com câmera | Imagem ao vivo via `getUserMedia` + grade + prévia do reconhecimento ao vivo; ordem guiada das 6 faces (com dicas de orientação) |
| Envio de foto | Qualquer face pode usar uma foto enviada; um controle «tamanho da grade» alinha os adesivos |
| Reconhecimento de cor | Mediana RGB dentro de cada célula → CIE Lab. Durante o escaneamento: prévia ao vivo comparada às cores típicas (tamanhos ímpares calibram com os centros medidos). **Depois das seis faces** (`js/core/color-cluster.js`): k-means de capacidade igual sobre todas as 6n² células (exatamente n² por cor, luminosidade com peso menor) → nomes de cor testando todas as 6! atribuições (fixadas pelos centros em tamanhos ímpares) → decodificação com restrições por órbita de peças com o algoritmo húngaro (cantos devem ser um dos 8 trios orientados válidos, arestas / asas pares válidos, cada órbita de centros tem uma cota por cor) → reestimar os centros de cor e resolver de novo. Funciona também em tamanhos pares (sem centros fixos) |
| Validação | Mensagens localizadas (12 idiomas, regras de plural do Intl): adesivos sem pintura, centros duplicados, contagem de cores, peças impossíveis, peças duplicadas, canto torcido, aresta invertida, paridade (duas peças trocadas) |
| Resolução | Em um Web Worker. 3×3: ① BFS bidirecional (ótimo comprovado até 8 movimentos) ② Kociemba em duas fases (cubejs) com encurtamento iterativo dentro de um limite de tempo, geralmente 19–21 movimentos. Outros quebra-cabeças: veja abaixo |
| Player | Reproduzir / pausar / anterior / próximo / primeiro / último / velocidade / linha do tempo arrastável / clique em qualquer passo; teclas: Espaço, ←, →; ritmo e suavização medidos no vídeo de referência |
| Som | Sintetizado ao vivo com Web Audio (sem arquivos de áudio): som de giro realista, arpejo de resolvido, varredura da exibição, toques de pintura, avisos de captura; música de fundo gerada opcional; «efeitos / música / volume» na barra do player, salvos localmente |
| Pegada | «Amarelo em cima, verde na frente» (padrão, igual ao vídeo de referência) / «Branco em cima, verde na frente (WCA)»: troca tanto a orientação 3D quanto a notação, então U é sempre a camada de cima na tela |
| Modo demonstração | «Primeiro embaralhar, depois resolver»: reproduz o embaralhamento a partir do resolvido e depois a solução |
| Responsivo | No celular a visão 3D e o grafo ficam empilhados; os controles quebram linha |
| Idiomas | 12 idiomas (English, 简体中文, 繁體中文, Español, العربية, Português, Bahasa Indonesia, Bahasa Melayu, Français, 日本語, Русский, Deutsch), RTL completo para árabe; ícone de globo no canto superior direito, escolha salva localmente |

## N×N (2×2 – 15×15)

O menu «Quebra-cabeça» no topo oferece 2×2 … 15×15 (também `?n=7`). Todas as visões (pintura da planificação, fórmula, grade N×N da câmera, 3D com three.js, o grafo com três grupos de n círculos concêntricos mais zoom / deslocamento, o player) são geradas para cada tamanho.

| Tamanho | Resolvedor | Métrica | Medido (embaralhamentos aleatórios, todos verificados como resolvidos) |
| --- | --- | --- | --- |
| 2×2 | Resolvedor ótimo próprio (tabela de distâncias completa, 3.674.160 estados, BFS) | HTM | 100 resoluções: média 8,87, máx. 10; tabela ≈ 0,3 s, resolução < 1 ms |
| 3×3 | BFS ≤ 8 ótimo + Kociemba em duas fases com encurtamento | HTM | geralmente 19–21 movimentos |
| 4×4 | Método de redução próprio (abaixo); gullicube opcional | OBTM | 12 resoluções (Node): média 56,8, máx. 64; tabelas ≈ 3,2 s; resolução média 6,9 s (a mais lenta 16 s) |
| 5×5 – 15×15 | gullicube (T. Rokicki, MPL-2.0) compilado para WebAssembly multithread; modo qualidade / rápido | SSTM | veja a tabela abaixo |

gullicube (Node, 4 threads, mesma compilação do navegador; SSTM):

| n | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Qualidade (--time 16, ≈ 10–15 s, primeiro download ≈ 30 MB de tabelas) | 119 | 169 | 257 | 329 | 448 | 563 | 678 | 833 | 981 | 1131 | 1408 |
| Rápido (--fast, ≈ 2–4 s, ≈ 0,5 MB de tabelas) | 168 | 281 | 402 | 571 | 695 | 972 | 1130 | 1495 | 1635 | 1950 | 2231 |

Aparelhos com pouca memória (`navigator.deviceMemory` < 4 GB) e celulares / tablets usam o modo rápido por padrão para n ≥ 5; o menu do resolvedor troca qualidade / velocidade a qualquer momento. O WASM multithread precisa de isolamento de origem cruzada: `deploy/_headers` define COOP / COEP / CORP.

**Análise de tráfego** (`js/analytics.js`, roda apenas em cube-solver.org): o Cloudflare Web Analytics não usa cookies e carrega para todos; o GA4 injeta o gtag.js somente depois que o visitante clica em «Aceitar» (Consent Mode v2, apenas `analytics_storage` concedido). Ambos respondem com `Cross-Origin-Resource-Policy: cross-origin` + cabeçalhos CORS, então `require-corp` continua e o isolamento de origem cruzada não quebra. Mudanças de rota da SPA (`history.replaceState`) são contadas automaticamente pelo modo SPA da CF e pela medição otimizada do GA4 («mudanças de página baseadas em eventos do histórico do navegador»); não envie `page_view` manualmente (contaria em dobro). Testes: `npm run test:analytics` (local, beacons interceptados) / `npm run test:analytics:live`. Os IDs de análise não ficam no repositório: `tools/build-dist.js` lê `CF_BEACON_TOKEN` e `GA_MEASUREMENT_ID` do ambiente (ou do `.env` ignorado pelo git) e os grava apenas em `dist/js/analytics.js`; sem eles não há análise, nem banner de consentimento, nem rastreamento. Tudo fica dentro da cota gratuita de recursos estáticos do Cloudflare Workers (arquivos estáticos não são cobrados como requisições ao Worker; o Worker roda apenas nas rotas de página).

**Resolvedor de redução 4×4** (`puzzles/nxn/cube4.worker.js`, código próprio; a ideia das fases segue métodos públicos do tipo Tsai / TPR, sem código copiado):
1. P1 (36 movimentos): os centros de cor R/L para R/L, tabela de distâncias exata C(24,8).
2. P2 (externas + Rw/Lw + Uw2/Dw2/Fw2/Bw2): centros U/D para U/D, os centros do eixo R/L em um dos 12 arranjos solucionáveis, todas as asas «orientadas» (as 24 posições de asa formam duas classes sob o grupo P3), permutação par das asas (remove a paridade OLL).
3. P3a (U D F B, R2 L2, meias-voltas largas): centros no subconjunto solucionável em P3b, as 8 asas da camada E de volta à camada E, P3b solucionável.
4. P3b (U D, F2 B2 R2 L2, meias-voltas largas): centros resolvidos, 12 arestas pareadas, paridade PLL removida.
5. O 3×3 equivalente vai para o Kociemba em duas fases (cubejs).
Cada fase usa IDA*; dentro do limite de tempo, vários candidatos das fases anteriores são testados e o mais curto é mantido; movimentos adjacentes no mesmo eixo são unidos.

Testes: `node tests/nxn.test.js [amostras 4×4]` (modelos 2–15 + 2×2 + 4×4), `node tests/gullicube.test.js 5,7,10,15 both`, ao vivo `node tests/live-nxn.js <URL>`.

### Tabelas pré-calculadas (resolvedores 4×4 e 3×3)

`npm run build:tables` grava `puzzles/nxn/cube4-tables.bin.gz` (1,61 MB, 7 tabelas de distâncias) e `puzzles/cube3/cubejs-prune.bin.gz` (0,89 MB, tabelas de poda do cubejs). Formato: `CLT1` + tamanho do cabeçalho + diretório JSON (nome / tipo / tamanho / soma FNV-1a) + bytes brutos, compactado com gzip (`js/core/table-pack.js`). O worker baixa as tabelas enquanto calcula as tabelas de movimentos; o navegador descompacta com `DecompressionStream`, verifica cada tabela e volta a calculá-las na hora se o download falhar, uma soma não bater ou o navegador não tiver suporte. Depois de mudar a estrutura das tabelas de qualquer resolvedor, rode `npm run build:tables` de novo (`tests/tables.test.js` compara as tabelas com o cálculo ao vivo).

## Jogo livre (todos os quebra-cabeças)

O seletor «Resolver / Jogo livre» no topo do palco (ou `?mode=play`).

| Ação | Descrição |
|---|---|
| Arrastar um adesivo (mouse / toque) | Gira a camada daquele adesivo. Cubos: dos dois eixos da face, aquele cuja projeção mais combina com o arraste; eixo = normal da face × direção do arraste; em cubos grandes gira a camada que você pega (camadas internas 2R, 3R…, a camada do meio de tamanhos ímpares M / E / S). Os outros quebra-cabeças usam `dragMoves` (abaixo). No toque o canvas tem `touch-action: none`, então a página não rola |
| Arrastar no vazio | Gira a visão (clique duplo redefine) |
| Teclado | `U D L R F B` (Shift = anti-horário); prefixo numérico escolhe a camada (`2` `R` → 2R); prefixo `w` para giros largos (`3` `w` `R` → 3Rw); `M E S` em tamanhos ímpares; rotações `x y z` (2×2 e 4×4+); Ctrl+Z / Backspace desfaz, Ctrl+Y / Ctrl+Shift+Z refaz; Esc limpa o prefixo. A notação segue a pegada atual (a camada de cima na tela é sempre U) |
| Campo de fórmula | Qualquer fórmula (3Rw, 2R, M/E/S…), Enter executa, animada passo a passo |
| Embaralhar | 2×2 / 3×3: estado aleatório uniforme (`CubeLab.play.randomState`); 4×4+: movimentos aleatórios; Pyraminx / Skewb: estado aleatório uniforme; Megaminx: embaralhamento WCA (Pochmann) |
| Cronômetro | Começa no primeiro movimento (que não seja rotação) após embaralhar e para ao resolver; inspeção WCA de 15 s opcional (+2 após 15 s, DNF após 17 s) |
| Contagem de movimentos | STM até 3×3, BTM para 4×4+ (rotações não contam); Pyraminx / Skewb VTM; Megaminx HTM |
| Desfazer / refazer / redefinir / resolver a partir do estado atual | «Resolver» volta ao modo de resolução e resolve o estado atual, reproduzido normalmente (essa tentativa não é cronometrada) |

- O melhor tempo de cada quebra-cabeça fica em `localStorage` (`cubelab.best.<quebra-cabeça>`). Ao resolver há um destaque leve + som de resolvido (segue o seletor de efeitos) + um giro de exibição (segue o seletor de rotação automática).
- Implementação: `js/core/play-core.js` (lógica pura, testável no Node), `Player.pushMove / popMove` (animação em fila, acelera quando acumula, nunca perde movimentos), `View3D.pick / dragTurn / setPlayMode` e o controle de modo em `app.js`. O grafo é atualizado passo a passo junto com a visão 3D.

## Pyraminx e Skewb

Ambos são plugins completos (`puzzles/twisty/`): modelo, validação, 3D, editor de planificação, visão de grafo, resolvedor estritamente ótimo, jogo livre, 12 idiomas.

- **Modelo** (`twisty-model.js`, compartilhado por página / worker / Node): os adesivos são gerados a partir da geometria (Pyraminx: 9 triângulos por face; Skewb: 1 quadrado + 4 triângulos de canto por face); a permutação de cada movimento = girar em 120° em torno do eixo os centroides e normais dos adesivos da camada e reencontrar os adesivos. Notação WCA: Pyraminx `U L R B` (duas camadas) + `u l r b` (pontas); Skewb `R U L B` (R = canto baixo-direita-trás, U = cima-esquerda-trás, L = baixo-esquerda-frente, B = baixo-esquerda-trás; o canto cima-direita-frente é fixo).
- **Resolvedor ótimo** (`twisty.worker.js?p=…`): estado de cores → peças + orientações, separadas por classe de peça em componentes independentes; primeiro um BFS acha o conjunto alcançável e as tabelas de movimentos de cada componente, depois um BFS completo no espaço produto (tabela de distâncias `Uint8Array`); a solução desce pela tabela, então seu comprimento é exatamente a distância mínima (VTM: cada giro de 120° conta 1). As pontas do Pyraminx comutam com tudo e são ajustadas no fim com 0 / 1 movimento cada (continua ótimo).

| | Estados (núcleo) | Componentes | Número de Deus medido | Tabela | Construção (Node / navegador com início do worker) | Resolução |
|---|---|---|---|---|---|---|
| Pyraminx | 933.120 (× 81 pontas = 75.582.720) | arestas 11.520 × centros axiais 81 | 11 (15 com pontas) | 0,93 MB | ≈ 60 ms / ≈ 250 ms | ≈ 0,03 ms |
| Skewb | 3.149.280 | centros 360 × cantos 8.748 | 11 (90 antípodas) | 3,15 MB | ≈ 180 ms / ≈ 400 ms | ≈ 0,01 ms |

  As tabelas são construídas no navegador (mais rápido do que baixar uma tabela compactada), então nenhum recurso extra é necessário. `tests/twisty.test.js` verifica: todo movimento ao cubo = identidade, cancela com o inverso, move peças inteiras; produto dos componentes = quantidade alcançável pelo BFS (componentes independentes); contagens por camada; a tabela é uma estratificação BFS consistente; estados aleatórios resolvem com comprimento = distância da tabela; o validador rejeita arestas invertidas / cantos torcidos / duas peças trocadas / combinações de cores impossíveis / pegada errada.
- **3D**: cada peça é um poliedro convexo sólido (forma ∩ semiespaços dos planos de corte: dois por vértice no Pyraminx, 4 planos pelo centro no Skewb); um giro rotaciona a camada inteira, as faces de corte deslizam no próprio plano e nunca se cruzam; os adesivos são triângulos / quadrados recuados e arredondados.
- **Visão de grafo**: as órbitas de adesivos de cada giro de 120° são 3-ciclos, desenhados como o círculo que passa pelos 3 nós. Nós do Pyraminx = centros dos adesivos na planificação (os vértices U / L / R são centros de grupos de círculos concêntricos, os círculos da camada B cercam a planificação inteira); o Skewb usa uma projeção azimutal equidistante a partir do canto DBL (a camada B são círculos concêntricos, R / U / L formam três pétalas).
- **Editor de planificação**: polígonos SVG (clique / arraste para pintar, Enter pinta pelo teclado, erros com contorno vermelho). Pyraminx: face frontal no centro, faces esquerda / direita nos lados, a base embaixo; Skewb: a mesma cruz do cubo.
- **Jogo livre**: ao arrastar um adesivo escolhe-se, entre os movimentos candidatos, aquele em que a velocidade instantânea desse adesivo mais combina com o arraste (mesmo eixo: o de menos peças, então arrastar uma ponta gira só a ponta); teclas `U L R B` / `R U L B` (Shift = anti-horário), no Pyraminx `T` e depois uma letra = ponta; embaralhar = estado aleatório uniforme; cronômetro / melhores tempos como nos cubos.
- **Reconhecimento por câmera / foto**: ainda não disponível (adesivos triangulares / rômbicos precisam de novas grades de amostragem e coloração com restrições de peças); esses quebra-cabeças escondem a aba de escaneamento e pedem para pintar.

## Megaminx

Um plugin completo em `puzzles/megaminx/` (código próprio, MIT): `megaminx-model.js` (geometria, movimentos, validação; compartilhado por página / worker / Node), `megaminx.js` (plugin: 3D, planificação, grafo, notação, jogo livre), `megaminx-solver.js` (resolvedor em várias fases), `megaminx.worker.js` e `megaminx-ll.json` (tabela da última camada, gerada offline por `tools/megaminx-ll-gen.js`).

- **Modelo**: 12 faces × 11 adesivos = 132 adesivos, 62 peças (12 centros, 30 arestas, 20 cantos). Movimentos de face `U F R L BL BR D DR DL B FL FR` com `X X' X2 X2'` (72° / 144°, horário visto daquela face); movimentos WCA Pochmann `R++ R-- D++ D--` (tudo exceto a camada L / U girado em 144°). A permutação de cada movimento é obtida girando centroides e normais dos adesivos. Validação: contagem de cores, peças impossíveis ou duplicadas, cantos torcidos, arestas invertidas, paridade da permutação e arranjo dos centros (`v.megaCenters`).
- **Resolvedor** (várias fases, não ótimo, HTM no estilo WCA: qualquer giro de face de 72° ou 144° conta 1):
  1. Após a validação, o estado é girado / reetiquetado para que os centros sigam o esquema padrão e convertido em códigos de peça (canto: posição × 3 orientações, aresta: posição × 2).
  2. **F2L, face por face**: D, as cinco faces do anel em volta de D e depois quatro das cinco faces superiores. Quando todas as peças de uma face estão no lugar, essa face não é mais girada, então o conjunto de movimentos S encolhe e as peças não tocadas continuam resolvidas. As peças novas de cada etapa são divididas em pequenos grupos (≤ 3 peças: um canto e suas arestas adjacentes); cada grupo é resolvido com IDA*, cuja heurística é o máximo de pequenas tabelas de distâncias de grupos de peças (BFS sob o S atual, construídas no primeiro uso e guardadas em cache). Antes da última etapa de duas faces entra uma tabela de orientação de arestas (como a EO `<R,U>` do 3×3), para que essa etapa termine com dois geradores. Um limite de nós com novas tentativas (usando a próxima solução do grupo anterior) mantém curtos os raros casos lentos.
  3. **Última camada em dois passos** por tabela: passo 1 = permutação de arestas + orientação de arestas + orientação de cantos (60 · 16 · 81 = 77.760 estados), passo 2 = permutação de cantos × permutação de arestas (3.600 estados). O gerador busca em subgrupos de três faces `<U,X,Y>` com encontro no meio (≤ 7 movimentos por lado) sequências que mantêm todas as peças fora de U, guarda a mais curta por efeito mais suas 5 rotações em U (39.059 macros) e roda Dijkstra com custo HTM.
  4. Movimentos adjacentes da mesma face são unidos (unidades de 72° mod 5).
- **Medido** (Node, `tests/megaminx.test.js` / benchmark): 1.000 estados aleatórios, todos resolvidos: média 120,1 HTM (F2L 95,4 + última camada 26,4), máx. 135, mín. 97; tempo médio 34 ms, máx. 1,6 s. 500 embaralhamentos Pochmann: média 119,7, máx. 135, média 29 ms, máx. 0,9 s. No navegador uma resolução costuma levar 2–20 ms mais a sobrecarga do worker; início do worker + carga da tabela ≈ 170–200 ms. Os números estão em `seo/site.config.json` e aparecem nas páginas de SEO.
- **3D**: `view3d.geometry: 'poly'` com o dodecaedro como `solid` e os 12 planos de corte como `cuts`; as peças são poliedros convexos.
- **Visão de grafo**: projeção estereográfica das posições dos adesivos a partir do centro de D (esse nó fica oculto). Cada giro de face de 72° move seus adesivos em 5-ciclos, e os 5 pontos de cada ciclo ficam sobre um círculo na projeção (a projeção estereográfica leva círculos em círculos), então cada órbita é desenhada como o círculo circunscrito do seu 5-ciclo: 39 círculos, 131 nós visíveis. A face U branca fica no meio, as faces superiores em volta e as inferiores como grandes pétalas externas; o zoom mostra o centro denso.
- **Editor de planificação**: duas «flores» de 6 pentágonos lado a lado (U com suas 5 vizinhas, D com suas 5 vizinhas), polígonos SVG como nas outras formas.
- **Jogo livre**: arrastar (`dragMoves` genérico), teclas `U F R L B D` mais `I`=BL, `O`=BR, `J`=FL, `K`=FR, `N`=DL, `M`=DR (Shift = anti-horário); contagem HTM; embaralhar = embaralhamento WCA Pochmann de 77 movimentos (7 linhas de `R±± D±±` × 5 + `U`/`U'`); «resolver a partir do estado atual» funciona como nos outros quebra-cabeças.
- **Escaneamento com câmera**: oculto (`cameraPlan: null`).
- **Nomes**: 五魔方 (zh), メガミンクス (ja), Мегаминкс (ru), ميغامينكس (ar), Megaminx nos demais; no menu vem logo depois do Skewb.

## SEO: uma página estática por quebra-cabeça × idioma

- **Configuração única**: `seo/site.config.json` (`baseUrl` = a URL de produção; canonical / hreflang / sitemap / OG derivam dela, então um domínio novo só exige essa mudança e gerar de novo) mais as contagens de movimentos medidas.
- **Rotas** (`js/seo-routes.js`, compartilhado pelo navegador e pelos scripts de geração): inglês na raiz, os outros idiomas em `/<idioma>/`; um caminho limpo por quebra-cabeça: `/` (entrada principal, x-default), `/2x2-cube-solver/` … `/15x15-cube-solver/`, `/pyraminx-solver/`, `/skewb-solver/`, `/megaminx-solver/`; ex.: `/zh-hans/3x3-cube-solver/`, `/ja/megaminx-solver/`. No total 12 idiomas × 18 = 216 páginas.
- **Textos**: `seo/lang/<code>.json` (12 idiomas, títulos escritos para os hábitos de busca locais), com modelos por tipo de quebra-cabeça e as contagens medidas.
- **Geração**: `npm run build:seo` (`tools/build-seo.js`) grava a página raiz em inglês entre os marcadores `<!--seo:*-->` de `index.html` e as demais páginas em `seo/out/`, além de `robots.txt`, `sitemap.xml` (com alternativas xhtml:link) e `manifest.webmanifest`; acrescenta `?v=<hash do conteúdo>` aos js/css referenciados pelo HTML. Ícones e imagens OG (1200×630, uma por quebra-cabeça, a partir de capturas reais do 3D + grafo): `npm run build:seo-images` (precisa do servidor local; `OG_ONLY=root,megaminx` limita a algumas imagens).
- **Por página**: title / description / canonical / 13 links hreflang (incl. x-default) / OG / cartão do Twitter / ícones / manifest / JSON-LD (WebSite, WebApplication (grátis, sem avaliações), WebPage, BreadcrumbList, HowTo, FAQPage, idêntico palavra por palavra ao texto visível), um `<h1>` estático, texto rastreável (como usar, resolvedor e contagens medidas, notação, explicação do grafo, FAQ, links para todos os quebra-cabeças), uma nota `<noscript>`.
- **Em execução** (`js/seo-nav.js`): as páginas pré-selecionam idioma e quebra-cabeça via `<html data-page-lang data-page-puzzle>`; trocar de quebra-cabeça ou idioma no app passa para a URL limpa correspondente com `history.replaceState` e pega título / meta / JSON-LD / corpo da página pré-renderizada, sem recarregar nem perder o estado. A raiz `/` continua seguindo o idioma do navegador / a última escolha.
- **Links antigos**: `/?puzzle=…`, `/?n=…`, `/?lang=…` recebem 301 para os novos caminhos a partir de `deploy/worker.js` (roda só nas rotas de página; recursos estáticos ficam de fora via `run_worker_first`; sem `?lang` o idioma vem do Accept-Language, com `Vary: Accept-Language`); os outros parâmetros (`mode`, `hold`, `start`) são mantidos. Localmente, sem o worker, `seo-nav.js` reescreve o endereço no cliente.
- **Testes**: `node tests/seo.test.js` (estático: title/description únicos nas 216 páginas, canonical, links hreflang cruzados completos, JSON-LD analisável e coerente com o conteúdo visível, sem avaliações, tamanhos das imagens OG, links internos, sitemap/robots/manifest, redirecionamentos do worker); `npm run test:seo:live` verifica cada página em produção.

## Executar

```bash
cd cube-solver
npm install
npm start                        # node tests/serve.js 8765 (sends COOP/COEP headers)
# open http://localhost:8765/
```

> A câmera precisa de um **contexto seguro**: `https://` ou `http://localhost`. Por um IP da rede local (ex.: `http://192.168.x.x`) o navegador desativa a câmera; use «Enviar foto».
> Web Workers não funcionam em `file://`; abra sempre o site por um servidor HTTP.

## Testes

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

Cobertura E2E: embaralhamento aleatório → resolver → reproduzir até o fim (6 grupos de uma cor no grafo, cada face 3D de uma cor), busca / anterior / próximo no player, pintura e todo tipo de erro de validação, entrada de fórmula, reconhecimento de 6 fotos sintéticas (dominantes de cor, gradientes de luz, ruído, reflexos), o caminho da câmera falsa do Chromium, layout móvel e capturas. `tests/graph-preview.html` é uma página independente para depurar layouts do grafo (`?scr=fórmula&mv=R&e=0.5`). `node tests/compare-ref.js` grava comparações lado a lado com os quadros de referência (`ref/f14`, `f07`, `f01`) em `screenshots/compare-*.png`; `tests/graph-pixel.html` desenha o grafo com o mapeamento de pixels do quadro de referência para sobreposições em nível de pixel.

## Estrutura de diretórios

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

## Pontos de extensão (arquitetura)

Os módulos centrais (entrada, visão de grafo, 3D, player, escaneamento, cliente do resolvedor) funcionam **apenas** por meio do objeto Puzzle registrado com `CubeLab.registerPuzzle(def)` e não contêm lógica específica do 3×3. Um novo quebra-cabeça vai em `puzzles/<id>/` e implementa a interface abaixo.

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

No registro, o núcleo preenche `parse / format / apply / inverse / isSolved` padrão, as peças que cada movimento gira (decididas por `layer`), as **trilhas do grafo** (`P.tracks`) e os caminhos de adesivos de cada movimento (`moves[tok].paths`).

Campos opcionais usados pelas outras formas: `trackMode: 'cycles'` (trilhas = ciclos das permutações dos movimentos base), `netLayout.polys` (planificação de polígonos SVG), `view3d.geometry: 'poly'` + `solid` / `cuts` / `core` (peças poliédricas convexas), `dragMoves` (arraste genérico), `playKeys` / `playMetric` / `metricTitle`, `hints` (chaves i18n das dicas), `randomState(rnd)` (estado aleatório uniforme), `randomScramble()`, `nameKey`; `cameraPlan: null` esconde a aba de escaneamento e, sem `holds`, o menu de pegada fica oculto.

### Trilhas do grafo e movimento (`CubeLab.buildTracks` + `GraphView`)

Para cada movimento base: pegam-se os adesivos movidos, agrupados por «normal do adesivo · eixo» (no 3×3: «os 8 da face» e «os 12 dos lados»), cada grupo é ordenado pelo ângulo em torno do eixo num anel fechado; um giro de θ avança os adesivos do anel `θ/2π × n` posições, conferido com `perm`.

O `graphLayout()` do plugin fornece as posições 2D dos nós e, opcionalmente, `circles: [{id, cx, cy, r}]`:
- se todos os nós de uma trilha lateral estão num círculo, eles se movem **ao longo desse círculo** (mesmo sentido em toda a trilha; o sentido com menor percurso total no movimento base, invertido no inverso) com rastros coloridos;
- os nós de uma trilha de «face» são interpolados em coordenadas polares em torno do nó central da face (o grupo gira em bloco);
- sem círculos usa-se uma spline fechada pelos nós, então outros quebra-cabeças podem ser visualizados sem layout feito à mão.

**Layout do 3×3** (a configuração `GL` em `puzzles/cube3/cube3.js`): os três grupos de círculos concêntricos são os eixos y (U/E/D), z (F/S/B) e x (R/M/L), centrados nos vértices de um triângulo equilátero (topo, inferior esquerdo, inferior direito), raios 1,3922 / 1,7696 / 2,1469 (raio circunscrito do triângulo = 1). Esses valores são um ajuste por mínimos quadrados a **todos os 54 nós** de um quadro de referência em alta resolução (resíduo RMS 0,2 px); raio do nó 0,184, traço 0,048, largura da trilha 0,063 e largura do destaque 0,076 vêm de medições em pixels do mesmo quadro. Desenhado com o mapeamento de pixels do quadro de referência e sobreposto a 50 %, círculos e nós coincidem quase exatamente (`tests/graph-pixel.html`). Os adesivos da face X ficam nas interseções dos grupos de círculos dos dois eixos diferentes da normal de X; as duas regiões de interseção abrigam um par de faces opostas. O sentido camada→raio (`sign`) e a região de interseção de cada face (`upper`) foram verificados exaustivamente (64 combinações): cada um dos seis giros de face é um deslocamento cíclico de 12 nós num único círculo. Os movimentos de camada do meio M/E/S são movimentos reais (gerados a partir da geometria em `moves`; o mesmo gerador reproduz exatamente as 6 permutações de face, verificado num teste unitário) e percorrem o círculo do meio do seu grupo. O resolvedor só produz movimentos de face.

**Roteamento dos arcos (conferido quadro a quadro com o vídeo de referência)**: os 12 nós de cada círculo pertencem a 4 setores de face espaçados cerca de 60°/60°/60°/180°. Com «menor percurso total» como regra de sentido, um giro de 90° move 9 adesivos por arcos de ≈ 60° e **os 3 adesivos de um setor atravessam o arco vazio de 180°** (ex.: o arco superior do círculo externo, o grande arco esquerdo do grupo inferior esquerdo). O vídeo de referência faz exatamente o mesmo (`screenshots/compare-motion.png`, segunda linha). As posições dos setores são fixadas por «layout resolvido = referência f14», então nenhuma outra atribuição deixa todos os arcos curtos.

**Tempo e suavização (medidos pela energia de movimento a 60 fps do vídeo de referência)**:
- suavização por passo `easeInOutQuad` (ajustada à curva média de velocidade de 15 giros, RMS 0,076; sine 0,155, cubic 0,193);
- a reprodução contínua tem um envelope «início lento – aceleração – fim lento»: primeiro passo ≈ 0,85 s, meio 0,48 s, último ≈ 1,0 s, apenas ≈ 0,07 s entre passos (`CubeLab.tempo(i, n)`, `Player.baseMs = 480`, `gapMs = 67`; um «próximo» isolado é fixo em 0,55 s);
- o destaque do círculo ativo aparece nos primeiros 8 % do giro e some nos últimos 16 %; os rastros coloridos se estendem para trás a partir do nó (fase da cauda `ease(1.6t − 0.6)`) e desaparecem no fim;
- depois de resolver, ≈ 1,2 s parado e então um giro de exibição de 2,0 s.

### Pegadas (ponto de vista da notação)

O estado interno, os resolvedores e a entrada de fórmulas sempre usam a pegada WCA (branco U, verde F). Um plugin pode fornecer `holds`: cada pegada dá uma orientação 3D geral e uma tabela de renomeação da notação. O padrão do 3×3, «amarelo em cima, verde na frente» = a pegada padrão girada 180° em torno do eixo frente–trás (z2): `U↔D`, `R↔L`, `F/B` inalterados, `M→M′`, `E→E′`, `S` inalterado (testes unitários conferem cada um: o eixo × ângulo do movimento interno, girado pela orientação, é igual ao eixo × ângulo do movimento exibido). O texto da solução, o passo atual do player, a lista de passos e as descrições usam a notação da pegada atual, então a camada de cima na tela se chama U.

### Estilo 3D e visão

- `view3d.style: 'plastic'`: corpo cinza-claro + painéis brancos (juntas finas cinza-claro) + adesivos arredondados de cor chapada (sem iluminação, mesmas cores do grafo) + sombreado suave no corpo; sem ele, o estilo plano clássico com corpo preto.
- `stickerCorners: [sup.-esq., sup.-dir., inf.-dir., inf.-esq.]`: raios dos cantos dos adesivos (formas de folha assimétricas são possíveis); `stickerColors` substitui as cores 3D dos adesivos.
- `orientation` (ângulos de Euler, substituídos pela pegada atual) + `camera: { fov, dir }`: a visão padrão do 3×3 é igual à do vídeo de referência — amarelo (D) em cima, verde (F) à esquerda, laranja (L) à direita —, que são os três grupos do triângulo central do grafo. Perspectiva FOV 24°, cerca de 25° de elevação, ajustada por comparação de pixels com os quadros de referência.
- `frame: { width, height, dx, dy }`: enquadramento (tamanho e deslocamento do quebra-cabeça / grafo em seus meios painéis), igual ao vídeo de referência com menos de 0,5 % de diferença.
- `autoRotate`: o quebra-cabeça balança levemente durante a reprodução; quando a reprodução chega ao fim num estado resolvido, ele descansa `showcaseDelay` (1,2 s), dá uma volta em `showcaseMs` (2,0 s) e retorna à visão inicial (como no fim do vídeo de referência). O seletor «rotação automática» do player desliga isso; girar arrastando e redefinir com clique duplo sempre funcionam.

### Som (`js/core/audio.js`, `CubeLab.SoundEngine`)

Tudo é sintetizado ao vivo com a Web Audio API; não há arquivos de áudio nem recursos de terceiros.
- **Política de reprodução automática**: nenhum `AudioContext` ao carregar a página; ele é criado e recebe `resume()` no primeiro `pointerdown / keydown / touchstart`. Efeitos ligados e música desligada por padrão; «efeitos / música / volume» ficam em `localStorage` (`cubelab.sfx / cubelab.music / cubelab.vol`). Se a música estava ligada antes de recarregar, ela espera o próximo gesto do usuário. Sem Web Audio toda chamada não faz nada e os controles ficam desativados.
- **Som de giro v3** (gancho `Player.onMove(phase, tok, durMs)`): refeito a partir da análise de três gravações reais de 3×3 (veja `user-sounds/ANALYSIS.md`, `screenshots/sound-compare.png`). Um giro real = um trem de 120–200 ms de grãos de plástico agrupados (≈ um a cada 5 ms) que excitam modos curtos do corpo: pico principal 0,86–1,1 kHz («oco / amadeirado») + 500 Hz, 1,55, 2,8, 4,1 kHz, ressonância de só 3–6 ms, quase nenhum baque abaixo de 300 Hz; a energia cresce até o clique mais forte quando a camada encaixa, seguido de um chocalhar de 70–100 ms que se apaga. Síntese: eventos de grão gerados em JS → 10 ressonadores de segunda ordem (cada grão excita modos diferentes ao acaso) + uma camada fina de microgrãos + atrito muito leve + uma borda direta de banda larga; o clique de encaixe é alinhado ao fim da animação, a reprodução lenta concentra o som no fim, giros de 180° acrescentam um clique de trava em T/2, camadas do meio soam mais suaves e escuras; cada som é gerado em 1,7–3,3 ms. Comparado com gravações reais (material de SpaceJoe / Pixabay, mesma análise): centroide 2141 Hz contra 2135 / 2077 Hz, fator de crista 20,7 contra 21,1 / 17,6 dB, planicidade 0,24 contra 0,25 / 0,32, 18,5 contra 17,8 / 12,0 grãos por 100 ms, diferença de forma em terços de oitava ≈ 2 dB. Nenhum arquivo de áudio é publicado (as gravações foram usadas só na análise; licenças em `vendor/sounds/LICENSE.txt`). Proteção para reprodução rápida: pelo menos 50 ms entre sons de giro; giros mais curtos soam mais baixo e com menos grãos; arrastar a linha do tempo interrompe na hora os sons de giro não terminados.
- **Resolvido**: um arpejo maior ascendente + acorde (quando a reprodução chega ao último passo num estado resolvido); um brilho ascendente suave quando começa o **giro de exibição** (`View3D.onShowcaseStart`).
- **Interface**: toques de pintura (a altura acompanha a cor, limitados ao pintar arrastando), avisos de captura / envio bem-sucedido (três tons quando as seis faces terminam).
- **Música de fundo**: 72 BPM, laço de quatro compassos Cmaj9 – Am9 – Fmaj9 – G6sus; serras desafinadas com passa-baixa como base + arpejos pentatônicos (pseudoaleatórios determinísticos), delay com realimentação para dar espaço; agendamento antecipado (0,6 s na fila a cada 150 ms), laço sem emendas, entra e sai com fade, volume muito baixo.
- Níveis (volume 0,8, medidos offline): um giro isolado em 1× tem pico de cerca de 0,31–0,36, na velocidade real da mão (130 ms) cerca de 0,22, o arpejo de resolvido cerca de 0,23, a música de fundo tem picos perto de −22 dBFS. Demonstrações (só local): `screenshots/sound-demo-turns.wav`, `sound-demo-turns-v3.wav`, `sound-demo-sfx.wav`, `sound-demo-music.wav`.

### Idiomas (`js/i18n/`, `CubeLab.i18n`)

- **Idiomas e ordem**: English, 简体中文, 繁體中文, Español, العربية, Português, Bahasa Indonesia, Bahasa Melayu, Français, 日本語, Русский, Deutsch (todas entradas iguais no menu, sem grupos).
- **Textos**: um arquivo por idioma, `js/i18n/<code>.js`, chamando `CubeLab.i18n.register(code, {key: text})`; `en.js` é a tabela mestre, chaves ausentes recorrem ao inglês e ficam registradas em `CubeLab.i18n.missing`. O HTML usa `data-i18n` / `data-i18n-title` / `data-i18n-aria` / `data-i18n-placeholder`; texto dinâmico usa `I.bind(el, key, params)` e é redesenhado ao trocar de idioma.
- **Formatação**: um subconjunto do ICU — `{name}`, `{n, plural, =0 {…} one {# …} few {…} many {…} other {…}}` (`Intl.PluralRules`), `{ms, unit, millisecond}`, `{x, number}` (`Intl.NumberFormat`). O francês recebe espaços não separáveis antes de `: ; ! ? « »` automaticamente; o espanhol usa ¡ ¿. A notação de movimentos mantém as letras padrão em todos os idiomas (U D L R F B M E S, ′ 2).
- **Ordem de detecção**: `?lang=xx` → `localStorage['cubelab.lang']` → `navigator.languages` (zh-TW/HK/MO/Hant → tradicional, outros zh → simplificado) → English. Define `<html lang dir>`, o título e a meta description.
- **RTL**: o árabe espelha a página inteira (propriedades lógicas do CSS); o canvas 3D, o grafo, a linha do tempo / controles do player, a faixa de passos, a notação, a entrada de fórmula e os números continuam LTR (`dir="ltr"`).
- **Tipografia**: CJK / árabe usam suas próprias pilhas de fontes, entrelinha maior e sem espaçamento entre letras; alemão / russo ativam `hyphens:auto`, e os botões podem quebrar linha em vez de transbordar.
- **Adicionar um idioma**: acrescente uma entrada em `LANGS` no `i18n.js`, crie `js/i18n/<code>.js` e inclua-o no `index.html`, depois rode `node tests/i18n.unit.test.js`.

### Adaptadores de resolvedor

```js
solvers: [
  { id: 'kociemba', name: '…', available: true,
    workerUrl: 'puzzles/cube3/kociemba.worker.js',
    encode: state => payload },          // runs on the main thread; throws a localized error for invalid states
  { id: 'optimal-ida', name: 'IDA* optimal (planned)', available: false }
]
```

Protocolo do worker:

```
→ { id, cmd: 'init' }                      ← { id, ok: true, ms }
→ { id, cmd: 'solve', payload }            ← { id, ok: true, moves: ['R', "U'", ...], optimal?: bool, label?, note?, ms }
                                           ← { id, ok: false, error }
```

Um quebra-cabeça pode ter vários resolvedores; o menu os lista automaticamente, e `available: false` aparece como «planejado». Acrescentar um resolvedor realmente ótimo (ex.: IDA* de Korf com bancos de padrões de cantos / arestas) só exige um novo worker registrado em `solvers`. Um worker pode devolver `optimal: false` com uma chave i18n `label` / `note` (o Megaminx faz isso), que a interface mostra ao lado da contagem de movimentos.

### Outras visões

O player (`CubeLab.Player`) controla qualquer número de visões; uma visão só implementa `setState(state)` e `animate(tok, e, fromState, t)` (e = progresso suavizado 0–1, t = fase de tempo bruta) e, opcionalmente, `highlight(tok, state)`. Uma nova visualização (ex.: um grafo de Cayley ou um diagrama de ciclos) só precisa desses métodos.

## Bibliotecas de terceiros

- [gullicube](https://github.com/rokicki/gullicube) (Tomas Rokicki, usado sob a opção MPL-2.0, código não modificado; veja `vendor/gullicube/NOTICE.md`)
- [cubejs](https://github.com/ldez/cubejs) (MIT) — algoritmo de Kociemba em duas fases. `vendor/solve.js` tem um pequeno patch (`vendor/solve.js.cubelab.patch`): um prazo opcional para `solve(maxDepth, deadline)` e uma exceção em vez de uma falha com null quando nada é encontrado, usado no encurtamento iterativo dentro do limite de tempo.
- [three.js](https://threejs.org/) r160 (MIT) — renderização 3D (compilação UMD `three.min.js`; o console avisa que essa compilação está obsoleta, o que não importa aqui).
- Os resolvedores de Pyraminx, Skewb e Megaminx e a tabela de última camada do Megaminx são código e dados próprios do projeto (MIT). Nenhum código GPL, do csTimer ou do TPR é usado.

## Limitações conhecidas

- Pyraminx / Skewb / Megaminx: ainda sem reconhecimento por câmera / foto. Ao pintar, segure o quebra-cabeça como as dicas indicam (Pyraminx: a peça axial sem amarelo em cima, a sem verde atrás; Skewb: o canto branco-verde-vermelho em cima-direita-frente; Megaminx: os centros devem formar o esquema de cores padrão); caso contrário aparece um erro de pegada / centros.
- As soluções do Megaminx **não são ótimas** (≈ 120 HTM em média, até ≈ 135); algum estado difícil leva até ≈ 1,6 s; a tabela de última camada de 1,8 MB (`megaminx-ll.json`, compactada na transferência) é baixada uma vez quando o resolvedor do Megaminx inicia.
- A câmera precisa de HTTPS ou localhost; o reconhecimento depende da iluminação — corrija o resultado na planificação sob reflexos fortes ou luz amarelada (as cores dos centros são usadas para calibrar e toleram alguma dominante de cor).
- O escaneamento supõe o esquema de cores padrão (branco oposto ao amarelo, verde ao azul, vermelho ao laranja) e a pegada guiada; os centros são fixos no editor.
- O resolvedor 3×3 só produz movimentos de face (HTM); as soluções do vídeo de referência incluem camadas do meio, então a sequência de passos para o mesmo estado será diferente da do vídeo.
- O algoritmo em duas fases dá soluções quase ótimas (geralmente 19–21 movimentos); só estados com ≤ 8 movimentos recebem uma solução comprovadamente ótima. Um resolvedor ótimo de nível «número de Deus» fica como extensão.
