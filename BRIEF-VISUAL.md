# Brief: passada gráfica 1 (personagens 3D Tripo + cenários por mapa)

Projeto: ~/Projects/the-last-arrow-web (Vite + TS + three). O núcleo já funciona (leia `NOTAS-CORE.md`,
`src/render/*.ts`, `src/sim/world.ts` só no que tocar). NÃO mexa em `src/sim/` (regras/física/bots).
Arquivos-alvo: `src/render/fighters.ts`, `src/render/scene.ts`, `src/render/fx.ts`, `src/render/arrows.ts`, novos arquivos em `src/render/`.

## 1. Personagens 3D reais (prioridade)
Assets prontos em `public/assets/models/`:
- `mizu.glb` e `storm.glb`: malha texturizada com skin Mixamo (ossos `mixamorig:*`), comprimida com
  `EXT_meshopt_compression` + `KHR_mesh_quantization` → use `GLTFLoader` com `setMeshoptDecoder(MeshoptDecoder)`
  de `three/examples/jsm/libs/meshopt_decoder.module.js`. Modelo ~1 unidade de altura, frente para -Y do Blender
  (no three costuma vir olhando +Z ou -Z; ajuste a rotação para ficar de perfil, virado para +X quando facing=1).
- Animações só de esqueleto (mesmos nomes de osso): `mizu_anims.glb` (idle, jump, shoot, fall, victory_celebration),
  `mizu_run.glb` (run), `storm_anims.glb` (run, idle, jump, shoot, fall). Aplique os `AnimationClip` desses arquivos ao
  `SkinnedMesh` do modelo por `AnimationMixer` (nomes de track batem por osso; remova tracks de posição do Hips
  exceto Y para não andar sozinho / root motion). Storm não tem victory: use idle. Mizu pode usar run do mizu_run.
- Mapeie estados: chão parado→idle, correndo→run (timeScale proporcional a |vx|), subindo→jump, caindo→fall,
  mirando/carregando→shoot (pausar perto do frame de puxar a corda enquanto carrega), morte→ragdoll fake (tombar +
  dissolver/partículas), vitória→victory_celebration. Crossfade 0.08–0.15 s.
- Escala: personagem ~1.6 tiles de altura (a hitbox é ~1x1.4; ajuste visual). Espelhar por rotação Y, não scale negativo.
- Kaze e Akane: reusar mizu/storm clonando (`SkeletonUtils.clone`) e tingindo o material (multiplicar cor por verde/vermelho) para diferenciar.
- Arco: o modelo já tem arco; adicione um brilho/linha de mira e uma flecha encaixada visível ao carregar.
- Se o GLB falhar ao carregar, mantenha o boneco procedural atual como fallback (não quebrar o jogo).
- Sombra suave embaixo (blob) e contorno/rim light para ler bem contra o fundo.

## 2. Cenário por mapa
Fundos (16:9) em `public/assets/bg/`: `ruins.jpg` + `canopy.jpg` (Ruínas do Musgo), `templo.jpg` (Templo do Totem, noite, runas teal),
`copas.jpg` (Copas Altas, pôr do sol, pontes de madeira). Cada mapa usa o seu fundo, com parallax leve e névoa/raios de luz.
Tiles: hoje são blocos verdes chapados. Faça blocos de pedra com `public/assets/tex/stone.jpg` (repetida por UV mundial),
topo de musgo irregular (geometria com bordas onduladas/tufos instanciados), musgo pendurado/cipós nas bordas inferiores,
e no Copas Altas tábuas de madeira (cor madeira + veios procedurais). Use InstancedMesh.
Set dressing por mapa (instanciado, barato): samambaias, cogumelos brilhantes (emissivos teal), flores, vagalumes
(Points animados), tochas com luz pontual no Templo, lanternas no Copas. Cor/luz copiando os concepts em `art/lvl_templo.png`, `art/lvl_copas.png`, `art/raw/key.png` (abra 1 vez cada).
Iluminação: hemisférica + direcional quente com sombras só nos personagens/tiles (shadowMap PCFSoft, mapa 2048), tone mapping ACES, sRGB, leve bloom (UnrealBloomPass) se 60 fps aguentar.

## 3. Juice
Flecha: modelo fino com penas e ponta, rastro (trail) e brilho ciano na do Stormdragon; ao cravar, vibra 0.2 s.
Kill: hitstop 80 ms, slow-motion 0.3 s, shake, explosão de folhas/penas na cor do personagem, flash branco curto.
Pulo/aterrissagem: poeira. Dash: rastro fantasma (afterimage) do personagem.

## Feito quando
- `npm run build` passa; `?autoplay=bots4` mostra os 4 lutadores 3D animados (correndo, pulando, mirando) em cada um dos 3 mapas.
- Capture prova headless pela fila (`agent-bench fila tla rodar -- node scripts/browser-test.mjs` ou o capturador existente) com prints de cada mapa em `evidence/visual-1/` e confira você mesmo os prints (personagem legível, olhando para o lado certo, pés no chão, não gigante nem minúsculo).
- 60 fps em 1600x900 (meça e registre).
- Commits locais pequenos em português. Sem push. Sem fuzz. Não abrir navegador no desktop.
- Escreva `NOTAS-VISUAL.md` curto.

## Publicação (obrigatório)
O jogo vai para GitHub Pages em `/the-last-arrow-web/`. Todo caminho de asset em TS deve sair de
`import.meta.env.BASE_URL + 'assets/...'` (nada de `'/assets/...'` absoluto); no CSS use `url('./assets/...')` relativo
ou injete pelo TS. Corrija também os que já existem (scene.ts, style.css, audio.ts, menu).
