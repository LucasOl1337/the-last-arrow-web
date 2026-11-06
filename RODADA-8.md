# RODADA-8 — celular, som e primeira impressão (GPT Astra xhigh)

Mesmas regras das rodadas 4-7 (branch rodada-astra, commits pequenos, sem push/publicação, prova só na bancada `tla` via /tmp/tla-prova.sh e fila pesada, sem fuzz, sem suíte inteira).

1. Celular: jogue por toque (Playwright com hasTouch, 844x390 e 932x430, deitado; e 390x844 em pé) uma partida P1 + 3 bots.
   Ache bugs: stick que não responde, botões cobrindo a ação, multitoque (andar+atirar ao mesmo tempo), zoom/scroll da página, tela em pé sem aviso de girar,
   HUD ilegível. Corrija.
2. Som: confira se cada evento tem som e se nada estoura (corda, soltura, cravar pedra/madeira, catch, baú, bomba, raio, abate, vitória, música).
   Corrija o que faltar ou estiver alto demais (analise o sinal com OfflineAudioContext ou captura de WebAudio, sem ouvir).
3. Primeira impressão: do link frio até o primeiro tiro, conte cliques e segundos; deixe começar em ≤2 cliques com dica de controles no countdown.
4. Prova: 0 erros, ≥58 fps nos 5 mapas no desktop, prints de celular em evidence/rodada-8/ conferidos.

Feito quando: NOTAS-RODADA-8.md curto (achado → correção → prova), commits no branch, resumo curto no fim.
