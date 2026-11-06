# RODADA-7 — regras, bots e PC fraco (GPT Astra xhigh)

Mesmas regras das rodadas 4-6 (branch rodada-astra, commits pequenos, sem push/publicação, prova só na bancada `tla` via /tmp/tla-prova.sh e fila pesada, sem fuzz, sem suíte inteira; se mexer em src/sim rode só os testes tocados + o teste novo).

1. Jogo de regras: jogue partidas P1 humano + 3 bots nos 5 mapas e no modo headhunter. Ache bugs de regra/fluxo: baú (raio/bomba) com efeito errado,
   flecha que some ou fica presa dentro da parede, pisão que não conta, empate mal resolvido, placar errado, respawn em cima de inimigo,
   bot travado num canto ou suicida em bomba, bot difícil injusto (acerto impossível). Corrija com teste unitário do caso exato.
2. PC fraco: detecte frame lento (média < 50 fps nos primeiros 2 s) e reduza qualidade sozinho (bloom off, menos partículas, pixel ratio menor),
   com aviso discreto; meça forçando CPU throttling do CDP (Emulation.setCPUThrottlingRate 4) e prove que fica jogável (≥45 fps) sem quebrar o visual normal.
3. Prova: 0 erros, ≥58 fps nos 5 mapas em qualidade normal, prints em evidence/rodada-7/ conferidos.

Feito quando: NOTAS-RODADA-7.md curto (achado → correção → prova), commits no branch, resumo curto no fim.
