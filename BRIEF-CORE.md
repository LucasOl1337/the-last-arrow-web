# Brief: núcleo jogável do The Last Arrow (web)

Repo: ~/Projects/the-last-arrow-web (Vite 8 + TypeScript 7 + three 0.187 já instalados em node_modules; `package.json` pronto).
Você escreve o NÚCLEO DE GAMEPLAY. Outro agente cuida da arte depois, então separe lógica de visual.

## Jogo
PvP de arena estilo TowerFall, numa tela única, visto de lado. 2 a 4 lutadores: humano(s) + bots.
Personagens: **Mizu** (arqueiro samurai, kimono azul-marinho, arco de madeira, flecha normal) e **Stormdragon**
(arqueiro de tempestade, cabelo prateado, arco de raio ciano). Mais 2 variações de cor para 4 jogadores (ex.: "Kaze" verde, "Akane" vermelha) usando os mesmos corpos.
Arena: floresta com ruínas, plataformas de pedra com musgo.

Regras (TowerFall):
- Um acerto mata. Flecha mata; pisar na cabeça (stomp) mata.
- Cada um começa com 3 flechas (máx 6). Flecha cravada em parede/chão pode ser recolhida passando por cima. Flecha em voo afetada por gravidade leve, gira na direção da velocidade.
- Mira em 8 direções (segurando direção). Atirar segura pra "carregar" mira (≤0.25 s parado no ar com queda lenta é opcional); solte pra atirar.
- Dash/esquiva (cooldown ~0.6 s, i-frames ~0.15 s). Esquivar contra flecha em voo no timing certo PEGA a flecha (catch).
- Pulo com coyote time 0.1 s e buffer 0.1 s, pulo variável (soltar corta), wall-slide e wall-jump, queda rápida segurando baixo.
- Borda da tela faz wrap (sair pela esquerda volta pela direita; idem cima/baixo), inclusive flechas.
- Round termina quando sobra 1 vivo (ou 0: empate). Placar first to 5. Tela de vitória.
- Itens extras desejáveis (só se der tempo, depois do resto): baú que solta flechas especiais (raio = Stormdragon ult, flecha bomba).

## Arquitetura (obrigatória)
- `src/sim/` lógica pura sem three: `world.ts` (estado, step fixo 120 Hz), `physics.ts` (AABB contra tiles, coyote, wall), `arrows.ts`, `rules.ts` (round/placar), `bot.ts`, `input.ts` (interface `Intent {moveX, moveY, jump, jumpHeld, shoot, shootHeld, dash}`), `level.ts` (mapa em grid ASCII 32x18 tiles, tile = 1 unidade; 3 mapas diferentes no estilo TowerFall: "Ruínas do Musgo", "Templo do Totem", "Copas Altas").
- `src/render/` a parte three.js: `scene.ts` (câmera perspectiva baixa FOV ~30° olhando o plano z=0 enquadrando 32x18; fundo em camadas com as imagens `public/assets/bg/canopy.jpg` (longe) e `ruins.jpg` (meio) com parallax leve; tiles como blocos 3D de pedra com textura `public/assets/tex/stone.jpg` e topo de musgo verde), `fighters.ts` (personagens por enquanto como bonecos estilizados low-poly em grupos de malhas: cabeça grande, tronco, braços, pernas, arco; animação procedural de corrida, pulo, mira, morte; cores por personagem), `arrows.ts`, `fx.ts` (partículas de impacto, poeira de pulo, rastro da flecha, flash e slow-motion curto + shake no kill), `hud.ts` (DOM: placar com ícones, contador de flechas por jogador acima da cabeça em 3D ou no HUD).
- `src/audio.ts` WebAudio: `public/assets/audio/music.mp3`, `mizu_shoot.wav`, `mizu_dash.ogg`, `storm_shoot.ogg`, `storm_dash.ogg`, `storm_ult.wav`; sons sintetizados para impacto/pulo/kill.
- `src/ui/` menu DOM: título "The Last Arrow" sobre `public/assets/bg/key.jpg`, escolha de modo (1 jogador vs 1-3 bots, 2 jogadores locais + bots), escolha de personagem, de mapa e de dificuldade de bot (fácil/normal/difícil), tela de controles, pausa (Esc).
- Controles: P1 teclado WASD + J atirar + K pular + L dash (também Espaço = pular); P2 setas + Numpad1/2/3 (ou , . /); Gamepad API para qualquer jogador.
- Bots (`bot.ts`): navegação em grafo de plataformas (pular para plataforma alvo, descer, wall-jump), mirar com previsão do alvo e da gravidade da flecha, esquivar de flecha próxima por dash, recolher flechas quando sem munição, stomp oportunista, níveis de dificuldade (tempo de reação, erro de mira). Não pode ficar parado nem preso em parede: tenha detecção de travamento.
- Ganchos de teste: `window.__tla = { world, setTimeScale, startMatch(opts), state() }` para que um agente possa jogar/conferir por Playwright; `?autoplay=bots4` na URL começa direto partida só de bots (para captura). `?seed=N` determinístico.
- Performance: 60 fps estável no navegador; sem alocação por frame no laço quente quando fácil.

## Feito quando
- `npm run build` passa sem erro de tipo e `dist/` abre via `npx vite preview`.
- Partida 1 humano vs 3 bots funciona do menu até a tela de vitória; bots matam e morrem; `?autoplay=bots4` roda um round completo sozinho.
- Commit no git a cada etapa com mensagem curta em português (repo local já inicializado; NÃO faça push).
- Não leia o repo antigo em Unity. Não use GitHub Actions. Sem fuzz. Não abra navegador no desktop (sem Playwright headful); se precisar testar, `node` + headless chromium em `$HOME/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome` com `--headless=new` pela fila: `agent-bench fila tla rodar -- CMD`.
- Ao terminar escreva `NOTAS-CORE.md` (o que existe, como testar, limites conhecidos).
