# RODADA-1 — gameplay (só `src/sim/` e `tests/`; NÃO tocar em `src/render/`, `src/ui/`, `src/main.ts` — outro agente está lá)

Prova: captura headless de `?autoplay=bots4&seed=3` por 24 s (folha de quadros vista pelo regente).

Bugs / feio, em ordem:
1. [alto] Rounds duram 2–4 s: os bots acertam quase no instante do spawn. Precisa:
   - contagem "3-2-1" de ~1.2 s no começo do round, sem input (o estado expõe `countdown` para a UI mostrar);
   - 1.0 s de invulnerabilidade de spawn (já existe `invulnerable`, use);
   - bots com tempo de reação + "intenção" de reposicionar antes de atirar (procurar ângulo, subir, flanquear pelo wrap), e não atirar de primeira a longa distância em linha reta no fácil/normal. Meta: round médio de bots de 8–20 s no normal (meça em teste com 20 rounds seed fixo e registre média em NOTAS-RODADA-1.md).
2. [alto] Bots ficam muito parados numa plataforma. Mais movimento: patrulha entre plataformas, pulos, wall-jump, dash de esquiva quando flecha vem; usar o wrap da tela.
3. [médio] Pegar flecha no ar (catch) quase nunca acontece; bot difícil deve tentar catch quando a flecha vem e ele está com o dash pronto.
4. [médio] Variedade: adicionar baú de tesouro (aparece a cada ~12 s num ponto livre, abre ao encostar) que dá 2 flechas OU flecha especial: **raio** (atravessa paredes/alvos em linha reta, quase sem gravidade) e **bomba** (explode raio 1.6 tiles ao cravar). Estado da flecha com `kind: 'normal'|'bolt'|'bomb'` e evento de explosão em `world.events` (para o render). Inventário do lutador com a ordem das flechas. Bots preferem pegar baú.
5. [baixo] Garantir que estados/eventos novos ficam em `world` com tipos exportados, sem quebrar o render atual (campos opcionais).

Feito quando: `npm run build` e `npm test` passam; teste novo com 20 rounds de bots mede duração média 8–20 s e ao menos 1 catch e 1 baú aberto; commit "rodada 1: ..." em português. Sem push, sem fuzz, sem navegador no desktop. Escreva `NOTAS-RODADA-1.md` (curto).
