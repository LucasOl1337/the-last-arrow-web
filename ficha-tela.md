# Ficha da tela — The Last Arrow

1. **Quem usa:** jogador de arena local, teclado ou controle, desktop/notebook; dois jogadores podem compartilhar a máquina.
2. **Tarefas:** configurar uma partida; lutar lendo arena, munição e placar; reiniciar ou trocar configuração após a vitória.
3. **Objeto principal:** arena 32×18 durante a partida; configuração da partida no menu.
4. **Visão simultânea:** quatro lutadores, plataformas, flechas e placar; no menu, modo, personagens, mapa e dificuldade.
5. **Dados medidos:** 3 mapas, 4 personagens, 2 modos humanos + espectador, até 4 jogadores, 0–6 flechas por jogador, vitória em 5 pontos; 3 fundos, 1 textura e 7 arquivos de áudio presentes.
6. **Estado:** escolhas valem ao iniciar; HUD reflete a simulação; pausa congela a partida; vitória oferece revanche com as mesmas escolhas ou volta ao menu.

## Regras e catálogo

- Uma ação principal: entrar na arena. Configuração compacta, título sobre a arte fornecida; sem painel administrativo.
- Arena em 16:9 sem deformação; em viewport alto usa letterbox. Exceção documentada ao portão de área de 40% em celular vertical: o jogo é local e horizontal, não oferece controles touch.
- Teclado com foco visível, labels associados, Escape pausa/retoma; gamepad funciona no combate, menu pelo teclado/mouse.
- Estados do catálogo: configuração padrão, dois humanos, controles, pausa, vitória, falha WebGL com recuperação. Não há login, permissão, rede de produto nem formulário de texto longo.
- Stack é DOM + Three.js, sem React. Usar adaptador Storybook HTML/Vite para importar o menu canônico, sem introduzir React.
- Galeria consultada: priorizar objeto sem rolagem, escolhas nomeadas e uma ação principal; evitar cartões/configurações redundantes.

## Crítica e provas

A preencher após captura dos componentes reais e do jogo em navegador isolado.
