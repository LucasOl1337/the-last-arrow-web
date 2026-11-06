# RODADA-4 — arqueiros grandes + jogar→bug→corrigir (GPT Astra xhigh)

Worktree: ~/Projects/the-last-arrow-web-wt/rodada-astra, branch `rodada-astra`. Commits pequenos aqui. NÃO faça push em master, NÃO rode tools/publicar.sh (publicar é do Lucas).
Prova visual: só pela bancada `tla` e fila pesada:
  agent-bench launch tla -- /tmp/tla-prova.sh scripts/SEU-SCRIPT.mjs /tmp/SEU.log   (depois leia o log; o script grava prints)
Use scripts/proof-rodada-2.mjs como modelo (Playwright headless, serve dist com vite preview na base /the-last-arrow-web/, fecha o browser no finally). Rode `npm run build` antes.
Sem fuzz, sem suíte inteira; `npm test` só se mexer em src/sim.

Estado (prints de 09:21 conferidos pelo regente): em 1600x900 os arqueiros ainda são palitos finos e escuros, difíceis de achar,
principalmente no Templo (fundo teal) e no Copas (fundo laranja). Nomes ilegíveis.

1. [alto] Arqueiros MAIORES e legíveis: VISUAL_HEIGHT em src/render/fighters.ts para ~2.4 tiles (ou equivalente), modelo mais largo
   (escala X/Z levemente maior se ficar magro), pés na base da hitbox. Considere câmera ortográfica com leve zoom (enquadrar a arena a ~92%)
   se não cortar plataformas. Aumente luz própria/rim por cor de jogador, contorno de 2-3 px na cor do jogador, e uma sombra/halo escuro
   atrás do personagem para destacar de fundos claros. Nome do jogador legível (fonte maior, com sombra) acima da cabeça.
2. [alto] Loop jogar→bug→corrigir: rode partidas autoplay (bots4) nos mapas, olhe os prints e o diagnóstico, ache bugs reais
   (personagem atravessando plataforma, flecha sumindo, travada, HUD sobreposto, animação errada, erro no console), corrija cada um
   com commit próprio. Registre cada bug achado e a correção em NOTAS-RODADA-4.md (curto).
3. Ao terminar cada melhoria: build passa, prova roda com 0 erros e ≥58 fps nos mapas, prints em evidence/rodada-4/ ABERTOS e conferidos por você.

Feito quando: itens 1 e 2 entregues com prints em evidence/rodada-4/ (pelo menos: moss, totem, canopy em jogo, um close de mira, um de abate),
NOTAS-RODADA-4.md com a lista de bugs corrigidos, commits no branch. Responda no fim com um resumo curto.
