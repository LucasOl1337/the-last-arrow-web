# RODADA-9 — sessão longa e robustez (GPT Astra xhigh)

Mesmas regras das rodadas 4-8 (branch rodada-astra, commits pequenos, sem push/publicação, prova só na bancada `tla` via /tmp/tla-prova.sh e fila pesada, sem fuzz, sem suíte inteira).

1. Sessão longa: num único carregamento de página, jogue 8 partidas seguidas (menu → partida → revanche/troca de mapa/personagem/modo), P1 humano em parte delas.
   Meça heap JS (performance.memory / CDP HeapProfiler.collectGarbage + getHeapUsage), contagem de objetos Three (renderer.info memory/programs),
   nós de áudio e listeners. Ache vazamentos (geometria/material/textura não descartados ao trocar de mapa, AudioNodes acumulando, listeners duplicados,
   fps caindo partida após partida). Corrija.
2. Robustez: aba escondida e voltando, redimensionar no meio do round, perder/recuperar contexto WebGL (WEBGL_lose_context), recarregar com ?map inválido,
   asset 404 simulado (route). Nada pode travar ou deixar tela preta; mensagem clara quando falhar.
3. Prova: 0 erros não esperados, ≥58 fps nos 5 mapas, curva de heap/fps ao longo das 8 partidas em evidence/rodada-9/ (json + um gráfico png simples), prints conferidos.

Feito quando: NOTAS-RODADA-9.md curto (achado → correção → prova), commits no branch, resumo curto no fim.
