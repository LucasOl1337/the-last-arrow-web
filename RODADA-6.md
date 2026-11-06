# RODADA-6 — sensação de jogo e animação (GPT Astra xhigh)

Mesmas regras da RODADA-4/5 (branch rodada-astra, commits pequenos, sem push/publicação, prova só na bancada `tla` via /tmp/tla-prova.sh e fila pesada, sem fuzz, sem suíte inteira).

Limites conhecidos (NOTAS-VISUAL.md): tiro usa clipe ajoelhado; queda usa trecho do pulo; morte é ragdoll falso; texturas 4096² pesadas.
1. Grave um vídeo curto (mp4, 10-15 s, 1600x900, a partir de frames ou recordVideo do Playwright) de P1 humano + 3 bots no Templo, assista os frames
   e ache o que parece errado para um jogador (pose de tiro, transições bruscas, pés deslizando, personagem flutuando, flecha cravada sem som/efeito, etc.).
2. Corrija até 4 itens de maior impacto, priorizando: tiro em pé legível (use o clipe `fire` dos *_extra.glb se ler melhor), pés sem deslizar
   (velocidade da animação de corrida proporcional à velocidade), transição pulo→queda→pouso, e reduzir texturas para 1024² (ou 2048²) se isso não piorar o visual.
3. Prova: 0 erros, ≥58 fps nos 5 mapas, prints e o vídeo depois em evidence/rodada-6/ conferidos (video-depois.mp4).

Feito quando: NOTAS-RODADA-6.md curto (achado → correção → prova), commits no branch, resumo curto no fim.
