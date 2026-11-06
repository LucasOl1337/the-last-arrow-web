# Rodada 1 — gameplay

06/11/2026, 07:31 (Brasília). Escopo: `src/sim/`, `tests/` e esta nota. Sem push, fuzz ou navegador; `src/render/`, `src/ui/` e `src/main.ts` não foram editados.

## Entregue

- Contagem 3–2–1 em 1,2 s, simulação/input congelados; proteção de spawn por 1 s **ativo**, preservada mesmo ao dar dash. Proteção sem dash não conta como catch.
- Bots com abertura/reação por dificuldade, reposicionamento mínimo entre tiros, patrulha de plataformas, pulo/wall-jump, wrap e interceptação de flechas com dash. Primeiro tiro fácil/normal limitado a 6,5 tiles; baús têm prioridade de navegação.
- Baú a cada 12 s ativos em tile livre e apoiado: duas flechas normais, um raio ou uma bomba. Inventário FIFO, limite de seis, tipos preservados ao disparar, pegar, capturar e derrubar. Especial substitui a última normal se o inventário estiver cheio.
- Raio atravessa paredes/alvos, gravidade 0,1; bomba explode ao cravar/atingir alvo, raio 1,6 tiles, com dano pelo wrap e respeito à invulnerabilidade. Catch desarma a bomba. Projéteis expiram após 7 s.

## Prova / Feito quando

`npm test`: **28/28 passaram**. `npm run build`: **passou**. `git diff --check`: passou. Testes antigos de mapas preservam seu limite de 20 s.

`tests/round-pacing.test.ts`: 20 rounds, **quatro bots normal, Musgo, seed 3**, 120 Hz; mesmo fluxo de RNG/rotação de spawn, placar zerado entre rounds para medir além da vitória a cinco.

- Média **10,8796 s de combate**; **12,0796 s com a contagem**, sem intervalo pós-round.
- Mínimo/máximo: **5,30 / 21,65 s**; meta de 8–20 s é da **média**, não de cada round.
- **24 catches, 7 baús gerados, 3 abertos, 496 pulos, 36 dashes, 209 cruzamentos de borda**.
- **60 mortes; todos os 20 rounds terminaram por combate**, sem empate/timeout.
- Durações ativas (s): 5,300; 9,650; 13,225; 5,483; 15,508; 11,733; 14,200; 20,067; 7,067; 5,683; 7,467; 11,725; 13,958; 12,667; 5,508; 6,058; 21,650; 11,108; 11,483; 8,050.

Testes focados cobrem contagem/input, proteção, FIFO/capacidade/compatibilidade, raio perfurante, bomba/catch/wrap, geração/abertura/reset de baú, wall-jump e catch do difícil. A medição detectou e corrigiu salto repetitivo acima de um baú inferior. Prova visual de 24 s não foi refeita nesta frente; integração visual pertence ao outro agente/regente.

## Contrato para render/UI

Tipos exportados em `src/sim/world.ts`; adições opcionais para manter consumidores antigos:

- `world.countdown`: **3 / 2 / 1 / 0** (usar este dígito; `phaseTime` continua em segundos).
- `world.chests?: Chest[]` → `{ id, x, y, reward: ArrowKind[] }`; `chestTimer` é o tempo até o próximo spawn.
- `fighter.inventory?: ArrowKind[]` em ordem de disparo, com `ammo` numérico mantido.
- `arrow.kind?: 'normal' | 'bolt' | 'bomb'`; ausência equivale a normal.
- Eventos `chest-spawn` / `chest-open` com `chestId` e `reward`; `explosion` com `kind: 'bomb'`, `radius: 1.6`, posição e `actor` dono. Spawn de baú usa `actor: -1`.
- `shoot`, `impact`, `pickup` e `catch` incluem `kind`. Eventos duram só até o próximo tick; `snapshot()` inclui os novos dados com cópia dos arrays.
