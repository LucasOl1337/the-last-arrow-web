# Rodada 3 — conteúdo de gameplay

06/11/2026, 08:49 (Brasília). Escopo: `src/sim/`, `tests/` e esta nota. Sem navegador, fuzz ou push. Nenhuma edição desta frente em `src/render/`, `src/ui/`, `src/main.ts`, `src/style.css` ou `src/audio.ts`; alterações concorrentes desses arquivos pertencem ao outro agente e não entram no commit.

## Entregue

- **Cachoeira Sagrada (`falls`)**: grid simétrico 32×18, plataformas em degraus, vão central alto e bordas abertas para wrap; tema `totem`.
- **Raízes Antigas (`roots`)**: grid simétrico 32×18, blocos baixos, túneis curtos transitáveis e paredes para wall-jump; tema `moss`. Teste de física atravessa um túnel de três tiles andando, sem salto/dash.
- **Headhunter**: um ponto por abate de adversário, 120 segundos ativos, respawn após 1,5 segundo, três flechas normais e um segundo de proteção. Suicídio/morte sem autor não pontuam. Atingir cinco pontos, sobrar só um vivo ou morrerem todos não encerra a partida. Vence o maior placar; empate no topo fica como empate (`winner: null`).
- **Respawn seguro**: procura posições apoiadas com espaço para o corpo inteiro e maximiza a distância ao inimigo mais próximo, levando wrap horizontal/vertical em conta. Respawns simultâneos são posicionados sequencialmente, sem sobreposição; preservam placar/abates. Se não houver posição livre, mantém o prazo e tenta no próximo tick.
- **Fair play**: bot não seleciona invulnerável, não age durante countdown e cancela o disparo carregado se o alvo morrer ou ganhar proteção. Continua patrulhando/coletando sem alvo válido.
- **Difícil**: prevê movimento observado do alvo com a física real do lutador e simula oito trajetórias de flecha com gravidade por tipo, colisão varrida e wrap; raio pode atravessar paredes. Não consulta intenção futura do adversário. Prefere descida rápida para stomp quando está acima e há caminho livre, sem trocar um dash defensivo por mira.

## Contrato para render/UI — integração da outra frente

```ts
createWorld({ map: 'falls', mode: 'headhunter' });
// mode omitido continua 'versus' (primeiro a cinco vitórias de round).
```

- `Level.id` continua string; `Level.theme?: 'moss' | 'totem' | 'canopy'` contém o tema dos mapas novos.
- `themeOf(levelId)` exportado de `src/sim/level.ts`: `falls → totem`, `roots → moss`; preserva temas antigos e usa `moss` como fallback.
- `world.options.mode`: `'versus' | 'headhunter'`.
- `world.matchTime`: segundos **ativos decorridos**, sem countdown/intervalos. Headhunter termina exatamente em 120; restante = `Math.max(0, 120 - world.matchTime)`.
- `fighter.respawnAt`: prazo absoluto em `matchTime` enquanto morto no headhunter; `null` vivo ou no versus. Restante = `Math.max(0, respawnAt - world.matchTime)`.
- `snapshot()` inclui `mode`, `matchTime` e `respawnAt`. Respawn reutiliza `alive`, `invulnerable` e coordenadas anteriores/atuais; não cria novo tipo de evento. Encerramento mantém `victory`, com `actor: -1` para empate.
- Menu, HUD e troca efetiva de tema no render não foram editados nesta frente.

## Feito quando — provas

- `npm test`: **45/45 passaram**, sem skips.
- `npm run build`: **passou** (`tsc --noEmit` + Vite).
- `git diff --check`: passou para os arquivos desta frente.
- Sem push, navegador ou fuzz. O ensaio é exatamente a fixture solicitada: cinco mapas autorados × dez rounds, seed fixa 3, sem geração/varredura de entradas.

### Dez rounds por mapa, quatro bots normal

Fonte: `tests/round-three-pacing.test.ts`. 120 Hz; fluxo contínuo de RNG e rotação de spawn por mapa; placar zerado entre rounds para permitir dez rounds sem parar no primeiro a cinco. Mede tempo ativo, excluindo countdown e mortos. Permanência é uma sequência no mesmo tile (`floor(x), floor(y)`) sem evento `shoot`; mover de tile ou atirar zera o contador.

| Mapa | Timeouts / 10 | Máximo no mesmo tile sem atirar | Média ativa | Tiros | Cruzamentos de borda |
| --- | ---: | ---: | ---: | ---: | ---: |
| Musgo | 0 (0%) | 0,475 s | 11,105 s | 86 | 88 |
| Totem | 0 (0%) | 0,450 s | 9,872 s | 74 | 109 |
| Copas | 0 (0%) | 0,400 s | 10,278 s | 83 | 120 |
| Cachoeira | 0 (0%) | 0,400 s | 6,649 s | 46 | 60 |
| Raízes | 0 (0%) | 1,158 s | 10,345 s | 91 | 57 |

**50/50 rounds sem timeout**, abaixo do teto de 20% por mapa; nenhum bot ultrapassou quatro segundos no mesmo tile sem disparar. Pior caso: Raízes, round 5, lutador 3, tile `(11,7)`, **1,158 s**. Todos os mapas tiveram wrap real em combate. São provas para esta fixture determinística, não garantia estatística de toda seed possível.

Durações ativas em segundos, na ordem dos rounds:

- Musgo: 5,342; 15,950; 12,333; 12,850; 7,575; 5,108; 17,875; 9,200; 6,708; 18,108.
- Totem: 9,375; 5,683; 4,733; 10,958; 10,817; 9,508; 7,642; 6,517; 16,392; 17,092.
- Copas: 8,442; 11,842; 8,567; 11,583; 8,642; 15,758; 6,833; 5,158; 5,475; 20,483.
- Cachoeira: 3,758; 5,883; 9,642; 8,467; 6,592; 7,167; 7,967; 5,025; 7,042; 4,942.
- Raízes: 11,950; 17,433; 9,175; 13,217; 5,650; 7,433; 9,758; 5,608; 10,025; 13,200.

### Regressões e casos focados

`tests/round-three.test.ts` cobre simetria/headroom/conectividade, túnel transitável, pontuação idempotente, suicídio, respawn cronometrado/distante/simultâneo, proteção de retorno, congelamento do relógio no countdown, fim em 120 s sem respawn após o encerramento, empate, seleção/cancelamento de alvo protegido, preferência por stomp e previsão balística com acerto no integrador real, paredes, tipos de flecha e wrap.

Inclui uma partida headhunter completa em Raízes, quatro bots normal, seed 3: 120 s ativos em um só round, abates e respawns recorrentes, prazos exatos, spawn sem sobreposição, soma dos pontos igual aos abates válidos e replay determinístico.

O ensaio anterior de 20 rounds Musgo/normal/seed 3 também segue passando: média ativa **11,718 s**, 33 catches, quatro baús abertos, 60 mortes e nenhum timeout. Testes antigos de mapas mantêm o limite de 20 s; duas fixtures de `think()` passaram a declarar `phase: 'playing'`, porque o bot agora respeita countdown mesmo em chamada direta.
