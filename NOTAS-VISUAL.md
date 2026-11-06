# Passada gráfica 1: notas

06/11/2026, 08:35 (Brasília). Só `src/render/`, `src/ui/menu.ts`, `src/style.css`, `src/main.ts`, `src/paths.ts`, `vite.config.ts` e scripts. `src/sim/` e `tests/` ficaram intocados (eram de outra frente). Sem push.

## Feito quando

| Critério | Resultado |
| --- | --- |
| `npm run build` | passa (bundle ~800 kB, aviso de tamanho elevado para 900 kB em `vite.config.ts`) |
| 4 lutadores 3D animados nos 3 mapas | `evidence/visual-1/{moss,totem,canopy}-1..4.png` (autoplay bots4). Amostra de 6 s em jogo: run 105, jump 100, fall 230, shoot 15 |
| Prova headless pela fila, prints conferidos | `scripts/visual-proof.mjs` na bancada `tla`. Prints abertos e conferidos: personagem com ~1,7 tile, de perfil para o lado certo (facing −1 olha para a esquerda), pés no chão, mira diagonal com flecha encaixada, morte tombando e dissolvendo |
| 60 fps em 1600×900 | Musgo **59,84**, Templo **59,84**, Copas **59,67** fps (360 quadros cada, vsync 60). Trabalho JS+render médio 1,3–1,6 ms, pico 40–45 ms (carga de shader/textura no início do round). Medido com a máquina sob compilação Unreal (load ~15) |
| Regressão | `npm test` passa; `scripts/browser-test.mjs` completo passa (menu, teclado, gamepad, pausa, vitória, revanche sem acumular geometria), zero erros, zero abas no fim |

Outros prints: `poses.png` (mira, corrida, carga, pulo), `death.png`, `juice-kill.png`, `juice-dash.png`, `fallback-procedural.png` (todos os GLB bloqueados: bonecos procedurais e jogo segue sem erro). Relatório: `evidence/visual-1/report.json`.

## O que mudou

- **Personagens** (`characters.ts`, `fighters.ts`, `characterMaterial.ts`): GLTFLoader + MeshoptDecoder, um kit por personagem (Kaze e Akane com modelo próprio, conforme a atualização do brief); se um falhar, usa o irmão tingido; se todos falharem, `puppet.ts` (boneco antigo). Root motion removido (Hips só em Y). Estados: idle, run (timeScale ∝ |vx|), jump, queda (trecho do `jump`, porque o `fall` gira o corpo para a câmera), shoot travado na pose de corda puxada enquanto carrega, morte (fim do `fall` + tombo + dissolver com borda na cor do personagem + flash), vitória. Crossfade de 0,12 s. Espelho por rotação Y (−0,35 rad de 3/4). Mira de 8 direções inclina Spine1/Spine2. Linha de mira, flecha encaixada, sombra blob, rim light e contorno (casco invertido com polygon offset).
- **Cenário** (`themes.ts`, `terrain.ts`, `scene.ts`, `textures.ts`): fundo próprio por mapa com parallax leve e desfoque suave, névoa em faixas, raios de luz, vagalumes em shader. Pedra com UV mundial, tampa de musgo irregular extrudada, tufos, cipós pendurados, samambaias, cogumelos emissivos, flores. Templo com runas teal pulsando e 4 tochas com PointLight. Copas com deck de tábuas (veios procedurais), toras, escoras, corda e lanternas com luz. Tudo em InstancedMesh. ACES, sRGB, sombra 2048 (PCF; o PCFSoft foi fundido no PCF no three r18x), bloom a meia resolução (`?bloom=0` desliga).
- **Juice** (`fx.ts`, `arrows.ts`, `chests.ts`): flecha com penas e ponta, rastro, brilho ciano na do Stormdragon, vibração de 0,2 s ao cravar. Raio ciano com halo e faíscas, bomba com pavio vermelho e fumaça, explosão com anel, partículas e shake. Kill: hitstop de 80 ms, câmera lenta de 0,3 s, shake, folhas e penas na cor do personagem, flash. Poeira no pulo e na aterrissagem; afterimage no dash; baús com brilho por recompensa.
- **UI**: logo no menu e na vitória, retratos no placar e na vitória, contagem `3·2·1` vinda de `world.countdown`.

## Publicação (GitHub Pages)

`vite.config.ts` usa `base: '/the-last-arrow-web/'` (com `TLA_BASE=/` dá para gerar build na raiz). Todo asset em TS passa por `asset()` em `src/paths.ts` (`import.meta.env.BASE_URL + 'assets/...'`): cena, modelos, áudio, retratos e logo. O fundo do menu no CSS virou `var(--key-art)`, injetado pelo TS. O favicon usa `%BASE_URL%`. O `browser-test.mjs` e a prova visual servem o `dist` em `/the-last-arrow-web/`.

## Limites

- Os clipes Tripo/Mixamo são genéricos: o `shoot` ajoelha (lê bem como "carregando", mas não é um tiro em pé) e o `fall` gira o corpo, por isso a queda usa um trecho do `jump`. Um clipe de queda e um de tiro em pé melhorariam a leitura.
- A morte é um ragdoll falso (pose + rotação + dissolver), sem física.
- 60 fps medido no Chromium headless da bancada com a GPU da máquina (RTX 4070 Ti SUPER), sob carga alta de CPU. GPU integrada fraca pode precisar de `?bloom=0`.
- Texturas dos modelos têm 4096² cada (cerca de 90 MB de VRAM por personagem). Reduzir para 2048² cortaria o download e a VRAM.
