# Rodada 4 — Astra

## Legibilidade entregue

- Altura 1,8 → 2,4 tiles (+33%), largura/profundidade +18%, base do GLB normalizada nos pés; hitbox preservada.
- Contorno em espaço de tela de 2,25 px, rim/luz própria reforçados, halo escuro atrás do corpo; nomes 11–16 px com fundo e sombra.
- Câmera preservada: já enquadra ~93% da arena; zoom adicional cortaria plataformas altas.
- `npm run build` passou. Primeira prova pela bancada `tla`/fila: **0 erros**, FPS real moss **59,33**, totem **60,03**, canopy **60,06**. Relatório/prints em `evidence/rodada-4/01-legibilidade/`, todos abertos e conferidos. Portão arena passou em 1366×768 e 900×1000.

## Jogar → achar → corrigir

Primeiro autoplay (bots4, seed 3, 10 s/mapa) teve 3 mortes em cada mapa, tiros/recuperação de flechas e avanço de round, sem penetração de hitbox. Achados a corrigir:

1. **HUD recortado/sobreposto:** nomes no salto/wrap saem da tela (moss tick 349: Akane y=−30,6 px; totem tick 488: Mizu excede direita), e dois nomes se cruzam (moss tick 668). Print `01-legibilidade/moss-jogo.png` mostra corte; `canopy-jogo.png` mostra nome sobre placar.
2. **Mira visual aponta ao lado oposto:** no close do Templo, Akane tem `aimX=-1`, mas o arco/modelo aponta à direita. Os pontos aparecem à esquerda (lado correto). Confirmar orientação local dos GLBs antes de corrigir.

Sem push/publicação, sem fuzz, sem suíte inteira. `src/sim` intocado, portanto `npm test` não executado.
