# Rodada 6 — sensação e animação

## Achado → correção → prova

1. **Tiro ajoelhado e giro abrupto:** vídeo inicial de 12 s no Templo confirmou perda de silhueta ao sacar. `fire` dos quatro `*_extra.glb` substitui `shoot`; mantém +X da corrida, segura a corda e anima a soltura. **`836e152`**. Fixture mede mão apontando ao lado correto e cabeça a 1,85–2,24 tiles do chão; `tiro-em-pe.png` conferido.
2. **Corrida deslizando:** velocidade genérica de 1,95 ignorava diferenças dos modelos, escala horizontal e mantinha cadência mínima de 60%. Agora usa deslocamento raiz/duração de cada GLB antes de remover root motion. **`47aa648`**. Nos quatro rigs reais, 3,9→7,8 tiles/s dobra exatamente a cadência; cadência × passada = velocidade. Dois testes focados em `tests/render-animation.test.ts` passaram.
3. **Pulo→queda sem mistura:** ambos buscavam tempo na mesma ação; a amostra passava do fim antes de ser limitada. Janelas viraram clipes/ações independentes com clamp do mixer, crossfade inclusive de pose parada e pouso de 140 ms sem atrasar input. **`5bd198f`**. Salto de P1 por teclado em posição inicial explícita, simulação normal: jump tick 1 → fall 63 → land 123 → idle 141; pesos de jump/fall simultâneos comprovam mistura. Prints de pulo/queda/pouso conferidos.
4. **Texturas excessivas:** quatro imagens 4096²→2048², JPEG 92/4:4:4. **`1829fc4`**. Quatro GLBs base: **11,94→5,05 MB (−57,7%)**; memória RGBA+mips estimada **341,3→85,3 MiB (−75%)**, não medição do processo inteiro. Meshopt/rig preservados byte a byte. Comparativo `texturas-4096-vs-2048.png` aberto: sem perda perceptível na câmera do jogo. Os extras de animação acrescentam ~2,86 MB ao carregamento; a redução líquida do conjunto carregado é ~4,03 MB.

## Prova final

`evidence/rodada-6/report.json`: **0 erros** de página/console/HTTP, quatro modelos carregados, **0 falhas de carregamento de áudio**. P1 humano por Playwright keyboard + 3 bots; FPS a 1×, separado da gravação e das capturas:

| Mapa | FPS real 1600×900 | Diagnóstico |
|---|---:|---:|
| Musgo | 60,065 | 59,586 |
| Templo | 60,062 | 59,725 |
| Copas | 60,056 | 59,724 |
| Cachoeira | 60,096 | 59,724 |
| Raízes | 60,100 | 59,725 |

- **Antes:** `evidence/rodada-6/antes/video-antes.mp4`. **Depois:** `evidence/rodada-6/video-depois.mp4`: H.264, **12 s, 1600×900, 25 fps de gravação**, sem áudio. Frames de ambos abertos/conferidos; vídeo posterior inclui tiros, salto, dash, abate e troca de round reais. FPS da gravação não é FPS do jogo.
- Prints dos cinco mapas, tiro, corrida, salto, pouso, comparação de texturas e responsividade conferidos; folhas de frames auxiliares preservadas. Fixtures congeladas são identificadas no script, não alegadas como encontros espontâneos.
- `npm run build`, `check:storybook` e `build-storybook` passaram. Story real `Arena/Animacao real/TiroEmPe`, zero erros; portão em 1366×768, 900×1000 e 844×390 aprovado. Crítica em `ficha-tela.md`.
- Apenas provas focadas, **sem fuzz/suíte inteira**. `src/sim` intocado; `npm test` não executado.
- Tudo pela bancada **tla**, via `/tmp/tla-prova.sh` e fila pesada. Navegadores privados registrados e fechados em `finally`: **0 abas próprias restantes**, preview/Storybook encerrados e vaga liberada. As duas páginas preexistentes do Chromium convencional foram preservadas.

**Limites:** cadência não é foot-lock/IK; mira em movimento ainda usa pose de tiro integral. Queda usa trecho de `jump`, morte continua tombo/dissolução e Storm mantém brilho forte. Nenhum deles é anunciado como resolvido nesta rodada.

Commits no branch **rodada-astra**, **sem push/publicação**. `evidence/rodada-2/` preexistente preservado fora dos commits. A primeira tentativa de gravação falhou por cache do ffmpeg do Playwright na bancada; corrigido o caminho do cache, não o navegador humano.
