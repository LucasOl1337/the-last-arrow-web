# Rodada 4 — Astra

## Legibilidade entregue

- Altura 1,8 → 2,4 tiles (+33%), largura/profundidade +18%, base do GLB normalizada nos pés; hitbox preservada.
- Contorno em espaço de tela de 2,25 px, rim/luz própria reforçados, halo escuro atrás do corpo; nomes 11–16 px com fundo e sombra.
- Câmera preservada: já enquadra ~93% da arena; zoom adicional cortaria plataformas altas.
- `npm run build` passou. Primeira prova pela bancada `tla`/fila: **0 erros**, FPS real moss **59,33**, totem **60,03**, canopy **60,06**. Relatório/prints em `evidence/rodada-4/01-legibilidade/`, todos abertos e conferidos. Portão arena passou em 1366×768 e 900×1000.

## Jogar → achar → corrigir

Primeiro autoplay (bots4, seed 3, 10 s/mapa) teve 3 mortes em cada mapa, tiros/recuperação de flechas e avanço de round, sem penetração de hitbox. Achados:

1. **HUD recortado/sobreposto:** nomes no salto/wrap saem da tela (moss tick 349: Akane y=−30,6 px; totem tick 488: Mizu excede direita), e dois nomes se cruzam (moss tick 668). Print `01-legibilidade/moss-jogo.png` mostra corte; `canopy-jogo.png` mostra nome sobre placar. **Corrigido:** layout limita nomes à arena e procura a faixa livre mais próxima, evitando placar/rodapé/outros nomes. Segunda prova em `02-hud/`: zero cortes, sobreposições e erros nos 3 mapas; FPS 60,04 / 60,04 / 60,05. Todos os PNGs abertos. Story de regressão `Arena/HUD real/BordasENomesCruzados`, build e check Storybook passaram.
2. **Mira visual aponta ao lado oposto:** no close do Templo, Akane tem `aimX=-1`, mas o arco/modelo aponta à direita. Os pontos aparecem à esquerda (lado correto). **Corrigido:** o clipe `shoot` dos quatro GLBs estende a mão em −Z local, diferente da locomoção em +X. Yaw específico de tiro, interpolação pelo menor arco e pitch no plano da arena. Regressão exata: mão do arco − ombro tem ΔX=−0,625 tile para mira esquerda; close mostra pose/flecha para a esquerda. `npm run build` e terceira prova passaram: 0 erros, FPS 60,03 / 60,05 / 60,07; diagnóstico ≥59,84. Prints finais e `report.json` na raiz de `evidence/rodada-4/`, todos abertos.

3. **Tema errado na Cachoeira:** autoplay extra mostrou cenário Musgo apesar de `level.theme='totem'`. **Corrigido:** cena e iluminação própria passam pelo mesmo resolvedor `themeForLevel`. Antes em `03-cachoeira-antes/falls-jogo.png`; depois em `falls-jogo.png`. Teste exato `node --test tests/render-theme.test.ts` passou (1/1); build passou.

## Fechamento

- Prova principal: `scripts/proof-rodada-4.mjs` (métricas reais de frames, tiros/mortes/rounds, sem colisão sólida, sem cortes/sobreposição do HUD, direção da mão do arco).
- Complemento: `scripts/proof-rodada-4-finish.mjs`, uma partida completa bots4 seed 3 em **cada um dos cinco mapas**, acelerada a 24× somente após a medição de FPS em tempo real. Vitória em cinco pontos; não confundir FPS medido com partida acelerada.
- Capturas requeridas: `moss-jogo.png`, `totem-jogo.png`, `canopy-jogo.png`, `mira-close.png`, `mira-regressao-close.png`, `abate-em-jogo.png` e `abate-close.png`. Close do abate mostra Kaze sobre Storm dissolvendo; abate real tick 786, não kill fabricado.
- Prova final (`finish-report.json`): **0 erros**; FPS real moss **60,05**, totem **60,07**, canopy **60,08**, falls **60,05**, roots **60,13** (diagnóstico mínimo **59,81**, todos ≥58). Partidas encerradas nos rounds 11/11/10/14/11. Todos os novos prints abertos e conferidos, incluindo o tema correto de Cachoeira.
- Story HUD real exercitada em 1366×768, 900×1000 e celular horizontal 844×390, portão siTela aprovado. Crítica antes/depois na `ficha-tela.md`.
- Provas exclusivamente em `tla`, com fila pesada, via `/tmp/tla-prova.sh`; browser/page próprios registrados em `web-events.ndjson`, fechados em `finally`, **0 abas próprias restantes**. Preview e servidor Storybook encerrados, vaga pesada liberada. Navegador humano não usado; a bancada `tla` preexistente e seu Chromium convencional foram preservados.

Sem push/publicação, sem fuzz, sem suíte inteira. `src/sim` intocado, portanto `npm test` não executado. A pasta preexistente não rastreada `evidence/rodada-2/` foi preservada e não entrou nos commits.
