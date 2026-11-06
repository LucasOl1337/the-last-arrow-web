# RODADA-10 — bots com personalidade e "juice" final (GPT Astra xhigh)

Mesmas regras das rodadas 4-9 (branch rodada-astra, commits pequenos, sem push/publicação, prova só na bancada `tla` via /tmp/tla-prova.sh e fila pesada, sem fuzz, sem suíte inteira; src/sim só com teste do caso exato).
Prazo duro: termine e responda até 15:45 (Brasília, `TZ=America/Sao_Paulo date`). Se o tempo apertar, entregue o que já passou na prova.

1. Jogue P1 humano contra 3 bots no normal e no fácil, nos 5 mapas. Ache o que deixa a partida chata ou injusta pra um humano: bot fácil bom demais,
   bots com o mesmo comportamento, rounds longos sem ação, spawn injusto, flecha pega no ar de forma impossível. Ajuste com no máximo 3 mudanças medidas
   (taxa de vitória do humano-script simples por dificuldade, duração média do round antes/depois).
2. No máximo 2 polimentos de sensação visíveis em print (ex.: hit-stop/flash no catch, indicador de borda quando o personagem está fora da tela no wrap,
   brilho no baú), sem regredir fps.
3. Prova: 0 erros, ≥58 fps nos 5 mapas, prints em evidence/rodada-10/ conferidos. NOTAS-RODADA-10.md curto. Resumo curto no fim.
