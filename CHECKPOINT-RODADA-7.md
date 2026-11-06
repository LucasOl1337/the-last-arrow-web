# Rodada 7 — checkpoint (encerrado)

**Atualização final:** aceite/provas em `NOTAS-RODADA-7.md`. Cinco mapas normal60FPS; CPU4+4K13,44→59,88FPS após cap1280×720. Regras e stories aprovados, prints conferidos. Zero jobs/abas/servidores próprios pendentes, fila liberada. Chromium convencional com2 abas preexistentes preservado. Sem push. O texto abaixo mantém a trilha intermediária; não é trabalho ainda em voo.

Contrato: RODADA-7.md; branch rodada-astra, sem push/publicação, provas só tla via /tmp/tla-prova.sh + fila. Sem fuzz/suíte inteira. Orçamento não definido; nenhum subagente. Evidence/rodada-2 preexistente intocada.

Feito:
- Leitura notas 4/5/6, skills eficiência, bancada, siTela/Storybook. Galeria consultada; ficha antes de código.
- P1 teclado +3 hard bots em 5 mapas e headhunter roots (25s real + fim24x). Evidência antes em evidence/rodada-7/antes. 0 erros. Headhunter mostrava regra e resultado Versus; menu nem oferecia regra.
- Regressões exatas vermelhas → verdes: bolt expira dentro coluna Totem, bot solta bomba suicida contra coluna, pisão wrap sem causa para stats. Commit d317376. Testes afetados por --test-name-pattern em sim/round-features/round-three passaram; logs /tmp/tla-rodada-7-*.
- UI: seleção Headhunter, regra/tempo/resultado corretos, story HUD modo leve e empate, escolha de regras compacta. Commit 1052af5. Stories iniciais passaram após corrigir CTA 844x390; PNG revelou resultado com botões cortados em horizontal, CSS ajustado (precisa reconstruir/reprovar stories).
- AutoQuality src/render/quality.ts + testes3 verdes; low bloom off, pixel ratio*0.7, pools150/40 e emissão1/3. main integra, usa elapsed real no diagnóstico, causa de pisão e fim de HH por phase. Build passou após helper matchEnded contornar narrowing TS.

Desempenho: bancada Chromium convencional 155 GPU NVIDIA OpenGL faz ~26–36 FPS normal; privado headed mesma lentidão, headed Vulkan também. Privado isolado/headless (como rodadas anteriores) Vulkan GPU real60 FPS normal E CPU4. Logo diferença é apresentação Xvnc, não GPU desativada. Não mexer no Chromium compartilhado/humano. Scripts diagnóstico explicitam rotas, proprietário e finally.

Em voo: /tmp/tla-rodada-7-adaptive.log, script proof-rodada-7-renderer.mjs lançado por agent-bench fila tla rodar; testa headed após governor. Fecha context/browser privados, preserva2 abas preexistentes.

Próximo: ler resultado adaptive; definir prova honesta de normal58 e CPU4≥45 com governor automático (sem falsificar FPS). Pode usar headless privado mesmo baseline anterior, registrar limites. Reprovar stories com botões cabendo; script principal ainda só antes, melhorar finish5mapas e fixtures exatas chest/bolt/bomb/stomp/draw. Conferir todos prints, finalizar NOTAS curto, commits pequenos e higiene/servidores.
