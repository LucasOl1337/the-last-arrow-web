# Rodada10 — bots e feedback

## Três mudanças de gameplay

1. **Catch sem tempo de reação real:** easy/normal apenas consultavam a flecha a cada360/240ms, mas podiam pegá-la instantaneamente ao vê-la. Agora precisam observar a mesma ameaça por esse tempo, com linha livre; hard mantém interceptação rápida. Caso exato de flecha a78ms do impacto falhava antes/passou depois. `5ba3a51`.
2. **Mira perseguia P1 a120Hz durante saque:** fácil/normal agora fixam a direção e anunciam o tiro por440/280ms; hard preservado. Desviar atrás/acima durante o saque não gira o tiro magicamente. `e2ffeef`.
3. **Rotas iguais:** Storm aproxima; Kaze busca flanco alto; Akane desvia para baús; Mizu mantém exploração equilibrada. Munição zero prioriza abastecimento. Na prova apareceu Totem round5 com39s sem tiro: rota tratava emenda0/32 como queda e os bots oscilavam. Busca da **saída física mais próxima** corrigiu dentro dessa mudança; teste exato desce em<2s. `feba3a2`. Sem mudar spawn,mapas,colisão ou limite90s.

## Medição antes → depois

Mesmo P1 simples congelado em `scripts/p1-rodada-10.mjs`,20 rounds consecutivos por mapa/dificuldade,seed3: **100 rounds por dificuldade em cada versão**. Observa posições a5Hz,anda/pula/atira/dá dash periódico; não usa cérebro dos bots nem previsão de flechas. Vitória abaixo é **de round**, não de partida nem de pessoa real.

| Dificuldade | Vitórias P1 | Round médio | Maior intervalo sem tiro/abate | Timeouts |
|---|---:|---:|---:|---:|
| Fácil |22%→36%|8,83→8,81s|11,88→8,41s|0→0|
| Normal |12%→33%|9,15→8,41s|10,43→8,84s|0→0|

Amostra pequena/um seed: não certifica balanceamento universal; a separação final36%×33% é estreita. Catch de bot caiu62→0 no fácil e106→14 no normal nessa amostra; hard continua com regressão de catch aprovada. Relatórios intermediários, incluindo uma correção incompleta de wrap que deu1 timeout, preservados em `intermediario/`; não são o resultado final.

## Dois polimentos

- Catch: aro claro+“PEGOU!”550ms, hit-stop alvo45ms sem tremor/flash de tela. Catch **real por teclado**, flechas3→4, pausa observada33,4ms discretizada pelo render; movimento reduzido0ms. Expiração/reset conferidos.
- Setas no nome durante corte nas quatro bordas; somem no interior/morte. Travessia horizontal por teclado comprovada. Fixtures posicionadas explicitamente, não encontros espontâneos. `7908d42`.

## Prova final

**P1 humano por Playwright keyboard+3 bots**,18s ativamente pilotados a1× em **cada um dos5 mapas×2 dificuldades**;10s de medição de FPS por configuração. Não partida inteira até5 pontos. Benchmark numérico separado do render.

| Mapa | FPS fácil | FPS normal |
|---|---:|---:|
| Musgo |60,002|60,002|
| Totem |60,003|60,002|
| Copas |60,003|60,002|
| Cachoeira |60,003|60,003|
| Raízes |60,003|59,803|

**0 erros** página/console/HTTP; diagnóstico mínimo58,773FPS, qualidade normal/modelos/áudio íntegros. Baseline~60,00; Raízes normal −0,20FPS, intervalo máximo33,4ms na janela, sem queda abaixo do aceite58. GPU NVIDIA/render privado isolado em`tla`: **não FPS da transmissão Xvnc**.

Build/check:storybook/build-storybook passaram;10 regressões novas+9 casos afetados aprovados (fixture de baú corrigida para declarar bot vivo). Sem suíte inteira/fuzz. Stories reais catch/wrap e portão1366×768,900×1000,844×390; crítica em`ficha-tela.md`. **Todos os PNGs abertos/conferidos**, individualmente ou em folhas `conferencia-*.jpg`.

Fontes: `evidence/rodada-10/{balance,play,juice,story}-report.json`, `summary.json`, baseline`antes/`, logs`validacao/`. Tudo via`/tmp/tla-prova.sh`, bancada`tla` e fila pesada. **0 abas próprias**,2 IDs preexistentes preservados, portas4176/6107/19190 encerradas,fila vazia. Commits no`rodada-astra`, **sem push/publicação**; `evidence/rodada-2/` preservada fora dos commits. Fechado13:49 Brasília,antes do prazo15:45.
