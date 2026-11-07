# Controles de videogame — fonte e contrato

Fonte consultada **antes da implementação**, 07/11/2026, Brasília:
- https://towerfall.wikidot.com/how-to-play — seção Game Pad Controls e Basics.
- Diagrama: https://towerfall.wdfiles.com/local--files/how-to-play/controller740.png (imagem aberta e lida).
- https://www.towerfall-game.com/ confirma esquiva e captura como mecânicas centrais, mas não especifica botões.

O diagrama da wiki mostra: botão inferior Jump, esquerdo Shoot, direito Alt Shoot, superior Arrow Toggle, ombros/gatilhos Dodge/Catch, Start Pause. O texto confirma direcional/analógico esquerdo para mover/mirar em oito direções e segurar/soltar para disparar. Não é um manual primário; é uma wiki verificável com o diagrama preservado em `evidencias/gamepad` do despacho. Fandom e StrategyWiki responderam com desafio; PDF presumido não existia, portanto não foram usados como evidência.

| Ação | Xbox | PS5 / DualSense | Gamepad API standard |
|---|---|---|---|
| Mover/mirar | stick esquerdo / D-pad | stick esquerdo / direcional | axes 0/1, buttons 12–15 |
| Pular | A | × | 0 |
| Atirar (segurar/soltar) | X; B como disparo alternativo | □; ○ como disparo alternativo | 2, 1 |
| Esquivar / pegar flecha | LB/RB/LT/RT | L1/R1/L2/R2 | 4–7 |
| Pausar/continuar | Menu/Start | Options | 9 |
| Confirmar / voltar no menu | A / B ou View | × / ○ ou Create | 0 / 1 ou 8 |

**Diferenças explícitas:** Last Arrow não tem Arrow Toggle nem Trigger Arrows: Y/△ fica sem ação; B/○ dispara normalmente em combate. Refluxo e Rajada são habilidades próprias já acopladas à esquiva pelo jogo, não mecânicas de TowerFall. O mapeamento não muda física nem separa essa habilidade existente em outra ação. Menus usam convenção A/× confirma e B/○ volta, não uma afirmação sobre menus de TowerFall.

Somente `mapping === 'standard'` é aceito, sem identificar fabricante por strings. Prompts mostram Xbox e PS lado a lado. Slots locais seguem ordem de conexão disponível, não índice físico: um controle em índice 3 pode ser P1. Reconectar libera/reocupa slot vazio sem deslocar outro jogador. P2 não vira P1 quando P1 desconecta. Online transmite somente o slot local P1; nunca o controle reservado a P2. Nenhuma permissão HID/WebUSB é necessária.

Reset/pausa/blur exigem controles neutros antes de rearmar. Desconexão cancela arco em vez de soltar flecha. Testes com snapshots e CDP são **simulação**, não prova de hardware PS5/Xbox.
