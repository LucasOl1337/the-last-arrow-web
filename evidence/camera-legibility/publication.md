# Publicado e verificado — 07/11/2026, 11:51 Brasília

URL: https://arrow.symbiose.si/
Revisão pública confirmada por fetch no navegador e curl: **a64719071f9258f1dcac9ded9bd60999f23ad26a**.
Release Hostinger: `20261107-114745-a647190`.

Cortes integrados em `sol-integracao` sob `/home/lol/.cache/last-arrow-deploy.lock`:
-19ee333: câmera/indicadores (origem d4253ae).
-13b6262: ArcoRig entregue3645f6f (candidato047c94e).
-65e0b35: provas conjuntas/aba única.
-a647190: permissões do build para Nginx (origem f371a1c).

Checkout master compartilhado intacto. Ancestral público conferido antes de publicar; `publish.sh` verificou rooms0.35testes focados na integração +1teste do bug de permissões passaram; builds TS/Storybook/produção passaram. Nenhuma suíte completa/fuzz, workflow ou migração.

## Achados resolvidos, sem esconder tentativas
Primeiro deploy65e0b35 ativou o serviço mas Nginx retornou403: umask0077 do harness fez o build index/version sair0600; tar preservou permissões. Confirmado via `namei` no destino. Apliquei755nosdiretórios/644nosarquivos **somente dist público** sob trava para restaurar a página, e acrescentei essa normalização ao `deploy/publish.sh`, com teste exato garantindo que arquivo privado fora dedist continua0600. Nova publicaçãoa647190 passou sem reparo manual. Logs anteriores preservados no despacho.

Primeira prova online pósdeploy entrou cedo demais: mundo offline anterior ainda tinha phaseplaying enquanto o handshake de rede ocorria. A espera agora exige evento autoritativo playing do peer e canvas visível, antes de pressionar B. Não relaxei asserts nem mudei o produto; prova corrigida passou. Relatório de timeout preservado.

## Prova pública
-URL/revisão exataa647190, menu carregado, dois modelos reais presentes.
-Cinco presets; rebind câmeraB sobrevive reload; C deixa de alternar; próxima/ampla atualizam marcador corretamente.
-Mouse no app mantém direção de mundo direita/cima (0,904916;−0,425590).
-Partida WebSocket real: peer recebeu36snapshots; B alterna ampla/próxima após início autoritativo; zero errosJS.
-PNGs menu, caso próximo e partida online abertos/criticados. Marcador visível sem LUTEM cobrindo o campo; no online ambos personagens/placar estão presentes.
-Peer encerrado; `/health` ok/rooms0. Não é playtest humano nem prova de todos os estados de rede.

`public-game-report.json` e `integration-tests.txt` neste diretório. PNGs no despacho `camera-evidencias/public-{menu,game-close,online}.png`. Limites de retrato25,3% e transição física do rig1,51/1,67tiles continuam descritos em `visual-review.md`; não foram declarados resolvidos.

Finalização: uma aba registrada usada para toda a missão, fechada porfinish. Nenhuma retida; previews5190/6140/6141/6154/API8890 encerrados; bancadaarrow-camera parada. Supervisor controla e libera a vaga ao término deste executor, sem segunda reserva/relançamento.
