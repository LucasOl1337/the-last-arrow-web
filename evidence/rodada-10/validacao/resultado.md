# Validação focada

- `node --test tests/round-ten-reaction.test.ts tests/round-ten-draw.test.ts tests/round-ten-personality.test.ts tests/round-ten-wrap-route.test.ts`:10/10, saída em testes-exatos.log.
- Seleção `--test-name-pattern='bot|bots|predictor|prediction|spawn protection lasts'` em round-features/round-three/round-seven:8 passaram;1 fixture antiga assumia slot0 vivo após2,5s e falhou porque morreu por pisão nas novas rotas. Não era falta de busca do baú por bot vivo. `tests/round-features.test.ts` passou a declarar alive:true no posicionamento da fixture.
- Após essa correção só o caso afetado foi executado novamente: `node --test --test-name-pattern='normal bot repositions' tests/round-features.test.ts`:1/1 passou. Os outros8 não foram repetidos sem alteração de código. Transcrição disponível no histórico da sessão; falha preliminar preservada em afetados-fixture-antiga.log.
- Anteriormente,3 casos selecionados (proteção de spawn/catch difícil/catch humano) também passaram. Não contar execuções repetidas como testes diferentes.
- Build final,typecheck/check:storybook,build-storybook passaram. Nenhuma suíte inteira,nenhum fuzz.
- Browser:play-report.json,story-report.json,juice-report.json, todos errors:[]/pagesAtEnd:0. Fluxos diretos por/tmp/tla-prova.sh na bancada tla, fila pesada.
