# Rodada 5 — P1 humano por teclado

## Bugs → correção → prova

- **Pausa dispara sozinha:** segurar J → Esc → soltar J → Esc gastava uma flecha (3→2; tick 154 no primeiro diagnóstico). Pausa/blur agora cancelam o saque humano, sem consumir munição; novo gesto continua atirando. Commit `491ec32`; regressão `scripts/proof-rodada-5-pause.mjs`, `pause-report.json` e prova final passaram.
- **Mute dessincronizado:** M silenciava, mas pausa/menu diziam “Som ligado”. Um estado sincroniza teclado, HUD e menus, inclusive `aria-pressed`. Commit `4786885`; regressão `proof-rodada-5-mute.mjs`, story `Arena/Menu real/SomSilenciadoExternamente` e prova final passaram.
- **Fundo ausente no catálogo:** story revelou 404 em `assets/assets/bg/key.jpg`; CSS interpretava URL relativa ao bundle. Resolvido contra a base do documento. Commit `445d783`; story com 0 erros/404 e fundo conferido.
- **Configuração escondida em horizontal baixo:** print 844×390 mostrava só logo, sem botão de começar. Media query por altura põe configuração ao lado do logo. Commit `2ee69d3`; regressão mede CTA inteiro dentro da tela, além do portão siTela. É o segundo e último polimento.
- **Polimento 1:** miniaturas de Cachoeira/Raízes passam a usar seus temas; nomes curtos cabem na faixa, nomes completos continuam acessíveis. Sem lazy load nas cinco escolhas visíveis. Commit `a2fd804`; story confere imagens, temas e navegação por setas.

## Jogabilidade comprovada

- P1 **humano**, entrada por `Playwright keyboard`, contra **3 bots**, entrando pelo menu em todos os mapas nas duas resoluções. Caminhada, K/Espaço, dash L, saque/soltura J, baixo para queda, tiros/recuperações e abates reais registrados.
- `controls-report.json`: oito direções normalizadas e retidas durante o saque; pulo após sair da borda (x=10,377, vy depois = −15,43); pulo antecipado ao pouso; wrap esquerda/direita/topo/baixo; flecha disparada no chão → impacto → pickup (munição volta a 3); pisão → morte e rebote −10.
- Casos de borda/pisão usam posições iniciais explícitas nos mapas reais, depois teclado e simulação normal, com bots ativos; não são alegados como encontros espontâneos. Nenhuma alteração em `src/sim`, nenhum fuzz.
- Gamepad **simulado pela Gamepad API**, não controle físico: direcional/diagonal, A, X, B e Start pausa/retoma. Esc congela tick; controles → voltar → retomar e mute também passaram.
- Uma partida P1+3 bots concluída por mapa, com vitória em cinco pontos, seguida de **revanche → jogar → pausa → menu**. Rounds finais: Musgo 10, Totem 11, Copas 14, Cachoeira 9, Raízes 15. Após a janela de teclado/FPS, conclusão acelerada a 24× com P1 ainda humano sem novas teclas; não confundir com FPS ou partida inteira ativamente pilotada.

## Prova final

`evidence/rodada-5/report.json`: **0 erros** de página/console/HTTP, **0 falhas de áudio**, todos os modelos carregados.

| Mapa | FPS real 1600×900 | FPS real 1366×768 |
|---|---:|---:|
| Musgo | 60,00 | 60,00 |
| Totem | 60,01 | 59,99 |
| Copas | 59,95 | 59,98 |
| Cachoeira | 60,00 | 60,00 |
| Raízes | 59,99 | 60,01 |

Mínimo real **59,948**, diagnóstico mínimo **59,207**: todos ≥58, sem regressão relevante frente aos ~60 FPS da primeira passagem. `npm run build`, `check:storybook` e `build-storybook` passaram. Só provas focadas, sem suíte inteira/`npm test` (simulação intocada).

PNGs em `evidence/rodada-5/` **abertos e conferidos**, incluindo os dez de jogo, `p1-mira-diagonal.png`, `p1-pisao.png`, `vitoria.png`, `revanche-p1.png`, `menu-apos-revanche.png`, `pausa-mute.png` e stories. Antes em `antes/`; crítica antes/depois em `ficha-tela.md`. Story/portão em 1366×768, 900×1000 e 844×390 aprovados; o teste específico de CTA evita o falso conforto do portão de área.

Execução exclusivamente em **tla**, via `/tmp/tla-prova.sh`, com fila pesada. Browser privado/page registrados em `web-events.ndjson`, fechados em `finally`; **0 abas próprias restantes**, preview/Storybook encerrados, vaga liberada. Chromium preexistente da bancada preservado.

**Sem push nem publicação.** Commits no branch `rodada-astra`. `evidence/rodada-2/` preexistente preservado e fora dos commits.
