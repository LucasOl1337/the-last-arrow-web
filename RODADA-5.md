# RODADA-5 — jogar→bug→corrigir, parte 2 (GPT Astra xhigh)

Mesmas regras da RODADA-4 (worktree/branch rodada-astra, commits pequenos, sem push nem publicação, prova só na bancada `tla` via /tmp/tla-prova.sh e fila pesada, sem fuzz, sem suíte inteira).

Foco agora é o jogo como um humano joga, não só os bots:
1. Rode partidas com P1 humano simulado por teclado (Playwright keyboard: andar, pular, dash, mirar 8 direções, atirar, pegar flecha do chão, pisão)
   contra 3 bots, nos 5 mapas, e também em 1366x768. Ache bugs reais de controle e sensação: input perdido, pulo que falha na borda,
   flecha que não dá pra recolher, wrap de tela quebrando, mira que não segue o teclado, câmera/hud atrapalhando, menu→partida→revanche→menu travando,
   pausa (Esc) e mute (M) funcionando, controle (gamepad) se der pra simular.
2. Corrija cada bug com commit próprio e caso de regressão exato (teste unitário se for src/sim, rode só o teste tocado).
3. Polimento visual pequeno que você notar nos prints (no máximo 2 itens), sem regredir fps.
4. Prova final: 0 erros, ≥58 fps nos 5 mapas, prints em evidence/rodada-5/ abertos e conferidos (pelo menos um de P1 humano em jogo, um da revanche/menu).

Feito quando: NOTAS-RODADA-5.md curto com bugs achados → correção → prova; commits no branch. Resumo curto no fim.
