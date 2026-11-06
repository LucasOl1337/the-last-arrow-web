# Rodada 10 — checkpoint

- Contrato: branch rodada-astra; até15:45 Brasília06/11; sem push/publicação; máximo3 mudanças de gameplay+2 polimentos; testes exatos, sem suíte/fuzz. Provas em tla(:80/workspace26), /tmp/tla-prova.sh+fila pesada.
- Notas4–9 lidas. Estado inicial5c00ea5; evidence/rodada-2 preexistente preservada. Skills eficiência/convivência/agent-bench/siTela/storybook-first carregadas, galeria consultada.
- Baseline numérico fechado: scripts/p1-rodada-10.mjs (não ajustar depois);20 rounds consecutivos por mapa/dificuldade seed3. P1 simples observa5Hz, persegue posição visível,8 direções, pulo/dash periódico, sem bot/pathfinding/antecipar flecha. easy22/100,8,829s;normal12/100,9,152s;0 timeouts. `evidence/rodada-10/antes/balance-report.json`.
- Prova de teclado baseline em execução `/tmp/tla-10-play-before.log`, PID inicial1162994, abre só browser privado GPU da bancada,18s a1× por configuração(10), finally limpa. Build baseline passou. Prints moss/totem abertos.
- Hipóteses: reação nominal é só frequência de polling, catch permite nova flecha sem atraso; mira easy/normal recalcula todo tick durante saque; todos escolhem mesma política de navegação/baú. Três mudanças propostas: percepção antes do catch; saque legível sem rastrear a120Hz; personalidade por personagem. Não tocar spawn/mapas/limite90s sem bug comprovado.
- Polimentos propostos (ainda não implementados): catch com confirmação curta; direção de retorno no wrap usando label existente. Ler/atualizar ficha e stories reais antes.
- Baseline higiene:0 abas próprias;2 IDs convencionais preexistentes5264C304224BD8497AF9E231E3FA73B6,E8B7D3B3BA43D86947A2E3E2ACC8D2D9. Não fechar. Porta4176 preview e19190 browser privado só enquanto prova.
- Próximo: acabar/inspecionar baseline visual; testes vermelhos do caso exato→3 mudanças no bot com métricas fixas após; stories/polimento; build+prova final0 erros/≥58FPS5mapas; abrir prints; notas curtas+commits pequenos.
