# Rodada 8 — concluída, 06/11 às 12:05 Brasília

Aceite/documentação: NOTAS-RODADA-8.md. Branch rodada-astra; sem push/publicação. Código: cc5c73c (touch),84a0266 (dica),05c1a11 (áudio). Provas/documentação no commit de fechamento.

Todos os relatórios finais em evidence/rodada-8: mobile, touch-regressions, desktop, audio, story. Zero erros. FPS desktop>=58 nos5 mapas (60,002 real; diagnóstico>=59,159), mobile3 partidas P1+3 bots concluídas (primeiros~3s toque1×, finish24×). Portrait congela e pede girar. Áudio19 sinais/126s de música, mix pico0,874 sem clipping. Prints todos vistos diretamente/folhas conferidas. Build/check/build-storybook passaram; src/sim intocado, sem fuzz/suíte inteira.

Higiene final: agent-bench-web hygiene/finish sem abas próprias;2 páginas preexistentes e PID100103 preservados. Nenhum preview/story/proof/browser19188 restante. Fila vazia. Bancada tla preexistente mantida; nenhum navegador humano usado. evidence/rodada-2/ continua não rastreada, não adicionar.

Limites e aprendizado registrados nas notas: GPU isolada não FPS do Xvnc; emulação mobile não Safari/aparelho; cold local não4G; áudio medido sem ouvir. Provas preliminares falharam no harness (DISPLAY antes de abrir navegador, CDP touchEnd inicialmente enviava IDs restantes, atrito/capture assíncronos), corrigidas e executadas só as afetadas. Testes válidos não repetidos sem mudança relevante.

Sem próxima ação pendente nesta rodada. Apenas conferir status após commits finais e entregar resumo curto.
