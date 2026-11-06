# Rodada 8 — celular, som e primeira impressão

## Achado → correção → prova

- **Toque cobria plataformas; portrait ilegível e sem aviso.** Controles64px nas faixas laterais, pausa/som44px, HUD compacto; em pé, “Gire o celular” congela o relógio. **`cc5c73c`**. Playwright `hasTouch/isMobile`, contatos reais via CDP em **844×390,932×430,390×844**; sem sobreposição controles/arena, zoom ou scroll. Portrait testado congelado e depois girado para jogar.
- **Pausa reaproveitava dedo antigo e voltava a sacar.** Reset dos IDs/estado em pausa, blur, rotação, cancelamento/perda de captura; segundo dedo não solta o primeiro. **`cc5c73c`**. Regressões: andar+carregar a7,8tiles/s, soltar atira enquanto continua andando; pausa/cancel/blur/capture/rotação mantêm3 flechas, novo gesto funciona; pulo/dash reais. Fixtures de posição inicial explícitas, bots ativos; sem fuzz.
- **Countdown não ensinava e ajuda dizia teclado obrigatório.** Dica curta de controles no primeiro round, ajuda touch correta; dica acima dos nomes. **`84a0266`**. Link frio local/cache desativado: **1 clique inicia / 2 gestos até o tiro**; desktop **1,80s**,844×390 **1,87s**,932×430 **1,75s**,portrait→girar **2,22s** (inclui350ms congelados de teste). Não é medição em4G nem de tempo de leitura humano.
- **Soltura Mizu29dB abaixo de Storm; mix saturava.** Normalização dos samples, música−8dB, corda reforçada e saturador suave com oversampling. **`05c1a11`**. `OfflineAudioContext`, sem ouvir: **19 sinais** (corda, solturas, pedra/madeira, catch, baú, bomba, raio, abate, vitórias, música e demais ações), nenhum ausente. Mix fixo4 jogadores: **pico1,811/448 amostras clipadas →0,874/zero**. Música inteira126s e vitória Storm5s analisadas; sem falhas de carregamento. Mede sinal, não julgamento auditivo subjetivo.

## Prova final

**0 erros** página/console/HTTP nos relatórios finais; modelos carregados, áudio sem falhas. Desktop1600×900, tempo real1×, qualidade normal:

| Mapa | FPS real | Diagnóstico |
|---|---:|---:|
| Musgo |60,002|59,399|
| Totem |60,002|59,159|
| Copas |60,002|59,279|
| Cachoeira |60,002|59,397|
| Raízes |60,002|59,396|

Uma partida **P1 humano+3 bots** encerrada para cada entrada mobile: rounds13/13/8, vencedor com5 pontos. Primeiros ~3s pilotados por toque a1×; conclusão a24× sem novos gestos, não alegada como partida inteira pilotada. Celular é emulação Chromium, não teste em aparelho/Safari.

Fontes: `evidence/rodada-8/{mobile,touch-regressions,desktop,audio,story}-report.json`; baseline em `antes/`. **Todos os PNGs conferidos**, diretamente ou nas folhas `conferencia-*.jpg`. Arquivos `*-apos-girar-390x844.png` mostram a partida após girar para844×390, não jogo vertical. Crítica antes/depois em `ficha-tela.md`.

Build, check:storybook, build-storybook passaram. Stories reais de toque/menu nos cinco viewports; siTela aprovado, com exceção declarada da área da arena escondida em portrait. `src/sim` intocado; **sem suíte inteira/npm test/fuzz**.

Tudo em **tla**, via `/tmp/tla-prova.sh` e fila pesada, GPU NVIDIA real/render privado isolado; **não60FPS da transmissão Xvnc**. Registros dono/PID em `web-events.ndjson`; finally encerrou páginas/navegadores/servidores. Higiene final: **0 abas próprias**,2 preexistentes preservadas, vaga liberada. O primeiro comando foi barrado pelo assert DISPLAY antes de abrir browser; helper CDP e duas expectativas de teste foram corrigidos (touchEnd libera IDs, atrito leva tempo, captura é processada no próximo pointerevent).

Commits no **rodada-astra**, **sem push/publicação**. `evidence/rodada-2/` preexistente preservado fora dos commits.
