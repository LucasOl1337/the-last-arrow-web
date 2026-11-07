# Prova visual e integração — 07/11/2026, 11:41 Brasília

Evento real concedeu a vaga `arrow-camera` ao supervisor; nenhuma segunda reserva. Bancada26/CDP19080, GPU NVIDIA RTX4070TiSUPER via ANGLE confirmada no render do rig. Uma aba registrada na missão `camera-continua`, reutilizada por navegação para baseline/câmera/vizinhos/app/rig. Nenhuma aba alheia tocada.

## Câmera: observado, não só calculado
Story `Arena/Camera legibilidade` usa viewport16:9/HUD/renderer reais. Baseline imutável02b128f + mesma fixture em6141; depois d4253ae em6140. Prova repetida no candidato com rig047c94e para detectar interação entre render e HUD.

| Janela | Próxima antes→depois: vivos localizáveis | Corpo empx, inalterado | Badge depois | Área efetiva arena próxima | siTela |
|---|---:|---:|---:|---:|---|
|1366×768|1/2→2/2|124,25|13,66px|99,95%|passou|
|900×1000|1/2→2/2|81,90|12px|50,62%|passou|
|360×800|1/2→2/2|32,76|12px|25,31%|**falhou área40%**, preservado|

Ampla: 2/2 corpos visíveis antes e depois. Corpo25,47px no retrato amplo; área projetada22,59%. Não confundir caixa16:9 com área projetada da arena. Indicador é sinal de direção, não prova de linha de tiro nem minimapa/posição exata.

### Crítica dos PNGs abertos
- Antes1366: o nome Stormy no canto direito parece sobrepor um personagem que não está ali, sem indicar ausência. Depois: contorno/seta branca `→ Stormy Dragon` torna a direção explícita; P1 e terreno mantêm a mesma escala. Tarefa de localizar o adversário dispensa rolagem.
-900ampla: os dois personagens aparecem completos e as setas somem, coerente com o modo. Placar e chão seguem presentes; nenhum enquadramento automático oscila.
-360retrato: badge legível, mas ocupa parcela importante da arena pequena. Placar/rodapé continuam pequenos e o rodapé apertado entre câmera e som. O print não autoriza chamar retrato de resolvido; mantém25,3% e gate vermelho. Não aumentar caixa vazia, esconder HUD ou esticar arte.
- Primeiros prints do app caíram no letreiro transitório LUTEM. Ajustei a **precondição da captura** para aguardar o letreiro desaparecer; não alterei comportamento de produto, asserts ou timing da simulação. Novos PNGs do app e online mostram o campo sem essa cobertura.

Vizinhos renderizados: wrapX/Y, morte/respawn P1 e rival, resize3janelas, próxima/ampla sem mudança de Z por alvo, labels sem colisão com placar/rodapé/som/câmera. Roundtrip mundo→tela→mouse teve erro máximo5,06e-14tiles. App real: cinco presets, câmeraB após reload, C não alterna após rebind, mouse aponta direita/cima, partida WebSocket real com peer e modelos carregados. Zero erros JS.

## ArcoRig — corte entregue e probado em lote
Origem3645f6f, cherry-pick047c94e. Autor entregou worktree limpa e encerrou domínio; não reescrevi fighters/puppet/arrows. Executei8testes focados dele, story real antes/depois e prova no candidato conjunto. Prova render `mechanicalPassed=true`, sem erros JS, arquivos no despacho `evidencias/arco-rig/render/`.

PNG antes/depois de primeiro giro, hold10s, release, crouch e jump foram abertos; detalhes recortados dos próprios PNGs só para inspeção (não substituem captura integral). Flecha passa pela mão também no primeiro frame de giro: erro perpendicular0,45318/0,53556tiles→<1e-14. Hold estável, pulo/agachado preservados, flecha decorativa some no release. Sem defeito visual novo bloqueante observado; diferença de profundidade é discreta em escala normal e mais clara no detalhe.

**Limite de produto explícito:** o arco/corda continuam baked; geometria da arma não foi refeita. O salto entre ponta empunhada e origem física ainda é1,5096/1,6650tiles no caso diagonal invertido. Não afirmar transição espacial perfeita, corda nova ou animação reconstruída. O corte corrige ancoragem/tempo do toque, não esse salto. Projétil físico antes/depois idêntico; não o movemos para ganhar métrica. A story do rig usa canvas100% para inspeção: seu gate não substitui o gate do app emretr ato.

## Artefatos
Brutos no despacho `camera-evidencias/{before,after,integrated}-report.json`, `neighbors-report.json`, `local-game-report.json`, PNGs correspondentes; rig `evidencias/arco-rig/render/render-report.json`. Relatórios copiados para este diretório para rastro Git. Publicação só após trava/ancestral/rooms0, versão e prova pública no próximo marco.
