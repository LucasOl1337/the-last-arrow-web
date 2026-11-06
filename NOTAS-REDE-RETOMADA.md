# Fatia de rede — continuação do despachante às16:26 (06/11 Brasília)

Astra xhigh mantido. Correção curta após recado2, sem nova janela10h. Fechamento ultrapassou o limite aproximado16:27 apenas para validar/publicar a fatia já iniciada.

## Bug concreto e antes/depois

A interpolação começava cada pacote novo na posição-alvo do pacote anterior, mesmo se essa posição ainda não tivesse sido desenhada. Exato: desenho10→12 a25% mostrava10,5; pacote novo14 começava em12, salto1,5unidades. Agora começa em10,5: salto0. Duração usa diferença de ticks, entre8,33 e100ms. Spawn/morte/troca de round não arrastam corpo através do mapa; wrap usa distância toroidal. Posição/colisão/placar continuam do servidor. Sem mudar animações/modelos.

Três regressões exatas passaram: rajada, gap100ms+wrap, respawn+round. Build/typecheck passaram. Prova real em bancada headed1366×768 com WebSocket interceptado: mensagens do servidor entregues em lotes ordenados de100ms, teclado movimenta e dispara (munição cai), simulação avança,0erros JS. Screenshot aberto. Artefatos`evidence/retomada/jitter/`.

Primeira tentativa não carregou: preview herdou base de subdiretório e redirecionou ao caminho antigo após build raiz; ferramenta encerrou a observação, processo conferido morto. Preview reiniciado com`TLA_BASE=/`, prova completou. Não foi timeout de rede do jogo.

**Não comprova:** RTT de internet150/300ms, perda/reconexão,60FPS ou correção de todos os engasgos. Correção trata apenas descontinuidade entre snapshots; predição local, flechas e câmera ainda podem sentir latência. Próxima janela de hill climbing precisa de autorização além da janela original já encerrada; não iniciar outro laço automático em nome deste parcial.
