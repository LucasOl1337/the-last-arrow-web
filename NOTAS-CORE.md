# The Last Arrow — núcleo jogável

Entrega em 06/11/2026, 07:07 (Brasília). Branch local `master`. Sem push, Actions ou consulta ao projeto Unity.

## Feito quando — conferência

| Critério | Resultado e prova |
| --- | --- |
| Build TypeScript + Vite | `npm run build` passou; saída em `dist/`. Há somente aviso de bundle >500 kB, sobretudo Three.js. |
| Preview abre | Teste real usa Vite preview em `127.0.0.1:4173`, servindo **dist**, não o servidor de desenvolvimento. |
| Menu → 1 humano + 3 bots → vitória | Chromium: seed 7, nove rounds, Stormdragon chegou a 5; tela de vitória e revanche acionadas por DOM. Humano fica sem jogar nessa prova de conclusão. |
| Bots lutam sozinhos | `?autoplay=bots4&seed=42` passou ao round 2 sozinho (tick 524 na captura). Teste puro também conclui a partida inteira e compara replay idêntico. |
| Outros mapas/dificuldades | Templo/fácil e Copas/difícil completaram rounds por combate, com três mortes cada — sem depender do limite de tempo. |
| Controles reais | P1 WASD/J/K/L, P2 setas/`,`/`.`/`/` e Numpad1/2/3 exercitados pelo teclado do Chromium. Dois gamepads padrão simulados na borda da API: movimento, tiro, pulo, dash e Start. |
| Pausa | Escape e botão Continuar; tick não muda durante a pausa. Start dos gamepads também pausa/retoma. |
| Qualidade | 14 testes Node passaram; `check:storybook` e `build-storybook` passaram; `npm audit`: zero vulnerabilidades. |
| Visual e desempenho | Capturas abertas e avaliadas; menu nos três tamanhos; 240 frames a **60,00 fps**, trabalho JS/render médio **0,35 ms**, máximo **5,30 ms** nessa amostra. |
| Higiene | Chromium headless dentro da bancada `tla`, via fila; zero abas restantes; preview/servidor de stories encerrados em `finally`. |

**Relatório principal:** `evidence/browser-final/report.json`. Inclui estados, medidas siTela, contagem de geometrias, áudio e resultados de teclado/gamepad. Console sem erros e áudio sem falhas de download/decodificação. Essa medição curta não é garantia para qualquer GPU nem substitui teste prolongado de hardware físico.

## Jogar

```sh
npm install
npm run dev -- --host 127.0.0.1
# ou produção local:
npm run build
npx vite preview --host 127.0.0.1
```

- Preview padrão: `http://127.0.0.1:4173/`.
- Espectador automático: `http://127.0.0.1:4173/?autoplay=bots4&seed=42`.
- Menu: um humano contra 1–3 bots; dois humanos com 0–2 bots; assistir quatro bots. Personagens, mapa e dificuldade são selecionáveis.
- Controles P1: **WASD** move/mira; **J** segura/solta tiro; **K ou Espaço** pula; **L** esquiva.
- P2: **setas**, **Numpad1/2/3** ou **vírgula/ponto/barra**.
- Gamepad padrão: direcional/analógico esquerdo mira e move; **A** pula; **X ou RT** atira; **B ou RB** esquiva; **Start** pausa. Primeiro controle é P1, segundo é P2. Teclado e controle podem coexistir.
- Mira em oito direções; direção sem atirar também movimenta. Soltar pulo corta a altura. Contra parede: deslize e wall-jump. Baixo acelera queda.
- Flecha ou pisão mata; dash tem 0,15 s de invulnerabilidade e cooldown de 0,6 s. Encostar em flecha no dash pega a flecha. Flechas cravadas são recolhidas até o máximo de seis.
- Primeiro a cinco rounds vence. Zero sobreviventes empata. Round com mais de um sobrevivente após **90 s** empata, sem pontos; contador visível e regra nos controles.
- Todas as bordas têm wrap para lutadores e flechas. Áudio precisa de gesto inicial pelas regras do navegador; autoplay pode começar mudo.

## Arquitetura e integração com arte

### `src/sim/` — independente de DOM e Three.js

- `world.ts`: estado, personagens, seed xorshift32, `createWorld`, `step` fixo de 1/120 s, snapshots e eventos.
- `physics.ts`: AABB contra tiles, corrida, gravidade, pulo variável, coyote/buffer de 0,1 s, parede, dash e wrap.
- `arrows.ts`: carregar/soltar, gravidade leve, orientação, colisão varrida em subpassos, catch, cravar e coletar.
- `rules.ts`: morte, quiver derrubado, stomp, empate, pontuação, reinício e vitória.
- `bot.ts`: grafo dirigido de plataformas, caminhos, saída pela borda para descer, saltos/wall-jump, reação por dificuldade, previsão balística quantizada em oito direções, esquiva, coleta e recuperação de travamento.
- `input.ts`: contrato `Intent` do brief, sem dependência de navegador.
- `level.ts`: três grids ASCII de 32×18, tile=1, plataformas/arestas/spawns derivados. IDs: `moss`, `totem`, `canopy`.

A simulação usa **x para a direita e y para baixo**; posição do lutador é seu centro, corpo físico 0,64×1,10. A renderização converte y para `18-y`. Não use dimensões do modelo artístico como hitbox.

### `src/render/` — consumidores de estado

- `scene.ts`: câmera perspectiva de 30°, enquadramento 32×18, planos canopy/ruins com parallax, pedra/musgo em instâncias.
- `fighters.ts`: quatro bonecos low-poly com materiais por personagem; corrida, salto, mira, halo de dash e morte procedural. Este é o principal ponto de substituição pelo agente de arte.
- `arrows.ts`: flechas instanciadas; Stormdragon usa ciano.
- `fx.ts`: pool limitado de 400 partículas, poeira, impacto, catch, rastros, flash, slow-motion e shake de morte; respeita redução de movimento.
- `hud.ts`: placar, munição, identificação projetada pela câmera, contagem inicial, tempo restante e resultado de round.

Os eventos do `world.events` só duram até o próximo tick. Consumir **a cada step**, como em `main.ts`, não só uma vez por frame. Cosméticos usam RNG separado (`Math.random`); não mudam o replay da simulação.

### UI, áudio e aplicação

- `src/ui/menu.ts`: implementação canônica usada na aplicação **e** no Storybook; configuração, controles, pausa, vitória e erro WebGL.
- `src/ui/controls.ts`: teclado/Gamepad API, edges preservadas até o tick, limpeza de teclas ao perder foco; blur/aba oculta pausam.
- `src/audio.ts`: WebAudio, música em loop, efeitos fornecidos, sons sintetizados de pulo/impacto/kill/recuperação; mute e redução do volume na pausa. `storm_ult.wav` toca na vitória de Stormdragon; não há ult de combate implementada.
- `src/main.ts`: acumulador fixo, interpolação, integração de eventos, pausa e hooks.

## Ganchos de teste

```js
window.__tla.startMatch({
  humans: 1, bots: 3, map: 'totem', difficulty: 'hard',
  characters: ['mizu', 'stormdragon', 'kaze', 'akane'], seed: 42
});
window.__tla.world;        // referência atual, inclusive após revanche
window.__tla.state();      // snapshot serializável: tick, fase, placar, vivos, munição etc.
window.__tla.setTimeScale(0);  // congela ticks; valores aceitos: 0..24
window.__tla.setTimeScale(1);
window.__tla.diagnostics();  // fps/trabalho de frame/draw calls/recursos/falhas de áudio
```

`startMatch` restaura a escala para 1. A comparação determinística exige o mesmo número de ticks e os mesmos intents; cadência do navegador não é o relógio da simulação.

## Reproduzir as provas

Node >=22.18 (suporte nativo a TypeScript sem transpiler); validado aqui em Node 26.7.

```sh
npm test
npm run build
npm run check:storybook
npm run build-storybook
```

Catálogo: `npm run storybook`, porta 6106, sem abrir janela automaticamente. Stories em `src/ui/menu.stories.ts`: configuração, controles, pausa, vitória e erro; o fluxo de dois humanos é exercitado na story canônica.

**Nesta máquina, testes visuais somente isolados e na fila:**

```sh
agent-bench ensure tla
agent-bench fila tla rodar -- agent-bench exec tla -- \
  /home/lol/.hermes/tools/node-26.7.0-linux-x64/bin/node scripts/browser-test.mjs

agent-bench fila tla rodar -- agent-bench exec tla -- \
  env TLA_PROOF_DIR=evidence/stories-after \
  /home/lol/.hermes/tools/node-26.7.0-linux-x64/bin/node scripts/browser-test.mjs --stories
agent-bench stop tla
```

O Node absoluto evita a configuração mise não confiada dentro da bancada. O script usa exatamente `$HOME/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome` com `--headless=new`, cria uma aba própria, não conecta a navegador alheio e encerra navegador/servidor em `finally`. Stories precisam do build prévio. O portão importa as medidas e a função de julgamento do `checa_tela.py` da skill local, sem relaxar sua régua; veja `ficha-tela.md` para a exceção dos diálogos curtos.

## Limites conhecidos e escolhas

- **Extras opcionais não implementados:** baú, flecha bomba, raio/ult jogável. O combate principal está completo.
- Arte propositalmente provisória: bonecos low-poly e blocos. Os três mapas têm layouts distintos, mas usam o mesmo par de fundos base. Não integrar nem sobrescrever assets que a frente de arte está preparando.
- Bots usam alcance aproximado no grafo e saltos reativos, não um planejador de trajetória exato; recuperam travamentos, mas não são IA perfeita. Caso excepcional de perseguição longa termina em empate aos 90 s.
- Flecha que segue voando por mais de 7 s vira recolhível no ponto atual, evitando munição perdida indefinidamente. Mortos derrubam a munição restante. Catch com seis flechas neutraliza o projétil sem ultrapassar o limite.
- Render em 16:9 com letterbox em janela alta. Menu responsivo até 360 px, mas combate é para teclado/controle, sem touch. Menus não são navegados pelo gamepad; teclado/mouse são necessários para configurar.
- Gamepads foram verificados por mock fiel da API padrão, não por periférico físico. Arquivos de áudio foram carregados/decodificados, não houve avaliação auditiva humana.
- Aviso de bundle de ~595 kB (153 kB gzip); build passa. Three.js permanece no bundle principal. As provas de desempenho são curtas e locais.
- Simulação não importa Three.js. Alocações foram evitadas onde simples: intent por jogador, matriz/recurso reutilizado, partículas/flechas/tiles instanciados. Eventos e busca de grafo ainda alocam; isso não foi gargalo na amostra.
- `.gitignore`, dependências de otimização GLTF, `tools/`, `BRIEF-VISUAL.md` e novos assets apareceram durante a execução por trabalho paralelo. Foram preservados; não pertencem aos commits do núcleo, exceto a exclusão isolada de `storybook-static/`.

## Evidências e histórico local

- `evidence/stories-before/`: capturas antes do ajuste de legibilidade (o relatório registra o 404 inicial de favicon, corrigido depois).
- `evidence/stories-after/`: stories e portão final, sem erros, zero abas.
- `evidence/browser/`: primeira integração completa.
- `evidence/browser-final/`: versão final, mapas, controles, vitória e desempenho.
- `ficha-tela.md`: tarefa, crítica dos prints, ajuste e limites.

Commits por etapa: `28a7757` simulação; `09c1f0d` render/menu/áudio; `27ede62` integração e controles; commit final de documentação/evidências. Não houve push.
