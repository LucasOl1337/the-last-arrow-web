# RODADA-3 — conteúdo de gameplay (só `src/sim/` e `tests/`; outro agente está em render/ui)

1. [alto] **2 mapas novos** em `level.ts`, mesmo grid 32x18, no estilo TowerFall (simétricos, com rotas de wrap úteis,
   sem pontos onde bot fica preso): `'falls'` "Cachoeira Sagrada" (plataformas em degraus e um vão central alto)
   e `'roots'` "Raízes Antigas" (blocos baixos, túneis curtos, muitos cantos de wall-jump). Use o tema visual
   existente mais próximo: falls→totem, roots→moss (exporte `themeOf(levelId)` se o render precisar; não edite o render,
   apenas deixe o `id` e `theme?: 'moss'|'totem'|'canopy'` em `Level`).
2. [médio] **Modo de jogo**: além de "primeiro a 5", `mode: 'versus'|'headhunter'` em MatchOptions. Headhunter: cada abate
   vale 1 ponto, respawn após 1.5 s em spawn livre longe dos inimigos, partida dura 120 s, vence quem tiver mais.
   Estado expõe `matchTime`, `respawnAt` por lutador.
3. [médio] **Fair play bots**: bot não mira em quem ainda está em countdown/invulnerável; dificuldade "difícil" usa
   previsão da física da flecha e prefere stomp quando acima do alvo.
4. [baixo] Teste: os 5 mapas, 10 rounds cada com 4 bots normal: nenhum round termina por timeout em > 20% e nenhum bot
   fica > 4 s parado no mesmo tile sem atirar (registrar em NOTAS-RODADA-3.md).

Feito quando: `npm test` e `npm run build` passam; commits só dos seus arquivos ("rodada 3: ..."); sem push; sem fuzz; sem navegador.
