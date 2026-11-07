# REA — mapas / 07/11/2026

## Contrato e critério

Atuar apenas em `src/sim/level.ts` e provas próprias, sem mudar UI, renderer, câmera, física ou bot. Storybook não se aplica ao dado de colisão: não houve mudança de componente/tela. Prova visual foi feita na implementação real do jogo. Não foi criado plano como entrega; primeira edição de mapa às 08:31, primeiro commit às 08:35 (Brasília).

Hipótese: a repetição de pares de plataformas e os tetos/muros cegos limitavam tiros diagonais e faziam os mapas terem o mesmo ritmo. Aceite: conservar segurança dos quatro spawns e testes de combate existentes, aumentar os pares de spawn com linha livre nos quatro mapas com 2/6, dar silhueta própria a Copas, provar um tiro normal e um salto entre vizinhos por mapa, sem alterar física.

## Referência literal consultada

Pesquisa em `cofre`, missão `tla-mapas-sol`, por `"Tower of Ascension" game`. Não havia `referencia-pesquisa.md` quando comecei.

Fontes realmente abertas e observadas:
- https://store.steampowered.com/app/1827060/Tower_of_Ascension/?cc=br&l=brazilian — desenvolvedor OwOInteractive; página descreve explicitamente **roguelite tower defense**. Screenshot da página em `anexos/mapas-referencia-literal.png`.
- Imagem da própria galeria (Captura de tela nº 0), aberta e vista: https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/1827060/ss_5823ed4ad9369965e4915c0041f7f0113e3f7e5c.1920x1080.jpg?t=1658239292 — comprovante `anexos/mapas-referencia-tower-of-ascension-1827060.png`.

O resultado de busca também mostrou outro homônimo Steam app 4358720 (cartas/roguelike) e o RPG da Gravity. Não abri esses produtos, portanto não extraio conclusões de screenshots deles. **A identidade pretendida por Lucas continua ambígua; não substituí por TowerFall Ascension.**

## REA curto baseado no que foi visto

- **Referência:** o screenshot literal do app 1827060 usa fundo cinza, massas sólidas pretas com borda vermelha e pequenas peças coloridas. É visto de cima; não é arena de arqueiros em plataformas. Portanto não dá para derivar saltos, wraps nem combate de arco dele.
- **Estado anterior nosso:** nas capturas reais, Musgo tem pares empilhados e duas grandes bases; Totem tem muros altos; Raízes tem bolsões em L; Copas repete a escada dupla da Cachoeira. O fundo e a decoração continuam mais ricos que os da referência, mas deixam a colisão menos óbvia. As seis linhas de tiro fixas mostram apenas 2 livres em quatro mapas.
- **Ação útil sem copiar o jogo errado:** separar massas em vez de cercar corredores, dar espaço vazio legível entre apoios e conservar coberturas isoladas. Mantive assets e fundos aprovados, não apliquei a paleta neon nem o UI do tower defense. Combate e saltos foram validados com a nossa física, não alegados a partir da referência.

## Comparação medida

Seis pares fixos (0–1, 0–2, 0–3, 1–2, 1–3, 2–3) com menor deslocamento toroidal, amostragem de colisão de 0,05 tile. Isso mede visibilidade geométrica, não todas as soluções balísticas.

| Mapa | Linhas livres antes→depois | Mudança útil |
|---|---:|---|
| Musgo | 2→5/6 | Pátio central e galerias deslocadas, bases encurtadas |
| Totem | 6→6/6 | Pilares baixos no lugar de paredes cegas, altar mantido |
| Copas | 2→5/6 | Caminho assimétrico, apoios em alturas alternadas |
| Cachoeira | 2→5/6 | Queda central livre entre bancos externos |
| Raízes | 2→4/6 | Terraços sem bolsões laterais em L |

Os JSONs baseline/after registram posições e distâncias exatas. Cada mapa tem um disparo normal com gravidade, sem flecha bolt, que mata o alvo no simulador real antes de atingir um bloco. O teste não testa só o raio.

## Crítica dos prints realmente vistos

Todos os cinco pares antes/depois foram abertos e vistos, não só produzidos. Capturas na bancada `arrow-mapas`, workspace 30, GPU real, sob `agent-bench fila arrow-mapas rodar`. Dimensão 1366×768, dois personagens Mizu/Stormdragon, seed 42, simulação congelada para comparar geometria. A base antiga foi importada do commit `11f933a` em memória da aba de prova e o dado novo restaurado para os frames depois; nenhum checkout compartilhado foi alterado.

- Musgo: o olho agora atravessa o pátio sem ser barrado por duas lajes longas no meio inferior. A cobertura superior continua útil; não virou área totalmente vazia.
- Totem: os dois muros foram reduzidos a pequenas ilhas. O altar largo inferior mantém identidade de arena de aproximação e os bots do caso existente terminam por combate. A tentativa de abrir também o altar regrediu esse caso e foi descartada.
- Copas: a diagonal assimétrica é visível de imediato, em contraste com os pares anteriores. Um apoio central y=11 foi mantido após o teste concreto seed 42 revelar demora/travamento sem ele. O teste original voltou a passar sem aumentar tempo limite.
- Cachoeira: o vazio central vertical agora é contínuo acima do apoio central; as margens têm posições claras para tiros diagonais. O tema/fundo de Totem foi preservado.
- Raízes: os Ls desapareceram e os terraços deixam as rotas de queda aparentes. É menos labiríntico que antes, sem perder a coroa superior.
- Câmera próxima: print adicional real em `mapas-after-roots-camera-proxima.png`. Mantida a configuração existente; nesse enquadramento P2 está fora da borda direita, com marcador de direção. Não atribuo correção de câmera a esta frente.

Ainda há brilho branco/azulado intenso em Stormdragon e flora brilhante; esses são baseline do renderer e assunto da frente Visual. Não alterei assets ou iluminação para esconder o problema. Os efeitos de proteção de spawn também aparecem porque as capturas estão congeladas no início; não são prova da aparência após expirar a proteção.

## Acesso e limites honestos

Todos os slots reais de baú têm apoio e duas células de altura livres; o grafo do jogo conecta cada spawn a cada plataforma. Isso NÃO prova fisicamente todos os links aproximados (o grafo já existente usa envelope simplificado).

A prova física fixa por mapa usa a colisão real para sair de uma plataforma, saltar para vizinha específica, abrir baú e recuperar flecha onde aterrissou, cruzar a borda horizontal e cair pelo wrap vertical aterrissando em apoio superior. Não é fuzz nem gerador de trajetórias. Não houve playtest humano nem prova exaustiva de cada trajeto.

## Higiene

A aba de pesquisa foi fechada com `finish` no cofre. A única aba da missão de captura foi fechada em `finally` e reconciliada com `finish`; 0 abas próprias mantidas. A vaga pesada foi liberada. Páginas fora do registro não foram tocadas. Bancada própria é encerrada ao concluir; servidor Vite próprio é parado. Prints estão na pasta de anexos do despacho; relatório técnico em `visual-report.json`.
