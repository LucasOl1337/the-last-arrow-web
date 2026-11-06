# Rodada 9 — sessão longa e robustez

## Achado → correção → prova

- **Texturas de esqueleto vazavam a cada revanche:** oito partidas antes: **50→157 texturas**. Corpo/outline e três fantasmas por lutador não descartavam `Skeleton.boneTexture`; terreno também esquecia os buffers próprios de `InstancedMesh`. **`23e6372`** libera esses recursos, preservando geometria/albedo compartilhados. Duas regressões focadas passaram. Depois: **50,50,53,54,54,54,54,54**; geometrias retornam a53 no Musgo e58 no Totem, programas estabilizam por tema (42–55).
- **WebGL restaurado ficava no erro para sempre:** **`df04d7d`** congela preservando mundo/placar, cancela saque e retorna pausado após restauração. `WEBGL_lose_context`: tick **433→433**, Continuar retoma, **60,003FPS**, sem reload/tela preta persistente. Resize em1366×768,900×1000,844×390,1600×900 passou; tamanho zero é ignorado.
- **Assets falhavam sem explicar; stone404 deixava plataformas pretas:** fallback visível + aviso compacto para modelos/texturas/áudio. Quatro404 injetados por route (`mizu.glb`, `stone.jpg`, `templo.jpg`, `mizu_shoot.wav`), jogo e nova partida continuam. `?map=nao-existe` abre Musgo e avisa. **12 registros HTTP/console esperados, zero inesperados**.
- **Áudio/listeners:** não havia vazamento confirmado, portanto sem reescrever o grafo. Após cada partida: **5 nós vivos / 41 listeners** constantes (40 antes do handler de restauração). CDP observou **28.730 nós criados,28.725 destruídos**, um único contexto. Medição após GC e6s para drenar o sample mais longo.

## Sessão final — um carregamento, oito partidas completas

**21,80min, todas a1×**, seed3; menu→partida→revanche/trocas de mapa/personagem/regra, mesmo `performance.timeOrigin`. P1 humano na simulação em5 partidas, pilotado por teclado Playwright por~1,5s em cada (andar, dois tiros, pulo,dash); depois continua humano sem novos inputs. Não é alegação de pessoa jogando nem de pilotagem ativa durante21min. Dois Versus até5 vitórias; seis Headhunter até120s. Baseline anterior usava24× somente para concluir, claramente separado no gráfico.

| Partida / mapa | FPS inicial / tardio | Heap após GC,MiB | Texturas |
|---|---:|---:|---:|
|1 Musgo|60,003 /60,002|12,13|50|
|2 Musgo · revanche|60,002 /60,002|12,31|50|
|3 Totem|60,002 /60,002|12,39|53|
|4 Copas|60,002 /60,002|13,64|54|
|5 Cachoeira|60,002 /60,002|12,86|54|
|6 Raízes|60,002 /60,002|13,18|54|
|7 Musgo|60,003 /60,003|13,13|54|
|8 Totem|60,002 /60,002|13,05|54|

Janelas de12s no início e mais adiante de cada partida; **mínimo diagnóstico acumulado59,706FPS**, qualidade normal. Heap medido por `HeapProfiler.collectGarbage`+`Runtime.getHeapUsage`, também registrado `performance.memory`; pico13,64MiB, final13,05, sem crescimento monotônico após aquecimento. Isso não mede toda a RAM/VRAM do processo.

**Aba realmente escondida:** CDP nativo em janela própria do Chromium convencional de`tla`, segunda aba própria. `document.hidden=true`, tick congelado por1,5s, retorno exige Continuar e conserva3 flechas. `visibility-report.json`; não evento sintético. Prova de suspensão/freeze do navegador também registrada em`robustness-report.json`.

## Evidências e fechamento

- `evidence/rodada-9/{session,robustness,visibility,story}-report.json`, `summary.json`, **`curva-sessao.png`**; baseline em`antes/`. **Zero erros inesperados** nos relatórios finais. Todos os PNGs e gráfico abertos/conferidos, individualmente ou nas folhas `conferencia-*.jpg`.
- Build, typecheck, build-storybook e2 regressões de descarte passaram; sem suíte inteira/fuzz/`npm test`, `src/sim` intocado. Stories reais de recuperação/recursos passaram nos3 viewports; crítica antes/depois em`ficha-tela.md`.
- Tudo em`tla`, via`/tmp/tla-prova.sh` e fila pesada. FPS usa render privado isolado, mesma rota das rodadas4–8: **não é FPS da transmissão Xvnc**. Visibilidade usa Chromium convencional sem automação Playwright que force foco.
- Tentativas preliminares de visibilidade falharam no harness (visibilidade forçada / navegação do Chromium privado), não no jogo; rota nativa validada resolveu. Um preview próprio órfão dessas tentativas foi identificado por PID/cwd e encerrado no fechamento. Servia o mesmo build final. Não se repetiu a sessão longa.
- Higiene final: **0 abas próprias**,2 IDs preexistentes preservados; portas4176/6107/19189 sem listeners, fila vazia. Bancada/Chromium preexistentes preservados. `closeTarget` agora aguarda desaparecimento verificável antes da contagem final.

Commits no **rodada-astra**, **sem push/publicação**. `evidence/rodada-2/` preexistente preservado fora dos commits.
