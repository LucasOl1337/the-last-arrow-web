# Ficha da tela — The Last Arrow

## Pedido de controles — 06/11 16:46

1. **Quem usa:** jogador no PC com teclado/mouse; P2 local, controle e toque continuam funcionando.
2. **Tarefas:** escolher layout ergonômico; mirar/atirar sem virar pelo movimento; pular/agachar/usar esquiva pela tecla preferida.
3. **Objeto:** configuração compacta de controles no menu Controles e mira na arena.
4. **Simultâneo:** nome do layout e teclas vigentes, com habilidade explicitamente identificada como esquiva/pegar flecha existente.
5. **Medido:** hoje P1 usa WASD/J/K/L e mira só8direções; simulação sem agachar;4personagens e5mapas, online envia o mesmo Intent.
6. **Estado:** escolha salva neste navegador, vale na próxima entrada e ao voltar da pausa; presets alternativos, nunca acumular todos. Mouse só P1/arqueiro próprio online; P2 local preservado.

Galeria consultada: manter menu conhecido, controles em linhas compactas, sem novos poderes. Stories do componente real antes da integração; portões1366×768,900×1000,844×390. Agachar tem altura/velocidade menores, sem refazer clipes aprovados; testar flecha/solo/teto e reset.

### Crítica dos controles — 17:10

Seletor único+linha com as teclas atuais, dentro do menu conhecido. Tarefa sem rolar nas3larguras; primeiro print horizontal tinha Voltar fora, padding e margens reduzidos e portão repetido aprovou. Ajuda de P2/regras recolhida em details, não empurra o seletor. Cinco stories reais abertas na folha, menu desktop/mobile aberto. Mira mostra cursor cruzado no canvas, hint do round acompanha layout salvo. Captura de agachar mostra corpo baixo/pés no chão e nome reposicionado; não são clipes novos. No online comprovado movimento para esquerda com disparo diagonal para direita. Preservado visual aprovado; limitação assumida é agachar por adaptação do rig, não animação mocap nova.

## Retomada 06/11 15:42 — câmera e sala online

1. **Quem usa:** Lucas no monitor; amigo em outro computador/celular, teclado/controle/toque.
2. **Tarefas:** jogar pelo link público; criar/entrar numa sala de dois; enxergar seu arqueiro maior.
3. **Objeto:** arena e arqueiro próprio, preservando modelos/animações aprovados.
4. **Simultâneo:** plataformas próximas, nome/munição e placar; alternar visão ampla quando precisar ver todas as bordas.
5. **Medido:** versão rodada10, cinco mapas, arena32×18; câmera fixa cobre33,8×19,4; zero transporte de rede existente. Print inicial salvo na retomada.
6. **Estado:** câmera próxima padrão só para um jogador/online, ampla para dois locais; sala por link, servidor decide simulação, desconexão explícita sem fingir partida online.

Galeria consultada: preservar formato conhecido. Stories reais de câmera e sala antes de conectar ao jogo; estados conectando/aguardando/ativo/erro. Provar1366×768,900×1000,844×390. O combate mantém proporção16:9; área menor em janela vertical é deliberada para não cortar a arena inteira na visão ampla.

### Crítica da retomada — prints abertos, 16:10

- Câmera próxima aumenta personagens28% sem alterar clipes aprovados; segue quem joga e mantém C/botão para ver a arena inteira. Recorta adversários distantes deliberadamente; por isso não é padrão para dois locais. Print público mostra P1 maior e flecha legível.
- Sala reaproveita cores/tipografia; convite é selecionável se clipboard falhar. Primeira story mostrou botões cinzentos genéricos e Voltar fora da tela844×390; corrigidos para botões reais secundários e layout compacto horizontal. Agora 18 portões reais passam (6 stories×3larguras) e TODOS os botões cabem.
- Entrada/espera/erro, menu com online, pausa online e câmera foram vistos nas folhas de conferência. Ação principal não exige rolar. Código vazio é entrada do usuário, não configuração vigente ausente; removido placeholder que a régua interpreta como valor implícito.
- Online não pode prometer pausa: overlay explica que combate continua; controles próprios param e Continuar/Voltar estão visíveis. HUD também diferencia sessão online. Renderização e animações existentes não foram substituídas.
- Limite visual: brilho branco de Storm preservado conforme aprovação, e prova em bancada convencional ativa modo leve (~49FPS na leitura após revanche); não extrapolar os60FPS da prova headless antiga para esta superfície.

## Rodada 10 — catch e wrap (antes do código visual)

1. **Quem usa:** P1 teclado contra3 bots, desktop1600×900/notebook1366×768/celular horizontal844×390.
2. **Tarefas:** reconhecer que pegou uma flecha; seguir o arqueiro durante wrap; ler o saque do oponente.
3. **Objeto:** combate real; feedback local no arqueiro, sem painel ou câmera nova.
4. **Simultâneo:** flecha/corpo/nome/munição, mantendo placar e plataformas livres.
5. **Medido:** baseline10 configurações com18s de teclado cada; labels presos à tela escondem o sentido de saída; catch só tem aro de250ms. Quatro personagens, cinco mapas, até4 labels.
6. **Estado:** até2 polimentos: catch com pausa breve45ms+confirmação local550ms; seta no label apenas durante saída pela borda. Sem mexer em colisão, velocidade ou spawn.

Galeria consultada: preservar formato conhecido, sem adensar. Stories reais `Arena/Juice real/Catch` e `Arena/HUD real/WrapComDirecao` antes da integração. Estados: catch ativo→expirado→reset, wrap em quatro bordas→interior→morte. Portão1366×768,900×1000,844×390; os nomes devem continuar inteiros e sem sobreposição. `prefers-reduced-motion` continua pulando hit-stop/flash de tela.

### Crítica rodada10 — prints conferidos

- **Antes:** aro de catch discreto junto dos pés; nomes presos à arena não explicavam de que lado o corpo saiu. Não havia problema de rolagem, portanto sem alterar câmera/menu.
- **Depois:** “PEGOU!” por550ms confirma o catch sobre o próprio P1; aro claro usa pool existente. Print `catch-real.png` mostra o evento real após teclado, munição3→4. Pausa medida em frames33,4ms (alvo45ms discretizado pelo render); com movimento reduzido0ms. Sem flash de tela ou tremor novo.
- Setas brancas no mesmo label, contrastantes com as cores dos personagens; `wrap-four-edges.png` deixa claro ↑Kaze e ↓Akane cortados. `wrap-keyboard-arrival.png` acompanha P1 no lado esquerdo após cruzar pela direita. Ao voltar ao interior/morrer, seta some. Elas sinalizam a borda da arena, não antecipam destino nem alteram wrap.
- Tarefas sem rolar nas3 larguras; olho fica nos arqueiros e não num painel novo. Seis portões/stories aprovados, labels inteiros; folhas antes/depois abertas. Em844×390, “PEGOU!” é pequeno mas legível, sem novo botão. Brilho forte de Storm permanece, fora do escopo.
- Ajuste após o primeiro print integrado: fixture capturava catch durante “LUTEM!” e ocultava o feedback. Corrigida a preparação da prova para aguardar os700ms do aviso real; não se removeu HUD do jogo para fabricar print.

## Rodada 9 — recuperação (antes do código de UI)

1. **Quem usa:** jogador em sessão longa, desktop/notebook ou celular horizontal.
2. **Tarefas:** entender uma interrupção; retomar sem perder placar; continuar com fallback quando um asset falha.
3. **Objeto:** a mesma arena, preservada durante perda de contexto; aviso curto sem cobrir o combate.
4. **Simultâneo:** placar/arena e motivo + ação de recuperação, sem diagnóstico técnico obrigatório.
5. **Medido:** cinco mapas, quatro kits GLB, seis arquivos de áudio; overlay atual apenas manda recarregar e nunca retoma contexto restaurado.
6. **Estado:** contexto perdido congela; restaurado volta pausado com Continuar; asset404 usa fallback e aviso persistente; mapa inválido usa Musgo com aviso.

Galeria consultada: preservar formato conhecido, ação visível sem rolagem. Reusar overlay do Menu e um status compacto no HUD; nada de novo painel. Stories: contexto perdido e aviso de recursos. Portão em1366×768,900×1000,844×390. Exceção de área: diálogo de recuperação não deve ocupar40% só para passar a régua; sua camada ocupa a tela, texto/CTA devem caber integralmente.

### Crítica rodada9 — antes/depois conferidos

- **Antes:** restaurar WebGL deixava a mesma mensagem de erro genérica e obrigava reload; stone404 deixava plataformas pretas, sem explicar o fallback. Prints `antes/contexto-{perdido,restaurado}.png` e `antes/assets-404.png` conferidos.
- **Depois:** olho cai no título “Imagem interrompida”, sem culpar o navegador; recuperação abre pausa com Continuar em destaque, arena/placar preservados. Não precisa rolar. Único reload secundário só para perda permanente, explicitamente rotulado.
- Status de assets fica na faixa inferior, sem ocultar o centro nem exigir clique; stone fallback branco mantém plataformas visíveis e tintadas. Visual simplificado é deliberado, não apresentação normal. Aviso é pequeno, mas legível nos prints integrais; texto agregado cabe nas três larguras sem corte.
- Stories reais `Arena/Menu real/ContextoPerdido` e `Arena/Recursos reais/AssetsIndisponiveis`: seis portões aprovados, caixa/CTA inteiros no viewport, Tab contido no diálogo. Folha `conferencia-story.jpg` e prints reais `assets-404.png`, `contexto-restaurado.png`, `aba-retomada-{pausada,jogando}.png` abertos e conferidos.
- Ajuste frente ao antes: mensagem específica + recuperação sem reload + texel de fallback em vez de plataforma preta. Sem reformular o menu existente.

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

## Rodada 7 — ficha antes do ajuste

1. **Quem usa:** P1 no teclado contra três bots, inclusive PC com CPU lenta; arena horizontal.
2. **Tarefas:** escolher regra da partida; acompanhar placar/tempo corretos; continuar jogando após ajuste automático de qualidade.
3. **Objeto:** arena e quatro arqueiros; aviso secundário não pode ocupar o centro.
4. **Simultâneo:** jogadores, placar, regra vigente e tempo restante; qualidade baixa não muda regras/input.
5. **Medido:** cinco mapas, quatro arqueiros, headhunter de 120 s implementado só na simulação; menu não permite escolhê-lo, HUD ainda diz “Primeiro a 5 / 90s”. Sem governor apesar do comentário no renderer.
6. **Estado:** selecionar Versus ou Headhunter antes de jogar; qualidade só reduz após média real <50 FPS em janela inicial de 2 s, sem oscilar nem interferir na pausa. Aviso discreto e estado vigente no HUD.

Galeria consultada. Stories canônicas para configuração, resultado headhunter/empate e HUD leve antes da integração. Estados sem login/carregamento remoto/permissão não se aplicam. Portão em 1366×768, 900×1000 e 844×390; a arena em letterbox ocupa 50,6% em 900×1000.

### Crítica da rodada 7 (06/11/2026, 11:30 Brasília)

- **Tarefa sem rolar:** Regras fica junto de Modo/Adversários. Primeira story com linha extra cortou o CTA horizontal; três seletores na mesma linha corrigiram. Portão de menu/HUD/arena passa em 1366×768, 900×1000 e 844×390; teste específico também exige Começar/Revanche inteiros no viewport.
- **Primeiro olhar:** arena e arqueiros preservados na qualidade normal. Modo leve é aviso pequeno no canto inferior esquerdo, fora do combate, sem roubar foco; entra nas exclusões do posicionamento de nomes. HUD é DOM e fica nítido mesmo com raster 720p.
- **Ajustes após ver:** resultado em 844×390 cortava Revanche; reduzi logo/retrato/padding apenas em telas baixas. Empate não mostra estatísticas inventadas de um vencedor. Stories reais `Configuracao`, `HeadhunterLeve`, `VitoriaHeadhunter`, `EmpateHeadhunter` conferidas nas três larguras; resultado mantém a exceção de área de diálogo curto (22–30%, não editor).
- **Leve:** o buffer reduzido amacia a imagem 3D e retira brilho do cenário, mas plataforma, flecha, cor e contorno dos arqueiros seguem reconhecíveis. Print 4K e rematch1600 abertos. Visual normal com bloom e pools500/160 permaneceu intacto nos cinco mapas. Não alego qualidade idêntica entre leve e normal.
- **Antes/depois/prova:** `evidence/rodada-7/antes/`, `story-*.png`, `cpu4-4k-antes.png`, `cpu4-4k-leve.png`, `cpu4-leve-1600.png`; todos os prints vistos diretamente ou nas folhas `conferencia-*.jpg`. `story-report.json` e `report.json` guardam os portões; `quality-report.json` mede 13,44→59,88 FPS após raster cap, CPU4 real por CDP.
- **Limite de ambiente:** Chromium com janela apresentada pelo Xvnc permanece ~30–36 FPS, inclusive em Vulkan e modo leve; mudar backend não resolveu. Medição oficial usa render isolado com GPU real, como rodadas4–6, na bancada tla. Não é prova de 60FPS da transmissão VNC.

## Rodada 8 — ficha antes do layout

1. **Quem usa:** pessoa chegando pelo link frio, desktop/teclado ou celular touch 844×390, 932×430 e 390×844.
2. **Tarefas:** começar P1+3 bots; mover/mirar e soltar flecha com dois dedos; pausar/retomar ou girar sem disparo acidental.
3. **Objeto principal:** arena 16:9 com quatro arqueiros; controles não podem esconder suas plataformas.
4. **Simultâneo:** ação, munição/placar, stick e três botões; dica curta só no countdown; som/pausa alcançáveis sem teclado.
5. **Medido:** quatro cartões, três ações touch 64px ocupando 138×138px DENTRO da arena; portrait mostra arena de 390×219px e nomes de 8px; menu deitado já abre com um toque.
6. **Estado:** toque é cancelado em pausa/blur/rotação; portrait interrompe o relógio e pede girar; retoma sem consumir munição. Configuração e desktop preservados.

Galeria consultada nesta rodada: objeto visível sem rolar, uma ação principal, nada abaixo da dobra. Mudança prevista: faixas laterais touch fora da arena; retrato mostra aviso em vez de combate ilegível. Stories canônicas `Arena/Toque real` e countdown do HUD, inclusive cancelamento e retrato. Exceção ao portão de área em retrato: objeto é aviso de girar; a arena não é jogável nessa orientação.

### Rodada 8 — crítica depois dos prints (06/11, 12:05 Brasília)

- **Tarefa 1 sem rolar:** sim; Começar visível nos três viewports mobile e nos dois de siTela. Padrão continua P1+3 bots, um toque entra; o segundo gesto segura/solta Atirar. Link frio local com cache desativado → tiro em 1,75–2,22s (inclui 350ms de prova congelada no portrait), não benchmark de rede móvel.
- **Olho/objeto:** arena ocupa 80,9% em844×390 e82,0% em932×430. Botões64px ficam nas faixas externas; teste geométrico confirma que não interceptam o combate. Sem alterar hitbox/câmera/regras. Pausa/som têm44px. Portrait mostra instrução de girar e preserva tick, não tenta mostrar HUD8px.
- **Ajuste depois de olhar:** nome Stormdragon cobria a ponta da dica; countdown ganhou camada própria, novo print conferido. Primeira story ficava à esquerda e cortava botões por falta do shell/viewport: story agora usa o #app de produção e meta viewport, não CSS especial para passar prova.
- **Antes/depois:** `evidence/rodada-8/antes/` versus `jogo-844x390.png`, `jogo-932x430.png`, `portrait-390x844.png`, `countdown-*.png`. Menu portrait aberto em tamanho original; miniaturas/seletores continuam compactos e parte de seus rótulos é truncada em390px, mas começar não depende de alterá-los. Não alego redesenho completo do menu.
- **Provas:** story real `Arena/Toque real/Countdown`, menu canônico em1366×768,900×1000,844×390,932×430,390×844; gates em `story-report.json`/`mobile-report.json`. Portrait tem exceção explícita de área para arena escondida (26%); aviso, não jogo vertical, é a entrega. Desktop teclado preservado e seus dois gates passaram. Todos os PNGs abertos diretamente ou em `conferencia-*.jpg`; folhas também vistas.
- **Limites:** toque em Chromium emulado (hasTouch/isMobile + CDP), não Safari/aparelho físico. Partidas iniciadas por toque, pilotadas ~3s em tempo real e encerradas a24× com P1 humano sem novo input; não alegar partida inteira pilotada. GLBs carregam de forma assíncrona: primeiro frame do countdown ainda pode exibir o boneco provisório; todos carregados antes do primeiro tiro medido.

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


# Limpeza de combate — feedback recuperado09/11

1. Quem usa: jogadores de Last Arrow no PC, teclado/mouse ou controle, durante combate rápido.
2. Tarefas: localizar seu arqueiro; ler adversários/projéteis; decidir movimento e disparo.
3. Objeto principal: arena e silhuetas/texturas reais de Mizu e Stormy Dragon, não placas de nome.
4. Ao mesmo tempo: personagem, plataformas, flechas e placar existente; indicador de borda só se personagem fora de tela.
5. Dados medidos: print do Lucas mostra dois personagens com duas placas, contornos e círculos sobrepostos; partida suporta2–4 personagens e o HUD atual duplica nomes acima deles e no placar.
6. Estado: proposta local sobre0e51e1a; remover nomes sobre corpos visíveis, halo de proteção e rim/outline permanentes. Manter placar, avisos fora de tela e sinais temporários das habilidades. Sem alteração física/combate, sem deploy autorizado por este participante.

Galeria consultada: preservar formato reconhecido e reduzir densidade. Storybook real existente Arena/Visual legivel será usado como primeiro consumidor. Comparação TowerFall já entregue por missão própria: não repetir notas/referências.

Aceite: corpos visíveis sem fighter-label, halo ou inverted-hull/rim luminoso; offscreen continua com direção identificável; HUD e habilidades sem regressão. Estados: repouso, proteção de spawn, habilidades, borda e morto. Viewports1366×768,900×1000,360×800; gates/layout no canvas, nenhum formulário/editor, teclas e foco preservados. Bloqueio de publicação: precisa do @Lucas. Arquivos de entrega do despachante são exceção explícita pedida; não alterar cron/marcadores/registro global nesta retomada.

## Crítica da prévia09/11
- Antes: círculos e hull azul/ciano chamavam o olho antes de roupas e rosto; duas placas duplicavam o placar.
- Depois: textura/silhueta ficam livres, sem pretender que isso resolve todo o contraste do cenário. Não há nova aprovação do Lucas.
- Ajuste após inspeção: proteção não ficou invisível semanticamente; movida para a linha de status existente do placar, sem um widget novo. Avisos fora de tela preservados (a partida local mostrou dois na borda), logo não alegar remoção de todo texto da arena.
- Mizu ainda é escura contra áreas sombreadas, e o placar de quatro jogadores continua grande: não ampliar este corte para cenário/câmera/HUD inteiro. Pips de munição temporários e habilidades reais permanecem, não são os halos permanentes rejeitados.
- Gate adaptado para CDP da bancada, pois checa_tela.py padrão abre browser não registrado. Canvas100% nas stories em1366×768/900×1000/360×800, sem overflow horizontal. Testes de offscreen/morto/habilidade ativos passaram; SIM serializada idêntica antes/depois. App local1366×768 confirmou personagens carregados e zero nomes em corpos visíveis. Storybook build/check e app build passaram.
