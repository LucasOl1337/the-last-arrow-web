# RODADA-2 — legibilidade e sensação (render/ui; Opus)

Prova: capturas do regente às 08:30 nos 3 mapas (1600x900, autoplay bots4).
Arquivos: `src/render/*`, `src/ui/*`, `src/style.css`, `src/main.ts`. Não mexer em `src/sim/` (lógica) salvo constante de escala visual.

1. [alto] **Personagens pequenos e escuros** (≈1 tile, quase silhuetas contra o fundo). Meta: altura visual 1.7–1.9 tiles
   (a hitbox continua igual; ancore os pés na base da hitbox), luz própria: rim light colorida por personagem
   (Mizu azul, Storm ciano, Kaze verde, Akane vermelho), leve emissive no rosto/roupa para não sumir no Templo,
   contorno (outline por casca invertida ou pós-processo) fino na cor do jogador. Nome menor, acima da cabeça.
2. [alto] **Leitura de mira**: quando carregando, mostrar arco de trajetória pontilhado curto (3–5 pontos) na cor do
   jogador, e a flecha encaixada no arco. Contador de flechas como pequenos ícones acima da cabeça (some após 1.5 s sem mudança).
3. [médio] **Countdown** 3·2·1·LUTEM grande no centro com o logo pequeno; tela de fim de round com retrato do vencedor e
   placar animado (bolinhas que acendem). Tela de vitória: retrato grande + logo + estatísticas (abates, catches, stomps se houver).
4. [médio] **Câmera**: zoom suave de 4–6% em direção ao último abate durante o slow-motion; shake proporcional.
5. [médio] **Áudio**: música só depois do primeiro gesto (já é), volume 0.35; sons sintetizados para corda esticando,
   flecha cravando em pedra vs madeira, catch ("tchak"), baú abrindo, bomba, raio. Botão de mute (M) no HUD.
6. [baixo] **Menu**: retratos clicáveis em vez de select para escolher personagem, mapas com miniatura (use os
   fundos), dificuldade em botões. Celular: aviso "melhor com teclado ou controle" + toque básico (stick virtual esquerdo,
   botões pular/atirar/dash à direita) — se der tempo.

Feito quando: build passa; captura headless (use `?autoplay=bots4&map=moss|totem|canopy`) mostrando personagens grandes e
legíveis em todos os mapas, a 60 fps; você abriu e conferiu os prints em `evidence/rodada-2/`; commits pequenos; sem push; NOTAS-RODADA-2.md curto.

## Atualização (08:45): clipes extras
`public/assets/models/{mizu,storm,kaze,akane}_extra.glb` (só esqueleto): `fire` (tiro em pé — teste se lê melhor que o `shoot` ajoelhado; se sim, use-o para mirar/soltar), `hurt` (use no início da morte) e `victory_celebration` (storm, kaze, akane; mizu já tinha). Carregue junto com os demais clipes.
