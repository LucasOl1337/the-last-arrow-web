# Ficha da tela — The Last Arrow

1. **Quem usa:** jogador de arena local, teclado ou controle, desktop/notebook; dois jogadores podem compartilhar a máquina.
2. **Tarefas:** configurar uma partida; lutar lendo arena, munição e placar; reiniciar ou trocar configuração após a vitória.
3. **Objeto principal:** arena 32×18 durante a partida; configuração da partida no menu.
4. **Visão simultânea:** quatro lutadores, plataformas, flechas e placar; no menu, modo, personagens, mapa e dificuldade.
5. **Dados medidos:** 3 mapas, 4 personagens, 2 modos humanos + espectador, até 4 jogadores, 0–6 flechas por jogador, vitória em 5 pontos; 3 fundos, 1 textura e 7 arquivos de áudio presentes.
6. **Estado:** escolhas valem ao iniciar; HUD reflete a simulação; pausa congela a partida; vitória oferece revanche com as mesmas escolhas ou volta ao menu.

## Rodada 4 — recorte antes da alteração

1. **Quem usa:** jogador/espectador desktop, referência 1600×900.
2. **Tarefas:** localizar os quatro arqueiros; ler direção de mira/munição; acompanhar abate e próximo round.
3. **Objeto principal:** arqueiros reais GLB dentro da arena, não retratos do menu.
4. **Visão simultânea:** silhueta, nome, arco, plataformas e flechas, preservando enquadramento completo.
5. **Medido no código e prints:** altura visual 1,8 tiles (~84 px), nomes 8 px; 4 arqueiros, 5 mapas disponíveis. Temple/Copas têm alto contraste de fundo que compete com os modelos.
6. **Estado:** mudança apenas visual; altura alvo 2,4 tiles, pés na base original, sem aumentar a hitbox. Prova integrada por `dist/` na bancada `tla`, conforme brief; catálogo de menu existente não é alterado.

Galeria consultada nesta rodada. Antes: `evidence/rodada-2/poses-templo.png` e `canopy-autoplay.png`, abertos: nomes minúsculos e bordas internas serrilhadas competem com textura/rosto. Manter a câmera atual (arena já ocupa ~93% da altura); ampliar zoom arriscaria cortar as plataformas superiores.

### Crítica da rodada 4 (06/11/2026, Brasília)

- **Tarefa sem rolar:** localizar arqueiros/ler nomes é possível na própria arena; quatro nomes estão em 16 px a 1600×900 e ≥11 px nos viewports menores. Portão integrado passou em 1366×768 (99,9% de área principal) e 900×1000 (50,6%, letterbox).
- **Primeiro olhar:** agora cai nas silhuetas coloridas, não apenas na pintura. Templo e Copas preservam fundos diferentes sem perder identidade dos jogadores. A altura em pé é ~112 px, antes ~84 px; luz/sombra separa tecido do cenário.
- **Ajuste após olhar:** primeira prova mostrou nomes cortados no salto/wrap e sobre placar. Segunda rodada prende os nomes à arena e separa rótulos próximos/placar, com zero sobreposições medidas. Para arqueiro parcialmente fora da arena, o nome fica na faixa livre mais próxima, em vez de desaparecer.
- **Mira:** o close revelou clipe orientado no eixo errado; corrigido e conferido novamente pela posição do osso da mão e pelo print `evidence/rodada-4/mira-regressao-close.png`. A pose de saque é agachada (altura menor que em pé), comportamento do clipe, não mudança de hitbox.
- **Limites honestos:** há brilho forte no Storm e decoração de fundo ainda detalhada. O topo do corpo pode sair da tela durante o wrap vertical; não é plataforma atravessada. Não foi aplicada câmera mais fechada, pois pioraria o recorte. Não houve prova de colisão visual 1:1: a hitbox continua 0,64×1,10 por contrato do brief.
- **Artefatos:** antes em `evidence/rodada-4/01-legibilidade/`, ajuste de HUD em `02-hud/`, final na raiz. PNGs de jogo, mira, abate e responsividade abertos e conferidos, não apenas produzidos.

## Rodada 5 — ficha antes do ajuste

1. **Quem usa:** P1 no teclado/gamepad, desktop 1600×900 e notebook 1366×768.
2. **Tarefas:** jogar e pausar sem perder flechas; conferir som vigente; escolher arena/revanche.
3. **Objeto:** estado do combate e os mesmos controles do menu canônico.
4. **Visão simultânea:** som real e rótulo do botão; nome e miniatura da arena escolhida.
5. **Medido:** 5 mapas em uma faixa de 267 px no notebook; Cachoeira/Raízes usam miniatura genérica e nomes espremidos; `M` deixa “Som ligado” apesar do HUD mudo.
6. **Estado:** áudio tem uma fonte de verdade; pausa cancela saque humano sem consumir munição. Limite de dois polimentos: escolhas de mapa com tema correto/nome curto (nome completo acessível) e configuração acima da dobra em tela horizontal baixa.

Galeria consultada. Story `Arena/Menu real` já importa produção; acrescentado estado silenciado externamente e medidos 1366×768, 900×1000 e 844×390 (celular horizontal). Sem redesign da arena, sem mudança de simulação. A regressão de pausa/blur não altera aparência; Storybook não se aplica à lógica de input.

### Crítica dos prints da rodada 5

- **Tarefa sem rolar:** desktop/notebook já cabiam; no print 844×390 a arte tomava a primeira tela e escondia configuração/CTA. O portão de área sozinho não enxergou isso (mediu `.menu-content`, que inclui o logo). Acrescentada asserção específica de CTA inteiramente dentro do viewport. Ajuste por altura, só abaixo de 600 px: logo à esquerda, configuração à direita. Antes `evidence/rodada-5/antes/menu-story-844.png`; depois `menu-story-844.png`, ambos abertos.
- **Primeiro olhar:** no jogo cai em P1 azul/arqueiros e nas plataformas; no menu a arte permanece, mas as cinco arenas têm miniatura carregada e tema correspondente. Nomes curtos não quebram em duas linhas a 1366 px; nome completo continua no radio acessível.
- **Estado antes escondido:** pausa exibia “Som ligado” com HUD já mudo; agora teclado, HUD e menu concordam e a story importa o mesmo `Menu`. Story revelou ainda URL de fundo relativa ao CSS compilado (`assets/assets/bg/key.jpg`, 404); URL absoluta derivada da base do documento corrigiu o catálogo sem hardcode de deploy.
- **Prova:** `check:storybook`, `build-storybook` e build do jogo passaram. `menu-story-report.json`: zero erros, portão aprovado nas três larguras e CTA dentro da tela; interação por setas no seletor preservada. Stories de som e menu abertas em todos os tamanhos. Os diálogos curtos conservam a exceção de área já documentada.
- **Limites:** mapa do menu continua uma miniatura do tema, não uma planta das plataformas. Brilho de Storm e diferença entre corpo visual/hitbox da rodada 4 preservados; não adicionada carga de renderização nem zoom.

## Rodada 6 — ficha antes do ajuste

1. **Quem usa:** P1 humano no teclado contra três bots, 1600×900.
2. **Tarefas:** ler tiro e direção; acompanhar corrida; prever queda/pouso.
3. **Objeto:** corpo animado dos quatro arqueiros, sem mudar hitbox, mapas ou HUD.
4. **Visão simultânea:** arco, pés, plataforma e flecha real.
5. **Medido:** vídeo inicial de 12 s no Templo; `shoot` baixa a cabeça de ~0,76 para ~0,46 unidade no Mizu; `fire` mantém ~0,76 e aponta +X. Corridas têm deslocamentos diferentes (2,44–3,24 unidades/1,25 s); quatro texturas 4096².
6. **Estado:** até quatro correções: tiro em pé; cadência proporcional por modelo; pulo/queda/pouso com ações separadas; textura 2048² com comparação. Simulação preservada.

Galeria consultada. Prova inicial: `evidence/rodada-6/antes/video-antes.mp4` e frames abertos. Fixture de animação importa o renderer real; nenhuma alteração de componente DOM/menu. Prova integrada e portão de arena em 1366×768 e 900×1000 permanecem obrigatórios.

### Crítica da rodada 6 (06/11/2026, 10:44 Brasília)

- **Tarefa sem rolar:** arena continua inteira nos dois viewports do portão; story real também passou em 844×390. Nenhum menu/HUD foi redesenhado.
- **Primeiro olhar:** arco e corpo agora permanecem em pé ao sacar. Antes o personagem perdia quase metade da altura e virava 90°; depois a mão estende para o lado correto nos quatro modelos. Frames dos dois vídeos de 12 s e prints de tiro foram abertos.
- **Ajuste depois de olhar:** corrida usa deslocamento raiz medido antes de removê-lo, incluindo escala horizontal real; pulo/queda não disputam mais a mesma ação do mixer. Pouso tem 140 ms de recuperação, sem travar controle. O salto real de P1 registrou jump → fall → land → idle, com pesos simultâneos na transição.
- **Texturas:** comparativo `texturas-4096-vs-2048.png` (4096 acima, 2048 abaixo) aberto: mantidos contorno, rosto, faixas de roupa e cores. JPEG 2048²/92/4:4:4; geometria comprimida e rig byte a byte preservados. Não há justificativa visual para manter 4096² nesta câmera.
- **Limites:** Storm continua muito luminoso; morte ainda é dissolução/tombo, não física. Cadência corrigida não equivale a foot-lock/IK (especialmente mira em movimento). Queda continua extraída de `jump`, agora como ação independente. Vídeos Playwright não têm áudio; o relatório verifica carregamento, não qualidade sonora.
- **Prova:** cinco PNGs de mapas, poses, stories, responsividade e frames conferidos. FPS real mínimo 60,056; diagnóstico mínimo 59,586. Zero erros; servidores/abas próprios fechados. Story `Arena/Animacao real/TiroEmPe` importa `FightersView` e `ArenaScene`, sem renderer paralelo.

## Regras e catálogo

- Uma ação principal: entrar na arena. Configuração compacta, título sobre a arte fornecida; sem painel administrativo.
- Arena em 16:9 sem deformação; em viewport alto usa letterbox. Exceção documentada ao portão de área de 40% em celular vertical: o jogo é local e horizontal, não oferece controles touch.
- Teclado com foco visível, labels associados, Escape pausa/retoma; gamepad funciona no combate, menu pelo teclado/mouse.
- Estados do catálogo: configuração padrão, dois humanos, controles, pausa, vitória, falha WebGL com recuperação. Não há login, permissão, rede de produto nem formulário de texto longo.
- Stack é DOM + Three.js, sem React. Usar adaptador Storybook HTML/Vite para importar o menu canônico, sem introduzir React.
- Galeria consultada: priorizar objeto sem rolagem, escolhas nomeadas e uma ação principal; evitar cartões/configurações redundantes.

## Crítica e provas

### Crítica das capturas (06/11/2026, 07:07 Brasília)

1. **Tarefa 1 sem rolar:** sim, em 1366×768, 900×1000 e 360×800. Modo, bots, personagens, arena, dificuldade e Começar ficam visíveis. No menu de dois humanos o foco permanece no seletor de modo após sua reconstrução.
2. **Primeiro olhar:** título e CTA dourado, com o confronto ilustrado à direita. Na partida, o centro fica reservado ao combate e o placar compacto no topo. Não há painel lateral ocupando a arena.
3. **O que estava duro:** labels de 11 px e opções de 13 px no menu, difíceis no notebook; contador/nomes dos bonecos um pouco afastados. Ajustei labels para 12 px, opções para 14 px, CTA para 13 px e projetei os nomes pela câmera real em vez de uma aproximação de porcentagem. Acrescentei retenção do foco e ciclo Tab nos diálogos.

**Antes:** `evidence/stories-before/menu-1366x768.png`, `menu-900x1000.png`, `menu-360x800.png`.

**Depois:** mesmos nomes em `evidence/stories-after/`; arena em `evidence/browser-final/arena.png`. As capturas foram abertas e inspecionadas. A configuração ocupa 71%, 46,2% e 75,1% do viewport; sem rolagem horizontal, sem ajuda longa nem campos vazios. Todas as medidas do menu passaram.

**Portão:** `scripts/check-screen.mjs` importa o `MEDIR_JS` e executa a função `julgar` do `checa_tela.py` da siTela sem alterar a régua; substitui somente o transporte por Playwright Node + Chromium headless explícito dentro da bancada/fila. Relatórios completos: `evidence/stories-after/report.json` e `evidence/browser-final/report.json`.

**Exceção de produto:** pausa, vitória e erro são diálogos curtos de decisão, não objetos editáveis. Não precisam ocupar 40% da janela; a medida b fica registrada como exceção, não como sucesso artificial. Nenhum outro limite é relaxado. O menu principal e a arena passam sem essa exceção.

**Limite visual restante:** os bonecos e blocos são a arte provisória pedida, não o acabamento final. A floresta tem detalhe que compete com os projéteis; fundo recebeu véu escuro e flechas recebem emissividade/rastro. A frente de arte pode simplificar ainda mais o contraste sem mudar a simulação.
