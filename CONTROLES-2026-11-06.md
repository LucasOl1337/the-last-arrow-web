# Controles — pedido do Lucas às16:46 de06/11/2026

Pi `cx/gpt-6-astra-xhigh`, mesma worktree rodada-astra. Escopo novo: layouts ergonômicos e mouse; sem continuar otimização de FPS ou criar poderes novos.

## Entregue

Menu **Controles** (também na pausa), escolha salva por navegador:

| Layout | Movimento | Pulo | Agachar | Habilidade | Mira/tiro |
|---|---|---|---|---|---|
| Plataforma + mouse (padrão) | A/D | W | S | Espaço | mouse/clique esquerdo |
| Atirador + mouse | A/D, W direção de dash para cima | Espaço | S | Q | mouse/clique esquerdo |
| MOBA + mouse | A/D | W | S | R | mouse/clique esquerdo |
| Alternativo H | A/D | W | S | H | mouse/clique esquerdo |
| Clássico | WASD move/mira | K/Espaço | — | L | J |

Segurar/soltar clique arma/solta flecha, como o arco existente. Habilidade significa **esquiva que pega flechas**, não nova skill/ultimate. P2 local mantém setas+numpad1/2/3; online usa mouse no arqueiro próprio. Toque preservado; gamepad ativo retoma mira e Start continua entrando/saindo do menu.

Mira contínua projetada pelo canvas/câmera, independente de andar; não limitada a8direções. S no chão reduz altura física de1,1 para0,6 e velocidade a40%; no ar continua queda rápida. Pés ficam no chão; teto impede levantar; hit de flecha/pisão acompanha corpo. Esc cancela saque sem gastar flecha, inclusive online. Arquivos/clipes de animação aprovados não trocados; agachar adapta escala vertical do rig existente, não é clipe novo.

## Prova focada

- 7 testes específicos: direção contínua+strafe, altura/pés, teto, flecha passa por cima, validação de rede, cancelar tiro no menu, presets sem conflito.
- 6 regressões afetadas do sim: coyote/pulo, colisão AABB, wrap, tiro8direções legado, catch e pisão.
- 2 testes rede existentes com extensão de mira enviada ao servidor; backend typecheck, frontend build e Storybook build.
- Navegador real:5layouts por teclado/mouse, cada um com pulo/skill;4 com mira independente+tiro+agachar; persistência após reload;3portões1366×768/900×1000/844×390. Fixture declarada para isolar input, não partidas espontâneas.
- Online real local: outro cliente confirma agachar, aim contínuo contra strafe, tiro, puloW, dashEspaço e cancelamento de saque na pausa sem gastar munição.
- Compatibilidade: P2 local controla apenas slot1; gamepad mock só na borda navigator.getGamepads exercita Controls real, retoma mira do mouse e Start pausa/continua; troca paraR pela pausa funciona. Não é prova de controle físico plugado.
-5stories reais do seletor passaram em844×390. Story antes da integração; preview6107 estava com índice velho no navegador, superfície privada6108 corrigiu sem mexer em browser compartilhado. Primeiro ensaio usava fixture dentro do piso (y16,45 em mapa cujo chão é16); corrigida para15,45. Sem alterar produto para satisfazer fixture.
- Ajuste UI: Voltar saía da tela horizontal; painel compacto corrigiu, prova final passou. Prints conferidos em`evidence/controles/`.

Publicação segue Hostinger+arrow.symbiose.si, build local, sem Actions. Conferir salas antes do deploy. Nenhum arquivo pendente da worktree principal foi tocado.
