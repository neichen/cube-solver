[English](README.md) · [简体中文](README.zh-Hans.md) · [繁體中文](README.zh-Hant.md) · [日本語](README.ja.md) · [Español](README.es.md) · **Português** · [Français](README.fr.md) · [Deutsch](README.de.md) · [Русский](README.ru.md) · [العربية](README.ar.md) · [Bahasa Indonesia](README.id.md) · [Bahasa Melayu](README.ms.md)

# Cube Solver Lab

Um resolvedor de quebra-cabeças que roda inteiramente no navegador: cubos de 2×2 a 15×15, Pyraminx, Skewb e Megaminx. Ao lado do modelo em 3D, um grafo de permutações mostra cada adesivo como um nó, para você ver cada giro movendo os adesivos ao longo de círculos.

**Site: https://cube-solver.org**

## Recursos

- **Resolve** cubos de 2×2 a 15×15, Pyraminx, Skewb e Megaminx. O 2×2, o Pyraminx e o Skewb recebem soluções ótimas. O 3×3 usa o algoritmo de duas fases de Kociemba (normalmente 19–21 movimentos). Do 5×5 para cima é usado o gullicube compilado para WebAssembly multithread. O Megaminx usa um método rápido em várias fases (cerca de 120 movimentos HTM em média; não é ótimo).
- **Informe uma posição** pintando a planificação do cubo, digitando um embaralhamento (`R U R' U2 …`, com movimentos largos e de camada do meio), escaneando com a câmera ou enviando fotos.
- **Validação** que explica o que está errado: cores faltando, uma quina torcida, um meio invertido, paridade e mais.
- **Player passo a passo** com linha do tempo, controle de velocidade e atalhos de teclado, sincronizado entre a visão 3D e o grafo.
- **Modo livre** em todos os quebra-cabeças: gire camadas arrastando ou pelo teclado, com cronômetro, inspeção WCA opcional, desfazer/refazer e melhores tempos. O embaralhamento do Megaminx segue o estilo WCA (Pochmann).
- **12 idiomas**, com layout completo da direita para a esquerda em árabe, e uma página estática otimizada para buscadores para cada quebra-cabeça em cada idioma.
- **Som sintetizado**: todos os sons são gerados ao vivo com a Web Audio API, e nenhum arquivo de áudio é incluído.

## Privacidade

- As imagens da câmera e as fotos enviadas são processadas apenas no seu navegador. Elas nunca são enviadas nem armazenadas em um servidor.
- O site publicado conta as visitas com o Cloudflare Web Analytics, que não usa cookies nem coleta dados pessoais; ele é carregado para todos os visitantes. O Google Analytics 4 só é carregado depois que você clica em Aceitar no aviso de consentimento (Consent Mode v2, com armazenamento de anúncios, dados de usuário para anúncios, personalização de anúncios e Google Signals desativados); se você recusar, ele nunca é carregado, e você pode mudar sua escolha a qualquer momento pelo link “Configurações de análise” no rodapé. Configurações como idioma, som, melhores tempos e sua escolha de análise ficam salvas apenas no armazenamento local do seu navegador. A análise só conta visualizações de página: estados do quebra-cabeça e imagens da câmera nunca são enviados.
- O site é um conjunto de arquivos estáticos hospedados na Cloudflare, que processa as requisições web comuns como qualquer serviço de hospedagem.

## Executar localmente

Requisitos: Node.js 18 ou mais recente.

```bash
npm install
npx playwright install chromium   # necessário só para os testes no navegador
npm start                         # http://localhost:8765/
```

A câmera precisa de um contexto seguro (`https://` ou `http://localhost`). O servidor local envia os mesmos cabeçalhos de isolamento entre origens que o site no ar, exigidos pelo WebAssembly multithread.

## Testes

```bash
npm test               # gera as páginas de SEO e roda os testes unitários, de resolvedores e de SEO (sem navegador)
npm run test:nxn       # verificações dos resolvedores 4×4–15×15 (mais lentas)
npm start &            # os testes no navegador precisam do servidor local
npm run test:e2e       # também: test:i18n, test:play, test:twisty, test:naming, test:analytics
```

## Build e deploy

```bash
npm run build          # monta o site para deploy em dist/
```

O site é publicado como assets estáticos do Cloudflare Workers (veja `deploy/`):

```bash
export CLOUDFLARE_ACCOUNT_ID=<o ID da sua conta>
export CLOUDFLARE_API_TOKEN=<um token de API que possa editar Workers>   # ou rode: npx wrangler login
export CF_BEACON_TOKEN=<token>               # opcional: token do Cloudflare Web Analytics
export GA_MEASUREMENT_ID=G-XXXXXXXXXX        # opcional: ID de medição do GA4, carregado só após o consentimento
npm run deploy
```

- `deploy/_headers` define `Cross-Origin-Opener-Policy` e `Cross-Origin-Embedder-Policy`, necessários para o resolvedor WebAssembly multithread.
- `deploy/worker.js` só faz redirecionamentos: `www` e `*.workers.dev` para o domínio principal, e links antigos `/?puzzle=…` para os novos caminhos. Arquivos estáticos (`/js`, `/css`, `/img`, `/puzzles`, `/vendor` etc.) são servidos diretamente, sem executar o Worker, então cada visualização de página custa uma requisição ao Worker.
- Os IDs de análise não estão no repositório. `npm run build` lê `CF_BEACON_TOKEN` e `GA_MEASUREMENT_ID` do ambiente (ou de um arquivo `.env` ignorado pelo git, com linhas `CHAVE=valor`) e os grava apenas em `dist/`. Sem eles, o build não tem análise, aviso de consentimento nem rastreamento; além disso, a análise só roda no domínio de produção.
- Se você publicar sua própria cópia, altere `name` e `routes` em `deploy/wrangler.toml` e `baseUrl` em `seo/site.config.json`.

Notas para desenvolvedores: [docs/DEVELOPMENT.pt.md](docs/DEVELOPMENT.pt.md).

## Agradecimentos

A visualização em grafo que desenha o cubo como círculos foi inspirada nas animações de じゃがりきん ([@jagarikin](https://x.com/jagarikin)): [original (2022-05)](https://x.com/jagarikin/status/1524175137633095681), [com cubo 3D (2022-11)](https://x.com/jagarikin/status/1593771091738374144). Conhecemos a ideia por meio [desta publicação de @UnicornBitcoin](https://x.com/UnicornBitcoin/status/2107652690113339684). Obrigado a ambos.

## Licença e créditos

- O código deste projeto é distribuído sob a [Licença MIT](LICENSE).
- Componentes de terceiros mantêm suas próprias licenças. Os detalhes estão em [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
  - [gullicube](https://github.com/rokicki/gullicube), de Tomas Rokicki, o resolvedor para 5×5 e maiores, é usado sem modificações sob a Mozilla Public License 2.0 (uma das opções da sua licença "MPL-2.0 OR GPL-3.0-or-later"). Veja `vendor/gullicube/` e `tools/build-gullicube.sh`.
  - [cubejs](https://github.com/ldez/cubejs) (MIT), o resolvedor de duas fases do 3×3, tem um pequeno patch em `vendor/solve.js.cubelab.patch`.
  - [three.js](https://threejs.org/) (MIT) renderiza a visão 3D.

## Marca registrada

Rubik's Cube é uma marca registrada da Spin Master Ltd. Este projeto não é afiliado, patrocinado nem endossado pela Spin Master. "Rubik's" aparece apenas para descrever o quebra-cabeça.
